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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../contexts/ThemeContext';
import { getTheme } from '../../styles/theme';
import { useDispatch } from 'react-redux';
import { logoutAsync } from '../../redux/slices/authSlice';
import api from '../../services/api';
import logger from '../../utils/logger';

const DESTRUCTIVE = '#FF3B30';
const PRIVACY_POLICY_URL = 'https://getpulse.app/privacy';
const TERMS_URL = 'https://getpulse.app/terms';

const SettingItem = ({ icon, label, value, onPress, isSwitch, theme, isDestructive, last }) => (
  <TouchableOpacity
    style={[
      styles.settingItem,
      { borderBottomColor: theme.colors.separator, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth },
    ]}
    onPress={onPress}
    disabled={isSwitch}
    activeOpacity={0.7}
  >
    <View style={styles.settingLeft}>
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: isDestructive ? theme.colors.accentMuted : theme.colors.surfaceAlt },
        ]}
      >
        <Ionicons name={icon} size={19} color={isDestructive ? theme.colors.error : theme.colors.text} />
      </View>
      <Text style={[styles.settingLabel, { color: isDestructive ? theme.colors.error : theme.colors.text }]}>
        {label}
      </Text>
    </View>
    {isSwitch ? (
      <Switch
        value={value}
        onValueChange={onPress}
        trackColor={{ false: theme.colors.borderStrong, true: theme.colors.primary }}
        thumbColor={'#FFFFFF'}
        ios_backgroundColor={theme.colors.borderStrong}
      />
    ) : (
      <View style={styles.settingRight}>
        {value ? (
          <Text style={[styles.settingValue, { color: theme.colors.textSecondary }]}>{value}</Text>
        ) : null}
        <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
      </View>
    )}
  </TouchableOpacity>
);

const SectionHeader = ({ title, theme }) => (
  <Text style={[styles.sectionHeader, { color: theme.colors.textTertiary }]}>{title}</Text>
);

