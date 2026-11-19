import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';

export type HotelRatingProps = {
  rating: number;
  reviewCount?: number;
  accessibilityLabel?: string;
};

export function HotelRating({ rating, reviewCount, accessibilityLabel }: HotelRatingProps) {
  const label = accessibilityLabel ?? `Rated ${rating.toFixed(1)} out of 5${reviewCount === undefined ? '' : `, ${reviewCount} reviews`}`;
  return (
    <View accessibilityRole="text" accessibilityLabel={label} style={styles.container}>
      <Text style={styles.star}>★</Text>
      <Text style={styles.rating}>{rating.toFixed(1)}</Text>
      {reviewCount !== undefined ? <Text style={styles.count}>({reviewCount.toLocaleString()})</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxxsmall },
  star: { color: colors.accent, fontSize: 16 },
  rating: { color: colors.text, fontSize: 14, fontWeight: '700' },
  count: { color: colors.muted, fontSize: 13 },
});
