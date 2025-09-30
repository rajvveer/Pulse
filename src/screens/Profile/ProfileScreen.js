import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../../redux/slices/authSlice';
import { useTheme } from '../../contexts/ThemeContext';
import { getTheme } from '../../styles/theme';
import { ThemeToggle } from '../../components/UI/ThemeToggle';
import Ionicons from '@expo/vector-icons/Ionicons';

const ProfileScreen = ({ navigation }) => {
  const { user } = useSelector(state => state.auth);
  const dispatch = useDispatch();
  const { isDark } = useTheme();
  const theme = getTheme(isDark);

  const profileOptions = [
    {
      id: 'edit',
      title: 'Edit Profile',
      subtitle: 'Update your personal information',
      icon: 'person-outline',
      screen: 'EditProfile',
      color: theme.colors.primary,
    },
    {
      id: 'posts',
      title: 'My Posts',
      subtitle: 'View all your posted content',
      icon: 'grid-outline',
      screen: 'MyPosts',
      color: theme.colors.accent,
    },
    {
      id: 'settings',
      title: 'Settings',
      subtitle: 'App preferences and account settings',
      icon: 'settings-outline',
      screen: 'Settings',
      color: theme.colors.textSecondary,
    },
    {
      id: 'privacy',
      title: 'Privacy & Safety',
      subtitle: 'Location and data privacy controls',
      icon: 'shield-outline',
      screen: 'Privacy',
      color: theme.colors.success,
    },
    {
      id: 'notifications',
      title: 'Notifications',
      subtitle: 'Manage your notification preferences',
      icon: 'notifications-outline',
      screen: 'Notifications',
      color: theme.colors.warning,
    },
    {
      id: 'about',
      title: 'About Pulse',
      subtitle: 'App info, version, and help center',
      icon: 'information-circle-outline',
      screen: 'About',
      color: theme.colors.textSecondary,
    },
  ];

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => dispatch(logout()),
        },
      ],
      { cancelable: true }
    );
  };

  const renderProfileOption = (option) => (
    <TouchableOpacity
      key={option.id}
      style={[styles.optionCard, { 
        backgroundColor: theme.colors.surface,
        shadowColor: theme.colors.shadow,
      }]}
      onPress={() => navigation.navigate(option.screen)}
    >
      <View style={styles.optionContent}>
        <View style={[styles.optionIcon, { backgroundColor: option.color + '20' }]}>
          <Ionicons name={option.icon} size={24} color={option.color} />
        </View>
        <View style={styles.optionText}>
          <Text style={[styles.optionTitle, { color: theme.colors.text }]}>
            {option.title}
          </Text>
          <Text style={[styles.optionSubtitle, { color: theme.colors.textSecondary }]}>
            {option.subtitle}
          </Text>
        </View>
        <Ionicons 
          name="chevron-forward" 
          size={20} 
          color={theme.colors.textSecondary} 
        />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={[styles.header, { 
        backgroundColor: theme.colors.surface,
        borderBottomColor: theme.colors.border,
        shadowColor: theme.colors.shadow,
      }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Profile</Text>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.navigate('Settings')}
        >
          <Ionicons name="settings-outline" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* User Profile Section */}
        <View style={[styles.profileCard, { 
          backgroundColor: theme.colors.surface,
          shadowColor: theme.colors.shadow,
        }]}>
          <View style={styles.profileHeader}>
            <View style={[styles.avatar, { backgroundColor: theme.colors.primary + '20' }]}>
              <Text style={[styles.avatarText, { color: theme.colors.primary }]}>
                {user?.name?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
            <TouchableOpacity 
              style={[styles.editButton, { borderColor: theme.colors.border }]}
              onPress={() => navigation.navigate('EditProfile')}
            >
              <Ionicons name="pencil" size={16} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
          
          <Text style={[styles.userName, { color: theme.colors.text }]}>
            {user?.name || 'Anonymous User'}
          </Text>
          <Text style={[styles.userLocation, { color: theme.colors.textSecondary }]}>
            📍 Jaipur, Rajasthan
          </Text>
          <Text style={[styles.userBio, { color: theme.colors.textSecondary }]}>
            Exploring my local community through Pulse. Love connecting with neighbors! 🌟
          </Text>

          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: theme.colors.primary }]}>23</Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Posts</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: theme.colors.primary }]}>847</Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Likes</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: theme.colors.primary }]}>156</Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Comments</Text>
            </View>
          </View>
        </View>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Profile Options */}
        <View style={styles.optionsContainer}>
          {profileOptions.map(renderProfileOption)}
        </View>

        {/* Logout Button */}
        <TouchableOpacity 
          style={[styles.logoutButton, { 
            backgroundColor: theme.colors.error,
            shadowColor: theme.colors.shadow,
          }]} 
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
            Pulse v1.0.0 • Made with ❤️ in Jaipur
          </Text>
        </View>
      </ScrollView>
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
    padding: 16,
    borderBottomWidth: 1,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  headerButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  profileCard: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileHeader: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
  },
  editButton: {
    position: 'absolute',
    right: -5,
    bottom: 5,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 6,
    borderWidth: 1,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  userLocation: {
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  userBio: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
  },
  optionsContainer: {
    marginBottom: 16,
  },
  optionCard: {
    borderRadius: 12,
    marginBottom: 8,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 32,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
  },
});

export default ProfileScreen;
