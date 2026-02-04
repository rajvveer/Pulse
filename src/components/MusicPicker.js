import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    FlatList,
    Animated,
    Dimensions,
    Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height } = Dimensions.get('window');

// Sample trending songs (replace with API call or backend data)
const TRENDING_SONGS = [
    { id: '1', title: 'Blinding Lights', artist: 'The Weeknd', duration: '3:20', cover: '🎵' },
    { id: '2', title: 'Levitating', artist: 'Dua Lipa', duration: '3:23', cover: '🎶' },
    { id: '3', title: 'Stay', artist: 'The Kid LAROI', duration: '2:21', cover: '🎧' },
    { id: '4', title: 'Good 4 U', artist: 'Olivia Rodrigo', duration: '2:58', cover: '🎤' },
    { id: '5', title: 'Montero', artist: 'Lil Nas X', duration: '2:17', cover: '🎹' },
    { id: '6', title: 'Peaches', artist: 'Justin Bieber', duration: '3:18', cover: '🍑' },
    { id: '7', title: 'Kiss Me More', artist: 'Doja Cat', duration: '3:28', cover: '💋' },
    { id: '8', title: 'drivers license', artist: 'Olivia Rodrigo', duration: '4:02', cover: '🚗' },
    { id: '9', title: 'Watermelon Sugar', artist: 'Harry Styles', duration: '2:54', cover: '🍉' },
    { id: '10', title: 'Save Your Tears', artist: 'The Weeknd', duration: '3:35', cover: '😢' },
];

const CATEGORIES = ['Trending', 'Pop', 'Hip Hop', 'EDM', 'Bollywood', 'Indie'];

const MusicPicker = ({ visible, onClose, onSelect, selectedMusic }) => {
    const insets = useSafeAreaInsets();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Trending');
    const slideAnim = useRef(new Animated.Value(height)).current;

    useEffect(() => {
        if (visible) {
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 65,
                friction: 11,
            }).start();
        } else {
            Animated.timing(slideAnim, {
                toValue: height,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }
    }, [visible]);

    const filteredSongs = TRENDING_SONGS.filter(song =>
        song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        song.artist.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSelect = (song) => {
        onSelect(song);
        onClose();
    };

    const renderSongItem = ({ item }) => {
        const isSelected = selectedMusic?.id === item.id;

        return (
            <TouchableOpacity
                style={[styles.songItem, isSelected && styles.songItemSelected]}
                onPress={() => handleSelect(item)}
                activeOpacity={0.7}
            >
                <View style={styles.songCover}>
                    <Text style={styles.songCoverEmoji}>{item.cover}</Text>
                </View>

                <View style={styles.songInfo}>
                    <Text style={styles.songTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.songArtist} numberOfLines={1}>{item.artist}</Text>
                </View>

                <View style={styles.songRight}>
                    <Text style={styles.songDuration}>{item.duration}</Text>
                    {isSelected ? (
                        <Ionicons name="checkmark-circle" size={24} color="#FF3B5C" />
                    ) : (
                        <Ionicons name="play-circle-outline" size={24} color="#999" />
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <TouchableOpacity style={styles.overlayTouchable} onPress={onClose} />

                <Animated.View
                    style={[
                        styles.container,
                        {
                            transform: [{ translateY: slideAnim }],
                            paddingBottom: insets.bottom,
                        }
                    ]}
                >
                    {/* Handle */}
                    <View style={styles.handle} />

                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Add Music</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={28} color="#000" />
                        </TouchableOpacity>
                    </View>

                    {/* Search */}
                    <View style={styles.searchContainer}>
                        <Ionicons name="search" size={20} color="#999" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search songs or artists..."
                            placeholderTextColor="#999"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            autoCorrect={false}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Ionicons name="close-circle" size={20} color="#999" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Categories */}
                    <View style={styles.categoriesContainer}>
                        <FlatList
                            horizontal
                            data={CATEGORIES}
                            showsHorizontalScrollIndicator={false}
                            keyExtractor={(item) => item}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        styles.categoryChip,
                                        selectedCategory === item && styles.categoryChipActive
                                    ]}
                                    onPress={() => setSelectedCategory(item)}
                                >
                                    <Text style={[
                                        styles.categoryText,
                                        selectedCategory === item && styles.categoryTextActive
                                    ]}>
                                        {item}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        />
                    </View>

                    {/* Songs List */}
                    <FlatList
                        data={filteredSongs}
                        keyExtractor={(item) => item.id}
                        renderItem={renderSongItem}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.songsList}
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <Ionicons name="musical-notes-outline" size={48} color="#ccc" />
                                <Text style={styles.emptyText}>No songs found</Text>
                            </View>
                        }
                    />

                    {/* Selected Music Preview */}
                    {selectedMusic && (
                        <View style={styles.selectedPreview}>
                            <View style={styles.selectedInfo}>
                                <Text style={styles.selectedCover}>{selectedMusic.cover}</Text>
                                <View>
                                    <Text style={styles.selectedTitle}>{selectedMusic.title}</Text>
                                    <Text style={styles.selectedArtist}>{selectedMusic.artist}</Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                style={styles.removeButton}
                                onPress={() => onSelect(null)}
                            >
                                <Ionicons name="close-circle" size={24} color="#FF3B5C" />
                            </TouchableOpacity>
                        </View>
                    )}
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    overlayTouchable: {
        flex: 1,
    },
    container: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        height: height * 0.8,
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: '#ddd',
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 10,
        marginBottom: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#000',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        marginHorizontal: 20,
        marginVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        height: 48,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#000',
        marginLeft: 10,
    },
    categoriesContainer: {
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    categoryChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#f0f0f0',
        marginHorizontal: 4,
    },
    categoryChipActive: {
        backgroundColor: '#FF3B5C',
    },
    categoryText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
    },
    categoryTextActive: {
        color: '#fff',
    },
    songsList: {
        paddingHorizontal: 20,
    },
    songItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f5f5f5',
    },
    songItemSelected: {
        backgroundColor: 'rgba(255, 59, 92, 0.05)',
        marginHorizontal: -20,
        paddingHorizontal: 20,
        borderRadius: 12,
    },
    songCover: {
        width: 50,
        height: 50,
        borderRadius: 8,
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    songCoverEmoji: {
        fontSize: 24,
    },
    songInfo: {
        flex: 1,
        marginLeft: 14,
    },
    songTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000',
        marginBottom: 4,
    },
    songArtist: {
        fontSize: 14,
        color: '#666',
    },
    songRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    songDuration: {
        fontSize: 13,
        color: '#999',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        fontSize: 16,
        color: '#999',
        marginTop: 12,
    },
    selectedPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: '#f8f8f8',
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    selectedInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    selectedCover: {
        fontSize: 28,
    },
    selectedTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#000',
    },
    selectedArtist: {
        fontSize: 13,
        color: '#666',
    },
    removeButton: {
        padding: 4,
    },
});

export default MusicPicker;
