import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useLocalSearchParams } from 'expo-router';

import { BookingSummary } from '@/components/booking/BookingSummary';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Divider } from '@/components/common/Divider';
import { ErrorView } from '@/components/common/ErrorView';
import { Input } from '@/components/common/Input';
import { Loader } from '@/components/common/Loader';
import { Modal } from '@/components/common/Modal';
import { ReviewModal } from '@/components/review/ReviewModal';
import { colors } from '@/constants/colors';
import { radii, spacing } from '@/constants/spacing';
import { cancelBooking, getBookingById } from '@/services/api/bookingApi';
import { checkReviewEligibility, createReview, updateReview } from '@/services/api/reviewApi';
import type { Booking, BookingStatus } from '@/types/booking';
import { formatCurrency } from '@/utils/currency';
import type { ReviewEligibility } from '@/types/review';

function getStatusBadgeTone(status: BookingStatus): 'success' | 'error' | 'gold' | 'neutral' {
  switch (status) {
    case 'CONFIRMED':
    case 'COMPLETED':
      return 'success';
    case 'CANCELLED':
      return 'error';
    case 'PENDING':
    default:
      return 'gold';
  }
}

export default function CustomerBookingDetailScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cancellation modal state
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Review modal state
  const [reviewEligibility, setReviewEligibility] = useState<ReviewEligibility | null>(null);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    if (!bookingId) return;

    setLoading(true);
    setError(null);
    getBookingById(bookingId)
      .then((data) => {
        if (active) {
          setBooking(data);
          void checkReviewEligibility(data.id)
            .then((res) => {
              if (active) setReviewEligibility(res);
            })
            .catch(() => undefined);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          const msg = err instanceof Error ? err.message : 'Unable to load booking details.';
          setError(msg);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [bookingId]);

  const handleReviewSubmit = async (input: { rating: number; comment?: string }) => {
    if (!booking) return;
    setReviewSubmitting(true);
    try {
      if (reviewEligibility?.alreadyReviewed && reviewEligibility.existingReview?.id) {
        const updated = await updateReview(reviewEligibility.existingReview.id, input);
        setReviewEligibility((prev) =>
          prev ? { ...prev, existingReview: updated } : null,
        );
        Alert.alert('Review Updated', 'Thank you! Your review has been updated.');
      } else {
        const created = await createReview({
          bookingId: booking.id,
          rating: input.rating,
          comment: input.comment,
        });
        setReviewEligibility({
          eligible: false,
          alreadyReviewed: true,
          existingReview: created,
        });
        Alert.alert('Review Submitted', 'Thank you! Your review has been submitted.');
      }
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleCancelReservation = async () => {
    if (!booking) return;
    setCancelling(true);

    try {
      const updated = await cancelBooking(booking.id, cancellationReason);
      setBooking(updated);
      setCancelModalVisible(false);
      setCancellationReason('');
      Alert.alert('Reservation Cancelled', 'Your reservation has been cancelled.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to cancel booking right now.';
      Alert.alert('Cancellation Failed', msg);
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Booking Details' }} />
        <Loader fullScreen label="Loading reservation details…" />
      </>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe}>
        <Stack.Screen options={{ title: 'Booking Details' }} />
        <ErrorView
          message={error}
          onRetry={() => {
            setError(null);
            setLoading(true);
            if (bookingId) {
              void getBookingById(bookingId)
                .then(setBooking)
                .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to reload'))
                .finally(() => setLoading(false));
            }
          }}
        />
      </SafeAreaView>
    );
  }

  if (!booking) return null;

  const isCancelled = booking.bookingStatus === 'CANCELLED';
  const isCompleted = booking.bookingStatus === 'COMPLETED';
  const canCancel = !isCancelled && !isCompleted;

  const checkIn = booking.checkIn ? String(booking.checkIn).slice(0, 10) : '—';
  const checkOut = booking.checkOut ? String(booking.checkOut).slice(0, 10) : '—';
  const hotelName = booking.hotel?.name || 'Hotel';
  const hotelAddress = booking.hotel?.address || '';
  const hotelCity = booking.hotel?.city || '';
  const roomType = booking.room?.roomType || 'Room';
  const guestName = booking.guestDetails?.fullName || booking.customer?.fullName || '—';
  const guestEmail = booking.guestDetails?.email || booking.customer?.email || '—';
  const guestPhone = booking.guestDetails?.phone || booking.customer?.phone || '—';

  const roomPriceNum = Number(booking.roomPrice);
  const taxNum = Number(booking.taxAmount);
  const discountNum = Number(booking.discountAmount);
  const totalNum = Number(booking.totalAmount);

  const currency = booking.currency || 'INR';

  const summaryLines = [
    {
      id: 'rate',
      label: `Room rate (${booking.numberOfNights} night${booking.numberOfNights > 1 ? 's' : ''})`,
      value: formatCurrency(roomPriceNum * booking.numberOfNights, currency),
    },
    {
      id: 'rooms',
      label: `Rooms count`,
      value: `× ${booking.roomsCount}`,
    },
    {
      id: 'tax',
      label: 'Taxes & fees',
      value: formatCurrency(taxNum, currency),
      subdued: true,
    },
    {
      id: 'discount',
      label: 'Discount',
      value: formatCurrency(discountNum, currency),
      subdued: true,
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: booking.bookingId ? `Booking #${booking.bookingId}` : 'Booking Details',
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Top Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>BOOKING REFERENCE</Text>
            <Text accessibilityRole="header" style={styles.bookingIdText}>
              {booking.bookingId}
            </Text>
            <Text style={styles.createdDate}>
              Booked on: {new Date(booking.createdAt).toLocaleDateString()}
            </Text>
          </View>
          <View style={styles.statusBadges}>
            <Badge label={booking.bookingStatus} tone={getStatusBadgeTone(booking.bookingStatus)} />
            <Badge
              label={`Pay: ${booking.paymentStatus}`}
              tone={
                booking.paymentStatus === 'PAID'
                  ? 'success'
                  : booking.paymentStatus === 'FAILED'
                    ? 'error'
                    : 'neutral'
              }
            />
          </View>
        </View>

        {/* Cancellation Notice if Cancelled */}
        {isCancelled ? (
          <View style={styles.cancellationBanner}>
            <Text style={styles.cancellationTitle}>Reservation Cancelled</Text>
            <Text style={styles.cancellationDate}>
              Cancelled on: {booking.cancelledAt ? new Date(booking.cancelledAt).toLocaleString() : '—'}
            </Text>
            {booking.cancellationReason ? (
              <Text style={styles.cancellationReason}>Reason: {booking.cancellationReason}</Text>
            ) : null}
          </View>
        ) : null}

        {/* Hotel & Stay Information */}
        <Card padding="medium">
          <Text style={styles.sectionHeader}>Stay Details</Text>
          <Text style={styles.hotelTitle}>{hotelName}</Text>
          <Text style={styles.hotelSub}>
            {hotelAddress}, {hotelCity}
          </Text>

          <Divider inset={spacing.small} />

          <View style={styles.stayGrid}>
            <View style={styles.stayItem}>
              <Text style={styles.stayMetaLabel}>CHECK-IN</Text>
              <Text style={styles.stayMetaVal}>{checkIn}</Text>
              <Text style={styles.stayTime}>Check-in: {booking.hotel?.checkInTime ?? 'After 2:00 PM'}</Text>
            </View>
            <View style={styles.stayItem}>
              <Text style={styles.stayMetaLabel}>CHECK-OUT</Text>
              <Text style={styles.stayMetaVal}>{checkOut}</Text>
              <Text style={styles.stayTime}>Check-out: {booking.hotel?.checkOutTime ?? 'Before 11:00 AM'}</Text>
            </View>
          </View>

          <Divider inset={spacing.small} />

          <View style={styles.roomRow}>
            <View>
              <Text style={styles.roomName}>{roomType}</Text>
              <Text style={styles.roomOccupancy}>
                {booking.roomsCount} room · {booking.guestsCount} guests
                {booking.room?.bedType ? ` · ${booking.room.bedType}` : ''}
              </Text>
            </View>
          </View>
        </Card>

        {/* Guest Information */}
        <Card padding="medium">
          <Text style={styles.sectionHeader}>Guest Details</Text>
          <View style={styles.guestRow}>
            <Text style={styles.guestLabel}>Primary Guest</Text>
            <Text style={styles.guestVal}>{guestName}</Text>
          </View>
          <View style={styles.guestRow}>
            <Text style={styles.guestLabel}>Email Address</Text>
            <Text style={styles.guestVal}>{guestEmail}</Text>
          </View>
          <View style={styles.guestRow}>
            <Text style={styles.guestLabel}>Phone Number</Text>
            <Text style={styles.guestVal}>{guestPhone}</Text>
          </View>
          {booking.specialRequests ? (
            <View style={styles.guestRow}>
              <Text style={styles.guestLabel}>Special Requests</Text>
              <Text style={styles.guestVal}>{booking.specialRequests}</Text>
            </View>
          ) : null}
        </Card>

        {/* Price Breakdown */}
        <BookingSummary
          title="Payment Details"
          lines={summaryLines}
          total={formatCurrency(totalNum, currency)}
          totalLabel="Total amount"
          note={`Payment status: ${booking.paymentStatus}`}
        />

        {/* Review Action */}
        {reviewEligibility?.eligible ? (
          <Button
            title="★ Write a Review"
            onPress={() => setReviewModalVisible(true)}
            fullWidth
          />
        ) : reviewEligibility?.alreadyReviewed ? (
          <Button
            title="★ View / Edit Your Review"
            variant="outline"
            onPress={() => setReviewModalVisible(true)}
            fullWidth
          />
        ) : null}

        {/* Cancellation Action */}
        {canCancel ? (
          <Button
            title="Cancel this reservation"
            variant="danger"
            onPress={() => setCancelModalVisible(true)}
            fullWidth
          />
        ) : null}

        <Button
          title="Back to My Bookings"
          variant="outline"
          onPress={() => router.replace('/(customer)/bookings')}
          fullWidth
        />
      </ScrollView>

      {/* Write / Edit Review Modal */}
      <ReviewModal
        visible={reviewModalVisible}
        onClose={() => setReviewModalVisible(false)}
        onSubmit={handleReviewSubmit}
        hotelName={hotelName}
        bookingRef={booking.bookingId}
        initialReview={reviewEligibility?.existingReview}
        loading={reviewSubmitting}
      />

      {/* Cancellation Modal */}
      <Modal
        visible={cancelModalVisible}
        title="Cancel Reservation"
        onClose={() => setCancelModalVisible(false)}>
        <View style={styles.modalBody}>
          <Text style={styles.modalText}>
            Are you sure you want to cancel your reservation at {hotelName}? Once cancelled, your room will be released.
          </Text>

          <Input
            label="Reason for cancellation (optional)"
            value={cancellationReason}
            onChangeText={setCancellationReason}
            placeholder="Change of plans, found alternate, etc."
            returnKeyType="done"
          />

          <View style={styles.modalActions}>
            <Button
              title="Keep Reservation"
              variant="outline"
              onPress={() => setCancelModalVisible(false)}
            />
            <Button
              title={cancelling ? 'Cancelling…' : 'Confirm Cancellation'}
              variant="danger"
              loading={cancelling}
              disabled={cancelling}
              onPress={() => void handleCancelReservation()}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.medium, gap: spacing.medium, paddingBottom: spacing.xxlarge },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerCopy: { gap: 2 },
  kicker: { color: colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  bookingIdText: { color: colors.primary, fontSize: 20, fontWeight: '800' },
  createdDate: { color: colors.muted, fontSize: 11, marginTop: 2 },
  statusBadges: { flexDirection: 'row', gap: spacing.xsmall },
  cancellationBanner: {
    padding: spacing.medium,
    borderRadius: radii.medium,
    backgroundColor: colors.errorSubtle,
    borderWidth: 1,
    borderColor: colors.error,
    gap: 4,
  },
  cancellationTitle: { color: colors.error, fontSize: 15, fontWeight: '800' },
  cancellationDate: { color: colors.text, fontSize: 13 },
  cancellationReason: { color: colors.muted, fontSize: 13, fontStyle: 'italic' },
  sectionHeader: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: spacing.small },
  hotelTitle: { color: colors.primary, fontSize: 18, fontWeight: '800' },
  hotelSub: { color: colors.muted, fontSize: 13 },
  stayGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  stayItem: { flex: 1, gap: 2 },
  stayMetaLabel: { color: colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  stayMetaVal: { color: colors.text, fontSize: 14, fontWeight: '700' },
  stayTime: { color: colors.muted, fontSize: 11 },
  roomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  roomName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  roomOccupancy: { color: colors.muted, fontSize: 13, marginTop: 2 },
  guestRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xxsmall },
  guestLabel: { color: colors.muted, fontSize: 13 },
  guestVal: { color: colors.text, fontSize: 13, fontWeight: '600' },
  modalBody: { gap: spacing.medium },
  modalText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.small, marginTop: spacing.small },
});
