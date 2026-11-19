import { body, param, query } from 'express-validator';

export const createBookingValidation = [
  body('hotelId').isUUID().withMessage('Hotel ID must be a valid UUID'),
  body('roomId').isUUID().withMessage('Room ID must be a valid UUID'),
  body('checkIn')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('checkIn must use YYYY-MM-DD format'),
  body('checkOut')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('checkOut must use YYYY-MM-DD format'),
  body('roomsCount')
    .isInt({ min: 1, max: 50 })
    .withMessage('roomsCount must be a positive integer between 1 and 50')
    .bail()
    .toInt(),
  body('guestsCount')
    .isInt({ min: 1, max: 200 })
    .withMessage('guestsCount must be a positive integer between 1 and 200')
    .bail()
    .toInt(),
  body('guestDetails').isObject().withMessage('guestDetails is required and must be an object'),
  body('guestDetails.fullName')
    .isString()
    .trim()
    .isLength({ min: 1, max: 160 })
    .withMessage('Guest full name is required (up to 160 characters)'),
  body('guestDetails.email')
    .isEmail()
    .normalizeEmail()
    .withMessage('A valid guest email is required'),
  body('guestDetails.phone')
    .isString()
    .trim()
    .isLength({ min: 4, max: 32 })
    .withMessage('A valid guest phone number is required (up to 32 characters)'),
  body('specialRequests')
    .optional({ values: 'null' })
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('specialRequests must be 500 characters or fewer'),
  body('idempotencyKey')
    .optional({ values: 'null' })
    .isString()
    .trim()
    .isLength({ max: 128 })
    .withMessage('idempotencyKey must be 128 characters or fewer'),
  body('couponCode')
    .optional({ values: 'null' })
    .isString()
    .trim()
    .isLength({ min: 1, max: 64 })
    .withMessage('couponCode must be 64 characters or fewer'),
];

export const cancelBookingValidation = [
  param('id').isString().trim().notEmpty().withMessage('Booking ID is required'),
  body('cancellationReason')
    .optional({ values: 'null' })
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('cancellationReason must be 500 characters or fewer'),
];

export const updateBookingStatusValidation = [
  param('id').isString().trim().notEmpty().withMessage('Booking ID is required'),
  body('status')
    .isIn(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'])
    .withMessage('status must be PENDING, CONFIRMED, CANCELLED, or COMPLETED'),
  body('reason')
    .optional({ values: 'null' })
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('reason must be 500 characters or fewer'),
];

export const bookingQueryValidation = [
  query('page').optional().isInt({ min: 1, max: 1000000 }).withMessage('page must be a positive integer').bail().toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit must be between 1 and 50').bail().toInt(),
  query('status')
    .optional()
    .isIn(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'])
    .withMessage('status must be PENDING, CONFIRMED, CANCELLED, or COMPLETED'),
  query('paymentStatus')
    .optional()
    .isIn(['PENDING', 'PAID', 'FAILED', 'REFUNDED'])
    .withMessage('paymentStatus must be PENDING, PAID, FAILED, or REFUNDED'),
  query('hotelId').optional().isUUID().withMessage('hotelId must be a valid UUID'),
  query('customerId').optional().isUUID().withMessage('customerId must be a valid UUID'),
  query('startDate').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('startDate must use YYYY-MM-DD format'),
  query('endDate').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('endDate must use YYYY-MM-DD format'),
  query('search').optional().isString().trim().isLength({ max: 100 }).withMessage('search must be 100 characters or fewer'),
  query('timeFilter').optional().isIn(['upcoming', 'past', 'cancelled']).withMessage('timeFilter must be upcoming, past, or cancelled'),
];
