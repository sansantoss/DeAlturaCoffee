-- DeAltura · DEMO DE LA SEMANA 25–31 DE OCTUBRE 2026 (Supabase → SQL Editor)
-- Requiere las migraciones 0001 a 0005. Se puede correr sobre lo que ya tengas (no borra nada tuyo)
-- y se puede repetir: primero quita lo que haya creado antes este mismo script.
--
-- Crea:
--   • 1 compra de café verde (recibida el 20 oct) con flete, aduana y agente
--   • 2 tuestes: lunes 26 (claro, medio, oscuro) y jueves 29 (medio, oscuro)
--   • ~2 pedidos por cliente aprobado con dirección (hasta 5 clientes), con estados realistas:
--       25–27 entregados · 28–29 enviados · 30 en tueste / pagado · 31 esperando pago / facturado
--   • gastos con fecha de esa semana (transporte, insumos, marketing, servicios)

do $$
declare
  pid    text := 'prd_ven_scm';
  tz     text := 'America/Toronto';
  lot_id uuid := gen_random_uuid();
  c      record;
  n      int := 0;
  o_id   uuid;
  d      date;
  k      int;
  q1     int; q5 int; qr int;
  p1     int; p5 int; pr int;
  r1     text; r5 text;
  sub    int; ship int; kg numeric;
  st     text;
  pay    text;
