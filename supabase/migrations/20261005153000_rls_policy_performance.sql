begin;

-- Keep read semantics unchanged while preventing edit policies from also
-- participating in SELECT evaluation.
drop policy if exists "products edit" on public.products;
create policy "products insert editors" on public.products for insert to authenticated with check (public.can_edit());
create policy "products update editors" on public.products for update to authenticated using (public.can_edit()) with check (public.can_edit());
create policy "products delete editors" on public.products for delete to authenticated using (public.can_edit());

drop policy if exists "product images edit" on public.product_images;
create policy "product images insert editors" on public.product_images for insert to authenticated with check (public.can_edit());
create policy "product images update editors" on public.product_images for update to authenticated using (public.can_edit()) with check (public.can_edit());
create policy "product images delete editors" on public.product_images for delete to authenticated using (public.can_edit());

drop policy if exists "campaigns edit" on public.campaigns;
create policy "campaigns insert editors" on public.campaigns for insert to authenticated with check (public.can_edit());
create policy "campaigns update editors" on public.campaigns for update to authenticated using (public.can_edit()) with check (public.can_edit());
create policy "campaigns delete editors" on public.campaigns for delete to authenticated using (public.can_edit());

drop policy if exists "campaign items edit" on public.campaign_items;
create policy "campaign items insert editors" on public.campaign_items for insert to authenticated with check (public.can_edit());
create policy "campaign items update editors" on public.campaign_items for update to authenticated using (public.can_edit()) with check (public.can_edit());
create policy "campaign items delete editors" on public.campaign_items for delete to authenticated using (public.can_edit());

drop policy if exists "publications edit" on public.publications;
create policy "publications insert editors" on public.publications for insert to authenticated with check (public.can_edit());
create policy "publications update editors" on public.publications for update to authenticated using (public.can_edit()) with check (public.can_edit());
create policy "publications delete editors" on public.publications for delete to authenticated using (public.can_edit());

drop policy if exists "publication media edit" on public.publication_media;
create policy "publication media insert editors" on public.publication_media for insert to authenticated with check (public.can_edit());
create policy "publication media update editors" on public.publication_media for update to authenticated using (public.can_edit()) with check (public.can_edit());
create policy "publication media delete editors" on public.publication_media for delete to authenticated using (public.can_edit());

drop policy if exists "erp products edit" on public.erp_products;
create policy "erp products insert editors" on public.erp_products for insert to authenticated with check (public.can_edit());
create policy "erp products update editors" on public.erp_products for update to authenticated using (public.can_edit()) with check (public.can_edit());
create policy "erp products delete editors" on public.erp_products for delete to authenticated using (public.can_edit());

drop policy if exists "produce template products edit" on public.produce_template_products;
create policy "produce template products insert editors" on public.produce_template_products for insert to authenticated with check (public.can_edit());
create policy "produce template products update editors" on public.produce_template_products for update to authenticated using (public.can_edit()) with check (public.can_edit());
create policy "produce template products delete editors" on public.produce_template_products for delete to authenticated using (public.can_edit());

drop policy if exists "product art compositions edit" on public.product_art_compositions;
create policy "product art compositions insert editors" on public.product_art_compositions for insert to authenticated with check (public.can_edit());
create policy "product art compositions update editors" on public.product_art_compositions for update to authenticated using (public.can_edit()) with check (public.can_edit());
create policy "product art compositions delete editors" on public.product_art_compositions for delete to authenticated using (public.can_edit());

drop policy if exists "visual templates edit" on public.visual_templates;
create policy "visual templates insert editors" on public.visual_templates for insert to authenticated with check (public.can_edit());
create policy "visual templates update editors" on public.visual_templates for update to authenticated using (public.can_edit()) with check (public.can_edit());
create policy "visual templates delete editors" on public.visual_templates for delete to authenticated using (public.can_edit());

commit;
