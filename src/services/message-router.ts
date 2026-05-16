import { parseIntent, getNextState, type Intent } from '../domain/conversation.js';
import { addToCart, removeFromCart, clearCart, formatCart, getCartTotal } from '../domain/cart.js';
import { catalogService } from './catalog.service.js';
import { orderService } from './order.service.js';
import { sessionService } from './session.service.js';
import { generateNaturalReply, isOpenRouterEnabled } from './openrouter.service.js';
import { ConversationState } from '../domain/types.js';
import type { IncomingMessage, Session, NuturyxProducto, CartItem } from '../domain/types.js';
import { logger } from '../middleware/logger.js';

let cachedProducts: NuturyxProducto[] | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 60_000;

async function getProducts(): Promise<NuturyxProducto[]> {
  const now = Date.now();
  if (cachedProducts && now < cacheExpiry) return cachedProducts;
  cachedProducts = await catalogService.listProducts();
  cacheExpiry = now + CACHE_TTL_MS;
  return cachedProducts;
}

function getHelpText(): string {
  return (
    '🤖 *NutriBot — Ayuda*\n\n' +
    'Comandos disponibles:\n' +
    '• *"catálogo"* — Ver productos\n' +
    '• *"carrito"* — Ver tu carrito\n' +
    '• *"pedir"* — Confirmar pedido\n' +
    '• *"vaciar"* — Vaciar carrito\n' +
    '• *"volver"* — Regresar al paso anterior\n' +
    '• *"cancelar"* — Cancelar operación actual\n' +
    '• *"ayuda"* — Ver este mensaje\n'
  );
}

function getWelcomeText(): string {
  return (
    '👋 *¡Hola! Bienvenido a NutriBot*\n\n' +
    'Soy tu asistente de compras. ¿En qué puedo ayudarte?\n\n' +
    '👉 Escribe *"catálogo"* para ver nuestros productos\n' +
    '👉 Escribe *"ayuda"* para ver todos los comandos'
  );
}

function isStrictCommandText(text: string): boolean {
  const normalized = text.trim().toLowerCase();

  return /^(cat[aá]logo|productos?|carrito|pedir|vaciar|ayuda|volver|cancelar|nuevo pedido|si|sí|confirmar|quitar\s+\d+|agregar(?:\s+\d+)?)$/.test(
    normalized,
  );
}

function shouldUseNaturalMode(text: string, intent: Intent): boolean {
  if (!isOpenRouterEnabled()) return false;

  const nutricionKeywords =
    /(busco|buscando|quiero|recom|aumentar|subir|bajar|masa|muscular|peso|proteina|proteína|creatina|gainer|definici[oó]n)/i;

  if (nutricionKeywords.test(text)) return true;
  if (text.trim().split(/\s+/).length >= 6) return true;

  const aiFriendlyIntents: Intent[] = ['GREET', 'HELP', 'UNKNOWN'];
  return !isStrictCommandText(text) && aiFriendlyIntents.includes(intent);
}

function appendRecentMessages(
  existing: Array<{ role: 'user' | 'assistant'; content: string }> | undefined,
  next: Array<{ role: 'user' | 'assistant'; content: string }>,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const merged = [...(existing || []), ...next];
  return merged.slice(-8);
}

function buildConversationSummary(
  previousSummary: string | undefined,
  userText: string,
  assistantText: string,
): string {
  const base = previousSummary ? `${previousSummary} | ` : '';
  const compactUser = userText.replace(/\s+/g, ' ').trim().slice(0, 80);
  const compactAssistant = assistantText.replace(/\s+/g, ' ').trim().slice(0, 100);
  return `${base}U:${compactUser} A:${compactAssistant}`.slice(-500);
}

