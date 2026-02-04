import React, { useEffect, useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocation } from '../hooks/useLocation';
import { useTheme } from '../contexts/ThemeContext';
import { getTheme } from '../styles/theme';
import { fetchGlobalPosts, likePostOptimistic } from '../redux/slices/postSlice';
import PostCard from '../components/PostCard';
import LeftDrawer from '../components/LeftDrawer';
import api from '../services/api';

const VIBE_LABELS = {
  auto: '🔮 Auto',
  chill: '😌 Chill',
  hype: '🔥 Hype',
  sad: '😢 Feels',
  funny: '😂 Comedy',
  creative: '✨ Creative',
};

const FeedScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const flatListRef = useRef(null);

  // Drawer & Vibe State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentVibe, setCurrentVibe] = useState('auto');

  // Selectors
  const { location, city, region } = useSelector(state => state.ui);
  const { posts, isLoading, isError, message, page, hasMore } = useSelector(state => state.posts);

  // Custom Hooks
  const { requestLocation } = useLocation();
  const { isDark } = useTheme();
  const theme = getTheme(isDark);

  // Header Animation
  const scrollY = useRef(new Animated.Value(0)).current;

  // Initial Load
  useEffect(() => {
    requestLocation();
    if (posts.length === 0) {
      loadFeed(1);
    }
  }, []);

  const loadFeed = useCallback((pageToLoad = 1) => {
    dispatch(fetchGlobalPosts({ page: pageToLoad, vibe: currentVibe }));
  }, [dispatch, currentVibe]);

  const handleRefresh = useCallback(() => {
    loadFeed(1);
  }, [loadFeed]);

  const handleLoadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      loadFeed(page + 1);
    }
  }, [isLoading, hasMore, page, loadFeed]);

  const handleVibeChange = useCallback((vibe) => {
    setCurrentVibe(vibe);
    // Reload feed with new vibe
    setTimeout(() => loadFeed(1), 100);
  }, [loadFeed]);

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

  // Header Component with Drawer Toggle
  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
      <View style={styles.headerRow}>
        {/* Menu Button */}
        <TouchableOpacity
          onPress={() => setDrawerOpen(true)}
          style={styles.menuBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="menu" size={26} color={theme.colors.text} />
        </TouchableOpacity>

        {/* Title */}
        {/* <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Pulse</Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
            {city ? `📍 ${city}` : '📍 Global'}
          </Text>
        </View> */}

        {/* Vibe Indicator */}
        <TouchableOpacity
          onPress={() => setDrawerOpen(true)}
          style={[styles.vibeTag, { backgroundColor: theme.colors.primary + '20' }]}
        >
          <Text style={[styles.vibeText, { color: theme.colors.primary }]}>
            {VIBE_LABELS[currentVibe]}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFooter = () => {
    if (!isLoading || posts.length === 0) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    );
  };

  if (isError && posts.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerMessage}>
          <Text style={[styles.errorMessage, { color: theme.colors.error }]}>
            ⚠️ {message || 'Failed to load feed'}
          </Text>
          <TouchableOpacity
            onPress={handleRefresh}
            style={[styles.button, { backgroundColor: theme.colors.primary }]}
          >
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        {renderHeader()}

        {isLoading && posts.length === 0 ? (
          <View style={styles.centerMessage}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading feed...</Text>
          </View>
        ) : (
          <Animated.FlatList
            ref={flatListRef}
            data={posts}
            renderItem={renderPost}
            keyExtractor={item => item._id}

            refreshing={isLoading && page === 1}
            onRefresh={handleRefresh}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={renderFooter}

            contentContainerStyle={styles.feedList}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={true}
            initialNumToRender={5}
            maxToRenderPerBatch={5}
            windowSize={5}

            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: true }
            )}
          />
        )}
      </SafeAreaView>

      {/* Left Drawer - OUTSIDE SafeAreaView for proper z-index */}
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
    borderBottomWidth: 1,
    elevation: 2,
    zIndex: 10,
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
  feedList: { paddingVertical: 8 },
  centerMessage: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 12, fontSize: 14 },
  footerLoader: { paddingVertical: 20, alignItems: 'center' },
  errorMessage: { fontSize: 16, textAlign: 'center', marginBottom: 20 },
  button: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 24 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});

export default FeedScreen;