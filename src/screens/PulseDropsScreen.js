import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { getTheme } from '../styles/theme';
import api from '../services/api';

const DropCard = ({ drop, theme, onJoin }) => {
    const [isJoining, setIsJoining] = useState(false);
    const [hasJoined, setHasJoined] = useState(false);

    const handleJoin = async () => {
        if (isJoining || hasJoined) return;
        setIsJoining(true);
        try {
            await onJoin(drop._id);
            setHasJoined(true);
        } catch (error) {
            console.error('Join error:', error);
        } finally {
            setIsJoining(false);
        }
    };

    const getTimeColor = () => {
        // Parse time remaining
        const match = drop.timeRemaining?.match(/(\d+)h/);
        const hours = match ? parseInt(match[1]) : 24;
        if (hours < 2) return '#F44336';
        if (hours < 6) return '#FF9800';
        return '#4CAF50';
    };

    return (
        <TouchableOpacity style={styles.dropCard} activeOpacity={0.9}>
            <LinearGradient
                colors={['#FF6B6B', '#FF8E53']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.dropGradient}
            >
                <View style={styles.dropHeader}>
                    <View style={styles.dropBadge}>
                        <Ionicons name="flash" size={14} color="#FFF" />
                        <Text style={styles.dropBadgeText}>LIVE</Text>
                    </View>
                    <View style={[styles.timeTag, { backgroundColor: getTimeColor() + '30' }]}>
                        <Ionicons name="time-outline" size={14} color={getTimeColor()} />
                        <Text style={[styles.timeText, { color: getTimeColor() }]}>{drop.timeRemaining || '24h'}</Text>
                    </View>
                </View>

                <Text style={styles.dropTitle}>{drop.title}</Text>
                <Text style={styles.dropDesc}>{drop.description || 'Join this trending moment!'}</Text>

                <View style={styles.dropStats}>
                    <View style={styles.statItem}>
                        <Ionicons name="people" size={16} color="rgba(255,255,255,0.9)" />
                        <Text style={styles.statText}>{drop.participantCount || 0} joined</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Ionicons name="chatbubble" size={16} color="rgba(255,255,255,0.9)" />
                        <Text style={styles.statText}>{drop.responseCount || 0} responses</Text>
                    </View>
                </View>

                {drop.hashtags?.length > 0 && (
                    <View style={styles.hashtagRow}>
                        {drop.hashtags.slice(0, 3).map((tag, i) => (
                            <View key={i} style={styles.hashTag}>
                                <Text style={styles.hashTagText}>#{tag}</Text>
                            </View>
                        ))}
                    </View>
                )}

                <TouchableOpacity
                    style={[styles.joinBtn, hasJoined && styles.joinedBtn]}
                    onPress={handleJoin}
                    disabled={hasJoined || isJoining}
                >
                    {isJoining ? (
                        <ActivityIndicator size="small" color="#FF6B6B" />
                    ) : (
                        <>
                            <Ionicons name={hasJoined ? "checkmark" : "add"} size={18} color={hasJoined ? "#4CAF50" : "#FF6B6B"} />
                            <Text style={[styles.joinText, hasJoined && styles.joinedText]}>
                                {hasJoined ? 'Joined!' : 'Join Drop'}
                            </Text>
                        </>
                    )}
                </TouchableOpacity>
            </LinearGradient>
        </TouchableOpacity>
    );
};

const PulseDropsScreen = ({ navigation }) => {
    const { isDark } = useTheme();
    const theme = getTheme(isDark);

    const [drops, setDrops] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchDrops = useCallback(async (showLoader = true) => {
        if (showLoader) setIsLoading(true);
        try {
            const response = await api.get('/pulse-drops');
            if (response.data.success) {
                setDrops(response.data.data);
            }
        } catch (error) {
            console.error('Fetch drops error:', error);
            setDrops([]);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchDrops();
    }, [fetchDrops]);

    const handleRefresh = () => {
        setIsRefreshing(true);
        fetchDrops(false);
    };

    const handleJoin = async (dropId) => {
        try {
            const response = await api.post(`/pulse-drops/${dropId}/join`);
            if (response.data.success) {
                // Update local state
                setDrops(prev => prev.map(d =>
                    d._id === dropId
                        ? { ...d, participantCount: response.data.data.participantCount }
                        : d
                ));
            }
        } catch (error) {
            console.error('Join drop error:', error);
            throw error;
        }
    };

    const renderItem = useCallback(({ item }) => (
        <DropCard drop={item} theme={theme} onJoin={handleJoin} />
    ), [theme]);

    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="flash-outline" size={48} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Active Drops</Text>
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                Check back soon for trending moments!
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
                    <Text style={[styles.headerTitle, { color: theme.colors.text }]}>⚡ Pulse Drops</Text>
                    <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>Ephemeral trending moments</Text>
                </View>
            </View>

            {/* Info Banner */}
            <View style={[styles.infoBanner, { backgroundColor: '#FF6B6B15' }]}>
                <Ionicons name="time" size={16} color="#FF6B6B" />
                <Text style={[styles.infoText, { color: '#FF6B6B' }]}>
                    Drops expire in 24 hours • Join before they're gone!
                </Text>
            </View>

            {/* Drops List */}
            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#FF6B6B" />
                    <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading drops...</Text>
                </View>
            ) : (
                <FlatList
                    data={drops}
                    renderItem={renderItem}
                    keyExtractor={item => item._id}
                    contentContainerStyle={[styles.list, drops.length === 0 && { flex: 1 }]}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={renderEmpty}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={handleRefresh}
                            tintColor="#FF6B6B"
                        />
                    }
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
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    backBtn: { padding: 4, marginRight: 12 },
    headerCenter: { flex: 1 },
    headerTitle: { fontSize: 20, fontWeight: '800' },
    headerSubtitle: { fontSize: 12, marginTop: 2 },
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
    dropCard: {
        marginBottom: 16,
        borderRadius: 20,
        overflow: 'hidden',
    },
    dropGradient: {
        padding: 20,
    },
    dropHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    dropBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    dropBadgeText: {
        color: '#FFF',
        fontSize: 11,
        fontWeight: '700',
    },
    timeTag: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    timeText: { fontSize: 12, fontWeight: '700' },
    dropTitle: {
        color: '#FFF',
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 6,
    },
    dropDesc: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 14,
        marginBottom: 16,
    },
    dropStats: {
        flexDirection: 'row',
        gap: 20,
        marginBottom: 12,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statText: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 13,
        fontWeight: '600',
    },
    hashtagRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    hashTag: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    hashTagText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '600',
    },
    joinBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFF',
        paddingVertical: 12,
        borderRadius: 24,
        gap: 8,
    },
    joinedBtn: {
        backgroundColor: 'rgba(255,255,255,0.9)',
    },
    joinText: {
        color: '#FF6B6B',
        fontSize: 15,
        fontWeight: '700',
    },
    joinedText: {
        color: '#4CAF50',
    },
});

export default PulseDropsScreen;
