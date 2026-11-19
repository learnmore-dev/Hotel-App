# TrumiTrip API foundation

This directory contains the Node.js, Express, PostgreSQL, and Prisma backend, kept separate from the Expo mobile app at the workspace root. Feature endpoints are intentionally deferred; only `GET /api/health` is implemented in this phase.

## Setup

1. Use Node.js 24 or another supported current Node.js LTS release.
2. Install packages with `npm install`.
3. Copy `.env.example` to `.env` and replace the placeholder in `DATABASE_URL` with a real PostgreSQL connection URI. Configure a private random `JWT_SECRET` of at least 32 characters, `JWT_EXPIRES_IN` (default `7d`), and any browser client origins in `CLIENT_URL` (comma-separated).
4. Start a local PostgreSQL service or provide a reachable PostgreSQL connection URI.
5. Run `npm run dev`.

The API listens on `PORT` (default `5000`) only after PostgreSQL connects. Native React Native requests may omit the browser `Origin` header; browser origins must match `CLIENT_URL` exactly.

Set the mobile app's `EXPO_PUBLIC_API_URL` to the API host reachable from the device, ending in `/api`. For a physical device, use the development machine's LAN address rather than `localhost`; do not commit a machine-specific address.

## Commands

- `npm run dev` generates Prisma Client and starts the TypeScript development server.
- `npm run build` generates Prisma Client and compiles `src/` to `dist/`.
- `npm start` runs the compiled server.
- `npm run lint` lints backend TypeScript.
- `npm run prisma:migrate` creates/applies the initial development migration.
- `npm run prisma:studio` opens Prisma Studio.

Health check: `GET /api/health`. Authentication is available at `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, and `POST /api/auth/logout`. Hotel, room, booking, coupon, review, partner, and admin routers remain without business endpoints.
