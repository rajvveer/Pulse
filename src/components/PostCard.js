import React, { useMemo, useCallback, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  Image,
  Dimensions,
  ScrollView,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';
import { getTheme } from '../styles/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_WIDTH = SCREEN_WIDTH - 32;

const PostCard = ({ post, onLike, onComment, showActions = true }) => {
  const navigation = useNavigation();
  const { isDark } = useTheme();
  const theme = getTheme(isDark);
  const currentUser = useSelector(state => state.auth.user);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const scrollViewRef = useRef(null);

  // ✅ FIX: Robust Avatar Logic
  // Check profile.avatar first, then root avatar
  const avatarUrl = post.author?.profile?.avatar || post.author?.avatar;
  
  // Get Display Name
  const displayName = post.author?.profile?.displayName || post.author?.name || post.author?.username || 'Unknown';

  const handlePostPress = useCallback(() => {
    navigation.navigate('PostDetail', { postId: post._id });
  }, [navigation, post._id]);

  const handleLike = useCallback(() => {
    onLike?.(post._id);
  }, [onLike, post._id]);

  const handleComment = useCallback(() => {
    if (onComment) {
      onComment(post._id);
    } else {
      navigation.navigate('PostDetail', { postId: post._id });
    }
  }, [onComment, navigation, post._id]);

  const handleUserPress = useCallback(() => {
    if (post.isAnonymous || !post.author) return; 

    const isMe = (post.author._id === currentUser?._id) || (post.author.username === currentUser?.username);

    if (isMe) {
      navigation.navigate('Profile', { screen: 'ProfileMain' });
    } else {
      navigation.navigate('UserProfile', { 
        userId: post.author._id,
        username: post.author.username 
      });
    }
  }, [navigation, post.isAnonymous, post.author, currentUser]);

  const formatTimestamp = useMemo(() => {
    if (!post.createdAt) return '';
    const now = new Date();
    const postDate = new Date(post.createdAt);
    const diffInSeconds = Math.floor((now - postDate) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
    
    return postDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }, [post.createdAt]);

  const formatCount = useCallback((count) => {
    if (!count || count === 0) return '0';
    if (count < 1000) return count.toString();
    if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
    return `${(count / 1000000).toFixed(1)}M`;
  }, []);

  const mediaItems = useMemo(() => 
    post.content?.media?.filter(item => item?.url) || [],
    [post.content?.media]
  );

  const hasMultipleImages = mediaItems.length > 1;

  const handleScroll = useCallback((event) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const currentIndex = Math.round(contentOffsetX / IMAGE_WIDTH);
    setActiveImageIndex(currentIndex);
  }, []);

  return (
    <View
      style={[styles.postCard, { 
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
      }]}
    >
      {/* Header */}
      <View style={styles.postHeader}>
        <Pressable 
          style={styles.userInfo}
          onPress={handleUserPress}
          disabled={post.isAnonymous}
        >
          <View style={styles.userRow}>
            {/* ✅ FIXED AVATAR RENDERING */}
            {avatarUrl ? (
              <Image 
                source={{ uri: avatarUrl }} 
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatar, { backgroundColor: theme.colors.primary + '20' }]}>
                <Text style={[styles.avatarText, { color: theme.colors.primary }]}>
                  {displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            
            <View style={styles.userDetails}>
              <View style={styles.usernameRow}>
                <Text 
                  style={[styles.username, { color: theme.colors.text }]}
                  numberOfLines={1}
                >
                  {post.isAnonymous ? 'Anonymous' : displayName}
                </Text>
                {post.author?.isVerified && !post.isAnonymous && (
                  <Ionicons name="checkmark-circle" size={16} color={theme.colors.primary} />
                )}
                {post.isAnonymous && (
                  <View style={styles.anonymousBadge}>
                    <Ionicons name="eye-off" size={11} color="#9C27B0" />
                  </View>
                )}
              </View>
              <View style={styles.metaRow}>
                {!post.isAnonymous && post.author?.username && (
                  <>
                    <Text style={[styles.handle, { color: theme.colors.textSecondary }]}>
                      @{post.author.username}
                    </Text>
                    <Text style={[styles.dot, { color: theme.colors.textSecondary }]}>•</Text>
                  </>
                )}
                <Text style={[styles.timestamp, { color: theme.colors.textSecondary }]}>
                  {formatTimestamp}
                </Text>
                {post.location && (
                  <>
                    <Text style={[styles.dot, { color: theme.colors.textSecondary }]}>•</Text>
                    <Ionicons name="location" size={11} color={theme.colors.textSecondary} />
                    <Text style={[styles.locationText, { color: theme.colors.textSecondary }]}>
                      {post.distance ? `${Math.round(post.distance)}m` : 'Nearby'}
                    </Text>
                  </>
                )}
              </View>
            </View>
          </View>
        </Pressable>

        <TouchableOpacity 
          style={styles.moreButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons 
            name="ellipsis-horizontal" 
            size={20} 
            color={theme.colors.textSecondary} 
          />
        </TouchableOpacity>
      </View>

      {/* Content Text */}
      {post.content?.text && (
        <Pressable onPress={handlePostPress}>
          <Text 
            style={[styles.caption, { color: theme.colors.text }]}
            numberOfLines={5}
          >
            {post.content.text}
          </Text>
        </Pressable>
      )}

      {/* Images Gallery */}
      {mediaItems.length > 0 && (
        <View style={styles.mediaContainer}>
          <ScrollView
            ref={scrollViewRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            decelerationRate="fast"
            snapToInterval={IMAGE_WIDTH}
            snapToAlignment="center"
            contentContainerStyle={styles.scrollContent}
            nestedScrollEnabled={true}
          >
            {mediaItems.map((item, index) => (
              <Pressable 
                key={`image-${index}`}
                onPress={handlePostPress}
                style={styles.imageSlide}
              >
                <Image 
                  source={{ uri: item.url }} 
                  style={[styles.postImage, { width: IMAGE_WIDTH }]}
                  resizeMode="cover"
                />
              </Pressable>
            ))}
          </ScrollView>
          
          {/* Image Counter & Pagination */}
          {hasMultipleImages && (
            <>
              {/* Counter Badge */}
              <View style={[styles.imageCounter, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
                <Ionicons name="images" size={12} color="#FFF" />
                <Text style={styles.imageCounterText}>
                  {activeImageIndex + 1}/{mediaItems.length}
                </Text>
              </View>
              
              {/* Pagination Dots */}
              <View style={styles.pagination}>
                {mediaItems.map((_, index) => (
                  <View
                    key={`dot-${index}`}
                    style={[
                      styles.paginationDot,
                      {
                        backgroundColor: index === activeImageIndex 
                          ? '#FFF' 
                          : 'rgba(255,255,255,0.5)',
                        width: index === activeImageIndex ? 20 : 6,
                      }
                    ]}
                  />
                ))}
              </View>
            </>
          )}
        </View>
      )}

      {/* Actions */}
      {showActions && (
        <View style={[styles.actions, { borderTopColor: theme.colors.border }]}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleLike}
            activeOpacity={0.7}
          >
            <Ionicons 
              name={post.isLiked ? "heart" : "heart-outline"} 
              size={24} 
              color={post.isLiked ? '#E91E63' : theme.colors.textSecondary} 
            />
            <Text style={[
              styles.actionText, 
              { color: post.isLiked ? '#E91E63' : theme.colors.textSecondary }
            ]}>
              {formatCount(post.stats?.likes)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleComment}
            activeOpacity={0.7}
          >
            <Ionicons 
              name="chatbubble-outline" 
              size={22} 
              color={theme.colors.textSecondary} 
            />
            <Text style={[styles.actionText, { color: theme.colors.textSecondary }]}>
              {formatCount(post.stats?.comments)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            activeOpacity={0.7}
          >
            <Ionicons 
              name="share-outline" 
              size={23} 
              color={theme.colors.textSecondary} 
            />
          </TouchableOpacity>

          <View style={{ flex: 1 }} />

          <TouchableOpacity 
            style={styles.actionButton}
            activeOpacity={0.7}
          >
            <Ionicons 
              name="bookmark-outline" 
              size={23} 
              color={theme.colors.textSecondary} 
            />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  postCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 14,
  },
  userInfo: {
    flex: 1,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    backgroundColor: '#E0E0E0', // Added fallback background
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
  },
  userDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  username: {
    fontSize: 15,
    fontWeight: '600',
    maxWidth: '70%',
  },
  anonymousBadge: {
    backgroundColor: 'rgba(156, 39, 176, 0.15)',
    padding: 4,
    borderRadius: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  handle: {
    fontSize: 12,
  },
  timestamp: {
    fontSize: 13,
  },
  dot: {
    fontSize: 10,
    marginHorizontal: 2,
  },
  locationText: {
    fontSize: 12,
  },
  moreButton: {
    padding: 4,
  },
  caption: {
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  mediaContainer: {
    width: '100%',
    position: 'relative',
  },
  scrollContent: {
    flexDirection: 'row',
  },
  imageSlide: {
    width: IMAGE_WIDTH,
  },
  postImage: {
    height: 400,
    backgroundColor: '#E0E0E0',
  },
  imageCounter: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  imageCounterText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  pagination: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  paginationDot: {
    height: 6,
    borderRadius: 3,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
    gap: 6,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default PostCard;