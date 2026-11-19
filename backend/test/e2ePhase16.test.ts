import 'dotenv/config';

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getPrismaClient } from '../src/config/prisma.js';
import * as bookingService from '../src/services/booking.service.js';
import * as paymentService from '../src/services/payment.service.js';
import * as reviewService from '../src/services/review.service.js';
import * as payoutService from '../src/services/payout.service.js';
import * as notificationService from '../src/services/notification.service.js';
import { requireRole } from '../src/middleware/role.middleware.js';
import { ApiError } from '../src/utils/ApiError.js';

describe('Phase 16 — Comprehensive End-to-End Multi-Role Lifecycle & Security Integration Tests', () => {
  const prisma = getPrismaClient();

  let customerUser: any;
  let partnerUser: any;
  let adminUser: any;
  let hotel: any;
  let room: any;

  // Shared state across sequential lifecycle steps
  let e2eBookingId: string;
  let e2ePayoutId: string;

  describe('1. Environment & Multi-Role Seed Verification', () => {
    it('verifies customer, partner, and admin users exist in the database', async () => {
      customerUser = await prisma.user.findUnique({
        where: { email: 'customer@trumitrip.dev' },
      });
      assert.ok(customerUser, 'Seed customer user must exist');
      assert.equal(customerUser.role, 'CUSTOMER');

      partnerUser = await prisma.user.findUnique({
        where: { email: 'partner@trumitrip.dev' },
        include: { partnerProfile: { include: { hotels: true } } },
      });
      assert.ok(partnerUser, 'Seed partner user must exist');
      assert.equal(partnerUser.role, 'PARTNER');
      assert.ok(partnerUser.partnerProfile, 'Partner profile must exist');

      adminUser = await prisma.user.findUnique({
        where: { email: 'admin@trumitrip.dev' },
      });
      assert.ok(adminUser, 'Seed admin user must exist');
      assert.equal(adminUser.role, 'ADMIN');

      hotel = await prisma.hotel.findFirst({
        where: { partnerId: partnerUser.partnerProfile.id, isActive: true },
        include: { rooms: { where: { status: 'AVAILABLE' } } },
      });
      assert.ok(hotel, 'At least one active partner hotel must exist');
      assert.ok(hotel.rooms.length > 0, 'Hotel must have at least one available room');
      room = hotel.rooms[0];
    });
  });

  describe('2. Customer Hotel Search & Room Availability', () => {
    it('finds hotel and confirms room availability for target dates', async () => {
      const availableRooms = await prisma.room.findMany({
        where: {
          hotelId: hotel.id,
          status: 'AVAILABLE',
        },
      });

      assert.ok(availableRooms.length > 0, 'Target room must be available');
      assert.ok(room.pricePerNight > 0, 'Room price per night must be greater than zero');
    });
  });

  describe('3. Customer Creates Booking', () => {
    it('creates a fresh booking in PENDING status with authoritative calculation', async () => {
      const checkIn = '2030-01-10';
      const checkOut = '2030-01-12'; // 2 nights

      const booking = await bookingService.createBooking(customerUser.id, {
        hotelId: hotel.id,
        roomId: room.id,
        checkIn,
        checkOut,
        roomsCount: 1,
        guestsCount: 2,
        guestDetails: {
          fullName: customerUser.fullName,
          email: customerUser.email,
          phone: '+1-555-0199',
        },
        specialRequests: 'Phase 16 E2E Test Stay',
      });

      assert.ok(booking.id, 'Booking must have an id');
      e2eBookingId = booking.id;
      assert.equal(booking.bookingStatus, 'PENDING');
      assert.equal(booking.paymentStatus, 'PENDING');
      assert.equal(booking.numberOfNights, 2);
      assert.equal(Number(booking.totalAmount), Number(room.pricePerNight) * 2);
    });
  });

  describe('4. Customer Completes Payment & Triggers Notifications', () => {
    it('completes online payment (SUCCESS) and transitions booking to CONFIRMED', async () => {
      const payment = await paymentService.createPayment(customerUser.id, {
        bookingId: e2eBookingId,
        paymentMethod: 'CARD',
        simulateFailure: false,
      });

      assert.equal(payment.status, 'SUCCESS');
      assert.ok(payment.transactionId && payment.transactionId.startsWith('TXN-'));

      const booking = await prisma.booking.findUniqueOrThrow({
        where: { id: e2eBookingId },
      });
      assert.equal(booking.paymentStatus, 'PAID');
      assert.equal(booking.bookingStatus, 'CONFIRMED');

      // Verify in-app notifications generated
      const notifications = await prisma.notification.findMany({
        where: { userId: customerUser.id },
        orderBy: { createdAt: 'desc' },
        take: 3,
      });
      assert.ok(notifications.length > 0, 'Customer must receive notification');
    });
  });

  describe('5. Partner Views Booking', () => {
    it('partner retrieves confirmed booking under their hotel', async () => {
      const partnerBooking = await prisma.booking.findFirst({
        where: {
          id: e2eBookingId,
          hotel: { partnerId: partnerUser.partnerProfile.id },
        },
        include: { hotel: true, payment: true },
      });

      assert.ok(partnerBooking, 'Booking must appear in partner hotel bookings');
      assert.equal(partnerBooking.paymentStatus, 'PAID');
      assert.equal(partnerBooking.bookingStatus, 'CONFIRMED');
    });
  });

  describe('6. Stay Concludes & Customer Submits Review', () => {
    it('transitions booking to COMPLETED and customer submits review', async () => {
      // Advance booking to COMPLETED
      await prisma.booking.update({
        where: { id: e2eBookingId },
        data: { bookingStatus: 'COMPLETED' },
      });

      const review = await reviewService.createReview(customerUser.id, {
        bookingId: e2eBookingId,
        rating: 5,
        comment: 'Outstanding stay verified via Phase 16 E2E integration test!',
      });

      assert.ok(review.id);
      assert.equal(review.rating, 5);
      assert.equal(review.isPublished, true);

      // Verify hotel rating aggregate updated
      const updatedHotel = await prisma.hotel.findUniqueOrThrow({
        where: { id: hotel.id },
      });
      assert.ok(updatedHotel.reviewCount > 0);
      assert.ok(updatedHotel.ratingScore !== null && Number(updatedHotel.ratingScore) >= 1);
    });

    it('enforces duplicate review prevention (409 Conflict)', async () => {
      let duplicateThrew = false;
      try {
        await reviewService.createReview(customerUser.id, {
          bookingId: e2eBookingId,
          rating: 4,
          comment: 'Duplicate attempt',
        });
      } catch (err: unknown) {
        if (err instanceof ApiError && err.statusCode === 409) {
          duplicateThrew = true;
        }
      }
      assert.equal(duplicateThrew, true, 'Must reject duplicate review with 409 Conflict');
    });
  });

  describe('7. Partner Checks Earnings & Requests Payout', () => {
    it('calculates available earnings and submits batch payout request', async () => {
      const earnings = await payoutService.getPartnerEarningsSummary(partnerUser.id);
      assert.ok(earnings.metrics.availableBalance >= 0);

      const batch = await payoutService.requestPartnerPayout(partnerUser.id, {
        bookingIds: [e2eBookingId],
      });

      assert.ok(batch.batchReference);
      assert.ok(batch.payouts && batch.payouts.length > 0);
      assert.equal(batch.payouts[0].status, 'PENDING');
      assert.ok(batch.totalNet > 0);
      assert.ok(batch.totalCommission >= 0);

      e2ePayoutId = batch.payouts[0].id;
    });

    it('prevents duplicate payout request for the same booking', async () => {
      let duplicatePayoutThrew = false;
      try {
        await payoutService.requestPartnerPayout(partnerUser.id, {
          bookingIds: [e2eBookingId],
        });
      } catch (err: any) {
        if (err?.statusCode === 400 || (err instanceof ApiError && err.statusCode === 400)) {
          duplicatePayoutThrew = true;
        }
      }
      assert.equal(duplicatePayoutThrew, true, 'Must reject duplicate payout request');
    });
  });

  describe('8. Admin Processes Payout to PAID', () => {
    it('admin approves PENDING payout to PROCESSING', async () => {
      const approved = await payoutService.updateAdminPayoutStatus(adminUser.id, e2ePayoutId, {
        action: 'APPROVE',
        notes: 'Approved during Phase 16 E2E integration test',
      });

      assert.equal(approved.status, 'PROCESSING');
    });

    it('admin marks PROCESSING payout as PAID with transaction reference', async () => {
      const paid = await payoutService.updateAdminPayoutStatus(adminUser.id, e2ePayoutId, {
        action: 'MARK_PAID',
        transactionReference: `BANK-E2E-${Date.now()}`,
        notes: 'Disbursed via automated bank transfer',
      });

      assert.equal(paid.status, 'PAID');
      assert.ok(paid.transactionReference?.startsWith('BANK-E2E-'));
    });

    it('prevents modifying completed PAID payout (immutability)', async () => {
      let modThrew = false;
      try {
        await payoutService.updateAdminPayoutStatus(adminUser.id, e2ePayoutId, {
          action: 'REJECT',
          rejectionReason: 'Should not allow altering completed payout',
        });
      } catch (err: any) {
        if (err?.statusCode === 400 || (err instanceof ApiError && err.statusCode === 400)) {
          modThrew = true;
        }
      }
      assert.equal(modThrew, true, 'Must reject modifying completed PAID payout');
    });
  });

  describe('9. Negative Branches: Payment Failure, Cancellations, and Refunds', () => {
    let failBookingId: string;

    it('creates a booking and handles payment failure cleanly', async () => {
      const booking = await bookingService.createBooking(customerUser.id, {
        hotelId: hotel.id,
        roomId: room.id,
        checkIn: '2030-02-01',
        checkOut: '2030-02-03',
        roomsCount: 1,
        guestsCount: 1,
        guestDetails: {
          fullName: 'Test Guest',
          email: 'guest@example.com',
          phone: '+1-555-0100',
        },
      });
      failBookingId = booking.id;

      const failedPayment = await paymentService.createPayment(customerUser.id, {
        bookingId: failBookingId,
        paymentMethod: 'CARD',
        simulateFailure: true,
      });

      assert.equal(failedPayment.status, 'FAILED');

      const bookingAfter = await prisma.booking.findUniqueOrThrow({
        where: { id: failBookingId },
      });
      assert.equal(bookingAfter.paymentStatus, 'FAILED');
      assert.equal(bookingAfter.bookingStatus, 'PENDING');
    });

    it('handles cancellation and refund for a paid booking', async () => {
      // Retry and pay for the failed booking
      await paymentService.createPayment(customerUser.id, {
        bookingId: failBookingId,
        paymentMethod: 'UPI',
        simulateFailure: false,
      });

      // Customer cancels the booking
      const cancelled = await bookingService.cancelCustomerBooking(customerUser.id, failBookingId, 'Change of travel plans');
      assert.equal(cancelled.bookingStatus, 'CANCELLED');

      // Process refund via authoritative payment service
      const paymentRecord = await prisma.payment.findUniqueOrThrow({
        where: { bookingId: failBookingId },
      });
      const refundedPayment = await paymentService.updatePaymentStatus(
        adminUser.id,
        paymentRecord.id,
        'REFUNDED',
        'Customer cancellation refund',
      );
      assert.equal(refundedPayment.status, 'REFUNDED');

      const bookingFinal = await prisma.booking.findUniqueOrThrow({
        where: { id: failBookingId },
      });
      assert.equal(bookingFinal.paymentStatus, 'REFUNDED');
      assert.equal(bookingFinal.bookingStatus, 'CANCELLED');
    });
  });

  describe('10. Multi-Role Authorization & Access Control (403 Enforcement)', () => {
    it('customer cannot review another user booking', async () => {
      const otherUser = await prisma.user.findFirst({
        where: { role: 'CUSTOMER', id: { not: customerUser.id } },
      });

      if (otherUser) {
        let threw = false;
        try {
          await reviewService.createReview(otherUser.id, {
            bookingId: e2eBookingId,
            rating: 5,
          });
        } catch (err: any) {
          if (err?.statusCode === 403 || (err instanceof ApiError && err.statusCode === 403)) {
            threw = true;
          }
        }
        assert.equal(threw, true, 'Customer must not review another user booking');
      }
    });

    it('partner cannot request payout on another partner hotel', async () => {
      const otherPartner = await prisma.partnerProfile.findFirst({
        where: { id: { not: partnerUser.partnerProfile.id }, status: 'APPROVED' },
        include: { user: true },
      });

      if (otherPartner) {
        let threw = false;
        try {
          await payoutService.requestPartnerPayout(otherPartner.user.id, {
            bookingIds: [e2eBookingId],
          });
        } catch (err: any) {
          if (
            err?.statusCode === 400 ||
            err?.statusCode === 403 ||
            (err instanceof ApiError && (err.statusCode === 400 || err.statusCode === 403))
          ) {
            threw = true;
          }
        }
        assert.equal(threw, true, 'Partner cannot request payout for another partner booking');
      }
    });

    it('regular customer cannot perform admin payout actions (403 Forbidden)', async () => {
      const middleware = requireRole('ADMIN');
      const req: any = { auth: { userId: customerUser.id, role: 'CUSTOMER' } };
      let authError: any = null;
      await middleware(req, {} as any, (err?: any) => {
        authError = err;
      });

      assert.ok(authError, 'requireRole must return an error for customer user');
      assert.equal(authError.statusCode, 403, 'Must reject with HTTP 403 Forbidden');
    });
  });
});
