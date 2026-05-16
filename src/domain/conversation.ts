import { ConversationState } from './types.js';

export type Intent =
  | 'GREET'
  | 'VIEW_CATALOG'
  | 'SELECT_PRODUCT'
  | 'ADD_TO_CART'
  | 'SET_QUANTITY'
  | 'VIEW_CART'
  | 'REMOVE_FROM_CART'
  | 'CLEAR_CART'
  | 'CHECKOUT'
  | 'PROVIDE_NAME'
  | 'CONFIRM_ORDER'
  | 'CANCEL'
  | 'GO_BACK'
  | 'HELP'
  | 'NEW_ORDER'
  | 'UNKNOWN';

const GREET_PATTERNS = /^(hola|hey|buenos?\s*d[ií]as?|buenas?\s*tardes?|buenas?\s*noches?|hi|hello|que\s*tal|saludos?|inicio)/i;
const CATALOG_PATTERNS = /^(cat[aá]logo|productos?|ver\s*productos?|menu|menú|tienda|comprar)/i;
const ADD_PATTERNS = /^(agregar|añadir|quiero|a[gñ]adir|meter)/i;
const CART_PATTERNS = /^(carrito|ver\s*carrito|mi\s*carrito|carro)/i;
const REMOVE_PATTERNS = /^(quitar|eliminar|borrar|remover|sacar)\s*/i;
const CLEAR_PATTERNS = /^(vaciar|limpiar|borrar\s*todo)/i;
const CHECKOUT_PATTERNS = /^(pedir|confirmar\s*pedido|checkout|ordenar|comprar|finalizar)/i;
const CONFIRM_PATTERNS = /^(s[ií]|confirmar?|dale|ok|listo|correcto|afirmativo)/i;
const CANCEL_PATTERNS = /^(no|cancelar|salir|cancelar\s*pedido)/i;
const BACK_PATTERNS = /^(volver|regresar|atr[aá]s|back)/i;
const HELP_PATTERNS = /^(ayuda|help|opciones|\?|que\s*puedo)/i;
const NEW_ORDER_PATTERNS = /^(nuevo\s*pedido|otra\s*vez|otro|nueva\s*compra)/i;

export function parseIntent(text: string, state: ConversationState): Intent {
  const trimmed = text.trim();

  if (HELP_PATTERNS.test(trimmed)) return 'HELP';
  if (GREET_PATTERNS.test(trimmed)) return 'GREET';
  if (CANCEL_PATTERNS.test(trimmed)) return 'CANCEL';
  if (BACK_PATTERNS.test(trimmed)) return 'GO_BACK';

  if (state === ConversationState.ORDER_PLACED) {
    if (NEW_ORDER_PATTERNS.test(trimmed) || CATALOG_PATTERNS.test(trimmed)) return 'NEW_ORDER';
    if (GREET_PATTERNS.test(trimmed)) return 'GREET';
    return 'UNKNOWN';
  }

  if (CATALOG_PATTERNS.test(trimmed)) return 'VIEW_CATALOG';
  if (CART_PATTERNS.test(trimmed)) return 'VIEW_CART';
  if (CLEAR_PATTERNS.test(trimmed)) return 'CLEAR_CART';
  if (REMOVE_PATTERNS.test(trimmed)) return 'REMOVE_FROM_CART';
  if (ADD_PATTERNS.test(trimmed)) return 'ADD_TO_CART';
  if (CHECKOUT_PATTERNS.test(trimmed)) return 'CHECKOUT';

  if (state === ConversationState.BROWSING_CATALOG) {
    if (/^\d+$/.test(trimmed)) return 'SELECT_PRODUCT';
    return 'SELECT_PRODUCT';
  }

  if (state === ConversationState.ADDING_TO_CART) {
    if (/^\d+$/.test(trimmed)) return 'SET_QUANTITY';
  }

  if (state === ConversationState.CHECKOUT) {
    return 'PROVIDE_NAME';
  }

  if (state === ConversationState.AWAITING_CONFIRM) {
    if (CONFIRM_PATTERNS.test(trimmed)) return 'CONFIRM_ORDER';
    return 'CANCEL';
  }

  return 'UNKNOWN';
}

export function getNextState(
  currentState: ConversationState,
  intent: Intent,
): ConversationState {
  switch (intent) {
    case 'GREET':
    case 'NEW_ORDER':
      return ConversationState.IDLE;
    case 'VIEW_CATALOG':
    case 'GO_BACK':
      if (currentState === ConversationState.CART_REVIEW && intent === 'GO_BACK') {
        return ConversationState.BROWSING_CATALOG;
      }
      return ConversationState.BROWSING_CATALOG;
    case 'SELECT_PRODUCT':
      return ConversationState.VIEWING_PRODUCT;
    case 'ADD_TO_CART':
      return ConversationState.ADDING_TO_CART;
    case 'SET_QUANTITY':
      return ConversationState.CART_REVIEW;
    case 'VIEW_CART':
      return ConversationState.CART_REVIEW;
    case 'REMOVE_FROM_CART':
    case 'CLEAR_CART':
      return ConversationState.CART_REVIEW;
    case 'CHECKOUT':
      return ConversationState.CHECKOUT;
    case 'PROVIDE_NAME':
      return ConversationState.AWAITING_CONFIRM;
    case 'CONFIRM_ORDER':
      return ConversationState.ORDER_PLACED;
    case 'CANCEL':
      if (currentState === ConversationState.AWAITING_CONFIRM) {
        return ConversationState.CART_REVIEW;
      }
      return ConversationState.IDLE;
    default:
      return currentState;
  }
}
