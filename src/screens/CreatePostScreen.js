import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Dimensions,
  Animated,
  Vibration,
  Keyboard
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';
import { getTheme } from '../styles/theme';
import api from '../services/api';
import { useSelector } from 'react-redux'; // To get current user avatar

const { width } = Dimensions.get('window');
const MAX_IMAGES = 4; // Modern apps usually limit to 4 for grids
const MAX_TEXT_LENGTH = 2000;

const CreatePostScreen = ({ navigation }) => {
  const { isDark } = useTheme();
  const theme = getTheme(isDark);
  const { user } = useSelector(state => state.auth); // Get logged in user

  // State
  const [text, setText] = useState('');
  const [images, setImages] = useState([]);
  const [location, setLocation] = useState(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPoll, setShowPoll] = useState(false); // New Feature
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    const kbdShow = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const kbdHide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));

    return () => {
      kbdShow.remove();
      kbdHide.remove();
    };
  }, []);

  // --- LOGIC HANDLERS ---

  const triggerHaptic = () => {
    // Simple vibration for feedback
    Vibration.vibrate(10); 
  };

  const handleBack = () => {
    if (text.length > 0 || images.length > 0) {
      Alert.alert(
        'Save Draft?',
        'You have unsaved changes. Do you want to save this as a draft?',
        [
          { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
          { text: 'Save Draft', onPress: () => { 
             // Logic to save to AsyncStorage would go here
             navigation.goBack(); 
          }},
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  const takePhoto = useCallback(async () => {
    triggerHaptic();
    if (images.length >= MAX_IMAGES) return Alert.alert('Limit Reached', `Max ${MAX_IMAGES} photos.`);
    
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission Denied', 'Camera access needed.');

    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });
    if (!result.canceled) {
      setImages(prev => [...prev, result.assets[0]]);
    }
  }, [images.length]);

  const pickImages = useCallback(async () => {
    triggerHaptic();
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) return Alert.alert('Limit Reached', `Max ${MAX_IMAGES} photos.`);

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission Denied', 'Gallery access needed.');

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.8,
    });

    if (!result.canceled) {
      setImages(prev => [...prev, ...result.assets].slice(0, MAX_IMAGES));
    }
  }, [images.length]);

  const toggleLocation = useCallback(async () => {
    triggerHaptic();
    if (location) {
      setLocation(null);
      return;
    }
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission Denied', 'Location needed.');

    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation({ type: 'Point', coordinates: [pos.coords.longitude, pos.coords.latitude] });
    } catch {
      Alert.alert('Error', 'Could not fetch location.');
    }
  }, [location]);

  // Enhanced Anonymous Toggle
  const toggleAnonymous = useCallback(() => {
    triggerHaptic();
    setIsAnonymous(prev => !prev);
  }, []);

  const uploadImage = async (uri) => {
    const formData = new FormData();
    formData.append('file', {
      uri,
      name: `upload_${Date.now()}.jpg`,
      type: 'image/jpeg',
    });
    const res = await api.post('/media/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    return res.data.data;
  };

  const handlePost = async () => {
    triggerHaptic();
    if (!text.trim() && images.length === 0) return;

    setLoading(true);
    try {
      let media = [];
      if (images.length > 0) {
        const uploadPromises = images.map(img => uploadImage(img.uri));
        const uploaded = await Promise.all(uploadPromises);
        media = uploaded.map(u => ({ type: 'image', url: u.url, width: u.width, height: u.height }));
      }

      await api.post('/posts', {
        text: text.trim(),
        media,
        location,
        isAnonymous,
        // poll: showPoll ? pollData : null (Backend implementation needed)
      });

      // Success Sound or Haptic could go here
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to post. Try again.');
    } finally {
      setLoading(false);
    }
  };

  // --- RENDER HELPERS ---

  const canPost = (text.trim().length > 0 || images.length > 0) && !loading;

  const renderImageItem = ({ item, index }) => (
    <View style={styles.mediaCard}>
      <Image source={{ uri: item.uri }} style={styles.mediaImage} resizeMode="cover" />
      <TouchableOpacity 
        style={styles.removeMediaBtn} 
        onPress={() => setImages(prev => prev.filter((_, i) => i !== index))}
      >
        <Ionicons name="close" size={14} color="#FFF" />
      </TouchableOpacity>
    </View>
  );

  // Mock Avatar Initials
  const avatarUrl = user?.profile?.avatar || user?.avatar;
  const initial = (user?.username || '?').charAt(0).toUpperCase();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      
      {/* 1. Header: Clean & Functional */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={handleBack} style={styles.cancelBtn}>
          <Text style={[styles.cancelText, { color: theme.colors.text }]}>Cancel</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.postBtn, { backgroundColor: canPost ? theme.colors.primary : theme.colors.border }]}
          disabled={!canPost}
          onPress={handlePost}
        >
          {loading ? <ActivityIndicator size="small" color="#FFF" /> : (
            <Text style={[styles.postBtnText, { color: canPost ? '#FFF' : theme.colors.textSecondary }]}>Post</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          style={styles.scrollContainer} 
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          
          {/* 2. User Identity Switcher (New Feature) */}
          <Animated.View style={[styles.identityRow, { opacity: fadeAnim }]}>
            <View style={styles.avatarContainer}>
              {isAnonymous ? (
                <View style={[styles.avatar, { backgroundColor: '#333' }]}>
                  <Ionicons name="eye-off" size={20} color="#FFF" />
                </View>
              ) : (
                avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
                    <Text style={styles.avatarInitial}>{initial}</Text>
                  </View>
                )
              )}
            </View>
            
            <TouchableOpacity onPress={toggleAnonymous} style={styles.identitySelector}>
              <Text style={[styles.identityName, { color: theme.colors.text }]}>
                {isAnonymous ? 'Anonymous' : (user?.username || 'You')}
              </Text>
              <View style={[styles.privacyBadge, { borderColor: theme.colors.border }]}>
                 <Text style={[styles.privacyText, { color: theme.colors.textSecondary }]}>
                   {isAnonymous ? 'Hidden Identity' : 'Public'}
                 </Text>
                 <Ionicons name="chevron-down" size={12} color={theme.colors.textSecondary} />
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* 3. Modern Text Input */}
          <TextInput
            style={[styles.input, { color: theme.colors.text }]}
            placeholder={isAnonymous ? "What's the secret?..." : "What's happening?"}
            placeholderTextColor={theme.colors.textSecondary}
            multiline
            autoFocus
            scrollEnabled={false} // Allow ScrollView to handle scrolling
            value={text}
            onChangeText={setText}
            maxLength={MAX_TEXT_LENGTH}
          />

          {/* 4. Poll Creator (New Feature UI) */}
          {showPoll && (
            <View style={[styles.pollContainer, { borderColor: theme.colors.border }]}>
               <View style={styles.pollOption}>
                 <TextInput placeholder="Option 1" placeholderTextColor={theme.colors.textSecondary} style={[styles.pollInput, {color: theme.colors.text}]} />
               </View>
               <View style={[styles.pollOption, { marginTop: 8 }]}>
                 <TextInput placeholder="Option 2" placeholderTextColor={theme.colors.textSecondary} style={[styles.pollInput, {color: theme.colors.text}]} />
               </View>
               <TouchableOpacity onPress={() => setShowPoll(false)} style={styles.removePollBtn}>
                 <Text style={{color: theme.colors.error, fontSize: 12}}>Remove Poll</Text>
               </TouchableOpacity>
            </View>
          )}

          {/* 5. Media Carousel */}
          {images.length > 0 && (
            <FlatList
              data={images}
              horizontal
              keyExtractor={(_, i) => i.toString()}
              renderItem={renderImageItem}
              style={styles.mediaList}
              contentContainerStyle={{ paddingRight: 20 }}
              showsHorizontalScrollIndicator={false}
            />
          )}

          {/* 6. Chips (Location/Tags) */}
          <View style={styles.chipContainer}>
            {location && (
              <View style={[styles.chip, { backgroundColor: theme.colors.primary + '15' }]}>
                <Ionicons name="location" size={14} color={theme.colors.primary} />
                <Text style={[styles.chipText, { color: theme.colors.primary }]}>Location Active</Text>
                <TouchableOpacity onPress={toggleLocation}>
                  <Ionicons name="close" size={14} color={theme.colors.primary} />
                </TouchableOpacity>
              </View>
            )}
            {text.length > MAX_TEXT_LENGTH * 0.9 && (
               <Text style={[styles.charCount, { color: 'orange' }]}>{MAX_TEXT_LENGTH - text.length} left</Text>
            )}
          </View>

          {/* Spacer for bottom toolbar */}
          <View style={{ height: 80 }} /> 
        </ScrollView>

        {/* 7. Modern Sticky Toolbar (Moves with Keyboard) */}
        <View style={[styles.toolbar, { 
          backgroundColor: theme.colors.surface, 
          borderTopColor: theme.colors.border,
        }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolbarScroll}>
            <TouchableOpacity style={styles.toolBtn} onPress={pickImages}>
              <Ionicons name="images-outline" size={24} color={theme.colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolBtn} onPress={takePhoto}>
              <Ionicons name="camera-outline" size={24} color={theme.colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolBtn} onPress={() => setShowPoll(!showPoll)}>
              <Ionicons name="stats-chart-outline" size={24} color={showPoll ? theme.colors.primary : theme.colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolBtn} onPress={toggleLocation}>
              <Ionicons name={location ? "location" : "location-outline"} size={24} color={location ? theme.colors.success : theme.colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolBtn} onPress={() => setText(prev => prev + " #")}>
              <Ionicons name="pricetag-outline" size={24} color={theme.colors.textSecondary} />
            </TouchableOpacity>

            <View style={styles.toolDivider} />

            <TouchableOpacity style={styles.toolBtn} onPress={toggleAnonymous}>
              <Ionicons name={isAnonymous ? "eye-off" : "eye-outline"} size={24} color={isAnonymous ? '#9C27B0' : theme.colors.textSecondary} />
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  cancelText: {
    fontSize: 16,
  },
  postBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  postBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 12,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  identitySelector: {
    justifyContent: 'center',
  },
  identityName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  privacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
    gap: 4,
  },
  privacyText: {
    fontSize: 12,
    fontWeight: '500',
  },
  input: {
    fontSize: 18,
    lineHeight: 26,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  mediaList: {
    marginBottom: 20,
  },
  mediaCard: {
    width: 140,
    height: 180,
    borderRadius: 12,
    marginRight: 10,
    position: 'relative',
    overflow: 'hidden',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  removeMediaBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  pollContainer: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderStyle: 'dashed',
  },
  pollInput: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 8,
    fontSize: 15,
  },
  removePollBtn: {
    marginTop: 10,
    alignSelf: 'flex-end',
  },
  toolbar: {
    paddingVertical: 12,
    borderTopWidth: 0.5,
    paddingBottom: Platform.OS === 'ios' ? 20 : 12, // Extra padding for iPhone home indicator
  },
  toolbarScroll: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  toolBtn: {
    padding: 10,
    marginRight: 15,
  },
  toolDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#ccc',
    marginHorizontal: 10,
  },
});

export default CreatePostScreen;