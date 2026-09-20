begin;

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  campaign_id uuid references public.campaigns(id) on delete set null,
  normal_price numeric(12,2) check (normal_price is null or normal_price >= 0),
  offer_price numeric(12,2) not null check (offer_price >= 0),
  unit text,
  starts_on date,
  ends_on date,
  notes text,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_on is null or ends_on is null or starts_on <= ends_on)
);

create index offers_product_idx on public.offers(product_id);
create index offers_campaign_idx on public.offers(campaign_id);
create index offers_active_dates_idx on public.offers(active,starts_on,ends_on);

alter table public.offers enable row level security;
revoke all on public.offers from anon;
grant select,insert,update,delete on public.offers to authenticated;
grant all on public.offers to service_role;

create policy "offers read active users" on public.offers for select to authenticated
  using (exists(select 1 from public.profiles where id=(select auth.uid()) and active));
create policy "offers insert editors" on public.offers for insert to authenticated
  with check (public.can_edit());
create policy "offers update editors" on public.offers for update to authenticated
  using (public.can_edit()) with check (public.can_edit());
create policy "offers delete editors" on public.offers for delete to authenticated
  using (public.can_edit());

alter table public.campaign_items add column offer_id uuid references public.offers(id) on delete set null;
create unique index campaign_items_offer_id_uidx on public.campaign_items(offer_id) where offer_id is not null;

with source as (
  select
    ci.id as campaign_item_id,
    gen_random_uuid() as offer_id,
    ci.product_id,
    ci.campaign_id,
    ci.normal_price,
    coalesce(ci.offer_price,ci.normal_price,0) as offer_price,
    p.unit,
    c.start_date,
    c.end_date,
    c.created_by,
    c.updated_by
  from public.campaign_items ci
  join public.campaigns c on c.id=ci.campaign_id
  join public.products p on p.id=ci.product_id
),
inserted as (
  insert into public.offers(id,product_id,campaign_id,normal_price,offer_price,unit,starts_on,ends_on,created_by,updated_by)
  select offer_id,product_id,campaign_id,normal_price,offer_price,unit,start_date,end_date,created_by,updated_by
  from source
  returning id
)
update public.campaign_items ci
set offer_id=s.offer_id
from source s
join inserted i on i.id=s.offer_id
where ci.id=s.campaign_item_id;

create or replace function public.upsert_campaign_offer(
  p_campaign_id uuid,
  p_product_id uuid,
  p_normal_price numeric,
  p_offer_price numeric,
  p_highlighted_price text,
  p_ean_snapshot text,
  p_name_snapshot text,
  p_brand_snapshot text,
  p_specification_snapshot text,
  p_user_id uuid
) returns uuid
language plpgsql
security invoker
set search_path = public
as $fn$
declare
  v_offer_id uuid;
  v_unit text;
  v_start date;
  v_end date;
begin
  if not public.can_edit() then raise exception 'Sem permissão.'; end if;
  select p.unit into v_unit from public.products p where p.id=p_product_id;
  select c.start_date,c.end_date into v_start,v_end from public.campaigns c where c.id=p_campaign_id;

  select ci.offer_id into v_offer_id
  from public.campaign_items ci
  where ci.campaign_id=p_campaign_id and ci.product_id=p_product_id;

  if v_offer_id is null then
    insert into public.offers(product_id,campaign_id,normal_price,offer_price,unit,starts_on,ends_on,created_by,updated_by)
    values(p_product_id,p_campaign_id,p_normal_price,coalesce(p_offer_price,p_normal_price,0),v_unit,v_start,v_end,p_user_id,p_user_id)
    returning id into v_offer_id;
  else
    update public.offers
    set normal_price=p_normal_price,offer_price=coalesce(p_offer_price,p_normal_price,0),unit=v_unit,
        starts_on=v_start,ends_on=v_end,updated_by=p_user_id,updated_at=now()
    where id=v_offer_id;
  end if;

  insert into public.campaign_items(campaign_id,product_id,normal_price,offer_price,highlighted_price,ean_snapshot,name_snapshot,brand_snapshot,specification_snapshot,offer_id)
  values(p_campaign_id,p_product_id,p_normal_price,p_offer_price,p_highlighted_price,p_ean_snapshot,p_name_snapshot,p_brand_snapshot,p_specification_snapshot,v_offer_id)
  on conflict(campaign_id,product_id) do update set
    normal_price=excluded.normal_price,offer_price=excluded.offer_price,highlighted_price=excluded.highlighted_price,
    ean_snapshot=excluded.ean_snapshot,name_snapshot=excluded.name_snapshot,brand_snapshot=excluded.brand_snapshot,
    specification_snapshot=excluded.specification_snapshot,offer_id=excluded.offer_id;

  return v_offer_id;
end;
$fn$;

revoke all on function public.upsert_campaign_offer(uuid,uuid,numeric,numeric,text,text,text,text,text,uuid) from public, anon;
grant execute on function public.upsert_campaign_offer(uuid,uuid,numeric,numeric,text,text,text,text,text,uuid) to authenticated, service_role;


create or replace function public.create_offer_with_campaign(
  p_product_id uuid, p_campaign_id uuid, p_normal_price numeric, p_offer_price numeric,
  p_unit text, p_starts_on date, p_ends_on date, p_notes text, p_user_id uuid
) returns uuid
language plpgsql security invoker set search_path = public
as $fn$
declare
  v_offer_id uuid;
  v_product public.products%rowtype;
