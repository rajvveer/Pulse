// src/screens/Auth/VerifyOTPScreen.js
import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch } from "react-redux";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginSuccess } from "../../redux/slices/authSlice";
import { useTheme } from "../../contexts/ThemeContext";
import { getTheme } from "../../styles/theme";
import api from "../../services/api";

const VerifyOTPScreen = ({ route, navigation }) => {
  const { identifier, method } = route.params;
  
  // State management
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [autoSubmitting, setAutoSubmitting] = useState(false);
  const [autoSubmitCountdown, setAutoSubmitCountdown] = useState(0);
  
  const dispatch = useDispatch();
  const { isDark } = useTheme();
  const theme = getTheme(isDark);

  // Refs for each input box and animations
  const inputRefs = useRef([]);
  const shakeAnimation = useRef(new Animated.Value(0)).current;

  // ==================== COUNTDOWN TIMER ====================
  useEffect(() => {
    let timer;
    if (countdown > 0 && !canResend) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (countdown === 0) {
      setCanResend(true);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [countdown, canResend]);

  // ==================== AUTO-FOCUS ====================
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // ==================== AUTO-SUBMIT WITH COUNTDOWN ====================
  useEffect(() => {
    const otp = otpDigits.join("");
    
    if (otp.length === 6 && !loading) {
      setAutoSubmitting(true);
      setAutoSubmitCountdown(3);
      
      // Countdown interval
      const countdownInterval = setInterval(() => {
        setAutoSubmitCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      // Auto-submit timer (3 seconds)
      const submitTimer = setTimeout(() => {
        handleVerifyOTP(otp);
        setAutoSubmitting(false);
      }, 3000);
      
      return () => {
        clearTimeout(submitTimer);
        clearInterval(countdownInterval);
        setAutoSubmitting(false);
        setAutoSubmitCountdown(0);
      };
    } else {
      setAutoSubmitting(false);
      setAutoSubmitCountdown(0);
    }
  }, [otpDigits, loading]);

  // ==================== DEVICE ID ====================
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

  // ==================== INPUT CHANGE HANDLER ====================
  const handleChangeText = (text, index) => {
    if (error) setError("");

    if (text.length > 1) {
      const pastedDigits = text.slice(0, 6).split("");
      const newOtpDigits = [...otpDigits];
      
      pastedDigits.forEach((digit, i) => {
        if (index + i < 6 && /^[0-9]$/.test(digit)) {
          newOtpDigits[index + i] = digit;
        }
      });
      
      setOtpDigits(newOtpDigits);
      
      const nextIndex = Math.min(index + pastedDigits.length, 5);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    if (text && !/^[0-9]$/.test(text)) {
      return;
    }

    const newOtpDigits = [...otpDigits];
    newOtpDigits[index] = text;
    setOtpDigits(newOtpDigits);

    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // ==================== BACKSPACE HANDLER ====================
  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === "Backspace") {
      if (!otpDigits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      } else if (otpDigits[index]) {
        const newOtpDigits = [...otpDigits];
        newOtpDigits[index] = "";
        setOtpDigits(newOtpDigits);
      }
    }
  };

  // ==================== SHAKE ANIMATION ====================
  const triggerShakeAnimation = () => {
    Animated.sequence([
      Animated.timing(shakeAnimation, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: -10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: 0,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // ==================== VERIFY OTP ====================
  const handleVerifyOTP = async (otpValue) => {
    const otp = otpValue || otpDigits.join("");

    if (otp.length !== 6) {
      setError("Please enter the complete 6-digit code");
      triggerShakeAnimation();
      return;
    }

    setLoading(true);
    setError("");
    setAutoSubmitting(false);
    Keyboard.dismiss();

    try {
      const deviceId = await getDeviceId();

      const response = await api.post("/auth/verify-otp", {
        identifier,
        otp,
        method,
        deviceId,
        platform: Platform.OS,
      });

      console.log('=== OTP VERIFY RESPONSE ===');
      console.log('Full response:', JSON.stringify(response.data, null, 2));

      const { user, nextStep, tokens } = response.data || {};
      const { accessToken, refreshToken } = tokens || {};

      console.log('Parsed data:');
      console.log('- user:', user);
      console.log('- nextStep:', nextStep);
      console.log('- accessToken:', accessToken ? 'EXISTS' : 'MISSING');
      console.log('- refreshToken:', refreshToken ? 'EXISTS' : 'MISSING');

      if (nextStep === "create_username") {
        console.log('→ Navigating to CreateUsername');
        navigation.replace("CreateUsername", {
          tempToken: response.data.tempToken,
        });
      } else {
        // ✅ Existing user - login successful
        console.log('=== STORING USER DATA ===');
        
        // Store access token
        if (accessToken) {
          await AsyncStorage.setItem('accessToken', accessToken);
          console.log('✅ accessToken stored');
        } else {
          console.log('❌ No accessToken to store');
        }
        
        // Store refresh token
        if (refreshToken) {
          await AsyncStorage.setItem('refreshToken', refreshToken);
          console.log('✅ refreshToken stored');
        } else {
          console.log('⚠️ No refreshToken provided');
        }
        
        // Store user
        if (user) {
          await AsyncStorage.setItem('user', JSON.stringify(user));
          console.log('✅ user stored:', user);
        } else {
          console.log('❌ No user to store');
        }

        // ✅ Verify storage
        const storedToken = await AsyncStorage.getItem('accessToken');
        const storedUser = await AsyncStorage.getItem('user');
        console.log('=== VERIFICATION ===');
        console.log('Stored token exists:', !!storedToken);
        console.log('Stored user:', storedUser);

        // Update Redux
        dispatch(loginSuccess({ user, token: accessToken }));
        console.log('✅ Redux updated');

        Alert.alert("Success", "Login successful!", [{ text: "OK" }]);
      }
    } catch (error) {
      console.error('=== OTP VERIFICATION ERROR ===');
      console.error('Error:', error.message);
      console.error('Response:', error.response?.data);
      
      const errorMessage =
        error.response?.data?.error || "Invalid or expired OTP. Please try again.";

      setError(errorMessage);
      triggerShakeAnimation();

      setOtpDigits(["", "", "", "", "", ""]);
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 300);
    } finally {
      setLoading(false);
    }
  };

  // ==================== RESEND OTP ====================
  const handleResendOTP = async () => {
    if (!canResend || resendLoading) return;

    setResendLoading(true);
    setError("");

    try {
      await api.post("/auth/resend-otp", {
        identifier,
        method,
      });

      setOtpDigits(["", "", "", "", "", ""]);
      setCountdown(60);
      setCanResend(false);
      
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);

      Alert.alert(
        "OTP Resent",
        `A new verification code has been sent to ${identifier}`,
        [{ text: "OK" }]
      );
    } catch (error) {
      const errorMessage =
        error.response?.data?.error || "Failed to resend OTP. Please try again.";
      setError(errorMessage);
    } finally {
      setResendLoading(false);
    }
  };

  // ==================== CANCEL AUTO-SUBMIT ====================
  const handleCancelAutoSubmit = () => {
    setAutoSubmitting(false);
    setAutoSubmitCountdown(0);
  };

  // ==================== MANUAL VERIFY ====================
  const handleManualVerify = () => {
    handleCancelAutoSubmit();
    handleVerifyOTP();
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.content}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            accessibilityLabel="Go back"
            accessible={true}
          >
            <Text style={[styles.backButtonText, { color: theme.colors.text }]}>
              ←
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.titleSection}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Enter Verification Code
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            We've sent a 6-digit code to
          </Text>
          <Text style={[styles.identifier, { color: theme.colors.primary }]}>
            {identifier}
          </Text>
        </View>

        <Animated.View
          style={[
            styles.otpContainer,
            { transform: [{ translateX: shakeAnimation }] },
          ]}
        >
          {otpDigits.map((digit, index) => (
            <View
              key={index}
              style={[
                styles.otpBox,
                {
                  borderColor: error
                    ? "#EF4444"
                    : digit
                    ? theme.colors.primary
                    : theme.colors.border,
                  backgroundColor: theme.colors.surface,
                },
              ]}
            >
              <TextInput
                ref={(ref) => (inputRefs.current[index] = ref)}
                style={[styles.otpInput, { color: theme.colors.text }]}
                value={digit}
                onChangeText={(text) => handleChangeText(text, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                editable={!loading}
                accessible={true}
                accessibilityLabel={`OTP digit ${index + 1}`}
                accessibilityHint={`Enter digit ${index + 1} of 6`}
              />
            </View>
          ))}
        </Animated.View>

        {autoSubmitting && (
          <View style={styles.autoSubmitContainer}>
            <ActivityIndicator 
              size="small" 
              color={theme.colors.primary}
              style={styles.autoSubmitSpinner}
            />
            <Text style={[styles.autoSubmitText, { color: theme.colors.primary }]}>
              Auto-verifying in {autoSubmitCountdown}s...
            </Text>
            <TouchableOpacity 
              onPress={handleCancelAutoSubmit}
              style={styles.cancelButton}
            >
              <Text style={[styles.cancelButtonText, { color: theme.colors.textSecondary }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {error && (
          <Text
            style={styles.errorText}
            accessibilityLiveRegion="polite"
            accessible={true}
          >
            ⚠️ {error}
          </Text>
        )}

        <TouchableOpacity
          style={[
            styles.verifyButton,
            {
              backgroundColor: theme.colors.primary,
              opacity: (loading || otpDigits.join("").length !== 6) ? 0.6 : 1,
            },
          ]}
          onPress={handleManualVerify}
          disabled={loading || otpDigits.join("").length !== 6}
          activeOpacity={0.8}
          accessible={true}
          accessibilityLabel="Verify OTP"
          accessibilityHint="Tap to verify your code"
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.verifyButtonText}>Verify & Continue</Text>
          )}
        </TouchableOpacity>

        <View style={styles.resendSection}>
          <Text style={[styles.resendText, { color: theme.colors.textSecondary }]}>
            Didn't receive the code?
          </Text>
          
          <TouchableOpacity
            onPress={handleResendOTP}
            disabled={!canResend || resendLoading}
            style={styles.resendButton}
            accessible={true}
            accessibilityLabel={canResend ? "Resend code" : `Resend code in ${countdown} seconds`}
          >
            {resendLoading ? (
              <ActivityIndicator
                size="small"
                color={theme.colors.primary}
                style={{ marginLeft: 8 }}
              />
            ) : (
              <Text
                style={[
                  styles.resendButtonText,
                  {
                    color: canResend
                      ? theme.colors.primary
                      : theme.colors.textSecondary,
                    opacity: canResend ? 1 : 0.5,
                  },
                ]}
              >
                {canResend ? "Resend Code" : `Resend in ${countdown}s`}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={[styles.helperText, { color: theme.colors.textSecondary }]}>
          {method === "email"
            ? "Check your email inbox and spam folder"
            : "The code expires in 5 minutes"}
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ==================== STYLES ====================
const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24 },
  header: { paddingTop: 8, paddingBottom: 16 },
  backButton: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  backButtonText: { fontSize: 28, fontWeight: "300" },
  titleSection: { marginTop: 20, marginBottom: 40 },
  title: { fontSize: 28, fontWeight: "700", marginBottom: 12 },
  subtitle: { fontSize: 15, marginBottom: 4, lineHeight: 22 },
  identifier: { fontSize: 16, fontWeight: "600", marginTop: 4 },
  otpContainer: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16, paddingHorizontal: 8 },
  otpBox: { width: 50, height: 60, borderWidth: 2, borderRadius: 12, justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  otpInput: { fontSize: 24, fontWeight: "700", textAlign: "center", width: "100%", height: "100%", padding: 0 },
  autoSubmitContainer: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 16, marginBottom: 8 },
  autoSubmitSpinner: { marginRight: 8 },
  autoSubmitText: { fontSize: 14, fontWeight: "500" },
  cancelButton: { marginLeft: 12, paddingHorizontal: 8, paddingVertical: 4 },
  cancelButtonText: { fontSize: 13, fontWeight: "600", textDecorationLine: "underline" },
  errorText: { color: "#EF4444", fontSize: 13, textAlign: "center", marginBottom: 16, marginTop: 8 },
  verifyButton: { height: 54, borderRadius: 12, justifyContent: "center", alignItems: "center", marginTop: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  verifyButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  resendSection: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 24, flexWrap: "wrap" },
  resendText: { fontSize: 14 },
  resendButton: { marginLeft: 8 },
  resendButtonText: { fontSize: 14, fontWeight: "600" },
  helperText: { fontSize: 12, textAlign: "center", marginTop: 32, lineHeight: 18 },
});

export default VerifyOTPScreen;
