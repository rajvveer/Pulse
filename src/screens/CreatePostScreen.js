import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { getTheme } from '../styles/theme';

const CreatePostScreen = () => {
  const { isDark } = useTheme();
  const theme = getTheme(isDark);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={[styles.header, { 
        backgroundColor: theme.colors.surface,
        borderBottomColor: theme.colors.border,
        shadowColor: theme.colors.shadow,
      }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Create Post</Text>
        <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
          Share your moment with nearby community
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.cameraSection, { 
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          shadowColor: theme.colors.shadow,
        }]}>
          <Text style={styles.cameraIcon}>📷</Text>
          <Text style={[styles.cameraText, { color: theme.colors.text }]}>
            Camera Access
          </Text>
          <Text style={[styles.cameraSubtext, { color: theme.colors.textSecondary }]}>
            Tap to capture photos and videos
          </Text>
          
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: theme.colors.primary }]}
            onPress={() => {/* TODO: Implement camera */}}
          >
            <Text style={styles.buttonText}>📸 Open Camera</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.featuresSection, { 
          backgroundColor: theme.colors.surface,
          shadowColor: theme.colors.shadow,
        }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Coming Soon Features
          </Text>
          
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>📍</Text>
            <View style={styles.featureContent}>
              <Text style={[styles.featureTitle, { color: theme.colors.text }]}>
                Location Radius
              </Text>
              <Text style={[styles.featureDesc, { color: theme.colors.textSecondary }]}>
                Choose who can see your post (100m, 500m, 1km)
              </Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>⏰</Text>
            <View style={styles.featureContent}>
              <Text style={[styles.featureTitle, { color: theme.colors.text }]}>
                Ephemeral Posts
              </Text>
              <Text style={[styles.featureDesc, { color: theme.colors.textSecondary }]}>
                Posts that disappear after 24 hours
              </Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>🎭</Text>
            <View style={styles.featureContent}>
              <Text style={[styles.featureTitle, { color: theme.colors.text }]}>
                Anonymous Mode
              </Text>
              <Text style={[styles.featureDesc, { color: theme.colors.textSecondary }]}>
                Share anonymously in your local area
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  cameraSection: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cameraIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  cameraText: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  cameraSubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  featuresSection: {
    padding: 16,
    borderRadius: 12,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
});

export default CreatePostScreen;
