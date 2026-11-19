import { apiRequest } from './client';
import type { ApiEnvelope } from '@/types/hotel';
import type {
  CreateReviewPayload,
  CustomerReviewsData,
  HotelReviewsData,
  ModerateReviewPayload,
  Review,
  ReviewEligibility,
  UpdateReviewPayload,
} from '@/types/review';

function queryString(query: Record<string, unknown> = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === '' || value === null) continue;
    params.set(key, String(value));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
}

export async function createReview(payload: CreateReviewPayload): Promise<Review> {
  const response = await apiRequest<ApiEnvelope<Review>>('/reviews', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function checkReviewEligibility(bookingId: string): Promise<ReviewEligibility> {
  const response = await apiRequest<ApiEnvelope<ReviewEligibility>>(
    `/reviews/eligibility/${encodeURIComponent(bookingId)}`,
  );
  return response.data;
}

export async function getHotelReviews(
  hotelId: string,
  query?: { page?: number; limit?: number; rating?: number },
): Promise<HotelReviewsData> {
  const response = await apiRequest<ApiEnvelope<HotelReviewsData>>(
    `/reviews/hotel/${encodeURIComponent(hotelId)}${queryString(query as Record<string, unknown>)}`,
  );
  return response.data;
}

export async function getMyReviews(query?: { page?: number; limit?: number }): Promise<CustomerReviewsData> {
  const response = await apiRequest<ApiEnvelope<CustomerReviewsData>>(
    `/reviews/my${queryString(query as Record<string, unknown>)}`,
  );
  return response.data;
}

export async function getReviewById(id: string): Promise<Review> {
  const response = await apiRequest<ApiEnvelope<Review>>(`/reviews/${encodeURIComponent(id)}`);
  return response.data;
}

export async function updateReview(id: string, payload: UpdateReviewPayload): Promise<Review> {
  const response = await apiRequest<ApiEnvelope<Review>>(`/reviews/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function deleteReview(id: string): Promise<void> {
  await apiRequest<ApiEnvelope<null>>(`/reviews/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function getPartnerReviews(query?: {
  hotelId?: string;
  page?: number;
  limit?: number;
  rating?: number;
}): Promise<HotelReviewsData> {
  const response = await apiRequest<ApiEnvelope<HotelReviewsData>>(
    `/partner/reviews${queryString(query as Record<string, unknown>)}`,
  );
  return response.data;
}

export async function getAdminReviews(query?: {
  hotelId?: string;
  page?: number;
  limit?: number;
  rating?: number;
  isPublished?: boolean;
}): Promise<CustomerReviewsData> {
  const response = await apiRequest<ApiEnvelope<CustomerReviewsData>>(
    `/admin/reviews${queryString(query as Record<string, unknown>)}`,
  );
  return response.data;
}

export async function moderateReview(id: string, payload: ModerateReviewPayload): Promise<Review> {
  const response = await apiRequest<ApiEnvelope<Review>>(
    `/admin/reviews/${encodeURIComponent(id)}/moderate`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
  return response.data;
}
