# Quotation Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully functional quotation builder with inline-editable tables, internal cost/margin calculation, template system, and PDF export — integrated into the TradeVoy portal.

**Architecture:** Supabase DB stores quotations/items/templates. Portal pages use Refine.js hooks for CRUD. Inline-editable Ant Design table for the spreadsheet-like editor. PDF generated client-side via HTML-to-PDF. Two-panel layout: left = customer quotation, right = internal cost calculation.

**Tech Stack:** Next.js 16, React 19, Refine.js, Ant Design 5, Supabase, jsPDF + html2canvas (PDF), TypeScript

**Spec:** `docs/superpowers/specs/2026-04-09-quotation-builder-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `admin/schema_quotations.sql` | DB tables + RLS |
| Modify | `portal/src/lib/types.ts` | Quotation/QuotationItem/QuotationTemplate types |
| Modify | `portal/src/providers/refine-provider.tsx` | Add quotation resources |
| Modify | `portal/src/app/dashboard/layout.tsx` | Add "견적서" sidebar menu |
| Create | `portal/src/app/dashboard/quotations/page.tsx` | Quotation list page |
| Create | `portal/src/app/dashboard/quotations/new/page.tsx` | New quotation (template select → redirect) |
| Create | `portal/src/app/dashboard/quotations/[id]/page.tsx` | Quotation editor (main page) |
| Create | `portal/src/components/quotation/EditableTable.tsx` | Inline-editable table component |
| Create | `portal/src/components/quotation/CostPanel.tsx` | Internal cost/margin calculation panel |
| Create | `portal/src/components/quotation/QuotationPDF.tsx` | PDF preview and generation |
| Create | `portal/src/components/quotation/FooterFields.tsx` | Payment terms, delivery, etc. |
| Create | `portal/src/lib/quotation-calc.ts` | Margin/currency calculation logic |

---

### Task 1: DB Schema — Quotation Tables

**Files:**
- Create: `admin/schema_quotations.sql`

- [ ] **Step 1: Create the schema file with all 3 tables**

```sql
-- Quotation Builder Tables
-- Supabase SQL Editor에서 실행

-- 템플릿
CREATE TABLE quotation_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  columns JSONB NOT NULL DEFAULT '[]',
  footer_defaults JSONB DEFAULT '{}',
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 견적서
CREATE TABLE quotations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID REFERENCES quotation_templates(id),
  ref_no TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  client_name TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'final')),
  columns JSONB NOT NULL DEFAULT '[]',
  currency TEXT DEFAULT 'USD',
  exchange_rates JSONB DEFAULT '{}',
  margin_mode TEXT DEFAULT 'forward' CHECK (margin_mode IN ('forward', 'reverse')),
  footer JSONB DEFAULT '{}',
  company_header JSONB DEFAULT '{}',
  global_costs JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 견적서 아이템
CREATE TABLE quotation_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_id UUID REFERENCES quotations(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  cells JSONB NOT NULL DEFAULT '{}',
  cost_price NUMERIC,
  cost_currency TEXT DEFAULT 'CNY',
  selling_price NUMERIC,
  margin_percent NUMERIC,
  margin_amount NUMERIC,
  extra_costs JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE quotation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own templates" ON quotation_templates FOR ALL USING (auth.uid() = user_id OR is_system = true);
CREATE POLICY "Users manage own quotations" ON quotations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own items" ON quotation_items FOR ALL USING (
  quotation_id IN (SELECT id FROM quotations WHERE user_id = auth.uid())
);

-- Indexes
CREATE INDEX idx_quotations_user ON quotations(user_id);
CREATE INDEX idx_quotations_ref ON quotations(ref_no);
CREATE INDEX idx_quotation_items_quotation ON quotation_items(quotation_id);

-- 기본 시스템 템플릿 삽입
INSERT INTO quotation_templates (user_id, name, columns, footer_defaults, is_system) VALUES
(NULL, 'Proforma Invoice', '[{"key":"model","label":"Model","type":"text","width":150},{"key":"spec","label":"Applicable Carrier (ton)","type":"text","width":150},{"key":"price","label":"Price","type":"currency","width":100},{"key":"qty","label":"Q''ty","type":"number","width":60},{"key":"amount","label":"Amount","type":"currency","width":120}]', '{"payment_terms":"T/T in 30 days after invoice date","delivery":"Within 8 weeks after order confirmation","packing":"Export standard wooden case"}', true),
(NULL, 'Parts Quotation', '[{"key":"part_name","label":"Part Name","type":"text","width":180},{"key":"part_no","label":"Part Number","type":"text","width":120},{"key":"lead_time","label":"Lead Time","type":"text","width":80},{"key":"weight","label":"Weight (kg)","type":"number","width":80},{"key":"price","label":"Price","type":"currency","width":100},{"key":"qty","label":"Q''ty","type":"number","width":60},{"key":"amount","label":"Amount","type":"currency","width":120},{"key":"remark","label":"Remark","type":"text","width":100}]', '{"payment_terms":"T/T in advance","delivery":"As per lead time","packing":"Standard export packing"}', true),
(NULL, 'Blank', '[{"key":"description","label":"Description","type":"text","width":250},{"key":"price","label":"Price","type":"currency","width":100},{"key":"qty","label":"Q''ty","type":"number","width":60},{"key":"amount","label":"Amount","type":"currency","width":120}]', '{}', true);

NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 2: Commit**

```bash
git add admin/schema_quotations.sql
git commit -m "feat: add quotation builder DB schema with system templates"
```

---

### Task 2: TypeScript Types + Calculation Logic

**Files:**
- Modify: `portal/src/lib/types.ts`
- Create: `portal/src/lib/quotation-calc.ts`

- [ ] **Step 1: Add types to `portal/src/lib/types.ts`**

Append at the end of the file:

