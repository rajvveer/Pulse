// screens/profile/AboutScreen.jsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { useTheme } from '../../contexts/ThemeContext';
import { getTheme } from '../../styles/theme';

const APP_VERSION = '1.0.0';

const AboutScreen = () => {
  const { isDark } = useTheme();
  const theme = getTheme(isDark);
  const { user } = useSelector(state => state.auth);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.colors.text }]}>About Pulse</Text>

        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          Hyperlocal social network to share moments with people near you.
        </Text>

        <View style={[styles.card, { backgroundColor: theme.colors.surface, shadowColor: theme.colors.shadow }]}>
          <Text style={[styles.cardLabel, { color: theme.colors.textSecondary }]}>Logged in as</Text>
          <Text style={[styles.cardValue, { color: theme.colors.text }]}>
            {user?.username || user?.email || 'Guest'}
          </Text>

          <Text style={[styles.cardLabel, { color: theme.colors.textSecondary, marginTop: 16 }]}>
            App version
          </Text>
          <Text style={[styles.cardValue, { color: theme.colors.text }]}>{APP_VERSION}</Text>
        </View>

        <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
          Made with ❤️ in Jaipur
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 8 },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 280,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    padding: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardLabel: { fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 },
  cardValue: { fontSize: 16, fontWeight: '600' },
  footerText: { marginTop: 24, fontSize: 12, textAlign: 'center' },
});

export default AboutScreen;
