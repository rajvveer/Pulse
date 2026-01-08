// screens/PostDetailScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';
import { getTheme } from '../styles/theme';
import PostDetailCard from '../components/PostDetailCard';
import GifPickerModal from '../components/GifPickerModal';
import api from '../services/api';
import { useSelector } from 'react-redux';

const PostDetailScreen = ({ route, navigation }) => {
  const { postId } = route.params;
  const { isDark } = useTheme();
  const theme = getTheme(isDark);
  const { user } = useSelector(state => state.auth);
  
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  
  const [commentText, setCommentText] = useState('');
  const [selectedGif, setSelectedGif] = useState(null);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sortBy, setSortBy] = useState('recent');
  const [keyboardBehavior, setKeyboardBehavior] = useState(undefined);
  const [replyingTo, setReplyingTo] = useState(null);
  const [expandedComments, setExpandedComments] = useState(new Set());
  
  const headerOpacity = useRef(new Animated.Value(1)).current;
  const inputFocused = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    fetchData();
    
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardBehavior('padding')
    );
    
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardBehavior(undefined)
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, [postId]);

  // ✅ HELPER: Robust Author Logic (Extracts nested profile data)
  const getAuthorDetails = (author) => {
    if (!author) return { avatarUrl: null, displayName: 'Unknown', username: 'unknown' };
    
    // Check nested profile first, then root properties
    const avatarUrl = author.profile?.avatar || author.avatar;
    const displayName = author.profile?.displayName || author.name || author.username || 'Unknown';
    const username = author.username || 'unknown';
    
    return { avatarUrl, displayName, username };
  };

  // ✅ Auto-expand comments with replies
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
        
        // 🔥 FIX FOR POST DETAIL CARD: 
        // Manually flatten the author object so the Card (which we can't edit) sees the correct data
        if (fetchedPost.author && fetchedPost.author.profile) {
            fetchedPost.author.avatar = fetchedPost.author.profile.avatar || fetchedPost.author.avatar;
            fetchedPost.author.displayName = fetchedPost.author.profile.displayName || fetchedPost.author.username;
            fetchedPost.author.name = fetchedPost.author.profile.displayName || fetchedPost.author.name; // Fallback for name
        }

        setPost(fetchedPost);
        setIsBookmarked(fetchedPost.isBookmarked || false);
      }
      
      if (commentRes.data.success) {
        const fetchedComments = commentRes.data.data;
        setComments(fetchedComments);
        
        const newExpanded = autoExpandComments(fetchedComments);
        setExpandedComments(newExpanded);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load post details');
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
    } catch (error) {
      console.error(error);
    }
  };

  const handleBookmark = async () => {
    try {
      const response = await api.post(`/posts/${postId}/bookmark`);
      if (response.data.success) {
        setIsBookmarked(!isBookmarked);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out this post: ${post.content?.text || 'Interesting post!'}`,
        url: `yourapp://post/${postId}`,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleReply = (comment) => {
    setReplyingTo(comment);
    const { username } = getAuthorDetails(comment.author);
    setCommentText(`@${username} `);
    inputRef.current?.focus();
  };

  const cancelReply = () => {
    setReplyingTo(null);
    setCommentText('');
  };

  const handleSubmitComment = async () => {
    if ((!commentText.trim() && !selectedGif) || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const payload = {
        content: commentText.trim(),
        gif: selectedGif,
        parentCommentId: replyingTo?._id || null,
      };

      const response = await api.post(`/posts/${postId}/comments`, payload);
      
      if (response.data.success) {
        await fetchData(true);
        setCommentText('');
        setSelectedGif(null);
        setReplyingTo(null);
        Keyboard.dismiss();
      }
    } catch (error) {
      console.error('Error posting comment:', error);
      Alert.alert('Error', 'Failed to post comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectGif = (gif) => {
    setSelectedGif(gif);
    setShowGifPicker(false);
  };

  const removeGif = () => {
    setSelectedGif(null);
  };

  const toggleSort = () => {
    const newSort = sortBy === 'recent' ? 'top' : 'recent';
    setSortBy(newSort);
    fetchData(true);
  };

  const toggleReplies = (commentId) => {
    setExpandedComments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(commentId)) {
        newSet.delete(commentId);
      } else {
        newSet.add(commentId);
      }
      return newSet;
    });
  };

  const handleLikeComment = async (commentId) => {
    console.log('Like comment:', commentId);
  };

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

  // ✅ Instagram-style recursive render with proper indentation
  const renderComment = (comment, level = 0) => {
    const replies = comment.replies || [];
    const hasReplies = replies.length > 0;
    const isExpanded = expandedComments.has(comment._id);
    const isNested = level > 0;
    
    // ✅ Use Helper to get correct Avatar/Name
    const { avatarUrl, displayName } = getAuthorDetails(comment.author);
    
    // ✅ Limit indentation to max 2 levels visually (like Instagram)
    const visualLevel = Math.min(level, 2);
    const marginLeft = visualLevel * 40; // 40px per level, max 2 levels

    return (
      <View key={comment._id}>
        <View style={[
          styles.commentContainer,
          isNested && { marginLeft }
        ]}>
          <View style={styles.commentContent}>
            {/* ✅ FIXED AVATAR */}
            {avatarUrl ? (
              <Image 
                source={{ uri: avatarUrl }} 
                style={[styles.commentAvatar, isNested && styles.replyAvatar]} 
              />
            ) : (
              <View style={[
                styles.commentAvatar, 
                isNested && styles.replyAvatar,
                { backgroundColor: theme.colors.primary }
              ]}>
                <Text style={[styles.commentAvatarText, isNested && styles.replyAvatarText]}>
                  {displayName?.charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
            )}

            <View style={styles.commentBody}>
              <View style={styles.commentHeader}>
                {/* ✅ FIXED NAME */}
                <Text style={[styles.commentUsername, { color: theme.colors.text }]}>
                  {displayName}
                </Text>
                {comment.author?.isVerified && (
                  <Ionicons 
                    name="checkmark-circle" 
                    size={12} 
                    color={theme.colors.primary} 
                    style={{ marginLeft: 4 }} 
                  />
                )}
              </View>

              {comment.content && (
                <Text style={[styles.commentText, { color: theme.colors.text }]}>
                  {comment.content}
                </Text>
              )}

              {comment.gif && (
                <Image 
                  source={{ uri: comment.gif.url }} 
                  style={styles.commentGif}
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
                  hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                >
                  <Ionicons 
                    name={comment.isLiked ? "heart" : "heart-outline"} 
                    size={16} 
                    color={comment.isLiked ? '#E91E63' : theme.colors.textSecondary} 
                  />
                  {(comment.likes?.length > 0) && (
                    <Text style={[styles.commentActionText, { color: theme.colors.textSecondary }]}>
                      {comment.likes.length}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.commentActionBtn}
                  onPress={() => handleReply(comment)}
                  hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                >
                  <Text style={[styles.commentReplyText, { color: theme.colors.textSecondary }]}>
                    Reply
                  </Text>
                </TouchableOpacity>
              </View>

              {/* ✅ Show/Hide replies toggle */}
              {hasReplies && (
                <TouchableOpacity 
                  style={styles.toggleRepliesBtn}
                  onPress={() => toggleReplies(comment._id)}
                >
                  <Ionicons 
                    name={isExpanded ? "chevron-up" : "chevron-down"} 
                    size={14} 
                    color={theme.colors.primary} 
                  />
                  <Text style={[styles.toggleRepliesText, { color: theme.colors.primary }]}>
                    {isExpanded ? 'Hide' : 'Show'} {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* ✅ Recursively render nested replies when expanded */}
        {hasReplies && isExpanded && replies.map(reply => renderComment(reply, level + 1))}
      </View>
    );
  };

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
              <Ionicons 
                name={sortBy === 'recent' ? 'time-outline' : 'trending-up-outline'} 
                size={16} 
                color={theme.colors.textSecondary} 
              />
              <Text style={[styles.sortText, { color: theme.colors.textSecondary }]}>
                {sortBy === 'recent' ? 'Recent' : 'Top'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="chatbubbles-outline" size={64} color={theme.colors.textSecondary} />
      <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
        Be the first to comment
      </Text>
    </View>
  );

  // ✅ Get Current User Details for Input using helper
  const currentUserDetails = getAuthorDetails(user);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView 
      style={[styles.container, { backgroundColor: theme.colors.background }]} 
      edges={['top']}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={keyboardBehavior}
        keyboardVerticalOffset={0}
      >
        <Animated.View style={[
          styles.header, 
          { 
            backgroundColor: theme.colors.surface,
            opacity: headerOpacity
          }
        ]}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.backButton}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Post</Text>
          <TouchableOpacity 
            style={styles.shareButton}
            onPress={handleShare}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
          >
            <Ionicons name="share-outline" size={22} color={theme.colors.text} />
          </TouchableOpacity>
        </Animated.View>

        <FlatList
          ref={flatListRef}
          data={comments}
          renderItem={({ item }) => renderComment(item, 0)}
          keyExtractor={(item) => item._id}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={comments.length === 0 && !isLoading ? renderEmpty : null}
          contentContainerStyle={{ 
            flexGrow: 1, 
            paddingBottom: 10 
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={true}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
        />

        <Animated.View style={[
          styles.inputWrapper, 
          { 
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.border,
            paddingBottom: Platform.OS === 'ios' ? 0 : 8,
          }
        ]}>
          
          {replyingTo && (
            <View style={[styles.replyIndicator, { backgroundColor: isDark ? '#2A2A2A' : '#F2F3F5' }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.replyingToText, { color: theme.colors.textSecondary }]}>
                  Replying to
                </Text>
                {/* ✅ FIXED: Use helper for reply username */}
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
              <Image 
                source={{ uri: selectedGif.preview || selectedGif.url }} 
                style={styles.gifPreviewImage}
                resizeMode="cover"
              />
              <TouchableOpacity style={styles.removeGifButton} onPress={removeGif}>
                <Ionicons name="close-circle" size={24} color="rgba(0,0,0,0.6)" />
              </TouchableOpacity>
            </View>
          )}

          <View style={[styles.inputContainer, { backgroundColor: isDark ? '#2A2A2A' : '#F2F3F5' }]}>
            {/* ✅ FIXED: Input Avatar using helper */}
            {currentUserDetails.avatarUrl ? (
              <Image source={{ uri: currentUserDetails.avatarUrl }} style={styles.inputAvatar} />
            ) : (
              <View style={[styles.inputAvatar, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.inputAvatarText}>
                  {currentUserDetails.displayName?.charAt(0).toUpperCase() || 'U'}
                </Text>
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
              onFocus={() => {
                Animated.spring(inputFocused, {
                  toValue: 1,
                  useNativeDriver: true,
                }).start();
              }}
              onBlur={() => {
                Animated.spring(inputFocused, {
                  toValue: 0,
                  useNativeDriver: true,
                }).start();
              }}
            />

            <View style={styles.inputActions}>
              <TouchableOpacity 
                onPress={() => setShowGifPicker(true)} 
                style={styles.iconButton}
              >
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
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Ionicons name="arrow-up" size={20} color="#FFF" />
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>

          {commentText.length > 400 && (
            <Text style={[
              styles.charCount, 
              { 
                color: commentText.length >= 500 ? '#E91E63' : theme.colors.textSecondary 
              }
            ]}>
              {commentText.length}/500
            </Text>
          )}
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
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  backButton: {
    padding: 4,
  },
  shareButton: {
    padding: 4,
  },
  commentHeaderSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  sortText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    fontWeight: '500',
  },
  commentContainer: {
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  commentContent: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  replyAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
  },
  commentAvatarText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  replyAvatarText: {
    fontSize: 12,
  },
  commentBody: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentUsername: {
    fontSize: 14,
    fontWeight: '700',
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  commentGif: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 8,
    backgroundColor: '#f0f0f0',
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 4,
  },
  commentTime: {
    fontSize: 13,
    fontWeight: '500',
  },
  commentActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentActionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  commentReplyText: {
    fontSize: 13,
    fontWeight: '700',
  },
  toggleRepliesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  toggleRepliesText: {
    fontSize: 13,
    fontWeight: '700',
  },
  inputWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 0.5,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  replyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 8,
  },
  replyingToText: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  replyingToName: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  cancelReplyButton: {
    padding: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 48,
  },
  inputAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginBottom: 2,
  },
  inputAvatarText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    flex: 1,
    fontSize: 15,
    maxHeight: 100,
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 4,
    lineHeight: 20,
  },
  inputActions: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 2,
  },
  iconButton: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gifPreviewContainer: {
    marginBottom: 10,
    position: 'relative',
    alignSelf: 'flex-start',
  },
  gifPreviewImage: {
    width: 150,
    height: 100,
    borderRadius: 12,
    backgroundColor: '#eee',
  },
  removeGifButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  charCount: {
    fontSize: 11,
    textAlign: 'right',
    marginTop: 4,
    fontWeight: '500',
  },
});

export default PostDetailScreen;