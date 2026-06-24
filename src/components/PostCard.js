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
import { getDisplayName } from '../utils/avatarHelper';
import { useBookmark } from '../utils/bookmarkStore';
import Avatar from './UI/Avatar';
import api from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_MARGIN = 14;
const IMAGE_WIDTH = SCREEN_WIDTH - CARD_MARGIN * 2;

const PostCard = ({ post, onLike, onComment, onBookmark, onDelete, showActions = true }) => {
  const navigation = useNavigation();
  const { isDark } = useTheme();
  const theme = getTheme(isDark);
  const currentUser = useSelector(state => state.auth.user);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isBookmarked, toggleBookmark] = useBookmark(post._id, post.isBookmarked);
  const [menuVisible, setMenuVisible] = useState(false);
  const lastTap = useRef(null);

  const likeScale = useRef(new Animated.Value(1)).current;
  const menuFade = useRef(new Animated.Value(0)).current;

  const displayName = getDisplayName(post.author);

  const isOwnPost = useMemo(() => {
    if (!currentUser || !post.author) return false;
    return (post.author._id === currentUser._id) || (post.author.username === currentUser.username);
  }, [currentUser, post.author]);

  const handlePostPress = useCallback(() => {
    navigation.navigate('PostDetail', { postId: post._id });
  }, [navigation, post._id]);

  const handleUserPress = useCallback(() => {
    if (post.isAnonymous || !post.author) return;
    const isMe = (post.author._id === currentUser?._id) || (post.author.username === currentUser?.username);
    if (isMe) navigation.navigate('Profile', { screen: 'ProfileMain' });
    else navigation.navigate('UserProfile', { userId: post.author._id, username: post.author.username });
  }, [navigation, post.isAnonymous, post.author, currentUser]);

  const handleLike = useCallback(() => {
    Animated.sequence([
      Animated.timing(likeScale, { toValue: 0.82, duration: 90, useNativeDriver: true }),
      Animated.spring(likeScale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
    onLike?.(post._id);
  }, [onLike, post._id]);

  const handleImagePress = useCallback(() => {
    const now = Date.now();
    if (lastTap.current && (now - lastTap.current) < 300) {
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
    toggleBookmark();
    onBookmark?.(post._id);
  }, [toggleBookmark, onBookmark, post._id]);

  const openMenu = useCallback(() => {
    setMenuVisible(true);
    Animated.timing(menuFade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, []);
  const closeMenu = useCallback(() => {
    Animated.timing(menuFade, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => setMenuVisible(false));
  }, []);

  const handleEditPost = useCallback(() => {
    closeMenu();
    setTimeout(() => navigation.navigate('EditPost', { postId: post._id, post }), 200);
  }, [navigation, post]);

  const handleDeletePost = useCallback(() => {
    closeMenu();
    setTimeout(() => {
      Alert.alert('Delete post', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/posts/${post._id}`);
              if (onDelete) onDelete(post._id);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete the post. Please try again.');
            }
          },
        },
      ]);
    }, 200);
  }, [post._id, onDelete]);

  const submitReport = useCallback(async (reason) => {
    try { await api.post(`/posts/${post._id}/report`, { reason }); } catch { /* best-effort */ }
    Alert.alert('Reported', "Thanks — we'll review this post.");
  }, [post._id]);

  const handleReportPost = useCallback(() => {
    closeMenu();
    setTimeout(() => {
      Alert.alert('Report post', 'Why are you reporting this?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Spam', onPress: () => submitReport('spam') },
        { text: 'Inappropriate', onPress: () => submitReport('inappropriate') },
        { text: 'Harassment', onPress: () => submitReport('harassment') },
      ]);
    }, 200);
  }, [submitReport]);

  const handleCopyText = useCallback(async () => {
    closeMenu();
    const textToCopy = post.content?.text || '';
    if (!textToCopy) return Alert.alert('Nothing to copy', 'This post has no text.');
    try {
      const ExpoClipboard = await import('expo-clipboard').catch(() => null);
      if (ExpoClipboard) { await ExpoClipboard.setStringAsync(textToCopy); Alert.alert('Copied', 'Text copied.'); }
      else await Share.share({ message: textToCopy });
    } catch { await Share.share({ message: textToCopy }); }
  }, [post.content?.text]);

  const handleSharePost = useCallback(async () => {
    closeMenu();
    setTimeout(async () => {
      try {
        const shareText = post.content?.text
          ? `${post.content.text.substring(0, 200)}${post.content.text.length > 200 ? '…' : ''}`
          : 'Check out this post on Pulse';
        await Share.share({ message: shareText, url: `pulse://post/${post._id}` });
      } catch { /* cancelled */ }
    }, 200);
  }, [post._id, post.content?.text]);

  const menuItems = useMemo(() => {
    const items = [];
    if (isOwnPost) {
      items.push(
        { icon: 'create-outline', label: 'Edit post', onPress: handleEditPost, color: theme.colors.text },
        { icon: 'trash-outline', label: 'Delete post', onPress: handleDeletePost, color: theme.colors.error },
      );
    } else {
      items.push({ icon: 'flag-outline', label: 'Report post', onPress: handleReportPost, color: theme.colors.error });
    }
    items.push(
      { icon: 'copy-outline', label: 'Copy text', onPress: handleCopyText, color: theme.colors.text },
      { icon: 'share-social-outline', label: 'Share post', onPress: handleSharePost, color: theme.colors.text },
    );
    return items;
  }, [isOwnPost, theme.colors, handleEditPost, handleDeletePost, handleReportPost, handleCopyText, handleSharePost]);

  const formatTimestamp = useMemo(() => {
    if (!post.createdAt) return '';
    const diff = Math.floor((Date.now() - new Date(post.createdAt)) / 1000);
    if (diff < 60) return 'now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
    return new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }, [post.createdAt]);

  const formatCount = useCallback((count) => {
    if (!count) return '';
    if (count < 1000) return String(count);
    if (count < 1000000) return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}K`;
    return `${(count / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  }, []);

  const mediaItems = useMemo(() => post.content?.media?.filter(item => item?.url) || [], [post.content?.media]);
  const hasMultipleImages = mediaItems.length > 1;

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) setActiveImageIndex(viewableItems[0].index);
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const renderImageItem = useCallback(({ item, index }) => (
    <Pressable onPress={handleImagePress}>
      <Image
        source={{ uri: item.url }}
        style={[styles.postImage, { width: IMAGE_WIDTH }]}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={post._id + '-img-' + index}
        transition={180}
      />
    </Pressable>
  ), [handleImagePress, post._id]);

  const anonAuthor = { username: 'anonymous', profile: { displayName: 'Anonymous' } };

  return (
    <View style={[styles.postCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }, theme.elevation(1)]}>
      {/* HEADER */}
      <View style={styles.postHeader}>
        <Pressable style={styles.userInfo} onPress={handleUserPress} disabled={post.isAnonymous}>
          <Avatar
            user={post.isAnonymous ? anonAuthor : post.author}
            size={42}
            verified={post.author?.isVerified && !post.isAnonymous}
          />
          <View style={styles.userDetails}>
            <View style={styles.usernameRow}>
              <Text style={[styles.username, { color: theme.colors.text }]} numberOfLines={1}>
                {post.isAnonymous ? 'Anonymous' : displayName}
              </Text>
              {post.isAnonymous && (
                <View style={[styles.anonymousBadge, { backgroundColor: theme.colors.surfaceAlt }]}>
                  <Ionicons name="eye-off-outline" size={11} color={theme.colors.textSecondary} />
                </View>
              )}
            </View>
            <View style={styles.metaRow}>
              {!post.isAnonymous && post.author?.username && (
                <>
                  <Text style={[styles.handle, { color: theme.colors.textTertiary }]} numberOfLines={1}>@{post.author.username}</Text>
                  <Text style={[styles.dot, { color: theme.colors.textTertiary }]}>·</Text>
                </>
              )}
              <Text style={[styles.timestamp, { color: theme.colors.textTertiary }]}>{formatTimestamp}</Text>
            </View>
          </View>
        </Pressable>

        <TouchableOpacity style={styles.moreButton} onPress={openMenu} hitSlop={hit}>
          <Ionicons name="ellipsis-horizontal" size={19} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* TEXT */}
      {post.content?.text ? (
        <Pressable onPress={handlePostPress}>
          <Text style={[styles.caption, { color: theme.colors.text }]} numberOfLines={6}>
            {post.content.text}
          </Text>
        </Pressable>
      ) : null}

      {/* MEDIA */}
      {mediaItems.length > 0 && (
        <View style={[styles.mediaContainer, { borderColor: theme.colors.separator }]}>
          <FlatList
            data={mediaItems}
            renderItem={renderImageItem}
            keyExtractor={(_, index) => index.toString()}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            initialNumToRender={1}
            maxToRenderPerBatch={1}
            windowSize={3}
            removeClippedSubviews={false}
          />
          {hasMultipleImages && (
            <>
              <View style={styles.imageCounter}>
                <Text style={styles.imageCounterText}>{activeImageIndex + 1}/{mediaItems.length}</Text>
              </View>
              <View style={styles.pagination}>
                {mediaItems.map((_, index) => (
                  <View
                    key={`dot-${index}`}
                    style={[styles.paginationDot, {
                      backgroundColor: index === activeImageIndex ? '#FFF' : 'rgba(255,255,255,0.55)',
                      width: index === activeImageIndex ? 16 : 5,
                    }]}
                  />
                ))}
              </View>
            </>
          )}
        </View>
      )}

      {/* ACTIONS */}
      {showActions && (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={handleLike} activeOpacity={0.7} hitSlop={hit}>
            <Animated.View style={{ transform: [{ scale: likeScale }] }}>
              <Ionicons name={post.isLiked ? 'heart' : 'heart-outline'} size={24} color={post.isLiked ? theme.colors.accent : theme.colors.text} />
            </Animated.View>
            {!!formatCount(post.stats?.likes) && (
              <Text style={[styles.actionText, { color: post.isLiked ? theme.colors.accent : theme.colors.textSecondary }]}>
                {formatCount(post.stats?.likes)}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleComment} activeOpacity={0.7} hitSlop={hit}>
            <Ionicons name="chatbubble-outline" size={22} color={theme.colors.text} />
            {!!formatCount(post.stats?.comments) && (
              <Text style={[styles.actionText, { color: theme.colors.textSecondary }]}>{formatCount(post.stats?.comments)}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleSharePost} activeOpacity={0.7} hitSlop={hit}>
            <Ionicons name="paper-plane-outline" size={21} color={theme.colors.text} />
          </TouchableOpacity>

          <View style={{ flex: 1 }} />

          <TouchableOpacity style={styles.actionButton} onPress={handleBookmark} activeOpacity={0.7} hitSlop={hit}>
            <Ionicons name={isBookmarked ? 'bookmark' : 'bookmark-outline'} size={22} color={isBookmarked ? theme.colors.primary : theme.colors.text} />
          </TouchableOpacity>
        </View>
      )}

      {/* MENU SHEET */}
      <Modal visible={menuVisible} transparent animationType="none" statusBarTranslucent onRequestClose={closeMenu}>
        <Pressable style={[styles.menuOverlay, { backgroundColor: theme.colors.overlay }]} onPress={closeMenu}>
          <Animated.View
            style={[
              styles.menuSheet,
              theme.elevation(3),
              {
                backgroundColor: theme.colors.surfaceElevated,
                opacity: menuFade,
                transform: [{ translateY: menuFade.interpolate({ inputRange: [0, 1], outputRange: [120, 0] }) }],
              },
            ]}
          >
            <View style={[styles.menuHandle, { backgroundColor: theme.colors.borderStrong }]} />
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.menuItem, index < menuItems.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.separator }]}
                onPress={item.onPress}
                activeOpacity={0.6}
              >
                <View style={[styles.menuIconWrap, { backgroundColor: item.color === theme.colors.error ? theme.colors.accentMuted : theme.colors.surfaceAlt }]}>
                  <Ionicons name={item.icon} size={20} color={item.color} />
                </View>
                <Text style={[styles.menuLabel, { color: item.color }]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.menuCancelButton, { backgroundColor: theme.colors.surfaceAlt }]} onPress={closeMenu} activeOpacity={0.7}>
              <Text style={[styles.menuCancelText, { color: theme.colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
};

const hit = { top: 8, bottom: 8, left: 8, right: 8 };

const styles = StyleSheet.create({
  postCard: { marginHorizontal: CARD_MARGIN, marginTop: 10, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingTop: 12, paddingBottom: 10 },
  userInfo: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  userDetails: { flex: 1, justifyContent: 'center', marginLeft: 4 },
  usernameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  username: { fontSize: 15, fontWeight: '700', maxWidth: '74%', letterSpacing: -0.2 },
  anonymousBadge: { padding: 4, borderRadius: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  handle: { fontSize: 12.5, maxWidth: '60%' },
  timestamp: { fontSize: 12.5 },
  dot: { fontSize: 12 },
  moreButton: { padding: 6 },
  caption: { fontSize: 15, lineHeight: 21, paddingHorizontal: 14, marginBottom: 12 },
  mediaContainer: { width: '100%', position: 'relative' },
  postImage: { height: 420, backgroundColor: '#00000010' },
  imageCounter: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12 },
  imageCounterText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  pagination: { position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5 },
  paginationDot: { height: 5, borderRadius: 3 },
  actions: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 11 },
  actionButton: { flexDirection: 'row', alignItems: 'center', marginRight: 18, gap: 6 },
  actionText: { fontSize: 13.5, fontWeight: '700' },

  menuOverlay: { flex: 1, justifyContent: 'flex-end' },
  menuSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10, paddingBottom: 34, paddingHorizontal: 18 },
  menuHandle: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13 },
  menuIconWrap: { width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  menuLabel: { flex: 1, fontSize: 15.5, fontWeight: '600' },
  menuCancelButton: { marginTop: 12, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  menuCancelText: { fontSize: 15.5, fontWeight: '700' },
});

export default React.memo(PostCard);
