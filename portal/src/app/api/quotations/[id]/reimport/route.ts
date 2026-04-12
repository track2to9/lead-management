import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin, requireUserId } from "@/lib/supabase-admin";
import { extractQuotation } from "@/lib/pdf-extract/llm-extractor";
import type {
  ImportConfidence,
  ImportSourceSnapshot,
  Quotation,
} from "@/lib/types";
import type { LlmExtractionResult } from "@/lib/pdf-extract/extract-types";

// Generous timeout — extraction may take ~30s
export const maxDuration = 60;

// Supabase has no generated Database types in this project, so `from()` returns
// builders typed as `never`. Cast narrowly to this permissive shape only for
// admin SELECT/INSERT/UPDATE/DELETE calls — business logic stays strongly typed
// elsewhere. Matches the pattern in `api/quotations/import/route.ts`.
type SupabaseTable = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  select: (columns?: string) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  insert: (values: any) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  update: (values: any) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete: () => any;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // 1. Auth
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }

  let userId: string;
  try {
    userId = await requireUserId(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Server misconfiguration: ANTHROPIC_API_KEY not set" },
      { status: 500 },
    );
  }

  const admin = getSupabaseAdmin();

  // 2. Fetch the existing quotation (scoped to this user)
  const quotationsTable = admin.from("quotations") as unknown as SupabaseTable;
  const { data: existing, error: fetchErr } = await quotationsTable
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
  }

  const existingQuotation = existing as Quotation;

  if (existingQuotation.source !== "imported_pdf") {
    return NextResponse.json(
      { error: "Not an imported quotation" },
      { status: 400 },
    );
  }
  if (!existingQuotation.import_source_snapshot) {
    return NextResponse.json(
      { error: "No cached snapshot to reimport from" },
      { status: 400 },
    );
  }

  // 3. Re-run LLM extraction against the cached snapshot
  const snapshot = existingQuotation.import_source_snapshot as ImportSourceSnapshot;
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let llm: LlmExtractionResult;
  try {
    llm = await extractQuotation(snapshot, anthropic);
  } catch (e) {
    return NextResponse.json(
      { error: `LLM extraction failed: ${(e as Error).message}` },
      { status: 500 },
    );
  }

  // 4. Delete existing items before re-inserting
  const itemsTable = admin.from("quotation_items") as unknown as SupabaseTable;
  const { error: deleteErr } = await itemsTable.delete().eq("quotation_id", id);
  if (deleteErr) {
    return NextResponse.json(
      { error: `Items delete failed: ${deleteErr.message}` },
      { status: 500 },
    );
  }

  // 5. Map LLM result → DB shape
  const columns = llm.columns.map(({ key, label, type }) => ({ key, label, type }));
  const importConfidence: ImportConfidence = {
    ref_no: llm.ref_no.confidence,
    date: llm.date.confidence,
    client_name: llm.client_name.confidence,
    currency: llm.currency.confidence,
    footer: Object.fromEntries(
      Object.entries(llm.footer).map(([k, v]) => [k, v.confidence]),
    ),
    items: {}, // filled after items are inserted with their ids
    notes_for_human: llm.notes_for_human,
  };

  // 6. Insert new items
  if (llm.items.length > 0) {
    const itemRows = llm.items.map((it, idx) => ({
      quotation_id: id,
      sort_order: idx,
      cells: it.cells,
    }));
    const insertTable = admin.from("quotation_items") as unknown as SupabaseTable;
    const { data: insertedItems, error: itemsErr } = await insertTable
      .insert(itemRows)
      .select();
    if (itemsErr || !insertedItems) {
      return NextResponse.json(
        { error: `Items insert failed: ${itemsErr?.message}` },
        { status: 500 },
      );
    }
    const perItemConfidence: Record<string, Record<string, number>> = {};
    (insertedItems as Array<{ id: string }>).forEach((row, idx) => {
      perItemConfidence[row.id] = llm.items[idx].confidence;
    });
    importConfidence.items = perItemConfidence;
  }

  // 7. Update the quotation row — reset verification state
  const footerValues: Record<string, string> = {};
  for (const [k, v] of Object.entries(llm.footer)) {
    footerValues[k] = v.value;
  }

  const updateTable = admin.from("quotations") as unknown as SupabaseTable;
  const { data: updated, error: updErr } = await updateTable
    .update({
      ref_no: llm.ref_no.value || existingQuotation.ref_no,
      client_name: llm.client_name.value || existingQuotation.client_name,
      currency: llm.currency.value || existingQuotation.currency,
      columns,
      footer: footerValues,
      company_header: llm.company_header ?? existingQuotation.company_header,
      import_confidence: importConfidence,
      status: "imported_unverified",
      verified_at: null,
    })
    .eq("id", id)
    .select()
    .single();

  if (updErr || !updated) {
    return NextResponse.json(
      { error: `Update failed: ${updErr?.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ quotation: updated });
}
