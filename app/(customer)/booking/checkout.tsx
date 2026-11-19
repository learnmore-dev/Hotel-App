import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { BookingSummary } from '@/components/booking/BookingSummary';
import { CouponInput } from '@/components/booking/CouponInput';
import { GuestForm, type GuestField } from '@/components/booking/GuestForm';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { Input } from '@/components/common/Input';
import { colors } from '@/constants/colors';
import { radii, spacing } from '@/constants/spacing';
import { useAuthStore } from '@/store/authStore';
import { useBookingStore } from '@/store/bookingStore';
import { formatCurrency } from '@/utils/currency';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function calculateNights(inStr: string, outStr: string): number {
  const dIn = new Date(`${inStr}T00:00:00.000Z`);
  const dOut = new Date(`${outStr}T00:00:00.000Z`);
  if (Number.isNaN(dIn.getTime()) || Number.isNaN(dOut.getTime())) return 1;
  const diff = dOut.getTime() - dIn.getTime();
  return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));
}

export default function CheckoutScreen() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const {
    selectedHotel,
    selectedRoom,
    checkIn,
    checkOut,
    roomsCount,
    guestsCount,
    guestDetails,
    specialRequests,
    appliedCoupon,
    discountAmount,
    couponError,
    isApplyingCoupon,
    setGuestDetail,
    setSpecialRequests,
    applyCoupon,
    removeCoupon,
  } = useBookingStore();

  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [formErrors, setFormErrors] = useState<Partial<Record<GuestField, string>>>({});

  if (!selectedHotel || !selectedRoom) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyContainer}>
          <EmptyState
            title="No room selected"
            description="Please choose a hotel and select a room to proceed with checkout."
            actionLabel="Browse hotels"
            onAction={() => router.replace('/(customer)/search')}
          />
        </View>
      </SafeAreaView>
    );
  }

  const nights = calculateNights(checkIn, checkOut);
  const roomPriceNum = Number(selectedRoom.pricePerNight);
  const baseAmount = roomPriceNum * nights * roomsCount;
  const taxAmount = 0;
  const currentDiscount = appliedCoupon ? discountAmount : 0;
  const totalAmount = Math.max(0, baseAmount + taxAmount - currentDiscount);

  const validate = (): boolean => {
    const errors: Partial<Record<GuestField, string>> = {};
    if (!guestDetails.fullName.trim()) {
      errors.fullName = 'Guest full name is required.';
    }
    if (!guestDetails.email.trim() || !emailPattern.test(guestDetails.email.trim())) {
      errors.email = 'A valid email address is required.';
    }
    if (!guestDetails.phone.trim() || guestDetails.phone.trim().length < 4) {
      errors.phone = 'A valid phone number is required.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleProceed = () => {
    if (!isAuthenticated) {
      router.push('/(auth)/login');
      return;
    }

    if (!validate()) return;

    router.push('/(customer)/booking/payment');
  };

  const summaryLines = [
    {
      id: 'room-rate',
      label: `${selectedRoom.roomType} (${nights} night${nights > 1 ? 's' : ''})`,
      value: formatCurrency(roomPriceNum * nights),
    },
    {
      id: 'rooms-count',
      label: `Rooms (${roomsCount})`,
      value: `× ${roomsCount}`,
    },
    {
      id: 'subtotal',
      label: 'Base stay price',
      value: formatCurrency(baseAmount),
    },
    {
      id: 'taxes',
      label: 'Taxes & fees',
      value: formatCurrency(taxAmount),
      subdued: true,
    },
    {
      id: 'discount',
      label: appliedCoupon ? `Discount (${appliedCoupon.code})` : 'Discount',
      value: appliedCoupon ? `-${formatCurrency(currentDiscount)}` : formatCurrency(currentDiscount),
      subdued: !appliedCoupon,
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.pageTitle}>
          Review & Checkout
        </Text>

        {/* Hotel & Room Summary */}
        <Card padding="medium">
          <View style={styles.hotelBlock}>
            <Text style={styles.hotelName}>{selectedHotel.name}</Text>
            <Text style={styles.hotelLocation}>
              {selectedHotel.address}, {selectedHotel.city}
            </Text>
            <View style={styles.divider} />
            <Text style={styles.roomType}>{selectedRoom.roomType}</Text>
            <Text style={styles.roomDetail}>
              {selectedRoom.bedType ? `${selectedRoom.bedType} · ` : ''}Up to {selectedRoom.maxGuests} guests
            </Text>
          </View>
        </Card>

        {/* Stay Dates */}
        <Card padding="medium">
          <Text style={styles.sectionHeading}>Trip details</Text>
          <View style={styles.tripGrid}>
            <View style={styles.tripCol}>
              <Text style={styles.tripLabel}>CHECK-IN</Text>
              <Text style={styles.tripValue}>{checkIn}</Text>
            </View>
            <View style={styles.tripCol}>
              <Text style={styles.tripLabel}>CHECK-OUT</Text>
              <Text style={styles.tripValue}>{checkOut}</Text>
            </View>
            <View style={styles.tripCol}>
              <Text style={styles.tripLabel}>DURATION</Text>
              <Text style={styles.tripValue}>
                {nights} night{nights > 1 ? 's' : ''}
              </Text>
            </View>
            <View style={styles.tripCol}>
              <Text style={styles.tripLabel}>ROOMS & GUESTS</Text>
              <Text style={styles.tripValue}>
                {roomsCount} room, {guestsCount} guest{guestsCount > 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        </Card>

        {/* Guest Details Form */}
        <Card padding="medium">
          <Text style={styles.sectionHeading}>Guest information</Text>
          <GuestForm
            value={guestDetails}
            onChange={setGuestDetail}
            errors={formErrors}
          />

          <View style={styles.specialRequestsWrap}>
            <Input
              label="Special requests (optional)"
              value={specialRequests}
              onChangeText={setSpecialRequests}
              placeholder="Early check-in, quiet room, high floor, etc."
              returnKeyType="done"
            />
          </View>
        </Card>

        {/* Coupon Code Section (Step 5) */}
        <Card padding="medium">
          <Text style={styles.sectionHeading}>Coupons & Offers</Text>
          {appliedCoupon ? (
            <View style={styles.appliedCouponBox}>
              <View style={styles.appliedCouponInfo}>
                <View style={styles.badgeWrap}>
                  <Text style={styles.appliedCouponBadge}>Coupon Applied</Text>
                </View>
                <Text style={styles.appliedCouponCode}>{appliedCoupon.code}</Text>
                <Text style={styles.appliedCouponSaving}>
                  Discount: -{formatCurrency(currentDiscount)}
                </Text>
              </View>
              <Button
                title="Remove"
                variant="outline"
                size="small"
                onPress={() => {
                  removeCoupon();
                  setCouponCodeInput('');
                }}
              />
            </View>
          ) : (
            <CouponInput
              code={couponCodeInput}
              onChangeCode={setCouponCodeInput}
              onApply={() => void applyCoupon(couponCodeInput, baseAmount)}
              applying={isApplyingCoupon}
              message={couponError || undefined}
              messageTone={couponError ? 'error' : 'neutral'}
              applyLabel="Apply"
            />
          )}
        </Card>

        {/* Pricing Summary */}
        <BookingSummary
          title="Price details"
          lines={summaryLines}
          total={formatCurrency(totalAmount)}
          totalLabel="Total amount"
          note="Pricing is calculated and verified by TrumiTrip server upon reservation."
        />

        <Button
          title={isAuthenticated ? 'Continue to Payment' : 'Log in to continue booking'}
          onPress={handleProceed}
          size="large"
          fullWidth
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.medium, gap: spacing.medium, paddingBottom: spacing.xxlarge },
  emptyContainer: { flex: 1, justifyContent: 'center', padding: spacing.large },
  pageTitle: { color: colors.text, fontSize: 24, fontWeight: '800' },
  hotelBlock: { gap: spacing.xxsmall },
  hotelName: { color: colors.primary, fontSize: 18, fontWeight: '800' },
  hotelLocation: { color: colors.muted, fontSize: 13 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.small },
  roomType: { color: colors.text, fontSize: 16, fontWeight: '700' },
  roomDetail: { color: colors.muted, fontSize: 13 },
  sectionHeading: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: spacing.medium },
  tripGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.medium },
  tripCol: { width: '45%', gap: spacing.xxxsmall },
  tripLabel: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  tripValue: { color: colors.text, fontSize: 14, fontWeight: '600' },
  specialRequestsWrap: { marginTop: spacing.medium },
  appliedCouponBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.medium,
    borderRadius: radii.medium,
    backgroundColor: colors.successSubtle,
    borderWidth: 1,
    borderColor: colors.success,
  },
  appliedCouponInfo: { flex: 1, gap: spacing.xxxsmall },
  badgeWrap: { alignSelf: 'flex-start' },
  appliedCouponBadge: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  appliedCouponCode: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  appliedCouponSaving: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
});
