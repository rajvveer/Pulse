import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableWithoutFeedback, Animated, Dimensions, TouchableOpacity, StatusBar, Alert,
  Modal, Pressable, FlatList, ActivityIndicator, Share,
} from 'react-native';
import { useSelector } from 'react-redux';
import { Image as ExpoImage } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Avatar from '../components/UI/Avatar';
import { markSnapViewed, deleteSnap, getSnapViewers } from '../services/snapService';

const { width, height } = Dimensions.get('window');

/**
 * SnapViewerScreen — full-screen tap-through story viewer.
 *
 * params: { rings: [{ authorId, user, snaps[] }], startAuthorId }
 * (startAuthorId selects which author to open on; we resolve it to an index
 * against the same filtered rings list so it can't desync with the rail.)
 *
 * Segmented progress bars at top, auto-advance on images, tap zones to go
 * back/forward, swipe-down (close button) to exit. Each snap is marked viewed.
 */
const IMAGE_DURATION = 5000;

const SnapViewerScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { user: currentUser } = useSelector((state) => state.auth);
  const myId = currentUser?._id || currentUser?.id;

  const initialRings = route.params?.rings?.filter((r) => r.snaps?.length) || [];
  const [rings, setRings] = useState(initialRings);
  const startAuthorId = route.params?.startAuthorId;
  const resolvedStart = startAuthorId
    ? Math.max(0, initialRings.findIndex((r) => r.authorId === startAuthorId))
    : (route.params?.startIndex || 0);

  const [authorIdx, setAuthorIdx] = useState(Math.min(resolvedStart, Math.max(0, initialRings.length - 1)));
  const [snapIdx, setSnapIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewers, setViewers] = useState(null);   // null = loading
  const [viewersCount, setViewersCount] = useState(0);

  const progress = useRef(new Animated.Value(0)).current;
  const animRef = useRef(null);

  const ring = rings[authorIdx];
  const snap = ring?.snaps?.[snapIdx];

  const player = useVideoPlayer(snap?.mediaType === 'video' ? snap.mediaUrl : null, (p) => {
    if (p) { p.loop = false; p.muted = false; }
  });

  const close = useCallback(() => navigation.goBack(), [navigation]);

  const confirmDelete = useCallback(() => {
    if (!snap?._id) return;
    setPaused(true); // hold the auto-advance while the dialog is open
    Alert.alert('Delete story', 'This snap will be removed for everyone.', [
      { text: 'Cancel', style: 'cancel', onPress: () => setPaused(false) },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const deletedId = snap._id;
          try {
            await deleteSnap(deletedId);
          } catch (e) {
            setPaused(false);
            return Alert.alert('Could not delete', 'Please try again.');
          }
          // Remove from local state; drop the author ring if it's now empty.
          progress.stopAnimation();
          setRings((prev) => {
            const updated = prev
              .map((r) => ({ ...r, snaps: r.snaps.filter((s) => s._id !== deletedId) }))
              .filter((r) => r.snaps.length > 0);
            if (updated.length === 0) { close(); return prev; }
            // Keep indices in range after removal.
            const newAuthor = Math.min(authorIdx, updated.length - 1);
            setAuthorIdx(newAuthor);
            setSnapIdx((si) => Math.min(si, updated[newAuthor].snaps.length - 1));
            return updated;
          });
          setPaused(false);
        },
      },
    ]);
  }, [snap, authorIdx, close, progress]);

  // Kebab menu: pause auto-advance while it's open.
  const openMenu = useCallback(() => { setPaused(true); setMenuOpen(true); }, []);
  const closeMenu = useCallback(() => { setMenuOpen(false); setPaused(false); }, []);

  // "Viewers" — author-only seen-by list.
  const openViewers = useCallback(async () => {
    setMenuOpen(false);
    setViewersOpen(true);
    setViewers(null);
    try {
      const data = await getSnapViewers(snap._id);
      setViewers(data?.viewers || []);
      setViewersCount(data?.viewCount || 0);
    } catch (e) {
      setViewers([]);
      setViewersCount(0);
    }
  }, [snap]);

  const closeViewers = useCallback(() => { setViewersOpen(false); setPaused(false); }, []);

  // "Share link" — share the media URL (works for any snap).
  const shareSnap = useCallback(async () => {
    setMenuOpen(false);
    try { await Share.share({ message: snap?.mediaUrl || '' }); } catch {}
    setPaused(false);
  }, [snap]);

  const goNext = useCallback(() => {
    progress.stopAnimation();
    if (!ring) return close();
    if (snapIdx < ring.snaps.length - 1) {
      setSnapIdx((i) => i + 1);
    } else if (authorIdx < rings.length - 1) {
      setAuthorIdx((a) => a + 1);
      setSnapIdx(0);
    } else {
      close();
    }
  }, [ring, snapIdx, authorIdx, rings.length, close, progress]);

  const goPrev = useCallback(() => {
    progress.stopAnimation();
    if (snapIdx > 0) setSnapIdx((i) => i - 1);
    else if (authorIdx > 0) {
      const prevRing = rings[authorIdx - 1];
      setAuthorIdx((a) => a - 1);
      setSnapIdx(Math.max(0, (prevRing?.snaps?.length || 1) - 1));
    }
  }, [snapIdx, authorIdx, rings, progress]);

  // Drive progress + auto-advance for the current snap.
  useEffect(() => {
    if (!snap) return;
    progress.setValue(0);
    markSnapViewed(snap._id);

    let duration = IMAGE_DURATION;
    if (snap.mediaType === 'video') {
      duration = snap.durationMs || 8000;
      try { player.currentTime = 0; player.play(); } catch {}
    }

    const run = () => {
      animRef.current = Animated.timing(progress, {
        toValue: 1,
        duration,
        useNativeDriver: false,
      });
      animRef.current.start(({ finished }) => { if (finished) goNext(); });
    };
    run();

    return () => { animRef.current?.stop?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorIdx, snapIdx]);

  // Pause/resume
  useEffect(() => {
    if (paused) {
      progress.stopAnimation();
      if (snap?.mediaType === 'video') { try { player.pause(); } catch {} }
    } else {
      if (snap?.mediaType === 'video') { try { player.play(); } catch {} }
      // resume the timing from current value
      const current = progress.__getValue ? progress.__getValue() : 0;
      const remaining = (1 - current) * (snap?.mediaType === 'video' ? (snap.durationMs || 8000) : IMAGE_DURATION);
      if (remaining > 0 && snap) {
        animRef.current = Animated.timing(progress, { toValue: 1, duration: remaining, useNativeDriver: false });
        animRef.current.start(({ finished }) => { if (finished) goNext(); });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  if (!ring || !snap) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <TouchableOpacity style={[styles.closeBtn, { top: insets.top + 8 }]} onPress={close}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  }

  const author = ring.user || {};

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {snap.mediaType === 'video' ? (
        <VideoView style={StyleSheet.absoluteFill} player={player} contentFit="contain" nativeControls={false} />
      ) : (
        <ExpoImage source={{ uri: snap.mediaUrl }} style={StyleSheet.absoluteFill} contentFit="contain" transition={120} />
      )}

      {/* top scrim */}
      <View style={[styles.topScrim, { height: insets.top + 90 }]} pointerEvents="none" />

      {/* segmented progress */}
      <View style={[styles.progressRow, { top: insets.top + 8 }]}>
        {ring.snaps.map((s, i) => (
          <View key={s._id} style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: i < snapIdx ? '100%' : i > snapIdx ? '0%'
                    : progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                },
              ]}
            />
          </View>
        ))}
      </View>

      {/* author row */}
      <View style={[styles.authorRow, { top: insets.top + 20 }]}>
        <Avatar user={author} size={34} />
        <Text style={styles.authorName} numberOfLines={1}>{author.username}</Text>
        <Text style={styles.timeAgo}>{timeAgo(snap.createdAt)}</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={openMenu} hitSlop={hit} style={{ marginRight: 16 }}>
          <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={close} hitSlop={hit}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* tap zones */}
      <View style={styles.tapZones}>
        <TouchableWithoutFeedback onPress={goPrev} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)}>
          <View style={styles.tapLeft} />
        </TouchableWithoutFeedback>
        <TouchableWithoutFeedback onPress={goNext} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)}>
          <View style={styles.tapRight} />
        </TouchableWithoutFeedback>
      </View>

      {/* caption */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]} pointerEvents="box-none">
        {!!snap.caption && <Text style={styles.caption} pointerEvents="none">{snap.caption}</Text>}
        {ring.authorId === myId && (
          <TouchableOpacity style={styles.seenByPill} onPress={openViewers} activeOpacity={0.8}>
            <Ionicons name="eye-outline" size={16} color="#fff" />
            <Text style={styles.seenByText}>
              {(snap.viewCount || 0) > 0 ? `Seen by ${snap.viewCount}` : 'Seen by'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── kebab menu ── */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={closeMenu}>
        <Pressable style={styles.sheetBackdrop} onPress={closeMenu}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}>
            <View style={styles.sheetHandle} />
            {ring.authorId === myId && (
              <TouchableOpacity style={styles.sheetRow} onPress={openViewers}>
                <Ionicons name="eye-outline" size={22} color="#fff" />
                <Text style={styles.sheetText}>Viewers</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.sheetRow} onPress={shareSnap}>
              <Ionicons name="share-outline" size={22} color="#fff" />
              <Text style={styles.sheetText}>Share link</Text>
            </TouchableOpacity>
            {ring.authorId === myId && (
              <TouchableOpacity style={styles.sheetRow} onPress={() => { setMenuOpen(false); confirmDelete(); }}>
                <Ionicons name="trash-outline" size={22} color="#ff5a5f" />
                <Text style={[styles.sheetText, { color: '#ff5a5f' }]}>Delete story</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.sheetRow, styles.sheetCancel]} onPress={closeMenu}>
              <Text style={[styles.sheetText, { textAlign: 'center', flex: 1, color: '#bbb' }]}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── viewers (seen by) sheet ── */}
      <Modal visible={viewersOpen} transparent animationType="slide" onRequestClose={closeViewers}>
        <Pressable style={styles.sheetBackdrop} onPress={closeViewers}>
          <Pressable style={[styles.viewersSheet, { paddingBottom: insets.bottom + 8 }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.viewersTitle}>
              {viewersCount > 0 ? `Viewers · ${viewersCount}` : 'Viewers'}
            </Text>
            {viewers === null ? (
              <ActivityIndicator color="#fff" style={{ marginVertical: 28 }} />
            ) : viewers.length === 0 ? (
              <Text style={styles.viewersEmpty}>No views yet</Text>
            ) : (
              <FlatList
                data={viewers}
                keyExtractor={(it, i) => it._id || String(i)}
                style={{ maxHeight: height * 0.5 }}
                renderItem={({ item }) => (
                  <View style={styles.viewerRow}>
                    <Avatar user={item} size={40} />
                    <View style={{ marginLeft: 12 }}>
                      <Text style={styles.viewerName}>{item.username || 'user'}</Text>
                      {!!item.name && <Text style={styles.viewerSub}>{item.name}</Text>}
                    </View>
                  </View>
                )}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const timeAgo = (date) => {
  if (!date) return '';
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
};

const hit = { top: 10, bottom: 10, left: 10, right: 10 };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  topScrim: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.3)' },
  closeBtn: { position: 'absolute', right: 16, zIndex: 20 },

  progressRow: { position: 'absolute', left: 10, right: 10, flexDirection: 'row', gap: 4, zIndex: 20 },
  progressTrack: { flex: 1, height: 2.5, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#fff' },

  authorRow: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 9, zIndex: 20 },
  authorName: { color: '#fff', fontWeight: '700', fontSize: 14 },
  timeAgo: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginLeft: 2 },

  tapZones: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', zIndex: 10 },
  tapLeft: { width: width * 0.32, height: '100%' },
  tapRight: { flex: 1, height: '100%' },

  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18, zIndex: 15 },
  caption: { color: '#fff', fontSize: 15, lineHeight: 21, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 3, backgroundColor: 'rgba(0,0,0,0.25)', padding: 10, borderRadius: 12, overflow: 'hidden' },

  seenByPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 6, marginTop: 12, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.45)' },
  seenByText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  // bottom sheets (kebab menu + viewers)
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#1c1c1e', borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 8, paddingTop: 8 },
  sheetHandle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', marginVertical: 8 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 15, paddingHorizontal: 16 },
  sheetText: { color: '#fff', fontSize: 16, fontWeight: '500' },
  sheetCancel: { marginTop: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.12)' },

  viewersSheet: { backgroundColor: '#1c1c1e', borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 16, paddingTop: 8 },
  viewersTitle: { color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 10 },
  viewersEmpty: { color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginVertical: 28 },
  viewerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  viewerName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  viewerSub: { color: 'rgba(255,255,255,0.55)', fontSize: 13 },
});

export default SnapViewerScreen;
