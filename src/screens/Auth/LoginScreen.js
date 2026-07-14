import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  ActivityIndicator, Alert, Animated, Platform, Keyboard,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginSuccess } from '../../redux/slices/authSlice';
import { useTheme } from '../../contexts/ThemeContext';
import { getTheme } from '../../styles/theme';
import api, { API_URL } from '../../services/api';
import { signInWithGoogle, getDeviceId } from '../../services/firebase';

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

// ==================== NETWORK DIAGNOSTIC ====================
const checkNetworkConnectivity = async () => {
  console.log('🔍 [Network] Starting connectivity diagnostic...');

  // Test 1: Check if general internet works (Google)
  let internetWorks = false;
  try {
    const googleTest = await fetch('https://www.google.com/generate_204', {
      method: 'HEAD',
      cache: 'no-cache',
    });
    internetWorks = googleTest.ok || googleTest.status === 204;
    console.log('✅ [Network] Google reachable:', internetWorks);
  } catch (e) {
    console.log('❌ [Network] Google NOT reachable:', e.message);
  }

  // Test 2: Check if Railway backend is reachable
  let backendWorks = false;
  try {
    const backendBaseUrl = API_URL.replace(/\/api\/v1\/?$/, '');
    const backendTest = await fetch(`${backendBaseUrl}/health`, {
      method: 'GET',
      cache: 'no-cache',
      headers: { 'Content-Type': 'application/json' },
    });
    backendWorks = backendTest.ok;
    console.log('✅ [Network] Backend reachable:', backendWorks);
  } catch (e) {
    console.log('❌ [Network] Backend NOT reachable:', e.message);
  }

  return { internetWorks, backendWorks };
};

