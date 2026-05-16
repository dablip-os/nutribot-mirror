import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../../src/app.js';
import type { WhatsAppAdapter } from '../../src/adapters/whatsapp.adapter.js';
import type { OutgoingMessage } from '../../src/domain/types.js';

const sentMessages: OutgoingMessage[] = [];

const mockAdapter: WhatsAppAdapter = {
  async sendMessage(msg: OutgoingMessage) {
    sentMessages.push(msg);
  },
};

function createTestApp() {
  return createApp(mockAdapter);
}

async function sendMessage(app: ReturnType<typeof createApp>, phone: string, text: string) {
  const res = await app.request('/api/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, text }),
  });
  return res;
}

describe('Order flow integration (webhook)', () => {
  beforeEach(() => {
    sentMessages.length = 0;
  });

  it('responds to invalid payload with 400', async () => {
    const app = createTestApp();
    const res = await app.request('/api/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid payload');
  });

  it('responds to greeting with welcome message', async () => {
    const app = createTestApp();
    const res = await sendMessage(app, '+573001234567', 'hola');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.response).toContain('Bienvenido');
  });

  it('responds to help command', async () => {
    const app = createTestApp();
    const res = await sendMessage(app, '+573001234567', 'ayuda');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.response).toContain('Ayuda');
    expect(body.response).toContain('catálogo');
  });

  it('sends message via adapter', async () => {
    const app = createTestApp();
    await sendMessage(app, '+573009999999', 'hola');
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0].phone).toBe('+573009999999');
    expect(sentMessages[0].text).toContain('Bienvenido');
  });

  it('health check returns ok', async () => {
    const app = createTestApp();
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  it('returns 404 for unknown routes', async () => {
    const app = createTestApp();
    const res = await app.request('/api/nonexistent');
    expect(res.status).toBe(404);
  });
});
