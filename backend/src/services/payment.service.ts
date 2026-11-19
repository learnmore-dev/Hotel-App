import {
  type BookingPaymentStatus,
  type PaymentMethod,
  type PaymentStatus,
  type Prisma,
  type UserRole,
} from '@prisma/client';

import { getPrismaClient } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { generateTransactionId } from '../utils/transactionId.js';
import { voidPendingPayoutsForBooking } from './payout.service.js';
import { safeNotify } from './notification.service.js';

export type CreatePaymentInput = {
  bookingId: string;
  paymentMethod: PaymentMethod;
  idempotencyKey?: string | null;
  simulateFailure?: boolean;
};

export const VALID_PAYMENT_STATUS_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  PENDING: ['SUCCESS', 'FAILED'],
  FAILED: ['PENDING', 'SUCCESS'],
  SUCCESS: ['REFUNDED'],
  REFUNDED: [],
};

export const paymentDetailSelect = {
  id: true,
  bookingId: true,
  customerId: true,
  amount: true,
  currency: true,
  paymentMethod: true,
  transactionId: true,
  gatewayOrderId: true,
  gatewayPaymentId: true,
  gatewaySignature: true,
  status: true,
  gateway: true,
  paidAt: true,
  createdAt: true,
  updatedAt: true,
  booking: {
    select: {
      id: true,
      bookingId: true,
      hotelId: true,
      roomId: true,
      checkIn: true,
      checkOut: true,
      roomsCount: true,
      guestsCount: true,
      numberOfNights: true,
      roomPrice: true,
      taxAmount: true,
      discountAmount: true,
      totalAmount: true,
      bookingStatus: true,
      paymentStatus: true,
      hotel: {
        select: {
          id: true,
          name: true,
          city: true,
          address: true,
          partnerId: true,
        },
      },
      room: {
        select: {
          id: true,
          roomType: true,
        },
      },
      customer: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
  },
} satisfies Prisma.PaymentSelect;

/**
 * Creates or updates a payment record for an authenticated customer's booking.
 * Amount is derived exclusively from the authoritative database booking record.
 * Never stores or requests sensitive card numbers, CVVs, or bank credentials.
 */
export async function createPayment(customerId: string, input: CreatePaymentInput) {
  const prisma = getPrismaClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.bookingId);

  // 1. Verify booking existence & customer ownership
  const booking = await prisma.booking.findFirst({
    where: isUuid ? { id: input.bookingId } : { bookingId: input.bookingId },
    select: {
      id: true,
      bookingId: true,
      customerId: true,
      totalAmount: true,
      bookingStatus: true,
      paymentStatus: true,
    },
  });

  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  if (booking.customerId !== customerId) {
    throw new ApiError(403, "You cannot pay for another customer's booking");
  }

  if (booking.bookingStatus === 'CANCELLED') {
    throw new ApiError(400, 'Cannot process payment for a cancelled booking');
  }

  if (booking.paymentStatus === 'PAID') {
    throw new ApiError(400, 'This booking has already been paid');
  }

  // 2. Check existing payment record for this booking
  const existingPayment = await prisma.payment.findUnique({
    where: { bookingId: booking.id },
  });

  if (existingPayment?.status === 'SUCCESS') {
    throw new ApiError(400, 'This booking already has a completed payment');
  }

  // Idempotency check: if caller repeats identical request with matching idempotency key
  if (input.idempotencyKey && existingPayment && existingPayment.transactionId?.includes(input.idempotencyKey)) {
    return prisma.payment.findUniqueOrThrow({
      where: { id: existingPayment.id },
      select: paymentDetailSelect,
    });
  }

  // 3. Execute transactional payment creation
  const payment = await prisma.$transaction(async (tx) => {
    let targetPaymentStatus: PaymentStatus;
    let targetBookingPaymentStatus: BookingPaymentStatus;
    let transactionId: string;
    let paidAt: Date | null;
    let gateway: string;

    if (input.paymentMethod === 'PAY_AT_HOTEL') {
      // Step 7: PAY_AT_HOTEL remains PENDING and does NOT become SUCCESS
      targetPaymentStatus = 'PENDING';
      targetBookingPaymentStatus = 'PENDING';
      transactionId = generateTransactionId('HOTEL');
      paidAt = null;
      gateway = 'PAY_AT_HOTEL';
    } else {
      // Online methods: UPI, CARD, NET_BANKING
      if (input.simulateFailure) {
        // Step 15: Simulated failure flow
        targetPaymentStatus = 'FAILED';
        targetBookingPaymentStatus = 'FAILED';
        transactionId = generateTransactionId('FAIL');
        paidAt = null;
        gateway = 'SIMULATED';
      } else {
        // Standard successful online payment simulation
        targetPaymentStatus = 'SUCCESS';
        targetBookingPaymentStatus = 'PAID';
        transactionId = generateTransactionId('TXN');
        paidAt = new Date();
        gateway = 'SIMULATED';
      }
    }

    const createdPayment = await tx.payment.upsert({
      where: { bookingId: booking.id },
      create: {
        bookingId: booking.id,
        customerId,
        amount: booking.totalAmount,
        currency: process.env.RAZORPAY_CURRENCY || 'INR',
        paymentMethod: input.paymentMethod,
        transactionId,
        status: targetPaymentStatus,
        gateway,
        gatewayResponse: {
          simulated: true,
          method: input.paymentMethod,
          idempotencyKey: input.idempotencyKey ?? null,
          processedAt: new Date().toISOString(),
        },
        paidAt,
      },
      update: {
        paymentMethod: input.paymentMethod,
        transactionId,
        status: targetPaymentStatus,
        amount: booking.totalAmount,
        currency: process.env.RAZORPAY_CURRENCY || 'INR',
        gateway,
        gatewayResponse: {
          simulated: true,
          method: input.paymentMethod,
          idempotencyKey: input.idempotencyKey ?? null,
          retriedAt: new Date().toISOString(),
        },
        paidAt,
      },
      select: paymentDetailSelect,
    });

    // Keep Booking.paymentStatus consistent with Payment.status
    await tx.booking.update({
      where: { id: booking.id },
      data: {
        paymentStatus: targetBookingPaymentStatus,
        ...(targetPaymentStatus === 'SUCCESS' && booking.bookingStatus === 'PENDING'
          ? { bookingStatus: 'CONFIRMED' }
          : {}),
      },
    });

    return createdPayment;
  });

  // Post-transaction notifications (fail-safe and non-blocking)
  if (payment.status === 'SUCCESS') {
    void safeNotify({
      userId: customerId,
      title: 'Payment Successful',
      message: `Your payment of $${payment.amount} for booking #${payment.booking.bookingId} was successful.`,
      type: 'PAYMENT',
      dedupKey: `PAYMENT_SUCCESS:${payment.id}`,
      actionUrl: `/(customer)/booking/${payment.bookingId}`,
      data: { paymentId: payment.id, bookingId: payment.bookingId },
    });

    const hotel = await prisma.hotel.findUnique({
      where: { id: payment.booking.hotelId },
      select: { name: true, partner: { select: { userId: true } } },
    });

    if (hotel?.partner?.userId) {
      void safeNotify({
        userId: hotel.partner.userId,
        title: 'Booking Payment Confirmed',
        message: `Payment received for booking #${payment.booking.bookingId} ($${payment.amount}).`,
        type: 'PAYMENT',
        dedupKey: `PARTNER_PAYMENT_CONFIRMED:${payment.id}`,
        actionUrl: `/(partner)/bookings/${payment.bookingId}`,
        data: { paymentId: payment.id, bookingId: payment.bookingId },
      });
    }
  } else if (payment.status === 'FAILED') {
    void safeNotify({
      userId: customerId,
      title: 'Payment Failed',
      message: `Payment attempt of $${payment.amount} for booking #${payment.booking.bookingId} failed. Please retry your payment.`,
      type: 'PAYMENT',
      dedupKey: `PAYMENT_FAILED:${payment.id}:${Date.now()}`,
      actionUrl: `/(customer)/booking/${payment.bookingId}`,
      data: { paymentId: payment.id, bookingId: payment.bookingId },
    });
  }

  return payment;
}

