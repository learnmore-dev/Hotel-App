import { apiRequest } from './client';
import type { ApiEnvelope } from '@/types/hotel';
import type {
  CreatePaymentPayload,
  Payment,
  RazorpayOrderDetails,
  VerifyRazorpayPayload,
} from '@/types/payment';

export async function createPayment(payload: CreatePaymentPayload): Promise<Payment> {
  const headers: Record<string, string> = {};
  if (payload.idempotencyKey) {
    headers['Idempotency-Key'] = payload.idempotencyKey;
  }

  const response = await apiRequest<ApiEnvelope<Payment>>('/payments', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  return response.data;
}

export async function createRazorpayOrder(bookingId: string): Promise<RazorpayOrderDetails> {
  const response = await apiRequest<ApiEnvelope<RazorpayOrderDetails>>('/payments/razorpay/order', {
    method: 'POST',
    body: JSON.stringify({ bookingId }),
  });
  return response.data;
}

export async function verifyRazorpayPayment(payload: VerifyRazorpayPayload): Promise<Payment> {
  const response = await apiRequest<ApiEnvelope<Payment>>('/payments/razorpay/verify', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function generateTestPaymentSignature(params: {
  bookingId: string;
  orderId?: string;
}): Promise<VerifyRazorpayPayload> {
  const response = await apiRequest<ApiEnvelope<VerifyRazorpayPayload>>('/payments/razorpay/test-sign', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  return response.data;
}

export async function getPaymentById(id: string): Promise<Payment> {
  const response = await apiRequest<ApiEnvelope<Payment>>(`/payments/${encodeURIComponent(id)}`);
  return response.data;
}

export async function getBookingPayment(bookingId: string): Promise<Payment> {
  const response = await apiRequest<ApiEnvelope<Payment>>(
    `/bookings/${encodeURIComponent(bookingId)}/payment`,
  );
  return response.data;
}

export async function refundPayment(paymentId: string, reason?: string): Promise<Payment> {
  const response = await apiRequest<ApiEnvelope<Payment>>(
    `/payments/${encodeURIComponent(paymentId)}/refund`,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    },
  );
  return response.data;
}

