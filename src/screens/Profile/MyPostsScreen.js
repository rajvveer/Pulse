import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Image,
  TouchableOpacity,
  Alert,
  RefreshControl,
  StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { getTheme } from '../../styles/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import api from '../../services/api';

const MyPostsScreen = ({ navigation }) => {
  const { isDark } = useTheme();
  const theme = getTheme(isDark);

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ✅ Auto-refresh when coming back from Edit Screen
  useFocusEffect(
    useCallback(() => {
      fetchMyPosts();
    }, [])
  );

  const fetchMyPosts = async () => {
    try {
      const res = await api.get('/posts/me/posts'); // Ensure this endpoint exists on backend
      setPosts(res.data.data || []);
    } catch (e) {
      console.error('Fetch posts error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMyPosts();
  };

  const handleDelete = (postId) => {
    Alert.alert('Delete Post', 'Are you sure? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/posts/${postId}`);
            setPosts(prev => prev.filter(p => p._id !== postId));
          } catch (e) {
            Alert.alert('Error', 'Failed to delete post');
          }
        },
      },
    ]);
  };

  const renderPostItem = ({ item }) => {
    const hasMedia = item.content?.media?.length > 0;
    const firstImage = hasMedia ? item.content.media[0].url : null;

    return (
      <View style={[styles.card, { backgroundColor: theme.colors.surface, shadowColor: theme.colors.shadow }]}>
        
        {/* Top: Image or Text Preview */}
        <View style={styles.cardPreview}>
          {hasMedia ? (
            <Image source={{ uri: firstImage }} style={styles.cardImage} resizeMode="cover" />
          ) : (
            <View style={[styles.textPreview, { backgroundColor: theme.colors.background }]}>
              <Text numberOfLines={3} style={[styles.previewText, { color: theme.colors.text }]}>
                {item.content?.text}
              </Text>
            </View>
          )}
          
          {/* Status Badge */}
          {item.isArchived && (
            <View style={styles.archivedBadge}>
              <Text style={styles.archivedText}>Archived</Text>
            </View>
          )}
        </View>

        {/* Bottom: Info & Actions */}
        <View style={styles.cardDetails}>
          
          {/* Stats Column */}
          <View style={styles.statsRow}>
            <View style={styles.statChip}>
              <Ionicons name="heart" size={14} color="#E91E63" />
              <Text style={[styles.statText, { color: theme.colors.text }]}>{item.stats?.likes || 0}</Text>
            </View>
            <View style={styles.statChip}>
              <Ionicons name="eye" size={14} color={theme.colors.primary} />
              <Text style={[styles.statText, { color: theme.colors.text }]}>{item.stats?.views || 0}</Text>
            </View>
            <Text style={[styles.dateText, { color: theme.colors.textSecondary }]}>
              {new Date(item.createdAt).toLocaleDateString()}
            </Text>
          </View>

          {/* Action Buttons Row */}
          <View style={[styles.actionsRow, { borderTopColor: theme.colors.border }]}>
            <TouchableOpacity 
              style={styles.actionBtn} 
              onPress={() => navigation.navigate('PostDetail', { postId: item._id })}
            >
              <Text style={[styles.btnText, { color: theme.colors.textSecondary }]}>View</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionBtn}
              // ✅ Navigate to EditPostScreen
              onPress={() => navigation.navigate('EditPost', { post: item })} 
            >
              <Ionicons name="create-outline" size={18} color={theme.colors.primary} />
              <Text style={[styles.btnText, { color: theme.colors.primary }]}>Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionBtn} 
              onPress={() => handleDelete(item._id)}
            >
              <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
            </TouchableOpacity>
          </View>

        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Manage Content</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Create')} style={styles.addBtn}>
          <Ionicons name="add" size={28} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item._id}
          renderItem={renderPostItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="layers-outline" size={64} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No posts yet.</Text>
              <Text style={[styles.emptySub, { color: theme.colors.textSecondary }]}>Time to create something new!</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  backBtn: { padding: 4 },
  addBtn: { padding: 4 },
  listContent: { padding: 16, paddingBottom: 40 },
  
  // Card Styles
  card: {
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardPreview: {
    height: 150,
    width: '100%',
    position: 'relative',
  },
  cardImage: { width: '100%', height: '100%' },
  textPreview: {
    width: '100%',
    height: '100%',
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewText: {
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  archivedBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  archivedText: { color: '#FFF', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  
  // Details
  cardDetails: { padding: 16 },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(128,128,128,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statText: { fontSize: 12, fontWeight: '600' },
  dateText: { fontSize: 12, marginLeft: 'auto' },
  
  // Actions
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
  },
  btnText: { fontSize: 14, fontWeight: '600' },

  // Empty State
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 18, fontWeight: '700', marginTop: 16 },
  emptySub: { fontSize: 14, marginTop: 4 },
});

export default MyPostsScreen;