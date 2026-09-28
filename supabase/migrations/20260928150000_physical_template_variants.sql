begin;

alter table public.art_templates drop constraint if exists art_templates_id_check;
alter table public.art_templates
  add constraint art_templates_id_check
  check (id in ('validity','produce','digital-feed','digital-story','physical-one','physical-four'));

insert into public.art_templates(id)
values ('physical-one'),('physical-four')
on conflict (id) do nothing;

commit;
