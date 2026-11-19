import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { BookingSuccess } from '@/components/booking/BookingSuccess';
import { Badge, type BadgeTone } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Loader } from '@/components/common/Loader';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import * as bookingApi from '@/services/api/bookingApi';
import * as paymentApi from '@/services/api/paymentApi';
import { useBookingStore } from '@/store/bookingStore';
import type { Booking } from '@/types/booking';
import type { Payment } from '@/types/payment';
import { formatCurrency } from '@/utils/currency';

export default function BookingSuccessScreen() {
  const {
    bookingId,
    paymentId,
    status: queryStatus,
    transactionId: queryTxnId,
    method: queryMethod,
  } = useLocalSearchParams<{
    bookingId?: string;
    paymentId?: string;
    status?: string;
    transactionId?: string;
    method?: string;
  }>();

  const lastBooking = useBookingStore((state) => state.lastBooking);
  const resetDraft = useBookingStore((state) => state.resetDraft);

  const [booking, setBooking] = useState<Booking | null>(lastBooking);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(!lastBooking && Boolean(bookingId));

  useEffect(() => {
    // Reset draft state so next booking starts with a fresh slate
    resetDraft();
  }, [resetDraft]);

  useEffect(() => {
    if (!bookingId) return;

    if (lastBooking && lastBooking.bookingId === bookingId) {
      setBooking(lastBooking);
    } else {
      setLoading(true);
      bookingApi
        .getBookingById(bookingId)
        .then((data) => setBooking(data))
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }

    // Attempt to load authoritative payment details
    paymentApi
      .getBookingPayment(bookingId)
      .then((data) => setPayment(data))
      .catch(() => undefined);
  }, [bookingId, lastBooking]);

  if (loading) return <Loader fullScreen label="Loading booking confirmation…" />;

  const displayId = booking?.bookingId || bookingId || '—';
  const hotelName = booking?.hotel?.name || 'Your hotel';
  const roomName = booking?.room?.roomType || 'Room';
  const checkIn = booking?.checkIn ? String(booking.checkIn).slice(0, 10) : '—';
  const checkOut = booking?.checkOut ? String(booking.checkOut).slice(0, 10) : '—';
  const currency = payment?.currency || booking?.currency || 'INR';
  const total = booking?.totalAmount
    ? formatCurrency(booking.totalAmount, currency)
    : '—';
  const bStatus = booking?.bookingStatus || 'CONFIRMED';

  const effectivePaymentStatus =
    payment?.status || queryStatus || booking?.paymentStatus || 'PENDING';
  const effectiveTxnId = payment?.transactionId || queryTxnId || null;
  const effectiveMethod = payment?.paymentMethod || queryMethod || 'PAY_AT_HOTEL';

  const isPaid = effectivePaymentStatus === 'PAID' || effectivePaymentStatus === 'SUCCESS';
  const paymentBadgeTone: BadgeTone = isPaid
    ? 'success'
    : effectivePaymentStatus === 'FAILED'
      ? 'error'
      : 'gold';

  const paymentBadgeLabel = isPaid
    ? 'PAID'
    : effectivePaymentStatus === 'FAILED'
      ? 'FAILED'
      : effectiveMethod === 'PAY_AT_HOTEL'
        ? 'PAY AT HOTEL (PENDING)'
        : 'PENDING';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <BookingSuccess
          title={isPaid ? 'Payment & Booking Confirmed' : 'Reservation Confirmed'}
          message={
            isPaid
              ? `Your payment has been received and your stay at ${hotelName} is confirmed.`
              : `Your stay at ${hotelName} has been booked. Settle your payment at check-in.`
          }
          bookingReference={displayId}
          primaryActionLabel="View Booking Details"
          onPrimaryAction={() => {
            router.push({
              pathname: '/(customer)/booking/[bookingId]',
              params: { bookingId: displayId },
            });
          }}
          secondaryActionLabel="Go to My Bookings"
          onSecondaryAction={() => router.replace('/(customer)/bookings')}
        />

        {/* Authoritative Details Card */}
        <Card padding="medium">
          <View style={styles.detailsList}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Hotel</Text>
              <Text style={styles.detailValue}>{hotelName}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Room</Text>
              <Text style={styles.detailValue}>{roomName}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Dates</Text>
              <Text style={styles.detailValue}>
                {checkIn} to {checkOut}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Total Amount</Text>
              <Text style={[styles.detailValue, styles.totalHighlight]}>{total}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Booking Status</Text>
              <Text style={[styles.detailValue, styles.statusSuccess]}>{bStatus}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Payment Method</Text>
              <Text style={styles.detailValue}>{effectiveMethod.replace(/_/g, ' ')}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Payment Status</Text>
              <Badge label={paymentBadgeLabel} tone={paymentBadgeTone} showDot />
            </View>
            {effectiveTxnId ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Transaction ID</Text>
                <Text style={styles.txnValue}>{effectiveTxnId}</Text>
              </View>
            ) : null}
          </View>
        </Card>

        <Button
          title="Return to Home"
          variant="outline"
          onPress={() => router.replace('/(customer)/home')}
          fullWidth
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.medium, gap: spacing.medium, paddingBottom: spacing.xxlarge },
  detailsList: { gap: spacing.small },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailLabel: { color: colors.muted, fontSize: 14 },
  detailValue: { color: colors.text, fontSize: 14, fontWeight: '700' },
  txnValue: { color: colors.muted, fontSize: 13, fontFamily: 'monospace' },
  totalHighlight: { color: colors.primary, fontSize: 16, fontWeight: '800' },
  statusSuccess: { color: colors.success, fontWeight: '700' },
});
