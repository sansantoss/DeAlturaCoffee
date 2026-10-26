-- DeAltura · DATOS DE EJEMPLO DE TODO EL AÑO (enero → hoy) — Supabase → SQL Editor
-- Requiere las migraciones 0001 a 0005. Córrelo después de reset_data.sql.
--
-- Crea, del 1 de enero a hoy:
--   • 3 compras de café verde (enero, mayo, septiembre) con flete, seguro, aduana y agente
--   • un tueste por semana (claro / medio / oscuro, ~15 % de merma), creciendo de ~40 a ~130 kg verdes
--   • pedidos semanales de tus clientes aprobados con dirección (hasta 6), que siguen a lo tostado
--   • gastos con fecha: renta CAD 150, transporte (4 envíos al mes), software, servicios, marketing e insumos
-- Resultado aproximado: costo ≈ CAD 21–22 por kg tostado, venta CAD 31–34/kg, margen bruto ≈ 35 %, utilidad positiva.
-- Todo queda ligado al café "prd_ven_scm" (Finca La Curva).

do $$
declare
  tz      text := 'America/Toronto';
  today   date := (now() at time zone 'America/Toronto')::date;
  y       int  := extract(year from (now() at time zone 'America/Toronto'))::int;
  pid     text := 'prd_ven_scm';
  lot1    uuid := gen_random_uuid();
  lot2    uuid := gen_random_uuid();
  lot3    uuid := gen_random_uuid();
  lot_id  uuid;
  i       int := 0;
  d       date;
  g       numeric;
  cust    record;
  custs   uuid[];
  tiers   text[];
  addrs   jsonb[];
  n       int;
  c       int;
  share   numeric;
  q1      int; q5 int;
  p1      int; p5 int;
  r1      text; r5 text;
  sub     int; ship int; kg numeric;
  st      text;
  o_id    uuid;
  m       int;
  mon     text;
  last_d  int;
  day     int;
