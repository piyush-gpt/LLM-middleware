import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';
import { badRequest, tooManyRequests } from '../errors';
import { claimRequestSlot, refundClaim } from '../services/budget';
import { insertUsage } from '../services/usage';
import { estimateCostMicros } from '../domain/pricing';
import { runChat } from '../providers';
import { logger } from '../logger';

const ChatRequestSchema = z.object({
  model: z.string().min(1),
  messages: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant', 'tool']),
        content: z.string(),
      }),
    )
    .min(1, 'messages must contain at least one entry'),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional(),
});

export const chatRouter = Router();
chatRouter.post(
  '/v1/chat/completions',
  authenticate,
  asyncHandler(async (req, res) => {
    const apiKey = req.apiKey!;

    const parsed = ChatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Invalid request body', parsed.error.flatten());
    }
    const chatReq = parsed.data;

    // 1) Enforce budget BEFORE spending money upstream (atomic reservation).
    const claim = await claimRequestSlot(apiKey.id);
    if (!claim.ok) {
      throw tooManyRequests(
        `Budget exhausted: used ${claim.requestsUsed}/${claim.requestLimit} requests`,
      );
    }

    try {
      const outcome = await runChat(chatReq);

      const costMicros = estimateCostMicros({
        model: outcome.model,
        tokensIn: outcome.usage.tokensIn,
        tokensOut: outcome.usage.tokensOut,
      });

      await insertUsage({
        keyId: apiKey.id,
        model: outcome.model,
        provider: outcome.provider,
        tokensIn: outcome.usage.tokensIn,
        tokensOut: outcome.usage.tokensOut,
        costMicros,
        status: 'ok',
      });

      // 4) Respond in an OpenAI-compatible shape, plus a small gateway block.
      res.json({
        id: `chatcmpl-gw-${Date.now()}`,
        object: 'chat.completion',
        model: outcome.model,
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: outcome.content },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: outcome.usage.tokensIn,
          completion_tokens: outcome.usage.tokensOut,
          total_tokens: outcome.usage.tokensIn + outcome.usage.tokensOut,
        },
        gateway: {
          provider: outcome.provider,
          attempts: outcome.attempts,
          estimated_cost_micros_usd: costMicros,
          budget: {
            requests_used: claim.requestsUsed,
            request_limit: claim.requestLimit,
          },
        },
      });
    } catch (err) {
      // Provider failedafter the slot was claimed:
      // refund it
      await refundClaim(apiKey.id).catch((refundErr) =>
        logger.error({ refundErr }, 'Failed to refund budget slot'),
      );
      throw err;
    }
  }),
);
