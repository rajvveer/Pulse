// OutgoingCallScreen — shown after we place a call, while it rings on the other
// end. Subscribes to callService; when the callee accepts, callService replaces
// this with CallScreen. Cancel hangs up before connect.
import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Animated, Easing, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import callService, { CallState } from '../../services/callService';

const AVATAR_PLACEHOLDER = 'https://via.placeholder.com/120';

export default function OutgoingCallScreen({ navigation }) {
  const [snap, setSnap] = useState(callService.snapshot());
  const dots = useRef(new Animated.Value(0)).current;

  useEffect(() => callService.subscribe(setSnap), []);

  useEffect(() => {
    if (snap.state === CallState.IDLE || snap.state === CallState.ENDED) {
      if (navigation.canGoBack()) navigation.goBack();
    }
  }, [snap.state]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(dots, { toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const call = snap.call || {};
  const peer = call.peer || {};
  const isVideo = call.callType === 'video';
  const name = peer.username || peer.name || 'Calling…';
  const avatar = peer.avatar || AVATAR_PLACEHOLDER;

  const statusText =
    snap.state === CallState.CONNECTING ? 'Connecting…' :
    snap.state === CallState.OUTGOING ? 'Ringing…' : 'Calling…';

  const onCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    callService.cancelCall();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.top}>
        <Text style={styles.callTypeLabel}>
          {isVideo ? 'Video call' : 'Voice call'}
        </Text>
        <Image source={{ uri: avatar }} style={styles.avatar} />
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.subtitle}>{statusText}</Text>
      </View>

      <View style={styles.actions}>
        <View style={styles.actionCol}>
          <TouchableOpacity style={[styles.actionBtn, styles.cancelBtn]} onPress={onCancel} activeOpacity={0.8}>
            <Ionicons name="call" size={32} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>
          <Text style={styles.actionLabel}>Cancel</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0E13', justifyContent: 'space-between' },
  top: { alignItems: 'center', marginTop: 100 },
  callTypeLabel: { color: '#9BA3B0', fontSize: 15, marginBottom: 40, letterSpacing: 0.3 },
  avatar: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#1C212B', marginBottom: 24 },
  name: { color: '#EDEFF3', fontSize: 28, fontWeight: '700' },
  subtitle: { color: '#9BA3B0', fontSize: 16, marginTop: 8 },
  actions: { flexDirection: 'row', justifyContent: 'center', marginBottom: 70 },
  actionCol: { alignItems: 'center' },
  actionBtn: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  cancelBtn: { backgroundColor: '#EF4444' },
  actionLabel: { color: '#EDEFF3', fontSize: 14, marginTop: 12 },
});
