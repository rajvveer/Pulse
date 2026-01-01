import React, { useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { useLocation } from '../hooks/useLocation';
import { useTheme } from '../contexts/ThemeContext';
import { getTheme } from '../styles/theme';
import { fetchGlobalPosts } from '../redux/slices/postSlice';
import PostCard from '../components/PostCard';
import api from '../services/api';

const FeedScreen = () => {
  const dispatch = useDispatch();
  
  const { location } = useSelector(state => state.ui);
  const { posts, isLoading, isError, message } = useSelector(state => state.posts); 
  
  const { requestLocation } = useLocation(); 
  const { isDark } = useTheme();
  const theme = getTheme(isDark);
  
  const loadFeed = useCallback(() => {
    dispatch(fetchGlobalPosts());
  }, [dispatch]);

  useEffect(() => {
    requestLocation(); 
    loadFeed(); 
  }, []); 

  // Handle like action
  const handleLikePost = async (postId) => {
    try {
      await api.post(`/posts/${postId}/like`);
      // Refresh feed or update local state
      loadFeed();
    } catch (error) {
      console.error('Like error:', error);
    }
  };

  const renderPost = ({ item }) => (
    <PostCard 
      post={item}
      onLike={handleLikePost}
    />
  );

  if (isError && posts.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <View style={styles.centerMessage}>
          <Text style={[styles.errorMessage, { color: theme.colors.error }]}>
            {'⚠️ Failed to load feed: '}{message || 'Unknown error'}
          </Text>
          <TouchableOpacity 
            onPress={loadFeed} 
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
      {/* Header */}
      <View style={[styles.header, { 
        backgroundColor: theme.colors.surface,
        borderBottomColor: theme.colors.border,
      }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Pulse
        </Text>
        <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
          {location ? '📍 Jodhpur, Rajasthan' : '📍 Getting location...'}
        </Text>
      </View>
      
      {/* Feed List */}
      {isLoading && posts.length === 0 ? (
        <View style={styles.centerMessage}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            Loading feed...
          </Text>
        </View>
      ) : (
        <FlatList
          data={posts} 
          renderItem={renderPost}
          keyExtractor={item => item._id.toString()} 
          refreshing={isLoading}
          onRefresh={loadFeed}
          contentContainerStyle={styles.feedList}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          maxToRenderPerBatch={5}
          windowSize={10}
          initialNumToRender={3}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  feedList: {
    paddingVertical: 8,
  },
  centerMessage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  }
});

export default FeedScreen;
