import type { Prisma, PrismaClient } from '@prisma/client';

import { getPrismaClient } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { safeNotify } from './notification.service.js';

export type CreateReviewInput = {
  bookingId: string;
  rating: number;
  comment?: string;
};

export type UpdateReviewInput = {
  rating?: number;
  comment?: string;
};

export type ReviewListQuery = {
  page?: number;
  limit?: number;
  rating?: number;
};

export type AdminReviewListQuery = ReviewListQuery & {
  hotelId?: string;
  isPublished?: boolean;
};

export type PartnerReviewListQuery = ReviewListQuery & {
  hotelId?: string;
};

export type RatingDistribution = {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
};

export type RatingSummary = {
  averageRating: number | null;
  totalReviews: number;
  ratingDistribution: RatingDistribution;
};

/**
 * Authoritative recalculation of Hotel.reviewCount and Hotel.ratingScore
 * based exclusively on published reviews.
 */
export async function syncHotelRating(
  hotelId: string,
  prismaClient: PrismaClient | Prisma.TransactionClient = getPrismaClient() as unknown as PrismaClient,
): Promise<{ reviewCount: number; ratingScore: number | null }> {
  const aggregate = await prismaClient.review.aggregate({
    where: {
      hotelId,
      isPublished: true,
    },
    _count: { id: true },
    _avg: { rating: true },
  });

  const reviewCount = aggregate._count.id;
  const rawAvg = aggregate._avg.rating;
  const ratingScore = reviewCount > 0 && rawAvg !== null ? Number(rawAvg.toFixed(2)) : null;

  await prismaClient.hotel.update({
    where: { id: hotelId },
    data: {
      reviewCount,
      ratingScore,
    },
  });

  return { reviewCount, ratingScore };
}

/**
 * Checks whether a booking qualifies for a customer review.
 */
export async function checkBookingEligibility(
  bookingId: string,
  customerId: string,
) {
  const prisma = getPrismaClient();

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      hotel: {
        select: {
          id: true,
          name: true,
          city: true,
          mainImage: true,
        },
      },
      review: {
        select: {
          id: true,
          rating: true,
          comment: true,
          isPublished: true,
          createdAt: true,
        },
      },
    },
  });

  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  if (booking.customerId !== customerId) {
    throw new ApiError(403, 'You are not authorized to review this booking');
  }

  if (booking.bookingStatus === 'CANCELLED') {
    throw new ApiError(400, 'Cancelled bookings cannot be reviewed');
  }

  // Completion check
  const now = new Date();
  const checkOutDate = new Date(booking.checkOut);
  const stayConcluded = checkOutDate <= now;

  if (booking.bookingStatus === 'COMPLETED') {
    // Stay is marked completed by hotel/system
  } else if (booking.bookingStatus === 'CONFIRMED' && stayConcluded) {
    if (booking.paymentStatus !== 'PAID') {
      throw new ApiError(
        400,
        'Booking payment must be completed before submitting a review',
      );
    }
  } else {
    throw new ApiError(
      400,
      'Reviews can only be submitted for completed stays after checkout',
    );
  }

  if (booking.review) {
    throw new ApiError(409, 'A review has already been submitted for this booking');
  }

  return {
    eligible: true,
    booking,
  };
}

/**
 * Safe eligibility check without throwing, ideal for UI eligibility banners.
 */
export async function getBookingEligibilityStatus(
  bookingId: string,
  customerId: string,
) {
  const prisma = getPrismaClient();

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      hotel: {
        select: {
          id: true,
          name: true,
          city: true,
          mainImage: true,
        },
      },
      review: {
        select: {
          id: true,
          rating: true,
          comment: true,
          isPublished: true,
          createdAt: true,
        },
      },
    },
  });

  if (!booking) {
    return { eligible: false, reason: 'Booking not found', booking: null };
  }

  if (booking.customerId !== customerId) {
    return { eligible: false, reason: 'Booking does not belong to you', booking: null };
  }

  if (booking.review) {
    return {
      eligible: false,
      alreadyReviewed: true,
      existingReview: booking.review,
      booking: {
        id: booking.id,
        bookingId: booking.bookingId,
        hotel: booking.hotel,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
      },
    };
  }

  if (booking.bookingStatus === 'CANCELLED') {
    return { eligible: false, reason: 'Booking was cancelled', booking: null };
  }

  const now = new Date();
  const checkOutDate = new Date(booking.checkOut);
  const stayConcluded = checkOutDate <= now;

  if (booking.bookingStatus !== 'COMPLETED' && !(booking.bookingStatus === 'CONFIRMED' && stayConcluded && booking.paymentStatus === 'PAID')) {
    return {
      eligible: false,
      reason: 'Stay is not yet completed',
      booking: {
        id: booking.id,
        bookingId: booking.bookingId,
        hotel: booking.hotel,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
      },
    };
  }

  return {
    eligible: true,
    booking: {
      id: booking.id,
      bookingId: booking.bookingId,
      hotel: booking.hotel,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
    },
  };
}

/**
 * Creates a new review for an eligible booking.
 */
