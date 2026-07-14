// CallScreen — the live, connected call. Owns the LiveKit Room lifecycle:
// connects with the active call's { wsUrl, token, room }, publishes mic (+ camera
// for video), renders the remote participant's video (and a local preview), and
// exposes mute / speaker / flip-camera / end-call controls.
//
// LiveKit RN v2 specifics (verified against the v2 docs):
//   * Rendering uses <VideoTrack trackRef={TrackReference}> where TrackReference
//     is { participant, publication, source } — NOT a raw track. We therefore
//     keep the *publications* (+ their participants) in state, not bare tracks.
//   * registerGlobals(), VideoTrack and AudioSession come from
//     '@livekit/react-native'; Room/RoomEvent/Track come from 'livekit-client'
//     (re-exported by @livekit/react-native). We require() them lazily so the JS
//     bundle still loads in plain Expo Go (no native module) — the screen shows a
//     "needs a dev build" message instead of crashing the bundle at import time.
//   * Speaker toggle is AudioSession.selectAudioOutput('speaker'|'earpiece')
//     (there is no setSpeakerphoneOn in v2).
//   * Camera flip is room.switchActiveDevice('videoinput', deviceId), choosing the
//     opposite-facing device from mediaDevices.enumerateDevices().
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, StatusBar, ActivityIndicator, AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import callService, { CallState } from '../../services/callService';

const AVATAR_PLACEHOLDER = 'https://via.placeholder.com/120';

// Lazy-load the LiveKit native bits. Null when the native module isn't present
// (e.g. plain Expo Go before a dev build).
let LK = null;
function loadLiveKit() {
  if (LK) return LK;
  try {
    // eslint-disable-next-line global-require
    const rn = require('@livekit/react-native');   // RN render + audio + globals
    // eslint-disable-next-line global-require
    const client = require('livekit-client');       // Room / RoomEvent / Track
    LK = {
      Room: client.Room,
      RoomEvent: client.RoomEvent,
      Track: client.Track,
      VideoTrack: rn.VideoTrack,     // RN render component
      AudioSession: rn.AudioSession,
      registerGlobals: rn.registerGlobals,
    };
    // mediaDevices for camera flip (from the webrtc package).
    try {
      // eslint-disable-next-line global-require
      LK.mediaDevices = require('@livekit/react-native-webrtc').mediaDevices;
    } catch {}
    if (LK.registerGlobals) LK.registerGlobals();
  } catch (e) {
    if (__DEV__) console.warn('[call] LiveKit native module not available:', e?.message);
    LK = null;
  }
  return LK;
}

function fmtDuration(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = String(s % 60).padStart(2, '0');
  return `${m}:${sec}`;
}

// Build a TrackReference { participant, publication, source } for a video pub.
function videoRef(participant, publication) {
  if (!participant || !publication) return null;
  return { participant, publication, source: publication.source };
}

