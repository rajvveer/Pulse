// components/CommentItem.js (Nested replies with collapse/expand)
import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';
import { getTheme } from '../styles/theme';

const CommentItem = ({ comment, currentUserId, onReply, replies = [], level = 0 }) => {
  const { isDark } = useTheme();
  const theme = getTheme(isDark);
  const [isLiked, setIsLiked] = useState(comment.isLiked || false);
  const [likeCount, setLikeCount] = useState(comment.likes || 0);
  const [showReplies, setShowReplies] = useState(true);

  const isNested = level > 0;
  const hasReplies = replies && replies.length > 0;

  const handleLike = async () => {
    setIsLiked(!isLiked);
    setLikeCount(isLiked ? likeCount - 1 : likeCount + 1);
  };

  const timeAgo = () => {
    if (!comment.createdAt) return '';
    const now = new Date();
    const diff = now - new Date(comment.createdAt);
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return new Date(comment.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <View style={[styles.container, isNested && styles.nestedContainer]}>
      <View style={styles.commentWrapper}>
        <View style={styles.header}>
          {comment.author?.avatar ? (
            <Image source={{ uri: comment.author.avatar }} style={[styles.avatar, isNested && styles.nestedAvatar]} />
          ) : (
            <View style={[styles.avatar, isNested && styles.nestedAvatar, { backgroundColor: theme.colors.primary }]}>
              <Text style={[styles.avatarText, isNested && styles.nestedAvatarText]}>
                {comment.author?.username?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          )}

          <View style={styles.content}>
            <View style={styles.headerRow}>
              <View style={styles.userInfo}>
                <Text style={[styles.username, { color: theme.colors.text }]}>
                  {comment.author?.username || 'Anonymous'}
                </Text>
                {comment.author?.isVerified && (
                  <Ionicons name="checkmark-circle" size={12} color={theme.colors.primary} style={{ marginLeft: 4 }} />
                )}
              </View>
            </View>

            {/* Comment text */}
            {comment.content && (
              <Text style={[styles.commentText, { color: theme.colors.text }]}>
                {comment.content}
              </Text>
            )}

            {/* GIF */}
            {comment.gif && (
              <Image 
                source={{ uri: comment.gif.url }} 
                style={styles.gifImage}
                resizeMode="cover"
              />
            )}

            {/* Action buttons */}
            <View style={styles.actions}>
              <Text style={[styles.timestamp, { color: theme.colors.textSecondary }]}>
                {timeAgo()}
              </Text>

              <TouchableOpacity 
                style={styles.actionButton} 
                onPress={handleLike}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
              >
                <Ionicons 
                  name={isLiked ? "heart" : "heart-outline"} 
                  size={16} 
                  color={isLiked ? '#E91E63' : theme.colors.textSecondary} 
                />
                {likeCount > 0 && (
                  <Text style={[styles.actionText, { color: theme.colors.textSecondary }]}>
                    {likeCount}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.actionButton} 
                onPress={() => onReply?.(comment)}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
              >
                <Text style={[styles.replyText, { color: theme.colors.textSecondary }]}>
                  Reply
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Toggle replies button */}
        {hasReplies && !isNested && (
          <TouchableOpacity 
            style={styles.toggleRepliesButton}
            onPress={() => setShowReplies(!showReplies)}
          >
            <Ionicons 
              name={showReplies ? "chevron-up" : "chevron-down"} 
              size={14} 
              color={theme.colors.primary} 
            />
            <Text style={[styles.toggleRepliesText, { color: theme.colors.primary }]}>
              {showReplies ? 'Hide' : 'Show'} {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Nested replies */}
      {hasReplies && showReplies && !isNested && (
        <View style={styles.repliesContainer}>
          {replies.map((reply) => (
            <CommentItem
              key={reply._id}
              comment={reply}
              currentUserId={currentUserId}
              onReply={onReply}
              level={level + 1}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  nestedContainer: {
    borderBottomWidth: 0,
    marginLeft: 46,
  },
  commentWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  header: {
    flexDirection: 'row',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nestedAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
  },
  avatarText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  nestedAvatarText: {
    fontSize: 12,
  },
  content: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  username: {
    fontSize: 14,
    fontWeight: '700',
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  gifImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 8,
    backgroundColor: '#f0f0f0',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 4,
  },
  timestamp: {
    fontSize: 13,
    fontWeight: '500',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  replyText: {
    fontSize: 13,
    fontWeight: '700',
  },
  toggleRepliesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    marginLeft: 46,
  },
  toggleRepliesText: {
    fontSize: 13,
    fontWeight: '700',
  },
  repliesContainer: {
    marginTop: 0,
  },
});

export default CommentItem;
