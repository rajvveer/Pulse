import React, { useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { useLocation } from '../hooks/useLocation';
import { useTheme } from '../contexts/ThemeContext';
import { getTheme } from '../styles/theme';

const FeedScreen = () => {
  const { user } = useSelector(state => state.auth);
  const { location } = useSelector(state => state.ui);
  const { requestLocation } = useLocation();
  const { isDark } = useTheme();
  const theme = getTheme(isDark);

  const mockPosts = [
    {
      id: 1,
      user: { name: 'John Doe', avatar: null },
      caption: 'Beautiful sunset at the local park! 🌅',
      timeAgo: '2h ago',
      distance: '150m',
      likes: 12,
      comments: 3,
    },
    {
      id: 2,
      user: { name: 'Sarah Smith', avatar: null },
      caption: 'New coffee shop opened downtown ☕',
      timeAgo: '4h ago', 
      distance: '300m',
      likes: 8,
      comments: 1,
    },
    {
      id: 3,
      user: { name: 'Mike Johnson', avatar: null },
      caption: `Enjoying the ${isDark ? 'night' : 'day'} with dark mode! 🌙✨`,
      timeAgo: '1h ago', 
      distance: '75m',
      likes: 15,
      comments: 5,
    },
  ];

  useEffect(() => {
    requestLocation();
  }, []);

  const renderPost = ({ item }) => (
    <View style={[styles.postCard, { 
      backgroundColor: theme.colors.surface,
      shadowColor: theme.colors.shadow,
    }]}>
      <View style={styles.postHeader}>
        <View style={styles.userInfo}>
          <Text style={[styles.username, { color: theme.colors.text }]}>
            {item.user.name}
          </Text>
          <Text style={[styles.timestamp, { color: theme.colors.textSecondary }]}>
            {item.timeAgo}
          </Text>
        </View>
        <Text style={[styles.distance, { 
          color: theme.colors.primary,
          backgroundColor: isDark ? 'rgba(66, 165, 245, 0.2)' : 'rgba(30, 136, 229, 0.1)',
        }]}>
          {item.distance}
        </Text>
      </View>
      
      <Text style={[styles.caption, { color: theme.colors.text }]}>
        {item.caption}
      </Text>
      
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton}>
          <Text style={[styles.actionText, { color: theme.colors.textSecondary }]}>
            ❤️ {item.likes}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Text style={[styles.actionText, { color: theme.colors.textSecondary }]}>
            💬 {item.comments}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={[styles.header, { 
        backgroundColor: theme.colors.surface,
        borderBottomColor: theme.colors.border,
        shadowColor: theme.colors.shadow,
      }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Pulse</Text>
        <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
          {location ? `📍 Location: Jaipur` : '📍 Getting location...'}
        </Text>
      </View>
      
      <FlatList
        data={mockPosts}
        renderItem={renderPost}
        keyExtractor={item => item.id.toString()}
        refreshing={false}
        onRefresh={() => {}}
        contentContainerStyle={styles.feedList}
        showsVerticalScrollIndicator={false}
      />
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
  feedList: {
    paddingVertical: 8,
  },
  postCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 14,
    marginTop: 2,
  },
  distance: {
    fontSize: 14,
    fontWeight: '500',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  caption: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
  },
  actionButton: {
    marginRight: 24,
  },
  actionText: {
    fontSize: 14,
  },
});

export default FeedScreen;
