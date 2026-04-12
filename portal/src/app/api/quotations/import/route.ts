import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin, requireUserId } from "@/lib/supabase-admin";
import { extractText } from "@/lib/pdf-extract/text-extractor";
import { extractQuotation } from "@/lib/pdf-extract/llm-extractor";
import type {
  ImportConfidence,
  ImportSourceSnapshot,
} from "@/lib/types";
import type { LlmExtractionResult } from "@/lib/pdf-extract/extract-types";

// Generous timeout — extraction may take ~30s
export const maxDuration = 60;

const BUCKET = "quotation-imports";
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB

// Supabase has no generated Database types in this project, so `from()` returns
// builders typed as `never`. Cast narrowly to this permissive shape only for
// admin INSERT/UPDATE calls — business logic stays strongly typed elsewhere.
type SupabaseTable = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  insert: (values: any) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  update: (values: any) => any;
};

export async function POST(request: Request) {
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

  // Fail fast if server is misconfigured — avoids creating phantom shell rows
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Server misconfiguration: ANTHROPIC_API_KEY not set" },
      { status: 500 },
    );
  }

  // 2. Parse multipart
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'file' field" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File exceeds 20MB limit" }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  // Magic bytes: real PDFs start with "%PDF"
  if (bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46) {
    return NextResponse.json({ error: "File is not a valid PDF" }, { status: 415 });
  }

  const admin = getSupabaseAdmin();

  // 3. Upload to Storage
  const quotationId = crypto.randomUUID();
  const objectPath = `${userId}/${quotationId}/${sanitizeName(file.name)}`;
  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(objectPath, bytes, { contentType: "application/pdf", upsert: false });
  if (uploadErr) {
    return NextResponse.json(
      { error: `Storage upload failed: ${uploadErr.message}` },
      { status: 500 },
    );
  }

  // 4. Stage A: deterministic text extraction
  let snapshot: ImportSourceSnapshot;
  try {
    snapshot = await extractText(bytes);
  } catch (e) {
    return await insertEmptyShell(admin, userId, quotationId, file.name, objectPath, {
      failure_reason: `Text extraction failed: ${(e as Error).message}`,
    });
  }

  // If no text came out, bail with empty shell
  const totalTextLen = snapshot.pages.reduce((s, p) => s + p.text.length, 0);
  if (totalTextLen === 0) {
    return await insertEmptyShell(
      admin,
      userId,
      quotationId,
      file.name,
      objectPath,
      {
        failure_reason: "PDF contained no extractable text (possibly scanned image)",
      },
      snapshot,
    );
  }

  // 5. Stage B: LLM structured extraction
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let llm: LlmExtractionResult;
  try {
    llm = await extractQuotation(snapshot, anthropic);
  } catch (e) {
    return await insertEmptyShell(
      admin,
      userId,
      quotationId,
      file.name,
      objectPath,
      { failure_reason: `LLM extraction failed: ${(e as Error).message}` },
      snapshot,
    );
  }

  // 6. Map LLM result → DB rows
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

  const footerValues: Record<string, string> = {};
  for (const [k, v] of Object.entries(llm.footer)) {
    footerValues[k] = v.value;
  }

  const snapshotForDb: ImportSourceSnapshot = snapshot;
  const importPdfUrl = objectPath; // store path, not public URL — use signed URLs to read

  // Insert quotations row
  const quotationsTable = admin.from("quotations") as unknown as SupabaseTable;
  const { data: quotationRow, error: qErr } = await quotationsTable
    .insert({
      id: quotationId,
      user_id: userId,
      ref_no: llm.ref_no.value || `IMPORT-${quotationId.slice(0, 8)}`,
      date: normalizeDate(llm.date.value),
      client_name: llm.client_name.value || null,
      status: "imported_unverified",
      source: "imported_pdf",
      columns,
      currency: llm.currency.value || "USD",
      exchange_rates: {},
      margin_mode: "forward",
      footer: footerValues,
      company_header: llm.company_header ?? {},
      global_costs: [],
      import_pdf_url: importPdfUrl,
      import_confidence: importConfidence,
      import_source_snapshot: snapshotForDb,
    })
    .select()
    .single();

  if (qErr || !quotationRow) {
    return NextResponse.json(
      { error: `DB insert failed: ${qErr?.message}` },
      { status: 500 },
    );
  }

  // Insert quotation_items
  if (llm.items.length > 0) {
    const itemRows = llm.items.map((it, idx) => ({
      quotation_id: quotationId,
      sort_order: idx,
      cells: it.cells,
    }));
    const itemsTable = admin.from("quotation_items") as unknown as SupabaseTable;
    const { data: insertedItems, error: itemsErr } = await itemsTable
      .insert(itemRows)
      .select();
    if (itemsErr || !insertedItems) {
      return NextResponse.json(
        { error: `Items insert failed: ${itemsErr?.message}` },
        { status: 500 },
      );
    }
    // Back-fill per-item confidence keyed by inserted id
    const perItemConfidence: Record<string, Record<string, number>> = {};
    (insertedItems as Array<{ id: string }>).forEach((row, idx) => {
      perItemConfidence[row.id] = llm.items[idx].confidence;
    });
    importConfidence.items = perItemConfidence;
    const { error: backfillErr } = await (admin.from("quotations") as unknown as SupabaseTable)
      .update({ import_confidence: importConfidence })
      .eq("id", quotationId);
    if (backfillErr) {
      console.error("[import] confidence back-fill failed", {
        quotationId,
        error: backfillErr.message,
      });
    }
  }

  return NextResponse.json({ quotation: quotationRow, status: "ok" });
}

// ---- helpers ----

function sanitizeName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
}

function normalizeDate(raw: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return new Date().toISOString().slice(0, 10);
}

async function insertEmptyShell(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  quotationId: string,
  filename: string,
  objectPath: string,
  confidenceOverrides: Partial<ImportConfidence>,
  snapshot?: ImportSourceSnapshot,
) {
  const quotationsTable = admin.from("quotations") as unknown as SupabaseTable;
  const { data, error } = await quotationsTable
    .insert({
      id: quotationId,
      user_id: userId,
      ref_no: `IMPORT-${quotationId.slice(0, 8)}`,
      date: new Date().toISOString().slice(0, 10),
      client_name: filename,
      status: "imported_unverified",
      source: "imported_pdf",
      columns: [],
      currency: "USD",
      exchange_rates: {},
      margin_mode: "forward",
      footer: {},
      company_header: {},
      global_costs: [],
      import_pdf_url: objectPath,
      import_confidence: confidenceOverrides,
      import_source_snapshot: snapshot ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: `Shell insert failed: ${error?.message}` },
      { status: 500 },
    );
  }
  return NextResponse.json({
    quotation: data,
    status: "partial",
    failure_reason: confidenceOverrides.failure_reason ?? null,
  });
}
