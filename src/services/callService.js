// callService.js — the call control plane on the client.
//
// Responsibilities:
//   * Drive call state (idle / outgoing / incoming / connected / ended) and
//     publish it to whoever is listening (the call screens subscribe).
//   * Speak the signaling protocol over the EXISTING raw-WebSocket socket
//     (socketService): emit call_invite/accept/reject/cancel/end and listen for
//     incoming_call / call_accepted / call_rejected / call_cancelled /
//     call_busy / call_ended. Media never goes over this socket.
//   * Talk to the REST control plane for LiveKit credentials
//     (POST /calls/initiate, /calls/token).
//   * Route the UI: a fresh incoming call (over ws OR via push) navigates to
//     IncomingCallScreen through the global navigationRef; placing a call
//     navigates to OutgoingCallScreen; both swap to CallScreen once connected.
//
// The actual LiveKit room connect/disconnect lives in CallScreen (it owns the
// React/AudioSession lifecycle and renders the tracks). This service hands
// CallScreen everything it needs (wsUrl + token + room) via the active call.
//
// Identity / dedup: the backend stamps `from` server-side, and the same logical
// event arrives under two aliases (underscore + hyphen). We register ONE
// listener per canonical event name; socketService dispatches by exact event
// string, so to catch both we subscribe to both but guard with the callId so a
// duplicate (same callId, same phase) is ignored.
import api from './api';
import socketService from './socket';
import * as nav from '../navigation/navigationRef';

// ── Call states ──
export const CallState = {
  IDLE: 'idle',
  OUTGOING: 'outgoing',   // we placed a call, waiting for accept
  INCOMING: 'incoming',   // someone is ringing us
  CONNECTING: 'connecting', // accepted, fetching token / joining room
  CONNECTED: 'connected', // media flowing
  ENDED: 'ended',
};

const log = (...a) => { if (__DEV__) console.log('[call]', ...a); };

// Server -> client signaling events (both aliases). We register on each.
const INCOMING_EVENTS = ['incoming_call', 'incoming-call'];
const ACCEPTED_EVENTS = ['call_accepted', 'call-accepted'];
const REJECTED_EVENTS = ['call_rejected', 'call-rejected'];
const CANCELLED_EVENTS = ['call_cancelled', 'call-cancelled'];
const BUSY_EVENTS = ['call_busy', 'call-busy'];
const ENDED_EVENTS = ['call_ended', 'call-ended'];

class CallService {
  constructor() {
    this.state = CallState.IDLE;
    this.call = null;          // active call descriptor (see _makeCall)
    this.listeners = new Set();// state subscribers (call screens)
    this._wired = false;       // socket listeners installed?
    this._boundHandlers = {};  // event -> handler (for off())
    this._processedInvites = new Set(); // callIds we've already rung for (push+ws dedupe)
  }

  // ── Public: lifecycle wiring ──────────────────────────────────────────────
  // Install the socket signaling listeners. Idempotent; call after the socket
  // service exists (e.g. once on app start after auth). Safe to call repeatedly.
  init() {
    if (this._wired) return;
    this._wired = true;

    const bind = (events, fn) => {
      events.forEach((ev) => {
        const h = (data) => fn(data || {});
        this._boundHandlers[ev] = h;
        socketService.on(ev, h);
      });
    };

    bind(INCOMING_EVENTS, (d) => this._onIncoming(d));
    bind(ACCEPTED_EVENTS, (d) => this._onAccepted(d));
    bind(REJECTED_EVENTS, (d) => this._onRejected(d));
    bind(CANCELLED_EVENTS, (d) => this._onCancelled(d));
    bind(BUSY_EVENTS, (d) => this._onBusy(d));
    bind(ENDED_EVENTS, (d) => this._onEnded(d));
    log('signaling listeners installed');
  }

  teardown() {
    if (!this._wired) return;
    Object.entries(this._boundHandlers).forEach(([ev, h]) => socketService.off(ev, h));
    this._boundHandlers = {};
    this._wired = false;
  }

  // ── Public: state subscription (call screens) ─────────────────────────────
  subscribe(cb) {
    this.listeners.add(cb);
    // push current snapshot immediately
    try { cb(this.snapshot()); } catch {}
    return () => this.listeners.delete(cb);
  }