export default function CallScreen({ navigation }) {
  const [snap, setSnap] = useState(callService.snapshot());
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(false);
  const [frontCamera, setFrontCamera] = useState(true);
  const [remoteRef, setRemoteRef] = useState(null); // TrackReference
  const [localRef, setLocalRef] = useState(null);   // TrackReference
  const [elapsed, setElapsed] = useState(0);

  const roomRef = useRef(null);
  const startedRef = useRef(false);

  const call = snap.call || {};
  const peer = call.peer || {};
  const isVideo = call.callType === 'video';
  const name = peer.username || peer.name || 'In call';
  const avatar = peer.avatar || AVATAR_PLACEHOLDER;

  useEffect(() => callService.subscribe(setSnap), []);

  // Leave when the call ends from signaling.
  useEffect(() => {
    if (snap.state === CallState.IDLE || snap.state === CallState.ENDED) {
      if (navigation.canGoBack()) navigation.goBack();
    }
  }, [snap.state]);

  // Duration ticker once connected.
  useEffect(() => {
    if (!connected) return;
    const startedAt = call.startedAt || Date.now();
    const t = setInterval(() => setElapsed(Date.now() - startedAt), 1000);
    return () => clearInterval(t);
  }, [connected]);

  const refreshTracks = useCallback((room) => {
    if (!room) return;
    const lk = loadLiveKit();
    const VideoKind = lk?.Track?.Kind?.Video ?? 'video';

    // Remote video: first subscribed video publication across remote participants.
    let rRef = null;
    room.remoteParticipants.forEach((p) => {
      if (rRef) return;
      p.trackPublications.forEach((pub) => {
        if (!rRef && pub.kind === VideoKind && pub.isSubscribed && pub.track) {
          rRef = videoRef(p, pub);
        }
      });
    });
    setRemoteRef(rRef);

    // Local camera preview.
    let lRef = null;
    const lp = room.localParticipant;
    lp.trackPublications.forEach((pub) => {
      if (!lRef && pub.kind === VideoKind && pub.track) lRef = videoRef(lp, pub);
    });
    setLocalRef(lRef);
  }, []);

  // Connect to the LiveKit room (once).
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const lk = loadLiveKit();
    const { wsUrl, token } = call;
    if (!lk || !lk.Room) {
      setError('Calling requires a dev build (LiveKit native module missing). Run "npx expo run:android".');
      return;
    }
    if (!wsUrl || !token) { setError('Missing call credentials.'); return; }

    let room;
    let cancelled = false;
    const { RoomEvent } = lk;

    (async () => {
      try {
        // Prefer speaker for a video call, earpiece for a voice call by default.
        try {
          await lk.AudioSession?.configureAudio?.({
            android: { preferredOutputList: [isVideo ? 'speaker' : 'earpiece'] },
            ios: { defaultOutput: isVideo ? 'speaker' : 'earpiece' },
          });
        } catch {}
        setSpeakerOn(isVideo);
        await lk.AudioSession?.startAudioSession?.();

        room = new lk.Room({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;

        room
          .on(RoomEvent.Connected, () => {
            if (cancelled) return;
            setConnected(true);
            callService.markConnected();
            refreshTracks(room);
          })
          .on(RoomEvent.Disconnected, () => {
            if (!cancelled) callService.endCall('ended');
          })
          .on(RoomEvent.TrackSubscribed, () => refreshTracks(room))
          .on(RoomEvent.TrackUnsubscribed, () => refreshTracks(room))
          .on(RoomEvent.LocalTrackPublished, () => refreshTracks(room))
          .on(RoomEvent.LocalTrackUnpublished, () => refreshTracks(room))
          .on(RoomEvent.ParticipantConnected, () => refreshTracks(room))
          .on(RoomEvent.ParticipantDisconnected, () => {
            if (room.remoteParticipants.size === 0) callService.endCall('ended');
          });

        await room.connect(wsUrl, token);
        if (cancelled) return;

        await room.localParticipant.setMicrophoneEnabled(true);
        if (isVideo) {
          await room.localParticipant.setCameraEnabled(true);
          setCameraOn(true);
        }
        refreshTracks(room);
      } catch (e) {
        if (__DEV__) console.error('[call] room connect failed', e);
        if (!cancelled) { setError('Could not connect the call.'); callService.endCall('error'); }
      }
    })();

    return () => {
      cancelled = true;
      try { room?.disconnect(); } catch {}
      try { lk.AudioSession?.stopAudioSession?.(); } catch {}
      roomRef.current = null;
    };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', () => {});
    return () => sub.remove();
  }, []);

  // ── Controls ──
  const toggleMute = async () => {
    const room = roomRef.current; if (!room) return;
    const next = !muted; setMuted(next);
    try { await room.localParticipant.setMicrophoneEnabled(!next); } catch {}
  };

  const toggleSpeaker = async () => {
    const lk = loadLiveKit();
    const next = !speakerOn; setSpeakerOn(next);
    try { await lk?.AudioSession?.selectAudioOutput?.(next ? 'speaker' : 'earpiece'); } catch {}
  };

  const toggleCamera = async () => {
    const room = roomRef.current; if (!room) return;
    const next = !cameraOn; setCameraOn(next);
    try { await room.localParticipant.setCameraEnabled(next); } catch {}
    refreshTracks(room);
  };

  const flipCamera = async () => {
    const room = roomRef.current; const lk = loadLiveKit();
    if (!room || !lk?.mediaDevices) return;
    const wantFacing = frontCamera ? 'environment' : 'front';
    try {
      const devices = await lk.mediaDevices.enumerateDevices();
      const dev = devices.find((d) => d.kind === 'videoinput' && d.facing === wantFacing);
      if (dev) {
        await room.switchActiveDevice('videoinput', dev.deviceId);
        setFrontCamera(!frontCamera);
        refreshTracks(room);
      }
    } catch (e) { if (__DEV__) console.warn('[call] flip camera failed', e?.message); }
  };

  const hangUp = () => callService.endCall('ended');

  const lk = loadLiveKit();
  const VideoTrackComp = lk?.VideoTrack;
  const showRemoteVideo = isVideo && remoteRef && VideoTrackComp;
  const showLocalVideo = isVideo && cameraOn && localRef && VideoTrackComp;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {showRemoteVideo ? (
        <VideoTrackComp trackRef={remoteRef} objectFit="cover" style={styles.remoteVideo} />
      ) : (
        <View style={styles.audioBg}>
          <Image source={{ uri: avatar }} style={styles.audioAvatar} />
        </View>
      )}

      {showLocalVideo ? (
        <View style={styles.localPreview}>
          <VideoTrackComp trackRef={localRef} objectFit="cover" mirror={frontCamera} style={styles.localVideo} />
        </View>
      ) : null}

      <View style={styles.header}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.status}>
          {error ? error : connected ? fmtDuration(elapsed) : 'Connecting…'}
        </Text>
        {!connected && !error ? <ActivityIndicator color="#9BA3B0" style={{ marginTop: 8 }} /> : null}
      </View>

      <View style={styles.controls}>
        <ControlBtn icon={muted ? 'mic-off' : 'mic'} active={muted} label="Mute" onPress={toggleMute} />
        <ControlBtn icon={speakerOn ? 'volume-high' : 'volume-mute'} active={!speakerOn} label="Speaker" onPress={toggleSpeaker} />
        {isVideo ? (
          <ControlBtn icon={cameraOn ? 'videocam' : 'videocam-off'} active={!cameraOn} label="Camera" onPress={toggleCamera} />
        ) : null}
        {isVideo && cameraOn ? (
          <ControlBtn icon="camera-reverse" label="Flip" onPress={flipCamera} />
        ) : null}
        <View style={styles.controlCol}>
          <TouchableOpacity style={[styles.controlBtn, styles.endBtn]} onPress={hangUp} activeOpacity={0.8}>
            <Ionicons name="call" size={28} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>
          <Text style={styles.controlLabel}>End</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

