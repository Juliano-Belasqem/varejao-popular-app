begin;

revoke all on function public.audit_publication_change() from public, anon, authenticated;
grant execute on function public.audit_publication_change() to service_role;

commit;
