import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  Animated,
  StatusBar,
  TouchableWithoutFeedback,
  Share,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Image as ExpoImage } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useIsFocused } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useSelector } from "react-redux";
import api from "../services/api";
import ReelCommentsSheet from "../components/ReelCommentsSheet";


const ActionButton = ({ icon, label, color = "#fff", onPress, scale }) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.actionButton}
      activeOpacity={0.7}
    >
      <Animated.View style={scale ? { transform: [{ scale }] } : {}}>
        <Ionicons name={icon} size={28} color={color} />
      </Animated.View>
      {label && <Text style={styles.actionText}>{label}</Text>}
    </TouchableOpacity>
  );
};


// --- SINGLE REEL ITEM ---

const ReelItem = React.memo(
  ({
    item,
    isActive,
    shouldPlay,
    viewHeight,
    currentUserId,
    navigation,
    onLike,
    onComment,
    onShare,
    onFollow,
    onSave,
  }) => {
    const insets = useSafeAreaInsets();

    // Animation Values
    const heartScale = useRef(new Animated.Value(1)).current;
    const doubleTapOpacity = useRef(new Animated.Value(0)).current;
    const playIconOpacity = useRef(new Animated.Value(0)).current;

    // Local State - Use API fields directly
    const [isLiked, setIsLiked] = useState(item.isLiked || false);
    const [likesCount, setLikesCount] = useState(item.likesCount || 0);
    const [isFollowing, setIsFollowing] = useState(
      item.user?.isFollowing || false,
    );
    const [isMuted, setIsMuted] = useState(false);
    const [userPaused, setUserPaused] = useState(false);
    const [isSaved, setIsSaved] = useState(item.isSaved || false);

    const lastTap = useRef(null);
    const author = item.author || item.user || {};

    // Video Player Setup
    const player = useVideoPlayer(item.videoUrl, (playerInstance) => {
      playerInstance.loop = true;
      playerInstance.muted = isMuted;
    });

    // Playback Logic
    useEffect(() => {
      if (isActive && shouldPlay && !userPaused) {
        player.play();
      } else {
        player.pause();
      }
    }, [isActive, shouldPlay, userPaused, player]);

    useEffect(() => {
      player.muted = isMuted;
    }, [isMuted, player]);

    // Sync local state when props change (e.g., after API call updates parent)
    useEffect(() => {
      setIsLiked(item.isLiked || false);
      setLikesCount(item.likesCount || 0);
    }, [item.isLiked, item.likesCount]);

    // Animations
    const animateHeart = () => {
      Animated.sequence([
        Animated.spring(heartScale, {
          toValue: 1.3,
          useNativeDriver: true,
          speed: 50,
        }),
        Animated.spring(heartScale, {
          toValue: 1,
          useNativeDriver: true,
          speed: 50,
        }),
      ]).start();
    };

    const animateDoubleTap = () => {
      Animated.sequence([
        Animated.timing(doubleTapOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(doubleTapOpacity, {
          toValue: 0,
          duration: 800,
          delay: 300,
          useNativeDriver: true,
        }),
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

    // Handlers
    const singleTapTimeout = useRef(null);

    const handleSingleTap = () => {
      const now = Date.now();
      const DOUBLE_PRESS_DELAY = 300;

      if (lastTap.current && now - lastTap.current < DOUBLE_PRESS_DELAY) {
        // Double Tap detected - cancel pending single tap and trigger like
        if (singleTapTimeout.current) {
          clearTimeout(singleTapTimeout.current);
          singleTapTimeout.current = null;
        }

        // Only like if not already liked
        if (!isLiked) {
          setIsLiked(true);
          setLikesCount((prev) => prev + 1);
          onLike(item._id);
        }
        animateHeart();
        animateDoubleTap();
        lastTap.current = null; // Reset to prevent triple tap issues
      } else {
        // First tap - wait to see if second tap comes
        lastTap.current = now;

        // Schedule single tap action (pause/play) after delay
        singleTapTimeout.current = setTimeout(() => {
          if (player.playing) {
            player.pause();
            setUserPaused(true);
            togglePlayPauseAnimation();
          } else {
            player.play();
            setUserPaused(false);
            togglePlayPauseAnimation();
          }
          singleTapTimeout.current = null;
        }, DOUBLE_PRESS_DELAY);
      }
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
      return String(num);
    };

    return (
      <View style={[styles.reelContainer, { height: viewHeight }]}>
        <TouchableWithoutFeedback onPress={handleSingleTap}>
          <View style={styles.videoWrapper}>
            <VideoView
              style={StyleSheet.absoluteFill}
              player={player}
              contentFit="cover"
              nativeControls={false}
              allowsPictureInPicture={false}
            />

            {/* Center Animations */}
            <View style={styles.centerOverlay}>
              <Animated.View
                style={{
                  opacity: doubleTapOpacity,
                  transform: [{ scale: 1.5 }],
                }}
              >
                <Ionicons
                  name="heart"
                  size={100}
                  color="rgba(255,255,255,0.9)"
                />
              </Animated.View>

              <Animated.View
                style={[styles.playIconContainer, { opacity: playIconOpacity }]}
              >
                <Ionicons
                  name={userPaused ? "play" : "pause"}
                  size={60}
                  color="rgba(255,255,255,0.8)"
                />
              </Animated.View>
            </View>

            {/* Gradients */}
            <LinearGradient
              colors={["rgba(0,0,0,0.4)", "transparent"]}
              style={[styles.topGradient, { height: insets.top + 80 }]}
            />
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.2)", "rgba(0,0,0,0.9)"]}
              style={styles.bottomGradient}
            />

            {/* UI Layer */}
            <View
              style={[
                styles.uiContainer,
                { paddingBottom: Platform.OS === "android" ? 20 : 10 },
              ]}
            >
              {/* Bottom Left Info */}
              <View style={styles.infoContainer}>
                <View style={styles.userRow}>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('UserProfile', { username: author.username, userId: author._id })}
                    activeOpacity={0.7}
                  >
                    <ExpoImage
                      source={{ uri: author.avatar || 'https://via.placeholder.com/150' }}
                      style={styles.avatar}
                      contentFit="cover"
                    />
                  </TouchableOpacity>
                  <Text style={styles.username}>@{author.username}</Text>
                  {!isFollowing && author._id !== currentUserId && (
                    <TouchableOpacity
                      onPress={() => {
                        setIsFollowing(true);
                        onFollow(author.username);
                      }}
                      style={styles.followBtn}
                    >
                      <Text style={styles.followText}>Follow</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={styles.caption} numberOfLines={2}>
                  {item.caption}{" "}
                  {item.hashtags?.length > 0 && (
                    <Text style={styles.hashtag}>
                      {item.hashtags.map(t => `#${t}`).join(' ')}
                    </Text>
                  )}
                </Text>

                {item.music && (
                  <View style={styles.musicRow}>
                    <Ionicons name="musical-notes" size={14} color="#fff" />
                    <View style={styles.tickerContainer}>
                      <Text style={styles.musicText}>
                        {item.music} • Original Audio
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Bottom Right Actions */}
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
                  icon={isSaved ? "bookmark" : "bookmark-outline"}
                  color={isSaved ? "#FFD700" : "#fff"}
                  label={isSaved ? "Saved" : "Save"}
                  onPress={() => {
                    setIsSaved(!isSaved);
                    onSave(item._id);
                  }}
                />

                <ActionButton
                  icon={isMuted ? "volume-mute-outline" : "volume-high-outline"}
                  onPress={() => setIsMuted(!isMuted)}
                />

                <View style={styles.vinylContainer}>
                  <ExpoImage
                    source={{ uri: author.avatar || 'https://via.placeholder.com/150' }}
                    style={styles.vinyl}
                  />
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
      prev.item.commentsCount === next.item.commentsCount &&
      prev.item.isLiked === next.item.isLiked &&
      prev.item.likesCount === next.item.likesCount &&
      prev.viewHeight === next.viewHeight
    );
  },
);


// --- MAIN SCREEN ---

const ReelsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useSelector((state) => state.auth);

  // Safe wrapper - useBottomTabBarHeight crashes if not in tab navigator
  let bottomTabHeight = 0;
  try {
    bottomTabHeight = useBottomTabBarHeight();
  } catch (e) {
    bottomTabHeight = 60; // fallback
  }

  const isFocused = useIsFocused();

  // State
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // DYNAMIC HEIGHT STATE
  const [containerHeight, setContainerHeight] = useState(null);

  // Comment Sheet State
  const [showComments, setShowComments] = useState(false);
  const [activeReel, setActiveReel] = useState(null);

  // API
  const fetchReels = async () => {
    try {
      const res = await api.get("/reels/feed");
      const data = res.data?.data || (Array.isArray(res.data) ? res.data : []);
      setReels(data);
    } catch (e) {
      console.error("Error fetching reels:", e.message);
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

  // Action Handlers
  const handleLike = useCallback(async (id) => {
    try {
      const res = await api.post(`/reels/${id}/like`);
      if (res.data?.success) {
        setReels((prev) =>
          prev.map((r) =>
            r._id === id
              ? { ...r, isLiked: res.data.data.isLiked, likesCount: res.data.data.likesCount }
              : r
          )
        );
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleFollow = useCallback(async (username) => {
    try {
      await api.post(`/users/${username}/follow`);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleSave = useCallback(async (id) => {
    try {
      await api.post('/bookmarks', { itemId: id, itemType: 'reel' });
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleShare = useCallback(async (item) => {
    try {
      await Share.share({ message: `Check out this reel! ${item.videoUrl}` });
    } catch (e) {
      console.error(e);
    }
  }, []);

  const openComments = useCallback((reel) => {
    setActiveReel(reel);
    setShowComments(true);
  }, []);

  const handleCommentCountChange = useCallback((newCount) => {
    if (activeReel) {
      setReels((prev) =>
        prev.map((r) =>
          r._id === activeReel._id
            ? { ...r, commentsCount: newCount }
            : r,
        ),
      );
    }
  }, [activeReel]);

  // View Config
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems?.length > 0) {
      setActiveIndex(viewableItems[0].index || 0);
    }
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;

  // Render Item
  const renderItem = useCallback(
    ({ item, index }) => (
      <ReelItem
        item={item}
        isActive={index === activeIndex}
        shouldPlay={isFocused}
        viewHeight={containerHeight}
        currentUserId={user?._id || user?.id}
        navigation={navigation}
        onLike={handleLike}
        onComment={openComments}
        onShare={handleShare}
        onFollow={handleFollow}
        onSave={handleSave}
      />
    ),
    [
      activeIndex,
      isFocused,
      containerHeight,
      handleLike,
      openComments,
      handleShare,
      handleFollow,
    ],
  );



  if (loading && reels.length === 0) {
    return (
      <View style={styles.loaderCenter}>
        <ActivityIndicator size="large" color="#FF3B5C" />
      </View>
    );
  }

  return (
    <View
      style={styles.container}
      onLayout={(e) => setContainerHeight(e.nativeEvent.layout.height)}
    >
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      {/* Header Overlay */}
      <View style={[styles.header, { top: insets.top }]}>
        <Text style={styles.headerTitle}>Reels</Text>
        <TouchableOpacity style={styles.cameraIcon}>
          <Ionicons name="camera-outline" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Reels List */}
      {containerHeight > 0 && (
        <FlashList
          data={reels}
          renderItem={renderItem}
          keyExtractor={(item) => item._id}
          estimatedItemSize={containerHeight}
          pagingEnabled
          decelerationRate="fast"
          disableIntervalMomentum
          showsVerticalScrollIndicator={false}
          snapToInterval={containerHeight}
          snapToAlignment="start"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      )}

      {/* Instagram-style Comments Sheet */}
      <ReelCommentsSheet
        visible={showComments}
        reel={activeReel}
        currentUserId={user?._id || user?.id || null}
        onClose={() => setShowComments(false)}
        onCommentCountChange={handleCommentCountChange}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  // Layout
  container: { flex: 1, backgroundColor: "black" },
  loaderCenter: {
    flex: 1,
    backgroundColor: "black",
    justifyContent: "center",
    alignItems: "center",
  },

  // Reel
  reelContainer: {
    width: "100%",
    overflow: "hidden",
    backgroundColor: "black",
  },
  videoWrapper: { flex: 1, justifyContent: "center" },

  // Header
  header: {
    position: "absolute",
    left: 20,
    right: 20,
    zIndex: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    height: 50,
  },
  headerTitle: {
    color: "white",
    fontWeight: "800",
    fontSize: 22,
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowRadius: 4,
  },
  cameraIcon: { padding: 8 },

  // Overlay
  centerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    pointerEvents: "none",
  },
  playIconContainer: { position: "absolute" },
  topGradient: { position: "absolute", top: 0, width: "100%" },
  bottomGradient: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    height: 350,
  },

  // UI
  uiContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    zIndex: 20,
    paddingHorizontal: 16,
  },
  infoContainer: { flex: 1, paddingRight: 10, marginBottom: 10 },
  actionsContainer: { width: 44, alignItems: "center", marginBottom: 14 },

  // User Info
  userRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "white",
    marginRight: 10,
  },
  username: {
    color: "white",
    fontWeight: "700",
    fontSize: 16,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowRadius: 3,
  },
  followBtn: {
    marginLeft: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  followText: { color: "white", fontSize: 12, fontWeight: "600" },
  caption: {
    color: "white",
    fontSize: 15,
    marginBottom: 10,
    lineHeight: 20,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowRadius: 2,
  },
  hashtag: { fontWeight: "700" },
  musicRow: { flexDirection: "row", alignItems: "center" },
  tickerContainer: { overflow: "hidden" },
  musicText: { color: "white", marginLeft: 8, fontSize: 14 },

  // Actions
  actionButton: { alignItems: "center", marginBottom: 18 },
  actionText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 3,
  },
  vinylContainer: {
    marginTop: 6,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#222",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#444",
  },
  vinyl: { width: 22, height: 22, borderRadius: 11 },


});

export default ReelsScreen;
