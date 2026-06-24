import React, { useRef, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    Dimensions,
    TouchableOpacity,
    TouchableWithoutFeedback,
    ScrollView,
    PanResponder,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';
import { getTheme } from '../styles/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH * 0.75;
const SWIPE_THRESHOLD = DRAWER_WIDTH * 0.3;
const VELOCITY_THRESHOLD = 0.5;

const LeftDrawer = ({ isOpen, onClose, currentVibe, onVibeChange }) => {
    const insets = useSafeAreaInsets();
    const navigation = useNavigation();
    const { isDark } = useTheme();
    const theme = getTheme(isDark);

    const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
    const overlayOpacity = useRef(new Animated.Value(0)).current;

    // Swipe-to-close gesture
    const panResponder = useMemo(() =>
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                // Only respond to leftward swipes on the drawer
                return gestureState.dx < -10 && Math.abs(gestureState.dy) < Math.abs(gestureState.dx);
            },
            onPanResponderMove: (_, gestureState) => {
                // Clamp between -DRAWER_WIDTH and 0
                const newX = Math.min(0, Math.max(-DRAWER_WIDTH, gestureState.dx));
                translateX.setValue(newX);
                // Sync overlay opacity
                const progress = 1 + (newX / DRAWER_WIDTH);
                overlayOpacity.setValue(Math.max(0, progress));
            },
            onPanResponderRelease: (_, gestureState) => {
                // If swiped far enough or fast enough, close
                if (gestureState.dx < -SWIPE_THRESHOLD || gestureState.vx < -VELOCITY_THRESHOLD) {
                    closeDrawer();
                } else {
                    // Snap back open
                    openDrawer();
                }
            },
        }),
        []);

    const openDrawer = () => {
        Animated.parallel([
            Animated.spring(translateX, {
                toValue: 0,
                useNativeDriver: true,
                tension: 50,
                friction: 10,
            }),
            Animated.timing(overlayOpacity, {
                toValue: 1,
                duration: 250,
                useNativeDriver: true,
            }),
        ]).start();
    };

    const closeDrawer = () => {
        Animated.parallel([
            Animated.spring(translateX, {
                toValue: -DRAWER_WIDTH,
                useNativeDriver: true,
                tension: 50,
                friction: 10,
            }),
            Animated.timing(overlayOpacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start(() => {
            onClose();
        });
    };

    useEffect(() => {
        if (isOpen) {
            openDrawer();
        } else {
            Animated.parallel([
                Animated.spring(translateX, {
                    toValue: -DRAWER_WIDTH,
                    useNativeDriver: true,
                    tension: 50,
                    friction: 10,
                }),
                Animated.timing(overlayOpacity, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [isOpen]);

    const vibes = [
        { id: 'auto', icon: 'color-wand-outline', label: 'Auto Detect' },
        { id: 'chill', icon: 'leaf-outline', label: 'Chill' },
        { id: 'hype', icon: 'flame-outline', label: 'Hype' },
        { id: 'sad', icon: 'heart-outline', label: 'In My Feels' },
        { id: 'funny', icon: 'happy-outline', label: 'Comedy' },
        { id: 'creative', icon: 'sparkles-outline', label: 'Creative' },
    ];

    const menuItems = [
        {
            id: 'profile',
            icon: 'person-circle-outline',
            label: 'Profile',
            screen: 'Profile',
        },
        {
            id: 'pulsedrops',
            icon: 'flash-outline',
            label: 'Pulse Drops',
            screen: 'PulseDrops',
        },
        {
            id: 'chains',
            icon: 'git-branch-outline',
            label: 'Chain Reactions',
            screen: 'Chains',
        },
        {
            id: 'alterego',
            icon: 'sparkles-outline',
            label: 'AI Alter Ego',
            screen: 'AlterEgo',
        },
        {
            id: 'roulette',
            icon: 'dice-outline',
            label: 'Roulette',
            screen: 'Roulette',
        },
        {
            id: 'bookmarks',
            icon: 'bookmark-outline',
            label: 'Bookmarks',
            screen: 'Bookmarks',
        },
    ];

    const handleNavigate = (screen) => {
        onClose();
        setTimeout(() => {
            // Profile and Settings live inside the Profile tab's stack, so they
            // must be reached through the nested Main > Profile route. The other
            // feature screens are registered on the root navigator directly.
            if (screen === 'Profile') {
                navigation.navigate('Main', { screen: 'Profile', params: { screen: 'ProfileMain' } });
            } else if (screen === 'Settings') {
                navigation.navigate('Main', { screen: 'Profile', params: { screen: 'Settings' } });
            } else {
                navigation.navigate(screen);
            }
        }, 300);
    };

    if (!isOpen) return null;

    return (
        <View style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 9999 }]} pointerEvents="box-none">
            {/* Overlay */}
            <TouchableWithoutFeedback onPress={closeDrawer}>
                <Animated.View
                    style={[
                        styles.overlay,
                        { opacity: overlayOpacity },
                    ]}
                />
            </TouchableWithoutFeedback>

            {/* Drawer with swipe gesture */}
            <Animated.View
                {...panResponder.panHandlers}
                style={[
                    styles.drawer,
                    {
                        width: DRAWER_WIDTH,
                        backgroundColor: theme.colors.surface,
                        paddingTop: insets.top + 16,
                        paddingBottom: insets.bottom + 16,
                        transform: [{ translateX }],
                    },
                ]}
            >
                <ScrollView showsVerticalScrollIndicator={false}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
                            Pulse
                        </Text>
                        <TouchableOpacity onPress={closeDrawer} style={styles.closeBtn}>
                            <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Vibe Check Section */}
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
                            VIBE CHECK
                        </Text>
                        <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
                            Feed adapts to your mood
                        </Text>
                        <View style={styles.vibeGrid}>
                            {vibes.map((vibe) => (
                                <TouchableOpacity
                                    key={vibe.id}
                                    style={[
                                        styles.vibeChip,
                                        {
                                            backgroundColor: currentVibe === vibe.id
                                                ? theme.colors.primary + '20'
                                                : theme.colors.background,
                                            borderColor: currentVibe === vibe.id
                                                ? theme.colors.primary
                                                : theme.colors.border,
                                        },
                                    ]}
                                    onPress={() => onVibeChange?.(vibe.id)}
                                >
                                    <Ionicons name={vibe.icon} size={16} color={currentVibe === vibe.id ? theme.colors.primary : theme.colors.textSecondary} />
                                    <Text
                                        style={[
                                            styles.vibeLabel,
                                            {
                                                color: currentVibe === vibe.id
                                                    ? theme.colors.primary
                                                    : theme.colors.text,
                                            },
                                        ]}
                                        numberOfLines={1}
                                    >
                                        {vibe.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Divider */}
                    <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

                    {/* Feature Menu */}
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
                            FEATURES
                        </Text>
                        {menuItems.map((item) => (
                            <TouchableOpacity
                                key={item.id}
                                style={styles.featureLink}
                                onPress={() => handleNavigate(item.screen)}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.featureName, { color: theme.colors.text }]}>
                                    {item.label}
                                </Text>
                                <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Divider */}
                    <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

                    {/* Settings */}
                    <View style={styles.section}>
                        <TouchableOpacity
                            style={[styles.menuItem, { backgroundColor: theme.colors.background }]}
                            onPress={() => handleNavigate('Settings')}
                        >
                            <View style={[styles.menuIconWrap, { backgroundColor: theme.colors.textSecondary + '20' }]}>
                                <Ionicons name="settings-outline" size={22} color={theme.colors.textSecondary} />
                            </View>
                            <View style={styles.menuTextWrap}>
                                <Text style={[styles.menuLabel, { color: theme.colors.text }]}>Settings</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    drawer: {
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        shadowColor: '#000',
        shadowOffset: { width: 4, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 24,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    closeBtn: {
        padding: 6,
    },
    section: {
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 1,
        marginBottom: 4,
    },
    sectionSubtitle: {
        fontSize: 12,
        marginBottom: 12,
    },
    vibeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    vibeChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1.5,
        gap: 6,
    },

    vibeLabel: {
        fontSize: 13,
        fontWeight: '600',
    },
    divider: {
        height: 1,
        marginHorizontal: 20,
        marginVertical: 12,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 14,
        marginBottom: 8,
    },
    menuIconWrap: {
        width: 42,
        height: 42,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    menuTextWrap: {
        flex: 1,
    },
    menuLabel: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 2,
    },
    menuSublabel: {
        fontSize: 12,
    },
    featureLink: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 4,
        borderBottomWidth: 0.5,
        borderBottomColor: 'rgba(128,128,128,0.2)',
    },
    featureName: {
        fontSize: 16,
        fontWeight: '600',
    },
});

export default LeftDrawer;
