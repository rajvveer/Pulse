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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native'; 
import { logoutAsync, setUser } from '../../redux/slices/authSlice'; 
import { useTheme } from '../../contexts/ThemeContext';
import { getTheme } from '../../styles/theme';
import { ThemeToggle } from '../../components/UI/ThemeToggle';
import Ionicons from '@expo/vector-icons/Ionicons';
import api from '../../services/api';

const { width } = Dimensions.get('window');
const COVER_HEIGHT = 200;
const COLUMN_SIZE = (width - 32) / 2; // 2 Columns for a "Gallery" feel

const ProfileScreen = ({ navigation }) => {
  const { user } = useSelector(state => state.auth);
  const dispatch = useDispatch();
  const { isDark } = useTheme();
  const theme = getTheme(isDark);
  
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('gallery'); // 'gallery' or 'menu'
  const [userPosts, setUserPosts] = useState([]);
  
  // Animation Value for Parallax
  const scrollY = useRef(new Animated.Value(0)).current;

  // Local state for immediate stats updates
  const [stats, setStats] = useState({
    posts: user?.stats?.posts || 0,
    followers: user?.stats?.followers || 0,
    following: user?.stats?.following || 0
  });

  // ✅ Auto-refresh data when screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchLatestData();
    }, [])
  );

  const fetchLatestData = async () => {
    try {
      // 1. Fetch Profile Data (Stats, Bio, Avatar changes)
      const profileRes = await api.get('/users/me');
      if (profileRes.data.success) {
        const freshUser = profileRes.data.data;
        
        // Update Redux global state
        if (setUser) dispatch(setUser(freshUser)); 

        // Update local stats state
        setStats({
          posts: freshUser.stats?.posts || 0,
          followers: freshUser.stats?.followers || 0,
          following: freshUser.stats?.following || 0
        });
        
        // 2. Fetch User's Posts for the Gallery
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
    Alert.alert('Logout', 'Ready to disconnect?', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => await dispatch(logoutAsync()) },
    ]);
  };

  const avatarInitial = (user?.username || '?').charAt(0).toUpperCase();

  // --- RENDER ITEMS ---

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
        {/* Like Badge Overlay */}
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

      {/* 1. Custom Transparent Header */}
      <View style={styles.navBar}>
        <View style={styles.navBadge}>
           <Text style={styles.navUsername}>@{user?.username}</Text>
        </View>
        <TouchableOpacity 
          style={styles.settingsBtn} 
          onPress={() => navigation.navigate('Settings')}
        >
           <Ionicons name="cog" size={24} color="#FFF" style={styles.shadowIcon} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
      >
        
        {/* 2. Immersive Cover Photo */}
        <View style={styles.coverContainer}>
           <Image 
             source={{ uri: user?.profile?.coverPhoto || 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&q=80' }} 
             style={styles.coverPhoto} 
           />
           <View style={styles.coverOverlay} />
        </View>

        {/* 3. Floating Profile Card */}
        <View style={styles.profileBody}>
           
           {/* Avatar Overlapping Cover */}
           <View style={[styles.avatarContainer, { borderColor: theme.colors.background }]}>
              {user?.profile?.avatar ? (
                <Image source={{ uri: user.profile.avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.primary }]}>
                   <Text style={styles.avatarInitial}>{avatarInitial}</Text>
                </View>
              )}
              {user?.isVerified && (
                 <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                 </View>
              )}
           </View>

           {/* Name & Bio */}
           <View style={styles.infoSection}>
              <Text style={[styles.displayName, { color: theme.colors.text }]}>
                {user?.profile?.displayName || user?.username}
              </Text>
              
              {user?.profile?.bio ? (
                <Text style={[styles.bio, { color: theme.colors.textSecondary }]}>{user.profile.bio}</Text>
              ) : null}

              <TouchableOpacity style={styles.locationChip}>
                 <Ionicons name="location-sharp" size={12} color={theme.colors.textSecondary} />
                 <Text style={[styles.locationText, { color: theme.colors.textSecondary }]}>
                    {user?.profile?.location || 'Digital Nomad'}
                 </Text>
              </TouchableOpacity>
           </View>

           {/* 4. Glassmorphism Stats Card */}
           <View style={[styles.statsCard, { backgroundColor: isDark ? '#1A1A1A' : '#F5F5F5' }]}>
              <View style={styles.statItem}>
                 <Text style={[styles.statValue, { color: theme.colors.text }]}>{stats.posts}</Text>
                 <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Shots</Text>
              </View>
              <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
              
              <TouchableOpacity 
                 style={styles.statItem}
                 onPress={() => navigation.push('Connections', { username: user.username, type: 'followers' })}
              >
                 <Text style={[styles.statValue, { color: theme.colors.text }]}>{stats.followers}</Text>
                 <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Fans</Text>
              </TouchableOpacity>
              
              <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
              
              <TouchableOpacity 
                 style={styles.statItem}
                 onPress={() => navigation.push('Connections', { username: user.username, type: 'following' })}
              >
                 <Text style={[styles.statValue, { color: theme.colors.text }]}>{stats.following}</Text>
                 <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Following</Text>
              </TouchableOpacity>
           </View>

           {/* 5. Main Action Buttons */}
           <View style={styles.actionRow}>
              <TouchableOpacity 
                 style={[styles.primaryBtn, { backgroundColor: theme.colors.text }]}
                 onPress={() => navigation.navigate('EditProfile')}
              >
                 <Text style={[styles.primaryBtnText, { color: theme.colors.background }]}>Edit Profile</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={[styles.iconBtn, { borderColor: theme.colors.border }]}>
                 <Ionicons name="share-outline" size={22} color={theme.colors.text} />
              </TouchableOpacity>
           </View>

           {/* 6. Creative Tab Switcher */}
           <View style={styles.tabContainer}>
              <TouchableOpacity 
                style={[styles.tab, activeTab === 'gallery' && styles.activeTab]}
                onPress={() => setActiveTab('gallery')}
              >
                 <Text style={[styles.tabText, { color: activeTab === 'gallery' ? theme.colors.text : theme.colors.textSecondary }]}>
                   Gallery
                 </Text>
                 {activeTab === 'gallery' && <View style={[styles.activeDot, { backgroundColor: theme.colors.primary }]} />}
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.tab, activeTab === 'menu' && styles.activeTab]}
                onPress={() => setActiveTab('menu')}
              >
                 <Text style={[styles.tabText, { color: activeTab === 'menu' ? theme.colors.text : theme.colors.textSecondary }]}>
                   Menu
                 </Text>
                 {activeTab === 'menu' && <View style={[styles.activeDot, { backgroundColor: theme.colors.primary }]} />}
              </TouchableOpacity>
           </View>

           {/* 7. Content Area */}
           {activeTab === 'gallery' ? (
              <View style={styles.galleryContainer}>
                 
                 {/* ✅ SHORTCUT TO CONTENT MANAGER */}
                 <View style={styles.galleryHeader}>
                    <Text style={{color: theme.colors.textSecondary, fontSize: 12}}>LATEST SHOTS</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('MyPosts')}>
                        <Text style={{color: theme.colors.primary, fontWeight: '700', fontSize: 12}}>MANAGE POSTS</Text>
                    </TouchableOpacity>
                 </View>

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
                       <Image 
                         source={{ uri: 'https://cdn-icons-png.flaticon.com/512/7486/7486744.png' }} 
                         style={{ width: 80, height: 80, opacity: 0.5, marginBottom: 10 }} 
                       />
                       <Text style={{ color: theme.colors.textSecondary }}>Start creating your gallery.</Text>
                       <TouchableOpacity onPress={() => navigation.navigate('Create')} style={{marginTop: 10}}>
                          <Text style={{color: theme.colors.primary, fontWeight:'600'}}>Create Now</Text>
                       </TouchableOpacity>
                    </View>
                 )}
              </View>
           ) : (
              <View style={styles.menuList}>
                 {/* ✅ MENU ITEM FOR CONTENT MANAGER */}
                 <TouchableOpacity 
                    style={[styles.menuItem, { backgroundColor: theme.colors.surface }]} 
                    onPress={() => navigation.navigate('MyPosts')}
                 >
                    <Ionicons name="grid" size={20} color={theme.colors.primary} />
                    <Text style={[styles.menuText, { color: theme.colors.text }]}>Manage Content</Text>
                    <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
                 </TouchableOpacity>

                 <TouchableOpacity style={[styles.menuItem, { backgroundColor: theme.colors.surface }]} onPress={() => navigation.navigate('Settings')}>
                    <Ionicons name="settings" size={20} color={theme.colors.textSecondary} />
                    <Text style={[styles.menuText, { color: theme.colors.text }]}>Settings</Text>
                    <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
                 </TouchableOpacity>
                 
                 <TouchableOpacity style={[styles.menuItem, { backgroundColor: theme.colors.surface }]} onPress={() => {}}>
                    <Ionicons name="bookmark" size={20} color="#FF9800" />
                    <Text style={[styles.menuText, { color: theme.colors.text }]}>Saved Posts</Text>
                    <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
                 </TouchableOpacity>

                 <View style={{ marginVertical: 10 }}>
                    <ThemeToggle />
                 </View>

                 <TouchableOpacity style={[styles.menuItem, { backgroundColor: '#FFEBEE' }]} onPress={handleLogout}>
                    <Ionicons name="log-out" size={20} color="#D32F2F" />
                    <Text style={[styles.menuText, { color: '#D32F2F' }]}>Sign Out</Text>
                 </TouchableOpacity>
              </View>
           )}
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
  navBadge: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    // Note: backdropFilter is not standard React Native, use View styles usually
  },
  navUsername: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  settingsBtn: {
    padding: 8,
  },
  shadowIcon: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
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
    marginTop: -50, // Pulls it up into cover
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
    // Soft Shadow
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
    flex: 1,
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
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // --- Tabs ---
  tabContainer: {
    flexDirection: 'row',
    marginTop: 30,
    marginBottom: 20,
    justifyContent: 'center',
    gap: 40,
  },
  tab: {
    alignItems: 'center',
    paddingBottom: 6,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 4,
  },

  // --- Content ---
  galleryContainer: {
    flex: 1,
  },
  galleryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  galleryItem: {
    width: COLUMN_SIZE,
    height: COLUMN_SIZE * 1.3, // Rectangular portrait feel
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

  // --- Menu ---
  menuList: {
    gap: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 16,
  },
  menuText: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
});

export default ProfileScreen;