import { Router } from 'express';

import * as notificationController from '../controllers/notification.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  notificationIdValidation,
  notificationQueryValidation,
  registerPushTokenValidation,
  unregisterPushTokenValidation,
  updatePreferencesValidation,
} from '../validators/notification.validators.js';

const notificationRouter = Router();

// All notification routes require authenticated user
notificationRouter.use(authenticate);

// 1. List user notifications with filtering and pagination
notificationRouter.get(
  '/',
  notificationQueryValidation,
  validateRequest,
  notificationController.getUserNotifications,
);

// 2. Unread notification count for badge
notificationRouter.get(
  '/unread-count',
  notificationController.getUnreadCount,
);

// 3. Mark all notifications as read
notificationRouter.patch(
  '/mark-all-read',
  notificationController.markAllNotificationsAsRead,
);
notificationRouter.post(
  '/mark-all-read',
  notificationController.markAllNotificationsAsRead,
);

// 4. Mark single notification as read
notificationRouter.patch(
  '/:id/read',
  notificationIdValidation,
  validateRequest,
  notificationController.markNotificationAsRead,
);

// 5. Dismiss / delete a single notification
notificationRouter.delete(
  '/:id',
  notificationIdValidation,
  validateRequest,
  notificationController.deleteNotification,
);

// 6. User notification preferences
notificationRouter.get(
  '/preferences',
  notificationController.getUserPreferences,
);

notificationRouter.patch(
  '/preferences',
  updatePreferencesValidation,
  validateRequest,
  notificationController.updateUserPreferences,
);

notificationRouter.put(
  '/preferences',
  updatePreferencesValidation,
  validateRequest,
  notificationController.updateUserPreferences,
);

// 7. Push device token management
notificationRouter.post(
  '/devices',
  registerPushTokenValidation,
  validateRequest,
  notificationController.registerPushDevice,
);

notificationRouter.delete(
  '/devices',
  unregisterPushTokenValidation,
  validateRequest,
  notificationController.unregisterPushDevice,
);

notificationRouter.post(
  '/devices/unregister',
  unregisterPushTokenValidation,
  validateRequest,
  notificationController.unregisterPushDevice,
);

export default notificationRouter;
