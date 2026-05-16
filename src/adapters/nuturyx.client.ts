import { getEnv } from '../config/env.js';
import { NuturyxApiError } from '../utils/errors.js';
import { withRetry } from '../utils/retry.js';
import type {
  NuturyxProducto,
  NuturyxCrearPedidoPayload,
  NuturyxPedidoResponse,
} from '../domain/types.js';

const TIMEOUT_MS = 10_000;

function headers(): Record<string, string> {
  const env = getEnv();
  return {
    'x-bot-token': env.NUTURYX_BOT_API_TOKEN,
    'Content-Type': 'application/json',
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const env = getEnv();
  const url = `${env.NUTURYX_API_BASE_URL}${path}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      ...init,
      headers: { ...headers(), ...(init?.headers || {}) },
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new NuturyxApiError(
        `Nuturyx API error: ${res.status} ${res.statusText}`,
        res.status >= 500 ? 502 : res.status,
        { url, status: res.status, body },
      );
    }

    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof NuturyxApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new NuturyxApiError('Nuturyx API timeout', 504, { url });
    }
    throw new NuturyxApiError(
      `Nuturyx API unreachable: ${(error as Error).message}`,
      502,
      { url },
    );
  } finally {
    clearTimeout(timeout);
  }
}

function isRetryable(error: unknown): boolean {
  if (error instanceof NuturyxApiError) {
    return error.statusCode >= 500 || error.statusCode === 504;
  }
  return false;
}

export const nuturyxClient = {
  async getProductos(): Promise<NuturyxProducto[]> {
    return withRetry(() => request<NuturyxProducto[]>('/productos'), {
      maxRetries: 2,
      retryOn: isRetryable,
    });
  },

  async getProducto(id: string): Promise<NuturyxProducto> {
    return withRetry(() => request<NuturyxProducto>(`/productos/${id}`), {
      maxRetries: 2,
      retryOn: isRetryable,
    });
  },

  async crearPedido(payload: NuturyxCrearPedidoPayload): Promise<NuturyxPedidoResponse> {
    return withRetry(
      () =>
        request<NuturyxPedidoResponse>('/pedidos', {
          method: 'POST',
          body: JSON.stringify(payload),
        }),
      {
        maxRetries: 1,
        retryOn: isRetryable,
      },
    );
  },
};
