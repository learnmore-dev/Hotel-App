import crypto from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';

import type { UserRole } from '../types/api.js';

export type VerifiedToken = {
  userId: string;
  role: UserRole;
};

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters');
  }
  return secret;
}

/**
 * Generate a short-lived access token.
 * Defaults to 15 minutes unless ACCESS_TOKEN_EXPIRES_IN is set.
 * No need to configure JWT_EXPIRES_IN in .env.
 */
export function generateAccessToken(
  userId: string,
  role: UserRole,
  customExpiresIn?: SignOptions['expiresIn']
): string {
  const expiresIn = (customExpiresIn ?? (process.env.ACCESS_TOKEN_EXPIRES_IN || '15m')) as SignOptions['expiresIn'];
  return jwt.sign({ role }, getJwtSecret(), {
    subject: userId,
    algorithm: 'HS256',
    expiresIn,
  });
}

export function verifyAccessToken(token: string): VerifiedToken {
  const payload = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
  if (
    typeof payload === 'string' ||
    typeof payload.sub !== 'string' ||
    (payload.role !== 'CUSTOMER' && payload.role !== 'PARTNER' && payload.role !== 'ADMIN')
  ) {
    throw new jwt.JsonWebTokenError('Token claims are invalid');
  }
  return { userId: payload.sub, role: payload.role };
}

/**
 * Computes a secure SHA-256 hash of a raw token string for database storage.
 */
export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Generates a cryptographically strong 256-bit random string for use as a refresh token.
 */
export function generateRawRefreshToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** Compatibility aliases for existing middleware imports. */
export const generateToken = (userId: string): string => generateAccessToken(userId, 'CUSTOMER');
export const verifyToken = verifyAccessToken;
