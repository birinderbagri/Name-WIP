-- ============================================================
-- Private storage for raw uploads.
-- Bucket is PRIVATE: files are served only via short-lived signed
-- URLs created server-side, and RLS scopes every object to its
-- owner's folder (first path segment = auth.uid()).
-- Object path convention: {user_id}/{source_id}/{index}.{ext}
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sources',
  'sources',
  false,
  10485760, -- 10 MB per file
  array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

create policy "users upload to own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'sources'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users read own files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'sources'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users delete own files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'sources'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
