import React, { useEffect, useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocation } from '../hooks/useLocation';
import { useTheme } from '../contexts/ThemeContext';
import { getTheme } from '../styles/theme';
import { fetchGlobalPosts, fetchFollowingPosts, likePostOptimistic } from '../redux/slices/postSlice';
import PostCard from '../components/PostCard';
import LeftDrawer from '../components/LeftDrawer';
import api from '../services/api';

const VIBE_LABELS = {
  auto: 'Auto',
  chill: 'Chill',
  hype: 'Hype',
  sad: 'Feels',
  funny: 'Comedy',
  creative: 'Creative',
};

const FeedScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const forYouListRef = useRef(null);
  const followingListRef = useRef(null);

  // Tab State
  const [activeTab, setActiveTab] = useState('forYou');
  const tabIndicatorAnim = useRef(new Animated.Value(0)).current;

  // Drawer & Vibe State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentVibe, setCurrentVibe] = useState('auto');
  const [notificationCount, setNotificationCount] = useState(0);

  // Selectors — For You
  const { location, city, region } = useSelector(state => state.ui);
  const { posts, isLoading, isError, message, page, hasMore } = useSelector(state => state.posts);

  // Selectors — Following
  const {
    followingPosts, followingIsLoading, followingIsError,
    followingMessage, followingPage, followingHasMore
  } = useSelector(state => state.posts);

  // Custom Hooks
  const { requestLocation } = useLocation();
  const { isDark } = useTheme();
  const theme = getTheme(isDark);

  // Initial Load
  useEffect(() => {
    requestLocation();
    if (posts.length === 0) loadForYou(1);
  }, []);

  // Load following feed when tab switches to it for the first time
  useEffect(() => {
    if (activeTab === 'following' && followingPosts.length === 0) {
      loadFollowing(1);
    }
  }, [activeTab]);

  // Animate tab indicator
  useEffect(() => {
    Animated.spring(tabIndicatorAnim, {
      toValue: activeTab === 'forYou' ? 0 : 1,
      useNativeDriver: false,
      tension: 300,
      friction: 20,
    }).start();
  }, [activeTab]);

  // Fetch notification count on focus
  const fetchNotificationCount = useCallback(async () => {
    try {
      const res = await api.get('/notifications/count');
      setNotificationCount(res.data?.data?.total || 0);
    } catch (e) {
      // Silently fail
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchNotificationCount();
    }, [fetchNotificationCount])
  );

  // Feed loaders
  const loadForYou = useCallback((pageToLoad = 1) => {
    dispatch(fetchGlobalPosts({ page: pageToLoad, vibe: currentVibe }));
  }, [dispatch, currentVibe]);

  const loadFollowing = useCallback((pageToLoad = 1) => {
    dispatch(fetchFollowingPosts({ page: pageToLoad }));
  }, [dispatch]);

  // Refresh handlers
  const handleRefresh = useCallback(() => {
    if (activeTab === 'forYou') {
      loadForYou(1);
    } else {
      loadFollowing(1);
    }
  }, [activeTab, loadForYou, loadFollowing]);

  const handleLoadMore = useCallback(() => {
    if (activeTab === 'forYou') {
      if (!isLoading && hasMore) loadForYou(page + 1);
    } else {
      if (!followingIsLoading && followingHasMore) loadFollowing(followingPage + 1);
    }
  }, [activeTab, isLoading, hasMore, page, loadForYou, followingIsLoading, followingHasMore, followingPage, loadFollowing]);

  const handleVibeChange = useCallback((vibe) => {
    setCurrentVibe(vibe);
    setTimeout(() => loadForYou(1), 100);
  }, [loadForYou]);

  const handleLikePost = useCallback(async (postId) => {
    try {
      dispatch(likePostOptimistic({ postId }));
      await api.post(`/posts/${postId}/like`);
    } catch (error) {
      console.error('Like error:', error);
    }
  }, [dispatch]);

  const renderPost = useCallback(({ item }) => (
    <PostCard
      post={item}
      onLike={handleLikePost}
      navigation={navigation}
    />
  ), [handleLikePost, navigation]);

  // Tab Bar
  const renderTabBar = () => {
    const indicatorLeft = tabIndicatorAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0%', '50%'],
    });

    return (
      <View style={[styles.tabBar, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => setActiveTab('forYou')}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'forYou' ? theme.colors.text : theme.colors.textSecondary }
          ]}>
            For You
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tab}
          onPress={() => setActiveTab('following')}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'following' ? theme.colors.text : theme.colors.textSecondary }
          ]}>
            Following
          </Text>
        </TouchableOpacity>

        {/* Animated underline indicator */}
        <Animated.View
          style={[
            styles.tabIndicator,
            {
              backgroundColor: theme.colors.primary,
              left: indicatorLeft,
            },
          ]}
        />
      </View>
    );
  };

  // Header Component with Drawer Toggle
  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: 'transparent' }]}>
      <View style={styles.headerRow}>
        {/* Menu Button */}
        <TouchableOpacity
          onPress={() => setDrawerOpen(true)}
          style={styles.menuBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="menu" size={26} color={theme.colors.text} />
        </TouchableOpacity>

        {/* Vibe Indicator — only show on For You tab */}
        {activeTab === 'forYou' && (
          <TouchableOpacity
            onPress={() => setDrawerOpen(true)}
            style={[styles.vibeTag, { backgroundColor: theme.colors.primary + '20' }]}
          >
            <Text style={[styles.vibeText, { color: theme.colors.primary }]}>
              {VIBE_LABELS[currentVibe]}
            </Text>
          </TouchableOpacity>
        )}

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Search Button */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Search')}
          style={styles.headerIcon}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="search" size={24} color={theme.colors.text} />
        </TouchableOpacity>

        {/* Notification Button */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Profile', { screen: 'Notifications' })}
          style={styles.headerIcon}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="notifications-outline" size={24} color={theme.colors.text} />
          {notificationCount > 0 && (
            <View style={[styles.badge, { backgroundColor: '#FF3B5C' }]}>
              <Text style={styles.badgeText}>{notificationCount > 99 ? '99+' : notificationCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFooter = (loading, dataLength) => {
    if (!loading || dataLength === 0) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    );
  };

  const renderEmptyFollowing = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="people-outline" size={48} color={theme.colors.textSecondary} />
      <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No posts yet</Text>
      <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
        Follow people to see their posts here
      </Text>
      <TouchableOpacity
        onPress={() => navigation.navigate('Search')}
        style={[styles.emptyButton, { backgroundColor: theme.colors.primary }]}
      >
        <Text style={styles.emptyButtonText}>Find People</Text>
      </TouchableOpacity>
    </View>
  );

  // Current feed data based on active tab
  const currentPosts = activeTab === 'forYou' ? posts : followingPosts;
  const currentLoading = activeTab === 'forYou' ? isLoading : followingIsLoading;
  const currentError = activeTab === 'forYou' ? isError : followingIsError;
  const currentMessage = activeTab === 'forYou' ? message : followingMessage;
  const currentPage = activeTab === 'forYou' ? page : followingPage;

  // Render the content area based on state
  const renderContent = () => {
    if (currentError && currentPosts.length === 0) {
      return (
        <View style={styles.centerMessage}>
          <Text style={[styles.errorMessage, { color: theme.colors.error }]}>
            ⚠️ {currentMessage || 'Failed to load feed'}
          </Text>
          <TouchableOpacity
            onPress={handleRefresh}
            style={[styles.button, { backgroundColor: theme.colors.primary }]}
          >
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (currentLoading && currentPosts.length === 0) {
      return (
        <View style={styles.centerMessage}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            {activeTab === 'forYou' ? 'Loading feed...' : 'Loading following...'}
          </Text>
        </View>
      );
    }

    if (activeTab === 'following' && currentPosts.length === 0 && !currentLoading) {
      return renderEmptyFollowing();
    }

    return (
      <FlashList
        ref={activeTab === 'forYou' ? forYouListRef : followingListRef}
        data={currentPosts}
        renderItem={renderPost}
        keyExtractor={item => item._id}
        estimatedItemSize={450}
        refreshing={currentLoading && currentPage === 1}
        onRefresh={handleRefresh}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={() => renderFooter(currentLoading, currentPosts.length)}
        contentContainerStyle={styles.feedList}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        {renderHeader()}
        {renderTabBar()}
        {renderContent()}
      </SafeAreaView>

      {/* Left Drawer - ALWAYS rendered, never removed from tree */}
      <LeftDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        currentVibe={currentVibe}
        onVibeChange={handleVibeChange}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuBtn: {
    padding: 4,
    marginRight: 12,
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 12, marginTop: 1, fontWeight: '500' },
  vibeTag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  vibeText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    position: 'relative',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '700',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    width: '50%',
    height: 3,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },

  feedList: { paddingVertical: 8 },
  centerMessage: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 12, fontSize: 14 },
  footerLoader: { paddingVertical: 20, alignItems: 'center' },
  errorMessage: { fontSize: 16, textAlign: 'center', marginBottom: 20 },
  button: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 24 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  searchBtn: { padding: 4 },
  headerIcon: { padding: 4, marginLeft: 12 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },

  // Empty state for Following tab
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  emptyButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 24,
  },
  emptyButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});

export default FeedScreen;