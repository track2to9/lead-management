import type Anthropic from "@anthropic-ai/sdk";
import type { ExtractedSnapshot, LlmExtractionResult } from "./extract-types";

const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `You extract structured data from legacy quotation PDFs for a Korean SMB trade company.

Your job: read the raw text of a quotation and fill the \`record_quotation\` tool with your best inference of every field. You MUST assign a confidence (0.0..1.0) to each field representing how certain you are.

Rules:
- Dates must be ISO YYYY-MM-DD. If only month/year is visible, pick day=01 and set confidence ≤ 0.5.
- If the quotation has an internal cost column (원가, cost, etc.), DO NOT include it in \`items[].cells\` — mention it in \`notes_for_human\` instead. Only customer-facing columns go into the row.
- Column \`key\`s should be lowercase snake_case English (e.g. \`part_name\`, \`lead_time\`). Column \`label\`s should be the exact text from the PDF.
- If a field is missing entirely, use an empty string as value and confidence 0.
- Keep \`notes_for_human\` short (1-2 sentences) and only populate it if there is something the reviewer should check.`;

function vcString() {
  return {
    type: "object",
    properties: {
      value: { type: "string" },
      confidence: { type: "number", minimum: 0, maximum: 1 },
    },
    required: ["value", "confidence"],
  };
}

const TOOL_DEFINITION = {
  name: "record_quotation",
  description: "Record the structured extraction of a legacy quotation PDF.",
  input_schema: {
    type: "object",
    properties: {
      ref_no: vcString(),
      date: vcString(),
      client_name: vcString(),
      currency: vcString(),
      columns: {
        type: "array",
        items: {
          type: "object",
          properties: {
            key: { type: "string" },
            label: { type: "string" },
            type: { type: "string", enum: ["text", "number", "currency"] },
            confidence: { type: "number", minimum: 0, maximum: 1 },
          },
          required: ["key", "label", "type", "confidence"],
        },
      },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            cells: { type: "object", additionalProperties: true },
            confidence: {
              type: "object",
              additionalProperties: { type: "number", minimum: 0, maximum: 1 },
            },
          },
          required: ["cells", "confidence"],
        },
      },
      footer: {
        type: "object",
        additionalProperties: {
          type: "object",
          properties: {
            value: { type: "string" },
            confidence: { type: "number", minimum: 0, maximum: 1 },
          },
          required: ["value", "confidence"],
        },
      },
      company_header: { type: "object", additionalProperties: { type: "string" } },
      notes_for_human: { type: "string" },
    },
    required: [
      "ref_no",
      "date",
      "client_name",
      "currency",
      "columns",
      "items",
      "footer",
      "company_header",
      "notes_for_human",
    ],
  },
} as const;

function snapshotToPrompt(snapshot: ExtractedSnapshot): string {
  return snapshot.pages
    .map((p) => `=== Page ${p.page_number} ===\n${p.text}`)
    .join("\n\n");
}

/**
 * Extract a structured quotation draft from a pre-parsed PDF snapshot using Claude.
 * The Anthropic client is injected so tests can supply a mock.
 */
export async function extractQuotation(
  snapshot: ExtractedSnapshot,
  client: Anthropic,
): Promise<LlmExtractionResult> {
  const prompt = snapshotToPrompt(snapshot);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [TOOL_DEFINITION as unknown as Anthropic.Tool],
    tool_choice: { type: "tool", name: "record_quotation" },
    messages: [
      {
        role: "user",
        content: `Extract the quotation below.\n\n${prompt}`,
      },
    ],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );

  if (!toolUse) {
    throw new Error("Claude did not return a tool_use block");
  }

  return toolUse.input as LlmExtractionResult;
}
