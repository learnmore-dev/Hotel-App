import { body, param, query } from 'express-validator';

export const notificationQueryValidation = [
  query('unreadOnly')
    .optional()
    .isBoolean()
    .withMessage('unreadOnly must be a boolean')
    .toBoolean(),
  query('type')
    .optional()
    .isIn(['BOOKING', 'PAYMENT', 'PROMOTION', 'SYSTEM'])
    .withMessage('Invalid notification type filter'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('page must be an integer >= 1')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be an integer between 1 and 100')
    .toInt(),
];

export const notificationIdValidation = [
  param('id')
    .isUUID()
    .withMessage('Notification ID must be a valid UUID'),
];

export const updatePreferencesValidation = [
  body('bookingUpdates')
    .optional()
    .isBoolean()
    .withMessage('bookingUpdates must be a boolean')
    .toBoolean(),
  body('paymentAlerts')
    .optional()
    .isBoolean()
    .withMessage('paymentAlerts must be a boolean')
    .toBoolean(),
  body('payoutAlerts')
    .optional()
    .isBoolean()
    .withMessage('payoutAlerts must be a boolean')
    .toBoolean(),
  body('reminders')
    .optional()
    .isBoolean()
    .withMessage('reminders must be a boolean')
    .toBoolean(),
  body('marketing')
    .optional()
    .isBoolean()
    .withMessage('marketing must be a boolean')
    .toBoolean(),
  body('pushEnabled')
    .optional()
    .isBoolean()
    .withMessage('pushEnabled must be a boolean')
    .toBoolean(),
  body('emailEnabled')
    .optional()
    .isBoolean()
    .withMessage('emailEnabled must be a boolean')
    .toBoolean(),
];

export const registerPushTokenValidation = [
  body('pushToken')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('pushToken is required')
    .isLength({ min: 5, max: 255 })
    .withMessage('pushToken must be between 5 and 255 characters'),
  body('deviceType')
    .optional({ values: 'null' })
    .isString()
    .trim()
    .isLength({ max: 40 })
    .withMessage('deviceType must be 40 characters or fewer'),
];

export const unregisterPushTokenValidation = [
  body('pushToken')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('pushToken is required'),
];

export const broadcastNotificationValidation = [
  body('title')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('title is required')
    .isLength({ min: 1, max: 160 })
    .withMessage('title must be between 1 and 160 characters'),
  body('message')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('message is required')
    .isLength({ min: 1, max: 1000 })
    .withMessage('message must be between 1 and 1000 characters'),
  body('targetRole')
    .optional()
    .isIn(['CUSTOMER', 'PARTNER', 'ALL'])
    .withMessage('targetRole must be CUSTOMER, PARTNER, or ALL'),
  body('actionUrl')
    .optional({ values: 'null' })
    .isString()
    .trim()
    .isLength({ max: 255 })
    .withMessage('actionUrl must be 255 characters or fewer'),
];
