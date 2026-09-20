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

with inserted as (
  insert into public.offers(product_id,campaign_id,normal_price,offer_price,unit,starts_on,ends_on,created_by,updated_by)
  select ci.product_id,ci.campaign_id,ci.normal_price,coalesce(ci.offer_price,ci.normal_price,0),p.unit,c.start_date,c.end_date,c.created_by,c.updated_by
  from public.campaign_items ci
  join public.campaigns c on c.id=ci.campaign_id
  join public.products p on p.id=ci.product_id
  returning id,product_id,campaign_id,normal_price,offer_price
)
update public.campaign_items ci
set offer_id=i.id
from inserted i
where ci.product_id=i.product_id
  and ci.campaign_id=i.campaign_id
  and ci.offer_id is null
  and ci.normal_price is not distinct from i.normal_price
  and coalesce(ci.offer_price,ci.normal_price,0)=i.offer_price;

commit;
