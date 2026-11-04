-- DeAltura: cuentas por cobrar. Registra cuándo y cómo se cobró un pedido a crédito (factura).
-- Correr en Supabase → SQL Editor después de 0005_catalog.sql.

alter table orders add column if not exists paid_at timestamptz;
alter table orders add column if not exists paid_note text;

-- Los pedidos con tarjeta ya pagados cuentan como cobrados el día que se pagaron (no entran a "por cobrar")
update orders set paid_at = updated_at
 where paid_at is null and payment_method = 'card' and status not in ('awaiting_payment', 'cancelled');

create index if not exists orders_unpaid_idx on orders (payment_method, paid_at) where paid_at is null;
