import { apiRequest } from './client';
import type { ApiEnvelope } from '@/types/hotel';
import type {
  Notification,
  NotificationListResponse,
  NotificationPreferences,
  NotificationQuery,
  PushDeviceRegistration,
} from '@/types/notification';

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
 * Retrieves paginated list of notifications for the current user.
 */
export async function getNotifications(query?: NotificationQuery): Promise<NotificationListResponse> {
  const qs = queryString(query as Record<string, unknown>);
  const response = await apiRequest<ApiEnvelope<NotificationListResponse>>(`/notifications${qs}`);
  return response.data;
}

/**
 * Retrieves unread notification count for badge rendering.
 */
export async function getUnreadNotificationCount(): Promise<{ unreadCount: number }> {
  const response = await apiRequest<ApiEnvelope<{ unreadCount: number }>>('/notifications/unread-count');
  return response.data;
}

/**
 * Marks a single notification as read.
 */
export async function markNotificationAsRead(id: string): Promise<Notification> {
  const response = await apiRequest<ApiEnvelope<Notification>>(`/notifications/${encodeURIComponent(id)}/read`, {
    method: 'PATCH',
  });
  return response.data;
}

/**
 * Marks all notifications for current user as read in bulk.
 */
export async function markAllNotificationsAsRead(): Promise<{ updatedCount: number }> {
  const response = await apiRequest<ApiEnvelope<{ updatedCount: number }>>('/notifications/mark-all-read', {
    method: 'PATCH',
  });
  return response.data;
}

/**
 * Dismisses / deletes a single notification.
 */
export async function deleteNotification(id: string): Promise<{ success: boolean; message: string }> {
  const response = await apiRequest<ApiEnvelope<{ success: boolean; message: string }>>(
    `/notifications/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
    },
  );
  return response.data;
}

/**
 * Retrieves user's notification preferences.
 */
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const response = await apiRequest<ApiEnvelope<NotificationPreferences>>('/notifications/preferences');
  return response.data;
}

/**
 * Updates user's notification preferences.
 */
export async function updateNotificationPreferences(
  payload: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  const response = await apiRequest<ApiEnvelope<NotificationPreferences>>('/notifications/preferences', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return response.data;
}

/**
 * Registers an active push device token.
 */
export async function registerPushDevice(
  payload: PushDeviceRegistration,
): Promise<{ pushToken: string; isActive: boolean }> {
  const response = await apiRequest<ApiEnvelope<{ pushToken: string; isActive: boolean }>>('/notifications/devices', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response.data;
}

/**
 * Unregisters a push device token.
 */
export async function unregisterPushDevice(pushToken: string): Promise<{ success: boolean }> {
  const response = await apiRequest<ApiEnvelope<{ success: boolean }>>('/notifications/devices', {
    method: 'DELETE',
    body: JSON.stringify({ pushToken }),
  });
  return response.data;
}
