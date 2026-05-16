import { Hono } from 'hono';
import { z } from 'zod';
import { handleMessage } from '../services/message-router.js';
import type { WhatsAppAdapter } from '../adapters/whatsapp.adapter.js';
import { logger } from '../middleware/logger.js';

const incomingMessageSchema = z.object({
  phone: z.string().min(1),
  text: z.string().min(1),
});

export function createWebhookRoutes(adapter: WhatsAppAdapter) {
  const webhook = new Hono();

  webhook.post('/', async (c) => {
    const body = await c.req.json();
    const parsed = incomingMessageSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        400,
      );
    }

    const { phone, text } = parsed.data;
    const start = Date.now();

    try {
      const response = await handleMessage({ phone, text });

      await adapter.sendMessage({ phone, text: response });

      logger.info({
        msg: 'webhook_processed',
        phone,
        action: 'message_handled',
        latency_ms: Date.now() - start,
      });

      return c.json({ ok: true, phone, response });
    } catch (error) {
      logger.error({
        msg: 'webhook_error',
        phone,
        error: (error as Error).message,
        latency_ms: Date.now() - start,
      });

      return c.json({ error: 'Internal error processing message' }, 500);
    }
  });

  return webhook;
}
