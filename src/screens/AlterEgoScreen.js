import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Switch,
    ActivityIndicator,
    FlatList,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';
import { getTheme } from '../styles/theme';
import api from '../services/api';

const { width } = Dimensions.get('window');

const PERSONALITIES = [
    { id: 'friendly', emoji: '😊', label: 'Friendly', desc: 'Warm and approachable' },
    { id: 'funny', emoji: '😂', label: 'Funny', desc: 'Witty and playful' },
    { id: 'professional', emoji: '💼', label: 'Professional', desc: 'Formal and polished' },
    { id: 'mysterious', emoji: '🔮', label: 'Mysterious', desc: 'Enigmatic and intriguing' },
    { id: 'chill', emoji: '😎', label: 'Chill', desc: 'Relaxed and casual' },
];

const TrainingCard = ({ title, placeholder, value, onChange, theme }) => (
    <View style={[styles.trainingCard, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.trainingTitle, { color: theme.colors.text }]}>{title}</Text>
        <TextInput
            style={[styles.trainingInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
            placeholder={placeholder}
            placeholderTextColor={theme.colors.textSecondary}
            value={value}
            onChangeText={onChange}
            multiline
        />
    </View>
);

const AlterEgoScreen = ({ navigation }) => {
    const { isDark } = useTheme();
    const theme = getTheme(isDark);

    const [ego, setEgo] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [tab, setTab] = useState('settings'); // settings | activity | guessWho
    const [activityLog, setActivityLog] = useState([]);
    const [aiStatus, setAiStatus] = useState(null);
    const [guessState, setGuessState] = useState(null); // { message, showAnswer }
    const [guessStats, setGuessStats] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        personality: 'friendly',
        isActive: false,
        training: {
            howAreYou: '',
            humorStyle: '',
            complimentResponse: '',
        }
    });

    // Fetch alter ego data
    const fetchEgo = useCallback(async () => {
        setIsLoading(true);
        try {
            const [egoRes, statusRes] = await Promise.all([
                api.get('/alter-ego/me'),
                api.get('/alter-ego/ai-status').catch(() => ({ data: { success: false } }))
            ]);

            if (egoRes.data.success) {
                const data = egoRes.data.data;
                setEgo(data);
                setFormData({
                    name: data.name || '',
                    personality: data.personality || 'friendly',
                    isActive: data.isActive || false,
                    training: data.training || {
                        howAreYou: '',
                        humorStyle: '',
                        complimentResponse: '',
                    }
                });
                setGuessStats(data.guessWhoStats || null);
            }
            if (statusRes.data.success) {
                setAiStatus(statusRes.data.data);
            }
        } catch (error) {
            console.error('Fetch ego error:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const fetchActivity = useCallback(async () => {
        try {
            const res = await api.get('/alter-ego/activity?limit=30');
            if (res.data.success) setActivityLog(res.data.data || []);
        } catch (e) {
            console.error('Activity fetch error:', e);
        }
    }, []);

    useEffect(() => { fetchEgo(); }, [fetchEgo]);
    useEffect(() => { if (tab === 'activity') fetchActivity(); }, [tab, fetchActivity]);

    const handleSave = async () => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            await api.put('/alter-ego', {
                name: formData.name,
                personality: formData.personality,
                isActive: formData.isActive,
            });

            const trainResponse = await api.post('/alter-ego/train', formData.training);

            if (trainResponse.data.success && trainResponse.data.data.trainingLevel !== undefined) {
                setEgo(prev => ({ ...prev, trainingLevel: trainResponse.data.data.trainingLevel }));
                if (trainResponse.data.data.trainingLevel >= 1) {
                    alert('✅ Training saved! Your AI is now ready to activate.');
                }
            }
        } catch (error) {
            console.error('Save error:', error);
            alert('Failed to save. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggle = async () => {
        try {
            const response = await api.post('/alter-ego/toggle');
            if (response.data.success) {
                setFormData(prev => ({ ...prev, isActive: response.data.data.isActive }));
            }
        } catch (error) {
            console.error('Toggle error:', error);
            const errorMessage = error.response?.data?.message || 'Failed to toggle AI';
            if (errorMessage.includes('training')) {
                alert('⚠️ Training Required!\n\nPlease fill in at least ONE training field below and tap Save before activating.');
            } else {
                alert(errorMessage);
            }
        }
    };

    const handleTestResponse = async () => {
        try {
            const response = await api.post('/alter-ego/generate', {
                message: 'Hey, how are you?'
            });
            if (response.data.success) {
                alert(`🤖 AI Response:\n\n${response.data.data.response}`);
            }
        } catch (error) {
            console.error('Test error:', error);
        }
    };

    // ===== GUESS WHO GAME =====
    const startGuessRound = async () => {
        try {
            // Generate a response and ask the user to guess
            const response = await api.post('/alter-ego/generate', {
                message: 'Hey what have you been up to lately?',
                context: { type: 'guess_game' }
            });
            if (response.data.success) {
                setGuessState({
                    message: response.data.data.response,
                    isAI: true, // This response IS from the AI
                    showAnswer: false
                });
            }
        } catch (e) {
            console.error('Guess round error:', e);
        }
    };

    const submitGuess = async (guessedAI) => {
        const correct = guessedAI === guessState?.isAI;
        setGuessState(prev => ({ ...prev, showAnswer: true, correct }));

        try {
            const res = await api.post('/alter-ego/guess', { guessedCorrectly: correct });
            if (res.data.success) setGuessStats(res.data.data);
        } catch (e) {
            console.error('Submit guess error:', e);
        }
    };

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#4CAF50" />
                    <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
                        Loading your AI twin...
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={[styles.headerTitle, { color: theme.colors.text }]}>🤖 AI Alter Ego</Text>
                    <View style={styles.headerRow}>
                        <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>Your AI twin</Text>
                        {aiStatus && (
                            <View style={[styles.aiBadge, {
                                backgroundColor: aiStatus.isAIEnabled ? 'rgba(76,175,80,0.15)' : 'rgba(255,152,0,0.15)'
                            }]}>
                                <View style={[styles.aiDot, {
                                    backgroundColor: aiStatus.isAIEnabled ? '#4CAF50' : '#FF9800'
                                }]} />
                                <Text style={[styles.aiBadgeText, {
                                    color: aiStatus.isAIEnabled ? '#4CAF50' : '#FF9800'
                                }]}>
                                    {aiStatus.provider === 'gemini' ? '✨ Gemini' :
                                        aiStatus.provider === 'openai' ? '🧠 GPT' : '📝 Template'}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
                {tab === 'settings' && (
                    <TouchableOpacity
                        onPress={handleSave}
                        style={[styles.saveBtn, { opacity: isSaving ? 0.5 : 1 }]}
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <ActivityIndicator size="small" color="#4CAF50" />
                        ) : (
                            <Text style={[styles.saveBtnText, { color: '#4CAF50' }]}>Save</Text>
                        )}
                    </TouchableOpacity>
                )}
            </View>

            {/* Tab Bar */}
            <View style={[styles.tabBar, { borderBottomColor: theme.colors.border }]}>
                {[
                    { key: 'settings', icon: 'settings', label: 'Settings' },
                    { key: 'activity', icon: 'list', label: 'Activity' },
                    { key: 'guessWho', icon: 'help-circle', label: 'Guess Who' },
                ].map(t => (
                    <TouchableOpacity
                        key={t.key}
                        style={[styles.tabItem, tab === t.key && styles.tabItemActive]}
                        onPress={() => setTab(t.key)}
                    >
                        <Ionicons
                            name={t.icon}
                            size={18}
                            color={tab === t.key ? '#4CAF50' : theme.colors.textSecondary}
                        />
                        <Text style={[
                            styles.tabLabel,
                            { color: tab === t.key ? '#4CAF50' : theme.colors.textSecondary }
                        ]}>{t.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* ═══════ SETTINGS TAB ═══════ */}
            {tab === 'settings' && (
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    {/* Activation Card */}
                    <View style={[styles.activationCard, { backgroundColor: '#4CAF50' + '15' }]}>
                        <View style={styles.activationInfo}>
                            <Ionicons name="flash" size={24} color="#4CAF50" />
                            <View style={styles.activationText}>
                                <Text style={[styles.activationTitle, { color: theme.colors.text }]}>
                                    {formData.isActive ? 'Active' : 'Inactive'}
                                </Text>
                                <Text style={[styles.activationDesc, { color: theme.colors.textSecondary }]}>
                                    {formData.isActive ? 'Your AI is responding for you' : 'Enable to let AI respond'}
                                </Text>
                            </View>
                        </View>
                        <Switch
                            value={formData.isActive}
                            onValueChange={handleToggle}
                            trackColor={{ false: theme.colors.border, true: '#4CAF50' + '50' }}
                            thumbColor={formData.isActive ? '#4CAF50' : theme.colors.textSecondary}
                        />
                    </View>

                    {/* Name */}
                    <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>AI NAME</Text>
                        <TextInput
                            style={[styles.nameInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                            placeholder="Give your AI a name..."
                            placeholderTextColor={theme.colors.textSecondary}
                            value={formData.name}
                            onChangeText={(t) => setFormData(prev => ({ ...prev, name: t }))}
                            maxLength={20}
                        />
                    </View>

                    {/* Personality */}
                    <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>PERSONALITY</Text>
                        <View style={styles.personalityGrid}>
                            {PERSONALITIES.map(p => (
                                <TouchableOpacity
                                    key={p.id}
                                    style={[
                                        styles.personalityChip,
                                        {
                                            backgroundColor: formData.personality === p.id
                                                ? '#4CAF50' + '20'
                                                : theme.colors.background,
                                            borderColor: formData.personality === p.id
                                                ? '#4CAF50'
                                                : theme.colors.border,
                                        }
                                    ]}
                                    onPress={() => setFormData(prev => ({ ...prev, personality: p.id }))}
                                >
                                    <Text style={styles.personalityEmoji}>{p.emoji}</Text>
                                    <Text style={[
                                        styles.personalityLabel,
                                        { color: formData.personality === p.id ? '#4CAF50' : theme.colors.text }
                                    ]}>
                                        {p.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Training Level */}
                    <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>TRAINING LEVEL</Text>
                        <View style={styles.levelRow}>
                            {[1, 2, 3, 4, 5].map(level => (
                                <View
                                    key={level}
                                    style={[
                                        styles.levelDot,
                                        {
                                            backgroundColor: level <= (ego?.trainingLevel || 0)
                                                ? '#4CAF50'
                                                : theme.colors.border
                                        }
                                    ]}
                                />
                            ))}
                            <Text style={[styles.levelText, { color: theme.colors.text }]}>
                                {ego?.trainingLevel || 0}/5
                            </Text>
                        </View>
                    </View>

                    {/* Training Cards */}
                    <Text style={[styles.trainSectionTitle, { color: theme.colors.text }]}>
                        🎯 Teach Your AI
                    </Text>

                    <TrainingCard
                        title="How do you respond to 'How are you?'"
                        placeholder="e.g., 'Living the dream! What about you?'"
                        value={formData.training.howAreYou}
                        onChange={(t) => setFormData(prev => ({
                            ...prev,
                            training: { ...prev.training, howAreYou: t }
                        }))}
                        theme={theme}
                    />

                    <TrainingCard
                        title="Describe your humor style"
                        placeholder="e.g., 'I love puns and self-deprecating jokes'"
                        value={formData.training.humorStyle}
                        onChange={(t) => setFormData(prev => ({
                            ...prev,
                            training: { ...prev.training, humorStyle: t }
                        }))}
                        theme={theme}
                    />

                    <TrainingCard
                        title="How do you respond to compliments?"
                        placeholder="e.g., 'Aw thanks! You're too kind 😊'"
                        value={formData.training.complimentResponse}
                        onChange={(t) => setFormData(prev => ({
                            ...prev,
                            training: { ...prev.training, complimentResponse: t }
                        }))}
                        theme={theme}
                    />

                    {/* Test Button */}
                    <TouchableOpacity
                        style={[styles.testBtn, { backgroundColor: theme.colors.surface, borderColor: '#4CAF50' }]}
                        onPress={handleTestResponse}
                    >
                        <Ionicons name="chatbubble" size={18} color="#4CAF50" />
                        <Text style={[styles.testBtnText, { color: '#4CAF50' }]}>Test AI Response</Text>
                    </TouchableOpacity>
                </ScrollView>
            )}

            {/* ═══════ ACTIVITY TAB ═══════ */}
            {tab === 'activity' && (
                <FlatList
                    data={activityLog}
                    keyExtractor={(_, i) => i.toString()}
                    contentContainerStyle={styles.content}
                    ListHeaderComponent={
                        <Text style={[styles.trainSectionTitle, { color: theme.colors.text }]}>
                            📋 AI Activity Log
                        </Text>
                    }
                    renderItem={({ item }) => {
                        const typeConfig = {
                            dm_reply: { icon: 'chatbubble', color: '#2196F3', label: 'DM Reply' },
                            comment_reply: { icon: 'chatbubbles', color: '#FF9800', label: 'Comment Reply' },
                            guess_game: { icon: 'help-circle', color: '#9C27B0', label: 'Guess Game' },
                        };
                        const cfg = typeConfig[item.type] || { icon: 'flash', color: '#4CAF50', label: item.type };

                        return (
                            <View style={[styles.activityItem, { backgroundColor: theme.colors.surface }]}>
                                <View style={[styles.activityIcon, { backgroundColor: cfg.color + '20' }]}>
                                    <Ionicons name={cfg.icon} size={18} color={cfg.color} />
                                </View>
                                <View style={styles.activityContent}>
                                    <Text style={[styles.activityLabel, { color: cfg.color }]}>{cfg.label}</Text>
                                    {item.trigger && (
                                        <Text style={[styles.activityTrigger, { color: theme.colors.textSecondary }]}
                                            numberOfLines={1}>
                                            "{item.trigger}"
                                        </Text>
                                    )}
                                    <Text style={[styles.activityResponse, { color: theme.colors.text }]}
                                        numberOfLines={2}>
                                        {item.response}
                                    </Text>
                                    <Text style={[styles.activityTime, { color: theme.colors.textSecondary }]}>
                                        {item.timestamp ? new Date(item.timestamp).toLocaleDateString() : ''}
                                    </Text>
                                </View>
                            </View>
                        );
                    }}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyEmoji}>🤖</Text>
                            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                                No activity yet. Activate your AI and it will start logging responses here.
                            </Text>
                        </View>
                    }
                />
            )}

            {/* ═══════ GUESS WHO TAB ═══════ */}
            {tab === 'guessWho' && (
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    <View style={styles.guessHeader}>
                        <Text style={[styles.guessTitle, { color: theme.colors.text }]}>
                            🎭 Guess Who Said It?
                        </Text>
                        <Text style={[styles.guessDesc, { color: theme.colors.textSecondary }]}>
                            Can you tell the difference between your Alter Ego's responses and real ones?
                        </Text>
                    </View>

                    {/* Stats */}
                    {guessStats && (
                        <View style={[styles.guessStatsRow, { backgroundColor: theme.colors.surface }]}>
                            <View style={styles.guessStat}>
                                <Text style={[styles.guessStatValue, { color: '#4CAF50' }]}>
                                    {guessStats.totalGuesses || 0}
                                </Text>
                                <Text style={[styles.guessStatLabel, { color: theme.colors.textSecondary }]}>
                                    Played
                                </Text>
                            </View>
                            <View style={styles.guessStat}>
                                <Text style={[styles.guessStatValue, { color: '#2196F3' }]}>
                                    {guessStats.correctGuesses || 0}
                                </Text>
                                <Text style={[styles.guessStatLabel, { color: theme.colors.textSecondary }]}>
                                    Correct
                                </Text>
                            </View>
                            <View style={styles.guessStat}>
                                <Text style={[styles.guessStatValue, { color: '#FF9800' }]}>
                                    {guessStats.fooledCount || 0}
                                </Text>
                                <Text style={[styles.guessStatLabel, { color: theme.colors.textSecondary }]}>
                                    Fooled
                                </Text>
                            </View>
                            <View style={styles.guessStat}>
                                <Text style={[styles.guessStatValue, { color: '#9C27B0' }]}>
                                    {guessStats.accuracy != null ? `${guessStats.accuracy}%` : '—'}
                                </Text>
                                <Text style={[styles.guessStatLabel, { color: theme.colors.textSecondary }]}>
                                    Accuracy
                                </Text>
                            </View>
                        </View>
                    )}

                    {/* Game Area */}
                    {!guessState && (
                        <TouchableOpacity
                            style={[styles.startGameBtn, { backgroundColor: '#4CAF50' }]}
                            onPress={startGuessRound}
                        >
                            <Text style={styles.startGameBtnText}>🎲 Start Round</Text>
                        </TouchableOpacity>
                    )}

                    {guessState && (
                        <View style={[styles.guessCard, { backgroundColor: theme.colors.surface }]}>
                            <Text style={[styles.guessPrompt, { color: theme.colors.textSecondary }]}>
                                Someone received "Hey what have you been up to?" and replied:
                            </Text>
                            <View style={[styles.guessBubble, { backgroundColor: isDark ? '#2C2C2E' : '#F0F0F5' }]}>
                                <Text style={[styles.guessBubbleText, { color: theme.colors.text }]}>
                                    "{guessState.message}"
                                </Text>
                            </View>

                            {!guessState.showAnswer ? (
                                <View style={styles.guessButtons}>
                                    <TouchableOpacity
                                        style={[styles.guessBtn, { backgroundColor: '#2196F3' }]}
                                        onPress={() => submitGuess(false)}
                                    >
                                        <Text style={styles.guessBtnText}>👤 Real Person</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.guessBtn, { backgroundColor: '#FF9800' }]}
                                        onPress={() => submitGuess(true)}
                                    >
                                        <Text style={styles.guessBtnText}>🤖 AI Alter Ego</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View style={styles.guessResult}>
                                    <Text style={[styles.guessResultEmoji]}>
                                        {guessState.correct ? '✅' : '❌'}
                                    </Text>
                                    <Text style={[styles.guessResultText, {
                                        color: guessState.correct ? '#4CAF50' : '#F44336'
                                    }]}>
                                        {guessState.correct ? 'You got it right!' : 'Fooled you!'}
                                    </Text>
                                    <Text style={[styles.guessResultSub, { color: theme.colors.textSecondary }]}>
                                        That was from the AI Alter Ego
                                    </Text>

                                    <TouchableOpacity
                                        style={[styles.nextRoundBtn, { borderColor: '#4CAF50' }]}
                                        onPress={() => {
                                            setGuessState(null);
                                            startGuessRound();
                                        }}
                                    >
                                        <Text style={{ color: '#4CAF50', fontWeight: '700' }}>Next Round →</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    )}
                </ScrollView>
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
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
    headerSubtitle: { fontSize: 12 },
    aiBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        gap: 4
    },
    aiDot: { width: 6, height: 6, borderRadius: 3 },
    aiBadgeText: { fontSize: 10, fontWeight: '700' },
    saveBtn: { padding: 8 },
    saveBtnText: { fontSize: 16, fontWeight: '700' },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    loadingText: { fontSize: 14 },

    // Tab Bar
    tabBar: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        paddingHorizontal: 8,
    },
    tabItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        gap: 6,
    },
    tabItemActive: {
        borderBottomWidth: 2,
        borderBottomColor: '#4CAF50',
    },
    tabLabel: { fontSize: 13, fontWeight: '600' },

    // Content
    content: { padding: 16, paddingBottom: 40 },
    activationCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 16,
        marginBottom: 16,
    },
    activationInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    activationText: {},
    activationTitle: { fontSize: 16, fontWeight: '700' },
    activationDesc: { fontSize: 12, marginTop: 2 },
    section: {
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
    },
    sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 12 },
    nameInput: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
    },
    personalityGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    personalityChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1.5,
        gap: 6,
    },
    personalityEmoji: { fontSize: 16 },
    personalityLabel: { fontSize: 14, fontWeight: '600' },
    levelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    levelDot: {
        width: 20,
        height: 20,
        borderRadius: 10,
    },
    levelText: { fontSize: 14, fontWeight: '700', marginLeft: 8 },
    trainSectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginTop: 8,
        marginBottom: 12,
    },
    trainingCard: {
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
    },
    trainingTitle: { fontSize: 14, fontWeight: '600', marginBottom: 10 },
    trainingInput: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        fontSize: 15,
        minHeight: 60,
        textAlignVertical: 'top',
    },
    testBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 24,
        borderWidth: 1.5,
        gap: 8,
        marginTop: 8,
    },
    testBtnText: { fontSize: 15, fontWeight: '700' },

    // Activity Log
    activityItem: {
        flexDirection: 'row',
        padding: 14,
        borderRadius: 14,
        marginBottom: 8,
        gap: 12,
    },
    activityIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    activityContent: { flex: 1 },
    activityLabel: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
    activityTrigger: { fontSize: 12, fontStyle: 'italic', marginBottom: 2 },
    activityResponse: { fontSize: 14, lineHeight: 20 },
    activityTime: { fontSize: 11, marginTop: 4 },

    // Empty state
    emptyState: { alignItems: 'center', paddingTop: 60 },
    emptyEmoji: { fontSize: 50, marginBottom: 12 },
    emptyText: { fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },

    // Guess Who
    guessHeader: { alignItems: 'center', marginBottom: 20 },
    guessTitle: { fontSize: 24, fontWeight: '900' },
    guessDesc: { fontSize: 14, textAlign: 'center', marginTop: 6 },
    guessStatsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        padding: 16,
        borderRadius: 16,
        marginBottom: 20,
    },
    guessStat: { alignItems: 'center' },
    guessStatValue: { fontSize: 22, fontWeight: '800' },
    guessStatLabel: { fontSize: 11, marginTop: 2 },
    startGameBtn: {
        paddingVertical: 16,
        borderRadius: 28,
        alignItems: 'center',
        marginTop: 10,
    },
    startGameBtnText: { color: '#FFF', fontSize: 18, fontWeight: '800' },
    guessCard: {
        padding: 20,
        borderRadius: 20,
        marginTop: 10,
    },
    guessPrompt: { fontSize: 13, marginBottom: 12, textAlign: 'center' },
    guessBubble: {
        padding: 16,
        borderRadius: 16,
        marginBottom: 20,
    },
    guessBubbleText: { fontSize: 16, lineHeight: 24, fontStyle: 'italic', textAlign: 'center' },
    guessButtons: { flexDirection: 'row', gap: 12 },
    guessBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 24,
        alignItems: 'center',
    },
    guessBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
    guessResult: { alignItems: 'center', paddingVertical: 10 },
    guessResultEmoji: { fontSize: 44, marginBottom: 8 },
    guessResultText: { fontSize: 20, fontWeight: '800' },
    guessResultSub: { fontSize: 13, marginTop: 4 },
    nextRoundBtn: {
        borderWidth: 1.5,
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 20,
        marginTop: 16,
    },
});

export default AlterEgoScreen;
