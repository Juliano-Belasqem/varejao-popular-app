begin;

alter function public.current_role() security invoker;
alter function public.is_admin() security invoker;
alter function public.can_edit() security invoker;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

commit;
