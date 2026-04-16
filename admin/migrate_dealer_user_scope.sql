-- manufacturer_dealers 테이블에 사용자 스코프 추가
-- user_id IS NULL = 관리자가 넣은 공통 딜러 (향후)
-- user_id = uuid = 특정 고객이 크롤링한 딜러

ALTER TABLE manufacturer_dealers
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS source_url TEXT;

-- 기존 unique 제약을 user_id 포함으로 변경
ALTER TABLE manufacturer_dealers DROP CONSTRAINT IF EXISTS manufacturer_dealers_brand_company_name_country_key;
ALTER TABLE manufacturer_dealers
  ADD CONSTRAINT manufacturer_dealers_unique
  UNIQUE NULLS NOT DISTINCT (user_id, brand, company_name, country);

CREATE INDEX IF NOT EXISTS idx_dealers_user ON manufacturer_dealers(user_id);

-- RLS 업데이트: 본인 것 또는 공통(user_id IS NULL)만 조회
DROP POLICY IF EXISTS "Authenticated users can read dealers" ON manufacturer_dealers;

CREATE POLICY "Users read own or global dealers"
  ON manufacturer_dealers FOR SELECT
  USING (auth.role() = 'authenticated' AND (user_id = auth.uid() OR user_id IS NULL));

CREATE POLICY "Users insert own dealers"
  ON manufacturer_dealers FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND user_id = auth.uid());

CREATE POLICY "Users update own dealers"
  ON manufacturer_dealers FOR UPDATE
  USING (auth.role() = 'authenticated' AND user_id = auth.uid());

CREATE POLICY "Users delete own dealers"
  ON manufacturer_dealers FOR DELETE
  USING (auth.role() = 'authenticated' AND user_id = auth.uid());

-- 크롤링 작업 기록 테이블 (이력 + 상태 추적용)
CREATE TABLE IF NOT EXISTS dealer_crawl_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand TEXT NOT NULL,
  category TEXT NOT NULL,
  source_url TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failed')),
  dealers_found INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE dealer_crawl_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own crawl jobs"
  ON dealer_crawl_jobs FOR ALL
  USING (auth.role() = 'authenticated' AND user_id = auth.uid())
  WITH CHECK (auth.role() = 'authenticated' AND user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_crawl_jobs_user ON dealer_crawl_jobs(user_id);

NOTIFY pgrst, 'reload schema';
