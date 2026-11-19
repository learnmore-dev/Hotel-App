import { body, param, query } from 'express-validator';

export const createReviewValidation = [
  body('bookingId')
    .isUUID()
    .withMessage('bookingId must be a valid UUID'),
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('rating must be an integer between 1 and 5')
    .toInt(),
  body('comment')
    .optional({ values: 'null' })
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('comment must be 1000 characters or fewer'),
];

export const updateReviewValidation = [
  param('id')
    .isUUID()
    .withMessage('Review ID must be a valid UUID'),
  body('rating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('rating must be an integer between 1 and 5')
    .toInt(),
  body('comment')
    .optional({ values: 'null' })
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('comment must be 1000 characters or fewer'),
  body().custom((value) => {
    if (value.rating === undefined && value.comment === undefined) {
      throw new Error('At least one of rating or comment must be provided for update');
    }
    return true;
  }),
];

export const reviewIdValidation = [
  param('id')
    .isUUID()
    .withMessage('Review ID must be a valid UUID'),
];

export const bookingEligibilityValidation = [
  param('bookingId')
    .isUUID()
    .withMessage('bookingId must be a valid UUID'),
];

export const hotelReviewsQueryValidation = [
  param('hotelId')
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
    .isInt({ min: 1, max: 50 })
    .withMessage('limit must be between 1 and 50')
    .toInt(),
  query('rating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('rating must be between 1 and 5')
    .toInt(),
];

export const partnerReviewsQueryValidation = [
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
    .isInt({ min: 1, max: 50 })
    .withMessage('limit must be between 1 and 50')
    .toInt(),
  query('rating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('rating must be between 1 and 5')
    .toInt(),
];

export const adminReviewsQueryValidation = [
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
    .isInt({ min: 1, max: 50 })
    .withMessage('limit must be between 1 and 50')
    .toInt(),
  query('rating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('rating must be between 1 and 5')
    .toInt(),
  query('isPublished')
    .optional()
    .isBoolean()
    .withMessage('isPublished must be a boolean')
    .toBoolean(),
];

export const adminModerateReviewValidation = [
  param('id')
    .isUUID()
    .withMessage('Review ID must be a valid UUID'),
  body('isPublished')
    .isBoolean()
    .withMessage('isPublished is required and must be a boolean')
    .toBoolean(),
  body('reason')
    .optional({ values: 'null' })
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('reason must be 500 characters or fewer'),
];
