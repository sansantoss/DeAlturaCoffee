-- DeAltura · DATOS DE EJEMPLO DEL MES ACTUAL (Supabase → SQL Editor)
-- Córrelo después de reset_data.sql. Crea, para el mes en curso:
--   • 1 compra de café verde ya recibida (2,200 lb a US$3.80/lb) con flete, seguro, aduana y agente
--   • tuestes semanales (claro, medio y oscuro, ~15 % de merma)
--   • gastos operativos del mes
--   • pedidos de tus clientes aprobados que tengan dirección (hasta 4 clientes; con 1–2 clientes ≈ 180 kg en el mes)
-- Con estos números: costo ≈ CAD 21.5 por kg tostado, venta a CAD 31–34/kg → margen bruto ≈ 33–35 % y utilidad positiva.
-- Solo pone fechas hasta hoy: si lo corres a principio de mes, habrá menos tuestes y pedidos.

do $$
declare
  ms      date := date_trunc('month', (now() at time zone 'America/Toronto'))::date;  -- día 1 del mes
  today   date := (now() at time zone 'America/Toronto')::date;
  mon     text := to_char(ms, 'YYYY-MM');
  lot_id  uuid := gen_random_uuid();
  wk      int;
  d       date;
  c       record;
  n       int := 0;
  o_id    uuid;
  addr    jsonb;
  p1      int; p5 int; pr int;           -- precios por cliente (estándar o socio)
  q1      int; q5 int; qr int;           -- cantidades
  roast1  text; roast5 text;
  sub     int; ship int; kg numeric;
  st      text;
  total_c int;
  per_wk  int;
  k       int;