begin
  if not exists (select 1 from products where id = pid) then
    raise exception 'No existe el café % en products: corre 0005_catalog.sql primero.', pid;
  end if;

  -- 0) Quitar lo que haya creado antes este script (marcado como demo)
  delete from order_lines where order_id in (select id from orders where notes = 'Demo semana 25–31 oct');
  delete from orders where notes = 'Demo semana 25–31 oct';
  delete from roast_batches where notes = 'Demo semana 25–31 oct';
  delete from green_lots where notes = 'Demo semana 25–31 oct';
  delete from expenses where description like '% · demo';

  -- 1) Compra de café verde: 1,500 lb a US$3.90/lb
  insert into green_lots (id, product_id, code, supplier, origin, purchased_at, status, quantity, input_unit,
                          price_per_unit_cents, currency, fx_to_cad, costs, notes)
  values (lot_id, pid, 'VEN-2026-OCT', 'Aprocandes', 'Santa Cruz de Mora, Mérida', date '2026-10-20', 'received', 1500, 'lb', 390, 'USD', 1.38,
          jsonb_build_array(
            jsonb_build_object('id', gen_random_uuid(), 'category', 'freight', 'label', 'Contenedor Puerto Cabello → Montreal', 'amountCents', 110000, 'currency', 'USD'),
            jsonb_build_object('id', gen_random_uuid(), 'category', 'customs', 'label', 'Aranceles e inspección CFIA', 'amountCents', 36000, 'currency', 'CAD'),
            jsonb_build_object('id', gen_random_uuid(), 'category', 'broker',  'label', 'Agente aduanal', 'amountCents', 28000, 'currency', 'CAD')),
          'Demo semana 25–31 oct');

  -- 2) Tuestes (tostador: CAD 2.50 por kg verde · insumos ≈ CAD 1.20 por kg verde)
  insert into roast_batches (id, lot_id, roasted_at, roast, green_kg, roasted_kg, roaster_rate_cents, roaster_basis, packaging_cents, notes) values
    (gen_random_uuid(), lot_id, date '2026-10-26', 'light',  30, 25.5, 250, 'green', 3600, 'Demo semana 25–31 oct'),
    (gen_random_uuid(), lot_id, date '2026-10-26', 'medium', 40, 34.0, 250, 'green', 4800, 'Demo semana 25–31 oct'),
    (gen_random_uuid(), lot_id, date '2026-10-26', 'dark',   30, 25.5, 250, 'green', 3600, 'Demo semana 25–31 oct'),
    (gen_random_uuid(), lot_id, date '2026-10-29', 'medium', 25, 21.3, 250, 'green', 3000, 'Demo semana 25–31 oct'),
    (gen_random_uuid(), lot_id, date '2026-10-29', 'dark',   20, 17.0, 250, 'green', 2400, 'Demo semana 25–31 oct');

  -- 3) Pedidos: 2 por cliente, repartidos en la semana
  for c in
    select cu.id, cu.price_tier,
           jsonb_build_object('label', a.label, 'line1', a.line1, 'line2', a.line2, 'city', a.city, 'province', a.province, 'postalCode', a.postal_code) as addr
      from customers cu
      join lateral (select * from addresses ad where ad.customer_id = cu.id order by ad.is_default desc limit 1) a on true
     where cu.status = 'approved'
     order by cu.created_at
     limit 5
  loop
    if c.price_tier = 'partner' then p1 := 3100; p5 := 6600; pr := 15600; else p1 := 3400; p5 := 7200; pr := 16800; end if;
    for k in 0..1 loop
      d := date '2026-10-25' + ((n * 2 + k * 4) % 7);      -- un día distinto de la semana para cada pedido
      q1 := 6 + ((n + k) % 4) * 2;                      -- 6 a 12 bolsas de 1 kg
      q5 := 1 + ((n * 2 + k) % 3);                      -- 1 a 3 bolsas de 5 lb
      qr := case when (n + k) % 4 = 0 then 1 else 0 end; -- a veces una caja retail
      r1 := (array['medium', 'dark', 'medium', 'light', 'dark'])[1 + (n + k) % 5];
      r5 := (array['dark', 'medium', 'dark', 'medium', 'light'])[1 + (n + k * 2) % 5];
      sub := q1 * p1 + q5 * p5 + qr * pr;
      kg := q1 + q5 * 2.268 + qr * 4.08;
      ship := case when kg >= 20 then 0 else 2500 end;
      pay := case when (n + k) % 2 = 0 then 'invoice' else 'card' end;
      st := case
              when d <= date '2026-10-27' then 'delivered'
              when d <= date '2026-10-29' then 'shipped'
              when d = date '2026-10-30' then (case when pay = 'card' then 'paid' else 'roasting' end)
              else (case when pay = 'card' then 'awaiting_payment' else 'invoiced' end)
            end;
      o_id := gen_random_uuid();
      insert into orders (id, customer_id, status, payment_method, subtotal_cents, shipping_cents, tax_cents, total_cents,
                          shipping_address, notes, created_at, updated_at)
      values (o_id, c.id, st::order_status, pay::payment_method, sub, ship, 0, sub + ship, c.addr, 'Demo semana 25–31 oct',
              (d + time '09:40' + (n * interval '47 minutes')) at time zone tz, (d + time '09:40' + (n * interval '47 minutes')) at time zone tz);
      insert into order_lines (order_id, sku, product_id, product_name, format_label, roast, quantity, unit_price_cents, grams) values
        (o_id, 'VEN-SCM-1KG', pid, 'Finca La Curva', 'Bolsa de 1 kg', r1::roast_profile, q1, p1, 1000),
        (o_id, 'VEN-SCM-5LB', pid, 'Finca La Curva', 'Bolsa de 5 lb (2.27 kg)', r5::roast_profile, q5, p5, 2268);
      if qr > 0 then
        insert into order_lines (order_id, sku, product_id, product_name, format_label, roast, quantity, unit_price_cents, grams)
        values (o_id, 'VEN-SCM-340-12', pid, 'Finca La Curva', 'Retail 340 g, caja de 12', 'medium', qr, pr, 4080);
      end if;
    end loop;
    n := n + 1;
  end loop;

  -- 4) Gastos de la semana (el " · demo" del final permite quitarlos al repetir el script)
  insert into expenses (id, month, spent_on, tag, description, amount_cents) values
    (gen_random_uuid(), '2026-10', date '2026-10-26', 'Insumos',    'Bolsas y etiquetas para el tueste · demo',     14000),
    (gen_random_uuid(), '2026-10', date '2026-10-27', 'Transporte', 'Canpar · envíos Ontario · demo',               5800),
    (gen_random_uuid(), '2026-10', date '2026-10-28', 'Marketing',  'Muestras para 3 cafeterías nuevas · demo',     9000),
    (gen_random_uuid(), '2026-10', date '2026-10-29', 'Transporte', 'Purolator · Montréal · demo',                  6400),
    (gen_random_uuid(), '2026-10', date '2026-10-30', 'Transporte', 'Mensajería local Toronto · demo',              3500),
    (gen_random_uuid(), '2026-10', date '2026-10-31', 'Servicios',  'Teléfono e internet · demo',                   6500);

  if n = 0 then
    raise notice 'Sin clientes aprobados con dirección: se crearon compra, tuestes y gastos, pero no pedidos. Crea uno en /admin/customers/new y vuelve a correr este script.';
  else
    raise notice 'Listo: % pedidos de % cliente(s) del 25 al 31 de octubre.', n * 2, n;
  end if;
end $$;
