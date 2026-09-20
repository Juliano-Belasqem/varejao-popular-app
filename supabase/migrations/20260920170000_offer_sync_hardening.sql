begin;

create or replace function public.create_offer_with_campaign(
  p_product_id uuid, p_campaign_id uuid, p_normal_price numeric, p_offer_price numeric,
  p_unit text, p_starts_on date, p_ends_on date, p_notes text, p_user_id uuid
) returns uuid
language plpgsql security invoker set search_path = public
as $fn$
declare
  v_offer_id uuid;
  v_product public.products%rowtype;
  v_start date := p_starts_on;
  v_end date := p_ends_on;
begin
  if not public.can_edit() then raise exception 'Sem permissão.'; end if;
  if p_offer_price is null or p_offer_price < 0 then raise exception 'Preço de oferta inválido.'; end if;
  select * into v_product from public.products where id=p_product_id;
  if not found then raise exception 'Produto não encontrado.'; end if;

  if p_campaign_id is not null then
    select start_date,end_date into v_start,v_end from public.campaigns where id=p_campaign_id;
    if not found then raise exception 'Campanha não encontrada.'; end if;
    select offer_id into v_offer_id from public.campaign_items
      where campaign_id=p_campaign_id and product_id=p_product_id for update;
  end if;
  if v_start is not null and v_end is not null and v_start>v_end then raise exception 'Período da oferta inválido.'; end if;

  if v_offer_id is null then
    insert into public.offers(product_id,campaign_id,normal_price,offer_price,unit,starts_on,ends_on,notes,created_by,updated_by)
    values(p_product_id,p_campaign_id,p_normal_price,p_offer_price,coalesce(p_unit,v_product.unit),v_start,v_end,p_notes,p_user_id,p_user_id)
    returning id into v_offer_id;
  else
    update public.offers set campaign_id=p_campaign_id,normal_price=p_normal_price,offer_price=p_offer_price,
      unit=coalesce(p_unit,v_product.unit),starts_on=v_start,ends_on=v_end,notes=p_notes,active=true,
      updated_by=p_user_id,updated_at=now() where id=v_offer_id;
  end if;

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

create or replace function public.sync_campaign_offer_dates(p_campaign_id uuid,p_user_id uuid) returns void
language plpgsql security invoker set search_path=public
as $fn$
declare v_start date; v_end date;
begin
  if not public.can_edit() then raise exception 'Sem permissão.'; end if;
  select start_date,end_date into v_start,v_end from public.campaigns where id=p_campaign_id;
  if not found then raise exception 'Campanha não encontrada.'; end if;
  update public.offers set starts_on=v_start,ends_on=v_end,updated_by=p_user_id,updated_at=now()
  where campaign_id=p_campaign_id;
end;
$fn$;

create or replace function public.set_offer_active(p_offer_id uuid,p_active boolean,p_user_id uuid) returns void
language plpgsql security invoker set search_path=public
as $fn$
declare v_campaign_id uuid;
begin
  if not public.can_edit() then raise exception 'Sem permissão.'; end if;
  select campaign_id into v_campaign_id from public.offers where id=p_offer_id for update;
  if not found then raise exception 'Oferta não encontrada.'; end if;
  if not p_active and v_campaign_id is not null then
    delete from public.campaign_items where offer_id=p_offer_id;
    update public.offers set active=false,campaign_id=null,updated_by=p_user_id,updated_at=now() where id=p_offer_id;
  else
    update public.offers set active=p_active,updated_by=p_user_id,updated_at=now() where id=p_offer_id;
  end if;
end;
$fn$;

revoke all on function public.sync_campaign_offer_dates(uuid,uuid) from public,anon;
grant execute on function public.sync_campaign_offer_dates(uuid,uuid) to authenticated,service_role;
revoke all on function public.set_offer_active(uuid,boolean,uuid) from public,anon;
grant execute on function public.set_offer_active(uuid,boolean,uuid) to authenticated,service_role;

commit;