begin
  if not exists (select 1 from products where id = pid) then
    raise exception 'No existe el café % en la tabla products: corre 0005_catalog.sql primero.', pid;
  end if;

  -- 1) Compras de café verde
  insert into green_lots (id, product_id, code, supplier, origin, purchased_at, status, quantity, input_unit,
                          price_per_unit_cents, currency, fx_to_cad, costs, notes) values
  (lot1, pid, 'VEN-' || y || '-01', 'Aprocandes', 'Santa Cruz de Mora, Mérida', make_date(y, 1, 10), 'received', 3000, 'lb', 380, 'USD', 1.36,
   jsonb_build_array(
     jsonb_build_object('id', gen_random_uuid(), 'category', 'freight',   'label', 'Contenedor Puerto Cabello → Montreal', 'amountCents', 220000, 'currency', 'USD'),
     jsonb_build_object('id', gen_random_uuid(), 'category', 'insurance', 'label', 'Seguro de carga', 'amountCents', 16000, 'currency', 'USD'),
     jsonb_build_object('id', gen_random_uuid(), 'category', 'customs',   'label', 'Aranceles e inspección CFIA', 'amountCents', 60000, 'currency', 'CAD'),
     jsonb_build_object('id', gen_random_uuid(), 'category', 'broker',    'label', 'Agente aduanal', 'amountCents', 32000, 'currency', 'CAD')),
   'Lote 0002 · Finca La Curva (ejemplo)'),
  (lot2, pid, 'VEN-' || y || '-02', 'Aprocandes', 'Santa Cruz de Mora, Mérida', make_date(y, 5, 15), 'received', 4200, 'lb', 390, 'USD', 1.37,
   jsonb_build_array(
     jsonb_build_object('id', gen_random_uuid(), 'category', 'freight',   'label', 'Contenedor Puerto Cabello → Montreal', 'amountCents', 280000, 'currency', 'USD'),
     jsonb_build_object('id', gen_random_uuid(), 'category', 'insurance', 'label', 'Seguro de carga', 'amountCents', 20000, 'currency', 'USD'),
     jsonb_build_object('id', gen_random_uuid(), 'category', 'customs',   'label', 'Aranceles e inspección CFIA', 'amountCents', 78000, 'currency', 'CAD'),
     jsonb_build_object('id', gen_random_uuid(), 'category', 'broker',    'label', 'Agente aduanal', 'amountCents', 32000, 'currency', 'CAD')),
   'Segunda compra del año (ejemplo)'),
  (lot3, pid, 'VEN-' || y || '-03', 'Aprocandes', 'Santa Cruz de Mora, Mérida', make_date(y, 9, 20), 'received', 2400, 'lb', 395, 'USD', 1.38,
   jsonb_build_array(
     jsonb_build_object('id', gen_random_uuid(), 'category', 'freight',   'label', 'Contenedor Puerto Cabello → Montreal', 'amountCents', 170000, 'currency', 'USD'),
     jsonb_build_object('id', gen_random_uuid(), 'category', 'insurance', 'label', 'Seguro de carga', 'amountCents', 13000, 'currency', 'USD'),
     jsonb_build_object('id', gen_random_uuid(), 'category', 'customs',   'label', 'Aranceles e inspección CFIA', 'amountCents', 52000, 'currency', 'CAD'),
     jsonb_build_object('id', gen_random_uuid(), 'category', 'broker',    'label', 'Agente aduanal', 'amountCents', 32000, 'currency', 'CAD')),
   'Tercera compra del año (ejemplo)');

  -- 2) Clientes que reciben pedidos (aprobados con dirección)
  for cust in
    select cu.id, cu.price_tier,
           jsonb_build_object('label', a.label, 'line1', a.line1, 'line2', a.line2, 'city', a.city, 'province', a.province, 'postalCode', a.postal_code) as addr
      from customers cu
      join lateral (select * from addresses ad where ad.customer_id = cu.id order by ad.is_default desc limit 1) a on true
     where cu.status = 'approved'
     order by cu.created_at
     limit 6
  loop
    custs := array_append(custs, cust.id);
    tiers := array_append(tiers, cust.price_tier::text);
    addrs := array_append(addrs, cust.addr);
  end loop;
  n := coalesce(array_length(custs, 1), 0);

  -- 3) Cada semana: tueste el lunes y pedidos durante la semana
  d := make_date(y, 1, 19);
  while d <= today loop
    g := round(40 + i * 2.2, 1);  -- kg verdes de la semana
    lot_id := case when d < make_date(y, 6, 1) then lot1 when d < make_date(y, 10, 1) then lot2 else lot3 end;
    insert into roast_batches (id, lot_id, roasted_at, roast, green_kg, roasted_kg, roaster_rate_cents, roaster_basis, packaging_cents, notes) values
      (gen_random_uuid(), lot_id, d, 'light',  round(g * 0.20, 1), round(g * 0.20 * 0.85, 1), 250, 'green', round(g * 0.20 * 120)::int, 'Ejemplo'),
      (gen_random_uuid(), lot_id, d, 'medium', round(g * 0.45, 1), round(g * 0.45 * 0.85, 1), 250, 'green', round(g * 0.45 * 120)::int, 'Ejemplo'),
      (gen_random_uuid(), lot_id, d, 'dark',   round(g * 0.35, 1), round(g * 0.35 * 0.85, 1), 250, 'green', round(g * 0.35 * 120)::int, 'Ejemplo');

    if n > 0 then
      share := g * 0.85 * 0.9 / n;  -- se vende ~90 % de lo tostado, repartido entre los clientes
      for c in 1..n loop
        exit when d + 1 + (c % 4) > today;
        q5 := floor(share * 0.35 / 2.268);
        q1 := greatest(3, round(share - q5 * 2.268));
        if tiers[c] = 'partner' then p1 := 3100; p5 := 6600; else p1 := 3400; p5 := 7200; end if;
        r1 := (array['medium', 'dark', 'medium', 'light', 'dark'])[1 + (i + c) % 5];
        r5 := (array['dark', 'medium', 'dark', 'medium', 'light'])[1 + (i * 3 + c) % 5];
        sub := q1 * p1 + q5 * p5;
        kg := q1 + q5 * 2.268;
        ship := case when kg >= 20 then 0 else 2500 end;
        st := case when d + 1 + (c % 4) < today - 6 then 'delivered'
                   when d + 1 + (c % 4) < today - 2 then 'shipped'
                   when (i + c) % 2 = 0 then 'paid' else 'invoiced' end;
        o_id := gen_random_uuid();
        insert into orders (id, customer_id, status, payment_method, subtotal_cents, shipping_cents, tax_cents, total_cents,
                            shipping_address, notes, created_at, updated_at)
        values (o_id, custs[c], st::order_status, (case when (i + c) % 3 = 0 then 'card' else 'invoice' end)::payment_method,
                sub, ship, 0, sub + ship, addrs[c], null,
                ((d + 1 + (c % 4)) + time '10:15') at time zone tz, ((d + 1 + (c % 4)) + time '10:15') at time zone tz);
        insert into order_lines (order_id, sku, product_id, product_name, format_label, roast, quantity, unit_price_cents, grams) values
          (o_id, 'VEN-SCM-1KG', pid, 'Finca La Curva', 'Bolsa de 1 kg', r1::roast_profile, q1, p1, 1000);
        if q5 > 0 then
          insert into order_lines (order_id, sku, product_id, product_name, format_label, roast, quantity, unit_price_cents, grams) values
            (o_id, 'VEN-SCM-5LB', pid, 'Finca La Curva', 'Bolsa de 5 lb (2.27 kg)', r5::roast_profile, q5, p5, 2268);
        end if;
      end loop;
    end if;

    d := d + 7;
    i := i + 1;
  end loop;

  -- 4) Gastos con fecha, cada mes hasta hoy
  for m in 1..extract(month from today)::int loop
    mon := y || '-' || lpad(m::text, 2, '0');
    last_d := case when m = extract(month from today)::int then extract(day from today)::int
                   else extract(day from (make_date(y, m, 1) + interval '1 month - 1 day'))::int end;
    insert into expenses (id, month, spent_on, tag, description, amount_cents) values
      (gen_random_uuid(), mon, make_date(y, m, 1), 'Renta', 'Espacio en bodega compartida', 15000);
    if last_d >= 3 then
      insert into expenses (id, month, spent_on, tag, description, amount_cents) values (gen_random_uuid(), mon, make_date(y, m, 3), 'Software', 'Hosting y correo', 4500);
    end if;
    foreach day in array array[6, 13, 20, 27] loop
      if day <= last_d then
        insert into expenses (id, month, spent_on, tag, description, amount_cents) values
          (gen_random_uuid(), mon, make_date(y, m, day), 'Transporte',
           (array['Canpar · envíos Ontario', 'Purolator · Montréal', 'UPS · Vancouver', 'Mensajería local Toronto'])[1 + (m + day) % 4],
           4500 + ((m * 37 + day * 13) % 95) * 100);
      end if;
    end loop;
    if last_d >= 10 then
      insert into expenses (id, month, spent_on, tag, description, amount_cents) values (gen_random_uuid(), mon, make_date(y, m, 10), 'Servicios', 'Teléfono e internet', 6500 + (m % 3) * 500);
    end if;
    if m % 2 = 1 and last_d >= 15 then
      insert into expenses (id, month, spent_on, tag, description, amount_cents) values
        (gen_random_uuid(), mon, make_date(y, m, 15), 'Marketing', (array['Muestras para cafeterías', 'Degustación en tienda', 'Anuncios Instagram'])[1 + m % 3], 8000 + (m % 4) * 3500);
    end if;
    if m % 3 = 2 and last_d >= 18 then
      insert into expenses (id, month, spent_on, tag, description, amount_cents) values (gen_random_uuid(), mon, make_date(y, m, 18), 'Insumos', 'Etiquetas y válvulas extra', 6000 + (m % 2) * 3000);
    end if;
  end loop;

  if n = 0 then
    raise notice 'Sin clientes aprobados con dirección: se crearon compras, tuestes y gastos, pero no pedidos. Crea un cliente en /admin/customers/new y vuelve a correr reset_data.sql + este script.';
  else
    raise notice 'Listo: % semanas de tueste y pedidos para % cliente(s).', i, n;
  end if;
end $$;
