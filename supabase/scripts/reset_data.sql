-- DeAltura · VACIAR DATOS (Supabase → SQL Editor)
-- Borra pedidos, inventario (compras y tuestes), gastos, precios editados y solicitudes.
-- NO borra cuentas: los clientes y el admin siguen pudiendo entrar.
-- No se puede deshacer. Si quieres respaldo: Table Editor → cada tabla → Export → CSV.

-- Si alguna tabla todavía no existe (falta una migración), se la salta en lugar de fallar.
do $$
declare t text;
begin
  foreach t in array array['order_lines', 'orders', 'roast_batches', 'green_lots', 'expenses', 'product_prices', 'wholesale_applications'] loop
    if to_regclass('public.' || t) is not null then
      execute format('delete from public.%I', t);
    else
      raise notice 'La tabla % no existe todavía: corre las migraciones que falten (0003_admin.sql, 0004_inventory.sql).', t;
    end if;
  end loop;
  if to_regclass('public.order_number_seq') is not null then
    alter sequence order_number_seq restart with 1001;  -- el próximo pedido vuelve a ser DA-1001
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- OPCIONAL: borrar también los CLIENTES de prueba (deja solo tu cuenta de admin).
-- Quita los "--" de las 3 líneas de abajo y cambia el correo por el de ADMIN_EMAILS.
-- Borra sus usuarios de Supabase Auth, así que ya no podrán entrar.
--
-- delete from auth.users
--  where id in (select id from customers where lower(email) <> lower('TU-CORREO-DE-ADMIN@ejemplo.com'));
-- (customers y addresses se borran solos por el "on delete cascade")
-- ─────────────────────────────────────────────────────────────────────────────
