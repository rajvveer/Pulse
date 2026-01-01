import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';
import { getTheme } from '../styles/theme';
import gifService from '../services/gifService';

const { width } = Dimensions.get('window');
const GIF_SIZE = (width - 48) / 2; // 2 columns like your chat app

const GifPickerModal = ({ visible, onClose, onSelectGif }) => {
  const { isDark } = useTheme();
  const theme = getTheme(isDark);

  const [searchTerm, setSearchTerm] = useState('');
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadGifs();
    }
  }, [visible, searchTerm]);

  const loadGifs = async () => {
    setLoading(true);
    
    if (searchTerm.trim()) {
      const results = await gifService.searchGifs(searchTerm, 20);
      setGifs(results);
    } else {
      const results = await gifService.getTrendingGifs(20);
      setGifs(results);
    }
    
    setLoading(false);
  };

  const handleGifSelect = (gif) => {
    onSelectGif({
      id: gif.id,
      url: gif.url,
      preview: gif.preview,
      width: gif.width,
      height: gif.height,
      description: gif.description
    });
    onClose();
  };

  const renderGifItem = ({ item }) => (
    <TouchableOpacity
      style={styles.gifItem}
      onPress={() => handleGifSelect(item)}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: item.preview }}
        style={styles.gifImage}
        resizeMode="cover"
      />
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { 
          backgroundColor: theme.colors.surface,
          borderBottomColor: theme.colors.border 
        }]}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            Choose a GIF
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={26} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.searchBar, { backgroundColor: theme.colors.background }]}>
            <Ionicons name="search" size={20} color={theme.colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.colors.text }]}
              placeholder="Search GIFs..."
              placeholderTextColor={theme.colors.textSecondary}
              value={searchTerm}
              onChangeText={setSearchTerm}
              returnKeyType="search"
            />
            {searchTerm.length > 0 && (
              <TouchableOpacity onPress={() => setSearchTerm('')}>
                <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* GIFs Grid */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
              Loading GIFs...
            </Text>
          </View>
        ) : gifs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="film-outline" size={64} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
              No GIFs found
            </Text>
          </View>
        ) : (
          <FlatList
            data={gifs}
            renderItem={renderGifItem}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={styles.gifGrid}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Footer */}
        <View style={[styles.footer, { 
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border 
        }]}>
          <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
            Powered by Tenor
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  gifGrid: {
    padding: 12,
  },
  gifItem: {
    width: GIF_SIZE,
    height: GIF_SIZE,
    margin: 3,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#E0E0E0',
  },
  gifImage: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    marginTop: 8,
  },
  footer: {
    paddingVertical: 10,
    alignItems: 'center',
    borderTopWidth: 1,
  },
  footerText: {
    fontSize: 11,
  },
});

export default GifPickerModal;
