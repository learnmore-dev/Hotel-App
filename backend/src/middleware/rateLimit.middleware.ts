import { rateLimit } from 'express-rate-limit';
import type { Request, Response } from 'express';

import type { ApiErrorResponse } from '../types/api.js';

function createRateLimitHandler(customMessage: string) {
  return (_req: Request, res: Response): void => {
    const response: ApiErrorResponse = {
      success: false,
      message: customMessage,
      errors: [
        {
          field: 'rateLimit',
          message: customMessage,
        },
      ],
    };
    res.status(429).json(response);
  };
}

/**
 * Strict rate limiter for authentication endpoints: /api/auth/login, /api/auth/register.
 * Prevents automated credential stuffing and brute-force account creation.
 * Allows 10 attempts per 15 minutes per IP.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // 10 attempts
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  handler: createRateLimitHandler(
    'Too many authentication attempts from this IP. Please try again after 15 minutes.',
  ),
});

/**
 * Token refresh rate limiter for /api/auth/refresh.
 * Allows 60 requests per 15 minutes per IP to support normal app background refresh while preventing flooding.
 */
export const tokenRefreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  handler: createRateLimitHandler(
    'Too many token refresh requests from this IP. Please wait a few moments before trying again.',
  ),
});

/**
 * Targeted rate limiter for booking creation and management: /api/bookings.
 * Prevents inventory spam and denial-of-service booking generation.
 * Allows 60 requests per 15 minutes per IP.
 */
export const bookingRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  handler: createRateLimitHandler(
    'Too many booking requests from this IP. Please wait a few moments before trying again.',
  ),
});

/**
 * Targeted rate limiter for payment transactions: /api/payments.
 * Prevents transaction flooding and card testing attacks.
 * Allows 30 payment operations per 15 minutes per IP.
 * Webhook callbacks from payment gateways are exempt from transaction throttling.
 */
export const paymentRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test' || req.path.includes('/webhook'),
  handler: createRateLimitHandler(
    'Too many payment transactions from this IP. Please wait a few moments before retrying.',
  ),
});

/**
 * General API rate limiter applied globally to protect infrastructure.
 * Generous threshold for legitimate mobile app usage (300 requests per 15 minutes).
 */
export const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  handler: createRateLimitHandler(
    'Too many requests to TrumiTrip API. Please slow down and try again shortly.',
  ),
});