export async function handleMessage(msg: IncomingMessage): Promise<string> {
  const { phone, text } = msg;

  try {
    const session = await sessionService.getOrCreate(phone);
    const intent = parseIntent(text, session.state);

    logger.info({
      msg: 'message_received',
      phone,
      text: text.substring(0, 100),
      state: session.state,
      intent,
    });

    if (shouldUseNaturalMode(text, intent)) {
      let productsForContext: NuturyxProducto[] = [];

      try {
        productsForContext = await getProducts();
      } catch (error) {
        logger.warn({
          msg: 'natural_mode_catalog_unavailable',
          phone,
          error: (error as Error).message,
        });
      }

      const naturalReply = await generateNaturalReply({
        userText: text,
        state: session.state,
        products: productsForContext,
        cart: session.cart,
        customerPhone: phone,
        recentMessages: session.context.recent_messages,
        conversationSummary: session.context.conversation_summary,
      });

      if (naturalReply) {
        const updatedRecent = appendRecentMessages(session.context.recent_messages, [
          { role: 'user', content: text },
          { role: 'assistant', content: naturalReply },
        ]);

        await sessionService.update(phone, {
          context: {
            ...session.context,
            last_message: text,
            recent_messages: updatedRecent,
            conversation_summary: buildConversationSummary(
              session.context.conversation_summary,
              text,
              naturalReply,
            ),
          },
        });

        logger.info({
          msg: 'natural_reply_generated',
          phone,
          state: session.state,
          intent,
          response_length: naturalReply.length,
        });

        return naturalReply;
      }
    }

    const response = await processIntent(intent, text, session);

    logger.info({
      msg: 'message_processed',
      phone,
      state: session.state,
      intent,
      response_length: response.length,
    });

    return response;
  } catch (error) {
    logger.error({
      msg: 'message_error',
      phone,
      error: (error as Error).message,
    });

    return '⚠️ Ocurrió un error procesando tu mensaje. Por favor intenta de nuevo.\n\nEscribe *"ayuda"* si necesitas orientación.';
  }
}

