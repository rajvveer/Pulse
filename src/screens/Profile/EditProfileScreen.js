import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  Dimensions,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import * as ImagePicker from 'expo-image-picker'; // ✅ Import ImagePicker
import { setUser } from '../../redux/slices/authSlice';
import { useTheme } from '../../contexts/ThemeContext';
import { getTheme } from '../../styles/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import api from '../../services/api';

const { width } = Dimensions.get('window');

const EditProfileScreen = ({ navigation }) => {
  const { user } = useSelector(state => state.auth);
  const dispatch = useDispatch();
  const { isDark } = useTheme();
  const theme = getTheme(isDark);

  const [formData, setFormData] = useState({
    'profile.displayName': user?.profile?.displayName || user?.name || '',
    'profile.bio': user?.profile?.bio || '',
    'profile.location': user?.profile?.location || '',
    'profile.website': user?.profile?.website || '',
  });

  // Images state
  const [avatarUri, setAvatarUri] = useState(user?.profile?.avatar || user?.avatar);
  const [coverUri, setCoverUri] = useState(user?.profile?.coverPhoto || 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&q=80');
  
  const [saving, setSaving] = useState(false);

  // --- IMAGE PICKER LOGIC ---
  const pickImage = async (type) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission needed', 'We need access to your photos.');

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: type === 'avatar' ? [1, 1] : [16, 9],
      quality: 0.8,
    });

    if (!result.canceled) {
      if (type === 'avatar') setAvatarUri(result.assets[0].uri);
      else setCoverUri(result.assets[0].uri);
    }
  };

  // --- UPLOAD HELPER ---
  const uploadFile = async (uri) => {
    const formData = new FormData();
    formData.append('file', {
      uri,
      name: `upload_${Date.now()}.jpg`,
      type: 'image/jpeg',
    });
    const res = await api.post('/media/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    return res.data.data.url;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let finalAvatar = avatarUri;
      let finalCover = coverUri;

      // 1. Upload images if changed (local URI starts with file://)
      if (avatarUri && avatarUri.startsWith('file')) {
        finalAvatar = await uploadFile(avatarUri);
      }
      if (coverUri && coverUri.startsWith('file')) {
        finalCover = await uploadFile(coverUri);
      }

      // 2. Prepare payload
      const payload = {
        ...formData,
        'profile.avatar': finalAvatar,
        'profile.coverPhoto': finalCover,
      };

      // 3. Update Profile
      const response = await api.patch('/users/me', payload);
      
      if (response.data.success) {
        dispatch(setUser(response.data.data));
        Alert.alert('Success', 'Profile updated!');
        navigation.goBack();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      
      {/* Custom Header */}
      <View style={[styles.header, { backgroundColor: 'transparent', zIndex: 10 }]}>
        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: 'rgba(0,0,0,0.5)' }]} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: '#FFF', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 5 }]}>Edit Profile</Text>
        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: theme.colors.primary }]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="checkmark" size={24} color="#FFF" />}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false}>
          
          {/* 1. Cover Photo Area */}
          <TouchableOpacity onPress={() => pickImage('cover')} activeOpacity={0.9}>
            <View style={styles.coverContainer}>
              <Image source={{ uri: coverUri }} style={styles.coverImage} resizeMode="cover" />
              <View style={styles.cameraBadgeCenter}>
                <Ionicons name="camera" size={20} color="#FFF" />
                <Text style={styles.cameraText}>Edit Cover</Text>
              </View>
              <View style={styles.overlay} />
            </View>
          </TouchableOpacity>

          {/* 2. Avatar Area */}
          <View style={styles.avatarWrapper}>
            <TouchableOpacity onPress={() => pickImage('avatar')} activeOpacity={0.9}>
              <View style={[styles.avatarContainer, { borderColor: theme.colors.background }]}>
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                <View style={styles.avatarEditBadge}>
                  <Ionicons name="camera" size={14} color="#FFF" />
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* 3. Form Fields */}
          <View style={styles.formContainer}>
            
            {/* Display Name */}
            <View style={[styles.inputGroup, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Display Name</Text>
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                value={formData['profile.displayName']}
                onChangeText={t => setFormData({ ...formData, 'profile.displayName': t })}
                placeholder="Name"
                placeholderTextColor={theme.colors.textSecondary}
              />
            </View>

            {/* Bio */}
            <View style={[styles.inputGroup, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Bio</Text>
              <TextInput
                style={[styles.input, { color: theme.colors.text, minHeight: 80 }]}
                value={formData['profile.bio']}
                onChangeText={t => setFormData({ ...formData, 'profile.bio': t })}
                placeholder="Tell the world about yourself..."
                placeholderTextColor={theme.colors.textSecondary}
                multiline
                maxLength={150}
              />
              <Text style={[styles.charCount, { color: theme.colors.textSecondary }]}>
                {formData['profile.bio'].length}/150
              </Text>
            </View>

            {/* Location */}
            <View style={[styles.inputGroup, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Location</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="location-outline" size={18} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.input, { color: theme.colors.text, flex: 1 }]}
                  value={formData['profile.location']}
                  onChangeText={t => setFormData({ ...formData, 'profile.location': t })}
                  placeholder="City, Country"
                  placeholderTextColor={theme.colors.textSecondary}
                />
              </View>
            </View>

            {/* Website */}
            <View style={[styles.inputGroup, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Website</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="link-outline" size={18} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.input, { color: theme.colors.text, flex: 1 }]}
                  value={formData['profile.website']}
                  onChangeText={t => setFormData({ ...formData, 'profile.website': t })}
                  placeholder="https://your-site.com"
                  placeholderTextColor={theme.colors.textSecondary}
                  autoCapitalize="none"
                />
              </View>
            </View>

          </View>
          
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 10,
    paddingBottom: 10,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverContainer: { height: 200, width: '100%', position: 'relative' },
  coverImage: { width: '100%', height: '100%' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
  cameraBadgeCenter: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -50 }, { translateY: -50 }],
    alignItems: 'center',
    zIndex: 2,
  },
  cameraText: { color: '#FFF', fontWeight: '600', marginTop: 4, fontSize: 12 },
  avatarWrapper: { alignItems: 'center', marginTop: -50 },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    position: 'relative',
  },
  avatarImage: { width: '100%', height: '100%', borderRadius: 50 },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#007AFF',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  formContainer: { padding: 16, marginTop: 10 },
  inputGroup: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { fontSize: 16, padding: 0 },
  charCount: { textAlign: 'right', fontSize: 11, marginTop: 8 },
});

export default EditProfileScreen;