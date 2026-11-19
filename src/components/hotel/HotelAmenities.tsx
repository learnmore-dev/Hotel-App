import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/colors';
import { radii, spacing } from '@/constants/spacing';

export type AmenityItem = { id: string; label: string; icon?: ReactNode };
export type HotelAmenitiesProps = {
  amenities: AmenityItem[];
  maxVisible?: number;
  compact?: boolean;
};

export function HotelAmenities({ amenities, maxVisible, compact = false }: HotelAmenitiesProps) {
  const visibleAmenities = maxVisible === undefined ? amenities : amenities.slice(0, maxVisible);
  const hiddenCount = amenities.length - visibleAmenities.length;
  return (
    <View accessibilityLabel="Hotel amenities" style={styles.container}>
      {visibleAmenities.map((amenity) => (
        <View key={amenity.id} style={[styles.item, compact && styles.compactItem]}>
          {amenity.icon ?? <View style={styles.bullet} />}
          <Text numberOfLines={1} style={styles.label}>
            {amenity.label}
          </Text>
        </View>
      ))}
      {hiddenCount > 0 ? <Text style={styles.more}>+{hiddenCount} more</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xsmall },
  item: { maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: spacing.xxsmall, paddingHorizontal: spacing.small, paddingVertical: spacing.xsmall, borderRadius: radii.pill, backgroundColor: colors.background },
  compactItem: { paddingHorizontal: spacing.xsmall, paddingVertical: spacing.xxsmall },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  label: { flexShrink: 1, color: colors.text, fontSize: 12 },
  more: { color: colors.primary, fontSize: 12, fontWeight: '700' },
});
