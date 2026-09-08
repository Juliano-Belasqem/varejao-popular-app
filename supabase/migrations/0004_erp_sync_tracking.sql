alter table public.erp_products
  add column if not exists last_seen_at timestamptz not null default now();

create index if not exists erp_products_last_seen_idx
  on public.erp_products(last_seen_at);
