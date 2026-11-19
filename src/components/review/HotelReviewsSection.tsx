import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorView } from '@/components/common/ErrorView';
import { Loader } from '@/components/common/Loader';
import { colors } from '@/constants/colors';
import { radii, spacing } from '@/constants/spacing';
import { getHotelReviews } from '@/services/api/reviewApi';
import type { HotelReviewsData, Review } from '@/types/review';
import { ReviewCard } from './ReviewCard';
import { ReviewSummary } from './ReviewSummary';

export type HotelReviewsSectionProps = {
  hotelId: string;
};

export function HotelReviewsSection({ hotelId }: HotelReviewsSectionProps) {
  const [data, setData] = useState<HotelReviewsData | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRating, setSelectedRating] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  
const loadReviews = useCallback(
  async (targetPage = 1, ratingFilter = selectedRating, append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setError(null);
    }

    try {
      console.log('[HotelReviews] Hotel ID:', hotelId);

      const result = await getHotelReviews(hotelId, {
        page: targetPage,
        limit: 5,
        rating: ratingFilter,
      });

      console.log('[HotelReviews] API result:', result);
      console.log('[HotelReviews] Total reviews:', result?.pagination?.total);
      console.log('[HotelReviews] Reviews received:', result?.reviews?.length);

      setData(result);
      setPage(result.pagination.page);
      setTotalPages(result.pagination.totalPages);

      if (append) {
        setReviews((prev) => [...prev, ...result.reviews]);
      } else {
        setReviews(result.reviews);
      }
    } catch (err: unknown) {
      console.log('[HotelReviews] API error:', err);
      const msg = err instanceof Error ? err.message : 'Unable to load reviews.';
      setError(msg);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  },
  [hotelId, selectedRating],
);


  useEffect(() => {
    void loadReviews(1, selectedRating, false);
  }, [loadReviews, selectedRating]);

  const handleRatingFilter = (rating?: number) => {
    setSelectedRating(rating);
  };

  const handleLoadMore = () => {
    if (page < totalPages && !loadingMore) {
      void loadReviews(page + 1, selectedRating, true);
    }
  };

  const filterTabs = [
    { label: 'All', value: undefined },
    { label: '5 ★', value: 5 },
    { label: '4 ★', value: 4 },
    { label: '3 ★', value: 3 },
    { label: '2 ★', value: 2 },
    { label: '1 ★', value: 1 },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Guest Reviews</Text>

      {error ? (
        <ErrorView message={error} onRetry={() => void loadReviews(1, selectedRating, false)} />
      ) : null}

      {data?.summary ? (
        <ReviewSummary summary={data.summary} />
      ) : null}

      {/* Star filter tabs */}
      <View style={styles.filterRow}>
        {filterTabs.map((tab) => {
          const isSelected = selectedRating === tab.value;
          return (
            <Pressable
              key={tab.label}
              onPress={() => handleRatingFilter(tab.value)}
              style={[styles.filterChip, isSelected && styles.filterChipSelected]}
            >
              <Text
                style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading && !loadingMore ? (
        <Loader label="Loading reviews…" />
      ) : reviews.length > 0 ? (
        <View style={styles.reviewList}>
          {reviews.map((rev) => (
            <ReviewCard key={rev.id} review={rev} />
          ))}

          {page < totalPages ? (
            <Button
              title={loadingMore ? 'Loading…' : 'Load More Reviews'}
              variant="outline"
              loading={loadingMore}
              onPress={handleLoadMore}
            />
          ) : null}
        </View>
      ) : (
        <EmptyState
          title={selectedRating ? `No ${selectedRating}-star reviews` : 'No reviews yet'}
          description={
            selectedRating
              ? 'Try selecting a different rating filter.'
              : 'Be the first guest to share your experience!'
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.medium,
    marginTop: spacing.small,
  },
  sectionTitle: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: '800',
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.xsmall,
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.xxsmall,
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
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipTextSelected: {
    color: colors.surface,
  },
  reviewList: {
    gap: spacing.medium,
  },
});
