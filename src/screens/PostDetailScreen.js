// screens/PostDetailScreen.js
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  StyleSheet,
  StatusBar,
  Image,
  FlatList,
  RefreshControl,
  Share,
  Animated,
  Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'; // Added hook
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';
import { getTheme } from '../styles/theme';
import PostDetailCard from '../components/PostDetailCard';
import GifPickerModal from '../components/GifPickerModal';
import { useBookmark } from '../utils/bookmarkStore';
import api from '../services/api';
import { useSelector } from 'react-redux';

// ✅ HELPER: Robust Author Logic
const getAuthorDetails = (author) => {
  if (!author) return { avatarUrl: null, displayName: 'Unknown', username: 'unknown' };
  const avatarUrl = author.profile?.avatar || author.avatar;
  const displayName = author.profile?.displayName || author.name || author.username || 'Unknown';
  const username = author.username || 'unknown';
  return { avatarUrl, displayName, username };
};

// ✅ HELPER: Time Ago
const getTimeAgo = (createdAt) => {
  if (!createdAt) return '';
  const now = new Date();
  const diff = now - new Date(createdAt);
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// ⚡️ PERFORMANCE: Extracted & Memoized Comment Component
// This prevents the whole list from re-rendering when user types in the input box.
const CommentItem = React.memo(({
  comment,
  level = 0,
  expandedComments,
  toggleReplies,
  handleReply,
  handleLikeComment,
  theme
}) => {
  const replies = comment.replies || [];
  const hasReplies = replies.length > 0;
  const isExpanded = expandedComments.has(comment._id);
  const isNested = level > 0;
  const { avatarUrl, displayName } = getAuthorDetails(comment.author);

  // ✅ FIX: Limit visual indentation to 3 levels max, with smaller step
  // Old: level*40 → at level 2 = 80px (too much on 375px screens)
  // New: level*24 capped at 3 → max 72px, with reduced inner padding
  const visualLevel = Math.min(level, 3);
  const marginLeft = visualLevel * 24;

  // ✅ FIX: Reduce GIF height in nested comments to prevent overflow
  const gifHeight = isNested ? 120 : 200;

  return (
    <View>
      <View style={[
        styles.commentContainer,
        isNested && {
          marginLeft,
          borderLeftWidth: 2,
          borderLeftColor: theme.colors.border,
          borderBottomWidth: 0,
        }
      ]}>
        <View style={[styles.commentContent, isNested && { paddingHorizontal: 10, paddingVertical: 8 }]}>
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={[styles.commentAvatar, isNested && styles.replyAvatar]}
            />
          ) : (
            <View style={[styles.commentAvatar, isNested && styles.replyAvatar, { backgroundColor: theme.colors.primary }]}>
              <Text style={[styles.commentAvatarText, isNested && styles.replyAvatarText]}>
                {displayName?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          )}

          <View style={styles.commentBody}>
            <View style={styles.commentHeader}>
              <Text style={[styles.commentUsername, { color: theme.colors.text }, isNested && { fontSize: 13 }]}>
                {displayName}
              </Text>
              {comment.author?.isVerified && (
                <Ionicons name="checkmark-circle" size={12} color={theme.colors.primary} style={{ marginLeft: 4 }} />
              )}
            </View>

            {comment.content && (
              <Text style={[styles.commentText, { color: theme.colors.text }, isNested && { fontSize: 13, lineHeight: 18 }]}>
                {comment.content}
              </Text>
            )}

            {comment.gif && (
              <Image
                source={{ uri: comment.gif.url }}
                style={[styles.commentGif, { height: gifHeight }]}
                resizeMode="cover"
              />
            )}

            <View style={styles.commentActions}>
              <Text style={[styles.commentTime, { color: theme.colors.textSecondary }]}>
                {getTimeAgo(comment.createdAt)}
              </Text>

              <TouchableOpacity
                style={styles.commentActionBtn}
                onPress={() => handleLikeComment(comment._id)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={comment.isLikedByMe ? "heart" : "heart-outline"}
                  size={isNested ? 14 : 16}
                  color={comment.isLikedByMe ? '#E91E63' : theme.colors.textSecondary}
                />
                {(comment.likesCount > 0) && (
                  <Text style={[styles.commentActionText, { color: theme.colors.textSecondary }]}>
                    {comment.likesCount}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.commentActionBtn}
                onPress={() => handleReply(comment)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={[styles.commentReplyText, { color: theme.colors.textSecondary }]}>Reply</Text>
              </TouchableOpacity>
            </View>

            {hasReplies && (
              <TouchableOpacity
                style={styles.toggleRepliesBtn}
                onPress={() => toggleReplies(comment._id)}
              >
                <View style={{ width: 20, height: 1, backgroundColor: theme.colors.border, marginRight: 8 }} />
                <Text style={[styles.toggleRepliesText, { color: theme.colors.textSecondary }]}>
                  {isExpanded ? 'Hide' : 'View'} {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Recursive Render */}
      {hasReplies && isExpanded && replies.map(reply => (
        <CommentItem
          key={reply._id}
          comment={reply}
          level={level + 1}
          expandedComments={expandedComments}
          toggleReplies={toggleReplies}
          handleReply={handleReply}
          handleLikeComment={handleLikeComment}
          theme={theme}
        />
      ))}
    </View>
  );
});

const PostDetailScreen = ({ route, navigation }) => {
  const { postId } = route.params;
  const { isDark } = useTheme();
  const theme = getTheme(isDark);
  const { user } = useSelector(state => state.auth);
  const insets = useSafeAreaInsets(); // ✅ Handle bottom notch

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isBookmarked, toggleBookmark] = useBookmark(postId, post?.isBookmarked);

  const [commentText, setCommentText] = useState('');
  const [selectedGif, setSelectedGif] = useState(null);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sortBy, setSortBy] = useState('recent');
  const [replyingTo, setReplyingTo] = useState(null);
  const [expandedComments, setExpandedComments] = useState(new Set());

  const headerOpacity = useRef(new Animated.Value(1)).current;
  const inputFocused = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, [postId]);

  // Recursively expand comments logic...
  const autoExpandComments = (commentsArray, expandedSet = new Set()) => {
    commentsArray.forEach(comment => {
      if (comment.replies && comment.replies.length > 0) {
        expandedSet.add(comment._id);
        autoExpandComments(comment.replies, expandedSet);
      }
    });
    return expandedSet;
  };

  const fetchData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [postRes, commentRes] = await Promise.all([
        api.get(`/posts/${postId}`),
        api.get(`/posts/${postId}/comments`, { params: { sort: sortBy } })
      ]);

      if (postRes.data.success) {
        const fetchedPost = postRes.data.data;
        // Fix author structure
        if (fetchedPost.author && fetchedPost.author.profile) {
          fetchedPost.author.avatar = fetchedPost.author.profile.avatar || fetchedPost.author.avatar;
          fetchedPost.author.displayName = fetchedPost.author.profile.displayName || fetchedPost.author.username;
        }
        setPost(fetchedPost);
      }

      if (commentRes.data.success) {
        const fetchedComments = commentRes.data.data;
        setComments(fetchedComments);
        const newExpanded = autoExpandComments(fetchedComments);
        setExpandedComments(newExpanded);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(true);
  }, [sortBy]);

  const handleLikePost = async () => {
    try {
      const response = await api.post(`/posts/${postId}/like`);
      if (response.data.success) {
        setPost(prev => ({
          ...prev,
          isLiked: response.data.data.isLiked,
          stats: { ...prev.stats, likes: response.data.data.likeCount }
        }));
      }
    } catch (error) { console.error(error); }
  };

  const handleBookmark = () => { toggleBookmark(); };

  const handleShare = async () => {
    try {
      await Share.share({ message: `Check out this post!`, url: `yourapp://post/${postId}` });
    } catch (error) { console.error(error); }
  };

  const handleReply = useCallback((comment) => {
    setReplyingTo(comment);
    const { username } = getAuthorDetails(comment.author);
    // Don't auto-fill text, just set state, looks cleaner
    // setCommentText(`@${username} `); 
    inputRef.current?.focus();
  }, []);

  const cancelReply = () => {
    setReplyingTo(null);
    setCommentText('');
  };

  const handleSubmitComment = async () => {
    if ((!commentText.trim() && !selectedGif) || isSubmitting) return;

    const payload = {
      content: commentText.trim(),
      gif: selectedGif,
      parentCommentId: replyingTo?._id || null,
    };
    const parentId = replyingTo?._id || null;

    // Optimistic: clear the input immediately so the UI feels instant, then
    // insert the server's populated comment into local state — no full refetch.
    setIsSubmitting(true);
    setCommentText('');
    setSelectedGif(null);
    setReplyingTo(null);
    Keyboard.dismiss();

    try {
      const response = await api.post(`/posts/${postId}/comments`, payload);

      if (response.data.success) {
        const newComment = response.data.data;

        if (parentId) {
          // Reply: append under its parent and make sure the thread is expanded.
          setComments(prev => addReplyToComment(prev, parentId, newComment));
          setExpandedComments(prev => new Set(prev).add(parentId));
        } else {
          // Top-level: prepend for 'recent' sort, append otherwise.
          setComments(prev =>
            sortBy === 'recent' ? [newComment, ...prev] : [...prev, newComment]
          );
          if (sortBy === 'recent') {
            setTimeout(() => {
              flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
            }, 100);
          }
        }

        // Bump the post's comment count locally.
        setPost(prev =>
          prev
            ? { ...prev, stats: { ...prev.stats, comments: (prev.stats?.comments || 0) + 1 } }
            : prev
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to post comment');
      // Restore the draft so the user doesn't lose what they typed.
      setCommentText(payload.content);
      setSelectedGif(payload.gif);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Recursively insert a reply under the comment whose _id === parentId.
  const addReplyToComment = (list, parentId, reply) =>
    list.map(c => {
      if (c._id === parentId) {
        return { ...c, replies: [...(c.replies || []), reply] };
      }
      if (c.replies && c.replies.length > 0) {
        return { ...c, replies: addReplyToComment(c.replies, parentId, reply) };
      }
      return c;
    });

  const handleSelectGif = (gif) => {
    setSelectedGif(gif);
    setShowGifPicker(false);
  };

  const toggleSort = () => {
    const newSort = sortBy === 'recent' ? 'top' : 'recent';
    setSortBy(newSort);
    fetchData(true);
  };

  const toggleReplies = useCallback((commentId) => {
    setExpandedComments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(commentId)) newSet.delete(commentId);
      else newSet.add(commentId);
      return newSet;
    });
  }, []);

  const handleLikeComment = useCallback(async (commentId) => {
    // Optimistic update helper — recursively find and update the comment
    const updateCommentLike = (commentsList, id) => {
      return commentsList.map(c => {
        if (c._id === id) {
          const isCurrentlyLiked = c.isLikedByMe;
          const currentUserId = user?._id || user?.id;
          return {
            ...c,
            isLikedByMe: !isCurrentlyLiked,
            likesCount: isCurrentlyLiked ? (c.likesCount || 1) - 1 : (c.likesCount || 0) + 1,
            likes: isCurrentlyLiked
              ? (c.likes || []).filter(id => id.toString() !== currentUserId)
              : [...(c.likes || []), currentUserId],
          };
        }
        if (c.replies && c.replies.length > 0) {
          return { ...c, replies: updateCommentLike(c.replies, id) };
        }
        return c;
      });
    };

    // Optimistic UI update
    setComments(prev => updateCommentLike(prev, commentId));

    try {
      await api.post(`/posts/${postId}/comments/${commentId}/like`);
    } catch (error) {
      console.error('Like comment error:', error);
      // Revert on error
      setComments(prev => updateCommentLike(prev, commentId));
    }
  }, [postId, user]);

  const renderHeader = () => {
    if (!post) return null;
    return (
      <View>
        <PostDetailCard
          post={post}
          onLike={handleLikePost}
          onShare={handleShare}
          onBookmark={handleBookmark}
          isBookmarked={isBookmarked}
        />
        <View style={[styles.commentHeaderSection, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Comments ({post.stats?.comments || 0})
          </Text>
          {comments.length > 0 && (
            <TouchableOpacity
              onPress={toggleSort}
              style={[styles.sortButton, { backgroundColor: isDark ? '#333' : '#F2F3F5' }]}
            >
              <Ionicons name={sortBy === 'recent' ? 'time-outline' : 'trending-up-outline'} size={16} color={theme.colors.textSecondary} />
              <Text style={[styles.sortText, { color: theme.colors.textSecondary }]}>
                {sortBy === 'recent' ? 'Recent' : 'Top'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const currentUserDetails = getAuthorDetails(user);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* ✅ FIXED KEYBOARD BEHAVIOR 
         Fixed behavior + offset ensures no bouncing on Android/iOS
      */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Header */}
        <Animated.View style={[styles.header, { backgroundColor: theme.colors.surface, opacity: headerOpacity }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Post</Text>
          <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
            <Ionicons name="share-outline" size={22} color={theme.colors.text} />
          </TouchableOpacity>
        </Animated.View>

        <FlatList
          ref={flatListRef}
          data={comments}
          // ✅ Use Memoized Component
          renderItem={({ item }) => (
            <CommentItem
              comment={item}
              level={0}
              expandedComments={expandedComments}
              toggleReplies={toggleReplies}
              handleReply={handleReply}
              handleLikeComment={handleLikeComment}
              theme={theme}
            />
          )}
          keyExtractor={(item) => item._id}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            !isLoading ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubbles-outline" size={64} color={theme.colors.textSecondary} />
                <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>Be the first to comment</Text>
              </View>
            ) : null
          }
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
          }
        />

        {/* Input Area */}
        <Animated.View style={[
          styles.inputWrapper,
          {
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.border,
            // ✅ Fix bottom padding for notched devices when keyboard closed
            paddingBottom: Math.max(insets.bottom, 14),
          }
        ]}>

          {replyingTo && (
            <View style={[styles.replyIndicator, { backgroundColor: isDark ? '#2A2A2A' : '#F2F3F5' }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.replyingToText, { color: theme.colors.textSecondary }]}>Replying to</Text>
                <Text style={[styles.replyingToName, { color: theme.colors.text }]} numberOfLines={1}>
                  @{getAuthorDetails(replyingTo.author).username}
                </Text>
              </View>
              <TouchableOpacity onPress={cancelReply} style={styles.cancelReplyButton}>
                <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          {selectedGif && (
            <View style={styles.gifPreviewContainer}>
              <Image source={{ uri: selectedGif.preview || selectedGif.url }} style={styles.gifPreviewImage} resizeMode="cover" />
              <TouchableOpacity style={styles.removeGifButton} onPress={() => setSelectedGif(null)}>
                <Ionicons name="close-circle" size={24} color="rgba(0,0,0,0.6)" />
              </TouchableOpacity>
            </View>
          )}

          <View style={[styles.inputContainer, { backgroundColor: isDark ? '#2A2A2A' : '#F2F3F5' }]}>
            {currentUserDetails.avatarUrl ? (
              <Image source={{ uri: currentUserDetails.avatarUrl }} style={styles.inputAvatar} />
            ) : (
              <View style={[styles.inputAvatar, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.inputAvatarText}>{currentUserDetails.displayName?.charAt(0).toUpperCase() || 'U'}</Text>
              </View>
            )}

            <TextInput
              ref={inputRef}
              style={[styles.input, { color: theme.colors.text }]}
              placeholder={replyingTo ? `Reply to @${getAuthorDetails(replyingTo.author).username}...` : "Add a thoughtful comment..."}
              placeholderTextColor={theme.colors.textSecondary}
              value={commentText}
              onChangeText={setCommentText}
              multiline
              maxLength={500}
              onFocus={() => Animated.spring(inputFocused, { toValue: 1, useNativeDriver: true }).start()}
              onBlur={() => Animated.spring(inputFocused, { toValue: 0, useNativeDriver: true }).start()}
            />

            <View style={styles.inputActions}>
              <TouchableOpacity onPress={() => setShowGifPicker(true)} style={styles.iconButton}>
                <Ionicons
                  name={selectedGif ? "image" : "happy-outline"}
                  size={22}
                  color={selectedGif ? theme.colors.primary : theme.colors.textSecondary}
                />
              </TouchableOpacity>

              {(commentText.trim().length > 0 || selectedGif) && (
                <TouchableOpacity
                  onPress={handleSubmitComment}
                  style={[styles.sendButton, { backgroundColor: theme.colors.primary }]}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="arrow-up" size={20} color="#FFF" />}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>

      <GifPickerModal
        visible={showGifPicker}
        onClose={() => setShowGifPicker(false)}
        onSelectGif={handleSelectGif}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.1)',
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  backButton: { padding: 4 },
  shareButton: { padding: 4 },
  commentHeaderSection: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 16, marginTop: 8,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.5 },
  sortButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  sortText: { fontSize: 13, fontWeight: '600' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, marginTop: 16, fontWeight: '500' },

  // Comment Styles
  commentContainer: { borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.05)' },
  commentContent: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12 },
  commentAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10, justifyContent: 'center', alignItems: 'center' },
  replyAvatar: { width: 28, height: 28, borderRadius: 14, marginRight: 8 },
  commentAvatarText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  replyAvatarText: { fontSize: 12 },
  commentBody: { flex: 1 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  commentUsername: { fontSize: 14, fontWeight: '700' },
  commentText: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  commentGif: { width: '100%', height: 200, borderRadius: 12, marginTop: 8, marginBottom: 8, backgroundColor: '#f0f0f0' },
  commentActions: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 },
  commentTime: { fontSize: 13, fontWeight: '500' },
  commentActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  commentActionText: { fontSize: 13, fontWeight: '600' },
  commentReplyText: { fontSize: 13, fontWeight: '700' },
  toggleRepliesBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  toggleRepliesText: { fontSize: 13, fontWeight: '600' },

  // Input Styles
  inputWrapper: {
    paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 0.5,
    elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.08, shadowRadius: 4,
  },
  replyIndicator: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginBottom: 8 },
  replyingToText: { fontSize: 11, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 },
  replyingToName: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  cancelReplyButton: { padding: 4 },
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', borderRadius: 24, paddingHorizontal: 12, paddingVertical: 10, minHeight: 48 },
  inputAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: 10, justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-end', marginBottom: 2 },
  inputAvatarText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  input: { flex: 1, fontSize: 15, maxHeight: 100, paddingTop: 8, paddingBottom: 8, paddingHorizontal: 4, lineHeight: 20 },
  inputActions: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 2 },
  iconButton: { padding: 6, justifyContent: 'center', alignItems: 'center' },
  sendButton: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  gifPreviewContainer: { marginBottom: 10, position: 'relative', alignSelf: 'flex-start' },
  gifPreviewImage: { width: 150, height: 100, borderRadius: 12, backgroundColor: '#eee' },
  removeGifButton: { position: 'absolute', top: -8, right: -8, backgroundColor: '#fff', borderRadius: 12 },
});

export default PostDetailScreen;