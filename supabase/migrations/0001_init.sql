-- DeAltura Coffee — initial schema
-- Mirrors src/lib/types.ts. Run in the Supabase SQL editor or with `supabase db push`.

create type account_status as enum ('pending', 'approved', 'suspended');
create type price_tier as enum ('standard', 'partner');
create type business_type as enum ('cafe', 'restaurant', 'retail', 'office', 'other');
create type order_status as enum (
  'awaiting_payment', 'paid', 'invoiced', 'roasting', 'shipped', 'delivered', 'cancelled'
);
create type payment_method as enum ('card', 'invoice');
create type roast_profile as enum ('filter', 'espresso', 'omni');

-- One row per business account. id = auth.users.id
create table customers (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  contact_name text not null,
  business_name text not null,
  business_type business_type not null default 'cafe',
  phone text,
  gst_number text,
  preferred_locale text not null default 'en' check (preferred_locale in ('en', 'fr', 'es')),
  status account_status not null default 'pending',
  price_tier price_tier not null default 'standard',
  invoice_terms_days int,
  created_at timestamptz not null default now()
);

create table addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers (id) on delete cascade,
  label text not null,
  line1 text not null,
  line2 text,
  city text not null,
  province char(2) not null,
  postal_code text not null,
  is_default boolean not null default false
);
create index on addresses (customer_id);

create sequence order_number_seq start 1001;

create table orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('DA-' || nextval('order_number_seq')),
  customer_id uuid not null references customers (id),
  status order_status not null,
  payment_method payment_method not null,
  subtotal_cents int not null,
  shipping_cents int not null,
  tax_cents int not null,
  total_cents int not null,
  shipping_address jsonb not null,
  notes text,
  stripe_session_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on orders (customer_id, created_at desc);

create table order_lines (
  id bigint generated always as identity primary key,
  order_id uuid not null references orders (id) on delete cascade,
  sku text not null,
  product_id text not null,
  product_name text not null,
  format_label text not null,
  roast roast_profile not null,
  quantity int not null check (quantity > 0),
  unit_price_cents int not null,
  grams int not null
);
create index on order_lines (order_id);

create table wholesale_applications (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  contact_name text not null,
  business_name text not null,
  business_type business_type not null,
  city text not null,
  province char(2) not null,
  estimated_kg_per_month int not null,
  message text,
  locale text not null,
  created_at timestamptz not null default now()
);

-- Row level security: customers (web or the future app) can READ their own data directly.
-- All writes that involve money go through the server (service role), never from the client.
alter table customers enable row level security;
alter table addresses enable row level security;
alter table orders enable row level security;
alter table order_lines enable row level security;
alter table wholesale_applications enable row level security;

create policy "own customer row" on customers for select using (auth.uid() = id);
create policy "own addresses" on addresses for all
  using (auth.uid() = customer_id) with check (auth.uid() = customer_id);
create policy "own orders" on orders for select using (auth.uid() = customer_id);
create policy "own order lines" on order_lines for select
  using (exists (select 1 from orders o where o.id = order_id and o.customer_id = auth.uid()));
-- wholesale_applications: no client policies; inserted by the server only.
