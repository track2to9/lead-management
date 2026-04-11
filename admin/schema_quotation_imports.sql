-- Quotation PDF Import — Phase 1 migration
-- Run in Supabase SQL Editor.

-- 1. New columns on quotations
ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual'
    CHECK (source IN ('manual', 'imported_pdf')),
  ADD COLUMN IF NOT EXISTS import_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS import_confidence JSONB,
  ADD COLUMN IF NOT EXISTS import_source_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- 2. Extend status enum to include 'imported_unverified'
ALTER TABLE quotations DROP CONSTRAINT IF EXISTS quotations_status_check;
ALTER TABLE quotations ADD CONSTRAINT quotations_status_check
  CHECK (status IN ('draft', 'final', 'imported_unverified'));

-- 3. Index for filtering imported quotations
CREATE INDEX IF NOT EXISTS idx_quotations_source_status
  ON quotations(user_id, source, status);

-- 4. Storage bucket (create manually in Supabase Dashboard):
--    Name: quotation-imports
--    Public: false
--    Then run the RLS policies below.

-- 5. Storage RLS — allow users to read/write/update/delete their own imports.
--    Path convention: {user_id}/{quotation_id}/{filename}
--    The first path segment must equal auth.uid().
--    All four policies are dropped first so the file is safely re-runnable.

DROP POLICY IF EXISTS "Users can upload their own quotation imports" ON storage.objects;
CREATE POLICY "Users can upload their own quotation imports"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'quotation-imports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can read their own quotation imports" ON storage.objects;
CREATE POLICY "Users can read their own quotation imports"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'quotation-imports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update their own quotation imports" ON storage.objects;
CREATE POLICY "Users can update their own quotation imports"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'quotation-imports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'quotation-imports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete their own quotation imports" ON storage.objects;
CREATE POLICY "Users can delete their own quotation imports"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'quotation-imports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

NOTIFY pgrst, 'reload schema';
