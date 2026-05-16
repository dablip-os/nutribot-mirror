import { Hono } from 'hono';
import {
  getSimulatorResponses,
  clearSimulatorResponses,
} from '../adapters/simulator.adapter.js';

export function createSimulatorRoutes() {
  const sim = new Hono();

  sim.get('/responses', (c) => {
    const phone = c.req.query('phone');
    const responses = getSimulatorResponses(phone || undefined);
    return c.json({ responses });
  });

  sim.delete('/responses', (c) => {
    const phone = c.req.query('phone');
    clearSimulatorResponses(phone || undefined);
    return c.json({ ok: true, message: 'Responses cleared' });
  });

  return sim;
}
