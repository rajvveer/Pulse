import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../contexts/ThemeContext';
import { getTheme } from '../../styles/theme';
import api from '../../services/api';
import logger from '../../utils/logger';

const BlockedAccountsScreen = () => {
  const { isDark } = useTheme();
  const theme = getTheme(isDark);

  const [blocked, setBlocked] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unblockingId, setUnblockingId] = useState(null);

  const fetchBlocked = useCallback(async () => {
    try {
      const res = await api.get('/users/me/blocked');
      setBlocked(res.data?.data || []);
    } catch (error) {
      logger.error('Fetch blocked users error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchBlocked();
    }, [fetchBlocked])
  );

  const handleUnblock = (user) => {
    Alert.alert(
      'Unblock User',
      `Unblock @${user.username}? They will be able to see your profile and interact with you again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            setUnblockingId(user._id);
            try {
              await api.delete(`/users/${user.username}/block`);
              setBlocked((prev) => prev.filter((u) => u._id !== user._id));
            } catch (error) {
              logger.error('Unblock error:', error);
              Alert.alert('Error', 'Could not unblock this user. Please try again.');
            } finally {
              setUnblockingId(null);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }) => {
    const avatar = item.profile?.avatar || item.avatar;
    const displayName = item.profile?.displayName || item.username;
    return (
      <View style={[styles.row, { borderBottomColor: theme.colors.border }]}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: theme.colors.primary + '20' }]}>
            <Ionicons name="person" size={20} color={theme.colors.primary} />
          </View>
        )}
        <View style={styles.info}>
          <Text style={[styles.name, { color: theme.colors.text }]} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={[styles.username, { color: theme.colors.textSecondary }]} numberOfLines={1}>
            @{item.username}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.unblockBtn, { borderColor: theme.colors.border }]}
          onPress={() => handleUnblock(item)}
          disabled={unblockingId === item._id}
          activeOpacity={0.7}
        >
          {unblockingId === item._id ? (
            <ActivityIndicator size="small" color={theme.colors.text} />
          ) : (
            <Text style={[styles.unblockText, { color: theme.colors.text }]}>Unblock</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        edges={['bottom']}
      >
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['bottom']}
    >
      <FlatList
        data={blocked}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        contentContainerStyle={blocked.length === 0 && styles.emptyWrap}
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="shield-checkmark-outline" size={48} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              No blocked accounts
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
              People you block will appear here.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyWrap: { flexGrow: 1 },
  emptyTitle: { fontSize: 17, fontWeight: '700', marginTop: 16 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', marginTop: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: { flex: 1, marginLeft: 12 },
  name: { fontSize: 15, fontWeight: '600' },
  username: { fontSize: 13, marginTop: 2 },
  unblockBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    minWidth: 86,
    alignItems: 'center',
  },
  unblockText: { fontSize: 14, fontWeight: '600' },
});

export default BlockedAccountsScreen;
