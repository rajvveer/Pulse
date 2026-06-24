import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';
import { getTheme } from '../styles/theme';
import Avatar from '../components/UI/Avatar';
import api from '../services/api';
import { createSnap } from '../services/snapService';

/**
 * SnapSendScreen — choose recipients for a DIRECT (disappearing) snap, then send.
 * Reached from CreateSnapScreen's "Send to" action with { media, caption }.
 */
const SnapSendScreen = ({ route, navigation }) => {
  const { media, caption } = route.params || {};
  const { isDark } = useTheme();
  const theme = getTheme(isDark);

  const [query, setQuery] = useState('');
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState({}); // id -> user
  const [sending, setSending] = useState(false);

  useEffect(() => { loadSuggestions(); }, []);

  const loadSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/chat/conversations', { params: { limit: 30 } });
      const seen = new Set();
      const list = [];
      for (const c of res.data?.data || []) {
        if (c.type === 'group') continue;
        const other = (c.participants || []).find((p) => p && !seen.has(p._id));
        if (other) { seen.add(other._id); list.push(other); }
      }
      setPeople(list);
    } catch { setPeople([]); } finally { setLoading(false); }
  }, []);

  const search = useCallback(async (q) => {
    setQuery(q);
    if (!q.trim()) return loadSuggestions();
    setLoading(true);
    try {
      const res = await api.get('/users/search', { params: { q: q.trim() } });
      setPeople(res.data?.data || []);
    } catch {} finally { setLoading(false); }
  }, [loadSuggestions]);

  const toggle = (u) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[u._id]) delete next[u._id]; else next[u._id] = u;
      return next;
    });
  };

  const send = async () => {
    const recipients = Object.keys(selected);
    if (recipients.length === 0 || sending) return;
    setSending(true);
    try {
      await createSnap({
        file: { uri: media.uri, name: media.name, type: media.mime },
        audience: 'direct',
        recipients,
        caption,
      });
      navigation.navigate('Main');
    } catch {
      Alert.alert('Could not send', 'Please try again.');
      setSending(false);
    }
  };

  const count = Object.keys(selected).length;

  const renderPerson = ({ item }) => {
    const on = !!selected[item._id];
    return (
      <TouchableOpacity style={styles.row} onPress={() => toggle(item)} activeOpacity={0.7}>
        <Avatar user={item} size={46} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.name, { color: theme.colors.text }]} numberOfLines={1}>
            {item.profile?.displayName || item.name || item.username}
          </Text>
          <Text style={[styles.handle, { color: theme.colors.textSecondary }]} numberOfLines={1}>@{item.username}</Text>
        </View>
        <View style={[styles.check, { borderColor: on ? theme.colors.primary : theme.colors.borderStrong, backgroundColor: on ? theme.colors.primary : 'transparent' }]}>
          {on && <Ionicons name="checkmark" size={15} color={theme.colors.onPrimary} />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={hit}>
          <Ionicons name="chevron-back" size={26} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Send snap to</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={[styles.searchBox, { backgroundColor: theme.colors.surfaceAlt }]}>
        <Ionicons name="search" size={18} color={theme.colors.textTertiary} />
        <TextInput
          value={query}
          onChangeText={search}
          placeholder="Search people"
          placeholderTextColor={theme.colors.textTertiary}
          style={[styles.searchInput, { color: theme.colors.text }]}
          autoCapitalize="none"
        />
      </View>

      {loading ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 28 }} />
      ) : (
        <FlatList
          data={people}
          keyExtractor={(it) => it._id}
          renderItem={renderPerson}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={[styles.empty, { color: theme.colors.textSecondary }]}>No people found</Text>}
        />
      )}

      {count > 0 && (
        <View style={[styles.footer, { backgroundColor: theme.colors.background, borderTopColor: theme.colors.separator }]}>
          <TouchableOpacity style={[styles.sendBtn, { backgroundColor: theme.colors.primary }]} onPress={send} disabled={sending} activeOpacity={0.85}>
            {sending ? <ActivityIndicator color={theme.colors.onPrimary} /> : (
              <Text style={[styles.sendBtnText, { color: theme.colors.onPrimary }]}>Send to {count}</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const hit = { top: 10, bottom: 10, left: 10, right: 10 };

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  searchBox: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, borderRadius: 14, paddingHorizontal: 12, height: 44, gap: 8, marginBottom: 8 },
  searchInput: { flex: 1, fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9 },
  name: { fontSize: 15, fontWeight: '600' },
  handle: { fontSize: 13, marginTop: 1 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', marginTop: 28, fontSize: 14 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
  sendBtn: { paddingVertical: 15, borderRadius: 999, alignItems: 'center' },
  sendBtnText: { fontSize: 16, fontWeight: '700' },
});

export default SnapSendScreen;
