-- 회사 기본 설정 (로고, 서명 등 견적서 기본값)
-- Supabase SQL Editor에서 실행

CREATE TABLE company_defaults (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  logo_url TEXT,           -- Storage public URL
  company_name TEXT,
  address TEXT,
  tel TEXT,
  website TEXT,
  from_name TEXT,          -- 발신 회사명 (From 필드)
  sig_company TEXT,        -- 서명 회사명
  sig_name TEXT,           -- 서명자 이름
  sig_title TEXT,          -- 서명자 직함
  sig_image_url TEXT,      -- 서명 이미지 Storage URL
  greeting TEXT DEFAULT 'Dear Sir,',
  intro TEXT DEFAULT 'We are pleased to offer the following goods as per terms and conditions set forth hereunder.',
  default_footer JSONB DEFAULT '{}',  -- payment_terms, packing, delivery 등
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE company_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own defaults" ON company_defaults
  FOR ALL USING (auth.uid() = user_id);

-- Storage bucket 생성 (Supabase Dashboard > Storage에서 수동 생성도 가능)
-- 아래는 참고용이며, Dashboard에서 "quotation-assets" 버킷을 public으로 생성하세요.
-- INSERT INTO storage.buckets (id, name, public) VALUES ('quotation-assets', 'quotation-assets', true);
