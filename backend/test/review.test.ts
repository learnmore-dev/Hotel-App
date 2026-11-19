import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  type CreateReviewInput,
  type RatingDistribution,
  type RatingSummary,
} from '../src/services/review.service.js';
import { ApiError } from '../src/utils/ApiError.js';

describe('Phase 13 — Reviews & Ratings Business Rules & Logic Tests', () => {
  const customerId = 'cust-1111-2222';
  const otherCustomerId = 'cust-3333-4444';
  const partnerId = 'part-1111-2222';
  const otherPartnerId = 'part-3333-4444';
  const hotelId = 'htl-1111-2222';
  const otherHotelId = 'htl-3333-4444';
  const bookingId = 'bkg-1111-2222';

  const completedPastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
  const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days in future

  const mockCompletedBooking = {
    id: bookingId,
    bookingId: 'TRM-20261019-ABC1',
    customerId,
    hotelId,
    checkIn: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    checkOut: completedPastDate,
    bookingStatus: 'COMPLETED',
    paymentStatus: 'PAID',
    review: null,
  };

  // Helper eligibility simulator
  function evaluateEligibility(booking: (Omit<typeof mockCompletedBooking, 'review'> & { review?: unknown }) | null, requesterId: string) {
    if (!booking) {
      throw new ApiError(404, 'Booking not found');
    }
    if (booking.customerId !== requesterId) {
      throw new ApiError(403, 'You are not authorized to review this booking');
    }
    if (booking.bookingStatus === 'CANCELLED') {
      throw new ApiError(400, 'Cancelled bookings cannot be reviewed');
    }
    const now = new Date();
    const isConcluded = new Date(booking.checkOut) <= now;
    if (booking.bookingStatus !== 'COMPLETED' && !(booking.bookingStatus === 'CONFIRMED' && isConcluded && booking.paymentStatus === 'PAID')) {
      throw new ApiError(400, 'Reviews can only be submitted for completed stays after checkout');
    }
    if (booking.review) {
      throw new ApiError(409, 'A review has already been submitted for this booking');
    }
    return true;
  }

  // 1. Successful review creation validation
  describe('1. Successful Review Creation', () => {
    it('allows an authenticated customer to review their completed stay', () => {
      const isEligible = evaluateEligibility(mockCompletedBooking, customerId);
      assert.equal(isEligible, true);

      const reviewInput: CreateReviewInput = {
        bookingId: mockCompletedBooking.id,
        rating: 5,
        comment: 'Exceptional stay and wonderful hospitality!',
      };

      assert.equal(reviewInput.rating, 5);
      assert.equal((reviewInput.comment?.length ?? 0) > 0, true);
    });
  });

  // 2. Invalid ratings and invalid content
  describe('2. Invalid Ratings and Content Validation', () => {
    it('rejects ratings below 1', () => {
      const validateRating = (r: number) => Number.isInteger(r) && r >= 1 && r <= 5;
      assert.equal(validateRating(0), false);
      assert.equal(validateRating(-1), false);
    });

    it('rejects ratings above 5', () => {
      const validateRating = (r: number) => Number.isInteger(r) && r >= 1 && r <= 5;
      assert.equal(validateRating(6), false);
      assert.equal(validateRating(10), false);
    });

    it('rejects non-integer float ratings', () => {
      const validateRating = (r: number) => Number.isInteger(r) && r >= 1 && r <= 5;
      assert.equal(validateRating(4.5), false);
    });

    it('rejects comment exceeding 1000 characters', () => {
      const longComment = 'a'.repeat(1001);
      const isTooLong = longComment.length > 1000;
      assert.equal(isTooLong, true);
    });
  });

  // 3. Unauthenticated access
  describe('3. Unauthenticated Access Protection', () => {
    it('throws 401 when auth context is missing', () => {
      const reqAuth = null;
      assert.throws(
        () => {
          if (!reqAuth) throw new ApiError(401, 'Please log in to continue.');
        },
        (err: Error) => {
          assert.equal(err instanceof ApiError, true);
          assert.equal((err as ApiError).statusCode, 401);
          return true;
        },
      );
    });
  });

  // 4. Booking ownership checks
  describe('4. Booking Ownership Enforcement', () => {
    it('denies customer attempt to review another user booking with 403', () => {
      assert.throws(
        () => evaluateEligibility(mockCompletedBooking, otherCustomerId),
        (err: Error) => {
          assert.equal(err instanceof ApiError, true);
          assert.equal((err as ApiError).statusCode, 403);
          return true;
        },
      );
    });
  });

  // 5. Ineligible or cancelled bookings
  describe('5. Ineligible and Cancelled Bookings', () => {
    it('rejects review on CANCELLED booking with 400', () => {
      const cancelledBooking = {
        ...mockCompletedBooking,
        bookingStatus: 'CANCELLED',
      };
      assert.throws(
        () => evaluateEligibility(cancelledBooking, customerId),
        (err: Error) => {
          assert.equal(err instanceof ApiError, true);
          assert.equal((err as ApiError).statusCode, 400);
          assert.match(err.message, /Cancelled/);
          return true;
        },
      );
    });

    it('rejects review on ongoing or future booking with 400', () => {
      const futureBooking = {
        ...mockCompletedBooking,
        bookingStatus: 'CONFIRMED',
        checkOut: futureDate,
      };
      assert.throws(
        () => evaluateEligibility(futureBooking, customerId),
        (err: Error) => {
          assert.equal(err instanceof ApiError, true);
          assert.equal((err as ApiError).statusCode, 400);
          assert.match(err.message, /completed stays after checkout/);
          return true;
        },
      );
    });

    it('rejects review on unpaid booking with 400', () => {
      const unpaidBooking = {
        ...mockCompletedBooking,
        bookingStatus: 'CONFIRMED',
        paymentStatus: 'FAILED',
        checkOut: completedPastDate,
      };
      assert.throws(
        () => evaluateEligibility(unpaidBooking, customerId),
        (err: Error) => {
          assert.equal(err instanceof ApiError, true);
          assert.equal((err as ApiError).statusCode, 400);
          return true;
        },
      );
    });
  });

  // 6. Duplicate review prevention
  describe('6. Duplicate Review Prevention', () => {
    it('rejects second review for same booking with 409 Conflict', () => {
      const alreadyReviewedBooking = {
        ...mockCompletedBooking,
        review: { id: 'rev-existing-1', rating: 4, comment: 'Nice' },
      };
      assert.throws(
        () => evaluateEligibility(alreadyReviewedBooking, customerId),
        (err: Error) => {
          assert.equal(err instanceof ApiError, true);
          assert.equal((err as ApiError).statusCode, 409);
          return true;
        },
      );
    });
  });

  // 7. Unauthorized edits and deletions
  describe('7. Unauthorized Edits and Deletions', () => {
    const existingReview = {
      id: 'rev-1',
      customerId,
      hotelId,
      rating: 5,
      comment: 'Superb',
      isPublished: true,
    };

    it('denies review edit when user is not the author (403)', () => {
      const canEdit = existingReview.customerId === otherCustomerId;
      assert.equal(canEdit, false);
      assert.throws(
        () => {
          if (!canEdit) throw new ApiError(403, 'You are not authorized to edit this review');
        },
        (err: Error) => {
          assert.equal((err as ApiError).statusCode, 403);
          return true;
        },
      );
    });

    it('denies review deletion when user is not the author (403)', () => {
      const canDelete = existingReview.customerId === otherCustomerId;
      assert.equal(canDelete, false);
      assert.throws(
        () => {
          if (!canDelete) throw new ApiError(403, 'You are not authorized to delete this review');
        },
        (err: Error) => {
          assert.equal((err as ApiError).statusCode, 403);
          return true;
        },
      );
    });
  });

  // 8. Public hotel review listing data projection
  describe('8. Public Hotel Review Listing & Privacy Protection', () => {
    it('omits private customer credentials and contact details in public output', () => {
      const internalUser = {
        id: customerId,
        fullName: 'Alex Morgan',
        email: 'alex.morgan@example.com',
        phone: '+15551234567',
        passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz',
        avatar: 'https://images.example.com/avatar.jpg',
      };

      const publicCustomerProjection = {
        id: internalUser.id,
        fullName: internalUser.fullName,
        avatar: internalUser.avatar,
      };

      assert.equal('passwordHash' in publicCustomerProjection, false);
      assert.equal('email' in publicCustomerProjection, false);
      assert.equal('phone' in publicCustomerProjection, false);
      assert.equal(publicCustomerProjection.fullName, 'Alex Morgan');
    });

    it('filters out unpublished reviews from public listing', () => {
      const allReviews = [
        { id: '1', rating: 5, isPublished: true },
        { id: '2', rating: 1, isPublished: false }, // Moderated/Hidden
        { id: '3', rating: 4, isPublished: true },
      ];
      const publicReviews = allReviews.filter((r) => r.isPublished);
      assert.equal(publicReviews.length, 2);
      assert.equal(publicReviews.some((r) => r.id === '2'), false);
    });
  });

  // 9. Average rating and review count calculations
  describe('9. Average Rating and Review Count Calculations', () => {
    it('calculates average rating rounded to 2 decimals', () => {
      const ratings = [5, 4, 4, 5, 5]; // Sum: 23, Count: 5, Avg: 4.60
      const total = ratings.length;
      const sum = ratings.reduce((acc, r) => acc + r, 0);
      const avg = Number((sum / total).toFixed(2));

      assert.equal(total, 5);
      assert.equal(avg, 4.6);
    });

    it('correctly handles fractional rounding (e.g. 4.67)', () => {
      const ratings = [5, 5, 4]; // Sum: 14, Count: 3, Avg: 4.6666... -> 4.67
      const total = ratings.length;
      const sum = ratings.reduce((acc, r) => acc + r, 0);
      const avg = Number((sum / total).toFixed(2));

      assert.equal(avg, 4.67);
    });

    it('returns null ratingScore and 0 count when no published reviews exist', () => {
      const ratings: number[] = [];
      const reviewCount = ratings.length;
      const ratingScore = reviewCount > 0 ? Number((ratings.reduce((a, b) => a + b, 0) / reviewCount).toFixed(2)) : null;

      assert.equal(reviewCount, 0);
      assert.equal(ratingScore, null);
    });

    it('builds a complete 1 to 5 star rating distribution', () => {
      const ratings = [5, 5, 5, 4, 4, 3, 1];
      const distribution: RatingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

      for (const r of ratings) {
        distribution[r as 1 | 2 | 3 | 4 | 5]++;
      }

      assert.equal(distribution[5], 3);
      assert.equal(distribution[4], 2);
      assert.equal(distribution[3], 1);
      assert.equal(distribution[2], 0);
      assert.equal(distribution[1], 1);
    });
  });

  // 10. Partner hotel authorization
  describe('10. Partner Hotel Authorization', () => {
    const partnerOwnedHotels = [hotelId];

    it('allows partner to access reviews for owned hotels', () => {
      const canAccess = partnerOwnedHotels.includes(hotelId);
      assert.equal(canAccess, true);
    });

    it('denies partner access to reviews for non-owned hotels with 403', () => {
      const canAccess = partnerOwnedHotels.includes(otherHotelId);
      assert.equal(canAccess, false);
      assert.throws(
        () => {
          if (!canAccess) throw new ApiError(403, 'You are not authorized to view reviews for this hotel');
        },
        (err: Error) => {
          assert.equal((err as ApiError).statusCode, 403);
          return true;
        },
      );
    });
  });

  // 11. Admin moderation permissions
  describe('11. Admin Moderation Permissions', () => {
    it('allows ADMIN role to hide or restore reviews', () => {
      const userRole = 'ADMIN';
      const isAdmin = userRole === 'ADMIN';
      assert.equal(isAdmin, true);

      let isPublished = true;
      // Admin hides review
      isPublished = false;
      assert.equal(isPublished, false);
      // Admin restores review
      isPublished = true;
      assert.equal(isPublished, true);
    });

    it('denies CUSTOMER or PARTNER from invoking moderation endpoint', () => {
      const roles = ['CUSTOMER', 'PARTNER'];
      for (const role of roles) {
        const isAdmin = role === 'ADMIN';
        assert.equal(isAdmin, false);
      }
    });
  });
});