async function processIntent(
  intent: Intent,
  text: string,
  session: Session,
): Promise<string> {
  const { phone } = session;

  switch (intent) {
    case 'GREET':
    case 'NEW_ORDER': {
      await sessionService.reset(phone);
      return getWelcomeText();
    }

    case 'HELP':
      return getHelpText();

    case 'VIEW_CATALOG': {
      const products = await getProducts();
      await sessionService.update(phone, {
        state: ConversationState.BROWSING_CATALOG,
      });
      return catalogService.formatProductList(products);
    }

    case 'SELECT_PRODUCT': {
      const products = await getProducts();
      const product = resolveProduct(text, products);

      if (!product) {
        return '❌ No encontré ese producto. Escribe *"catálogo"* para ver la lista completa.';
      }

      await sessionService.update(phone, {
        state: ConversationState.VIEWING_PRODUCT,
        context: { ...session.context, viewing_product_id: product.id },
      });
      return catalogService.formatProductDetail(product);
    }

    case 'ADD_TO_CART': {
      const quantityMatch = text.match(/(\d+)/);
      const quantity = quantityMatch ? parseInt(quantityMatch[1], 10) : 1;

      let productId = session.context.viewing_product_id;

      if (!productId) {
        const products = await getProducts();
        const product = resolveProduct(text.replace(/^(agregar|añadir|quiero|meter)\s*/i, ''), products);
        if (product) {
          productId = product.id;
        }
      }

      if (!productId) {
        return '❌ No sé qué producto agregar. Primero selecciona un producto del *catálogo*.';
      }

      const product = await catalogService.getProduct(productId);
      if (!product) {
        return '❌ Producto no encontrado. Escribe *"catálogo"* para ver la lista.';
      }

      if (product.stock < quantity) {
        return `⚠️ Solo hay ${product.stock} unidades disponibles de *${product.nombre}*.`;
      }

      const newItem: CartItem = {
        producto_id: product.id,
        nombre: product.nombre,
        precio: product.precio,
        cantidad: quantity,
      };

      const updatedCart = addToCart(session.cart, newItem);
      await sessionService.update(phone, {
        state: ConversationState.CART_REVIEW,
        cart: updatedCart,
        context: { ...session.context, viewing_product_id: undefined },
      });

      return `✅ *${product.nombre}* x${quantity} agregado al carrito.\n\n${formatCart(updatedCart)}`;
    }

    case 'SET_QUANTITY': {
      const qty = parseInt(text.trim(), 10);
      if (isNaN(qty) || qty <= 0) {
        return '❌ Por favor ingresa una cantidad válida (número mayor a 0).';
      }

      const pendingId = session.context.pending_quantity_product_id;
      if (!pendingId) {
        return '❌ No hay producto pendiente. Escribe *"catálogo"* para seleccionar uno.';
      }

      const prod = await catalogService.getProduct(pendingId);
      if (!prod) {
        return '❌ Producto no encontrado.';
      }

      if (prod.stock < qty) {
        return `⚠️ Solo hay ${prod.stock} unidades disponibles de *${prod.nombre}*.`;
      }

      const item: CartItem = {
        producto_id: prod.id,
        nombre: prod.nombre,
        precio: prod.precio,
        cantidad: qty,
      };

      const cart = addToCart(session.cart, item);
      await sessionService.update(phone, {
        state: ConversationState.CART_REVIEW,
        cart,
        context: { ...session.context, pending_quantity_product_id: undefined },
      });

      return `✅ *${prod.nombre}* x${qty} agregado al carrito.\n\n${formatCart(cart)}`;
    }

    case 'VIEW_CART': {
      await sessionService.update(phone, {
        state: ConversationState.CART_REVIEW,
      });
      return formatCart(session.cart);
    }

    case 'REMOVE_FROM_CART': {
      const indexMatch = text.match(/(\d+)/);
      if (!indexMatch) {
        return '❌ Indica el número del producto a quitar. Ej: *"quitar 1"*';
      }

      const index = parseInt(indexMatch[1], 10) - 1;
      if (index < 0 || index >= session.cart.length) {
        return '❌ Número inválido. Revisa tu carrito con *"carrito"*.';
      }

      const removed = session.cart[index];
      const updatedCart = removeFromCart(session.cart, removed.producto_id);
      await sessionService.update(phone, {
        state: ConversationState.CART_REVIEW,
        cart: updatedCart,
      });

      return `🗑️ *${removed.nombre}* eliminado del carrito.\n\n${formatCart(updatedCart)}`;
    }

    case 'CLEAR_CART': {
      await sessionService.update(phone, {
        state: ConversationState.CART_REVIEW,
        cart: clearCart(),
      });
      return '🗑️ Carrito vaciado.\n\n👉 Escribe *"catálogo"* para seguir comprando.';
    }

    case 'CHECKOUT': {
      if (session.cart.length === 0) {
        return '🛒 Tu carrito está vacío. Agrega productos primero.\n\n👉 Escribe *"catálogo"* para ver productos.';
      }

      const total = getCartTotal(session.cart);
      await sessionService.update(phone, {
        state: ConversationState.CHECKOUT,
      });

      let text = '📋 *Resumen de tu pedido:*\n\n';
      session.cart.forEach((item, i) => {
        text += `${i + 1}. ${item.nombre} x${item.cantidad} — $${(item.precio * item.cantidad).toLocaleString()}\n`;
      });
      text += `\n💰 *Total: $${total.toLocaleString()}*\n\n`;
      text += '👉 Por favor escribe tu *nombre completo* para continuar:';
      return text;
    }

    case 'PROVIDE_NAME': {
      const nombre = text.trim();
      if (nombre.length < 2) {
        return '❌ Por favor ingresa un nombre válido (al menos 2 caracteres).';
      }

      await sessionService.update(phone, {
        state: ConversationState.AWAITING_CONFIRM,
        context: { ...session.context, cliente_nombre: nombre },
      });

      const total = getCartTotal(session.cart);
      let confirmText = '📋 *Confirma tu pedido:*\n\n';
      confirmText += `👤 Nombre: *${nombre}*\n`;
      confirmText += `📱 WhatsApp: *${phone}*\n\n`;
      session.cart.forEach((item, i) => {
        confirmText += `${i + 1}. ${item.nombre} x${item.cantidad} — $${(item.precio * item.cantidad).toLocaleString()}\n`;
      });
      confirmText += `\n💰 *Total: $${total.toLocaleString()}*\n\n`;
      confirmText += '👉 Escribe *"sí"* para confirmar o *"cancelar"* para volver al carrito.';
      return confirmText;
    }

    case 'CONFIRM_ORDER': {
      const nombre = session.context.cliente_nombre;
      if (!nombre) {
        await sessionService.update(phone, { state: ConversationState.CHECKOUT });
        return '❌ Necesito tu nombre primero. Por favor escríbelo:';
      }

      if (session.cart.length === 0) {
        await sessionService.reset(phone);
        return '🛒 Tu carrito está vacío. No se puede crear el pedido.';
      }

      const pedido = await orderService.createOrder({
        phone,
        nombre,
        email: session.context.cliente_email,
        cart: session.cart,
      });

      await sessionService.update(phone, {
        state: ConversationState.ORDER_PLACED,
        cart: [],
        context: {},
      });

      return orderService.formatOrderConfirmation(pedido);
    }

    case 'CANCEL': {
      if (session.state === ConversationState.AWAITING_CONFIRM) {
        await sessionService.update(phone, {
          state: ConversationState.CART_REVIEW,
          context: { ...session.context, cliente_nombre: undefined },
        });
        return '❌ Pedido cancelado.\n\n' + formatCart(session.cart);
      }
      await sessionService.reset(phone);
      return '❌ Operación cancelada.\n\n👉 Escribe *"catálogo"* para empezar de nuevo.';
    }

    case 'GO_BACK': {
      const backState = getBackState(session.state);
      await sessionService.update(phone, { state: backState });

      if (backState === ConversationState.BROWSING_CATALOG) {
        const products = await getProducts();
        return catalogService.formatProductList(products);
      }
      if (backState === ConversationState.CART_REVIEW) {
        return formatCart(session.cart);
      }
      return getWelcomeText();
    }

    case 'UNKNOWN':
    default: {
      const stateHint = getStateHint(session.state);
      return `🤔 No entendí tu mensaje.\n\n${stateHint}\n\n👉 Escribe *"ayuda"* para ver los comandos disponibles.`;
    }
  }
}

