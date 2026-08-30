-- 0002_storage_extratos.sql

insert into storage.buckets (id, name, public)
values ('extratos', 'extratos', false)
on conflict (id) do nothing;

create policy "owner_select_extratos" on storage.objects
  for select using (
    bucket_id = 'extratos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owner_insert_extratos" on storage.objects
  for insert with check (
    bucket_id = 'extratos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owner_delete_extratos" on storage.objects
  for delete using (
    bucket_id = 'extratos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
