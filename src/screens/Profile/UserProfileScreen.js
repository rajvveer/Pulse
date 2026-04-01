import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Dimensions,
  FlatList,
  Animated,
  StatusBar,
  RefreshControl
} from 'react-native';
import { useSelector } from 'react-redux';
import { useTheme } from '../../contexts/ThemeContext';
import { getTheme } from '../../styles/theme';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import api from '../../services/api';

const { width } = Dimensions.get('window');
const HEADER_HEIGHT = 260;
const AVATAR_SIZE = 100;
const GRID_GAP = 2;
const NUM_COLUMNS = 3;
const ITEM_SIZE = (width - (GRID_GAP * (NUM_COLUMNS + 1))) / NUM_COLUMNS;

const UserProfileScreen = ({ route, navigation }) => {
  const { username, userId } = route.params;
  const { user: currentUser } = useSelector(state => state.auth);
  const { isDark } = useTheme();
  const theme = getTheme(isDark);

  const [userData, setUserData] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchProfileData();
  }, [username, userId]);

  const fetchProfileData = async () => {
    try {
      setLoading(true);

      const endpoint = username ? `/users/${username}` : `/users/${userId}`;

      const userResponse = await api.get(endpoint);
      const fetchedUser = userResponse.data.data;

      setUserData(fetchedUser);
      setIsFollowing(fetchedUser.isFollowing || false);

      const postsResponse = await api.get(`/users/${fetchedUser.username}/posts`);
      setUserPosts(postsResponse.data.data);

    } catch (error) {
      console.error('Profile fetch error:', error);
      Alert.alert('Error', 'Failed to load user profile');
      navigation.goBack();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfileData();
  };

  const handleFollowToggle = async () => {
    if (followLoading) return;
    try {
      setFollowLoading(true);

      const willFollow = !isFollowing;
      setIsFollowing(willFollow);

      setUserData(prev => ({
        ...prev,
        stats: {
          ...prev.stats,
          followers: willFollow
            ? (prev.stats.followers || 0) + 1
            : (prev.stats.followers || 0) - 1
        }
      }));

      await api.post(`/users/${userData.username}/follow`);

    } catch (error) {
      console.error('Follow error:', error);
      setIsFollowing(prev => !prev);
      Alert.alert('Error', 'Failed to update follow status');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleMessage = async () => {
    if (messageLoading) return;

    try {
      setMessageLoading(true);

      const res = await api.post('/chat/conversation', {
        targetUserId: userData._id
      });

      if (res.data.success) {
        navigation.navigate('ChatScreen', {
          conversationId: res.data.data._id,
          targetUser: userData
        });
      }
    } catch (error) {
      console.error("Chat init error", error);
      Alert.alert("Error", "Could not start conversation");
    } finally {
      setMessageLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num?.toString() || '0';
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!userData) return null;

  const isOwnProfile = userData._id === currentUser?._id;
  const avatarInitial = (userData.username || '?').charAt(0).toUpperCase();

  const renderGridItem = ({ item }) => {
    const imageUrl = item.content?.media?.[0]?.url;
    const isVideo = item.content?.media?.[0]?.type === 'video';

    return (
      <TouchableOpacity
        style={styles.gridItem}
        onPress={() => navigation.navigate('PostDetail', { postId: item._id })}
        activeOpacity={0.9}
      >
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.gridImage} resizeMode="cover" />
        ) : (
          <View style={[styles.textPostGrid, { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' }]}>
            <Text numberOfLines={3} style={[styles.gridText, { color: theme.colors.text }]}>
              {item.content?.text}
            </Text>
          </View>
        )}

        {isVideo && (
          <View style={styles.videoIndicator}>
            <Ionicons name="play" size={16} color="#FFF" />
          </View>
        )}

        {item.content?.media?.length > 1 && (
          <View style={styles.multiIndicator}>
            <Ionicons name="copy" size={14} color="#FFF" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Floating Back Button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="arrow-back" size={24} color="#FFF" />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
            progressViewOffset={HEADER_HEIGHT / 2}
          />
        }
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {/* Hero Header */}
        <View style={styles.headerContainer}>
          <Image
            source={{ uri: userData.profile?.coverPhoto || 'https://images.unsplash.com/photo-1557683316-973673baf926?w=800&q=80' }}
            style={styles.coverImage}
            blurRadius={1}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.9)']}
            style={styles.headerGradient}
          />

          {/* Profile Info on Header */}
          <View style={styles.profileInfo}>
            <View style={styles.avatarWrapper}>
              {userData.profile?.avatar ? (
                <Image source={{ uri: userData.profile.avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.primary }]}>
                  <Text style={styles.avatarInitial}>{avatarInitial}</Text>
                </View>
              )}
              {userData.isVerified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark" size={12} color="#FFF" />
                </View>
              )}
            </View>

            <Text style={styles.displayName}>
              {userData.profile?.displayName || userData.username}
            </Text>

            <Text style={styles.usernameText}>@{userData.username}</Text>

            {userData.profile?.bio && (
              <Text style={styles.bio}>{userData.profile.bio}</Text>
            )}
          </View>
        </View>

        {/* Stats Bar */}
        <View style={[styles.statsBar, { backgroundColor: theme.colors.background }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.colors.text }]}>
              {formatNumber(userPosts.length || userData.stats?.posts || 0)}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>posts</Text>
          </View>

          <TouchableOpacity
            style={styles.statItem}
            onPress={() => navigation.push('Connections', { username: userData.username, type: 'followers' })}
          >
            <Text style={[styles.statNumber, { color: theme.colors.text }]}>
              {formatNumber(userData.stats?.followers || 0)}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>followers</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.statItem}
            onPress={() => navigation.push('Connections', { username: userData.username, type: 'following' })}
          >
            <Text style={[styles.statNumber, { color: theme.colors.text }]}>
              {formatNumber(userData.stats?.following || 0)}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>following</Text>
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        {!isOwnProfile && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[
                styles.followBtn,
                {
                  backgroundColor: isFollowing
                    ? (isDark ? '#2C2C2E' : '#EBEBF0')
                    : '#0095F6'
                }
              ]}
              onPress={handleFollowToggle}
              disabled={followLoading}
            >
              {followLoading ? (
                <ActivityIndicator size="small" color={isFollowing ? theme.colors.text : '#FFF'} />
              ) : (
                <Text style={[
                  styles.followBtnText,
                  { color: isFollowing ? theme.colors.text : '#FFF' }
                ]}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.messageBtn, { backgroundColor: isDark ? '#2C2C2E' : '#EBEBF0' }]}
              onPress={handleMessage}
              disabled={messageLoading}
            >
              {messageLoading ? (
                <ActivityIndicator size="small" color={theme.colors.text} />
              ) : (
                <Ionicons name="chatbubble-outline" size={18} color={theme.colors.text} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.messageBtn, { backgroundColor: isDark ? '#2C2C2E' : '#EBEBF0' }]}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
        )}

        {/* Tab Bar */}
        <View style={[styles.tabBar, { borderBottomColor: isDark ? '#2C2C2E' : '#EBEBF0' }]}>
          <TouchableOpacity style={styles.tab}>
            <Ionicons name="grid" size={24} color={theme.colors.text} />
            <View style={[styles.tabIndicator, { backgroundColor: theme.colors.text }]} />
          </TouchableOpacity>
        </View>

        {/* Gallery Grid */}
        <View style={styles.galleryContainer}>
          {userPosts.length > 0 ? (
            <FlatList
              data={userPosts}
              keyExtractor={item => item._id}
              renderItem={renderGridItem}
              numColumns={NUM_COLUMNS}
              scrollEnabled={false}
              contentContainerStyle={styles.gridContent}
              columnWrapperStyle={styles.gridRow}
            />
          ) : (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}>
                <Ionicons name="camera-outline" size={48} color={theme.colors.textSecondary} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Posts Yet</Text>
              <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
                When {userData.profile?.displayName || userData.username} shares posts, you'll see them here.
              </Text>
            </View>
          )}
        </View>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },

  // Back Button
  backButton: {
    position: 'absolute',
    top: 50,
    left: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Header
  headerContainer: {
    height: HEADER_HEIGHT,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  headerGradient: {
    ...StyleSheet.absoluteFillObject,
  },

  // Profile Info
  profileInfo: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 10,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 3,
    borderColor: '#FFF',
  },
  avatarPlaceholder: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
  },
  avatarInitial: {
    fontSize: 40,
    fontWeight: '700',
    color: '#FFF',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0095F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  displayName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  usernameText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  bio: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 40,
    lineHeight: 18,
  },

  // Stats
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
  },
  statItem: {
    alignItems: 'center',
    minWidth: 80,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 13,
    marginTop: 2,
  },

  // Actions
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  followBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  followBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  messageBtn: {
    width: 44,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 32,
    height: 2,
    borderRadius: 1,
  },

  // Grid
  galleryContainer: {
    flex: 1,
  },
  gridContent: {
    padding: GRID_GAP / 2,
  },
  gridRow: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  gridItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  textPostGrid: {
    width: '100%',
    height: '100%',
    padding: 8,
    justifyContent: 'center',
  },
  gridText: {
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
  },
  videoIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  multiIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default UserProfileScreen;