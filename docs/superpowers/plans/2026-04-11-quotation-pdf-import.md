# Quotation PDF Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import legacy quotation PDFs as first-class editable rows in the existing `quotations` table, using deterministic text extraction + Claude Haiku 4.5 structured output. Add clone support (missing from codebase) so past quotations can become templates for new ones.

**Architecture:** Single-file synchronous processing — the client loops through files and POSTs one at a time to a Next.js 16 Route Handler. The route does: Storage upload → `unpdf` text extraction → Anthropic tool-use structured extraction → insert `quotations` + `quotation_items` rows with `source='imported_pdf'`, `status='imported_unverified'`. UI shows confidence-coded cells on imported quotations; editing a cell clears its "needs-review" styling. No background job queue, no polling endpoints.

**Tech Stack:**
- **Portal:** Next.js 16.2.2 (App Router), React 19, TypeScript, Ant Design 5, Refine.dev + Supabase
- **PDF parsing:** `unpdf` (Node-native, works in serverless)
- **LLM:** `@anthropic-ai/sdk` with `claude-haiku-4-5-20251001`, tool use for structured output
- **Testing:** Vitest (new — codebase has no test infra); unit tests for pure modules, manual verification for UI
- **Database:** Supabase Postgres, RLS-based access; migrations via SQL files in `admin/`
- **Storage:** Supabase Storage bucket `quotation-imports`

**⚠️ Next.js 16 caveat:** The `portal/AGENTS.md` notes this is NOT the Next.js you know. Breaking changes exist vs. older versions. Before touching Route Handlers, check `portal/node_modules/next/dist/docs/` for current guidance. Specific gotchas we rely on:
- App Router Route Handlers at `portal/src/app/api/.../route.ts` with `POST` / `GET` named exports
- `Request` / `Response` standard APIs, `NextResponse` from `next/server`
- `request.formData()` for multipart upload parsing
- Route segment config for body size limit if needed

---

## File Structure

### New files

```
portal/src/lib/pdf-extract/
  text-extractor.ts          # unpdf wrapper: PDF buffer → { pages: [{ text, tables }] }
  text-extractor.test.ts     # Vitest unit tests with fixture PDFs
  llm-extractor.ts           # Claude tool-use: snapshot → structured Quotation draft
  llm-extractor.test.ts      # Vitest unit tests with mocked Anthropic client
  extract-types.ts           # Shared ExtractedSnapshot, LlmExtractionResult types
  __fixtures__/
    simple-quotation.pdf     # Hand-crafted test fixture
    broken.pdf               # Empty/corrupt PDF for failure path

portal/src/lib/supabase-admin.ts    # Service-role Supabase client for server-side ops (Storage writes, inserts)

portal/src/app/api/quotations/import/route.ts          # POST — single-file import (sync)
portal/src/app/api/quotations/[id]/reimport/route.ts   # POST — re-run LLM on cached snapshot
portal/src/app/api/quotations/[id]/clone/route.ts      # POST — duplicate a quotation

portal/src/components/quotation/
  ImportDropzone.tsx         # Multi-file drag-drop modal, sequential upload
  VerifyBanner.tsx           # Yellow banner on imported-unverified detail pages

admin/schema_quotation_imports.sql                     # Migration: add columns, storage bucket instructions

portal/vitest.config.ts                                 # Vitest setup
```

### Modified files

```
portal/package.json                                  # Add: unpdf, @anthropic-ai/sdk, vitest, @vitejs/plugin-react
portal/src/lib/types.ts                              # Add new Quotation fields
portal/src/components/quotation/EditableTable.tsx   # Inject confidence-coded cell styling
portal/src/app/dashboard/quotations/page.tsx        # Import button, filter, source badges, clone action
portal/src/app/dashboard/quotations/[id]/page.tsx   # VerifyBanner mount, clone button
```

### File responsibilities

- **`text-extractor.ts`**: Pure function `extractText(buffer: Uint8Array): Promise<ExtractedSnapshot>`. No I/O other than calling `unpdf`. Unit-testable with fixture PDFs.
- **`llm-extractor.ts`**: Pure-ish function `extractQuotation(snapshot, anthropicClient): Promise<LlmExtractionResult>`. Takes the Anthropic client as a parameter so tests can inject a mock.
- **`extract-types.ts`**: All types shared between the two extractors and the Route Handler. No runtime code.
- **`supabase-admin.ts`**: Creates a service-role Supabase client (reads `SUPABASE_SERVICE_ROLE_KEY` from env). Used server-side only, never imported from `"use client"` modules.
- **`/api/quotations/import/route.ts`**: Thin orchestrator. Auth check → read file → call text-extractor → call llm-extractor → Storage upload → DB inserts → return JSON. No business logic of its own; delegates to the two extractors.
- **`ImportDropzone.tsx`**: Client component. Owns the dropzone UI and the sequential upload loop. State = `{ files: [{ name, status, error?, quotationId? }] }`. Closes modal on "done" or stays open showing results.
- **`VerifyBanner.tsx`**: Dumb presentational component. Takes a `Quotation` prop, renders nothing if `source !== 'imported_pdf'`, otherwise renders the yellow strip + notes + "original PDF" link + "Mark verified" button.

---

## Task List

### Task 1: Set up Vitest and add dependencies

**Files:**
- Modify: `portal/package.json`
- Create: `portal/vitest.config.ts`
- Create: `portal/src/lib/pdf-extract/__fixtures__/.gitkeep`

- [ ] **Step 1: Install runtime and dev deps**

Run from `portal/`:

```bash
npm install unpdf @anthropic-ai/sdk
npm install --save-dev vitest @vitest/ui
```

Expected: `portal/package.json` gets three new `dependencies` (`unpdf`, `@anthropic-ai/sdk`) and two new `devDependencies` (`vitest`, `@vitest/ui`).

- [ ] **Step 2: Add `test` script to `portal/package.json`**

Modify the `scripts` block:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 3: Create `portal/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
```

- [ ] **Step 4: Create fixtures folder placeholder**

```bash
mkdir -p portal/src/lib/pdf-extract/__fixtures__
touch portal/src/lib/pdf-extract/__fixtures__/.gitkeep
```

