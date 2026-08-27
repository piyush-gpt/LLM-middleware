import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { pool } from '../db/pool';

export const healthRouter = Router();

healthRouter.get(
  '/health',
  asyncHandler(async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', time: new Date().toISOString() });
  }),
);
