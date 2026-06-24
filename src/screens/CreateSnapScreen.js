import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator,
  Alert, Dimensions, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createSnap } from '../services/snapService';

const { width, height } = Dimensions.get('window');

/**
 * CreateSnapScreen — capture or pick a photo/short video, add a caption, then
 * post it to your story or send it as a direct disappearing snap.
 */
const CreateSnapScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [media, setMedia] = useState(null); // { uri, type: 'image'|'video', name, mime }
  const [caption, setCaption] = useState('');
  const [posting, setPosting] = useState(false);

  const videoPlayer = useVideoPlayer(media?.type === 'video' ? media.uri : null, (p) => {
    if (p) { p.loop = true; p.muted = false; }
  });

  useEffect(() => {
    if (media?.type === 'video' && videoPlayer) {
      try { videoPlayer.play(); } catch {}
    }
  }, [media, videoPlayer]);

  const fromResult = (asset) => {
    const uri = asset.uri;
    const isVideo = asset.type === 'video' || /\.(mp4|mov|webm)$/i.test(uri);
    const name = uri.split('/').pop() || (isVideo ? 'snap.mp4' : 'snap.jpg');
    const ext = (name.split('.').pop() || (isVideo ? 'mp4' : 'jpg')).toLowerCase();
    return { uri, type: isVideo ? 'video' : 'image', name, mime: isVideo ? `video/${ext}` : `image/${ext}` };
  };

  const capture = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission needed', 'Camera access is required.');
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8, videoMaxDuration: 15,
    });
    if (!res.canceled) setMedia(fromResult(res.assets[0]));
  };

  const pick = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission needed', 'Gallery access is required.');
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8, videoMaxDuration: 15,
    });
    if (!res.canceled) setMedia(fromResult(res.assets[0]));
  };

  const post = async (audience, recipients = []) => {
    if (!media || posting) return;
    setPosting(true);
    try {
      await createSnap({
        file: { uri: media.uri, name: media.name, type: media.mime },
        audience,
        recipients,
        caption,
      });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Could not post', 'Please try again.');
    } finally {
      setPosting(false);
    }
  };

  // CAPTURE / PICK CHOOSER
  if (!media) {
    return (
      <View style={styles.chooser}>
        <View style={[styles.chooserHeader, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn} hitSlop={hit}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.chooserTitle}>New snap</Text>
          <View style={styles.headerBtn} />
        </View>

        <View style={styles.chooserBody}>
          <View style={styles.snapMark}>
            <Ionicons name="aperture-outline" size={56} color="#fff" />
          </View>
          <Text style={styles.chooserHeadline}>Share a moment</Text>
          <Text style={styles.chooserSub}>Photos and clips disappear after 24 hours.</Text>

          <TouchableOpacity style={styles.primaryBtn} onPress={capture} activeOpacity={0.85}>
            <Ionicons name="camera-outline" size={22} color="#000" />
            <Text style={styles.primaryBtnText}>Open camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostBtn} onPress={pick} activeOpacity={0.85}>
            <Ionicons name="images-outline" size={22} color="#fff" />
            <Text style={styles.ghostBtnText}>Choose from gallery</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // PREVIEW + COMPOSE
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.previewWrap}>
      {media.type === 'video' ? (
        <VideoView style={StyleSheet.absoluteFill} player={videoPlayer} contentFit="cover" nativeControls={false} />
      ) : (
        <ExpoImage source={{ uri: media.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      )}

      <View style={[styles.previewTop, { top: insets.top + 6 }]}>
        <TouchableOpacity style={styles.roundBtn} onPress={() => setMedia(null)} hitSlop={hit}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={[styles.composer, { paddingBottom: insets.bottom + 14 }]}>
        <View style={styles.captionRow}>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="Add a caption"
            placeholderTextColor="rgba(255,255,255,0.7)"
            style={styles.captionInput}
            maxLength={280}
            multiline
          />
        </View>

        <View style={styles.postRow}>
          <TouchableOpacity
            style={[styles.storyBtn, posting && { opacity: 0.6 }]}
            onPress={() => post('story')}
            disabled={posting}
            activeOpacity={0.85}
          >
            {posting ? <ActivityIndicator color="#000" /> : (
              <>
                <Ionicons name="add-circle-outline" size={20} color="#000" />
                <Text style={styles.storyBtnText}>Your story</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sendBtn}
            onPress={() => navigation.navigate('SnapSend', { media, caption })}
            disabled={posting}
            activeOpacity={0.85}
          >
            <Text style={styles.sendBtnText}>Send to</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const hit = { top: 10, bottom: 10, left: 10, right: 10 };

const styles = StyleSheet.create({
  chooser: { flex: 1, backgroundColor: '#000' },
  chooserHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  headerBtn: { width: 40 },
  chooserTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  chooserBody: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 },
  snapMark: { width: 104, height: 104, borderRadius: 52, borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 26 },
  chooserHeadline: { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  chooserSub: { color: 'rgba(255,255,255,0.7)', fontSize: 15, textAlign: 'center', marginTop: 8, marginBottom: 36 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#fff', width: '100%', paddingVertical: 15, borderRadius: 999, marginBottom: 12 },
  primaryBtnText: { color: '#000', fontSize: 16, fontWeight: '700' },
  ghostBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', width: '100%', paddingVertical: 15, borderRadius: 999 },
  ghostBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  previewWrap: { flex: 1, backgroundColor: '#000' },
  previewTop: { position: 'absolute', left: 14, zIndex: 10 },
  roundBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },

  composer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16 },
  captionRow: { backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14 },
  captionInput: { color: '#fff', fontSize: 16, maxHeight: 100 },
  postRow: { flexDirection: 'row', gap: 10 },
  storyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', paddingVertical: 14, borderRadius: 999 },
  storyBtnText: { color: '#000', fontSize: 15, fontWeight: '700' },
  sendBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', paddingVertical: 14, borderRadius: 999 },
  sendBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

export default CreateSnapScreen;
