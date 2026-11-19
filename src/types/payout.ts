export type PayoutStatus = 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' | 'REJECTED';

export type PartnerEarningsSummary = {
  partner: {
    id: string;
    businessName: string;
    commissionRate: number;
    status: string;
  };
  metrics: {
    availableBalance: number;
    pendingBalance: number;
    processingBalance: number;
    paidBalance: number;
    lifetimeGross: number;
    lifetimeCommission: number;
    lifetimeNet: number;
    eligibleBookingsCount: number;
  };
  payAtHotel: {
    totalBookings: number;
    totalCollectedByHotel: number;
    platformCommissionReceivable: number;
    notice: string;
  };
};

export type PartnerEarningsItem = {
  id: string;
  bookingId: string;
  hotel: {
    id: string;
    name: string;
    city: string;
  };
  customer: {
    fullName: string;
  };
  checkIn: string;
  checkOut: string;
  bookingStatus: string;
  paymentStatus: string;
  paymentMethod: string;
  amounts: {
    grossAmount: number;
    commissionRate: number;
    commissionAmount: number;
    netAmount: number;
  };
  payoutStatus: 'AVAILABLE' | 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' | 'REJECTED' | 'PAY_AT_HOTEL' | 'NOT_ELIGIBLE';
  payout: {
    id: string;
    batchReference: string | null;
    status: PayoutStatus;
    amount: number;
    commissionAmount: number;
    netAmount: number;
    transactionReference: string | null;
    rejectionReason: string | null;
    processedAt: string | null;
    createdAt: string;
  } | null;
  createdAt: string;
};

export type PartnerEarningsHistoryResponse = {
  items: PartnerEarningsItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type PayoutRecord = {
  id: string;
  batchReference: string | null;
  bookingId: string;
  bookingRef: string;
  hotelName: string;
  checkIn: string;
  checkOut: string;
  amount: number;
  commissionAmount: number;
  netAmount: number;
  status: PayoutStatus;
  transactionReference: string | null;
  rejectionReason: string | null;
  notes: string | null;
  processedAt: string | null;
  createdAt: string;
};

export type PartnerPayoutsResponse = {
  items: PayoutRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type RequestPayoutPayload = {
  bookingIds?: string[];
  notes?: string | null;
};

export type RequestPayoutResponse = {
  batchReference: string;
  totalGross: number;
  totalCommission: number;
  totalNet: number;
  payoutsCount: number;
  payouts: Array<{
    id: string;
    bookingId: string;
    amount: number;
    commissionAmount: number;
    netAmount: number;
    status: PayoutStatus;
  }>;
};

export type AdminPayoutItem = {
  id: string;
  batchReference: string | null;
  partner: {
    id: string;
    businessName: string;
    contactEmail: string;
    commissionRate: number;
  };
  booking: {
    id: string;
    bookingId: string;
    hotelName: string;
    city: string;
    checkIn: string;
    checkOut: string;
    customerName: string;
  };
  amount: number;
  commissionAmount: number;
  netAmount: number;
  status: PayoutStatus;
  transactionReference: string | null;
  rejectionReason: string | null;
  notes: string | null;
  processedBy: string | null;
  processedAt: string | null;
  createdAt: string;
};

export type AdminPayoutsResponse = {
  items: AdminPayoutItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type AdminUpdatePayoutStatusPayload = {
  action: 'APPROVE' | 'REJECT' | 'MARK_PAID';
  transactionReference?: string | null;
  rejectionReason?: string | null;
  notes?: string | null;
};

export type AdminUpdateCommissionPayload = {
  commissionRate: number;
};
