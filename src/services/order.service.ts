import { nuturyxClient } from '../adapters/nuturyx.client.js';
import type {
  CartItem,
  NuturyxCrearPedidoPayload,
  NuturyxPedidoResponse,
} from '../domain/types.js';

export const orderService = {
  async createOrder(params: {
    phone: string;
    nombre: string;
    email?: string;
    cart: CartItem[];
    notas?: string;
  }): Promise<NuturyxPedidoResponse> {
    const payload: NuturyxCrearPedidoPayload = {
      cliente_nombre: params.nombre,
      cliente_whatsapp: params.phone,
      cliente_email: params.email,
      canal: 'whatsapp',
      items: params.cart.map((item) => ({
        producto_id: item.producto_id,
        cantidad: item.cantidad,
      })),
      notas_cliente: params.notas,
    };

    return nuturyxClient.crearPedido(payload);
  },

  formatOrderConfirmation(pedido: NuturyxPedidoResponse): string {
    let text = '✅ *¡Pedido creado exitosamente!*\n\n';
    text += `📋 Pedido #${pedido.id}\n`;
    text += `📊 Estado: ${pedido.estado}\n\n`;
    text += '*Detalle:*\n';
    pedido.items.forEach((item) => {
      text += `• ${item.nombre} x${item.cantidad} — $${item.subtotal.toLocaleString()}\n`;
    });
    text += `\n💰 *Total: $${pedido.total.toLocaleString()}*\n\n`;
    text += '📞 Un administrador confirmará tu pedido pronto.\n';
    text += '\n👉 Escribe *"nuevo pedido"* para hacer otra compra.';
    return text;
  },
};
