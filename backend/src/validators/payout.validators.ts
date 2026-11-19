import { body, param, query } from 'express-validator';

export const requestPayoutValidation = [
  body('bookingIds')
    .optional()
    .isArray()
    .withMessage('bookingIds must be an array of booking UUIDs'),
  body('bookingIds.*')
    .optional()
    .isUUID()
    .withMessage('Each bookingId must be a valid UUID'),
  body('notes')
    .optional({ values: 'null' })
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('notes must be 500 characters or fewer'),
];

export const partnerPayoutsQueryValidation = [
  query('status')
    .optional()
    .isIn(['PENDING', 'PROCESSING', 'PAID', 'FAILED', 'REJECTED', 'ALL'])
    .withMessage('Invalid payout status filter'),
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
  query('startDate')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('startDate must be in YYYY-MM-DD format'),
  query('endDate')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('endDate must be in YYYY-MM-DD format'),
];

export const partnerEarningsHistoryQueryValidation = [
  query('status')
    .optional()
    .isIn(['AVAILABLE', 'PENDING', 'PROCESSING', 'PAID', 'FAILED', 'REJECTED', 'PAY_AT_HOTEL', 'ALL'])
    .withMessage('Invalid earnings status filter'),
  query('hotelId')
    .optional()
    .isUUID()
    .withMessage('hotelId must be a valid UUID'),
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
  query('startDate')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('startDate must be in YYYY-MM-DD format'),
  query('endDate')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('endDate must be in YYYY-MM-DD format'),
];

export const adminPayoutsQueryValidation = [
  query('status')
    .optional()
    .isIn(['PENDING', 'PROCESSING', 'PAID', 'FAILED', 'REJECTED', 'ALL'])
    .withMessage('Invalid payout status filter'),
  query('partnerId')
    .optional()
    .isUUID()
    .withMessage('partnerId must be a valid UUID'),
  query('hotelId')
    .optional()
    .isUUID()
    .withMessage('hotelId must be a valid UUID'),
  query('batchReference')
    .optional()
    .isString()
    .trim(),
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
  query('startDate')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('startDate must be in YYYY-MM-DD format'),
  query('endDate')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('endDate must be in YYYY-MM-DD format'),
];

export const adminPayoutIdValidation = [
  param('id')
    .isUUID()
    .withMessage('Payout ID must be a valid UUID'),
];

export const adminUpdatePayoutStatusValidation = [
  param('id')
    .isUUID()
    .withMessage('Payout ID must be a valid UUID'),
  body('action')
    .isIn(['APPROVE', 'REJECT', 'MARK_PAID'])
    .withMessage('action must be one of APPROVE, REJECT, or MARK_PAID'),
  body('transactionReference')
    .if(body('action').equals('MARK_PAID'))
    .isString()
    .trim()
    .notEmpty()
    .withMessage('transactionReference is required when marking a payout as paid')
    .isLength({ min: 3, max: 160 })
    .withMessage('transactionReference must be between 3 and 160 characters'),
  body('rejectionReason')
    .if(body('action').equals('REJECT'))
    .isString()
    .trim()
    .notEmpty()
    .withMessage('rejectionReason is required when rejecting a payout')
    .isLength({ min: 3, max: 500 })
    .withMessage('rejectionReason must be between 3 and 500 characters'),
  body('notes')
    .optional({ values: 'null' })
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('notes must be 500 characters or fewer'),
];

export const adminUpdateCommissionValidation = [
  param('id')
    .isUUID()
    .withMessage('Partner ID must be a valid UUID'),
  body('commissionRate')
    .isFloat({ min: 0, max: 100 })
    .withMessage('commissionRate must be a number between 0 and 100')
    .toFloat(),
];
