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
  status: "active" | "reviewing" | "completed";
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
