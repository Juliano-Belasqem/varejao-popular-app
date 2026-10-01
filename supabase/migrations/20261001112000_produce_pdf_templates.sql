begin;
alter table public.produce_template_products add column if not exists pdf_path text;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('produce-pdfs','produce-pdfs',false,10485760,array['application/pdf'])
on conflict (id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['application/pdf'];
create policy "produce pdf read" on storage.objects for select to authenticated using (bucket_id='produce-pdfs');
create policy "produce pdf insert" on storage.objects for insert to authenticated with check (bucket_id='produce-pdfs' and public.can_edit());
create policy "produce pdf update" on storage.objects for update to authenticated using (bucket_id='produce-pdfs' and public.can_edit()) with check (bucket_id='produce-pdfs' and public.can_edit());
create policy "produce pdf delete" on storage.objects for delete to authenticated using (bucket_id='produce-pdfs' and public.can_edit());
commit;
