export type NotificationType = 'BOOKING' | 'PAYMENT' | 'PROMOTION' | 'SYSTEM';

export type Notification = {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  readAt: string | null;
  dedupKey?: string | null;
  actionUrl?: string | null;
  data?: Record<string, unknown> | null;
  createdAt: string;
};

export type NotificationListResponse = {
  items: Notification[];
  unreadCount: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type NotificationPreferences = {
  bookingUpdates: boolean;
  paymentAlerts: boolean;
  payoutAlerts: boolean;
  reminders: boolean;
  marketing: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
  updatedAt?: string;
};

export type NotificationQuery = {
  unreadOnly?: boolean;
  type?: NotificationType;
  page?: number;
  limit?: number;
};

export type PushDeviceRegistration = {
  pushToken: string;
  deviceType?: string | null;
};
