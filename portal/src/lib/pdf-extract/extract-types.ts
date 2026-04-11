// portal/src/lib/pdf-extract/extract-types.ts

export interface ExtractedPage {
  page_number: number;
  text: string;
  tables: string[][][]; // [table][row][col] — empty [] if no tables
}

export interface ExtractedSnapshot {
  pages: ExtractedPage[];
  extracted_at: string;
}

/** Result wrapper for confidence-annotated LLM output. */
export interface ValueWithConfidence<T> {
  value: T;
  confidence: number; // 0..1
}

export interface LlmExtractionColumn {
  key: string;
  label: string;
  type: "text" | "number" | "currency";
  confidence: number;
}

export interface LlmExtractionItem {
  cells: Record<string, string | number>;
  confidence: Record<string, number>;
}

export interface LlmExtractionResult {
  ref_no: ValueWithConfidence<string>;
  date: ValueWithConfidence<string>; // ISO YYYY-MM-DD
  client_name: ValueWithConfidence<string>;
  currency: ValueWithConfidence<string>;
  columns: LlmExtractionColumn[];
  items: LlmExtractionItem[];
  footer: Record<string, ValueWithConfidence<string>>;
  company_header: Record<string, string>;
  notes_for_human: string;
}
