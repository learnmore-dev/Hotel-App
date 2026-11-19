import { apiRequest } from './client';
import type {
  AdminCouponListResponse,
  AdminCouponQuery,
  Coupon,
  Offer,
  ValidatedCouponResult,
} from '@/types/coupon';
import type { ApiEnvelope } from '@/types/hotel';

function queryString(query: Record<string, unknown> = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === '' || value === null) continue;
    params.set(key, String(value));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
}

/**
 * Validates a coupon code for customer checkout.
 */
export async function validateCoupon(
  code: string,
  bookingAmount?: number,
): Promise<ValidatedCouponResult> {
  const response = await apiRequest<ApiEnvelope<ValidatedCouponResult>>('/coupons/validate', {
    method: 'POST',
    body: JSON.stringify({ code, bookingAmount }),
  });
  return response.data;
}

/**
 * Fetches all currently active promotional offers for customers.
 */
export async function getActiveOffers(): Promise<Offer[]> {
  const response = await apiRequest<ApiEnvelope<Offer[]>>('/offers', {
    method: 'GET',
  });
  return response.data;
}

/**
 * Lists all coupons for administrator.
 */
export async function getAdminCoupons(
  query?: AdminCouponQuery,
): Promise<AdminCouponListResponse> {
  const response = await apiRequest<ApiEnvelope<AdminCouponListResponse>>(
    `/admin/coupons${queryString(query as Record<string, unknown>)}`,
    { method: 'GET' },
  );
  return response.data;
}

/**
 * Retrieves a single coupon by ID for administrator.
 */
export async function getAdminCouponById(id: string): Promise<Coupon> {
  const response = await apiRequest<ApiEnvelope<Coupon>>(`/admin/coupons/${id}`, {
    method: 'GET',
  });
  return response.data;
}

/**
 * Creates a coupon by administrator.
 */
export async function createAdminCoupon(data: Partial<Coupon>): Promise<Coupon> {
  const response = await apiRequest<ApiEnvelope<Coupon>>('/admin/coupons', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return response.data;
}

/**
 * Updates a coupon by administrator.
 */
export async function updateAdminCoupon(
  id: string,
  data: Partial<Coupon>,
): Promise<Coupon> {
  const response = await apiRequest<ApiEnvelope<Coupon>>(`/admin/coupons/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return response.data;
}

/**
 * Deletes a coupon by administrator.
 */
export async function deleteAdminCoupon(id: string): Promise<void> {
  await apiRequest<ApiEnvelope<null>>(`/admin/coupons/${id}`, {
    method: 'DELETE',
  });
}
