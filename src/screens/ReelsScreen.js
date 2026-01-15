import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Animated,
  StatusBar,
  TouchableWithoutFeedback,
  Share,
} from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useIsFocused } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import api from "../services/api";
import GifPickerModal from "../components/GifPickerModal";

// ✅ USE 'screen' instead of 'window' for full device dimensions including system UI
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("screen");

// --- UTILITY COMPONENTS ---

/**
 * Renders a side action button (Like, Comment, Share)
 * Ensures consistent spacing and hit-slop for easier tapping.
 */
const ActionButton = ({ icon, label, color = "#fff", onPress, scale }) => (
  <TouchableOpacity onPress={onPress} style={styles.actionButton} activeOpacity={0.7}>
    <Animated.View style={scale ? { transform: [{ scale }] } : {}}>
      <Ionicons name={icon} size={32} color={color} style={styles.shadow} />
    </Animated.View>
    {label && <Text style={styles.actionText}>{label}</Text>}
  </TouchableOpacity>
);

// --- SINGLE REEL ITEM ---

const ReelItem = React.memo(
  ({
    item,
    isActive,
    shouldPlay,
    bottomTabHeight,
    bottomInset,
    onLike,
    onComment,
    onShare,
    onFollow,
  }) => {
    // 1. Layout Calculations
    // ✅ FIXED: Calculate reel height accounting for system navigation bar on Android
    const reelHeight = SCREEN_HEIGHT - bottomTabHeight - bottomInset;
    const insets = useSafeAreaInsets();

    // 2. Animation Values
    const heartScale = useRef(new Animated.Value(1)).current;
    const doubleTapOpacity = useRef(new Animated.Value(0)).current;
    const playIconOpacity = useRef(new Animated.Value(0)).current;

    // 3. Local State
    const [isLiked, setIsLiked] = useState(
      item.isLiked || (item.likes && item.likes.includes(item.currentUserId))
    );
    const [likesCount, setLikesCount] = useState(item.likes?.length || 0);
    const [isFollowing, setIsFollowing] = useState(item.user?.isFollowing || false);
    const [isMuted, setIsMuted] = useState(false);
    const [userPaused, setUserPaused] = useState(false);

    const lastTap = useRef(null);
    const author = item.author || item.user || {};

    // 4. Video Player Setup (New Expo Video API)
    const player = useVideoPlayer(item.videoUrl, (playerInstance) => {
      playerInstance.loop = true;
      playerInstance.muted = isMuted;
    });

    // 5. Playback Logic
    useEffect(() => {
      if (isActive && shouldPlay && !userPaused) {
        player.play();
      } else {
        player.pause();
      }
    }, [isActive, shouldPlay, userPaused, player]);

    // Sync Mute State
    useEffect(() => {
      player.muted = isMuted;
    }, [isMuted, player]);

    // 6. Interaction Handlers
    const animateHeart = () => {
      Animated.sequence([
        Animated.spring(heartScale, { toValue: 1.3, useNativeDriver: true, speed: 50 }),
        Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, speed: 50 }),
      ]).start();
    };

    const animateDoubleTap = () => {
      Animated.sequence([
        Animated.timing(doubleTapOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(doubleTapOpacity, { toValue: 0, duration: 800, delay: 300, useNativeDriver: true }),
      ]).start();
    };

    const togglePlayPauseAnimation = () => {
      playIconOpacity.setValue(1);
      Animated.timing(playIconOpacity, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }).start();
    };

    const handleSingleTap = () => {
      const now = Date.now();
      const DOUBLE_PRESS_DELAY = 300;

      if (lastTap.current && now - lastTap.current < DOUBLE_PRESS_DELAY) {
        // Double Tap - Like
        if (!isLiked) {
          setIsLiked(true);
          setLikesCount((prev) => prev + 1);
          onLike(item._id);
        }
        animateHeart();
        animateDoubleTap();
      } else {
        // Single Tap - Play/Pause
        if (player.playing) {
          player.pause();
          setUserPaused(true);
          togglePlayPauseAnimation();
        } else {
          player.play();
          setUserPaused(false);
          togglePlayPauseAnimation();
        }
      }
      lastTap.current = now;
    };

    const handleLikePress = () => {
      const newState = !isLiked;
      setIsLiked(newState);
      setLikesCount((prev) => (newState ? prev + 1 : prev - 1));
      animateHeart();
      onLike(item._id);
    };

    const formatNumber = (num) => {
      if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
      if (num >= 1000) return (num / 1000).toFixed(1) + "K";
      return num;
    };

    return (
      <View style={[styles.reelContainer, { height: reelHeight }]}>
        <TouchableWithoutFeedback onPress={handleSingleTap}>
          <View style={styles.videoWrapper}>
            {/* VIDEO LAYER */}
            <VideoView
              style={StyleSheet.absoluteFill}
              player={player}
              contentFit="cover"
              nativeControls={false}
              allowsPictureInPicture={false}
            />

            {/* CENTER ANIMATIONS LAYER */}
            <View style={styles.centerOverlay}>
              {/* Double Tap Heart */}
              <Animated.View style={{ opacity: doubleTapOpacity, transform: [{ scale: 1.5 }] }}>
                <Ionicons name="heart" size={100} color="rgba(255,255,255,0.9)" />
              </Animated.View>

              {/* Play/Pause Indicator */}
              <Animated.View style={[styles.playIconContainer, { opacity: playIconOpacity }]}>
                <Ionicons name={userPaused ? "play" : "pause"} size={60} color="rgba(255,255,255,0.8)" />
              </Animated.View>
            </View>

            {/* GRADIENTS - For Text Readability */}
            <LinearGradient
              colors={["rgba(0,0,0,0.3)", "transparent"]}
              style={[styles.topGradient, { height: insets.top + 60 }]}
            />
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.1)", "rgba(0,0,0,0.8)"]}
              style={styles.bottomGradient}
            />

            {/* UI INTERFACE LAYER */}
            {/* ✅ CRITICAL FIX: Add proper padding for Android navigation bar */}
            <View 
              style={[
                styles.uiContainer, 
                { 
                  paddingBottom: Platform.OS === 'android' ? Math.max(bottomInset, 10) : 10,
                  paddingHorizontal: 16 
                }
              ]}
            >
              {/* Bottom Left: User Info & Caption */}
              <View style={styles.infoContainer}>
                <View style={styles.userRow}>
                  <Image 
                    source={{ uri: author.profile?.avatar || author.avatar }} 
                    style={styles.avatar} 
                    contentFit="cover"
                  />
                  <Text style={styles.username}>@{author.username}</Text>
                  {!isFollowing && (
                    <TouchableOpacity 
                      onPress={() => { 
                        setIsFollowing(true); 
                        onFollow(author._id); 
                      }} 
                      style={styles.followBtn}
                    >
                      <Text style={styles.followText}>Follow</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={styles.caption} numberOfLines={2}>
                  {item.caption} <Text style={styles.hashtag}>#viral #trending</Text>
                </Text>

                {item.music && (
                  <View style={styles.musicRow}>
                    <Ionicons name="musical-notes" size={14} color="#fff" />
                    <View style={styles.tickerContainer}>
                      <Text style={styles.musicText}>{item.music} • Original Audio</Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Bottom Right: Actions */}
              <View style={styles.actionsContainer}>
                <ActionButton 
                  icon={isLiked ? "heart" : "heart-outline"} 
                  color={isLiked ? "#FF3B5C" : "#fff"} 
                  label={formatNumber(likesCount)} 
                  onPress={handleLikePress}
                  scale={heartScale}
                />

                <ActionButton 
                  icon="chatbubble-ellipses-outline" 
                  label={formatNumber(item.commentsCount || 0)} 
                  onPress={() => onComment(item)} 
                />

                <ActionButton 
                  icon="paper-plane-outline" 
                  label="Share" 
                  onPress={() => onShare(item)} 
                />

                <ActionButton 
                  icon={isMuted ? "volume-mute-outline" : "volume-high-outline"} 
                  onPress={() => setIsMuted(!isMuted)} 
                />

                {/* Rotating Album Art */}
                <View style={styles.vinylContainer}>
                  <Image source={{ uri: author.profile?.avatar }} style={styles.vinyl} />
                </View>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </View>
    );
  },
  (prev, next) => {
    return (
      prev.isActive === next.isActive &&
      prev.shouldPlay === next.shouldPlay &&
      prev.item._id === next.item._id &&
      prev.item.commentsCount === next.item.commentsCount
    );
  }
);

