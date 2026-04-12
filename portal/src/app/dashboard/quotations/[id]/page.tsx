"use client";

import { useOne, useList, useUpdate, useCreate, useDelete } from "@refinedev/core";
import { useParams } from "next/navigation";
import { Input, InputNumber, Select, Button, Space, Typography, Breadcrumb, Tag, Spin, Tabs, DatePicker, Popconfirm, message } from "antd";
import { HomeOutlined, CheckCircleOutlined, FilePdfOutlined, PlusOutlined, DeleteOutlined, CalculatorOutlined, FileTextOutlined, MinusCircleOutlined, CopyOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import Link from "next/link";
import { useState, useRef, useEffect, useCallback, type CSSProperties } from "react";
import { EyeOutlined, EyeInvisibleOutlined } from "@ant-design/icons";
import type { Quotation, QuotationItem, QuotationColumn, ExtraCost } from "@/lib/types";
import { calcForward, calcReverse, calcSummary, formatCurrency, convertCurrency } from "@/lib/quotation-calc";
import { useRefExchangeRates } from "@/lib/use-exchange-rates";
import QuotationPDF from "@/components/quotation/QuotationPDF";
import ImageUploader from "@/components/quotation/ImageUploader";
import VerifyBanner from "@/components/quotation/VerifyBanner";
import { supabaseClient } from "@/lib/supabase-client";
// ColumnManager removed — column controls now inline in table header

const { Title, Text } = Typography;

export default function QuotationEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [showPDF, setShowPDF] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingColIdx, setEditingColIdx] = useState<number | null>(null);
  const [dragCol, setDragCol] = useState<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<number | null>(null);
  const [resizingCol, setResizingCol] = useState<number | null>(null);
  const [editingCostColIdx, setEditingCostColIdx] = useState<number | null>(null);
  const [dragCostCol, setDragCostCol] = useState<number | null>(null);
  const [dragOverCostCol, setDragOverCostCol] = useState<number | null>(null);
  const [resizingCostCol, setResizingCostCol] = useState<number | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartW = useRef(0);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const refRates = useRefExchangeRates();

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

  const qRaw = qq.data?.data as Quotation | undefined;
  const itemsRaw = iq.data?.data || [];

  // === Local state (편집은 로컬, 저장 시에만 DB) ===
  const [localQ, setLocalQ] = useState<Quotation | null>(null);
  const [localItems, setLocalItems] = useState<QuotationItem[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // DB → 로컬 동기화 (최초 로드 및 외부 변경 시)
  useEffect(() => {
    if (qRaw && !isDirty) setLocalQ(qRaw);
  }, [qRaw]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (itemsRaw.length > 0 && !isDirty) setLocalItems(itemsRaw);
  }, [itemsRaw]); // eslint-disable-line react-hooks/exhaustive-deps

  if (qq.isLoading || !localQ) {
    return <div style={{ textAlign: "center", padding: 64 }}><Spin size="large" /></div>;
  }

  const quotation = localQ;
  const items = localItems;

  const rates = quotation.exchange_rates || {};
  const h = quotation.company_header || {};
  const f = quotation.footer || {};
  const costCols = quotation.cost_columns || [];
  const summary = calcSummary(items, quotation.global_costs || [], rates);
  const totalAmount = items.reduce((s, i) => s + (Number(i.cells?.amount) || 0), 0);
  const visibleItems = items.filter((i) => String(i.cells?._visible) !== "false");
  const visibleTotalAmount = visibleItems.reduce((s, i) => s + (Number(i.cells?.amount) || 0), 0);

  // --- 로컬 수정 헬퍼 (DB 안 씀) ---
  function editQ(values: Partial<Quotation>) {
    setLocalQ((prev) => prev ? { ...prev, ...values } : prev);
    setIsDirty(true);
  }
  function saveQ(values: Partial<Quotation>) { editQ(values); }
  function saveHeader(key: string, value: string) {
    editQ({ company_header: { ...h, [key]: value } });
  }
  function saveFooter(key: string, value: string) {
    editQ({ footer: { ...f, [key]: value } });
  }
  function editItem(itemId: string, values: Partial<QuotationItem>) {
    // For imported quotations: diff incoming cells against current, drop confidence for any changed key
    if (values.cells && localQ?.source === "imported_pdf" && localQ.import_confidence?.items?.[itemId]) {
      const currentItem = localItems.find((i) => i.id === itemId);
      if (currentItem) {
        const changedKeys: string[] = [];
        for (const [k, v] of Object.entries(values.cells)) {
          if ((currentItem.cells as Record<string, unknown>)[k] !== v) changedKeys.push(k);
        }
        if (changedKeys.length > 0) {
          const prevItemConf = localQ.import_confidence.items[itemId] ?? {};
          const nextItemConf: Record<string, number> = { ...prevItemConf };
          for (const k of changedKeys) delete nextItemConf[k];
          const nextImportConfidence = {
            ...localQ.import_confidence,
            items: { ...localQ.import_confidence.items, [itemId]: nextItemConf },
          };
          setLocalQ((prev) => prev ? { ...prev, import_confidence: nextImportConfidence } : prev);
        }
      }
    }
    setLocalItems((prev) => prev.map((i) => i.id === itemId ? { ...i, ...values } as QuotationItem : i));
    setIsDirty(true);
  }
  function addLocalItem(values: Partial<QuotationItem>) {
    const tempId = "temp_" + Date.now().toString(36);
    setLocalItems((prev) => [...prev, { id: tempId, quotation_id: id, sort_order: prev.length, cells: {}, cost_price: null, cost_currency: "CNY", selling_price: null, margin_percent: null, margin_amount: null, extra_costs: [], created_at: "", ...values } as QuotationItem]);
    setIsDirty(true);
  }
  function removeLocalItem(itemId: string) {
    setLocalItems((prev) => prev.filter((i) => i.id !== itemId));
    setIsDirty(true);
  }

  // --- DB 저장 (임시 저장 / 완료) ---
  async function flushToDB(newStatus?: "draft" | "final") {
    setSaving(true);
    try {
      // 1) quotation 저장
      const qValues: Record<string, unknown> = { ...quotation };
      delete qValues.id; delete qValues.created_at; delete qValues.updated_at; delete qValues.user_id;
      if (newStatus) qValues.status = newStatus;
      await new Promise<void>((res, rej) =>
        updateQuotation({ resource: "quotations", id, values: qValues }, { onSuccess: () => res(), onError: (e) => rej(e) })
      );
      // 2) 신규 아이템 생성 + 기존 아이템 업데이트
      for (const item of localItems) {
        const { id: itemId, created_at, ...vals } = item;
        if (itemId.startsWith("temp_")) {
          await new Promise<void>((res, rej) =>
            createItem({ resource: "quotation_items", values: { ...vals, quotation_id: id } }, { onSuccess: () => res(), onError: (e) => rej(e) })
          );
        } else {
          await new Promise<void>((res, rej) =>
            updateItem({ resource: "quotation_items", id: itemId, values: vals }, { onSuccess: () => res(), onError: (e) => rej(e) })
          );
        }
      }
      // 3) 삭제된 아이템 처리
      const localIds = new Set(localItems.map((i) => i.id));
      for (const orig of itemsRaw) {
        if (!localIds.has(orig.id)) {
          await new Promise<void>((res, rej) =>
            deleteItem({ resource: "quotation_items", id: orig.id }, { onSuccess: () => res(), onError: (e) => rej(e) })
          );
        }
      }
      // 4) 리프레시
      await qq.refetch();
      await iq.refetch();
      setIsDirty(false);
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
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

  // --- viewer table cell (read-only — data comes from calc tab) ---
  function renderViewerCell(item: QuotationItem, col: QuotationColumn) {
    const value = item.cells?.[col.key] ?? "";
    if (col.key === "amount") return <span style={{ fontWeight: 600 }}>{formatCurrency(Number(value) || 0, quotation.currency)}</span>;
    if (col.type === "currency") return <span>{formatCurrency(Number(value) || 0, quotation.currency)}</span>;
    if (col.type === "number") return <span>{Number(value) || ""}</span>;
    return <span>{String(value) || "-"}</span>;
  }

  // --- cost change for calc tab ---
  function onCostChange(itemId: string, field: string, value: number | string) {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const updates: Partial<QuotationItem> = { [field]: value } as Partial<QuotationItem>;
    const cp = field === "cost_price" ? Number(value) : (item.cost_price || 0);
    const cc = String(rates._cost_cur || "CNY");
    updates.cost_currency = cc;
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
    editItem(itemId, updates);
  }

  // --- visibility toggle ---
  function toggleVisibility(itemId: string) {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const isVisible = String(item.cells?._visible) !== "false";
    editItem(itemId, { cells: { ...item.cells, _visible: isVisible ? "false" : "true" } });
  }

  // --- convert purchase price to target currency ---
  function convertTo(amount: number, fromCurrency: string, toCurrency: string): number {
    if (fromCurrency === toCurrency) return amount;
    // rates are stored as USD/X (how many X per 1 USD)
    const toUSD = fromCurrency === "USD" ? amount : amount / (rates[fromCurrency] || 1);
    if (toCurrency === "USD") return toUSD;
    return toUSD * (rates[toCurrency] || 1);
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
          {items.filter((i) => String(i.cells?._visible) !== "false").map((item, idx) => {
            const isMerged = String(item.cells?._merged) === "true";
            if (isMerged) {
              return (
                <tr key={item.id}>
                  <td style={{ border: "1px solid #333", padding: "4px 8px", textAlign: "center" }}>{idx + 1}</td>
                  <td colSpan={quotation.columns.length - 1} style={{ border: "1px solid #333", padding: "4px 8px", textAlign: "center" }}>
                    {String(item.cells?._merged_label || "")}
                  </td>
                  <td style={{ border: "1px solid #333", padding: "4px 8px", textAlign: "right", fontWeight: 600 }}>
                    {formatCurrency(Number(item.cells?.amount) || 0, quotation.currency)}
                  </td>
                </tr>
              );
            }
            return (
              <tr key={item.id}>
                <td style={{ border: "1px solid #333", padding: "4px 8px", textAlign: "center" }}>{idx + 1}</td>
                {quotation.columns.map((col) => (
                  <td key={col.key} style={{ border: "1px solid #333", padding: "4px 8px", textAlign: col.type === "currency" || col.type === "number" ? "right" : "left" }}>
                    {renderViewerCell(item, col)}
                  </td>
                ))}
              </tr>
            );
          })}
          <tr>
            <td colSpan={quotation.columns.length} style={{ border: "1px solid #333", padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>TTL</td>
            <td style={{ border: "1px solid #333", padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>{formatCurrency(visibleTotalAmount, quotation.currency)}</td>
          </tr>
        </tbody>
      </table>

      {/* 행 추가/편집은 "계산" 탭에서 관리 — 여기는 읽기 전용 */}
      {items.length === 0 && (
        <div style={{ textAlign: "center", padding: 16, color: "#999", fontSize: 11 }}>
          "계산" 탭에서 항목을 추가하세요.
        </div>
      )}

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
      {/* Exchange rate controls — 우측 정렬, 각 환율 한 줄씩 */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <div style={{ padding: "8px 16px", background: "#fafafa", borderRadius: 8, fontSize: 11, display: "flex", gap: 24 }}>
          {/* 참조 환율 */}
          <div>
            <Text type="secondary" style={{ fontSize: 9, display: "block", marginBottom: 4 }}>
              📡 참조 환율 {refRates.date ? `(${refRates.date})` : ""} {refRates.loading && <Spin size="small" />}
            </Text>
            <div style={{ lineHeight: 2 }}>
              <div>USD/CNY: <strong>{refRates.USD_CNY ? refRates.USD_CNY.toFixed(4) : "—"}</strong></div>
              <div>USD/KRW: <strong>{refRates.USD_KRW ? refRates.USD_KRW.toFixed(0) : "—"}</strong></div>
            </div>
          </div>
          {/* 적용 환율 */}
          <div>
            <Text type="secondary" style={{ fontSize: 9, display: "block", marginBottom: 4 }}>적용 환율</Text>
            <div style={{ lineHeight: 2 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                USD/CNY:
                <InputNumber size="small" value={rates.CNY || 7.2} style={{ width: 80 }}
                  onChange={(v) => editQ({ exchange_rates: { ...rates, CNY: v || 7.2 } })} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                USD/KRW:
                <InputNumber size="small" value={rates.KRW || 1380} style={{ width: 80 }}
                  onChange={(v) => editQ({ exchange_rates: { ...rates, KRW: v || 1380 } })} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== 좌우 통합 테이블 ===== */}
      <style>{`
        .qt-unified { border-collapse: collapse; font-size: 12px; }
        .qt-unified td, .qt-unified th { vertical-align: middle; box-sizing: border-box; }
        .qt-unified .ant-input-number, .qt-unified .ant-input, .qt-unified .ant-select { height: 28px !important; }
        .qt-unified .ant-select .ant-select-selector { height: 28px !important; line-height: 28px !important; }
        .qt-unified .ant-input-number-input, .qt-unified .ant-input { height: 28px !important; line-height: 28px !important; }
        .qt-r-border { border-left: 3px solid #f15f23 !important; }
      `}</style>
      {/* 통합 테이블 */}
      <div style={{ overflowX: "auto", border: "2px solid #1890ff", borderRadius: 8, background: "#fff" }}>
        <table className="qt-unified" style={{ width: "max-content", minWidth: "100%" }}>
          <colgroup>
            {/* 좌측: No */}
            <col style={{ width: 36 }} />
            {/* 좌측: 동적 칼럼 */}
            {quotation.columns.map((col) => (
              <col key={col.key} style={{ width: col.width || 100 }} />
            ))}
            {/* 좌측: + 칼럼 추가, 👁 가시성, 행 삭제 */}
            <col style={{ width: 32 }} />
            <col style={{ width: 24 }} />
            <col style={{ width: 24 }} />
            {/* 우측: 구매단가, 환산, [추가칼럼...], 원가합(KRW), 마진율, + */}
            <col style={{ width: 100 }} />
            <col style={{ width: 100 }} />
            {costCols.map((cc) => (
              <col key={cc.key} style={{ width: cc.width || 80 }} />
            ))}
            <col style={{ width: 110 }} />
            <col style={{ width: 65 }} />
            <col style={{ width: 28 }} />
          </colgroup>
          <thead>
            {/* 타이틀 행 */}
            <tr>
              <th colSpan={quotation.columns.length + 4} style={{ background: "#e8f4fd", padding: "6px 12px", textAlign: "left", borderBottom: "1px solid #1890ff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Text strong style={{ color: "#1890ff", fontSize: 11 }}>📋 고객 전달용</Text>
                  <Space size={4}>
                    <span style={{ fontSize: 10, color: "#666" }}>통화</span>
                    <Select size="small" value={quotation.currency} style={{ width: 70 }}
                      onChange={(v) => saveQ({ currency: v })}
                      options={[{ value: "USD", label: "USD($)" }, { value: "EUR", label: "EUR(€)" }, { value: "KRW", label: "KRW(₩)" }, { value: "CNY", label: "CNY(¥)" }]} />
                    <Button size="small" icon={<PlusOutlined />}
                      onClick={() => addLocalItem({ sort_order: items.length, cells: {}, cost_price: 0, cost_currency: "CNY", selling_price: 0, margin_percent: 0, margin_amount: 0, extra_costs: [] })}>행 추가</Button>
                    <Button size="small" type="dashed" icon={<PlusOutlined />}
                      onClick={() => addLocalItem({ sort_order: items.length, cells: { _merged: "true", _merged_label: "", amount: 0 }, cost_price: 0, cost_currency: "CNY", selling_price: 0, margin_percent: 0, margin_amount: 0, extra_costs: [] })}>병합 행</Button>
                  </Space>
                </div>
              </th>
              <th className="qt-r-border" colSpan={4 + costCols.length + 1} style={{ background: "#fff7ed", padding: "6px 12px", textAlign: "left", borderBottom: "1px solid #f15f23" }}>
                <Text strong style={{ color: "#f15f23", fontSize: 11 }}>🔒 내부 마진 계산</Text>
              </th>
            </tr>
            {/* 칼럼 헤더 행 */}
            <tr>
              {/* 좌측 헤더 */}
              <th style={{ padding: "6px", background: "#f0f7ff", fontSize: 10 }}>No</th>
              {quotation.columns.map((col, ci) => {
                const isDragging = dragCol === ci;
                const isOver = dragOverCol === ci && dragCol !== ci;
                const dropLeft = isOver && dragCol !== null && dragCol > ci;
                const dropRight = isOver && dragCol !== null && dragCol < ci;
                return (
                  <th key={col.key}
                    draggable={editingColIdx !== ci && resizingCol === null}
                    onDragStart={(e) => {
                      if (resizingCol !== null) { e.preventDefault(); return; }
                      setDragCol(ci);
                      e.dataTransfer.effectAllowed = "move";
                      const el = e.currentTarget;
                      e.dataTransfer.setDragImage(el, el.offsetWidth / 2, el.offsetHeight / 2);
                    }}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverCol(ci); }}
                    onDragLeave={() => { if (dragOverCol === ci) setDragOverCol(null); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragCol !== null && dragCol !== ci) {
                        const arr = [...quotation.columns];
                        const [moved] = arr.splice(dragCol, 1);
                        arr.splice(ci, 0, moved);
                        editQ({ columns: arr });
                      }
                      setDragCol(null); setDragOverCol(null);
                    }}
                    onDragEnd={() => { setDragCol(null); setDragOverCol(null); }}
                    style={{
                      padding: "4px 2px", background: isDragging ? "#dbeafe" : "#f0f7ff",
                      textAlign: "center", fontSize: 10,
                      opacity: isDragging ? 0.5 : 1,
                      cursor: editingColIdx === ci ? "text" : "grab",
                      transition: "all 0.15s ease",
                      borderLeft: dropLeft ? "3px solid #1890ff" : undefined,
                      borderRight: dropRight ? "3px solid #1890ff" : undefined,
                      position: "relative", overflow: "hidden",
                    }}
                  >
                    {/* 삭제 버튼 — Price, Qty, Amount 삭제 불가 */}
                    {!["price", "qty", "amount"].includes(col.key) && (
                    <div style={{ position: "absolute", top: 1, right: 8, zIndex: 3 }}>
                      <Popconfirm
                        title={`"${col.label}" 칼럼을 삭제할까요?`}
                        okText="삭제" cancelText="취소" okButtonProps={{ danger: true, size: "small" }} cancelButtonProps={{ size: "small" }}
                        onConfirm={() => {
                          editQ({ columns: quotation.columns.filter((_, i) => i !== ci) });
                        }}
                      >
                        <span style={{ cursor: "pointer", color: "#ff4d4f", fontSize: 8, opacity: 0.4, transition: "opacity 0.15s" }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.4")}
                          onClick={(e) => e.stopPropagation()}>✕</span>
                      </Popconfirm>
                    </div>
                    )}
                    {/* 리사이즈 핸들 */}
                    <div
                      style={{ position: "absolute", top: 0, right: 0, width: 4, height: "100%", cursor: "col-resize", zIndex: 2 }}
                      onMouseDown={(e) => {
                        e.preventDefault(); e.stopPropagation();
                        setResizingCol(ci);
                        resizeStartX.current = e.clientX;
                        resizeStartW.current = col.width || 100;
                        const onMove = (ev: MouseEvent) => {
                          const diff = ev.clientX - resizeStartX.current;
                          const newW = Math.max(50, resizeStartW.current + diff);
                          const table = (e.target as HTMLElement).closest("table");
                          const cols = table?.querySelectorAll("colgroup col");
                          if (cols && cols[ci + 1]) (cols[ci + 1] as HTMLElement).style.width = newW + "px";
                        };
                        const onUp = (ev: MouseEvent) => {
                          document.removeEventListener("mousemove", onMove);
                          document.removeEventListener("mouseup", onUp);
                          const diff = ev.clientX - resizeStartX.current;
                          const newW = Math.max(50, resizeStartW.current + diff);
                          const arr = [...quotation.columns]; arr[ci] = { ...arr[ci], width: newW };
                          editQ({ columns: arr });
                          setResizingCol(null);
                        };
                        document.addEventListener("mousemove", onMove);
                        document.addEventListener("mouseup", onUp);
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#1890ff")}
                      onMouseLeave={(e) => { if (resizingCol !== ci) e.currentTarget.style.background = "transparent"; }}
                    />
                    <div style={{ fontSize: 8, color: "#ccc", marginBottom: 1, cursor: "grab" }}>⠿</div>
                    {editingColIdx === ci ? (
                      <Input size="small" autoFocus defaultValue={col.label}
                        style={{ width: "100%", textAlign: "center", fontSize: 11, fontWeight: 600 }}
                        onBlur={(e) => {
                          const arr = [...quotation.columns]; arr[ci] = { ...arr[ci], label: e.target.value || col.label };
                          editQ({ columns: arr });
                          setEditingColIdx(null);
                        }}
                        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditingColIdx(null); }}
                      />
                    ) : (
                      <span style={{ cursor: "text", borderBottom: "1px dashed #bbb", padding: "1px 4px", fontWeight: 600 }}
                        onClick={() => setEditingColIdx(ci)} title="클릭하여 이름 변경">
                        {col.label}
                      </span>
                    )}
                  </th>
                );
              })}
              {/* 좌측: 칼럼 추가 */}
              <th style={{ padding: "4px", background: "#f0f7ff" }}>
                <Button type="text" size="small" icon={<PlusOutlined />}
                  style={{ color: "#1890ff", fontSize: 12 }} title="칼럼 추가"
                  onClick={() => {
                    const key = "col_" + Date.now().toString(36);
                    const newCols = [...quotation.columns, { key, label: "새 칼럼", type: "text" as const, width: 100 }];
                    editQ({ columns: newCols });
                    setEditingColIdx(newCols.length - 1);
                  }} />
              </th>
              <th style={{ background: "#f0f7ff", fontSize: 8, color: "#aaa" }} title="고객 표시">👁</th>
              <th style={{ background: "#f0f7ff" }} />
              {/* 우측 헤더 — 칼럼 레벨 통화 선택 */}
              <th className="qt-r-border" style={{ padding: "4px", background: "#fff7ed", textAlign: "center", fontSize: 10 }}>
                <div>구매단가</div>
                <Select size="small" value={rates._cost_cur || "CNY"} style={{ width: 70, marginTop: 2 }}
                  onChange={(v) => editQ({ exchange_rates: { ...rates, _cost_cur: v } as Record<string, number> })}
                  options={[{ value: "CNY", label: "위안(¥)" }, { value: "USD", label: "달러($)" }, { value: "KRW", label: "원화(₩)" }]} />
              </th>
              <th style={{ padding: "4px", background: "#fff7ed", textAlign: "center", fontSize: 10 }}>
                <div>환산</div>
                <Select size="small" value={rates._conv_cur || "USD"} style={{ width: 70, marginTop: 2 }}
                  onChange={(v) => editQ({ exchange_rates: { ...rates, _conv_cur: v } as Record<string, number> })}
                  options={[{ value: "CNY", label: "위안(¥)" }, { value: "USD", label: "달러($)" }, { value: "KRW", label: "원화(₩)" }]} />
              </th>
              {/* 우측 추가 칼럼 헤더 — 좌측과 동일 UX */}
              {costCols.map((cc, ci) => {
                const isDragging = dragCostCol === ci;
                const isOver = dragOverCostCol === ci && dragCostCol !== ci;
                const dropLeft = isOver && dragCostCol !== null && dragCostCol > ci;
                const dropRight = isOver && dragCostCol !== null && dragCostCol < ci;
                // colgroup 인덱스: No(1) + quotation.columns + 3(+,👁,🗑) + 2(구매단가,환산) + ci
                const colgroupIdx = quotation.columns.length + 6 + ci;
                return (
                  <th key={cc.key}
                    draggable={editingCostColIdx !== ci && resizingCostCol === null}
                    onDragStart={(e) => {
                      if (resizingCostCol !== null) { e.preventDefault(); return; }
                      setDragCostCol(ci);
                      e.dataTransfer.effectAllowed = "move";
                      const el = e.currentTarget;
                      e.dataTransfer.setDragImage(el, el.offsetWidth / 2, el.offsetHeight / 2);
                    }}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverCostCol(ci); }}
                    onDragLeave={() => { if (dragOverCostCol === ci) setDragOverCostCol(null); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragCostCol !== null && dragCostCol !== ci) {
                        const arr = [...costCols];
                        const [moved] = arr.splice(dragCostCol, 1);
                        arr.splice(ci, 0, moved);
                        editQ({ cost_columns: arr });
                      }
                      setDragCostCol(null); setDragOverCostCol(null);
                    }}
                    onDragEnd={() => { setDragCostCol(null); setDragOverCostCol(null); }}
                    style={{
                      padding: "4px 2px", background: isDragging ? "#fed7aa" : "#fff7ed",
                      textAlign: "center", fontSize: 10,
                      opacity: isDragging ? 0.5 : 1,
                      cursor: editingCostColIdx === ci ? "text" : "grab",
                      transition: "all 0.15s ease",
                      borderLeft: dropLeft ? "3px solid #f15f23" : undefined,
                      borderRight: dropRight ? "3px solid #f15f23" : undefined,
                      position: "relative", overflow: "hidden",
                    }}
                  >
                    {/* 삭제 버튼 */}
                    <div style={{ position: "absolute", top: 1, right: 8, zIndex: 3 }}>
                      <Popconfirm
                        title={`"${cc.label}" 칼럼을 삭제할까요?`}
                        okText="삭제" cancelText="취소" okButtonProps={{ danger: true, size: "small" }} cancelButtonProps={{ size: "small" }}
                        onConfirm={() => editQ({ cost_columns: costCols.filter((_, i) => i !== ci) })}
                      >
                        <span style={{ cursor: "pointer", color: "#ff4d4f", fontSize: 8, opacity: 0.4, transition: "opacity 0.15s" }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.4")}
                          onClick={(e) => e.stopPropagation()}>✕</span>
                      </Popconfirm>
                    </div>
                    {/* 리사이즈 핸들 */}
                    <div
                      style={{ position: "absolute", top: 0, right: 0, width: 4, height: "100%", cursor: "col-resize", zIndex: 2 }}
                      onMouseDown={(e) => {
                        e.preventDefault(); e.stopPropagation();
                        setResizingCostCol(ci);
                        resizeStartX.current = e.clientX;
                        resizeStartW.current = cc.width || 80;
                        const onMove = (ev: MouseEvent) => {
                          const diff = ev.clientX - resizeStartX.current;
                          const newW = Math.max(50, resizeStartW.current + diff);
                          const table = (e.target as HTMLElement).closest("table");
                          const cols = table?.querySelectorAll("colgroup col");
                          if (cols && cols[colgroupIdx]) (cols[colgroupIdx] as HTMLElement).style.width = newW + "px";
                        };
                        const onUp = (ev: MouseEvent) => {
                          document.removeEventListener("mousemove", onMove);
                          document.removeEventListener("mouseup", onUp);
                          const diff = ev.clientX - resizeStartX.current;
                          const newW = Math.max(50, resizeStartW.current + diff);
                          const arr = [...costCols]; arr[ci] = { ...arr[ci], width: newW };
                          editQ({ cost_columns: arr });
                          setResizingCostCol(null);
                        };
                        document.addEventListener("mousemove", onMove);
                        document.addEventListener("mouseup", onUp);
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f15f23")}
                      onMouseLeave={(e) => { if (resizingCostCol !== ci) e.currentTarget.style.background = "transparent"; }}
                    />
                    <div style={{ fontSize: 8, color: "#ccc", marginBottom: 1, cursor: "grab" }}>⠿</div>
                    {editingCostColIdx === ci ? (
                      <Input size="small" autoFocus defaultValue={cc.label}
                        style={{ width: "100%", textAlign: "center", fontSize: 11, fontWeight: 600 }}
                        onBlur={(e) => {
                          const arr = [...costCols]; arr[ci] = { ...arr[ci], label: e.target.value || cc.label };
                          editQ({ cost_columns: arr });
                          setEditingCostColIdx(null);
                        }}
                        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditingCostColIdx(null); }}
                      />
                    ) : (
                      <span style={{ cursor: "text", borderBottom: "1px dashed #bbb", padding: "1px 4px", fontWeight: 600 }}
                        onClick={() => setEditingCostColIdx(ci)} title="클릭하여 이름 변경">
                        {cc.label}
                      </span>
                    )}
                  </th>
                );
              })}
              <th style={{ padding: "6px", background: "#fff7ed", textAlign: "right", fontSize: 10 }}>원가합(₩)</th>
              <th style={{ padding: "6px", background: "#fff7ed", textAlign: "right", fontSize: 10 }}>마진율</th>
              {/* 우측 칼럼 추가 버튼 */}
              <th style={{ padding: "4px", background: "#fff7ed" }}>
                <Button type="text" size="small" icon={<PlusOutlined />}
                  style={{ color: "#f15f23", fontSize: 12 }} title="마진 칼럼 추가"
                  onClick={() => {
                    const key = "rc_" + Date.now().toString(36);
                    editQ({ cost_columns: [...costCols, { key, label: "기타", type: "number" as const, width: 80 }] });
                  }} />
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const isMerged = String(item.cells?._merged) === "true";
              const isVisible = String(item.cells?._visible) !== "false";
              const colCostCur = String(rates._cost_cur || "CNY");
              const colConvCur = String(rates._conv_cur || "USD");
              const costConverted = convertTo(item.cost_price || 0, colCostCur, colConvCur);
              const baseCostKRW = convertTo(item.cost_price || 0, colCostCur, "KRW");
              const extraCostKRW = costCols.reduce((s, cc) => s + (Number(item.cells?.[cc.key]) || 0), 0);
              const costKRW = baseCostKRW + extraCostKRW;
              const sellingKRW = convertTo(Number(item.cells?.amount) || 0, quotation.currency, "KRW");
              const marginRate = costKRW > 0 ? ((sellingKRW - costKRW) / costKRW * 100) : 0;
              const curSymbol = (c: string) => c === "KRW" ? "₩" : c === "CNY" ? "¥" : "$";
              return (
                <tr key={item.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  {/* 좌측 데이터 — 숨김 행은 빈칸 + 회색 배경 */}
                  <td style={{ padding: "4px 6px", textAlign: "center", color: "#999", fontSize: 11, background: isVisible ? undefined : "#f9f9f9" }}>
                    {isVisible ? idx + 1 : <span style={{ color: "#ddd" }}>{idx + 1}</span>}
                  </td>
                  {!isVisible ? (
                    <td colSpan={quotation.columns.length} style={{ background: "#f9f9f9", padding: "4px 8px", color: "#ccc", fontSize: 10, textAlign: "center" }}>
                      고객 미표시
                    </td>
                  ) : isMerged ? (
                    <td colSpan={quotation.columns.length} style={{ padding: "2px 4px" }}>
                      <Input size="small" variant="borderless" value={String(item.cells?._merged_label || "")}
                        placeholder="항목명 (예: Air Freight)"
                        style={{ fontWeight: 500, textAlign: "center" }}
                        onChange={(e) => editItem(item.id, { cells: { ...item.cells, _merged_label: e.target.value } })} />
                    </td>
                  ) : (
                    quotation.columns.map((col) => {
                      const isNum = col.type === "number" || col.type === "currency";
                      const isAmount = col.key === "amount";
                      const isPrice = col.key === "price" || col.type === "currency";
                      const curSym = quotation.currency === "USD" ? "$" : quotation.currency === "EUR" ? "€" : quotation.currency === "KRW" ? "₩" : quotation.currency === "CNY" ? "¥" : quotation.currency;
                      const confScore = localQ?.source === "imported_pdf"
                        ? localQ.import_confidence?.items?.[item.id]?.[col.key]
                        : undefined;
                      const confStyle: CSSProperties =
                        confScore === undefined || confScore >= 0.9
                          ? {}
                          : confScore >= 0.7
                          ? { backgroundColor: "#fff7db" }
                          : { backgroundColor: "#fff1b8", outline: "1px dashed #d48806" };
                      return (
                        <td key={col.key} style={{ padding: "1px 2px", ...confStyle }}>
                          {isAmount ? (
                            <span style={{ display: "block", textAlign: "right", padding: "0 8px", fontWeight: 600, fontSize: 12 }}>
                              {formatCurrency(Number(item.cells?.[col.key]) || 0, quotation.currency)}
                            </span>
                          ) : isNum ? (
                            <InputNumber
                              size="small" variant="borderless" value={Number(item.cells?.[col.key]) || undefined}
                              style={{ width: "100%", textAlign: "right" }}
                              prefix={isPrice ? curSym : undefined}
                              onChange={(val) => {
                                const v = Number(val) || 0;
                                const newCells = { ...item.cells, [col.key]: v };
                                if (quotation.columns.some(c => c.key === "price") && quotation.columns.some(c => c.key === "qty")) {
                                  newCells.amount = Math.round((Number(newCells.price) || 0) * (Number(newCells.qty) || 0) * 100) / 100;
                                }
                                editItem(item.id, { cells: newCells, selling_price: Number(newCells.amount) || 0 });
                              }} />
                          ) : (
                            <Input size="small" variant="borderless" value={String(item.cells?.[col.key] ?? "")}
                              onChange={(e) => editItem(item.id, { cells: { ...item.cells, [col.key]: e.target.value } })} />
                          )}
                        </td>
                      );
                    })
                  )}
                  <td style={{ background: isVisible ? undefined : "#f9f9f9" }} />
                  {/* 가시성 토글 */}
                  <td style={{ padding: "2px", textAlign: "center" }}>
                    <span style={{ cursor: "pointer", fontSize: 11, color: isVisible ? "#1890ff" : "#ccc" }}
                      onClick={() => toggleVisibility(item.id)} title={isVisible ? "고객에게 표시됨" : "고객에게 숨김"}>
                      {isVisible ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                    </span>
                  </td>
                  <td style={{ padding: "2px" }}>
                    <DeleteOutlined style={{ color: "#ff4d4f", cursor: "pointer", fontSize: 10 }}
                      onClick={() => removeLocalItem(item.id)} />
                  </td>
                  {/* 우측: 구매단가, 환산, 원가합(₩), 마진율 — 항상 editable */}
                  <td className="qt-r-border" style={{ padding: "2px 4px", background: "#fffbf5", textAlign: "right" }}>
                    <InputNumber
                      size="small" value={item.cost_price || undefined} style={{ width: "100%" }}
                      prefix={curSymbol(colCostCur)}
                      onChange={(v) => onCostChange(item.id, "cost_price", Number(v) || 0)} />
                  </td>
                  <td style={{ padding: "4px 6px", background: "#fffbf5", textAlign: "right", fontSize: 11 }}>
                    {costConverted ? `${curSymbol(colConvCur)}${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(costConverted)}` : "—"}
                  </td>
                  {/* 추가 마진 칼럼 입력 (₩) */}
                  {costCols.map((cc) => (
                    <td key={cc.key} style={{ padding: "2px 4px", background: "#fffbf5", textAlign: "right" }}>
                      <InputNumber size="small" variant="borderless" value={Number(item.cells?.[cc.key]) || undefined}
                        style={{ width: "100%", textAlign: "right" }}
                        prefix="₩"
                        onChange={(v) => editItem(item.id, { cells: { ...item.cells, [cc.key]: Number(v) || 0 } })} />
                    </td>
                  ))}
                  <td style={{ padding: "4px 6px", background: "#fffbf5", textAlign: "right", fontWeight: 600, fontSize: 11 }}>
                    {costKRW ? `₩${new Intl.NumberFormat("ko-KR").format(Math.round(costKRW))}` : "—"}
                  </td>
                  <td style={{ padding: "2px 4px", background: "#fffbf5", textAlign: "right" }}>
                    <InputNumber size="small" variant="borderless" value={costKRW > 0 ? Number(marginRate.toFixed(1)) : undefined}
                      style={{ width: "100%", textAlign: "right", color: marginRate >= 0 ? "#52c41a" : "#ff4d4f", fontWeight: 600 }}
                      suffix="%"
                      disabled={costKRW <= 0}
                      onChange={(v) => {
                        if (costKRW <= 0) return;
                        const newMarginRate = Number(v) || 0;
                        // 역산: 새 sellingKRW → new amount (quotation currency) → new price
                        const newSellingKRW = costKRW * (1 + newMarginRate / 100);
                        const newAmount = convertTo(newSellingKRW, "KRW", quotation.currency);
                        const qty = Number(item.cells?.qty) || 1;
                        const newPrice = qty > 0 ? Math.round((newAmount / qty) * 100) / 100 : 0;
                        const newCells = { ...item.cells, price: newPrice, amount: Math.round(newAmount * 100) / 100 };
                        editItem(item.id, { cells: newCells, selling_price: Math.round(newAmount * 100) / 100, margin_percent: newMarginRate });
                      }} />
                  </td>
                  <td style={{ background: "#fffbf5" }} />
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ padding: "6px 8px", fontWeight: 700, fontSize: 11, background: "#f0f7ff", borderTop: "2px solid #1890ff" }}>TTL</td>
              {quotation.columns.map((col) => (
                <td key={col.key} style={{ padding: "4px 8px", textAlign: "right", fontWeight: 700, fontSize: 12, background: "#f0f7ff", borderTop: "2px solid #1890ff" }}>
                  {col.key === "amount" ? formatCurrency(totalAmount, quotation.currency) : ""}
                </td>
              ))}
              <td style={{ background: "#f0f7ff", borderTop: "2px solid #1890ff" }} />
              <td style={{ background: "#f0f7ff", borderTop: "2px solid #1890ff" }} />
              <td style={{ background: "#f0f7ff", borderTop: "2px solid #1890ff" }} />
              {(() => {
                const colCostCur = String(rates._cost_cur || "CNY");
                const totalBaseCostKRW = items.reduce((s, i) => s + convertTo(i.cost_price || 0, colCostCur, "KRW"), 0);
                const totalExtraCostKRW = items.reduce((s, i) => s + costCols.reduce((ss, cc) => ss + (Number(i.cells?.[cc.key]) || 0), 0), 0);
                const globalCostKRW = (quotation.global_costs || []).reduce((s: number, c: ExtraCost) => s + convertTo(c.amount, c.currency, "KRW"), 0);
                const grandCostKRW = totalBaseCostKRW + totalExtraCostKRW + globalCostKRW;
                const totalSellingKRW = convertTo(totalAmount, quotation.currency, "KRW");
                const totalMarginRate = grandCostKRW > 0 ? ((totalSellingKRW - grandCostKRW) / grandCostKRW * 100) : 0;
                return (
                  <>
                    <td className="qt-r-border" colSpan={2 + costCols.length} style={{ padding: "6px", fontSize: 10, textAlign: "right", background: "#fff7ed", borderTop: "2px solid #f15f23" }}>
                      총 구매원가
                    </td>
                    <td style={{ padding: "6px", fontSize: 11, fontWeight: 700, textAlign: "right", background: "#fff7ed", borderTop: "2px solid #f15f23" }}>
                      ₩{new Intl.NumberFormat("ko-KR").format(Math.round(grandCostKRW))}
                    </td>
                    <td style={{ padding: "6px", fontWeight: 700, textAlign: "right", background: "#fff7ed", borderTop: "2px solid #f15f23",
                      color: totalMarginRate >= 0 ? "#52c41a" : "#ff4d4f" }}>
                      {totalMarginRate.toFixed(1)}%
                    </td>
                    <td style={{ background: "#fff7ed", borderTop: "2px solid #f15f23" }} />
                  </>
                );
              })()}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Global costs */}
      <div style={{ marginTop: 12, padding: 12, background: "#fafafa", borderRadius: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Text strong style={{ fontSize: 12 }}>전체 부대비용</Text>
          <Button size="small" icon={<PlusOutlined />}
            onClick={() => editQ({ global_costs: [...(quotation.global_costs || []), { name: "", amount: 0, currency: "USD" }] })}>추가</Button>
        </div>
        {(quotation.global_costs || []).map((cost: ExtraCost, i: number) => (
          <div key={i} style={{ display: "flex", gap: 4, marginBottom: 4, alignItems: "center" }}>
            <Input size="small" value={cost.name} placeholder="항목명" style={{ width: 120 }}
              onChange={(e) => { const c = [...(quotation.global_costs || [])]; c[i] = { ...c[i], name: e.target.value };
                editQ({ global_costs: c }); }} />
            <InputNumber size="small" value={cost.amount} style={{ width: 80 }}
              onChange={(v) => { const c = [...(quotation.global_costs || [])]; c[i] = { ...c[i], amount: v || 0 };
                editQ({ global_costs: c }); }} />
            <Select size="small" value={cost.currency} style={{ width: 60 }}
              onChange={(v) => { const c = [...(quotation.global_costs || [])]; c[i] = { ...c[i], currency: v };
                editQ({ global_costs: c }); }}
              options={[{ value: "USD" }, { value: "CNY" }, { value: "KRW" }]} />
            <DeleteOutlined style={{ color: "#ff4d4f", cursor: "pointer" }}
              onClick={() => { const c = (quotation.global_costs || []).filter((_: ExtraCost, j: number) => j !== i);
                editQ({ global_costs: c }); }} />
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
      <VerifyBanner
        quotation={quotation}
        onVerified={(updated) => {
          setLocalQ((prev) => prev ? { ...prev, ...updated } : prev);
        }}
      />
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
          {isDirty && <Tag color="orange">미저장</Tag>}
          <Button size="small" icon={<FilePdfOutlined />} onClick={() => setShowPDF(true)}>PDF</Button>
          <Button
            size="small"
            icon={<CopyOutlined />}
            onClick={async () => {
              const { data: session } = await supabaseClient.auth.getSession();
              const token = session.session?.access_token;
              if (!token) {
                message.error("로그인이 필요합니다");
                return;
              }
              const res = await fetch(`/api/quotations/${quotation.id}/clone`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
              });
              if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                message.error(`복제 실패: ${body.error ?? res.status}`);
                return;
              }
              const body = await res.json();
              window.location.href = `/dashboard/quotations/${body.quotation.id}`;
            }}
          >
            복제
          </Button>
          <Button size="small" onClick={() => flushToDB()} loading={saving} disabled={!isDirty}>
            저장
          </Button>
          <Button size="small" type="primary" icon={<CheckCircleOutlined />}
            onClick={() => flushToDB(quotation.status === "final" ? "draft" : "final")} loading={saving}>
            {quotation.status === "final" ? "Draft" : "완료"}
          </Button>
        </Space>
      </div>

      <Tabs size="large" items={[
        { key: "doc", label: <><FileTextOutlined /> 견적서</>, children: tabViewer },
        { key: "calc", label: <><CalculatorOutlined /> 계산</>, children: tabCalc },
      ]} />

      <QuotationPDF quotation={quotation} items={visibleItems} open={showPDF} onClose={() => setShowPDF(false)} />
    </div>
  );
}
