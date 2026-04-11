import { describe, it, expect, vi } from "vitest";
import { extractQuotation } from "./llm-extractor";
import type { ExtractedSnapshot } from "./extract-types";

function makeSnapshot(text: string): ExtractedSnapshot {
  return {
    pages: [{ page_number: 1, text, tables: [] }],
    extracted_at: "2026-04-11T00:00:00.000Z",
  };
}

describe("extractQuotation", () => {
  it("returns structured result when Claude returns a valid tool call", async () => {
    const toolInput = {
      ref_no: { value: "SPS-2024-0312", confidence: 0.95 },
      date: { value: "2024-03-12", confidence: 0.9 },
      client_name: { value: "ACME GmbH", confidence: 0.98 },
      currency: { value: "USD", confidence: 0.99 },
      columns: [
        { key: "model", label: "Model", type: "text", confidence: 0.92 },
        { key: "qty", label: "Q'ty", type: "number", confidence: 0.95 },
        { key: "price", label: "Price", type: "currency", confidence: 0.95 },
      ],
      items: [
        {
          cells: { model: "XYZ-500", qty: 3, price: 2400 },
          confidence: { model: 0.98, qty: 0.98, price: 0.8 },
        },
      ],
      footer: {
        payment_terms: { value: "T/T 30 days", confidence: 0.88 },
      },
      company_header: { name: "SPS Eng" },
      notes_for_human: "",
    };

    const mockCreate = vi.fn().mockResolvedValue({
      content: [
        {
          type: "tool_use",
          id: "t1",
          name: "record_quotation",
          input: toolInput,
        },
      ],
      stop_reason: "tool_use",
    });

    const fakeClient = { messages: { create: mockCreate } } as unknown as import("@anthropic-ai/sdk").default;

    const result = await extractQuotation(makeSnapshot("some text"), fakeClient);

    expect(result.ref_no.value).toBe("SPS-2024-0312");
    expect(result.items).toHaveLength(1);
    expect(result.items[0].cells.qty).toBe(3);
    expect(mockCreate).toHaveBeenCalledOnce();
    expect(mockCreate.mock.calls[0][0].model).toBe("claude-haiku-4-5-20251001");
  });

  it("throws when Claude does not return a tool_use block", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "I cannot do this" }],
      stop_reason: "end_turn",
    });
    const fakeClient = { messages: { create: mockCreate } } as unknown as import("@anthropic-ai/sdk").default;

    await expect(extractQuotation(makeSnapshot("x"), fakeClient)).rejects.toThrow(/tool_use/);
  });
});
