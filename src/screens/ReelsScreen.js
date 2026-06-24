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
  PanResponder,
  Dimensions,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useVideoPlayer, VideoView } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useIsFocused } from "@react-navigation/native";
import { useSelector } from "react-redux";
import api from "../services/api";
import ReelCommentsSheet from "../components/ReelCommentsSheet";
import ShareToDMSheet from "../components/ShareToDMSheet";
import Avatar from "../components/UI/Avatar";

const { width: SCREEN_W } = Dimensions.get("window");

const formatNumber = (num) => {
  if (!num) return "0";
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(num);
};

// Renders a caption with tappable #hashtags and @mentions.
const RichCaption = ({ text, onTagPress, onMentionPress, style, mentionStyle }) => {
  if (!text) return null;
  const parts = text.split(/(\s+)/);
  return (
    <Text style={style}>
      {parts.map((part, i) => {
        if (/^#[\w]+$/.test(part)) {
          return (
            <Text key={i} style={mentionStyle} onPress={() => onTagPress?.(part.slice(1))}>
              {part}
            </Text>
          );
        }
        if (/^@[\w.]+$/.test(part)) {
          return (
            <Text key={i} style={mentionStyle} onPress={() => onMentionPress?.(part.slice(1))}>
              {part}
            </Text>
          );
        }
        return part;
      })}
    </Text>
  );
};

const ActionButton = ({ icon, label, active, activeColor = "#fff", onPress, scale }) => (
  <TouchableOpacity onPress={onPress} style={styles.actionButton} activeOpacity={0.7}>
    <Animated.View style={[styles.actionIconWrap, scale ? { transform: [{ scale }] } : null]}>
      <Ionicons name={icon} size={29} color={active ? activeColor : "#fff"} />
    </Animated.View>
    {label !== undefined && <Text style={styles.actionText}>{label}</Text>}
  </TouchableOpacity>
);

