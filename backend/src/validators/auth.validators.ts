import { body } from 'express-validator';

import { normalizeEmail } from '../utils/normalization.js';

const emailValidation = body('email')
  .isString()
  .withMessage('Enter a valid email address')
  .bail()
  .trim()
  .isEmail()
  .withMessage('Enter a valid email address')
  .bail()
  .customSanitizer(normalizeEmail);

export const registerValidation = [
  body('fullName')
    .isString()
    .withMessage('Full name is required')
    .bail()
    .trim()
    .isLength({ min: 1, max: 160 })
    .withMessage('Full name must be between 1 and 160 characters'),
  emailValidation,
  body('phone')
    .optional({ checkFalsy: true })
    .isString()
    .withMessage('Enter a valid phone number')
    .bail()
    .trim()
    .isMobilePhone('any')
    .withMessage('Enter a valid phone number'),
  body('password')
    .isString()
    .withMessage('Password is required')
    .bail()
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .bail()
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)
    .withMessage('Password must include an uppercase letter, a lowercase letter, and a number')
    .bail()
    .custom((password: string) => Buffer.byteLength(password, 'utf8') <= 72)
    .withMessage('Password must be 72 bytes or fewer'),
  body('confirmPassword')
    .isString()
    .withMessage('Confirm password is required')
    .bail()
    .custom((value: string, { req }) => value === req.body.password)
    .withMessage('Passwords do not match'),
  body('role').custom((_value, { req }) => {
    if (req.body != null && Object.hasOwn(req.body, 'role')) {
      throw new Error('Role cannot be provided during public registration');
    }
    return true;
  }),
];

export const loginValidation = [
  emailValidation,
  body('password').isString().withMessage('Password is required').bail().notEmpty().withMessage('Password is required'),
];

export const refreshTokenValidation = [
  body('refreshToken')
    .isString()
    .withMessage('Refresh token is required')
    .bail()
    .trim()
    .notEmpty()
    .withMessage('Refresh token is required'),
];
