import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    FlatList,
    Image,
    ActivityIndicator,
    Keyboard,
    StatusBar,
    Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { getTheme } from '../styles/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import api from '../services/api';

const { width } = Dimensions.get('window');

const TABS = [
    { key: 'all', label: 'All' },
    { key: 'users', label: 'Users' },
    { key: 'posts', label: 'Posts' },
    { key: 'tags', label: 'Tags' }
];

const SearchScreen = ({ navigation }) => {
    const { isDark } = useTheme();
    const theme = getTheme(isDark);
    const inputRef = useRef(null);

    const [query, setQuery] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState([]);
    const [posts, setPosts] = useState([]);
    const [trending, setTrending] = useState([]);

    // Focus input on mount
    useEffect(() => {
        setTimeout(() => inputRef.current?.focus(), 300);
        fetchTrending();
    }, []);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (query.trim().length >= 2) {
                performSearch();
            } else {
                setUsers([]);
                setPosts([]);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [query, activeTab]);

    const fetchTrending = async () => {
        try {
            const res = await api.get('/posts/trending');
            if (res.data.success) {
                setTrending(res.data.data);
            }
        } catch (err) {
            console.error('Trending fetch error:', err);
        }
    };

    const performSearch = async () => {
        if (!query.trim()) return;
        setLoading(true);

        try {
            const searchPromises = [];

            if (activeTab === 'all' || activeTab === 'users') {
                searchPromises.push(api.get(`/users/search?q=${encodeURIComponent(query)}`));
            } else {
                searchPromises.push(Promise.resolve({ data: { data: [] } }));
            }

            if (activeTab === 'all' || activeTab === 'posts' || activeTab === 'tags') {
                searchPromises.push(api.get(`/posts/search?q=${encodeURIComponent(query)}`));
            } else {
                searchPromises.push(Promise.resolve({ data: { data: [] } }));
            }

            const [userRes, postRes] = await Promise.all(searchPromises);

            setUsers(userRes.data.data || []);
            setPosts(postRes.data.data || []);
        } catch (err) {
            console.error('Search error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleUserPress = (user) => {
        Keyboard.dismiss();
        navigation.navigate('UserProfile', { username: user.username });
    };

    const handlePostPress = (post) => {
        Keyboard.dismiss();
        navigation.navigate('PostDetail', { postId: post._id });
    };

    const handleTagPress = (tag) => {
        setQuery(`#${tag}`);
        setActiveTab('posts');
    };

    // Render user item
    const renderUserItem = ({ item }) => (
        <TouchableOpacity
            style={[styles.userItem, { backgroundColor: isDark ? '#1C1C1E' : '#F8F8F8' }]}
            onPress={() => handleUserPress(item)}
        >
            {item.profile?.avatar || item.avatar ? (
                <Image
                    source={{ uri: item.profile?.avatar || item.avatar }}
                    style={styles.userAvatar}
                />
            ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.primary }]}>
                    <Text style={styles.avatarInitial}>
                        {(item.username || '?').charAt(0).toUpperCase()}
                    </Text>
                </View>
            )}
            <View style={styles.userInfo}>
                <Text style={[styles.userName, { color: theme.colors.text }]}>
                    {item.profile?.displayName || item.username}
                </Text>
                <Text style={[styles.userHandle, { color: theme.colors.textSecondary }]}>
                    @{item.username}
                </Text>
            </View>
            {item.isVerified && (
                <Ionicons name="checkmark-circle" size={18} color="#0095F6" />
            )}
        </TouchableOpacity>
    );

    // Render post item
    const renderPostItem = ({ item }) => {
        const imageUrl = item.content?.media?.[0]?.url;
        return (
            <TouchableOpacity
                style={[styles.postItem, { backgroundColor: isDark ? '#1C1C1E' : '#F8F8F8' }]}
                onPress={() => handlePostPress(item)}
            >
                {imageUrl && (
                    <Image source={{ uri: imageUrl }} style={styles.postImage} />
                )}
                <View style={styles.postContent}>
                    <View style={styles.postAuthor}>
                        {item.author?.profile?.avatar || item.author?.avatar ? (
                            <Image
                                source={{ uri: item.author?.profile?.avatar || item.author?.avatar }}
                                style={styles.postAuthorAvatar}
                            />
                        ) : (
                            <View style={[styles.postAuthorAvatarPlaceholder, { backgroundColor: theme.colors.primary }]}>
                                <Text style={styles.postAuthorInitial}>
                                    {(item.author?.username || '?').charAt(0).toUpperCase()}
                                </Text>
                            </View>
                        )}
                        <Text style={[styles.postAuthorName, { color: theme.colors.text }]}>
                            {item.author?.username}
                        </Text>
                    </View>
                    {item.content?.text && (
                        <Text
                            numberOfLines={2}
                            style={[styles.postText, { color: theme.colors.textSecondary }]}
                        >
                            {item.content.text}
                        </Text>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    // Render trending tag
    const renderTrendingTag = ({ item, index }) => (
        <TouchableOpacity
            style={[styles.trendingItem, { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' }]}
            onPress={() => handleTagPress(item.tag)}
        >
            <Text style={[styles.trendingRank, { color: theme.colors.textSecondary }]}>
                {index + 1}
            </Text>
            <View style={styles.trendingInfo}>
                <Text style={[styles.trendingTag, { color: theme.colors.text }]}>
                    #{item.tag}
                </Text>
                <Text style={[styles.trendingCount, { color: theme.colors.textSecondary }]}>
                    {item.count} posts
                </Text>
            </View>
            <Ionicons name="trending-up" size={18} color={theme.colors.primary} />
        </TouchableOpacity>
    );

    // Combined results for "All" tab
    const getCombinedResults = () => {
        const results = [];

        if (users.length > 0) {
            results.push({ type: 'section', title: 'Users' });
            users.slice(0, 3).forEach(u => results.push({ type: 'user', data: u }));
            if (users.length > 3) {
                results.push({ type: 'more', label: `See all ${users.length} users`, tab: 'users' });
            }
        }

        if (posts.length > 0) {
            results.push({ type: 'section', title: 'Posts' });
            posts.slice(0, 3).forEach(p => results.push({ type: 'post', data: p }));
            if (posts.length > 3) {
                results.push({ type: 'more', label: `See all ${posts.length} posts`, tab: 'posts' });
            }
        }

        return results;
    };

    const renderCombinedItem = ({ item }) => {
        if (item.type === 'section') {
            return (
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    {item.title}
                </Text>
            );
        }
        if (item.type === 'user') {
            return renderUserItem({ item: item.data });
        }
        if (item.type === 'post') {
            return renderPostItem({ item: item.data });
        }
        if (item.type === 'more') {
            return (
                <TouchableOpacity
                    style={styles.moreBtn}
                    onPress={() => setActiveTab(item.tab)}
                >
                    <Text style={[styles.moreText, { color: theme.colors.primary }]}>
                        {item.label}
                    </Text>
                </TouchableOpacity>
            );
        }
        return null;
    };

    const renderContent = () => {
        if (loading) {
            return (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            );
        }

        if (!query.trim()) {
            // Show trending when no search
            return (
                <View style={styles.trendingContainer}>
                    <Text style={[styles.trendingTitle, { color: theme.colors.text }]}>
                        🔥 Trending
                    </Text>
                    <FlatList
                        data={trending}
                        keyExtractor={(item, i) => `trend-${i}`}
                        renderItem={renderTrendingTag}
                        scrollEnabled={false}
                    />
                </View>
            );
        }

        if (activeTab === 'all') {
            const combined = getCombinedResults();
            if (combined.length === 0) {
                return (
                    <View style={styles.centerContainer}>
                        <Ionicons name="search-outline" size={48} color={theme.colors.textSecondary} />
                        <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                            No results for "{query}"
                        </Text>
                    </View>
                );
            }
            return (
                <FlatList
                    data={combined}
                    keyExtractor={(item, i) => `combined-${i}`}
                    renderItem={renderCombinedItem}
                    contentContainerStyle={styles.listContent}
                />
            );
        }

        if (activeTab === 'users') {
            return (
                <FlatList
                    data={users}
                    keyExtractor={item => item._id}
                    renderItem={renderUserItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.centerContainer}>
                            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                                No users found
                            </Text>
                        </View>
                    }
                />
            );
        }

        if (activeTab === 'posts' || activeTab === 'tags') {
            return (
                <FlatList
                    data={posts}
                    keyExtractor={item => item._id}
                    renderItem={renderPostItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.centerContainer}>
                            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                                No posts found
                            </Text>
                        </View>
                    }
                />
            );
        }

        return null;
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

            {/* Header with Search Bar */}
            <View style={[styles.header, { borderBottomColor: isDark ? '#2C2C2E' : '#E5E5E5' }]}>
                <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>

                <View style={[styles.searchBar, { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}>
                    <Ionicons name="search" size={18} color={theme.colors.textSecondary} />
                    <TextInput
                        ref={inputRef}
                        style={[styles.searchInput, { color: theme.colors.text }]}
                        placeholder="Search users, posts, hashtags..."
                        placeholderTextColor={theme.colors.textSecondary}
                        value={query}
                        onChangeText={setQuery}
                        returnKeyType="search"
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                    {query.length > 0 && (
                        <TouchableOpacity onPress={() => setQuery('')}>
                            <Ionicons name="close-circle" size={18} color={theme.colors.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Tabs */}
            <View style={[styles.tabs, { borderBottomColor: isDark ? '#2C2C2E' : '#E5E5E5' }]}>
                {TABS.map(tab => (
                    <TouchableOpacity
                        key={tab.key}
                        style={[
                            styles.tab,
                            activeTab === tab.key && { borderBottomColor: theme.colors.primary, borderBottomWidth: 2 }
                        ]}
                        onPress={() => setActiveTab(tab.key)}
                    >
                        <Text
                            style={[
                                styles.tabText,
                                { color: activeTab === tab.key ? theme.colors.text : theme.colors.textSecondary }
                            ]}
                        >
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Content */}
            {renderContent()}
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
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        gap: 12,
    },
    backBtn: {
        padding: 4,
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        padding: 0,
    },
    tabs: {
        flexDirection: 'row',
        borderBottomWidth: 1,
    },
    tab: {
        flex: 1,
        paddingVertical: 14,
        alignItems: 'center',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
    },
    listContent: {
        padding: 16,
        paddingBottom: 100,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 60,
    },
    emptyText: {
        fontSize: 16,
        marginTop: 12,
    },

    // User Item
    userItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 14,
        marginBottom: 10,
        gap: 14,
    },
    userAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    avatarPlaceholder: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarInitial: {
        fontSize: 20,
        fontWeight: '700',
        color: '#FFF',
    },
    userInfo: {
        flex: 1,
    },
    userName: {
        fontSize: 16,
        fontWeight: '600',
    },
    userHandle: {
        fontSize: 13,
        marginTop: 2,
    },

    // Post Item
    postItem: {
        flexDirection: 'row',
        padding: 14,
        borderRadius: 14,
        marginBottom: 10,
        gap: 12,
    },
    postImage: {
        width: 70,
        height: 70,
        borderRadius: 10,
    },
    postContent: {
        flex: 1,
    },
    postAuthor: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 6,
    },
    postAuthorAvatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
    },
    postAuthorAvatarPlaceholder: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    postAuthorInitial: {
        fontSize: 10,
        fontWeight: '700',
        color: '#FFF',
    },
    postAuthorName: {
        fontSize: 14,
        fontWeight: '600',
    },
    postText: {
        fontSize: 13,
        lineHeight: 18,
    },

    // Trending
    trendingContainer: {
        padding: 16,
    },
    trendingTitle: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 16,
    },
    trendingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 14,
        marginBottom: 10,
        gap: 16,
    },
    trendingRank: {
        fontSize: 16,
        fontWeight: '700',
        width: 24,
    },
    trendingInfo: {
        flex: 1,
    },
    trendingTag: {
        fontSize: 16,
        fontWeight: '600',
    },
    trendingCount: {
        fontSize: 12,
        marginTop: 2,
    },

    // Section
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginTop: 16,
        marginBottom: 12,
    },
    moreBtn: {
        paddingVertical: 12,
        alignItems: 'center',
    },
    moreText: {
        fontSize: 14,
        fontWeight: '600',
    },
});

export default SearchScreen;
