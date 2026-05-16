import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { createApp } from './app.js';

const api = createApp();
const root = new Hono();

// Serve API
root.route('/', api);

// Serve frontend
root.use('/*', serveStatic({ root: './public' }));

const port = parseInt(process.env.PORT || '3005', 10);

serve({ fetch: root.fetch, port }, (info) => {
  console.log(`🚀 NutriBot running at http://localhost:${info.port}`);
  console.log(`   💬 Chat UI: http://localhost:${info.port}`);
  console.log(`   Health: http://localhost:${info.port}/api/health`);
  console.log(`   Webhook: POST http://localhost:${info.port}/api/webhook`);
});
