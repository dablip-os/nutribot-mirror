import { describe, it, expect } from 'vitest';
import {
  addToCart,
  removeFromCart,
  updateQuantity,
  clearCart,
  getCartTotal,
  formatCart,
} from '../../src/domain/cart.js';
import type { CartItem } from '../../src/domain/types.js';

const mockItem: CartItem = {
  producto_id: 'p1',
  nombre: 'Proteína Whey',
  precio: 50000,
  cantidad: 1,
};

const mockItem2: CartItem = {
  producto_id: 'p2',
  nombre: 'Creatina',
  precio: 30000,
  cantidad: 2,
};

describe('addToCart', () => {
  it('adds new item to empty cart', () => {
    const cart = addToCart([], mockItem);
    expect(cart).toHaveLength(1);
    expect(cart[0].producto_id).toBe('p1');
    expect(cart[0].cantidad).toBe(1);
  });

  it('increments quantity for existing item', () => {
    const cart = addToCart([mockItem], { ...mockItem, cantidad: 3 });
    expect(cart).toHaveLength(1);
    expect(cart[0].cantidad).toBe(4);
  });

  it('adds different items separately', () => {
    const cart = addToCart([mockItem], mockItem2);
    expect(cart).toHaveLength(2);
  });
});

describe('removeFromCart', () => {
  it('removes item by product id', () => {
    const cart = removeFromCart([mockItem, mockItem2], 'p1');
    expect(cart).toHaveLength(1);
    expect(cart[0].producto_id).toBe('p2');
  });

  it('returns same cart if product not found', () => {
    const cart = removeFromCart([mockItem], 'nonexistent');
    expect(cart).toHaveLength(1);
  });
});

describe('updateQuantity', () => {
  it('updates quantity for existing item', () => {
    const cart = updateQuantity([mockItem], 'p1', 5);
    expect(cart[0].cantidad).toBe(5);
  });

  it('removes item if quantity is 0', () => {
    const cart = updateQuantity([mockItem], 'p1', 0);
    expect(cart).toHaveLength(0);
  });

  it('removes item if quantity is negative', () => {
    const cart = updateQuantity([mockItem], 'p1', -1);
    expect(cart).toHaveLength(0);
  });
});

describe('clearCart', () => {
  it('returns empty array', () => {
    expect(clearCart()).toEqual([]);
  });
});

describe('getCartTotal', () => {
  it('calculates total correctly', () => {
    const cart = [mockItem, mockItem2];
    expect(getCartTotal(cart)).toBe(50000 * 1 + 30000 * 2);
  });

  it('returns 0 for empty cart', () => {
    expect(getCartTotal([])).toBe(0);
  });
});

describe('formatCart', () => {
  it('shows empty cart message for empty cart', () => {
    const text = formatCart([]);
    expect(text).toContain('vacío');
  });

  it('shows items and total for non-empty cart', () => {
    const text = formatCart([mockItem, mockItem2]);
    expect(text).toContain('Proteína Whey');
    expect(text).toContain('Creatina');
    expect(text).toContain('Total');
  });
});