// ==================== MAIN COMPONENT ====================
const LoginScreen = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { isDark } = useTheme();
  const theme = getTheme(isDark);

  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  // Animation values
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(50)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.3)).current;

  // Run initial animations
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
      console.log('❌ [Login] Error:', error.message, error.code);

      // Check if this is a network error (no response from server)
      if (!error.response) {
        console.log('🔍 [Login] No response - running network diagnostic...');

        // Run diagnostic to determine exact issue
        const { internetWorks, backendWorks } = await checkNetworkConnectivity();

        if (internetWorks && !backendWorks) {
          // Internet works but backend doesn't = carrier blocking
          const carrierError = 'Your mobile network may be blocking our servers. Please try:\n\n' +
            '1. Switch to WiFi\n' +
            '2. Try a different mobile network\n' +
            '3. Use a VPN app';
          setError('Network blocked by carrier');
          Alert.alert(
            '📵 Connection Blocked',
            carrierError,
            [{ text: 'OK' }]
          );
        } else if (!internetWorks) {
          // No internet at all
          setError('No internet connection');
          Alert.alert('No Connection', 'Please check your internet connection and try again.');
        } else {
          // Both work but still failed - temporary issue
          setError('Connection failed. Please try again.');
          Alert.alert('Error', 'Connection failed. Please try again in a moment.');
        }
      } else {
        // Server responded with error
        const errorMessage = error.response?.data?.error || 'Connection failed. Please try again.';
        setError(errorMessage);
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  // ==================== GOOGLE SIGN-IN ====================
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError('');
    
    try {
      const result = await signInWithGoogle();
      await handleGoogleAuthSuccess(result);
    } catch (error) {
      setGoogleLoading(false);
      // We don't need to show an error if they just cancelled the dialog
      if (error.code !== 'SIGN_IN_CANCELLED') {
        setError('Google sign in failed');
      }
    }
  };

  const handleGoogleAuthSuccess = async (result) => {
    try {
      const { userInfo, idToken, accessToken } = result;

      // Get device ID
      const deviceId = await getDeviceId();

      // Send to backend - send both tokens, backend will try both verification strategies
      const authResponse = await api.post('/auth/firebase-login', {
        idToken: idToken, 
        accessToken: accessToken,
        email: userInfo.email,
        name: userInfo.name || userInfo.givenName,
        picture: userInfo.photo,
        googleId: userInfo.id,
        deviceId,
        platform: Platform.OS,
        deviceName: `${userInfo.name || 'User'}'s Device`,
      });

      const data = authResponse.data;
      
      // Handle response - backend may return tokens nested or flat
      const appToken = data.accessToken || data.tokens?.accessToken;
      const appRefreshToken = data.refreshToken || data.tokens?.refreshToken;
      const requiresUsername = data.requiresUsername || data.nextStep === 'create_username';
      const tempToken = data.tempToken;
      const user = data.user;

      if (!appToken && !tempToken) {
        throw new Error('No authentication token received from server');
      }

      // Store tokens
      if (appToken) {
        await AsyncStorage.setItem('accessToken', appToken);
      }
      if (appRefreshToken) {
        await AsyncStorage.setItem('refreshToken', appRefreshToken);
      }

      // ✅ FIX: Store user data in AsyncStorage (was missing - caused message sender/receiver swap)
      if (user) {
        await AsyncStorage.setItem('user', JSON.stringify(user));
        console.log('✅ Google auth: user stored in AsyncStorage:', user.id || user._id);
      }

      // Navigate based on whether username is set
      if (requiresUsername) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'CreateUsername', params: { tempToken: tempToken || appToken } }],
        });
      } else {
        // ✅ FIX: Dispatch loginSuccess to Redux (was missing - user object was null in Redux)
        if (user && appToken) {
          dispatch(loginSuccess({ user, token: appToken }));
          console.log('✅ Google auth: Redux state updated with user:', user.id || user._id);
        }

        navigation.reset({
          index: 0,
          routes: [{ name: 'Main' }],
        });
      }

    } catch (error) {
      console.error('Google Auth Error:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Google sign in failed';
      setError(errorMessage);
      Alert.alert('Sign In Failed', errorMessage);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#100C20' : '#F1EFFF' }]} edges={['top', 'left', 'right']}>
      <Animated.View
        style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}
      >
        <LinearGradient
          colors={isDark ? ['#17132D', '#332472'] : ['#241653', '#6043CF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Animated.View style={[styles.centerBrand, { transform: [{ scale: scaleAnim }] }]}>
            <View style={styles.brandMark}><Text style={styles.brandMarkText}>P</Text></View>
            <Text style={styles.brandText}>pulse</Text>
          </Animated.View>
        </LinearGradient>

        <View style={[styles.authCard, { backgroundColor: isDark ? '#17131F' : '#FFFFFF' }]}>
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
            Jump back in
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            One step away from your people.
          </Text>
        </View>

        {/* Input Section */}
        <View style={styles.inputSection}>
          <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>EMAIL OR PHONE</Text>
          <View style={[
            styles.inputContainer,
            {
              backgroundColor: isDark ? '#211C2A' : '#FFFFFF',
              borderColor: error ? '#FF4B4B' : isFocused ? '#6C32E5' : (isDark ? '#393143' : '#E8E5ED'),
              borderWidth: 1,
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
              placeholder="you@example.com"
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
                opacity: (loading || googleLoading || !identifier.trim()) ? 0.6 : 1,
                shadowColor: '#6C32E5',
              }
            ]}
            onPress={handleInitiateAuth}
            disabled={loading || googleLoading || !identifier.trim()}
            activeOpacity={0.8}
          >
            <LinearGradient colors={['#5B36F2', '#7A5AF8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.buttonGradient}>
              {loading ? <ActivityIndicator color="#FFFFFF" /> : <View style={styles.continueRow}><Text style={styles.loginButtonText}>Continue</Text><Text style={styles.continueArrow}>→</Text></View>}
            </LinearGradient>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
            <Text style={[styles.dividerText, { color: theme.colors.textSecondary }]}>OR</Text>
            <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
          </View>

          {/* Google Sign-In Button */}
          <TouchableOpacity
            style={[
              styles.googleButton,
              {
                backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF',
                borderColor: isDark ? '#333' : '#E0E0E0',
                opacity: googleLoading ? 0.7 : 1,
              }
            ]}
            onPress={handleGoogleSignIn}
            disabled={loading || googleLoading}
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
  },
  hero: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  centerBrand: {
    flexDirection: 'row', alignItems: 'center', marginTop: -10,
  },
  brandMark: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
  },
  brandMarkText: {
    color: '#5B36F2', fontSize: 18, fontWeight: '900', includeFontPadding: false,
  },
  brandText: {
    color: '#FFFFFF', fontSize: 24, fontWeight: '800', letterSpacing: -0.7, marginLeft: 10,
  },
  topRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 3,
  },
  backGlyph: {
    color: '#FFFFFF', fontSize: 27, fontWeight: '300', lineHeight: 30,
  },
  accountPrompt: {
    flexDirection: 'row', alignItems: 'center',
  },
  accountPromptText: {
    color: 'rgba(255,255,255,0.82)', fontSize: 10, marginRight: 8,
  },
  getStartedPill: {
    backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 10, height: 27,
    borderRadius: 7, alignItems: 'center', justifyContent: 'center',
  },
  getStartedText: {
    color: '#FFFFFF', fontSize: 9, fontWeight: '700',
  },
  wordmark: {
    color: '#FFFFFF', fontSize: 28, fontWeight: '800', textAlign: 'center', marginTop: 37, zIndex: 3,
    letterSpacing: -0.8,
  },
  heroLayerOne: {
    position: 'absolute', left: 18, right: 18, height: 38, bottom: -20, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  heroLayerTwo: {
    position: 'absolute', left: 34, right: 34, height: 45, bottom: -27, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  authCard: {
    flex: 1,
    marginTop: -20,
    marginHorizontal: 0,
    marginBottom: 0,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingHorizontal: 24,
    paddingTop: 28,
    zIndex: 4,
    shadowColor: '#2A174D', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3,
  },
  logoContainer: {
    display: 'none',
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
    marginBottom: 22,
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 25,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'left',
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'left',
    opacity: 0.8,
  },
  inputSection: {
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 9, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8, opacity: 0.75,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: 15,
    paddingHorizontal: 15,
  },
  leftIcon: {
    display: 'none',
  },
  input: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    height: '100%',
  },
  errorContainer: {
    height: 25,
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 2,
    paddingHorizontal: 4,
  },
  errorText: {
    color: '#FF4B4B',
    fontSize: 13,
    fontWeight: '600',
  },
  loginButton: {
    height: 55,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 5,
  },
  buttonGradient: {
    flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center',
  },
  continueRow: { flexDirection: 'row', alignItems: 'center' },
  continueArrow: { color: '#FFFFFF', fontSize: 18, marginLeft: 9, marginTop: -1 },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    paddingHorizontal: 12,
    fontSize: 9,
    fontWeight: '500',
  },
  googleButton: {
    flexDirection: 'row',
    height: 53,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    gap: 12,
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4285F4',
  },
  googleButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    display: 'none',
  },
  footerText: {
    fontSize: 10,
    fontWeight: '500',
  }
});

export default LoginScreen;
