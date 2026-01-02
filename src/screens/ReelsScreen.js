import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, ActivityIndicator, TouchableOpacity, RefreshControl, Modal, TextInput, KeyboardAvoidingView, Platform, FlatList, Animated, Share } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Video, ResizeMode, Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import api from '../services/api';

const { width, height: screenHeight } = Dimensions.get('window');

// --- ENHANCED REEL ITEM ---
const ReelItem = React.memo(({ item, isActive, bottomTabHeight, onLike, onOpenComments, onShare, onFollow }) => {
  const videoRef = useRef(null);
  const likeScale = useRef(new Animated.Value(1)).current;
  const doubleTapScale = useRef(new Animated.Value(0)).current;
  
  const [isLiked, setIsLiked] = useState(item.isLiked || (item.likes && item.likes.includes(item.currentUserId)));
  const [likesCount, setLikesCount] = useState(item.likes?.length || 0);
  const [isFollowing, setIsFollowing] = useState(item.user?.isFollowing || false);
  const [isMuted, setIsMuted] = useState(false);
  const [showDoubleTapHeart, setShowDoubleTapHeart] = useState(false);
  
  const lastTap = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      if (isActive) {
        videoRef.current.playAsync();
      } else {
        videoRef.current.pauseAsync();
      }
    }
  }, [isActive]);

  // Animated Like Button
  const handleLikePress = () => {
    const newLikedState = !isLiked;
    setIsLiked(newLikedState);
    setLikesCount(prev => newLikedState ? prev + 1 : prev - 1);
    
    // Scale animation
    Animated.sequence([
      Animated.timing(likeScale, { toValue: 1.3, duration: 100, useNativeDriver: true }),
      Animated.timing(likeScale, { toValue: 1, duration: 100, useNativeDriver: true })
    ]).start();
    
    onLike(item._id);
  };

  // Double Tap to Like
  const handleDoubleTap = () => {
    const now = Date.now();
    if (lastTap.current && (now - lastTap.current) < 300) {
      if (!isLiked) {
        setIsLiked(true);
        setLikesCount(prev => prev + 1);
        onLike(item._id);
      }
      
      // Show heart animation
      setShowDoubleTapHeart(true);
      Animated.sequence([
        Animated.timing(doubleTapScale, { toValue: 1.5, duration: 300, useNativeDriver: true }),
        Animated.timing(doubleTapScale, { toValue: 0, duration: 300, useNativeDriver: true })
      ]).start(() => setShowDoubleTapHeart(false));
    }
    lastTap.current = now;
  };

  const handleFollow = () => {
    setIsFollowing(!isFollowing);
    onFollow(item.user._id);
  };

  const formatCount = (count) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <View style={[styles.reelContainer, { height: screenHeight - bottomTabHeight }]}>
      <TouchableOpacity 
        activeOpacity={1} 
        onPress={handleDoubleTap}
        style={styles.videoContainer}
      >
        <Video
          ref={videoRef}
          style={styles.video}
          source={{ uri: item.videoUrl }}
          resizeMode={ResizeMode.COVER}
          isLooping
          shouldPlay={isActive}
          isMuted={isMuted}
        />
        
        {/* Double Tap Heart Animation */}
        {showDoubleTapHeart && (
          <Animated.View 
            style={[
              styles.doubleTapHeart,
              { transform: [{ scale: doubleTapScale }] }
            ]}
          >
            <Ionicons name="heart" size={120} color="#fff" />
          </Animated.View>
        )}
      </TouchableOpacity>

      {/* Gradient Overlay using View with backgroundColor */}
      <View style={styles.gradientOverlay} />
      
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.userInfo}>
            <View style={styles.userRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(item.user?.username || 'U')[0].toUpperCase()}
                </Text>
              </View>
              <Text style={styles.username}>@{item.user?.username || 'user'}</Text>
              {!isFollowing && (
                <TouchableOpacity onPress={handleFollow} style={styles.followBtn}>
                  <Text style={styles.followText}>Follow</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          <Text style={styles.caption} numberOfLines={2}>{item.caption}</Text>
          {item.music && (
            <View style={styles.musicRow}>
              <Ionicons name="musical-notes" size={14} color="#fff" />
              <Text style={styles.musicText}>{item.music}</Text>
            </View>
          )}
        </View>

        <View style={styles.actions}>
          {/* LIKE BUTTON with animation */}
          <TouchableOpacity onPress={handleLikePress} style={styles.actionBtn}>
            <Animated.View style={{ transform: [{ scale: likeScale }] }}>
              <Ionicons 
                name={isLiked ? "heart" : "heart-outline"} 
                size={32} 
                color={isLiked ? "#FF3B5C" : "#fff"} 
              />
            </Animated.View>
            <Text style={styles.actionLabel}>{formatCount(likesCount)}</Text>
          </TouchableOpacity>

          {/* COMMENT BUTTON */}
          <TouchableOpacity onPress={() => onOpenComments(item)} style={styles.actionBtn}>
            <Ionicons name="chatbubble-outline" size={30} color="#fff" />
            <Text style={styles.actionLabel}>{formatCount(item.commentsCount || 0)}</Text>
          </TouchableOpacity>

          {/* SHARE BUTTON */}
          <TouchableOpacity onPress={() => onShare(item)} style={styles.actionBtn}>
            <Ionicons name="paper-plane-outline" size={30} color="#fff" />
            <Text style={styles.actionLabel}>Share</Text>
          </TouchableOpacity>

          {/* MUTE BUTTON */}
          <TouchableOpacity onPress={() => setIsMuted(!isMuted)} style={styles.actionBtn}>
            <Ionicons 
              name={isMuted ? "volume-mute" : "volume-high"} 
              size={28} 
              color="#fff" 
            />
          </TouchableOpacity>

          {/* MORE OPTIONS */}
          <TouchableOpacity style={styles.actionBtn}>
            <Ionicons name="ellipsis-vertical" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

// --- ENHANCED MAIN SCREEN ---
const ReelsScreen = ({ navigation }) => {
  const [reels, setReels] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [showComments, setShowComments] = useState(false);
  const [activeReel, setActiveReel] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [postingComment, setPostingComment] = useState(false);

  const bottomTabHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  // Set audio mode for video playback
  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });
  }, []);

  const fetchReels = async () => {
    try {
      const res = await api.get('/reels/feed');
      let data = res.data?.data || (Array.isArray(res.data) ? res.data : []);
      setReels(data);
    } catch (err) {
      console.log('Error fetching reels:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { 
    fetchReels(); 
  }, []));

  const onRefresh = () => {
    setRefreshing(true);
    fetchReels();
  };

  const handleLike = async (reelId) => {
    try {
      await api.post(`/reels/${reelId}/like`);
    } catch (error) {
      console.error("Like failed", error);
    }
  };

  const handleFollow = async (userId) => {
    try {
      await api.post(`/users/${userId}/follow`);
    } catch (error) {
      console.error("Follow failed", error);
    }
  };

  const handleShare = async (reel) => {
    try {
      await Share.share({
        message: `Check out this reel by @${reel.user?.username}: ${reel.caption}`,
        url: reel.videoUrl,
      });
    } catch (error) {
      console.error("Share failed", error);
    }
  };

  const openComments = async (reel) => {
    setActiveReel(reel);
    setShowComments(true);
    setLoadingComments(true);
    try {
      const res = await api.get(`/reels/${reel._id}/comments`);
      setComments(res.data.data || []);
    } catch (error) {
      console.error("Failed to load comments", error);
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  };

  const postComment = async () => {
    if (!commentText.trim() || postingComment) return;
    
    setPostingComment(true);
    try {
      const res = await api.post(`/reels/${activeReel._id}/comments`, { content: commentText });
      setComments([res.data.data, ...comments]);
      setCommentText('');
      
      // Update comment count in reels list
      setReels(prev => prev.map(r => 
        r._id === activeReel._id 
          ? { ...r, commentsCount: (r.commentsCount || 0) + 1 }
          : r
      ));
    } catch (error) {
      console.error("Post comment failed", error);
    } finally {
      setPostingComment(false);
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) setCurrentIndex(viewableItems[0].index);
  }).current;

  if (loading && !refreshing && reels.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF3B5C" />
      </View>
    );
  }

  if (!loading && reels.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="film-outline" size={64} color="#666" />
        <Text style={styles.emptyText}>No reels yet</Text>
        <TouchableOpacity onPress={fetchReels} style={styles.retryBtn}>
          <Text style={styles.retryText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity>
          <Text style={styles.topBarText}>For You</Text>
        </TouchableOpacity>
        <View style={styles.topBarDivider} />
        <TouchableOpacity>
          <Text style={[styles.topBarText, styles.topBarTextInactive]}>Following</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cameraBtn}>
          <Ionicons name="camera-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlashList
        data={reels}
        renderItem={({ item, index }) => (
          <ReelItem 
            item={item} 
            isActive={index === currentIndex && isFocused} 
            bottomTabHeight={bottomTabHeight}
            onLike={handleLike}
            onOpenComments={openComments}
            onShare={handleShare}
            onFollow={handleFollow}
          />
        )}
        estimatedItemSize={screenHeight}
        pagingEnabled
        keyExtractor={item => item._id}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor="#fff" 
          />
        }
      />

      {/* ENHANCED COMMENT MODAL */}
      <Modal 
        visible={showComments} 
        animationType="slide" 
        transparent={true} 
        onRequestClose={() => setShowComments(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"} 
          style={styles.modalContainer}
        >
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1}
            onPress={() => setShowComments(false)} 
          />
          <View style={[styles.modalContent, { height: screenHeight * 0.75 }]}>
            {/* Modal Handle */}
            <View style={styles.modalHandle} />
            
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {comments.length} {comments.length === 1 ? 'Comment' : 'Comments'}
              </Text>
              <TouchableOpacity onPress={() => setShowComments(false)}>
                <Ionicons name="close" size={26} color="#000" />
              </TouchableOpacity>
            </View>

            {loadingComments ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#FF3B5C" />
              </View>
            ) : comments.length === 0 ? (
              <View style={styles.emptyComments}>
                <Ionicons name="chatbubble-outline" size={48} color="#ccc" />
                <Text style={styles.emptyCommentsText}>No comments yet</Text>
                <Text style={styles.emptyCommentsSubtext}>Be the first to comment!</Text>
              </View>
            ) : (
              <FlatList 
                data={comments}
                keyExtractor={item => item._id}
                renderItem={({ item }) => (
                  <View style={styles.commentItem}>
                    <View style={styles.commentAvatar}>
                      <Text style={styles.commentAvatarText}>
                        {(item.author?.username || 'U')[0].toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.commentContent}>
                      <View style={styles.commentHeader}>
                        <Text style={styles.commentUser}>@{item.author?.username}</Text>
                        <Text style={styles.commentTime}>2h</Text>
                      </View>
                      <Text style={styles.commentText}>{item.content}</Text>
                      <View style={styles.commentActions}>
                        <TouchableOpacity style={styles.commentAction}>
                          <Text style={styles.commentActionText}>Reply</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.commentLike}>
                          <Ionicons name="heart-outline" size={14} color="#666" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )}
                contentContainerStyle={styles.commentsList}
              />
            )}

            <View style={styles.commentInputContainer}>
              <View style={styles.commentInputAvatar}>
                <Text style={styles.commentInputAvatarText}>Y</Text>
              </View>
              <TextInput 
                style={styles.commentInput} 
                placeholder="Add a comment..." 
                placeholderTextColor="#999"
                value={commentText}
                onChangeText={setCommentText}
                multiline
                maxLength={500}
              />
              <TouchableOpacity 
                onPress={postComment}
                disabled={!commentText.trim() || postingComment}
              >
                {postingComment ? (
                  <ActivityIndicator size="small" color="#FF3B5C" />
                ) : (
                  <Ionicons 
                    name="send" 
                    size={24} 
                    color={commentText.trim() ? "#FF3B5C" : "#ccc"} 
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  centerContainer: { 
    flex: 1, 
    backgroundColor: 'black', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  emptyText: { color: '#666', fontSize: 16, marginTop: 16 },
  retryBtn: { 
    marginTop: 20, 
    paddingHorizontal: 24, 
    paddingVertical: 12, 
    backgroundColor: '#FF3B5C', 
    borderRadius: 20 
  },
  retryText: { color: '#fff', fontWeight: '600' },
  
  // Top Bar
  topBar: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  topBarText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '700',
    paddingHorizontal: 16 
  },
  topBarTextInactive: { opacity: 0.6 },
  topBarDivider: { 
    width: 1, 
    height: 16, 
    backgroundColor: 'rgba(255,255,255,0.3)' 
  },
  cameraBtn: { position: 'absolute', right: 16 },
  
  // Reel Container
  reelContainer: { width, justifyContent: 'center' },
  videoContainer: { width: '100%', height: '100%' },
  video: { width: '100%', height: '100%', position: 'absolute' },
  
  doubleTapHeart: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -60,
    marginTop: -60,
    opacity: 0.9,
  },
  
  // Gradient overlay replacement - using solid color with opacity
  gradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 250,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  
  content: { flex: 1, marginRight: 16 },
  
  userInfo: { marginBottom: 8 },
  userRow: { 
    flexDirection: 'row', 
    alignItems: 'center',
    marginBottom: 8 
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF3B5C',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  username: { 
    color: '#fff', 
    fontWeight: '700', 
    fontSize: 14,
    marginRight: 12 
  },
  followBtn: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fff',
  },
  followText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  
  caption: { 
    color: '#fff', 
    fontSize: 14, 
    lineHeight: 18,
    marginBottom: 8 
  },
  
  musicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  musicText: { color: '#fff', fontSize: 12 },
  
  actions: { alignItems: 'center', gap: 24, paddingBottom: 8 },
  actionBtn: { alignItems: 'center' },
  actionLabel: { 
    color: '#fff', 
    marginTop: 4, 
    fontSize: 11, 
    fontWeight: '600' 
  },
  
  // Modal
  modalContainer: { flex: 1, justifyContent: 'flex-end' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' },
  modalContent: { 
    backgroundColor: '#fff', 
    borderTopLeftRadius: 20, 
    borderTopRightRadius: 20 
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f0f0f0' 
  },
  modalTitle: { fontWeight: '700', fontSize: 16 },
  
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  
  emptyComments: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 60,
  },
  emptyCommentsText: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: '#666', 
    marginTop: 16 
  },
  emptyCommentsSubtext: { 
    fontSize: 14, 
    color: '#999', 
    marginTop: 4 
  },
  
  commentsList: { paddingHorizontal: 16, paddingTop: 8 },
  commentItem: { 
    flexDirection: 'row', 
    marginBottom: 20,
    alignItems: 'flex-start' 
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF3B5C',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  commentAvatarText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  commentContent: { flex: 1 },
  commentHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between',
    marginBottom: 4 
  },
  commentUser: { fontWeight: '700', fontSize: 13 },
  commentTime: { fontSize: 12, color: '#999' },
  commentText: { fontSize: 14, color: '#000', lineHeight: 18 },
  commentActions: { 
    flexDirection: 'row', 
    alignItems: 'center',
    marginTop: 8,
    gap: 16 
  },
  commentAction: {},
  commentActionText: { fontSize: 12, color: '#666', fontWeight: '600' },
  commentLike: {},
  
  commentInputContainer: { 
    flexDirection: 'row', 
    padding: 16, 
    borderTopWidth: 1, 
    borderTopColor: '#f0f0f0', 
    alignItems: 'center',
    gap: 12 
  },
  commentInputAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF3B5C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentInputAvatarText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  commentInput: { 
    flex: 1, 
    backgroundColor: '#f5f5f5', 
    borderRadius: 20, 
    paddingHorizontal: 16, 
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 14 
  },
});

export default ReelsScreen;