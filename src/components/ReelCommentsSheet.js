// components/ReelCommentsSheet.js — Instagram-style comment bottom sheet for Reels
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    FlatList,
    TextInput,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Animated,
    Dimensions,
    Keyboard,
    PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import api from '../services/api';
import GifPickerModal from './GifPickerModal';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.65;

// ── Helpers ──
const getTimeAgo = (createdAt) => {
    if (!createdAt) return '';
    const diff = Date.now() - new Date(createdAt).getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    const weeks = Math.floor(days / 7);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    if (hrs < 24) return `${hrs}h`;
    if (days < 7) return `${days}d`;
    if (weeks < 52) return `${weeks}w`;
    return new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const getAuthor = (author) => {
    if (!author) return { avatar: null, name: 'User', username: 'user' };
    const BROKEN = '/defaults/avatar.png';
    let avatar = author.profile?.avatar || author.avatar || null;
    if (avatar && avatar.includes(BROKEN)) avatar = null;
    return {
        avatar,
        name: author.profile?.displayName || author.name || author.username || 'User',
        username: author.username || 'user',
        isVerified: author.isVerified || false,
    };
};

const formatCount = (n) => {
    if (!n) return '';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
};

// ── Single Comment Row ──
const CommentRow = React.memo(({ comment, level = 0, onReply, onLike, currentUserId, onToggleReplies, expandedSet }) => {
    const { avatar, name, username, isVerified } = getAuthor(comment.author);
    const isNested = level > 0;
    const replies = comment.replies || [];
    const hasReplies = replies.length > 0;
    const isExpanded = expandedSet?.has(comment._id);
    const isLikedByMe = Array.isArray(comment.likes) && comment.likes.includes(currentUserId);
    const likesCount = comment.likes?.length || 0;
    const indent = Math.min(level, 3) * 24;

    return (
        <View>
            <View style={[
                styles.commentRow,
                isNested && { marginLeft: indent, borderLeftWidth: 2, borderLeftColor: 'rgba(255,255,255,0.08)' }
            ]}>
                {/* Avatar */}
                {avatar ? (
                    <Image source={{ uri: avatar }} style={[styles.cAvatar, isNested && styles.cAvatarSmall]} />
                ) : (
                    <View style={[styles.cAvatar, isNested && styles.cAvatarSmall, styles.cAvatarFallback]}>
                        <Text style={styles.cAvatarLetter}>{name.charAt(0).toUpperCase()}</Text>
                    </View>
                )}

                {/* Body */}
                <View style={styles.cBody}>
                    <View style={styles.cTop}>
                        <Text style={styles.cUsername}>
                            {username}
                            {isVerified && ' ✓'}
                            <Text style={styles.cTime}>  {getTimeAgo(comment.createdAt)}</Text>
                        </Text>
                    </View>

                    {/* Text or GIF */}
                    {comment.type === 'gif' || (comment.content && comment.content.includes('.gif')) ? (
                        <ExpoImage source={{ uri: comment.content }} style={styles.cGif} contentFit="cover" />
                    ) : (
                        <Text style={styles.cText}>{comment.content}</Text>
                    )}

                    {/* Actions */}
                    <View style={styles.cActions}>
                        <TouchableOpacity onPress={() => onReply(comment)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Text style={styles.cReply}>Reply</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Toggle replies */}
                    {hasReplies && (
                        <TouchableOpacity
                            style={styles.cToggleReplies}
                            onPress={() => onToggleReplies(comment._id)}
                        >
                            <View style={styles.cToggleLine} />
                            <Text style={styles.cToggleText}>
                                {isExpanded ? 'Hide' : 'View'} {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Like button (right side, Instagram-style) */}
                <TouchableOpacity style={styles.cLikeBtn} onPress={() => onLike(comment._id, comment.reel)}>
                    <Ionicons
                        name={isLikedByMe ? 'heart' : 'heart-outline'}
                        size={14}
                        color={isLikedByMe ? '#FF3B5C' : 'rgba(255,255,255,0.5)'}
                    />
                    {likesCount > 0 && <Text style={styles.cLikeCount}>{formatCount(likesCount)}</Text>}
                </TouchableOpacity>
            </View>

            {/* Nested replies */}
            {hasReplies && isExpanded && replies.map(reply => (
                <CommentRow
                    key={reply._id}
                    comment={reply}
                    level={level + 1}
                    onReply={onReply}
                    onLike={onLike}
                    currentUserId={currentUserId}
                    onToggleReplies={onToggleReplies}
                    expandedSet={expandedSet}
                />
            ))}
        </View>
    );
});


// ── Main Sheet Component ──
const ReelCommentsSheet = ({ visible, reel, currentUserId, onClose, onCommentCountChange }) => {
    const insets = useSafeAreaInsets();
    const inputRef = useRef(null);

    // State
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [commentText, setCommentText] = useState('');
    const [replyingTo, setReplyingTo] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [showGifPicker, setShowGifPicker] = useState(false);
    const [selectedGif, setSelectedGif] = useState(null);
    const [expandedSet, setExpandedSet] = useState(new Set());

    // Drag to dismiss
    const translateY = useRef(new Animated.Value(0)).current;
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (_, g) => g.dy > 10 && Math.abs(g.dy) > Math.abs(g.dx),
            onPanResponderMove: (_, g) => {
                if (g.dy > 0) translateY.setValue(g.dy);
            },
            onPanResponderRelease: (_, g) => {
                if (g.dy > 120) {
                    Animated.timing(translateY, { toValue: SHEET_HEIGHT, duration: 200, useNativeDriver: true }).start(onClose);
                } else {
                    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
                }
            },
        })
    ).current;

    // Reset on open
    useEffect(() => {
        if (visible && reel) {
            translateY.setValue(0);
            fetchComments();
        } else {
            setComments([]);
            setReplyingTo(null);
            setCommentText('');
            setSelectedGif(null);
        }
    }, [visible, reel?._id]);

    // ── API ──
    const fetchComments = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/reels/${reel._id}/comments`);
            const fetched = res.data.data || [];
            setComments(fetched);
            // Auto-expand top-level replies
            const expanded = new Set();
            fetched.forEach(c => { if (c.replies?.length > 0) expanded.add(c._id); });
            setExpandedSet(expanded);
        } catch (e) {
            console.error('Fetch comments error:', e);
            setComments([]);
        } finally {
            setLoading(false);
        }
    };

    const handlePost = async () => {
        if ((!commentText.trim() && !selectedGif) || submitting) return;
        setSubmitting(true);
        try {
            const payload = {
                content: selectedGif ? selectedGif.url : commentText.trim(),
                type: selectedGif ? 'gif' : 'text',
                parentCommentId: replyingTo?._id || null,
            };
            await api.post(`/reels/${reel._id}/comments`, payload);

            // Refetch to get threaded structure
            await fetchComments();
            setCommentText('');
            setSelectedGif(null);
            setReplyingTo(null);
            Keyboard.dismiss();
            onCommentCountChange?.((reel.commentsCount || 0) + 1);
        } catch (e) {
            console.error('Post comment error:', e);
        } finally {
            setSubmitting(false);
        }
    };

    const handleLike = useCallback(async (commentId, reelId) => {
        try {
            const res = await api.post(`/reels/${reel._id}/comments/${commentId}/like`);
            if (res.data.success) {
                // Update local state optimistically
                const updateLikes = (arr) => arr.map(c => {
                    if (c._id === commentId) {
                        const liked = res.data.data.isLiked;
                        let likes = [...(c.likes || [])];
                        if (liked && !likes.includes(currentUserId)) likes.push(currentUserId);
                        if (!liked) likes = likes.filter(id => id !== currentUserId);
                        return { ...c, likes };
                    }
                    if (c.replies?.length) return { ...c, replies: updateLikes(c.replies) };
                    return c;
                });
                setComments(prev => updateLikes(prev));
            }
        } catch (e) { console.error(e); }
    }, [reel?._id, currentUserId]);

    const handleReply = useCallback((comment) => {
        setReplyingTo(comment);
        inputRef.current?.focus();
    }, []);

    const toggleReplies = useCallback((commentId) => {
        setExpandedSet(prev => {
            const next = new Set(prev);
            if (next.has(commentId)) next.delete(commentId);
            else next.add(commentId);
            return next;
        });
    }, []);

    const handleGifSelect = (gif) => {
        setSelectedGif(gif);
        setShowGifPicker(false);
    };

    const renderComment = useCallback(({ item }) => (
        <CommentRow
            comment={item}
            level={0}
            onReply={handleReply}
            onLike={handleLike}
            currentUserId={currentUserId}
            onToggleReplies={toggleReplies}
            expandedSet={expandedSet}
        />
    ), [handleReply, handleLike, currentUserId, toggleReplies, expandedSet]);

    if (!visible) return null;

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.modalWrap}
            >
                {/* Backdrop */}
                <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

                {/* Sheet */}
                <Animated.View
                    style={[styles.sheet, { height: SHEET_HEIGHT, transform: [{ translateY }] }]}
                    {...panResponder.panHandlers}
                >
                    {/* Drag Handle */}
                    <View style={styles.handleWrap}>
                        <View style={styles.handle} />
                    </View>

                    {/* Header */}
                    <View style={styles.sheetHeader}>
                        <Text style={styles.sheetTitle}>Comments</Text>
                        <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                            <Ionicons name="close" size={24} color="rgba(255,255,255,0.7)" />
                        </TouchableOpacity>
                    </View>

                    {/* Comment List */}
                    {loading ? (
                        <ActivityIndicator color="#FF3B5C" style={{ marginTop: 40 }} />
                    ) : (
                        <FlatList
                            data={comments}
                            keyExtractor={(item) => item._id}
                            renderItem={renderComment}
                            contentContainerStyle={{ paddingBottom: 20 }}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            ListEmptyComponent={
                                <View style={styles.emptyWrap}>
                                    <Ionicons name="chatbubble-outline" size={48} color="rgba(255,255,255,0.2)" />
                                    <Text style={styles.emptyText}>No comments yet</Text>
                                    <Text style={styles.emptySubtext}>Be the first to comment</Text>
                                </View>
                            }
                        />
                    )}

                    {/* Reply Indicator */}
                    {replyingTo && (
                        <View style={styles.replyBar}>
                            <Text style={styles.replyBarText}>
                                Replying to <Text style={styles.replyBarUsername}>@{getAuthor(replyingTo.author).username}</Text>
                            </Text>
                            <TouchableOpacity onPress={() => { setReplyingTo(null); setCommentText(''); }}>
                                <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.5)" />
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* GIF Preview */}
                    {selectedGif && (
                        <View style={styles.gifPreview}>
                            <Image source={{ uri: selectedGif.preview || selectedGif.url }} style={styles.gifPreviewImg} />
                            <TouchableOpacity style={styles.gifPreviewClose} onPress={() => setSelectedGif(null)}>
                                <Ionicons name="close-circle" size={22} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Input Bar */}
                    <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
                        <TouchableOpacity onPress={() => setShowGifPicker(true)} style={styles.gifBtn}>
                            <Ionicons
                                name={selectedGif ? 'image' : 'happy-outline'}
                                size={24}
                                color={selectedGif ? '#FF3B5C' : 'rgba(255,255,255,0.5)'}
                            />
                        </TouchableOpacity>

                        <TextInput
                            ref={inputRef}
                            style={styles.input}
                            placeholder={replyingTo ? `Reply to @${getAuthor(replyingTo.author).username}...` : 'Add a comment...'}
                            placeholderTextColor="rgba(255,255,255,0.35)"
                            value={commentText}
                            onChangeText={setCommentText}
                            multiline
                            maxLength={500}
                        />

                        {(commentText.trim().length > 0 || selectedGif) && (
                            <TouchableOpacity onPress={handlePost} disabled={submitting} style={styles.sendBtn}>
                                {submitting ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Ionicons name="arrow-up" size={18} color="#fff" />
                                )}
                            </TouchableOpacity>
                        )}
                    </View>
                </Animated.View>
            </KeyboardAvoidingView>

            <GifPickerModal
                visible={showGifPicker}
                onClose={() => setShowGifPicker(false)}
                onSelectGif={handleGifSelect}
            />
        </Modal>
    );
};


// ── Styles ──
const styles = StyleSheet.create({
    modalWrap: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },

    sheet: {
        backgroundColor: '#1A1A1A',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        overflow: 'hidden',
    },
    handleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' },

    sheetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 0.5,
        borderBottomColor: 'rgba(255,255,255,0.08)',
    },
    sheetTitle: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },

    // Comment row
    commentRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    cAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 12 },
    cAvatarSmall: { width: 28, height: 28, borderRadius: 14, marginRight: 10 },
    cAvatarFallback: { backgroundColor: '#FF3B5C', justifyContent: 'center', alignItems: 'center' },
    cAvatarLetter: { color: '#fff', fontWeight: '700', fontSize: 14 },
    cBody: { flex: 1 },
    cTop: { marginBottom: 4 },
    cUsername: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' },
    cTime: { fontWeight: '400', color: 'rgba(255,255,255,0.35)' },
    cText: { color: '#fff', fontSize: 14, lineHeight: 20 },
    cGif: { width: 120, height: 120, borderRadius: 10, marginTop: 4, backgroundColor: '#333' },

    cActions: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 16 },
    cReply: { color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: '700' },

    cLikeBtn: { alignItems: 'center', paddingTop: 10, paddingLeft: 8, width: 32 },
    cLikeCount: { color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 },

    cToggleReplies: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
    cToggleLine: { width: 20, height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginRight: 8 },
    cToggleText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.45)' },

    // Empty state
    emptyWrap: { alignItems: 'center', paddingVertical: 60 },
    emptyText: { color: 'rgba(255,255,255,0.4)', fontSize: 16, fontWeight: '600', marginTop: 16 },
    emptySubtext: { color: 'rgba(255,255,255,0.25)', fontSize: 14, marginTop: 4 },

    // Reply bar
    replyBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderTopWidth: 0.5,
        borderTopColor: 'rgba(255,255,255,0.08)',
    },
    replyBarText: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
    replyBarUsername: { color: '#fff', fontWeight: '600' },

    // GIF preview
    gifPreview: { paddingHorizontal: 16, paddingVertical: 6, flexDirection: 'row', alignItems: 'flex-start' },
    gifPreviewImg: { width: 100, height: 70, borderRadius: 10, backgroundColor: '#333' },
    gifPreviewClose: { marginLeft: -12, marginTop: -6 },

    // Input bar
    inputBar: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 12,
        paddingTop: 10,
        borderTopWidth: 0.5,
        borderTopColor: 'rgba(255,255,255,0.08)',
        backgroundColor: '#1A1A1A',
    },
    gifBtn: { padding: 8, marginBottom: 4 },
    input: {
        flex: 1,
        color: '#fff',
        fontSize: 15,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        marginHorizontal: 8,
        maxHeight: 100,
        lineHeight: 20,
    },
    sendBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#FF3B5C',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
});

export default ReelCommentsSheet;
