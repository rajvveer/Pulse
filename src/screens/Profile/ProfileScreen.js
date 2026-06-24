import React, { useState, useCallback } from 'react';
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
  StatusBar,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import { logoutAsync, setUser } from '../../redux/slices/authSlice';
import { useTheme } from '../../contexts/ThemeContext';
import { getTheme } from '../../styles/theme';
import { ThemeToggle } from '../../components/UI/ThemeToggle';
import Avatar from '../../components/UI/Avatar';
import Ionicons from '@expo/vector-icons/Ionicons';
import api from '../../services/api';

const { width } = Dimensions.get('window');
const COVER_HEIGHT = 150;
const AVATAR_SIZE = 92;
const GRID_GAP = 2;
const NUM_COLUMNS = 3;
const ITEM_SIZE = (width - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

const ProfileScreen = ({ navigation }) => {
  const { user } = useSelector(state => state.auth);
  const dispatch = useDispatch();
  const { isDark } = useTheme();
  const theme = getTheme(isDark);

  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('posts');
  const [userPosts, setUserPosts] = useState([]);
  const [stats, setStats] = useState({
    posts: user?.stats?.posts || 0,
    followers: user?.stats?.followers || 0,
    following: user?.stats?.following || 0,
  });

  useFocusEffect(useCallback(() => { fetchLatestData(); }, []));

  const fetchLatestData = async () => {
    try {
      const profileRes = await api.get('/users/me');
      if (profileRes.data.success) {
        const freshUser = profileRes.data.data;
        if (setUser) dispatch(setUser(freshUser));
        setStats({
          posts: freshUser.stats?.posts || 0,
          followers: freshUser.stats?.followers || 0,
          following: freshUser.stats?.following || 0,
        });
        const postsRes = await api.get(`/users/${freshUser.username}/posts`);
        if (postsRes.data.success) setUserPosts(postsRes.data.data);
      }
    } catch (error) {
      console.error('Failed to refresh profile:', error);
    }
  };

  const onRefresh = async () => { setRefreshing(true); await fetchLatestData(); setRefreshing(false); };

  const handleLogout = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => await dispatch(logoutAsync()) },
    ]);
  };

  const handleShareProfile = async () => {
    try {
      await Share.share({ message: `Check out @${user?.username} on Pulse`, url: `pulse://user/${user?.username}` });
    } catch { /* cancelled */ }
  };

  const coverPhoto = user?.profile?.coverPhoto;
  const hasCover = coverPhoto && !coverPhoto.includes('defaults/cover.png');

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num?.toString() || '0';
  };

  const renderGridItem = ({ item }) => {
    const imageUrl = item.content?.media?.[0]?.url;
    const isVideo = item.content?.media?.[0]?.type === 'video';
    const multi = item.content?.media?.length > 1;
    return (
      <TouchableOpacity style={styles.gridItem} onPress={() => navigation.navigate('PostDetail', { postId: item._id })} activeOpacity={0.85}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.gridImage} resizeMode="cover" />
        ) : (
          <View style={[styles.textPostGrid, { backgroundColor: theme.colors.surfaceAlt }]}>
            <Text numberOfLines={5} style={[styles.gridText, { color: theme.colors.text }]}>{item.content?.text}</Text>
          </View>
        )}
        {(isVideo || multi) && (
          <View style={styles.cornerIcon}>
            <Ionicons name={isVideo ? 'play' : 'copy'} size={13} color="#FFF" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const MenuRow = ({ icon, label, onPress, danger }) => (
    <TouchableOpacity style={[styles.menuItem, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.menuIconBox, { backgroundColor: danger ? theme.colors.accentMuted : theme.colors.surfaceAlt }]}>
        <Ionicons name={icon} size={18} color={danger ? theme.colors.error : theme.colors.text} />
      </View>
      <Text style={[styles.menuText, { color: danger ? theme.colors.error : theme.colors.text }]}>{label}</Text>
      {!danger && <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />}
    </TouchableOpacity>
  );

  const StatButton = ({ value, label, onPress }) => (
    <TouchableOpacity style={styles.statItem} onPress={onPress} disabled={!onPress} activeOpacity={0.7}>
      <Text style={[styles.statNumber, { color: theme.colors.text }]}>{formatNumber(value)}</Text>
      <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  );

  const renderTabContent = () => {
    if (activeTab === 'posts') {
      if (userPosts.length === 0) {
        return (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.colors.surfaceAlt }]}>
              <Ionicons name="grid-outline" size={32} color={theme.colors.textSecondary} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No posts yet</Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>Your posts will show up here.</Text>
            <TouchableOpacity style={[styles.shareFirstBtn, { backgroundColor: theme.colors.primary }]} onPress={() => navigation.navigate('Create')} activeOpacity={0.85}>
              <Text style={[styles.shareFirstText, { color: theme.colors.onPrimary }]}>Share your first post</Text>
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
          columnWrapperStyle={styles.gridRow}
          ItemSeparatorComponent={() => <View style={{ height: GRID_GAP }} />}
        />
      );
    }
    return (
      <View style={styles.menuContainer}>
        <MenuRow icon="albums-outline" label="Manage content" onPress={() => navigation.navigate('MyPosts')} />
        <MenuRow icon="bookmark-outline" label="Bookmarks" onPress={() => navigation.navigate('Bookmarks')} />
        <MenuRow icon="git-network-outline" label="Social DNA" onPress={() => navigation.navigate('SocialDNA')} />
        <MenuRow icon="trophy-outline" label="Pulse Score" onPress={() => navigation.navigate('PulseScore')} />
        <MenuRow icon="settings-outline" label="Settings" onPress={() => navigation.navigate('Settings')} />
        <View style={[styles.themeCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <ThemeToggle />
        </View>
        <MenuRow icon="log-out-outline" label="Sign out" onPress={handleLogout} danger />
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        {/* Cover */}
        <View style={[styles.coverWrap, { backgroundColor: theme.colors.surfaceAlt }]}>
          {hasCover && <Image source={{ uri: coverPhoto }} style={styles.coverImage} resizeMode="cover" />}
          {hasCover && <View style={styles.coverScrim} />}
        </View>

        {/* Avatar + identity */}
        <View style={styles.identityRow}>
          <View style={[styles.avatarBorder, { borderColor: theme.colors.background }]}>
            <Avatar user={user} size={AVATAR_SIZE} verified={user?.isVerified} />
          </View>
        </View>

        <View style={styles.bioBlock}>
          <Text style={[styles.displayName, { color: theme.colors.text }]} numberOfLines={1}>
            {user?.profile?.displayName || user?.username}
          </Text>
          <Text style={[styles.handle, { color: theme.colors.textSecondary }]} numberOfLines={1}>@{user?.username}</Text>
          {user?.profile?.bio ? <Text style={[styles.bio, { color: theme.colors.text }]}>{user.profile.bio}</Text> : null}
          {user?.profile?.location ? (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color={theme.colors.textSecondary} />
              <Text style={[styles.locationText, { color: theme.colors.textSecondary }]}>{user.profile.location}</Text>
            </View>
          ) : null}
        </View>

        {/* Stats */}
        <View style={[styles.statsCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <StatButton value={stats.posts} label="Posts" />
          <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
          <StatButton value={stats.followers} label="Followers" onPress={() => navigation.push('Connections', { username: user.username, type: 'followers' })} />
          <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
          <StatButton value={stats.following} label="Following" onPress={() => navigation.push('Connections', { username: user.username, type: 'following' })} />
        </View>

        {/* Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.editBtn, { backgroundColor: theme.colors.surfaceAlt }]} onPress={() => navigation.navigate('EditProfile')} activeOpacity={0.8}>
            <Text style={[styles.editBtnText, { color: theme.colors.text }]}>Edit profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconActionBtn, { backgroundColor: theme.colors.surfaceAlt }]} onPress={handleShareProfile} activeOpacity={0.8}>
            <Ionicons name="share-outline" size={18} color={theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconActionBtn, { backgroundColor: theme.colors.surfaceAlt }]} onPress={() => navigation.navigate('Settings')} activeOpacity={0.8}>
            <Ionicons name="settings-outline" size={18} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={[styles.tabBar, { borderColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.tab} onPress={() => setActiveTab('posts')} activeOpacity={0.7}>
            <Ionicons name="grid-outline" size={22} color={activeTab === 'posts' ? theme.colors.text : theme.colors.textTertiary} />
            {activeTab === 'posts' && <View style={[styles.tabIndicator, { backgroundColor: theme.colors.text }]} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.tab} onPress={() => setActiveTab('menu')} activeOpacity={0.7}>
            <Ionicons name="menu-outline" size={24} color={activeTab === 'menu' ? theme.colors.text : theme.colors.textTertiary} />
            {activeTab === 'menu' && <View style={[styles.tabIndicator, { backgroundColor: theme.colors.text }]} />}
          </TouchableOpacity>
        </View>

        {renderTabContent()}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  coverWrap: { width: '100%', height: COVER_HEIGHT },
  coverImage: { width: '100%', height: '100%' },
  coverScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.12)' },

  identityRow: { paddingHorizontal: 16, marginTop: -AVATAR_SIZE / 2 },
  avatarBorder: { borderRadius: AVATAR_SIZE, borderWidth: 4, alignSelf: 'flex-start' },

  bioBlock: { paddingHorizontal: 16, paddingTop: 12 },
  displayName: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  handle: { fontSize: 13.5, marginTop: 2 },
  bio: { fontSize: 14.5, lineHeight: 20, marginTop: 10 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  locationText: { fontSize: 13, fontWeight: '500' },

  statsCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 16, paddingVertical: 14, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: StyleSheet.hairlineWidth, height: 26 },
  statNumber: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 12.5, marginTop: 3 },

  actionRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14, gap: 8 },
  editBtn: { flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: 'center' },
  editBtnText: { fontSize: 14.5, fontWeight: '700' },
  iconActionBtn: { width: 44, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },

  tabBar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, position: 'relative' },
  tabIndicator: { position: 'absolute', bottom: -StyleSheet.hairlineWidth, height: 2, width: 46, borderRadius: 1 },

  gridRow: { gap: GRID_GAP, marginBottom: GRID_GAP },
  gridItem: { width: ITEM_SIZE, height: ITEM_SIZE, position: 'relative' },
  gridImage: { width: '100%', height: '100%' },
  textPostGrid: { width: '100%', height: '100%', padding: 8, justifyContent: 'center' },
  gridText: { fontSize: 11, lineHeight: 15, textAlign: 'center' },
  cornerIcon: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 3 },

  emptyState: { alignItems: 'center', paddingTop: 56, paddingHorizontal: 40, paddingBottom: 40 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  shareFirstBtn: { paddingHorizontal: 24, paddingVertical: 11, borderRadius: 999 },
  shareFirstText: { fontSize: 14.5, fontWeight: '700' },

  menuContainer: { padding: 16, gap: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 14, gap: 12, borderWidth: StyleSheet.hairlineWidth },
  menuIconBox: { width: 36, height: 36, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  menuText: { flex: 1, fontSize: 15, fontWeight: '600' },
  themeCard: { padding: 12, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
});

export default ProfileScreen;
