// src/screens/Auth/CreateUsernameScreen.js
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';
import { loginSuccess } from '../../redux/slices/authSlice';
import { useTheme } from '../../contexts/ThemeContext';
import { getTheme } from '../../styles/theme';
import api from '../../services/api';

const CreateUsernameScreen = ({ route }) => {
  const { tempToken } = route.params; // Get the temp token from the previous screen
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const { isDark } = useTheme();
  const theme = getTheme(isDark);

  const handleCreateAccount = async () => {
    if (!username || !password) {
      return Alert.alert('Fields Required', 'Please choose a username and password.');
    }
    setLoading(true);
    try {
      const response = await api.post('/auth/create-username', {
        tempToken,
        username,
        password,
        deviceId: 'some-unique-device-id',
      });

      const { user, accessToken, refreshToken } = response.data;
      
      // Account created, now log the user in
      dispatch(loginSuccess({ user, token: accessToken }));
      // Remember to securely store the refreshToken

    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Could not create account.';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.colors.text }]}>One Last Step</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          Choose a username and password for your account.
        </Text>

        <TextInput
          style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text }]}
          placeholder="Username"
          placeholderTextColor={theme.colors.textSecondary}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />

        <TextInput
          style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text }]}
          placeholder="Password"
          placeholderTextColor={theme.colors.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry // Hides the password
        />

        <TouchableOpacity 
          style={[styles.button, { backgroundColor: theme.colors.primary }]} 
          onPress={handleCreateAccount}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Create Account & Login</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  title: { fontSize: 32, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 16, marginBottom: 48, textAlign: 'center' },
  input: { height: 55, width: '100%', borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, fontSize: 16, marginBottom: 20 },
  button: { height: 55, justifyContent: 'center', paddingHorizontal: 32, borderRadius: 12, width: '100%', marginTop: 10 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', textAlign: 'center' },
});

export default CreateUsernameScreen;
