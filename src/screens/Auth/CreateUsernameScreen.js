// src/screens/Auth/CreateUsernameScreen.js
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginSuccess } from '../../redux/slices/authSlice';
import { useTheme } from '../../contexts/ThemeContext';
import { getTheme } from '../../styles/theme';
import api from '../../services/api';

const CreateUsernameScreen = ({ route }) => {
  const { tempToken } = route.params;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const dispatch = useDispatch();
  const { isDark } = useTheme();
  const theme = getTheme(isDark);

  // ✅ Get device ID from AsyncStorage
  const getDeviceId = async () => {
    try {
      let deviceId = await AsyncStorage.getItem('deviceId');
      if (!deviceId) {
        deviceId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
        await AsyncStorage.setItem('deviceId', deviceId);
      }
      return deviceId;
    } catch (error) {
      console.error('Error getting device ID:', error);
      return `session-${Date.now()}`;
    }
  };

  const validateUsername = (username) => {
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      return 'Username must be 3-20 characters (letters, numbers, underscore only)';
    }
    return null;
  };

  const validatePassword = (password) => {
    if (password.length < 6) {
      return 'Password must be at least 6 characters';
    }
    return null;
  };

  const handleCreateAccount = async () => {
    // Clear previous errors
    setError('');

    // Validate inputs
    if (!username.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return Alert.alert('Fields Required', 'Please choose a username and password.');
    }

    const usernameError = validateUsername(username.trim());
    if (usernameError) {
      setError(usernameError);
      return Alert.alert('Invalid Username', usernameError);
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return Alert.alert('Invalid Password', passwordError);
    }

    setLoading(true);

    try {
      const deviceId = await getDeviceId();

      console.log('=== CREATING USERNAME ===');
      console.log('Username:', username);
      console.log('DeviceId:', deviceId);

      const response = await api.post('/auth/create-username', {
        tempToken,
        username: username.trim(),
        password,
        deviceId,
        platform: Platform.OS,
      });

      console.log('=== USERNAME CREATION RESPONSE ===');
      console.log('Response:', JSON.stringify(response.data, null, 2));

      const { user, tokens } = response.data || {};
      const { accessToken, refreshToken } = tokens || {};

      if (!accessToken || !user) {
        throw new Error('Invalid response from server');
      }

      console.log('=== STORING USER DATA ===');

      // ✅ Store tokens in AsyncStorage
      if (accessToken) {
        await AsyncStorage.setItem('accessToken', accessToken);
        console.log('✅ accessToken stored');
      }

      if (refreshToken) {
        await AsyncStorage.setItem('refreshToken', refreshToken);
        console.log('✅ refreshToken stored');
      }

      if (user) {
        await AsyncStorage.setItem('user', JSON.stringify(user));
        console.log('✅ user stored');
      }

      // ✅ Verify storage
      const storedToken = await AsyncStorage.getItem('accessToken');
      const storedUser = await AsyncStorage.getItem('user');
      console.log('=== VERIFICATION ===');
      console.log('Stored token exists:', !!storedToken);
      console.log('Stored user:', storedUser);

      // ✅ Update Redux state
      dispatch(loginSuccess({ user, token: accessToken }));
      console.log('✅ Redux updated - User logged in');

      Alert.alert('Success', 'Account created successfully!', [{ text: 'OK' }]);

    } catch (error) {
      console.error('=== USERNAME CREATION ERROR ===');
      console.error('Error:', error.message);
      console.error('Response:', error.response?.data);

      const errorMessage = error.response?.data?.error || 'Could not create account. Please try again.';
      setError(errorMessage);
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
          style={[
            styles.input, 
            { 
              borderColor: error ? '#EF4444' : theme.colors.border, 
              color: theme.colors.text,
              backgroundColor: theme.colors.surface,
            }
          ]}
          placeholder="Username"
          placeholderTextColor={theme.colors.textSecondary}
          value={username}
          onChangeText={(text) => {
            setUsername(text);
            if (error) setError('');
          }}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />

        <TextInput
          style={[
            styles.input, 
            { 
              borderColor: error ? '#EF4444' : theme.colors.border, 
              color: theme.colors.text,
              backgroundColor: theme.colors.surface,
            }
          ]}
          placeholder="Password (min 6 characters)"
          placeholderTextColor={theme.colors.textSecondary}
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            if (error) setError('');
          }}
          secureTextEntry
          editable={!loading}
        />

        {error && (
          <Text style={styles.errorText}>⚠️ {error}</Text>
        )}

        <TouchableOpacity 
          style={[
            styles.button, 
            { 
              backgroundColor: theme.colors.primary,
              opacity: loading ? 0.6 : 1,
            }
          ]} 
          onPress={handleCreateAccount}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Create Account & Login</Text>
          )}
        </TouchableOpacity>

        <Text style={[styles.helperText, { color: theme.colors.textSecondary }]}>
          Username: 3-20 characters, letters, numbers, underscore only
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  content: { 
    flex: 1, 
    justifyContent: 'center', 
    paddingHorizontal: 32 
  },
  title: { 
    fontSize: 32, 
    fontWeight: '700', 
    marginBottom: 8, 
    textAlign: 'center' 
  },
  subtitle: { 
    fontSize: 16, 
    marginBottom: 48, 
    textAlign: 'center',
    lineHeight: 22,
  },
  input: { 
    height: 55, 
    width: '100%', 
    borderWidth: 1.5, 
    borderRadius: 12, 
    paddingHorizontal: 16, 
    fontSize: 16, 
    marginBottom: 20 
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    marginBottom: 16,
    marginTop: -8,
    textAlign: 'center',
  },
  button: { 
    height: 55, 
    justifyContent: 'center', 
    alignItems: 'center',
    paddingHorizontal: 32, 
    borderRadius: 12, 
    width: '100%', 
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: { 
    color: '#FFFFFF', 
    fontSize: 16, 
    fontWeight: '600', 
    textAlign: 'center' 
  },
  helperText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
});

export default CreateUsernameScreen;
