# DeAltura Coffee — web B2B

Sitio y portal de mayoreo de DeAltura Coffee: café de altura de Latinoamérica, tostado en Canadá.
Next.js 16 · TypeScript · next-intl (EN / FR / ES) · Supabase · Stripe.

## Correrlo en tu compu

Necesitas Node 20 o más nuevo.

```bash
npm install
cp .env.example .env.local   # ya trae valores para modo local
npm run seed                 # crea cuentas de prueba
npm run dev                  # abre http://localhost:3000
```

Cuentas de prueba (modo local):

| Correo | Contraseña | Qué es |
| --- | --- | --- |
| `admin@dealtura.ca` | `dealtura-admin` | Panel de admin en `/es/admin` |
| `demo@dealtura.ca` | `cafe-de-altura` | Cliente aprobado, puede pedir (crédito a 30 días) |
| `nuevo@dealtura.ca` | `cafe-de-altura` | Solicitud pendiente, para probar la aprobación |

## Qué hay

| Ruta | Para qué |
| --- | --- |
| `/` | Home: la etiqueta de la bolsa, formatos, calculadora de kg por semana, FAQ |
| `/coffee`, `/coffee/[slug]` | Catálogo y ficha de cada café (precios solo con cuenta aprobada) |
| `/origin` | Historia del origen y la regla de altitud de todos los orígenes |
| `/wholesale` | Solicitud de cuenta de mayoreo (crea la cuenta en estado "en revisión") |
| `/login`, `/account` | Login, pedidos, datos del negocio y dirección |
| `/cart` | Carrito, mínimo de kg, envío, impuestos, pago con tarjeta o a crédito |
| `/admin` | Aprobar cuentas, lista de precios, crédito; avanzar pedidos |
| `/api/v1/*` | API JSON para la app móvil (catálogo, cuenta, pedidos) |

Idioma: en la primera visita se detecta el idioma del navegador (inglés por defecto); el selector
del header lo cambia y queda guardado en una cookie. Cada idioma tiene su URL (`/en`, `/fr`, `/es`).

## Dónde se edita cada cosa

- **Cafés, orígenes, precios:** `content/products.json`, `content/origins.json`
  (precios en centavos de CAD; `standard` y `partner` son las dos listas de precios).
- **Mínimo de pedido, envío, correo de contacto:** `content/settings.json`.
- **Textos de la web:** `messages/en.json`, `fr.json`, `es.json`.
- **Colores, tipografía:** `src/app/globals.css` y `DESIGN.md`.
- **Fotos:** `public/images/` con los nombres de `content/images.json` (ver abajo).
- **Logo:** `public/brand/*.svg` (provisional; `npm run brand` lo regenera).

## Fotos

Pon cada foto en `public/images/` con el nombre exacto (sirve `.jpg`, `.png` o `.webp`).
Si una foto falta, la página muestra la ilustración en su lugar, así que puedes ir agregándolas de a poco.
Los nombres se cambian en `content/images.json`. Las fotos se recortan solas a la proporción del espacio.

| Archivo | Dónde sale | Proporción | Tamaño mínimo |
| --- | --- | --- | --- |
| `hero` | Fondo del inicio, detrás de la etiqueta | 16:9 horizontal | 2400 × 1350 |
| `proceso_1` … `proceso_6` | Inicio, "De la ladera a tu barra" (cosecha, secado, envío en verde, tueste, empaque, en tu barra) | 4:5 vertical | 1000 × 1250 |
| `origen_hero` | Fondo del encabezado de Origen | 16:9 horizontal | 2400 × 1350 |
| `origen_altura` | Origen, "Por qué importa la altura" | 4:5 vertical | 1000 × 1250 |
| `origen_canada` | Origen, "Tostado en Canadá" | 4:5 vertical | 1000 × 1250 |
| `mayoreo` | Página de Mayoreo, arriba de las condiciones | 4:5 vertical | 1000 × 1250 |
| `cafe_venezuela_1` … `_3` | Producto: la 1 en catálogo, inicio y ficha; la 2 y 3 en la galería de la ficha | 4:5 vertical | 1000 × 1250 |
| `cafe_colombia_*`, `cafe_costarica_*`, `cafe_panama_*` | Igual, para cada café | 4:5 vertical | 1000 × 1250 |

Con `npm run dev` corriendo, solo recarga la página para ver una foto nueva.

## Datos: de JSON a base de datos

