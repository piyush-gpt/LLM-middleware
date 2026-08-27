import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { unauthorized, forbidden, badRequest } from '../errors';
import { config } from '../config';
import { createKey } from '../services/keys';

export const adminRouter = Router();

const CreateKeySchema = z.object({
  name: z.string().max(120).optional(),
  request_limit: z.number().int().positive(),
});

adminRouter.post(
  '/admin/keys',
  asyncHandler(async (req, res) => {
    const adminToken = req.header('x-admin-token');
    if (!adminToken) {
      throw unauthorized('Provide x-admin-token');
    }
    if (adminToken !== config.ADMIN_TOKEN) {
      throw forbidden('Invalid admin token');
    }

    const parsed = CreateKeySchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Invalid request body', parsed.error.flatten());
    }

    const created = await createKey(
      parsed.data.name ?? null,
      parsed.data.request_limit,
    );

    res.status(201).json({
      id: created.id,
      name: created.name,
      request_limit: created.requestLimit,
      // Shown once. Store it now; it cannot be retrieved later.
      api_key: created.rawKey,
    });
  }),
);