export async function createReview(
  customerId: string,
  input: CreateReviewInput,
) {
  const { booking } = await checkBookingEligibility(input.bookingId, customerId);

  const prisma = getPrismaClient();

  const review = await prisma.$transaction(async (tx) => {
    const createdReview = await tx.review.create({
      data: {
        customerId,
        hotelId: booking.hotelId,
        bookingId: input.bookingId,
        rating: input.rating,
        comment: input.comment?.trim() || '',
        isPublished: true, // Auto-publish new reviews
      },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            avatar: true,
          },
        },
        hotel: {
          select: {
            id: true,
            name: true,
            city: true,
          },
        },
      },
    });

    await syncHotelRating(booking.hotelId, tx);

    return createdReview;
  });

  // Notify hotel partner of new review
  const hotelPartner = await prisma.hotel.findUnique({
    where: { id: booking.hotelId },
    select: { name: true, partner: { select: { userId: true } } },
  });

  if (hotelPartner?.partner?.userId) {
    void safeNotify({
      userId: hotelPartner.partner.userId,
      title: 'New Review Received ⭐',
      message: `A new ${input.rating}★ review was submitted for ${hotelPartner.name}.`,
      type: 'BOOKING',
      dedupKey: `REVIEW_RECEIVED:${review.id}`,
      actionUrl: `/(partner)/reviews`,
      data: { reviewId: review.id, rating: input.rating },
    });
  }

  return review;
}

/**
 * Public listing of published reviews for a given hotel,
 * including summary calculations and star distribution.
 */
