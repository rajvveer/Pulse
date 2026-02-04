import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  ActivityIndicator, Alert, Animated, Platform, Keyboard,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../contexts/ThemeContext';
import { getTheme } from '../../styles/theme';
import api from '../../services/api';
import { useGoogleAuth, getGoogleUserInfo, getDeviceId } from '../../services/firebase';

const { width } = Dimensions.get('window');

// ==================== VALIDATION UTILITIES ====================
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

const validatePhone = (phone) => {
  const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  return phoneRegex.test(cleaned) && cleaned.length >= 10;
};

const sanitizeInput = (input) => {
  return input.trim().toLowerCase();
};

// ==================== DEVICE ID UTILITY ====================
const getOrCreateDeviceId = async () => {
  try {
    let deviceId = await AsyncStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      await AsyncStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  } catch (error) {
    return `session-${Date.now()}`;
  }
};

// ==================== MAIN COMPONENT ====================
const LoginScreen = () => {
  const navigation = useNavigation();
  const { isDark } = useTheme();
  const theme = getTheme(isDark);

  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  // Google Auth Hook (Expo)
  const [request, response, promptAsync] = useGoogleAuth();

  // Animation values
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(50)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Handle Google Auth Response
  useEffect(() => {
    if (response?.type === 'success') {
      handleGoogleAuthSuccess(response.authentication.accessToken);
    } else if (response?.type === 'error') {
      setGoogleLoading(false);
      setError('Google sign in failed');
    } else if (response?.type === 'dismiss') {
      setGoogleLoading(false);
    }
  }, [response]);

  // ==================== FIXED LOGIC ====================
  const method = useMemo(() => {
    const trimmed = identifier.trim();
    if (!trimmed) return null;
    const isPhoneStart = /^[0-9+]/.test(trimmed);
    return isPhoneStart ? 'phone' : 'email';
  }, [identifier]);

  useEffect(() => {
    if (error) setError('');
  }, [identifier]);

  // ==================== OTP AUTH ====================
  const handleInitiateAuth = async () => {
    const trimmed = identifier.trim();

    if (!trimmed) {
      setError('Please enter your email or phone number');
      return;
    }

    if (method === 'email' && !validateEmail(trimmed)) {
      setError('Please enter a valid email address');
      return;
    }

    if (method === 'phone' && !validatePhone(trimmed)) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    Keyboard.dismiss();

    try {
      const deviceId = await getOrCreateDeviceId();
      const sanitizedIdentifier = sanitizeInput(identifier);

      await api.post('/auth/initiate', {
        identifier: sanitizedIdentifier,
        method,
        deviceId,
        platform: Platform.OS,
      });

      navigation.navigate('VerifyOTP', { identifier: sanitizedIdentifier, method });

    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Connection failed. Please try again.';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // ==================== GOOGLE SIGN-IN ====================
  const handleGoogleSignIn = () => {
    setGoogleLoading(true);
    setError('');
    promptAsync();
  };

  const handleGoogleAuthSuccess = async (accessToken) => {
    try {
      // Get user info from Google
      const userInfo = await getGoogleUserInfo(accessToken);

      // Get device ID
      const deviceId = await getDeviceId();

      // Send to backend - using access token approach
      const response = await api.post('/auth/firebase-login', {
        idToken: accessToken, // We send access token, backend should verify with Google
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        googleId: userInfo.id,
        deviceId,
        platform: Platform.OS,
        deviceName: `${userInfo.name || 'User'}'s Device`,
      });

      const { accessToken: appToken, refreshToken, user: userData, requiresUsername } = response.data;

      // Store tokens
      await AsyncStorage.setItem('accessToken', appToken);
      await AsyncStorage.setItem('refreshToken', refreshToken);

      // Navigate based on whether username is set
      if (requiresUsername) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'CreateUsername', params: { tempToken: appToken } }],
        });
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Main' }],
        });
      }

    } catch (error) {
      console.error('Google Auth Error:', error);
      const errorMessage = error.response?.data?.error || 'Google sign in failed';
      setError(errorMessage);
      Alert.alert('Sign In Failed', errorMessage);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Animated.View
        style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}
      >
        {/* LOGO SECTION */}
        <View style={styles.logoContainer}>
          <Animated.View
            style={[
              styles.logoCircle,
              {
                backgroundColor: theme.colors.primary,
                transform: [{ scale: scaleAnim }]
              }
            ]}
          >
            <Text style={styles.logoText}>P</Text>
          </Animated.View>
        </View>

        {/* Header */}
        <View style={styles.headerSection}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Welcome to Pulse
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Enter your details to continue
          </Text>
        </View>

        {/* Input Section */}
        <View style={styles.inputSection}>
          <View style={[
            styles.inputContainer,
            {
              backgroundColor: isDark ? '#1A1A1A' : '#F7F7F8',
              borderColor: error ? '#FF4B4B' : isFocused ? theme.colors.primary : 'transparent',
              borderWidth: 2,
              shadowColor: isFocused ? theme.colors.primary : '#000',
              shadowOpacity: isFocused ? 0.15 : 0,
              shadowRadius: 10,
              elevation: isFocused ? 4 : 0,
            }
          ]}>
            <View style={styles.leftIcon}>
              <Text style={{ fontSize: 20 }}>
                {method === 'phone' ? '📱' : method === 'email' ? '📧' : '👤'}
              </Text>
            </View>

            <TextInput
              style={[styles.input, { color: theme.colors.text }]}
              placeholder="Email or Phone Number"
              placeholderTextColor={theme.colors.textSecondary}
              value={identifier}
              onChangeText={setIdentifier}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading && !googleLoading}
              returnKeyType="done"
              onSubmitEditing={handleInitiateAuth}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
            />
          </View>

          {/* Error Message */}
          <View style={styles.errorContainer}>
            {error ? (
              <Text style={styles.errorText}>⚠️ {error}</Text>
            ) : null}
          </View>

          {/* Continue Button */}
          <TouchableOpacity
            style={[
              styles.loginButton,
              {
                backgroundColor: theme.colors.primary,
                opacity: (loading || googleLoading || !identifier.trim()) ? 0.6 : 1,
                shadowColor: theme.colors.primary,
              }
            ]}
            onPress={handleInitiateAuth}
            disabled={loading || googleLoading || !identifier.trim()}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.loginButtonText}>Continue</Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
            <Text style={[styles.dividerText, { color: theme.colors.textSecondary }]}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
          </View>

          {/* Google Sign-In Button */}
          <TouchableOpacity
            style={[
              styles.googleButton,
              {
                backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF',
                borderColor: isDark ? '#333' : '#E0E0E0',
                opacity: (googleLoading || !request) ? 0.7 : 1,
              }
            ]}
            onPress={handleGoogleSignIn}
            disabled={loading || googleLoading || !request}
            activeOpacity={0.8}
          >
            {googleLoading ? (
              <ActivityIndicator color={theme.colors.text} />
            ) : (
              <>
                <Text style={styles.googleIcon}>G</Text>
                <Text style={[styles.googleButtonText, { color: theme.colors.text }]}>
                  Continue with Google
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
            Secure Login with Pulse
          </Text>
        </View>

      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 10,
  },
  logoText: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    includeFontPadding: false,
  },
  headerSection: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.8,
  },
  inputSection: {
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
    borderRadius: 18,
    paddingHorizontal: 16,
  },
  leftIcon: {
    marginRight: 14,
    width: 24,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: 17,
    fontWeight: '500',
    height: '100%',
  },
  errorContainer: {
    height: 24,
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  errorText: {
    color: '#FF4B4B',
    fontSize: 13,
    fontWeight: '600',
  },
  loginButton: {
    height: 64,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 14,
    fontWeight: '500',
  },
  googleButton: {
    flexDirection: 'row',
    height: 60,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    gap: 12,
  },
  googleIcon: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4285F4',
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    marginTop: 'auto',
    marginBottom: 20,
    alignItems: 'center',
    opacity: 0.6,
  },
  footerText: {
    fontSize: 13,
    fontWeight: '500',
  }
});

export default LoginScreen;