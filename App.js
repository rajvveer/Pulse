import React, { useEffect, useState } from 'react';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
// ✅ IMPORT initialWindowMetrics
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { ActivityIndicator, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { store } from './src/redux/store';
import { loginSuccess } from './src/redux/slices/authSlice';
import { RootNavigator } from './src/navigation';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { ThemeStatusBar } from './src/components/UI/ThemeStatusBar';

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
          console.log('✅ User restored from AsyncStorage');
        } else {
          console.log('❌ No stored user found');
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

  return (
    <NavigationContainer theme={isDark ? customDarkTheme : customLightTheme}>
      {children}
    </NavigationContainer>
  );
};

export default function App() {
  return (
    // ✅ PASS initialWindowMetrics HERE
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
  );
}