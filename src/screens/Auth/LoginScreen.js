// src/screens/Auth/LoginScreen.js
import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  ActivityIndicator, Alert, Animated, Platform, Keyboard
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../contexts/ThemeContext';
import { getTheme } from '../../styles/theme';
import api from '../../services/api';

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
    console.error('Error getting device ID:', error);
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
  const [error, setError] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  
  // Animation values
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(50)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.9)).current;

  // Entrance animations
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Detect authentication method
  const method = useMemo(() => {
    const trimmed = identifier.trim();
    if (!trimmed) return null;
    return trimmed.includes('@') ? 'email' : 'phone';
  }, [identifier]);

  // Clear error when user types
  useEffect(() => {
    if (error) setError('');
  }, [identifier]);

  // ==================== INPUT VALIDATION ====================
  const validateInput = () => {
    const trimmed = identifier.trim();
    
    if (!trimmed) {
      return {
        valid: false,
        message: 'Please enter your email or phone number'
      };
    }

    if (method === 'email' && !validateEmail(trimmed)) {
      return {
        valid: false,
        message: 'Please enter a valid email address'
      };
    }
    
    if (method === 'phone' && !validatePhone(trimmed)) {
      return {
        valid: false,
        message: 'Please enter a valid phone number (at least 10 digits)'
      };
    }

    return { valid: true };
  };

  // ==================== AUTHENTICATION HANDLER ====================
  const handleInitiateAuth = async () => {
    const validation = validateInput();
    if (!validation.valid) {
      setError(validation.message);
      Alert.alert('Validation Error', validation.message);
      return;
    }

    setLoading(true);
    setError('');
    Keyboard.dismiss();

    try {
      const deviceId = await getOrCreateDeviceId();
      const sanitizedIdentifier = sanitizeInput(identifier);

      const response = await api.post('/auth/initiate', {
        identifier: sanitizedIdentifier,
        method,
        deviceId,
        platform: Platform.OS,
      });

      navigation.navigate('VerifyOTP', { 
        identifier: sanitizedIdentifier, 
        method 
      });

    } catch (error) {
      const errorMessage = error.response?.data?.error 
        || error.response?.data?.message 
        || 'Unable to connect. Please check your internet connection and try again.';
      
      setError(errorMessage);
      Alert.alert('Authentication Error', errorMessage);
      console.error('Auth initiation error:', error);
    } finally {
      setLoading(false);
    }
  };

  // ==================== RENDER ====================
  return (
    <SafeAreaView 
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      accessible={true}
    >
      <Animated.View 
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [
              { translateY: slideAnim },
              { scale: scaleAnim }
            ]
          }
        ]}
      >
        {/* Logo/Icon Section */}
        <View style={styles.logoContainer}>
          <View style={[styles.logoCircle, { backgroundColor: theme.colors.primary }]}>
            <Text style={styles.logoText}>P</Text>
          </View>
        </View>

        {/* Header */}
        <View style={styles.headerSection}>
          <Text 
            style={[styles.title, { color: theme.colors.text }]}
            accessibilityRole="header"
          >
            Welcome to Pulse
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Enter your email or phone number to continue
          </Text>
        </View>

        {/* Input Section */}
        <View style={styles.inputSection}>
          <View style={styles.inputContainer}>
            <View 
              style={[
                styles.inputWrapper,
                {
                  borderColor: error 
                    ? '#EF4444' 
                    : isFocused 
                    ? theme.colors.primary 
                    : theme.colors.border,
                  backgroundColor: theme.colors.surface,
                  borderWidth: isFocused ? 2 : 1.5,
                }
              ]}
            >
              <View style={styles.inputIconContainer}>
                <Text style={styles.inputIcon}>
                  {method === 'email' ? '📧' : method === 'phone' ? '📱' : '👤'}
                </Text>
              </View>
              
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                placeholder="Email or Phone Number"
                placeholderTextColor={theme.colors.textSecondary}
                value={identifier}
                onChangeText={setIdentifier}
                keyboardType={method === 'phone' ? 'phone-pad' : 'email-address'}
                autoComplete={method === 'phone' ? 'tel' : 'email'}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                returnKeyType="done"
                onSubmitEditing={handleInitiateAuth}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                accessible={true}
                accessibilityLabel="Email or phone number input"
                accessibilityHint="Enter your email address or phone number to continue"
              />
            </View>
            
            {/* Method Indicator */}
            {method && identifier.trim() && !error && (
              <Animated.Text 
                style={[styles.methodIndicator, { color: theme.colors.primary }]}
              >
                ✓ {method === 'email' ? 'Email detected' : 'Phone number detected'}
              </Animated.Text>
            )}
            
            {/* Error Message */}
            {error && (
              <Animated.Text 
                style={styles.errorText} 
                accessibilityLiveRegion="polite"
              >
                ⚠️ {error}
              </Animated.Text>
            )}
          </View>

          {/* Continue Button */}
          <TouchableOpacity
            style={[
              styles.loginButton, 
              { 
                backgroundColor: theme.colors.primary,
                opacity: (loading || !identifier.trim()) ? 0.6 : 1,
              }
            ]}
            onPress={handleInitiateAuth}
            disabled={loading || !identifier.trim()}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Continue"
            accessibilityHint="Tap to proceed with authentication"
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <View style={styles.buttonContent}>
                <Text style={styles.loginButtonText}>Continue</Text>
                <Text style={styles.buttonArrow}>→</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.helperText, { color: theme.colors.textSecondary }]}>
            We'll send you a verification code
          </Text>
          
          <View style={styles.securityBadge}>
            <Text style={styles.securityIcon}>🔒</Text>
            <Text style={[styles.securityText, { color: theme.colors.textSecondary }]}>
              Secure & encrypted
            </Text>
          </View>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
};

// ==================== STYLES ====================
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
    marginBottom: 32,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  logoText: {
    fontSize: 40,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSection: {
    marginBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  inputSection: {
    marginBottom: 24,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 58,
    borderRadius: 14,
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inputIconContainer: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputIcon: {
    fontSize: 24,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingRight: 16,
    height: '100%',
  },
  methodIndicator: {
    fontSize: 13,
    marginTop: 8,
    marginLeft: 4,
    fontWeight: '500',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    marginTop: 8,
    marginLeft: 4,
  },
  loginButton: {
    height: 58,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    marginRight: 8,
  },
  buttonArrow: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
  },
  footer: {
    marginTop: 32,
    alignItems: 'center',
  },
  helperText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
  },
  securityIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  securityText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default LoginScreen;
