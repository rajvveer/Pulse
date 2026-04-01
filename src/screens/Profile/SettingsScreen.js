import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Share,
  Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../contexts/ThemeContext';
import { getTheme } from '../../styles/theme';
import { useDispatch } from 'react-redux';
import { logout } from '../../redux/slices/authSlice';
import api from '../../services/api';

const SettingItem = ({ icon, label, value, onPress, isSwitch, theme, isDestructive }) => (
  <TouchableOpacity
    style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}
    onPress={onPress}
    disabled={isSwitch}
    activeOpacity={0.7}
  >
    <View style={styles.settingLeft}>
      <View style={[styles.iconContainer, { backgroundColor: isDestructive ? '#FF3B3010' : theme.colors.primary + '15' }]}>
        <Ionicons
          name={icon}
          size={20}
          color={isDestructive ? '#FF3B30' : theme.colors.primary}
        />
      </View>
      <Text style={[styles.settingLabel, { color: isDestructive ? '#FF3B30' : theme.colors.text }]}>
        {label}
      </Text>
    </View>
    {isSwitch ? (
      <Switch
        value={value}
        onValueChange={onPress}
        trackColor={{ false: theme.colors.border, true: theme.colors.primary + '50' }}
        thumbColor={value ? theme.colors.primary : '#f4f3f4'}
      />
    ) : (
      <View style={styles.settingRight}>
        {value && <Text style={[styles.settingValue, { color: theme.colors.textSecondary }]}>{value}</Text>}
        <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
      </View>
    )}
  </TouchableOpacity>
);

const SectionHeader = ({ title, theme }) => (
  <Text style={[styles.sectionHeader, { color: theme.colors.textSecondary }]}>{title}</Text>
);

