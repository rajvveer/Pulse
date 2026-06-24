import React, { useState, useEffect } from 'react';
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
  StatusBar,
  RefreshControl,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { useTheme } from '../../contexts/ThemeContext';
import { getTheme } from '../../styles/theme';
import Avatar from '../../components/UI/Avatar';
import Ionicons from '@expo/vector-icons/Ionicons';
import api from '../../services/api';

const { width } = Dimensions.get('window');
const COVER_HEIGHT = 150;
const AVATAR_SIZE = 92;
const GRID_GAP = 2;
const NUM_COLUMNS = 3;
const ITEM_SIZE = (width - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

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

  useEffect(() => { fetchProfileData(); }, [username, userId]);

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

  const onRefresh = async () => { setRefreshing(true); await fetchProfileData(); };

  const handleFollowToggle = async () => {
    if (followLoading) return;
    try {
      setFollowLoading(true);
      const willFollow = !isFollowing;
      setIsFollowing(willFollow);
      setUserData(prev => ({
        ...prev,
        stats: { ...prev.stats, followers: willFollow ? (prev.stats.followers || 0) + 1 : Math.max(0, (prev.stats.followers || 0) - 1) },
      }));
      await api.post(`/users/${userData.username}/follow`);
    } catch (error) {
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
      const res = await api.post('/chat/conversation', { targetUserId: userData._id });
      if (res.data.success) {
        navigation.navigate('ChatScreen', { conversationId: res.data.data._id, targetUser: userData });
      }
    } catch (error) {
      Alert.alert('Error', 'Could not start conversation');
    } finally {
      setMessageLoading(false);
    }
  };

  const handleShareProfile = async () => {
    try { await Share.share({ message: `Check out @${userData?.username} on Pulse`, url: `pulse://user/${userData?.username}` }); } catch {}
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
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
  const coverPhoto = userData.profile?.coverPhoto;
  const hasCover = coverPhoto && !coverPhoto.includes('defaults/cover.png');

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

  const StatItem = ({ value, label, onPress }) => (
    <TouchableOpacity style={styles.statItem} onPress={onPress} disabled={!onPress} activeOpacity={0.7}>
      <Text style={[styles.statNumber, { color: theme.colors.text }]}>{formatNumber(value)}</Text>
      <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      {/* Top bar over cover */}
      <View style={styles.topBar}>
        <TouchableOpacity style={[styles.circleBtn, { backgroundColor: theme.colors.surface }, theme.elevation(1)]} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.topUsername, { color: theme.colors.text }]} numberOfLines={1}>@{userData.username}</Text>
        <TouchableOpacity style={[styles.circleBtn, { backgroundColor: theme.colors.surface }, theme.elevation(1)]} onPress={handleShareProfile} activeOpacity={0.8}>
          <Ionicons name="share-outline" size={20} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        <View style={[styles.coverWrap, { backgroundColor: theme.colors.surfaceAlt }]}>
          {hasCover && <Image source={{ uri: coverPhoto }} style={styles.coverImage} resizeMode="cover" />}
          {hasCover && <View style={styles.coverScrim} />}
        </View>

        <View style={styles.identityRow}>
          <View style={[styles.avatarBorder, { borderColor: theme.colors.background }]}>
            <Avatar user={userData} size={AVATAR_SIZE} verified={userData.isVerified} />
          </View>
        </View>

        <View style={styles.bioBlock}>
          <Text style={[styles.displayName, { color: theme.colors.text }]} numberOfLines={1}>
            {userData.profile?.displayName || userData.username}
          </Text>
          <Text style={[styles.handle, { color: theme.colors.textSecondary }]} numberOfLines={1}>@{userData.username}</Text>
          {userData.profile?.bio ? <Text style={[styles.bio, { color: theme.colors.text }]}>{userData.profile.bio}</Text> : null}
        </View>

        <View style={[styles.statsCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <StatItem value={userPosts.length || userData.stats?.posts || 0} label="Posts" />
          <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
          <StatItem value={userData.stats?.followers || 0} label="Followers" onPress={() => navigation.push('Connections', { username: userData.username, type: 'followers' })} />
          <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
          <StatItem value={userData.stats?.following || 0} label="Following" onPress={() => navigation.push('Connections', { username: userData.username, type: 'following' })} />
        </View>

        {!isOwnProfile && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.followBtn, isFollowing ? { backgroundColor: theme.colors.surfaceAlt, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border } : { backgroundColor: theme.colors.primary }]}
              onPress={handleFollowToggle}
              disabled={followLoading}
              activeOpacity={0.85}
            >
              {followLoading ? (
                <ActivityIndicator size="small" color={isFollowing ? theme.colors.text : theme.colors.onPrimary} />
              ) : (
                <Text style={[styles.followBtnText, { color: isFollowing ? theme.colors.text : theme.colors.onPrimary }]}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.messageBtn, { backgroundColor: theme.colors.surfaceAlt }]} onPress={handleMessage} disabled={messageLoading} activeOpacity={0.85}>
              {messageLoading ? <ActivityIndicator size="small" color={theme.colors.text} /> : <Text style={[styles.messageBtnText, { color: theme.colors.text }]}>Message</Text>}
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.tabBar, { borderColor: theme.colors.border }]}>
          <View style={styles.tab}>
            <Ionicons name="grid-outline" size={22} color={theme.colors.text} />
            <View style={[styles.tabIndicator, { backgroundColor: theme.colors.text }]} />
          </View>
        </View>

        {userPosts.length > 0 ? (
          <FlatList
            data={userPosts}
            keyExtractor={item => item._id}
            renderItem={renderGridItem}
            numColumns={NUM_COLUMNS}
            scrollEnabled={false}
            columnWrapperStyle={styles.gridRow}
            ItemSeparatorComponent={() => <View style={{ height: GRID_GAP }} />}
          />
        ) : (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.colors.surfaceAlt }]}>
              <Ionicons name="grid-outline" size={32} color={theme.colors.textSecondary} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No posts yet</Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
              When {userData.profile?.displayName || userData.username} posts, you'll see it here.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, gap: 12 },
  circleBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  topUsername: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },

  coverWrap: { width: '100%', height: COVER_HEIGHT, borderRadius: 0 },
  coverImage: { width: '100%', height: '100%' },
  coverScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.12)' },

  identityRow: { paddingHorizontal: 16, marginTop: -AVATAR_SIZE / 2 },
  avatarBorder: { borderRadius: AVATAR_SIZE, borderWidth: 4, alignSelf: 'flex-start' },

  bioBlock: { paddingHorizontal: 16, paddingTop: 12 },
  displayName: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  handle: { fontSize: 13.5, marginTop: 2 },
  bio: { fontSize: 14.5, lineHeight: 20, marginTop: 10 },

  statsCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 16, paddingVertical: 14, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: StyleSheet.hairlineWidth, height: 26 },
  statNumber: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 12.5, marginTop: 3 },

  actionRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14, gap: 8 },
  followBtn: { flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: 'center' },
  followBtnText: { fontSize: 14.5, fontWeight: '700' },
  messageBtn: { flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: 'center' },
  messageBtnText: { fontSize: 14.5, fontWeight: '700' },

  tabBar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, position: 'relative' },
  tabIndicator: { position: 'absolute', bottom: -StyleSheet.hairlineWidth, height: 2, width: 46, borderRadius: 1 },

  gridRow: { gap: GRID_GAP, marginBottom: GRID_GAP },
  gridItem: { width: ITEM_SIZE, height: ITEM_SIZE, position: 'relative' },
  gridImage: { width: '100%', height: '100%' },
  textPostGrid: { width: '100%', height: '100%', padding: 8, justifyContent: 'center' },
  gridText: { fontSize: 11, lineHeight: 15, textAlign: 'center' },
  cornerIcon: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 3 },

  emptyState: { alignItems: 'center', paddingTop: 56, paddingHorizontal: 40 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});

export default UserProfileScreen;
