import type { RequestHandler } from 'express';

import * as notificationService from '../services/notification.service.js';
import type {
  BroadcastNotificationInput,
  NotificationListQuery,
  NotificationPreferencesInput,
  RegisterPushDeviceInput,
} from '../services/notification.service.js';
import type { ApiSuccess } from '../types/api.js';
import { ApiError } from '../utils/ApiError.js';

function asyncHandler(handler: RequestHandler): RequestHandler {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

/**
 * Retrieves paginated notifications for the authenticated user.
 */
export const getUserNotifications = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Authentication required');
  }

  const query: NotificationListQuery = {
    unreadOnly: req.query.unreadOnly !== undefined ? String(req.query.unreadOnly) === 'true' : undefined,
    type: req.query.type as NotificationListQuery['type'],
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  };

  const data = await notificationService.getUserNotifications(req.auth.userId, query);

  const response: ApiSuccess<typeof data> = {
    success: true,
    message: 'Notifications retrieved successfully',
    data,
  };

  res.json(response);
});

/**
 * Retrieves current unread notification count for the authenticated user.
 */
export const getUnreadCount = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Authentication required');
  }

  const data = await notificationService.getUnreadCount(req.auth.userId);

  const response: ApiSuccess<typeof data> = {
    success: true,
    message: 'Unread notification count retrieved successfully',
    data,
  };

  res.json(response);
});

/**
 * Marks a single notification as read.
 */
export const markNotificationAsRead = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Authentication required');
  }

  const notificationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const data = await notificationService.markNotificationAsRead(req.auth.userId, notificationId);

  const response: ApiSuccess<typeof data> = {
    success: true,
    message: 'Notification marked as read',
    data,
  };

  res.json(response);
});

/**
 * Marks all notifications for authenticated user as read in bulk.
 */
export const markAllNotificationsAsRead = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Authentication required');
  }

  const data = await notificationService.markAllNotificationsAsRead(req.auth.userId);

  const response: ApiSuccess<typeof data> = {
    success: true,
    message: 'All notifications marked as read',
    data,
  };

  res.json(response);
});

/**
 * Dismisses / deletes a single notification.
 */
export const deleteNotification = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Authentication required');
  }

  const notificationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const data = await notificationService.deleteNotification(req.auth.userId, notificationId);

  const response: ApiSuccess<typeof data> = {
    success: true,
    message: 'Notification deleted successfully',
    data,
  };

  res.json(response);
});

/**
 * Retrieves user's notification preferences.
 */
export const getUserPreferences = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Authentication required');
  }

  const data = await notificationService.getUserPreferences(req.auth.userId);

  const response: ApiSuccess<typeof data> = {
    success: true,
    message: 'Notification preferences retrieved successfully',
    data,
  };

  res.json(response);
});

/**
 * Updates user's notification preferences.
 */
export const updateUserPreferences = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Authentication required');
  }

  const input: NotificationPreferencesInput = {
    bookingUpdates: req.body.bookingUpdates,
    paymentAlerts: req.body.paymentAlerts,
    payoutAlerts: req.body.payoutAlerts,
    reminders: req.body.reminders,
    marketing: req.body.marketing,
    pushEnabled: req.body.pushEnabled,
    emailEnabled: req.body.emailEnabled,
  };

  const data = await notificationService.updateUserPreferences(req.auth.userId, input);

  const response: ApiSuccess<typeof data> = {
    success: true,
    message: 'Notification preferences updated successfully',
    data,
  };

  res.json(response);
});

/**
 * Registers an active push device token.
 */
export const registerPushDevice = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Authentication required');
  }

  const input: RegisterPushDeviceInput = {
    pushToken: req.body.pushToken,
    deviceType: req.body.deviceType,
  };

  const data = await notificationService.registerPushDevice(req.auth.userId, input);

  const response: ApiSuccess<typeof data> = {
    success: true,
    message: 'Push device registered successfully',
    data,
  };

  res.status(201).json(response);
});

/**
 * Unregisters a push device token.
 */
export const unregisterPushDevice = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Authentication required');
  }

  const pushToken = req.body.pushToken || (req.query.pushToken as string);
  if (!pushToken) {
    throw new ApiError(400, 'pushToken is required');
  }

  const data = await notificationService.unregisterPushDevice(req.auth.userId, pushToken);

  const response: ApiSuccess<typeof data> = {
    success: true,
    message: 'Push device unregistered successfully',
    data,
  };

  res.json(response);
});

/**
 * Admin: Broadcast notification to target roles.
 */
export const broadcastNotification = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Authentication required');
  }

  const input: BroadcastNotificationInput = {
    title: req.body.title,
    message: req.body.message,
    targetRole: req.body.targetRole,
    actionUrl: req.body.actionUrl,
  };

  const data = await notificationService.broadcastNotification(req.auth.userId, input);

  const response: ApiSuccess<typeof data> = {
    success: true,
    message: 'Broadcast notifications dispatched successfully',
    data,
  };

  res.status(201).json(response);
});
