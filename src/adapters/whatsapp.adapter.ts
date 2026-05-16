import type { OutgoingMessage } from '../domain/types.js';

export interface WhatsAppAdapter {
  sendMessage(message: OutgoingMessage): Promise<void>;
}