function resolveProduct(text: string, products: NuturyxProducto[]): NuturyxProducto | undefined {
  const trimmed = text.trim();

  const num = parseInt(trimmed, 10);
  if (!isNaN(num) && num >= 1 && num <= products.length) {
    return products[num - 1];
  }

  const byId = products.find((p) => p.id === trimmed);
  if (byId) return byId;

  const lower = trimmed.toLowerCase();
  return products.find((p) => p.nombre.toLowerCase().includes(lower));
}

function getBackState(current: ConversationState): ConversationState {
  switch (current) {
    case ConversationState.VIEWING_PRODUCT:
    case ConversationState.ADDING_TO_CART:
      return ConversationState.BROWSING_CATALOG;
    case ConversationState.CHECKOUT:
    case ConversationState.AWAITING_CONFIRM:
      return ConversationState.CART_REVIEW;
    default:
      return ConversationState.IDLE;
  }
}

function getStateHint(state: ConversationState): string {
  switch (state) {
    case ConversationState.IDLE:
      return 'Puedes escribir *"catálogo"* para ver productos.';
    case ConversationState.BROWSING_CATALOG:
      return 'Escribe el *número* del producto para ver detalles.';
    case ConversationState.VIEWING_PRODUCT:
      return 'Escribe *"agregar"* para añadir al carrito o *"volver"* para regresar.';
    case ConversationState.ADDING_TO_CART:
      return 'Escribe la *cantidad* que deseas (número).';
    case ConversationState.CART_REVIEW:
      return 'Escribe *"pedir"* para confirmar o *"catálogo"* para seguir comprando.';
    case ConversationState.CHECKOUT:
      return 'Escribe tu *nombre completo* para continuar.';
    case ConversationState.AWAITING_CONFIRM:
      return 'Escribe *"sí"* para confirmar o *"cancelar"*.';
    case ConversationState.ORDER_PLACED:
      return 'Escribe *"nuevo pedido"* para hacer otra compra.';
    default:
      return '';
  }
}
