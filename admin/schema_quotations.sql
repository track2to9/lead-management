-- Quotation Builder Tables
-- Supabase SQL Editor에서 실행

-- 템플릿
CREATE TABLE quotation_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  columns JSONB NOT NULL DEFAULT '[]',
  footer_defaults JSONB DEFAULT '{}',
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 견적서
CREATE TABLE quotations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID REFERENCES quotation_templates(id),
  ref_no TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  client_name TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'final')),
  columns JSONB NOT NULL DEFAULT '[]',
  currency TEXT DEFAULT 'USD',
  exchange_rates JSONB DEFAULT '{}',
  margin_mode TEXT DEFAULT 'forward' CHECK (margin_mode IN ('forward', 'reverse')),
  footer JSONB DEFAULT '{}',
  company_header JSONB DEFAULT '{}',
  global_costs JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 견적서 아이템
CREATE TABLE quotation_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_id UUID REFERENCES quotations(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  cells JSONB NOT NULL DEFAULT '{}',
  cost_price NUMERIC,
  cost_currency TEXT DEFAULT 'CNY',
  selling_price NUMERIC,
  margin_percent NUMERIC,
  margin_amount NUMERIC,
  extra_costs JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE quotation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own templates" ON quotation_templates FOR ALL USING (auth.uid() = user_id OR is_system = true);
CREATE POLICY "Users manage own quotations" ON quotations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own items" ON quotation_items FOR ALL USING (
  quotation_id IN (SELECT id FROM quotations WHERE user_id = auth.uid())
);

-- Indexes
CREATE INDEX idx_quotations_user ON quotations(user_id);
CREATE INDEX idx_quotations_ref ON quotations(ref_no);
CREATE INDEX idx_quotation_items_quotation ON quotation_items(quotation_id);

-- 기본 시스템 템플릿
INSERT INTO quotation_templates (user_id, name, columns, footer_defaults, is_system) VALUES
(NULL, 'Proforma Invoice', '[{"key":"model","label":"Model","type":"text","width":150},{"key":"spec","label":"Applicable Carrier (ton)","type":"text","width":150},{"key":"price","label":"Price","type":"currency","width":100},{"key":"qty","label":"Qty","type":"number","width":60},{"key":"amount","label":"Amount","type":"currency","width":120}]', '{"payment_terms":"T/T in 30 days after invoice date","delivery":"Within 8 weeks after order confirmation","packing":"Export standard wooden case"}', true),
(NULL, 'Parts Quotation', '[{"key":"part_name","label":"Part Name","type":"text","width":180},{"key":"part_no","label":"Part Number","type":"text","width":120},{"key":"lead_time","label":"Lead Time","type":"text","width":80},{"key":"weight","label":"Weight (kg)","type":"number","width":80},{"key":"price","label":"Price","type":"currency","width":100},{"key":"qty","label":"Qty","type":"number","width":60},{"key":"amount","label":"Amount","type":"currency","width":120},{"key":"remark","label":"Remark","type":"text","width":100}]', '{"payment_terms":"T/T in advance","delivery":"As per lead time","packing":"Standard export packing"}', true),
(NULL, 'Blank', '[{"key":"description","label":"Description","type":"text","width":250},{"key":"price","label":"Price","type":"currency","width":100},{"key":"qty","label":"Qty","type":"number","width":60},{"key":"amount","label":"Amount","type":"currency","width":120}]', '{}', true);

NOTIFY pgrst, 'reload schema';
