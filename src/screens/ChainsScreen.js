import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    TextInput,
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';
import { getTheme } from '../styles/theme';
import api from '../services/api';

const GENRES = [
    { id: 'all', label: 'All', emoji: '📚' },
    { id: 'mystery', label: 'Mystery', emoji: '🔍' },
    { id: 'comedy', label: 'Comedy', emoji: '😂' },
    { id: 'drama', label: 'Drama', emoji: '🎭' },
    { id: 'horror', label: 'Horror', emoji: '👻' },
    { id: 'romance', label: 'Romance', emoji: '💕' },
    { id: 'adventure', label: 'Adventure', emoji: '🗺️' },
];

const ChainCard = ({ chain, theme, onPress }) => (
    <TouchableOpacity
        style={[styles.chainCard, { backgroundColor: theme.colors.surface }]}
        onPress={() => onPress(chain)}
        activeOpacity={0.8}
    >
        <View style={styles.chainHeader}>
            <View style={[styles.genreTag, { backgroundColor: '#00BCD4' + '20' }]}>
                <Text style={styles.genreEmoji}>
                    {GENRES.find(g => g.id === chain.genre)?.emoji || '📚'}
                </Text>
                <Text style={[styles.genreText, { color: '#00BCD4' }]}>
                    {chain.genre || 'other'}
                </Text>
            </View>
            <View style={styles.statsRow}>
                <Ionicons name="git-branch" size={14} color={theme.colors.textSecondary} />
                <Text style={[styles.statNum, { color: theme.colors.text }]}>{chain.segmentCount || 0}</Text>
            </View>
        </View>

        <Text style={[styles.chainTitle, { color: theme.colors.text }]} numberOfLines={2}>
            {chain.title}
        </Text>

        <Text style={[styles.chainPreview, { color: theme.colors.textSecondary }]} numberOfLines={3}>
            {chain.lastSegment || chain.starterContent}
        </Text>

        <View style={styles.chainFooter}>
            <View style={styles.contributorsRow}>
                <Ionicons name="people" size={14} color={theme.colors.textSecondary} />
                <Text style={[styles.contributorText, { color: theme.colors.textSecondary }]}>
                    {chain.contributorCount || 1} contributors
                </Text>
            </View>
            <View style={styles.likesRow}>
                <Ionicons name="heart" size={14} color="#FF6B6B" />
                <Text style={[styles.likeNum, { color: theme.colors.text }]}>{chain.likes || 0}</Text>
            </View>
        </View>
    </TouchableOpacity>
);

