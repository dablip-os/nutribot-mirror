import { describe, it, expect } from 'vitest';
import { parseIntent, getNextState } from '../../src/domain/conversation.js';
import { ConversationState } from '../../src/domain/types.js';

describe('parseIntent', () => {
  it('detects greetings', () => {
    expect(parseIntent('hola', ConversationState.IDLE)).toBe('GREET');
    expect(parseIntent('Buenos días', ConversationState.IDLE)).toBe('GREET');
    expect(parseIntent('hey', ConversationState.IDLE)).toBe('GREET');
  });

  it('detects catalog intent', () => {
    expect(parseIntent('catálogo', ConversationState.IDLE)).toBe('VIEW_CATALOG');
    expect(parseIntent('productos', ConversationState.IDLE)).toBe('VIEW_CATALOG');
    expect(parseIntent('ver productos', ConversationState.IDLE)).toBe('VIEW_CATALOG');
  });

  it('detects help intent from any state', () => {
    expect(parseIntent('ayuda', ConversationState.IDLE)).toBe('HELP');
    expect(parseIntent('ayuda', ConversationState.BROWSING_CATALOG)).toBe('HELP');
    expect(parseIntent('help', ConversationState.CART_REVIEW)).toBe('HELP');
  });

  it('detects product selection in BROWSING_CATALOG', () => {
    expect(parseIntent('1', ConversationState.BROWSING_CATALOG)).toBe('SELECT_PRODUCT');
    expect(parseIntent('proteina', ConversationState.BROWSING_CATALOG)).toBe('SELECT_PRODUCT');
  });

  it('detects add to cart intent', () => {
    expect(parseIntent('agregar', ConversationState.VIEWING_PRODUCT)).toBe('ADD_TO_CART');
    expect(parseIntent('agregar 3', ConversationState.VIEWING_PRODUCT)).toBe('ADD_TO_CART');
    expect(parseIntent('quiero', ConversationState.VIEWING_PRODUCT)).toBe('ADD_TO_CART');
  });

  it('detects quantity in ADDING_TO_CART', () => {
    expect(parseIntent('5', ConversationState.ADDING_TO_CART)).toBe('SET_QUANTITY');
  });

  it('detects cart review intent', () => {
    expect(parseIntent('carrito', ConversationState.IDLE)).toBe('VIEW_CART');
    expect(parseIntent('ver carrito', ConversationState.BROWSING_CATALOG)).toBe('VIEW_CART');
  });

  it('detects checkout intent', () => {
    expect(parseIntent('pedir', ConversationState.CART_REVIEW)).toBe('CHECKOUT');
    expect(parseIntent('confirmar pedido', ConversationState.CART_REVIEW)).toBe('CHECKOUT');
  });

  it('detects name input in CHECKOUT', () => {
    expect(parseIntent('Juan Pérez', ConversationState.CHECKOUT)).toBe('PROVIDE_NAME');
  });

  it('detects confirmation in AWAITING_CONFIRM', () => {
    expect(parseIntent('sí', ConversationState.AWAITING_CONFIRM)).toBe('CONFIRM_ORDER');
    expect(parseIntent('confirmar', ConversationState.AWAITING_CONFIRM)).toBe('CONFIRM_ORDER');
    expect(parseIntent('dale', ConversationState.AWAITING_CONFIRM)).toBe('CONFIRM_ORDER');
  });

  it('detects cancel in AWAITING_CONFIRM', () => {
    expect(parseIntent('no', ConversationState.AWAITING_CONFIRM)).toBe('CANCEL');
    expect(parseIntent('cancelar', ConversationState.AWAITING_CONFIRM)).toBe('CANCEL');
  });

  it('detects remove from cart', () => {
    expect(parseIntent('quitar 1', ConversationState.CART_REVIEW)).toBe('REMOVE_FROM_CART');
    expect(parseIntent('eliminar 2', ConversationState.CART_REVIEW)).toBe('REMOVE_FROM_CART');
  });

  it('detects clear cart', () => {
    expect(parseIntent('vaciar', ConversationState.CART_REVIEW)).toBe('CLEAR_CART');
  });

  it('detects back/volver', () => {
    expect(parseIntent('volver', ConversationState.VIEWING_PRODUCT)).toBe('GO_BACK');
    expect(parseIntent('atrás', ConversationState.CART_REVIEW)).toBe('GO_BACK');
  });

  it('detects new order in ORDER_PLACED', () => {
    expect(parseIntent('nuevo pedido', ConversationState.ORDER_PLACED)).toBe('NEW_ORDER');
    expect(parseIntent('catálogo', ConversationState.ORDER_PLACED)).toBe('NEW_ORDER');
  });

  it('returns UNKNOWN for unrecognized text', () => {
    expect(parseIntent('asdfghjkl', ConversationState.IDLE)).toBe('UNKNOWN');
  });
});

describe('getNextState', () => {
  it('GREET → IDLE', () => {
    expect(getNextState(ConversationState.BROWSING_CATALOG, 'GREET')).toBe(ConversationState.IDLE);
  });

  it('VIEW_CATALOG → BROWSING_CATALOG', () => {
    expect(getNextState(ConversationState.IDLE, 'VIEW_CATALOG')).toBe(ConversationState.BROWSING_CATALOG);
  });

  it('SELECT_PRODUCT → VIEWING_PRODUCT', () => {
    expect(getNextState(ConversationState.BROWSING_CATALOG, 'SELECT_PRODUCT')).toBe(ConversationState.VIEWING_PRODUCT);
  });

  it('ADD_TO_CART → ADDING_TO_CART', () => {
    expect(getNextState(ConversationState.VIEWING_PRODUCT, 'ADD_TO_CART')).toBe(ConversationState.ADDING_TO_CART);
  });

  it('CHECKOUT → CHECKOUT', () => {
    expect(getNextState(ConversationState.CART_REVIEW, 'CHECKOUT')).toBe(ConversationState.CHECKOUT);
  });

  it('PROVIDE_NAME → AWAITING_CONFIRM', () => {
    expect(getNextState(ConversationState.CHECKOUT, 'PROVIDE_NAME')).toBe(ConversationState.AWAITING_CONFIRM);
  });

  it('CONFIRM_ORDER → ORDER_PLACED', () => {
    expect(getNextState(ConversationState.AWAITING_CONFIRM, 'CONFIRM_ORDER')).toBe(ConversationState.ORDER_PLACED);
  });

  it('CANCEL from AWAITING_CONFIRM → CART_REVIEW', () => {
    expect(getNextState(ConversationState.AWAITING_CONFIRM, 'CANCEL')).toBe(ConversationState.CART_REVIEW);
  });

  it('CANCEL from other → IDLE', () => {
    expect(getNextState(ConversationState.BROWSING_CATALOG, 'CANCEL')).toBe(ConversationState.IDLE);
  });

  it('UNKNOWN keeps current state', () => {
    expect(getNextState(ConversationState.CART_REVIEW, 'UNKNOWN')).toBe(ConversationState.CART_REVIEW);
  });
});
