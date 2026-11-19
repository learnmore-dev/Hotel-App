import 'dotenv/config';

import app from './app.js';
import { connectDB, disconnectDB } from './config/db.js';

const DEFAULT_PORT = 5000;

async function startServer(): Promise<void> {
  const portValue = process.env.PORT?.trim();
  const port = portValue ? Number(portValue) : DEFAULT_PORT;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('[server] PORT must be a valid TCP port');
    process.exitCode = 1;
    return;
  }

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error('[server] JWT_SECRET must be configured with at least 32 characters');
    process.exitCode = 1;
    return;
  }

  try {
    await connectDB();
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown PostgreSQL connection error';
    console.error(`[server] Startup aborted; Express was not started. ${reason}`);
    process.exitCode = 1;
    return;
  }

  const server = app.listen(port, '0.0.0.0', () => {
    console.info(`[server] TrumiTrip API listening on port ${port}`);
  });

  const shutdown = (signal: NodeJS.Signals) => {
    console.info(`[server] ${signal} received; closing database connection`);
    server.close(() => {
      void disconnectDB()
        .then(() => {
          process.exitCode = 0;
        })
        .catch(() => {
          process.exitCode = 1;
        });
    });
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

void startServer();
