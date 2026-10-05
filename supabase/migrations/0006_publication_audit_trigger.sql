create or replace function public.audit_publication_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  event_action text;
begin
  if tg_op = 'INSERT' then
    event_action := 'publication_created';
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
    values (
      coalesce(new.updated_by, new.created_by, auth.uid()),
      event_action,
      'publication',
      new.id::text,
      jsonb_build_object(
        'network', new.network,
        'type', new.type,
        'status', new.status,
        'campaign_id', new.campaign_id
      )
    );
    return new;
  end if;

  if old.status is distinct from new.status
     or old.scheduled_at is distinct from new.scheduled_at
     or old.published_at is distinct from new.published_at
     or old.error_message is distinct from new.error_message
     or old.network is distinct from new.network
     or old.type is distinct from new.type
     or old.caption is distinct from new.caption then

    event_action := case
      when old.status is distinct from new.status and new.status = 'scheduled' then 'publication_scheduled'
      when old.status is distinct from new.status and new.status = 'published' then 'publication_published'
      when old.status is distinct from new.status and new.status = 'error' then 'publication_error'
      when old.status is distinct from new.status and new.status = 'cancelled' then 'publication_cancelled'
      when old.status is distinct from new.status and new.status = 'draft' then 'publication_returned_to_draft'
      else 'publication_updated'
    end;

    insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
    values (
      coalesce(new.updated_by, new.created_by, auth.uid()),
      event_action,
      'publication',
      new.id::text,
      jsonb_build_object(
        'old_status', old.status,
        'new_status', new.status,
        'network', new.network,
        'type', new.type,
        'scheduled_at', new.scheduled_at,
        'published_at', new.published_at,
        'error_message', new.error_message
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_audit_publication_change on public.publications;
create trigger trg_audit_publication_change
after insert or update on public.publications
for each row execute function public.audit_publication_change();
