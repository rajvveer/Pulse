import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../contexts/ThemeContext';
import { getTheme } from '../../styles/theme';
import api from '../../services/api';
import logger from '../../utils/logger';

const ChangePasswordScreen = ({ navigation }) => {
  const { isDark } = useTheme();
  const theme = getTheme(isDark);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (newPassword.length < 6) {
      Alert.alert('Weak Password', 'New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'New password and confirmation do not match.');
      return;
    }

    setSaving(true);
    try {
      await api.patch('/users/me/password', {
        currentPassword: currentPassword || undefined,
        newPassword,
      });
      Alert.alert('Success', 'Your password has been updated.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      logger.error('Change password error:', error);
      const message =
        error.response?.data?.message || 'Could not update password. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = [
    styles.input,
    {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      color: theme.colors.text,
    },
  ];

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['bottom']}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>
            Choose a strong password you don't use anywhere else. Leave "Current password" blank
            if you signed up with Google and haven't set one yet.
          </Text>

          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
            CURRENT PASSWORD
          </Text>
          <TextInput
            style={inputStyle}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Current password"
            placeholderTextColor={theme.colors.textSecondary}
            secureTextEntry={!showPasswords}
            autoCapitalize="none"
          />

          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>NEW PASSWORD</Text>
          <TextInput
            style={inputStyle}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="New password"
            placeholderTextColor={theme.colors.textSecondary}
            secureTextEntry={!showPasswords}
            autoCapitalize="none"
          />

          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
            CONFIRM NEW PASSWORD
          </Text>
          <TextInput
            style={inputStyle}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Re-enter new password"
            placeholderTextColor={theme.colors.textSecondary}
            secureTextEntry={!showPasswords}
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={styles.showRow}
            onPress={() => setShowPasswords((v) => !v)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={showPasswords ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={theme.colors.primary}
            />
            <Text style={[styles.showText, { color: theme.colors.primary }]}>
              {showPasswords ? 'Hide passwords' : 'Show passwords'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.saveButton,
              { backgroundColor: theme.colors.primary, opacity: saving ? 0.6 : 1 },
            ]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveText}>Update Password</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20 },
  hint: { fontSize: 13, lineHeight: 19, marginBottom: 24 },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  showRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
  },
  showText: { fontSize: 14, fontWeight: '500' },
  saveButton: {
    marginTop: 32,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export default ChangePasswordScreen;