  snapshot() {
    return { state: this.state, call: this.call };
  }

  _emit() {
    const snap = this.snapshot();
    this.listeners.forEach((cb) => { try { cb(snap); } catch {} });
  }

  _setState(state, patch) {
    this.state = state;
    if (patch && this.call) this.call = { ...this.call, ...patch };
    this._emit();
  }

  _makeCall(fields) {
    // Canonical active-call descriptor used by every screen.
    this.call = {
      callId: fields.callId || null,
      conversationId: fields.conversationId || null,
      room: fields.room || null,
      token: fields.token || null,
      wsUrl: fields.wsUrl || null,
      callType: fields.callType === 'video' ? 'video' : 'audio',
      direction: fields.direction,             // 'outgoing' | 'incoming'
      peer: fields.peer || null,               // { _id, username, name, avatar }
      peerId: fields.peerId || null,           // the other user's id (to:)
      startedAt: null,                         // set when CONNECTED
      ...fields,
    };
    return this.call;
  }

  isBusy() {
    return this.state !== CallState.IDLE && this.state !== CallState.ENDED;
  }

  // ── Public: place a call (caller) ─────────────────────────────────────────
  // peer: { _id/id, username, name, avatar } — the user we're calling.
  async startCall({ conversationId, peer, calleeId, callType = 'audio' }) {
    if (this.isBusy()) { log('startCall ignored — already busy'); return; }
    const peerId = calleeId || peer?._id || peer?.id || peer;
    this._makeCall({
      direction: 'outgoing', conversationId, callType,
      peer: typeof peer === 'object' ? peer : null, peerId,
    });
    this._setState(CallState.OUTGOING);
    nav.navigate('OutgoingCallScreen', {});

    try {
      // Ask the server to allocate the room + our LiveKit token, and to push the
      // callee. Returns { callId, room, token, wsUrl, callType, callee, caller }.
      const res = await api.post('/calls/initiate', {
        conversationId,
        calleeId: peerId,
        callType,
      });
      const d = res.data || {};
      if (!d.success && !d.token) throw new Error(d.error || 'initiate failed');

      this._setState(CallState.OUTGOING, {
        callId: d.callId, room: d.room, token: d.token, wsUrl: d.wsUrl,
        callType: d.callType || callType, peerId: d.callee || peerId,
      });

      // Also ring over ws for a foregrounded peer (push covers backgrounded).
      socketService.emit('call_invite', {
        callId: d.callId, conversationId, to: d.callee || peerId,
        room: d.room, callType: d.callType || callType,
      });
      log('call initiated', d.callId, '->', d.callee);
    } catch (e) {
      log('startCall failed', e?.response?.data || e?.message);
      this.endCall('error');
    }
  }

  // ── Public: accept an incoming call (callee) ──────────────────────────────
  async acceptCall() {
    if (this.state !== CallState.INCOMING || !this.call) return;
    const { callId, conversationId, room, peerId, callType } = this.call;
    this._setState(CallState.CONNECTING);
    try {
      // Mint our own join token for the room the caller allocated.
      const res = await api.post('/calls/token', { room });
      const d = res.data || {};
      if (!d.token) throw new Error(d.error || 'token failed');
      this._setState(CallState.CONNECTING, { token: d.token, wsUrl: d.wsUrl });
      // Tell the caller we accepted so they stop ringing and stay in the room.
      socketService.emit('call_accept', { callId, conversationId, to: peerId, room });
      // Move to the live call UI; CallScreen connects the LiveKit room.
      nav.replace('CallScreen', {});
    } catch (e) {
      log('acceptCall failed', e?.response?.data || e?.message);
      this.endCall('error');
    }
  }

  // ── Public: decline an incoming call (callee) ─────────────────────────────
  rejectCall() {
    if (!this.call) { this._reset(); return; }
    const { callId, conversationId, peerId } = this.call;
    socketService.emit('call_reject', { callId, conversationId, to: peerId });
    this._finish('rejected');
  }

