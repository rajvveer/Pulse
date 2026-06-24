import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Easing,
    TextInput,
    FlatList,
    StatusBar,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';
import { getTheme } from '../styles/theme';
import api from '../services/api';

const ACCENT = '#FF6B35';
const CHAT_DURATION = 180;

const RouletteScreen = ({ navigation }) => {
    const { isDark } = useTheme();
    const theme = getTheme(isDark);

    const [phase, setPhase] = useState('idle');
    const [sessionId, setSessionId] = useState(null);
    const [partner, setPartner] = useState(null);
    const [icebreaker, setIcebreaker] = useState('');
    const [messages, setMessages] = useState([]);
    const [messageText, setMessageText] = useState('');
    const [timeLeft, setTimeLeft] = useState(CHAT_DURATION);
    const [outcome, setOutcome] = useState(null);

    const pulseAnim = useRef(new Animated.Value(0)).current;
    const pollRef = useRef(null);
    const timerRef = useRef(null);
    const flatListRef = useRef(null);

    useEffect(() => {
        if (phase === 'searching') {
            Animated.loop(
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1600,
                    easing: Easing.out(Easing.ease),
                    useNativeDriver: true
                })
            ).start();
        } else {
            pulseAnim.setValue(0);
        }
    }, [phase, pulseAnim]);

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
                            setTimeLeft(data.timeRemaining || CHAT_DURATION);
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
                    setTimeLeft(data.chatDuration || CHAT_DURATION);
                }
            }
        } catch (e) {
            console.error('Join error:', e);
            setPhase('idle');
        }
    };

    const handleLeave = async () => {
        try { await api.post('/roulette/leave'); } catch (e) { /* silent */ }
        resetState();
    };

    const handleSend = async () => {
        if (!messageText.trim() || !sessionId) return;
        const text = messageText.trim();
        setMessageText('');
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
        setTimeLeft(CHAT_DURATION);
        setOutcome(null);
    };

    const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

    const bg = theme.colors.background;
    const surface = isDark ? '#1C1C1E' : '#FFFFFF';
    const subtle = isDark ? '#2A2A2C' : '#F2F2F5';

    // ───────── IDLE ─────────
    if (phase === 'idle') {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
                <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={bg} />

                <View style={styles.topBar}>
                    <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
                        <Ionicons name="chevron-back" size={26} color={theme.colors.text} />
                    </TouchableOpacity>
                </View>

                <View style={styles.idleBody}>
                    <View style={[styles.iconCircle, { backgroundColor: subtle }]}>
                        <Ionicons name="shuffle" size={40} color={ACCENT} />
                    </View>

                    <Text style={[styles.title, { color: theme.colors.text }]}>Roulette</Text>
                    <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                        A 3-minute chat with someone new.{'\n'}If you vibe, connect.
                    </Text>

                    <TouchableOpacity
                        style={[styles.primaryBtn, { backgroundColor: ACCENT }]}
                        onPress={handleJoin}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.primaryBtnText}>Start</Text>
                    </TouchableOpacity>

                    <View style={styles.metaRow}>
                        <View style={styles.metaItem}>
                            <Ionicons name="time-outline" size={16} color={theme.colors.textSecondary} />
                            <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>3 min</Text>
                        </View>
                        <View style={[styles.metaDot, { backgroundColor: theme.colors.border }]} />
                        <View style={styles.metaItem}>
                            <Ionicons name="person-outline" size={16} color={theme.colors.textSecondary} />
                            <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>1-on-1</Text>
                        </View>
                        <View style={[styles.metaDot, { backgroundColor: theme.colors.border }]} />
                        <View style={styles.metaItem}>
                            <Ionicons name="lock-closed-outline" size={16} color={theme.colors.textSecondary} />
                            <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>Private</Text>
                        </View>
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    // ───────── SEARCHING ─────────
    if (phase === 'searching') {
        const ringScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] });
        const ringOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

        return (
            <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
                <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={bg} />

                <View style={styles.idleBody}>
                    <View style={styles.pulseWrap}>
                        <Animated.View
                            style={[
                                styles.pulseRing,
                                { borderColor: ACCENT, transform: [{ scale: ringScale }], opacity: ringOpacity }
                            ]}
                        />
                        <View style={[styles.iconCircle, { backgroundColor: ACCENT }]}>
                            <Ionicons name="shuffle" size={40} color="#FFF" />
                        </View>
                    </View>

                    <Text style={[styles.title, { color: theme.colors.text, marginTop: 32 }]}>Looking for someone</Text>
                    <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                        Usually under 30 seconds
                    </Text>

                    <TouchableOpacity style={styles.ghostBtn} onPress={handleLeave}>
                        <Text style={[styles.ghostBtnText, { color: theme.colors.textSecondary }]}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // ───────── CHAT / DECIDE ─────────
    if (phase === 'chatting' || phase === 'deciding') {
        const initial = (partner?.username || '?').charAt(0).toUpperCase();
        const isDeciding = phase === 'deciding';
        const progress = Math.max(0, Math.min(1, timeLeft / CHAT_DURATION));
        const lowTime = timeLeft < 30;

        return (
            <KeyboardAvoidingView
                style={[styles.container, { backgroundColor: bg }]}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={surface} />

                <SafeAreaView style={{ backgroundColor: surface }}>
                    <View style={[styles.chatHeader, { borderBottomColor: theme.colors.border }]}>
                        <TouchableOpacity onPress={handleLeave} hitSlop={12}>
                            <Ionicons name="close" size={24} color={theme.colors.text} />
                        </TouchableOpacity>

                        <View style={styles.chatHeaderCenter}>
                            <View style={[styles.chatAvatar, { backgroundColor: ACCENT }]}>
                                <Text style={styles.chatAvatarText}>{initial}</Text>
                            </View>
                            <View>
                                <Text style={[styles.chatPartnerName, { color: theme.colors.text }]}>
                                    @{partner?.username || 'someone'}
                                </Text>
                                <Text style={[styles.chatPartnerSub, { color: theme.colors.textSecondary }]}>
                                    Anonymous chat
                                </Text>
                            </View>
                        </View>

                        <Text style={[styles.timerText, { color: lowTime ? '#FF3B30' : theme.colors.text }]}>
                            {formatTime(timeLeft)}
                        </Text>
                    </View>

                    <View style={[styles.progressTrack, { backgroundColor: theme.colors.border }]}>
                        <View
                            style={[
                                styles.progressFill,
                                { width: `${progress * 100}%`, backgroundColor: lowTime ? '#FF3B30' : ACCENT }
                            ]}
                        />
                    </View>
                </SafeAreaView>

                {icebreaker && messages.length < 3 && (
                    <View style={[styles.icebreakerCard, { backgroundColor: subtle, borderColor: theme.colors.border }]}>
                        <Ionicons name="bulb-outline" size={16} color={ACCENT} />
                        <Text style={[styles.icebreakerText, { color: theme.colors.text }]}>
                            {icebreaker}
                        </Text>
                    </View>
                )}

                <FlatList
                    ref={flatListRef}
                    data={messages}
                    keyExtractor={(_, i) => i.toString()}
                    contentContainerStyle={styles.messagesList}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                    renderItem={({ item }) => {
                        const isMe = item.sender?._id === 'me' || item.sender === 'me';
                        return (
                            <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
                                <View
                                    style={[
                                        styles.msgBubble,
                                        isMe
                                            ? { backgroundColor: ACCENT, borderBottomRightRadius: 4 }
                                            : { backgroundColor: subtle, borderBottomLeftRadius: 4 }
                                    ]}
                                >
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
                                Say hi. The clock is ticking.
                            </Text>
                        </View>
                    }
                />

                {isDeciding && (
                    <View style={[styles.decideOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.92)' : 'rgba(255,255,255,0.96)' }]}>
                        <Text style={[styles.decideTitle, { color: theme.colors.text }]}>Time's up</Text>
                        <Text style={[styles.decideSub, { color: theme.colors.textSecondary }]}>
                            Did you vibe with @{partner?.username}?
                        </Text>

                        <View style={styles.decideButtons}>
                            <TouchableOpacity
                                style={[styles.decideBtn, { borderColor: theme.colors.border, backgroundColor: subtle }]}
                                onPress={() => handleDecision('pass')}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="close" size={20} color={theme.colors.text} />
                                <Text style={[styles.decideBtnText, { color: theme.colors.text }]}>Pass</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.decideBtn, { backgroundColor: ACCENT, borderColor: ACCENT }]}
                                onPress={() => handleDecision('connect')}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="heart" size={20} color="#FFF" />
                                <Text style={[styles.decideBtnText, { color: '#FFF' }]}>Connect</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {!isDeciding && (
                    <SafeAreaView style={{ backgroundColor: surface }}>
                        <View style={[styles.inputBar, { borderTopColor: theme.colors.border }]}>
                            <TextInput
                                style={[styles.input, { color: theme.colors.text, backgroundColor: subtle }]}
                                placeholder="Message"
                                placeholderTextColor={theme.colors.textSecondary}
                                value={messageText}
                                onChangeText={setMessageText}
                                onSubmitEditing={handleSend}
                                returnKeyType="send"
                            />
                            <TouchableOpacity
                                style={[styles.sendBtn, { backgroundColor: messageText.trim() ? ACCENT : subtle }]}
                                onPress={handleSend}
                                disabled={!messageText.trim()}
                            >
                                <Ionicons
                                    name="arrow-up"
                                    size={20}
                                    color={messageText.trim() ? '#FFF' : theme.colors.textSecondary}
                                />
                            </TouchableOpacity>
                        </View>
                    </SafeAreaView>
                )}
            </KeyboardAvoidingView>
        );
    }

    // ───────── RESULT ─────────
    if (phase === 'result') {
        const isMutualConnect = outcome === 'mutual_connect';

        return (
            <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
                <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={bg} />

                <View style={styles.idleBody}>
                    <View style={[styles.iconCircle, { backgroundColor: isMutualConnect ? ACCENT : subtle }]}>
                        <Ionicons
                            name={isMutualConnect ? 'heart' : 'close'}
                            size={40}
                            color={isMutualConnect ? '#FFF' : theme.colors.textSecondary}
                        />
                    </View>

                    <Text style={[styles.title, { color: theme.colors.text }]}>
                        {isMutualConnect ? "It's a match" : 'Not this time'}
                    </Text>
                    <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                        {isMutualConnect
                            ? `You and @${partner?.username} can now chat.`
                            : 'Try again — your match is out there.'}
                    </Text>

                    <View style={{ width: '100%', alignItems: 'center', marginTop: 32 }}>
                        {isMutualConnect && (
                            <TouchableOpacity
                                style={[styles.primaryBtn, { backgroundColor: ACCENT }]}
                                onPress={() => {
                                    resetState();
                                    navigation.navigate('ChatScreen', { recipientId: partner?._id });
                                }}
                                activeOpacity={0.85}
                            >
                                <Text style={styles.primaryBtnText}>Open chat</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={[
                                styles.secondaryBtn,
                                { borderColor: theme.colors.border, marginTop: isMutualConnect ? 12 : 0 }
                            ]}
                            onPress={() => { resetState(); handleJoin(); }}
                            activeOpacity={0.85}
                        >
                            <Text style={[styles.secondaryBtnText, { color: theme.colors.text }]}>Spin again</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={resetState} style={{ marginTop: 20 }} hitSlop={10}>
                            <Text style={[styles.ghostBtnText, { color: theme.colors.textSecondary }]}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    return null;
};

const styles = StyleSheet.create({
    container: { flex: 1 },

    topBar: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 4
    },

    idleBody: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
        paddingBottom: 60
    },

    iconCircle: {
        width: 96,
        height: 96,
        borderRadius: 48,
        justifyContent: 'center',
        alignItems: 'center'
    },

    pulseWrap: {
        width: 96,
        height: 96,
        justifyContent: 'center',
        alignItems: 'center'
    },
    pulseRing: {
        position: 'absolute',
        width: 96,
        height: 96,
        borderRadius: 48,
        borderWidth: 2
    },

    title: {
        fontSize: 28,
        fontWeight: '700',
        marginTop: 24,
        letterSpacing: -0.5
    },
    subtitle: {
        fontSize: 15,
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 22
    },

    primaryBtn: {
        marginTop: 32,
        paddingHorizontal: 48,
        paddingVertical: 14,
        borderRadius: 28,
        minWidth: 200,
        alignItems: 'center'
    },
    primaryBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: 0.2
    },

    secondaryBtn: {
        paddingHorizontal: 48,
        paddingVertical: 14,
        borderRadius: 28,
        minWidth: 200,
        alignItems: 'center',
        borderWidth: 1
    },
    secondaryBtnText: { fontSize: 16, fontWeight: '600' },

    ghostBtn: { marginTop: 32, paddingVertical: 8, paddingHorizontal: 16 },
    ghostBtnText: { fontSize: 15, fontWeight: '500' },

    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 40,
        gap: 12
    },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    metaText: { fontSize: 13, fontWeight: '500' },
    metaDot: { width: 3, height: 3, borderRadius: 1.5 },

    // Chat
    chatHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth
    },
    chatHeaderCenter: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginLeft: 12
    },
    chatAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center'
    },
    chatAvatarText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
    chatPartnerName: { fontSize: 15, fontWeight: '600' },
    chatPartnerSub: { fontSize: 12, marginTop: 1 },
    timerText: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },

    progressTrack: { height: 2, width: '100%' },
    progressFill: { height: 2 },

    icebreakerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginHorizontal: 16,
        marginTop: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth
    },
    icebreakerText: { flex: 1, fontSize: 13, lineHeight: 18 },

    messagesList: { padding: 16, paddingBottom: 24, flexGrow: 1 },
    msgRow: { marginBottom: 6 },
    msgRowMe: { alignItems: 'flex-end' },
    msgBubble: {
        maxWidth: '78%',
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 18
    },
    msgText: { fontSize: 15, lineHeight: 20 },

    emptyChat: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
    emptyChatText: { fontSize: 14 },

    decideOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
        zIndex: 100
    },
    decideTitle: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
    decideSub: { fontSize: 15, marginTop: 8, textAlign: 'center' },
    decideButtons: { flexDirection: 'row', marginTop: 32, gap: 12 },
    decideBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 28,
        paddingVertical: 14,
        borderRadius: 28,
        gap: 8,
        borderWidth: 1,
        minWidth: 130
    },
    decideBtnText: { fontSize: 15, fontWeight: '600' },

    inputBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderTopWidth: StyleSheet.hairlineWidth
    },
    input: {
        flex: 1,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 22,
        fontSize: 15,
        maxHeight: 100
    },
    sendBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        justifyContent: 'center',
        alignItems: 'center'
    }
});

export default RouletteScreen;
