import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, TextInput, FlatList,
  TouchableOpacity, ActivityIndicator, Animated, Share, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';
import { getTheme } from '../styles/theme';
import Avatar from './UI/Avatar';
import api from '../services/api';
import socketService from '../services/socket';

/**
 * ShareToDMSheet — send a reel / post / snap to friends via the existing chat
 * system, or out to the OS share sheet. Reusable across Reels, Feed, etc.
 *
 * `payload` describes what's being shared:
 *   { type: 'reel'|'post', id, previewUrl, caption, deepLink }
 */
const ShareToDMSheet = ({ visible, onClose, payload }) => {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const theme = getTheme(isDark);

  const [query, setQuery] = useState('');
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState({}); // userId -> true
  const [sendingId, setSendingId] = useState(null);

  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
    if (visible) {
      setSentTo({});
      loadSuggestions();
    }
  }, [visible]);

  const loadSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      // Recent conversations are the best share targets.
      const res = await api.get('/chat/conversations', { params: { limit: 30 } });
      const convs = res.data?.data || [];
      const me = null;
      // Flatten DM participants into a unique person list.
      const seen = new Set();
      const list = [];
      for (const c of convs) {
        if (c.type === 'group') continue;
        const other = (c.participants || []).find((p) => p && !seen.has(p._id));
        if (other && !seen.has(other._id)) {
          seen.add(other._id);
          list.push({ user: other, conversationId: c._id });
        }
      }
      setPeople(list);
    } catch {
      setPeople([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const runSearch = useCallback(async (q) => {
    setQuery(q);
    if (!q.trim()) return loadSuggestions();
    setLoading(true);
    try {
      const res = await api.get('/users/search', { params: { q: q.trim() } });
      const users = res.data?.data || [];
      setPeople(users.map((u) => ({ user: u, conversationId: null })));
    } catch {
      // keep previous
    } finally {
      setLoading(false);
    }
  }, [loadSuggestions]);

  const sendTo = useCallback(async (entry) => {
    if (sentTo[entry.user._id] || sendingId) return;
    setSendingId(entry.user._id);
    try {
      let conversationId = entry.conversationId;
      if (!conversationId) {
        const res = await api.post('/chat/conversation', { targetUserId: entry.user._id });
        conversationId = res.data?.data?._id;
      }
      if (!conversationId) throw new Error('no conversation');

      const label = payload?.type === 'reel' ? 'Shared a reel' : 'Shared a post';
      const body = payload?.caption ? `${label}: ${payload.caption}` : label;
      const link = payload?.deepLink || '';

      socketService.joinConversation(conversationId);
      socketService.sendMessage({
        conversationId,
        content: `${body}${link ? `\n${link}` : ''}`,
        type: 'text',
      });

      setSentTo((prev) => ({ ...prev, [entry.user._id]: true }));
    } catch {
      Alert.alert('Could not send', 'Please try again.');
    } finally {
      setSendingId(null);
    }
  }, [sentTo, sendingId, payload]);

  const shareExternal = useCallback(async () => {
    try {
      await Share.share({
        message: `${payload?.caption || 'Check this out on Pulse'}${payload?.deepLink ? `\n${payload.deepLink}` : ''}`,
      });
    } catch {}
  }, [payload]);

  const renderPerson = ({ item }) => {
    const done = sentTo[item.user._id];
    return (
      <View style={styles.personRow}>
        <Avatar user={item.user} size={46} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.personName, { color: theme.colors.text }]} numberOfLines={1}>
            {item.user.profile?.displayName || item.user.name || item.user.username}
          </Text>
          <Text style={[styles.personHandle, { color: theme.colors.textSecondary }]} numberOfLines={1}>
            @{item.user.username}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => sendTo(item)}
          disabled={done}
          activeOpacity={0.85}
          style={[
            styles.sendBtn,
            done
              ? { backgroundColor: theme.colors.surfaceAlt }
              : { backgroundColor: theme.colors.primary },
          ]}
        >
          {sendingId === item.user._id ? (
            <ActivityIndicator size="small" color={done ? theme.colors.text : theme.colors.onPrimary} />
          ) : (
            <Text style={[styles.sendBtnText, { color: done ? theme.colors.textSecondary : theme.colors.onPrimary }]}>
              {done ? 'Sent' : 'Send'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={[styles.overlay, { backgroundColor: theme.colors.overlay }]} onPress={onClose}>
        <Animated.View
          style={[
            styles.sheet,
            theme.elevation(3),
            {
              backgroundColor: theme.colors.surfaceElevated,
              paddingBottom: insets.bottom + 12,
              transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [600, 0] }) }],
            },
          ]}
        >
          <Pressable>
            <View style={[styles.handle, { backgroundColor: theme.colors.borderStrong }]} />
            <Text style={[styles.title, { color: theme.colors.text }]}>Send to</Text>

            <View style={[styles.searchBox, { backgroundColor: theme.colors.surfaceAlt }]}>
              <Ionicons name="search" size={18} color={theme.colors.textTertiary} />
              <TextInput
                value={query}
                onChangeText={runSearch}
                placeholder="Search people"
                placeholderTextColor={theme.colors.textTertiary}
                style={[styles.searchInput, { color: theme.colors.text }]}
                autoCapitalize="none"
              />
            </View>

            {loading ? (
              <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 28 }} />
            ) : (
              <FlatList
                data={people}
                keyExtractor={(it) => it.user._id}
                renderItem={renderPerson}
                style={{ maxHeight: 340 }}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <Text style={[styles.empty, { color: theme.colors.textSecondary }]}>No people found</Text>
                }
              />
            )}

            <TouchableOpacity style={[styles.externalBtn, { borderColor: theme.colors.border }]} onPress={shareExternal} activeOpacity={0.8}>
              <Ionicons name="share-outline" size={20} color={theme.colors.text} />
              <Text style={[styles.externalText, { color: theme.colors.text }]}>Share via…</Text>
            </TouchableOpacity>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 10 },
  handle: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  title: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3, marginBottom: 14 },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: 12, height: 44, gap: 8, marginBottom: 8 },
  searchInput: { flex: 1, fontSize: 15 },
  personRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9 },
  personName: { fontSize: 15, fontWeight: '600' },
  personHandle: { fontSize: 13, marginTop: 1 },
  sendBtn: { paddingHorizontal: 18, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', minWidth: 72 },
  sendBtnText: { fontSize: 14, fontWeight: '700' },
  empty: { textAlign: 'center', paddingVertical: 28, fontSize: 14 },
  externalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, paddingVertical: 14, borderRadius: 14, borderWidth: 1 },
  externalText: { fontSize: 15, fontWeight: '600' },
});

export default ShareToDMSheet;
