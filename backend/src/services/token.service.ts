import crypto from 'node:crypto';
import type { Prisma, UserRole } from '@prisma/client';

import { getPrismaClient } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { generateAccessToken, generateRawRefreshToken, hashToken } from '../utils/jwt.js';

export type SafeUser = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: UserRole;
  avatar: string | null;
  isActive: boolean;
  isEmailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export const safeUserSelect = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  role: true,
  avatar: true,
  isActive: true,
  isEmailVerified: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

const REFRESH_TOKEN_EXPIRATION_DAYS = 30;

function getRefreshTokenDurationMs(): number {
  return REFRESH_TOKEN_EXPIRATION_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Creates and stores a new refresh token session for a user.
 * Returns the raw token that must be sent to the client (never stored in DB).
 */
export async function createRefreshTokenSession(
  userId: string,
  family?: string
): Promise<{ rawRefreshToken: string; expiresAt: Date; family: string }> {
  const prisma = getPrismaClient();
  const rawRefreshToken = generateRawRefreshToken();
  const tokenHash = hashToken(rawRefreshToken);
  const tokenFamily = family ?? crypto.randomUUID();
  const expiresAt = new Date(Date.now() + getRefreshTokenDurationMs());

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      family: tokenFamily,
      expiresAt,
    },
  });

  return { rawRefreshToken, expiresAt, family: tokenFamily };
}

/**
 * Securely rotates a refresh token:
 * - Detects reuse of previously rotated/revoked tokens and revokes the whole family lineage.
 * - Atomically revokes the current token and creates the replacement token.
 * - Issues a fresh short-lived access token.
 */
export async function rotateRefreshToken(
  rawRefreshToken: string
): Promise<{ accessToken: string; refreshToken: string; user: SafeUser }> {
  const prisma = getPrismaClient();
  const tokenHash = hashToken(rawRefreshToken);

  const tokenRecord = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: { select: safeUserSelect } },
  });

  if (!tokenRecord) {
    throw new ApiError(401, 'Invalid or expired refresh token');
  }

  // Token reuse detection: if already revoked, potential theft detected!
  if (tokenRecord.isRevoked) {
    await prisma.refreshToken.updateMany({
      where: { family: tokenRecord.family },
      data: { isRevoked: true, revokedAt: new Date() },
    });
    throw new ApiError(401, 'Refresh token has been revoked');
  }

  if (tokenRecord.expiresAt < new Date()) {
    throw new ApiError(401, 'Refresh token has expired');
  }

  if (!tokenRecord.user.isActive) {
    throw new ApiError(401, 'Authenticated user is not active');
  }

  const newRawRefreshToken = generateRawRefreshToken();
  const newTokenHash = hashToken(newRawRefreshToken);
  const newExpiresAt = new Date(Date.now() + getRefreshTokenDurationMs());

  // Atomic rotation inside database transaction
  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
        replacedByToken: newTokenHash,
      },
    }),
    prisma.refreshToken.create({
      data: {
        userId: tokenRecord.userId,
        tokenHash: newTokenHash,
        family: tokenRecord.family,
        expiresAt: newExpiresAt,
      },
    }),
  ]);

  const accessToken = generateAccessToken(tokenRecord.user.id, tokenRecord.user.role);

  return {
    accessToken,
    refreshToken: newRawRefreshToken,
    user: tokenRecord.user,
  };
}

/**
 * Revokes an individual refresh token by its raw value.
 */
export async function revokeRefreshToken(rawRefreshToken: string): Promise<boolean> {
  const prisma = getPrismaClient();
  const tokenHash = hashToken(rawRefreshToken);

  const result = await prisma.refreshToken.updateMany({
    where: { tokenHash, isRevoked: false },
    data: { isRevoked: true, revokedAt: new Date() },
  });

  return result.count > 0;
}

/**
 * Revokes all active refresh token sessions for a user (e.g. password reset or global logout).
 */
export async function revokeAllUserTokens(userId: string): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.refreshToken.updateMany({
    where: { userId, isRevoked: false },
    data: { isRevoked: true, revokedAt: new Date() },
  });
}
