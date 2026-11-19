import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent, ListRenderItemInfo } from 'react-native';
import { Image } from 'expo-image';

import { colors } from '@/constants/colors';
import { radii } from '@/constants/spacing';

export type HotelImageSource = { uri: string; alt: string };
export type HotelImageGalleryProps = {
  images: HotelImageSource[];
  height?: number;
  accessibilityLabel?: string;
  onIndexChange?: (index: number) => void;
};

export function HotelImageGallery({
  images,
  height = 220,
  accessibilityLabel = 'Hotel photos',
  onIndexChange,
}: HotelImageGalleryProps) {
  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const handleLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  const handleScroll = (event: { nativeEvent: { contentOffset: { x: number } } }) => {
    if (!width) return;
    const nextIndex = Math.min(images.length - 1, Math.max(0, Math.round(event.nativeEvent.contentOffset.x / width)));
    if (nextIndex !== activeIndex) {
      setActiveIndex(nextIndex);
      onIndexChange?.(nextIndex);
    }
  };

  const renderItem = ({ item }: ListRenderItemInfo<HotelImageSource>) => failedImages[item.uri] ? (
    <View accessibilityLabel="Photo unavailable" style={[styles.imageFallback, { width, height }]}><Text style={styles.emptyGlyph}>⌂</Text><Text style={styles.emptyText}>Photo unavailable</Text></View>
  ) : (
    <Image accessibilityLabel={item.alt} contentFit="cover" source={{ uri: item.uri }} style={{ width, height }} transition={180} onError={() => setFailedImages((current) => ({ ...current, [item.uri]: true }))} />
  );

  return (
    <View accessibilityLabel={accessibilityLabel} onLayout={handleLayout} style={[styles.container, { height }]}>
      {images.length ? (
        <>
          <FlatList
            data={images}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item, index) => `${item.uri}-${index}`}
            renderItem={renderItem}
            onMomentumScrollEnd={handleScroll}
            getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          />
          {images.length > 1 ? (
            <View accessibilityElementsHidden style={styles.pagination}>
              {images.map((image, index) => (
                <View key={`${image.uri}-dot-${index}`} style={[styles.dot, index === activeIndex && styles.activeDot]} />
              ))}
            </View>
          ) : null}
        </>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyGlyph}>⌂</Text>
          <Text style={styles.emptyText}>No photos available</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', overflow: 'hidden', borderRadius: radii.large, backgroundColor: colors.background },
  pagination: { position: 'absolute', right: 0, bottom: 12, left: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.65)' },
  activeDot: { width: 18, backgroundColor: colors.surface },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  imageFallback: { alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.background },
  emptyGlyph: { color: colors.muted, fontSize: 30 },
  emptyText: { color: colors.muted, fontSize: 13 },
});
