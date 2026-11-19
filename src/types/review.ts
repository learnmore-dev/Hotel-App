export type ReviewCustomer = {
  id: string;
  fullName: string;
  avatar: string | null;
  email?: string;
};

export type ReviewHotel = {
  id: string;
  name: string;
  city?: string;
  mainImage?: string | null;
  starRating?: number | null;
};

export type ReviewBooking = {
  id: string;
  bookingId: string;
  checkIn: string;
  checkOut: string;
};

export type Review = {
  id: string;
  rating: number;
  comment: string;
  isPublished?: boolean;
  createdAt: string;
  updatedAt: string;
  customer: ReviewCustomer;
  hotel?: ReviewHotel;
  booking?: ReviewBooking;
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

export type HotelReviewsData = {
  hotel: { id: string; name: string };
  summary: RatingSummary;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  reviews: Review[];
};

export type CustomerReviewsData = {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  reviews: Review[];
};

export type ReviewEligibility = {
  eligible: boolean;
  reason?: string;
  alreadyReviewed?: boolean;
  existingReview?: Review | null;
  booking?: {
    id: string;
    bookingId: string;
    hotel: { id: string; name: string; city: string; mainImage: string | null };
    checkIn: string;
    checkOut: string;
  } | null;
};

export type CreateReviewPayload = {
  bookingId: string;
  rating: number;
  comment?: string;
};

export type UpdateReviewPayload = {
  rating?: number;
  comment?: string;
};

export type ModerateReviewPayload = {
  isPublished: boolean;
  reason?: string;
};