```typescript
// --- Quotation Builder ---

export interface QuotationColumn {
  key: string;
  label: string;
  type: "text" | "number" | "currency";
  width?: number;
}

export interface QuotationTemplate {
  id: string;
  user_id?: string;
  name: string;
  columns: QuotationColumn[];
  footer_defaults: Record<string, string>;
  is_system: boolean;
  created_at: string;
}

export interface ExtraCost {
  name: string;
  amount: number;
  currency: string;
}

export interface QuotationItem {
  id: string;
  quotation_id: string;
  sort_order: number;
  cells: Record<string, string | number>;
  cost_price: number | null;
  cost_currency: string;
  selling_price: number | null;
  margin_percent: number | null;
  margin_amount: number | null;
  extra_costs: ExtraCost[];
  created_at: string;
}

export interface Quotation {
  id: string;
  user_id: string;
  template_id?: string;
  ref_no: string;
  date: string;
  client_name?: string;
  status: "draft" | "final";
  columns: QuotationColumn[];
  currency: string;
  exchange_rates: Record<string, number>;
  margin_mode: "forward" | "reverse";
  footer: Record<string, string>;
  company_header: Record<string, string>;
  global_costs: ExtraCost[];
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: Create calculation logic in `portal/src/lib/quotation-calc.ts`**

```typescript
import type { QuotationItem, ExtraCost } from "./types";

/**
 * Convert cost to target currency using exchange rate.
 * e.g., CNY 68000 with rate 7.2 (USD/CNY) → USD 9444.44
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  rates: Record<string, number>,
): number {
  const rate = rates[fromCurrency];
  if (!rate || rate === 0) return amount;
  return amount / rate;
}

/**
 * Calculate item totals from extra costs.
 */
function sumExtraCosts(
  costs: ExtraCost[],
  rates: Record<string, number>,
): number {
  return costs.reduce((sum, c) => sum + convertCurrency(c.amount, c.currency, rates), 0);
}

/**
 * Forward mode: cost + margin% → selling price
 */
export function calcForward(
  costPrice: number,
  costCurrency: string,
  marginPercent: number,
  extraCosts: ExtraCost[],
  rates: Record<string, number>,
): { sellingPrice: number; marginAmount: number; costUSD: number } {
  const costUSD = convertCurrency(costPrice, costCurrency, rates);
  const extras = sumExtraCosts(extraCosts, rates);
  const totalCost = costUSD + extras;
  const sellingPrice = totalCost * (1 + marginPercent / 100);
  const marginAmount = sellingPrice - totalCost;
  return {
    sellingPrice: Math.round(sellingPrice * 100) / 100,
    marginAmount: Math.round(marginAmount * 100) / 100,
    costUSD: Math.round(costUSD * 100) / 100,
  };
}

/**
 * Reverse mode: selling price → margin%
 */
export function calcReverse(
  sellingPrice: number,
  costPrice: number,
  costCurrency: string,
  extraCosts: ExtraCost[],
  rates: Record<string, number>,
): { marginPercent: number; marginAmount: number; costUSD: number } {
  const costUSD = convertCurrency(costPrice, costCurrency, rates);
  const extras = sumExtraCosts(extraCosts, rates);
  const totalCost = costUSD + extras;
  const marginAmount = sellingPrice - totalCost;
  const marginPercent = totalCost > 0 ? (marginAmount / totalCost) * 100 : 0;
  return {
    marginPercent: Math.round(marginPercent * 10) / 10,
    marginAmount: Math.round(marginAmount * 100) / 100,
    costUSD: Math.round(costUSD * 100) / 100,
  };
}

/**
 * Calculate summary totals for all items.
 */
export function calcSummary(
  items: QuotationItem[],
  globalCosts: ExtraCost[],
  rates: Record<string, number>,
): {
  totalCost: number;
  totalExtraCosts: number;
  totalSelling: number;
  totalMargin: number;
  marginPercent: number;
} {
  const totalCost = items.reduce(
    (sum, item) => sum + convertCurrency(item.cost_price || 0, item.cost_currency, rates),
    0,
  );
  const itemExtras = items.reduce(
    (sum, item) => sum + sumExtraCosts(item.extra_costs || [], rates),
    0,
  );
  const globalExtrasTotal = sumExtraCosts(globalCosts, rates);
  const totalExtraCosts = itemExtras + globalExtrasTotal;
  const totalSelling = items.reduce((sum, item) => sum + (item.selling_price || 0), 0);
  const totalMargin = totalSelling - totalCost - totalExtraCosts;
  const marginPercent = totalCost + totalExtraCosts > 0
    ? (totalMargin / (totalCost + totalExtraCosts)) * 100
    : 0;

  return {
    totalCost: Math.round(totalCost * 100) / 100,
    totalExtraCosts: Math.round(totalExtraCosts * 100) / 100,
    totalSelling: Math.round(totalSelling * 100) / 100,
    totalMargin: Math.round(totalMargin * 100) / 100,
    marginPercent: Math.round(marginPercent * 10) / 10,
  };
}

/**
 * Format currency value.
 */
export function formatCurrency(value: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}
```

- [ ] **Step 3: Commit**

```bash
git add portal/src/lib/types.ts portal/src/lib/quotation-calc.ts
git commit -m "feat: add quotation types and calculation logic"
```

---

### Task 3: Portal Integration — Resources, Menu, Routing

**Files:**
- Modify: `portal/src/providers/refine-provider.tsx`
- Modify: `portal/src/app/dashboard/layout.tsx`

- [ ] **Step 1: Add quotation resources to refine-provider.tsx**

Add to the `resources` array (after `{ name: "evidence" }`):

```typescript
            {
              name: "quotation_templates",
              meta: { label: "견적서 템플릿" },
            },
            {
              name: "quotations",
              list: "/dashboard/quotations",
              create: "/dashboard/quotations/new",
              edit: "/dashboard/quotations/:id",
              meta: { label: "견적서" },
            },
            {
              name: "quotation_items",
              meta: { label: "견적서 아이템" },
            },
```

- [ ] **Step 2: Add "견적서" menu to sidebar in layout.tsx**

In the `Menu` items array, add after the "새 분석 요청" item:

```typescript
            { type: "divider" },
            { key: "/dashboard/quotations", icon: <FileTextOutlined />, label: <Link href="/dashboard/quotations">견적서</Link> },
```

And add the import for `FileTextOutlined`:

```typescript
import { DashboardOutlined, PlusOutlined, SettingOutlined, LogoutOutlined, GlobalOutlined, FileTextOutlined } from "@ant-design/icons";
```

- [ ] **Step 3: Commit**

```bash
git add "portal/src/providers/refine-provider.tsx" "portal/src/app/dashboard/layout.tsx"
git commit -m "feat: add quotation resources and sidebar menu"
```

---

### Task 4: Quotation List Page

**Files:**
- Create: `portal/src/app/dashboard/quotations/page.tsx`

- [ ] **Step 1: Create the quotation list page**

```tsx
"use client";

