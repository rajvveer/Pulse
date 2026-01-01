import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';
import { getTheme } from '../styles/theme';

const UserListItem = ({ user, onPress }) => {
  const navigation = useNavigation();
  const { isDark } = useTheme();
  const theme = getTheme(isDark);

  const avatarUrl = user.profile?.avatar || user.avatar;
  const displayName = user.profile?.displayName || user.username;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <TouchableOpacity 
      style={[styles.container, { borderBottomColor: theme.colors.border }]} 
      onPress={onPress}
    >
      {/* Avatar */}
      <View style={[styles.avatarContainer, { backgroundColor: theme.colors.primary + '20' }]}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <Text style={[styles.initial, { color: theme.colors.primary }]}>{initial}</Text>
        )}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: theme.colors.text }]}>{displayName}</Text>
          {user.isVerified && (
            <Ionicons name="checkmark-circle" size={14} color={theme.colors.primary} style={{ marginLeft: 4 }} />
          )}
        </View>
        <Text style={[styles.username, { color: theme.colors.textSecondary }]}>@{user.username}</Text>
      </View>

      {/* Arrow Icon */}
      <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  initial: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
  },
  username: {
    fontSize: 14,
  },
});

export default UserListItem;