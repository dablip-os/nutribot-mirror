import type { WhatsAppAdapter } from './whatsapp.adapter.js';
import type { OutgoingMessage } from '../domain/types.js';

interface StoredResponse extends OutgoingMessage {
  timestamp: string;
}

const responseStore = new Map<string, StoredResponse[]>();

export const simulatorAdapter: WhatsAppAdapter = {
  async sendMessage(message: OutgoingMessage): Promise<void> {
    const entry: StoredResponse = {
      ...message,
      timestamp: new Date().toISOString(),
    };

    const existing = responseStore.get(message.phone) || [];
    existing.push(entry);
    responseStore.set(message.phone, existing);
  },
};

export function getSimulatorResponses(phone?: string): StoredResponse[] {
  if (phone) {
    return responseStore.get(phone) || [];
  }
  const all: StoredResponse[] = [];
  for (const entries of responseStore.values()) {
    all.push(...entries);
  }
  return all.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export function clearSimulatorResponses(phone?: string): void {
  if (phone) {
    responseStore.delete(phone);
  } else {
    responseStore.clear();
  }
}
