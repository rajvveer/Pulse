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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { useTheme } from '../../contexts/ThemeContext';
import { getTheme } from '../../styles/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import api from '../../services/api';

const { width } = Dimensions.get('window');
const COVER_HEIGHT = 200;
const COLUMN_SIZE = (width - 32) / 2;

const UserProfileScreen = ({ route, navigation }) => {
  const { username, userId } = route.params; 
  const { user: currentUser } = useSelector(state => state.auth);
  const { isDark } = useTheme();
  const theme = getTheme(isDark);

  const [userData, setUserData] = useState(null);
  const [userPosts, setUserPosts] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Follow State
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  
  // ✅ NEW: Message State
  const [messageLoading, setMessageLoading] = useState(false);
  
  // Animation Value
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
    setRefreshing(false);
  };

  // --- ACTIONS ---

  const handleFollowToggle = async () => {
    if (followLoading) return;
    try {
      setFollowLoading(true);
      
      // Optimistic Update
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
      setIsFollowing(prev => !prev); // Revert
      Alert.alert('Error', 'Failed to update follow status');
    } finally {
      setFollowLoading(false);
    }
  };

  // ✅ NEW: Handle Message Button Click
  const handleMessage = async () => {
    if (messageLoading) return;

    try {
      setMessageLoading(true);

      // 1. Call API to get or create conversation ID
      const res = await api.post('/chat/conversation', { 
        targetUserId: userData._id 
      });

      if (res.data.success) {
        // 2. Navigate to Chat Screen with required params
        navigation.navigate('ChatScreen', { 
          conversationId: res.data.data._id, 
          targetUser: userData // Pass full user object for header
        });
      }
    } catch (error) {
      console.error("Chat init error", error);
      Alert.alert("Error", "Could not start conversation");
    } finally {
      setMessageLoading(false);
    }
  };

  // --- RENDERING ---

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

  const renderPostItem = ({ item }) => {
    const imageUrl = item.content?.media?.[0]?.url;
    return (
      <TouchableOpacity 
        style={[styles.galleryItem, { backgroundColor: theme.colors.surface }]}
        onPress={() => navigation.navigate('PostDetail', { postId: item._id })}
        activeOpacity={0.9}
      >
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.galleryImage} resizeMode="cover" />
        ) : (
          <View style={styles.textPost}>
             <Text numberOfLines={4} style={[styles.postTextContent, { color: theme.colors.text }]}>
               "{item.content?.text}"
             </Text>
             <Ionicons name="text" size={20} color={theme.colors.textSecondary} style={{marginTop: 10}}/>
          </View>
        )}
        <View style={styles.likeBadge}>
           <Ionicons name="heart" size={12} color="#FFF" />
           <Text style={styles.likeCount}>{item.stats?.likes || 0}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* 1. Custom Nav Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.iconBtnGlass} onPress={() => navigation.goBack()}>
           <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        
        <View style={styles.navBadge}>
           <Text style={styles.navUsername}>@{userData.username}</Text>
        </View>

        <TouchableOpacity style={styles.iconBtnGlass}>
           <Ionicons name="ellipsis-horizontal" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
      >
        
        {/* 2. Cover Photo */}
        <View style={styles.coverContainer}>
           <Image 
             source={{ uri: userData.profile?.coverPhoto || 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&q=80' }} 
             style={styles.coverPhoto} 
           />
           <View style={styles.coverOverlay} />
        </View>

        {/* 3. Profile Body */}
        <View style={styles.profileBody}>
           
           {/* Avatar */}
           <View style={[styles.avatarContainer, { borderColor: theme.colors.background }]}>
              {userData.profile?.avatar ? (
                <Image source={{ uri: userData.profile.avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.primary }]}>
                   <Text style={styles.avatarInitial}>{avatarInitial}</Text>
                </View>
              )}
              {userData.isVerified && (
                 <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                 </View>
              )}
           </View>

           {/* Info */}
           <View style={styles.infoSection}>
              <Text style={[styles.displayName, { color: theme.colors.text }]}>
                {userData.profile?.displayName || userData.username}
              </Text>
              
              {userData.profile?.bio ? (
                <Text style={[styles.bio, { color: theme.colors.textSecondary }]}>{userData.profile.bio}</Text>
              ) : null}

              {userData.profile?.location ? (
                <View style={styles.locationChip}>
                   <Ionicons name="location-sharp" size={12} color={theme.colors.textSecondary} />
                   <Text style={[styles.locationText, { color: theme.colors.textSecondary }]}>
                      {userData.profile.location}
                   </Text>
                </View>
              ) : null}
           </View>

           {/* 4. Stats Card */}
           <View style={[styles.statsCard, { backgroundColor: isDark ? '#1A1A1A' : '#F5F5F5' }]}>
              <View style={styles.statItem}>
                 <Text style={[styles.statValue, { color: theme.colors.text }]}>
                    {userPosts.length || userData.stats?.posts || 0}
                 </Text>
                 <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Posts</Text>
              </View>
              <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
              
              <TouchableOpacity 
                 style={styles.statItem}
                 onPress={() => navigation.push('Connections', { username: userData.username, type: 'followers' })}
              >
                 <Text style={[styles.statValue, { color: theme.colors.text }]}>
                    {userData.stats?.followers || 0}
                 </Text>
                 <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Followers</Text>
              </TouchableOpacity>
              
              <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
              
              <TouchableOpacity 
                 style={styles.statItem}
                 onPress={() => navigation.push('Connections', { username: userData.username, type: 'following' })}
              >
                 <Text style={[styles.statValue, { color: theme.colors.text }]}>
                    {userData.stats?.following || 0}
                 </Text>
                 <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Following</Text>
              </TouchableOpacity>
           </View>

           {/* 5. Action Buttons (Follow / Message) */}
           {!isOwnProfile && (
             <View style={styles.actionRow}>
                {/* Follow Button */}
                <TouchableOpacity 
                   style={[styles.primaryBtn, { 
                     backgroundColor: isFollowing ? theme.colors.surface : theme.colors.text,
                     borderWidth: isFollowing ? 1 : 0,
                     borderColor: theme.colors.border,
                     flex: 3 // Take more width
                   }]}
                   onPress={handleFollowToggle}
                   disabled={followLoading}
                >
                   {followLoading ? (
                      <ActivityIndicator size="small" color={isFollowing ? theme.colors.text : theme.colors.background} />
                   ) : (
                      <Text style={[styles.primaryBtnText, { 
                        color: isFollowing ? theme.colors.text : theme.colors.background 
                      }]}>
                        {isFollowing ? 'Following' : 'Follow'}
                      </Text>
                   )}
                </TouchableOpacity>
                
                {/* ✅ MESSAGE BUTTON */}
                <TouchableOpacity 
                   style={[styles.iconBtn, { borderColor: theme.colors.border, flex: 1 }]}
                   onPress={handleMessage}
                   disabled={messageLoading}
                >
                   {messageLoading ? (
                     <ActivityIndicator size="small" color={theme.colors.text} />
                   ) : (
                     <Ionicons name="chatbubble-ellipses-outline" size={24} color={theme.colors.text} />
                   )}
                </TouchableOpacity>
             </View>
           )}

           {/* 6. Gallery Header */}
           <View style={styles.galleryHeader}>
              <Text style={[styles.galleryTitle, { color: theme.colors.text }]}>Gallery</Text>
              <View style={{height: 1, flex: 1, backgroundColor: theme.colors.border, marginLeft: 16}} />
           </View>

           {/* 7. Gallery Grid */}
           <View style={styles.galleryContainer}>
              {userPosts.length > 0 ? (
                 <FlatList
                   data={userPosts}
                   keyExtractor={item => item._id}
                   renderItem={renderPostItem}
                   numColumns={2}
                   scrollEnabled={false}
                   columnWrapperStyle={{ justifyContent: 'space-between', marginBottom: 16 }}
                 />
              ) : (
                 <View style={styles.emptyContainer}>
                    <Ionicons name="images-outline" size={48} color={theme.colors.textSecondary} opacity={0.5} />
                    <Text style={{ color: theme.colors.textSecondary, marginTop: 10 }}>No posts yet.</Text>
                 </View>
              )}
           </View>

        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  // --- Nav ---
  navBar: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  iconBtnGlass: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navBadge: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  navUsername: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  
  // --- Header ---
  coverContainer: {
    height: COVER_HEIGHT,
    width: '100%',
    position: 'relative',
  },
  coverPhoto: {
    width: '100%',
    height: '100%',
  },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  
  // --- Body ---
  profileBody: {
    marginTop: -40,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  avatarContainer: {
    alignSelf: 'center',
    borderWidth: 4,
    borderRadius: 60,
    position: 'relative',
    marginTop: -50,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFF',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: '#2196F3',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  
  // --- Info ---
  infoSection: {
    alignItems: 'center',
    marginTop: 12,
  },
  displayName: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  bio: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: '80%',
    lineHeight: 20,
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: 'rgba(128,128,128,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  locationText: {
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '500',
  },

  // --- Stats Card ---
  statsCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  divider: {
    width: 1,
    height: 24,
  },

  // --- Actions ---
  actionRow: {
    flexDirection: 'row',
    marginTop: 24,
    gap: 12,
  },
  primaryBtn: {
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontWeight: '700',
    fontSize: 15,
  },
  iconBtn: {
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // --- Gallery ---
  galleryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 20,
  },
  galleryTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  galleryContainer: {
    flex: 1,
  },
  galleryItem: {
    width: COLUMN_SIZE,
    height: COLUMN_SIZE * 1.3,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 0,
  },
  galleryImage: {
    width: '100%',
    height: '100%',
  },
  textPost: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  postTextContent: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  likeBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 4,
  },
  likeCount: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
});

export default UserProfileScreen;