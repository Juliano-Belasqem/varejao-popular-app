alter table public.products
  add column if not exists display_name text;

comment on column public.products.display_name is
  'Optional presentation name used in campaigns and generated artwork; ERP/imported name remains unchanged.';
