import pino from 'pino';
import { createMiddleware } from 'hono/factory';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV === 'development'
      ? { target: 'pino/file', options: { destination: 1 } }
      : undefined,
});

export const loggerMiddleware = createMiddleware(async (c, next) => {
  const start = Date.now();
  const requestId = c.get('requestId') || 'unknown';

  logger.info({
    msg: 'request_start',
    request_id: requestId,
    method: c.req.method,
    path: c.req.path,
  });

  await next();

  const latency_ms = Date.now() - start;
  logger.info({
    msg: 'request_end',
    request_id: requestId,
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    latency_ms,
  });
});
