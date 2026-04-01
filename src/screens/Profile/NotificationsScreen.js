import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../contexts/ThemeContext';
import { getTheme } from '../../styles/theme';
import { useNavigation } from '@react-navigation/native';
import api from '../../services/api';
import { getTimeAgo } from '../../utils/timeAgo';

const TABS = [
  { key: 'all', label: 'All', icon: 'notifications' },
  { key: 'like', label: 'Likes', icon: 'heart' },
  { key: 'comment', label: 'Comments', icon: 'chatbubble' },
  { key: 'follow', label: 'Follows', icon: 'person-add' },
  { key: 'chat', label: 'Messages', icon: 'chatbubbles' },
];

const NotificationItem = ({ item, theme, onPress }) => {
  const getIcon = () => {
    switch (item.type) {
      case 'like':
      case 'reel_like':
        return { name: 'heart', color: '#E91E63' };
      case 'comment':
      case 'reel_comment':
        return { name: 'chatbubble', color: '#2196F3' };
      case 'follow':
        return { name: 'person-add', color: '#4CAF50' };
      case 'chat':
        return { name: 'chatbubbles', color: '#9C27B0' };
      case 'whisper':
        return { name: 'eye-off', color: '#FF9800' };
      case 'mention':
        return { name: 'at', color: '#00BCD4' };
      default:
        return { name: 'notifications', color: theme.colors.primary };
    }
  };

  const icon = getIcon();
  const sender = item.sender || {};
  const avatar = sender.profile?.avatar || sender.avatar;

  return (
    <TouchableOpacity
      style={[
        styles.notificationItem,
        { backgroundColor: item.isRead ? theme.colors.surface : theme.colors.primary + '10' }
      ]}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.avatarContainer}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: theme.colors.border }]}>
            <Ionicons name="person" size={20} color={theme.colors.textSecondary} />
          </View>
        )}
        <View style={[styles.iconBadge, { backgroundColor: icon.color }]}>
          <Ionicons name={icon.name} size={12} color="#fff" />
        </View>
      </View>

      <View style={styles.contentContainer}>
        <Text style={[styles.notificationText, { color: theme.colors.text }]}>
          <Text style={styles.username}>
            {sender.profile?.displayName || sender.username || 'Someone'}
          </Text>
          {' '}{item.message || 'interacted with your content'}
        </Text>
        <Text style={[styles.timeText, { color: theme.colors.textSecondary }]}>
          {getTimeAgo(item.createdAt)}
        </Text>
      </View>

      {!item.isRead && <View style={[styles.unreadDot, { backgroundColor: theme.colors.primary }]} />}
    </TouchableOpacity>
  );
};

const NotificationsScreen = () => {
  const { isDark } = useTheme();
  const theme = getTheme(isDark);
  const navigation = useNavigation();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchNotifications = useCallback(async (pageNum = 1, type = null, refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else if (pageNum === 1) setLoading(true);

      const params = { page: pageNum, limit: 20 };
      if (type && type !== 'all') params.type = type;

      const res = await api.get('/notifications', { params });
      const data = res.data?.data || [];

      if (pageNum === 1) {
        setNotifications(data);
      } else {
        setNotifications(prev => [...prev, ...data]);
      }

      setHasMore(res.data?.pagination?.hasMore || false);
      setPage(pageNum);
    } catch (error) {
      console.error('Fetch notifications error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications(1, activeTab);
  }, [activeTab, fetchNotifications]);

  const handleRefresh = useCallback(() => {
    fetchNotifications(1, activeTab, true);
  }, [activeTab, fetchNotifications]);

  const handleLoadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchNotifications(page + 1, activeTab);
    }
  }, [loading, hasMore, page, activeTab, fetchNotifications]);

  const handleNotificationPress = useCallback(async (item) => {
    // Mark as read
    if (!item.isRead) {
      try {
        await api.patch(`/notifications/${item._id}/read`);
        setNotifications(prev =>
          prev.map(n => n._id === item._id ? { ...n, isRead: true } : n)
        );
      } catch (e) {
        console.error('Mark read error:', e);
      }
    }

    // Navigate based on type
    if (item.type === 'like' || item.type === 'comment') {
      if (item.post) navigation.navigate('PostDetail', { postId: item.post._id || item.post });
    } else if (item.type === 'reel_like' || item.type === 'reel_comment') {
      navigation.navigate('Reels');
    } else if (item.type === 'follow') {
      if (item.sender?.username) {
        navigation.navigate('UserProfile', { username: item.sender.username });
      }
    } else if (item.type === 'chat') {
      navigation.navigate('Chat');
    } else if (item.type === 'whisper') {
      navigation.navigate('Whisper');
    }
  }, [navigation]);

  const handleMarkAllRead = useCallback(async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (e) {
      console.error('Mark all read error:', e);
    }
  }, []);

  const renderHeader = () => (
    <View style={styles.tabsContainer}>
      <FlatList
        data={TABS}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={item => item.key}
        contentContainerStyle={styles.tabsList}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.tab,
              {
                backgroundColor: activeTab === item.key
                  ? theme.colors.primary
                  : theme.colors.surface,
                borderColor: theme.colors.border,
              }
            ]}
            onPress={() => setActiveTab(item.key)}
          >
            <Ionicons
              name={item.icon}
              size={16}
              color={activeTab === item.key ? '#fff' : theme.colors.textSecondary}
            />
            <Text
              style={[
                styles.tabText,
                { color: activeTab === item.key ? '#fff' : theme.colors.text }
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="notifications-off-outline" size={64} color={theme.colors.textSecondary} />
      <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Notifications</Text>
      <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
        When you get notifications, they'll appear here
      </Text>
    </View>
  );

  if (loading && notifications.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['bottom']}>
        {renderHeader()}
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['bottom']}>
      {renderHeader()}

      {notifications.length > 0 && (
        <TouchableOpacity style={styles.markAllButton} onPress={handleMarkAllRead}>
          <Text style={[styles.markAllText, { color: theme.colors.primary }]}>Mark all as read</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={notifications}
        keyExtractor={item => item._id}
        renderItem={({ item }) => (
          <NotificationItem item={item} theme={theme} onPress={handleNotificationPress} />
        )}
        contentContainerStyle={notifications.length === 0 ? styles.emptyList : styles.list}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loading && notifications.length > 0 ? (
            <ActivityIndicator style={styles.footerLoader} color={theme.colors.primary} />
          ) : null
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabsContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  tabsList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
    marginRight: 8,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  markAllButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'flex-end',
  },
  markAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    paddingBottom: 20,
  },
  emptyList: {
    flex: 1,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  contentContainer: {
    flex: 1,
    marginRight: 10,
  },
  notificationText: {
    fontSize: 14,
    lineHeight: 20,
  },
  username: {
    fontWeight: '700',
  },
  timeText: {
    fontSize: 12,
    marginTop: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  footerLoader: {
    paddingVertical: 20,
  },
});

export default NotificationsScreen;