begin
  if not public.can_edit() then raise exception 'Sem permissão.'; end if;
  if p_offer_price is null or p_offer_price < 0 then raise exception 'Preço de oferta inválido.'; end if;
  if p_starts_on is not null and p_ends_on is not null and p_starts_on > p_ends_on then
    raise exception 'Período da oferta inválido.';
  end if;
  select * into v_product from public.products where id=p_product_id;
  if not found then raise exception 'Produto não encontrado.'; end if;

  insert into public.offers(product_id,campaign_id,normal_price,offer_price,unit,starts_on,ends_on,notes,created_by,updated_by)
  values(p_product_id,p_campaign_id,p_normal_price,p_offer_price,coalesce(p_unit,v_product.unit),p_starts_on,p_ends_on,p_notes,p_user_id,p_user_id)
  returning id into v_offer_id;

  if p_campaign_id is not null then
    insert into public.campaign_items(campaign_id,product_id,normal_price,offer_price,highlighted_price,
      ean_snapshot,name_snapshot,brand_snapshot,specification_snapshot,offer_id)
    values(p_campaign_id,p_product_id,p_normal_price,p_offer_price,'offer',
      v_product.ean,v_product.name,v_product.brand,v_product.specification,v_offer_id)
    on conflict(campaign_id,product_id) do update set
      normal_price=excluded.normal_price,offer_price=excluded.offer_price,highlighted_price='offer',
      ean_snapshot=excluded.ean_snapshot,name_snapshot=excluded.name_snapshot,brand_snapshot=excluded.brand_snapshot,
      specification_snapshot=excluded.specification_snapshot,offer_id=excluded.offer_id;
  end if;
  return v_offer_id;
end;
$fn$;

revoke all on function public.create_offer_with_campaign(uuid,uuid,numeric,numeric,text,date,date,text,uuid) from public, anon;
grant execute on function public.create_offer_with_campaign(uuid,uuid,numeric,numeric,text,date,date,text,uuid) to authenticated, service_role;


create or replace function public.update_campaign_offer_item(
  p_item_id uuid, p_campaign_id uuid, p_normal_price numeric, p_offer_price numeric,
  p_highlighted_price text, p_sort_order integer, p_user_id uuid
) returns void
language plpgsql security invoker set search_path = public
as $fn$
declare v_offer_id uuid;
begin
  if not public.can_edit() then raise exception 'Sem permissão.'; end if;
  update public.campaign_items
  set normal_price=p_normal_price, offer_price=p_offer_price,
      highlighted_price=p_highlighted_price, sort_order=p_sort_order
  where id=p_item_id and campaign_id=p_campaign_id
  returning offer_id into v_offer_id;
  if not found then raise exception 'Item de campanha não encontrado.'; end if;
  if v_offer_id is not null then
    update public.offers set normal_price=p_normal_price,
      offer_price=coalesce(p_offer_price,p_normal_price,0),
      updated_by=p_user_id,updated_at=now()
    where id=v_offer_id;
  end if;
end;
$fn$;

create or replace function public.remove_campaign_offer_item(
  p_item_id uuid, p_campaign_id uuid, p_user_id uuid
) returns void
language plpgsql security invoker set search_path = public
as $fn$
declare v_offer_id uuid;
begin
  if not public.can_edit() then raise exception 'Sem permissão.'; end if;
  delete from public.campaign_items
  where id=p_item_id and campaign_id=p_campaign_id
  returning offer_id into v_offer_id;
  if not found then raise exception 'Item de campanha não encontrado.'; end if;
  if v_offer_id is not null then
    update public.offers set active=false,campaign_id=null,updated_by=p_user_id,updated_at=now()
    where id=v_offer_id;
  end if;
end;
$fn$;

revoke all on function public.update_campaign_offer_item(uuid,uuid,numeric,numeric,text,integer,uuid) from public, anon;
grant execute on function public.update_campaign_offer_item(uuid,uuid,numeric,numeric,text,integer,uuid) to authenticated, service_role;
revoke all on function public.remove_campaign_offer_item(uuid,uuid,uuid) from public, anon;
grant execute on function public.remove_campaign_offer_item(uuid,uuid,uuid) to authenticated, service_role;


create table public.visual_templates (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  name text not null,
  category text not null default 'custom',
  width numeric not null check (width > 0),
  height numeric not null check (height > 0),
  unit text not null default 'px' check (unit in ('px','mm')),
  active boolean not null default true,
  current_version integer not null default 1 check (current_version > 0),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.visual_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.visual_templates(id) on delete cascade,
  version integer not null check (version > 0),
  document jsonb not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(template_id,version)
);

create index visual_templates_category_idx on public.visual_templates(category,active);
create index visual_template_versions_template_idx on public.visual_template_versions(template_id,version desc);

alter table public.visual_templates enable row level security;
alter table public.visual_template_versions enable row level security;
revoke all on public.visual_templates, public.visual_template_versions from anon;
grant select,insert,update,delete on public.visual_templates, public.visual_template_versions to authenticated;
grant all on public.visual_templates, public.visual_template_versions to service_role;

create policy "visual templates read active users" on public.visual_templates for select to authenticated
  using (exists(select 1 from public.profiles where id=(select auth.uid()) and active));
create policy "visual templates edit" on public.visual_templates for all to authenticated
  using (public.can_edit()) with check (public.can_edit());
create policy "visual versions read active users" on public.visual_template_versions for select to authenticated
  using (exists(select 1 from public.profiles where id=(select auth.uid()) and active));
create policy "visual versions insert editors" on public.visual_template_versions for insert to authenticated
  with check (public.can_edit());

commit;
