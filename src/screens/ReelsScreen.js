import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Dimensions, 
  ActivityIndicator, 
  TouchableOpacity, 
  RefreshControl, 
  Modal, 
  TextInput, 
  KeyboardAvoidingView, 
  Platform, 
  FlatList, 
  Animated, 
  Share, 
  StatusBar, 
  TouchableWithoutFeedback, 
  Image 
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Video, ResizeMode, Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient'; 
import api from '../services/api';

// ✅ IMPORT THE GIF PICKER
import GifPickerModal from '../components/GifPickerModal'; 

const { width, height: screenHeight } = Dimensions.get('window');

// --- ENHANCED REEL ITEM ---
const ReelItem = React.memo(({ item, isActive, bottomTabHeight, onLike, onOpenComments, onShare, onFollow }) => {
  const videoRef = useRef(null);
  const likeScale = useRef(new Animated.Value(1)).current;
  const doubleTapScale = useRef(new Animated.Value(0)).current;
  const playIconScale = useRef(new Animated.Value(0)).current;
  
  const [isLiked, setIsLiked] = useState(item.isLiked || (item.likes && item.likes.includes(item.currentUserId)));
  const [likesCount, setLikesCount] = useState(item.likes?.length || 0);
  const [isFollowing, setIsFollowing] = useState(item.user?.isFollowing || false);
  const [isMuted, setIsMuted] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [showDoubleTapHeart, setShowDoubleTapHeart] = useState(false);
  
  const lastTap = useRef(null);

  // ✅ FIX: Match PostCard Logic Exactly
  // 1. Determine the author object (PostCard uses 'author', Reels might use 'user' or 'author')
  const author = item.author || item.user || {};

  // 2. Extract Avatar (Deep check like PostCard)
  // Check profile.avatar FIRST, then root avatar
  const avatarUrl = author.profile?.avatar || author.avatar;

  // 3. Extract Name & Username
  const displayName = author.profile?.displayName || author.name || author.username || 'Unknown';
  const username = author.username || 'unknown';

  // Debugging: If avatar is missing, check your console
  // if (!avatarUrl) console.log(`[ReelItem] Missing avatar for ${username}`, author);

  useEffect(() => {
    if (videoRef.current) {
      if (isActive && !userPaused) {
        videoRef.current.playAsync();
      } else {
        videoRef.current.pauseAsync();
      }
    }
  }, [isActive, userPaused]);

  const handleLikePress = () => {
    const newLikedState = !isLiked;
    setIsLiked(newLikedState);
    setLikesCount(prev => newLikedState ? prev + 1 : prev - 1);
    
    Animated.sequence([
      Animated.timing(likeScale, { toValue: 1.3, duration: 100, useNativeDriver: true }),
      Animated.timing(likeScale, { toValue: 1, duration: 100, useNativeDriver: true })
    ]).start();
    
    onLike(item._id);
  };

  const handlePress = () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;

    if (lastTap.current && (now - lastTap.current) < DOUBLE_PRESS_DELAY) {
      if (!isLiked) {
        setIsLiked(true);
        setLikesCount(prev => prev + 1);
        onLike(item._id);
      }
      setShowDoubleTapHeart(true);
      Animated.sequence([
        Animated.timing(doubleTapScale, { toValue: 1.5, duration: 300, useNativeDriver: true }),
        Animated.timing(doubleTapScale, { toValue: 0, duration: 300, useNativeDriver: true })
      ]).start(() => setShowDoubleTapHeart(false));
    } else {
      const newPausedState = !userPaused;
      setUserPaused(newPausedState);
      if (newPausedState) {
        Animated.sequence([
            Animated.timing(playIconScale, { toValue: 1.2, duration: 200, useNativeDriver: true }),
            Animated.timing(playIconScale, { toValue: 1, duration: 200, useNativeDriver: true }),
        ]).start();
      } else {
        Animated.timing(playIconScale, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      }
    }
    lastTap.current = now;
  };

  const handleFollow = () => {
    setIsFollowing(!isFollowing);
    onFollow(author._id);
  };

  const formatCount = (count) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <View style={[styles.reelContainer, { height: screenHeight - bottomTabHeight }]}>
      <TouchableWithoutFeedback onPress={handlePress}>
        <View style={styles.videoContainer}>
          <Video
            ref={videoRef}
            style={styles.video}
            source={{ uri: item.videoUrl }}
            resizeMode={ResizeMode.COVER}
            isLooping
            shouldPlay={isActive && !userPaused}
            isMuted={isMuted}
          />
          
          {showDoubleTapHeart && (
            <Animated.View style={[styles.centerIcon, { transform: [{ scale: doubleTapScale }] }]}>
              <Ionicons name="heart" size={100} color="rgba(255, 255, 255, 0.9)" />
            </Animated.View>
          )}

          {userPaused && (
             <Animated.View style={[styles.centerIcon, { transform: [{ scale: playIconScale }] }]}>
               <Ionicons name="play" size={80} color="rgba(255, 255, 255, 0.8)" />
             </Animated.View>
          )}
        </View>
      </TouchableWithoutFeedback>

      <LinearGradient colors={['rgba(0,0,0,0.6)', 'transparent']} style={styles.topGradient} />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.9)']} style={styles.bottomGradient} />
      
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.userInfo}>
            <View style={styles.userRow}>
              {/* ✅ Avatar - Now matches PostCard logic */}
              <View style={styles.avatar}>
                {avatarUrl ? (
                  <Image 
                    source={{ uri: avatarUrl }} 
                    style={styles.avatarImage} 
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={styles.avatarText}>
                    {(displayName?.[0] || 'U').toUpperCase()}
                  </Text>
                )}
              </View>
              
              <Text style={styles.username}>@{username}</Text>
              
              {/* Verified Badge (Optional, added since PostCard has it) */}
              {author.isVerified && (
                 <Ionicons name="checkmark-circle" size={16} color="#4DB6AC" style={{ marginLeft: 4 }} />
              )}

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

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity onPress={handleLikePress} style={styles.actionBtn}>
            <Animated.View style={{ transform: [{ scale: likeScale }] }}>
              <Ionicons name={isLiked ? "heart" : "heart-outline"} size={32} color={isLiked ? "#FF3B5C" : "#fff"} />
            </Animated.View>
            <Text style={styles.actionLabel}>{formatCount(likesCount)}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => onOpenComments(item)} style={styles.actionBtn}>
            <Ionicons name="chatbubble-outline" size={30} color="#fff" />
            <Text style={styles.actionLabel}>{formatCount(item.commentsCount || 0)}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => onShare(item)} style={styles.actionBtn}>
            <Ionicons name="paper-plane-outline" size={30} color="#fff" />
            <Text style={styles.actionLabel}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setIsMuted(!isMuted)} style={styles.actionBtn}>
            <Ionicons name={isMuted ? "volume-mute" : "volume-high"} size={28} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn}>
            <Ionicons name="ellipsis-vertical" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

