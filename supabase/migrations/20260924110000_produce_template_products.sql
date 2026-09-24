begin;

create table public.produce_template_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  specification text not null default '',
  unit text not null default 'KG',
  code text not null unique,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index produce_template_products_name_idx
  on public.produce_template_products (name);

create trigger produce_template_products_touch
before update on public.produce_template_products
for each row execute function public.touch_updated_at();

alter table public.produce_template_products enable row level security;

create policy "produce template products read"
on public.produce_template_products for select
to authenticated
using (true);

create policy "produce template products edit"
on public.produce_template_products for all
to authenticated
using (public.can_edit())
with check (public.can_edit());

commit;
