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
import { useLocation } from '../hooks/useLocation';
import { useTheme } from '../contexts/ThemeContext';
import { getTheme } from '../styles/theme';
import { fetchGlobalPosts, likePostOptimistic } from '../redux/slices/postSlice'; // You need to add likePostOptimistic to your slice
import PostCard from '../components/PostCard';
import api from '../services/api';

const FeedScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const flatListRef = useRef(null);
  
  // Selectors
  const { location, city, region } = useSelector(state => state.ui);
  const { posts, isLoading, isError, message, page, hasMore } = useSelector(state => state.posts); 
  
  // Custom Hooks
  const { requestLocation } = useLocation(); 
  const { isDark } = useTheme();
  const theme = getTheme(isDark);
  
  // Header Animation (Optional but nice)
  const scrollY = useRef(new Animated.Value(0)).current;

  // Initial Load
  useEffect(() => {
    requestLocation(); 
    if (posts.length === 0) {
      loadFeed(1); 
    }
  }, []); 

  const loadFeed = useCallback((pageToLoad = 1) => {
    dispatch(fetchGlobalPosts({ page: pageToLoad })); 
  }, [dispatch]);

  const handleRefresh = useCallback(() => {
    loadFeed(1); // Force page 1 reset
  }, [loadFeed]);

  const handleLoadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      loadFeed(page + 1);
    }
  }, [isLoading, hasMore, page, loadFeed]);

  // ✅ OPTIMIZED: Optimistic Update for Likes
  // Instead of refetching the whole feed, update Redux state immediately
  const handleLikePost = useCallback(async (postId) => {
    try {
      // 1. Update UI Immediately (Redux Action required)
      dispatch(likePostOptimistic({ postId })); 
      
      // 2. Send API Call silently
      await api.post(`/posts/${postId}/like`);
    } catch (error) {
      console.error('Like error:', error);
      // Optionally revert state here if API fails
    }
  }, [dispatch]);

  // ✅ MEMOIZED: Render Item (Prevents re-mounting)
  const renderPost = useCallback(({ item }) => (
    <PostCard 
      post={item}
      onLike={handleLikePost}
      // Pass navigation if PostCard handles routing internally or via props
      navigation={navigation} 
    />
  ), [handleLikePost, navigation]);

  // Header Component (Sticky)
  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
      <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Pulse</Text>
      <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
        {city ? `📍 ${city}, ${region}` : '📍 World Feed'}
      </Text>
    </View>
  );

  // Loading Footer for Infinite Scroll
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
          
          // Refresh & Pagination
          refreshing={isLoading && page === 1}
          onRefresh={handleRefresh}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5} // Trigger when half a screen away from bottom
          ListFooterComponent={renderFooter}
          
          // Performance Props 
          contentContainerStyle={styles.feedList}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true} // Unmount off-screen items
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={5} // Smaller window saves memory on image-heavy apps
          
          // Scroll Event for animations (if needed later)
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
        />
      )}
    </SafeAreaView>
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
  headerTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, marginTop: 2, fontWeight: '500' },
  feedList: { paddingVertical: 8 },
  centerMessage: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 12, fontSize: 14 },
  footerLoader: { paddingVertical: 20, alignItems: 'center' },
  errorMessage: { fontSize: 16, textAlign: 'center', marginBottom: 20 },
  button: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 24 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});

export default FeedScreen;