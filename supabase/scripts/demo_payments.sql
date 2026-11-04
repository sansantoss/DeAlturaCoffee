-- DeAltura · DEMO DE COBROS (Supabase → SQL Editor). Requiere 0006_receivables.sql.
-- Marca como cobradas las facturas de más de 30 días (≈ 7 de cada 8), cobradas a los 15–34 días,
-- para que "Por cobrar" se vea realista: casi todo cobrado, algunas vencidas y las recientes abiertas.
-- Se puede repetir: solo toca facturas sin fecha de cobro.
update orders
   set paid_at = least(now(), created_at + ((15 + abs(hashtext(id::text)) % 20) * interval '1 day')),
       paid_note = (array['Interac e-Transfer', 'Transferencia bancaria', 'Cheque'])[1 + abs(hashtext(id::text)) % 3],
       updated_at = now()
 where payment_method = 'invoice'
   and paid_at is null
   and status <> 'cancelled'
   and created_at < now() - interval '30 days'
   and abs(hashtext(id::text)) % 8 <> 0;

-- Los pagos con tarjeta se cobran al momento (Stripe).
update orders set paid_at = created_at, paid_note = 'Stripe'
 where payment_method = 'card' and paid_at is null and status not in ('awaiting_payment', 'cancelled');
