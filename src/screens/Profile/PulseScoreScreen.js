import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Animated,
    Dimensions,
    RefreshControl,
    FlatList,
    ActivityIndicator,
    StatusBar
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../contexts/ThemeContext';
import { getTheme } from '../../styles/theme';
import api from '../../services/api';

const { width } = Dimensions.get('window');

const TIER_CONFIG = {
    newcomer: { emoji: '🌱', label: 'Newcomer', gradient: ['#8BC34A', '#4CAF50'] },
    rising: { emoji: '⭐', label: 'Rising Star', gradient: ['#FFC107', '#FF9800'] },
    established: { emoji: '💫', label: 'Established', gradient: ['#FF9800', '#F44336'] },
    influencer: { emoji: '🔥', label: 'Influencer', gradient: ['#F44336', '#E91E63'] },
    icon: { emoji: '👑', label: 'Icon', gradient: ['#9C27B0', '#673AB7'] }
};

const COMPONENT_META = {
    engagement: { emoji: '💎', label: 'Engagement', color: '#00D2FF' },
    consistency: { emoji: '🔥', label: 'Consistency', color: '#FF6B35' },
    community: { emoji: '🤝', label: 'Community', color: '#7B68EE' },
    reach: { emoji: '📡', label: 'Reach', color: '#FFD700' },
    creativity: { emoji: '✨', label: 'Creativity', color: '#FF1493' }
};

