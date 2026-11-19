import { body, param, query } from 'express-validator';

const optionalText = (field: string, maximum: number) =>
  body(field).optional().isString().withMessage(`${field} must be text`).bail().trim().isLength({ max: maximum });

const requiredText = (field: string, maximum: number) =>
  body(field)
    .isString()
    .withMessage(`${field} is required`)
    .bail()
    .trim()
    .isLength({ min: 1, max: maximum })
    .withMessage(`${field} must be between 1 and ${maximum} characters`);

const optionalNumber = (field: string, min: number, max?: number) =>
  body(field)
    .optional()
    .isFloat({ min, ...(max === undefined ? {} : { max }) })
    .withMessage(`${field} must be a valid number`)
    .bail()
    .toFloat();

export const hotelIdValidation = [param('id').isUUID().withMessage('Hotel ID must be a valid UUID')];

export const hotelListQueryValidation = [
  query('search').optional().isString().trim().isLength({ max: 160 }).withMessage('Search must be 160 characters or fewer'),
  query('city').optional().isString().trim().isLength({ max: 120 }).withMessage('City must be 120 characters or fewer'),
  query('destination')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 120 })
    .withMessage('Destination must be 120 characters or fewer'),
  query('minPrice').optional().isFloat({ min: 0 }).withMessage('minPrice must be zero or greater').bail().toFloat(),
  query('maxPrice').optional().isFloat({ min: 0 }).withMessage('maxPrice must be zero or greater').bail().toFloat(),
  query('starRating').optional().isInt({ min: 1, max: 5 }).withMessage('starRating must be between 1 and 5').bail().toInt(),
  query('featured').optional().isIn(['true', 'false']).withMessage('featured must be true or false').bail().toBoolean(),
  query('amenities').optional().isString().trim().isLength({ max: 500 }).withMessage('amenities filter is too long'),
  query('page').optional().isInt({ min: 1, max: 1000000 }).withMessage('page must be a positive integer').bail().toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit must be between 1 and 50').bail().toInt(),
  query('sort')
    .optional()
    .isIn(['price_asc', 'price_desc', 'rating', 'popular', 'newest'])
    .withMessage('sort must be price_asc, price_desc, rating, popular, or newest'),
];

const restrictedPartnerFields = body().custom((_value, { req }) => {
  const forbidden = ['partnerId', 'userId', 'role', 'isActive', 'isFeatured', 'approvalStatus'];
  const provided = forbidden.find((field) => req.body != null && Object.hasOwn(req.body, field));
  if (provided) throw new Error(`${provided} cannot be set by a partner`);
  return true;
});

const imageArray = (field: string) =>
  body(field)
    .optional()
    .isArray({ max: 20 })
    .withMessage(`${field} must be a list of up to 20 image paths`)
    .bail()
    .custom((images: unknown[]) => images.every((image) => typeof image === 'string' && image.trim().length > 0 && image.length <= 2048))
    .withMessage(`${field} must contain non-empty image paths or URLs`);

const amenitiesArray = (field: string) =>
  body(field)
    .optional()
    .isArray({ max: 40 })
    .withMessage(`${field} must be a list of up to 40 items`)
    .bail()
    .custom((values: unknown[]) => values.every((value) => typeof value === 'string' && value.trim().length > 0 && value.length <= 80))
    .withMessage(`${field} items must be non-empty text under 80 characters`);

export const createHotelValidation = [
  requiredText('name', 200),
  optionalText('description', 5000),
  requiredText('city', 120),
  requiredText('destination', 120),
  requiredText('address', 1000),
  optionalNumber('latitude', -90, 90),
  optionalNumber('longitude', -180, 180),
  body('starRating').optional().isInt({ min: 1, max: 5 }).withMessage('starRating must be between 1 and 5').bail().toInt(),
  body('pricePerNight').isFloat({ gt: 0 }).withMessage('pricePerNight must be greater than zero').bail().toFloat(),
  body('originalPrice').optional().isFloat({ gt: 0 }).withMessage('originalPrice must be greater than zero').bail().toFloat(),
  body('mainImage').optional({ nullable: true }).isString().trim().isLength({ max: 2048 }).withMessage('mainImage must be a valid image URL or path'),
  imageArray('galleryImages'),
  amenitiesArray('amenities'),
  optionalText('checkInTime', 20).bail().custom((value: string | undefined) => value === undefined || /^([01]\d|2[0-3]):[0-5]\d$/.test(value)).withMessage('checkInTime must use HH:mm format'),
  optionalText('checkOutTime', 20).bail().custom((value: string | undefined) => value === undefined || /^([01]\d|2[0-3]):[0-5]\d$/.test(value)).withMessage('checkOutTime must use HH:mm format'),
  restrictedPartnerFields,
];

export const updateHotelValidation = [
  ...hotelIdValidation,
  optionalText('name', 200).bail().isLength({ min: 1 }).withMessage('name cannot be empty'),
  optionalText('description', 5000),
  optionalText('city', 120).bail().isLength({ min: 1 }).withMessage('city cannot be empty'),
  optionalText('destination', 120).bail().isLength({ min: 1 }).withMessage('destination cannot be empty'),
  optionalText('address', 1000).bail().isLength({ min: 1 }).withMessage('address cannot be empty'),
  optionalNumber('latitude', -90, 90),
  optionalNumber('longitude', -180, 180),
  body('starRating').optional().isInt({ min: 1, max: 5 }).withMessage('starRating must be between 1 and 5').bail().toInt(),
  optionalNumber('pricePerNight', Number.MIN_VALUE),
  body('originalPrice').optional().isFloat({ gt: 0 }).withMessage('originalPrice must be greater than zero').bail().toFloat(),
  body('mainImage').optional({ nullable: true }).isString().trim().isLength({ max: 2048 }).withMessage('mainImage must be a valid image URL or path'),
  imageArray('galleryImages'),
  amenitiesArray('amenities'),
  optionalText('checkInTime', 20).bail().custom((value: string | undefined) => value === undefined || /^([01]\d|2[0-3]):[0-5]\d$/.test(value)).withMessage('checkInTime must use HH:mm format'),
  optionalText('checkOutTime', 20).bail().custom((value: string | undefined) => value === undefined || /^([01]\d|2[0-3]):[0-5]\d$/.test(value)).withMessage('checkOutTime must use HH:mm format'),
  body().custom((value) => value != null && Object.keys(value).length > 0).withMessage('At least one hotel field is required'),
  restrictedPartnerFields,
];

export const partnerHotelStatusValidation = [
  ...hotelIdValidation,
  body('isActive').isBoolean().withMessage('isActive must be true or false').bail().toBoolean(),
];

export const adminHotelStatusValidation = partnerHotelStatusValidation;

export const adminHotelFeaturedValidation = [
  ...hotelIdValidation,
  body('isFeatured').isBoolean().withMessage('isFeatured must be true or false').bail().toBoolean(),
];
