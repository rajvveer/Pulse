import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    RefreshControl,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';
import { getTheme } from '../styles/theme';
import PostCard from '../components/PostCard';
import api from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const REEL_GRID_GAP = 2;
const REEL_THUMB_SIZE = (SCREEN_WIDTH - REEL_GRID_GAP * 4) / 3;

const BookmarksScreen = ({ navigation }) => {
    const { isDark } = useTheme();
    const theme = getTheme(isDark);

    const [activeTab, setActiveTab] = useState('post');
    const [posts, setPosts] = useState([]);
    const [reels, setReels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchBookmarks = useCallback(async (type, silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await api.get('/bookmarks', { params: { type } });
            if (res.data?.success) {
                if (type === 'post') setPosts(res.data.data);
                else setReels(res.data.data);
            }
        } catch (error) {
            console.error('Fetch bookmarks error:', error.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchBookmarks(activeTab);
    }, [activeTab]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchBookmarks(activeTab, true);
    }, [activeTab, fetchBookmarks]);

    const handleLikePost = useCallback(async (postId) => {
        try {
            setPosts(prev => prev.map(post =>
                post._id === postId
                    ? {
                        ...post,
                        stats: {
                            ...post.stats,
                            likes: post.isLiked ? post.stats.likes - 1 : post.stats.likes + 1
                        },
                        isLiked: !post.isLiked
                    }
                    : post
            ));
            await api.post(`/posts/${postId}/like`);
        } catch (error) {
            console.error('Like error:', error);
        }
    }, []);

    const handleRemoveBookmark = useCallback(async (itemId, itemType) => {
        try {
            if (itemType === 'post') {
                setPosts(prev => prev.filter(p => p._id !== itemId));
            } else {
                setReels(prev => prev.filter(r => r._id !== itemId));
            }
            await api.post('/bookmarks', { itemId, itemType });
        } catch (error) {
            console.error('Remove bookmark error:', error);
        }
    }, []);

    const renderPost = useCallback(({ item }) => (
        <PostCard
            post={item}
            onLike={handleLikePost}
            onBookmark={(id) => handleRemoveBookmark(id, 'post')}
            navigation={navigation}
        />
    ), [handleLikePost, handleRemoveBookmark, navigation]);

    const renderReelItem = useCallback(({ item }) => (
        <TouchableOpacity
            style={styles.reelThumb}
            activeOpacity={0.8}
            onPress={() => {
                // Navigate to reels screen — could be enhanced to open specific reel
                navigation.navigate('Main', { screen: 'Reels' });
            }}
        >
            <Image
                source={{ uri: item.videoUrl }}
                style={styles.reelImage}
                contentFit="cover"
                cachePolicy="memory-disk"
            />
            <View style={styles.reelOverlay}>
                <View style={styles.reelStats}>
                    <Ionicons name="heart" size={12} color="#fff" />
                    <Text style={styles.reelStatText}>{item.stats?.likes || 0}</Text>
                </View>
            </View>
            {item.caption && (
                <Text style={styles.reelCaption} numberOfLines={1}>{item.caption}</Text>
            )}
            <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => handleRemoveBookmark(item._id, 'reel')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
                <Ionicons name="bookmark" size={16} color="#FFD700" />
            </TouchableOpacity>
        </TouchableOpacity>
    ), [handleRemoveBookmark, navigation]);

    const EmptyState = useCallback(() => (
        <View style={styles.emptyContainer}>
            <Ionicons
                name={activeTab === 'post' ? 'bookmark-outline' : 'film-outline'}
                size={80}
                color={theme.colors.textSecondary}
            />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                No saved {activeTab === 'post' ? 'posts' : 'reels'} yet
            </Text>
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                {activeTab === 'post'
                    ? 'Tap the bookmark icon on any post to save it here.'
                    : 'Tap the save icon on any reel to save it here.'}
            </Text>
        </View>
    ), [activeTab, theme]);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Bookmarks</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Tabs */}
            <View style={[styles.tabBar, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'post' && [styles.activeTab, { borderBottomColor: theme.colors.primary }]]}
                    onPress={() => setActiveTab('post')}
                >
                    <Ionicons
                        name={activeTab === 'post' ? 'bookmark' : 'bookmark-outline'}
                        size={20}
                        color={activeTab === 'post' ? theme.colors.primary : theme.colors.textSecondary}
                    />
                    <Text style={[styles.tabText, { color: activeTab === 'post' ? theme.colors.primary : theme.colors.textSecondary }]}>
                        Posts
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tab, activeTab === 'reel' && [styles.activeTab, { borderBottomColor: theme.colors.primary }]]}
                    onPress={() => setActiveTab('reel')}
                >
                    <Ionicons
                        name={activeTab === 'reel' ? 'film' : 'film-outline'}
                        size={20}
                        color={activeTab === 'reel' ? theme.colors.primary : theme.colors.textSecondary}
                    />
                    <Text style={[styles.tabText, { color: activeTab === 'reel' ? theme.colors.primary : theme.colors.textSecondary }]}>
                        Reels
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Content */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            ) : activeTab === 'post' ? (
                <FlatList
                    key="posts-list"
                    data={posts}
                    renderItem={renderPost}
                    keyExtractor={(item) => item._id}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={EmptyState}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={theme.colors.primary}
                            colors={[theme.colors.primary]}
                        />
                    }
                    showsVerticalScrollIndicator={false}
                />
            ) : (
                <FlatList
                    key="reels-grid-3"
                    data={reels}
                    renderItem={renderReelItem}
                    keyExtractor={(item) => item._id}
                    numColumns={3}
                    contentContainerStyle={styles.reelGrid}
                    ListEmptyComponent={EmptyState}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={theme.colors.primary}
                            colors={[theme.colors.primary]}
                        />
                    }
                    showsVerticalScrollIndicator={false}
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
    backButton: { padding: 4 },
    headerTitle: { fontSize: 20, fontWeight: '700' },
    tabBar: {
        flexDirection: 'row',
        borderBottomWidth: 1,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        gap: 8,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    activeTab: {
        borderBottomWidth: 2,
    },
    tabText: { fontSize: 15, fontWeight: '600' },
    listContent: { paddingVertical: 8, paddingBottom: 100, flexGrow: 1 },
    reelGrid: { paddingHorizontal: REEL_GRID_GAP, paddingTop: REEL_GRID_GAP, paddingBottom: 100, flexGrow: 1 },
    reelThumb: {
        width: REEL_THUMB_SIZE,
        height: REEL_THUMB_SIZE * 1.5,
        margin: REEL_GRID_GAP / 2,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#1a1a1a',
    },
    reelImage: {
        width: '100%',
        height: '100%',
    },
    reelOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 6,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    reelStats: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    reelStatText: { color: '#fff', fontSize: 11, fontWeight: '600' },
    reelCaption: { color: '#fff', fontSize: 10, paddingHorizontal: 4, paddingBottom: 2 },
    removeBtn: {
        position: 'absolute',
        top: 6,
        right: 6,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 12,
        padding: 4,
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 80,
        paddingHorizontal: 32,
    },
    emptyTitle: { fontSize: 20, fontWeight: '600', marginTop: 16, marginBottom: 8 },
    emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});

export default BookmarksScreen;