- [ ] **Step 5: Verify vitest runs (no tests yet)**

Run from `portal/`:

```bash
npm test
```

Expected: Vitest runs, reports "no test files found", exit code 0 (or the expected "no tests" behavior for vitest run mode — a non-zero exit code from "no tests found" is acceptable; the fix is to add tests in later tasks).

- [ ] **Step 6: Commit**

```bash
git add portal/package.json portal/package-lock.json portal/vitest.config.ts portal/src/lib/pdf-extract/__fixtures__/.gitkeep
git commit -m "chore: add vitest + unpdf + anthropic sdk"
```

---

### Task 2: Database migration SQL

**Files:**
- Create: `admin/schema_quotation_imports.sql`

- [ ] **Step 1: Write the migration file**

Create `admin/schema_quotation_imports.sql`:

```sql
-- Quotation PDF Import — Phase 1 migration
-- Run in Supabase SQL Editor.

-- 1. New columns on quotations
ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual'
    CHECK (source IN ('manual', 'imported_pdf')),
  ADD COLUMN IF NOT EXISTS import_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS import_confidence JSONB,
  ADD COLUMN IF NOT EXISTS import_source_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- 2. Extend status enum to include 'imported_unverified'
ALTER TABLE quotations DROP CONSTRAINT IF EXISTS quotations_status_check;
ALTER TABLE quotations ADD CONSTRAINT quotations_status_check
  CHECK (status IN ('draft', 'final', 'imported_unverified'));

-- 3. Index for filtering imported quotations
CREATE INDEX IF NOT EXISTS idx_quotations_source_status
  ON quotations(user_id, source, status);

-- 4. Storage bucket (create manually in Supabase Dashboard):
--    Name: quotation-imports
--    Public: false
--    Then run the RLS policies below.

-- 5. Storage RLS — allow users to read/write their own imports
--    Note: path convention is {user_id}/{quotation_id}/{filename}
--    The first path segment must equal auth.uid().

CREATE POLICY "Users can upload their own quotation imports"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'quotation-imports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read their own quotation imports"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'quotation-imports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 2: Apply migration manually**

Open Supabase Dashboard → SQL Editor → paste the file contents → Run.

Also in Dashboard:
1. Storage → Create bucket `quotation-imports` (Public: OFF)
2. Verify RLS policies exist on `storage.objects` for the bucket

- [ ] **Step 3: Commit**

```bash
git add admin/schema_quotation_imports.sql
git commit -m "feat(db): add quotation import columns and storage bucket"
```

---

### Task 3: Update TypeScript types

**Files:**
- Modify: `portal/src/lib/types.ts:158-176`

- [ ] **Step 1: Update `Quotation` interface**

In `portal/src/lib/types.ts`, replace the `Quotation` interface with:

```ts
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
  cost_columns?: QuotationColumn[];
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
```

- [ ] **Step 2: Run build to verify no type errors**

From `portal/`:

```bash
npm run build
```

Expected: Build succeeds. If there are type errors in files that reference `Quotation`, fix them conservatively — e.g. adding `source: 'manual'` as a default when creating quotations in `new/page.tsx`. (The new quotation page at line 82-99 of `new/page.tsx` creates quotations but does not set `source`; rely on the DB default.)

- [ ] **Step 3: Commit**

```bash
git add portal/src/lib/types.ts
git commit -m "feat(types): add quotation import fields"
```

---

### Task 4: Shared extraction types module

**Files:**
- Create: `portal/src/lib/pdf-extract/extract-types.ts`

- [ ] **Step 1: Write the types file**

```ts
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
```

- [ ] **Step 2: Verify it compiles**

```bash
cd portal && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add portal/src/lib/pdf-extract/extract-types.ts
git commit -m "feat(pdf-extract): add shared extraction types"
```

---

### Task 5: PDF text extractor (deterministic stage A)

**Files:**
- Create: `portal/src/lib/pdf-extract/text-extractor.ts`
- Create: `portal/src/lib/pdf-extract/text-extractor.test.ts`
- Create: `portal/src/lib/pdf-extract/__fixtures__/simple-quotation.pdf` (obtained or generated — see Step 1)

- [ ] **Step 1: Generate a tiny fixture PDF**

We need a small real PDF with known text content. Create it using `pdf-lib` or download a sample. Easiest: create with a Node one-liner using `pdf-lib`:

```bash
cd portal
npm install --save-dev pdf-lib
node -e "
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
(async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText('Quotation Ref: SPS-2024-0312', { x: 50, y: 780, size: 12, font });
  page.drawText('Client: ACME GmbH', { x: 50, y: 760, size: 12, font });
  page.drawText('Date: 2024-03-12', { x: 50, y: 740, size: 12, font });
  page.drawText('Item: Widget A    Qty: 3    Price: USD 2400', { x: 50, y: 700, size: 12, font });
  const bytes = await doc.save();
  fs.writeFileSync('src/lib/pdf-extract/__fixtures__/simple-quotation.pdf', bytes);
  console.log('wrote', bytes.length, 'bytes');
})();
"
```

Expected: File `portal/src/lib/pdf-extract/__fixtures__/simple-quotation.pdf` exists, around 1-2 KB.

- [ ] **Step 2: Write the failing test**

Create `portal/src/lib/pdf-extract/text-extractor.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { extractText } from "./text-extractor";

const FIXTURE_DIR = path.resolve(__dirname, "__fixtures__");

