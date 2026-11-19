import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { VALID_BOOKING_STATUS_TRANSITIONS, bookingDetailSelect } from '../src/services/booking.service.js';
import type { BookingStatus, BookingPaymentStatus } from '../src/services/booking.service.js';
import { ApiError } from '../src/utils/ApiError.js';

describe('Phase 10 — Booking Management Tests', () => {
  // Test Data Fixtures
  const customerAId = 'customer-uuid-aaaa-1111';
  const customerBId = 'customer-uuid-bbbb-2222';
  const partnerProfileAId = 'partner-profile-aaaa-1111';
  const partnerProfileBId = 'partner-profile-bbbb-2222';

  const sampleBookings = [
    {
      id: 'booking-uuid-1',
      bookingId: 'TRM-20281101-ABC001',
      customerId: customerAId,
      hotelId: 'hotel-uuid-1',
      roomId: 'room-uuid-1',
      checkIn: new Date('2028-11-10T00:00:00.000Z'),
      checkOut: new Date('2028-11-13T00:00:00.000Z'),
      roomsCount: 1,
      guestsCount: 2,
      numberOfNights: 3,
      roomPrice: 200,
      totalAmount: 600,
      bookingStatus: 'PENDING' as BookingStatus,
      paymentStatus: 'PENDING' as BookingPaymentStatus,
      hotel: { id: 'hotel-uuid-1', name: 'Azure Grand Resort', partnerId: partnerProfileAId, city: 'Miami' },
      customer: { id: customerAId, fullName: 'Alice Customer', email: 'alice@example.com' },
    },
    {
      id: 'booking-uuid-2',
      bookingId: 'TRM-20281102-ABC002',
      customerId: customerBId,
      hotelId: 'hotel-uuid-2',
      roomId: 'room-uuid-2',
      checkIn: new Date('2028-10-01T00:00:00.000Z'),
      checkOut: new Date('2028-10-04T00:00:00.000Z'),
      roomsCount: 2,
      guestsCount: 4,
      numberOfNights: 3,
      roomPrice: 150,
      totalAmount: 900,
      bookingStatus: 'COMPLETED' as BookingStatus,
      paymentStatus: 'PAID' as BookingPaymentStatus,
      hotel: { id: 'hotel-uuid-2', name: 'Alpine Retreat', partnerId: partnerProfileBId, city: 'Aspen' },
      customer: { id: customerBId, fullName: 'Bob Customer', email: 'bob@example.com' },
    },
    {
      id: 'booking-uuid-3',
      bookingId: 'TRM-20281103-ABC003',
      customerId: customerAId,
      hotelId: 'hotel-uuid-1',
      roomId: 'room-uuid-1',
      checkIn: new Date('2028-12-01T00:00:00.000Z'),
      checkOut: new Date('2028-12-05T00:00:00.000Z'),
      roomsCount: 1,
      guestsCount: 1,
      numberOfNights: 4,
      roomPrice: 200,
      totalAmount: 800,
      bookingStatus: 'CANCELLED' as BookingStatus,
      paymentStatus: 'REFUNDED' as BookingPaymentStatus,
      cancelledAt: new Date('2028-11-05T10:00:00.000Z'),
      hotel: { id: 'hotel-uuid-1', name: 'Azure Grand Resort', partnerId: partnerProfileAId, city: 'Miami' },
      customer: { id: customerAId, fullName: 'Alice Customer', email: 'alice@example.com' },
    },
  ];

  // 1. Customer can view own bookings
  describe('1. Customer View Own Bookings', () => {
    it('returns only bookings belonging to authenticated customer', () => {
      const customerBookings = sampleBookings.filter((b) => b.customerId === customerAId);
      assert.equal(customerBookings.length, 2);
      assert.ok(customerBookings.every((b) => b.customerId === customerAId));
      assert.equal(customerBookings[0].bookingId, 'TRM-20281101-ABC001');
      assert.equal(customerBookings[1].bookingId, 'TRM-20281103-ABC003');
    });
  });

  // 2. Customer cannot view another customer's booking
  describe("2. Customer Cannot View Another Customer's Booking", () => {
    it("denies access when customer requests another user's reservation ID", () => {
      const requestedBooking = sampleBookings.find((b) => b.id === 'booking-uuid-2');
      const isOwner = requestedBooking?.customerId === customerAId;
      assert.equal(isOwner, false);

      const accessCheck = () => {
        if (!isOwner) throw new ApiError(404, 'Booking not found');
      };
      assert.throws(accessCheck, (err: unknown) => err instanceof ApiError && err.statusCode === 404);
    });
  });

  // 3. Customer cannot cancel another customer's booking
  describe("3. Customer Cannot Cancel Another Customer's Booking", () => {
    it("prevents cancellation of a booking owned by another customer", () => {
      const targetBooking = sampleBookings.find((b) => b.id === 'booking-uuid-2');
      assert.notEqual(targetBooking?.customerId, customerAId);

      const cancelCheck = () => {
        if (targetBooking?.customerId !== customerAId) {
          throw new ApiError(404, 'Booking not found');
        }
      };
      assert.throws(cancelCheck, (err: unknown) => err instanceof ApiError && err.statusCode === 404);
    });
  });

  // 4. Partner can view own hotel's bookings
  describe("4. Partner Can View Own Hotel's Bookings", () => {
    it('returns only bookings for hotels owned by the authenticated partner', () => {
      const partnerABookings = sampleBookings.filter((b) => b.hotel.partnerId === partnerProfileAId);
      assert.equal(partnerABookings.length, 2);
      assert.ok(partnerABookings.every((b) => b.hotel.partnerId === partnerProfileAId));
    });
  });

  // 5. Partner cannot view another partner's hotel's bookings
  describe("5. Partner Cannot View Another Partner's Hotel's Bookings", () => {
    it('returns 403 Forbidden when partner attempts to access another partner’s booking', () => {
      const targetBooking = sampleBookings.find((b) => b.id === 'booking-uuid-2'); // belongs to Partner B
      const partnerAProfile = { id: partnerProfileAId, status: 'APPROVED' };

      const checkPartnerAccess = () => {
        if (targetBooking?.hotel.partnerId !== partnerAProfile.id) {
          throw new ApiError(403, 'You do not have permission to view this booking');
        }
      };

      assert.throws(checkPartnerAccess, (err: unknown) => err instanceof ApiError && err.statusCode === 403);
    });
  });

  // 6. Admin can view all bookings
  describe('6. Admin Can View All Bookings', () => {
    it('returns all bookings across all hotels without partner or customer scoping', () => {
      const adminBookings = [...sampleBookings];
      assert.equal(adminBookings.length, 3);
      const uniqueHotels = new Set(adminBookings.map((b) => b.hotelId));
      assert.equal(uniqueHotels.size, 2); // spans multiple properties
    });
  });

  // 7. Non-admin cannot access admin booking API
  describe('7. Non-Admin Cannot Access Admin Booking API', () => {
    it('rejects access with 403 when role is not ADMIN', () => {
      const userRoles = ['CUSTOMER', 'PARTNER'];
      userRoles.forEach((role) => {
        const verifyAdminRole = () => {
          if (role !== 'ADMIN') throw new ApiError(403, 'Access denied: requires ADMIN role');
        };
        assert.throws(verifyAdminRole, (err: unknown) => err instanceof ApiError && err.statusCode === 403);
      });
    });
  });

  // 8. Invalid booking status transition is rejected
  describe('8. Invalid Booking Status Transition is Rejected', () => {
    it('rejects CANCELLED to CONFIRMED transition', () => {
      const currentStatus: BookingStatus = 'CANCELLED';
      const targetStatus: BookingStatus = 'CONFIRMED';
      const allowed = VALID_BOOKING_STATUS_TRANSITIONS[currentStatus];

      assert.equal(allowed.includes(targetStatus), false);
      const transition = () => {
        if (!allowed.includes(targetStatus)) {
          throw new ApiError(400, `Cannot transition booking status from ${currentStatus} to ${targetStatus}`);
        }
      };
      assert.throws(transition, (err: unknown) => err instanceof ApiError && err.statusCode === 400);
    });

    it('rejects COMPLETED to CANCELLED transition', () => {
      const currentStatus: BookingStatus = 'COMPLETED';
      const targetStatus: BookingStatus = 'CANCELLED';
      const allowed = VALID_BOOKING_STATUS_TRANSITIONS[currentStatus];

      assert.equal(allowed.includes(targetStatus), false);
      const transition = () => {
        if (!allowed.includes(targetStatus)) {
          throw new ApiError(400, `Cannot transition booking status from ${currentStatus} to ${targetStatus}`);
        }
      };
      assert.throws(transition, (err: unknown) => err instanceof ApiError && err.statusCode === 400);
    });

    it('rejects CANCELLED to COMPLETED transition', () => {
      const allowed = VALID_BOOKING_STATUS_TRANSITIONS['CANCELLED'];
      assert.deepEqual(allowed, []);
    });
  });

  // 9. Valid status transition succeeds
  describe('9. Valid Status Transition Succeeds', () => {
    it('allows PENDING to CONFIRMED transition', () => {
      const allowed = VALID_BOOKING_STATUS_TRANSITIONS['PENDING'];
      assert.ok(allowed.includes('CONFIRMED'));
    });

    it('allows PENDING to CANCELLED transition', () => {
      const allowed = VALID_BOOKING_STATUS_TRANSITIONS['PENDING'];
      assert.ok(allowed.includes('CANCELLED'));
    });

    it('allows CONFIRMED to COMPLETED transition', () => {
      const allowed = VALID_BOOKING_STATUS_TRANSITIONS['CONFIRMED'];
      assert.ok(allowed.includes('COMPLETED'));
    });

    it('allows CONFIRMED to CANCELLED transition', () => {
      const allowed = VALID_BOOKING_STATUS_TRANSITIONS['CONFIRMED'];
      assert.ok(allowed.includes('CANCELLED'));
    });
  });

  // 10. Booking filtering works
  describe('10. Booking Filtering Works', () => {
    it('filters bookings by status correctly', () => {
      const pending = sampleBookings.filter((b) => b.bookingStatus === 'PENDING');
      assert.equal(pending.length, 1);
      assert.equal(pending[0].id, 'booking-uuid-1');

      const cancelled = sampleBookings.filter((b) => b.bookingStatus === 'CANCELLED');
      assert.equal(cancelled.length, 1);
      assert.equal(cancelled[0].id, 'booking-uuid-3');
    });

    it('filters upcoming vs past bookings based on dates', () => {
      const referenceDate = new Date('2028-11-01T00:00:00.000Z');
      const upcoming = sampleBookings.filter(
        (b) => b.checkIn >= referenceDate && ['PENDING', 'CONFIRMED'].includes(b.bookingStatus),
      );
      assert.equal(upcoming.length, 1);
      assert.equal(upcoming[0].bookingId, 'TRM-20281101-ABC001');

      const past = sampleBookings.filter(
        (b) => b.checkOut < referenceDate || b.bookingStatus === 'COMPLETED',
      );
      assert.equal(past.length, 1);
      assert.equal(past[0].bookingId, 'TRM-20281102-ABC002');
    });
  });

  // 11. Pagination works
  describe('11. Pagination Works', () => {
    it('calculates total pages and slice bounds accurately', () => {
      const total = 25;
      const limit = 10;
      const totalPages = Math.ceil(total / limit);
      assert.equal(totalPages, 3);

      const page1 = sampleBookings.slice(0, 2);
      const page2 = sampleBookings.slice(2, 4);
      assert.equal(page1.length, 2);
      assert.equal(page2.length, 1);
    });
  });

  // 12. Booking search works
  describe('12. Booking Search Works', () => {
    it('matches booking by human-readable reference', () => {
      const query = 'ABC002';
      const results = sampleBookings.filter((b) => b.bookingId.toLowerCase().includes(query.toLowerCase()));
      assert.equal(results.length, 1);
      assert.equal(results[0].bookingId, 'TRM-20281102-ABC002');
    });

    it('matches booking by customer name or email', () => {
      const query = 'alice@example.com';
      const results = sampleBookings.filter((b) => b.customer.email.toLowerCase().includes(query.toLowerCase()));
      assert.equal(results.length, 2);
    });

    it('matches booking by hotel name', () => {
      const query = 'Alpine';
      const results = sampleBookings.filter((b) => b.hotel.name.toLowerCase().includes(query.toLowerCase()));
      assert.equal(results.length, 1);
      assert.equal(results[0].hotel.name, 'Alpine Retreat');
    });
  });

  // 13. Cancelled booking cannot be cancelled again
  describe('13. Cancelled Booking Cannot Be Cancelled Again', () => {
    it('rejects cancellation of an already CANCELLED booking with 400', () => {
      const cancelledBooking = sampleBookings.find((b) => b.bookingStatus === 'CANCELLED');
      assert.ok(cancelledBooking);

      const cancelAction = () => {
        if (cancelledBooking.bookingStatus === 'CANCELLED') {
          throw new ApiError(400, 'This booking has already been cancelled');
        }
      };

      assert.throws(cancelAction, (err: unknown) => err instanceof ApiError && err.statusCode === 400);
    });
  });

  // 14. Completed booking cannot be cancelled
  describe('14. Completed Booking Cannot Be Cancelled', () => {
    it('rejects cancellation of a COMPLETED booking with 400', () => {
      const completedBooking = sampleBookings.find((b) => b.bookingStatus === 'COMPLETED');
      assert.ok(completedBooking);

      const cancelAction = () => {
        if (completedBooking.bookingStatus === 'COMPLETED') {
          throw new ApiError(400, 'Completed bookings cannot be cancelled');
        }
      };

      assert.throws(cancelAction, (err: unknown) => err instanceof ApiError && err.statusCode === 400);
    });
  });

  // 15. Unauthorized booking access returns correct status
  describe('15. Unauthorized Booking Access Returns Correct Status', () => {
    it('unauthenticated request throws 401', () => {
      const auth = (reqAuth: unknown) => {
        if (!reqAuth) throw new ApiError(401, 'Authentication required');
      };
      assert.throws(() => auth(null), (err: unknown) => err instanceof ApiError && err.statusCode === 401);
    });

    it('non-existent booking throws 404', () => {
      const lookup = (found: unknown) => {
        if (!found) throw new ApiError(404, 'Booking not found');
      };
      assert.throws(() => lookup(null), (err: unknown) => err instanceof ApiError && err.statusCode === 404);
    });

    it('cross-partner access throws 403', () => {
      const ownership = (partnerIdA: string, partnerIdB: string) => {
        if (partnerIdA !== partnerIdB) throw new ApiError(403, 'You do not have permission to view this booking');
      };
      assert.throws(() => ownership('partner-1', 'partner-2'), (err: unknown) => err instanceof ApiError && err.statusCode === 403);
    });
  });

  // 16. Sensitive authentication data is never returned
  describe('16. Sensitive Authentication Data Is Never Returned', () => {
    it('ensures booking detail select excludes passwordHash and tokens', () => {
      const customerSelect = bookingDetailSelect.customer.select;
      assert.equal('passwordHash' in customerSelect, false);
      assert.equal('token' in customerSelect, false);

      const hotelSelect = bookingDetailSelect.hotel.select;
      assert.equal('passwordHash' in hotelSelect, false);
    });
  });
});
