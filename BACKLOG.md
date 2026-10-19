# DeAltura Coffee — Pendientes

Ideas y decisiones para siguientes sprints. Lo de arriba es lo más urgente.

## Antes de lanzar

- [ ] Datos reales: precios, notas de cata, puntajes, alturas (Colombia, Costa Rica y Panamá son de muestra).
- [ ] Contacto real: correo, teléfono, ciudad/dirección (señal de confianza para compradores B2B).
- [ ] Aviso de privacidad (PIPEDA) y términos de venta, en EN/FR/ES. Borrador por Claude, revisión por abogado.
- [ ] Dominio propio conectado en Vercel.
- [ ] Correos con su marca: Resend como SMTP de Supabase (gratis hasta 3,000/mes) y volver a activar "Confirm email".
- [ ] Francés revisado por alguien nativo (Quebec).
- [ ] Vercel Analytics.

## Ideas del equipo

### 1. Carrito tipo ecommerce con pago en línea
- El carrito y el checkout ya existen; falta cobrar con tarjeta.
- Opciones para Canadá:
  - **Stripe** (recomendado para empezar): ya está integrado en el código, Checkout alojado, Apple/Google Pay, facturas B2B a 30 días con Stripe Invoicing, cobra GST/HST. Sin mensualidad, comisión por transacción.
  - **Helcim**: canadiense, precio "interchange-plus" (suele salir más barato con volumen B2B), también tiene facturación.
  - **Square**: bueno si además venden en persona (ferias, catas), terminal física.
  - **Moneris**: el procesador bancario tradicional en Canadá; más papeleo, contrato.
- Decisión pendiente: ¿cobrar todo con tarjeta, o tarjeta + factura a crédito para clientes aprobados?

### 2. Precios visibles sin cuenta / comprar sin cuenta
- **Hecho:** `publicPrices` activado; los visitantes ven la lista Estándar.
- Comprar sin cuenta (checkout de invitado) cambia el modelo: hoy es solo mayoreo con aprobación.
- Decidir antes de construir:
  - ¿Precio público = precio de mayoreo estándar, o un precio de menudeo más alto?
  - ¿Mínimo de 5 kg también para invitados, o bolsas de 340 g sueltas?
  - ¿Envío e impuestos iguales? (Café en grano es tasa cero, pero accesorios no.)
- Posible enfoque: dos canales en el mismo catálogo — "Tienda" (público, menudeo, tarjeta) y "Mayoreo" (cuenta aprobada, precios por volumen, crédito).

### 3. Estampas / lealtad para clientes con cuenta
- **Decidido:** estampas por kg entregado, no por pedido (pendiente: cuántos kg por estampa y qué premio).
- Mecánica propuesta: cada pedido suma una estampa; la 10ª da una bolsa gratis.
- Ojo B2B: a una cafetería que pide 20 kg por semana, una bolsa gratis le importa poco y premia igual un pedido de 5 kg que uno de 50 kg.
- Alternativas a evaluar:
  - Estampas por kg (ej. cada 50 kg = 1 kg gratis), no por pedido.
  - Niveles por volumen mensual (Estándar → Socio) que ya existen como `priceTier`: subir de nivel automático.
  - Recompensas no monetarias: muestras de microlotes nuevos, invitación a catas, kit de barra.
- Técnico: tabla `loyalty_events` en Supabase + tarjeta de estampas en "Tu cuenta"; se calcula desde los pedidos entregados.

### 4. Chatbot de preguntas básicas
- Viable y barato: un widget que responde solo con información del sitio (FAQ, mínimos, envíos, orígenes, cómo abrir cuenta).
- Con la API de Claude, respuestas en EN/FR/ES; si no sabe, ofrece el correo de contacto.
- Cuidar: que no invente precios ni promesas de entrega; registrar las preguntas para mejorar la FAQ.
- Cotización (precios API oct 2026): con Claude Haiku 5.5 ≈ USD 0.002 por conversación de 5 mensajes → ~USD 2 al mes por 1,000 conversaciones. Con Sonnet 5.5 ≈ USD 0.04 por conversación (~USD 37 / 1,000). Recomendado: Haiku.
- Trabajo: 1 sprint (widget, respuestas con la info del sitio, límite de uso, registro de preguntas).

### 5. Clientes por correo / teléfono (cuentas gestionadas)
- El admin da de alta al cliente (negocio, contacto, correo, dirección) sin que el cliente tenga contraseña.
- El admin hace pedidos a nombre de ese cliente desde el panel; quedan en su historial.
- "Dar acceso": el admin genera una contraseña temporal y se la pasa por WhatsApp/teléfono; el cliente entra y la cambia. Sus pedidos anteriores ya están ahí (misma cuenta, no hay que ligar nada).
- Requiere: formulario de alta en admin, formulario de pedido en admin, cambio de contraseña en "Tu cuenta".
- Seguridad: nunca permitir que alguien "reclame" una cuenta solo con escribir el correo; el acceso lo da el admin (o un correo de verificación cuando haya Resend).

## Ideas tomadas de otros sitios
- Barra superior con el mínimo de pedido y el día de tueste (Alexander Henry Coffee).
- Dirección física y contacto visibles como señal de confianza.
- Video corto en el inicio (tostador o cosecha) cuando lo tengan.

## La app (Expo)
- Catálogo, pedidos, repetir pedido, chat y pagos. Usa la API `/api/v1` que ya existe.
