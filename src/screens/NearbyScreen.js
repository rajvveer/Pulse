import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { useTheme } from '../contexts/ThemeContext';
import { getTheme } from '../styles/theme';

const NearbyScreen = () => {
  const { isDark } = useTheme();
  const theme = getTheme(isDark);
  const { location } = useSelector(state => state.ui);

  // Mock nearby activity data
  const nearbyActivity = [
    {
      id: 1,
      type: 'post',
      title: '5 people posted in the last hour',
      subtitle: 'Within 500m of your location',
      icon: '📝',
      distance: 'Last post: 2 min ago',
    },
    {
      id: 2,
      type: 'hotspot',
      title: 'City Palace area is active',
      subtitle: '12 posts in the last 2 hours',
      icon: '🔥',
      distance: '300m away',
    },
    {
      id: 3,
      type: 'event',
      title: 'Local event nearby',
      subtitle: 'Food festival discussion trending',
      icon: '🎉',
      distance: '850m away',
    },
  ];

  const renderActivityItem = ({ item }) => (
    <TouchableOpacity 
      style={[styles.activityCard, { 
        backgroundColor: theme.colors.surface,
        shadowColor: theme.colors.shadow,
      }]}
    >
      <View style={styles.activityHeader}>
        <Text style={styles.activityIcon}>{item.icon}</Text>
        <View style={styles.activityInfo}>
          <Text style={[styles.activityTitle, { color: theme.colors.text }]}>
            {item.title}
          </Text>
          <Text style={[styles.activitySubtitle, { color: theme.colors.textSecondary }]}>
            {item.subtitle}
          </Text>
        </View>
      </View>
      <Text style={[styles.activityDistance, { 
        color: theme.colors.primary,
        backgroundColor: isDark ? 'rgba(66, 165, 245, 0.2)' : 'rgba(30, 136, 229, 0.1)',
      }]}>
        {item.distance}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={[styles.header, { 
        backgroundColor: theme.colors.surface,
        borderBottomColor: theme.colors.border,
        shadowColor: theme.colors.shadow,
      }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Nearby</Text>
        <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
          {location ? 'Discover local activity around Jaipur' : 'Getting your location...'}
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.mapSection, { 
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          shadowColor: theme.colors.shadow,
        }]}>
          <Text style={styles.mapIcon}>🗺️</Text>
          <Text style={[styles.mapText, { color: theme.colors.text }]}>
            Interactive Map
          </Text>
          <Text style={[styles.mapSubtext, { color: theme.colors.textSecondary }]}>
            Visual representation of nearby posts and activity
          </Text>
          
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: theme.colors.primary }]}
            onPress={() => {/* TODO: Implement map */}}
          >
            <Text style={styles.buttonText}>🔍 View Map</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.activitySection, { 
          backgroundColor: theme.colors.surface,
          shadowColor: theme.colors.shadow,
        }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Live Activity Feed
          </Text>
          
          <FlatList
            data={nearbyActivity}
            renderItem={renderActivityItem}
            keyExtractor={item => item.id.toString()}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
          />
        </View>

        <View style={[styles.statsSection, { 
          backgroundColor: theme.colors.surface,
          shadowColor: theme.colors.shadow,
        }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Your Area Stats
          </Text>
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>23</Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                People online
              </Text>
            </View>
            
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>47</Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                Posts today
              </Text>
            </View>
            
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>1.2km</Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                Coverage area
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
  mapSection: {
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
  mapIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  mapText: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  mapSubtext: {
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
  activitySection: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
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
  activityCard: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  activityIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  activitySubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  activityDistance: {
    fontSize: 12,
    fontWeight: '500',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  statsSection: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 32,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E88E5',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
});

export default NearbyScreen;
