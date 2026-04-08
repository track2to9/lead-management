-- TradeVoy Admin - Supabase DB Schema
-- Supabase 프로젝트 생성 후 SQL Editor에서 실행

-- 프로젝트 (고객별 분석 프로젝트)
CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'reviewing', 'completed')),
  client_name TEXT,
  product TEXT,
  countries TEXT,
  total_companies INTEGER DEFAULT 0,
  high_count INTEGER DEFAULT 0,
  medium_count INTEGER DEFAULT 0,
  emails_drafted INTEGER DEFAULT 0,
  report_url TEXT,           -- Supabase Storage URL for HTML report
  excel_url TEXT,            -- Supabase Storage URL for Excel
  score_weights JSONB DEFAULT '{"product_fit": 30, "buying_signal": 25, "company_capability": 20, "accessibility": 15, "strategic_value": 10}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 바이어 (프로젝트별 분석된 업체)
CREATE TABLE prospects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT,
  country TEXT,
  match_score INTEGER DEFAULT 0,
  priority TEXT DEFAULT 'low',
  buyer_or_competitor TEXT DEFAULT 'unclear',
  summary TEXT,
  match_reason TEXT,
  reasoning_chain TEXT,
  approach TEXT,
  evidence_quotes JSONB DEFAULT '[]',
  current_suppliers JSONB DEFAULT '[]',
  detected_products JSONB DEFAULT '[]',
  company_size TEXT,
  decision_maker TEXT,
  best_timing TEXT,
  competitive_landscape TEXT,
  email_subject TEXT,
  email_body TEXT,
  followup_sequence JSONB DEFAULT '[]',
  screenshot_url TEXT,
  source TEXT,
  source_type TEXT,
  client_feedback TEXT,      -- 고객이 남긴 피드백
  feedback_status TEXT DEFAULT 'pending' CHECK (feedback_status IN ('pending', 'accepted', 'rejected', 'needs_more')),
  score_breakdown JSONB DEFAULT '{}',  -- 항목별 점수 {product_fit: {score, reason}, ...}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 피드백 (고객 ↔ TradeVoy 소통)
CREATE TABLE feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_email TEXT,
  type TEXT DEFAULT 'general',  -- general, additional_analysis, rejection, approval
  text TEXT NOT NULL,
  prospect_id UUID REFERENCES prospects(id),  -- 특정 업체에 대한 피드백이면
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 전시회
CREATE TABLE exhibitions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT,
  location TEXT,
  typical_month TEXT,
  website TEXT,
  relevance TEXT,
  action_suggestion TEXT
);

-- RLS (Row Level Security) 활성화
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE exhibitions ENABLE ROW LEVEL SECURITY;

-- 정책: 사용자는 자신의 프로젝트만 볼 수 있음
CREATE POLICY "Users can view own projects" ON projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own prospects" ON prospects
  FOR SELECT USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert feedback" ON feedback
  FOR INSERT WITH CHECK (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view own feedback" ON feedback
  FOR SELECT USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view own exhibitions" ON exhibitions
  FOR SELECT USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

-- 인덱스
CREATE INDEX idx_projects_user ON projects(user_id);
CREATE INDEX idx_prospects_project ON prospects(project_id);
CREATE INDEX idx_prospects_score ON prospects(match_score DESC);
CREATE INDEX idx_feedback_project ON feedback(project_id);
