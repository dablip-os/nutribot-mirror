import type { CartItem } from './types.js';

export function addToCart(
  cart: CartItem[],
  item: CartItem,
): CartItem[] {
  const existing = cart.find((c) => c.producto_id === item.producto_id);
  if (existing) {
    return cart.map((c) =>
      c.producto_id === item.producto_id
        ? { ...c, cantidad: c.cantidad + item.cantidad }
        : c,
    );
  }
  return [...cart, item];
}

export function removeFromCart(cart: CartItem[], productoId: string): CartItem[] {
  return cart.filter((c) => c.producto_id !== productoId);
}

export function updateQuantity(
  cart: CartItem[],
  productoId: string,
  cantidad: number,
): CartItem[] {
  if (cantidad <= 0) return removeFromCart(cart, productoId);
  return cart.map((c) =>
    c.producto_id === productoId ? { ...c, cantidad } : c,
  );
}

export function clearCart(): CartItem[] {
  return [];
}

export function getCartTotal(cart: CartItem[]): number {
  return cart.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
}

export function formatCart(cart: CartItem[]): string {
  if (cart.length === 0) {
    return '🛒 Tu carrito está vacío.\n\n👉 Escribe *"catálogo"* para ver productos.';
  }

  let text = '🛒 *Tu carrito:*\n\n';
  cart.forEach((item, i) => {
    const subtotal = item.precio * item.cantidad;
    text += `${i + 1}. ${item.nombre} x${item.cantidad} — $${subtotal.toLocaleString()}\n`;
  });

  const total = getCartTotal(cart);
  text += `\n💰 *Total: $${total.toLocaleString()}*\n`;
  text += '\n👉 Opciones:\n';
  text += '• *"quitar [número]"* — eliminar producto\n';
  text += '• *"vaciar"* — vaciar carrito\n';
  text += '• *"catálogo"* — seguir comprando\n';
  text += '• *"pedir"* — confirmar pedido';
  return text;
}
