begin;

create table if not exists public.brand_settings (
  id text primary key default 'default' check (id = 'default'),
  logo_path text,
  primary_color text not null default '#2F42A6',
  accent_color text not null default '#FF8A1F',
  field_fonts jsonb not null default '{"title":"Arial, sans-serif","product":"Arial, sans-serif","brand":"Arial, sans-serif","specification":"Arial, sans-serif","price":"Arial, sans-serif","validity":"Arial, sans-serif","body":"Arial, sans-serif","footer":"Arial, sans-serif"}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.brand_fonts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  family text not null unique,
  storage_path text not null unique,
  mime_type text not null,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists brand_settings_updated_by_idx on public.brand_settings(updated_by);
create index if not exists brand_fonts_created_by_idx on public.brand_fonts(created_by);

insert into public.brand_settings (id) values ('default') on conflict (id) do nothing;

alter table public.brand_settings enable row level security;
alter table public.brand_fonts enable row level security;

revoke all on table public.brand_settings from anon;
revoke all on table public.brand_fonts from anon;
grant select, insert, update, delete on public.brand_settings to authenticated, service_role;
grant select, insert, update, delete on public.brand_fonts to authenticated, service_role;

create policy "brand settings read" on public.brand_settings for select to authenticated using (true);
create policy "brand settings insert" on public.brand_settings for insert to authenticated with check (public.can_edit());
create policy "brand settings update" on public.brand_settings for update to authenticated using (public.can_edit()) with check (public.can_edit());
create policy "brand settings delete" on public.brand_settings for delete to authenticated using (public.can_edit());
create policy "brand fonts read" on public.brand_fonts for select to authenticated using (true);
create policy "brand fonts insert" on public.brand_fonts for insert to authenticated with check (public.can_edit());
create policy "brand fonts update" on public.brand_fonts for update to authenticated using (public.can_edit()) with check (public.can_edit());
create policy "brand fonts delete" on public.brand_fonts for delete to authenticated using (public.can_edit());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand-assets','brand-assets',false,10485760,array['image/png','image/webp','image/svg+xml','font/woff2','font/woff','font/ttf','font/otf','application/font-woff','application/x-font-ttf','application/x-font-opentype'])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy "brand assets read" on storage.objects for select to authenticated using (bucket_id='brand-assets');
create policy "brand assets insert" on storage.objects for insert to authenticated with check (bucket_id='brand-assets' and public.can_edit());
create policy "brand assets update" on storage.objects for update to authenticated using (bucket_id='brand-assets' and public.can_edit()) with check (bucket_id='brand-assets' and public.can_edit());
create policy "brand assets delete" on storage.objects for delete to authenticated using (bucket_id='brand-assets' and public.can_edit());

commit;
