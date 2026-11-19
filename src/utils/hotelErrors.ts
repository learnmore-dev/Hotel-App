import { ApiRequestError } from '@/services/api/client';

export function hotelErrorMessage(error: unknown, context: 'customer' | 'management' = 'customer') {
  if (!(error instanceof ApiRequestError)) {
    return error instanceof Error && error.message ? error.message : 'Unable to load hotels. Please try again.';
  }
  if (error.status === 0) return 'Unable to reach TrumiTrip. Check your connection and try again.';
  if (error.status === 401) return 'Your session has expired. Please sign in again.';
  if (error.status === 403) return context === 'management' ? 'Your account does not have permission to manage this hotel.' : 'You do not have permission to view this hotel.';
  if (error.status === 404) return 'This hotel could not be found or is no longer available.';
  if (error.status >= 500) return context === 'management' ? 'Hotel management is temporarily unavailable. Please try again.' : 'Unable to load hotels. Please try again.';
  const details = error.errors.map(({ message }) => message).filter(Boolean).join('\n');
  return details || error.message || 'Please check the hotel information and try again.';
}
