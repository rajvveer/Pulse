import React, { createContext, useContext, useState, useEffect } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [themeMode, setThemeMode] = useState('system'); // 'system', 'light', 'dark'
  const [currentTheme, setCurrentTheme] = useState('light');

  // Load saved theme preference
  useEffect(() => {
    loadThemePreference();
  }, []);

  // Update theme when mode changes
  useEffect(() => {
    updateCurrentTheme();
    const subscription = Appearance.addChangeListener(updateCurrentTheme);
    return () => subscription.remove();
  }, [themeMode]);

  const loadThemePreference = async () => {
    try {
      const savedMode = await AsyncStorage.getItem('themeMode');
      if (savedMode) {
        setThemeMode(savedMode);
      }
    } catch (error) {
      console.log('Error loading theme preference:', error);
    }
  };

  const updateCurrentTheme = () => {
    if (themeMode === 'system') {
      const systemTheme = Appearance.getColorScheme() || 'light';
      setCurrentTheme(systemTheme);
    } else {
      setCurrentTheme(themeMode);
    }
  };

  const changeTheme = async (mode) => {
    try {
      setThemeMode(mode);
      await AsyncStorage.setItem('themeMode', mode);
    } catch (error) {
      console.log('Error saving theme preference:', error);
    }
  };

  const value = {
    themeMode,
    currentTheme,
    isDark: currentTheme === 'dark',
    changeTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
