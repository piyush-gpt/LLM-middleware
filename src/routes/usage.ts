import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { badRequest } from '../errors';
import { findActiveKeyByRaw } from '../services/keys';
import { getSpendByKeyId } from '../services/usage';
import { formatUsd } from '../domain/pricing';

export const usageRouter = Router();

const QuerySchema = z.object({
  key: z.string().min(1, 'key query param is required'),
});


usageRouter.get(
  '/usage',
  asyncHandler(async (req, res) => {
    const parsed = QuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw badRequest('Invalid query', parsed.error.flatten());
    }

    const key = await findActiveKeyByRaw(parsed.data.key);
    if (!key) {
      throw badRequest('Unknown or inactive key');
    }

    const summary = await getSpendByKeyId(key.id);
    if (!summary) {
      throw badRequest('Unknown key');
    }

    res.json({
      key_id: summary.keyId,
      name: summary.name,
      budget: {
        requests_used: summary.requestsUsed,
        request_limit: summary.requestLimit,
        requests_remaining: Math.max(
          summary.requestLimit - summary.requestsUsed,
          0,
        ),
      },
      usage: {
        total_requests: summary.totalRequests,
        total_tokens_in: summary.totalTokensIn,
        total_tokens_out: summary.totalTokensOut,
        total_cost_micros_usd: summary.totalCostMicros,
        total_cost_usd: formatUsd(summary.totalCostMicros),
      },
    });
  }),
);
