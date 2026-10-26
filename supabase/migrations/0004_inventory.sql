-- DeAltura: tostados claro/medio/oscuro, inventario, costos de importación y gastos operativos.
-- Correr en Supabase → SQL Editor después de 0003_admin.sql.

-- Nuevos niveles de tueste (los viejos se quedan para los pedidos anteriores)
alter type roast_profile add value if not exists 'light';
alter type roast_profile add value if not exists 'medium';
alter type roast_profile add value if not exists 'dark';

-- Compras de café verde. Los gastos de la compra (flete, aduana...) van en `costs` (jsonb).
create table if not exists green_lots (
  id uuid primary key,
  code text not null,
  supplier text not null,
  origin text not null default '',
  purchased_at date not null,
  status text not null default 'ordered' check (status in ('ordered', 'in_transit', 'received')),
  quantity numeric(12, 3) not null check (quantity > 0),
  input_unit text not null check (input_unit in ('kg', 'lb')),
  price_per_unit_cents int not null check (price_per_unit_cents >= 0),
  currency text not null check (currency in ('CAD', 'USD')),
  fx_to_cad numeric(10, 5) not null default 1 check (fx_to_cad > 0),
  costs jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);

-- Tuestes: kg verdes que entran de un lote, kg tostados que salen.
-- La columna se llama `roast` pero es text: el enum roast_profile recién alterado no se puede usar en la misma transacción.
create table if not exists roast_batches (
  id uuid primary key,
  lot_id uuid not null references green_lots(id) on delete restrict,
  roasted_at date not null,
  roast text not null check (roast in ('light', 'medium', 'dark')),
  green_kg numeric(12, 3) not null check (green_kg > 0),
  roasted_kg numeric(12, 3) not null check (roasted_kg > 0),
  roaster_rate_cents int not null default 0 check (roaster_rate_cents >= 0),
  roaster_basis text not null default 'green' check (roaster_basis in ('green', 'roasted')),
  packaging_cents int not null default 0 check (packaging_cents >= 0),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists roast_batches_lot_idx on roast_batches(lot_id);

-- Gastos operativos del mes, con etiqueta libre.
create table if not exists expenses (
  id uuid primary key,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  tag text not null,
  description text not null default '',
  amount_cents int not null check (amount_cents >= 0),
  created_at timestamptz not null default now()
);
create index if not exists expenses_month_idx on expenses(month);

-- Solo el servidor (service_role) lee y escribe; nadie más.
alter table green_lots enable row level security;
alter table roast_batches enable row level security;
alter table expenses enable row level security;
grant select, insert, update, delete on green_lots, roast_batches, expenses to service_role;
revoke all on green_lots, roast_batches, expenses from anon, authenticated;
