import { apiRequest } from './client';
import type {
  AvailableRoomsData,
  Booking,
  BookingPage,
  BookingQuery,
  BookingStatus,
  CreateBookingPayload,
} from '@/types/booking';
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

export async function createBooking(payload: CreateBookingPayload): Promise<Booking> {
  const headers: Record<string, string> = {};
  if (payload.idempotencyKey) {
    headers['Idempotency-Key'] = payload.idempotencyKey;
  }

  const response = await apiRequest<ApiEnvelope<Booking>>('/bookings', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  return response.data;
}

export async function getMyBookings(query?: BookingQuery): Promise<BookingPage> {
  const response = await apiRequest<ApiEnvelope<BookingPage>>(
    `/bookings${queryString(query as Record<string, unknown>)}`,
  );
  return response.data;
}

export async function getBookingById(id: string): Promise<Booking> {
  const response = await apiRequest<ApiEnvelope<Booking>>(`/bookings/${encodeURIComponent(id)}`);
  return response.data;
}

export async function cancelBooking(id: string, reason?: string): Promise<Booking> {
  const response = await apiRequest<ApiEnvelope<Booking>>(`/bookings/${encodeURIComponent(id)}/cancel`, {
    method: 'PATCH',
    body: JSON.stringify({ cancellationReason: reason }),
  });
  return response.data;
}

export async function getRoomAvailability(
  hotelId: string,
  query: { checkIn: string; checkOut: string; guests: number; rooms: number },
): Promise<AvailableRoomsData> {
  const response = await apiRequest<ApiEnvelope<AvailableRoomsData>>(
    `/hotels/${encodeURIComponent(hotelId)}/rooms/availability${queryString(query)}`,
    { authenticated: false },
  );
  return response.data;
}

// Partner Booking Endpoints
export async function getPartnerBookings(query?: BookingQuery): Promise<BookingPage> {
  const response = await apiRequest<ApiEnvelope<BookingPage>>(
    `/partner/bookings${queryString(query as Record<string, unknown>)}`,
  );
  return response.data;
}

export async function getPartnerBookingById(id: string): Promise<Booking> {
  const response = await apiRequest<ApiEnvelope<Booking>>(
    `/partner/bookings/${encodeURIComponent(id)}`,
  );
  return response.data;
}

export async function updatePartnerBookingStatus(
  id: string,
  status: BookingStatus,
  reason?: string,
): Promise<Booking> {
  const response = await apiRequest<ApiEnvelope<Booking>>(
    `/partner/bookings/${encodeURIComponent(id)}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status, reason }),
    },
  );
  return response.data;
}

// Admin Booking Endpoints
export async function getAdminBookings(query?: BookingQuery): Promise<BookingPage> {
  const response = await apiRequest<ApiEnvelope<BookingPage>>(
    `/admin/bookings${queryString(query as Record<string, unknown>)}`,
  );
  return response.data;
}

export async function getAdminBookingById(id: string): Promise<Booking> {
  const response = await apiRequest<ApiEnvelope<Booking>>(
    `/admin/bookings/${encodeURIComponent(id)}`,
  );
  return response.data;
}

export async function updateAdminBookingStatus(
  id: string,
  status: BookingStatus,
  reason?: string,
): Promise<Booking> {
  const response = await apiRequest<ApiEnvelope<Booking>>(
    `/admin/bookings/${encodeURIComponent(id)}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status, reason }),
    },
  );
  return response.data;
}
