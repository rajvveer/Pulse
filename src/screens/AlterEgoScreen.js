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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';
import { getTheme } from '../styles/theme';
import api from '../services/api';

const ACCENT = '#4CAF50';

const PERSONALITIES = [
    { id: 'friendly', label: 'Friendly', desc: 'Warm and approachable' },
    { id: 'funny', label: 'Funny', desc: 'Witty and playful' },
    { id: 'professional', label: 'Professional', desc: 'Formal and polished' },
    { id: 'mysterious', label: 'Mysterious', desc: 'Enigmatic and intriguing' },
    { id: 'chill', label: 'Chill', desc: 'Relaxed and casual' },
];

const TrainingCard = ({ title, placeholder, value, onChange, theme }) => (
    <View style={[styles.trainingCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
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
    const [tab, setTab] = useState('settings');
    const [activityLog, setActivityLog] = useState([]);
    const [aiStatus, setAiStatus] = useState(null);
    const [guessState, setGuessState] = useState(null);
    const [guessStats, setGuessStats] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        personality: 'friendly',
        isActive: false,
        training: { howAreYou: '', humorStyle: '', complimentResponse: '' }
    });

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
                    training: data.training || { howAreYou: '', humorStyle: '', complimentResponse: '' }
                });
                setGuessStats(data.guessWhoStats || null);
            }
            if (statusRes.data.success) setAiStatus(statusRes.data.data);
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
                    alert('Training saved. Your AI is ready to activate.');
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
                alert('Training required. Fill in at least one training field below and tap Save before activating.');
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
                alert(`AI response:\n\n${response.data.data.response}`);
            }
        } catch (error) {
            console.error('Test error:', error);
        }
    };

    const startGuessRound = async () => {
        try {
            const response = await api.post('/alter-ego/generate', {
                message: 'Hey what have you been up to lately?',
                context: { type: 'guess_game' }
            });
            if (response.data.success) {
                setGuessState({
                    message: response.data.data.response,
                    isAI: true,
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

    const providerLabel = (p) => {
        if (p === 'gemini') return 'Gemini';
        if (p === 'openai') return 'GPT';
        return 'Template';
    };

    const subtle = isDark ? '#2A2A2C' : '#F2F2F5';

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={ACCENT} />
                    <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading…</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
                    <Ionicons name="chevron-back" size={26} color={theme.colors.text} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Alter Ego</Text>
                    {aiStatus && (
                        <View style={styles.headerRow}>
                            <View style={[styles.aiDot, {
                                backgroundColor: aiStatus.isAIEnabled ? ACCENT : theme.colors.textSecondary
                            }]} />
                            <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
                                {providerLabel(aiStatus.provider)}
                            </Text>
                        </View>
                    )}
                </View>
                {tab === 'settings' && (
                    <TouchableOpacity
                        onPress={handleSave}
                        style={[styles.saveBtn, { opacity: isSaving ? 0.5 : 1 }]}
                        disabled={isSaving}
                        hitSlop={8}
                    >
                        {isSaving ? (
                            <ActivityIndicator size="small" color={ACCENT} />
                        ) : (
                            <Text style={[styles.saveBtnText, { color: ACCENT }]}>Save</Text>
                        )}
                    </TouchableOpacity>
                )}
            </View>

            {/* Tab Bar */}
            <View style={[styles.tabBar, { borderBottomColor: theme.colors.border }]}>
                {[
                    { key: 'settings', label: 'Settings' },
                    { key: 'activity', label: 'Activity' },
                    { key: 'guessWho', label: 'Guess Who' },
                ].map(t => {
                    const active = tab === t.key;
                    return (
                        <TouchableOpacity
                            key={t.key}
                            style={styles.tabItem}
                            onPress={() => setTab(t.key)}
                            activeOpacity={0.7}
                        >
                            <Text style={[
                                styles.tabLabel,
                                { color: active ? theme.colors.text : theme.colors.textSecondary }
                            ]}>{t.label}</Text>
                            {active && <View style={[styles.tabIndicator, { backgroundColor: ACCENT }]} />}
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* SETTINGS */}
            {tab === 'settings' && (
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    {/* Activation */}
                    <View style={[styles.activationCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                        <View style={styles.activationInfo}>
                            <View style={[styles.statusDot, {
                                backgroundColor: formData.isActive ? ACCENT : theme.colors.textSecondary
                            }]} />
                            <View>
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
                            trackColor={{ false: theme.colors.border, true: ACCENT + '70' }}
                            thumbColor={formData.isActive ? ACCENT : '#FFF'}
                        />
                    </View>

                    {/* Name */}
                    <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>NAME</Text>
                    <TextInput
                        style={[styles.nameInput, {
                            color: theme.colors.text,
                            backgroundColor: theme.colors.surface,
                            borderColor: theme.colors.border
                        }]}
                        placeholder="Name your AI"
                        placeholderTextColor={theme.colors.textSecondary}
                        value={formData.name}
                        onChangeText={(t) => setFormData(prev => ({ ...prev, name: t }))}
                        maxLength={20}
                    />

                    {/* Personality */}
                    <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary, marginTop: 20 }]}>PERSONALITY</Text>
                    <View style={styles.personalityList}>
                        {PERSONALITIES.map(p => {
                            const active = formData.personality === p.id;
                            return (
                                <TouchableOpacity
                                    key={p.id}
                                    style={[
                                        styles.personalityRow,
                                        {
                                            backgroundColor: theme.colors.surface,
                                            borderColor: active ? ACCENT : theme.colors.border,
                                        }
                                    ]}
                                    onPress={() => setFormData(prev => ({ ...prev, personality: p.id }))}
                                    activeOpacity={0.7}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.personalityLabel, { color: theme.colors.text }]}>
                                            {p.label}
                                        </Text>
                                        <Text style={[styles.personalityDesc, { color: theme.colors.textSecondary }]}>
                                            {p.desc}
                                        </Text>
                                    </View>
                                    <View style={[
                                        styles.radio,
                                        { borderColor: active ? ACCENT : theme.colors.border }
                                    ]}>
                                        {active && <View style={[styles.radioInner, { backgroundColor: ACCENT }]} />}
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Training Level */}
                    <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary, marginTop: 20 }]}>TRAINING</Text>
                    <View style={[styles.levelCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                        <View style={styles.levelHeader}>
                            <Text style={[styles.levelTitle, { color: theme.colors.text }]}>Level</Text>
                            <Text style={[styles.levelText, { color: theme.colors.text }]}>
                                {ego?.trainingLevel || 0} / 5
                            </Text>
                        </View>
                        <View style={[styles.levelTrack, { backgroundColor: subtle }]}>
                            <View
                                style={[
                                    styles.levelFill,
                                    { width: `${((ego?.trainingLevel || 0) / 5) * 100}%`, backgroundColor: ACCENT }
                                ]}
                            />
                        </View>
                    </View>

                    <View style={{ height: 20 }} />

                    <TrainingCard
                        title="How do you respond to 'How are you?'"
                        placeholder="Living the dream! What about you?"
                        value={formData.training.howAreYou}
                        onChange={(t) => setFormData(prev => ({
                            ...prev,
                            training: { ...prev.training, howAreYou: t }
                        }))}
                        theme={theme}
                    />

                    <TrainingCard
                        title="Describe your humor style"
                        placeholder="I love puns and self-deprecating jokes"
                        value={formData.training.humorStyle}
                        onChange={(t) => setFormData(prev => ({
                            ...prev,
                            training: { ...prev.training, humorStyle: t }
                        }))}
                        theme={theme}
                    />

                    <TrainingCard
                        title="How do you respond to compliments?"
                        placeholder="Aw thanks, you're too kind"
                        value={formData.training.complimentResponse}
                        onChange={(t) => setFormData(prev => ({
                            ...prev,
                            training: { ...prev.training, complimentResponse: t }
                        }))}
                        theme={theme}
                    />

                    <TouchableOpacity
                        style={[styles.testBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
                        onPress={handleTestResponse}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="chatbubble-outline" size={18} color={theme.colors.text} />
                        <Text style={[styles.testBtnText, { color: theme.colors.text }]}>Test AI response</Text>
                    </TouchableOpacity>
                </ScrollView>
            )}

            {/* ACTIVITY */}
            {tab === 'activity' && (
                <FlatList
                    data={activityLog}
                    keyExtractor={(_, i) => i.toString()}
                    contentContainerStyle={styles.content}
                    renderItem={({ item }) => {
                        const typeConfig = {
                            dm_reply: { icon: 'chatbubble-outline', label: 'DM reply' },
                            comment_reply: { icon: 'chatbubbles-outline', label: 'Comment reply' },
                            guess_game: { icon: 'help-circle-outline', label: 'Guess game' },
                        };
                        const cfg = typeConfig[item.type] || { icon: 'flash-outline', label: item.type };

                        return (
                            <View style={[styles.activityItem, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                                <View style={[styles.activityIcon, { backgroundColor: subtle }]}>
                                    <Ionicons name={cfg.icon} size={18} color={theme.colors.text} />
                                </View>
                                <View style={styles.activityContent}>
                                    <View style={styles.activityHeader}>
                                        <Text style={[styles.activityLabel, { color: theme.colors.text }]}>{cfg.label}</Text>
                                        <Text style={[styles.activityTime, { color: theme.colors.textSecondary }]}>
                                            {item.timestamp ? new Date(item.timestamp).toLocaleDateString() : ''}
                                        </Text>
                                    </View>
                                    {item.trigger && (
                                        <Text style={[styles.activityTrigger, { color: theme.colors.textSecondary }]}
                                            numberOfLines={1}>
                                            “{item.trigger}”
                                        </Text>
                                    )}
                                    <Text style={[styles.activityResponse, { color: theme.colors.text }]}
                                        numberOfLines={2}>
                                        {item.response}
                                    </Text>
                                </View>
                            </View>
                        );
                    }}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <View style={[styles.emptyIconCircle, { backgroundColor: subtle }]}>
                                <Ionicons name="time-outline" size={28} color={theme.colors.textSecondary} />
                            </View>
                            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                                No activity yet. Activate your AI and it will start logging responses here.
                            </Text>
                        </View>
                    }
                />
            )}

            {/* GUESS WHO */}
            {tab === 'guessWho' && (
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    <Text style={[styles.guessTitle, { color: theme.colors.text }]}>Guess Who Said It</Text>
                    <Text style={[styles.guessDesc, { color: theme.colors.textSecondary }]}>
                        Can you tell your AI's responses from real ones?
                    </Text>

                    {guessStats && (
                        <View style={[styles.guessStatsRow, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                            {[
                                { value: guessStats.totalGuesses || 0, label: 'Played' },
                                { value: guessStats.correctGuesses || 0, label: 'Correct' },
                                { value: guessStats.fooledCount || 0, label: 'Fooled' },
                                { value: guessStats.accuracy != null ? `${guessStats.accuracy}%` : '—', label: 'Accuracy' },
                            ].map((s, i) => (
                                <View key={i} style={styles.guessStat}>
                                    <Text style={[styles.guessStatValue, { color: theme.colors.text }]}>{s.value}</Text>
                                    <Text style={[styles.guessStatLabel, { color: theme.colors.textSecondary }]}>{s.label}</Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {!guessState && (
                        <TouchableOpacity
                            style={[styles.primaryBtn, { backgroundColor: ACCENT }]}
                            onPress={startGuessRound}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.primaryBtnText}>Start round</Text>
                        </TouchableOpacity>
                    )}

                    {guessState && (
                        <View style={[styles.guessCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                            <Text style={[styles.guessPrompt, { color: theme.colors.textSecondary }]}>
                                Someone received “Hey what have you been up to?” and replied:
                            </Text>
                            <View style={[styles.guessBubble, { backgroundColor: subtle }]}>
                                <Text style={[styles.guessBubbleText, { color: theme.colors.text }]}>
                                    “{guessState.message}”
                                </Text>
                            </View>

                            {!guessState.showAnswer ? (
                                <View style={styles.guessButtons}>
                                    <TouchableOpacity
                                        style={[styles.guessBtn, { borderColor: theme.colors.border, backgroundColor: subtle }]}
                                        onPress={() => submitGuess(false)}
                                        activeOpacity={0.85}
                                    >
                                        <Text style={[styles.guessBtnText, { color: theme.colors.text }]}>Real person</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.guessBtn, { borderColor: theme.colors.border, backgroundColor: subtle }]}
                                        onPress={() => submitGuess(true)}
                                        activeOpacity={0.85}
                                    >
                                        <Text style={[styles.guessBtnText, { color: theme.colors.text }]}>AI Alter Ego</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View style={styles.guessResult}>
                                    <View style={[
                                        styles.resultBadge,
                                        { backgroundColor: guessState.correct ? ACCENT : '#F44336' }
                                    ]}>
                                        <Ionicons
                                            name={guessState.correct ? 'checkmark' : 'close'}
                                            size={20}
                                            color="#FFF"
                                        />
                                    </View>
                                    <Text style={[styles.guessResultText, { color: theme.colors.text }]}>
                                        {guessState.correct ? 'You got it right' : 'Fooled you'}
                                    </Text>
                                    <Text style={[styles.guessResultSub, { color: theme.colors.textSecondary }]}>
                                        That was from the AI Alter Ego
                                    </Text>

                                    <TouchableOpacity
                                        style={[styles.nextRoundBtn, { borderColor: theme.colors.border }]}
                                        onPress={() => {
                                            setGuessState(null);
                                            startGuessRound();
                                        }}
                                        activeOpacity={0.85}
                                    >
                                        <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Next round</Text>
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
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    backBtn: { padding: 4, marginRight: 8 },
    headerCenter: { flex: 1 },
    headerTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
    headerSubtitle: { fontSize: 12, fontWeight: '500' },
    aiDot: { width: 6, height: 6, borderRadius: 3 },
    saveBtn: { paddingHorizontal: 8, paddingVertical: 4 },
    saveBtnText: { fontSize: 16, fontWeight: '600' },

    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingText: { fontSize: 14 },

    tabBar: {
        flexDirection: 'row',
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 14,
        position: 'relative',
    },
    tabLabel: { fontSize: 14, fontWeight: '600' },
    tabIndicator: {
        position: 'absolute',
        bottom: -StyleSheet.hairlineWidth,
        height: 2,
        left: '30%',
        right: '30%',
        borderRadius: 1,
    },

    content: { padding: 16, paddingBottom: 40 },

    activationCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        marginBottom: 24,
    },
    activationInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    statusDot: { width: 10, height: 10, borderRadius: 5 },
    activationTitle: { fontSize: 16, fontWeight: '600' },
    activationDesc: { fontSize: 13, marginTop: 2 },

    sectionLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginBottom: 8 },

    nameInput: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
    },

    personalityList: { gap: 8 },
    personalityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
    },
    personalityLabel: { fontSize: 15, fontWeight: '600' },
    personalityDesc: { fontSize: 12, marginTop: 2 },
    radio: {
        width: 20, height: 20, borderRadius: 10,
        borderWidth: 2,
        justifyContent: 'center', alignItems: 'center',
    },
    radioInner: { width: 10, height: 10, borderRadius: 5 },

    levelCard: {
        padding: 14,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
    },
    levelHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    levelTitle: { fontSize: 14, fontWeight: '500' },
    levelText: { fontSize: 14, fontWeight: '600' },
    levelTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
    levelFill: { height: 4, borderRadius: 2 },

    trainingCard: {
        padding: 14,
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: StyleSheet.hairlineWidth,
    },
    trainingTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
    trainingInput: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 10,
        padding: 12,
        fontSize: 14,
        minHeight: 56,
        textAlignVertical: 'top',
    },

    testBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        gap: 8,
        marginTop: 12,
    },
    testBtnText: { fontSize: 15, fontWeight: '600' },

    // Activity
    activityItem: {
        flexDirection: 'row',
        padding: 14,
        borderRadius: 12,
        marginBottom: 8,
        gap: 12,
        borderWidth: StyleSheet.hairlineWidth,
    },
    activityIcon: {
        width: 36, height: 36, borderRadius: 18,
        justifyContent: 'center', alignItems: 'center',
    },
    activityContent: { flex: 1 },
    activityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    activityLabel: { fontSize: 13, fontWeight: '600' },
    activityTime: { fontSize: 11 },
    activityTrigger: { fontSize: 12, fontStyle: 'italic', marginTop: 4 },
    activityResponse: { fontSize: 14, lineHeight: 19, marginTop: 4 },

    emptyState: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
    emptyIconCircle: {
        width: 64, height: 64, borderRadius: 32,
        justifyContent: 'center', alignItems: 'center',
        marginBottom: 16,
    },
    emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

    // Guess Who
    guessTitle: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
    guessDesc: { fontSize: 14, marginTop: 6, marginBottom: 20 },

    guessStatsRow: {
        flexDirection: 'row',
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
        borderWidth: StyleSheet.hairlineWidth,
    },
    guessStat: { flex: 1, alignItems: 'center' },
    guessStatValue: { fontSize: 20, fontWeight: '700' },
    guessStatLabel: { fontSize: 11, marginTop: 2 },

    primaryBtn: {
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 4,
    },
    primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },

    guessCard: {
        padding: 18,
        borderRadius: 14,
        marginTop: 4,
        borderWidth: StyleSheet.hairlineWidth,
    },
    guessPrompt: { fontSize: 13, marginBottom: 12, textAlign: 'center' },
    guessBubble: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
    },
    guessBubbleText: { fontSize: 16, lineHeight: 24, textAlign: 'center' },

    guessButtons: { flexDirection: 'row', gap: 10 },
    guessBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
    },
    guessBtnText: { fontSize: 14, fontWeight: '600' },

    guessResult: { alignItems: 'center', paddingVertical: 8 },
    resultBadge: {
        width: 44, height: 44, borderRadius: 22,
        justifyContent: 'center', alignItems: 'center',
        marginBottom: 12,
    },
    guessResultText: { fontSize: 18, fontWeight: '600' },
    guessResultSub: { fontSize: 13, marginTop: 4 },
    nextRoundBtn: {
        borderWidth: 1,
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 10,
        marginTop: 18,
    },
});

export default AlterEgoScreen;