export async function getHotelReviews(
  hotelId: string,
  query: ReviewListQuery,
) {
  const prisma = getPrismaClient();

  const hotel = await prisma.hotel.findUnique({
    where: { id: hotelId },
    select: { id: true, name: true, ratingScore: true, reviewCount: true },
  });

  if (!hotel) {
    throw new ApiError(404, 'Hotel not found');
  }

  const page = Math.max(1, query.page || 1);
  const limit = Math.min(50, Math.max(1, query.limit || 10));
  const skip = (page - 1) * limit;

  const whereCondition: Prisma.ReviewWhereInput = {
    hotelId,
    isPublished: true,
    ...(query.rating ? { rating: query.rating } : {}),
  };

  const [reviews, total, groupCounts] = await Promise.all([
    prisma.review.findMany({
      where: whereCondition,
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        updatedAt: true,
        customer: {
          select: {
            id: true,
            fullName: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.review.count({ where: whereCondition }),
    prisma.review.groupBy({
      by: ['rating'],
      where: { hotelId, isPublished: true },
      _count: { rating: true },
    }),
  ]);

  const ratingDistribution: RatingDistribution = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  let totalPublishedReviews = 0;
  for (const group of groupCounts) {
    const star = group.rating as 1 | 2 | 3 | 4 | 5;
    if (ratingDistribution[star] !== undefined) {
      ratingDistribution[star] = group._count.rating;
    }
    totalPublishedReviews += group._count.rating;
  }

  const summary: RatingSummary = {
    averageRating: hotel.ratingScore !== null ? Number(hotel.ratingScore) : null,
    totalReviews: hotel.reviewCount || totalPublishedReviews,
    ratingDistribution,
  };

  return {
    hotel: {
      id: hotel.id,
      name: hotel.name,
    },
    summary,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
    reviews,
  };
}

/**
 * Retrieves submitted reviews by the authenticated customer.
 */
export async function getCustomerReviews(
  customerId: string,
  query: ReviewListQuery,
) {
  const prisma = getPrismaClient();

  const page = Math.max(1, query.page || 1);
  const limit = Math.min(50, Math.max(1, query.limit || 10));
  const skip = (page - 1) * limit;

  const whereCondition: Prisma.ReviewWhereInput = {
    customerId,
  };

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where: whereCondition,
      include: {
        hotel: {
          select: {
            id: true,
            name: true,
            city: true,
            mainImage: true,
            starRating: true,
          },
        },
        booking: {
          select: {
            id: true,
            bookingId: true,
            checkIn: true,
            checkOut: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.review.count({ where: whereCondition }),
  ]);

  return {
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
    reviews,
  };
}

/**
 * Retrieves a single review by ID.
 */
export async function getReviewById(
  reviewId: string,
  currentUserId?: string,
  userRole?: string,
) {
  const prisma = getPrismaClient();

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: {
      customer: {
        select: {
          id: true,
          fullName: true,
          avatar: true,
          email: userRole === 'ADMIN',
        },
      },
      hotel: {
        select: {
          id: true,
          name: true,
          city: true,
          partnerId: true,
        },
      },
      booking: {
        select: {
          id: true,
          bookingId: true,
          checkIn: true,
          checkOut: true,
        },
      },
    },
  });

  if (!review) {
    throw new ApiError(404, 'Review not found');
  }

  // Unpublished review privacy check
  if (!review.isPublished) {
    const isAuthor = currentUserId === review.customerId;
    const isAdmin = userRole === 'ADMIN';
    if (!isAuthor && !isAdmin) {
      throw new ApiError(404, 'Review not found');
    }
  }

  return review;
}

/**
 * Updates a customer's own review.
 */
export async function updateCustomerReview(
  customerId: string,
  reviewId: string,
  input: UpdateReviewInput,
) {
  const prisma = getPrismaClient();

  const existing = await prisma.review.findUnique({
    where: { id: reviewId },
  });

  if (!existing) {
    throw new ApiError(404, 'Review not found');
  }

  if (existing.customerId !== customerId) {
    throw new ApiError(403, 'You are not authorized to edit this review');
  }

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.review.update({
      where: { id: reviewId },
      data: {
        ...(input.rating !== undefined ? { rating: input.rating } : {}),
        ...(input.comment !== undefined ? { comment: input.comment.trim() } : {}),
      },
      include: {
        hotel: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (existing.isPublished) {
      await syncHotelRating(existing.hotelId, tx);
    }

    return updated;
  });
}

/**
 * Deletes a customer's own review.
 */
export async function deleteCustomerReview(
  customerId: string,
  reviewId: string,
) {
  const prisma = getPrismaClient();

  const existing = await prisma.review.findUnique({
    where: { id: reviewId },
  });

  if (!existing) {
    throw new ApiError(404, 'Review not found');
  }

  if (existing.customerId !== customerId) {
    throw new ApiError(403, 'You are not authorized to delete this review');
  }

  await prisma.$transaction(async (tx) => {
    await tx.review.delete({
      where: { id: reviewId },
    });

    if (existing.isPublished) {
      await syncHotelRating(existing.hotelId, tx);
    }
  });

  return { success: true, message: 'Review deleted successfully' };
}

/**
 * Retrieves reviews for hotels owned by a partner.
 */
export async function getPartnerReviews(
  partnerUserId: string,
  query: PartnerReviewListQuery,
) {
  const prisma = getPrismaClient();

  const partnerProfile = await prisma.partnerProfile.findUnique({
    where: { userId: partnerUserId },
  });

  if (!partnerProfile) {
    throw new ApiError(403, 'Partner profile not found');
  }

  const partnerHotels = await prisma.hotel.findMany({
    where: { partnerId: partnerProfile.id },
    select: { id: true, name: true },
  });

  const hotelIds = partnerHotels.map((h) => h.id);

  if (hotelIds.length === 0) {
    return {
      hotels: [],
      pagination: { page: 1, limit: query.limit || 10, total: 0, totalPages: 1 },
      reviews: [],
    };
  }

  // If specific hotelId requested, verify ownership
  if (query.hotelId) {
    if (!hotelIds.includes(query.hotelId)) {
      throw new ApiError(403, 'You are not authorized to view reviews for this hotel');
    }
  }

  const targetHotelIds = query.hotelId ? [query.hotelId] : hotelIds;

  const page = Math.max(1, query.page || 1);
  const limit = Math.min(50, Math.max(1, query.limit || 10));
  const skip = (page - 1) * limit;

  const whereCondition: Prisma.ReviewWhereInput = {
    hotelId: { in: targetHotelIds },
    ...(query.rating ? { rating: query.rating } : {}),
  };

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where: whereCondition,
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            avatar: true,
          },
        },
        hotel: {
          select: {
            id: true,
            name: true,
            city: true,
          },
        },
        booking: {
          select: {
            id: true,
            bookingId: true,
            checkIn: true,
            checkOut: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.review.count({ where: whereCondition }),
  ]);

  return {
    hotels: partnerHotels,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
    reviews,
  };
}

/**
 * Retrieves all reviews for admin moderation.
 */
export async function getAdminReviews(
  query: AdminReviewListQuery,
) {
  const prisma = getPrismaClient();

  const page = Math.max(1, query.page || 1);
  const limit = Math.min(50, Math.max(1, query.limit || 10));
  const skip = (page - 1) * limit;

  const whereCondition: Prisma.ReviewWhereInput = {
    ...(query.hotelId ? { hotelId: query.hotelId } : {}),
    ...(query.isPublished !== undefined ? { isPublished: query.isPublished } : {}),
    ...(query.rating ? { rating: query.rating } : {}),
  };

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where: whereCondition,
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatar: true,
          },
        },
        hotel: {
          select: {
            id: true,
            name: true,
            city: true,
          },
        },
        booking: {
          select: {
            id: true,
            bookingId: true,
            checkIn: true,
            checkOut: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.review.count({ where: whereCondition }),
  ]);

  return {
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
    reviews,
  };
}

/**
 * Moderate review status (publish or unpublish).
 */
export async function moderateReview(
  adminUserId: string,
  reviewId: string,
  input: { isPublished: boolean; reason?: string },
) {
  const prisma = getPrismaClient();

  const existing = await prisma.review.findUnique({
    where: { id: reviewId },
  });

  if (!existing) {
    throw new ApiError(404, 'Review not found');
  }

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.review.update({
      where: { id: reviewId },
      data: {
        isPublished: input.isPublished,
      },
      include: {
        hotel: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    await syncHotelRating(existing.hotelId, tx);

    return updated;
  });
}
