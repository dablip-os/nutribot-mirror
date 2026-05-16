import { nuturyxClient } from '../adapters/nuturyx.client.js';
import type { NuturyxProducto } from '../domain/types.js';

export const catalogService = {
  async listProducts(): Promise<NuturyxProducto[]> {
    const productos = await nuturyxClient.getProductos();
    return productos.filter((p) => p.activo && p.stock > 0);
  },

  async getProduct(id: string): Promise<NuturyxProducto | null> {
    try {
      return await nuturyxClient.getProducto(id);
    } catch {
      return null;
    }
  },

  formatProductList(productos: NuturyxProducto[]): string {
    if (productos.length === 0) {
      return '😕 No hay productos disponibles en este momento.';
    }

    let text = '📦 *Catálogo de productos:*\n\n';
    productos.forEach((p, i) => {
      text += `${i + 1}. *${p.nombre}* — $${p.precio.toLocaleString()}\n`;
      if (p.descripcion) text += `   ${p.descripcion}\n`;
      text += `   📊 Stock: ${p.stock} | ID: ${p.id}\n\n`;
    });
    text += '👉 Escribe el *número* o *nombre* del producto para ver más detalles.';
    return text;
  },

  formatProductDetail(p: NuturyxProducto): string {
    let text = `🏷️ *${p.nombre}*\n\n`;
    if (p.descripcion) text += `📝 ${p.descripcion}\n\n`;
    text += `💰 Precio: $${p.precio.toLocaleString()}\n`;
    text += `📊 Stock disponible: ${p.stock}\n`;
    if (p.categoria) text += `📁 Categoría: ${p.categoria}\n`;
    text += '\n👉 Opciones:\n';
    text += '• Escribe *"agregar"* o *"agregar X"* para añadir al carrito\n';
    text += '• Escribe *"volver"* para regresar al catálogo';
    return text;
  },
};
