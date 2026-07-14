import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// ============================================================
// SOCKET CONFIGURATION
// ------------------------------------------------------------
// The C++ backend speaks RAW WebSocket (one JSON text frame per event,
// `{ event, data, ack? }`), NOT Socket.IO's Engine.IO protocol. So this client
// is a thin raw-WebSocket wrapper that preserves the previous socketService
// public API (connect/emit/on/off/joinConversation/sendMessage/...) plus a
// `.socket` shim, so the screens (ChatScreen, ShareToDMSheet) work unchanged.
//
// Wire contract (see backend src/sockets/realtime_controller.cc):
//   - Connect:  ws://host:3000/ws?token=<accessToken>
//   - Send:     { event, data, ack? }   (ack = numeric id for a callback)
//   - Receive:  { event, data }         (server->client events)
//   - Ack:      { event:'ack', ack:<id>, data }  (reply to an emit with ack)
// ============================================================
const getExpoHost = () => {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest?.debuggerHost ||
    Constants.manifest2?.extra?.expoClient?.hostUri;
  return hostUri?.split(':')[0];
};

const resolveLocalUrl = (url) => {
  const expoHost = getExpoHost();
  if (!expoHost || expoHost === 'localhost' || expoHost === '127.0.0.1') {
    return url;
  }
  return url.replace('localhost', expoHost).replace('127.0.0.1', expoHost);
};

// socketUrl is http(s)://host:port — convert to the ws(s):// scheme + /ws path.
const HTTP_URL = resolveLocalUrl(
  Constants.expoConfig?.extra?.socketUrl || 'http://localhost:3000'
);
const WS_BASE = HTTP_URL.replace(/^http/i, 'ws').replace(/\/+$/, '') + '/ws';

let ws = null;
let token = null;
let manualClose = false;          // true when we intentionally disconnect()
let reconnectTimer = null;
let reconnectAttempts = 0;
let authFailures = 0;             // consecutive 1008/auth closes -> give-up ceiling
let pendingEmits = [];            // queued while disconnected
let joinedConversations = new Set();
const listeners = new Map();      // event -> Set<callback>
const ackCallbacks = new Map();   // ackId -> { cb, timer }
let ackCounter = 1;

const RECONNECT_BASE = 1000;
const RECONNECT_MAX = 30000;      // wider steady-state window (full jitter spreads herd)
const MAX_AUTH_FAILURES = 5;      // stop hammering after repeated auth rejections
const PENDING_MAX = 100;          // cap offline queue; drop-oldest beyond this
const ACK_TIMEOUT_MS = 30000;
// Transient/idempotent events that should NOT pile up while offline. Typing is
// dropped entirely; mark_seen/reactions coalesce to the latest per key.
const NO_QUEUE_EVENTS = ['typing_start', 'typing_stop', 'typing', 'stop_typing'];
const COALESCE_EVENTS = ['mark_seen', 'message_seen', 'add_reaction', 'remove_reaction'];

const log = (...a) => { if (__DEV__) console.log(...a); };

// Dispatch a received event to all registered listeners.
const dispatch = (event, data) => {
  const set = listeners.get(event);
  if (!set) return;
  set.forEach((cb) => {
    try { cb(data); } catch (e) { if (__DEV__) console.error('socket listener error', e); }
  });
};

