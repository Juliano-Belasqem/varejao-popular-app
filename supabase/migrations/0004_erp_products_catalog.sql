create table if not exists public.erp_products (
  code text primary key,
  description text not null,
  sale_price numeric,
  stock numeric,
  unit text,
  code_type text,
  gtin_valid boolean,
  search_image boolean not null default false,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.erp_products enable row level security;

drop policy if exists "erp products read" on public.erp_products;
create policy "erp products read" on public.erp_products for select to authenticated using (true);

drop policy if exists "erp products edit" on public.erp_products;
create policy "erp products edit" on public.erp_products for all to authenticated using (can_edit()) with check (can_edit());

create index if not exists erp_products_description_idx on public.erp_products using gin (to_tsvector('simple', coalesce(description,'')));
create index if not exists erp_products_gtin_valid_idx on public.erp_products (gtin_valid);
