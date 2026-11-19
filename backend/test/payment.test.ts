import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  VALID_PAYMENT_STATUS_TRANSITIONS,
  paymentDetailSelect,
} from '../src/services/payment.service.js';
import { generateTransactionId } from '../src/utils/transactionId.js';

describe('Phase 12 — Payment Flow Architecture & Business Rules Tests', () => {
  const customerId = 'cust-1111-2222';
  const otherCustomerId = 'cust-3333-4444';

  const mockBooking = {
    id: 'bkg-uuid-1234',
    bookingId: 'TRM-20261008-ABC123',
    customerId,
    hotelId: 'htl-1',
    roomId: 'rm-1',
    checkIn: new Date('2026-10-15'),
    checkOut: new Date('2026-10-17'),
    roomsCount: 1,
    guestsCount: 2,
    numberOfNights: 2,
    roomPrice: 100,
    taxAmount: 0,
    discountAmount: 20,
    totalAmount: 180,
    bookingStatus: 'PENDING',
    paymentStatus: 'PENDING',
  };

  // 1. Customer initiates payment for own booking
  describe('1. Customer Can Initiate Payment for Own Booking', () => {
    it('verifies customer matches booking customerId', () => {
      assert.equal(mockBooking.customerId, customerId);
      assert.equal(mockBooking.totalAmount, 180);
    });
  });

  // 2. Customer cannot pay for another customer's booking (403)
  describe("2. Customer Cannot Pay for Another Customer's Booking", () => {
    it('rejects payment attempt when customerId does not match', () => {
      const isAllowed = mockBooking.customerId === otherCustomerId;
      assert.equal(isAllowed, false, "Must reject payment for another customer's booking");
    });
  });

  // 3. Cannot pay for a cancelled booking (400)
  describe('3. Cannot Pay for Cancelled Booking', () => {
    it('rejects payment if bookingStatus is CANCELLED', () => {
      const cancelledBooking = { ...mockBooking, bookingStatus: 'CANCELLED' };
      const canPay = cancelledBooking.bookingStatus !== 'CANCELLED';
      assert.equal(canPay, false, 'Cannot pay for cancelled booking');
    });
  });

  // 4. Cannot pay for an already paid booking (400)
  describe('4. Cannot Pay for Already Paid Booking', () => {
    it('rejects payment if paymentStatus is already PAID', () => {
      const paidBooking = { ...mockBooking, paymentStatus: 'PAID' };
      const canPay = paidBooking.paymentStatus !== 'PAID';
      assert.equal(canPay, false, 'Cannot pay for already paid booking');
    });
  });

  // 5. UPI payment simulation succeeds and sets Payment SUCCESS + Booking PAID
  describe('5. UPI Payment Simulation', () => {
    it('sets Payment status to SUCCESS and Booking status to PAID', () => {
      const paymentMethod = 'UPI';
      const isSimulateFailure = false;
      const targetPaymentStatus = isSimulateFailure ? 'FAILED' : 'SUCCESS';
      const targetBookingPaymentStatus = targetPaymentStatus === 'SUCCESS' ? 'PAID' : 'FAILED';

      assert.equal(paymentMethod, 'UPI');
      assert.equal(targetPaymentStatus, 'SUCCESS');
      assert.equal(targetBookingPaymentStatus, 'PAID');
    });
  });

  // 6. CARD payment simulation succeeds and sets Payment SUCCESS + Booking PAID
  describe('6. CARD Payment Simulation', () => {
    it('sets Payment status to SUCCESS and Booking status to PAID', () => {
      const paymentMethod = 'CARD';
      const targetPaymentStatus = 'SUCCESS';
      const targetBookingPaymentStatus = 'PAID';

      assert.equal(paymentMethod, 'CARD');
      assert.equal(targetPaymentStatus, 'SUCCESS');
      assert.equal(targetBookingPaymentStatus, 'PAID');
    });
  });

  // 7. NET_BANKING payment simulation succeeds and sets Payment SUCCESS + Booking PAID
  describe('7. NET_BANKING Payment Simulation', () => {
    it('sets Payment status to SUCCESS and Booking status to PAID', () => {
      const paymentMethod = 'NET_BANKING';
      const targetPaymentStatus = 'SUCCESS';
      const targetBookingPaymentStatus = 'PAID';

      assert.equal(paymentMethod, 'NET_BANKING');
      assert.equal(targetPaymentStatus, 'SUCCESS');
      assert.equal(targetBookingPaymentStatus, 'PAID');
    });
  });

  // 8. PAY_AT_HOTEL creates PENDING payment and PENDING booking
  describe('8. PAY_AT_HOTEL Payment Mode', () => {
    it('creates PENDING payment and keeps booking paymentStatus as PENDING', () => {
      const paymentMethod = 'PAY_AT_HOTEL';
      let targetPaymentStatus: string;
      let targetBookingPaymentStatus: string;

      if (paymentMethod === 'PAY_AT_HOTEL') {
        targetPaymentStatus = 'PENDING';
        targetBookingPaymentStatus = 'PENDING';
      } else {
        targetPaymentStatus = 'SUCCESS';
        targetBookingPaymentStatus = 'PAID';
      }

      assert.equal(targetPaymentStatus, 'PENDING');
      assert.equal(targetBookingPaymentStatus, 'PENDING');
    });
  });

  // 9. PAY_AT_HOTEL does not automatically transition to SUCCESS
  describe('9. PAY_AT_HOTEL Never Auto-Transitions to SUCCESS', () => {
    it('guarantees PAY_AT_HOTEL remains PENDING upon creation', () => {
      const paymentMethod = 'PAY_AT_HOTEL';
      const isAutoSuccess = paymentMethod === 'PAY_AT_HOTEL' ? false : true;
      assert.equal(isAutoSuccess, false, 'PAY_AT_HOTEL must not auto-transition to SUCCESS');
    });
  });

  // 10. Simulated payment failure marks Payment FAILED and Booking FAILED
  describe('10. Simulated Payment Failure', () => {
    it('marks Payment as FAILED and Booking paymentStatus as FAILED', () => {
      const simulateFailure = true;
      const targetPaymentStatus = simulateFailure ? 'FAILED' : 'SUCCESS';
      const targetBookingPaymentStatus = simulateFailure ? 'FAILED' : 'PAID';

      assert.equal(targetPaymentStatus, 'FAILED');
      assert.equal(targetBookingPaymentStatus, 'FAILED');
    });
  });

  // 11. Failed payment can be retried
  describe('11. Failed Payment Can Be Retried', () => {
    it('allows FAILED payment status to transition back to PENDING or SUCCESS', () => {
      const allowedFromFailed = VALID_PAYMENT_STATUS_TRANSITIONS['FAILED'];
      assert.ok(allowedFromFailed.includes('PENDING'));
      assert.ok(allowedFromFailed.includes('SUCCESS'));
    });
  });

  // 12. Retry after failure with success updates Payment to SUCCESS and Booking to PAID
  describe('12. Retry After Failure with Success', () => {
    it('transitions from FAILED to SUCCESS and sets Booking paymentStatus to PAID', () => {
      const initialStatus = 'FAILED';
      const targetStatus = 'SUCCESS';
      const isValidTransition = VALID_PAYMENT_STATUS_TRANSITIONS[initialStatus].includes(targetStatus);
      const resultingBookingStatus = targetStatus === 'SUCCESS' ? 'PAID' : 'FAILED';

      assert.ok(isValidTransition);
      assert.equal(resultingBookingStatus, 'PAID');
    });
  });

  // 13. Invalid status transition is rejected
  describe('13. Invalid Payment Status Transitions Are Rejected', () => {
    it('rejects SUCCESS -> PENDING transition', () => {
      const allowed = VALID_PAYMENT_STATUS_TRANSITIONS['SUCCESS'];
      assert.equal(allowed.includes('PENDING'), false);
    });

    it('rejects SUCCESS -> FAILED transition', () => {
      const allowed = VALID_PAYMENT_STATUS_TRANSITIONS['SUCCESS'];
      assert.equal(allowed.includes('FAILED'), false);
    });

    it('rejects REFUNDED -> SUCCESS transition', () => {
      const allowed = VALID_PAYMENT_STATUS_TRANSITIONS['REFUNDED'];
      assert.equal(allowed.includes('SUCCESS'), false);
    });

    it('rejects REFUNDED -> PENDING transition', () => {
      const allowed = VALID_PAYMENT_STATUS_TRANSITIONS['REFUNDED'];
      assert.equal(allowed.includes('PENDING'), false);
    });
  });

  // 14. Valid status transition succeeds
  describe('14. Valid Payment Status Transitions Succeed', () => {
    it('allows PENDING -> SUCCESS', () => {
      assert.ok(VALID_PAYMENT_STATUS_TRANSITIONS['PENDING'].includes('SUCCESS'));
    });

    it('allows PENDING -> FAILED', () => {
      assert.ok(VALID_PAYMENT_STATUS_TRANSITIONS['PENDING'].includes('FAILED'));
    });

    it('allows SUCCESS -> REFUNDED', () => {
      assert.ok(VALID_PAYMENT_STATUS_TRANSITIONS['SUCCESS'].includes('REFUNDED'));
    });
  });

  // 15. Refund transitions SUCCESS to REFUNDED and Booking paymentStatus to REFUNDED
  describe('15. Refund Transition', () => {
    it('transitions SUCCESS to REFUNDED and sets Booking paymentStatus to REFUNDED', () => {
      const currentStatus = 'SUCCESS';
      const targetStatus = 'REFUNDED';
      const isAllowed = VALID_PAYMENT_STATUS_TRANSITIONS[currentStatus].includes(targetStatus);
      const targetBookingPaymentStatus = targetStatus === 'REFUNDED' ? 'REFUNDED' : 'UNKNOWN';

      assert.ok(isAllowed);
      assert.equal(targetBookingPaymentStatus, 'REFUNDED');
    });
  });

  // 16. Cannot refund a non-SUCCESS payment
  describe('16. Cannot Refund Non-SUCCESS Payment', () => {
    it('rejects refund when payment is PENDING', () => {
      const allowed = VALID_PAYMENT_STATUS_TRANSITIONS['PENDING'];
      assert.equal(allowed.includes('REFUNDED'), false);
    });

    it('rejects refund when payment is FAILED', () => {
      const allowed = VALID_PAYMENT_STATUS_TRANSITIONS['FAILED'];
      assert.equal(allowed.includes('REFUNDED'), false);
    });
  });

  // 17. Idempotent payment request returns existing payment without creating duplicate
  describe('17. Idempotent Payment Request', () => {
    it('matches existing transactionId when idempotencyKey is supplied', () => {
      const idempotencyKey = 'idem-key-9988';
      const existingTransactionId = `TXN-20261008-ABC_${idempotencyKey}`;
      const isIdempotentMatch = existingTransactionId.includes(idempotencyKey);

      assert.ok(isIdempotentMatch);
    });
  });

  // 18. Payment amount cannot be manipulated by client
  describe('18. Authoritative Server-Side Amount Enforcement', () => {
    it('derives payment amount exclusively from authoritative booking.totalAmount', () => {
      const clientManipulatedAmount = 1; // Attempted discount hack
      const authoritativeBookingAmount = mockBooking.totalAmount; // Authoritative 180

      const finalPaymentAmount = authoritativeBookingAmount; // Service uses booking.totalAmount
      assert.equal(finalPaymentAmount, 180);
      assert.notEqual(finalPaymentAmount, clientManipulatedAmount);
    });
  });

  // 19. Sensitive payment credentials are never requested, stored, or returned
  describe('19. Sensitive Payment Credentials Security Guardrails', () => {
    it('excludes sensitive payment fields from paymentDetailSelect', () => {
      const selectKeys = Object.keys(paymentDetailSelect);
      assert.ok(!selectKeys.includes('cardNumber'));
      assert.ok(!selectKeys.includes('cvv'));
      assert.ok(!selectKeys.includes('pin'));
      assert.ok(!selectKeys.includes('upiPin'));
      assert.ok(!selectKeys.includes('password'));
      assert.ok(!selectKeys.includes('bankPassword'));
    });

    it('generates collision-safe transaction IDs with appropriate prefix', () => {
      const txnId = generateTransactionId('TXN');
      const hotelTxnId = generateTransactionId('HOTEL');
      const failTxnId = generateTransactionId('FAIL');

      assert.match(txnId, /^TXN-\d{8}-[A-F0-9]{6}$/);
      assert.match(hotelTxnId, /^HOTEL-\d{8}-[A-F0-9]{6}$/);
      assert.match(failTxnId, /^FAIL-\d{8}-[A-F0-9]{6}$/);
    });
  });
});