describe("extractText", () => {
  it("extracts text from a simple single-page PDF", async () => {
    const buf = await readFile(path.join(FIXTURE_DIR, "simple-quotation.pdf"));
    const snapshot = await extractText(new Uint8Array(buf));

    expect(snapshot.pages).toHaveLength(1);
    expect(snapshot.pages[0].page_number).toBe(1);
    expect(snapshot.pages[0].text).toContain("SPS-2024-0312");
    expect(snapshot.pages[0].text).toContain("ACME GmbH");
    expect(snapshot.pages[0].text).toContain("2024-03-12");
    expect(typeof snapshot.extracted_at).toBe("string");
  });

  it("returns empty pages when PDF bytes are empty", async () => {
    await expect(extractText(new Uint8Array(0))).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd portal && npm test -- text-extractor
```

Expected: FAIL with `Cannot find module './text-extractor'` or similar.

- [ ] **Step 4: Write the minimal implementation**

Create `portal/src/lib/pdf-extract/text-extractor.ts`:

```ts
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
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd portal && npm test -- text-extractor
```

Expected: PASS on "extracts text from a simple single-page PDF" and "returns empty pages when PDF bytes are empty".

If `unpdf`'s API differs from what's shown above, consult `portal/node_modules/unpdf/README.md` and adjust — the goal is to return one entry per page with the page's text string.

- [ ] **Step 6: Commit**

```bash
git add portal/src/lib/pdf-extract/text-extractor.ts \
        portal/src/lib/pdf-extract/text-extractor.test.ts \
        portal/src/lib/pdf-extract/__fixtures__/simple-quotation.pdf \
        portal/package.json portal/package-lock.json
git commit -m "feat(pdf-extract): deterministic text extraction via unpdf"
```

---

### Task 6: LLM structured extractor (stage B)

**Files:**
- Create: `portal/src/lib/pdf-extract/llm-extractor.ts`
- Create: `portal/src/lib/pdf-extract/llm-extractor.test.ts`

- [ ] **Step 1: Write the failing test (with a mocked Anthropic client)**

Create `portal/src/lib/pdf-extract/llm-extractor.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd portal && npm test -- llm-extractor
```

Expected: FAIL with `Cannot find module './llm-extractor'`.

- [ ] **Step 3: Write the minimal implementation**

Create `portal/src/lib/pdf-extract/llm-extractor.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify both test cases pass**

```bash
cd portal && npm test -- llm-extractor
```

Expected: PASS on both "returns structured result when Claude returns a valid tool call" and "throws when Claude does not return a tool_use block".

- [ ] **Step 5: Commit**

```bash
git add portal/src/lib/pdf-extract/llm-extractor.ts portal/src/lib/pdf-extract/llm-extractor.test.ts
git commit -m "feat(pdf-extract): Claude-based structured quotation extractor"
```

---

### Task 7: Supabase service-role admin client

**Files:**
- Create: `portal/src/lib/supabase-admin.ts`

- [ ] **Step 1: Write the admin client module**

```ts
// portal/src/lib/supabase-admin.ts
// Server-side only. NEVER import from a "use client" module.
import { createClient } from "@supabase/supabase-js";

let cached: ReturnType<typeof createClient> | null = null;

/**
 * Service-role Supabase client for server-side operations (Route Handlers).
 * Has elevated privileges — only use for trusted server-originated requests,
 * and only after authenticating the user via their access token.
 */
export function getSupabaseAdmin() {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/**
 * Given a user access token (from the Authorization header or cookie),
 * verify it and return the user id. Throws if invalid.
 */
export async function requireUserId(accessToken: string): Promise<string> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.getUser(accessToken);
  if (error || !data.user) {
    throw new Error("Unauthorized");
  }
  return data.user.id;
}
```

- [ ] **Step 2: Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local`**

Open `portal/.env.local` and add the key (ask user for value; NEVER commit real keys). Add a placeholder entry now and mark TODO for the user to fill in:

```bash
# portal/.env.local — local only, do not commit
SUPABASE_SERVICE_ROLE_KEY=<ask user to paste from Supabase Dashboard → Settings → API>
```

Verify `.env.local` is in `.gitignore` (it should be — commit `35b1bcd` shows it was removed from tracking).

- [ ] **Step 3: Typecheck**

```bash
cd portal && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add portal/src/lib/supabase-admin.ts
git commit -m "feat(lib): add service-role supabase client for server-side ops"
```

---

### Task 8: Import Route Handler — `POST /api/quotations/import`

**Files:**
- Create: `portal/src/app/api/quotations/import/route.ts`

- [ ] **Step 1: Skim the Next.js 16 Route Handler docs**

Before writing, read `portal/node_modules/next/dist/docs/` (specifically anything about "route-handlers" or "app/api") to confirm the current API for:
- Declaring `POST` as a named export
- Parsing multipart via `request.formData()`
- Returning JSON responses

- [ ] **Step 2: Write the Route Handler**

Create `portal/src/app/api/quotations/import/route.ts`:

```ts
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
  const admin = getSupabaseAdmin();

  // 3. Upload to Storage
  const quotationId = crypto.randomUUID();
  const objectPath = `${userId}/${quotationId}/${sanitizeName(file.name)}`;
  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(objectPath, bytes, { contentType: "application/pdf", upsert: false });
  if (uploadErr) {
    return NextResponse.json({ error: `Storage upload failed: ${uploadErr.message}` }, { status: 500 });
  }

  // 4. Stage A: deterministic text extraction
  let snapshot;
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
    return await insertEmptyShell(admin, userId, quotationId, file.name, objectPath, {
      failure_reason: "PDF contained no extractable text (possibly scanned image)",
    }, snapshot);
  }

  // 5. Stage B: LLM structured extraction
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let llm: LlmExtractionResult;
  try {
    llm = await extractQuotation(snapshot, anthropic);
  } catch (e) {
    return await insertEmptyShell(admin, userId, quotationId, file.name, objectPath, {
      failure_reason: `LLM extraction failed: ${(e as Error).message}`,
    }, snapshot);
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
  const { data: quotationRow, error: qErr } = await admin
    .from("quotations")
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
    const { data: insertedItems, error: itemsErr } = await admin
      .from("quotation_items")
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
    insertedItems.forEach((row, idx) => {
      perItemConfidence[row.id as string] = llm.items[idx].confidence;
    });
    importConfidence.items = perItemConfidence;
    await admin
      .from("quotations")
      .update({ import_confidence: importConfidence })
      .eq("id", quotationId);
  }

  return NextResponse.json({ quotation: quotationRow });
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
  const { data, error } = await admin
    .from("quotations")
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
    return NextResponse.json({ error: `Shell insert failed: ${error?.message}` }, { status: 500 });
  }
  return NextResponse.json({ quotation: data });
}
```

- [ ] **Step 3: Verify it typechecks**

```bash
cd portal && npx tsc --noEmit
```

Expected: No errors. If Anthropic SDK types for `ToolUseBlock` differ, adjust the import path but keep behavior identical.

- [ ] **Step 4: Manual smoke test**

Start dev server: `npm run dev` (from `portal/`). In a second terminal:

```bash
# Get a user access token from your logged-in browser session's
# Supabase storage: open devtools → Application → Local Storage →
# copy the access_token. Save as $TOKEN.

curl -X POST http://localhost:3000/api/quotations/import \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@portal/src/lib/pdf-extract/__fixtures__/simple-quotation.pdf"
```

Expected: 200 OK, JSON body with `quotation` containing `source: "imported_pdf"`, `status: "imported_unverified"`, and a populated `ref_no`. Verify in Supabase Dashboard that the row appears and the PDF is in Storage.

- [ ] **Step 5: Commit**

```bash
git add portal/src/app/api/quotations/import/route.ts
git commit -m "feat(api): POST /api/quotations/import for synchronous PDF import"
```

---

### Task 9: Reimport Route Handler — `POST /api/quotations/:id/reimport`

**Files:**
- Create: `portal/src/app/api/quotations/[id]/reimport/route.ts`

- [ ] **Step 1: Write the Route Handler**

```ts
// portal/src/app/api/quotations/[id]/reimport/route.ts
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin, requireUserId } from "@/lib/supabase-admin";
import { extractQuotation } from "@/lib/pdf-extract/llm-extractor";
import type {
  ImportConfidence,
  ImportSourceSnapshot,
  Quotation,
} from "@/lib/types";

