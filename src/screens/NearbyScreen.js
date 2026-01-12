import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator,
  RefreshControl,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';
import { getTheme } from '../styles/theme';
import PostCard from '../components/PostCard';
import api from '../services/api';

const CACHE_KEY = 'nearby_posts_cache';
const LOCATION_CACHE_KEY = 'last_location';
const CACHE_DURATION = 5 * 60 * 1000;

const NearbyScreen = ({ navigation }) => {
  const { isDark } = useTheme();
  const theme = getTheme(isDark);
  const { user } = useSelector(state => state.auth);
  const isFocused = useIsFocused();

  const [location, setLocation] = useState(null);
  const [posts, setPosts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  
  const appState = useRef(AppState.currentState);
  const isMounted = useRef(true);
  const fetchInProgress = useRef(false);

  // ✅ Deduplicate posts
  const uniquePosts = useMemo(() => {
    const seen = new Set();
    return posts.filter(post => {
      if (!post?._id) return false;
      const duplicate = seen.has(post._id);
      seen.add(post._id);
      return !duplicate;
    });
  }, [posts]);

  const getLocation = useCallback(async () => {
    try {
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermissionBlocked(!canAskAgain);
        throw new Error('Location permission denied');
      }
      
      const cachedLoc = await AsyncStorage.getItem(LOCATION_CACHE_KEY);
      if (cachedLoc) {
        const { coords, timestamp } = JSON.parse(cachedLoc);
        if (Date.now() - timestamp < CACHE_DURATION) {
          setLocation(coords);
          return coords;
        }
      }

      const pos = await Location.getCurrentPositionAsync({ 
        accuracy: Location.Accuracy.Balanced // Changed from High to reduce battery drain
      });
      const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setLocation(coords);
      await AsyncStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify({ coords, timestamp: Date.now() }));
      return coords;
    } catch (err) { 
      throw err; 
    }
  }, []);

  const fetchNearbyData = useCallback(async (silent = false) => {
    // ✅ CRITICAL: Prevent multiple simultaneous fetches
    if (fetchInProgress.current) return;
    if (!isMounted.current || !isFocused) return; // ✅ Don't fetch if screen not focused
    
    fetchInProgress.current = true;
    if (!silent) setLoading(true);
    
    try {
      const coords = await getLocation();
      if (!coords || !isMounted.current || !isFocused) return;
      
      const response = await api.get('/feed/nearby', {
        params: {
          latitude: coords.latitude,
          longitude: coords.longitude,
          radius: user?.settings?.radius || 1000,
          limit: 20,
        }
      });
      
      if (!isMounted.current || !isFocused) return;
      
      const postsData = response.data?.data || [];
      setPosts(postsData);
      setStats({ totalPosts: postsData.length, radius: user?.settings?.radius || 1000 });
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ posts: postsData, timestamp: Date.now() }));
      setError('');
    } catch (err) {
      if (!isMounted.current) return;
      if (!silent) {
        setError(err?.response?.data?.message || err.message || 'Failed to load nearby posts');
      }
    } finally {
      fetchInProgress.current = false;
      if (!isMounted.current) return;
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  }, [getLocation, user?.settings?.radius, isFocused]);

  const loadCachedData = useCallback(async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const { posts: cachedPosts, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION && cachedPosts?.length > 0) {
          setPosts(cachedPosts);
          setStats({ totalPosts: cachedPosts.length, radius: user?.settings?.radius || 1000 });
          setLoading(false);
        }
      }
    } catch (err) { 
      console.error('Cache load error:', err); 
    }
  }, [user?.settings?.radius]);

  const recheckPermissions = useCallback(async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        setPermissionBlocked(false);
        setError('');
        if (isFocused) fetchNearbyData();
      }
    } catch (err) { 
      console.error('Permission recheck error:', err); 
    }
  }, [fetchNearbyData, isFocused]);

  // ✅ Cleanup on unmount
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      fetchInProgress.current = false;
    };
  }, []);

  // ✅ AppState listener
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        if (isFocused) recheckPermissions();
      }
      appState.current = nextAppState;
    });
    return () => subscription?.remove();
  }, [recheckPermissions, isFocused]);

  // ✅ Initial load - only when focused
  useEffect(() => {
    if (isFocused) {
      loadCachedData();
      fetchNearbyData();
    }
  }, [isFocused]); // Only depend on isFocused

  // ✅ Refresh on focus (silently, only if we have posts)
  useFocusEffect(
    useCallback(() => {
      if (posts.length > 0 && isMounted.current) {
        const timer = setTimeout(() => {
          fetchNearbyData(true);
        }, 500);
        return () => clearTimeout(timer);
      }
    }, [posts.length]) // Remove fetchNearbyData from dependencies
  );

  const onRefresh = useCallback(() => { 
    setRefreshing(true); 
    fetchNearbyData(true); 
  }, [fetchNearbyData]);

  const handleLikePost = useCallback(async (postId) => {
    try {
      setPosts(prev => prev.map(post => 
        post._id === postId 
          ? { 
              ...post, 
              stats: { 
                ...post.stats, 
                likes: post.isLiked ? post.stats.likes - 1 : post.stats.likes + 1 
              }, 
              isLiked: !post.isLiked 
            } 
          : post
      ));
      await api.post(`/posts/${postId}/like`);
    } catch (error) { 
      console.error('Like error:', error); 
    }
  }, []);

  const renderPost = useCallback(({ item }) => (
    <PostCard 
      post={item}
      onLike={handleLikePost}
      navigation={navigation}
      isScreenFocused={isFocused}
    />
  ), [handleLikePost, navigation, isFocused]);

  const keyExtractor = useCallback((item) => item._id, []);

  const EmptyState = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Ionicons name="location-outline" size={80} color={theme.colors.textSecondary} />
      <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No posts nearby</Text>
      <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
        Be the first to post in your area!
      </Text>
      <TouchableOpacity 
        style={[styles.createButton, { backgroundColor: theme.colors.primary }]} 
        onPress={() => navigation.navigate('Create')}
      >
        <Ionicons name="add" size={20} color="#FFF" />
        <Text style={styles.createButtonText}>Create Post</Text>
      </TouchableOpacity>
    </View>
  ), [theme, navigation]);

  if (loading && posts.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            Finding posts near you...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Nearby</Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
            Within {(user?.settings?.radius || 1000) / 1000}km
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.filterButton} 
          onPress={() => navigation.navigate('Settings')}
        >
          <Ionicons name="options-outline" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {stats && (
        <View style={[styles.statsBar, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.colors.primary }]}>{stats.totalPosts}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Posts</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.colors.primary }]}>
              {(stats.radius / 1000).toFixed(1)}km
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Radius</Text>
          </View>
        </View>
      )}

      {/* ✅ Only render FlatList when focused to save memory */}
      {isFocused ? (
        <FlatList
          data={uniquePosts}
          renderItem={renderPost}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={EmptyState}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
              tintColor={theme.colors.primary} 
              colors={[theme.colors.primary]} 
            />
          }
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true} 
          initialNumToRender={3}
          maxToRenderPerBatch={3}
          windowSize={5}
          updateCellsBatchingPeriod={100}
          getItemLayout={(data, index) => ({
            length: 400, // Approximate post height
            offset: 400 * index,
            index,
          })}
        />
      ) : (
        <View style={{ flex: 1, backgroundColor: theme.colors.background }} />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 16, 
    borderBottomWidth: 1 
  },
  headerTitle: { fontSize: 28, fontWeight: '700' },
  headerSubtitle: { fontSize: 13, marginTop: 2 },
  filterButton: { padding: 8 },
  statsBar: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    paddingVertical: 12, 
    borderBottomWidth: 1 
  },
  statItem: { alignItems: 'center' },
  statNumber: { fontSize: 20, fontWeight: '700' },
  statLabel: { fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, height: '80%' },
  listContent: { paddingVertical: 8, paddingBottom: 100, flexGrow: 1 },
  emptyContainer: { 
    alignItems: 'center', 
    paddingVertical: 80, 
    paddingHorizontal: 32 
  },
  emptyTitle: { 
    fontSize: 20, 
    fontWeight: '600', 
    marginTop: 16, 
    marginBottom: 8 
  },
  emptyText: { 
    fontSize: 14, 
    marginBottom: 24, 
    textAlign: 'center' 
  },
  createButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 12, 
    paddingHorizontal: 24, 
    borderRadius: 24, 
    gap: 8 
  },
  createButtonText: { 
    color: '#FFF', 
    fontSize: 15, 
    fontWeight: '600' 
  },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  loadingText: { marginTop: 16, fontSize: 14 },
});

export default NearbyScreen;