import React, { useMemo, useCallback, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Pressable,
  Animated,
  FlatList,
  Modal,
  Share,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';
import { getTheme } from '../styles/theme';
import { getValidAvatarUrl, getDisplayName } from '../utils/avatarHelper';
import api from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_MARGIN = 16;
const IMAGE_WIDTH = SCREEN_WIDTH - (CARD_MARGIN * 2) - 2; // Account for border

const PostCard = ({ post, onLike, onComment, onBookmark, onDelete, showActions = true }) => {
  const navigation = useNavigation();
  const { isDark } = useTheme();
  const theme = getTheme(isDark);
  const currentUser = useSelector(state => state.auth.user);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isBookmarked, setIsBookmarked] = useState(post.isBookmarked || false);
  const [menuVisible, setMenuVisible] = useState(false);
  const lastTap = useRef(null);

  // Animation Refs
  const likeScale = useRef(new Animated.Value(1)).current;
  const menuFade = useRef(new Animated.Value(0)).current;

  // ✅ Robust Avatar & Name Logic (filters broken default URLs)
  const avatarUrl = getValidAvatarUrl(post.author);
  const displayName = getDisplayName(post.author);

  // ✅ Check if the post belongs to the current user
  const isOwnPost = useMemo(() => {
    if (!currentUser || !post.author) return false;
    return (post.author._id === currentUser._id) || (post.author.username === currentUser.username);
  }, [currentUser, post.author]);

  // ✅ MEMOIZED: Navigation Handlers
  const handlePostPress = useCallback(() => {
    navigation.navigate('PostDetail', { postId: post._id });
  }, [navigation, post._id]);

  const handleUserPress = useCallback(() => {
    if (post.isAnonymous || !post.author) return;
    const isMe = (post.author._id === currentUser?._id) || (post.author.username === currentUser?.username);
    if (isMe) {
      navigation.navigate('Profile', { screen: 'ProfileMain' });
    } else {
      navigation.navigate('UserProfile', { userId: post.author._id, username: post.author.username });
    }
  }, [navigation, post.isAnonymous, post.author, currentUser]);

  // ✅ ANIMATED: Like Handler
  const handleLike = useCallback(() => {
    Animated.sequence([
      Animated.timing(likeScale, { toValue: 0.8, duration: 100, useNativeDriver: true }),
      Animated.timing(likeScale, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    onLike?.(post._id);
  }, [onLike, post._id]);

  // ✅ DOUBLE TAP TO LIKE
  const handleImagePress = useCallback(() => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;

    if (lastTap.current && (now - lastTap.current) < DOUBLE_PRESS_DELAY) {
      if (!post.isLiked) handleLike();
    } else {
      handlePostPress();
    }
    lastTap.current = now;
  }, [handleLike, handlePostPress, post.isLiked]);

  const handleComment = useCallback(() => {
    if (onComment) onComment(post._id);
    else navigation.navigate('PostDetail', { postId: post._id });
  }, [onComment, navigation, post._id]);

  const handleBookmark = useCallback(() => {
    setIsBookmarked(prev => !prev);
    if (onBookmark) {
      onBookmark(post._id);
    } else {
      api.post('/bookmarks', { itemId: post._id, itemType: 'post' }).catch(console.error);
    }
  }, [onBookmark, post._id]);

  // ===== THREE-DOT MENU HANDLERS =====
  const openMenu = useCallback(() => {
    setMenuVisible(true);
    Animated.timing(menuFade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, []);

  const closeMenu = useCallback(() => {
    Animated.timing(menuFade, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setMenuVisible(false);
    });
  }, []);

  const handleEditPost = useCallback(() => {
    closeMenu();
    setTimeout(() => {
      navigation.navigate('EditPost', { postId: post._id, post });
    }, 200);
  }, [navigation, post]);

  const handleDeletePost = useCallback(() => {
    closeMenu();
    setTimeout(() => {
      Alert.alert(
        'Delete Post',
        'Are you sure you want to delete this post? This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await api.delete(`/posts/${post._id}`);
                Alert.alert('Deleted', 'Your post has been deleted.');
                if (onDelete) onDelete(post._id);
              } catch (error) {
                console.error('Delete post error:', error);
                Alert.alert('Error', 'Failed to delete the post. Please try again.');
              }
            },
          },
        ]
      );
    }, 200);
  }, [post._id, onDelete]);

  const handleReportPost = useCallback(() => {
    closeMenu();
    setTimeout(() => {
      Alert.alert(
        'Report Post',
        'Why are you reporting this post?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Spam',
            onPress: () => submitReport('spam'),
          },
          {
            text: 'Inappropriate',
            onPress: () => submitReport('inappropriate'),
          },
          {
            text: 'Harassment',
            onPress: () => submitReport('harassment'),
          },
        ]
      );
    }, 200);
  }, [post._id]);

  const submitReport = useCallback(async (reason) => {
    try {
      await api.post(`/posts/${post._id}/report`, { reason });
      Alert.alert('Reported', 'Thanks for letting us know. We\'ll review this post.');
    } catch (error) {
      console.error('Report post error:', error);
      Alert.alert('Reported', 'Thanks for your report. We\'ll look into it.');
    }
  }, [post._id]);

  const handleCopyText = useCallback(async () => {
    closeMenu();
    const textToCopy = post.content?.text || '';
    if (textToCopy) {
      try {
        // Use expo-clipboard if available, fallback to Share
        const ExpoClipboard = await import('expo-clipboard').catch(() => null);
        if (ExpoClipboard) {
          await ExpoClipboard.setStringAsync(textToCopy);
          Alert.alert('Copied', 'Post text copied to clipboard.');
        } else {
          await Share.share({ message: textToCopy });
        }
      } catch {
        await Share.share({ message: textToCopy });
      }
    } else {
      Alert.alert('Nothing to copy', 'This post has no text content.');
    }
  }, [post.content?.text]);

  const handleSharePost = useCallback(async () => {
    closeMenu();
    setTimeout(async () => {
      try {
        const shareText = post.content?.text
          ? `${post.content.text.substring(0, 200)}${post.content.text.length > 200 ? '...' : ''}`
          : 'Check out this post on Pulse!';
        await Share.share({
          message: shareText,
          url: `pulse://post/${post._id}`,
        });
      } catch (error) {
        console.error('Share error:', error);
      }
    }, 200);
  }, [post._id, post.content?.text]);

  // ✅ MEMOIZED: Menu items based on ownership
  const menuItems = useMemo(() => {
    const items = [];

    if (isOwnPost) {
      items.push(
        { icon: 'create-outline', label: 'Edit Post', onPress: handleEditPost, color: theme.colors.text },
        { icon: 'trash-outline', label: 'Delete Post', onPress: handleDeletePost, color: '#E53935' },
      );
    } else {
      items.push(
        { icon: 'flag-outline', label: 'Report Post', onPress: handleReportPost, color: '#E53935' },
      );
    }

    items.push(
      { icon: 'copy-outline', label: 'Copy Text', onPress: handleCopyText, color: theme.colors.text },
      { icon: 'share-social-outline', label: 'Share Post', onPress: handleSharePost, color: theme.colors.text },
    );

    return items;
  }, [isOwnPost, theme.colors.text, handleEditPost, handleDeletePost, handleReportPost, handleCopyText, handleSharePost]);

  // ✅ MEMOIZED: Formats
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

  const mediaItems = useMemo(() => post.content?.media?.filter(item => item?.url) || [], [post.content?.media]);
  const hasMultipleImages = mediaItems.length > 1;

  // ✅ OPTIMIZED: Image Carousel Logic (Replaces ScrollView calculations)
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setActiveImageIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const renderImageItem = useCallback(({ item, index }) => (
    <Pressable onPress={handleImagePress} activeOpacity={0.9}>
      <Image
        source={{ uri: item.url }}
        style={[styles.postImage, { width: IMAGE_WIDTH }]}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={post._id + '-img-' + index}
        placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
        transition={200}
      />
    </Pressable>
  ), [handleImagePress, post._id]);

  return (
    <View style={[styles.postCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>

      {/* --- HEADER --- */}
      <View style={styles.postHeader}>
        <Pressable style={styles.userInfo} onPress={handleUserPress} disabled={post.isAnonymous}>
          <View style={styles.userRow}>
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={styles.avatar}
                cachePolicy="memory-disk"
                recyclingKey={post._id + '-avatar'}
              />
            ) : (
              <View style={[styles.avatar, { backgroundColor: theme.colors.primary + '20' }]}>
                <Text style={[styles.avatarText, { color: theme.colors.primary }]}>{displayName.charAt(0).toUpperCase()}</Text>
              </View>
            )}

            <View style={styles.userDetails}>
              <View style={styles.usernameRow}>
                <Text style={[styles.username, { color: theme.colors.text }]} numberOfLines={1}>
                  {post.isAnonymous ? 'Anonymous' : displayName}
                </Text>
                {post.author?.isVerified && !post.isAnonymous && (
                  <Ionicons name="checkmark-circle" size={16} color={theme.colors.primary} />
                )}
                {post.isAnonymous && (
                  <View style={styles.anonymousBadge}><Ionicons name="eye-off" size={11} color="#9C27B0" /></View>
                )}
              </View>
              <View style={styles.metaRow}>
                {!post.isAnonymous && post.author?.username && (
                  <>
                    <Text style={[styles.handle, { color: theme.colors.textSecondary }]}>@{post.author.username}</Text>
                    <Text style={[styles.dot, { color: theme.colors.textSecondary }]}>•</Text>
                  </>
                )}
                <Text style={[styles.timestamp, { color: theme.colors.textSecondary }]}>{formatTimestamp}</Text>
              </View>
            </View>
          </View>
        </Pressable>

        <TouchableOpacity style={styles.moreButton} onPress={openMenu} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="ellipsis-horizontal" size={20} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* --- CONTENT TEXT --- */}
      {post.content?.text && (
        <Pressable onPress={handlePostPress}>
          <Text style={[styles.caption, { color: theme.colors.text }]} numberOfLines={5}>
            {post.content.text}
          </Text>
        </Pressable>
      )}

      {/* --- IMAGE CAROUSEL (Optimized) --- */}
      {mediaItems.length > 0 && (
        <View style={styles.mediaContainer}>
          <FlatList
            data={mediaItems}
            renderItem={renderImageItem}
            keyExtractor={(item, index) => index.toString()}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            initialNumToRender={1}
            maxToRenderPerBatch={1}
            windowSize={3}
            removeClippedSubviews={false} // Crucial for nested lists
          />

          {hasMultipleImages && (
            <>
              <View style={[styles.imageCounter, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                <Ionicons name="images" size={12} color="#FFF" />
                <Text style={styles.imageCounterText}>{activeImageIndex + 1}/{mediaItems.length}</Text>
              </View>
              <View style={styles.pagination}>
                {mediaItems.map((_, index) => (
                  <View
                    key={`dot-${index}`}
                    style={[
                      styles.paginationDot,
                      {
                        backgroundColor: index === activeImageIndex ? '#FFF' : 'rgba(255,255,255,0.5)',
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

      {/* --- ACTIONS --- */}
      {showActions && (
        <View style={[styles.actions, { borderTopColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.actionButton} onPress={handleLike} activeOpacity={0.7}>
            <Animated.View style={{ transform: [{ scale: likeScale }] }}>
              <Ionicons
                name={post.isLiked ? "heart" : "heart-outline"}
                size={24}
                color={post.isLiked ? '#E91E63' : theme.colors.textSecondary}
              />
            </Animated.View>
            <Text style={[styles.actionText, { color: post.isLiked ? '#E91E63' : theme.colors.textSecondary }]}>
              {formatCount(post.stats?.likes)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleComment} activeOpacity={0.7}>
            <Ionicons name="chatbubble-outline" size={22} color={theme.colors.textSecondary} />
            <Text style={[styles.actionText, { color: theme.colors.textSecondary }]}>
              {formatCount(post.stats?.comments)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleSharePost} activeOpacity={0.7}>
            <Ionicons name="share-outline" size={23} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          <View style={{ flex: 1 }} />

          <TouchableOpacity style={styles.actionButton} onPress={handleBookmark} activeOpacity={0.7}>
            <Ionicons name={isBookmarked ? "bookmark" : "bookmark-outline"} size={23} color={isBookmarked ? theme.colors.primary : theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* --- BOTTOM SHEET MENU --- */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeMenu}
      >
        <Pressable style={styles.menuOverlay} onPress={closeMenu}>
          <Animated.View
            style={[
              styles.menuSheet,
              {
                backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
                opacity: menuFade,
                transform: [{
                  translateY: menuFade.interpolate({
                    inputRange: [0, 1],
                    outputRange: [100, 0],
                  }),
                }],
              },
            ]}
          >
            {/* Handle bar */}
            <View style={[styles.menuHandle, { backgroundColor: isDark ? '#555' : '#D0D0D0' }]} />

            {/* Post preview */}
            <View style={[styles.menuPostPreview, { borderBottomColor: isDark ? '#333' : '#F0F0F0' }]}>
              <Text style={[styles.menuPreviewLabel, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                {isOwnPost ? 'Your post' : `Post by ${post.isAnonymous ? 'Anonymous' : displayName}`}
              </Text>
              {post.content?.text && (
                <Text style={[styles.menuPreviewText, { color: theme.colors.text }]} numberOfLines={2}>
                  {post.content.text}
                </Text>
              )}
            </View>

            {/* Menu items */}
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.menuItem,
                  index < menuItems.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isDark ? '#333' : '#F0F0F0' },
                ]}
                onPress={item.onPress}
                activeOpacity={0.6}
              >
                <View style={[styles.menuIconWrap, { backgroundColor: (item.color === '#E53935' ? 'rgba(229,57,53,0.1)' : (isDark ? '#2A2A2A' : '#F5F5F5')) }]}>
                  <Ionicons name={item.icon} size={20} color={item.color} />
                </View>
                <Text style={[styles.menuLabel, { color: item.color }]}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={18} color={isDark ? '#555' : '#CCC'} />
              </TouchableOpacity>
            ))}

            {/* Cancel button */}
            <TouchableOpacity
              style={[styles.menuCancelButton, { backgroundColor: isDark ? '#2A2A2A' : '#F5F5F5' }]}
              onPress={closeMenu}
              activeOpacity={0.7}
            >
              <Text style={[styles.menuCancelText, { color: theme.colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  postCard: {
    marginHorizontal: CARD_MARGIN,
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
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 14 },
  userInfo: { flex: 1 },
  userRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', marginRight: 10, backgroundColor: '#E0E0E0' },
  avatarText: { fontSize: 18, fontWeight: '700' },
  userDetails: { flex: 1, justifyContent: 'center' },
  usernameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  username: { fontSize: 15, fontWeight: '600', maxWidth: '70%' },
  anonymousBadge: { backgroundColor: 'rgba(156, 39, 176, 0.15)', padding: 4, borderRadius: 10 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  handle: { fontSize: 12 },
  timestamp: { fontSize: 13 },
  dot: { fontSize: 10, marginHorizontal: 2 },
  moreButton: { padding: 4 },
  caption: { fontSize: 15, lineHeight: 22, paddingHorizontal: 14, marginBottom: 12 },
  mediaContainer: { width: '100%', position: 'relative' },
  postImage: { height: 400, backgroundColor: '#E0E0E0' },
  imageCounter: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, gap: 4 },
  imageCounterText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  pagination: { position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  paginationDot: { height: 6, borderRadius: 3 },
  actions: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1 },
  actionButton: { flexDirection: 'row', alignItems: 'center', marginRight: 20, gap: 6 },
  actionText: { fontSize: 14, fontWeight: '600' },

  // ✅ Bottom Sheet Menu Styles
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: 34,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  menuHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  menuPostPreview: {
    paddingBottom: 14,
    marginBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuPreviewLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  menuPreviewText: {
    fontSize: 14,
    lineHeight: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  menuIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  menuCancelButton: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  menuCancelText: {
    fontSize: 16,
    fontWeight: '700',
  },
});

// ✅ MEMOIZED TO PREVENT UNNECESSARY RE-RENDERS
export default React.memo(PostCard);