/**
 * Retrieves payment details by payment primary ID or transaction reference.
 * Strictly verifies ownership based on JWT caller identity.
 */
export async function getPaymentById(userId: string, userRole: UserRole, idOrTransactionId: string) {
  const prisma = getPrismaClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrTransactionId);

  const payment = await prisma.payment.findFirst({
    where: isUuid ? { id: idOrTransactionId } : { transactionId: idOrTransactionId },
    select: paymentDetailSelect,
  });

  if (!payment) {
    throw new ApiError(404, 'Payment not found');
  }

  // Authorization checks
  if (userRole === 'ADMIN') {
    return payment;
  }

  if (userRole === 'CUSTOMER') {
    if (payment.customerId !== userId) {
      throw new ApiError(403, 'You do not have permission to view this payment');
    }
    return payment;
  }

  if (userRole === 'PARTNER') {
    const partnerProfile = await prisma.partnerProfile.findUnique({
      where: { userId },
      select: { id: true, status: true },
    });
    if (!partnerProfile || partnerProfile.status !== 'APPROVED') {
      throw new ApiError(403, 'An approved partner profile is required');
    }
    if (payment.booking.hotel.partnerId !== partnerProfile.id) {
      throw new ApiError(403, 'You do not have permission to view this payment');
    }
    return payment;
  }

  throw new ApiError(403, 'Access denied');
}

