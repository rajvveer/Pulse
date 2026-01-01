import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
  ActivityIndicator,
  Image,
  Dimensions,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

// ✅ FIXED IMPORTS (Added ../ to go up one more level)
import { useTheme } from '../../contexts/ThemeContext';
import { getTheme } from '../../styles/theme';
import api from '../../services/api';

const { width } = Dimensions.get('window');

const EditPostScreen = ({ route, navigation }) => {
  // Safe destructuring in case params are missing
  const { post } = route.params || {}; 
  const { isDark } = useTheme();
  const theme = getTheme(isDark);

  if (!post) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.text, padding: 20 }}>Error: No post data found.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 20 }}>
           <Text style={{ color: theme.colors.primary }}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const [text, setText] = useState(post.content?.text || '');
  const [commentsDisabled, setCommentsDisabled] = useState(post.settings?.commentsDisabled || false);
  const [isArchived, setIsArchived] = useState(post.isArchived || false);
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      await api.patch(`/posts/${post._id}`, {
        text,
        settings: { commentsDisabled },
        isArchived
      });
      Alert.alert('Updated', 'Your post has been updated successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to update post.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Post?',
      'This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            try {
              setLoading(true);
              await api.delete(`/posts/${post._id}`);
              navigation.popToTop(); // Go back to feed/profile
            } catch (error) {
              Alert.alert('Error', 'Failed to delete post.');
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const firstImage = post.content?.media?.[0]?.url;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={{ fontSize: 16, color: theme.colors.text }}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Edit Info</Text>
          <TouchableOpacity onPress={handleUpdate} disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Text style={{ fontSize: 16, color: theme.colors.primary, fontWeight: '600' }}>Done</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Post Preview & Caption */}
          <View style={styles.previewContainer}>
            {firstImage && (
              <Image source={{ uri: firstImage }} style={styles.previewImage} />
            )}
            <TextInput
              style={[styles.input, { color: theme.colors.text }]}
              multiline
              value={text}
              onChangeText={setText}
              placeholder="Write a caption..."
              placeholderTextColor={theme.colors.textSecondary}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

          {/* Advanced Settings */}
          <View style={styles.settingsContainer}>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Turn off commenting</Text>
                <Text style={[styles.settingSub, { color: theme.colors.textSecondary }]}>
                  People won't be able to comment on this post.
                </Text>
              </View>
              <Switch 
                value={commentsDisabled} 
                onValueChange={setCommentsDisabled}
                trackColor={{ false: '#767577', true: theme.colors.primary }}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Archive Post</Text>
                <Text style={[styles.settingSub, { color: theme.colors.textSecondary }]}>
                  Hide from profile without deleting.
                </Text>
              </View>
              <Switch 
                value={isArchived} 
                onValueChange={setIsArchived}
                trackColor={{ false: '#767577', true: theme.colors.primary }}
              />
            </View>
          </View>

          <View style={{ flex: 1 }} />

          {/* Delete Button */}
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
            <Text style={styles.deleteText}>Delete Post</Text>
          </TouchableOpacity>

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 0.5,
  },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  content: { flex: 1, padding: 20 },
  previewContainer: { flexDirection: 'row', marginBottom: 20 },
  previewImage: { width: 80, height: 80, borderRadius: 8, marginRight: 12 },
  input: { flex: 1, fontSize: 16, textAlignVertical: 'top', paddingTop: 8 },
  divider: { height: 1, width: '100%', marginBottom: 20 },
  settingsContainer: { gap: 24 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingLabel: { fontSize: 16, fontWeight: '500', marginBottom: 4 },
  settingSub: { fontSize: 12, paddingRight: 10 },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    marginBottom: 20,
  },
  deleteText: { color: '#FF3B30', fontSize: 16, fontWeight: '600', marginLeft: 8 },
});

export default EditPostScreen;