const ChainsScreen = ({ navigation }) => {
    const { isDark } = useTheme();
    const theme = getTheme(isDark);

    const [chains, setChains] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [selectedGenre, setSelectedGenre] = useState('all');
    const [showCreate, setShowCreate] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newChain, setNewChain] = useState({ title: '', content: '', genre: 'other' });

    const fetchChains = useCallback(async (showLoader = true) => {
        if (showLoader) setIsLoading(true);
        try {
            const genreQuery = selectedGenre !== 'all' ? `&genre=${selectedGenre}` : '';
            const response = await api.get(`/chains?status=active${genreQuery}`);
            if (response.data.success) {
                setChains(response.data.data);
            }
        } catch (error) {
            console.error('Fetch chains error:', error);
            setChains([]);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [selectedGenre]);

    useEffect(() => {
        fetchChains();
    }, [fetchChains]);

    const handleRefresh = () => {
        setIsRefreshing(true);
        fetchChains(false);
    };

    const handleCreate = async () => {
        if (!newChain.title.trim() || !newChain.content.trim() || isCreating) return;

        setIsCreating(true);
        try {
            const response = await api.post('/chains', {
                title: newChain.title.trim(),
                starterContent: newChain.content.trim(),
                genre: newChain.genre
            });

            if (response.data.success) {
                setChains(prev => [response.data.data, ...prev]);
                setShowCreate(false);
                setNewChain({ title: '', content: '', genre: 'other' });
            }
        } catch (error) {
            console.error('Create chain error:', error);
        } finally {
            setIsCreating(false);
        }
    };

    const handleChainPress = (chain) => {
        // Navigate to chain detail screen (to be implemented)
        console.log('View chain:', chain._id);
    };

    const renderItem = useCallback(({ item }) => (
        <ChainCard chain={item} theme={theme} onPress={handleChainPress} />
    ), [theme]);

    const renderGenreFilter = () => (
        <FlatList
            horizontal
            data={GENRES}
            keyExtractor={item => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.genreList}
            renderItem={({ item }) => (
                <TouchableOpacity
                    style={[
                        styles.genreChip,
                        {
                            backgroundColor: selectedGenre === item.id
                                ? '#00BCD4'
                                : theme.colors.surface,
                        }
                    ]}
                    onPress={() => setSelectedGenre(item.id)}
                >
                    <Text style={styles.genreChipEmoji}>{item.emoji}</Text>
                    <Text style={[
                        styles.genreChipText,
                        { color: selectedGenre === item.id ? '#FFF' : theme.colors.text }
                    ]}>
                        {item.label}
                    </Text>
                </TouchableOpacity>
            )}
        />
    );

    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="git-branch-outline" size={48} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Chains Yet</Text>
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                Start a collaborative story and let others add to it!
            </Text>
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={[styles.headerTitle, { color: theme.colors.text }]}>🔗 Chain Reactions</Text>
                    <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>Collaborative stories</Text>
                </View>
                <TouchableOpacity
                    onPress={() => setShowCreate(true)}
                    style={[styles.createBtn, { backgroundColor: '#00BCD4' }]}
                >
                    <Ionicons name="add" size={22} color="#FFF" />
                </TouchableOpacity>
            </View>

            {/* Genre Filter */}
            {renderGenreFilter()}

            {/* Chains List */}
            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#00BCD4" />
                    <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading chains...</Text>
                </View>
            ) : (
                <FlatList
                    data={chains}
                    renderItem={renderItem}
                    keyExtractor={item => item._id}
                    contentContainerStyle={[styles.list, chains.length === 0 && { flex: 1 }]}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={renderEmpty}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={handleRefresh}
                            tintColor="#00BCD4"
                        />
                    }
                />
            )}

            {/* Create Modal */}
            <Modal visible={showCreate} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>✍️ Start a Chain</Text>
                            <TouchableOpacity onPress={() => setShowCreate(false)}>
                                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
                            placeholder="Chain title..."
                            placeholderTextColor={theme.colors.textSecondary}
                            value={newChain.title}
                            onChangeText={(t) => setNewChain(prev => ({ ...prev, title: t }))}
                            maxLength={80}
                        />

                        <TextInput
                            style={[styles.input, styles.contentInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                            placeholder="Write the first segment..."
                            placeholderTextColor={theme.colors.textSecondary}
                            value={newChain.content}
                            onChangeText={(t) => setNewChain(prev => ({ ...prev, content: t }))}
                            multiline
                            maxLength={500}
                        />

                        <Text style={[styles.genreLabel, { color: theme.colors.textSecondary }]}>Genre:</Text>
                        <FlatList
                            horizontal
                            data={GENRES.filter(g => g.id !== 'all')}
                            keyExtractor={item => item.id}
                            showsHorizontalScrollIndicator={false}
                            style={styles.genreSelect}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        styles.genreOption,
                                        {
                                            backgroundColor: newChain.genre === item.id
                                                ? '#00BCD4'
                                                : theme.colors.background,
                                        }
                                    ]}
                                    onPress={() => setNewChain(prev => ({ ...prev, genre: item.id }))}
                                >
                                    <Text>{item.emoji}</Text>
                                </TouchableOpacity>
                            )}
                        />

                        <TouchableOpacity
                            style={[styles.submitBtn, { opacity: newChain.title.trim() && newChain.content.trim() && !isCreating ? 1 : 0.5 }]}
                            onPress={handleCreate}
                            disabled={!newChain.title.trim() || !newChain.content.trim() || isCreating}
                        >
                            {isCreating ? (
                                <ActivityIndicator size="small" color="#FFF" />
                            ) : (
                                <Text style={styles.submitText}>Start Chain</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    backBtn: { padding: 4, marginRight: 12 },
    headerCenter: { flex: 1 },
    headerTitle: { fontSize: 20, fontWeight: '800' },
    headerSubtitle: { fontSize: 12, marginTop: 2 },
    createBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    genreList: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
    genreChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        marginRight: 8,
        gap: 6,
    },
    genreChipEmoji: { fontSize: 14 },
    genreChipText: { fontSize: 13, fontWeight: '600' },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    loadingText: { fontSize: 14 },
    list: { padding: 16 },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
        gap: 12,
    },
    emptyTitle: { fontSize: 18, fontWeight: '700' },
    emptyText: { fontSize: 14, textAlign: 'center' },
    chainCard: {
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
    },
    chainHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    genreTag: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    genreEmoji: { fontSize: 12 },
    genreText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statNum: { fontSize: 13, fontWeight: '600' },
    chainTitle: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
    chainPreview: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
    chainFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    contributorsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    contributorText: { fontSize: 12 },
    likesRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    likeNum: { fontSize: 13, fontWeight: '600' },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: { fontSize: 20, fontWeight: '700' },
    input: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
        marginBottom: 12,
    },
    contentInput: {
        minHeight: 120,
        textAlignVertical: 'top',
    },
    genreLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
    genreSelect: { marginBottom: 20 },
    genreOption: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    submitBtn: {
        backgroundColor: '#00BCD4',
        paddingVertical: 14,
        borderRadius: 24,
        alignItems: 'center',
    },
    submitText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});

export default ChainsScreen;
