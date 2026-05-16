import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3005),

  // Nuturyx API
  NUTURYX_API_BASE_URL: z.string().default('http://localhost:3000/api/comercial'),
  NUTURYX_BOT_API_TOKEN: z.string().default(''),

  // Supabase (optional — falls back to in-memory sessions if not set)
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_KEY: z.string().optional(),

  // OpenRouter (optional — enables natural language assistant mode)
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),
  OPENROUTER_MODEL: z.string().default('meta-llama/llama-3.1-8b-instruct:free'),
  OPENROUTER_APP_URL: z.string().url().default('http://localhost:3005'),
  OPENROUTER_APP_NAME: z.string().default('NutriBot'),

  // Business profile (used by conversational assistant)
  BOT_BRAND_NAME: z.string().default('NutriBot'),
  BOT_STORE_NAME: z.string().default('Nuturyx'),
  BOT_COUNTRY: z.string().default('Colombia'),
  BOT_CURRENCY: z.string().default('COP'),
  BOT_SUPPORT_PHONE: z.string().default(''),
  BOT_SUPPORT_HOURS: z.string().default('Lun a Sáb 8:00am - 6:00pm'),
  BOT_DELIVERY_INFO: z.string().default('Envíos nacionales 24-72h hábiles, según ciudad.'),
  BOT_PAYMENT_METHODS: z.string().default('Transferencia, tarjeta, pago contraentrega (según cobertura).'),
  BOT_RETURN_POLICY: z.string().default('Cambios por producto sellado con empaque original dentro de 5 días.'),
  BOT_DISCLAIMER: z.string().default('La asesoría no reemplaza recomendación médica o nutricional profesional.'),

  // Observability
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().default(60),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

export function getEnv(): Env {
  if (!_env) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      const formatted = result.error.flatten().fieldErrors;
      console.error('❌ Invalid environment variables:', formatted);
      throw new Error(`Invalid environment variables: ${JSON.stringify(formatted)}`);
    }
    _env = result.data;
  }
  return _env;
}

export function isDev(): boolean {
  return getEnv().NODE_ENV === 'development';
}

export function isTest(): boolean {
  return getEnv().NODE_ENV === 'test';
}
