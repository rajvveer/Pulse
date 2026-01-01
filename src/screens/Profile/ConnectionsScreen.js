import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  ActivityIndicator, 
  StyleSheet, 
  TouchableOpacity 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { getTheme } from '../../styles/theme';
import api from '../../services/api';
import UserListItem from '../../components/UserListItem';
import Ionicons from '@expo/vector-icons/Ionicons';

const ConnectionsScreen = ({ route, navigation }) => {
  const { username, type } = route.params; // type = 'followers' or 'following'
  const { isDark } = useTheme();
  const theme = getTheme(isDark);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Dynamic Title (Followers or Following)
  const title = type.charAt(0).toUpperCase() + type.slice(1);

  useEffect(() => {
    fetchUsers();
  }, [username, type]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/users/${username}/${type}`);
      if (response.data.success) {
        setUsers(response.data.data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleUserPress = (userId, userUsername) => {
    // Navigate to that user's profile
    navigation.push('UserProfile', { 
        userId: userId, 
        username: userUsername 
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          {title}
        </Text>
        <View style={styles.placeholder} />
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <UserListItem 
              user={item} 
              onPress={() => handleUserPress(item._id, item.username)} 
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                No {type} found
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  placeholder: {
    width: 32,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
  },
});

export default ConnectionsScreen;