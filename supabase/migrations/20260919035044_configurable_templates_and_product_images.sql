begin;

create table public.art_templates (
  id text primary key check (id in ('validity','digital-feed','digital-story')),
  background_path text,
  layout jsonb not null default '{}'::jsonb check (jsonb_typeof(layout)='object'),
  revision integer not null default 0 check (revision>=0),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
create index art_templates_updated_by_idx on public.art_templates(updated_by);
insert into public.art_templates(id) values ('validity'),('digital-feed'),('digital-story');
alter table public.art_templates enable row level security;
revoke all on public.art_templates from anon;
grant select, update on public.art_templates to authenticated;
grant all on public.art_templates to service_role;
create policy "templates read active" on public.art_templates for select to authenticated
  using (exists(select 1 from public.profiles where id=(select auth.uid()) and active));
create policy "templates edit" on public.art_templates for update to authenticated
  using (public.can_edit()) with check (public.can_edit());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('template-assets','template-assets',false,4194304,array['image/png','image/jpeg','image/webp']);
create policy "template assets read" on storage.objects for select to authenticated
  using (bucket_id='template-assets' and exists(select 1 from public.profiles where id=(select auth.uid()) and active));
create policy "template assets insert" on storage.objects for insert to authenticated
  with check (bucket_id='template-assets' and public.can_edit());
create policy "template assets update" on storage.objects for update to authenticated
  using (bucket_id='template-assets' and public.can_edit()) with check (bucket_id='template-assets' and public.can_edit());
create policy "template assets delete" on storage.objects for delete to authenticated
  using (bucket_id='template-assets' and public.can_edit());

-- Invoker rights preserve RLS. Lock the product before replacing its primary image.
create function public.set_product_primary_image(p_product_id uuid,p_image_id uuid)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if not public.can_edit() then raise exception 'Sem permissão'; end if;
  perform id from public.products where id=p_product_id for update;
  if not found then raise exception 'Produto não encontrado'; end if;
  perform id from public.product_images where id=p_image_id and product_id=p_product_id;
  if not found then raise exception 'Imagem não encontrada'; end if;
  update public.product_images set is_primary=false where product_id=p_product_id and is_primary;
  update public.product_images set is_primary=true,approved=true where id=p_image_id and product_id=p_product_id;
end;
$$;
revoke all on function public.set_product_primary_image(uuid,uuid) from public,anon;
grant execute on function public.set_product_primary_image(uuid,uuid) to authenticated;

create function public.register_product_image(p_product_id uuid,p_storage_path text,p_source text,p_source_url text default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare new_id uuid;
begin
  if not public.can_edit() then raise exception 'Sem permissão'; end if;
  perform id from public.products where id=p_product_id for update;
  if not found then raise exception 'Produto não encontrado'; end if;
  if p_storage_path not like p_product_id::text || '/%' then raise exception 'Caminho de imagem inválido'; end if;
  if not exists(select 1 from storage.objects where bucket_id='product-images' and name=p_storage_path) then raise exception 'Arquivo não encontrado'; end if;
  insert into public.product_images(product_id,storage_path,source,source_url,approved,is_primary,created_by)
    values(p_product_id,p_storage_path,p_source,p_source_url,true,false,auth.uid()) returning id into new_id;
  perform public.set_product_primary_image(p_product_id,new_id);
  return new_id;
end;
$$;
revoke all on function public.register_product_image(uuid,text,text,text) from public,anon;
grant execute on function public.register_product_image(uuid,text,text,text) to authenticated;

create function public.remove_product_image(p_product_id uuid,p_image_id uuid)
returns text language plpgsql security invoker set search_path='' as $$
declare old_path text; was_primary boolean; replacement uuid;
begin
  if not public.can_edit() then raise exception 'Sem permissão'; end if;
  perform id from public.products where id=p_product_id for update;
  if not found then raise exception 'Produto não encontrado'; end if;
  select storage_path,is_primary into old_path,was_primary from public.product_images where id=p_image_id and product_id=p_product_id;
  if not found then raise exception 'Imagem não encontrada'; end if;
  delete from public.product_images where id=p_image_id and product_id=p_product_id;
  if was_primary then
    select id into replacement from public.product_images where product_id=p_product_id and approved order by id limit 1;
    if replacement is not null then perform public.set_product_primary_image(p_product_id,replacement); end if;
  end if;
  return old_path;
end;
$$;
revoke all on function public.remove_product_image(uuid,uuid) from public,anon;
grant execute on function public.remove_product_image(uuid,uuid) to authenticated;

commit;
