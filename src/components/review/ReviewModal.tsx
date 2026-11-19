import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { ErrorView } from '@/components/common/ErrorView';
import { Modal } from '@/components/common/Modal';
import { StarRatingInput } from './StarRatingInput';
import { colors } from '@/constants/colors';
import { radii, spacing } from '@/constants/spacing';
import type { Review } from '@/types/review';

export type ReviewModalProps = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: { rating: number; comment?: string }) => Promise<void>;
  hotelName?: string;
  bookingRef?: string;
  initialReview?: Review | null;
  loading?: boolean;
};

export function ReviewModal({
  visible,
  onClose,
  onSubmit,
  hotelName,
  bookingRef,
  initialReview,
  loading = false,
}: ReviewModalProps) {
  const [rating, setRating] = useState<number>(initialReview?.rating || 5);
  const [comment, setComment] = useState<string>(initialReview?.comment || '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setRating(initialReview?.rating || 5);
      setComment(initialReview?.comment || '');
      setError(null);
    }
  }, [visible, initialReview]);

  const handleSubmit = async () => {
    if (rating < 1 || rating > 5) {
      setError('Please select a rating between 1 and 5 stars.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({ rating, comment: comment.trim() });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to submit review. Please try again.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const isEditing = Boolean(initialReview);

  return (
    <Modal
      visible={visible}
      title={isEditing ? 'Edit Your Review' : 'Write a Review'}
      onClose={onClose}
    >
      <View style={styles.content}>
        {hotelName ? (
          <View style={styles.hotelInfo}>
            <Text style={styles.hotelName}>{hotelName}</Text>
            {bookingRef ? <Text style={styles.bookingRef}>Booking ID: {bookingRef}</Text> : null}
          </View>
        ) : null}

        <View style={styles.ratingSection}>
          <Text style={styles.ratingLabel}>Your Rating</Text>
          <StarRatingInput
            rating={rating}
            onRatingChange={setRating}
            size={36}
            accessibilityLabel="Select review star rating"
          />
        </View>

        <View style={styles.commentSection}>
          <View style={styles.commentHeader}>
            <Text style={styles.commentLabel}>Review (Optional)</Text>
            <Text style={styles.charCount}>{comment.length} / 1000</Text>
          </View>
          <TextInput
            multiline
            numberOfLines={4}
            maxLength={1000}
            value={comment}
            onChangeText={setComment}
            placeholder="Share details of your experience, rooms, amenities, and service..."
            placeholderTextColor={colors.muted}
            style={styles.textInput}
          />
        </View>

        {error ? <ErrorView message={error} /> : null}

        <View style={styles.actions}>
          <Button
            title="Cancel"
            variant="outline"
            onPress={onClose}
            disabled={submitting || loading}
          />
          <Button
            title={submitting ? 'Submitting…' : isEditing ? 'Save Changes' : 'Submit Review'}
            onPress={() => void handleSubmit()}
            loading={submitting || loading}
            disabled={submitting || loading}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.medium,
  },
  hotelInfo: {
    paddingBottom: spacing.small,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 2,
  },
  hotelName: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  bookingRef: {
    color: colors.muted,
    fontSize: 12,
  },
  ratingSection: {
    alignItems: 'center',
    gap: spacing.xsmall,
    paddingVertical: spacing.small,
  },
  ratingLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  commentSection: {
    gap: spacing.xxsmall,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  commentLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  charCount: {
    color: colors.muted,
    fontSize: 11,
  },
  textInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.medium,
    padding: spacing.medium,
    fontSize: 14,
    color: colors.text,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.small,
    marginTop: spacing.small,
  },
});
