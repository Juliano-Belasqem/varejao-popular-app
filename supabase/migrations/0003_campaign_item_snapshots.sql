alter table public.campaign_items
  add column if not exists ean_snapshot text,
  add column if not exists name_snapshot text,
  add column if not exists brand_snapshot text,
  add column if not exists specification_snapshot text;

comment on column public.campaign_items.ean_snapshot is 'EAN captured when the product is added to the campaign.';
comment on column public.campaign_items.name_snapshot is 'Product name captured when the product is added to the campaign.';
comment on column public.campaign_items.brand_snapshot is 'Brand captured when the product is added to the campaign.';
comment on column public.campaign_items.specification_snapshot is 'Specification captured when the product is added to the campaign.';
