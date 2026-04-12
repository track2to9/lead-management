-- Manufacturer Dealer Network
-- 제조사 홈페이지에서 크롤링한 공식 딜러 목록

CREATE TABLE IF NOT EXISTS manufacturer_dealers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('attachment', 'excavator')),
  company_name TEXT NOT NULL,
  country TEXT,
  city TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  lat NUMERIC,
  lng NUMERIC,
  raw_data JSONB DEFAULT '{}',
  crawled_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brand, company_name, country)
);

-- RLS
ALTER TABLE manufacturer_dealers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read dealers"
  ON manufacturer_dealers FOR SELECT
  USING (auth.role() = 'authenticated');

-- Index
CREATE INDEX idx_dealers_brand ON manufacturer_dealers(brand);
CREATE INDEX idx_dealers_country ON manufacturer_dealers(country);
CREATE INDEX idx_dealers_name ON manufacturer_dealers(company_name);

NOTIFY pgrst, 'reload schema';
