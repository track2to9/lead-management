import { NextResponse } from "next/server";
import { getSupabaseAdmin, requireUserId } from "@/lib/supabase-admin";
import type { Quotation, QuotationItem } from "@/lib/types";

// Supabase has no generated Database types in this project, so `from()` returns
// builders typed as `never`. Cast narrowly to this permissive shape only for
// admin SELECT/INSERT/UPDATE/DELETE calls — business logic stays strongly typed
// elsewhere. Matches the pattern in `api/quotations/[id]/reimport/route.ts`.
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

  const admin = getSupabaseAdmin();

  // 2. Fetch source quotation (scoped to this user)
  const quotationsTable = admin.from("quotations") as unknown as SupabaseTable;
  const { data: sourceData, error: fetchErr } = await quotationsTable
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (fetchErr || !sourceData) {
    return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
  }

  const source = sourceData as Quotation;

  // 3. Fetch source items
  const itemsTable = admin.from("quotation_items") as unknown as SupabaseTable;
  const { data: itemsData, error: itemsErr } = await itemsTable
    .select("*")
    .eq("quotation_id", id)
    .order("sort_order", { ascending: true });

  if (itemsErr) {
    return NextResponse.json(
      { error: `Failed to load items: ${itemsErr.message}` },
      { status: 500 },
    );
  }

  const items = (itemsData ?? []) as QuotationItem[];

  const now = new Date();
  const newId = crypto.randomUUID();

  // 4. Clone the quotation row — reset source/status/import fields
  const insertQuotationsTable = admin
    .from("quotations") as unknown as SupabaseTable;
  const { data: newQ, error: insErr } = await insertQuotationsTable
    .insert({
      id: newId,
      user_id: userId,
      template_id: source.template_id ?? null,
      ref_no: `${source.ref_no}-copy`,
      date: now.toISOString().slice(0, 10),
      client_name: source.client_name,
      status: "draft",
      source: "manual",
      columns: source.columns,
      cost_columns: source.cost_columns ?? null,
      currency: source.currency,
      exchange_rates: source.exchange_rates,
      margin_mode: source.margin_mode,
      footer: source.footer,
      company_header: source.company_header,
      global_costs: source.global_costs,
      // import_* fields intentionally null
      import_pdf_url: null,
      import_confidence: null,
      import_source_snapshot: null,
      verified_at: null,
    })
    .select()
    .single();

  if (insErr || !newQ) {
    return NextResponse.json(
      { error: `Clone failed: ${insErr?.message}` },
      { status: 500 },
    );
  }

  // 5. Clone items (if any)
  if (items.length > 0) {
    const cloned = items.map((it) => ({
      quotation_id: newId,
      sort_order: it.sort_order,
      cells: it.cells,
      cost_price: it.cost_price,
      cost_currency: it.cost_currency,
      selling_price: it.selling_price,
      margin_percent: it.margin_percent,
      margin_amount: it.margin_amount,
      extra_costs: it.extra_costs,
    }));
    const insertItemsTable = admin
      .from("quotation_items") as unknown as SupabaseTable;
    const { error: cloneItemsErr } = await insertItemsTable.insert(cloned);
    if (cloneItemsErr) {
      return NextResponse.json(
        { error: `Items clone failed: ${cloneItemsErr.message}` },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ quotation: newQ });
}