// --- SINGLE REEL ITEM ---
const ReelItem = React.memo(
  ({
    item, isActive, shouldPlay, viewHeight, currentUserId, navigation,
    onLike, onComment, onShare, onFollow, onSave,
  }) => {
    const insets = useSafeAreaInsets();

    const heartScale = useRef(new Animated.Value(1)).current;
    const doubleTapOpacity = useRef(new Animated.Value(0)).current;
    const playIconOpacity = useRef(new Animated.Value(0)).current;

    const [isLiked, setIsLiked] = useState(item.isLiked || false);
    const [likesCount, setLikesCount] = useState(item.likesCount || 0);
    const [isFollowing, setIsFollowing] = useState(item.user?.isFollowing || false);
    const [isMuted, setIsMuted] = useState(false);
    const [userPaused, setUserPaused] = useState(false);
    const [isSaved, setIsSaved] = useState(item.isSaved || false);
    const [expanded, setExpanded] = useState(false);

    // Progress (0..1) and scrubbing state
    const [progress, setProgress] = useState(0);
    const [scrubbing, setScrubbing] = useState(false);
    const durationRef = useRef(0);

    const lastTap = useRef(null);
    const singleTapTimeout = useRef(null);
    const author = item.user || item.author || {};

    const player = useVideoPlayer(item.videoUrl, (p) => {
      p.loop = true;
      p.muted = isMuted;
      p.timeUpdateEventInterval = 0.25;
    });

    useEffect(() => {
      if (isActive && shouldPlay && !userPaused) player.play();
      else player.pause();
    }, [isActive, shouldPlay, userPaused, player]);

    useEffect(() => { player.muted = isMuted; }, [isMuted, player]);

    useEffect(() => {
      setIsLiked(item.isLiked || false);
      setLikesCount(item.likesCount || 0);
    }, [item.isLiked, item.likesCount]);

    // Subscribe to time updates for the progress bar.
    useEffect(() => {
      const sub = player.addListener("timeUpdate", (payload) => {
        const dur = player.duration || durationRef.current || 0;
        durationRef.current = dur;
        if (!scrubbing && dur > 0) {
          setProgress(Math.min(1, (payload.currentTime || 0) / dur));
        }
      });
      return () => sub?.remove?.();
    }, [player, scrubbing]);

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
    const flashPlayIcon = () => {
      playIconOpacity.setValue(1);
      Animated.timing(playIconOpacity, { toValue: 0, duration: 700, useNativeDriver: true }).start();
    };

    const handleSingleTap = () => {
      const now = Date.now();
      const DELAY = 300;
      if (lastTap.current && now - lastTap.current < DELAY) {
        if (singleTapTimeout.current) { clearTimeout(singleTapTimeout.current); singleTapTimeout.current = null; }
        if (!isLiked) { setIsLiked(true); setLikesCount((p) => p + 1); onLike(item._id); }
        animateHeart(); animateDoubleTap();
        lastTap.current = null;
      } else {
        lastTap.current = now;
        singleTapTimeout.current = setTimeout(() => {
          if (player.playing) { player.pause(); setUserPaused(true); }
          else { player.play(); setUserPaused(false); }
          flashPlayIcon();
          singleTapTimeout.current = null;
        }, DELAY);
      }
    };

    const handleLikePress = () => {
      const next = !isLiked;
      setIsLiked(next);
      setLikesCount((p) => (next ? p + 1 : Math.max(0, p - 1)));
      animateHeart();
      onLike(item._id);
    };

    const goToAuthor = () =>
      navigation.navigate("UserProfile", { username: author.username, userId: author._id });

    // Seek bar pan responder
    const barWidth = SCREEN_W - 24;
    const seek = useCallback((ratio) => {
      const dur = durationRef.current || player.duration || 0;
      if (dur > 0) { try { player.currentTime = ratio * dur; } catch {} }
    }, [player]);

    const pan = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          setScrubbing(true);
          const r = Math.max(0, Math.min(1, e.nativeEvent.locationX / barWidth));
          setProgress(r);
        },
        onPanResponderMove: (e) => {
          const r = Math.max(0, Math.min(1, e.nativeEvent.locationX / barWidth));
          setProgress(r);
        },
        onPanResponderRelease: (e) => {
          const r = Math.max(0, Math.min(1, e.nativeEvent.locationX / barWidth));
          seek(r);
          setScrubbing(false);
        },
        onPanResponderTerminate: () => setScrubbing(false),
      })
    ).current;

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

            {/* Center animations */}
            <View style={styles.centerOverlay} pointerEvents="none">
              <Animated.View style={{ opacity: doubleTapOpacity, transform: [{ scale: 1.4 }] }}>
                <Ionicons name="heart" size={104} color="rgba(255,255,255,0.92)" />
              </Animated.View>
              <Animated.View style={[styles.playIconContainer, { opacity: playIconOpacity }]}>
                <View style={styles.playPill}>
                  <Ionicons name={userPaused ? "play" : "pause"} size={46} color="rgba(255,255,255,0.95)" />
                </View>
              </Animated.View>
            </View>

            {/* Scrims (solid, no gradient) */}
            <View style={[styles.topScrim, { height: insets.top + 70 }]} pointerEvents="none" />
            <View style={styles.bottomScrim} pointerEvents="none" />

            {/* UI layer */}
            <View style={[styles.uiContainer, { paddingBottom: Platform.OS === "android" ? 18 : 8 }]}>
              {/* Bottom-left info */}
              <View style={styles.infoContainer}>
                <View style={styles.userRow}>
                  <TouchableOpacity onPress={goToAuthor} activeOpacity={0.8}>
                    <Avatar user={author} size={36} style={{ marginRight: 10 }} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={goToAuthor} activeOpacity={0.8}>
                    <Text style={styles.username}>{author.username}</Text>
                  </TouchableOpacity>
                  {!isFollowing && author._id !== currentUserId && (
                    <TouchableOpacity
                      onPress={() => { setIsFollowing(true); onFollow(author.username); }}
                      style={styles.followBtn}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.followText}>Follow</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {!!item.caption && (
                  <TouchableOpacity activeOpacity={0.9} onPress={() => setExpanded((v) => !v)}>
                    <RichCaption
                      text={item.caption}
                      style={styles.caption}
                      mentionStyle={styles.captionTag}
                      onTagPress={(t) => navigation.navigate("Search", { query: `#${t}` })}
                      onMentionPress={(u) => navigation.navigate("UserProfile", { username: u })}
                    />
                    {item.caption.length > 80 && (
                      <Text style={styles.moreLabel}>{expanded ? "less" : "more"}</Text>
                    )}
                  </TouchableOpacity>
                )}

                {!!(item.music || author.username) && (
                  <View style={styles.musicRow}>
                    <Ionicons name="musical-note" size={13} color="#fff" />
                    <Text style={styles.musicText} numberOfLines={1}>
                      {item.music || `Original audio · ${author.username}`}
                    </Text>
                  </View>
                )}
              </View>

              {/* Bottom-right actions */}
              <View style={styles.actionsContainer}>
                <ActionButton
                  icon={isLiked ? "heart" : "heart-outline"}
                  active={isLiked}
                  activeColor="#FF4060"
                  label={formatNumber(likesCount)}
                  onPress={handleLikePress}
                  scale={heartScale}
                />
                <ActionButton
                  icon="chatbubble-outline"
                  label={formatNumber(item.commentsCount || 0)}
                  onPress={() => onComment(item)}
                />
                <ActionButton
                  icon="arrow-redo-outline"
                  label={formatNumber(item.stats?.shares || 0)}
                  onPress={() => onShare(item)}
                />
                <ActionButton
                  icon={isSaved ? "bookmark" : "bookmark-outline"}
                  active={isSaved}
                  activeColor="#FFC53D"
                  onPress={() => { setIsSaved((v) => !v); onSave(item._id); }}
                />
                <ActionButton
                  icon={isMuted ? "volume-mute" : "volume-high"}
                  onPress={() => setIsMuted((v) => !v)}
                />
                <TouchableOpacity
                  style={styles.remixBtn}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate("CreateReel", { remixOf: item._id })}
                >
                  <Avatar user={author} size={26} />
                  <View style={styles.remixPlus}>
                    <Ionicons name="add" size={12} color="#fff" />
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Seek / progress bar */}
            <View
              style={[styles.seekHit, { bottom: (Platform.OS === "android" ? 18 : 8) }]}
              {...pan.panHandlers}
            >
              <View style={[styles.seekTrack, scrubbing && styles.seekTrackActive]}>
                <View style={[styles.seekFill, { width: `${progress * 100}%` }]} />
                {scrubbing && <View style={[styles.seekKnob, { left: `${progress * 100}%` }]} />}
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </View>
    );
  },
  (prev, next) =>
    prev.isActive === next.isActive &&
    prev.shouldPlay === next.shouldPlay &&
    prev.item._id === next.item._id &&
    prev.item.commentsCount === next.item.commentsCount &&
    prev.item.isLiked === next.item.isLiked &&
    prev.item.likesCount === next.item.likesCount &&
    prev.viewHeight === next.viewHeight
);

