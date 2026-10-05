begin;

-- Authenticated users whose application profile has been deactivated must
-- not retain read access through legacy USING (true) policies.
drop policy if exists "products read" on public.products;
create policy "products read active users" on public.products for select to authenticated
using (exists (select 1 from public.profiles where id = (select auth.uid()) and active));

drop policy if exists "product images read" on public.product_images;
create policy "product images read active users" on public.product_images for select to authenticated
using (exists (select 1 from public.profiles where id = (select auth.uid()) and active));

drop policy if exists "campaigns read" on public.campaigns;
create policy "campaigns read active users" on public.campaigns for select to authenticated
using (exists (select 1 from public.profiles where id = (select auth.uid()) and active));

drop policy if exists "campaign items read" on public.campaign_items;
create policy "campaign items read active users" on public.campaign_items for select to authenticated
using (exists (select 1 from public.profiles where id = (select auth.uid()) and active));

drop policy if exists "publications read" on public.publications;
create policy "publications read active users" on public.publications for select to authenticated
using (exists (select 1 from public.profiles where id = (select auth.uid()) and active));

drop policy if exists "publication media read" on public.publication_media;
create policy "publication media read active users" on public.publication_media for select to authenticated
using (exists (select 1 from public.profiles where id = (select auth.uid()) and active));

drop policy if exists "erp products read" on public.erp_products;
create policy "erp products read active users" on public.erp_products for select to authenticated
using (exists (select 1 from public.profiles where id = (select auth.uid()) and active));

drop policy if exists "produce template products read" on public.produce_template_products;
create policy "produce template products read active users" on public.produce_template_products for select to authenticated
using (exists (select 1 from public.profiles where id = (select auth.uid()) and active));

drop policy if exists "brand fonts read" on public.brand_fonts;
create policy "brand fonts read active users" on public.brand_fonts for select to authenticated
using (exists (select 1 from public.profiles where id = (select auth.uid()) and active));

drop policy if exists "brand settings read" on public.brand_settings;
create policy "brand settings read active users" on public.brand_settings for select to authenticated
using (exists (select 1 from public.profiles where id = (select auth.uid()) and active));

commit;
