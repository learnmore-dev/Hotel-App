import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { BookingSummary } from '@/components/booking/BookingSummary';
import { PaymentMethod, type PaymentMethodOption } from '@/components/booking/PaymentMethod';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { Loader } from '@/components/common/Loader';
import { Modal } from '@/components/common/Modal';
import { colors } from '@/constants/colors';
import { radii, spacing } from '@/constants/spacing';
import * as bookingApi from '@/services/api/bookingApi';
import * as paymentApi from '@/services/api/paymentApi';
import {
  isNativeRazorpayAvailable,
  openNativeRazorpayCheckout,
  RazorpayCancelError,
} from '@/services/razorpay/razorpayNative';
import { useBookingStore } from '@/store/bookingStore';
import type { Booking } from '@/types/booking';
import type { PaymentMethod as PaymentMethodType, RazorpayOrderDetails } from '@/types/payment';
import { formatCurrency } from '@/utils/currency';

const paymentOptions: PaymentMethodOption[] = [
  {
    id: 'UPI',
    label: 'UPI / Instant Pay',
    description: 'Pay via Google Pay, PhonePe, Paytm, BHIM or any UPI app.',
  },
  {
    id: 'CARD',
    label: 'Credit or Debit Card',
    description: 'Visa, Mastercard, RuPay. Production-ready payment processing.',
  },
  {
    id: 'NET_BANKING',
    label: 'Net Banking',
    description: 'Direct internet banking across all major supported banks.',
  },
  {
    id: 'PAY_AT_HOTEL',
    label: 'Pay at Hotel',
    description: 'No advance payment needed. Settle your bill during check-in.',
  },
];

