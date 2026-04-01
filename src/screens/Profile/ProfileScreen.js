import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  RefreshControl,
  Image,
  Dimensions,
  FlatList,
  Animated,
  StatusBar
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import { logoutAsync, setUser } from '../../redux/slices/authSlice';
import { useTheme } from '../../contexts/ThemeContext';
import { getTheme } from '../../styles/theme';
import { ThemeToggle } from '../../components/UI/ThemeToggle';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import api from '../../services/api';
import { getValidAvatarUrl } from '../../utils/avatarHelper';

const { width, height } = Dimensions.get('window');
const HEADER_HEIGHT = 280;
const AVATAR_SIZE = 110;
const GRID_GAP = 2;
const NUM_COLUMNS = 3;
const ITEM_SIZE = (width - (GRID_GAP * (NUM_COLUMNS + 1))) / NUM_COLUMNS;

const ProfileScreen = ({ navigation }) => {
  const { user } = useSelector(state => state.auth);
  const dispatch = useDispatch();
  const { isDark } = useTheme();
  const theme = getTheme(isDark);

  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('posts');
  const [userPosts, setUserPosts] = useState([]);

  const scrollY = useRef(new Animated.Value(0)).current;

  const [stats, setStats] = useState({
    posts: user?.stats?.posts || 0,
    followers: user?.stats?.followers || 0,
    following: user?.stats?.following || 0
  });

  useFocusEffect(
    useCallback(() => {
      fetchLatestData();
    }, [])
  );

  const fetchLatestData = async () => {
    try {
      const profileRes = await api.get('/users/me');
      if (profileRes.data.success) {
        const freshUser = profileRes.data.data;
        if (setUser) dispatch(setUser(freshUser));

        setStats({
          posts: freshUser.stats?.posts || 0,
          followers: freshUser.stats?.followers || 0,
          following: freshUser.stats?.following || 0
        });

        const postsRes = await api.get(`/users/${freshUser.username}/posts`);
        if (postsRes.data.success) setUserPosts(postsRes.data.data);
      }
    } catch (error) {
      console.error("Failed to refresh profile:", error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLatestData();
    setRefreshing(false);
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => await dispatch(logoutAsync()) },
    ]);
  };

  const avatarInitial = (user?.username || '?').charAt(0).toUpperCase();

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num?.toString() || '0';
  };

  // Gallery item renderer
  const renderGridItem = ({ item, index }) => {
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

        {/* Video indicator */}
        {isVideo && (
          <View style={styles.videoIndicator}>
            <Ionicons name="play" size={16} color="#FFF" />
          </View>
        )}

        {/* Multi-image indicator */}
        {item.content?.media?.length > 1 && (
          <View style={styles.multiIndicator}>
            <Ionicons name="copy" size={14} color="#FFF" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderTabContent = () => {
    if (activeTab === 'posts') {
      if (userPosts.length === 0) {
        return (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}>
              <Ionicons name="camera-outline" size={48} color={theme.colors.textSecondary} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>Share Photos</Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
              When you share photos, they will appear on your profile.
            </Text>
            <TouchableOpacity
              style={styles.shareFirstBtn}
              onPress={() => navigation.navigate('Create')}
            >
              <Text style={styles.shareFirstText}>Share your first photo</Text>
            </TouchableOpacity>
          </View>
        );
      }

      return (
        <FlatList
          data={userPosts}
          keyExtractor={item => item._id}
          renderItem={renderGridItem}
          numColumns={NUM_COLUMNS}
          scrollEnabled={false}
          contentContainerStyle={styles.gridContainer}
          columnWrapperStyle={styles.gridRow}
        />
      );
    }

    // Menu tab content
    return (
      <View style={styles.menuContainer}>
        <TouchableOpacity
          style={[styles.menuItem, { backgroundColor: isDark ? '#1C1C1E' : '#F8F8F8' }]}
          onPress={() => navigation.navigate('MyPosts')}
        >
          <View style={[styles.menuIconBox, { backgroundColor: isDark ? '#2C2C2E' : '#EBEBF0' }]}>
            <Ionicons name="grid-outline" size={20} color={theme.colors.primary} />
          </View>
          <Text style={[styles.menuText, { color: theme.colors.text }]}>Manage Content</Text>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, { backgroundColor: isDark ? '#1C1C1E' : '#F8F8F8' }]}
          onPress={() => navigation.navigate('SocialDNA')}
        >
          <View style={[styles.menuIconBox, { backgroundColor: 'rgba(0, 210, 255, 0.15)' }]}>
            <Text style={{ fontSize: 18 }}>🧬</Text>
          </View>
          <Text style={[styles.menuText, { color: theme.colors.text }]}>Social DNA</Text>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, { backgroundColor: isDark ? '#1C1C1E' : '#F8F8F8' }]}
          onPress={() => navigation.navigate('PulseScore')}
        >
          <View style={[styles.menuIconBox, { backgroundColor: 'rgba(255, 107, 53, 0.15)' }]}>
            <Text style={{ fontSize: 18 }}>🏆</Text>
          </View>
          <Text style={[styles.menuText, { color: theme.colors.text }]}>Pulse Score</Text>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, { backgroundColor: isDark ? '#1C1C1E' : '#F8F8F8' }]}
          onPress={() => navigation.navigate('Settings')}
        >
          <View style={[styles.menuIconBox, { backgroundColor: isDark ? '#2C2C2E' : '#EBEBF0' }]}>
            <Ionicons name="settings-outline" size={20} color={theme.colors.textSecondary} />
          </View>
          <Text style={[styles.menuText, { color: theme.colors.text }]}>Settings</Text>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, { backgroundColor: isDark ? '#1C1C1E' : '#F8F8F8' }]}
        >
          <View style={[styles.menuIconBox, { backgroundColor: 'rgba(255, 152, 0, 0.15)' }]}>
            <Ionicons name="bookmark-outline" size={20} color="#FF9800" />
          </View>
          <Text style={[styles.menuText, { color: theme.colors.text }]}>Saved</Text>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        <View style={styles.themeRow}>
          <ThemeToggle />
        </View>

        <TouchableOpacity
          style={[styles.menuItem, styles.logoutBtn]}
          onPress={handleLogout}
        >
          <View style={[styles.menuIconBox, { backgroundColor: 'rgba(255, 59, 48, 0.1)' }]}>
            <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
          </View>
          <Text style={[styles.menuText, { color: '#FF3B30' }]}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

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
            source={{ uri: user?.profile?.coverPhoto || 'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=800&q=80' }}
            style={styles.coverImage}
            blurRadius={2}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.85)']}
            style={styles.headerGradient}
          />

          {/* Top Nav */}
          <View style={styles.topNav}>
            <View style={styles.usernameChip}>
              <Text style={styles.usernameText}>@{user?.username}</Text>
            </View>
            <TouchableOpacity
              style={styles.settingsIconBtn}
              onPress={() => navigation.navigate('Settings')}
            >
              <Ionicons name="menu-outline" size={26} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Avatar & Info */}
          <View style={styles.profileInfo}>
            <View style={styles.avatarWrapper}>
              {getValidAvatarUrl(user) ? (
                <Image source={{ uri: getValidAvatarUrl(user) }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.primary }]}>
                  <Text style={styles.avatarInitial}>{avatarInitial}</Text>
                </View>
              )}
              {user?.isVerified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark" size={12} color="#FFF" />
                </View>
              )}
            </View>

            <Text style={styles.displayName}>
              {user?.profile?.displayName || user?.username}
            </Text>

            {user?.profile?.bio && (
              <Text style={styles.bio}>{user.profile.bio}</Text>
            )}
          </View>
        </View>

        {/* Stats Bar */}
        <View style={[styles.statsBar, { backgroundColor: theme.colors.background }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.colors.text }]}>{formatNumber(stats.posts)}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>posts</Text>
          </View>

          <TouchableOpacity
            style={styles.statItem}
            onPress={() => navigation.push('Connections', { username: user.username, type: 'followers' })}
          >
            <Text style={[styles.statNumber, { color: theme.colors.text }]}>{formatNumber(stats.followers)}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>followers</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.statItem}
            onPress={() => navigation.push('Connections', { username: user.username, type: 'following' })}
          >
            <Text style={[styles.statNumber, { color: theme.colors.text }]}>{formatNumber(stats.following)}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>following</Text>
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.editBtn, { backgroundColor: isDark ? '#2C2C2E' : '#EBEBF0' }]}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <Text style={[styles.editBtnText, { color: theme.colors.text }]}>Edit profile</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.shareBtn, { backgroundColor: isDark ? '#2C2C2E' : '#EBEBF0' }]}
          >
            <Ionicons name="person-add-outline" size={18} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        {/* Tab Switcher */}
        <View style={[styles.tabBar, { borderBottomColor: isDark ? '#2C2C2E' : '#EBEBF0' }]}>
          <TouchableOpacity
            style={styles.tab}
            onPress={() => setActiveTab('posts')}
          >
            <Ionicons
              name={activeTab === 'posts' ? 'grid' : 'grid-outline'}
              size={24}
              color={activeTab === 'posts' ? theme.colors.text : theme.colors.textSecondary}
            />
            {activeTab === 'posts' && <View style={[styles.tabIndicator, { backgroundColor: theme.colors.text }]} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tab}
            onPress={() => setActiveTab('menu')}
          >
            <Ionicons
              name={activeTab === 'menu' ? 'menu' : 'menu-outline'}
              size={24}
              color={activeTab === 'menu' ? theme.colors.text : theme.colors.textSecondary}
            />
            {activeTab === 'menu' && <View style={[styles.tabIndicator, { backgroundColor: theme.colors.text }]} />}
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {renderTabContent()}

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
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
  topNav: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  usernameChip: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  usernameText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  settingsIconBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 12,
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
    fontSize: 44,
    fontWeight: '700',
    color: '#FFF',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
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
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  bio: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 32,
    lineHeight: 20,
  },

  // Stats
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderBottomWidth: 0,
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
  editBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  editBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  shareBtn: {
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
  gridContainer: {
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
    marginBottom: 20,
  },
  shareFirstBtn: {
    paddingVertical: 8,
  },
  shareFirstText: {
    color: '#0095F6',
    fontSize: 14,
    fontWeight: '600',
  },

  // Menu
  menuContainer: {
    padding: 16,
    gap: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    gap: 14,
  },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  themeRow: {
    marginVertical: 8,
  },
  logoutBtn: {
    marginTop: 8,
  },
});

export default ProfileScreen;