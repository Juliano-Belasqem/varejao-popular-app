begin;

create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'editor', 'viewer');
create type public.campaign_status as enum ('draft', 'approved', 'archived');
create type public.publication_network as enum ('instagram', 'facebook');
create type public.publication_type as enum ('feed', 'story', 'carousel', 'reel');
create type public.publication_status as enum (
  'draft',
  'scheduled',
  'publishing',
  'published',
  'error',
  'cancelled'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text not null default '',
  role public.app_role not null default 'viewer',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  ean text not null unique,
  name text not null,
  brand text,
  specification text,
  category text,
  unit text,
  active boolean not null default true,
  erp_description text,
  sale_price numeric(12,2),
  stock numeric(14,3),
  code_type text,
  gtin_valid boolean,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null,
  source text not null default 'manual',
  source_url text,
  approved boolean not null default false,
  is_primary boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create unique index product_images_one_primary
  on public.product_images(product_id)
  where is_primary = true;

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  start_date date,
  end_date date,
  theme text not null default 'Padrão',
  format text not null default 'Físico + Digital',
  status public.campaign_status not null default 'draft',
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.campaign_items (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  product_id uuid not null references public.products(id),
  normal_price numeric(12,2),
  offer_price numeric(12,2),
  highlighted_price text not null default 'offer'
    check (highlighted_price in ('offer','normal')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique(campaign_id, product_id)
);

create table public.publications (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete set null,
  network public.publication_network not null,
  type public.publication_type not null,
  scheduled_at timestamptz,
  caption text,
  status public.publication_status not null default 'draft',
  meta_media_id text,
  meta_post_id text,
  error_message text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.publication_media (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications(id) on delete cascade,
  storage_path text not null,
  public_url text,
  media_type text not null check (media_type in ('image','video')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index products_name_idx on public.products using gin (to_tsvector('simple', name));
create index products_brand_idx on public.products(brand);
create index campaign_items_campaign_idx on public.campaign_items(campaign_id);
create index publications_status_schedule_idx on public.publications(status, scheduled_at);
create index audit_logs_created_at_idx on public.audit_logs(created_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
for each row execute function public.touch_updated_at();

create trigger products_touch before update on public.products
for each row execute function public.touch_updated_at();

create trigger campaigns_touch before update on public.campaigns
for each row execute function public.touch_updated_at();

create trigger publications_touch before update on public.publications
for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role, active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'viewer',
    true
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.profiles
  where id = auth.uid() and active = true;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_role() = 'admin', false);
$$;

create or replace function public.can_edit()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_role() in ('admin','editor'), false);
$$;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_items enable row level security;
alter table public.publications enable row level security;
alter table public.publication_media enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles read authenticated"
on public.profiles for select
to authenticated
using (active = true);

create policy "profiles admin update"
on public.profiles for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "products read"
on public.products for select
to authenticated
using (true);

create policy "products edit"
on public.products for all
to authenticated
using (public.can_edit())
with check (public.can_edit());

create policy "product images read"
on public.product_images for select
to authenticated
using (true);

create policy "product images edit"
on public.product_images for all
to authenticated
using (public.can_edit())
with check (public.can_edit());

create policy "campaigns read"
on public.campaigns for select
to authenticated
using (true);

create policy "campaigns edit"
on public.campaigns for all
to authenticated
using (public.can_edit())
with check (public.can_edit());

create policy "campaign items read"
on public.campaign_items for select
to authenticated
using (true);

create policy "campaign items edit"
on public.campaign_items for all
to authenticated
using (public.can_edit())
with check (public.can_edit());

create policy "publications read"
on public.publications for select
to authenticated
using (true);

create policy "publications edit"
on public.publications for all
to authenticated
using (public.can_edit())
with check (public.can_edit());

create policy "publication media read"
on public.publication_media for select
to authenticated
using (true);

create policy "publication media edit"
on public.publication_media for all
to authenticated
using (public.can_edit())
with check (public.can_edit());

create policy "audit logs admin read"
on public.audit_logs for select
to authenticated
using (public.is_admin());

create policy "audit logs insert authenticated"
on public.audit_logs for insert
to authenticated
with check (actor_id = auth.uid());

insert into storage.buckets (id, name, public)
values
  ('product-images', 'product-images', true),
  ('digital-materials', 'digital-materials', true),
  ('social-media', 'social-media', true)
on conflict (id) do nothing;

create policy "storage public reads"
on storage.objects for select
to public
using (
  bucket_id in ('product-images','digital-materials','social-media')
);

create policy "storage editors insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id in ('product-images','digital-materials','social-media')
  and public.can_edit()
);

create policy "storage editors update"
on storage.objects for update
to authenticated
using (
  bucket_id in ('product-images','digital-materials','social-media')
  and public.can_edit()
)
with check (
  bucket_id in ('product-images','digital-materials','social-media')
  and public.can_edit()
);

create policy "storage editors delete"
on storage.objects for delete
to authenticated
using (
  bucket_id in ('product-images','digital-materials','social-media')
  and public.can_edit()
);

commit;
