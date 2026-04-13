-- Issue #2: 내 회사/제품 프로필 필드 추가

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS company_url TEXT,
  ADD COLUMN IF NOT EXISTS company_profile TEXT,
  ADD COLUMN IF NOT EXISTS product_profile TEXT,
  ADD COLUMN IF NOT EXISTS attachment_urls JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS ai_company_analysis TEXT,
  ADD COLUMN IF NOT EXISTS ai_product_analysis TEXT;

NOTIFY pgrst, 'reload schema';
