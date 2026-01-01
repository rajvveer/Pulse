import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator,
  RefreshControl,
  Linking,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';
import { getTheme } from '../styles/theme';
import PostCard from '../components/PostCard';
import api from '../services/api';

const CACHE_KEY = 'nearby_posts_cache';
const LOCATION_CACHE_KEY = 'last_location';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const NearbyScreen = ({ navigation }) => {
  const { isDark } = useTheme();
  const theme = getTheme(isDark);
  const { user } = useSelector(state => state.auth);

  const [location, setLocation] = useState(null);
  const [posts, setPosts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const appState = useRef(AppState.currentState);

  // Monitor app state to detect return from settings
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground, recheck permissions
        recheckPermissions();
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, []);

  const recheckPermissions = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        setPermissionBlocked(false);
        setError('');
        fetchNearbyData();
      }
    } catch (err) {
      console.error('Permission recheck error:', err);
    }
  };

  // Load cached data immediately
  useEffect(() => {
    loadCachedData();
    fetchNearbyData();
  }, []);

  // Load cache for instant display
  const loadCachedData = async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const { posts: cachedPosts, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          setPosts(cachedPosts);
          setStats({
            totalPosts: cachedPosts.length,
            activeUsers: 0,
            radius: user?.settings?.radius || 1000,
          });
        }
      }
    } catch (err) {
      console.error('Cache load error:', err);
    }
  };

  // Optimized location fetch
  const getLocation = async () => {
    try {
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        setPermissionBlocked(!canAskAgain);
        throw new Error('Location permission denied');
      }

      // Try cached location first
      const cachedLoc = await AsyncStorage.getItem(LOCATION_CACHE_KEY);
      if (cachedLoc) {
        const { coords, timestamp } = JSON.parse(cachedLoc);
        if (Date.now() - timestamp < CACHE_DURATION) {
          setLocation(coords);
          return coords;
        }
      }

      // Use last known position for instant result
      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown) {
        const coords = {
          latitude: lastKnown.coords.latitude,
          longitude: lastKnown.coords.longitude,
        };
        setLocation(coords);
        
        await AsyncStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify({
          coords,
          timestamp: Date.now()
        }));
        
        return coords;
      }

      // Fallback to current position with low accuracy for speed
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        maximumAge: 10000,
      });
      
      const coords = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      
      setLocation(coords);
      await AsyncStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify({
        coords,
        timestamp: Date.now()
      }));
      
      return coords;
      
    } catch (err) {
      throw err;
    }
  };

  // Fetch nearby data
  const fetchNearbyData = async () => {
    try {
      const coords = await getLocation();
      
      const response = await api.get('/feed/nearby', {
        params: {
          latitude: coords.latitude,
          longitude: coords.longitude,
          radius: user?.settings?.radius || 1000,
          limit: 20,
        }
      });

      const postsData = response.data?.data || [];
      
      setPosts(postsData);
      setStats({
        totalPosts: postsData.length,
        activeUsers: 0,
        radius: user?.settings?.radius || 1000,
      });
      
      // Cache the results
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
        posts: postsData,
        timestamp: Date.now()
      }));
      
      setError('');

    } catch (err) {
      console.error('Nearby fetch error:', err);
      setError(err?.response?.data?.message || err.message || 'Failed to load nearby posts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchNearbyData();
  };

  // Handle like action
  const handleLikePost = async (postId) => {
    try {
      const res = await api.post(`/posts/${postId}/like`);
      
      // Update the post in the list with new like count and isLiked status
      setPosts(prev => prev.map(post => 
        post._id === postId 
          ? { 
              ...post, 
              stats: { ...post.stats, likes: res.data.data.likeCount },
              isLiked: res.data.data.isLiked
            }
          : post
      ));
    } catch (error) {
      console.error('Like error:', error);
    }
  };

  // Render post using PostCard component
  const renderPost = useCallback(({ item }) => (
    <PostCard 
      post={item}
      onLike={handleLikePost}
    />
  ), []);

  // Key extractor memoized
  const keyExtractor = useCallback((item) => item._id, []);

  const EmptyState = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Ionicons name="location-outline" size={80} color={theme.colors.textSecondary} />
      <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
        No posts nearby
      </Text>
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

  if (error && !location && posts.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.errorContainer}>
          <Ionicons 
            name={permissionBlocked ? "lock-closed-outline" : "alert-circle-outline"} 
            size={64} 
            color={theme.colors.error} 
          />
          <Text style={[styles.errorTitle, { color: theme.colors.text }]}>
            {permissionBlocked ? 'Location Access Blocked' : 'Location Required'}
          </Text>
          <Text style={[styles.errorText, { color: theme.colors.textSecondary }]}>
            {permissionBlocked 
              ? 'You previously denied location access. Please enable it in your device settings to see nearby posts.'
              : 'This app needs your location to show nearby posts.'}
          </Text>
          
          {permissionBlocked ? (
            <>
              <TouchableOpacity
                style={[styles.settingsButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => Linking.openSettings()}
              >
                <Ionicons name="settings-outline" size={20} color="#FFF" />
                <Text style={styles.settingsButtonText}>Open Settings</Text>
              </TouchableOpacity>
              <Text style={[styles.instructionText, { color: theme.colors.textSecondary }]}>
                Go to Settings → Permissions → Location → Allow
              </Text>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
              onPress={fetchNearbyData}
            >
              <Text style={styles.retryButtonText}>Grant Permission</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={[styles.backButtonText, { color: theme.colors.textSecondary }]}>
              Go Back
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { 
        backgroundColor: theme.colors.surface,
        borderBottomColor: theme.colors.border,
      }]}>
        <View>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            Nearby
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
            Posts within {(user?.settings?.radius || 1000) / 1000}km
          </Text>
        </View>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => navigation.navigate('Settings')}
        >
          <Ionicons name="options-outline" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {/* Stats Bar */}
      {stats && (
        <View style={[styles.statsBar, { 
          backgroundColor: theme.colors.surface,
          borderBottomColor: theme.colors.border,
        }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.colors.primary }]}>
              {stats.totalPosts || posts.length}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              Posts
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.colors.primary }]}>
              {stats.activeUsers || 0}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              Active
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.colors.primary }]}>
              {(stats.radius / 1000).toFixed(1)}km
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              Radius
            </Text>
          </View>
        </View>
      )}

      {/* Posts List */}
      <FlatList
        data={posts}
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
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        windowSize={10}
        initialNumToRender={5}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  filterButton: {
    padding: 8,
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
  },
  listContent: {
    paddingVertical: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    gap: 8,
  },
  createButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  settingsButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  instructionText: {
    fontSize: 12,
    marginTop: 12,
    textAlign: 'center',
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default NearbyScreen;
