import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Animated,
    Dimensions,
    RefreshControl,
    Share,
    ActivityIndicator,
    StatusBar
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../contexts/ThemeContext';
import { getTheme } from '../../styles/theme';
import api from '../../services/api';

const { width } = Dimensions.get('window');
const BAR_MAX_WIDTH = width - 120;

const VIBE_CONFIG = {
    chill: { emoji: '😌', color: '#00D2FF', gradient: ['#00D2FF', '#0096C7'], label: 'Chill' },
    hype: { emoji: '🔥', color: '#FF6B35', gradient: ['#FF6B35', '#FF3E00'], label: 'Hype' },
    sad: { emoji: '😢', color: '#7B68EE', gradient: ['#7B68EE', '#5A3EC8'], label: 'Sad' },
    funny: { emoji: '😂', color: '#FFD700', gradient: ['#FFD700', '#FFA500'], label: 'Funny' },
    creative: { emoji: '✨', color: '#FF1493', gradient: ['#FF1493', '#C71585'], label: 'Creative' }
};

const SocialDNAScreen = ({ navigation }) => {
    const { isDark } = useTheme();
    const theme = getTheme(isDark);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [dnaData, setDnaData] = useState(null);
    const [evolution, setEvolution] = useState(null);
    const [twins, setTwins] = useState([]);

    // Animated values for strand bars
    const barAnims = useRef(
        Object.keys(VIBE_CONFIG).reduce((acc, v) => {
            acc[v] = new Animated.Value(0);
            return acc;
        }, {})
    ).current;

    const pulseAnim = useRef(new Animated.Value(1)).current;

    // Fetch all DNA data
    const fetchDNA = useCallback(async () => {
        try {
            const [dnaRes, evoRes, twinsRes] = await Promise.all([
                api.get('/social-dna/me'),
                api.get('/social-dna/evolution?weeks=8'),
                api.get('/social-dna/twins?limit=5')
            ]);

            if (dnaRes.data.success) setDnaData(dnaRes.data.data);
            if (evoRes.data.success) setEvolution(evoRes.data.data);
            if (twinsRes.data.success) setTwins(twinsRes.data.data);

            // Animate bars
            if (dnaRes.data.success) {
                const strands = dnaRes.data.data.strands;
                Object.keys(strands).forEach(vibe => {
                    Animated.spring(barAnims[vibe], {
                        toValue: strands[vibe] / 100,
                        friction: 6,
                        tension: 40,
                        useNativeDriver: false
                    }).start();
                });
            }
        } catch (error) {
            console.error('Failed to fetch DNA:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [barAnims]);

    useEffect(() => {
        fetchDNA();

        // Pulse animation for dominant vibe
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.08,
                    duration: 1200,
                    useNativeDriver: true
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1200,
                    useNativeDriver: true
                })
            ])
        ).start();
    }, [fetchDNA, pulseAnim]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchDNA();
    };

    const handleShare = async () => {
        try {
            await api.post('/social-dna/share');
            const dominant = VIBE_CONFIG[dnaData?.dominantVibe || 'chill'];
            await Share.share({
                message: `${dominant.emoji} My Social DNA on Pulse:\n\n${Object.entries(dnaData?.strands || {})
                    .sort((a, b) => b[1] - a[1])
                    .map(([v, pct]) => `${VIBE_CONFIG[v].emoji} ${VIBE_CONFIG[v].label}: ${pct}%`)
                    .join('\n')}\n\nDiscover your DNA → pulse.app/dna 🧬`
            });
        } catch (e) {
            console.error('Share error:', e);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
                <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
                <ActivityIndicator size="large" color="#00D2FF" />
                <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
                    Analyzing your DNA...
                </Text>
            </View>
        );
    }

    const dominantVibe = dnaData?.dominantVibe || 'chill';
    const dominantConfig = VIBE_CONFIG[dominantVibe];
    const sortedStrands = Object.entries(dnaData?.strands || {})
        .sort((a, b) => b[1] - a[1]);

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00D2FF" />
                }
            >
                {/* ══════ HERO SECTION ══════ */}
                <LinearGradient
                    colors={[...dominantConfig.gradient, isDark ? '#000' : '#1A1A2E']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.hero}
                >
                    {/* Floating DNA emoji particles */}
                    <View style={styles.particles}>
                        {['🧬', dominantConfig.emoji, '🧬', dominantConfig.emoji].map((emoji, i) => (
                            <Text key={i} style={[styles.particle, {
                                left: `${15 + i * 22}%`,
                                top: `${10 + (i % 2) * 30}%`,
                                opacity: 0.15,
                                fontSize: 40 + i * 8
                            }]}>
                                {emoji}
                            </Text>
                        ))}
                    </View>

                    {/* Back button */}
                    <TouchableOpacity
                        style={styles.backBtn}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="arrow-back" size={24} color="#FFF" />
                    </TouchableOpacity>

                    {/* Share button */}
                    <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
                        <Ionicons name="share-outline" size={22} color="#FFF" />
                    </TouchableOpacity>

                    {/* Central DNA badge */}
                    <Animated.View style={[styles.dnaBadge, { transform: [{ scale: pulseAnim }] }]}>
                        <View style={[styles.dnaBadgeInner, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                            <Text style={styles.dnaBadgeEmoji}>{dominantConfig.emoji}</Text>
                        </View>
                    </Animated.View>

                    <Text style={styles.heroTitle}>Your Social DNA</Text>
                    <Text style={styles.heroSubtitle}>
                        {dnaData?.totalSignals || 0} interactions analyzed
                    </Text>

                    <View style={styles.heroTags}>
                        <View style={styles.heroTag}>
                            <Ionicons name="flame" size={14} color="#FFF" />
                            <Text style={styles.heroTagText}>{dnaData?.streak || 0} week streak</Text>
                        </View>
                        <View style={styles.heroTag}>
                            <Ionicons name="calendar" size={14} color="#FFF" />
                            <Text style={styles.heroTagText}>{dnaData?.weeksTracked || 0} weeks tracked</Text>
                        </View>
                    </View>
                </LinearGradient>

                {/* ══════ DNA STRANDS ══════ */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                        🧬 DNA Strands
                    </Text>
                    <Text style={[styles.sectionSub, { color: theme.colors.textSecondary }]}>
                        Your content personality breakdown
                    </Text>

                    <View style={styles.strandsList}>
                        {sortedStrands.map(([vibe, pct], index) => {
                            const config = VIBE_CONFIG[vibe];
                            const isDominant = vibe === dominantVibe;

                            return (
                                <View key={vibe} style={[
                                    styles.strandRow,
                                    isDominant && styles.strandRowDominant,
                                    { backgroundColor: isDark ? '#1C1C1E' : '#F8F8FA' }
                                ]}>
                                    <View style={styles.strandLabel}>
                                        <Text style={styles.strandEmoji}>{config.emoji}</Text>
                                        <View>
                                            <Text style={[styles.strandName, { color: theme.colors.text }]}>
                                                {config.label}
                                                {isDominant && <Text style={{ color: config.color }}> ★</Text>}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.strandBarContainer}>
                                        <Animated.View style={[styles.strandBar, {
                                            width: barAnims[vibe].interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [0, BAR_MAX_WIDTH * 0.65]
                                            }),
                                        }]}>
                                            <LinearGradient
                                                colors={config.gradient}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 0 }}
                                                style={styles.strandBarGradient}
                                            />
                                        </Animated.View>
                                    </View>

                                    <Text style={[styles.strandPct, { color: config.color }]}>
                                        {pct}%
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                </View>

                {/* ══════ WEEKLY INSIGHTS ══════ */}
                {dnaData?.latestInsights?.length > 0 && (
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                            💡 Latest Insights
                        </Text>

                        {dnaData.latestInsights.map((insight, i) => (
                            <View key={i} style={[styles.insightCard, {
                                backgroundColor: isDark ? '#1C1C1E' : '#F8F8FA',
                                borderLeftColor: dominantConfig.color
                            }]}>
                                <Text style={[styles.insightText, { color: theme.colors.text }]}>
                                    {insight.message}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* ══════ EVOLUTION CHART ══════ */}
                {evolution?.snapshots?.length > 0 && (
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                            📈 Evolution
                        </Text>
                        <Text style={[styles.sectionSub, { color: theme.colors.textSecondary }]}>
                            How your DNA has changed over time
                        </Text>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.evoScroll}>
                            {evolution.snapshots.map((snap, i) => {
                                const weekLabel = `W${i + 1}`;
                                return (
                                    <View key={i} style={[styles.evoColumn, {
                                        backgroundColor: isDark ? '#1C1C1E' : '#F8F8FA'
                                    }]}>
                                        <Text style={[styles.evoWeek, { color: theme.colors.textSecondary }]}>
                                            {weekLabel}
                                        </Text>
                                        <View style={styles.evoStack}>
                                            {Object.entries(snap.strands)
                                                .sort((a, b) => b[1] - a[1])
                                                .map(([v, pct]) => (
                                                    <View key={v} style={[styles.evoSegment, {
                                                        height: Math.max(pct * 0.8, 2),
                                                        backgroundColor: VIBE_CONFIG[v]?.color || '#888'
                                                    }]} />
                                                ))}
                                        </View>
                                        <Text style={styles.evoDominant}>
                                            {VIBE_CONFIG[snap.dominantVibe]?.emoji || '🧬'}
                                        </Text>
                                    </View>
                                );
                            })}
                        </ScrollView>
                    </View>
                )}

                {/* ══════ DNA TWINS ══════ */}
                {twins.length > 0 && (
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                            👯 DNA Twins
                        </Text>
                        <Text style={[styles.sectionSub, { color: theme.colors.textSecondary }]}>
                            Users with the most similar personality
                        </Text>

                        {twins.slice(0, 5).map((twin, i) => {
                            const initial = (twin.user?.username || '?').charAt(0).toUpperCase();

                            return (
                                <TouchableOpacity
                                    key={i}
                                    style={[styles.twinCard, {
                                        backgroundColor: isDark ? '#1C1C1E' : '#F8F8FA'
                                    }]}
                                    onPress={() => twin.user?._id && navigation.push('UserProfile', {
                                        userId: twin.user._id,
                                        username: twin.user.username
                                    })}
                                >
                                    <View style={[styles.twinAvatar, { backgroundColor: VIBE_CONFIG[twin.dominantVibe]?.color || '#888' }]}>
                                        <Text style={styles.twinAvatarText}>{initial}</Text>
                                    </View>

                                    <View style={styles.twinInfo}>
                                        <Text style={[styles.twinName, { color: theme.colors.text }]}>
                                            @{twin.user?.username || 'unknown'}
                                        </Text>
                                        <Text style={[styles.twinVibe, { color: theme.colors.textSecondary }]}>
                                            {VIBE_CONFIG[twin.dominantVibe]?.emoji} {VIBE_CONFIG[twin.dominantVibe]?.label}
                                        </Text>
                                    </View>

                                    <View style={[styles.matchBadge, {
                                        backgroundColor: twin.matchPercent >= 85
                                            ? 'rgba(0,210,255,0.15)'
                                            : 'rgba(255,255,255,0.1)'
                                    }]}>
                                        <Text style={[styles.matchPct, {
                                            color: twin.matchPercent >= 85 ? '#00D2FF' : theme.colors.text
                                        }]}>
                                            {twin.matchPercent}%
                                        </Text>
                                        <Text style={[styles.matchLabel, { color: theme.colors.textSecondary }]}>
                                            match
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                {/* ══════ SHARE CTA ══════ */}
                <View style={styles.section}>
                    <TouchableOpacity onPress={handleShare}>
                        <LinearGradient
                            colors={dominantConfig.gradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.shareCard}
                        >
                            <View style={styles.shareCardContent}>
                                <Ionicons name="share-social" size={28} color="#FFF" />
                                <View style={styles.shareCardText}>
                                    <Text style={styles.shareCardTitle}>Share Your DNA Card</Text>
                                    <Text style={styles.shareCardSub}>
                                        Let friends discover their DNA match with you
                                    </Text>
                                </View>
                                <Ionicons name="arrow-forward" size={22} color="rgba(255,255,255,0.7)" />
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

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
        paddingBottom: 32,
        paddingHorizontal: 20,
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden'
    },
    particles: { ...StyleSheet.absoluteFillObject },
    particle: { position: 'absolute' },
    backBtn: {
        position: 'absolute',
        top: 50,
        left: 16,
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center'
    },
    shareBtn: {
        position: 'absolute',
        top: 50,
        right: 16,
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center'
    },
    dnaBadge: {
        marginBottom: 16,
        marginTop: 20
    },
    dnaBadgeInner: {
        width: 90,
        height: 90,
        borderRadius: 45,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)'
    },
    dnaBadgeEmoji: { fontSize: 44 },
    heroTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#FFF',
        letterSpacing: 0.5
    },
    heroSubtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 6
    },
    heroTags: {
        flexDirection: 'row',
        marginTop: 16,
        gap: 12
    },
    heroTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6
    },
    heroTagText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '600'
    },

    // Section
    section: {
        padding: 20,
        paddingBottom: 8
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 4
    },
    sectionSub: {
        fontSize: 13,
        marginBottom: 16
    },

    // Strands
    strandsList: { gap: 10 },
    strandRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 16,
    },
    strandRowDominant: {
        borderWidth: 1,
        borderColor: 'rgba(0,210,255,0.3)'
    },
    strandLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        width: 90,
        gap: 8
    },
    strandEmoji: { fontSize: 22 },
    strandName: {
        fontSize: 14,
        fontWeight: '600'
    },
    strandBarContainer: {
        flex: 1,
        height: 10,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 5,
        overflow: 'hidden',
        marginHorizontal: 8
    },
    strandBar: {
        height: '100%',
        borderRadius: 5,
        overflow: 'hidden'
    },
    strandBarGradient: {
        flex: 1,
        borderRadius: 5
    },
    strandPct: {
        fontSize: 15,
        fontWeight: '800',
        width: 42,
        textAlign: 'right'
    },

    // Insights
    insightCard: {
        padding: 16,
        borderRadius: 14,
        marginBottom: 10,
        borderLeftWidth: 3
    },
    insightText: {
        fontSize: 14,
        lineHeight: 20
    },

    // Evolution
    evoScroll: {
        marginBottom: 8
    },
    evoColumn: {
        alignItems: 'center',
        marginRight: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 14,
        minWidth: 60
    },
    evoWeek: {
        fontSize: 11,
        fontWeight: '600',
        marginBottom: 8
    },
    evoStack: {
        width: 24,
        height: 80,
        justifyContent: 'flex-end',
        gap: 2,
        borderRadius: 4,
        overflow: 'hidden'
    },
    evoSegment: {
        width: '100%',
        borderRadius: 2
    },
    evoDominant: {
        fontSize: 16,
        marginTop: 6
    },

    // Twins
    twinCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 16,
        marginBottom: 10,
        gap: 12
    },
    twinAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center'
    },
    twinAvatarText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFF'
    },
    twinInfo: { flex: 1 },
    twinName: {
        fontSize: 15,
        fontWeight: '600'
    },
    twinVibe: {
        fontSize: 12,
        marginTop: 2
    },
    matchBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        alignItems: 'center'
    },
    matchPct: {
        fontSize: 16,
        fontWeight: '800'
    },
    matchLabel: {
        fontSize: 10,
        fontWeight: '500'
    },

    // Share CTA
    shareCard: {
        borderRadius: 18,
        overflow: 'hidden'
    },
    shareCardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        gap: 14
    },
    shareCardText: { flex: 1 },
    shareCardTitle: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700'
    },
    shareCardSub: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        marginTop: 2
    }
});

export default SocialDNAScreen;
