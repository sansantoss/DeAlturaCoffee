-- DeAltura Coffee — panel de admin
-- 1) Precios editables desde el admin (sobrescriben los de content/products.json)
-- 2) Cuentas gestionadas: clientes que el equipo da de alta y que aún no tienen acceso
-- Se puede correr más de una vez.

create table if not exists product_prices (
  sku text not null,
  tier price_tier not null,
  price_cents int not null check (price_cents > 0),
  updated_at timestamptz not null default now(),
  primary key (sku, tier)
);
alter table product_prices enable row level security;

alter table customers add column if not exists has_login boolean not null default true;

grant select, insert, update, delete on product_prices to service_role;
