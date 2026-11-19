import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

import { getPrismaClient } from '../config/prisma.js';
import {
  createRefreshTokenSession,
  revokeRefreshToken,
  rotateRefreshToken,
  safeUserSelect,
} from '../services/token.service.js';
import type { ApiSuccess } from '../types/api.js';
import { ApiError } from '../utils/ApiError.js';
import { generateAccessToken } from '../utils/jwt.js';
import { normalizeEmail } from '../utils/normalization.js';
import { comparePassword, hashPassword } from '../utils/password.js';

type RegisterBody = {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
  confirmPassword: string;
  role?: unknown;
};

type LoginBody = { email: string; password: string };

type RefreshBody = { refreshToken: string };

type LogoutBody = { refreshToken?: string };

export async function register(req: Request<object, unknown, RegisterBody>, res: Response): Promise<void> {
  if (req.body != null && Object.hasOwn(req.body, 'role')) {
    throw new ApiError(400, 'Role cannot be provided during public registration');
  }

  const email = normalizeEmail(req.body.email);
  const phone = req.body.phone?.trim() || null;
  const prisma = getPrismaClient();
  const emailTaken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (emailTaken) {
    throw new ApiError(409, 'An account with this email already exists');
  }

  try {
    const user = await prisma.user.create({
      data: {
        fullName: req.body.fullName.trim(),
        email,
        phone,
        passwordHash: await hashPassword(req.body.password),
        role: 'CUSTOMER',
      },
      select: safeUserSelect,
    });

    const accessToken = generateAccessToken(user.id, user.role);
    const { rawRefreshToken } = await createRefreshTokenSession(user.id);

    const response: ApiSuccess<{ user: typeof user; accessToken: string; refreshToken: string }> = {
      success: true,
      message: 'Account created successfully',
      data: { user, accessToken, refreshToken: rawRefreshToken },
    };
    res.status(201).json(response);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ApiError(409, 'An account with this email or phone already exists');
    }
    throw error;
  }
}

export async function login(req: Request<object, unknown, LoginBody>, res: Response): Promise<void> {
  const email = normalizeEmail(req.body.email);
  const user = await getPrismaClient().user.findUnique({ where: { email } });

  if (!user || !(await comparePassword(req.body.password, user.passwordHash))) {
    throw new ApiError(401, 'Invalid email or password');
  }
  if (!user.isActive) {
    throw new ApiError(403, 'This account is inactive');
  }

  const { passwordHash: _passwordHash, ...safeUser } = user;
  void _passwordHash;

  const accessToken = generateAccessToken(user.id, user.role);
  const { rawRefreshToken } = await createRefreshTokenSession(user.id);

  const response: ApiSuccess<{ user: typeof safeUser; accessToken: string; refreshToken: string }> = {
    success: true,
    message: 'Login successful',
    data: { user: safeUser, accessToken, refreshToken: rawRefreshToken },
  };
  res.status(200).json(response);
}

export async function refresh(req: Request<object, unknown, RefreshBody>, res: Response): Promise<void> {
  const result = await rotateRefreshToken(req.body.refreshToken);
  const response: ApiSuccess<typeof result> = {
    success: true,
    message: 'Token refreshed successfully',
    data: result,
  };
  res.status(200).json(response);
}

export async function getMe(req: Request, res: Response): Promise<void> {
  if (!req.auth) throw new ApiError(401, 'Authentication required');

  const user = await getPrismaClient().user.findUnique({
    where: { id: req.auth.userId },
    select: safeUserSelect,
  });
  if (!user || !user.isActive) {
    throw new ApiError(401, 'Authenticated user is not active');
  }

  const response: ApiSuccess<typeof user> = { success: true, message: 'Current user', data: user };
  res.status(200).json(response);
}

export async function logout(req: Request<object, unknown, LogoutBody>, res: Response): Promise<void> {
  if (req.body?.refreshToken) {
    await revokeRefreshToken(req.body.refreshToken);
  }

  const response: ApiSuccess<Record<string, never>> = {
    success: true,
    message: 'Logged out successfully',
    data: {},
  };
  res.status(200).json(response);
}
