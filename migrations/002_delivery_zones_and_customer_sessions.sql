create table if not exists public.delivery_zones (
  id bigserial primary key,
  city text,
  township text,
  aliases text[] default '{}',
  cod_available boolean default false,
  delivery_fee numeric default 0,
  payment_method text default 'needs_review',
  estimated_days text,
  note text,
  created_at timestamptz default now()
);

create index if not exists delivery_zones_city_idx on public.delivery_zones (city);
create index if not exists delivery_zones_township_idx on public.delivery_zones (township);

create table if not exists public.customer_sessions (
  id bigserial primary key,
  telegram_user_id bigint unique not null,
  last_product text,
  last_city text,
  customer_name text,
  phone text,
  address text,
  interests text[],
  current_intent text,
  draft_order jsonb,
  updated_at timestamptz default now()
);

alter table public.products
add column if not exists image_url text;

alter table public.orders
add column if not exists customer_name text;

alter table public.orders
add column if not exists city text;
