export interface ScoreDimension {
  score: number;
  reason: string;
}

export interface ScoreBreakdown {
  product_fit: ScoreDimension;
  buying_signal: ScoreDimension;
  company_capability: ScoreDimension;
  accessibility: ScoreDimension;
  strategic_value: ScoreDimension;
}

export type ScoreWeights = Record<keyof ScoreBreakdown, number>;

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  product_fit: 30,
  buying_signal: 25,
  company_capability: 20,
  accessibility: 15,
  strategic_value: 10,
};

export const SCORE_DIMENSION_LABELS: Record<keyof ScoreBreakdown, string> = {
  product_fit: "제품 적합도",
  buying_signal: "구매 시그널",
  company_capability: "기업 규모/역량",
  accessibility: "접근 가능성",
  strategic_value: "전략적 가치",
};

export interface Project {
  id: string;
  user_id: string;
  name: string;
  status: "active" | "analyzing" | "results_ready" | "refining" | "completed";
  client_name: string;
  product: string;
  countries: string;
  total_companies: number;
  high_count: number;
  medium_count: number;
  emails_drafted: number;
  report_url?: string;
  excel_url?: string;
  score_weights?: ScoreWeights;
  refinement_conditions?: string[];
  refinement_round?: number;
  // 내 회사/제품 프로필 (Issue #2)
  company_url?: string;                   // 고객사 홈페이지
  company_profile?: string;               // 고객사 자유 설명
  product_profile?: string;               // 제품 상세 설명
  attachment_urls?: string[];             // 업로드한 자료 (PDF 등) Storage 경로
  ai_company_analysis?: string;           // AI가 회사 분석한 결과 (수정 가능)
  ai_product_analysis?: string;           // AI가 제품 분석한 결과 (수정 가능)
  created_at: string;
  updated_at: string;
}

export interface Prospect {
  id: string;
  project_id: string;
  name: string;
  url?: string;
  country?: string;
  match_score: number;
  score_breakdown?: ScoreBreakdown;
  priority: "high" | "medium" | "low";
  buyer_or_competitor: "buyer" | "competitor" | "unclear";
  summary?: string;
  match_reason?: string;
  reasoning_chain?: string;
  approach?: string;
  evidence_quotes: { original: string; translated: string; relevance: string }[];
  current_suppliers: string[];
  detected_products: string[];
  company_size?: string;
  decision_maker?: string;
  best_timing?: string;
  competitive_landscape?: string;
  email_subject?: string;
  email_body?: string;
  followup_sequence: { day: number; subject: string; body: string }[];
  screenshot_url?: string;
  source?: string;
  source_type?: string;
  feedback_status: "pending" | "accepted" | "rejected" | "needs_more";
  round?: number;
  created_at: string;
}

export interface Feedback {
  id: string;
  project_id: string;
  prospect_id?: string;
  user_email: string;
  type: string;
  text: string;
  timestamp: string;
}

export interface Exhibition {
  id: string;
  project_id: string;
  name: string;
  location?: string;
  typical_month?: string;
  website?: string;
  relevance?: string;
  action_suggestion?: string;
}

export interface Evidence {
  id: string;
  prospect_id: string;
  source_url: string;
  source_type: "website" | "linkedin" | "facebook" | "instagram" | "x" | "forum" | "news";
  screenshot_path?: string;
  text_excerpt?: string;
  text_translated?: string;
  related_scores: string[];
  collected_at: string;
  content_date?: string;
}

// --- Manufacturer Dealer Network ---

export interface ManufacturerDealer {
  id: string;
  user_id?: string | null;   // null = admin-global, else user-scoped
  brand: string;
  category: "attachment" | "excavator";
  company_name: string;
  country?: string;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  lat?: number;
  lng?: number;
  raw_data?: Record<string, unknown>;
  source_url?: string;
  crawled_at: string;
}

export interface DealerCrawlJob {
  id: string;
  user_id: string;
  brand: string;
  category: "attachment" | "excavator";
  source_url: string;
  status: "pending" | "running" | "success" | "failed";
  dealers_found: number;
  error_message?: string;
  started_at?: string;
  finished_at?: string;
  created_at: string;
}

// --- Quotation Builder ---

export interface QuotationColumn {
  key: string;
  label: string;
  type: "text" | "number" | "currency";
  width?: number;
}

export interface QuotationTemplate {
  id: string;
  user_id?: string;
  name: string;
  columns: QuotationColumn[];
  footer_defaults: Record<string, string>;
  is_system: boolean;
  created_at: string;
}

export interface ExtraCost {
  name: string;
  amount: number;
  currency: string;
}

export interface QuotationItem {
  id: string;
  quotation_id: string;
  sort_order: number;
  cells: Record<string, string | number>;
  cost_price: number | null;
  cost_currency: string;
  selling_price: number | null;
  margin_percent: number | null;
  margin_amount: number | null;
  extra_costs: ExtraCost[];
  created_at: string;
}

export type QuotationSource = "manual" | "imported_pdf";
export type QuotationStatus = "draft" | "final" | "imported_unverified";

export interface ImportConfidence {
  // Top-level field confidences (0..1)
  ref_no?: number;
  date?: number;
  client_name?: number;
  currency?: number;
  // Per-item, per-cell confidence keyed by item id
  items?: Record<string, Record<string, number>>;
  // Footer field confidences
  footer?: Record<string, number>;
  // Free-form LLM note addressed to the human reviewer
  notes_for_human?: string;
  // Extraction failure reason (present only on failure)
  failure_reason?: string;
}

export interface ExtractedPageSnapshot {
  page_number: number;
  text: string;
  tables: string[][][]; // [table][row][col]
}

export interface ImportSourceSnapshot {
  pages: ExtractedPageSnapshot[];
  extracted_at: string; // ISO timestamp
}

export interface Quotation {
  id: string;
  user_id: string;
  template_id?: string;
  ref_no: string;
  date: string;
  client_name?: string;
  status: QuotationStatus;
  columns: QuotationColumn[];
  cost_columns?: QuotationColumn[];  // 우측 마진 계산용 추가 칼럼
  currency: string;
  exchange_rates: Record<string, number>;
  margin_mode: "forward" | "reverse";
  footer: Record<string, string>;
  company_header: Record<string, string>;
  global_costs: ExtraCost[];
  // Import-related (Phase 1)
  source: QuotationSource;
  import_pdf_url?: string | null;
  import_confidence?: ImportConfidence | null;
  import_source_snapshot?: ImportSourceSnapshot | null;
  verified_at?: string | null;
  created_at: string;
  updated_at: string;
}
