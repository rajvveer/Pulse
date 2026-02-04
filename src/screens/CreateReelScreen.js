import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ScrollView,
  Keyboard,
} from "react-native";
import { Video, ResizeMode } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";
import api from "../services/api";
import MusicPicker from "../components/MusicPicker";

const { width, height } = Dimensions.get("window");

// Trending hashtags (can be fetched from backend)
const TRENDING_HASHTAGS = [
  'fyp', 'viral', 'trending', 'foryou', 'explore',
  'reels', 'dance', 'comedy', 'music', 'vlog'
];

const CreateReelScreen = ({ navigation }) => {
  const isFocused = useIsFocused();
  const [videoUri, setVideoUri] = useState(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showCaptionInput, setShowCaptionInput] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);

  // Music state
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState(null);

  // Hashtags state
  const [hashtags, setHashtags] = useState([]);
  const [hashtagInput, setHashtagInput] = useState("");

  const insets = useSafeAreaInsets();
  const videoRef = useRef(null);

  // Animations
  const slideAnim = useRef(new Animated.Value(height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (showCaptionInput) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Keyboard.dismiss();
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, { toValue: height, useNativeDriver: true }),
      ]).start();
    }
  }, [showCaptionInput]);

  // Parse hashtags from caption
  useEffect(() => {
    const captionTags = caption.match(/#\w+/g) || [];
    const parsedTags = captionTags.map(tag => tag.slice(1).toLowerCase());
    // Merge with manually added tags (unique)
    const allTags = [...new Set([...hashtags.filter(t => !parsedTags.includes(t)), ...parsedTags])];
    if (JSON.stringify(allTags) !== JSON.stringify(hashtags)) {
      setHashtags(allTags);
    }
  }, [caption]);

  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Denied",
        "We need camera roll permissions to select videos."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 0.8,
      videoMaxDuration: 60,
    });

    if (!result.canceled) {
      setVideoUri(result.assets[0].uri);
      setVideoDuration(result.assets[0].duration || 0);
    }
  };

  const recordVideo = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Denied",
        "We need camera permissions to record videos."
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 0.8,
      videoMaxDuration: 60,
    });

    if (!result.canceled) {
      setVideoUri(result.assets[0].uri);
      setVideoDuration(result.assets[0].duration || 0);
    }
  };

  const handleNext = () => {
    setShowCaptionInput(true);
  };

  const addHashtag = (tag) => {
    const cleanTag = tag.replace(/^#/, '').toLowerCase().trim();
    if (cleanTag && !hashtags.includes(cleanTag)) {
      setHashtags([...hashtags, cleanTag]);
    }
    setHashtagInput("");
  };

  const removeHashtag = (tag) => {
    setHashtags(hashtags.filter(t => t !== tag));
  };

  const handleUpload = async () => {
    if (!videoUri) return;
    setUploading(true);

    try {
      const filename = videoUri.split("/").pop();
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `video/${match[1]}` : `video/mp4`;

      const formData = new FormData();
      formData.append("file", {
        uri: videoUri,
        name: filename,
        type: type,
      });
      formData.append("caption", caption);
      formData.append("hashtags", JSON.stringify(hashtags));

      // Add music metadata if selected
      if (selectedMusic) {
        formData.append("music", JSON.stringify({
          id: selectedMusic.id,
          title: selectedMusic.title,
          artist: selectedMusic.artist,
        }));
      }

      await api.post("/reels/create", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      Alert.alert("Success", "Your reel is being processed!", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to upload reel. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // --- EMPTY STATE ---
  if (!videoUri) {
    return (
      <View style={styles.emptyContainer}>
        <View style={[styles.emptyHeader, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerBtn}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.emptyHeaderTitle}>Create Reel</Text>
          <View style={styles.headerBtn} />
        </View>

        <View style={styles.emptyContent}>
          <View style={styles.iconCircle}>
            <Ionicons name="film" size={60} color="#FF3B5C" />
          </View>
          <Text style={styles.emptyTitle}>Create a Reel</Text>
          <Text style={styles.emptySubtitle}>
            Share a fun video with your followers
          </Text>

          <TouchableOpacity style={styles.primaryButton} onPress={recordVideo}>
            <Ionicons name="videocam" size={24} color="#fff" />
            <Text style={styles.primaryButtonText}>Record Video</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={pickVideo}>
            <Ionicons name="images" size={24} color="#FF3B5C" />
            <Text style={styles.secondaryButtonText}>Choose from Gallery</Text>
          </TouchableOpacity>

          <View style={styles.tipContainer}>
            <Ionicons
              name="information-circle-outline"
              size={20}
              color="#999"
            />
            <Text style={styles.tipText}>
              Videos can be up to 60 seconds long
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // --- PREVIEW STATE ---
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <Video
        ref={videoRef}
        style={styles.fullScreenVideo}
        source={{ uri: videoUri }}
        resizeMode={ResizeMode.COVER}
        isLooping
        shouldPlay={!showCaptionInput && isFocused && !showMusicPicker}
        isMuted={false}
      />

      {/* Overlay Controls */}
      <View style={[styles.overlay, { paddingTop: insets.top }]}>
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              if (showCaptionInput) {
                setShowCaptionInput(false);
              } else {
                setVideoUri(null);
                setCaption("");
                setSelectedMusic(null);
                setHashtags([]);
              }
            }}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={30} color="#fff" />
          </TouchableOpacity>

          {videoDuration > 0 && (
            <View style={styles.durationBadge}>
              <Ionicons name="time-outline" size={16} color="#fff" />
              <Text style={styles.durationText}>
                {formatDuration(videoDuration / 1000)}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.musicButton}
            onPress={() => setShowMusicPicker(true)}
          >
            <Ionicons name="musical-notes" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Selected Music Badge */}
        {selectedMusic && !showCaptionInput && (
          <View style={styles.musicBadge}>
            <Text style={styles.musicBadgeEmoji}>{selectedMusic.cover}</Text>
            <View style={styles.musicBadgeInfo}>
              <Text style={styles.musicBadgeTitle} numberOfLines={1}>
                {selectedMusic.title}
              </Text>
              <Text style={styles.musicBadgeArtist} numberOfLines={1}>
                {selectedMusic.artist}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedMusic(null)}>
              <Ionicons name="close-circle" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* Bottom Controls (Hidden when modal is open) */}
        {!showCaptionInput && (
          <View style={styles.bottomControls}>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => setVideoUri(null)}
            >
              <Ionicons name="refresh" size={24} color="#fff" />
              <Text style={styles.controlText}>Retake</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
              <Text style={styles.nextButtonText}>Next</Text>
              <Ionicons name="chevron-forward" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Caption Input Modal */}
      <Animated.View
        style={[
          styles.captionModal,
          {
            transform: [{ translateY: slideAnim }],
            opacity: fadeAnim,
          },
        ]}
      >
        <View style={styles.modalHandle} />

        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Add Details</Text>
          <TouchableOpacity onPress={() => setShowCaptionInput(false)}>
            <Ionicons name="close-circle" size={24} color="#ccc" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.modalContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Caption Input */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Caption</Text>
            <TextInput
              style={styles.captionInput}
              placeholder="Write a caption... use #hashtags"
              placeholderTextColor="#999"
              value={caption}
              onChangeText={setCaption}
              maxLength={2200}
              multiline
            />
            <Text style={styles.characterCount}>{caption.length}/2200</Text>
          </View>

          {/* Hashtags Section */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Hashtags</Text>

            {/* Selected Hashtags */}
            {hashtags.length > 0 && (
              <View style={styles.hashtagsContainer}>
                {hashtags.map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    style={styles.hashtagChip}
                    onPress={() => removeHashtag(tag)}
                  >
                    <Text style={styles.hashtagChipText}>#{tag}</Text>
                    <Ionicons name="close" size={14} color="#FF3B5C" />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Hashtag Input */}
            <View style={styles.hashtagInputContainer}>
              <Text style={styles.hashtagPrefix}>#</Text>
              <TextInput
                style={styles.hashtagInput}
                placeholder="Add hashtag"
                placeholderTextColor="#999"
                value={hashtagInput}
                onChangeText={setHashtagInput}
                onSubmitEditing={() => addHashtag(hashtagInput)}
                returnKeyType="done"
                autoCapitalize="none"
              />
              {hashtagInput.length > 0 && (
                <TouchableOpacity
                  style={styles.addHashtagBtn}
                  onPress={() => addHashtag(hashtagInput)}
                >
                  <Ionicons name="add-circle" size={24} color="#FF3B5C" />
                </TouchableOpacity>
              )}
            </View>

            {/* Trending Hashtags */}
            <Text style={styles.trendingLabel}>Trending</Text>
            <View style={styles.trendingContainer}>
              {TRENDING_HASHTAGS.filter(t => !hashtags.includes(t)).slice(0, 6).map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={styles.trendingChip}
                  onPress={() => addHashtag(tag)}
                >
                  <Text style={styles.trendingChipText}>#{tag}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Music Section */}
          <TouchableOpacity
            style={styles.optionRow}
            onPress={() => setShowMusicPicker(true)}
          >
            <View style={styles.optionLeft}>
              <Ionicons name="musical-notes-outline" size={24} color="#000" />
              <Text style={styles.optionText}>
                {selectedMusic ? selectedMusic.title : 'Add Music'}
              </Text>
            </View>
            {selectedMusic ? (
              <TouchableOpacity onPress={() => setSelectedMusic(null)}>
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            ) : (
              <Ionicons name="chevron-forward" size={20} color="#999" />
            )}
          </TouchableOpacity>

          {/* Options */}
          <TouchableOpacity style={styles.optionRow}>
            <View style={styles.optionLeft}>
              <Ionicons name="location-outline" size={24} color="#000" />
              <Text style={styles.optionText}>Add Location</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionRow}>
            <View style={styles.optionLeft}>
              <Ionicons name="person-add-outline" size={24} color="#000" />
              <Text style={styles.optionText}>Tag People</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          {/* Privacy */}
          <View style={styles.divider} />
          <View style={styles.settingsSection}>
            <Text style={styles.sectionTitle}>Privacy Settings</Text>
            <View style={styles.settingRow}>
              <Text style={styles.settingText}>Allow Comments</Text>
              <View style={styles.toggle}>
                <View style={styles.toggleActive} />
              </View>
            </View>
          </View>

          {/* Spacer for bottom safe area */}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Share Button */}
        <View
          style={[styles.modalFooter, { paddingBottom: insets.bottom + 10 }]}
        >
          <TouchableOpacity
            style={[
              styles.shareButton,
              uploading && styles.shareButtonDisabled,
            ]}
            onPress={handleUpload}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={[styles.shareButtonText, { marginLeft: 10 }]}>
                  Uploading...
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="paper-plane" size={20} color="#fff" />
                <Text style={[styles.shareButtonText, { marginLeft: 8 }]}>
                  Share Reel
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Music Picker Modal */}
      <MusicPicker
        visible={showMusicPicker}
        onClose={() => setShowMusicPicker(false)}
        onSelect={setSelectedMusic}
        selectedMusic={selectedMusic}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "black" },

  // Empty State
  emptyContainer: { flex: 1, backgroundColor: "#000" },
  emptyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  headerBtn: { width: 40 },
  emptyHeaderTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  emptyContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255, 59, 92, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 30,
  },
  emptyTitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 12,
  },
  emptySubtitle: {
    color: "#999",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 40,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF3B5C",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    width: "100%",
    marginBottom: 16,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginLeft: 10,
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "#FF3B5C",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    width: "100%",
    marginBottom: 24,
  },
  secondaryButtonText: {
    color: "#FF3B5C",
    fontSize: 16,
    fontWeight: "700",
    marginLeft: 10,
  },
  tipContainer: { flexDirection: "row", alignItems: "center", gap: 8 },
  tipText: { color: "#999", fontSize: 14 },

  // Video Preview
  fullScreenVideo: { width, height: height, position: "absolute" },
  overlay: { flex: 1, justifyContent: "space-between" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  durationBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  durationText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  musicButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  musicBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    marginHorizontal: 20,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  musicBadgeEmoji: { fontSize: 20 },
  musicBadgeInfo: { flex: 1 },
  musicBadgeTitle: { color: "#fff", fontSize: 13, fontWeight: "600" },
  musicBadgeArtist: { color: "#ccc", fontSize: 11 },
  bottomControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  controlButton: { alignItems: "center" },
  controlText: { color: "#fff", fontSize: 14, marginTop: 8, fontWeight: "600" },
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF3B5C",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 30,
    gap: 8,
  },
  nextButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  // Caption Modal
  captionModal: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.75,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    zIndex: 100,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#ddd",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 10,
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#000" },
  modalContent: { flex: 1, paddingHorizontal: 20 },
  inputSection: { paddingTop: 20, marginBottom: 10 },
  inputLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 10,
  },
  captionInput: {
    fontSize: 16,
    color: "#000",
    minHeight: 80,
    maxHeight: 120,
    textAlignVertical: "top",
    paddingVertical: 10,
  },
  characterCount: {
    fontSize: 12,
    color: "#999",
    textAlign: "right",
    marginTop: 5,
  },

  // Hashtags
  hashtagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  hashtagChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 59, 92, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  hashtagChipText: {
    color: "#FF3B5C",
    fontSize: 14,
    fontWeight: "600",
  },
  hashtagInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  hashtagPrefix: {
    fontSize: 16,
    color: "#999",
    fontWeight: "600",
  },
  hashtagInput: {
    flex: 1,
    fontSize: 16,
    color: "#000",
    marginLeft: 4,
  },
  addHashtagBtn: {
    padding: 4,
  },
  trendingLabel: {
    fontSize: 13,
    color: "#666",
    marginTop: 12,
    marginBottom: 8,
  },
  trendingContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  trendingChip: {
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  trendingChipText: {
    color: "#666",
    fontSize: 13,
  },

  optionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  optionLeft: { flexDirection: "row", alignItems: "center", gap: 16 },
  optionText: { fontSize: 16, color: "#000" },
  divider: {
    height: 8,
    backgroundColor: "#f5f5f5",
    marginVertical: 20,
    marginHorizontal: -20,
  },
  settingsSection: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  settingText: { fontSize: 16, color: "#000" },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#FF3B5C",
    padding: 2,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  toggleActive: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#fff",
  },

  modalFooter: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    backgroundColor: "#fff",
  },
  shareButton: {
    flexDirection: "row",
    backgroundColor: "#FF3B5C",
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  shareButtonDisabled: { opacity: 0.7 },
  shareButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});

export default CreateReelScreen;
