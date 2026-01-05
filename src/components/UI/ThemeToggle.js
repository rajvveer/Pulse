import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { getTheme } from '../../styles/theme';

export const ThemeToggle = () => {
  const { themeMode, changeTheme, isDark } = useTheme();
  const theme = getTheme(isDark);

  const themeOptions = [
    { key: 'light', icon: '☀️' },
    { key: 'dark', icon: '🌙' },
    { key: 'system', icon: '📱' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.card }]}>
      {themeOptions.map((option, index) => {
        const isSelected = themeMode === option.key;
        const isFirst = index === 0;
        const isLast = index === themeOptions.length - 1;
        
        return (
          <TouchableOpacity
            key={option.key}
            onPress={() => changeTheme(option.key)}
            activeOpacity={0.7}
            style={[
              styles.option,
              {
                backgroundColor: isSelected 
                  ? theme.colors.primary 
                  : 'transparent',
                borderTopLeftRadius: isFirst ? 8 : 0,
                borderBottomLeftRadius: isFirst ? 8 : 0,
                borderTopRightRadius: isLast ? 8 : 0,
                borderBottomRightRadius: isLast ? 8 : 0,
              },
            ]}
          >
            <Text style={styles.icon}>{option.icon}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 2,
    alignSelf: 'flex-start',
  },
  option: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 1,
  },
  icon: {
    fontSize: 18,
  },
});