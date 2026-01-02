import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, Dimensions, KeyboardAvoidingView, Platform, Animated, ScrollView } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../services/api';

const { width, height } = Dimensions.get('window');

const CreateReelScreen = ({ navigation }) => {
  const [videoUri, setVideoUri] = useState(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showCaptionInput, setShowCaptionInput] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const insets = useSafeAreaInsets();
  const videoRef = useRef(null);
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
    }
  }, [showCaptionInput]);

  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need camera roll permissions to select videos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 1,
      videoMaxDuration: 90, // 90 seconds limit
    });

    if (!result.canceled) {
      setVideoUri(result.assets[0].uri);
      setVideoDuration(result.assets[0].duration || 0);
    }
  };

  const recordVideo = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need camera permissions to record videos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 1,
      videoMaxDuration: 90,
    });

    if (!result.canceled) {
      setVideoUri(result.assets[0].uri);
      setVideoDuration(result.assets[0].duration || 0);
    }
  };

  const handleNext = () => {
    setShowCaptionInput(true);
  };

  const handleUpload = async () => {
    if (!videoUri) return;
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', {
        uri: videoUri,
        type: 'video/mp4',
        name: `reel_${Date.now()}.mp4`,
      });
      formData.append('caption', caption);

      await api.post('/reels/create', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      Alert.alert('Success', 'Your reel has been shared!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to upload reel. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Empty State - Video Selection
  if (!videoUri) {
    return (
      <View style={styles.emptyContainer}>
        {/* Header */}
        <View style={[styles.emptyHeader, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.emptyHeaderTitle}>Create Reel</Text>
          <View style={styles.headerBtn} />
        </View>

        {/* Main Content */}
        <View style={styles.emptyContent}>
          <View style={styles.iconCircle}>
            <Ionicons name="film" size={60} color="#FF3B5C" />
          </View>
          <Text style={styles.emptyTitle}>Create a Reel</Text>
          <Text style={styles.emptySubtitle}>
            Share a fun video with your followers
          </Text>

          {/* Action Buttons */}
          <TouchableOpacity style={styles.primaryButton} onPress={recordVideo}>
            <Ionicons name="videocam" size={24} color="#fff" />
            <Text style={styles.primaryButtonText}>Record Video</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={pickVideo}>
            <Ionicons name="images" size={24} color="#FF3B5C" />
            <Text style={styles.secondaryButtonText}>Choose from Gallery</Text>
          </TouchableOpacity>

          <View style={styles.tipContainer}>
            <Ionicons name="information-circle-outline" size={20} color="#999" />
            <Text style={styles.tipText}>Videos can be up to 90 seconds long</Text>
          </View>
        </View>
      </View>
    );
  }

  // Video Preview State
  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <Video
        ref={videoRef}
        style={styles.fullScreenVideo}
        source={{ uri: videoUri }}
        resizeMode={ResizeMode.COVER}
        isLooping
        shouldPlay
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
                setCaption('');
              }
            }}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={30} color="#fff" />
          </TouchableOpacity>

          {videoDuration > 0 && (
            <View style={styles.durationBadge}>
              <Ionicons name="time-outline" size={16} color="#fff" />
              <Text style={styles.durationText}>{formatDuration(videoDuration / 1000)}</Text>
            </View>
          )}

          <TouchableOpacity style={styles.musicButton}>
            <Ionicons name="musical-notes" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Bottom Controls */}
        {!showCaptionInput ? (
          <View style={styles.bottomControls}>
            <TouchableOpacity style={styles.controlButton} onPress={() => setVideoUri(null)}>
              <Ionicons name="refresh" size={24} color="#fff" />
              <Text style={styles.controlText}>Retake</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
              <Text style={styles.nextButtonText}>Next</Text>
              <Ionicons name="chevron-forward" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {/* Caption Input Modal */}
      {showCaptionInput && (
        <Animated.View 
          style={[
            styles.captionModal,
            { 
              transform: [{ translateY: slideAnim }],
              opacity: fadeAnim,
            }
          ]}
        >
          <View style={styles.modalHandle} />
          
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Details</Text>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Caption Input */}
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Caption</Text>
              <TextInput
                style={styles.captionInput}
                placeholder="Write a caption..."
                placeholderTextColor="#999"
                value={caption}
                onChangeText={setCaption}
                maxLength={2200}
                multiline
                autoFocus
              />
              <Text style={styles.characterCount}>{caption.length}/2200</Text>
            </View>

            {/* Additional Options */}
            <TouchableOpacity style={styles.optionRow}>
              <View style={styles.optionLeft}>
                <Ionicons name="location-outline" size={24} color="#000" />
                <Text style={styles.optionText}>Add Location</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionRow}>
              <View style={styles.optionLeft}>
                <Ionicons name="pricetag-outline" size={24} color="#000" />
                <Text style={styles.optionText}>Tag People</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionRow}>
              <View style={styles.optionLeft}>
                <Ionicons name="musical-notes-outline" size={24} color="#000" />
                <Text style={styles.optionText}>Add Music</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>

            {/* Privacy Settings */}
            <View style={styles.divider} />
            
            <View style={styles.settingsSection}>
              <Text style={styles.sectionTitle}>Privacy Settings</Text>
              
              <View style={styles.settingRow}>
                <Text style={styles.settingText}>Allow Comments</Text>
                <View style={styles.toggle}>
                  <View style={styles.toggleActive} />
                </View>
              </View>

              <View style={styles.settingRow}>
                <Text style={styles.settingText}>Allow Sharing</Text>
                <View style={styles.toggle}>
                  <View style={styles.toggleActive} />
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Share Button */}
          <View style={[styles.modalFooter, { paddingBottom: insets.bottom + 10 }]}>
            <TouchableOpacity 
              style={[styles.shareButton, uploading && styles.shareButtonDisabled]} 
              onPress={handleUpload}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={[styles.shareButtonText, { marginLeft: 10 }]}>Uploading...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="paper-plane" size={20} color="#fff" />
                  <Text style={[styles.shareButtonText, { marginLeft: 8 }]}>Share Reel</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  
  // Empty State
  emptyContainer: { flex: 1, backgroundColor: '#000' },
  emptyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  headerBtn: { width: 40 },
  emptyHeaderTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 59, 92, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
  },
  emptySubtitle: {
    color: '#999',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
  },
  
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF3B5C',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    width: '100%',
    marginBottom: 16,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 10,
  },
  
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#FF3B5C',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    width: '100%',
    marginBottom: 24,
  },
  secondaryButtonText: {
    color: '#FF3B5C',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 10,
  },
  
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tipText: {
    color: '#999',
    fontSize: 14,
  },
  
  // Video Preview
  fullScreenVideo: { 
    width, 
    height: height, 
    position: 'absolute' 
  },
  overlay: { 
    flex: 1, 
    justifyContent: 'space-between',
  },
  
  header: { 
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20, 
    paddingTop: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  durationText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  
  musicButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  controlButton: {
    alignItems: 'center',
  },
  controlText: {
    color: '#fff',
    fontSize: 14,
    marginTop: 8,
    fontWeight: '600',
  },
  
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF3B5C',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 30,
    gap: 8,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  
  // Caption Modal
  captionModal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.75,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  
  inputSection: {
    paddingTop: 20,
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 10,
  },
  captionInput: {
    fontSize: 16,
    color: '#000',
    minHeight: 100,
    maxHeight: 150,
    textAlignVertical: 'top',
    paddingVertical: 10,
  },
  characterCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 5,
  },
  
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  optionText: {
    fontSize: 16,
    color: '#000',
  },
  
  divider: {
    height: 8,
    backgroundColor: '#f5f5f5',
    marginVertical: 20,
    marginHorizontal: -20,
  },
  
  settingsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingText: {
    fontSize: 16,
    color: '#000',
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FF3B5C',
    padding: 2,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  toggleActive: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
  },
  
  modalFooter: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  shareButton: {
    flexDirection: 'row',
    backgroundColor: '#FF3B5C',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButtonDisabled: {
    opacity: 0.7,
  },
  shareButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});

export default CreateReelScreen;