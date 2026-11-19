import 'dotenv/config';

import assert from 'node:assert/strict';
import http from 'node:http';
import { describe, it } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';

import { getPrismaClient } from '../src/config/prisma.js';
import { errorMiddleware } from '../src/middleware/errorMiddleware.js';
import authRouter from '../src/routes/auth.routes.js';
import * as tokenService from '../src/services/token.service.js';
import { generateAccessToken, hashToken, verifyAccessToken } from '../src/utils/jwt.js';

describe('Persistent Login & Refresh Token Rotation Tests', () => {
  const prisma = getPrismaClient();

  describe('1. JWT Access Token Expiration & Validation', () => {
    it('generates an access token with short-lived expiration that is valid immediately', () => {
      const token = generateAccessToken('user-123', 'CUSTOMER', '15m');
      const verified = verifyAccessToken(token);
      assert.equal(verified.userId, 'user-123');
      assert.equal(verified.role, 'CUSTOMER');

      // Verify expiration claim exists and is ~15 minutes in the future
      const decoded = jwt.decode(token) as jwt.JwtPayload;
      assert.ok(decoded.exp, 'Access token must have an exp claim');
      assert.ok(decoded.iat, 'Access token must have an iat claim');
      assert.ok(decoded.exp > decoded.iat, 'exp must be greater than iat');
      const lifespanSeconds = decoded.exp - decoded.iat;
      assert.equal(lifespanSeconds, 15 * 60, 'Default lifespan must be 15 minutes');
    });

    it('rejects an expired access token with TokenExpiredError', async () => {
      // Create a token that expired 5 seconds ago
      const token = generateAccessToken('user-123', 'CUSTOMER', '-5s');
      assert.throws(
        () => verifyAccessToken(token),
        (err) => err instanceof jwt.TokenExpiredError
      );
    });
  });

  describe('2. Refresh Token Generation, Hashing & Storage Security', () => {
    it('creates a refresh token session and stores only the SHA-256 hash in database', async () => {
      const customer = await prisma.user.findUnique({
        where: { email: 'customer@trumitrip.dev' },
      });
      assert.ok(customer, 'Seed customer must exist');

      const { rawRefreshToken, expiresAt, family } = await tokenService.createRefreshTokenSession(customer.id);
      assert.ok(rawRefreshToken, 'Raw refresh token must be returned');
      assert.equal(typeof rawRefreshToken, 'string');
      assert.equal(rawRefreshToken.length, 64, 'Raw token must be a 64-character hex string');
      assert.ok(family, 'Token family UUID must exist');
      assert.ok(expiresAt > new Date(), 'Expiration must be in the future');

      const expectedHash = hashToken(rawRefreshToken);
      const recordInDb = await prisma.refreshToken.findUnique({
        where: { tokenHash: expectedHash },
      });
      assert.ok(recordInDb, 'Record must exist in DB by tokenHash');
      assert.equal(recordInDb.userId, customer.id);
      assert.equal(recordInDb.isRevoked, false);
      assert.equal(recordInDb.family, family);

      // Verify raw plaintext token is NOT stored anywhere in the database
      const rawInDb = await prisma.refreshToken.findFirst({
        where: { tokenHash: rawRefreshToken },
      });
      assert.equal(rawInDb, null, 'Raw plaintext token must NEVER be stored in the database');
    });
  });

  describe('3. End-to-End Auth API Refresh, Rotation & Reuse Detection', () => {
    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);
    app.use(errorMiddleware);

    let server: http.Server;
    let baseUrl: string;

    it('starts ephemeral test HTTP server', async () => {
      server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const addr = server.address() as { port: number };
      baseUrl = `http://127.0.0.1:${addr.port}`;
    });

    it('login returns both accessToken and refreshToken', async () => {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'customer@trumitrip.dev',
          password: 'CustomerPass123!',
        }),
      });

      assert.equal(response.status, 200);
      const body = await response.json() as any;
      assert.equal(body.success, true);
      assert.ok(body.data.accessToken, 'Must return accessToken');
      assert.ok(body.data.refreshToken, 'Must return refreshToken');
      assert.equal(body.data.user.email, 'customer@trumitrip.dev');

      const verified = verifyAccessToken(body.data.accessToken);
      assert.equal(verified.userId, body.data.user.id);
    });

    it('rotates refresh token: issues new access and refresh token and revokes the old refresh token', async () => {
      const customer = await prisma.user.findUnique({
        where: { email: 'customer@trumitrip.dev' },
      });
      assert.ok(customer);

      const session1 = await tokenService.createRefreshTokenSession(customer.id);

      const response = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: session1.rawRefreshToken }),
      });

      assert.equal(response.status, 200);
      const body = await response.json() as any;
      assert.equal(body.success, true);
      assert.ok(body.data.accessToken);
      assert.ok(body.data.refreshToken);
      assert.notEqual(body.data.refreshToken, session1.rawRefreshToken, 'New token must differ from old token');

      // Check DB: old token is marked revoked and points to new replacement token
      const oldHash = hashToken(session1.rawRefreshToken);
      const oldRecord = await prisma.refreshToken.findUnique({ where: { tokenHash: oldHash } });
      assert.ok(oldRecord);
      assert.equal(oldRecord.isRevoked, true, 'Old token must be marked isRevoked: true');
      assert.ok(oldRecord.revokedAt, 'Old token must have revokedAt timestamp');
      assert.equal(oldRecord.replacedByToken, hashToken(body.data.refreshToken));

      // Check DB: new token is active in the same family
      const newHash = hashToken(body.data.refreshToken);
      const newRecord = await prisma.refreshToken.findUnique({ where: { tokenHash: newHash } });
      assert.ok(newRecord);
      assert.equal(newRecord.isRevoked, false);
      assert.equal(newRecord.family, oldRecord.family, 'New token must belong to the same lineage family');
    });

    it('reuse detection: attempting to reuse an already-rotated token revokes the entire family lineage', async () => {
      const customer = await prisma.user.findUnique({
        where: { email: 'customer@trumitrip.dev' },
      });
      assert.ok(customer);

      // Step 1: Create token A
      const tokenA = await tokenService.createRefreshTokenSession(customer.id);

      // Step 2: Rotate token A -> produces token B
      const rotateRes = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokenA.rawRefreshToken }),
      });
      assert.equal(rotateRes.status, 200);
      const rotateBody = await rotateRes.json() as any;
      const tokenB = rotateBody.data.refreshToken;

      // Step 3: Attacker or replay attempts to reuse token A!
      const reuseRes = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokenA.rawRefreshToken }),
      });
      assert.equal(reuseRes.status, 401);
      const reuseBody = await reuseRes.json() as any;
      assert.equal(reuseBody.message, 'Refresh token has been revoked');

      // Step 4: Because reuse was detected, Token B in the same family MUST ALSO BE REVOKED!
      const attemptBRes = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokenB }),
      });
      assert.equal(attemptBRes.status, 401, 'Token B must be revoked due to family reuse detection');
    });

    it('rejects an expired refresh token with HTTP 401', async () => {
      const customer = await prisma.user.findUnique({
        where: { email: 'customer@trumitrip.dev' },
      });
      assert.ok(customer);

      const session = await tokenService.createRefreshTokenSession(customer.id);
      // Manually set expiration in the past
      await prisma.refreshToken.update({
        where: { tokenHash: hashToken(session.rawRefreshToken) },
        data: { expiresAt: new Date(Date.now() - 10000) },
      });

      const response = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: session.rawRefreshToken }),
      });

      assert.equal(response.status, 401);
      const body = await response.json() as any;
      assert.equal(body.message, 'Refresh token has expired');
    });

    it('logout revokes the refresh token and subsequent refresh fails', async () => {
      const customer = await prisma.user.findUnique({
        where: { email: 'customer@trumitrip.dev' },
      });
      assert.ok(customer);

      const session = await tokenService.createRefreshTokenSession(customer.id);

      // Perform logout
      const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: session.rawRefreshToken }),
      });
      assert.equal(logoutRes.status, 200);

      // Attempt to refresh with logged-out token
      const refreshRes = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: session.rawRefreshToken }),
      });
      assert.equal(refreshRes.status, 401);
    });

    it('rejects refresh when user account is deactivated', async () => {
      // Create a temporary test user and deactivate
      const testEmail = `inactive-${Date.now()}@trumitrip.dev`;
      const tempUser = await prisma.user.create({
        data: {
          fullName: 'Inactive User',
          email: testEmail,
          passwordHash: 'dummy',
          role: 'CUSTOMER',
          isActive: false, // Inactive
        },
      });

      try {
        const session = await tokenService.createRefreshTokenSession(tempUser.id);
        const response = await fetch(`${baseUrl}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: session.rawRefreshToken }),
        });
        assert.equal(response.status, 401);
      } finally {
        await prisma.user.delete({ where: { id: tempUser.id } }).catch(() => undefined);
      }
    });

    it('stops test HTTP server', async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    });
  });
});
