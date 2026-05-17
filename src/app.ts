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
  const app = new Hono();
  const api = new Hono();
  const wa = adapter || simulatorAdapter;

  // Global middleware
  api.use('*', cors());
  api.use('*', requestIdMiddleware);
  api.use('*', loggerMiddleware);
  api.use('*', createRateLimiter(
    parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    parseInt(process.env.RATE_LIMIT_MAX || '60', 10),
  ));

  app.get('/', (c) => {
    return c.html(`<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>NutriBot Tester</title>
    <style>
      body { font-family: Segoe UI, Arial, sans-serif; margin: 0; background: #0f172a; color: #e2e8f0; }
      .wrap { max-width: 780px; margin: 24px auto; background: #111827; border: 1px solid #1f2937; border-radius: 12px; overflow: hidden; }
      .head { padding: 12px 14px; border-bottom: 1px solid #1f2937; font-weight: 600; }
      .meta { padding: 10px 14px; border-bottom: 1px solid #1f2937; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .chat { height: 420px; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
      .msg { max-width: 86%; padding: 10px 12px; border-radius: 10px; white-space: pre-wrap; line-height: 1.35; }
      .u { align-self: flex-end; background: #1f2937; }
      .b { align-self: flex-start; background: #064e3b; }
      .send { padding: 12px 14px; border-top: 1px solid #1f2937; display: grid; grid-template-columns: 1fr auto; gap: 8px; }
      input { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #1f2937; background: #0b1220; color: #e2e8f0; }
      button { border: 0; border-radius: 8px; padding: 10px 14px; background: #10b981; color: white; font-weight: 600; cursor: pointer; }
    </style>
  </head>
  <body>
    <main class="wrap">
      <div class="head">NutriBot · Tester web</div>
      <div class="meta">
        <input id="phone" value="+573001234567" placeholder="Teléfono" />
        <input id="base" value="/api" placeholder="Base API" />
      </div>
      <section id="chat" class="chat">
        <div class="msg b">Hola 👋 escribe: "estoy buscando proteína para subir masa"</div>
      </section>
      <div class="send">
        <input id="text" placeholder="Escribe tu mensaje..." />
        <button id="btn">Enviar</button>
      </div>
    </main>
    <script>
      const chat = document.getElementById('chat');
      const phone = document.getElementById('phone');
      const base = document.getElementById('base');
      const text = document.getElementById('text');
      const btn = document.getElementById('btn');
      function add(role, msg) {
        const el = document.createElement('div');
        el.className = 'msg ' + role;
        el.textContent = msg;
        chat.appendChild(el);
        chat.scrollTop = chat.scrollHeight;
      }
      async function send() {
        const t = text.value.trim();
        if (!t) return;
        add('u', t);
        text.value = '';
        btn.disabled = true;
        try {
          const res = await fetch(base.value + '/webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: phone.value, text: t })
          });
          const data = await res.json();
          add('b', data.response || data.error || 'Sin respuesta');
        } catch {
          add('b', 'No se pudo conectar con el backend');
        } finally {
          btn.disabled = false;
          text.focus();
        }
      }
      btn.addEventListener('click', send);
      text.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
    </script>
  </body>
</html>`);
  });

  // Health check
  api.get('/health', (c) => {
    return c.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
    });
  });

  // Readiness check (config only)
  api.get('/ready', (c) => {
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
  api.route('/webhook', createWebhookRoutes(wa));

  // Simulator (dev only)
  api.route('/simulator', createSimulatorRoutes());

  app.route('/api', api);

  // Global error handler
  api.onError((err, c) => {
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
  api.notFound((c) => {
    return c.json({ error: 'Not found' }, 404);
  });

  return app;
}

const app = createApp();
export default app;
