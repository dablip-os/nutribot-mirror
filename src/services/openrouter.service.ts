import { getEnv } from '../config/env.js';
import { logger } from '../middleware/logger.js';
import type { CartItem, ConversationState, NuturyxProducto } from '../domain/types.js';

type OpenRouterMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

function formatCatalog(products: NuturyxProducto[]): string {
  if (products.length === 0) {
    return 'Catálogo no disponible temporalmente. No inventes productos; indica que se está actualizando y ofrece tomar datos para seguimiento.';
  }

  return products
    .slice(0, 25)
    .map((p) => `- ${p.nombre} | $${p.precio} | stock: ${p.stock}${p.categoria ? ` | categoria: ${p.categoria}` : ''}`)
    .join('\n');
}

function formatCart(cart: CartItem[]): string {
  if (cart.length === 0) return 'Carrito vacío';
  return cart
    .map((item) => `- ${item.nombre} x${item.cantidad} ($${item.precio})`)
    .join('\n');
}

function getSystemPrompt(): string {
  const env = getEnv();

  return [
    `Eres una asesora comercial humana de suplementos de ${env.BOT_STORE_NAME} por WhatsApp.`,
    'Responde en español neutro, tono cercano y natural, sin decir que eres IA ni bot.',
    'Objetivo: ayudar a elegir productos y cerrar compra de forma consultiva.',
    'Haz preguntas breves cuando falte contexto (objetivo, experiencia, presupuesto, sabor).',
    'Si te preguntan por subir peso, masa muscular, definición o rendimiento, recomienda productos concretos del catálogo disponible.',
    'No inventes productos, precios ni stock fuera del catálogo compartido.',
    'Mantén respuestas de 3 a 8 líneas, claras y accionables.',
    'Cierra con una pregunta concreta para avanzar (ej: ¿te recomiendo una opción económica y una premium?).',
    'Si preguntan por pedido/carrito, guía de forma natural y breve.',
    `Moneda de precios: ${env.BOT_CURRENCY}. País principal de operación: ${env.BOT_COUNTRY}.`,
    `Horarios de soporte: ${env.BOT_SUPPORT_HOURS}.`,
    `Envíos: ${env.BOT_DELIVERY_INFO}.`,
    `Pagos: ${env.BOT_PAYMENT_METHODS}.`,
    `Política comercial: ${env.BOT_RETURN_POLICY}.`,
    `Si aplica, agrega esta nota al final en una frase breve: ${env.BOT_DISCLAIMER}`,
  ].join(' ');
}

export function isOpenRouterEnabled(): boolean {
  const env = getEnv();
  return Boolean(env.OPENROUTER_API_KEY);
}

export async function generateNaturalReply(params: {
  userText: string;
  state: ConversationState;
  products: NuturyxProducto[];
  cart: CartItem[];
  customerPhone: string;
  recentMessages?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  conversationSummary?: string;
}): Promise<string | null> {
  const env = getEnv();

  if (!env.OPENROUTER_API_KEY) {
    return null;
  }

  const messages: OpenRouterMessage[] = [
    { role: 'system', content: getSystemPrompt() },
    {
      role: 'system',
      content: [
        `Estado conversacional actual: ${params.state}`,
        `Teléfono cliente: ${params.customerPhone}`,
        'Catálogo disponible:',
        formatCatalog(params.products),
        'Carrito actual:',
        formatCart(params.cart),
        params.conversationSummary ? `Resumen de conversación: ${params.conversationSummary}` : '',
      ].join('\n\n'),
    },
    ...(params.recentMessages || []).map((m) => ({
      role: m.role,
      content: m.content,
    })),
    { role: 'user', content: params.userText },
  ];

  try {
    const res = await fetch(`${env.OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': env.OPENROUTER_APP_URL,
        'X-Title': env.OPENROUTER_APP_NAME,
      },
      body: JSON.stringify({
        model: env.OPENROUTER_MODEL,
        messages,
        temperature: 0.6,
        max_tokens: 280,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      logger.warn({ msg: 'openrouter_non_200', status: res.status, error: errorText.slice(0, 300) });
      return null;
    }

    const data = (await res.json()) as OpenRouterResponse;
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      logger.warn({ msg: 'openrouter_empty_reply' });
      return null;
    }

    return content;
  } catch (error) {
    logger.warn({ msg: 'openrouter_request_error', error: (error as Error).message });
    return null;
  }
}
