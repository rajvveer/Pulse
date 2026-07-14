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

  return url
    .replace('localhost', expoHost)
    .replace('127.0.0.1', expoHost);
};

const SOCKET_URL = resolveLocalUrl(
  Constants.expoConfig?.extra?.socketUrl || 'http://localhost:3000'
);

let socket = null;
let pendingEmits = []; // Queue for messages sent while disconnected
let connectionAttempts = 0;
// Conversation rooms the user is currently in. Socket.IO rooms are tied to a
// socket id and are LOST on reconnect, so we track them here and re-join on
// every (re)connect — otherwise messaging silently dies after a network blip.
let joinedConversations = new Set();

class SocketService {
  connect(token) {
    if (socket?.connected) {
      console.log('✅ Socket already connected');
      return;
    }

    // Don't create duplicate connections
    if (socket?.connecting) {
      console.log('⏳ Socket connection already in progress...');
      return;
    }

    console.log('🔌 Connecting to socket:', SOCKET_URL);
    connectionAttempts = 0;

    socket = io(SOCKET_URL, {
      auth: { token },
      // ✅ CRITICAL: Use polling first, then upgrade to websocket
      // Mobile networks often block direct WebSocket connections
      transports: ['polling', 'websocket'],
      upgrade: true, // Allow upgrade from polling to websocket

      // ✅ AGGRESSIVE RECONNECTION for mobile data reliability
      reconnection: true,
      reconnectionAttempts: Infinity, // Never stop trying
      reconnectionDelay: 1000,        // Start with 1 second
      reconnectionDelayMax: 10000,    // Max 10 seconds between retries
      randomizationFactor: 0.5,       // Add jitter to prevent thundering herd

      // ✅ LONGER TIMEOUTS for slow mobile networks
      timeout: 60000,                 // 60 second connection timeout
      pingTimeout: 30000,             // 30 second ping timeout
      pingInterval: 25000,            // Ping every 25 seconds

      // ✅ FORCE NEW CONNECTION to avoid stale socket issues
      forceNew: true,

      // ✅ BUFFER MANAGEMENT
      rememberUpgrade: true,          // Remember if upgrade was successful
    });

    // Connection successful
    socket.on('connect', () => {
      connectionAttempts = 0;
      console.log('✅ Connected to Socket.io:', socket.id);
      console.log('📡 Transport:', socket.io.engine.transport.name);

      // Re-join conversation rooms (lost on every new socket id) then
      // flush anything that was queued while offline.
      this._rejoinConversations();
      this._processPendingEmits();
    });

    // Track transport upgrade
    socket.io.engine.on('upgrade', () => {
      console.log('🚀 Socket upgraded to:', socket.io.engine.transport.name);
    });

    // Disconnection handler
    socket.on('disconnect', (reason) => {
      console.log('⚠️ Socket disconnected:', reason);

      // If server disconnected us, we need to manually reconnect
      if (reason === 'io server disconnect') {
        console.log('🔄 Server disconnected us, reconnecting...');
        socket.connect();
      }
    });

    // Connection error handler with detailed logging
    socket.on('connect_error', async (error) => {
      connectionAttempts++;
      console.error(`❌ Connection error (attempt ${connectionAttempts}):`, error.message);

      // ✅ FIX: If auth error (expired token), refresh the token before reconnecting
      if (error.message === 'Authentication error' || error.message?.includes('expired')) {
        console.log('🔑 Socket auth failed — refreshing token for next reconnect...');
        try {
          const freshToken = await AsyncStorage.getItem('accessToken');
          if (freshToken && socket) {
            socket.auth.token = freshToken;
            console.log('✅ Socket auth token updated from storage');
          }
        } catch (e) {
          console.error('❌ Failed to refresh socket token:', e.message);
        }
      }

      // After 3 failed websocket attempts, force polling
      if (connectionAttempts === 3 && socket.io.opts.transports.includes('websocket')) {
        console.log('🔄 Forcing polling-only mode after websocket failures...');
        socket.io.opts.transports = ['polling'];
      }
    });

    // Reconnection events
    socket.on('reconnect', (attemptNumber) => {
      console.log(`🔄 Reconnected after ${attemptNumber} attempts`);
      this._rejoinConversations();
      this._processPendingEmits();
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`🔄 Reconnection attempt ${attemptNumber}...`);
    });

