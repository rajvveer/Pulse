import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../contexts/ThemeContext';
import { getTheme } from '../styles/theme';
import api from '../services/api';

const GroupInfoScreen = ({ route, navigation }) => {
  const { groupId } = route.params;
  const { user } = useSelector(state => state.auth);
  const { isDark } = useTheme();
  const theme = getTheme(isDark);

  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const currentUserId = user?.id || user?.userId || user?._id;
  const isAdmin = group?.admins?.some(admin => 
    String(admin._id || admin) === String(currentUserId)
  );
  const isCreator = String(group?.createdBy?._id || group?.createdBy) === String(currentUserId);

  useEffect(() => {
    fetchGroupDetails();
  }, [groupId]);

  const fetchGroupDetails = async () => {
    try {
      const res = await api.get(`/groups/${groupId}`);
      if (res.data.success) {
        setGroup(res.data.data);
        setEditedName(res.data.data.groupName);
        setEditedDescription(res.data.data.groupDescription || '');
      }
    } catch (error) {
      console.error('❌ Fetch group error:', error);
      Alert.alert('Error', 'Failed to load group details');
    } finally {
      setLoading(false);
    }
  };

  const updateGroupInfo = async () => {
    if (!editedName.trim()) {
      Alert.alert('Error', 'Group name cannot be empty');
      return;
    }

    try {
      const res = await api.put(`/groups/${groupId}`, {
        groupName: editedName.trim(),
        groupDescription: editedDescription.trim()
      });

      if (res.data.success) {
        setGroup(res.data.data);
        setEditMode(false);
        Alert.alert('Success', 'Group info updated');
      }
    } catch (error) {
      console.error('❌ Update group error:', error);
      Alert.alert('Error', 'Failed to update group');
    }
  };

  const changeGroupAvatar = async () => {
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
        name: 'group-avatar.jpg'
      });

      try {
        const uploadRes = await api.post('/media/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (uploadRes.data.success) {
          const res = await api.put(`/groups/${groupId}`, {
            groupAvatar: uploadRes.data.data.url
          });

          if (res.data.success) {
            setGroup(res.data.data);
          }
        }
      } catch (err) {
        console.error("Upload failed", err);
        Alert.alert('Error', 'Failed to update group photo');
      } finally {
        setUploading(false);
      }
    }
  };

  const searchUsers = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const res = await api.get(`/users/search?q=${query}`);
      if (res.data.success) {
        // Filter out users already in group
        const existingIds = group.participants.map(p => p._id || p);
        const filtered = res.data.data.filter(u => !existingIds.includes(u._id));
        setSearchResults(filtered);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  };

  const addMembers = async (userIds) => {
    try {
      const res = await api.post(`/groups/${groupId}/members`, { userIds });
      if (res.data.success) {
        setGroup(res.data.data);
        setShowAddMembers(false);
        setSearchQuery('');
        setSearchResults([]);
        Alert.alert('Success', 'Members added');
      }
    } catch (error) {
      console.error('❌ Add members error:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to add members');
    }
  };

  const removeMember = async (userId, username) => {
    Alert.alert(
      'Remove Member',
      `Remove ${username} from the group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/groups/${groupId}/members/${userId}`);
              fetchGroupDetails();
              Alert.alert('Success', 'Member removed');
            } catch (error) {
              console.error('❌ Remove member error:', error);
              Alert.alert('Error', 'Failed to remove member');
            }
          }
        }
      ]
    );
  };

  const makeAdmin = async (userId, username) => {
    try {
      await api.post(`/groups/${groupId}/admins`, { userId });
      fetchGroupDetails();
      Alert.alert('Success', `${username} is now an admin`);
    } catch (error) {
      console.error('❌ Make admin error:', error);
      Alert.alert('Error', 'Failed to make admin');
    }
  };

  const removeAdmin = async (userId, username) => {
    try {
      await api.delete(`/groups/${groupId}/admins/${userId}`);
      fetchGroupDetails();
      Alert.alert('Success', `${username} is no longer an admin`);
    } catch (error) {
      console.error('❌ Remove admin error:', error);
      Alert.alert('Error', 'Failed to remove admin');
    }
  };

  const leaveGroup = () => {
    Alert.alert(
      'Leave Group',
      'Are you sure you want to leave this group?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post(`/groups/${groupId}/leave`);
              navigation.goBack();
              Alert.alert('Success', 'You left the group');
            } catch (error) {
              console.error('❌ Leave group error:', error);
              Alert.alert('Error', error.response?.data?.message || 'Failed to leave group');
            }
          }
        }
      ]
    );
  };

  const deleteGroup = () => {
    Alert.alert(
      'Delete Group',
      'Are you sure? This will delete the group for everyone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/groups/${groupId}`);
              navigation.navigate('ChatListScreen');
              Alert.alert('Success', 'Group deleted');
            } catch (error) {
              console.error('❌ Delete group error:', error);
              Alert.alert('Error', 'Failed to delete group');
            }
          }
        }
      ]
    );
  };

  const renderMember = (member) => {
    const memberId = member._id || member;
    const isThisUserAdmin = group.admins?.some(admin => 
      String(admin._id || admin) === String(memberId)
    );
    const isThisUserCreator = String(group.createdBy?._id || group.createdBy) === String(memberId);
    const isMe = String(memberId) === String(currentUserId);

    return (
      <TouchableOpacity
        key={memberId}
        style={[styles.memberItem, { backgroundColor: isDark ? '#1A1A1A' : '#F9F9F9' }]}
        disabled={!isAdmin || isMe}
        onPress={() => {
          if (isAdmin && !isMe) {
            Alert.alert(
              member.username,
              'Choose an action',
              [
                { text: 'Cancel', style: 'cancel' },
                ...(isCreator && !isThisUserCreator ? [
                  {
                    text: isThisUserAdmin ? 'Remove Admin' : 'Make Admin',
                    onPress: () => isThisUserAdmin 
                      ? removeAdmin(memberId, member.username)
                      : makeAdmin(memberId, member.username)
                  }
                ] : []),
                ...(isAdmin && !isThisUserCreator ? [
                  {
                    text: 'Remove from Group',
                    style: 'destructive',
                    onPress: () => removeMember(memberId, member.username)
                  }
                ] : [])
              ]
            );
          }
        }}
      >
        <Image
          source={{ uri: member.profile?.avatar || member.avatar || 'https://via.placeholder.com/48' }}
          style={styles.memberAvatar}
        />
        <View style={styles.memberInfo}>
          <View style={styles.memberNameRow}>
            <Text style={[styles.memberName, { color: theme.colors.text }]}>
              {member.username} {isMe && '(You)'}
            </Text>
            {isThisUserAdmin && (
              <View style={[styles.adminBadge, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.adminText}>Admin</Text>
              </View>
            )}
          </View>
          {member.name && (
            <Text style={[styles.memberFullName, { color: theme.colors.textSecondary }]}>
              {member.name}
            </Text>
          )}
        </View>
        {member.isOnline && <View style={styles.onlineDot} />}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  if (!group) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.errorText, { color: theme.colors.text }]}>Group not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Group Info</Text>
        {isAdmin && (
          <TouchableOpacity onPress={() => setEditMode(!editMode)}>
            <Text style={[styles.editBtn, { color: theme.colors.primary }]}>
              {editMode ? 'Cancel' : 'Edit'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Group Avatar */}
        <TouchableOpacity
          style={styles.avatarSection}
          onPress={isAdmin ? changeGroupAvatar : null}
          disabled={!isAdmin || uploading}
        >
          <Image
            source={{ uri: group.groupAvatar || 'https://via.placeholder.com/120' }}
            style={styles.groupAvatar}
          />
          {uploading && (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator size="large" color="#FFF" />
            </View>
          )}
          {isAdmin && (
            <View style={styles.cameraButton}>
              <Ionicons name="camera" size={20} color="#FFF" />
            </View>
          )}
        </TouchableOpacity>

        {/* Group Name & Description */}
        <View style={styles.infoSection}>
          {editMode ? (
            <>
              <TextInput
                style={[styles.nameInput, { 
                  color: theme.colors.text,
                  backgroundColor: isDark ? '#1A1A1A' : '#F9F9F9'
                }]}
                value={editedName}
                onChangeText={setEditedName}
                placeholder="Group Name"
                placeholderTextColor={theme.colors.textSecondary}
              />
              <TextInput
                style={[styles.descInput, { 
                  color: theme.colors.text,
                  backgroundColor: isDark ? '#1A1A1A' : '#F9F9F9'
                }]}
                value={editedDescription}
                onChangeText={setEditedDescription}
                placeholder="Description (optional)"
                placeholderTextColor={theme.colors.textSecondary}
                multiline
              />
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: theme.colors.primary }]}
                onPress={updateGroupInfo}
              >
                <Text style={styles.saveBtnText}>Save Changes</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={[styles.groupName, { color: theme.colors.text }]}>
                {group.groupName}
              </Text>
              {group.groupDescription && (
                <Text style={[styles.groupDescription, { color: theme.colors.textSecondary }]}>
                  {group.groupDescription}
                </Text>
              )}
              <Text style={[styles.groupMeta, { color: theme.colors.textSecondary }]}>
                Group · {group.participants?.length} members
              </Text>
            </>
          )}
        </View>

        {/* Members Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Members ({group.participants?.length})
            </Text>
            {isAdmin && (
              <TouchableOpacity onPress={() => setShowAddMembers(true)}>
                <Ionicons name="person-add" size={24} color={theme.colors.primary} />
              </TouchableOpacity>
            )}
          </View>

          {group.participants?.map(renderMember)}
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: isDark ? '#1A1A1A' : '#F9F9F9' }]}
            onPress={() => navigation.navigate('ChatScreen', {
              conversationId: groupId,
              conversation: group
            })}
          >
            <Ionicons name="chatbubble-outline" size={22} color={theme.colors.primary} />
            <Text style={[styles.actionText, { color: theme.colors.text }]}>
              Send Message
            </Text>
          </TouchableOpacity>

          {!isCreator && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: isDark ? '#1A1A1A' : '#F9F9F9' }]}
              onPress={leaveGroup}
            >
              <Ionicons name="exit-outline" size={22} color="#FF3B30" />
              <Text style={[styles.actionText, { color: '#FF3B30' }]}>
                Leave Group
              </Text>
            </TouchableOpacity>
          )}

          {isCreator && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: isDark ? '#1A1A1A' : '#F9F9F9' }]}
              onPress={deleteGroup}
            >
              <Ionicons name="trash-outline" size={22} color="#FF3B30" />
              <Text style={[styles.actionText, { color: '#FF3B30' }]}>
                Delete Group
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Add Members Modal */}
      <Modal
        visible={showAddMembers}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddMembers(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
            <TouchableOpacity onPress={() => setShowAddMembers(false)}>
              <Ionicons name="close" size={28} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Add Members</Text>
            <View style={{ width: 28 }} />
          </View>

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

          {searching ? (
            <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 50 }} />
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.userItem, { backgroundColor: theme.colors.background }]}
                  onPress={() => addMembers([item._id])}
                >
                  <Image
                    source={{ uri: item.profile?.avatar || item.avatar || 'https://via.placeholder.com/48' }}
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
                  <Ionicons name="add-circle" size={28} color={theme.colors.primary} />
                </TouchableOpacity>
              )}
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
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', flex: 1, marginLeft: 16 },
  editBtn: { fontSize: 16, fontWeight: '600' },

  avatarSection: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  groupAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  uploadingOverlay: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 32,
    right: '50%',
    marginRight: -70,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0095F6',
    justifyContent: 'center',
    alignItems: 'center',
  },

  infoSection: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    alignItems: 'center',
  },
  groupName: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  groupDescription: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 8,
  },
  groupMeta: {
    fontSize: 14,
  },

  nameInput: {
    width: '100%',
    fontSize: 18,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  descInput: {
    width: '100%',
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  saveBtn: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },

  section: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },

  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
  },
  memberFullName: {
    fontSize: 14,
    marginTop: 2,
  },
  adminBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adminText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  onlineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22C55E',
  },

  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
  },

  errorText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
  },

  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 20, fontWeight: '700' },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 16 },

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

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
  },
});

export default GroupInfoScreen;
