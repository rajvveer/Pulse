// IncomingCallScreen — the ring screen shown when someone calls us. Subscribes
// to callService for the active (incoming) call and renders accept/decline.
// Accepting hands off to CallScreen (callService.acceptCall does the nav).
import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Animated, Easing, StatusBar, Platform, Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import callService, { CallState } from '../../services/callService';

const AVATAR_PLACEHOLDER = 'https://via.placeholder.com/120';

export default function IncomingCallScreen({ navigation }) {
  const [snap, setSnap] = useState(callService.snapshot());
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const unsub = callService.subscribe(setSnap);
    return unsub;
  }, []);

  // If the call goes away (caller cancelled / ended), leave the screen.
  useEffect(() => {
    if (snap.state !== CallState.INCOMING && snap.state !== CallState.CONNECTING) {
      // callService handles the nav via goBackFromCall; this is a safety net.
      if (snap.state === CallState.IDLE || snap.state === CallState.ENDED) {
        if (navigation.canGoBack()) navigation.goBack();
      }
    }
  }, [snap.state]);

  // Ringing: pulse animation + vibration loop.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    const PATTERN = Platform.OS === 'android' ? [0, 600, 1000] : [0, 600, 1000];
    Vibration.vibrate(PATTERN, true);
    return () => { loop.stop(); Vibration.cancel(); };
  }, []);

  const call = snap.call || {};
  const peer = call.peer || {};
  const isVideo = call.callType === 'video';
  const name = peer.username || peer.name || 'Unknown';
  const avatar = peer.avatar || AVATAR_PLACEHOLDER;

  const onAccept = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Vibration.cancel();
    callService.acceptCall();
  };
  const onDecline = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Vibration.cancel();
    callService.rejectCall();
  };

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.top}>
        <Text style={styles.callTypeLabel}>
          {isVideo ? 'Incoming video call' : 'Incoming voice call'}
        </Text>
        <View style={styles.avatarWrap}>
          <Animated.View style={[styles.ring, { transform: [{ scale: ringScale }], opacity: ringOpacity }]} />
          <Image source={{ uri: avatar }} style={styles.avatar} />
        </View>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.subtitle}>is calling you…</Text>
      </View>

      <View style={styles.actions}>
        <View style={styles.actionCol}>
          <TouchableOpacity style={[styles.actionBtn, styles.declineBtn]} onPress={onDecline} activeOpacity={0.8}>
            <Ionicons name="call" size={32} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>
          <Text style={styles.actionLabel}>Decline</Text>
        </View>
        <View style={styles.actionCol}>
          <TouchableOpacity style={[styles.actionBtn, styles.acceptBtn]} onPress={onAccept} activeOpacity={0.8}>
            <Ionicons name={isVideo ? 'videocam' : 'call'} size={32} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.actionLabel}>Accept</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0E13', justifyContent: 'space-between' },
  top: { alignItems: 'center', marginTop: 80 },
  callTypeLabel: { color: '#9BA3B0', fontSize: 15, marginBottom: 40, letterSpacing: 0.3 },
  avatarWrap: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  ring: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: '#5B8DEF' },
  avatar: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#1C212B' },
  name: { color: '#EDEFF3', fontSize: 28, fontWeight: '700' },
  subtitle: { color: '#9BA3B0', fontSize: 16, marginTop: 8 },
  actions: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 40, marginBottom: 60 },
  actionCol: { alignItems: 'center' },
  actionBtn: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  declineBtn: { backgroundColor: '#EF4444' },
  acceptBtn: { backgroundColor: '#22C55E' },
  actionLabel: { color: '#EDEFF3', fontSize: 14, marginTop: 12 },
});
