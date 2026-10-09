begin;

create type public.supplier_relation_status as enum ('draft', 'finalized', 'cancelled');

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  document text,
  contact_name text,
  contact_phone text,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.supplier_occurrences (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  reference text,
  occurred_on date,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.supplier_relations (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  status public.supplier_relation_status not null default 'draft',
  notes text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete set null,
  finalized_by uuid references public.profiles(id) on delete set null,
  finalized_at timestamptz,
  cancelled_by uuid references public.profiles(id) on delete set null,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.supplier_relation_items (
  id uuid primary key default gen_random_uuid(),
  relation_id uuid not null references public.supplier_relations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  occurrence_id uuid references public.supplier_occurrences(id) on delete restrict,
  quantity numeric(14,3) not null check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (relation_id, product_id, occurrence_id)
);

create table public.supplier_relation_reservations (
  id uuid primary key default gen_random_uuid(),
  relation_id uuid not null references public.supplier_relations(id) on delete restrict,
  relation_item_id uuid not null unique references public.supplier_relation_items(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity numeric(14,3) not null check (quantity > 0),
  reserved_at timestamptz not null default now(),
  released_at timestamptz,
  release_reason text
);

create index suppliers_name_idx on public.suppliers(name);
create index supplier_occurrences_supplier_idx on public.supplier_occurrences(supplier_id, occurred_on desc);
create index supplier_relations_status_idx on public.supplier_relations(status, created_at desc);
create index supplier_relation_items_relation_idx on public.supplier_relation_items(relation_id);
create index supplier_relation_reservations_product_active_idx
  on public.supplier_relation_reservations(product_id) where released_at is null;

create trigger suppliers_touch before update on public.suppliers
for each row execute function public.touch_updated_at();
create trigger supplier_relations_touch before update on public.supplier_relations
for each row execute function public.touch_updated_at();

alter table public.suppliers enable row level security;
alter table public.supplier_occurrences enable row level security;
alter table public.supplier_relations enable row level security;
alter table public.supplier_relation_items enable row level security;
alter table public.supplier_relation_reservations enable row level security;

create policy "suppliers read active users" on public.suppliers for select to authenticated
using (exists (select 1 from public.profiles where id = (select auth.uid()) and active));
create policy "suppliers edit" on public.suppliers for all to authenticated
using (public.can_edit()) with check (public.can_edit());

create policy "supplier occurrences read active users" on public.supplier_occurrences for select to authenticated
using (exists (select 1 from public.profiles where id = (select auth.uid()) and active));
create policy "supplier occurrences edit" on public.supplier_occurrences for all to authenticated
using (public.can_edit()) with check (public.can_edit());

create policy "supplier relations read active users" on public.supplier_relations for select to authenticated
using (exists (select 1 from public.profiles where id = (select auth.uid()) and active));
create policy "supplier relations draft edit" on public.supplier_relations for insert to authenticated
with check (public.can_edit() and status = 'draft' and created_by = (select auth.uid()));
create policy "supplier relations draft update" on public.supplier_relations for update to authenticated
using (public.can_edit() and status = 'draft')
with check (public.can_edit() and status = 'draft');
create policy "supplier relations draft delete" on public.supplier_relations for delete to authenticated
using (public.can_edit() and status = 'draft');

create policy "supplier relation items read active users" on public.supplier_relation_items for select to authenticated
using (exists (select 1 from public.profiles where id = (select auth.uid()) and active));
create policy "supplier relation items draft edit" on public.supplier_relation_items for all to authenticated
using (public.can_edit() and exists (select 1 from public.supplier_relations r where r.id = relation_id and r.status = 'draft'))
with check (public.can_edit() and exists (select 1 from public.supplier_relations r where r.id = relation_id and r.status = 'draft'));

create policy "supplier reservations read active users" on public.supplier_relation_reservations for select to authenticated
using (exists (select 1 from public.profiles where id = (select auth.uid()) and active));

create or replace function public.relation_available_stock(p_product_id uuid)
returns numeric
language sql stable security invoker set search_path = public
as $$
  select coalesce(p.stock, 0) - coalesce((
    select sum(r.quantity) from public.supplier_relation_reservations r
    where r.product_id = p_product_id and r.released_at is null
  ), 0)
  from public.products p where p.id = p_product_id;
$$;

create or replace function public.finalize_supplier_relation(p_relation_id uuid)
returns public.supplier_relations
language plpgsql security definer set search_path = public
as $$
declare
  v_relation public.supplier_relations%rowtype;
  v_item public.supplier_relation_items%rowtype;
  v_available numeric;
begin
  if not public.is_admin() then raise exception 'Somente administradores podem finalizar relações'; end if;
  select * into v_relation from public.supplier_relations where id = p_relation_id for update;
  if not found then raise exception 'Relação não encontrada'; end if;
  if v_relation.status <> 'draft' then raise exception 'Somente rascunhos podem ser finalizados'; end if;
  if not exists (select 1 from public.supplier_relation_items where relation_id = p_relation_id) then
    raise exception 'A relação precisa ter ao menos um item';
  end if;

  for v_item in
    select * from public.supplier_relation_items where relation_id = p_relation_id order by product_id, id
  loop
    perform id from public.products where id = v_item.product_id for update;
    v_available := public.relation_available_stock(v_item.product_id);
    if v_available < v_item.quantity then
      raise exception 'Saldo insuficiente para o produto %: disponível %, solicitado %', v_item.product_id, v_available, v_item.quantity;
    end if;
    insert into public.supplier_relation_reservations(relation_id, relation_item_id, product_id, quantity)
      values (p_relation_id, v_item.id, v_item.product_id, v_item.quantity);
  end loop;

  update public.supplier_relations
  set status = 'finalized', finalized_by = auth.uid(), finalized_at = now(), updated_by = auth.uid()
  where id = p_relation_id returning * into v_relation;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'supplier_relation.finalized', 'supplier_relation', p_relation_id::text,
    jsonb_build_object('supplier_id', v_relation.supplier_id));
  return v_relation;
exception when unique_violation then
  raise exception 'A relação já possui reserva ou foi processada por outra operação';
end;
$$;

create or replace function public.cancel_supplier_relation(p_relation_id uuid, p_reason text)
returns public.supplier_relations
language plpgsql security definer set search_path = public
as $$
declare v_relation public.supplier_relations%rowtype;
begin
  if not public.is_admin() then raise exception 'Somente administradores podem cancelar relações'; end if;
  select * into v_relation from public.supplier_relations where id = p_relation_id for update;
  if not found then raise exception 'Relação não encontrada'; end if;
  if v_relation.status <> 'finalized' then raise exception 'Somente relações finalizadas podem ser canceladas'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'Informe o motivo do cancelamento'; end if;
  update public.supplier_relation_reservations
  set released_at = now(), release_reason = trim(p_reason)
  where relation_id = p_relation_id and released_at is null;
  update public.supplier_relations
  set status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now(), cancellation_reason = trim(p_reason), updated_by = auth.uid()
  where id = p_relation_id returning * into v_relation;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'supplier_relation.cancelled', 'supplier_relation', p_relation_id::text,
    jsonb_build_object('reason', trim(p_reason), 'released_at', now()));
  return v_relation;
end;
$$;

revoke all on function public.finalize_supplier_relation(uuid) from public, anon;
revoke all on function public.cancel_supplier_relation(uuid, text) from public, anon;
grant execute on function public.finalize_supplier_relation(uuid), public.cancel_supplier_relation(uuid, text) to authenticated;
grant select on public.supplier_relation_reservations to authenticated;
grant select, insert, update, delete on public.suppliers, public.supplier_occurrences, public.supplier_relations, public.supplier_relation_items to authenticated;

comment on table public.supplier_relation_reservations is 'Ledger imutável de reservas; released_at libera saldo sem apagar auditoria.';
comment on function public.finalize_supplier_relation(uuid) is 'Confere saldo sob lock e reserva atomicamente; somente administradores.';
comment on function public.cancel_supplier_relation(uuid, text) is 'Libera reservas e registra cancelamento de forma auditável; somente administradores.';

commit;
