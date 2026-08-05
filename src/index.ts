import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { ElfaApiError } from '@elfa-ai/sdk';

import healthRouter from './routes/health';
import marketRouter from './routes/market';
import authRouter from './routes/auth';

// Validate required env vars at startup
const REQUIRED_ENV = [
  'DATABASE_URL',
  'JWT_SECRET',
  'ELFA_API_KEY',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
];

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? '*',
    credentials: true,
  })
);
app.use(express.json());

// Routes
app.use('/api/health', healthRouter);
app.use('/api/market', marketRouter);
app.use('/api/auth', authRouter);

// Global error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err);

    // Forward Elfa API errors with their actual status code + message
    if (err instanceof ElfaApiError) {
      res.status(err.statusCode ?? 500).json({
        error: err.message,
        code: err.code,
      });
      return;
    }

    // Zod validation errors
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid request', details: (err as any).errors });
      return;
    }

    res.status(500).json({ error: 'Internal server error' });
  }
);

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