function ControlBtn({ icon, label, active, onPress }) {
  return (
    <View style={styles.controlCol}>
      <TouchableOpacity
        style={[styles.controlBtn, active && styles.controlBtnActive]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Ionicons name={icon} size={26} color={active ? '#0B0E13' : '#FFF'} />
      </TouchableOpacity>
      <Text style={styles.controlLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0E13', justifyContent: 'space-between' },
  remoteVideo: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
  audioBg: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B0E13' },
  audioAvatar: { width: 140, height: 140, borderRadius: 70, backgroundColor: '#1C212B' },
  localPreview: {
    position: 'absolute', top: 60, right: 16, width: 100, height: 150, borderRadius: 12,
    overflow: 'hidden', backgroundColor: '#14181F', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  localVideo: { width: '100%', height: '100%' },
  header: { alignItems: 'center', marginTop: 70 },
  name: { color: '#EDEFF3', fontSize: 24, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 6 },
  status: { color: '#9BA3B0', fontSize: 15, marginTop: 6, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 6 },
  controls: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', flexWrap: 'wrap',
    paddingHorizontal: 20, paddingBottom: 50, gap: 18,
  },
  controlCol: { alignItems: 'center' },
  controlBtn: {
    width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  controlBtnActive: { backgroundColor: '#FFF' },
  endBtn: { backgroundColor: '#EF4444' },
  controlLabel: { color: '#EDEFF3', fontSize: 12, marginTop: 8 },
});
