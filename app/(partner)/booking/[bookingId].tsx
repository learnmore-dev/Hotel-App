import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useLocalSearchParams } from 'expo-router';

import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Divider } from '@/components/common/Divider';
import { ErrorView } from '@/components/common/ErrorView';
import { Input } from '@/components/common/Input';
import { Loader } from '@/components/common/Loader';
import { Modal } from '@/components/common/Modal';
import { colors } from '@/constants/colors';
import { radii, spacing } from '@/constants/spacing';
import { getPartnerBookingById, updatePartnerBookingStatus } from '@/services/api/bookingApi';
import type { Booking, BookingPaymentStatus, BookingStatus } from '@/types/booking';
import { formatCurrency } from '@/utils/currency';

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

function getPaymentBadgeTone(status: BookingPaymentStatus): 'success' | 'error' | 'gold' | 'neutral' {
  switch (status) {
    case 'PAID':
      return 'success';
    case 'FAILED':
      return 'error';
    case 'REFUNDED':
      return 'neutral';
    case 'PENDING':
    default:
      return 'neutral';
  }
}

export default function PartnerBookingDetailScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status transition states
  const [updating, setUpdating] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    let active = true;
    if (!bookingId) return;

    setLoading(true);
    setError(null);
    getPartnerBookingById(bookingId)
      .then((data) => {
        if (active) setBooking(data);
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

  const handleStatusTransition = async (newStatus: BookingStatus, reason?: string) => {
    if (!booking) return;
    setUpdating(true);

    try {
      const updated = await updatePartnerBookingStatus(booking.id, newStatus, reason);
      setBooking(updated);
      setCancelModalVisible(false);
      setCancelReason('');
      Alert.alert('Status Updated', `Booking status changed to ${newStatus}.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to update booking status.';
      Alert.alert('Action Failed', msg);
    } finally {
      setUpdating(false);
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
              void getPartnerBookingById(bookingId)
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

  const isPending = booking.bookingStatus === 'PENDING';
  const isConfirmed = booking.bookingStatus === 'CONFIRMED';
  const isCancelled = booking.bookingStatus === 'CANCELLED';
  const isCompleted = booking.bookingStatus === 'COMPLETED';

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
  const totalNum = Number(booking.totalAmount);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: booking.bookingId ? `Booking #${booking.bookingId}` : 'Booking Details',
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>PARTNER RESERVATION</Text>
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
              tone={getPaymentBadgeTone(booking.paymentStatus)}
            />
          </View>
        </View>

        {/* Cancellation Notice if Cancelled */}
        {isCancelled ? (
          <View style={styles.cancellationBanner}>
            <Text style={styles.cancellationTitle}>Booking Cancelled</Text>
            <Text style={styles.cancellationDate}>
              Cancelled at: {booking.cancelledAt ? new Date(booking.cancelledAt).toLocaleString() : '—'}
            </Text>
            {booking.cancellationReason ? (
              <Text style={styles.cancellationReason}>Reason: {booking.cancellationReason}</Text>
            ) : null}
          </View>
        ) : null}

        {/* Property & Stay Details */}
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
                {booking.roomsCount} room{booking.roomsCount > 1 ? 's' : ''} · {booking.guestsCount} guest{booking.guestsCount > 1 ? 's' : ''} ({booking.numberOfNights} night{booking.numberOfNights > 1 ? 's' : ''})
                {booking.room?.bedType ? ` · ${booking.room.bedType}` : ''}
              </Text>
            </View>
          </View>
        </Card>

        {/* Guest Information */}
        <Card padding="medium">
          <Text style={styles.sectionHeader}>Guest & Contact Info</Text>
          <View style={styles.guestRow}>
            <Text style={styles.guestLabel}>Primary Guest</Text>
            <Text style={styles.guestVal}>{guestName}</Text>
          </View>
          <View style={styles.guestRow}>
            <Text style={styles.guestLabel}>Email</Text>
            <Text style={styles.guestVal}>{guestEmail}</Text>
          </View>
          <View style={styles.guestRow}>
            <Text style={styles.guestLabel}>Phone</Text>
            <Text style={styles.guestVal}>{guestPhone}</Text>
          </View>
          {booking.specialRequests ? (
            <View style={styles.guestRow}>
              <Text style={styles.guestLabel}>Special Requests</Text>
              <Text style={styles.guestVal}>{booking.specialRequests}</Text>
            </View>
          ) : null}
        </Card>

        {/* Pricing Summary */}
        <Card padding="medium">
          <Text style={styles.sectionHeader}>Billing Summary</Text>
          <View style={styles.guestRow}>
            <Text style={styles.guestLabel}>Nightly Rate</Text>
            <Text style={styles.guestVal}>{formatCurrency(roomPriceNum, booking.currency || 'INR')}/night</Text>
          </View>
          <View style={styles.guestRow}>
            <Text style={styles.guestLabel}>Nights × Rooms</Text>
            <Text style={styles.guestVal}>{booking.numberOfNights} × {booking.roomsCount}</Text>
          </View>
          <View style={styles.guestRow}>
            <Text style={styles.guestLabel}>Taxes & Fees</Text>
            <Text style={styles.guestVal}>{formatCurrency(booking.taxAmount, booking.currency || 'INR')}</Text>
          </View>
          <Divider inset={spacing.xsmall} />
          <View style={styles.guestRow}>
            <Text style={styles.totalLabel}>Total Revenue</Text>
            <Text style={styles.totalVal}>{formatCurrency(totalNum, booking.currency || 'INR')}</Text>
          </View>
        </Card>

        {/* Status Actions */}
        <Card padding="medium">
          <Text style={styles.sectionHeader}>Manage Reservation Status</Text>

          {isPending ? (
            <View style={styles.actionCol}>
              <Button
                title="Confirm Reservation"
                disabled={updating}
                onPress={() => void handleStatusTransition('CONFIRMED')}
                fullWidth
              />
              <Button
                title="Decline / Cancel Reservation"
                variant="danger"
                disabled={updating}
                onPress={() => setCancelModalVisible(true)}
                fullWidth
              />
            </View>
          ) : null}

          {isConfirmed ? (
            <View style={styles.actionCol}>
              <Button
                title="Mark Completed (Guest Checked Out)"
                disabled={updating}
                onPress={() => void handleStatusTransition('COMPLETED')}
                fullWidth
              />
              <Button
                title="Cancel Reservation"
                variant="outline"
                disabled={updating}
                onPress={() => setCancelModalVisible(true)}
                fullWidth
              />
            </View>
          ) : null}

          {isCompleted ? (
            <Text style={styles.terminalText}>✔ This reservation has been completed and concluded.</Text>
          ) : null}

          {isCancelled ? (
            <Text style={styles.terminalText}>✖ This reservation is cancelled. No further status changes are allowed.</Text>
          ) : null}
        </Card>

        <Button
          title="Back to Reservations"
          variant="outline"
          onPress={() => router.back()}
          fullWidth
        />
      </ScrollView>

      {/* Cancellation Modal */}
      <Modal
        visible={cancelModalVisible}
        title="Cancel Reservation"
        onClose={() => setCancelModalVisible(false)}>
        <View style={styles.modalBody}>
          <Text style={styles.modalText}>
            Are you sure you want to cancel reservation {booking.bookingId}? Room inventory will be automatically restored.
          </Text>
          <Input
            label="Cancellation Reason (Optional)"
            placeholder="e.g. Guest no-show, operational constraint"
            value={cancelReason}
            onChangeText={setCancelReason}
          />
          <View style={styles.modalActions}>
            <Button
              title="Keep Reservation"
              variant="outline"
              disabled={updating}
              onPress={() => setCancelModalVisible(false)}
            />
            <Button
              title={updating ? 'Cancelling…' : 'Confirm Cancellation'}
              variant="danger"
              disabled={updating}
              onPress={() => void handleStatusTransition('CANCELLED', cancelReason)}
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
  totalLabel: { color: colors.text, fontSize: 15, fontWeight: '800' },
  totalVal: { color: colors.primary, fontSize: 17, fontWeight: '800' },
  actionCol: { gap: spacing.small },
  terminalText: { color: colors.muted, fontSize: 13, fontStyle: 'italic', paddingVertical: spacing.xsmall },
  modalBody: { gap: spacing.medium },
  modalText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.small, marginTop: spacing.small },
});