// --- MAIN SCREEN ---
const ReelsScreen = ({ navigation }) => {
  const [reels, setReels] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Comment State
  const [showComments, setShowComments] = useState(false);
  const [activeReel, setActiveReel] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [postingComment, setPostingComment] = useState(false);
  
  // GIF Picker State
  const [showGifPicker, setShowGifPicker] = useState(false);

  const bottomTabHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

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

  // API Handlers
  const handleLike = async (reelId) => {
    try { await api.post(`/reels/${reelId}/like`); } catch (error) { console.error(error); }
  };
  const handleFollow = async (userId) => {
    try { await api.post(`/users/${userId}/follow`); } catch (error) { console.error(error); }
  };
  const handleShare = async (reel) => {
    try { await Share.share({ message: `Watch this reel! ${reel.videoUrl}` }); } catch (error) { console.error(error); }
  };
  
  const openComments = async (reel) => {
    setActiveReel(reel);
    setShowComments(true);
    setLoadingComments(true);
    try {
      const res = await api.get(`/reels/${reel._id}/comments`);
      setComments(res.data.data || []);
    } catch (error) { console.error(error); setComments([]); } finally { setLoadingComments(false); }
  };

  // 💬 Post Text Comment
  const postComment = async () => {
    if (!commentText.trim() || postingComment) return;
    setPostingComment(true);
    try {
      const res = await api.post(`/reels/${activeReel._id}/comments`, { content: commentText });
      setComments([res.data.data, ...comments]);
      setCommentText('');
      setReels(prev => prev.map(r => r._id === activeReel._id ? { ...r, commentsCount: (r.commentsCount || 0) + 1 } : r));
    } catch (error) { console.error(error); } finally { setPostingComment(false); }
  };

  // 🎞️ Post GIF Comment
  const handleGifSelect = async (gif) => {
    if (postingComment) return;
    setPostingComment(true);
    try {
      // Sending GIF URL as content
      const res = await api.post(`/reels/${activeReel._id}/comments`, { 
        content: gif.url, 
        type: 'gif' 
      });
      setComments([res.data.data, ...comments]);
      setReels(prev => prev.map(r => r._id === activeReel._id ? { ...r, commentsCount: (r.commentsCount || 0) + 1 } : r));
    } catch (error) {
      console.error("Failed to post GIF", error);
    } finally {
      setPostingComment(false);
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) setCurrentIndex(viewableItems[0].index);
  }).current;

  // --- RENDERING ---

  if (loading && !refreshing && reels.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF3B5C" />
      </View>
    );
  }

  return (
    <View style={styles.container}> 
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity>
          <Text style={styles.topBarText}>For You</Text>
        </TouchableOpacity>
        <View style={styles.topBarDivider} />
        <TouchableOpacity>
          <Text style={[styles.topBarText, styles.topBarTextInactive]}>Following</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.cameraBtn, { top: insets.top + 10 }]}>
          <Ionicons name="camera-outline" size={26} color="#fff" />
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" progressViewOffset={insets.top + 50} />
        }
      />

      {/* COMMENT MODAL */}
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
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowComments(false)} />
          <View style={[styles.modalContent, { height: screenHeight * 0.75 }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{comments.length} Comments</Text>
              <TouchableOpacity onPress={() => setShowComments(false)}>
                <Ionicons name="close" size={26} color="#000" />
              </TouchableOpacity>
            </View>
            
            {/* Comment List */}
            {loadingComments ? (
              <View style={styles.loadingContainer}><ActivityIndicator color="#FF3B5C" /></View>
            ) : (
              <FlatList 
                data={comments}
                keyExtractor={item => item._id}
                renderItem={({ item }) => {
                    const cAuthor = item.author || {};
                    // Match PostCard logic for comments too
                    const cAvatar = cAuthor.profile?.avatar || cAuthor.avatar;
                    const cName = cAuthor.profile?.displayName || cAuthor.username || 'user';
                    const isGif = item.content?.includes('http') && (item.content?.includes('.gif') || item.type === 'gif');
                    
                    return (
                        <View style={styles.commentItem}>
                            <View style={styles.commentAvatar}>
                                {cAvatar ? (
                                    <Image source={{ uri: cAvatar }} style={styles.avatarImage} />
                                ) : (
                                    <Text style={styles.commentAvatarText}>{cName[0].toUpperCase()}</Text>
                                )}
                            </View>
                            <View style={styles.commentContent}>
                                <View style={styles.commentHeader}>
                                    <Text style={styles.commentUser}>@{cAuthor.username || 'user'}</Text>
                                    <Text style={styles.commentTime}>2h</Text>
                                </View>
                                {isGif ? (
                                  <Image 
                                    source={{ uri: item.content }} 
                                    style={{ width: 150, height: 150, borderRadius: 8, marginTop: 4 }} 
                                    resizeMode="cover" 
                                  />
                                ) : (
                                  <Text style={styles.commentText}>{item.content}</Text>
                                )}
                            </View>
                        </View>
                    );
                }}
                contentContainerStyle={styles.commentsList}
                ListEmptyComponent={
                  <View style={styles.emptyComments}>
                    <Text style={styles.emptyCommentsText}>No comments yet</Text>
                  </View>
                }
              />
            )}

            {/* Input Area */}
            <View style={styles.commentInputContainer}>
                {/* GIF Button */}
                <TouchableOpacity 
                  onPress={() => setShowGifPicker(true)}
                  style={styles.gifButton}
                >
                   <Ionicons name="images-outline" size={24} color="#666" />
                </TouchableOpacity>

                <TextInput 
                    style={styles.commentInput} 
                    placeholder="Add a comment..." 
                    placeholderTextColor="#999"
                    value={commentText}
                    onChangeText={setCommentText}
                />
                <TouchableOpacity onPress={postComment} disabled={!commentText.trim()}>
                    <Ionicons name="send" size={24} color={commentText.trim() ? "#FF3B5C" : "#ccc"} />
                </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* GIF PICKER MODAL */}
      <GifPickerModal 
        visible={showGifPicker}
        onClose={() => setShowGifPicker(false)}
        onSelectGif={handleGifSelect}
      />

    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  centerContainer: { flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' },
  
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  topBarText: { color: '#fff', fontSize: 16, fontWeight: '700', paddingHorizontal: 12, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  topBarTextInactive: { opacity: 0.6 },
  topBarDivider: { width: 1, height: 16, backgroundColor: 'rgba(255,255,255,0.3)' },
  cameraBtn: { position: 'absolute', right: 16 },

  reelContainer: { width, backgroundColor: 'black' },
  videoContainer: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  video: { width: '100%', height: '100%', position: 'absolute' },
  
  topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 120, zIndex: 10 },
  bottomGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 300 },

  centerIcon: { position: 'absolute', zIndex: 20, opacity: 0.8 },

  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  content: { flex: 1, marginRight: 60, marginBottom: 10 },
  
  userInfo: { marginBottom: 10 },
  userRow: { flexDirection: 'row', alignItems: 'center' },
  
  avatar: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    backgroundColor: '#FF3B5C', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 10, 
    borderWidth: 1.5, 
    borderColor: '#fff',
    overflow: 'hidden' 
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  
  username: { color: '#fff', fontWeight: '700', fontSize: 15, marginRight: 10, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 3 },
  followBtn: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' },
  followText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  
  caption: { color: '#fff', fontSize: 14, lineHeight: 20, marginBottom: 10, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 3 },
  musicRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  musicText: { color: '#fff', fontSize: 13 },
  
  actions: { alignItems: 'center', gap: 20, paddingBottom: 10 },
  actionBtn: { alignItems: 'center' },
  actionLabel: { color: '#fff', marginTop: 5, fontSize: 12, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 2 },
  
  modalContainer: { flex: 1, justifyContent: 'flex-end' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 15, borderTopRightRadius: 15 },
  modalHandle: { width: 40, height: 4, backgroundColor: '#ccc', alignSelf: 'center', marginTop: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderColor: '#eee' },
  modalTitle: { fontWeight: '700', fontSize: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  commentsList: { padding: 15 },
  commentItem: { flexDirection: 'row', marginBottom: 20 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FF3B5C', justifyContent: 'center', alignItems: 'center', marginRight: 10, overflow: 'hidden' },
  commentAvatarText: { color: '#fff', fontWeight: 'bold' },
  commentContent: { flex: 1 },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  commentUser: { fontWeight: '700', fontSize: 13 },
  commentTime: { color: '#999', fontSize: 11 },
  commentText: { fontSize: 14, color: '#333' },
  emptyComments: { alignItems: 'center', marginTop: 50 },
  emptyCommentsText: { color: '#999' },
  
  commentInputContainer: { flexDirection: 'row', padding: 10, borderTopWidth: 1, borderColor: '#eee', alignItems: 'center' },
  gifButton: { marginRight: 10, padding: 4 },
  commentInput: { flex: 1, backgroundColor: '#f0f0f0', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, marginRight: 10, maxHeight: 80 },
});

export default ReelsScreen;