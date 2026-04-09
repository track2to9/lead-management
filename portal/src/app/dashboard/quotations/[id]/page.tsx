"use client";

import { useOne, useList, useUpdate, useCreate, useDelete } from "@refinedev/core";
import { useParams } from "next/navigation";
import { Input, InputNumber, Select, Button, Space, Typography, Breadcrumb, Tag, Spin, Tabs, DatePicker, Popconfirm } from "antd";
import { HomeOutlined, CheckCircleOutlined, FilePdfOutlined, PlusOutlined, DeleteOutlined, CalculatorOutlined, FileTextOutlined, MinusCircleOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import Link from "next/link";
import { useState, useRef } from "react";
import type { Quotation, QuotationItem, QuotationColumn, ExtraCost } from "@/lib/types";
import { calcForward, calcReverse, calcSummary, formatCurrency, convertCurrency } from "@/lib/quotation-calc";
import QuotationPDF from "@/components/quotation/QuotationPDF";
import ImageUploader from "@/components/quotation/ImageUploader";

const { Title, Text } = Typography;

export default function QuotationEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [showPDF, setShowPDF] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ itemId: string; key: string } | null>(null);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<any>(null);

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

  const q = qq.data?.data as Quotation | undefined;
  const items = iq.data?.data || [];

  if (qq.isLoading || !q) {
    return <div style={{ textAlign: "center", padding: 64 }}><Spin size="large" /></div>;
  }

  // TS can't narrow `q` inside closures after early return. Force it.
  const quotation = q as Quotation;

  const rates = quotation.exchange_rates || {};
  const h = quotation.company_header || {};
  const f = quotation.footer || {};
  const summary = calcSummary(items, quotation.global_costs || [], rates);
  const totalAmount = items.reduce((s, i) => s + (Number(i.cells?.amount) || 0), 0);

  // --- save helpers ---
  function saveQ(values: Partial<Quotation>) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      updateQuotation({ resource: "quotations", id, values });
    }, 800);
  }
  function saveHeader(key: string, value: string) {
    saveQ({ company_header: { ...h, [key]: value } });
  }
  function saveFooter(key: string, value: string) {
    saveQ({ footer: { ...f, [key]: value } });
  }

  // --- inline editable text (for viewer tab) ---
  function InlineText({ value, onSave, placeholder, style }: { value: string; onSave: (v: string) => void; placeholder?: string; style?: React.CSSProperties }) {
    const fieldKey = placeholder || "field";
    const isEditing = editingField === fieldKey;
    if (isEditing) {
      return <Input defaultValue={value} size="small" autoFocus placeholder={placeholder}
        style={{ ...style, background: "transparent", border: "1px solid #f15f23" }}
        onBlur={(e) => { onSave(e.target.value); setEditingField(null); }}
        onKeyDown={(e) => { if (e.key === "Enter") { onSave((e.target as HTMLInputElement).value); setEditingField(null); } }} />;
    }
    return (
      <span onClick={() => setEditingField(fieldKey)}
        style={{ ...style, cursor: "text", borderBottom: "1px dashed #d9d9d9", padding: "1px 2px", minWidth: 60, display: "inline-block" }}>
        {value || <span style={{ color: "#ccc" }}>{placeholder}</span>}
      </span>
    );
  }

  // --- cell editing for viewer table ---
  function onCellClick(itemId: string, key: string) {
    setEditingCell({ itemId, key });
    setTimeout(() => inputRef.current?.focus(), 50);
  }
  function onCellSave(itemId: string, key: string, value: string | number) {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const newCells = { ...item.cells, [key]: value };
    const hasPrice = q?.columns.some((c) => c.key === "price");
    const hasQty = q?.columns.some((c) => c.key === "qty");
    if (hasPrice && hasQty) {
      newCells.amount = Math.round((Number(newCells.price) || 0) * (Number(newCells.qty) || 0) * 100) / 100;
    }
    updateItem({ resource: "quotation_items", id: itemId, values: { cells: newCells, selling_price: Number(newCells.amount) || 0 } },
      { onSuccess: () => iq.refetch() });
    setEditingCell(null);
  }
  function renderViewerCell(item: QuotationItem, col: QuotationColumn) {
    const value = item.cells?.[col.key] ?? "";
    const isEditing = editingCell?.itemId === item.id && editingCell?.key === col.key;
    if (col.key === "amount") return <span style={{ fontWeight: 600 }}>{formatCurrency(Number(value) || 0, quotation.currency)}</span>;
    if (isEditing) {
      const isNum = col.type === "number" || col.type === "currency";
      return isNum ? (
        <InputNumber ref={inputRef} defaultValue={Number(value) || undefined} size="small" style={{ width: "100%", border: "1px solid #f15f23" }}
          onBlur={(e) => onCellSave(item.id, col.key, Number(e.target.value) || 0)}
          onKeyDown={(e) => { if (e.key === "Enter") { onCellSave(item.id, col.key, Number((e.target as HTMLInputElement).value) || 0); } }} />
      ) : (
        <Input ref={inputRef} defaultValue={String(value)} size="small" style={{ border: "1px solid #f15f23" }}
          onBlur={(e) => onCellSave(item.id, col.key, e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { onCellSave(item.id, col.key, (e.target as HTMLInputElement).value); } }} />
      );
    }
    return (
      <span onClick={() => onCellClick(item.id, col.key)}
        style={{ cursor: "text", borderBottom: "1px dashed transparent", padding: "1px 2px" }}
        onMouseEnter={(e) => (e.currentTarget.style.borderBottom = "1px dashed #d9d9d9")}
        onMouseLeave={(e) => (e.currentTarget.style.borderBottom = "1px dashed transparent")}>
        {col.type === "currency" ? formatCurrency(Number(value) || 0, quotation.currency) : String(value) || <span style={{ color: "#ccc" }}>-</span>}
      </span>
    );
  }

  // --- cost change for calc tab ---
  function onCostChange(itemId: string, field: string, value: number | string) {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const updates: Record<string, unknown> = { [field]: value };
    const cp = field === "cost_price" ? Number(value) : (item.cost_price || 0);
    const cc = field === "cost_currency" ? String(value) : item.cost_currency;
    if (field === "selling_price") {
      const r = calcReverse(Number(value), cp, cc, item.extra_costs || [], rates);
      updates.margin_percent = r.marginPercent;
      updates.margin_amount = r.marginAmount;
    } else {
      const mp = field === "margin_percent" ? Number(value) : (item.margin_percent || 0);
      const r = calcForward(cp, cc, mp, item.extra_costs || [], rates);
      updates.selling_price = r.sellingPrice;
      updates.margin_amount = r.marginAmount;
      const qty = Number(item.cells?.qty) || 1;
      updates.cells = { ...item.cells, price: r.sellingPrice, amount: Math.round(r.sellingPrice * qty * 100) / 100 };
    }
    updateItem({ resource: "quotation_items", id: itemId, values: updates }, { onSuccess: () => iq.refetch() });
  }

  // ============================================================
  // TAB 1: 견적서 (Document View — looks like actual q)
  // ============================================================
  const tabViewer = (
    <div style={{ maxWidth: 800, margin: "0 auto", background: "#fff", border: "1px solid #e0e0e0", borderRadius: 4, padding: "40px 48px", position: "relative", minHeight: 600 }}>
      {quotation.status === "draft" && (
        <div style={{ position: "absolute", top: "40%", left: "50%", transform: "translate(-50%, -50%) rotate(-30deg)", fontSize: 72, color: "rgba(0,0,0,0.03)", fontWeight: 900, pointerEvents: "none", userSelect: "none" }}>DRAFT</div>
      )}

      {/* ===== HEADER: Logo + Title ===== */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        {/* Left: Logo */}
        <div style={{ flex: 1 }}>
          <ImageUploader
            value={h.logo_url}
            onChange={(url) => saveHeader("logo_url", url || "")}
            folder="logos"
            placeholder="로고 이미지 업로드"
            maxHeight={60}
          />
        </div>
        {/* Right: Title */}
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#cc0000", fontStyle: "italic" }}>
            <InlineText value={h.doc_title || "Quotation"} onSave={(v) => saveHeader("doc_title", v)} placeholder="Quotation" style={{ fontSize: 28, fontWeight: 900, color: "#cc0000", fontStyle: "italic" }} />
          </div>
        </div>
      </div>

      {/* Divider line */}
      <div style={{ height: 3, background: "linear-gradient(to right, #999, #ccc)", marginBottom: 12 }} />

      {/* ===== Company Info (below logo) ===== */}
      <div style={{ fontSize: 11, color: "#333", lineHeight: 1.8, marginBottom: 20 }}>
        <div><InlineText value={h.address || ""} onSave={(v) => saveHeader("address", v)} placeholder="주소 (예: 509 Hyundai Tower, 293-19, Olympic-ro...)" /></div>
        <div>Tel : <InlineText value={h.tel || ""} onSave={(v) => saveHeader("tel", v)} placeholder="+82 70 4103 0770" /></div>
        <div>Website: <InlineText value={h.web || ""} onSave={(v) => saveHeader("web", v)} placeholder="www.example.com" /></div>
      </div>

      {/* ===== Dynamic Header Fields (Left + Right) ===== */}
      {(() => {
        // 기본 좌측 필드
        const defaultLeftFields = [
          { key: "client_name", label: "To", value: quotation.client_name || "", isRed: true, isQ: true },
          { key: "from_name", label: "From", value: h.from_name || h.name || "" },
          { key: "attn", label: "Attn.", value: h.attn || "" },
          { key: "subject", label: "Subject", value: h.subject || "", isRed: true },
        ];
        // 추가된 커스텀 좌측 필드
        const extraLeftFields = (h.extra_left_fields || []) as unknown as { key: string; label: string; value: string }[];

        // 기본 우측 필드
        const defaultRightFields = [
          { key: "ref_no", label: "Ref No", value: quotation.ref_no, isRed: true, isQ: true },
          { key: "date", label: "Date", value: quotation.date, isRed: true, isQ: true, isDate: true },
        ];
        const extraRightFields = (h.extra_right_fields || []) as unknown as { key: string; label: string; value: string }[];

        return (
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 32, marginBottom: 24, fontSize: 13 }}>
            {/* Left fields */}
            <div style={{ lineHeight: 2.4 }}>
              {defaultLeftFields.map((field) => (
                <div key={field.key} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <strong style={{ minWidth: 70 }}>{field.label}</strong>
                  <span>: <InlineText
                    value={field.value}
                    onSave={(v) => field.isQ ? saveQ({ [field.key]: v }) : saveHeader(field.key, v)}
                    placeholder={field.label}
                    style={field.isRed ? { color: "#cc0000", fontWeight: 600 } : {}}
                  /></span>
                </div>
              ))}
              {extraLeftFields.map((field, i) => (
                <div key={`el-${i}`} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <InlineText value={field.label} onSave={(v) => {
                    const arr = [...extraLeftFields]; arr[i] = { ...arr[i], label: v };
                    saveHeader("extra_left_fields", arr as unknown as string);
                  }} placeholder="필드명" style={{ minWidth: 70, fontWeight: 700 }} />
                  <span>: <InlineText value={field.value} onSave={(v) => {
                    const arr = [...extraLeftFields]; arr[i] = { ...arr[i], value: v };
                    saveHeader("extra_left_fields", arr as unknown as string);
                  }} placeholder="값 입력" /></span>
                  <MinusCircleOutlined style={{ color: "#ff4d4f", cursor: "pointer", fontSize: 11 }}
                    onClick={() => {
                      const arr = extraLeftFields.filter((_, j) => j !== i);
                      saveHeader("extra_left_fields", arr as unknown as string);
                    }} />
                </div>
              ))}
              <Button type="dashed" size="small" icon={<PlusOutlined />} style={{ marginTop: 4, fontSize: 11 }}
                onClick={() => {
                  const arr = [...extraLeftFields, { key: `custom_${Date.now()}`, label: "", value: "" }];
                  saveHeader("extra_left_fields", arr as unknown as string);
                }}>좌측 필드 추가</Button>
            </div>

            {/* Right fields */}
            <div style={{ lineHeight: 2.4, textAlign: "right" }}>
              {defaultRightFields.map((field) => (
                <div key={field.key} style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
                  <strong>{field.label} : </strong>
                  {field.isDate ? (
                    <DatePicker
                      value={field.value ? dayjs(field.value) : undefined}
                      onChange={(d) => saveQ({ date: d ? d.format("YYYY-MM-DD") : "" })}
                      format="YYYY-MM-DD"
                      size="small"
                      allowClear={false}
                      style={{ width: 140 }}
                      variant="borderless"
                      suffixIcon={null}
                    />
                  ) : (
                    <InlineText value={field.value} onSave={(v) => saveQ({ [field.key]: v })} placeholder={field.label} style={{ color: "#cc0000" }} />
                  )}
                </div>
              ))}
              {extraRightFields.map((field, i) => (
                <div key={`er-${i}`} style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
                  <InlineText value={field.label} onSave={(v) => {
                    const arr = [...extraRightFields]; arr[i] = { ...arr[i], label: v };
                    saveHeader("extra_right_fields", arr as unknown as string);
                  }} placeholder="필드명" style={{ fontWeight: 700 }} />
                  <span>: <InlineText value={field.value} onSave={(v) => {
                    const arr = [...extraRightFields]; arr[i] = { ...arr[i], value: v };
                    saveHeader("extra_right_fields", arr as unknown as string);
                  }} placeholder="값 입력" style={{ color: "#cc0000" }} /></span>
                  <MinusCircleOutlined style={{ color: "#ff4d4f", cursor: "pointer", fontSize: 11 }}
                    onClick={() => {
                      const arr = extraRightFields.filter((_, j) => j !== i);
                      saveHeader("extra_right_fields", arr as unknown as string);
                    }} />
                </div>
              ))}
              <Button type="dashed" size="small" icon={<PlusOutlined />} style={{ marginTop: 4, fontSize: 11 }}
                onClick={() => {
                  const arr = [...extraRightFields, { key: `custom_${Date.now()}`, label: "", value: "" }];
                  saveHeader("extra_right_fields", arr as unknown as string);
                }}>우측 필드 추가</Button>
            </div>
          </div>
        );
      })()}

      {/* Dear Sir, intro */}
      <div style={{ fontSize: 12, marginBottom: 16, lineHeight: 1.8 }}>
        <InlineText value={h.greeting || "Dear Sir,"} onSave={(v) => saveHeader("greeting", v)} placeholder="Dear Sir," />
        <br />
        <InlineText value={h.intro || "We are pleased to offer the following goods as per terms and conditions set forth hereunder."} onSave={(v) => saveHeader("intro", v)} placeholder="인사말/소개문" style={{ fontSize: 11 }} />
      </div>

      {/* Items Table — actual quotation look */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20, fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ border: "1px solid #333", padding: "6px 8px", background: "#f5f5f5", width: 36 }}>No</th>
            {quotation.columns.map((col) => (
              <th key={col.key} style={{ border: "1px solid #333", padding: "6px 8px", background: "#f5f5f5", textAlign: col.type === "currency" || col.type === "number" ? "right" : "left" }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={item.id}>
              <td style={{ border: "1px solid #333", padding: "4px 8px", textAlign: "center" }}>{idx + 1}</td>
              {quotation.columns.map((col) => (
                <td key={col.key} style={{ border: "1px solid #333", padding: "4px 8px", textAlign: col.type === "currency" || col.type === "number" ? "right" : "left" }}>
                  {renderViewerCell(item, col)}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <td colSpan={quotation.columns.length} style={{ border: "1px solid #333", padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>TTL</td>
            <td style={{ border: "1px solid #333", padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>{formatCurrency(totalAmount, quotation.currency)}</td>
          </tr>
        </tbody>
      </table>

      <Button size="small" icon={<PlusOutlined />} style={{ marginBottom: 20 }}
        onClick={() => createItem({ resource: "quotation_items",
          values: { quotation_id: id, sort_order: items.length, cells: {}, cost_price: 0, cost_currency: "CNY", selling_price: 0, margin_percent: 0, margin_amount: 0, extra_costs: [] },
        }, { onSuccess: () => iq.refetch() })}>행 추가</Button>

      {/* ===== Terms & Conditions (Dynamic) ===== */}
      {(() => {
        const defaultTerms = [
          { key: "payment_terms", label: "Payment", placeholder: "By T/T in advance...", isRed: true },
          { key: "packing", label: "Packing", placeholder: "Export standard packing (Wooden box)" },
          { key: "delivery", label: "Delivery", placeholder: "Within 8 weeks after order confirmation" },
          { key: "validity", label: "Validity", placeholder: "31 Mar, 2026", isRed: true },
          { key: "remarks", label: "Remarks", placeholder: "Bank reference, etc." },
        ];
        const extraTerms = (f.extra_terms || []) as unknown as { key: string; label: string; value: string }[];

        return (
          <div style={{ fontSize: 11, lineHeight: 2.2, borderTop: "1px solid #e0e0e0", paddingTop: 16, marginTop: 8 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>※ Terms & Conditions</div>
            {defaultTerms.map((term) => (
              <div key={term.key} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <strong style={{ minWidth: 100 }}>{term.label}</strong>
                <span>: <InlineText value={f[term.key] || ""} onSave={(v) => saveFooter(term.key, v)} placeholder={term.placeholder} style={term.isRed ? { color: "#cc0000" } : {}} /></span>
                <Popconfirm title="이 필드를 삭제하시겠습니까?" onConfirm={() => {
                  const newF = { ...f }; delete newF[term.key];
                  saveQ({ footer: newF });
                }} okText="삭제" cancelText="취소">
                  <MinusCircleOutlined style={{ color: "#ff4d4f", cursor: "pointer", fontSize: 10, opacity: 0.4 }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.4")} />
                </Popconfirm>
              </div>
            ))}
            {extraTerms.map((term, i) => (
              <div key={`et-${i}`} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <InlineText value={term.label} onSave={(v) => {
                  const arr = [...extraTerms]; arr[i] = { ...arr[i], label: v };
                  saveFooter("extra_terms", arr as unknown as string);
                }} placeholder="항목명" style={{ minWidth: 100, fontWeight: 700 }} />
                <span>: <InlineText value={term.value} onSave={(v) => {
                  const arr = [...extraTerms]; arr[i] = { ...arr[i], value: v };
                  saveFooter("extra_terms", arr as unknown as string);
                }} placeholder="내용 입력" /></span>
                <MinusCircleOutlined style={{ color: "#ff4d4f", cursor: "pointer", fontSize: 10 }}
                  onClick={() => {
                    const arr = extraTerms.filter((_, j) => j !== i);
                    saveFooter("extra_terms", arr as unknown as string);
                  }} />
              </div>
            ))}
            <Button type="dashed" size="small" icon={<PlusOutlined />} style={{ marginTop: 4, fontSize: 10 }}
              onClick={() => {
                const arr = [...extraTerms, { key: `term_${Date.now()}`, label: "", value: "" }];
                saveFooter("extra_terms", arr as unknown as string);
              }}>조건 항목 추가</Button>
          </div>
        );
      })()}

      {/* ===== Signature Block ===== */}
      <div style={{ marginTop: 40, display: "flex", justifyContent: "flex-end" }}>
        <div style={{ textAlign: "center", minWidth: 200 }}>
          <div style={{ fontSize: 10, fontStyle: "italic", color: "#666", marginBottom: 8 }}>For and on behalf of</div>
          <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: 2, marginBottom: 4 }}>
            <InlineText value={f.sig_company || h.from_name || h.name || ""} onSave={(v) => saveFooter("sig_company", v)} placeholder="COMPANY NAME" style={{ fontSize: 14, fontWeight: 900, letterSpacing: 2 }} />
          </div>
          {/* Signature image */}
          <div style={{ margin: "8px auto", display: "flex", justifyContent: "center" }}>
            <ImageUploader
              value={f.sig_image_url}
              onChange={(url) => saveFooter("sig_image_url", url || "")}
              folder="signatures"
              placeholder="서명 이미지 업로드"
              maxHeight={50}
            />
          </div>
          <div style={{ borderTop: "1px solid #000", paddingTop: 4, marginTop: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 700 }}>
              <InlineText value={f.sig_name || ""} onSave={(v) => saveFooter("sig_name", v)} placeholder="KIM JOO SIK" style={{ fontWeight: 700 }} />
              {" / "}
              <InlineText value={f.sig_title || ""} onSave={(v) => saveFooter("sig_title", v)} placeholder="Managing Director" />
            </div>
            <div style={{ fontSize: 9, color: "#666", fontStyle: "italic" }}>Authorized Signature</div>
          </div>
        </div>
      </div>
    </div>
  );

  // ============================================================
  // TAB 2: 계산 (Cost/Margin calculation table)
  // ============================================================
  const tabCalc = (
    <div>
      {/* Exchange rate controls */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, padding: 12, background: "#fafafa", borderRadius: 8, alignItems: "end", flexWrap: "wrap" }}>
        <div>
          <Text type="secondary" style={{ fontSize: 10, display: "block" }}>USD/CNY</Text>
          <InputNumber size="small" value={rates.CNY || 7.2} style={{ width: 80 }}
            onChange={(v) => updateQuotation({ resource: "quotations", id, values: { exchange_rates: { ...rates, CNY: v || 7.2 } } }, { onSuccess: () => qq.refetch() })} />
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 10, display: "block" }}>USD/KRW</Text>
          <InputNumber size="small" value={rates.KRW || 1380} style={{ width: 80 }}
            onChange={(v) => updateQuotation({ resource: "quotations", id, values: { exchange_rates: { ...rates, KRW: v || 1380 } } }, { onSuccess: () => qq.refetch() })} />
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 10, display: "block" }}>출력 통화</Text>
          <Input size="small" value={quotation.currency} style={{ width: 60 }}
            onChange={(e) => saveQ({ currency: e.target.value })} />
        </div>
      </div>

      {/* Unified calc table */}
      <div style={{ overflowX: "auto", border: "1px solid #e0e0e0", borderRadius: 8, background: "#fff" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ padding: "8px 6px", background: "#f5f5f5", borderBottom: "2px solid #e0e0e0", width: 36 }}>No</th>
              {/* Customer columns */}
              {quotation.columns.map((col) => (
                <th key={col.key} style={{ padding: "8px 6px", background: "#f5f5f5", borderBottom: "2px solid #e0e0e0", minWidth: col.width || 100, textAlign: "left" }}>
                  {col.label}
                </th>
              ))}
              {/* Divider + Internal */}
              <th style={{ background: "#fff7ed", borderBottom: "2px solid #f15f23", borderLeft: "3px solid #f15f23", width: 3 }} />
              <th style={{ padding: "8px 6px", background: "#fff7ed", borderBottom: "2px solid #f15f23", minWidth: 80, textAlign: "right" }}>원가</th>
              <th style={{ padding: "8px 6px", background: "#fff7ed", borderBottom: "2px solid #f15f23", width: 55 }}>통화</th>
              <th style={{ padding: "8px 6px", background: "#fff7ed", borderBottom: "2px solid #f15f23", minWidth: 80, textAlign: "right" }}>원가(USD)</th>
              <th style={{ padding: "8px 6px", background: "#fff7ed", borderBottom: "2px solid #f15f23", minWidth: 60, textAlign: "right" }}>마진%</th>
              <th style={{ padding: "8px 6px", background: "#fff7ed", borderBottom: "2px solid #f15f23", minWidth: 80, textAlign: "right" }}>판매가</th>
              <th style={{ padding: "8px 6px", background: "#fff7ed", borderBottom: "2px solid #f15f23", minWidth: 80, textAlign: "right" }}>마진액</th>
              <th style={{ width: 32, background: "#f5f5f5", borderBottom: "2px solid #e0e0e0" }} />
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const costUSD = convertCurrency(item.cost_price || 0, item.cost_currency, rates);
              return (
                <tr key={item.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={{ padding: "4px 6px", textAlign: "center", color: "#999" }}>{idx + 1}</td>
                  {/* Customer cells (read-only summary in calc tab) */}
                  {quotation.columns.map((col) => {
                    const v = item.cells?.[col.key] ?? "";
                    return (
                      <td key={col.key} style={{ padding: "4px 6px", color: "#666", fontSize: 11 }}>
                        {col.type === "currency" ? formatCurrency(Number(v) || 0, quotation.currency) : String(v) || "-"}
                      </td>
                    );
                  })}
                  {/* Internal */}
                  <td style={{ borderLeft: "3px solid #f15f23" }} />
                  <td style={{ padding: "4px 4px", background: "#fffbf5", textAlign: "right" }}>
                    <InputNumber size="small" value={item.cost_price || undefined} style={{ width: 75 }}
                      onChange={(v) => onCostChange(item.id, "cost_price", v || 0)} />
                  </td>
                  <td style={{ padding: "4px 2px", background: "#fffbf5" }}>
                    <Select size="small" value={item.cost_currency} style={{ width: 55 }}
                      onChange={(v) => onCostChange(item.id, "cost_currency", v)}
                      options={[{ value: "CNY" }, { value: "KRW" }]} />
                  </td>
                  <td style={{ padding: "4px 6px", background: "#fffbf5", textAlign: "right", color: "#999", fontSize: 11 }}>
                    {formatCurrency(costUSD, "USD")}
                  </td>
                  <td style={{ padding: "4px 4px", background: "#fffbf5", textAlign: "right" }}>
                    <InputNumber size="small" value={item.margin_percent || undefined} style={{ width: 55 }}
                      onChange={(v) => onCostChange(item.id, "margin_percent", v || 0)} />
                  </td>
                  <td style={{ padding: "4px 4px", background: "#fffbf5", textAlign: "right" }}>
                    <InputNumber size="small" value={item.selling_price || undefined} style={{ width: 75 }}
                      onChange={(v) => onCostChange(item.id, "selling_price", v || 0)} />
                  </td>
                  <td style={{ padding: "4px 6px", background: "#fffbf5", textAlign: "right", fontWeight: 600,
                    color: (item.margin_amount || 0) >= 0 ? "#52c41a" : "#ff4d4f" }}>
                    {formatCurrency(item.margin_amount || 0, quotation.currency)}
                  </td>
                  <td style={{ padding: "4px", textAlign: "center" }}>
                    <DeleteOutlined style={{ color: "#ff4d4f", cursor: "pointer", fontSize: 11 }}
                      onClick={() => deleteItem({ resource: "quotation_items", id: item.id }, { onSuccess: () => iq.refetch() })} />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "2px solid #e0e0e0", background: "#f9f9f9" }}>
              <td colSpan={quotation.columns.length + 1} style={{ padding: "8px 6px", fontWeight: 700 }}>TTL</td>
              <td style={{ borderLeft: "3px solid #f15f23" }} />
              <td colSpan={2} style={{ padding: "8px 6px", background: "#fff7ed", fontSize: 11, textAlign: "right" }}>
                총원가 {formatCurrency(summary.totalCost, "USD")}
              </td>
              <td colSpan={2} style={{ padding: "8px 6px", background: "#fff7ed", fontSize: 11, textAlign: "right" }}>
                부대비용 {formatCurrency(summary.totalExtraCosts, "USD")}
              </td>
              <td style={{ padding: "8px 6px", background: summary.totalMargin >= 0 ? "#f6ffed" : "#fff2f0", fontWeight: 700, textAlign: "right",
                color: summary.totalMargin >= 0 ? "#52c41a" : "#ff4d4f" }}>
                마진 {formatCurrency(summary.totalMargin, quotation.currency)} ({summary.marginPercent}%)
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Global costs */}
      <div style={{ marginTop: 12, padding: 12, background: "#fafafa", borderRadius: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Text strong style={{ fontSize: 12 }}>전체 부대비용</Text>
          <Button size="small" icon={<PlusOutlined />}
            onClick={() => updateQuotation({ resource: "quotations", id,
              values: { global_costs: [...(quotation.global_costs || []), { name: "", amount: 0, currency: "USD" }] } },
              { onSuccess: () => qq.refetch() })}>추가</Button>
        </div>
        {(quotation.global_costs || []).map((cost: ExtraCost, i: number) => (
          <div key={i} style={{ display: "flex", gap: 4, marginBottom: 4, alignItems: "center" }}>
            <Input size="small" value={cost.name} placeholder="항목명" style={{ width: 120 }}
              onChange={(e) => { const c = [...(quotation.global_costs || [])]; c[i] = { ...c[i], name: e.target.value };
                updateQuotation({ resource: "quotations", id, values: { global_costs: c } }); }} />
            <InputNumber size="small" value={cost.amount} style={{ width: 80 }}
              onChange={(v) => { const c = [...(quotation.global_costs || [])]; c[i] = { ...c[i], amount: v || 0 };
                updateQuotation({ resource: "quotations", id, values: { global_costs: c } }); }} />
            <Select size="small" value={cost.currency} style={{ width: 60 }}
              onChange={(v) => { const c = [...(quotation.global_costs || [])]; c[i] = { ...c[i], currency: v };
                updateQuotation({ resource: "quotations", id, values: { global_costs: c } }); }}
              options={[{ value: "USD" }, { value: "CNY" }, { value: "KRW" }]} />
            <DeleteOutlined style={{ color: "#ff4d4f", cursor: "pointer" }}
              onClick={() => { const c = (quotation.global_costs || []).filter((_: ExtraCost, j: number) => j !== i);
                updateQuotation({ resource: "quotations", id, values: { global_costs: c } }, { onSuccess: () => qq.refetch() }); }} />
          </div>
        ))}
      </div>
    </div>
  );

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div>
      <Breadcrumb className="mb-4" items={[
        { title: <Link href="/dashboard"><HomeOutlined /> 대시보드</Link> },
        { title: <Link href="/dashboard/quotations">견적서</Link> },
        { title: quotation.ref_no },
      ]} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <Space align="center">
          <Title level={4} style={{ margin: 0 }}>{quotation.ref_no}</Title>
          <Tag color={quotation.status === "final" ? "green" : "default"}>
            {quotation.status === "final" ? "완료" : "작성 중"}
          </Tag>
        </Space>
        <Space>
          <Button size="small" icon={<FilePdfOutlined />} onClick={() => setShowPDF(true)}>PDF</Button>
          <Button size="small" type="primary" icon={<CheckCircleOutlined />}
            onClick={() => updateQuotation(
              { resource: "quotations", id, values: { status: quotation.status === "final" ? "draft" : "final" } },
              { onSuccess: () => qq.refetch() },
            )}>
            {quotation.status === "final" ? "Draft" : "완료"}
          </Button>
        </Space>
      </div>

      <Tabs size="large" items={[
        { key: "doc", label: <><FileTextOutlined /> 견적서</>, children: tabViewer },
        { key: "calc", label: <><CalculatorOutlined /> 계산</>, children: tabCalc },
      ]} />

      <QuotationPDF quotation={q} items={items} open={showPDF} onClose={() => setShowPDF(false)} />
    </div>
  );
}