// --- MAIN SCREEN ---

const ReelsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const bottomTabHeight = useBottomTabBarHeight();
  const isFocused = useIsFocused();

  // State
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Comment Modal State
  const [showComments, setShowComments] = useState(false);
  const [activeReel, setActiveReel] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);

  // ✅ Calculate proper height accounting for system UI
  const reelHeight = SCREEN_HEIGHT - bottomTabHeight - insets.bottom;

  // --- API LOGIC ---
  const fetchReels = async () => {
    try {
      const res = await api.get("/reels/feed");
      const data = res.data?.data || (Array.isArray(res.data) ? res.data : []);
      setReels(data);
    } catch (e) { 
      console.error("Error fetching reels:", e); 
    } finally { 
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { 
    fetchReels(); 
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchReels();
  }, []);

  // --- ACTIONS ---
  const handleLike = useCallback(async (id) => {
    try {
      await api.post(`/reels/${id}/like`);
    } catch (e) {
      console.error("Error liking reel:", e);
    }
  }, []);

  const handleFollow = useCallback(async (id) => {
    try {
      await api.post(`/users/${id}/follow`);
    } catch (e) {
      console.error("Error following user:", e);
    }
  }, []);

  const handleShare = useCallback(async (item) => {
    try {
      await Share.share({ 
        message: `Check out this reel! ${item.videoUrl}` 
      });
    } catch (e) {
      console.error("Error sharing:", e);
    }
  }, []);

  const openComments = useCallback(async (reel) => {
    setActiveReel(reel);
    setShowComments(true);
    setLoadingComments(true);
    try {
      const res = await api.get(`/reels/${reel._id}/comments`);
      setComments(res.data.data || []);
    } catch(e) { 
      console.error("Error fetching comments:", e);
      setComments([]); 
    } finally { 
      setLoadingComments(false); 
    }
  }, []);

  const postComment = async () => {
    if (!commentText.trim()) return;
    try {
      const res = await api.post(`/reels/${activeReel._id}/comments`, { content: commentText });
      setComments([res.data.data, ...comments]);
      setCommentText("");
      // Update local count
      setReels(prev => prev.map(r => 
        r._id === activeReel._id 
          ? {...r, commentsCount: (r.commentsCount || 0) + 1} 
          : r
      ));
    } catch(e) { 
      console.error("Error posting comment:", e); 
    }
  };

  const handleGifSelect = async (gif) => {
    setShowGifPicker(false);
    try {
      const res = await api.post(`/reels/${activeReel._id}/comments`, { 
        content: gif.url, 
        type: 'gif' 
      });
      setComments([res.data.data, ...comments]);
      setReels(prev => prev.map(r => 
        r._id === activeReel._id 
          ? {...r, commentsCount: (r.commentsCount || 0) + 1} 
          : r
      ));
    } catch(e) { 
      console.error("Error posting gif:", e); 
    }
  };

  // --- LIST CONFIGURATION ---
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems?.length > 0) {
      setActiveIndex(viewableItems[0].index || 0);
    }
  }).current;

  const viewabilityConfig = useRef({ 
    itemVisiblePercentThreshold: 80 
  }).current;

  const renderItem = useCallback(({ item, index }) => (
    <ReelItem
      item={item}
      isActive={index === activeIndex}
      shouldPlay={isFocused}
      bottomTabHeight={bottomTabHeight}
      bottomInset={insets.bottom}
      onLike={handleLike}
      onComment={openComments}
      onShare={handleShare}
      onFollow={handleFollow}
    />
  ), [activeIndex, isFocused, bottomTabHeight, insets.bottom, handleLike, openComments, handleShare, handleFollow]);

  const keyExtractor = useCallback((item) => item._id, []);

  if (loading && reels.length === 0) {
    return (
      <View style={styles.loaderCenter}>
        <ActivityIndicator size="large" color="#FF3B5C" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ✅ Make status bar translucent for edge-to-edge */}
      <StatusBar 
        barStyle="light-content" 
        translucent={true}
        backgroundColor="transparent" 
      />

      {/* HEADER OVERLAY */}
      <View style={[styles.header, { top: insets.top }]}>
        <Text style={styles.headerTitle}>Reels</Text>
        <TouchableOpacity style={styles.cameraIcon}>
          <Ionicons name="camera-outline" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={reels}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        pagingEnabled
        decelerationRate="fast"
        disableIntervalMomentum
        showsVerticalScrollIndicator={false}
        getItemLayout={(data, index) => ({
          length: reelHeight,
          offset: reelHeight * index,
          index,
        })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        windowSize={3}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />

      {/* COMMENTS MODAL */}
      <Modal 
        visible={showComments} 
        animationType="slide" 
        transparent 
        onRequestClose={() => setShowComments(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"} 
          style={styles.modalKeyView}
        >
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            onPress={() => setShowComments(false)} 
            activeOpacity={1} 
          />
          <View style={[styles.modalContent, { height: SCREEN_HEIGHT * 0.7 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Comments</Text>
              <TouchableOpacity onPress={() => setShowComments(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            {loadingComments ? (
              <ActivityIndicator style={{marginTop: 20}} color="#FF3B5C" />
            ) : (
              <FlatList
                data={comments}
                keyExtractor={i => i._id}
                renderItem={({item}) => (
                  <View style={styles.commentRow}>
                    <Image 
                      source={{uri: item.author?.profile?.avatar}} 
                      style={styles.commentAvatar} 
                    />
                    <View style={{flex: 1}}>
                      <Text style={styles.commentUser}>
                        @{item.author?.username} 
                        <Text style={styles.commentTime}> • 2h</Text>
                      </Text>
                      {item.type === 'gif' || item.content.includes('.gif') ? (
                        <Image 
                          source={{uri: item.content}} 
                          style={{width: 100, height: 100, borderRadius: 8, marginTop: 4}} 
                        />
                      ) : (
                        <Text style={styles.commentBody}>{item.content}</Text>
                      )}
                    </View>
                  </View>
                )}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No comments yet. Say something!</Text>
                }
              />
            )}

            <View style={[styles.inputContainer, { paddingBottom: insets.bottom + 10 }]}>
              <TouchableOpacity onPress={() => setShowGifPicker(true)}>
                <Ionicons name="images-outline" size={28} color="#555" />
              </TouchableOpacity>
              <TextInput 
                placeholder="Add a comment..." 
                style={styles.input} 
                value={commentText} 
                onChangeText={setCommentText} 
                placeholderTextColor="#999"
              />
              <TouchableOpacity onPress={postComment} disabled={!commentText.trim()}>
                <Text style={{
                  color: commentText.trim() ? '#FF3B5C' : '#ccc', 
                  fontWeight:'bold'
                }}>
                  Post
                </Text>
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
  // --- LAYOUT & CONTAINERS ---
  container: { 
    flex: 1, 
    backgroundColor: "black" 
  },
  loaderCenter: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center'
  },
  reelContainer: {
    width: SCREEN_WIDTH,
    overflow: 'hidden',
    backgroundColor: 'black'
  },
  videoWrapper: {
    flex: 1,
    justifyContent: 'center'
  },

  // --- HEADER ---
  header: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 50,
  },
  headerTitle: {
    color: 'white',
    fontWeight: '800',
    fontSize: 22,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1}
  },
  cameraIcon: {
    padding: 8,
  },

  // --- OVERLAYS ---
  centerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    pointerEvents: 'none',
  },
  playIconContainer: {
    position: 'absolute',
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    width: '100%',
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: 350,
  },

  // --- UI INTERFACE ---
  uiContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    zIndex: 20,
  },
  infoContainer: {
    flex: 1,
    paddingRight: 10,
    marginBottom: 10,
  },
  actionsContainer: {
    width: 50,
    alignItems: 'center',
    marginBottom: 20,
  },

  // --- USER INFO ---
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'white',
    marginRight: 10,
  },
  username: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 3,
  },
  followBtn: {
    marginLeft: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  followText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600'
  },
  caption: {
    color: 'white',
    fontSize: 15,
    marginBottom: 10,
    lineHeight: 20,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 2,
  },
  hashtag: {
    fontWeight: '700',
  },
  musicRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tickerContainer: {
    overflow: 'hidden',
  },
  musicText: {
    color: 'white',
    marginLeft: 8,
    fontSize: 14,
  },

  // --- ACTION BUTTONS ---
  actionButton: {
    alignItems: 'center',
    marginBottom: 22,
  },
  shadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  actionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 3,
  },
  vinylContainer: {
    marginTop: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#333'
  },
  vinyl: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },

  // --- MODAL ---
  modalKeyView: { 
    flex: 1, 
    justifyContent: 'flex-end' 
  },
  modalBackdrop: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.6)' 
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#eee'
  },
  modalTitle: { 
    fontWeight: 'bold', 
    fontSize: 16 
  },
  commentRow: {
    flexDirection: 'row',
    padding: 16,
  },
  commentAvatar: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    marginRight: 12, 
    backgroundColor: '#eee' 
  },
  commentUser: { 
    fontWeight: 'bold', 
    fontSize: 13, 
    color: '#333', 
    marginBottom: 2 
  },
  commentTime: { 
    fontWeight: '400', 
    color: '#999' 
  },
  commentBody: { 
    fontSize: 14, 
    color: '#111', 
    lineHeight: 18 
  },
  emptyText: { 
    textAlign: 'center', 
    marginTop: 40, 
    color: '#999' 
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderColor: '#eee',
    backgroundColor: 'white',
  },
  input: {
    flex: 1,
    backgroundColor: '#f1f1f1',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 10,
    fontSize: 15,
  },
});

export default ReelsScreen;