    socket.on('reconnect_error', (error) => {
      console.error('❌ Reconnection error:', error.message);
    });

    socket.on('reconnect_failed', () => {
      console.error('💀 All reconnection attempts failed');
    });

    // Generic error handler
    socket.on('error', (error) => {
      console.error('❌ Socket error:', error);
    });
  }

  disconnect() {
    if (socket) {
      console.log('👋 Disconnecting socket');
      socket.disconnect();
      socket = null;
      pendingEmits = [];
      connectionAttempts = 0;
      joinedConversations.clear();
    }
  }

  // ✅ Re-join every active conversation room after a (re)connect.
  _rejoinConversations() {
    if (joinedConversations.size === 0) return;
    console.log(`🚪 Re-joining ${joinedConversations.size} conversation room(s)...`);
    joinedConversations.forEach((conversationId) => {
      if (socket?.connected) {
        socket.emit('join_conversation', { conversationId });
      }
    });
  }

  // ✅ Process queued messages after reconnection
  _processPendingEmits() {
    if (pendingEmits.length > 0) {
      console.log(`📤 Processing ${pendingEmits.length} queued messages...`);
      const toProcess = [...pendingEmits];
      pendingEmits = [];

      toProcess.forEach(({ event, data, callback }) => {
        this.emit(event, data, callback);
      });
    }
  }

  // ✅ IMPROVED EMIT METHOD with queuing
  emit(event, data, callback) {
    if (!socket) {
      console.error('❌ Socket not initialized');
      if (callback) callback({ status: 'error', message: 'Socket not initialized' });
      return;
    }

    // If not connected, queue the message (except for certain events)
    if (!socket.connected) {
      const noQueueEvents = ['typing_start', 'typing_stop'];

      if (!noQueueEvents.includes(event)) {
        // Only log non-typing queued events to avoid spam
        if (pendingEmits.length < 3) {
          console.log(`⏳ Socket not connected, queuing: ${event}`);
        }
        pendingEmits.push({ event, data, callback });
        return;
      } else {
        // Silently skip typing events when disconnected
        return;
      }
    }

    console.log(`📤 Emitting: ${event}`, data);

    if (callback) {
      socket.emit(event, data, callback);
    } else {
      socket.emit(event, data);
    }
  }

  // ✅ GENERAL ON METHOD
  on(event, callback) {
    if (!socket) {
      console.error('❌ Socket not initialized for event:', event);
      return;
    }
    socket.on(event, callback);
  }

  // ✅ GENERAL OFF METHOD
  off(event, callback) {
    if (!socket) return;
    if (callback) {
      socket.off(event, callback);
    } else {
      socket.off(event);
    }
  }

  joinConversation(conversationId) {
    if (!conversationId) return;
    // Remember it so we can re-join automatically after any reconnect.
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

  onNewMessage(callback) {
    this.on('new_message', callback);
  }

  onTyping(callback) {
    this.on('user_typing', callback);
  }

  startTyping(conversationId) {
    this.emit('typing_start', { conversationId });
  }

  stopTyping(conversationId) {
    this.emit('typing_stop', { conversationId });
  }

  removeListener(eventName, callback) {
    this.off(eventName, callback);
  }

  // ✅ CONNECTION STATE HELPERS
  get isConnected() {
    return socket?.connected || false;
  }

  // ✅ Update token (call this after HTTP token refresh)
  updateToken(newToken) {
    if (socket) {
      socket.auth.token = newToken;
      console.log('🔑 Socket auth token updated');

      // If disconnected due to auth, reconnect with new token
      if (!socket.connected) {
        console.log('🔄 Reconnecting socket with fresh token...');
        socket.connect();
      }
    }
  }

  get isConnecting() {
    return socket?.connecting || false;
  }

  get connectionState() {
    if (!socket) return 'disconnected';
    if (socket.connected) return 'connected';
    if (socket.connecting) return 'connecting';
    return 'disconnected';
  }

  // Expose the socket instance getter
  get socket() {
    return socket;
  }
}

export default new SocketService();
