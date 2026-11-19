export type PaymentMethod = 'UPI' | 'CARD' | 'NET_BANKING' | 'PAY_AT_HOTEL';

export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';

export type CreatePaymentPayload = {
  bookingId: string;
  paymentMethod: PaymentMethod;
  idempotencyKey?: string;
  simulateFailure?: boolean;
};

export type Payment = {
  id: string;
  bookingId: string;
  customerId: string;
  amount: number | string;
  currency: string;
  paymentMethod: PaymentMethod;
  transactionId: string;
  gatewayOrderId?: string | null;
  gatewayPaymentId?: string | null;
  gatewaySignature?: string | null;
  status: PaymentStatus;
  gateway: string;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  booking?: {
    id: string;
    bookingId: string;
    hotelId: string;
    roomId: string;
    checkIn: string;
    checkOut: string;
    roomsCount: number;
    guestsCount: number;
    numberOfNights: number;
    roomPrice: number | string;
    taxAmount: number | string;
    discountAmount: number | string;
    totalAmount: number | string;
    bookingStatus: string;
    paymentStatus: string;
    hotel?: {
      id: string;
      name: string;
      city: string;
      address: string;
    };
    room?: {
      id: string;
      roomType: string;
    };
  };
};

export type RazorpayOrderDetails = {
  keyId: string;
  orderId: string;
  amount: number; // in paise
  currency: string;
  bookingId: string;
  bookingRef: string;
  hotelName: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  paymentId: string;
};

export type VerifyRazorpayPayload = {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  bookingId: string;
};
