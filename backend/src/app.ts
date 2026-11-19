import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { errorMiddleware } from './middleware/errorMiddleware.js';
import { notFoundMiddleware } from './middleware/notFoundMiddleware.js';
import apiRouter from './routes/apiRoutes.js';
import { ApiError } from './utils/ApiError.js';

const app = express();
const allowedOrigins = (process.env.CLIENT_URL ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Proxy configuration: trust reverse proxy (e.g. ALB, Cloudflare, Nginx) only when explicitly configured or in production
if (process.env.TRUST_PROXY) {
  const tp = process.env.TRUST_PROXY;
  app.set('trust proxy', isNaN(Number(tp)) ? tp === 'true' : Number(tp));
} else if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.disable('x-powered-by');
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      // Native React Native requests normally omit the Origin header.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new ApiError(403, 'Origin is not allowed'));
    },
  }),
);
app.use(
  express.json({
    limit: '100kb',
    verify: (req, _res, buf) => {
      (req as unknown as { rawBody?: Buffer }).rawBody = buf;
    },
  }),
);
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use('/api', apiRouter);
app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