  // ── Public: caller cancels before the callee answers ──────────────────────
  cancelCall() {
    if (!this.call) { this._reset(); return; }
    const { callId, conversationId, peerId } = this.call;
    socketService.emit('call_cancel', { callId, conversationId, to: peerId });
    this._finish('cancelled');
  }

  // ── Public: hang up a connected (or any) call ─────────────────────────────
  endCall(reason = 'ended') {
    if (!this.call) { this._reset(); return; }
    const { callId, conversationId, peerId } = this.call;
    // Notify the peer + clear server call state (best-effort).
    socketService.emit('call_end', { callId, conversationId, to: peerId });
    if (callId) api.post('/calls/end', { callId }).catch(() => {});
    this._finish(reason);
  }

  // Called by CallScreen once the LiveKit room reports connected.
  markConnected() {
    if (this.state === CallState.CONNECTING || this.state === CallState.OUTGOING) {
      this.call.startedAt = Date.now();
      this._setState(CallState.CONNECTED);
    }
  }

  // ── Incoming-call entry (used by both ws and the push handler) ────────────
  // data: { callId, room, conversationId, callType, callerId/from, callerName,
  //         callerAvatar } — push uses caller*, ws uses from + a peer lookup.
  presentIncoming(data) {
    if (!data || !data.callId) return;
    // Dedup: a call rings over BOTH the ws invite and the FCM/Expo push.
    if (this._processedInvites.has(data.callId)) {
      log('duplicate invite ignored', data.callId);
      return;
    }
    // If we're already in a call, auto-busy the new caller.
    if (this.isBusy()) {
      const from = data.from || data.callerId;
      if (from) socketService.emit('call_busy', { callId: data.callId, to: from, conversationId: data.conversationId });
      log('busy — auto-rejected incoming', data.callId);
      return;
    }
    this._processedInvites.add(data.callId);

    const peerId = data.from || data.callerId;
    this._makeCall({
      direction: 'incoming',
      callId: data.callId,
      conversationId: data.conversationId,
      room: data.room,
      callType: data.callType,
      peerId,
      peer: {
        _id: peerId,
        username: data.callerName || data.username,
        name: data.callerName || data.name,
        avatar: data.callerAvatar || data.avatar,
      },
    });
    this._setState(CallState.INCOMING);

    // Navigate to the ring screen (retry briefly if navigation isn't ready yet,
    // e.g. a cold launch from a push).
    if (!nav.navigate('IncomingCallScreen', {})) {
      let tries = 0;
      const t = setInterval(() => {
        tries += 1;
        if (nav.navigate('IncomingCallScreen', {}) || tries > 20) clearInterval(t);
      }, 250);
    }
  }

  // ── Signaling handlers ────────────────────────────────────────────────────
  _onIncoming(d) { this.presentIncoming(d); }

  _onAccepted(d) {
    // The callee accepted. We (caller) move to the live call UI.
    if (this.state !== CallState.OUTGOING || !this.call) return;
    if (d.callId && this.call.callId && d.callId !== this.call.callId) return;
    this._setState(CallState.CONNECTING);
    nav.replace('CallScreen', {});
  }

  _onRejected(d) {
    if (!this._matches(d)) return;
    this._finish('rejected');
  }

  _onCancelled(d) {
    if (!this._matches(d)) return;
    this._finish('cancelled');
  }

  _onBusy(d) {
    if (!this._matches(d)) return;
    this._finish('busy');
  }

  _onEnded(d) {
    if (!this._matches(d)) return;
    this._finish('ended');
  }

  _matches(d) {
    if (!this.call) return false;
    if (d && d.callId && this.call.callId) return d.callId === this.call.callId;
    return true; // no callId on the frame — apply to the active call
  }

  // ── Teardown helpers ──────────────────────────────────────────────────────
  _finish(reason) {
    log('call finished:', reason);
    this._setState(CallState.ENDED, { endReason: reason });
    // Leave the call screens.
    nav.goBackFromCall();
    // Reset shortly after so screens can render a final "ended" frame.
    setTimeout(() => this._reset(), 400);
  }

  _reset() {
    this.state = CallState.IDLE;
    this.call = null;
    this._emit();
    // Keep _processedInvites bounded.
    if (this._processedInvites.size > 50) this._processedInvites.clear();
  }
}

export default new CallService();
