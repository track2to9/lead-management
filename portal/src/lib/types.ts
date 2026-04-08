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
