# NutriBot

Chatbot de ventas por WhatsApp para **Nuturyx**. Recibe mensajes, muestra catálogo, permite armar pedidos y los crea en Nuturyx vía API.

## Stack

- **Runtime**: Node.js 20+
- **Framework**: [Hono](https://hono.dev) (ultra-ligero, serverless-first)
- **Lenguaje**: TypeScript
- **Sesiones**: Supabase (producción) / In-memory (dev/test)
- **Deploy**: Vercel Serverless Functions
- **Tests**: Vitest

## Arquitectura

```
src/
├── config/       → Validación env vars (Zod)
├── transport/    → Webhook + simulador HTTP
├── domain/       → Máquina de estados, carrito, tipos
├── services/     → Message router, catálogo, pedidos, sesiones
├── adapters/     → Nuturyx client, WhatsApp adapter, Supabase
├── middleware/   → Request ID, logger (pino), rate limit
└── utils/        → Errores tipados, retry con backoff
```

## Inicio rápido

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Edita `.env` con tus valores:

```env
# Mínimo para dev local (sin Supabase = sesiones in-memory)
NUTURYX_API_BASE_URL=http://localhost:3000/api/comercial
NUTURYX_BOT_API_TOKEN=tu_token_bot

# Opcional: si quieres sesiones persistentes
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_KEY=tu_service_key

# Opcional: respuestas naturales con OpenRouter
OPENROUTER_API_KEY=tu_openrouter_key
OPENROUTER_MODEL=meta-llama/llama-3.1-8b-instruct:free

# Perfil comercial (para respuestas más humanas y de cierre)
BOT_STORE_NAME=Nuturyx
BOT_COUNTRY=Colombia
BOT_CURRENCY=COP
BOT_SUPPORT_PHONE=+57XXXXXXXXXX
BOT_SUPPORT_HOURS=Lun a Sab 8:00am - 6:00pm
BOT_DELIVERY_INFO=Envios nacionales 24-72h habiles, segun ciudad.
BOT_PAYMENT_METHODS=Transferencia, tarjeta, pago contraentrega (segun cobertura).
BOT_RETURN_POLICY=Cambios por producto sellado con empaque original dentro de 5 dias.
BOT_DISCLAIMER=La asesoria no reemplaza recomendacion medica o nutricional profesional.
```

### 3. Crear tabla en Supabase (opcional)

Ejecuta el SQL en tu Supabase Dashboard → SQL Editor:

```sql
-- Archivo: supabase/migrations/001_bot_sessions.sql
```

### 4. Correr en desarrollo

```bash
npm run dev
```

El servidor inicia en `http://localhost:3005`.

## Probar con el simulador

El simulador permite probar todo el flujo sin conectar WhatsApp.

### Enviar un mensaje

```bash
curl -X POST http://localhost:3005/api/webhook \
  -H "Content-Type: application/json" \
  -d '{"phone": "+573001234567", "text": "hola"}'
```

### Flujo completo de ejemplo

```bash
# 1. Saludar
curl -s -X POST http://localhost:3005/api/webhook \
  -H "Content-Type: application/json" \
  -d '{"phone": "+573001234567", "text": "hola"}' | jq .response

# 2. Ver catálogo
curl -s -X POST http://localhost:3005/api/webhook \
  -H "Content-Type: application/json" \
  -d '{"phone": "+573001234567", "text": "catálogo"}' | jq .response

# 3. Seleccionar producto (por número)
curl -s -X POST http://localhost:3005/api/webhook \
  -H "Content-Type: application/json" \
  -d '{"phone": "+573001234567", "text": "1"}' | jq .response

# 4. Agregar al carrito
curl -s -X POST http://localhost:3005/api/webhook \
  -H "Content-Type: application/json" \
  -d '{"phone": "+573001234567", "text": "agregar 2"}' | jq .response

# 5. Confirmar pedido
curl -s -X POST http://localhost:3005/api/webhook \
  -H "Content-Type: application/json" \
  -d '{"phone": "+573001234567", "text": "pedir"}' | jq .response

# 6. Dar nombre
curl -s -X POST http://localhost:3005/api/webhook \
  -H "Content-Type: application/json" \
  -d '{"phone": "+573001234567", "text": "Juan Pérez"}' | jq .response

# 7. Confirmar
curl -s -X POST http://localhost:3005/api/webhook \
  -H "Content-Type: application/json" \
  -d '{"phone": "+573001234567", "text": "sí"}' | jq .response
```

### Ver respuestas del simulador

```bash
# Todas las respuestas
curl http://localhost:3005/api/simulator/responses | jq

# Solo de un teléfono
curl "http://localhost:3005/api/simulator/responses?phone=+573001234567" | jq

# Limpiar respuestas
curl -X DELETE http://localhost:3005/api/simulator/responses
```

### Health check

```bash
curl http://localhost:3005/api/health
```

### Readiness check (antes de salir a producción)

```bash
curl http://localhost:3005/api/ready
```

Si faltan variables críticas, responde `503` con `missingRequired`.

## Tests

```bash
# Todos los tests
npm test

# Con watch
npm run test:watch

# Solo unitarios
npx vitest run tests/unit

# Solo integración
npx vitest run tests/integration
```

## Comandos del bot

| Comando | Acción |
|---------|--------|
| `hola` | Saludo / reiniciar |
| `catálogo` / `productos` | Ver lista de productos |
| `[número]` | Seleccionar producto (en catálogo) |
| `agregar` / `agregar N` | Añadir al carrito |
| `carrito` | Ver carrito actual |
| `quitar N` | Eliminar item N del carrito |
| `vaciar` | Vaciar carrito |
| `pedir` | Iniciar checkout |
| `sí` / `confirmar` | Confirmar pedido |
| `cancelar` | Cancelar operación |
| `volver` | Regresar al paso anterior |
| `ayuda` | Ver comandos disponibles |
| `nuevo pedido` | Iniciar nueva compra (después de pedir) |

## Estados conversacionales

```
IDLE → BROWSING_CATALOG → VIEWING_PRODUCT → ADDING_TO_CART
                                                    ↓
                                              CART_REVIEW
                                                    ↓
                                               CHECKOUT
                                                    ↓
                                           AWAITING_CONFIRM
                                                    ↓
                                             ORDER_PLACED
```

## Deploy en Vercel

### 1. Instalar Vercel CLI

```bash
npm i -g vercel
```

### 2. Configurar proyecto

```bash
vercel
```

### 3. Configurar env vars en Vercel

```bash
vercel env add NUTURYX_API_BASE_URL
vercel env add NUTURYX_BOT_API_TOKEN
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_KEY
vercel env add OPENROUTER_API_KEY
vercel env add OPENROUTER_MODEL
vercel env add BOT_STORE_NAME
vercel env add BOT_COUNTRY
vercel env add BOT_CURRENCY
vercel env add BOT_SUPPORT_PHONE
vercel env add BOT_SUPPORT_HOURS
vercel env add BOT_DELIVERY_INFO
vercel env add BOT_PAYMENT_METHODS
vercel env add BOT_RETURN_POLICY
vercel env add BOT_DISCLAIMER
```

### 4. Deploy

```bash
# Preview
vercel

# Producción
vercel --prod
```

### Endpoints en producción

- Health: `GET https://tu-app.vercel.app/api/health`
- Webhook: `POST https://tu-app.vercel.app/api/webhook`

## Integración con Nuturyx

NutriBot consume la API de Nuturyx via `x-bot-token`:

| Operación | Endpoint |
|-----------|----------|
| Listar productos | `GET {BASE_URL}/productos` |
| Detalle producto | `GET {BASE_URL}/productos/{id}` |
| Crear pedido | `POST {BASE_URL}/pedidos` |

Los pedidos se crean con estado `pendiente_confirmacion`. Un admin los confirma desde Nuturyx.

## Futuro (post-MVP)

- **Baileys adapter**: WhatsApp real sin costo (con anti-ban)
- **NLP mejorado**: Intenciones más sofisticadas
- **Imágenes de productos**: Enviar fotos del catálogo
- **Notificaciones**: Avisar al cliente cuando el pedido cambie de estado

## Checklist Go-Live

- [ ] `NUTURYX_API_BASE_URL` y `NUTURYX_BOT_API_TOKEN` configurados
- [ ] `OPENROUTER_API_KEY` configurada (si quieres modo consultivo natural)
- [ ] Variables `BOT_*` ajustadas a tu operación real (envíos, pagos, horarios)
- [ ] `GET /api/ready` devuelve `ready: true`
- [ ] Prueba E2E: saludo → recomendación → carrito → checkout → pedido creado