// --- MAIN SCREEN ---
const ReelsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useSelector((state) => state.auth);

  let bottomTabHeight = 0;
  try { bottomTabHeight = useBottomTabBarHeight(); } catch { bottomTabHeight = 60; }

  const isFocused = useIsFocused();

  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [containerHeight, setContainerHeight] = useState(null);
  const [feedType, setFeedType] = useState("foryou"); // 'foryou' | 'following'

  const [showComments, setShowComments] = useState(false);
  const [activeReel, setActiveReel] = useState(null);
  const [sharePayload, setSharePayload] = useState(null);

  const fetchReels = useCallback(async (type = feedType) => {
    try {
      const res = await api.get("/reels/feed", { params: { type } });
      const data = res.data?.data || (Array.isArray(res.data) ? res.data : []);
      setReels(data);
    } catch (e) {
      console.error("Error fetching reels:", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [feedType]);

  useEffect(() => { fetchReels("foryou"); }, []);

  const switchFeed = (type) => {
    if (type === feedType) return;
    setFeedType(type);
    setLoading(true);
    setReels([]);
    setActiveIndex(0);
    fetchReels(type);
  };

  const handleRefresh = useCallback(() => { setRefreshing(true); fetchReels(); }, [fetchReels]);

  const handleLike = useCallback(async (id) => {
    try {
      const res = await api.post(`/reels/${id}/like`);
      if (res.data?.success) {
        setReels((prev) => prev.map((r) => (r._id === id
          ? { ...r, isLiked: res.data.data.isLiked, likesCount: res.data.data.likesCount }
          : r)));
      }
    } catch (e) { console.error(e); }
  }, []);

  const handleFollow = useCallback(async (username) => {
    try { await api.post(`/users/${username}/follow`); } catch (e) { console.error(e); }
  }, []);

  const handleSave = useCallback(async (id) => {
    try { await api.post("/bookmarks", { itemId: id, itemType: "reel" }); } catch (e) { console.error(e); }
  }, []);

  const handleShare = useCallback((item) => {
    api.post(`/reels/${item._id}/share`).catch(() => {});
    setSharePayload({
      type: "reel",
      id: item._id,
      previewUrl: item.thumbnailUrl || item.videoUrl,
      caption: item.caption || "",
      deepLink: `pulse://reel/${item._id}`,
    });
  }, []);

  const openComments = useCallback((reel) => { setActiveReel(reel); setShowComments(true); }, []);

  const handleCommentCountChange = useCallback((newCount) => {
    if (activeReel) {
      setReels((prev) => prev.map((r) => (r._id === activeReel._id ? { ...r, commentsCount: newCount } : r)));
    }
  }, [activeReel]);

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems?.length > 0) setActiveIndex(viewableItems[0].index || 0);
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;

  const renderItem = useCallback(
    ({ item, index }) => (
      <ReelItem
        item={item}
        isActive={index === activeIndex}
        shouldPlay={isFocused && !showComments && !sharePayload}
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
    [activeIndex, isFocused, showComments, sharePayload, containerHeight, handleLike, openComments, handleShare, handleFollow, handleSave]
  );

  if (loading && reels.length === 0) {
    return (
      <View style={styles.loaderCenter}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <View style={styles.container} onLayout={(e) => setContainerHeight(e.nativeEvent.layout.height)}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Header: segmented For You / Following + camera */}
      <View style={[styles.header, { top: insets.top + 4 }]}>
        <View style={styles.segment}>
          <TouchableOpacity onPress={() => switchFeed("following")} activeOpacity={0.8}>
            <Text style={[styles.segmentText, feedType === "following" && styles.segmentTextActive]}>
              Following
            </Text>
          </TouchableOpacity>
          <View style={styles.segmentDivider} />
          <TouchableOpacity onPress={() => switchFeed("foryou")} activeOpacity={0.8}>
            <Text style={[styles.segmentText, feedType === "foryou" && styles.segmentTextActive]}>
              For You
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.cameraIcon} onPress={() => navigation.navigate("CreateReel")} activeOpacity={0.8}>
          <Ionicons name="camera-outline" size={27} color="#fff" />
        </TouchableOpacity>
      </View>

      {containerHeight > 0 && reels.length > 0 && (
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

      {containerHeight > 0 && reels.length === 0 && !loading && (
        <View style={styles.emptyWrap}>
          <Ionicons name="film-outline" size={54} color="rgba(255,255,255,0.6)" />
          <Text style={styles.emptyTitle}>
            {feedType === "following" ? "No reels from people you follow" : "No reels yet"}
          </Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate("CreateReel")} activeOpacity={0.85}>
            <Text style={styles.emptyBtnText}>Create a reel</Text>
          </TouchableOpacity>
        </View>
      )}

      <ReelCommentsSheet
        visible={showComments}
        reel={activeReel}
        currentUserId={user?._id || user?.id || null}
        onClose={() => setShowComments(false)}
        onCommentCountChange={handleCommentCountChange}
      />

      <ShareToDMSheet
        visible={!!sharePayload}
        payload={sharePayload}
        onClose={() => setSharePayload(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  loaderCenter: { flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" },

  reelContainer: { width: "100%", overflow: "hidden", backgroundColor: "#000" },
  videoWrapper: { flex: 1, justifyContent: "center" },

  header: {
    position: "absolute", left: 0, right: 0, zIndex: 50,
    flexDirection: "row", justifyContent: "center", alignItems: "center", height: 44, paddingHorizontal: 16,
  },
  segment: { flexDirection: "row", alignItems: "center", gap: 14 },
  segmentText: { color: "rgba(255,255,255,0.6)", fontWeight: "600", fontSize: 16 },
  segmentTextActive: { color: "#fff", fontWeight: "800" },
  segmentDivider: { width: 1, height: 14, backgroundColor: "rgba(255,255,255,0.4)" },
  cameraIcon: { position: "absolute", right: 16, padding: 6 },

  centerOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center", zIndex: 10 },
  playIconContainer: { position: "absolute" },
  playPill: { width: 84, height: 84, borderRadius: 42, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },

  topScrim: { position: "absolute", top: 0, width: "100%", backgroundColor: "rgba(0,0,0,0.28)" },
  bottomScrim: { position: "absolute", bottom: 0, width: "100%", height: 240, backgroundColor: "rgba(0,0,0,0.42)" },

  uiContainer: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", alignItems: "flex-end", zIndex: 20, paddingHorizontal: 14 },
  infoContainer: { flex: 1, paddingRight: 12, marginBottom: 18 },
  actionsContainer: { width: 56, alignItems: "center", marginBottom: 18 },

  userRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  username: { color: "#fff", fontWeight: "700", fontSize: 15, textShadowColor: "rgba(0,0,0,0.4)", textShadowRadius: 3 },
  followBtn: { marginLeft: 12, borderWidth: 1.2, borderColor: "rgba(255,255,255,0.9)", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  followText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  caption: { color: "#fff", fontSize: 14, lineHeight: 19, textShadowColor: "rgba(0,0,0,0.4)", textShadowRadius: 2 },
  captionTag: { fontWeight: "700", color: "#fff" },
  moreLabel: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: "600", marginTop: 2 },
  musicRow: { flexDirection: "row", alignItems: "center", marginTop: 10, gap: 6 },
  musicText: { color: "#fff", fontSize: 13, flex: 1, opacity: 0.95 },

  actionButton: { alignItems: "center", marginBottom: 20 },
  actionIconWrap: { alignItems: "center", justifyContent: "center" },
  actionText: { color: "#fff", fontSize: 12, fontWeight: "700", marginTop: 4, textShadowColor: "rgba(0,0,0,0.4)", textShadowRadius: 2 },
  remixBtn: { marginTop: 4, alignItems: "center", justifyContent: "center" },
  remixPlus: { position: "absolute", bottom: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: "#FF4060", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#000" },

  seekHit: { position: "absolute", left: 0, right: 0, height: 28, justifyContent: "center", zIndex: 30, paddingHorizontal: 12 },
  seekTrack: { height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.3)", overflow: "visible" },
  seekTrackActive: { height: 5 },
  seekFill: { height: "100%", borderRadius: 2, backgroundColor: "#fff" },
  seekKnob: { position: "absolute", top: -4, width: 13, height: 13, borderRadius: 7, backgroundColor: "#fff", marginLeft: -6 },

  emptyWrap: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", padding: 40, gap: 14 },
  emptyTitle: { color: "#fff", fontSize: 16, fontWeight: "600", textAlign: "center" },
  emptyBtn: { backgroundColor: "#fff", paddingHorizontal: 22, paddingVertical: 11, borderRadius: 24, marginTop: 4 },
  emptyBtnText: { color: "#000", fontWeight: "700", fontSize: 15 },
});

export default ReelsScreen;
