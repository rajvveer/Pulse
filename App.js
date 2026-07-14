import React, { useEffect, useState, useRef } from 'react';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
// ✅ IMPORT initialWindowMetrics
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { ActivityIndicator, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { store } from './src/redux/store';
import { loginSuccess, setUser } from './src/redux/slices/authSlice';
import api from './src/services/api';
import { RootNavigator } from './src/navigation';
import { navigationRef } from './src/navigation/navigationRef';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { ThemeStatusBar } from './src/components/UI/ThemeStatusBar';
import pushNotifications from './src/services/pushNotifications';

// ERROR BOUNDARY TO CATCH CRASHES
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
  }

  handleRestart = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (__DEV__) {
        return (
          <View style={{ flex: 1, padding: 20, backgroundColor: '#1a1a2e', justifyContent: 'center' }}>
            <ScrollView>
              <Text style={{ color: '#ff6b6b', fontSize: 20, fontWeight: 'bold', marginBottom: 10 }}>
                🔴 App Crashed!
              </Text>
              <Text style={{ color: '#fff', fontSize: 14, marginBottom: 10 }}>
                Error: {this.state.error?.message || String(this.state.error)}
              </Text>
              <Text style={{ color: '#888', fontSize: 12 }}>
                {this.state.error?.stack}
              </Text>
              <Text style={{ color: '#888', fontSize: 12, marginTop: 10 }}>
                Component Stack: {this.state.errorInfo?.componentStack}
              </Text>
            </ScrollView>
          </View>
        );
      }

      return (
        <View style={{ flex: 1, padding: 32, backgroundColor: '#0F1419', justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>😵</Text>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8 }}>
            Something went wrong
          </Text>
          <Text style={{ color: '#888', fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>
            Pulse ran into an unexpected issue. Please try again.
          </Text>
          <TouchableOpacity
            onPress={this.handleRestart}
            style={{ backgroundColor: '#1E88E5', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 }}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

// ✅ Check login on app start
const AuthLoader = ({ children }) => {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkLogin = async () => {
      try {
        const token = await AsyncStorage.getItem('accessToken');
        const userStr = await AsyncStorage.getItem('user');

        if (token && userStr) {
          const user = JSON.parse(userStr);
          dispatch(loginSuccess({ user, token }));

          // Refresh the user from the server so cached sessions pick up fields
          // added/changed since last login (e.g. profile.avatar) instead of
          // showing stale data until the next manual profile visit.
          api.get('/auth/me')
            .then((res) => {
              const fresh = res.data?.user;
              if (fresh) {
                dispatch(setUser(fresh));
                AsyncStorage.setItem('user', JSON.stringify(fresh)).catch(() => {});
              }
            })
            .catch(() => { /* offline / token expiring — keep cached user */ });

          // Initialize push notifications after login
          pushNotifications.initializePushNotifications()
            .catch(() => { });
        }
      } catch (error) {
        console.error('Error checking login:', error);
      } finally {
        setLoading(false);
      }
    };

    checkLogin();
  }, [dispatch]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F7F9FC' }}>
        <ActivityIndicator size="large" color="#1E88E5" />
      </View>
    );
  }

  return children;
};

// Navigation Theme Wrapper Component
const NavigationTheme = ({ children }) => {
  const { isDark } = useTheme();

  const customLightTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: '#1E88E5',
      background: '#F7F9FC',
      card: '#FFFFFF',
      text: '#0F1724',
      border: '#E1E5E9',
    },
  };

  const customDarkTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: '#42A5F5',
      background: '#0F1419',
      card: '#1A1F25',
      text: '#E1E5E9',
      border: '#374151',
    },
  };

  // Deep linking configuration
  const linking = {
    prefixes: ['pulse://', 'https://getpulse.app'],
    config: {
      screens: {
        Main: {
          screens: {
            Feed: 'feed',
            Nearby: 'nearby',
            Reels: 'reels',
            Whisper: 'whisper',
            Chat: 'chat',
          },
        },
        PostDetail: 'post/:postId',
        UserProfile: 'profile/:username',
        Roulette: 'roulette',
        Bookmarks: 'bookmarks',
        AlterEgo: 'alter-ego',
        PulseDrops: 'drops',
        Chains: 'chains',
        Search: 'search',
        Auth: 'auth',
      },
    },
  };

  return (
    <NavigationContainer theme={isDark ? customDarkTheme : customLightTheme} linking={linking}>
      {children}
    </NavigationContainer>
  );
};

// Main App Component

export default function App() {

  return (
    <ErrorBoundary>
      <SafeAreaProvider initialWindowMetrics={initialWindowMetrics}>
        <Provider store={store}>
          <ThemeProvider>
            <ThemeStatusBar />
            <AuthLoader>
              <NavigationTheme>
                <RootNavigator />
              </NavigationTheme>
            </AuthLoader>
          </ThemeProvider>
        </Provider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}