class SocketService {
  connect(accessToken) {
    token = accessToken || token;
    if (!token) { log('❌ Socket connect called without token'); return; }
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      log('✅ Socket already connected/connecting');
      return;
    }
    manualClose = false;
    authFailures = 0;
    this._open();
  }

  // Single guarded path to open a socket. Always clears any pending reconnect
  // timer and tears down any existing ws first, so concurrent callers
  // (connect / updateToken / a firing reconnectTimer) can never create two
  // live sockets for one user.
  _open() {
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      log('⏳ _open ignored — socket already open/connecting');
      return;
    }
    if (ws) { try { ws.onclose = null; ws.close(); } catch {} ws = null; }

    const url = `${WS_BASE}?token=${encodeURIComponent(token)}`;
    log('🔌 Connecting to socket:', WS_BASE);
    try {
      ws = new WebSocket(url);
    } catch (e) {
      log('❌ Socket construct failed:', e?.message);
      this._scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      reconnectAttempts = 0;
      authFailures = 0;
      log('✅ Connected to WebSocket');
      this._rejoinConversations();
      this._processPendingEmits();
      dispatch('connect', undefined);
    };

    ws.onmessage = (evt) => {
      let frame;
      try { frame = JSON.parse(evt.data); } catch { return; }
      if (!frame || typeof frame !== 'object') return;

      // Ack reply -> resolve the stored callback and clear its timeout.
      if (frame.event === 'ack' && frame.ack != null) {
        const entry = ackCallbacks.get(frame.ack);
        if (entry) {
          ackCallbacks.delete(frame.ack);
          if (entry.timer) clearTimeout(entry.timer);
          try { entry.cb(frame.data); } catch {}
        }
        return;
      }
      if (frame.event) dispatch(frame.event, frame.data);
    };

    ws.onerror = (e) => {
      log('❌ Socket error:', e?.message || e);
      dispatch('error', e);
    };

    ws.onclose = async (e) => {
      log('⚠️ Socket closed:', e?.code, e?.reason);
      ws = null;
      // Fail any in-flight ack callbacks so the UI can mark temp messages
      // 'failed' instead of leaving them stuck on 'sending' forever.
      this._failPendingAcks();
      dispatch('disconnect', e?.reason);
      if (manualClose) return;

      // 1008 / auth failures -> refresh token from storage before retrying,
      // with a give-up ceiling so an expired session can't loop forever.
      const isAuth = e?.code === 1008 || /auth|expired|token/i.test(e?.reason || '');
      if (isAuth) {
        authFailures += 1;
        if (authFailures >= MAX_AUTH_FAILURES) {
          log('🛑 Giving up reconnect after repeated auth failures — awaiting updateToken()');
          return; // updateToken() (after a real refresh/login) resumes us
        }
        try {
          const fresh = await AsyncStorage.getItem('accessToken');
          if (fresh) token = fresh;
        } catch {}
      }
      this._scheduleReconnect();
    };
  }

  // Reject every in-flight ack callback (connection lost before the server
  // acked). Lets ChatScreen flip optimistic 'sending' messages to 'failed'.
  _failPendingAcks() {
    ackCallbacks.forEach(({ cb, timer }) => {
      if (timer) clearTimeout(timer);
      try { cb({ status: 'error', message: 'disconnected' }); } catch {}
    });
    ackCallbacks.clear();
  }

  _scheduleReconnect() {
    if (manualClose || reconnectTimer) return;
    reconnectAttempts += 1;
    // Full jitter: random in [0, cap] where cap grows exponentially. This
    // spreads a fleet of clients across the whole window after a server outage
    // instead of clustering them in a narrow band (no thundering herd).
    const cap = Math.min(RECONNECT_BASE * Math.pow(2, reconnectAttempts - 1), RECONNECT_MAX);
    const delay = Math.random() * cap;
    log(`🔄 Reconnecting in ${Math.round(delay)}ms (attempt ${reconnectAttempts})`);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (!manualClose && token) this._open();
    }, delay);
  }

  disconnect() {
    log('👋 Disconnecting socket');
    manualClose = true;
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    if (ws) { try { ws.onclose = null; ws.close(); } catch {} ws = null; }
    this._failPendingAcks();
    pendingEmits = [];
    joinedConversations.clear();
    reconnectAttempts = 0;
    authFailures = 0;
  }

  _rejoinConversations() {
    if (joinedConversations.size === 0) return;
    log(`🚪 Re-joining ${joinedConversations.size} conversation room(s)...`);
    joinedConversations.forEach((conversationId) => {
      this._rawSend('join_conversation', { conversationId });
    });
  }

  _processPendingEmits() {
    if (pendingEmits.length === 0) return;
    log(`📤 Processing ${pendingEmits.length} queued messages...`);
    const toProcess = [...pendingEmits];
    pendingEmits = [];
    // Drain on the next ticks so a big offline backlog doesn't burst the
    // freshly-opened socket in one synchronous flood (avoids server rate-limit).
    let i = 0;
    const drain = () => {
      if (!this.isConnected) { // dropped mid-flush; re-queue the rest
        pendingEmits = toProcess.slice(i).concat(pendingEmits);
        return;
      }
      const batch = toProcess.slice(i, i + 10);
      batch.forEach(({ event, data, callback }) => this.emit(event, data, callback));
      i += batch.length;
      if (i < toProcess.length) setTimeout(drain, 50);
    };
    drain();
  }

  // Low-level frame send; returns true if it went out.
  _rawSend(event, data, callback) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    const frame = { event, data };
    if (callback) {
      const id = ackCounter++;
      // Store the callback with its own timeout so we can clear it on ack/teardown.
      const timer = setTimeout(() => {
        const entry = ackCallbacks.get(id);
        if (entry) { ackCallbacks.delete(id); try { entry.cb({ status: 'error', message: 'timeout' }); } catch {} }
      }, ACK_TIMEOUT_MS);
      ackCallbacks.set(id, { cb: callback, timer });
      frame.ack = id;
    }
    try { ws.send(JSON.stringify(frame)); return true; }
    catch (e) { log('❌ send failed:', e?.message); return false; }
  }

  emit(event, data, callback) {
    if (this._rawSend(event, data, callback)) {
      log(`📤 Emitting: ${event}`);
      return;
    }
    // Not connected. Transient typing events are dropped (stale instantly).
    if (NO_QUEUE_EVENTS.includes(event)) return;

    // Idempotent events coalesce to the latest per (event + conversation/message)
    // so a long offline stretch can't pile up hundreds of stale mark_seen frames.
    if (COALESCE_EVENTS.includes(event)) {
      const key = data?.conversationId || data?.messageId || '';
      const idx = pendingEmits.findIndex(
        (p) => p.event === event && ((p.data?.conversationId || p.data?.messageId || '') === key)
      );
      if (idx >= 0) { pendingEmits[idx] = { event, data, callback }; return; }
    }

    pendingEmits.push({ event, data, callback });
    // Bound the queue: drop the OLDEST non-message frame, else the oldest entry.
    if (pendingEmits.length > PENDING_MAX) {
      const dropIdx = pendingEmits.findIndex((p) => p.event !== 'send_message');
      pendingEmits.splice(dropIdx >= 0 ? dropIdx : 0, 1);
    }
    if (pendingEmits.length <= 3) log(`⏳ Socket not connected, queuing: ${event}`);
  }

  on(event, callback) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(callback);
  }

  off(event, callback) {
    const set = listeners.get(event);
    if (!set) return;
    if (callback) set.delete(callback);
    else listeners.delete(event);
  }

  joinConversation(conversationId) {
    if (!conversationId) return;
    joinedConversations.add(conversationId);
    this.emit('join_conversation', { conversationId });
  }

  leaveConversation(conversationId) {
    if (!conversationId) return;
    joinedConversations.delete(conversationId);
    this.emit('leave_conversation', { conversationId });
  }

  sendMessage(payload, callback) {
    this.emit('send_message', payload, callback);
  }

  onNewMessage(callback) { this.on('new_message', callback); }
  onTyping(callback) { this.on('user_typing', callback); }
  startTyping(conversationId) { this.emit('typing_start', { conversationId }); }
  stopTyping(conversationId) { this.emit('typing_stop', { conversationId }); }
  removeListener(eventName, callback) { this.off(eventName, callback); }

  get isConnected() { return !!ws && ws.readyState === WebSocket.OPEN; }
  get isConnecting() { return !!ws && ws.readyState === WebSocket.CONNECTING; }
  get connectionState() {
    if (!ws) return 'disconnected';
    if (ws.readyState === WebSocket.OPEN) return 'connected';
    if (ws.readyState === WebSocket.CONNECTING) return 'connecting';
    return 'disconnected';
  }

  updateToken(newToken) {
    if (!newToken) return;
    token = newToken;
    authFailures = 0; // a genuine refresh — allow reconnects again after give-up
    log('🔑 Socket auth token updated');
    if (!this.isConnected && !this.isConnecting && !manualClose) {
      log('🔄 Reconnecting socket with fresh token...');
      this._open();
    }
  }

  // ── .socket shim ───────────────────────────────────────────────────────────
  // ChatScreen accesses socketService.socket.{on,off,emit,connected} directly
  // (it was the raw socket.io instance). Expose a compatible facade. It is a
  // SINGLE memoized object (not rebuilt per access) so reference checks and any
  // `if (socketService.socket)` truthiness are stable. NOTE: prefer
  // socketService.isConnected for connection guards — `.socket` is always truthy.
  get socket() {
    if (!this._shim) {
      const self = this;
      this._shim = {
        on: (event, cb) => self.on(event, cb),
        off: (event, cb) => self.off(event, cb),
        emit: (event, data, cb) => self.emit(event, data, cb),
        connect: () => self.connect(token),
        disconnect: () => self.disconnect(),
        get connected() { return self.isConnected; },
        get connecting() { return self.isConnecting; },
      };
    }
    return this._shim;
  }
}

export default new SocketService();
