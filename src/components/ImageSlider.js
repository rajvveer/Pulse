import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Dimensions,
  Pressable,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ImageSlider = ({ 
  images = [], 
  onImagePress, 
  containerWidth = SCREEN_WIDTH - 32,
  height = 400 
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef(null);

  const hasMultipleImages = images.length > 1;

  const onViewRef = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index || 0);
    }
  });

  const viewConfigRef = useRef({ viewAreaCoveragePercentThreshold: 50 });

  const scrollToIndex = useCallback((index) => {
    flatListRef.current?.scrollToIndex({
      index,
      animated: true,
    });
  }, []);

  const renderItem = useCallback(({ item, index }) => (
    <Pressable
      onPress={() => onImagePress?.(item, index)}
      style={[styles.imageSlide, { width: containerWidth }]}
    >
      <Image
        source={{ uri: item.url }}
        style={[styles.image, { width: containerWidth, height }]}
        resizeMode="cover"
      />
    </Pressable>
  ), [containerWidth, height, onImagePress]);

  const getItemLayout = useCallback((data, index) => ({
    length: containerWidth,
    offset: containerWidth * index,
    index,
  }), [containerWidth]);

  if (!images || images.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={images}
        renderItem={renderItem}
        keyExtractor={(item, index) => `image-${item.url}-${index}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewRef.current}
        viewabilityConfig={viewConfigRef.current}
        getItemLayout={getItemLayout}
        decelerationRate="fast"
        snapToInterval={containerWidth}
        snapToAlignment="center"
        removeClippedSubviews={true}
        maxToRenderPerBatch={3}
        windowSize={5}
        initialNumToRender={1}
      />

      {/* Counter Badge */}
      {hasMultipleImages && (
        <View style={[styles.imageCounter, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
          <Ionicons name="images" size={12} color="#FFF" />
          <Text style={styles.imageCounterText}>
            {activeIndex + 1}/{images.length}
          </Text>
        </View>
      )}

      {/* Pagination Dots */}
      {hasMultipleImages && (
        <View style={styles.pagination}>
          {images.map((_, index) => (
            <TouchableOpacity
              key={`dot-${index}`}
              onPress={() => scrollToIndex(index)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.paginationDot,
                  {
                    backgroundColor: index === activeIndex 
                      ? '#FFF' 
                      : 'rgba(255,255,255,0.5)',
                    width: index === activeIndex ? 20 : 6,
                  }
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
  },
  imageSlide: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    backgroundColor: '#E0E0E0',
  },
  imageCounter: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  imageCounterText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  pagination: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  paginationDot: {
    height: 6,
    borderRadius: 3,
  },
});

export default ImageSlider;