const SettingsScreen = ({ navigation }) => {
  const { isDark, toggleTheme } = useTheme();
  const theme = getTheme(isDark);
  const dispatch = useDispatch();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    pushNotifications: true,
    emailNotifications: true,
    notifyOnLike: true,
    notifyOnComment: true,
    notifyOnFollow: true,
    notifyOnMention: true,
    isPrivate: false,
    showOnlineStatus: true,
    allowMessages: 'everyone',
    theme: 'auto',
  });

  // Referral state
  const [referral, setReferral] = useState({
    code: null,
    shareUrl: '',
    shareMessage: '',
    count: 0,
    loading: false,
  });

  useEffect(() => {
    fetchSettings();
    fetchReferralCode();
  }, []);

  const fetchReferralCode = async () => {
    try {
      setReferral(prev => ({ ...prev, loading: true }));
      const res = await api.get('/referral/my-code');
      if (res.data?.data) {
        const d = res.data.data;
        setReferral({
          code: d.referralCode,
          shareUrl: d.shareUrl,
          shareMessage: d.shareMessage,
          count: d.referralCount || 0,
          loading: false,
        });
      }
    } catch (error) {
      console.error('Fetch referral error:', error);
      setReferral(prev => ({ ...prev, loading: false }));
    }
  };

  const handleShareReferral = async () => {
    try {
      await Share.share({
        message: referral.shareMessage || `Join me on Pulse! Use code ${referral.code}`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleCopyCode = () => {
    if (referral.code) {
      Clipboard.setString(referral.code);
      Alert.alert('Copied!', 'Referral code copied to clipboard.');
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await api.get('/users/me');
      if (res.data?.data) {
        const user = res.data.data;
        setSettings({
          pushNotifications: user.settings?.pushNotifications ?? true,
          emailNotifications: user.settings?.emailNotifications ?? true,
          notifyOnLike: user.settings?.notifyOnLike ?? true,
          notifyOnComment: user.settings?.notifyOnComment ?? true,
          notifyOnFollow: user.settings?.notifyOnFollow ?? true,
          notifyOnMention: user.settings?.notifyOnMention ?? true,
          isPrivate: user.privacy?.isPrivate ?? false,
          showOnlineStatus: user.privacy?.showOnlineStatus ?? true,
          allowMessages: user.privacy?.allowMessages ?? 'everyone',
          theme: user.settings?.theme ?? 'auto',
        });
      }
    } catch (error) {
      console.error('Fetch settings error:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key, value) => {
    const prevSettings = { ...settings };
    setSettings(prev => ({ ...prev, [key]: value }));

    try {
      // Determine if it's a privacy or settings field
      const isPrivacy = ['isPrivate', 'showOnlineStatus', 'allowMessages'].includes(key);
      const updatePath = isPrivacy ? `privacy.${key}` : `settings.${key}`;

      await api.patch('/users/me', { [updatePath]: value });
    } catch (error) {
      console.error('Update setting error:', error);
      setSettings(prevSettings); // Revert on error
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => dispatch(logout()),
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Coming Soon', 'Account deletion will be available in a future update.');
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['bottom']}>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Notifications */}
        <SectionHeader title="NOTIFICATIONS" theme={theme} />
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <SettingItem
            icon="notifications"
            label="Push Notifications"
            value={settings.pushNotifications}
            onPress={(val) => updateSetting('pushNotifications', val)}
            isSwitch
            theme={theme}
          />
          <SettingItem
            icon="mail"
            label="Email Notifications"
            value={settings.emailNotifications}
            onPress={(val) => updateSetting('emailNotifications', val)}
            isSwitch
            theme={theme}
          />
          <SettingItem
            icon="heart"
            label="Likes"
            value={settings.notifyOnLike}
            onPress={(val) => updateSetting('notifyOnLike', val)}
            isSwitch
            theme={theme}
          />
          <SettingItem
            icon="chatbubble"
            label="Comments"
            value={settings.notifyOnComment}
            onPress={(val) => updateSetting('notifyOnComment', val)}
            isSwitch
            theme={theme}
          />
          <SettingItem
            icon="person-add"
            label="New Followers"
            value={settings.notifyOnFollow}
            onPress={(val) => updateSetting('notifyOnFollow', val)}
            isSwitch
            theme={theme}
          />
          <SettingItem
            icon="at"
            label="Mentions"
            value={settings.notifyOnMention}
            onPress={(val) => updateSetting('notifyOnMention', val)}
            isSwitch
            theme={theme}
          />
        </View>

        {/* Privacy */}
        <SectionHeader title="PRIVACY" theme={theme} />
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <SettingItem
            icon="lock-closed"
            label="Private Account"
            value={settings.isPrivate}
            onPress={(val) => updateSetting('isPrivate', val)}
            isSwitch
            theme={theme}
          />
          <SettingItem
            icon="ellipse"
            label="Show Online Status"
            value={settings.showOnlineStatus}
            onPress={(val) => updateSetting('showOnlineStatus', val)}
            isSwitch
            theme={theme}
          />
          <SettingItem
            icon="chatbubbles"
            label="Who Can Message Me"
            value={settings.allowMessages === 'everyone' ? 'Everyone' : settings.allowMessages === 'followers' ? 'Followers' : 'No One'}
            onPress={() => navigation.navigate('Privacy')}
            theme={theme}
          />
        </View>

        {/* Appearance */}
        <SectionHeader title="APPEARANCE" theme={theme} />
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <SettingItem
            icon={isDark ? "moon" : "sunny"}
            label="Dark Mode"
            value={isDark}
            onPress={() => toggleTheme()}
            isSwitch
            theme={theme}
          />
        </View>

        {/* Invite Friends */}
        <SectionHeader title="INVITE FRIENDS" theme={theme} />
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary + '15' }]}>
                  <Ionicons name="gift" size={20} color={theme.colors.primary} />
                </View>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Your Referral Code</Text>
              </View>

              {referral.loading ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : referral.code ? (
                <>
                  <View style={{
                    backgroundColor: theme.colors.primary + '12',
                    borderRadius: 10,
                    padding: 14,
                    alignItems: 'center',
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: theme.colors.primary + '30',
                  }}>
                    <Text style={{
                      fontSize: 22,
                      fontWeight: '800',
                      letterSpacing: 3,
                      color: theme.colors.primary,
                    }}>{referral.code}</Text>
                  </View>

                  <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 12, textAlign: 'center' }}>
                    {referral.count} {referral.count === 1 ? 'friend' : 'friends'} joined with your code
                  </Text>

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      onPress={handleShareReferral}
                      activeOpacity={0.7}
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        backgroundColor: theme.colors.primary,
                        paddingVertical: 12,
                        borderRadius: 10,
                      }}
                    >
                      <Ionicons name="share-social" size={18} color="#fff" />
                      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Share</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={handleCopyCode}
                      activeOpacity={0.7}
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        backgroundColor: theme.colors.primary + '15',
                        paddingVertical: 12,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: theme.colors.primary + '30',
                      }}
                    >
                      <Ionicons name="copy" size={18} color={theme.colors.primary} />
                      <Text style={{ color: theme.colors.primary, fontWeight: '600', fontSize: 14 }}>Copy</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <Text style={{ fontSize: 13, color: theme.colors.textSecondary }}>
                  Unable to load referral code
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Account */}
        <SectionHeader title="ACCOUNT" theme={theme} />
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <SettingItem
            icon="key"
            label="Change Password"
            onPress={() => Alert.alert('Coming Soon', 'This feature will be available soon.')}
            theme={theme}
          />
          <SettingItem
            icon="information-circle"
            label="About"
            onPress={() => navigation.navigate('About')}
            theme={theme}
          />
          <SettingItem
            icon="log-out"
            label="Logout"
            onPress={handleLogout}
            theme={theme}
            isDestructive
          />
          <SettingItem
            icon="trash"
            label="Delete Account"
            onPress={handleDeleteAccount}
            theme={theme}
            isDestructive
          />
        </View>

        <Text style={[styles.version, { color: theme.colors.textSecondary }]}>
          Pulse v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 24,
    marginBottom: 8,
    marginHorizontal: 20,
  },
  section: {
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingValue: {
    fontSize: 14,
  },
  version: {
    textAlign: 'center',
    marginTop: 30,
    fontSize: 13,
  },
});

export default SettingsScreen;