function calculateNights(inStr: string, outStr: string): number {
  const dIn = new Date(`${inStr}T00:00:00.000Z`);
  const dOut = new Date(`${outStr}T00:00:00.000Z`);
  if (Number.isNaN(dIn.getTime()) || Number.isNaN(dOut.getTime())) return 1;
  const diff = dOut.getTime() - dIn.getTime();
  return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if ((window as any).Razorpay) return resolve(true);
    const existing = document.querySelector('script[src*="checkout.razorpay.com"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function PaymentScreen() {
  const { bookingId: routeBookingId } = useLocalSearchParams<{ bookingId?: string }>();
  const {
    selectedHotel,
    selectedRoom,
    checkIn,
    checkOut,
    roomsCount,
    guestsCount,
    appliedCoupon,
    discountAmount,
    submitBooking,
    lastBooking,
  } = useBookingStore();

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType>('UPI');
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [existingBooking, setExistingBooking] = useState<Booking | null>(lastBooking);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [razorpayOrder, setRazorpayOrder] = useState<RazorpayOrderDetails | null>(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // If a bookingId parameter is passed, load that booking directly
  useEffect(() => {
    if (routeBookingId) {
      setLoadingExisting(true);
      bookingApi
        .getBookingById(routeBookingId)
        .then((b) => setExistingBooking(b))
        .catch(() => undefined)
        .finally(() => setLoadingExisting(false));
    }
  }, [routeBookingId]);

  if (loadingExisting) {
    return <Loader fullScreen label="Loading booking details…" />;
  }

  // Determine active context: either existing booking or draft in store
  const hasDraft = Boolean(selectedHotel && selectedRoom);
  const activeBooking = existingBooking;

  if (!hasDraft && !activeBooking) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyWrap}>
          <EmptyState
            title="No booking in progress"
            description="Please select a hotel and room first."
            actionLabel="Go back to search"
            onAction={() => router.replace('/(customer)/search')}
          />
        </View>
      </SafeAreaView>
    );
  }

  // Calculate pricing breakdown
  const hotelName = activeBooking?.hotel?.name || selectedHotel?.name || 'Hotel';
  const roomType = activeBooking?.room?.roomType || selectedRoom?.roomType || 'Room';
  const stayDates = activeBooking
    ? `${String(activeBooking.checkIn).slice(0, 10)} to ${String(activeBooking.checkOut).slice(0, 10)}`
    : `${checkIn} to ${checkOut}`;
  const nights = activeBooking
    ? activeBooking.numberOfNights
    : calculateNights(checkIn, checkOut);
  const rooms = activeBooking ? activeBooking.roomsCount : roomsCount;
  const guests = activeBooking ? activeBooking.guestsCount : guestsCount;

  const roomPriceNum = activeBooking
    ? Number(activeBooking.roomPrice)
    : Number(selectedRoom?.pricePerNight || 0);
  const baseAmount = roomPriceNum * nights * rooms;
  const currentDiscount = activeBooking
    ? Number(activeBooking.discountAmount)
    : appliedCoupon
      ? discountAmount
      : 0;
  const finalPayable = activeBooking
    ? Number(activeBooking.totalAmount)
    : Math.max(0, baseAmount - currentDiscount);

  const handleProcessPayment = async () => {
    if (isProcessing) return;
    setErrorMessage(null);
    setIsProcessing(true);

    try {
      // 1. Ensure authoritative booking exists
      let targetBooking = activeBooking;
      if (!targetBooking) {
        targetBooking = await submitBooking();
        setExistingBooking(targetBooking);
      }

      // Offline method: Pay at Hotel bypasses Razorpay completely
      if (selectedMethod === 'PAY_AT_HOTEL') {
        const payment = await paymentApi.createPayment({
          bookingId: targetBooking.id,
          paymentMethod: 'PAY_AT_HOTEL',
        });

        router.replace({
          pathname: '/(customer)/booking/success',
          params: {
            bookingId: targetBooking.bookingId,
            paymentId: payment.id,
            status: payment.status,
            transactionId: payment.transactionId,
            method: payment.paymentMethod,
          },
        });
        return;
      }

      // If developer simulation toggle is enabled (DEVELOPMENT ONLY), use simulation
      if (__DEV__ && simulateFailure) {
        const failedPayment = await paymentApi.createPayment({
          bookingId: targetBooking.id,
          paymentMethod: selectedMethod,
          simulateFailure: true,
        });
        setErrorMessage(
          `Payment simulation failed (Ref: ${failedPayment.transactionId}). Please retry or select another payment method.`,
        );
        return;
      }

      // Online Gateway Flow: Create authoritative Razorpay order
      const order = await paymentApi.createRazorpayOrder(targetBooking.id);
      setRazorpayOrder(order);

      // 1. On Web platform: Open official Razorpay Checkout modal
      if (Platform.OS === 'web') {
        const loaded = await loadRazorpayScript();
        if (loaded && (window as any).Razorpay) {
          const rzp = new (window as any).Razorpay({
            key: order.keyId,
            amount: order.amount,
            currency: order.currency,
            name: 'TrumiTrip',
            description: `Booking #${order.bookingRef} - ${order.hotelName}`,
            order_id: order.orderId,
            prefill: {
              name: order.customerName,
              email: order.customerEmail,
              contact: order.customerPhone || '',
            },
            theme: { color: colors.primary },
            handler: async (response: {
              razorpay_payment_id: string;
              razorpay_order_id: string;
              razorpay_signature: string;
            }) => {
              try {
                setIsVerifying(true);
                const verified = await paymentApi.verifyRazorpayPayment({
                  bookingId: targetBooking.id,
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                });
                router.replace({
                  pathname: '/(customer)/booking/success',
                  params: {
                    bookingId: targetBooking.bookingId,
                    paymentId: verified.id,
                    status: verified.status,
                    transactionId: verified.transactionId,
                    method: selectedMethod,
                  },
                });
              } catch (verifyErr: unknown) {
                const msg =
                  verifyErr instanceof Error
                    ? verifyErr.message
                    : 'Payment verification failed. Please contact support.';
                setErrorMessage(msg);
              } finally {
                setIsVerifying(false);
              }
            },
            modal: {
              ondismiss: () => {
                setErrorMessage('Checkout was closed. You can retry when ready.');
                setIsProcessing(false);
              },
            },
          });
          rzp.open();
          return;
        }
      }

      // 2. On Native (Android / iOS): Open official native Razorpay SDK activity if available
      if (isNativeRazorpayAvailable()) {
        try {
          const nativeResult = await openNativeRazorpayCheckout({
            key: order.keyId,
            order_id: order.orderId,
            amount: order.amount,
            currency: order.currency,
            name: 'TrumiTrip',
            description: `Booking #${order.bookingRef} - ${order.hotelName}`,
            prefill: {
              name: order.customerName,
              email: order.customerEmail,
              contact: order.customerPhone || '',
              method:
                selectedMethod === 'UPI'
                  ? 'upi'
                  : selectedMethod === 'CARD'
                    ? 'card'
                    : 'netbanking',
            },
            theme: { color: colors.primary },
          });

          // Server-side verification
          setIsVerifying(true);
          const verified = await paymentApi.verifyRazorpayPayment({
            bookingId: targetBooking.id,
            razorpayOrderId: nativeResult.razorpay_order_id,
            razorpayPaymentId: nativeResult.razorpay_payment_id,
            razorpaySignature: nativeResult.razorpay_signature,
          });

          router.replace({
            pathname: '/(customer)/booking/success',
            params: {
              bookingId: targetBooking.bookingId,
              paymentId: verified.id,
              status: verified.status,
              transactionId: verified.transactionId,
              method: selectedMethod,
            },
          });
          return;
        } catch (nativeErr: unknown) {
          if (
            nativeErr instanceof RazorpayCancelError ||
            (nativeErr as { isCancelled?: boolean })?.isCancelled
          ) {
            setErrorMessage('Payment was cancelled. You can retry when ready.');
            return;
          }
          const msg =
            nativeErr instanceof Error
              ? nativeErr.message
              : 'Native payment processing failed. Please retry.';
          setErrorMessage(msg);
          return;
        } finally {
          setIsVerifying(false);
        }
      }

      // 3. Fallback for Expo Go / simulator (Development Mode Only)
      if (__DEV__) {
        setShowCheckoutModal(true);
      } else {
        setErrorMessage(
          'Official payment gateway module is unavailable on this device. Please use Pay at Hotel or update the app.',
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to complete payment. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompleteTestPayment = async (simulateDecline = false) => {
    if (!__DEV__ || !razorpayOrder || isVerifying) return;
    setIsVerifying(true);
    setErrorMessage(null);

    try {
      if (simulateDecline) {
        setShowCheckoutModal(false);
        setErrorMessage(
          'Payment declined by Razorpay test gateway (Bank Card Declined). Please retry or select another payment method.',
        );
        return;
      }

      // 1. Generate test HMAC signature from backend test mode helper
      const credentials = await paymentApi.generateTestPaymentSignature({
        bookingId: razorpayOrder.bookingId,
        orderId: razorpayOrder.orderId,
      });

      // 2. Submit signature to authoritative verification endpoint
      const verified = await paymentApi.verifyRazorpayPayment({
        bookingId: razorpayOrder.bookingId,
        razorpayOrderId: credentials.razorpayOrderId,
        razorpayPaymentId: credentials.razorpayPaymentId,
        razorpaySignature: credentials.razorpaySignature,
      });

      setShowCheckoutModal(false);
      router.replace({
        pathname: '/(customer)/booking/success',
        params: {
          bookingId: razorpayOrder.bookingRef,
          paymentId: verified.id,
          status: verified.status,
          transactionId: verified.transactionId,
          method: selectedMethod,
        },
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Payment verification failed. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsVerifying(false);
    }
  };

    const activeCurrency = activeBooking?.currency || razorpayOrder?.currency || 'INR';

    const summaryLines = [
    {
      id: 'hotel-name',
      label: 'Hotel',
      value: hotelName,
    },
    {
      id: 'room-type',
      label: 'Room',
      value: roomType,
    },
    {
      id: 'stay-dates',
      label: 'Dates',
      value: `${stayDates} (${nights} night${nights > 1 ? 's' : ''})`,
    },
    {
      id: 'occupancy',
      label: 'Occupancy',
      value: `${rooms} room${rooms > 1 ? 's' : ''}, ${guests} guest${guests > 1 ? 's' : ''}`,
    },
    {
      id: 'stay-subtotal',
      label: 'Base stay rate',
      value: formatCurrency(baseAmount, activeCurrency),
    },
    ...(currentDiscount > 0
      ? [
          {
            id: 'coupon-discount',
            label: appliedCoupon ? `Discount (${appliedCoupon.code})` : 'Discount',
            value: `-${formatCurrency(currentDiscount, activeCurrency)}`,
            subdued: false,
          },
        ]
      : []),
    {
      id: 'selected-method',
      label: 'Payment mode',
      value: selectedMethod.replace(/_/g, ' '),
      subdued: true,
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          Payment & Confirmation
        </Text>

        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Transaction Notice</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* Payment Method Selector */}
        <Card padding="medium">
          <PaymentMethod
            methods={paymentOptions}
            selectedMethodId={selectedMethod}
            onSelect={(id) => setSelectedMethod(id as PaymentMethodType)}
            title="Select payment method"
            disabled={isProcessing}
          />
        </Card>

        {/* Developer / Tester Simulation Controls (Development Only) */}
        {__DEV__ && selectedMethod !== 'PAY_AT_HOTEL' ? (
          <Card padding="medium">
            <View style={styles.simulationRow}>
              <View style={styles.simulationTextWrap}>
                <Text style={styles.simulationLabel}>Simulate Payment Failure</Text>
                <Text style={styles.simulationSub}>
                  Toggle to test failed transaction handling and immediate retry behavior.
                </Text>
              </View>
              <Switch
                value={simulateFailure}
                onValueChange={setSimulateFailure}
                trackColor={{ false: colors.border, true: colors.error }}
              />
            </View>
          </Card>
        ) : null}

        {/* Security Assurance Notice */}
        <View style={styles.securityBanner}>
          <Text style={styles.securityText}>
            🔒 256-bit encrypted checkout. Never asks for or stores sensitive PINs or CVVs.
          </Text>
        </View>

        {/* Final Price Summary */}
        <BookingSummary
          title="Price & reservation summary"
          lines={summaryLines}
          total={formatCurrency(finalPayable, activeCurrency)}
          totalLabel="Total payable"
          note={
            selectedMethod === 'PAY_AT_HOTEL'
              ? 'No card required now. Payment status will be PENDING until check-in.'
              : 'Payment will be confirmed immediately upon completion.'
          }
        />

        {/* Action Button */}
        <Button
          title={
            isProcessing
              ? 'Processing payment…'
              : selectedMethod === 'PAY_AT_HOTEL'
                ? 'Confirm Reservation (Pay at Hotel)'
                : `Pay ${formatCurrency(finalPayable, activeCurrency)} Now`
          }
          onPress={() => void handleProcessPayment()}
          size="large"
          loading={isProcessing}
          disabled={isProcessing}
          fullWidth
        />
      </ScrollView>

      {/* Razorpay Test Mode Checkout Modal for Expo Go / Mobile Simulator (Development Only) */}
      {__DEV__ ? (
        <Modal
          visible={showCheckoutModal}
          title="Razorpay Secure Checkout"
          onClose={() => {
            if (!isVerifying) {
              setShowCheckoutModal(false);
              setErrorMessage('Payment was dismissed. You can retry when ready.');
            }
          }}>
          <View style={styles.modalBody}>
            <View style={styles.modalBadgeRow}>
              <Badge label="TEST MODE (Sandbox)" tone="gold" />
              <Text style={styles.modalOrderId}>
                Order: {razorpayOrder?.orderId ? razorpayOrder.orderId.slice(0, 18) + '…' : ''}
              </Text>
            </View>

            <View style={styles.modalSummaryBox}>
              <Text style={styles.modalHotelName}>{hotelName}</Text>
              <Text style={styles.modalAmountText}>
                Payable: {formatCurrency((razorpayOrder?.amount ?? 0) / 100, razorpayOrder?.currency ?? 'INR')}
              </Text>
              <Text style={styles.modalCustomerText}>
                Billed to: {razorpayOrder?.customerName} ({razorpayOrder?.customerEmail})
              </Text>
            </View>

            <Text style={styles.modalInstructionText}>
              Simulate a Razorpay transaction below. In test mode, no real funds will be charged.
            </Text>

            {isVerifying ? (
              <View style={styles.verifyingBox}>
                <Loader label="Verifying payment signature with server…" />
              </View>
            ) : (
              <View style={styles.modalActions}>
                <Button
                  title={`Pay with Test ${selectedMethod === 'UPI' ? 'UPI' : 'Card'} (Success)`}
                  onPress={() => void handleCompleteTestPayment(false)}
                  size="medium"
                  fullWidth
                />
                <Button
                  title="Simulate Gateway Failure"
                  onPress={() => void handleCompleteTestPayment(true)}
                  variant="outline"
                  size="medium"
                  fullWidth
                />
                <Button
                  title="Cancel Checkout"
                  onPress={() => {
                    setShowCheckoutModal(false);
                    setErrorMessage('Checkout was cancelled. You can retry when ready.');
                  }}
                  variant="ghost"
                  size="medium"
                  fullWidth
                />
              </View>
            )}
          </View>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.medium, gap: spacing.medium, paddingBottom: spacing.xxlarge },
  emptyWrap: { flex: 1, justifyContent: 'center', padding: spacing.large },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  errorBanner: {
    padding: spacing.medium,
    borderRadius: radii.medium,
    backgroundColor: colors.errorSubtle,
    borderWidth: 1,
    borderColor: colors.error,
    gap: spacing.xxxsmall,
  },
  errorTitle: { color: colors.error, fontSize: 14, fontWeight: '700' },
  errorText: { color: colors.error, fontSize: 13, lineHeight: 18 },
  simulationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.medium,
  },
  simulationTextWrap: { flex: 1 },
  simulationLabel: { color: colors.text, fontSize: 14, fontWeight: '700' },
  simulationSub: { color: colors.muted, fontSize: 12, lineHeight: 16, marginTop: 2 },
  securityBanner: {
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
    borderRadius: radii.medium,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  securityText: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  modalBody: {
    gap: spacing.medium,
    paddingVertical: spacing.small,
  },
  modalBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalOrderId: {
    color: colors.muted,
    fontSize: 12,
  },
  modalSummaryBox: {
    padding: spacing.medium,
    borderRadius: radii.medium,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xxsmall,
  },
  modalHotelName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  modalAmountText: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '800',
  },
  modalCustomerText: {
    color: colors.muted,
    fontSize: 12,
  },
  modalInstructionText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  verifyingBox: {
    paddingVertical: spacing.large,
    alignItems: 'center',
  },
  modalActions: {
    gap: spacing.small,
  },
});
