begin;

-- Avoid evaluating auth.uid() once per row in this policy.
drop policy if exists "audit logs insert authenticated" on public.audit_logs;
create policy "audit logs insert authenticated"
on public.audit_logs for insert to authenticated
with check (actor_id = (select auth.uid()));

-- Cover the foreign keys reported by Supabase's Performance Advisor.
create index if not exists audit_logs_actor_id_idx on public.audit_logs(actor_id);
create index if not exists campaign_items_product_id_idx on public.campaign_items(product_id);
create index if not exists campaigns_created_by_idx on public.campaigns(created_by);
create index if not exists campaigns_updated_by_idx on public.campaigns(updated_by);
create index if not exists offers_created_by_idx on public.offers(created_by);
create index if not exists offers_updated_by_idx on public.offers(updated_by);
create index if not exists produce_template_products_created_by_idx on public.produce_template_products(created_by);
create index if not exists produce_template_products_updated_by_idx on public.produce_template_products(updated_by);
create index if not exists product_art_compositions_updated_by_idx on public.product_art_compositions(updated_by);
create index if not exists product_images_created_by_idx on public.product_images(created_by);
create index if not exists publication_media_publication_id_idx on public.publication_media(publication_id);
create index if not exists publications_campaign_id_idx on public.publications(campaign_id);
create index if not exists publications_created_by_idx on public.publications(created_by);
create index if not exists publications_updated_by_idx on public.publications(updated_by);
create index if not exists visual_template_versions_created_by_idx on public.visual_template_versions(created_by);
create index if not exists visual_templates_created_by_idx on public.visual_templates(created_by);
create index if not exists visual_templates_updated_by_idx on public.visual_templates(updated_by);

commit;
