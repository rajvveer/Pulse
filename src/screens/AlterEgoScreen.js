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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';
import { getTheme } from '../styles/theme';
import api from '../services/api';

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
            const response = await api.get('/alter-ego/me');
            if (response.data.success) {
                const data = response.data.data;
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
            }
        } catch (error) {
            console.error('Fetch ego error:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchEgo();
    }, [fetchEgo]);

    const handleSave = async () => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            // Update settings
            await api.put('/alter-ego', {
                name: formData.name,
                personality: formData.personality,
                isActive: formData.isActive,
            });

            // Update training
            const trainResponse = await api.post('/alter-ego/train', formData.training);

            // Update local training level from response
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
            // Provide clearer instructions for training requirement
            if (errorMessage.includes('training')) {
                alert('⚠️ Training Required!\n\nPlease fill in at least ONE training field below (e.g., "How do you respond to \'How are you?\'") and tap Save before activating your AI.');
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
                alert(`AI Response: ${response.data.data.response}`);
            }
        } catch (error) {
            console.error('Test error:', error);
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
                    <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>Your AI twin</Text>
                </View>
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
            </View>

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
    saveBtn: { padding: 8 },
    saveBtnText: { fontSize: 16, fontWeight: '700' },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    loadingText: { fontSize: 14 },
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
});

export default AlterEgoScreen;
