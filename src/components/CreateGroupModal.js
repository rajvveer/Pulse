import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../contexts/ThemeContext';
import { getTheme } from '../styles/theme';
import api from '../services/api';

const { width } = Dimensions.get('window');

const CreateGroupModal = ({ visible, onClose, onGroupCreated }) => {
  const { isDark } = useTheme();
  const theme = getTheme(isDark);

  const [step, setStep] = useState(1);
  const [groupName, setGroupName] = useState('');
  const [groupAvatar, setGroupAvatar] = useState(null);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);

  const searchUsers = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const res = await api.get(`/users/search?q=${query}`);
      if (res.data.success) {
        setSearchResults(res.data.data);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleUser = (user) => {
    if (selectedUsers.find(u => u._id === user._id)) {
      setSelectedUsers(selectedUsers.filter(u => u._id !== user._id));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const pickGroupAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      setUploading(true);

      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        type: 'image/jpeg',
        name: 'group.jpg'
      });

      try {
        const res = await api.post('/media/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (res.data.success) {
          setGroupAvatar(res.data.data.url);
        }
      } catch (err) {
        console.error("Upload failed", err);
        Alert.alert('Error', 'Failed to upload image');
      } finally {
        setUploading(false);
      }
    }
  };

  const createGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    if (selectedUsers.length < 2) {
      Alert.alert('Error', 'Select at least 2 members');
      return;
    }

    setCreating(true);
    try {
      const res = await api.post('/groups', {
        groupName: groupName.trim(),
        participants: selectedUsers.map(u => u._id),
        groupAvatar: groupAvatar
      });

      if (res.data.success) {
        onGroupCreated(res.data.data);
        handleClose();
      }
    } catch (error) {
      console.error('Create group error:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setGroupName('');
    setGroupAvatar(null);
    setSelectedUsers([]);
    setSearchQuery('');
    setSearchResults([]);
    onClose();
  };

  const renderUserItem = ({ item }) => {
    const isSelected = selectedUsers.find(u => u._id === item._id);
    
    return (
      <TouchableOpacity
        style={[styles.userItem, { backgroundColor: theme.colors.background }]}
        onPress={() => toggleUser(item)}
      >
        <Image
          source={{ uri: item.profile?.avatar || item.avatar || 'https://via.placeholder.com/40' }}
          style={styles.userAvatar}
        />
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: theme.colors.text }]}>
            {item.username}
          </Text>
          {item.name && (
            <Text style={[styles.userFullName, { color: theme.colors.textSecondary }]}>
              {item.name}
            </Text>
          )}
        </View>
        <View style={[
          styles.checkbox,
          { borderColor: theme.colors.border },
          isSelected && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
        ]}>
          {isSelected && <Ionicons name="checkmark" size={16} color="#FFF" />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={handleClose}>
            <Ionicons name="close" size={28} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            {step === 1 ? 'Add Members' : 'New Group'}
          </Text>
          {step === 1 ? (
            <TouchableOpacity
              onPress={() => selectedUsers.length >= 2 && setStep(2)}
              disabled={selectedUsers.length < 2}
            >
              <Text style={[
                styles.nextBtn,
                { color: selectedUsers.length >= 2 ? theme.colors.primary : theme.colors.textSecondary }
              ]}>
                Next
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={createGroup} disabled={creating}>
              {creating ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <Text style={[styles.nextBtn, { color: theme.colors.primary }]}>
                  Create
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {step === 1 ? (
          <>
            {/* Selected Count */}
            {selectedUsers.length > 0 && (
              <View style={styles.selectedCount}>
                <Text style={[styles.countText, { color: theme.colors.text }]}>
                  {selectedUsers.length} selected
                </Text>
              </View>
            )}

            {/* Selected Users Chips */}
            {selectedUsers.length > 0 && (
              <View style={styles.selectedContainer}>
                <FlatList
                  horizontal
                  data={selectedUsers}
                  keyExtractor={(item) => item._id}
                  renderItem={({ item }) => (
                    <View style={[styles.selectedChip, { backgroundColor: isDark ? '#262626' : '#F0F0F0' }]}>
                      <Image
                        source={{ uri: item.profile?.avatar || item.avatar || 'https://via.placeholder.com/24' }}
                        style={styles.chipAvatar}
                      />
                      <Text style={[styles.chipText, { color: theme.colors.text }]} numberOfLines={1}>
                        {item.username}
                      </Text>
                      <TouchableOpacity onPress={() => toggleUser(item)}>
                        <Ionicons name="close-circle" size={18} color={theme.colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  )}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsList}
                />
              </View>
            )}

            {/* Search */}
            <View style={[styles.searchContainer, { backgroundColor: isDark ? '#262626' : '#F0F0F0' }]}>
              <Ionicons name="search" size={20} color={theme.colors.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: theme.colors.text }]}
                placeholder="Search users..."
                placeholderTextColor={theme.colors.textSecondary}
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  searchUsers(text);
                }}
              />
            </View>

            {/* User List */}
            {loading ? (
              <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 50 }} />
            ) : (
              <FlatList
                data={searchResults}
                renderItem={renderUserItem}
                keyExtractor={(item) => item._id}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Ionicons name="people-outline" size={64} color={theme.colors.textSecondary} />
                    <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                      {searchQuery ? 'No users found' : 'Search for users to add'}
                    </Text>
                  </View>
                }
              />
            )}
          </>
        ) : (
          <View style={styles.detailsContainer}>
            {/* Group Avatar */}
            <TouchableOpacity 
              style={styles.avatarSection}
              onPress={pickGroupAvatar}
              disabled={uploading}
            >
              {groupAvatar ? (
                <Image source={{ uri: groupAvatar }} style={styles.groupAvatarImage} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: isDark ? '#262626' : '#F0F0F0' }]}>
                  {uploading ? (
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                  ) : (
                    <Ionicons name="camera" size={32} color={theme.colors.textSecondary} />
                  )}
                </View>
              )}
              <Text style={[styles.avatarHint, { color: theme.colors.primary }]}>
                {groupAvatar ? 'Change photo' : 'Add group photo'}
              </Text>
            </TouchableOpacity>

            {/* Group Name Input */}
            <View style={[styles.inputGroup, { backgroundColor: isDark ? '#262626' : '#F0F0F0' }]}>
              <TextInput
                style={[styles.groupInput, { color: theme.colors.text }]}
                placeholder="Group Name (required)"
                placeholderTextColor={theme.colors.textSecondary}
                value={groupName}
                onChangeText={setGroupName}
                maxLength={100}
              />
            </View>

            {/* Members Preview */}
            <View style={styles.membersSection}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Participants: {selectedUsers.length}
              </Text>
              <FlatList
                data={selectedUsers}
                renderItem={({ item }) => (
                  <View style={[styles.memberItem, { backgroundColor: isDark ? '#262626' : '#F0F0F0' }]}>
                    <Image
                      source={{ uri: item.profile?.avatar || item.avatar || 'https://via.placeholder.com/36' }}
                      style={styles.memberAvatar}
                    />
                    <Text style={[styles.memberName, { color: theme.colors.text }]}>
                      {item.username}
                    </Text>
                  </View>
                )}
                keyExtractor={(item) => item._id}
                scrollEnabled={false}
              />
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  nextBtn: { fontSize: 16, fontWeight: '600' },

  selectedCount: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  countText: {
    fontSize: 14,
    fontWeight: '600',
  },

  selectedContainer: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  chipsList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 10,
    borderRadius: 20,
    gap: 6,
  },
  chipAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  chipText: {
    fontSize: 14,
    maxWidth: 80,
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },

  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
  },
  userFullName: {
    fontSize: 14,
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
  },

  detailsContainer: {
    padding: 16,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  groupAvatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 12,
  },
  avatarHint: {
    fontSize: 14,
    fontWeight: '600',
  },

  inputGroup: {
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  groupInput: {
    fontSize: 16,
    paddingVertical: 14,
  },

  membersSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  memberName: {
    fontSize: 15,
    marginLeft: 12,
    fontWeight: '500',
  },
});

export default CreateGroupModal;
