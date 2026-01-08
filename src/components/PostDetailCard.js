// components/PostDetailCard.js (FIXED - Robust Author Data)
import React, { useMemo, useState, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  Image,
  Dimensions,
  Pressable,
  Animated,
} from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';
import { getTheme } from '../styles/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_HEIGHT = 400;

const PostDetailCard = ({ post, onLike, onShare, onBookmark, isBookmarked }) => {
  const navigation = useNavigation();
  const { isDark } = useTheme();
  const theme = getTheme(isDark);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  
  // Animation values
  const likeScale = useRef(new Animated.Value(1)).current;
  const bookmarkScale = useRef(new Animated.Value(1)).current;

  const mediaItems = post.content?.media?.filter(item => item?.url) || [];
  const hasMultipleImages = mediaItems.length > 1;

  // ✅ HELPER: Extract Author Details Robustly
  // This handles both structures: author.avatar OR author.profile.avatar
  const getAuthorDetails = (author) => {
    if (!author) return { avatarUrl: null, displayName: 'Unknown', username: 'unknown' };
    
    const avatarUrl = author.profile?.avatar || author.avatar;
    const displayName = author.profile?.displayName || author.name || author.username || 'Unknown';
    const username = author.username || 'unknown';
    
    return { avatarUrl, displayName, username };
  };

  const { avatarUrl, displayName, username } = getAuthorDetails(post.author);

  const handleUserPress = () => {
    if (!post.isAnonymous && username !== 'unknown') {
      navigation.navigate('UserProfile', { username: username });
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setActiveImageIndex(viewableItems[0].index);
    }
  }).current;

  const renderImageItem = useCallback(({ item }) => {
    return (
      <View style={{ width: SCREEN_WIDTH, height: IMAGE_HEIGHT }}>
        <Image 
          source={{ uri: item.url }} 
          style={{ width: SCREEN_WIDTH, height: IMAGE_HEIGHT, backgroundColor: theme.colors.border }}
          resizeMode="cover"
        />
      </View>
    );
  }, [theme]);

  const timeAgo = useMemo(() => {
    if (!post.createdAt) return '';
    const now = new Date();
    const diff = now - new Date(post.createdAt);
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60));
      return minutes < 1 ? 'Just now' : `${minutes}m ago`;
    }
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }, [post.createdAt]);

  const animateButton = (animValue, callback) => {
    Animated.sequence([
      Animated.timing(animValue, {
        toValue: 0.85,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(animValue, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(callback);
  };

  const handleLike = () => {
    animateButton(likeScale, () => onLike?.(post._id));
  };

  const handleBookmark = () => {
    animateButton(bookmarkScale, () => onBookmark?.(post._id));
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      
      {/* HEADER */}
      <View style={styles.header}>
        <Pressable 
          style={styles.userInfo}
          onPress={handleUserPress}
          disabled={post.isAnonymous}
        >
          {/* ✅ FIXED: Use extracted avatarUrl */}
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.avatarText}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.userDetails}>
            <View style={styles.nameRow}>
              {/* ✅ FIXED: Use extracted displayName */}
              <Text style={[styles.username, { color: theme.colors.text }]}>
                {post.isAnonymous ? 'Anonymous' : displayName}
              </Text>
              {post.author?.isVerified && (
                <Ionicons name="checkmark-circle" size={14} color={theme.colors.primary} style={{ marginLeft: 4 }}/>
              )}
            </View>
            <Text style={[styles.timestamp, { color: theme.colors.textSecondary }]}>
               {timeAgo} • {post.isAnonymous ? 'Anonymous' : `@${username}`}
            </Text>
          </View>
        </Pressable>
        
        <TouchableOpacity style={styles.moreButton}>
          <Ionicons name="ellipsis-horizontal" size={20} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* CAPTION */}
      {post.content?.text && (
        <Text style={[styles.caption, { color: theme.colors.text }]}>
          {post.content.text}
        </Text>
      )}

      {/* IMAGE SLIDER */}
      {mediaItems.length > 0 && (
        <View style={styles.mediaWrapper}>
          <FlatList
            data={mediaItems}
            renderItem={renderImageItem}
            keyExtractor={(item, index) => index.toString()}
            horizontal={true}
            pagingEnabled={true}
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled={true} 
            removeClippedSubviews={false}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
            windowSize={3}
          />

          {/* Enhanced Pagination */}
          {hasMultipleImages && (
            <View style={styles.paginationCapsule}>
              {mediaItems.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.paginationDot,
                    {
                      backgroundColor: index === activeImageIndex ? '#FFF' : 'rgba(255,255,255,0.4)',
                      transform: [{ scale: index === activeImageIndex ? 1.2 : 1 }]
                    }
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      )}

      {/* ACTION BAR */}
      <View style={styles.actionBar}>
        <View style={styles.leftActions}>
          <Animated.View style={{ transform: [{ scale: likeScale }] }}>
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={handleLike}
              activeOpacity={0.7}
            >
              <Ionicons 
                name={post.isLiked ? "heart" : "heart-outline"} 
                size={28} 
                color={post.isLiked ? '#E91E63' : theme.colors.text} 
              />
              {post.stats?.likes > 0 && (
                <Text style={[styles.actionText, { color: theme.colors.text }]}>
                  {post.stats.likes > 999 ? `${(post.stats.likes / 1000).toFixed(1)}k` : post.stats.likes}
                </Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
            <Ionicons name="chatbubble-outline" size={26} color={theme.colors.text} />
            {post.stats?.comments > 0 && (
              <Text style={[styles.actionText, { color: theme.colors.text }]}>
                {post.stats.comments > 999 ? `${(post.stats.comments / 1000).toFixed(1)}k` : post.stats.comments}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} activeOpacity={0.7} onPress={onShare}>
            <Ionicons name="paper-plane-outline" size={26} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        <Animated.View style={{ transform: [{ scale: bookmarkScale }] }}>
          <TouchableOpacity activeOpacity={0.7} onPress={handleBookmark}>
            <Ionicons 
              name={isBookmarked ? "bookmark" : "bookmark-outline"} 
              size={26} 
              color={isBookmarked ? theme.colors.primary : theme.colors.text} 
            />
          </TouchableOpacity>
        </Animated.View>
      </View>
      
      <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 0,
  },
  header: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  userDetails: {
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  username: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  timestamp: {
    fontSize: 12,
    marginTop: 2,
  },
  moreButton: {
    padding: 8,
    marginRight: -8,
  },
  caption: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    fontSize: 15,
    lineHeight: 22,
  },
  mediaWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  paginationCapsule: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    opacity: 0.5,
    marginTop: 8,
  },
});

export default PostDetailCard;