-- Serialize media edits with publication status claims using the parent row lock.
-- Apply only after validating against an isolated Supabase database.
begin;

create or replace function public.guard_publication_media_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  parent_id uuid;
  parent_status public.publication_status;
begin
  parent_id := case when tg_op = 'DELETE' then old.publication_id else new.publication_id end;
  -- A media reassignment is not a supported operation. Remove and re-add instead.
  if tg_op = 'UPDATE' and new.publication_id is distinct from old.publication_id then
    raise exception 'Cannot reassign publication media';
  end if;

  select p.status into parent_status
  from public.publications p
  where p.id = parent_id
  for update;

  if not found then
    -- Parent deletion with ON DELETE CASCADE may invoke this trigger after
    -- the parent has become invisible to the statement.
    if tg_op = 'DELETE' then return old; end if;
    raise exception 'Publication does not exist';
  end if;

  if parent_status not in ('draft', 'scheduled', 'error', 'cancelled') then
    raise exception 'Cannot modify media while publication is processing or published';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_publication_media_mutation on public.publication_media;
create trigger trg_guard_publication_media_mutation
before insert or update or delete on public.publication_media
for each row execute function public.guard_publication_media_mutation();

commit;