export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

  let userId: string;
  try {
    userId = await requireUserId(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();

  const { data: existing, error: fetchErr } = await admin
    .from("quotations")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single<Quotation>();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
  }
  if (existing.source !== "imported_pdf") {
    return NextResponse.json({ error: "Not an imported quotation" }, { status: 400 });
  }
  if (!existing.import_source_snapshot) {
    return NextResponse.json({ error: "No cached snapshot to reimport from" }, { status: 400 });
  }

  const snapshot = existing.import_source_snapshot as ImportSourceSnapshot;
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let llm;
  try {
    llm = await extractQuotation(snapshot, anthropic);
  } catch (e) {
    return NextResponse.json(
      { error: `LLM extraction failed: ${(e as Error).message}` },
      { status: 500 },
    );
  }

  // Delete existing items, insert new
  await admin.from("quotation_items").delete().eq("quotation_id", id);

  const columns = llm.columns.map(({ key, label, type }) => ({ key, label, type }));
  const importConfidence: ImportConfidence = {
    ref_no: llm.ref_no.confidence,
    date: llm.date.confidence,
    client_name: llm.client_name.confidence,
    currency: llm.currency.confidence,
    footer: Object.fromEntries(
      Object.entries(llm.footer).map(([k, v]) => [k, v.confidence]),
    ),
    items: {},
    notes_for_human: llm.notes_for_human,
  };

  if (llm.items.length > 0) {
    const { data: insertedItems, error: itemsErr } = await admin
      .from("quotation_items")
      .insert(
        llm.items.map((it, idx) => ({
          quotation_id: id,
          sort_order: idx,
          cells: it.cells,
        })),
      )
      .select();
    if (itemsErr || !insertedItems) {
      return NextResponse.json({ error: `Items insert failed: ${itemsErr?.message}` }, { status: 500 });
    }
    const perItem: Record<string, Record<string, number>> = {};
    insertedItems.forEach((row, idx) => {
      perItem[row.id as string] = llm.items[idx].confidence;
    });
    importConfidence.items = perItem;
  }

  const { data: updated, error: updErr } = await admin
    .from("quotations")
    .update({
      ref_no: llm.ref_no.value || existing.ref_no,
      client_name: llm.client_name.value || existing.client_name,
      currency: llm.currency.value || existing.currency,
      columns,
      footer: Object.fromEntries(
        Object.entries(llm.footer).map(([k, v]) => [k, v.value]),
      ),
      company_header: llm.company_header ?? existing.company_header,
      import_confidence: importConfidence,
      status: "imported_unverified",
      verified_at: null,
    })
    .eq("id", id)
    .select()
    .single();

  if (updErr || !updated) {
    return NextResponse.json({ error: `Update failed: ${updErr?.message}` }, { status: 500 });
  }

  return NextResponse.json({ quotation: updated });
}
```

- [ ] **Step 2: Typecheck**

```bash
cd portal && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add portal/src/app/api/quotations/\[id\]/reimport/route.ts
git commit -m "feat(api): POST /api/quotations/:id/reimport"
```

---

### Task 10: Clone Route Handler — `POST /api/quotations/:id/clone`

**Files:**
- Create: `portal/src/app/api/quotations/[id]/clone/route.ts`

- [ ] **Step 1: Write the Route Handler**

```ts
// portal/src/app/api/quotations/[id]/clone/route.ts
import { NextResponse } from "next/server";
import { getSupabaseAdmin, requireUserId } from "@/lib/supabase-admin";
import type { Quotation, QuotationItem } from "@/lib/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

  let userId: string;
  try {
    userId = await requireUserId(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();

  const { data: source, error: fetchErr } = await admin
    .from("quotations")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single<Quotation>();

  if (fetchErr || !source) {
    return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
  }

  const { data: items, error: itemsErr } = await admin
    .from("quotation_items")
    .select("*")
    .eq("quotation_id", id)
    .order("sort_order", { ascending: true })
    .returns<QuotationItem[]>();

  if (itemsErr) {
    return NextResponse.json({ error: `Failed to load items: ${itemsErr.message}` }, { status: 500 });
  }

  const now = new Date();
  const newId = crypto.randomUUID();

  // Clone quotation
  const { data: newQ, error: insErr } = await admin
    .from("quotations")
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
    return NextResponse.json({ error: `Clone failed: ${insErr?.message}` }, { status: 500 });
  }

  // Clone items (if any)
  if ((items ?? []).length > 0) {
    const cloned = (items ?? []).map((it) => ({
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
    const { error: cloneItemsErr } = await admin.from("quotation_items").insert(cloned);
    if (cloneItemsErr) {
      return NextResponse.json(
        { error: `Items clone failed: ${cloneItemsErr.message}` },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ quotation: newQ });
}
```

- [ ] **Step 2: Typecheck**

```bash
cd portal && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add portal/src/app/api/quotations/\[id\]/clone/route.ts
git commit -m "feat(api): POST /api/quotations/:id/clone"
```

---

### Task 11: ImportDropzone component

**Files:**
- Create: `portal/src/components/quotation/ImportDropzone.tsx`

- [ ] **Step 1: Write the component**

```tsx
// portal/src/components/quotation/ImportDropzone.tsx
"use client";

import { useState } from "react";
import { Modal, Upload, Button, List, Tag, Typography, Space } from "antd";
import { InboxOutlined } from "@ant-design/icons";
import type { UploadFile } from "antd";
import { supabaseClient } from "@/lib/supabase-client";

const { Dragger } = Upload;
const { Text } = Typography;

type FileStatus = "pending" | "uploading" | "done" | "failed";

interface RowState {
  uid: string;
  name: string;
  status: FileStatus;
  error?: string;
  quotationId?: string;
  confidenceAvg?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onAllDone: () => void;
}

export default function ImportDropzone({ open, onClose, onAllDone }: Props) {
  const [rows, setRows] = useState<RowState[]>([]);
  const [running, setRunning] = useState(false);

  function addFiles(files: File[]) {
    setRows((prev) => [
      ...prev,
      ...files.map((f) => ({
        uid: `${f.name}-${Date.now()}-${Math.random()}`,
        name: f.name,
        status: "pending" as FileStatus,
      })),
    ]);
  }

  async function runSequentialUpload(files: File[]) {
    setRunning(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const uid = rows[i]?.uid ?? `${file.name}-${i}`;
      updateRow(uid, { status: "uploading" });

      try {
        const { data: session } = await supabaseClient.auth.getSession();
        const token = session.session?.access_token;
        if (!token) throw new Error("Not logged in");

        const fd = new FormData();
        fd.append("file", file);

        const res = await fetch("/api/quotations/import", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        const body = await res.json();

        if (!res.ok) {
          updateRow(uid, { status: "failed", error: body.error ?? `HTTP ${res.status}` });
          continue;
        }

        const confs = extractConfidences(body.quotation?.import_confidence);
        const avg = confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : undefined;

        updateRow(uid, {
          status: "done",
          quotationId: body.quotation?.id,
          confidenceAvg: avg,
        });
      } catch (e) {
        updateRow(uid, { status: "failed", error: (e as Error).message });
      }
    }
    setRunning(false);
    onAllDone();
  }

  function updateRow(uid: string, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));
  }

  function handleBeforeUpload(file: File, fileList: File[]) {
    addFiles(fileList);
    // When Dragger batches, runSequentialUpload kicks off once (on the last file)
    if (file === fileList[fileList.length - 1]) {
      void runSequentialUpload(fileList);
    }
    return false; // prevent default upload
  }

  return (
    <Modal
      title="PDF 견적서 임포트"
      open={open}
      onCancel={running ? undefined : onClose}
      footer={[
        <Button key="close" onClick={onClose} disabled={running}>
          닫기
        </Button>,
      ]}
      width={640}
    >
      <Dragger
        multiple
        accept="application/pdf"
        beforeUpload={handleBeforeUpload}
        showUploadList={false}
        disabled={running}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">PDF 파일을 여기로 끌어다 놓으세요</p>
        <p className="ant-upload-hint">여러 파일을 한 번에 선택할 수 있습니다. 파일당 최대 20MB.</p>
      </Dragger>

      <List
        style={{ marginTop: 16 }}
        dataSource={rows}
        locale={{ emptyText: "대기 중..." }}
        renderItem={(row) => (
          <List.Item>
            <Space>
              <Text>{row.name}</Text>
              <StatusTag row={row} />
              {row.error && <Text type="danger">{row.error}</Text>}
            </Space>
          </List.Item>
        )}
      />
    </Modal>
  );
}

function StatusTag({ row }: { row: RowState }) {
  switch (row.status) {
    case "pending":
      return <Tag>대기</Tag>;
    case "uploading":
      return <Tag color="processing">추출 중</Tag>;
    case "done":
      return (
        <Tag color="success">
          완료{row.confidenceAvg !== undefined ? ` (${Math.round(row.confidenceAvg * 100)}%)` : ""}
        </Tag>
      );
    case "failed":
      return <Tag color="error">실패</Tag>;
  }
}

function extractConfidences(
  imp: Record<string, unknown> | null | undefined,
): number[] {
  if (!imp) return [];
  const out: number[] = [];
  for (const v of Object.values(imp)) {
    if (typeof v === "number") out.push(v);
  }
  return out;
}
```

- [ ] **Step 2: Typecheck**

```bash
cd portal && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add portal/src/components/quotation/ImportDropzone.tsx
git commit -m "feat(ui): ImportDropzone modal with sequential upload"
```

---

### Task 12: VerifyBanner component

**Files:**
- Create: `portal/src/components/quotation/VerifyBanner.tsx`

- [ ] **Step 1: Write the component**

```tsx
// portal/src/components/quotation/VerifyBanner.tsx
"use client";

import { Alert, Button, Space, Typography } from "antd";
import { FilePdfOutlined, CheckCircleOutlined } from "@ant-design/icons";
import { useState } from "react";
import { supabaseClient } from "@/lib/supabase-client";
import type { Quotation } from "@/lib/types";

const { Text } = Typography;

interface Props {
  quotation: Quotation;
  onVerified: (updated: Quotation) => void;
}

export default function VerifyBanner({ quotation, onVerified }: Props) {
  const [signing, setSigning] = useState(false);
  const [verifying, setVerifying] = useState(false);

  if (quotation.source !== "imported_pdf") return null;
  const needsReview = quotation.status === "imported_unverified";

  async function openOriginal() {
    if (!quotation.import_pdf_url) return;
    setSigning(true);
    try {
      const { data, error } = await supabaseClient.storage
        .from("quotation-imports")
        .createSignedUrl(quotation.import_pdf_url, 300);
      if (error) throw error;
      window.open(data.signedUrl, "_blank", "noopener");
    } finally {
      setSigning(false);
    }
  }

  async function markVerified() {
    setVerifying(true);
    try {
      const { data, error } = await supabaseClient
        .from("quotations")
        .update({ status: "draft", verified_at: new Date().toISOString() })
        .eq("id", quotation.id)
        .select()
        .single();
      if (error || !data) throw error ?? new Error("Update failed");
      onVerified(data as Quotation);
    } finally {
      setVerifying(false);
    }
  }

  const note = quotation.import_confidence?.notes_for_human;
  const failure = quotation.import_confidence?.failure_reason;

  return (
    <Alert
      type={failure ? "error" : needsReview ? "warning" : "info"}
      showIcon
      style={{ marginBottom: 16 }}
      message={
        failure
          ? "이 PDF는 자동 추출에 실패했습니다"
          : needsReview
          ? "이 견적서는 PDF에서 자동 추출되었습니다"
          : "PDF에서 임포트된 견적서 (검증 완료)"
      }
      description={
        <Space direction="vertical" size={4} style={{ width: "100%" }}>
          {failure && <Text type="danger">{failure}</Text>}
          {note && !failure && <Text type="secondary">{note}</Text>}
          {!failure && needsReview && (
            <Text type="secondary">
              노란 셀은 신뢰도가 낮은 필드입니다. 확인 후 고치세요. 복제해서 새 견적서로 쓰는 경우 수정 불필요.
            </Text>
          )}
          <Space>
            {quotation.import_pdf_url && (
              <Button
                size="small"
                icon={<FilePdfOutlined />}
                loading={signing}
                onClick={openOriginal}
              >
                원본 PDF 보기
              </Button>
            )}
            {needsReview && (
              <Button
                size="small"
                type="primary"
                icon={<CheckCircleOutlined />}
                loading={verifying}
                onClick={markVerified}
              >
                확인 완료
              </Button>
            )}
          </Space>
        </Space>
      }
    />
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd portal && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add portal/src/components/quotation/VerifyBanner.tsx
git commit -m "feat(ui): VerifyBanner for imported quotations"
```

---

### Task 13: EditableTable confidence visualization

**Files:**
- Modify: `portal/src/components/quotation/EditableTable.tsx`

- [ ] **Step 1: Extend the Props interface**

Locate the `interface Props` block (around line 9 of `EditableTable.tsx`) and add an optional `confidenceMap` prop:

```tsx
interface Props {
  columns: QuotationColumn[];
  items: QuotationItem[];
  currency: string;
  onItemChange: (itemId: string, cells: Record<string, string | number>) => void;
  onAddItem: () => void;
  onRemoveItem: (itemId: string) => void;
  onAddColumn: (column: QuotationColumn) => void;
  onRemoveColumn: (key: string) => void;
  /** Optional: per-item per-cell confidence (0..1). Cells below 0.9 get highlighted. */
  confidenceMap?: Record<string, Record<string, number>>;
}
```

- [ ] **Step 2: Accept the prop in the component signature**

```tsx
export default function EditableTable({
  columns, items, currency, onItemChange, onAddItem, onRemoveItem, onAddColumn, onRemoveColumn,
  confidenceMap,
}: Props) {
```

- [ ] **Step 3: Add a helper and apply styling to cell renderers**

Find the cell render logic inside the `columns.map(...)` construction of `tableColumns`. For each regular column cell, wrap the rendered value with a styled `<span>` whose background color depends on the confidence for that `(itemId, colKey)` pair.

Add this helper above `tableColumns`:

```tsx
function confidenceStyle(itemId: string, key: string): React.CSSProperties | undefined {
  const c = confidenceMap?.[itemId]?.[key];
  if (c === undefined) return undefined;
  if (c >= 0.9) return undefined;
  if (c >= 0.7) {
    return { backgroundColor: "#fff7db", display: "block", padding: 2 };
  }
  return {
    backgroundColor: "#fff1b8",
    border: "1px dashed #d48806",
    display: "block",
    padding: 2,
  };
}
```

Then in the cell renderer (wherever the non-editing cell value is rendered inside `columns.map`), wrap the display value:

```tsx
// Before (simplified, existing code):
// return <span>{value}</span>;

// After:
return (
  <span style={confidenceStyle(record.id, col.key)} title={
    confidenceMap?.[record.id]?.[col.key] !== undefined
      ? `confidence: ${Math.round((confidenceMap[record.id][col.key] ?? 0) * 100)}%`
      : undefined
  }>
    {value}
  </span>
);
```

(Exact edit will depend on the current shape of that function — do NOT rewrite the whole file. Only add the helper and adjust the specific rendering span.)

- [ ] **Step 4: Clear confidence for edited cells**

In `handleCellChange`, after computing `newCells`, also invoke a callback if we track confidence changes. Since confidence lives in the parent's `quotation.import_confidence.items`, the parent page will handle the update. For the component itself, we only need to ensure that when `confidenceMap` is updated by the parent, styling goes away. No change needed here beyond the prop — the parent (Task 15) will update confidence when the user edits a cell.

- [ ] **Step 5: Typecheck**

```bash
cd portal && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add portal/src/components/quotation/EditableTable.tsx
git commit -m "feat(ui): confidence-coded cells in EditableTable"
```

---

### Task 14: Quotations list page integration

**Files:**
- Modify: `portal/src/app/dashboard/quotations/page.tsx`

- [ ] **Step 1: Add state and imports**

Replace the file contents (rewrite is simplest here — the file is only ~68 lines):

```tsx
"use client";

import { useList } from "@refinedev/core";
import { Table, Tag, Button, Typography, Space, Select, Tooltip } from "antd";
import { PlusOutlined, FilePdfOutlined, PaperClipOutlined, WarningOutlined } from "@ant-design/icons";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Quotation } from "@/lib/types";
import ImportDropzone from "@/components/quotation/ImportDropzone";

const { Title, Text } = Typography;

type Filter = "all" | "manual" | "imported" | "unverified";

export default function QuotationsPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [importOpen, setImportOpen] = useState(false);

  const { query } = useList<Quotation>({
    resource: "quotations",
    sorters: [{ field: "created_at", order: "desc" }],
    pagination: { pageSize: 200 },
  });

  const all = query.data?.data ?? [];
  const quotations = useMemo(() => {
    switch (filter) {
      case "manual":
        return all.filter((q) => q.source === "manual");
      case "imported":
        return all.filter((q) => q.source === "imported_pdf");
      case "unverified":
        return all.filter(
          (q) => q.source === "imported_pdf" && q.status === "imported_unverified",
        );
      default:
        return all;
    }
  }, [all, filter]);

  const unverifiedCount = all.filter(
    (q) => q.source === "imported_pdf" && q.status === "imported_unverified",
  ).length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>견적서</Title>
          <Text type="secondary">{quotations.length}개 표시 중 (전체 {all.length}개)</Text>
        </div>
        <Space>
          <Select
            value={filter}
            style={{ width: 180 }}
            onChange={(v) => setFilter(v)}
            options={[
              { value: "all", label: "전체" },
              { value: "manual", label: "수기 작성" },
              { value: "imported", label: "임포트됨" },
              { value: "unverified", label: `검증 필요${unverifiedCount ? ` (${unverifiedCount})` : ""}` },
            ]}
          />
          <Button icon={<FilePdfOutlined />} onClick={() => setImportOpen(true)}>
            PDF 임포트
          </Button>
          <Link href="/dashboard/quotations/new">
            <Button type="primary" icon={<PlusOutlined />}>새 견적서</Button>
          </Link>
        </Space>
      </div>

      <Table
        dataSource={quotations}
        rowKey="id"
        loading={query.isLoading}
        pagination={{ pageSize: 20, showTotal: (t) => `총 ${t}개` }}
        onRow={(record) => ({
          onClick: () => (window.location.href = `/dashboard/quotations/${record.id}`),
          style: { cursor: "pointer" },
        })}
        columns={[
          {
            title: "Ref No",
            dataIndex: "ref_no",
            key: "ref_no",
            width: 200,
            render: (v: string, row: Quotation) => (
              <Space>
                <Text strong>{v}</Text>
                {row.source === "imported_pdf" && row.status === "imported_unverified" && (
                  <Tooltip title="PDF 임포트, 검증 필요">
                    <WarningOutlined style={{ color: "#d48806" }} />
                  </Tooltip>
                )}
                {row.source === "imported_pdf" && row.status !== "imported_unverified" && (
                  <Tooltip title="PDF에서 임포트">
                    <PaperClipOutlined style={{ color: "#8c8c8c" }} />
                  </Tooltip>
                )}
              </Space>
            ),
          },
          { title: "업체", dataIndex: "client_name", key: "client", width: 200 },
          {
            title: "통화", dataIndex: "currency", key: "currency", width: 80,
            render: (v: string) => <Tag>{v}</Tag>,
          },
          {
            title: "상태", dataIndex: "status", key: "status", width: 120,
            render: (s: Quotation["status"]) => {
              if (s === "final") return <Tag color="green">완료</Tag>;
              if (s === "imported_unverified") return <Tag color="gold">검증 필요</Tag>;
              return <Tag>작성 중</Tag>;
            },
          },
          { title: "날짜", dataIndex: "date", key: "date", width: 120 },
          {
            title: "생성일", dataIndex: "created_at", key: "created", width: 120,
            render: (v: string) => v?.split("T")[0],
          },
        ]}
      />

      <ImportDropzone
        open={importOpen}
        onClose={() => {
          setImportOpen(false);
          void query.refetch();
        }}
        onAllDone={() => void query.refetch()}
      />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd portal && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Manual smoke test**

Run `npm run dev`, navigate to `/dashboard/quotations`. Expected:
- "PDF 임포트" button visible next to "새 견적서"
- Filter dropdown works (even with no imported quotations yet, "전체" and "수기 작성" both show the same rows, "임포트됨" and "검증 필요" show empty)
- Clicking "PDF 임포트" opens the modal
- Uploading a test PDF runs the full pipeline and a new row appears with the warning icon

- [ ] **Step 4: Commit**

```bash
git add portal/src/app/dashboard/quotations/page.tsx
git commit -m "feat(ui): quotations list — import button, filter, source badges"
```

---

### Task 15: Quotation detail page integration

**Files:**
- Modify: `portal/src/app/dashboard/quotations/[id]/page.tsx`

This file is ~800+ lines; make targeted edits only.

- [ ] **Step 1: Add imports at top of file**

After the existing component imports (near line 14-16), add:

```tsx
import VerifyBanner from "@/components/quotation/VerifyBanner";
```

- [ ] **Step 2: Mount `VerifyBanner` in the JSX**

Find the top-level JSX return (after the `if (qq.isLoading || !localQ)` early return). At the very top of the main render output, before the existing `Breadcrumb` or page header, insert:

```tsx
<VerifyBanner
  quotation={quotation}
  onVerified={(updated) => {
    setLocalQ((prev) => (prev ? { ...prev, ...updated } : prev));
  }}
/>
```

- [ ] **Step 3: Pass `confidenceMap` to `EditableTable`**

Find the `<EditableTable ... />` invocation. Add the `confidenceMap` prop:

```tsx
<EditableTable
  columns={quotation.columns}
  items={items}
  currency={quotation.currency}
  onItemChange={(itemId, cells) => { /* existing handler */ }}
  onAddItem={...}
  onRemoveItem={...}
  onAddColumn={...}
  onRemoveColumn={...}
  confidenceMap={quotation.import_confidence?.items}
/>
```

- [ ] **Step 4: Clear confidence on cell edit**

In the `onItemChange` handler passed to `EditableTable`, after updating `localItems`, also clear the confidence for every key that changed. Find the handler (look for `function editItem` or the inline arrow). Immediately after the `setLocalItems(...)` call, add:

```tsx
// Clear confidence markers for any cell the user touched (imported quotations only)
if (quotation.source === "imported_pdf" && quotation.import_confidence?.items?.[itemId]) {
  const currentItemConf = { ...quotation.import_confidence.items[itemId] };
  const prevItem = localItems.find((i) => i.id === itemId);
  if (prevItem) {
    for (const k of Object.keys(values.cells ?? {})) {
      if ((prevItem.cells as Record<string, unknown>)[k] !== (values.cells as Record<string, unknown>)[k]) {
        delete currentItemConf[k];
      }
    }
  }
  const nextImportConfidence = {
    ...quotation.import_confidence,
    items: { ...quotation.import_confidence.items, [itemId]: currentItemConf },
  };
  editQ({ import_confidence: nextImportConfidence });
}
```

Note: the exact integration point depends on the existing cell-update handler shape. The principle is: whenever a cell value changes on an imported quotation, drop that `(itemId, cellKey)` entry from `quotation.import_confidence.items[itemId]` so the visualization clears.

- [ ] **Step 5: Add a "복제" (clone) button**

Find the action bar area of the detail page (near the "PDF 미리보기" button or similar). Add:

```tsx
<Button
  icon={<CopyOutlined />}
  onClick={async () => {
    const { data: session } = await supabaseClient.auth.getSession();
    const token = session.session?.access_token;
    if (!token) return;
    const res = await fetch(`/api/quotations/${quotation.id}/clone`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      // Show error with antd message
      return;
    }
    const body = await res.json();
    window.location.href = `/dashboard/quotations/${body.quotation.id}`;
  }}
>
  복제
</Button>
```

And add `CopyOutlined` to the `@ant-design/icons` import at the top of the file, and `supabaseClient` to `@/lib/supabase-client` import if not already present.

- [ ] **Step 6: Typecheck**

```bash
cd portal && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 7: Manual smoke test**

Start dev server, import a test PDF via the list page, click into the imported quotation. Verify:
- VerifyBanner shows at top with "원본 PDF 보기" and "확인 완료" buttons
- Low-confidence cells have yellow backgrounds
- Editing a low-confidence cell clears its yellow background
- Clicking "원본 PDF 보기" opens the PDF in a new tab (signed URL works)
- Clicking "확인 완료" removes the banner and changes status
- Clicking "복제" creates a new manual quotation and navigates to it

- [ ] **Step 8: Commit**

```bash
git add portal/src/app/dashboard/quotations/\[id\]/page.tsx
git commit -m "feat(ui): detail page — VerifyBanner, confidence clearing, clone button"
```

---

### Task 16: End-to-end verification with a real sample

**Files:**
- None (verification only)

- [ ] **Step 1: Collect or create a realistic sample PDF**

Use either:
- A de-identified real customer quotation PDF (ask the user)
- Or the fixture generator from Task 5, with more realistic content (multiple items, footer text, client header)

- [ ] **Step 2: Full flow walkthrough**

1. Log into portal at `http://localhost:3000/dashboard/quotations`
2. Click "PDF 임포트"
3. Drag 3-5 PDFs into the dropzone
4. Observe sequential upload progress
5. When done, verify list shows new rows with warning icon
6. Click each imported row
7. On the detail page, verify VerifyBanner, notes, confidence highlighting
8. Edit a low-confidence cell — highlight should clear
9. Click "확인 완료" — status moves to draft, banner disappears
10. Click "복제" — new row created with `-copy` ref_no, no import fields

- [ ] **Step 3: Check Supabase dashboard**

- `quotations` table: rows visible, `source = 'imported_pdf'`, `import_confidence` JSON populated, `import_source_snapshot` JSON populated
- Storage `quotation-imports` bucket: PDF files under `{user_id}/{quotation_id}/`
- Check `import_source_snapshot` row size — if any single row exceeds 1 MB, revisit whether to trim (e.g. limit to first 5 pages of text)

- [ ] **Step 4: Record measured values in the spec**

Open `docs/superpowers/specs/2026-04-11-quotation-pdf-import-design.md`. In the "비용 추정" section, replace the `$1~3` estimate with measured actuals from a real import batch. In "실제 샘플 검증" bullet, note the N of PDFs tested and the extraction accuracy observed.

- [ ] **Step 5: Commit the spec update**

```bash
git add docs/superpowers/specs/2026-04-11-quotation-pdf-import-design.md
git commit -m "docs: record measured import cost and accuracy from real samples"
```

---

## Self-Review Checklist

This plan was reviewed for:

**Spec coverage:**
- [x] PDF text extraction — Task 5
- [x] LLM structured extraction — Task 6
- [x] Storage + DB schema — Task 2
- [x] Types update — Task 3
- [x] Import API — Task 8
- [x] Reimport API — Task 9
- [x] Clone API (new in Phase 1) — Task 10
- [x] ImportDropzone — Task 11
- [x] VerifyBanner — Task 12
- [x] Confidence visualization — Task 13 + 15
- [x] List badges + filter — Task 14
- [x] Detail integration + clone button — Task 15
- [x] Lazy verification flow — Tasks 12 + 15
- [x] Manual end-to-end verification — Task 16

**Placeholder scan:**
- No "TBD" / "implement later" / hand-waving.
- Task 5 notes to adjust if `unpdf` API differs — this is legitimate because the exact API surface may have drifted; the fallback is "consult README.md and keep the contract". Acceptable.
- Task 13 Step 3 says edits depend on existing shape — this is explicit guidance to preserve the file, not hand-waving.
- Task 15 Step 4 likewise notes integration depends on current handler shape. The principle is stated explicitly and is actionable.

**Type consistency:**
- `ImportConfidence`, `ImportSourceSnapshot`, `ExtractedSnapshot`, `LlmExtractionResult` — defined in Tasks 3 and 4, used consistently across Tasks 5, 6, 8, 9, 11, 12, 15.
- `source: 'manual' | 'imported_pdf'` — consistent string literals throughout.
- `status: 'draft' | 'final' | 'imported_unverified'` — consistent.

**Gaps / decisions explicitly deferred:**
- Test strategy: unit tests cover pure modules (text-extractor, llm-extractor). No UI or integration tests — manual verification (Task 16) is the safety net. Acceptable for a codebase with zero existing tests.
- `maxDuration = 60` in Route Handlers — assumes Vercel Pro (60s default on Hobby, 300s on Pro). User should verify their tier before deploying. Noted here, not a blocker for dev.

---

## Execution

Plan complete and saved to `docs/superpowers/plans/2026-04-11-quotation-pdf-import.md`.

Two execution options:

1. **Subagent-Driven (recommended)** — A fresh subagent runs each task end-to-end, I review between tasks, fast iteration with minimal context pollution.
2. **Inline Execution** — Execute tasks sequentially in this same session using `superpowers:executing-plans`, batch execution with checkpoints for review.

Which approach?
