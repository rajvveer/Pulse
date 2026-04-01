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
  Modal,
  ScrollView,
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

const RADIUS_OPTIONS = [
  { label: '500m', value: 500 },
  { label: '1 km', value: 1000 },
  { label: '2 km', value: 2000 },
  { label: '5 km', value: 5000 },
  { label: '10 km', value: 10000 },
  { label: '25 km', value: 25000 },
  { label: '50 km', value: 50000 },
  { label: '100 km', value: 100000 },
  { label: '250 km', value: 250000 },
  { label: '500 km', value: 500000 },
];

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
  const [radius, setRadius] = useState(5000);
  const [showRadiusPicker, setShowRadiusPicker] = useState(false);

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

  const formatRadius = (r) => {
    if (r >= 1000) return `${r / 1000} km`;
    return `${r}m`;
  };

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
        accuracy: Location.Accuracy.Balanced
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
    if (fetchInProgress.current) return;
    if (!isMounted.current || !isFocused) return;

    fetchInProgress.current = true;
    if (!silent) setLoading(true);

    try {
      const coords = await getLocation();
      if (!coords || !isMounted.current || !isFocused) return;

      const response = await api.get('/feed/nearby', {
        params: {
          latitude: coords.latitude,
          longitude: coords.longitude,
          maxDistance: radius,
          limit: 20,
        }
      });

      if (!isMounted.current || !isFocused) return;

      const postsData = response.data?.data || [];
      setPosts(postsData);
      setStats({ totalPosts: postsData.length, radius });
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
  }, [getLocation, radius, isFocused]);

  const loadCachedData = useCallback(async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const { posts: cachedPosts, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION && cachedPosts?.length > 0) {
          setPosts(cachedPosts);
          setStats({ totalPosts: cachedPosts.length, radius });
          setLoading(false);
        }
      }
    } catch (err) {
      console.error('Cache load error:', err);
    }
  }, [radius]);

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

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      fetchInProgress.current = false;
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        if (isFocused) recheckPermissions();
      }
      appState.current = nextAppState;
    });
    return () => subscription?.remove();
  }, [recheckPermissions, isFocused]);

  useEffect(() => {
    if (isFocused) {
      loadCachedData();
      fetchNearbyData();
    }
  }, [isFocused, radius]);

  useFocusEffect(
    useCallback(() => {
      if (posts.length > 0 && isMounted.current) {
        const timer = setTimeout(() => {
          fetchNearbyData(true);
        }, 500);
        return () => clearTimeout(timer);
      }
    }, [posts.length])
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

  const handleBookmarkPost = useCallback(async (postId) => {
    try {
      setPosts(prev => prev.map(post =>
        post._id === postId
          ? { ...post, isBookmarked: !post.isBookmarked }
          : post
      ));
      await api.post('/bookmarks', { itemId: postId, itemType: 'post' });
    } catch (error) {
      console.error('Bookmark error:', error);
    }
  }, []);

  const renderPost = useCallback(({ item }) => (
    <PostCard
      post={item}
      onLike={handleLikePost}
      onBookmark={handleBookmarkPost}
      navigation={navigation}
      isScreenFocused={isFocused}
    />
  ), [handleLikePost, handleBookmarkPost, navigation, isFocused]);

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
            Within {formatRadius(radius)}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.filterButton, { backgroundColor: theme.colors.primary + '15', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }]}
          onPress={() => setShowRadiusPicker(true)}
        >
          <Ionicons name="locate-outline" size={18} color={theme.colors.primary} />
          <Text style={{ color: theme.colors.primary, fontWeight: '600', fontSize: 13, marginLeft: 4 }}>
            {formatRadius(radius)}
          </Text>
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
              {formatRadius(stats.radius)}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Radius</Text>
          </View>
        </View>
      )}

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
            length: 400,
            offset: 400 * index,
            index,
          })}
        />
      ) : (
        <View style={{ flex: 1, backgroundColor: theme.colors.background }} />
      )}

      {/* Radius Picker Modal */}
      <Modal
        visible={showRadiusPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRadiusPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowRadiusPicker(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Search Radius</Text>
            <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}>
              How far should we look for posts?
            </Text>
            <ScrollView style={styles.radiusOptions} showsVerticalScrollIndicator={false}>
              {RADIUS_OPTIONS.map((option) => {
                const isSelected = radius === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.radiusOption,
                      { borderColor: theme.colors.border },
                      isSelected && { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary },
                    ]}
                    onPress={() => {
                      setRadius(option.value);
                      setShowRadiusPicker(false);
                    }}
                  >
                    <Ionicons
                      name={isSelected ? "radio-button-on" : "radio-button-off"}
                      size={22}
                      color={isSelected ? theme.colors.primary : theme.colors.textSecondary}
                    />
                    <Text style={[
                      styles.radiusOptionText,
                      { color: isSelected ? theme.colors.primary : theme.colors.text },
                      isSelected && { fontWeight: '700' }
                    ]}>
                      {option.label}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary} style={{ marginLeft: 'auto' }} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
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
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#888',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  radiusOptions: {
    maxHeight: 400,
  },
  radiusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  radiusOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
});

export default NearbyScreen;