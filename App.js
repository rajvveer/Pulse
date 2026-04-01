import React, { useEffect, useState, useRef } from 'react';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
// ✅ IMPORT initialWindowMetrics
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { ActivityIndicator, View, Text, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { store } from './src/redux/store';
import { loginSuccess } from './src/redux/slices/authSlice';
import { RootNavigator } from './src/navigation';
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

  render() {
    if (this.state.hasError) {
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
    return this.props.children;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 3,
    },
  },
});

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
            <QueryClientProvider client={queryClient}>
              <ThemeStatusBar />
              <AuthLoader>
                <NavigationTheme>
                  <RootNavigator />
                </NavigationTheme>
              </AuthLoader>
            </QueryClientProvider>
          </ThemeProvider>
        </Provider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}