const SettingsScreen = ({ navigation }) => {
  const { isDark } = useTheme();
  const theme = getTheme(isDark);
  const dispatch = useDispatch();

  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [settings, setSettings] = useState({
    pushNotifications: true,
    shareExactLocation: false,
  });

  const [referral, setReferral] = useState({
    code: null,
    shareMessage: '',
    count: 0,
    loading: true,
  });

  useEffect(() => {
    fetchSettings();
    fetchReferralCode();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/users/me');
      const user = res.data?.data;
      if (user) {
        setSettings({
          pushNotifications: user.settings?.pushNotifications ?? true,
          shareExactLocation: user.settings?.shareExactLocation ?? false,
        });
      }
    } catch (error) {
      logger.error('Fetch settings error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReferralCode = async () => {
    try {
      const res = await api.get('/referral/my-code');
      const d = res.data?.data;
      if (d) {
        setReferral({
          code: d.referralCode,
          shareMessage: d.shareMessage || '',
          count: d.referralCount || 0,
          loading: false,
        });
      } else {
        setReferral((prev) => ({ ...prev, loading: false }));
      }
    } catch (error) {
      logger.error('Fetch referral error:', error);
      setReferral((prev) => ({ ...prev, loading: false }));
    }
  };

  const updateSetting = async (key, value) => {
    const previous = settings[key];
    setSettings((prev) => ({ ...prev, [key]: value }));

    try {
      await api.patch('/users/me', { [`settings.${key}`]: value });
    } catch (error) {
      logger.error('Update setting error:', error);
      setSettings((prev) => ({ ...prev, [key]: previous })); // revert
      Alert.alert('Error', 'Could not save that change. Please try again.');
    }
  };

  const handleShareReferral = async () => {
    try {
      await Share.share({
        message: referral.shareMessage || `Join me on Pulse! Use my code ${referral.code}`,
      });
    } catch (error) {
      logger.error('Share referral error:', error);
    }
  };

  const handleCopyCode = async () => {
    if (!referral.code) return;
    await Clipboard.setStringAsync(referral.code);
    Alert.alert('Copied', 'Referral code copied to clipboard.');
  };

  const openLink = async (url) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      logger.error('Open link error:', error);
      Alert.alert('Error', 'Could not open the link.');
    }
  };

  const performDelete = async () => {
    setDeleting(true);
    try {
      await api.delete('/users/me');
      // Account is gone — clear the session and drop back to the auth flow.
      dispatch(logoutAsync());
    } catch (error) {
      logger.error('Delete account error:', error);
      setDeleting(false);
      Alert.alert('Error', 'Could not delete your account. Please try again.');
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This permanently deactivates your account and removes your posts. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Are you absolutely sure?', 'Your account and content will be gone for good.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete Forever', style: 'destructive', onPress: performDelete },
            ]),
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        edges={['bottom']}
      >
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['bottom']}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Account */}
        <SectionHeader title="ACCOUNT" theme={theme} />
        <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <SettingItem
            icon="person-outline"
            label="Edit Profile"
            onPress={() => navigation.navigate('EditProfile')}
            theme={theme}
          />
          <SettingItem
            icon="key-outline"
            label="Change Password"
            onPress={() => navigation.navigate('ChangePassword')}
            theme={theme}
            last
          />
        </View>

        {/* Notifications */}
        <SectionHeader title="NOTIFICATIONS" theme={theme} />
        <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <SettingItem
            icon="notifications"
            label="Push Notifications"
            value={settings.pushNotifications}
            onPress={(val) => updateSetting('pushNotifications', val)}
            isSwitch
            theme={theme}
            last
          />
        </View>

        {/* Location */}
        <SectionHeader title="LOCATION" theme={theme} />
        <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <SettingItem
            icon="navigate"
            label="Share Exact Location"
            value={settings.shareExactLocation}
            onPress={(val) => updateSetting('shareExactLocation', val)}
            isSwitch
            theme={theme}
            last
          />
        </View>

        {/* Invite Friends */}
        <SectionHeader title="INVITE FRIENDS" theme={theme} />
        <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.referralWrap}>
            <View style={styles.referralHeader}>
              <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary + '15' }]}>
                <Ionicons name="gift" size={20} color={theme.colors.primary} />
              </View>
              <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                Your Referral Code
              </Text>
            </View>

            {referral.loading ? (
              <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginTop: 12 }} />
            ) : referral.code ? (
              <>
                <View
                  style={[
                    styles.codeBox,
                    { backgroundColor: theme.colors.primary + '12', borderColor: theme.colors.primary + '30' },
                  ]}
                >
                  <Text style={[styles.codeText, { color: theme.colors.primary }]}>
                    {referral.code}
                  </Text>
                </View>
                <Text style={[styles.referralCount, { color: theme.colors.textSecondary }]}>
                  {referral.count} {referral.count === 1 ? 'friend has' : 'friends have'} joined with
                  your code
                </Text>
                <View style={styles.referralButtons}>
                  <TouchableOpacity
                    onPress={handleShareReferral}
                    activeOpacity={0.7}
                    style={[styles.referralBtn, { backgroundColor: theme.colors.primary }]}
                  >
                    <Ionicons name="share-social" size={18} color="#fff" />
                    <Text style={styles.referralBtnText}>Share</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleCopyCode}
                    activeOpacity={0.7}
                    style={[
                      styles.referralBtn,
                      { backgroundColor: theme.colors.primary + '15', borderWidth: 1, borderColor: theme.colors.primary + '30' },
                    ]}
                  >
                    <Ionicons name="copy" size={18} color={theme.colors.primary} />
                    <Text style={[styles.referralBtnText, { color: theme.colors.primary }]}>Copy</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <Text style={[styles.referralCount, { color: theme.colors.textSecondary }]}>
                Unable to load referral code.
              </Text>
            )}
          </View>
        </View>

        {/* Support & About */}
        <SectionHeader title="SUPPORT & ABOUT" theme={theme} />
        <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <SettingItem
            icon="information-circle"
            label="About Pulse"
            onPress={() => navigation.navigate('About')}
            theme={theme}
          />
          <SettingItem
            icon="shield-checkmark"
            label="Privacy Policy"
            onPress={() => openLink(PRIVACY_POLICY_URL)}
            theme={theme}
          />
          <SettingItem
            icon="document-text"
            label="Terms of Service"
            onPress={() => openLink(TERMS_URL)}
            theme={theme}
            last
          />
        </View>

        {/* Danger zone */}
        <SectionHeader title="ACCOUNT ACTIONS" theme={theme} />
        <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          {deleting ? (
            <View style={[styles.settingItem, { borderBottomWidth: 0 }]}>
              <ActivityIndicator size="small" color={DESTRUCTIVE} />
              <Text style={[styles.settingLabel, { color: DESTRUCTIVE, marginLeft: 12 }]}>
                Deleting account...
              </Text>
            </View>
          ) : (
            <SettingItem
              icon="trash"
              label="Delete Account"
              onPress={handleDeleteAccount}
              theme={theme}
              isDestructive
              last
            />
          )}
        </View>

        <Text style={[styles.version, { color: theme.colors.textSecondary }]}>Pulse v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: 40 },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 26,
    marginBottom: 9,
    marginHorizontal: 22,
  },
  section: { marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 13,
  },
  settingLabel: { fontSize: 15, fontWeight: '600' },
  settingRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  settingValue: { fontSize: 14 },
  referralWrap: { padding: 16 },
  referralHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  codeBox: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  codeText: { fontSize: 22, fontWeight: '800', letterSpacing: 4 },
  referralCount: { fontSize: 13, marginBottom: 14, textAlign: 'center' },
  referralButtons: { flexDirection: 'row', gap: 10 },
  referralBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  referralBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  version: { textAlign: 'center', marginTop: 30, fontSize: 13 },
});

export default SettingsScreen;
