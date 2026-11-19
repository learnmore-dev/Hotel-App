import { Router } from 'express';

import { checkDB } from '../config/db.js';

const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  const connected = await checkDB();
  if (!connected) {
    res.status(503).json({
      success: false,
      message: 'TrumiTrip API is unavailable',
      errors: [],
      database: 'disconnected',
    });
    return;
  }

  res.status(200).json({
    success: true,
    message: 'TrumiTrip API is running',
    database: 'connected',
  });
});

export default healthRouter;
