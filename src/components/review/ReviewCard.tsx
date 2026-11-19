import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { StarRatingInput } from './StarRatingInput';
import { colors } from '@/constants/colors';
import { radii, spacing } from '@/constants/spacing';
import type { Review } from '@/types/review';

export type ReviewCardProps = {
  review: Review;
  onEdit?: () => void;
  onDelete?: () => void;
  canManage?: boolean;
};

export function ReviewCard({ review, onEdit, onDelete, canManage = false }: ReviewCardProps) {
  const formattedDate = review.createdAt
    ? new Date(review.createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '';

  const initial = (review.customer.fullName || 'G').charAt(0).toUpperCase();

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.authorRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.authorMeta}>
            <Text style={styles.authorName}>{review.customer.fullName || 'Verified Guest'}</Text>
            <Text style={styles.reviewDate}>{formattedDate}</Text>
          </View>
        </View>

        <StarRatingInput rating={review.rating} readOnly size={16} />
      </View>

      {review.hotel?.name ? (
        <Text style={styles.hotelName}>Stay at {review.hotel.name}</Text>
      ) : null}

      {review.comment ? (
        <Text style={styles.comment}>{review.comment}</Text>
      ) : (
        <Text style={styles.emptyComment}>No written comment provided.</Text>
      )}

      {review.isPublished === false ? (
        <View style={styles.hiddenBanner}>
          <Text style={styles.hiddenText}>This review is hidden by moderation</Text>
        </View>
      ) : null}

      {canManage && (onEdit || onDelete) ? (
        <View style={styles.actions}>
          {onEdit ? (
            <Button title="Edit" variant="outline" size="small" onPress={onEdit} />
          ) : null}
          {onDelete ? (
            <Button title="Delete" variant="danger" size="small" onPress={onDelete} />
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.small,
    padding: spacing.medium,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '700',
  },
  authorMeta: {
    gap: 2,
  },
  authorName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  reviewDate: {
    color: colors.muted,
    fontSize: 12,
  },
  hotelName: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  comment: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyComment: {
    color: colors.muted,
    fontSize: 13,
    fontStyle: 'italic',
  },
  hiddenBanner: {
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.xxsmall,
    backgroundColor: colors.errorSubtle,
    borderRadius: radii.small,
    alignSelf: 'flex-start',
  },
  hiddenText: {
    color: colors.error,
    fontSize: 12,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.small,
    marginTop: spacing.xxsmall,
  },
});
