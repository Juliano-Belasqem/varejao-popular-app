update storage.buckets set public = false where id in ('product-images','digital-materials');

drop policy if exists "storage public reads" on storage.objects;
create policy "storage reads" on storage.objects
for select using (
  bucket_id = 'social-media'
  or (bucket_id in ('product-images','digital-materials') and auth.uid() is not null)
);
