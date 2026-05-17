import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requestIdMiddleware } from './middleware/request-id.js';
import { loggerMiddleware } from './middleware/logger.js';
import { createRateLimiter } from './middleware/rate-limit.js';
import { createWebhookRoutes } from './transport/webhook.js';
import { createSimulatorRoutes } from './transport/simulator.js';
import { simulatorAdapter } from './adapters/simulator.adapter.js';
import { AppError } from './utils/errors.js';
import { getEnv } from './config/env.js';
import type { WhatsAppAdapter } from './adapters/whatsapp.adapter.js';

export function createApp(adapter?: WhatsAppAdapter) {
  const app = new Hono().basePath('/api');
  const wa = adapter || simulatorAdapter;

  // Global middleware
  app.use('*', cors());
  app.use('*', requestIdMiddleware);
  app.use('*', loggerMiddleware);
  app.use('*', createRateLimiter(
    parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    parseInt(process.env.RATE_LIMIT_MAX || '60', 10),
  ));

  // Health check
  app.get('/health', (c) => {
    return c.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
    });
  });

  // Readiness check (config only)
  app.get('/ready', (c) => {
    const env = getEnv();

    const requiredChecks = {
      NUTURYX_API_BASE_URL: Boolean(env.NUTURYX_API_BASE_URL),
      NUTURYX_BOT_API_TOKEN: Boolean(env.NUTURYX_BOT_API_TOKEN),
    };

    const optionalChecks = {
      SUPABASE_CONFIGURED: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY),
      OPENROUTER_CONFIGURED: Boolean(env.OPENROUTER_API_KEY),
      SUPPORT_PHONE_CONFIGURED: Boolean(env.BOT_SUPPORT_PHONE),
    };

    const missingRequired = Object.entries(requiredChecks)
      .filter(([, ok]) => !ok)
      .map(([key]) => key);

    const ready = missingRequired.length === 0;

    return c.json(
      {
        status: ready ? 'ready' : 'not_ready',
        ready,
        requiredChecks,
        optionalChecks,
        missingRequired,
      },
      ready ? 200 : 503,
    );
  });

  // Webhook (receives messages)
  app.route('/webhook', createWebhookRoutes(wa));

  // Simulator (dev only)
  app.route('/simulator', createSimulatorRoutes());

  // Global error handler
  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json(
        { error: err.message, code: err.code, details: err.details },
        err.statusCode as 400,
      );
    }

    console.error('Unhandled error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  });

  // 404
  app.notFound((c) => {
    return c.json({ error: 'Not found' }, 404);
  });

  return app;
}

const app = createApp();
export default app;