/**
 * Retrieves payment details for a specific booking.
 */
export async function getBookingPayment(userId: string, userRole: UserRole, bookingIdOrRef: string) {
  const prisma = getPrismaClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingIdOrRef);

  const booking = await prisma.booking.findFirst({
    where: isUuid ? { id: bookingIdOrRef } : { bookingId: bookingIdOrRef },
    select: {
      id: true,
      bookingId: true,
      customerId: true,
      hotel: { select: { partnerId: true } },
    },
  });

  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  // Ownership authorization
  if (userRole === 'CUSTOMER' && booking.customerId !== userId) {
    throw new ApiError(403, 'You do not have permission to view payments for this booking');
  }

  if (userRole === 'PARTNER') {
    const partnerProfile = await prisma.partnerProfile.findUnique({
      where: { userId },
      select: { id: true, status: true },
    });
    if (!partnerProfile || partnerProfile.status !== 'APPROVED' || booking.hotel.partnerId !== partnerProfile.id) {
      throw new ApiError(403, 'You do not have permission to view payments for this booking');
    }
  }

  const payment = await prisma.payment.findUnique({
    where: { bookingId: booking.id },
    select: paymentDetailSelect,
  });

  if (!payment) {
    throw new ApiError(404, 'No payment record found for this booking');
  }

  return payment;
}

/**
 * Updates payment status according to the valid state machine.
 * Supports transition from SUCCESS -> REFUNDED.
 */
export async function updatePaymentStatus(
  _adminUserId: string,
  paymentId: string,
  targetStatus: PaymentStatus,
  reason?: string,
) {
  const prisma = getPrismaClient();
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { id: true, status: true, bookingId: true },
  });

  if (!payment) {
    throw new ApiError(404, 'Payment not found');
  }

  if (payment.status === targetStatus) {
    return prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
      select: paymentDetailSelect,
    });
  }

  const allowedTransitions = VALID_PAYMENT_STATUS_TRANSITIONS[payment.status] || [];
  if (!allowedTransitions.includes(targetStatus)) {
    throw new ApiError(
      400,
      `Cannot transition payment status from ${payment.status} to ${targetStatus}`,
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    let bookingPaymentStatus: BookingPaymentStatus;
    if (targetStatus === 'REFUNDED') {
      bookingPaymentStatus = 'REFUNDED';
    } else if (targetStatus === 'SUCCESS') {
      bookingPaymentStatus = 'PAID';
    } else if (targetStatus === 'FAILED') {
      bookingPaymentStatus = 'FAILED';
    } else {
      bookingPaymentStatus = 'PENDING';
    }

    const updatedRecord = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: targetStatus,
        gatewayResponse: {
          statusChangedTo: targetStatus,
          reason: reason?.trim() || null,
          updatedAt: new Date().toISOString(),
        },
      },
      select: paymentDetailSelect,
    });

    await tx.booking.update({
      where: { id: payment.bookingId },
      data: { paymentStatus: bookingPaymentStatus },
    });

    if (targetStatus === 'REFUNDED') {
      await voidPendingPayoutsForBooking(payment.bookingId, reason?.trim() || 'Payment refunded', tx);
    }

    return updatedRecord;
  });

  if (targetStatus === 'REFUNDED') {
    void safeNotify({
      userId: updated.customerId,
      title: 'Refund Processed',
      message: `A refund of $${updated.amount} for booking #${updated.booking.bookingId} has been successfully processed.`,
      type: 'PAYMENT',
      dedupKey: `REFUND_PROCESSED:${updated.id}`,
      actionUrl: `/(customer)/booking/${updated.bookingId}`,
      data: { paymentId: updated.id, bookingId: updated.bookingId },
    });
  }

  return updated;
}
