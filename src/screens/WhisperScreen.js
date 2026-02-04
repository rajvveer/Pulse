import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';
import { getTheme } from '../styles/theme';
import { useSelector } from 'react-redux';
import api from '../services/api';

const WhisperCard = ({ whisper, theme, onVote }) => {
    const [voted, setVoted] = useState(null);
    const [voteCount, setVoteCount] = useState(whisper.score || 0);

    const handleVote = async (type) => {
        const prevVoted = voted;
        const prevCount = voteCount;

        // Optimistic update
        if (voted === type) {
            setVoted(null);
            setVoteCount(whisper.score || 0);
        } else {
            setVoted(type);
            setVoteCount((whisper.score || 0) + (type === 'up' ? 1 : -1));
        }

        try {
            await onVote?.(whisper._id, type);
        } catch (error) {
            // Revert on error
            setVoted(prevVoted);
            setVoteCount(prevCount);
        }
    };

    const timeAgo = () => {
        const timestamp = whisper.createdAt || whisper.timestamp;
        const mins = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    return (
        <View style={[styles.whisperCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.whisperHeader}>
                <View style={[styles.anonAvatar, { backgroundColor: theme.colors.primary + '30' }]}>
                    <Ionicons name="eye-off" size={18} color={theme.colors.primary} />
                </View>
                <Text style={[styles.anonLabel, { color: theme.colors.textSecondary }]}>Anonymous</Text>
                <Text style={[styles.distance, { color: theme.colors.textSecondary }]}>📍 {whisper.distance || whisper.city || 'Nearby'}</Text>
            </View>

            <Text style={[styles.whisperContent, { color: theme.colors.text }]}>
                {whisper.content}
            </Text>

            <View style={styles.whisperFooter}>
                <View style={styles.voteRow}>
                    <TouchableOpacity
                        style={[styles.voteBtn, voted === 'up' && { backgroundColor: '#4CAF50' + '30' }]}
                        onPress={() => handleVote('up')}
                    >
                        <Ionicons name="arrow-up" size={20} color={voted === 'up' ? '#4CAF50' : theme.colors.textSecondary} />
                    </TouchableOpacity>
                    <Text style={[styles.voteCount, { color: theme.colors.text }]}>{voteCount}</Text>
                    <TouchableOpacity
                        style={[styles.voteBtn, voted === 'down' && { backgroundColor: '#F44336' + '30' }]}
                        onPress={() => handleVote('down')}
                    >
                        <Ionicons name="arrow-down" size={20} color={voted === 'down' ? '#F44336' : theme.colors.textSecondary} />
                    </TouchableOpacity>
                </View>
                <Text style={[styles.timestamp, { color: theme.colors.textSecondary }]}>{timeAgo()}</Text>
            </View>
        </View>
    );
};

const WhisperScreen = ({ navigation }) => {
    const { isDark } = useTheme();
    const theme = getTheme(isDark);
    const { location } = useSelector(state => state.ui);

    const [whispers, setWhispers] = useState([]);
    const [newWhisper, setNewWhisper] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showCompose, setShowCompose] = useState(false);
    const [isPosting, setIsPosting] = useState(false);

    // Fetch whispers from API
    const fetchWhispers = useCallback(async (showLoader = true) => {
        if (showLoader) setIsLoading(true);
        try {
            // Use default coords if location not available
            const lng = location?.longitude || 77.2;
            const lat = location?.latitude || 28.6;

            const response = await api.get(`/whispers/nearby?lng=${lng}&lat=${lat}&radius=5`);
            if (response.data.success) {
                setWhispers(response.data.data);
            }
        } catch (error) {
            console.error('Fetch whispers error:', error);
            // Show empty state instead of crashing
            setWhispers([]);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [location]);

    useEffect(() => {
        fetchWhispers();
    }, [fetchWhispers]);

    const handleRefresh = () => {
        setIsRefreshing(true);
        fetchWhispers(false);
    };

    const handlePost = useCallback(async () => {
        if (!newWhisper.trim() || isPosting) return;

        setIsPosting(true);
        try {
            const lng = location?.longitude || 77.2;
            const lat = location?.latitude || 28.6;

            const response = await api.post('/whispers', {
                content: newWhisper.trim(),
                lng,
                lat,
                city: location?.city || 'Unknown'
            });

            if (response.data.success) {
                // Add at top of list
                setWhispers(prev => [response.data.data, ...prev]);
                setNewWhisper('');
                setShowCompose(false);
            }
        } catch (error) {
            console.error('Post whisper error:', error);
        } finally {
            setIsPosting(false);
        }
    }, [newWhisper, location, isPosting]);

    const handleVote = useCallback(async (id, type) => {
        try {
            const response = await api.post(`/whispers/${id}/vote`, { voteType: type });
            if (response.data.success) {
                // Update score in list
                setWhispers(prev => prev.map(w =>
                    w._id === id ? { ...w, score: response.data.data.score } : w
                ));
            }
        } catch (error) {
            console.error('Vote error:', error);
            throw error;
        }
    }, []);

    const renderItem = useCallback(({ item }) => (
        <WhisperCard whisper={item} theme={theme} onVote={handleVote} />
    ), [theme, handleVote]);

    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="eye-off-outline" size={48} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Whispers Yet</Text>
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                Be the first to share something anonymously in your area!
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
                    <Text style={[styles.headerTitle, { color: theme.colors.text }]}>👻 Whisper Mode</Text>
                    <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>Anonymous • Local</Text>
                </View>
                <TouchableOpacity
                    onPress={() => setShowCompose(true)}
                    style={[styles.composeBtn, { backgroundColor: theme.colors.primary }]}
                >
                    <Ionicons name="add" size={22} color="#FFF" />
                </TouchableOpacity>
            </View>

            {/* Info Banner */}
            <View style={[styles.infoBanner, { backgroundColor: theme.colors.primary + '15' }]}>
                <Ionicons name="location" size={16} color={theme.colors.primary} />
                <Text style={[styles.infoText, { color: theme.colors.primary }]}>
                    Showing whispers within 5km of you
                </Text>
            </View>

            {/* Whispers List */}
            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                    <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading whispers...</Text>
                </View>
            ) : (
                <FlatList
                    data={whispers}
                    renderItem={renderItem}
                    keyExtractor={item => item._id}
                    contentContainerStyle={[styles.list, whispers.length === 0 && { flex: 1 }]}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={renderEmpty}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={handleRefresh}
                            tintColor={theme.colors.primary}
                        />
                    }
                />
            )}

            {/* Compose Modal */}
            {showCompose && (
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.composeOverlay}
                >
                    <TouchableOpacity style={styles.overlayBg} onPress={() => setShowCompose(false)} />
                    <View style={[styles.composeBox, { backgroundColor: theme.colors.surface }]}>
                        <Text style={[styles.composeTitle, { color: theme.colors.text }]}>✍️ New Whisper</Text>
                        <TextInput
                            style={[styles.composeInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                            placeholder="Share something anonymously..."
                            placeholderTextColor={theme.colors.textSecondary}
                            multiline
                            value={newWhisper}
                            onChangeText={setNewWhisper}
                            autoFocus
                            maxLength={280}
                        />
                        <View style={styles.composeFooter}>
                            <Text style={[styles.charCount, { color: theme.colors.textSecondary }]}>
                                {newWhisper.length}/280
                            </Text>
                            <TouchableOpacity
                                style={[styles.postBtn, { backgroundColor: theme.colors.primary, opacity: newWhisper.trim() && !isPosting ? 1 : 0.5 }]}
                                onPress={handlePost}
                                disabled={!newWhisper.trim() || isPosting}
                            >
                                {isPosting ? (
                                    <ActivityIndicator size="small" color="#FFF" />
                                ) : (
                                    <Text style={styles.postBtnText}>Whisper</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            )}
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
    composeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    infoBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        gap: 6,
    },
    infoText: { fontSize: 13, fontWeight: '600' },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    loadingText: { fontSize: 14 },
    list: { padding: 16, gap: 12 },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
        gap: 12,
    },
    emptyTitle: { fontSize: 18, fontWeight: '700' },
    emptyText: { fontSize: 14, textAlign: 'center' },
    whisperCard: {
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
    },
    whisperHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    anonAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    anonLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
    distance: { fontSize: 12 },
    whisperContent: { fontSize: 16, lineHeight: 22, marginBottom: 14 },
    whisperFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    voteRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    voteBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    voteCount: { fontSize: 15, fontWeight: '700', minWidth: 30, textAlign: 'center' },
    timestamp: { fontSize: 12 },
    composeOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'flex-end',
    },
    overlayBg: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    composeBox: {
        padding: 20,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
    },
    composeTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
    composeInput: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
        minHeight: 100,
        textAlignVertical: 'top',
    },
    composeFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 14,
    },
    charCount: { fontSize: 13 },
    postBtn: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 24,
        minWidth: 100,
        alignItems: 'center',
    },
    postBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
});

export default WhisperScreen;
