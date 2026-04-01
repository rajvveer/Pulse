import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Dimensions,
    TextInput,
    FlatList,
    ActivityIndicator,
    StatusBar,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';
import { getTheme } from '../styles/theme';
import api from '../services/api';

const { width } = Dimensions.get('window');

const RouletteScreen = ({ navigation }) => {
    const { isDark } = useTheme();
    const theme = getTheme(isDark);

    const [phase, setPhase] = useState('idle');    // idle | searching | matched | chatting | deciding | result
    const [sessionId, setSessionId] = useState(null);
    const [partner, setPartner] = useState(null);
    const [icebreaker, setIcebreaker] = useState('');
    const [messages, setMessages] = useState([]);
    const [messageText, setMessageText] = useState('');
    const [timeLeft, setTimeLeft] = useState(180);
    const [outcome, setOutcome] = useState(null);

    const spinAnim = useRef(new Animated.Value(0)).current;
    const pollRef = useRef(null);
    const timerRef = useRef(null);
    const flatListRef = useRef(null);

    // Spin animation for searching
    useEffect(() => {
        if (phase === 'searching') {
            Animated.loop(
                Animated.timing(spinAnim, {
                    toValue: 1,
                    duration: 2000,
                    useNativeDriver: true
                })
            ).start();
        } else {
            spinAnim.setValue(0);
        }
    }, [phase, spinAnim]);

    // Poll for status when searching
    useEffect(() => {
        if (phase === 'searching') {
            pollRef.current = setInterval(async () => {
                try {
                    const res = await api.get('/roulette/status');
                    if (res.data.success) {
                        const data = res.data.data;
                        if (data.status === 'chatting' || data.status === 'matched') {
                            setPhase('chatting');
                            setSessionId(data.sessionId);
                            setPartner(data.partner);
                            setIcebreaker(data.icebreaker);
                            setMessages(data.messages || []);
                            setTimeLeft(data.timeRemaining || 180);
                            clearInterval(pollRef.current);
                        }
                    }
                } catch (e) {
                    console.error('Poll error:', e);
                }
            }, 2000);
        }

        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [phase]);

    // Chat timer countdown
    useEffect(() => {
        if (phase === 'chatting' && timeLeft > 0) {
            timerRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        clearInterval(timerRef.current);
                        setPhase('deciding');
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [phase, timeLeft]);

    // Poll messages during chat
    useEffect(() => {
        if (phase === 'chatting') {
            const msgPoll = setInterval(async () => {
                try {
                    const res = await api.get('/roulette/status');
                    if (res.data.success) {
                        setMessages(res.data.data.messages || []);
                        if (res.data.data.timeRemaining !== null) {
                            setTimeLeft(res.data.data.timeRemaining);
                        }
                        if (res.data.data.status === 'deciding') {
                            setPhase('deciding');
                        }
                    }
                } catch (e) { /* silent */ }
            }, 3000);

            return () => clearInterval(msgPoll);
        }
    }, [phase]);

    const handleJoin = async () => {
        setPhase('searching');
        try {
            const res = await api.post('/roulette/join');
            if (res.data.success) {
                const data = res.data.data;
                setSessionId(data.sessionId);

                if (data.status === 'matched') {
                    setPhase('chatting');
                    setPartner(data.partner);
                    setIcebreaker(data.icebreaker);
                    setTimeLeft(data.chatDuration || 180);
                }
            }
        } catch (e) {
            console.error('Join error:', e);
            setPhase('idle');
        }
    };

    const handleLeave = async () => {
        try {
            await api.post('/roulette/leave');
        } catch (e) { /* silent */ }
        resetState();
    };

    const handleSend = async () => {
        if (!messageText.trim() || !sessionId) return;

        const text = messageText.trim();
        setMessageText('');

        // Optimistic update
        setMessages(prev => [...prev, { sender: { _id: 'me' }, text, timestamp: new Date() }]);

        try {
            await api.post('/roulette/message', { sessionId, text });
        } catch (e) {
            console.error('Send error:', e);
        }
    };

    const handleDecision = async (decision) => {
        try {
            const res = await api.post('/roulette/decide', { sessionId, decision });
            if (res.data.success) {
                setOutcome(res.data.data.outcome || decision);
                setPhase('result');
            }
        } catch (e) {
            console.error('Decision error:', e);
        }
    };

    const resetState = () => {
        setPhase('idle');
        setSessionId(null);
        setPartner(null);
        setIcebreaker('');
        setMessages([]);
        setMessageText('');
        setTimeLeft(180);
        setOutcome(null);
    };

    const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

    // ═══════ IDLE SCREEN ═══════
    if (phase === 'idle') {
        return (
            <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
                <LinearGradient
                    colors={['#FF6B35', '#E91E63', isDark ? '#000' : '#1A1A2E']}
                    style={styles.fullScreen}
                >
                    <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={24} color="#FFF" />
                    </TouchableOpacity>

                    <Text style={styles.idleEmoji}>🎰</Text>
                    <Text style={styles.idleTitle}>Pulse Roulette</Text>
                    <Text style={styles.idleDesc}>
                        Get matched with a random person for a 3-minute timed chat.{'\n'}
                        If you vibe, connect. If not, no pressure.
                    </Text>

                    <TouchableOpacity style={styles.spinBtn} onPress={handleJoin}>
                        <LinearGradient
                            colors={['#FFF', 'rgba(255,255,255,0.9)']}
                            style={styles.spinBtnGradient}
                        >
                            <Text style={styles.spinBtnText}>🎲 Spin the Roulette</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    <View style={styles.rulesRow}>
                        {[
                            { icon: '⏱️', text: '3 min chat' },
                            { icon: '🤝', text: 'Connect or pass' },
                            { icon: '🎭', text: 'Be yourself' }
                        ].map((r, i) => (
                            <View key={i} style={styles.ruleItem}>
                                <Text style={styles.ruleIcon}>{r.icon}</Text>
                                <Text style={styles.ruleText}>{r.text}</Text>
                            </View>
                        ))}
                    </View>
                </LinearGradient>
            </View>
        );
    }

    // ═══════ SEARCHING ═══════
    if (phase === 'searching') {
        const spin = spinAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', '360deg']
        });

        return (
            <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <StatusBar barStyle="light-content" />
                <LinearGradient
                    colors={['#FF6B35', '#E91E63', isDark ? '#000' : '#1A1A2E']}
                    style={styles.fullScreen}
                >
                    <Animated.Text style={[styles.searchEmoji, { transform: [{ rotate: spin }] }]}>
                        🎰
                    </Animated.Text>
                    <Text style={styles.searchTitle}>Finding your match...</Text>
                    <Text style={styles.searchSub}>This usually takes under 30 seconds</Text>

                    <TouchableOpacity style={styles.cancelBtn} onPress={handleLeave}>
                        <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                </LinearGradient>
            </View>
        );
    }

    // ═══════ CHATTING ═══════
    if (phase === 'chatting' || phase === 'deciding') {
        const initial = (partner?.username || '?').charAt(0).toUpperCase();
        const isDeciding = phase === 'deciding';

        return (
            <KeyboardAvoidingView
                style={[styles.container, { backgroundColor: theme.colors.background }]}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

                {/* Header */}
                <View style={[styles.chatHeader, { backgroundColor: isDark ? '#1C1C1E' : '#FFF', borderBottomColor: theme.colors.border }]}>
                    <TouchableOpacity onPress={handleLeave}>
                        <Ionicons name="close" size={24} color={theme.colors.text} />
                    </TouchableOpacity>

                    <View style={styles.chatHeaderCenter}>
                        <View style={[styles.chatAvatar, { backgroundColor: '#FF6B35' }]}>
                            <Text style={styles.chatAvatarText}>{initial}</Text>
                        </View>
                        <Text style={[styles.chatPartnerName, { color: theme.colors.text }]}>
                            @{partner?.username || 'someone'}
                        </Text>
                    </View>

                    <View style={[styles.timerBadge, {
                        backgroundColor: timeLeft < 30 ? 'rgba(255,0,0,0.15)' : 'rgba(255,107,53,0.15)'
                    }]}>
                        <Ionicons name="time" size={14} color={timeLeft < 30 ? '#FF0000' : '#FF6B35'} />
                        <Text style={[styles.timerText, {
                            color: timeLeft < 30 ? '#FF0000' : '#FF6B35'
                        }]}>
                            {formatTime(timeLeft)}
                        </Text>
                    </View>
                </View>

                {/* Icebreaker */}
                {icebreaker && messages.length < 3 && (
                    <View style={[styles.icebreakerCard, { backgroundColor: isDark ? '#2C2C2E' : '#FFF5F0' }]}>
                        <Text style={[styles.icebreakerText, { color: theme.colors.text }]}>
                            💡 {icebreaker}
                        </Text>
                    </View>
                )}

                {/* Messages */}
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    keyExtractor={(_, i) => i.toString()}
                    contentContainerStyle={styles.messagesList}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
                    renderItem={({ item }) => {
                        const isMe = item.sender?._id === 'me' || item.sender === 'me';
                        return (
                            <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
                                <View style={[
                                    styles.msgBubble,
                                    isMe ? styles.msgBubbleMe : [styles.msgBubbleOther, { backgroundColor: isDark ? '#2C2C2E' : '#F0F0F5' }]
                                ]}>
                                    <Text style={[styles.msgText, { color: isMe ? '#FFF' : theme.colors.text }]}>
                                        {item.text}
                                    </Text>
                                </View>
                            </View>
                        );
                    }}
                    ListEmptyComponent={
                        <View style={styles.emptyChat}>
                            <Text style={[styles.emptyChatText, { color: theme.colors.textSecondary }]}>
                                Say hi! You have {formatTime(timeLeft)} ⏱️
                            </Text>
                        </View>
                    }
                />

                {/* Decide overlay */}
                {isDeciding && (
                    <View style={[styles.decideOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.95)' : 'rgba(255,255,255,0.95)' }]}>
                        <Text style={[styles.decideTitle, { color: theme.colors.text }]}>
                            ⏰ Time's up!
                        </Text>
                        <Text style={[styles.decideSub, { color: theme.colors.textSecondary }]}>
                            Did you vibe with @{partner?.username}?
                        </Text>

                        <View style={styles.decideButtons}>
                            <TouchableOpacity
                                style={[styles.decideBtn, styles.decideBtnConnect]}
                                onPress={() => handleDecision('connect')}
                            >
                                <Ionicons name="heart" size={24} color="#FFF" />
                                <Text style={styles.decideBtnText}>Connect</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.decideBtn, styles.decideBtnPass]}
                                onPress={() => handleDecision('pass')}
                            >
                                <Ionicons name="close" size={24} color="#FFF" />
                                <Text style={styles.decideBtnText}>Pass</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Input */}
                {!isDeciding && (
                    <View style={[styles.inputBar, { backgroundColor: isDark ? '#1C1C1E' : '#FFF', borderTopColor: theme.colors.border }]}>
                        <TextInput
                            style={[styles.input, { color: theme.colors.text, backgroundColor: isDark ? '#2C2C2E' : '#F0F0F5' }]}
                            placeholder="Type a message..."
                            placeholderTextColor={theme.colors.textSecondary}
                            value={messageText}
                            onChangeText={setMessageText}
                            onSubmitEditing={handleSend}
                            returnKeyType="send"
                        />
                        <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
                            <Ionicons name="send" size={20} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                )}
            </KeyboardAvoidingView>
        );
    }

    // ═══════ RESULT ═══════
    if (phase === 'result') {
        const isMutualConnect = outcome === 'mutual_connect';

        return (
            <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <StatusBar barStyle="light-content" />
                <LinearGradient
                    colors={isMutualConnect
                        ? ['#4CAF50', '#2196F3', isDark ? '#000' : '#1A1A2E']
                        : ['#333', '#1A1A2E', isDark ? '#000' : '#1A1A2E']}
                    style={styles.fullScreen}
                >
                    <Text style={styles.resultEmoji}>
                        {isMutualConnect ? '🎉' : '👋'}
                    </Text>
                    <Text style={styles.resultTitle}>
                        {isMutualConnect ? "It's a Match!" : "Maybe Next Time"}
                    </Text>
                    <Text style={styles.resultSub}>
                        {isMutualConnect
                            ? `You and @${partner?.username} are now connected!`
                            : "Keep spinning — your perfect match is out there!"}
                    </Text>

                    <View style={styles.resultButtons}>
                        {isMutualConnect && (
                            <TouchableOpacity
                                style={styles.resultBtn}
                                onPress={() => {
                                    resetState();
                                    navigation.navigate('ChatScreen', { recipientId: partner?._id });
                                }}
                            >
                                <Text style={styles.resultBtnText}>💬 Start Chatting</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={[styles.resultBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
                            onPress={() => {
                                resetState();
                                handleJoin();
                            }}
                        >
                            <Text style={styles.resultBtnText}>🎲 Spin Again</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={resetState}>
                            <Text style={[styles.resultDone, { marginTop: 20 }]}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </LinearGradient>
            </View>
        );
    }

    return null;
};

// =========================================================
//  STYLES
// =========================================================
const styles = StyleSheet.create({
    container: { flex: 1 },
    fullScreen: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 30
    },

    // Back
    backBtn: {
        position: 'absolute',
        top: 50,
        left: 16,
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center'
    },

    // Idle
    idleEmoji: { fontSize: 70, marginBottom: 20 },
    idleTitle: { fontSize: 32, fontWeight: '900', color: '#FFF' },
    idleDesc: {
        fontSize: 15,
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
        marginTop: 12,
        lineHeight: 22
    },
    spinBtn: { marginTop: 30, borderRadius: 30, overflow: 'hidden' },
    spinBtnGradient: { paddingHorizontal: 36, paddingVertical: 16, borderRadius: 30 },
    spinBtnText: { fontSize: 18, fontWeight: '800', color: '#FF6B35' },
    rulesRow: { flexDirection: 'row', marginTop: 40, gap: 20 },
    ruleItem: { alignItems: 'center', gap: 4 },
    ruleIcon: { fontSize: 22 },
    ruleText: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600' },

    // Searching
    searchEmoji: { fontSize: 80, marginBottom: 24 },
    searchTitle: { fontSize: 24, fontWeight: '800', color: '#FFF' },
    searchSub: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 8 },
    cancelBtn: {
        marginTop: 40,
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)'
    },
    cancelText: { color: '#FFF', fontSize: 14, fontWeight: '600' },

    // Chat header
    chatHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 50,
        paddingBottom: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1
    },
    chatHeaderCenter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10
    },
    chatAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center'
    },
    chatAvatarText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
    chatPartnerName: { fontSize: 16, fontWeight: '700' },
    timerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4
    },
    timerText: { fontSize: 14, fontWeight: '800' },

    // Icebreaker
    icebreakerCard: {
        marginHorizontal: 16,
        marginTop: 8,
        padding: 12,
        borderRadius: 12
    },
    icebreakerText: { fontSize: 14, textAlign: 'center' },

    // Messages
    messagesList: { padding: 16, paddingBottom: 80 },
    msgRow: { marginBottom: 8 },
    msgRowMe: { alignItems: 'flex-end' },
    msgBubble: { maxWidth: '80%', padding: 12, borderRadius: 18 },
    msgBubbleMe: { backgroundColor: '#FF6B35', borderBottomRightRadius: 4 },
    msgBubbleOther: { borderBottomLeftRadius: 4 },
    msgText: { fontSize: 15, lineHeight: 20 },

    // Empty chat
    emptyChat: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
    emptyChatText: { fontSize: 15 },

    // Decide
    decideOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100
    },
    decideTitle: { fontSize: 28, fontWeight: '900' },
    decideSub: { fontSize: 16, marginTop: 8 },
    decideButtons: { flexDirection: 'row', marginTop: 30, gap: 16 },
    decideBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 28,
        paddingVertical: 16,
        borderRadius: 30,
        gap: 8
    },
    decideBtnConnect: { backgroundColor: '#4CAF50' },
    decideBtnPass: { backgroundColor: '#F44336' },
    decideBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

    // Result
    resultEmoji: { fontSize: 60, marginBottom: 20 },
    resultTitle: { fontSize: 28, fontWeight: '900', color: '#FFF' },
    resultSub: { fontSize: 15, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 8 },
    resultButtons: { marginTop: 30, alignItems: 'center', gap: 12 },
    resultBtn: {
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 28,
        paddingVertical: 14,
        borderRadius: 26,
        minWidth: 200,
        alignItems: 'center'
    },
    resultBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
    resultDone: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '600' }
});

export default RouletteScreen;
