import { apiRequest } from './client';
import type { ApiEnvelope } from '@/types/hotel';
import type {
  AdminPayoutItem,
  AdminPayoutsResponse,
  AdminUpdateCommissionPayload,
  AdminUpdatePayoutStatusPayload,
  PartnerEarningsHistoryResponse,
  PartnerEarningsSummary,
  PartnerPayoutsResponse,
  PayoutStatus,
  RequestPayoutPayload,
  RequestPayoutResponse,
} from '@/types/payout';

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
 * Retrieves the comprehensive earnings summary for the authenticated partner.
 */
export async function getPartnerEarningsSummary(): Promise<PartnerEarningsSummary> {
  const response = await apiRequest<ApiEnvelope<PartnerEarningsSummary>>(
    '/partner/earnings/summary',
  );
  return response.data;
}

/**
 * Retrieves booking-level earnings history for the authenticated partner.
 */
export async function getPartnerEarningsHistory(query?: {
  status?: string;
  hotelId?: string;
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}): Promise<PartnerEarningsHistoryResponse> {
  const response = await apiRequest<ApiEnvelope<PartnerEarningsHistoryResponse>>(
    `/partner/earnings/history${queryString(query as Record<string, unknown>)}`,
  );
  return response.data;
}

/**
 * Retrieves submitted payout requests and history for the authenticated partner.
 */
export async function getPartnerPayouts(query?: {
  status?: PayoutStatus | 'ALL';
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}): Promise<PartnerPayoutsResponse> {
  const response = await apiRequest<ApiEnvelope<PartnerPayoutsResponse>>(
    `/partner/payouts${queryString(query as Record<string, unknown>)}`,
  );
  return response.data;
}

/**
 * Requests payout for eligible completed bookings.
 */
export async function requestPartnerPayout(
  payload: RequestPayoutPayload = {},
): Promise<RequestPayoutResponse> {
  const response = await apiRequest<ApiEnvelope<RequestPayoutResponse>>(
    '/partner/payouts/request',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  return response.data;
}

/**
 * Retrieves all payout requests across partners for admin management.
 */
export async function getAdminPayouts(query?: {
  status?: PayoutStatus | 'ALL';
  partnerId?: string;
  hotelId?: string;
  batchReference?: string;
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}): Promise<AdminPayoutsResponse> {
  const response = await apiRequest<ApiEnvelope<AdminPayoutsResponse>>(
    `/admin/payouts${queryString(query as Record<string, unknown>)}`,
  );
  return response.data;
}

/**
 * Retrieves a single payout record by ID for admin detail view.
 */
export async function getAdminPayoutById(id: string): Promise<AdminPayoutItem> {
  const response = await apiRequest<ApiEnvelope<AdminPayoutItem>>(
    `/admin/payouts/${encodeURIComponent(id)}`,
  );
  return response.data;
}

/**
 * Approves, rejects, or marks a payout as paid.
 */
export async function updateAdminPayoutStatus(
  id: string,
  payload: AdminUpdatePayoutStatusPayload,
): Promise<AdminPayoutItem> {
  const response = await apiRequest<ApiEnvelope<AdminPayoutItem>>(
    `/admin/payouts/${encodeURIComponent(id)}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
  return response.data;
}

/**
 * Updates a partner's platform commission rate.
 */
export async function updatePartnerCommission(
  partnerId: string,
  payload: AdminUpdateCommissionPayload,
): Promise<{ id: string; businessName: string; commissionRate: number; updatedAt: string }> {
  const response = await apiRequest<
    ApiEnvelope<{ id: string; businessName: string; commissionRate: number; updatedAt: string }>
  >(`/admin/partners/${encodeURIComponent(partnerId)}/commission`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return response.data;
}
