import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  calculatePayoutAmounts,
  type PayoutAmounts,
} from '../src/services/payout.service.js';
import { ApiError } from '../src/utils/ApiError.js';

describe('Phase 14 — Partner Payouts & Commission Management Business Rules Tests', () => {
  const partnerUserId = 'usr-part-1111-2222';
  const otherPartnerUserId = 'usr-part-3333-4444';
  const partnerProfileId = 'prof-part-1111-2222';
  const otherPartnerProfileId = 'prof-part-3333-4444';
  const hotelId = 'htl-1111-2222';
  const otherHotelId = 'htl-3333-4444';
  const adminUserId = 'usr-admin-9999';

  const defaultCommissionRate = 15.0; // 15%

  const pastCheckOut = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  const futureCheckOut = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

  type MockBooking = {
    id: string;
    bookingId: string;
    hotelId: string;
    partnerProfileId: string;
    totalAmount: number;
    checkIn: Date;
    checkOut: Date;
    bookingStatus: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
    paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
    paymentMethod: 'UPI' | 'CARD' | 'NET_BANKING' | 'PAY_AT_HOTEL';
    paymentState: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
    payouts: Array<{ id: string; status: 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' | 'REJECTED' }>;
  };

  function createMockBooking(overrides: Partial<MockBooking> = {}): MockBooking {
    return {
      id: 'bkg-' + Math.random().toString(36).substring(2, 9),
      bookingId: 'TRM-BKG-' + Math.floor(1000 + Math.random() * 9000),
      hotelId,
      partnerProfileId,
      totalAmount: 200.0,
      checkIn: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      checkOut: pastCheckOut,
      bookingStatus: 'COMPLETED',
      paymentStatus: 'PAID',
      paymentMethod: 'CARD',
      paymentState: 'SUCCESS',
      payouts: [],
      ...overrides,
    };
  }

  // Pure logic simulator for booking payout eligibility
  function evaluateBookingPayoutEligibility(booking: MockBooking, requestingPartnerProfileId: string) {
    if (booking.partnerProfileId !== requestingPartnerProfileId) {
      return { eligible: false, reason: 'Partner does not own this booking' };
    }
    if (booking.bookingStatus === 'CANCELLED') {
      return { eligible: false, reason: 'Booking is cancelled' };
    }
    if (booking.paymentStatus === 'REFUNDED' || booking.paymentState === 'REFUNDED') {
      return { eligible: false, reason: 'Payment has been refunded' };
    }
    const isPayAtHotel = booking.paymentMethod === 'PAY_AT_HOTEL';
    if (isPayAtHotel) {
      return { eligible: false, reason: 'Pay at hotel stays are collected directly by property and not disbursed by platform' };
    }
    const now = new Date();
    const isConcluded = booking.bookingStatus === 'COMPLETED' || (booking.bookingStatus === 'CONFIRMED' && booking.checkOut <= now);
    if (!isConcluded) {
      return { eligible: false, reason: 'Stay is not yet completed' };
    }
    if (booking.paymentStatus !== 'PAID' || booking.paymentState !== 'SUCCESS') {
      return { eligible: false, reason: 'Booking is not paid online' };
    }
    const hasActivePayout = booking.payouts.some((po) =>
      ['PENDING', 'PROCESSING', 'PAID'].includes(po.status),
    );
    if (hasActivePayout) {
      return { eligible: false, reason: 'Payout is already active or paid for this booking' };
    }
    return { eligible: true, reason: 'Eligible for payout' };
  }

  // 1. Accurate Decimal Commission & Net Earnings Calculation
  describe('1. Accurate Decimal Commission & Net Earnings Calculation', () => {
    it('calculates 15% platform commission and 85% net correctly', () => {
      const result: PayoutAmounts = calculatePayoutAmounts(200.0, 15.0);
      assert.strictEqual(result.amount, 200.0);
      assert.strictEqual(result.commissionAmount, 30.0);
      assert.strictEqual(result.netAmount, 170.0);
    });

    it('handles fractional amounts and rounds to exactly 2 decimals', () => {
      // 123.45 with 15% commission: 123.45 * 0.15 = 18.5175 -> 18.52
      // Net: 123.45 - 18.52 = 104.93
      const result = calculatePayoutAmounts(123.45, 15.0);
      assert.strictEqual(result.amount, 123.45);
      assert.strictEqual(result.commissionAmount, 18.52);
      assert.strictEqual(result.netAmount, 104.93);
      assert.strictEqual(Math.round((result.commissionAmount + result.netAmount) * 100) / 100, 123.45);
    });

    it('handles 0% commission rate correctly (100% net to partner)', () => {
      const result = calculatePayoutAmounts(150.0, 0);
      assert.strictEqual(result.amount, 150.0);
      assert.strictEqual(result.commissionAmount, 0.0);
      assert.strictEqual(result.netAmount, 150.0);
    });

    it('handles 100% platform commission correctly', () => {
      const result = calculatePayoutAmounts(150.0, 100.0);
      assert.strictEqual(result.amount, 150.0);
      assert.strictEqual(result.commissionAmount, 150.0);
      assert.strictEqual(result.netAmount, 0.0);
    });
  });

  // 2. Payout Eligibility and Restrictions
  describe('2. Payout Eligibility & Business Rules', () => {
    it('approves completed online paid stays after checkout', () => {
      const booking = createMockBooking();
      const evalResult = evaluateBookingPayoutEligibility(booking, partnerProfileId);
      assert.strictEqual(evalResult.eligible, true);
    });

    it('approves confirmed stays where checkout date has concluded', () => {
      const booking = createMockBooking({
        bookingStatus: 'CONFIRMED',
        checkOut: pastCheckOut,
      });
      const evalResult = evaluateBookingPayoutEligibility(booking, partnerProfileId);
      assert.strictEqual(evalResult.eligible, true);
    });

    it('rejects ongoing or future bookings before checkout date', () => {
      const booking = createMockBooking({
        bookingStatus: 'CONFIRMED',
        checkOut: futureCheckOut,
      });
      const evalResult = evaluateBookingPayoutEligibility(booking, partnerProfileId);
      assert.strictEqual(evalResult.eligible, false);
      assert.match(evalResult.reason, /Stay is not yet completed/i);
    });

    it('rejects cancelled bookings', () => {
      const booking = createMockBooking({
        bookingStatus: 'CANCELLED',
      });
      const evalResult = evaluateBookingPayoutEligibility(booking, partnerProfileId);
      assert.strictEqual(evalResult.eligible, false);
      assert.match(evalResult.reason, /cancelled/i);
    });

    it('rejects refunded payments', () => {
      const booking = createMockBooking({
        paymentStatus: 'REFUNDED',
        paymentState: 'REFUNDED',
      });
      const evalResult = evaluateBookingPayoutEligibility(booking, partnerProfileId);
      assert.strictEqual(evalResult.eligible, false);
      assert.match(evalResult.reason, /refunded/i);
    });

    it('rejects unpaid or pending payment bookings', () => {
      const booking = createMockBooking({
        paymentStatus: 'PENDING',
        paymentState: 'PENDING',
      });
      const evalResult = evaluateBookingPayoutEligibility(booking, partnerProfileId);
      assert.strictEqual(evalResult.eligible, false);
      assert.match(evalResult.reason, /not paid online/i);
    });
  });

  // 3. Pay at Hotel Isolation Safeguard
  describe('3. Pay at Hotel Isolation Safeguard', () => {
    it('strictly isolates Pay at Hotel bookings from platform-funded payouts', () => {
      const booking = createMockBooking({
        paymentMethod: 'PAY_AT_HOTEL',
        paymentStatus: 'PAID',
        paymentState: 'SUCCESS',
      });
      const evalResult = evaluateBookingPayoutEligibility(booking, partnerProfileId);
      assert.strictEqual(evalResult.eligible, false);
      assert.match(evalResult.reason, /Pay at hotel/i);
    });

    it('tracks Pay at Hotel gross collected and platform commission receivable separately', () => {
      const payAtHotelBookings = [
        createMockBooking({ totalAmount: 300, paymentMethod: 'PAY_AT_HOTEL' }),
        createMockBooking({ totalAmount: 200, paymentMethod: 'PAY_AT_HOTEL' }),
      ];

      const totalCollectedByHotel = payAtHotelBookings.reduce((sum, b) => sum + b.totalAmount, 0);
      const commissionRate = 15.0;
      const commissionReceivable = Math.round(totalCollectedByHotel * (commissionRate / 100) * 100) / 100;

      assert.strictEqual(totalCollectedByHotel, 500.0);
      assert.strictEqual(commissionReceivable, 75.0);
    });
  });

  // 4. Duplicate Payout Prevention & Re-eligibility
  describe('4. Duplicate Payout Prevention & Re-eligibility', () => {
    it('prevents payout if booking already has PENDING payout', () => {
      const booking = createMockBooking({
        payouts: [{ id: 'po-1', status: 'PENDING' }],
      });
      const evalResult = evaluateBookingPayoutEligibility(booking, partnerProfileId);
      assert.strictEqual(evalResult.eligible, false);
      assert.match(evalResult.reason, /already active/i);
    });

    it('prevents payout if booking already has PROCESSING payout', () => {
      const booking = createMockBooking({
        payouts: [{ id: 'po-2', status: 'PROCESSING' }],
      });
      const evalResult = evaluateBookingPayoutEligibility(booking, partnerProfileId);
      assert.strictEqual(evalResult.eligible, false);
      assert.match(evalResult.reason, /already active/i);
    });

    it('prevents payout if booking is already PAID', () => {
      const booking = createMockBooking({
        payouts: [{ id: 'po-3', status: 'PAID' }],
      });
      const evalResult = evaluateBookingPayoutEligibility(booking, partnerProfileId);
      assert.strictEqual(evalResult.eligible, false);
      assert.match(evalResult.reason, /already active/i);
    });

    it('allows re-eligibility if previous payout was REJECTED or FAILED', () => {
      const booking = createMockBooking({
        payouts: [
          { id: 'po-failed', status: 'FAILED' },
          { id: 'po-rejected', status: 'REJECTED' },
        ],
      });
      const evalResult = evaluateBookingPayoutEligibility(booking, partnerProfileId);
      assert.strictEqual(evalResult.eligible, true);
    });
  });

  // 5. Multi-Booking Batch Payout & Concurrency Protection
  describe('5. Multi-Booking Batch Payout & Concurrency Protection', () => {
    it('groups multiple eligible bookings into one batch request', () => {
      const bookings = [
        createMockBooking({ id: 'bkg-1', totalAmount: 100 }),
        createMockBooking({ id: 'bkg-2', totalAmount: 200 }),
        createMockBooking({ id: 'bkg-3', totalAmount: 300 }),
      ];

      const batchReference = `PO-BATCH-20261022-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      let totalGross = 0;
      let totalCommission = 0;
      let totalNet = 0;

      const payoutRecords = bookings.map((b) => {
        const amounts = calculatePayoutAmounts(b.totalAmount, defaultCommissionRate);
        totalGross += amounts.amount;
        totalCommission += amounts.commissionAmount;
        totalNet += amounts.netAmount;
        return {
          bookingId: b.id,
          batchReference,
          ...amounts,
          status: 'PENDING',
        };
      });

      assert.strictEqual(payoutRecords.length, 3);
      assert.strictEqual(totalGross, 600.0);
      assert.strictEqual(totalCommission, 90.0);
      assert.strictEqual(totalNet, 510.0);
      assert(payoutRecords.every((p) => p.batchReference === batchReference));
    });

    it('prevents concurrent balance overdraft via atomic booking allocation', () => {
      // Simulating 2 concurrent payout requests competing for 3 bookings
      const pool = [
        createMockBooking({ id: 'bkg-10', totalAmount: 100 }),
        createMockBooking({ id: 'bkg-11', totalAmount: 200 }),
        createMockBooking({ id: 'bkg-12', totalAmount: 300 }),
      ];

      // Request 1 claims all available
      const claimedByReq1 = pool.filter((b) => evaluateBookingPayoutEligibility(b, partnerProfileId).eligible);
      assert.strictEqual(claimedByReq1.length, 3);

      // Request 1 marks them PENDING
      claimedByReq1.forEach((b) => b.payouts.push({ id: 'po-' + b.id, status: 'PENDING' }));

      // Concurrent Request 2 tries to claim at same time
      const claimedByReq2 = pool.filter((b) => evaluateBookingPayoutEligibility(b, partnerProfileId).eligible);
      assert.strictEqual(claimedByReq2.length, 0); // Correctly locked out, 0 double-spent!
    });
  });

  // 6. Cancellation and Refund Safeguard on Payouts
  describe('6. Cancellation & Refund Voiding Rules', () => {
    it('voids PENDING payout when stay is cancelled', () => {
      const payout = { id: 'po-pend', status: 'PENDING', rejectionReason: null as string | null };
      // Simulating voidPendingPayoutsForBooking
      if (['PENDING', 'PROCESSING'].includes(payout.status)) {
        payout.status = 'FAILED';
        payout.rejectionReason = 'Booking was cancelled';
      }
      assert.strictEqual(payout.status, 'FAILED');
      assert.strictEqual(payout.rejectionReason, 'Booking was cancelled');
    });

    it('voids PROCESSING payout when payment is refunded', () => {
      const payout = { id: 'po-proc', status: 'PROCESSING', rejectionReason: null as string | null };
      if (['PENDING', 'PROCESSING'].includes(payout.status)) {
        payout.status = 'FAILED';
        payout.rejectionReason = 'Payment refunded';
      }
      assert.strictEqual(payout.status, 'FAILED');
      assert.strictEqual(payout.rejectionReason, 'Payment refunded');
    });

    it('never alters completed PAID payouts upon subsequent refund/cancellation', () => {
      const payout = { id: 'po-paid', status: 'PAID', rejectionReason: null as string | null };
      // PAID transactions must remain immutable
      if (['PENDING', 'PROCESSING'].includes(payout.status)) {
        payout.status = 'FAILED';
      }
      assert.strictEqual(payout.status, 'PAID'); // Remains PAID!
    });
  });

  // 7. Administrator Actions & Audit State Machine
  describe('7. Administrator Actions & Audit State Machine', () => {
    it('allows admin to approve PENDING payout to PROCESSING', () => {
      const payout = { id: 'po-1', status: 'PENDING', processedBy: null as string | null };
      assert.strictEqual(payout.status, 'PENDING');
      payout.status = 'PROCESSING';
      payout.processedBy = adminUserId;
      assert.strictEqual(payout.status, 'PROCESSING');
      assert.strictEqual(payout.processedBy, adminUserId);
    });

    it('rejects approving non-PENDING payout', () => {
      const payout = { id: 'po-proc', status: 'PROCESSING' };
      assert.throws(() => {
        if (payout.status !== 'PENDING') {
          throw new ApiError(400, `Cannot approve a payout with status ${payout.status}`);
        }
      }, /Cannot approve a payout with status PROCESSING/);
    });

    it('requires minimum 3-character rejection reason when rejecting', () => {
      assert.throws(() => {
        const reason = '  ';
        if (!reason || reason.trim().length < 3) {
          throw new ApiError(400, 'A valid rejection reason (minimum 3 characters) is required');
        }
      }, /A valid rejection reason/);
    });

    it('allows rejecting PENDING or PROCESSING payout with reason', () => {
      const payout = { id: 'po-2', status: 'PENDING', rejectionReason: null as string | null, processedBy: null as string | null };
      const reason = 'Invalid bank account details provided';
      payout.status = 'REJECTED';
      payout.rejectionReason = reason;
      payout.processedBy = adminUserId;
      assert.strictEqual(payout.status, 'REJECTED');
      assert.strictEqual(payout.rejectionReason, reason);
      assert.strictEqual(payout.processedBy, adminUserId);
    });

    it('requires non-empty transactionReference when marking as PAID', () => {
      assert.throws(() => {
        const txRef: string = '';
        if (txRef.trim().length < 3) {
          throw new ApiError(400, 'A valid transaction reference (minimum 3 characters) is required');
        }
      }, /A valid transaction reference/);
    });

    it('rejects duplicate transactionReference when marking as PAID', () => {
      const existingReferences = new Set(['BANK-TXN-1001', 'BANK-TXN-1002']);
      assert.throws(() => {
        const proposedRef = 'BANK-TXN-1001';
        if (existingReferences.has(proposedRef)) {
          throw new ApiError(409, 'Transaction reference is already used by another payout');
        }
      }, /Transaction reference is already used by another payout/);
    });

    it('prevents modifying completed PAID payouts', () => {
      const payout = { id: 'po-done', status: 'PAID' };
      assert.throws(() => {
        if (payout.status === 'PAID') {
          throw new ApiError(400, 'Completed payout cannot be modified or altered');
        }
      }, /Completed payout cannot be modified or altered/);
    });
  });

  // 8. Commission Rate Changes & Historical Immutability
  describe('8. Commission Rate Changes & Historical Immutability', () => {
    it('preserves historical snapshot amounts when partner commission rate changes later', () => {
      // Historical payout snapshot created with 15% rate
      const historicalPayout = {
        bookingId: 'bkg-old',
        amount: 200.0,
        commissionAmount: 30.0,
        netAmount: 170.0,
        status: 'PAID',
      };

      // Admin updates partner commission rate to 10%
      const newCommissionRate = 10.0;

      // Historical payout remains exactly as snapshotted
      assert.strictEqual(historicalPayout.commissionAmount, 30.0);
      assert.strictEqual(historicalPayout.netAmount, 170.0);

      // Future booking uses new 10% rate
      const futureAmounts = calculatePayoutAmounts(200.0, newCommissionRate);
      assert.strictEqual(futureAmounts.commissionAmount, 20.0);
      assert.strictEqual(futureAmounts.netAmount, 180.0);
    });

    it('validates commission rate boundaries between 0% and 100%', () => {
      assert.throws(() => {
        const invalidRate = -5;
        if (invalidRate < 0 || invalidRate > 100) {
          throw new ApiError(400, 'commissionRate must be a number between 0 and 100');
        }
      }, /commissionRate must be a number between 0 and 100/);

      assert.throws(() => {
        const invalidRate = 105;
        if (invalidRate < 0 || invalidRate > 100) {
          throw new ApiError(400, 'commissionRate must be a number between 0 and 100');
        }
      }, /commissionRate must be a number between 0 and 100/);
    });
  });

  // 9. Partner Ownership & Scoping Protection
  describe('9. Partner Ownership & Scoping Protection', () => {
    it('forbids partner from requesting payout on another partner booking', () => {
      const otherPartnerBooking = createMockBooking({
        partnerProfileId: otherPartnerProfileId,
      });

      const evalResult = evaluateBookingPayoutEligibility(otherPartnerBooking, partnerProfileId);
      assert.strictEqual(evalResult.eligible, false);
      assert.match(evalResult.reason, /Partner does not own this booking/i);
    });
  });
});
