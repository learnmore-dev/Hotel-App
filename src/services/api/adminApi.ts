
import { apiRequest } from './client';
import type { ApiEnvelope } from '@/types/hotel';

export type AdminDashboardData = {
  users: {
    total: number;
    customers: number;
    partners: number;
  };
  hotels: {
    total: number;
    active: number;
    featured: number;
  };
  bookings: {
    total: number;
    confirmed: number;
    pending: number;
    cancelled: number;
  };
  payments: {
    total: number;
    successful: number;
    pending: number;
    revenue: string;
  };
  payouts: {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
};

export type AdminAnalyticsData = {
  period: {
    startDate: string;
    endDate: string;
    days: number;
  };
  bookingTrends: {
    date: string;
    count: number;
  }[];
  revenueTrends: {
    date: string;
    revenue: string;
  }[];
  bookingStatus: {
    status: string;
    count: number;
  }[];
  paymentStatus: {
    status: string;
    count: number;
  }[];
  payoutStatus: {
    status: string;
    count: number;
    amount: string;
  }[];
};

export async function getAdminDashboard(): Promise<AdminDashboardData> {
  const response = await apiRequest<ApiEnvelope<AdminDashboardData>>(
    '/admin/dashboard',
  );

  return response.data;
}

export async function getAdminAnalytics(): Promise<AdminAnalyticsData> {
  const response = await apiRequest<ApiEnvelope<AdminAnalyticsData>>(
    '/admin/analytics',
  );

  return response.data;
}



export type AdminVendor = {
  id: string;
  businessName: string;
  businessEmail: string | null;
  businessPhone: string | null;
  address: string | null;
  documents: string[];
  status: string;
  commissionRate: string;
  hotelCount: number;
  user: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
    role: string;
    isActive: boolean;
  };
  createdAt: string | null;
  updatedAt: string | null;
};

export type AdminVendorsQuery = {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
};

export type AdminVendorsResponse = {
  items: AdminVendor[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export async function getAdminVendors(
  query: AdminVendorsQuery = {},
): Promise<AdminVendorsResponse> {
  const params = new URLSearchParams();

  if (query.search) params.set('search', query.search);
  if (query.status) params.set('status', query.status);
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));

  const queryString = params.toString();
  const response = await apiRequest<ApiEnvelope<AdminVendorsResponse>>(
    `/admin/vendors${queryString ? `?${queryString}` : ''}`,
  );

  return response.data;
}
