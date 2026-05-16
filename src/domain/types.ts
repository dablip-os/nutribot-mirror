// ── Conversation States ──
export enum ConversationState {
  IDLE = 'IDLE',
  BROWSING_CATALOG = 'BROWSING_CATALOG',
  VIEWING_PRODUCT = 'VIEWING_PRODUCT',
  ADDING_TO_CART = 'ADDING_TO_CART',
  CART_REVIEW = 'CART_REVIEW',
  CHECKOUT = 'CHECKOUT',
  AWAITING_CONFIRM = 'AWAITING_CONFIRM',
  ORDER_PLACED = 'ORDER_PLACED',
}

// ── Session ──
export interface CartItem {
  producto_id: string;
  nombre: string;
  precio: number;
  cantidad: number;
}

export interface Session {
  id: string;
  phone: string;
  state: ConversationState;
  cart: CartItem[];
  context: SessionContext;
  created_at: string;
  updated_at: string;
}

export interface SessionContext {
  viewing_product_id?: string;
  pending_quantity_product_id?: string;
  cliente_nombre?: string;
  cliente_email?: string;
  last_message?: string;
  conversation_summary?: string;
  recent_messages?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

// ── Nuturyx API types ──
export interface NuturyxProducto {
  id: string;
  nombre: string;
  descripcion?: string;
  precio: number;
  stock: number;
  categoria?: string;
  imagen_url?: string;
  activo: boolean;
}

export interface NuturyxPedidoItem {
  producto_id: string;
  cantidad: number;
}

export interface NuturyxCrearPedidoPayload {
  cliente_nombre: string;
  cliente_whatsapp: string;
  cliente_email?: string;
  canal: 'whatsapp';
  items: NuturyxPedidoItem[];
  notas_cliente?: string;
}

export interface NuturyxPedidoResponse {
  id: string;
  estado: string;
  total: number;
  items: Array<{
    producto_id: string;
    nombre: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
  }>;
  created_at: string;
}

// ── Message types ──
export interface IncomingMessage {
  phone: string;
  text: string;
  timestamp?: string;
}

export interface OutgoingMessage {
  phone: string;
  text: string;
}
