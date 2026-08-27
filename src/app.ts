import express, { type Express } from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { logger } from './logger';
import { chatRouter } from './routes/chat';
import { usageRouter } from './routes/usage';
import { adminRouter } from './routes/admin';
import { healthRouter } from './routes/health';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

export function createApp(): Express {
  const app = express();

  app.use(helmet());

  app.use(pinoHttp({ logger }));

  app.use(express.json({ limit: '1mb' }));

  app.use(healthRouter);
  app.use(adminRouter);
  app.use(usageRouter);
  app.use(chatRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
