import { ConversationState } from '../domain/types.js';
import type { Session, CartItem, SessionContext } from '../domain/types.js';
import { randomUUID } from 'crypto';

const TABLE = 'bot_sessions';

export interface SessionStore {
  getOrCreate(phone: string): Promise<Session>;
  update(phone: string, updates: {
    state?: ConversationState;
    cart?: CartItem[];
    context?: SessionContext;
  }): Promise<Session>;
  reset(phone: string): Promise<Session>;
}

function createSession(phone: string): Session {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    phone,
    state: ConversationState.IDLE,
    cart: [],
    context: {},
    created_at: now,
    updated_at: now,
  };
}

// ── In-memory store (dev/test) ──
function createMemoryStore(): SessionStore {
  const store = new Map<string, Session>();

  return {
    async getOrCreate(phone: string): Promise<Session> {
      let session = store.get(phone);
      if (!session) {
        session = createSession(phone);
        store.set(phone, session);
      }
      return { ...session };
    },

    async update(phone, updates): Promise<Session> {
      const session = store.get(phone);
      if (!session) {
        const newSession = createSession(phone);
        Object.assign(newSession, updates, { updated_at: new Date().toISOString() });
        store.set(phone, newSession);
        return { ...newSession };
      }
      Object.assign(session, updates, { updated_at: new Date().toISOString() });
      store.set(phone, session);
      return { ...session };
    },

    async reset(phone): Promise<Session> {
      return this.update(phone, {
        state: ConversationState.IDLE,
        cart: [],
        context: {},
      });
    },
  };
}

// ── Supabase store (production) ──
function createSupabaseStore(): SessionStore {
  return {
    async getOrCreate(phone: string): Promise<Session> {
      const { getSupabaseClient } = await import('../adapters/supabase.client.js');
      const supabase = getSupabaseClient();

      const { data: existing } = await supabase
        .from(TABLE)
        .select('*')
        .eq('phone', phone)
        .single();

      if (existing) {
        return existing as Session;
      }

      const sessionData = {
        phone,
        state: ConversationState.IDLE,
        cart: [],
        context: {},
      };

      const { data: created, error } = await supabase
        .from(TABLE)
        .insert(sessionData)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create session: ${error.message}`);
      }

      return created as Session;
    },

    async update(phone, updates): Promise<Session> {
      const { getSupabaseClient } = await import('../adapters/supabase.client.js');
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from(TABLE)
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('phone', phone)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update session: ${error.message}`);
      }

      return data as Session;
    },

    async reset(phone): Promise<Session> {
      return this.update(phone, {
        state: ConversationState.IDLE,
        cart: [],
        context: {},
      });
    },
  };
}

function resolveStore(): SessionStore {
  const hasSupabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY;
  return hasSupabase ? createSupabaseStore() : createMemoryStore();
}

export const sessionService: SessionStore = resolveStore();