Todo el acceso a datos pasa por `src/lib/db/repository.ts`, con dos implementaciones:

- `local` — clientes y pedidos en `.data/db.json`. Solo para tu compu.
- `supabase` — Postgres. Es la que va en producción.

Cambiar de una a otra es una variable de entorno (`DATA_BACKEND`); el resto del código no cambia.
El catálogo sigue en JSON; se puede pasar a tablas después reimplementando `src/lib/catalog.ts`.

> **Importante:** el modo `local` no funciona en Vercel (su disco es de solo lectura).
> Para publicar con login y pedidos necesitas Supabase.

## Subir a GitHub y Vercel

1. **GitHub:** crea un repo vacío (privado) y desde esta carpeta:
   ```bash
   git init -b main && git add . && git commit -m "Primer commit"
   git remote add origin https://github.com/<tu-usuario>/dealtura-web.git
   git push -u origin main
   ```
2. **Vercel:** importa el repo (Framework Preset: Next.js). Cada `git push` a `main` publica solo.

## Conectar Supabase (cuentas, solicitudes y pedidos en línea)

1. **Base de datos.** Supabase → **SQL Editor** → New query. Pega y corre, en este orden:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_grants.sql`
2. **Correo de confirmación.** Supabase → **Authentication → URL Configuration**:
   - *Site URL*: la URL del sitio (`https://dealturacoffee.vercel.app` o su dominio).
   - *Redirect URLs*: agrega `https://dealturacoffee.vercel.app/api/auth/callback` y `http://localhost:3000/api/auth/callback`.
   Si prefieren que el cliente entre sin confirmar su correo: **Authentication → Sign In / Providers → Email**, apaga *Confirm email*.
3. **Llaves.** Supabase → **Project Settings → API Keys** (y *Data API* para la URL). En `.env.local`:
   ```
   DATA_BACKEND=supabase
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<llave publishable / anon>
   SUPABASE_SERVICE_ROLE_KEY=<llave secret / service_role>
   ADMIN_EMAILS=tu-correo@ejemplo.com
   AUTH_SECRET=<texto largo aleatorio>
   ```
   La llave secreta da acceso total a la base: no la subas a GitHub ni la mandes por chat.
4. **Revisa:** `npm run check:supabase`. Si todo sale con ✔, corre `npm run dev` y prueba.
5. **Vercel:** Settings → Environment Variables → las mismas seis variables → Redeploy.
6. **Primer admin:** abre una cuenta en `/es/wholesale` con el correo de `ADMIN_EMAILS`, entra a `/es/admin` y apruébate (y a los demás).

## Pagos con Stripe

Sin llave de Stripe, los pedidos con tarjeta quedan "esperando pago" y el admin los puede marcar
como pagados. Para cobrar de verdad:

1. Crea la cuenta en stripe.com (en modo prueba primero).
2. Pon `STRIPE_SECRET_KEY` en Vercel.
3. En Stripe → Developers → Webhooks, agrega `https://<tu-dominio>/api/stripe/webhook`
   con el evento `checkout.session.completed`, y copia el secreto a `STRIPE_WEBHOOK_SECRET`.

## Antes de lanzar

- [ ] Logo final en vector (SVG) → reemplazar `public/brand/`.
- [ ] Fotos reales: la web usa ilustraciones dibujadas en código; faltan fotos de producto y de origen.
- [ ] Confirmar cafés, precios, puntajes y alturas: Colombia, Costa Rica y Panamá son **datos de muestra**.
- [ ] Confirmar con su contador el tratamiento de impuestos (el café en grano está como
      "basic grocery", tasa cero de GST/HST; ver `src/lib/pricing.ts`).
- [ ] Revisar las traducciones al francés con un nativo (Ley 96 en Quebec).
- [ ] Correo de contacto real en `content/settings.json`.
- [ ] Recuperar contraseña: Supabase Auth lo trae; falta la pantalla en la web.
- [ ] Correos de confirmación de pedido (siguiente paso: Resend).

## La app (después)

La app en Expo (React Native) usará el mismo backend:
- Login con Supabase Auth desde la app → manda `Authorization: Bearer <token>` a `/api/v1/*`.
- `GET /api/v1/catalog`, `GET /api/v1/me`, `GET|POST /api/v1/orders`, `GET /api/v1/orders/:id`.
- Los tipos están en `src/lib/types.ts` y la marca en `DESIGN.md`, para reusarlos tal cual.
