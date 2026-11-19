import { body, param, query } from 'express-validator';

export const validateCouponValidation = [
  body('code')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Coupon code is required')
    .isLength({ min: 1, max: 64 })
    .withMessage('Coupon code must be between 1 and 64 characters'),
  body('bookingAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('bookingAmount must be a non-negative number')
    .bail()
    .toFloat(),
];

export const createCouponValidation = [
  body('code')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Coupon code is required')
    .isLength({ min: 2, max: 64 })
    .withMessage('Coupon code must be between 2 and 64 characters'),
  body('description')
    .optional({ values: 'null' })
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('description must be 500 characters or fewer'),
  body('discountType')
    .isIn(['PERCENTAGE', 'FIXED', 'FIXED_AMOUNT'])
    .withMessage('discountType must be PERCENTAGE, FIXED, or FIXED_AMOUNT'),
  body('discountValue')
    .isFloat({ gt: 0 })
    .withMessage('discountValue must be a positive number')
    .bail()
    .toFloat()
    .custom((value, { req }) => {
      const type = req.body.discountType;
      if (type === 'PERCENTAGE' && value > 100) {
        throw new Error('Percentage discount cannot exceed 100');
      }
      return true;
    }),
  body('minimumBookingAmount')
    .optional({ values: 'null' })
    .isFloat({ min: 0 })
    .withMessage('minimumBookingAmount must be a non-negative number')
    .bail()
    .toFloat(),
  body('maximumDiscount')
    .optional({ values: 'null' })
    .isFloat({ min: 0 })
    .withMessage('maximumDiscount must be a non-negative number')
    .bail()
    .toFloat(),
  body('validFrom')
    .isISO8601()
    .withMessage('validFrom must be a valid ISO 8601 date string'),
  body('validUntil')
    .isISO8601()
    .withMessage('validUntil must be a valid ISO 8601 date string')
    .custom((value, { req }) => {
      const from = new Date(req.body.validFrom);
      const until = new Date(value);
      if (!Number.isNaN(from.getTime()) && !Number.isNaN(until.getTime()) && until <= from) {
        throw new Error('validUntil must be after validFrom');
      }
      return true;
    }),
  body('usageLimit')
    .optional({ values: 'null' })
    .isInt({ min: 1 })
    .withMessage('usageLimit must be a positive integer')
    .bail()
    .toInt(),
  body('perUserLimit')
    .optional({ values: 'null' })
    .isInt({ min: 1 })
    .withMessage('perUserLimit must be a positive integer')
    .bail()
    .toInt(),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
    .bail()
    .toBoolean(),
];

export const updateCouponValidation = [
  param('id')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Coupon ID is required'),
  body('code')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 64 })
    .withMessage('Coupon code must be between 2 and 64 characters'),
  body('description')
    .optional({ values: 'null' })
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('description must be 500 characters or fewer'),
  body('discountType')
    .optional()
    .isIn(['PERCENTAGE', 'FIXED', 'FIXED_AMOUNT'])
    .withMessage('discountType must be PERCENTAGE, FIXED, or FIXED_AMOUNT'),
  body('discountValue')
    .optional()
    .isFloat({ gt: 0 })
    .withMessage('discountValue must be a positive number')
    .bail()
    .toFloat()
    .custom((value, { req }) => {
      const type = req.body.discountType;
      if (type === 'PERCENTAGE' && value > 100) {
        throw new Error('Percentage discount cannot exceed 100');
      }
      return true;
    }),
  body('minimumBookingAmount')
    .optional({ values: 'null' })
    .isFloat({ min: 0 })
    .withMessage('minimumBookingAmount must be a non-negative number')
    .bail()
    .toFloat(),
  body('maximumDiscount')
    .optional({ values: 'null' })
    .isFloat({ min: 0 })
    .withMessage('maximumDiscount must be a non-negative number')
    .bail()
    .toFloat(),
  body('validFrom')
    .optional()
    .isISO8601()
    .withMessage('validFrom must be a valid ISO 8601 date string'),
  body('validUntil')
    .optional()
    .isISO8601()
    .withMessage('validUntil must be a valid ISO 8601 date string'),
  body('usageLimit')
    .optional({ values: 'null' })
    .isInt({ min: 1 })
    .withMessage('usageLimit must be a positive integer')
    .bail()
    .toInt(),
  body('perUserLimit')
    .optional({ values: 'null' })
    .isInt({ min: 1 })
    .withMessage('perUserLimit must be a positive integer')
    .bail()
    .toInt(),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
    .bail()
    .toBoolean(),
];

export const adminCouponQueryValidation = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000000 })
    .withMessage('page must be a positive integer')
    .bail()
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('limit must be between 1 and 50')
    .bail()
    .toInt(),
  query('search')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('search must be 100 characters or fewer'),
  query('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
    .bail()
    .toBoolean(),
  query('discountType')
    .optional()
    .isIn(['PERCENTAGE', 'FIXED', 'FIXED_AMOUNT'])
    .withMessage('discountType must be PERCENTAGE, FIXED, or FIXED_AMOUNT'),
];
