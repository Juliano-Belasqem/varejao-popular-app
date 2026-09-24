begin;

create table public.product_art_compositions (
  product_id uuid not null references public.products(id) on delete cascade,
  format text not null check (format in ('feed','story')),
  images jsonb not null default '[]'::jsonb check (jsonb_typeof(images)='array'),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (product_id, format)
);

alter table public.product_art_compositions enable row level security;
revoke all on public.product_art_compositions from anon;
grant select, insert, update, delete on public.product_art_compositions to authenticated;
grant all on public.product_art_compositions to service_role;

create policy "product art compositions read" on public.product_art_compositions
for select to authenticated
using (exists(select 1 from public.profiles where id=(select auth.uid()) and active));

create policy "product art compositions edit" on public.product_art_compositions
for all to authenticated
using (public.can_edit())
with check (public.can_edit());

commit;
