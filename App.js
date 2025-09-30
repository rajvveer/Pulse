import React from 'react';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { store } from './src/redux/store';
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
    <SafeAreaProvider>
      <ThemeProvider>
        <Provider store={store}>
          <QueryClientProvider client={queryClient}>
            <ThemeStatusBar />
            <NavigationTheme>
              <RootNavigator />
            </NavigationTheme>
          </QueryClientProvider>
        </Provider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