const PulseScoreScreen = ({ navigation }) => {
    const { isDark } = useTheme();
    const theme = getTheme(isDark);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [breakdown, setBreakdown] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);
    const [myRank, setMyRank] = useState(null);
    const [tab, setTab] = useState('overview'); // overview | leaderboard | achievements

    const scoreAnim = useRef(new Animated.Value(0)).current;
    const ringAnim = useRef(new Animated.Value(0)).current;

    const fetchData = useCallback(async () => {
        try {
            const [bdRes, lbRes] = await Promise.all([
                api.get('/pulse-score/breakdown'),
                api.get('/pulse-score/leaderboard?limit=20')
            ]);

            if (bdRes.data.success) setBreakdown(bdRes.data.data);
            if (lbRes.data.success) {
                setLeaderboard(lbRes.data.data.leaderboard || []);
                setMyRank(lbRes.data.data.myRank);
            }

            // Animate score counter
            if (bdRes.data.success) {
                Animated.timing(scoreAnim, {
                    toValue: bdRes.data.data.score / 1000,
                    duration: 1500,
                    useNativeDriver: false
                }).start();

                Animated.timing(ringAnim, {
                    toValue: (bdRes.data.data.progressToNext || 0) / 100,
                    duration: 1200,
                    useNativeDriver: false
                }).start();
            }
        } catch (error) {
            console.error('Pulse Score fetch error:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [scoreAnim, ringAnim]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const onRefresh = () => { setRefreshing(true); fetchData(); };

    if (loading) {
        return (
            <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
                <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
                <ActivityIndicator size="large" color="#FF6B35" />
                <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
                    Calculating your score...
                </Text>
            </View>
        );
    }

    const tierConfig = TIER_CONFIG[breakdown?.tier || 'newcomer'];

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B35" />
                }
            >
                {/* ══════ HERO ══════ */}
                <LinearGradient
                    colors={[...tierConfig.gradient, isDark ? '#000' : '#1A1A2E']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.hero}
                >
                    <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={24} color="#FFF" />
                    </TouchableOpacity>

                    <Text style={styles.heroEmoji}>{tierConfig.emoji}</Text>

                    <Animated.Text style={[styles.heroScore, {
                        opacity: scoreAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] })
                    }]}>
                        {breakdown?.score || 0}
                    </Animated.Text>

                    <Text style={styles.heroLabel}>{tierConfig.label}</Text>
                    <Text style={styles.heroSub}>
                        Pulse Score • {breakdown?.streak || 0} day streak 🔥
                    </Text>

                    {/* Progress bar to next tier */}
                    {breakdown?.nextTierAt && (
                        <View style={styles.progressContainer}>
                            <View style={styles.progressBg}>
                                <Animated.View style={[styles.progressFill, {
                                    width: ringAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: ['0%', '100%']
                                    })
                                }]} />
                            </View>
                            <Text style={styles.progressText}>
                                {breakdown.progressToNext}% to next tier
                            </Text>
                        </View>
                    )}

                    {myRank && (
                        <View style={styles.rankBadge}>
                            <Text style={styles.rankText}>🏆 #{myRank.rank} of {myRank.total}</Text>
                        </View>
                    )}
                </LinearGradient>

                {/* ══════ TAB SWITCHER ══════ */}
                <View style={styles.tabBar}>
                    {['overview', 'leaderboard', 'achievements'].map(t => (
                        <TouchableOpacity
                            key={t}
                            style={[styles.tab, tab === t && styles.tabActive]}
                            onPress={() => setTab(t)}
                        >
                            <Text style={[
                                styles.tabText,
                                { color: tab === t ? tierConfig.gradient[0] : theme.colors.textSecondary }
                            ]}>
                                {t.charAt(0).toUpperCase() + t.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* ══════ OVERVIEW TAB ══════ */}
                {tab === 'overview' && (
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                            📊 Score Breakdown
                        </Text>

                        {Object.entries(COMPONENT_META).map(([key, meta]) => {
                            const value = breakdown?.components?.[key] || 0;
                            const pct = (value / 200) * 100;

                            return (
                                <View key={key} style={[styles.componentRow, {
                                    backgroundColor: isDark ? '#1C1C1E' : '#F8F8FA'
                                }]}>
                                    <View style={styles.componentLabel}>
                                        <Text style={styles.componentEmoji}>{meta.emoji}</Text>
                                        <Text style={[styles.componentName, { color: theme.colors.text }]}>
                                            {meta.label}
                                        </Text>
                                    </View>

                                    <View style={styles.componentBarBg}>
                                        <View style={[styles.componentBarFill, {
                                            width: `${pct}%`,
                                            backgroundColor: meta.color
                                        }]} />
                                    </View>

                                    <Text style={[styles.componentValue, { color: meta.color }]}>
                                        {value}
                                    </Text>
                                </View>
                            );
                        })}

                        {/* Streak card */}
                        <View style={[styles.streakCard, {
                            backgroundColor: isDark ? '#1C1C1E' : '#F8F8FA'
                        }]}>
                            <View style={styles.streakRow}>
                                <View style={styles.streakItem}>
                                    <Text style={styles.streakIcon}>🔥</Text>
                                    <Text style={[styles.streakValue, { color: theme.colors.text }]}>
                                        {breakdown?.metrics?.currentStreak || 0}
                                    </Text>
                                    <Text style={[styles.streakLabel, { color: theme.colors.textSecondary }]}>
                                        Current
                                    </Text>
                                </View>
                                <View style={styles.streakItem}>
                                    <Text style={styles.streakIcon}>🏆</Text>
                                    <Text style={[styles.streakValue, { color: theme.colors.text }]}>
                                        {breakdown?.metrics?.longestStreak || 0}
                                    </Text>
                                    <Text style={[styles.streakLabel, { color: theme.colors.textSecondary }]}>
                                        Best
                                    </Text>
                                </View>
                                <View style={styles.streakItem}>
                                    <Text style={styles.streakIcon}>📅</Text>
                                    <Text style={[styles.streakValue, { color: theme.colors.text }]}>
                                        {breakdown?.metrics?.daysActive || 0}
                                    </Text>
                                    <Text style={[styles.streakLabel, { color: theme.colors.textSecondary }]}>
                                        Days Active
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>
                )}

                {/* ══════ LEADERBOARD TAB ══════ */}
                {tab === 'leaderboard' && (
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                            🏆 Global Leaderboard
                        </Text>

                        {leaderboard.map((entry, i) => {
                            const medals = ['🥇', '🥈', '🥉'];
                            const entryTier = TIER_CONFIG[entry.tier || 'newcomer'];
                            const initial = (entry.user?.username || '?').charAt(0).toUpperCase();

                            return (
                                <TouchableOpacity
                                    key={i}
                                    style={[styles.lbRow, {
                                        backgroundColor: isDark ? '#1C1C1E' : '#F8F8FA',
                                        borderLeftColor: i < 3 ? entryTier.gradient[0] : 'transparent',
                                        borderLeftWidth: i < 3 ? 3 : 0
                                    }]}
                                    onPress={() => entry.user?._id && navigation.push('UserProfile', {
                                        userId: entry.user._id,
                                        username: entry.user.username
                                    })}
                                >
                                    <Text style={styles.lbRank}>
                                        {i < 3 ? medals[i] : `#${entry.rank}`}
                                    </Text>
                                    <View style={[styles.lbAvatar, { backgroundColor: entryTier.gradient[0] }]}>
                                        <Text style={styles.lbAvatarText}>{initial}</Text>
                                    </View>
                                    <View style={styles.lbInfo}>
                                        <Text style={[styles.lbName, { color: theme.colors.text }]}>
                                            @{entry.user?.username || 'unknown'}
                                        </Text>
                                        <Text style={[styles.lbTier, { color: theme.colors.textSecondary }]}>
                                            {entryTier.emoji} {entryTier.label}
                                        </Text>
                                    </View>
                                    <Text style={[styles.lbScore, { color: entryTier.gradient[0] }]}>
                                        {entry.score}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}

                        {leaderboard.length === 0 && (
                            <View style={[styles.emptyState, { backgroundColor: isDark ? '#1C1C1E' : '#F8F8FA' }]}>
                                <Text style={{ fontSize: 40 }}>🏆</Text>
                                <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                                    No scores yet. Start posting to climb the ranks!
                                </Text>
                            </View>
                        )}
                    </View>
                )}

                {/* ══════ ACHIEVEMENTS TAB ══════ */}
                {tab === 'achievements' && (
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                            🏅 Achievements ({breakdown?.achievements?.length || 0})
                        </Text>

                        <View style={styles.achieveGrid}>
                            {(breakdown?.achievements || []).map((a, i) => (
                                <View key={i} style={[styles.achieveCard, {
                                    backgroundColor: isDark ? '#1C1C1E' : '#F8F8FA'
                                }]}>
                                    <Text style={styles.achieveEmoji}>{a.emoji}</Text>
                                    <Text style={[styles.achieveName, { color: theme.colors.text }]}>
                                        {a.name}
                                    </Text>
                                    <Text style={[styles.achieveDesc, { color: theme.colors.textSecondary }]}>
                                        {a.description}
                                    </Text>
                                </View>
                            ))}
                        </View>

                        {(!breakdown?.achievements || breakdown.achievements.length === 0) && (
                            <View style={[styles.emptyState, { backgroundColor: isDark ? '#1C1C1E' : '#F8F8FA' }]}>
                                <Text style={{ fontSize: 40 }}>🎯</Text>
                                <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                                    No achievements yet. Keep engaging to unlock badges!
                                </Text>
                            </View>
                        )}
                    </View>
                )}

            </ScrollView>
        </View>
    );
};

// =========================================================
//  STYLES
// =========================================================
const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 12, fontSize: 15 },

    // Hero
    hero: {
        paddingTop: 60,
        paddingBottom: 28,
        paddingHorizontal: 20,
        alignItems: 'center'
    },
    backBtn: {
        position: 'absolute',
        top: 50,
        left: 16,
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center'
    },
    heroEmoji: { fontSize: 50, marginTop: 10 },
    heroScore: {
        fontSize: 64,
        fontWeight: '900',
        color: '#FFF',
        marginTop: 4
    },
    heroLabel: {
        fontSize: 20,
        fontWeight: '700',
        color: '#FFF'
    },
    heroSub: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 4
    },
    progressContainer: {
        width: '80%',
        marginTop: 16
    },
    progressBg: {
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255,255,255,0.2)',
        overflow: 'hidden'
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
        backgroundColor: '#FFF'
    },
    progressText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 11,
        marginTop: 4,
        textAlign: 'center'
    },
    rankBadge: {
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        marginTop: 12
    },
    rankText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '600'
    },

    // Tab bar
    tabBar: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 12,
        gap: 8
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 12,
        alignItems: 'center'
    },
    tabActive: {
        backgroundColor: 'rgba(255,107,53,0.1)'
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600'
    },

    // Section
    section: { padding: 20, paddingTop: 0 },
    sectionTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16 },

    // Score components
    componentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 16,
        marginBottom: 10,
        gap: 10
    },
    componentLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        width: 110,
        gap: 8
    },
    componentEmoji: { fontSize: 20 },
    componentName: { fontSize: 13, fontWeight: '600' },
    componentBarBg: {
        flex: 1,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(255,255,255,0.08)',
        overflow: 'hidden'
    },
    componentBarFill: {
        height: '100%',
        borderRadius: 4
    },
    componentValue: {
        fontSize: 15,
        fontWeight: '800',
        width: 36,
        textAlign: 'right'
    },

    // Streak card
    streakCard: {
        padding: 20,
        borderRadius: 16,
        marginTop: 6
    },
    streakRow: {
        flexDirection: 'row',
        justifyContent: 'space-around'
    },
    streakItem: {
        alignItems: 'center',
        gap: 4
    },
    streakIcon: { fontSize: 24 },
    streakValue: { fontSize: 22, fontWeight: '800' },
    streakLabel: { fontSize: 11 },

    // Leaderboard
    lbRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 16,
        marginBottom: 8,
        gap: 12
    },
    lbRank: {
        fontSize: 18,
        fontWeight: '800',
        width: 36,
        textAlign: 'center'
    },
    lbAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center'
    },
    lbAvatarText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
    lbInfo: { flex: 1 },
    lbName: { fontSize: 14, fontWeight: '600' },
    lbTier: { fontSize: 12, marginTop: 2 },
    lbScore: { fontSize: 18, fontWeight: '800' },

    // Achievements
    achieveGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10
    },
    achieveCard: {
        width: (width - 50) / 2,
        padding: 16,
        borderRadius: 16,
        alignItems: 'center'
    },
    achieveEmoji: { fontSize: 32 },
    achieveName: { fontSize: 14, fontWeight: '700', marginTop: 8, textAlign: 'center' },
    achieveDesc: { fontSize: 11, marginTop: 4, textAlign: 'center' },

    // Empty state
    emptyState: {
        padding: 40,
        borderRadius: 16,
        alignItems: 'center'
    },
    emptyText: { fontSize: 14, marginTop: 12, textAlign: 'center' }
});

export default PulseScoreScreen;
