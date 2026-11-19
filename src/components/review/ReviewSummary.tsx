import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/common/Card';
import { StarRatingInput } from './StarRatingInput';
import { colors } from '@/constants/colors';
import { radii, spacing } from '@/constants/spacing';
import type { RatingSummary } from '@/types/review';

export type ReviewSummaryProps = {
  summary: RatingSummary;
};

export function ReviewSummary({ summary }: ReviewSummaryProps) {
  const { averageRating, totalReviews, ratingDistribution } = summary;
  const stars: (5 | 4 | 3 | 2 | 1)[] = [5, 4, 3, 2, 1];

  return (
    <Card style={styles.card}>
      <View style={styles.scoreSection}>
        <Text style={styles.scoreText}>
          {averageRating !== null && averageRating > 0 ? averageRating.toFixed(1) : '—'}
        </Text>
        <StarRatingInput
          rating={averageRating !== null ? Math.round(averageRating) : 0}
          readOnly
          size={18}
        />
        <Text style={styles.totalText}>
          {totalReviews > 0 ? `${totalReviews} review${totalReviews > 1 ? 's' : ''}` : 'No reviews yet'}
        </Text>
      </View>

      <View style={styles.distributionSection}>
        {stars.map((star) => {
          const count = ratingDistribution?.[star] || 0;
          const percentage = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;

          return (
            <View key={star} style={styles.barRow}>
              <Text style={styles.barStarLabel}>{star} ★</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${percentage}%` }]} />
              </View>
              <Text style={styles.barCountLabel}>{count}</Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.medium,
    gap: spacing.medium,
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: spacing.medium,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    minWidth: 110,
    gap: spacing.xxsmall,
  },
  scoreText: {
    color: colors.primary,
    fontSize: 32,
    fontWeight: '800',
  },
  totalText: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  distributionSection: {
    flex: 1,
    gap: 4,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xsmall,
  },
  barStarLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    width: 24,
  },
  barTrack: {
    flex: 1,
    height: 6,
    backgroundColor: colors.border,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
  },
  barCountLabel: {
    color: colors.muted,
    fontSize: 11,
    width: 24,
    textAlign: 'right',
  },
});
