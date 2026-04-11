import { extractText as unpdfExtractText, getDocumentProxy } from "unpdf";
import type { ExtractedSnapshot, ExtractedPage } from "./extract-types";

/**
 * Deterministic PDF text extraction using unpdf.
 * Returns one entry per page. Tables are currently returned empty ([])
 * because unpdf does not expose table structure — the LLM stage handles
 * table inference from raw page text. We keep the `tables` field in the
 * shape for future upgrades without schema change.
 */
export async function extractText(pdfBytes: Uint8Array): Promise<ExtractedSnapshot> {
  if (pdfBytes.length === 0) {
    throw new Error("Empty PDF bytes");
  }

  const pdf = await getDocumentProxy(pdfBytes);
  const result = await unpdfExtractText(pdf, { mergePages: false });
  // unpdf returns { totalPages, text: string[] } when mergePages: false
  const pageTexts = Array.isArray(result.text) ? result.text : [result.text];

  const pages: ExtractedPage[] = pageTexts.map((text, idx) => ({
    page_number: idx + 1,
    text: text ?? "",
    tables: [],
  }));

  return {
    pages,
    extracted_at: new Date().toISOString(),
  };
}