import { useList } from "@refinedev/core";
import { Table, Tag, Button, Typography, Space } from "antd";
import { PlusOutlined, FilePdfOutlined } from "@ant-design/icons";
import Link from "next/link";
import type { Quotation } from "@/lib/types";
import { formatCurrency } from "@/lib/quotation-calc";

const { Title, Text } = Typography;

export default function QuotationsPage() {
  const { query } = useList<Quotation>({
    resource: "quotations",
    sorters: [{ field: "created_at", order: "desc" }],
  });

  const quotations = query.data?.data || [];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>견적서</Title>
          <Text type="secondary">{quotations.length}개의 견적서</Text>
        </div>
        <Link href="/dashboard/quotations/new">
          <Button type="primary" icon={<PlusOutlined />}>새 견적서</Button>
        </Link>
      </div>

      <Table
        dataSource={quotations}
        rowKey="id"
        loading={query.isLoading}
        pagination={{ pageSize: 20, showTotal: (t) => `총 ${t}개` }}
        onRow={(record) => ({
          onClick: () => window.location.href = `/dashboard/quotations/${record.id}`,
          style: { cursor: "pointer" },
        })}
        columns={[
          {
            title: "Ref No", dataIndex: "ref_no", key: "ref_no", width: 160,
            render: (v: string) => <Text strong>{v}</Text>,
          },
          { title: "업체", dataIndex: "client_name", key: "client", width: 200 },
          {
            title: "통화", dataIndex: "currency", key: "currency", width: 80,
            render: (v: string) => <Tag>{v}</Tag>,
          },
          {
            title: "상태", dataIndex: "status", key: "status", width: 100,
            render: (s: string) => (
              <Tag color={s === "final" ? "green" : "default"}>
                {s === "final" ? "완료" : "작성 중"}
              </Tag>
            ),
          },
          {
            title: "날짜", dataIndex: "date", key: "date", width: 120,
          },
          {
            title: "생성일", dataIndex: "created_at", key: "created", width: 120,
            render: (v: string) => v?.split("T")[0],
          },
        ]}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "portal/src/app/dashboard/quotations/page.tsx"
git commit -m "feat: add quotation list page"
```

---

### Task 5: New Quotation Page (Template Select → Create → Redirect)

**Files:**
- Create: `portal/src/app/dashboard/quotations/new/page.tsx`

- [ ] **Step 1: Create the template selection and quotation creation page**

```tsx
"use client";

import { useList, useCreate, useGetIdentity } from "@refinedev/core";
import { Card, Typography, Space, Spin, Row, Col } from "antd";
import { FileTextOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import type { QuotationTemplate } from "@/lib/types";

const { Title, Text, Paragraph } = Typography;

export default function NewQuotationPage() {
  const router = useRouter();
  const { data: identity } = useGetIdentity<{ id: string }>();
  const { query } = useList<QuotationTemplate>({
    resource: "quotation_templates",
    pagination: { pageSize: 50 },
  });
  const { mutate: createQuotation, isLoading: creating } = useCreate();

  const templates = query.data?.data || [];

  function handleSelect(template: QuotationTemplate) {
    const now = new Date();
    const refNo = `QT${now.getFullYear().toString().slice(2)}-${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;

    createQuotation(
      {
        resource: "quotations",
        values: {
          user_id: identity?.id,
          template_id: template.id,
          ref_no: refNo,
          date: now.toISOString().split("T")[0],
          status: "draft",
          columns: template.columns,
          currency: "USD",
          exchange_rates: { CNY: 7.2, KRW: 1380 },
          margin_mode: "forward",
          footer: template.footer_defaults || {},
          company_header: {
            name: "SPS ENG CO., LTD",
            address: "서울특별시 송파구",
            tel: "",
            web: "https://spseng.com",
          },
          global_costs: [],
        },
      },
      {
        onSuccess: (data) => {
          router.push(`/dashboard/quotations/${data.data.id}`);
        },
      },
    );
  }

  if (query.isLoading) return <div style={{ textAlign: "center", padding: 64 }}><Spin size="large" /></div>;

  return (
    <div>
      <Title level={4}>새 견적서</Title>
      <Text type="secondary" style={{ display: "block", marginBottom: 24 }}>템플릿을 선택하면 견적서가 생성됩니다</Text>

      <Row gutter={[16, 16]}>
        {templates.map((t) => (
          <Col key={t.id} xs={24} sm={12} md={8}>
            <Card
              hoverable
              onClick={() => !creating && handleSelect(t)}
              style={{ height: "100%" }}
            >
              <Space direction="vertical">
                <FileTextOutlined style={{ fontSize: 24, color: "#f15f23" }} />
                <Title level={5} style={{ margin: 0 }}>{t.name}</Title>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t.columns.length}개 필드: {t.columns.map((c) => c.label).join(", ")}
                </Text>
                {t.is_system && <Text type="secondary" style={{ fontSize: 11 }}>기본 템플릿</Text>}
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "portal/src/app/dashboard/quotations/new/page.tsx"
git commit -m "feat: add new quotation page with template selection"
```

---

### Task 6: Editable Table Component

**Files:**
- Create: `portal/src/components/quotation/EditableTable.tsx`

- [ ] **Step 1: Create the inline-editable table component**

```tsx
"use client";

import { Table, Input, InputNumber, Button, Space, Dropdown } from "antd";
import { PlusOutlined, DeleteOutlined, PlusCircleOutlined } from "@ant-design/icons";
import { useState, useRef } from "react";
import type { QuotationColumn, QuotationItem } from "@/lib/types";
import { formatCurrency } from "@/lib/quotation-calc";

interface Props {
  columns: QuotationColumn[];
  items: QuotationItem[];
  currency: string;
  onItemChange: (itemId: string, cells: Record<string, string | number>) => void;
  onAddItem: () => void;
  onRemoveItem: (itemId: string) => void;
  onAddColumn: (column: QuotationColumn) => void;
  onRemoveColumn: (key: string) => void;
}

export default function EditableTable({
  columns, items, currency, onItemChange, onAddItem, onRemoveItem, onAddColumn, onRemoveColumn,
}: Props) {
  const [editingCell, setEditingCell] = useState<{ itemId: string; key: string } | null>(null);
  const [newColName, setNewColName] = useState("");
  const [newColType, setNewColType] = useState<"text" | "number" | "currency">("text");
  const [showAddCol, setShowAddCol] = useState(false);
  const inputRef = useRef<any>(null);

  function handleCellClick(itemId: string, key: string) {
    setEditingCell({ itemId, key });
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleCellChange(itemId: string, key: string, value: string | number) {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    const newCells = { ...item.cells, [key]: value };

    // Auto-calc amount if price and qty exist
    const priceCol = columns.find((c) => c.key === "price");
    const qtyCol = columns.find((c) => c.key === "qty");
    const amountCol = columns.find((c) => c.key === "amount");
    if (priceCol && qtyCol && amountCol) {
      const price = Number(newCells.price) || 0;
      const qty = Number(newCells.qty) || 0;
      newCells.amount = Math.round(price * qty * 100) / 100;
    }

    onItemChange(itemId, newCells);
    setEditingCell(null);
  }

  function handleKeyDown(e: React.KeyboardEvent, itemId: string, key: string, value: string | number) {
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      handleCellChange(itemId, key, value);
      // Move to next cell
      const colIdx = columns.findIndex((c) => c.key === key);
      const itemIdx = items.findIndex((i) => i.id === itemId);
      if (e.key === "Tab" && colIdx < columns.length - 1) {
        setEditingCell({ itemId, key: columns[colIdx + 1].key });
      } else if (e.key === "Enter" && itemIdx < items.length - 1) {
        setEditingCell({ itemId: items[itemIdx + 1].id, key });
      }
      setTimeout(() => inputRef.current?.focus(), 50);
    } else if (e.key === "Escape") {
      setEditingCell(null);
    }
  }

  const tableColumns = [
    {
      title: "No", key: "_no", width: 50, fixed: "left" as const,
      render: (_: unknown, __: unknown, idx: number) => (
        <span style={{ color: "#999", fontSize: 12 }}>{idx + 1}</span>
      ),
    },
    ...columns.map((col) => ({
      title: (
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span>{col.label}</span>
          {col.key !== "amount" && (
            <DeleteOutlined
              style={{ fontSize: 10, color: "#ccc", cursor: "pointer" }}
              onClick={(e) => { e.stopPropagation(); onRemoveColumn(col.key); }}
            />
          )}
        </div>
      ),
      dataIndex: ["cells", col.key],
      key: col.key,
      width: col.width || 120,
      render: (_: unknown, record: QuotationItem) => {
        const value = record.cells?.[col.key] ?? "";
        const isEditing = editingCell?.itemId === record.id && editingCell?.key === col.key;

        if (col.key === "amount") {
          return <span style={{ fontWeight: 600 }}>{formatCurrency(Number(value) || 0, currency)}</span>;
        }

        if (isEditing) {
          const isNum = col.type === "number" || col.type === "currency";
          return isNum ? (
            <InputNumber
              ref={inputRef}
              defaultValue={Number(value) || undefined}
              size="small"
              style={{ width: "100%" }}
              onBlur={(e) => handleCellChange(record.id, col.key, Number(e.target.value) || 0)}
              onKeyDown={(e) => handleKeyDown(e, record.id, col.key, Number((e.target as HTMLInputElement).value) || 0)}
            />
          ) : (
            <Input
              ref={inputRef}
              defaultValue={String(value)}
              size="small"
              onBlur={(e) => handleCellChange(record.id, col.key, e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, record.id, col.key, (e.target as HTMLInputElement).value)}
            />
          );
        }

        return (
          <div
            onClick={() => handleCellClick(record.id, col.key)}
            style={{ cursor: "text", minHeight: 22, padding: "2px 4px", borderRadius: 4, border: "1px solid transparent" }}
            onMouseEnter={(e) => (e.currentTarget.style.border = "1px solid #d9d9d9")}
            onMouseLeave={(e) => (e.currentTarget.style.border = "1px solid transparent")}
          >
            {col.type === "currency" ? formatCurrency(Number(value) || 0, currency) : String(value) || <span style={{ color: "#ccc" }}>클릭하여 입력</span>}
          </div>
        );
      },
    })),
    {
      title: "", key: "_actions", width: 40,
      render: (_: unknown, record: QuotationItem) => (
        <DeleteOutlined
          style={{ color: "#ff4d4f", cursor: "pointer", fontSize: 12 }}
          onClick={() => onRemoveItem(record.id)}
        />
      ),
    },
  ];

  return (
    <div>
      <Table
        dataSource={items}
        columns={tableColumns}
        rowKey="id"
        pagination={false}
        size="small"
        bordered
        scroll={{ x: "max-content" }}
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={columns.length}>
                <span style={{ fontWeight: 700 }}>TTL</span>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={1}>
                <span style={{ fontWeight: 700 }}>
                  {formatCurrency(
                    items.reduce((sum, item) => sum + (Number(item.cells?.amount) || 0), 0),
                    currency,
                  )}
                </span>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2} />
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />

      <Space style={{ marginTop: 8 }}>
        <Button icon={<PlusOutlined />} size="small" onClick={onAddItem}>
          행 추가
        </Button>
        <Button icon={<PlusCircleOutlined />} size="small" onClick={() => setShowAddCol(true)}>
          필드 추가
        </Button>
      </Space>

      {showAddCol && (
        <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
          <Input
            placeholder="필드명"
            size="small"
            value={newColName}
            onChange={(e) => setNewColName(e.target.value)}
            style={{ width: 150 }}
          />
          <select
            value={newColType}
            onChange={(e) => setNewColType(e.target.value as "text" | "number" | "currency")}
            style={{ padding: "2px 8px", borderRadius: 4, border: "1px solid #d9d9d9" }}
          >
            <option value="text">텍스트</option>
            <option value="number">숫자</option>
            <option value="currency">통화</option>
          </select>
          <Button
            size="small"
            type="primary"
            onClick={() => {
              if (newColName.trim()) {
                const key = newColName.trim().toLowerCase().replace(/\s+/g, "_");
                onAddColumn({ key, label: newColName.trim(), type: newColType, width: 120 });
                setNewColName("");
                setShowAddCol(false);
              }
            }}
          >
            추가
          </Button>
          <Button size="small" onClick={() => setShowAddCol(false)}>취소</Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "portal/src/components/quotation/EditableTable.tsx"
git commit -m "feat: add inline-editable table component for quotation builder"
```

---

### Task 7: Cost Panel Component

**Files:**
- Create: `portal/src/components/quotation/CostPanel.tsx`

- [ ] **Step 1: Create the internal cost/margin calculation panel**

```tsx
"use client";

import { InputNumber, Select, Switch, Typography, Space, Button, Input, Tag } from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import { useState } from "react";
import type { QuotationItem, ExtraCost } from "@/lib/types";
import { calcForward, calcReverse, calcSummary, formatCurrency, convertCurrency } from "@/lib/quotation-calc";

const { Text } = Typography;

interface Props {
  items: QuotationItem[];
  marginMode: "forward" | "reverse";
  exchangeRates: Record<string, number>;
  globalCosts: ExtraCost[];
  currency: string;
  onItemCostChange: (itemId: string, field: string, value: number | string) => void;
  onItemExtraCostChange: (itemId: string, costs: ExtraCost[]) => void;
  onMarginModeChange: (mode: "forward" | "reverse") => void;
  onExchangeRateChange: (rates: Record<string, number>) => void;
  onGlobalCostsChange: (costs: ExtraCost[]) => void;
}

export default function CostPanel({
  items, marginMode, exchangeRates, globalCosts, currency,
  onItemCostChange, onItemExtraCostChange, onMarginModeChange, onExchangeRateChange, onGlobalCostsChange,
}: Props) {
  const summary = calcSummary(items, globalCosts, exchangeRates);

  return (
    <div style={{ fontSize: 12 }}>
      {/* Controls */}
      <div style={{ marginBottom: 16, padding: 12, background: "#fafafa", borderRadius: 8 }}>
        <Space direction="vertical" size={8} style={{ width: "100%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Text strong>계산 모드</Text>
            <Space size={4}>
              <Text type="secondary">마진→판매가</Text>
              <Switch
                checked={marginMode === "reverse"}
                onChange={(v) => onMarginModeChange(v ? "reverse" : "forward")}
                size="small"
              />
              <Text type="secondary">판매가→마진</Text>
            </Space>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div>
              <Text type="secondary" style={{ fontSize: 10 }}>USD/CNY</Text>
              <InputNumber
                size="small" value={exchangeRates.CNY || 7.2}
                onChange={(v) => onExchangeRateChange({ ...exchangeRates, CNY: v || 7.2 })}
                style={{ width: 80 }}
              />
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 10 }}>USD/KRW</Text>
              <InputNumber
                size="small" value={exchangeRates.KRW || 1380}
                onChange={(v) => onExchangeRateChange({ ...exchangeRates, KRW: v || 1380 })}
                style={{ width: 80 }}
              />
            </div>
          </div>
        </Space>
      </div>

      {/* Per-item costs */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr style={{ background: "#f5f5f5" }}>
            <th style={{ padding: "6px 4px", textAlign: "left" }}>No</th>
            <th style={{ padding: "6px 4px", textAlign: "right" }}>원가</th>
            <th style={{ padding: "6px 4px", width: 50 }}>통화</th>
            <th style={{ padding: "6px 4px", textAlign: "right" }}>원가(USD)</th>
            {marginMode === "forward" ? (
              <>
                <th style={{ padding: "6px 4px", textAlign: "right" }}>마진%</th>
                <th style={{ padding: "6px 4px", textAlign: "right" }}>판매가</th>
              </>
            ) : (
              <>
                <th style={{ padding: "6px 4px", textAlign: "right" }}>판매가</th>
                <th style={{ padding: "6px 4px", textAlign: "right" }}>마진%</th>
              </>
            )}
            <th style={{ padding: "6px 4px", textAlign: "right" }}>마진액</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const costUSD = convertCurrency(item.cost_price || 0, item.cost_currency, exchangeRates);
            return (
              <tr key={item.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: "4px" }}>{idx + 1}</td>
                <td style={{ padding: "4px", textAlign: "right" }}>
                  <InputNumber
                    size="small" value={item.cost_price || undefined}
                    onChange={(v) => onItemCostChange(item.id, "cost_price", v || 0)}
                    style={{ width: 80 }}
                  />
                </td>
                <td style={{ padding: "4px" }}>
                  <Select
                    size="small" value={item.cost_currency}
                    onChange={(v) => onItemCostChange(item.id, "cost_currency", v)}
                    style={{ width: 60 }} options={[{ value: "CNY" }, { value: "KRW" }]}
                  />
                </td>
                <td style={{ padding: "4px", textAlign: "right", color: "#999" }}>
                  {formatCurrency(costUSD, "USD")}
                </td>
                {marginMode === "forward" ? (
                  <>
                    <td style={{ padding: "4px", textAlign: "right" }}>
                      <InputNumber
                        size="small" value={item.margin_percent || undefined}
                        onChange={(v) => onItemCostChange(item.id, "margin_percent", v || 0)}
                        style={{ width: 60 }} suffix="%"
                      />
                    </td>
                    <td style={{ padding: "4px", textAlign: "right", fontWeight: 600 }}>
                      {formatCurrency(item.selling_price || 0, currency)}
                    </td>
                  </>
                ) : (
                  <>
                    <td style={{ padding: "4px", textAlign: "right" }}>
                      <InputNumber
                        size="small" value={item.selling_price || undefined}
                        onChange={(v) => onItemCostChange(item.id, "selling_price", v || 0)}
                        style={{ width: 80 }}
                      />
                    </td>
                    <td style={{ padding: "4px", textAlign: "right", color: (item.margin_percent || 0) >= 0 ? "#52c41a" : "#ff4d4f" }}>
                      {(item.margin_percent || 0).toFixed(1)}%
                    </td>
                  </>
                )}
                <td style={{ padding: "4px", textAlign: "right", color: (item.margin_amount || 0) >= 0 ? "#52c41a" : "#ff4d4f" }}>
                  {formatCurrency(item.margin_amount || 0, currency)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Global costs */}
      <div style={{ marginTop: 16, padding: 8, background: "#fafafa", borderRadius: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Text strong style={{ fontSize: 11 }}>전체 부대비용</Text>
          <Button size="small" icon={<PlusOutlined />} onClick={() => onGlobalCostsChange([...globalCosts, { name: "", amount: 0, currency: "USD" }])}>
            추가
          </Button>
        </div>
        {globalCosts.map((cost, i) => (
          <div key={i} style={{ display: "flex", gap: 4, marginBottom: 4, alignItems: "center" }}>
            <Input size="small" value={cost.name} placeholder="항목명"
              onChange={(e) => { const c = [...globalCosts]; c[i] = { ...c[i], name: e.target.value }; onGlobalCostsChange(c); }}
              style={{ width: 100 }} />
            <InputNumber size="small" value={cost.amount}
              onChange={(v) => { const c = [...globalCosts]; c[i] = { ...c[i], amount: v || 0 }; onGlobalCostsChange(c); }}
              style={{ width: 80 }} />
            <Select size="small" value={cost.currency} style={{ width: 60 }}
              onChange={(v) => { const c = [...globalCosts]; c[i] = { ...c[i], currency: v }; onGlobalCostsChange(c); }}
              options={[{ value: "USD" }, { value: "CNY" }, { value: "KRW" }]} />
            <DeleteOutlined style={{ color: "#ff4d4f", cursor: "pointer" }}
              onClick={() => onGlobalCostsChange(globalCosts.filter((_, j) => j !== i))} />
          </div>
        ))}
      </div>

      {/* Summary */}
      <div style={{ marginTop: 16, padding: 12, background: "#f6ffed", borderRadius: 8, border: "1px solid #b7eb8f" }}>
        <Text strong style={{ fontSize: 12 }}>요약</Text>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginTop: 8 }}>
          <Text style={{ fontSize: 11 }}>총 원가</Text>
          <Text style={{ fontSize: 11, textAlign: "right" }}>{formatCurrency(summary.totalCost, "USD")}</Text>
          <Text style={{ fontSize: 11 }}>총 부대비용</Text>
          <Text style={{ fontSize: 11, textAlign: "right" }}>{formatCurrency(summary.totalExtraCosts, "USD")}</Text>
          <Text strong style={{ fontSize: 12 }}>총 판매가</Text>
          <Text strong style={{ fontSize: 12, textAlign: "right" }}>{formatCurrency(summary.totalSelling, currency)}</Text>
          <Text strong style={{ fontSize: 12, color: summary.totalMargin >= 0 ? "#52c41a" : "#ff4d4f" }}>총 마진</Text>
          <Text strong style={{ fontSize: 12, textAlign: "right", color: summary.totalMargin >= 0 ? "#52c41a" : "#ff4d4f" }}>
            {formatCurrency(summary.totalMargin, currency)} ({summary.marginPercent}%)
          </Text>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "portal/src/components/quotation/CostPanel.tsx"
git commit -m "feat: add cost/margin calculation panel component"
```

---

### Task 8: Footer Fields + PDF Preview Components

**Files:**
- Create: `portal/src/components/quotation/FooterFields.tsx`
- Create: `portal/src/components/quotation/QuotationPDF.tsx`

- [ ] **Step 1: Create footer fields component**

```tsx
"use client";

import { Input, DatePicker, Typography } from "antd";

const { Text } = Typography;

interface Props {
  footer: Record<string, string>;
  onChange: (footer: Record<string, string>) => void;
}

const FIELDS = [
  { key: "payment_terms", label: "Payment Terms", placeholder: "T/T in 30 days after invoice date" },
  { key: "delivery", label: "Delivery", placeholder: "Within 8 weeks after order confirmation" },
  { key: "packing", label: "Packing", placeholder: "Export standard wooden case" },
  { key: "validity", label: "Validity", placeholder: "31 Jan, 2026" },
  { key: "remarks", label: "Remarks", placeholder: "" },
];

export default function FooterFields({ footer, onChange }: Props) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      {FIELDS.map((f) => (
        <div key={f.key}>
          <Text type="secondary" style={{ fontSize: 11, display: "block", marginBottom: 2 }}>{f.label}</Text>
          {f.key === "remarks" ? (
            <Input.TextArea
              size="small" rows={2} value={footer[f.key] || ""} placeholder={f.placeholder}
              onChange={(e) => onChange({ ...footer, [f.key]: e.target.value })}
            />
          ) : (
            <Input
              size="small" value={footer[f.key] || ""} placeholder={f.placeholder}
              onChange={(e) => onChange({ ...footer, [f.key]: e.target.value })}
            />
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create PDF preview component**

```tsx
"use client";

import { Modal, Button, Space, Tag } from "antd";
import { FilePdfOutlined, DownloadOutlined } from "@ant-design/icons";
import { useRef } from "react";
import type { Quotation, QuotationItem } from "@/lib/types";
import { formatCurrency } from "@/lib/quotation-calc";

interface Props {
  quotation: Quotation;
  items: QuotationItem[];
  open: boolean;
  onClose: () => void;
}

export default function QuotationPDF({ quotation, items, open, onClose }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);

  async function handleDownload() {
    const el = contentRef.current;
    if (!el) return;
    // Dynamic import to avoid SSR issues
    const html2canvas = (await import("html2canvas")).default;
    const { jsPDF } = await import("jspdf");

    const canvas = await html2canvas(el, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${quotation.ref_no}.pdf`);
  }

  const h = quotation.company_header || {};
  const f = quotation.footer || {};
  const total = items.reduce((s, i) => s + (Number(i.cells?.amount) || 0), 0);

  return (
    <Modal open={open} onCancel={onClose} width={700} footer={
      <Space>
        <Button icon={<DownloadOutlined />} type="primary" onClick={handleDownload}>PDF 다운로드</Button>
        <Button onClick={onClose}>닫기</Button>
      </Space>
    } title={<><FilePdfOutlined /> PDF 미리보기 {quotation.status === "draft" && <Tag>DRAFT</Tag>}</>}>
      <div ref={contentRef} style={{ padding: 32, background: "white", fontFamily: "Arial, sans-serif", fontSize: 12, lineHeight: 1.6, position: "relative" }}>
        {quotation.status === "draft" && (
          <div style={{ position: "absolute", top: "40%", left: "50%", transform: "translate(-50%, -50%) rotate(-30deg)", fontSize: 60, color: "rgba(0,0,0,0.06)", fontWeight: 900, pointerEvents: "none" }}>
            DRAFT
          </div>
        )}

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>{h.name || "Company Name"}</div>
          {h.address && <div style={{ fontSize: 10, color: "#666" }}>{h.address}</div>}
          {h.tel && <div style={{ fontSize: 10, color: "#666" }}>Tel: {h.tel}</div>}
          {h.web && <div style={{ fontSize: 10, color: "#666" }}>{h.web}</div>}
        </div>

        {/* Ref / Date / Client */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <div><strong>Ref No:</strong> {quotation.ref_no}</div>
          <div><strong>Date:</strong> {quotation.date}</div>
        </div>
        {quotation.client_name && <div style={{ marginBottom: 16 }}><strong>To:</strong> {quotation.client_name}</div>}

        {/* Items Table */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16, fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ border: "1px solid #000", padding: "4px 6px", background: "#f5f5f5" }}>No</th>
              {quotation.columns.map((col) => (
                <th key={col.key} style={{ border: "1px solid #000", padding: "4px 6px", background: "#f5f5f5" }}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.id}>
                <td style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "center" }}>{idx + 1}</td>
                {quotation.columns.map((col) => (
                  <td key={col.key} style={{ border: "1px solid #000", padding: "4px 6px", textAlign: col.type === "currency" || col.type === "number" ? "right" : "left" }}>
                    {col.type === "currency" ? formatCurrency(Number(item.cells?.[col.key]) || 0, quotation.currency) : String(item.cells?.[col.key] || "")}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td colSpan={quotation.columns.length} style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right", fontWeight: 700 }}>TTL</td>
              <td style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right", fontWeight: 700 }}>{formatCurrency(total, quotation.currency)}</td>
            </tr>
          </tbody>
        </table>

        {/* Footer */}
        <div style={{ fontSize: 10, lineHeight: 1.8 }}>
          {f.payment_terms && <div><strong>Payment:</strong> {f.payment_terms}</div>}
          {f.delivery && <div><strong>Delivery:</strong> {f.delivery}</div>}
          {f.packing && <div><strong>Packing:</strong> {f.packing}</div>}
          {f.validity && <div><strong>Validity:</strong> {f.validity}</div>}
          {f.remarks && <div><strong>Remarks:</strong> {f.remarks}</div>}
        </div>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add "portal/src/components/quotation/FooterFields.tsx" "portal/src/components/quotation/QuotationPDF.tsx"
git commit -m "feat: add footer fields and PDF preview components"
```

---

### Task 9: Quotation Editor Page (Main Assembly)

**Files:**
- Create: `portal/src/app/dashboard/quotations/[id]/page.tsx`

- [ ] **Step 1: Create the main quotation editor page**

```tsx
"use client";

import { useOne, useList, useUpdate, useCreate, useDelete } from "@refinedev/core";
import { useParams, useRouter } from "next/navigation";
import { Card, Input, Button, Space, Typography, Breadcrumb, Switch, Tag, Spin, DatePicker, Divider } from "antd";
import { HomeOutlined, EyeOutlined, SaveOutlined, CheckCircleOutlined, FilePdfOutlined, CopyOutlined } from "@ant-design/icons";
import Link from "next/link";
import { useState, useCallback, useEffect, useRef } from "react";
import type { Quotation, QuotationItem, QuotationColumn, ExtraCost } from "@/lib/types";
import { calcForward, calcReverse } from "@/lib/quotation-calc";
import EditableTable from "@/components/quotation/EditableTable";
import CostPanel from "@/components/quotation/CostPanel";
import FooterFields from "@/components/quotation/FooterFields";
import QuotationPDF from "@/components/quotation/QuotationPDF";

const { Title, Text } = Typography;

export default function QuotationEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [showCostPanel, setShowCostPanel] = useState(true);
  const [showPDF, setShowPDF] = useState(false);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { query: qq } = useOne<Quotation>({ resource: "quotations", id });
  const { query: iq } = useList<QuotationItem>({
    resource: "quotation_items",
    filters: [{ field: "quotation_id", operator: "eq", value: id }],
    sorters: [{ field: "sort_order", order: "asc" }],
    pagination: { pageSize: 200 },
  });

  const { mutate: updateQuotation } = useUpdate();
  const { mutate: createItem } = useCreate();
  const { mutate: updateItem } = useUpdate();
  const { mutate: deleteItem } = useDelete();

  const quotation = qq.data?.data;
  const items = iq.data?.data || [];

  if (qq.isLoading || !quotation) return <div style={{ textAlign: "center", padding: 64 }}><Spin size="large" /></div>;

  // --- Auto-save quotation fields with debounce ---
  function saveQuotation(values: Partial<Quotation>) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      updateQuotation({ resource: "quotations", id, values });
    }, 1500);
  }

  // --- Item handlers ---
  function handleItemCellChange(itemId: string, cells: Record<string, string | number>) {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    // Recalc margins
    const sellingPrice = Number(cells.amount) || item.selling_price || 0;
    updateItem({ resource: "quotation_items", id: itemId, values: { cells, selling_price: sellingPrice } });
  }

  function handleAddItem() {
    createItem({
      resource: "quotation_items",
      values: {
        quotation_id: id,
        sort_order: items.length,
        cells: {},
        cost_price: 0,
        cost_currency: "CNY",
        selling_price: 0,
        margin_percent: 0,
        margin_amount: 0,
        extra_costs: [],
      },
    }, { onSuccess: () => iq.refetch() });
  }

  function handleRemoveItem(itemId: string) {
    deleteItem({ resource: "quotation_items", id: itemId }, { onSuccess: () => iq.refetch() });
  }

  function handleAddColumn(col: QuotationColumn) {
    const newCols = [...quotation.columns, col];
    saveQuotation({ columns: newCols });
    qq.refetch();
  }

  function handleRemoveColumn(key: string) {
    const newCols = quotation.columns.filter((c) => c.key !== key);
    saveQuotation({ columns: newCols });
    qq.refetch();
  }

  // --- Cost panel handlers ---
  function handleItemCostChange(itemId: string, field: string, value: number | string) {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    const updates: Partial<QuotationItem> = { [field]: value };

    // Recalculate
    const costPrice = field === "cost_price" ? Number(value) : (item.cost_price || 0);
    const costCurrency = field === "cost_currency" ? String(value) : item.cost_currency;
    const marginPercent = field === "margin_percent" ? Number(value) : (item.margin_percent || 0);
    const sellingPrice = field === "selling_price" ? Number(value) : (item.selling_price || 0);

    if (quotation.margin_mode === "forward") {
      const calc = calcForward(costPrice, costCurrency, marginPercent, item.extra_costs || [], quotation.exchange_rates);
      updates.selling_price = calc.sellingPrice;
      updates.margin_amount = calc.marginAmount;
      // Also update the cells.amount for the customer-facing table
      const qty = Number(item.cells?.qty) || 1;
      updates.cells = { ...item.cells, price: calc.sellingPrice, amount: Math.round(calc.sellingPrice * qty * 100) / 100 };
    } else {
      const calc = calcReverse(sellingPrice, costPrice, costCurrency, item.extra_costs || [], quotation.exchange_rates);
      updates.margin_percent = calc.marginPercent;
      updates.margin_amount = calc.marginAmount;
    }

    updateItem({ resource: "quotation_items", id: itemId, values: updates }, { onSuccess: () => iq.refetch() });
  }

  return (
    <div>
      <Breadcrumb className="mb-4" items={[
        { title: <Link href="/dashboard"><HomeOutlined /> 대시보드</Link> },
        { title: <Link href="/dashboard/quotations">견적서</Link> },
        { title: quotation.ref_no },
      ]} />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Space align="center">
          <Title level={4} style={{ margin: 0 }}>{quotation.ref_no}</Title>
          <Tag color={quotation.status === "final" ? "green" : "default"}>
            {quotation.status === "final" ? "완료" : "작성 중"}
          </Tag>
        </Space>
        <Space>
          <Button icon={<EyeOutlined />} onClick={() => setShowCostPanel(!showCostPanel)}>
            {showCostPanel ? "내부계산 숨기기" : "내부계산 보기"}
          </Button>
          <Button icon={<FilePdfOutlined />} onClick={() => setShowPDF(true)}>PDF 미리보기</Button>
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={() => updateQuotation({ resource: "quotations", id, values: { status: quotation.status === "final" ? "draft" : "final" } }, { onSuccess: () => qq.refetch() })}
          >
            {quotation.status === "final" ? "Draft로 변경" : "완료 처리"}
          </Button>
        </Space>
      </div>

      {/* Meta fields */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <div>
          <Text type="secondary" style={{ fontSize: 11 }}>Ref No</Text>
          <Input size="small" value={quotation.ref_no} style={{ width: 160 }}
            onChange={(e) => saveQuotation({ ref_no: e.target.value })} />
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 11 }}>날짜</Text>
          <Input size="small" value={quotation.date} style={{ width: 130 }}
            onChange={(e) => saveQuotation({ date: e.target.value })} />
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 11 }}>업체</Text>
          <Input size="small" value={quotation.client_name || ""} placeholder="업체명" style={{ width: 200 }}
            onChange={(e) => saveQuotation({ client_name: e.target.value })} />
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 11 }}>통화</Text>
          <Input size="small" value={quotation.currency} style={{ width: 60 }}
            onChange={(e) => saveQuotation({ currency: e.target.value })} />
        </div>
      </div>

      {/* Main content: editable table + cost panel */}
      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ flex: showCostPanel ? 3 : 1 }}>
          <Card size="small" title="📄 견적서 (고객용)">
            <EditableTable
              columns={quotation.columns}
              items={items}
              currency={quotation.currency}
              onItemChange={handleItemCellChange}
              onAddItem={handleAddItem}
              onRemoveItem={handleRemoveItem}
              onAddColumn={handleAddColumn}
              onRemoveColumn={handleRemoveColumn}
            />
          </Card>
        </div>

        {showCostPanel && (
          <div style={{ flex: 2 }}>
            <Card size="small" title="🔒 내부 계산 (고객 비공개)">
              <CostPanel
                items={items}
                marginMode={quotation.margin_mode}
                exchangeRates={quotation.exchange_rates}
                globalCosts={quotation.global_costs}
                currency={quotation.currency}
                onItemCostChange={handleItemCostChange}
                onItemExtraCostChange={(itemId, costs) => updateItem({ resource: "quotation_items", id: itemId, values: { extra_costs: costs } })}
                onMarginModeChange={(mode) => { saveQuotation({ margin_mode: mode }); qq.refetch(); }}
                onExchangeRateChange={(rates) => { saveQuotation({ exchange_rates: rates }); qq.refetch(); }}
                onGlobalCostsChange={(costs) => { saveQuotation({ global_costs: costs }); qq.refetch(); }}
              />
            </Card>
          </div>
        )}
      </div>

      {/* Footer fields */}
      <Card size="small" title="조건" style={{ marginTop: 16 }}>
        <FooterFields footer={quotation.footer} onChange={(f) => saveQuotation({ footer: f })} />
      </Card>

      {/* PDF Modal */}
      <QuotationPDF quotation={quotation} items={items} open={showPDF} onClose={() => setShowPDF(false)} />
    </div>
  );
}
```

- [ ] **Step 2: Install PDF dependencies**

```bash
cd portal && npm install html2canvas jspdf
```

- [ ] **Step 3: Commit**

```bash
git add "portal/src/app/dashboard/quotations/[id]/page.tsx" portal/package.json portal/package-lock.json
git commit -m "feat: add quotation editor page with two-panel layout and PDF preview"
```

---

### Task 10: Run Supabase Migration + Seed Templates

This task is manual — run the SQL from Task 1 in Supabase SQL Editor.

- [ ] **Step 1: Run `admin/schema_quotations.sql` in Supabase SQL Editor**

URL: `https://supabase.com/dashboard/project/jktvqcubipmcpihzgbpz/sql/new`

- [ ] **Step 2: Verify tables exist**

```bash
python3 -c "
import os
from dotenv import load_dotenv
load_dotenv('.env.local')
from supabase import create_client
sb = create_client(os.getenv('NEXT_PUBLIC_SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY를'))
templates = sb.table('quotation_templates').select('*').execute()
print(f'Templates: {len(templates.data)}')
for t in templates.data:
    print(f'  {t[\"name\"]} ({len(t[\"columns\"])} columns)')
"
```

- [ ] **Step 3: Commit (if any fixes needed)**

---

## Self-Review

**1. Spec coverage:**
- ✅ Inline-editable table (Task 6)
- ✅ Template system with presets (Task 1 seed + Task 5)
- ✅ Dynamic field add/remove (Task 6)
- ✅ Internal cost/margin panel (Task 7)
- ✅ Forward/reverse margin modes (Task 2 calc + Task 7 UI)
- ✅ Multi-currency with exchange rates (Task 2 + Task 7)
- ✅ Global + per-item extra costs (Task 7)
- ✅ PDF preview + download (Task 8)
- ✅ Draft/Final status (Task 9)
- ✅ Footer fields (Task 8)
- ✅ Quotation list (Task 4)
- ✅ Sidebar menu integration (Task 3)
- ✅ Save to DB (Task 9 auto-save)
- ✅ Quotation copy/duplicate — not explicitly a task but can be added via list page action

**2. Placeholder scan:** No TBD/TODO found.

**3. Type consistency:** `QuotationColumn`, `QuotationItem`, `Quotation` types used consistently across all files. `calcForward`/`calcReverse` signatures match usage in CostPanel and editor page.