begin
  -- 1) Compra de café verde (llegó antes de empezar el mes)
  insert into green_lots (id, code, supplier, origin, purchased_at, status, quantity, input_unit,
                          price_per_unit_cents, currency, fx_to_cad, costs, notes)
  values (lot_id, 'VEN-' || to_char(ms, 'YYYY') || '-' || to_char(ms, 'MM'), 'Aprocandes', 'Santa Cruz de Mora, Mérida',
          ms - 20, 'received', 2200, 'lb', 380, 'USD', 1.37,
          jsonb_build_array(
            jsonb_build_object('id', gen_random_uuid(), 'category', 'freight',   'label', 'Contenedor Puerto Cabello → Montreal', 'amountCents', 160000, 'currency', 'USD'),
            jsonb_build_object('id', gen_random_uuid(), 'category', 'insurance', 'label', 'Seguro de carga',                       'amountCents',  12000, 'currency', 'USD'),
            jsonb_build_object('id', gen_random_uuid(), 'category', 'customs',   'label', 'Aranceles e inspección CFIA',          'amountCents',  48000, 'currency', 'CAD'),
            jsonb_build_object('id', gen_random_uuid(), 'category', 'broker',    'label', 'Agente aduanal',                       'amountCents',  30000, 'currency', 'CAD')
          ),
          'Lote 0002 · Finca La Curva · 84 pts SCA (datos de ejemplo)');

  -- 2) Tuestes cada semana: el tostador cobra CAD 2.50 por kg verde; insumos ≈ CAD 1.20 por kg verde
  for wk in 0..3 loop
    d := ms + 1 + wk * 7;
    exit when d > today;
    insert into roast_batches (id, lot_id, roasted_at, roast, green_kg, roasted_kg, roaster_rate_cents, roaster_basis, packaging_cents, notes)
    values
      (gen_random_uuid(), lot_id, d, 'light',  20, 17.0, 250, 'green', 2400, 'Ejemplo'),
      (gen_random_uuid(), lot_id, d, 'medium', 70, 59.5, 250, 'green', 8400, 'Ejemplo'),
      (gen_random_uuid(), lot_id, d, 'dark',   45, 38.2, 250, 'green', 5400, 'Ejemplo');
  end loop;

  -- 3) Gastos operativos del mes
  insert into expenses (id, month, tag, description, amount_cents) values
    (gen_random_uuid(), mon, 'Renta',      'Bodega compartida',         95000),
    (gen_random_uuid(), mon, 'Transporte', 'Paquetería a clientes',     32000),
    (gen_random_uuid(), mon, 'Software',   'Hosting y correo',           4500),
    (gen_random_uuid(), mon, 'Servicios',  'Luz e internet',             9500),
    (gen_random_uuid(), mon, 'Marketing',  'Muestras y degustaciones',  15000);

  -- 4) Pedidos de los clientes aprobados con dirección. Con pocos clientes, cada uno pide más seguido,
  --    para que el mes tenga un volumen creíble (~200 kg) y cierre con utilidad.
  select count(*) into total_c
    from customers cu where cu.status = 'approved' and exists (select 1 from addresses ad where ad.customer_id = cu.id);
  per_wk := greatest(1, ceil(2.0 / greatest(least(total_c, 4), 1)))::int;

  for c in
    select cu.id, cu.price_tier, a.label, a.line1, a.line2, a.city, a.province, a.postal_code
      from customers cu
      join lateral (select * from addresses ad where ad.customer_id = cu.id order by ad.is_default desc limit 1) a on true
     where cu.status = 'approved'
     order by cu.created_at
     limit 4
  loop
    addr := jsonb_build_object('label', c.label, 'line1', c.line1, 'line2', c.line2, 'city', c.city,
                               'province', c.province, 'postalCode', c.postal_code);
    if c.price_tier = 'partner' then p1 := 3100; p5 := 6600; pr := 15600; else p1 := 3400; p5 := 7200; pr := 16800; end if;

    for wk in 0..3 loop
    for k in 1..per_wk loop
      d := ms + 1 + wk * 7 + (n % 2) + (k - 1) * 3;
      exit when d > today;
      q1 := 10 + ((n + wk + k) % 4) * 2;   -- 10 a 16 bolsas de 1 kg
      q5 := 3 + ((n + wk + k) % 3);        -- 3 a 5 bolsas de 5 lb
      qr := case when (n + wk) % 3 = 0 then 1 else 0 end;  -- a veces una caja retail
      roast1 := (array['medium', 'dark', 'medium', 'light'])[1 + (n + wk) % 4];
      roast5 := (array['dark', 'medium', 'dark', 'medium'])[1 + (n + wk) % 4];
      sub := q1 * p1 + q5 * p5 + qr * pr;
      kg  := q1 * 1.0 + q5 * 2.268 + qr * 4.08;
      ship := case when kg >= 20 then 0 else 2500 end;
      st := case when d < today - 6 then 'delivered' when d < today - 2 then 'shipped' when (n + wk) % 2 = 0 then 'paid' else 'invoiced' end;

      o_id := gen_random_uuid();
      insert into orders (id, customer_id, status, payment_method, subtotal_cents, shipping_cents, tax_cents, total_cents,
                          shipping_address, notes, created_at, updated_at)
      values (o_id, c.id, st::order_status, (case when (n + wk) % 2 = 0 then 'card' else 'invoice' end)::payment_method,
              sub, ship, 0, sub + ship, addr, 'Pedido de ejemplo',
              (d + time '10:30') at time zone 'America/Toronto', (d + time '10:30') at time zone 'America/Toronto');

      insert into order_lines (order_id, sku, product_id, product_name, format_label, roast, quantity, unit_price_cents, grams) values
        (o_id, 'VEN-SCM-1KG', 'prd_ven_scm', 'Santa Cruz de Mora', 'Bolsa de 1 kg', roast1::roast_profile, q1, p1, 1000),
        (o_id, 'VEN-SCM-5LB', 'prd_ven_scm', 'Santa Cruz de Mora', 'Bolsa de 5 lb (2.27 kg)', roast5::roast_profile, q5, p5, 2268);
      if qr > 0 then
        insert into order_lines (order_id, sku, product_id, product_name, format_label, roast, quantity, unit_price_cents, grams)
        values (o_id, 'VEN-SCM-340-12', 'prd_ven_scm', 'Santa Cruz de Mora', 'Retail 340 g, caja de 12', 'medium', qr, pr, 4080);
      end if;
    end loop;
    end loop;
    n := n + 1;
  end loop;

  if n = 0 then
    raise notice 'No hay clientes aprobados con dirección: se crearon compra, tuestes y gastos, pero no pedidos. Crea un cliente en /admin/customers/new y vuelve a correr solo la parte 4, o todo el script después de reset_data.sql.';
  else
    raise notice 'Listo: pedidos de ejemplo para % cliente(s).', n;
  end if;
end $$;
