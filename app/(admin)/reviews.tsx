import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorView } from '@/components/common/ErrorView';
import { Loader } from '@/components/common/Loader';
import { Modal } from '@/components/common/Modal';
import { StarRatingInput } from '@/components/review/StarRatingInput';
import { colors } from '@/constants/colors';
import { radii, spacing } from '@/constants/spacing';
import * as reviewApi from '@/services/api/reviewApi';
import type { Review } from '@/types/review';

type StatusFilter = 'ALL' | 'PUBLISHED' | 'HIDDEN';

export default function AdminReviewsScreen() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [ratingFilter, setRatingFilter] = useState<number | undefined>(undefined);

  // Moderation Modal State
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [moderationReason, setModerationReason] = useState('');
  const [targetPublished, setTargetPublished] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const fetchReviews = useCallback(async () => {
    try {
      setError(null);
      const isPublishedParam =
        statusFilter === 'PUBLISHED' ? true : statusFilter === 'HIDDEN' ? false : undefined;

      const res = await reviewApi.getAdminReviews({
        isPublished: isPublishedParam,
        rating: ratingFilter,
        limit: 50,
      });

      setReviews(res.reviews);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to load reviews';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, ratingFilter]);

  useEffect(() => {
    setLoading(true);
    void fetchReviews();
  }, [fetchReviews]);

  const onRefresh = () => {
    setRefreshing(true);
    void fetchReviews();
  };

  const handleOpenModeration = (review: Review, nextPublished: boolean) => {
    setSelectedReview(review);
    setTargetPublished(nextPublished);
    setModerationReason('');
    setModalVisible(true);
  };

  const handleConfirmModeration = async () => {
    if (!selectedReview) return;

    setSubmitting(true);
    try {
      await reviewApi.moderateReview(selectedReview.id, {
        isPublished: targetPublished,
        reason: moderationReason.trim() || undefined,
      });

      setModalVisible(false);
      void fetchReviews();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update review moderation status';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const statusTabs: StatusFilter[] = ['ALL', 'PUBLISHED', 'HIDDEN'];

  const renderReviewItem = ({ item }: { item: Review }) => {
    const formattedDate = item.createdAt
      ? new Date(item.createdAt).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : '';

    const isPublished = item.isPublished !== false;

    return (
      <Card style={styles.reviewCard}>
        <View style={styles.cardHeader}>
          <View style={styles.authorMeta}>
            <Text style={styles.authorName}>{item.customer?.fullName || 'Verified Guest'}</Text>
            {item.customer?.email ? (
              <Text style={styles.authorEmail}>{item.customer.email}</Text>
            ) : null}
            <Text style={styles.hotelLabel}>Hotel: {item.hotel?.name || 'Hotel Stay'}</Text>
          </View>
          <View style={styles.badgeSection}>
            <Badge
              label={isPublished ? 'Published' : 'Hidden'}
              tone={isPublished ? 'success' : 'error'}
            />
            <Text style={styles.dateText}>{formattedDate}</Text>
          </View>
        </View>

        <StarRatingInput rating={item.rating} readOnly size={16} />

        {item.comment ? (
          <Text style={styles.commentText}>{item.comment}</Text>
        ) : (
          <Text style={styles.noCommentText}>No written review comment.</Text>
        )}

        <View style={styles.cardActions}>
          {isPublished ? (
            <Button
              title="Hide Review"
              variant="outline"
              size="small"
              onPress={() => handleOpenModeration(item, false)}
            />
          ) : (
            <Button
              title="Publish Review"
              size="small"
              onPress={() => handleOpenModeration(item, true)}
            />
          )}
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>
            Reviews Moderation
          </Text>
          <Text style={styles.subtitle}>Audit, hide, or restore customer hotel reviews</Text>
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterRow}>
          {statusTabs.map((tab) => {
            const isSelected = statusFilter === tab;
            return (
              <Pressable
                key={tab}
                onPress={() => setStatusFilter(tab)}
                style={[styles.filterChip, isSelected && styles.filterChipSelected]}
              >
                <Text
                  style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}
                >
                  {tab === 'ALL' ? 'All' : tab === 'PUBLISHED' ? 'Published' : 'Hidden'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {error ? <ErrorView message={error} onRetry={() => void fetchReviews()} /> : null}

        {loading && !refreshing ? (
          <Loader label="Loading reviews…" />
        ) : (
          <FlatList
            data={reviews}
            keyExtractor={(item) => item.id}
            renderItem={renderReviewItem}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={
              <EmptyState
                title="No reviews found"
                description="No reviews matched your selected status filter."
              />
            }
          />
        )}
      </View>

      {/* Moderation Confirmation Modal */}
      <Modal
        visible={modalVisible}
        title={targetPublished ? 'Restore / Publish Review' : 'Hide Review from Public'}
        onClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalDescription}>
            {targetPublished
              ? 'This review will be published and restored to the hotel page. The hotel rating score will be updated.'
              : 'This review will be hidden from public view and excluded from the hotel rating score.'}
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Moderation Reason (Optional)</Text>
            <TextInput
              multiline
              numberOfLines={3}
              value={moderationReason}
              onChangeText={setModerationReason}
              placeholder="e.g. Inappropriate language, policy violation, spam, etc."
              placeholderTextColor={colors.muted}
              style={styles.reasonInput}
            />
          </View>

          <View style={styles.modalActions}>
            <Button
              title="Cancel"
              variant="outline"
              onPress={() => setModalVisible(false)}
              disabled={submitting}
            />
            <Button
              title={submitting ? 'Updating…' : targetPublished ? 'Confirm Publish' : 'Confirm Hide'}
              variant={targetPublished ? 'primary' : 'danger'}
              loading={submitting}
              disabled={submitting}
              onPress={() => void handleConfirmModeration()}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    padding: spacing.medium,
    gap: spacing.medium,
  },
  header: {
    gap: 4,
  },
  title: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.xsmall,
  },
  filterChip: {
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.xsmall,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  filterChipTextSelected: {
    color: colors.surface,
  },
  listContent: {
    gap: spacing.medium,
    paddingBottom: spacing.xxlarge,
  },
  reviewCard: {
    padding: spacing.medium,
    gap: spacing.small,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  authorMeta: {
    gap: 2,
    flex: 1,
  },
  authorName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  authorEmail: {
    color: colors.muted,
    fontSize: 12,
  },
  hotelLabel: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  badgeSection: {
    alignItems: 'flex-end',
    gap: 4,
  },
  dateText: {
    color: colors.muted,
    fontSize: 11,
  },
  commentText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  noCommentText: {
    color: colors.muted,
    fontSize: 13,
    fontStyle: 'italic',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.xxsmall,
  },
  modalContent: {
    gap: spacing.medium,
  },
  modalDescription: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  inputGroup: {
    gap: spacing.xxsmall,
  },
  inputLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  reasonInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.medium,
    padding: spacing.medium,
    fontSize: 14,
    color: colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.small,
    marginTop: spacing.small,
  },
});
