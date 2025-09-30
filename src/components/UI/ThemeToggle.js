import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { getTheme } from '../../styles/theme';

export const ThemeToggle = () => {
  const { themeMode, changeTheme, isDark } = useTheme();
  const theme = getTheme(isDark);

  const themeOptions = [
    { key: 'light', label: '☀️ Light', icon: '☀️' },
    { key: 'dark', label: '🌙 Dark', icon: '🌙' },
    { key: 'system', label: '📱 System', icon: '📱' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <Text style={[styles.title, { color: theme.colors.text }]}>
        Theme Preference
      </Text>
      <View style={styles.options}>
        {themeOptions.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.option,
              { 
                backgroundColor: themeMode === option.key 
                  ? theme.colors.primary 
                  : theme.colors.background,
                borderColor: theme.colors.border,
              }
            ]}
            onPress={() => changeTheme(option.key)}
          >
            <Text style={styles.icon}>{option.icon}</Text>
            <Text 
              style={[
                styles.optionText,
                { 
                  color: themeMode === option.key 
                    ? '#FFFFFF' 
                    : theme.colors.text 
                }
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 12,
    marginVertical: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  options: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  option: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
  },
  icon: {
    fontSize: 24,
    marginBottom: 4,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
