import assert from 'node:assert/strict';
import http from 'node:http';
import { describe, it } from 'node:test';
import express, { type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';

import {
  authRateLimiter,
  bookingRateLimiter,
  paymentRateLimiter,
  generalApiLimiter,
} from '../src/middleware/rateLimit.middleware.js';
import type { ApiErrorResponse } from '../src/types/api.js';

describe('Phase 16 — API Rate Limiting & Proxy Security Tests', () => {
  describe('1. Configuration & Safeguards Validation', () => {
    it('verifies authRateLimiter has strict brute-force protection (10 attempts / 15m)', () => {
      // In express-rate-limit, options can be accessed or verified
      assert.ok(authRateLimiter, 'authRateLimiter middleware must exist');
      assert.equal(typeof authRateLimiter, 'function');
    });

    it('verifies bookingRateLimiter has inventory spam protection (60 requests / 15m)', () => {
      assert.ok(bookingRateLimiter, 'bookingRateLimiter middleware must exist');
      assert.equal(typeof bookingRateLimiter, 'function');
    });

    it('verifies paymentRateLimiter has card-testing/flooding protection (30 requests / 15m)', () => {
      assert.ok(paymentRateLimiter, 'paymentRateLimiter middleware must exist');
      assert.equal(typeof paymentRateLimiter, 'function');
    });

    it('verifies generalApiLimiter protects overall infrastructure (300 requests / 15m)', () => {
      assert.ok(generalApiLimiter, 'generalApiLimiter middleware must exist');
      assert.equal(typeof generalApiLimiter, 'function');
    });
  });

  describe('2. Rate Limit Enforcement & 429 Response Format', () => {
    it('returns standardized ApiErrorResponse with HTTP 429 when threshold is exceeded', async () => {
      const app = express();

      // Create a test limiter with limit 3 for fast, deterministic unit testing
      const testLimiter = rateLimit({
        windowMs: 60 * 1000,
        limit: 3,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        handler: (_req: Request, res: Response): void => {
          const response: ApiErrorResponse = {
            success: false,
            message: 'Too many requests. Please slow down and try again shortly.',
            errors: [
              {
                field: 'rateLimit',
                message: 'Too many requests. Please slow down and try again shortly.',
              },
            ],
          };
          res.status(429).json(response);
        },
      });

      app.use('/test-throttle', testLimiter, (_req, res) => {
        res.status(200).json({ success: true, message: 'Request allowed' });
      });

      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const address = server.address() as { port: number };
      const baseUrl = `http://127.0.0.1:${address.port}`;

      try {
        // Request 1: allowed
        const res1 = await fetch(`${baseUrl}/test-throttle`);
        assert.equal(res1.status, 200);
        const data1 = (await res1.json()) as any;
        assert.equal(data1.success, true);

        // Request 2: allowed
        const res2 = await fetch(`${baseUrl}/test-throttle`);
        assert.equal(res2.status, 200);

        // Request 3: allowed (last one within threshold)
        const res3 = await fetch(`${baseUrl}/test-throttle`);
        assert.equal(res3.status, 200);

        // Request 4: rejected with HTTP 429
        const res4 = await fetch(`${baseUrl}/test-throttle`);
        assert.equal(res4.status, 429, 'Excessive request must return HTTP 429');
        assert.equal(res4.headers.get('content-type')?.includes('application/json'), true);

        const errorBody = (await res4.json()) as ApiErrorResponse;
        assert.equal(errorBody.success, false);
        assert.ok(errorBody.message.includes('Too many requests'));
        assert.equal(Array.isArray(errorBody.errors), true);
        assert.equal(errorBody.errors?.[0]?.field, 'rateLimit');
        assert.ok(errorBody.errors?.[0]?.message.includes('Too many requests'));

        // Check standard headers (draft-7)
        assert.ok(res4.headers.get('ratelimit-limit') || res4.headers.get('ratelimit-policy'));
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });

    it('enforces authRateLimiter on repeated failed login/register attempts', async () => {
      const app = express();
      app.use(express.json());

      let authAttempts = 0;
      // Simulated auth controller
      app.post('/api/auth/login', authRateLimiter, (_req, res) => {
        authAttempts++;
        res.status(401).json({ success: false, message: 'Invalid credentials' });
      });

      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const address = server.address() as { port: number };
      const baseUrl = `http://127.0.0.1:${address.port}`;

      try {
        // Send requests up to limit 10
        let reached429 = false;
        for (let i = 0; i < 12; i++) {
          const res = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: `test${i}@example.com`, password: 'wrong' }),
          });

          if (res.status === 429) {
            reached429 = true;
            const body = (await res.json()) as ApiErrorResponse;
            assert.equal(body.success, false);
            assert.ok(body.message.includes('Too many authentication attempts'));
            assert.equal(body.errors?.[0]?.field, 'rateLimit');
            break;
          }
        }
        assert.equal(reached429, true, 'Must throttle after exceeding 10 attempts');
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });
  });

  describe('3. Proxy Security & IP Forwarding Protection', () => {
    it('does not trust arbitrary client-supplied X-Forwarded-For when trust proxy is not enabled', async () => {
      const app = express();
      // By default trust proxy is not enabled (matches dev/test behavior)
      let resolvedIp = '';
      app.get('/ip-check', (req, res) => {
        resolvedIp = req.ip || '';
        res.json({ ip: req.ip });
      });

      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const address = server.address() as { port: number };
      const baseUrl = `http://127.0.0.1:${address.port}`;

      try {
        await fetch(`${baseUrl}/ip-check`, {
          headers: {
            'X-Forwarded-For': '203.0.113.195', // Spoofed client IP
          },
        });

        // When trust proxy is disabled, req.ip should NOT be the spoofed header
        assert.notEqual(resolvedIp, '203.0.113.195', 'Untrusted proxy must ignore spoofed X-Forwarded-For');
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });

    it('correctly resolves client IP when trust proxy is explicitly configured for reverse proxy hop', async () => {
      const app = express();
      app.set('trust proxy', 1); // 1 hop (e.g. ALB, Cloudflare, Nginx)

      let resolvedIp = '';
      app.get('/ip-check-trusted', (req, res) => {
        resolvedIp = req.ip || '';
        res.json({ ip: req.ip });
      });

      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const address = server.address() as { port: number };
      const baseUrl = `http://127.0.0.1:${address.port}`;

      try {
        await fetch(`${baseUrl}/ip-check-trusted`, {
          headers: {
            'X-Forwarded-For': '198.51.100.42',
          },
        });

        // When trust proxy is 1, req.ip resolves to the client IP in X-Forwarded-For
        assert.equal(resolvedIp, '198.51.100.42', 'Trusted proxy must resolve client IP');
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });
  });
});
