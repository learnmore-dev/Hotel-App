import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useState } from 'react';

import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Divider } from '@/components/common/Divider';
import { formatCurrency } from '@/utils/currency';

export type RoomCardProps = {
  name: string;
  description?: string;
  capacity?: string;
  amenities?: string[];
  images?: string[];
  price: number;
  currency?: string;
  priceCaption?: string;
  selected?: boolean;
  actionLabel?: string;
  onSelect?: () => void;
};

export function RoomCard({
  name,
  description,
  capacity,
  amenities = [],
  images = [],
  price,
  currency = '',
  priceCaption = 'per night',
  selected = false,
  actionLabel = selected ? 'Selected' : 'Select room',
  onSelect,
}: RoomCardProps) {
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  return (
    <Card padding="medium">
      <View style={styles.header}>
        <View style={styles.copy}>
          <Text style={styles.name}>{name}</Text>
          {description ? <Text style={styles.description}>{description}</Text> : null}
          {capacity ? <Text style={styles.capacity}>{capacity}</Text> : null}
        </View>
        <View style={styles.priceBlock}>
          <Text style={styles.price}>{formatCurrency(price, { currency: currency || undefined, minimumFractionDigits: 0, maximumFractionDigits: 2 })}</Text>
          <Text style={styles.caption}>{priceCaption}</Text>
        </View>
      </View>
      {amenities.length ? (
        <>
          <Divider inset={spacing.medium} />
          <View style={styles.amenities}>
            {amenities.map((amenity) => <Text key={amenity} style={styles.amenity}>• {amenity}</Text>)}
          </View>
        </>
      ) : null}
      {images.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.images}>{images.map((uri, index) => failedImages[uri] ? <View key={`${uri}-${index}`} style={[styles.image, styles.imageFallback]}><Text style={styles.fallbackText}>Photo unavailable</Text></View> : <Image key={`${uri}-${index}`} source={{ uri }} accessibilityLabel={`${name} room photo ${index + 1}`} contentFit="cover" style={styles.image} transition={150} onError={() => setFailedImages((current) => ({ ...current, [uri]: true }))} />)}</ScrollView> : null}
      {onSelect ? <Button title={actionLabel} onPress={onSelect} variant={selected ? 'secondary' : 'outline'} fullWidth /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.small },
  copy: { flex: 1, minWidth: 0, gap: spacing.xsmall },
  name: { color: colors.text, fontSize: 17, fontWeight: '700' },
  description: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  capacity: { color: colors.text, fontSize: 13, fontWeight: '600' },
  priceBlock: { alignItems: 'flex-end' },
  price: { color: colors.primary, fontSize: 17, fontWeight: '800' },
  caption: { color: colors.muted, fontSize: 12 },
  amenities: { gap: spacing.xsmall, marginBottom: spacing.medium },
  images: { gap: spacing.xsmall },
  image: { width: 112, height: 76, borderRadius: 10, backgroundColor: colors.background },
  imageFallback: { alignItems: 'center', justifyContent: 'center', padding: spacing.xsmall },
  fallbackText: { color: colors.muted, fontSize: 11, textAlign: 'center' },
  amenity: { color: colors.text, fontSize: 13 },
});
