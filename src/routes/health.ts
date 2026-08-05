import { Router } from 'express';
import { db } from '../db/client';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    // Ping the database
    await db.selectFrom('users').select('id').limit(1).execute();
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'degraded', db: 'unreachable', timestamp: new Date().toISOString() });
  }
});

export default router;
