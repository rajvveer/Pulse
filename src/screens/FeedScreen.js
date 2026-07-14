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
import SnapRail from '../components/SnapRail';
import api from '../services/api';
import { getStoryRail } from '../services/snapService';
import logger from '../utils/logger';

const VIBE_LABELS = {
  auto: 'Auto', chill: 'Chill', hype: 'Hype', sad: 'Feels', funny: 'Comedy', creative: 'Creative',
};

const FeedScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const forYouListRef = useRef(null);
  const followingListRef = useRef(null);

  const [activeTab, setActiveTab] = useState('forYou');
  const tabIndicatorAnim = useRef(new Animated.Value(0)).current;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentVibe, setCurrentVibe] = useState('auto');
  const [notificationCount, setNotificationCount] = useState(0);

  const [storyRings, setStoryRings] = useState([]);
  const [railLoading, setRailLoading] = useState(false);

  const { posts, isLoading, isError, message, page, hasMore } = useSelector(state => state.posts);
  const {
    followingPosts, followingIsLoading, followingIsError,
    followingMessage, followingPage, followingHasMore,
  } = useSelector(state => state.posts);

  const { requestLocation } = useLocation();
  const { isDark } = useTheme();
  const theme = getTheme(isDark);

  useEffect(() => {
    requestLocation();
    if (posts.length === 0) loadForYou(1);
    loadStoryRail();
  }, []);

  useEffect(() => {
    if (activeTab === 'following' && followingPosts.length === 0) loadFollowing(1);
  }, [activeTab]);

  useEffect(() => {
    Animated.spring(tabIndicatorAnim, {
      toValue: activeTab === 'forYou' ? 0 : 1,
      useNativeDriver: false, tension: 280, friction: 22,
    }).start();
  }, [activeTab]);

  const fetchNotificationCount = useCallback(async () => {
    try {
      const res = await api.get('/notifications/count');
      setNotificationCount(res.data?.data?.total || 0);
    } catch (e) { /* silent */ }
  }, []);

  const loadStoryRail = useCallback(async () => {
    setRailLoading(true);
    try {
      const rings = await getStoryRail();
      setStoryRings(rings);
    } catch (e) { /* silent */ } finally { setRailLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => {
    fetchNotificationCount();
    loadStoryRail();
  }, [fetchNotificationCount, loadStoryRail]));

  const loadForYou = useCallback((p = 1) => {
    dispatch(fetchGlobalPosts({ page: p, vibe: currentVibe }));
  }, [dispatch, currentVibe]);

  const loadFollowing = useCallback((p = 1) => {
    dispatch(fetchFollowingPosts({ page: p }));
  }, [dispatch]);

  const handleRefresh = useCallback(() => {
    loadStoryRail();
    if (activeTab === 'forYou') loadForYou(1); else loadFollowing(1);
  }, [activeTab, loadForYou, loadFollowing, loadStoryRail]);

  const handleLoadMore = useCallback(() => {
    if (activeTab === 'forYou') { if (!isLoading && hasMore) loadForYou(page + 1); }
    else { if (!followingIsLoading && followingHasMore) loadFollowing(followingPage + 1); }
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
      dispatch(likePostOptimistic({ postId }));
      logger.error('Like error:', error);
    }
  }, [dispatch]);

  const openStory = useCallback((authorId) => {
    // Pass the full rings list and the target authorId; the viewer resolves the
    // starting index itself, so filtering/order in the rail can't desync it.
    navigation.navigate('SnapViewer', { rings: storyRings, startAuthorId: authorId });
  }, [navigation, storyRings]);

  const openOwnOrAdd = useCallback(() => {
    navigation.navigate('CreateSnap');
  }, [navigation]);

  const renderPost = useCallback(({ item }) => (
    <PostCard post={item} onLike={handleLikePost} navigation={navigation} />
  ), [handleLikePost, navigation]);

  // Premium segmented tab control with sliding pill.
  const renderTabBar = () => {
    const translate = tabIndicatorAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
    return (
      <View style={styles.tabWrap}>
        <View style={[styles.segment, { backgroundColor: theme.colors.surfaceAlt }]}>
          <Animated.View
            style={[
              styles.segmentPill,
              theme.elevation(1),
              {
                backgroundColor: theme.colors.surface,
                left: translate.interpolate({ inputRange: [0, 1], outputRange: ['1.5%', '50.5%'] }),
              },
            ]}
          />
          <TouchableOpacity style={styles.segmentBtn} onPress={() => setActiveTab('forYou')} activeOpacity={0.8}>
            <Text style={[styles.segmentText, { color: activeTab === 'forYou' ? theme.colors.text : theme.colors.textSecondary }]}>
              For You
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.segmentBtn} onPress={() => setActiveTab('following')} activeOpacity={0.8}>
            <Text style={[styles.segmentText, { color: activeTab === 'following' ? theme.colors.text : theme.colors.textSecondary }]}>
              Following
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: theme.colors.background }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)} style={styles.iconBtn} hitSlop={hit}>
          <Ionicons name="menu-outline" size={26} color={theme.colors.text} />
        </TouchableOpacity>

        <Text style={[styles.wordmark, { color: theme.colors.text }]}>Pulse</Text>

        <View style={{ flex: 1 }} />

        {activeTab === 'forYou' && (
          <TouchableOpacity
            onPress={() => setDrawerOpen(true)}
            style={[styles.vibeChip, { backgroundColor: theme.colors.primaryMuted }]}
            activeOpacity={0.8}
          >
            <View style={[styles.vibeDot, { backgroundColor: theme.colors.primary }]} />
            <Text style={[styles.vibeText, { color: theme.colors.primary }]}>{VIBE_LABELS[currentVibe]}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={() => navigation.navigate('Search')} style={styles.iconBtn} hitSlop={hit}>
          <Ionicons name="search-outline" size={23} color={theme.colors.text} />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Profile', { screen: 'Notifications' })} style={styles.iconBtn} hitSlop={hit}>
          <Ionicons name="notifications-outline" size={23} color={theme.colors.text} />
          {notificationCount > 0 && (
            <View style={[styles.badge, { backgroundColor: theme.colors.accent, borderColor: theme.colors.background }]}>
              <Text style={styles.badgeText}>{notificationCount > 99 ? '99+' : notificationCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
      {renderTabBar()}
    </View>
  );

  const renderListHeader = () => (
    <SnapRail
      rings={storyRings}
      loading={railLoading}
      onAddPress={openOwnOrAdd}
      onOpenRing={openStory}
    />
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
      <View style={[styles.emptyIcon, { backgroundColor: theme.colors.surfaceAlt }]}>
        <Ionicons name="people-outline" size={34} color={theme.colors.textSecondary} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>Nothing here yet</Text>
      <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
        Follow people and their posts will appear here.
      </Text>
      <TouchableOpacity onPress={() => navigation.navigate('Search')} style={[styles.emptyButton, { backgroundColor: theme.colors.primary }]} activeOpacity={0.85}>
        <Text style={[styles.emptyButtonText, { color: theme.colors.onPrimary }]}>Find people</Text>
      </TouchableOpacity>
    </View>
  );

  const currentPosts = activeTab === 'forYou' ? posts : followingPosts;
  const currentLoading = activeTab === 'forYou' ? isLoading : followingIsLoading;
  const currentError = activeTab === 'forYou' ? isError : followingIsError;
  const currentMessage = activeTab === 'forYou' ? message : followingMessage;
  const currentPage = activeTab === 'forYou' ? page : followingPage;

  const renderContent = () => {
    if (currentError && currentPosts.length === 0) {
      return (
        <View style={styles.centerMessage}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.colors.surfaceAlt }]}>
            <Ionicons name="cloud-offline-outline" size={32} color={theme.colors.textSecondary} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>Couldn't load feed</Text>
          <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>{currentMessage || 'Check your connection and try again.'}</Text>
          <TouchableOpacity onPress={handleRefresh} style={[styles.emptyButton, { backgroundColor: theme.colors.primary }]} activeOpacity={0.85}>
            <Text style={[styles.emptyButtonText, { color: theme.colors.onPrimary }]}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (currentLoading && currentPosts.length === 0) {
      return (
        <>
          {renderListHeader()}
          <View style={styles.centerMessage}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        </>
      );
    }

    return (
      <FlashList
        ref={activeTab === 'forYou' ? forYouListRef : followingListRef}
        data={currentPosts}
        renderItem={renderPost}
        keyExtractor={item => item._id}
        estimatedItemSize={460}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={activeTab === 'following' && !currentLoading ? renderEmptyFollowing : null}
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
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        {renderHeader()}
        {renderContent()}
      </SafeAreaView>

      {/* Compose FAB — floats just above the tab bar; primary create action. */}
      <TouchableOpacity
        onPress={() => navigation.navigate('Create')}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel="Create post"
        style={[
          styles.fab,
          theme.elevation(3),
          { backgroundColor: theme.colors.primary, opacity: 0.85 },
        ]}
      >
        <Ionicons name="add" size={30} color={theme.colors.onPrimary} />
      </TouchableOpacity>

      <LeftDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        currentVibe={currentVibe}
        onVibeChange={handleVibeChange}
      />
    </View>
  );
};

const hit = { top: 10, bottom: 10, left: 10, right: 10 };

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 6 },
  headerRow: { flexDirection: 'row', alignItems: 'center', height: 40 },
  wordmark: { fontSize: 22, fontWeight: '800', letterSpacing: -0.6, marginLeft: 8 },
  iconBtn: { padding: 5, marginLeft: 6 },
  vibeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, marginRight: 4 },
  vibeDot: { width: 6, height: 6, borderRadius: 3 },
  vibeText: { fontSize: 12.5, fontWeight: '700' },
  badge: {
    position: 'absolute', top: -2, right: -3, minWidth: 17, height: 17, borderRadius: 9,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, borderWidth: 1.5,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  // Segmented control
  tabWrap: { paddingTop: 10, paddingBottom: 2 },
  segment: { flexDirection: 'row', borderRadius: 12, padding: 3, position: 'relative', height: 40 },
  segmentPill: { position: 'absolute', top: 3, bottom: 3, width: '48%', borderRadius: 9 },
  segmentBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  segmentText: { fontSize: 14.5, fontWeight: '700' },

  feedList: { paddingBottom: 8 },
  centerMessage: { paddingVertical: 80, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 },
  footerLoader: { paddingVertical: 20, alignItems: 'center' },

  emptyContainer: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, paddingTop: 60 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 2, letterSpacing: -0.3 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  emptyButton: { marginTop: 22, paddingVertical: 12, paddingHorizontal: 28, borderRadius: 999 },
  emptyButtonText: { fontWeight: '700', fontSize: 15 },
});

export default FeedScreen;
