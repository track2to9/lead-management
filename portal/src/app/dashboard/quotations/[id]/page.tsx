"use client";

import { useOne, useList, useUpdate, useCreate, useDelete } from "@refinedev/core";
import { useParams } from "next/navigation";
import { Card, Input, InputNumber, Select, Button, Space, Typography, Breadcrumb, Tag, Spin, Switch } from "antd";
import { HomeOutlined, EyeOutlined, CheckCircleOutlined, FilePdfOutlined, EyeInvisibleOutlined, PlusOutlined, DeleteOutlined, PlusCircleOutlined } from "@ant-design/icons";
import Link from "next/link";
import { useState, useRef } from "react";
import type { Quotation, QuotationItem, QuotationColumn, ExtraCost } from "@/lib/types";
import { calcForward, calcReverse, calcSummary, formatCurrency, convertCurrency } from "@/lib/quotation-calc";
import FooterFields from "@/components/quotation/FooterFields";
import QuotationPDF from "@/components/quotation/QuotationPDF";

const { Title, Text } = Typography;

export default function QuotationEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [showCost, setShowCost] = useState(true);
  const [showPDF, setShowPDF] = useState(false);
  const [editingCell, setEditingCell] = useState<{ itemId: string; key: string } | null>(null);
  const [showAddCol, setShowAddCol] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColType, setNewColType] = useState<"text" | "number" | "currency">("text");
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

  const quotation = qq.data?.data;
  const items = iq.data?.data || [];

  if (qq.isLoading || !quotation) {
    return <div style={{ textAlign: "center", padding: 64 }}><Spin size="large" /></div>;
  }

  const summary = calcSummary(items, quotation.global_costs || [], quotation.exchange_rates || {});

  // --- Debounced save ---
  function saveQ(values: Partial<Quotation>) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      updateQuotation({ resource: "quotations", id, values });
    }, 1500);
  }

  // --- Cell editing ---
  function onCellClick(itemId: string, key: string) {
    setEditingCell({ itemId, key });
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function onCellSave(itemId: string, key: string, value: string | number) {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const newCells = { ...item.cells, [key]: value };
    const hasPrice = quotation.columns.some((c) => c.key === "price");
    const hasQty = quotation.columns.some((c) => c.key === "qty");
    if (hasPrice && hasQty) {
      newCells.amount = Math.round((Number(newCells.price) || 0) * (Number(newCells.qty) || 0) * 100) / 100;
    }
    updateItem({ resource: "quotation_items", id: itemId, values: { cells: newCells, selling_price: Number(newCells.amount) || 0 } },
      { onSuccess: () => iq.refetch() });
    setEditingCell(null);
  }

  function onCellKeyDown(e: React.KeyboardEvent, itemId: string, key: string, value: string | number) {
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      onCellSave(itemId, key, value);
      const cols = quotation.columns;
      const ci = cols.findIndex((c) => c.key === key);
      const ii = items.findIndex((i) => i.id === itemId);
      if (e.key === "Tab" && ci < cols.length - 1) setEditingCell({ itemId, key: cols[ci + 1].key });
      else if (e.key === "Enter" && ii < items.length - 1) setEditingCell({ itemId: items[ii + 1].id, key });
      setTimeout(() => inputRef.current?.focus(), 50);
    } else if (e.key === "Escape") setEditingCell(null);
  }

  // --- Cost change ---
  function onCostChange(itemId: string, field: string, value: number | string) {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const updates: Record<string, unknown> = { [field]: value };
    const cp = field === "cost_price" ? Number(value) : (item.cost_price || 0);
    const cc = field === "cost_currency" ? String(value) : item.cost_currency;
    const mp = field === "margin_percent" ? Number(value) : (item.margin_percent || 0);
    const sp = field === "selling_price" ? Number(value) : (item.selling_price || 0);

    if (quotation.margin_mode === "forward") {
      const r = calcForward(cp, cc, mp, item.extra_costs || [], quotation.exchange_rates);
      updates.selling_price = r.sellingPrice;
      updates.margin_amount = r.marginAmount;
      const qty = Number(item.cells?.qty) || 1;
      updates.cells = { ...item.cells, price: r.sellingPrice, amount: Math.round(r.sellingPrice * qty * 100) / 100 };
    } else {
      const r = calcReverse(sp, cp, cc, item.extra_costs || [], quotation.exchange_rates);
      updates.margin_percent = r.marginPercent;
      updates.margin_amount = r.marginAmount;
    }
    updateItem({ resource: "quotation_items", id: itemId, values: updates }, { onSuccess: () => iq.refetch() });
  }

  // --- Render cell ---
  function renderCell(item: QuotationItem, col: QuotationColumn) {
    const value = item.cells?.[col.key] ?? "";
    const isEditing = editingCell?.itemId === item.id && editingCell?.key === col.key;

    if (col.key === "amount") {
      return <span style={{ fontWeight: 600 }}>{formatCurrency(Number(value) || 0, quotation.currency)}</span>;
    }
    if (isEditing) {
      const isNum = col.type === "number" || col.type === "currency";
      return isNum ? (
        <InputNumber ref={inputRef} defaultValue={Number(value) || undefined} size="small" style={{ width: "100%" }}
          onBlur={(e) => onCellSave(item.id, col.key, Number(e.target.value) || 0)}
          onKeyDown={(e) => onCellKeyDown(e, item.id, col.key, Number((e.target as HTMLInputElement).value) || 0)} />
      ) : (
        <Input ref={inputRef} defaultValue={String(value)} size="small"
          onBlur={(e) => onCellSave(item.id, col.key, e.target.value)}
          onKeyDown={(e) => onCellKeyDown(e, item.id, col.key, (e.target as HTMLInputElement).value)} />
      );
    }
    return (
      <div onClick={() => onCellClick(item.id, col.key)}
        style={{ cursor: "text", minHeight: 24, padding: "2px 4px", borderRadius: 3, border: "1px solid transparent" }}
        onMouseEnter={(e) => (e.currentTarget.style.border = "1px solid #d9d9d9")}
        onMouseLeave={(e) => (e.currentTarget.style.border = "1px solid transparent")}>
        {col.type === "currency" ? formatCurrency(Number(value) || 0, quotation.currency) :
          String(value) || <span style={{ color: "#ccc", fontSize: 11 }}>클릭</span>}
      </div>
    );
  }

  const rates = quotation.exchange_rates || {};

  return (
    <div>
      <Breadcrumb className="mb-4" items={[
        { title: <Link href="/dashboard"><HomeOutlined /> 대시보드</Link> },
        { title: <Link href="/dashboard/quotations">견적서</Link> },
        { title: quotation.ref_no },
      ]} />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <Space align="center">
          <Title level={4} style={{ margin: 0 }}>{quotation.ref_no}</Title>
          <Tag color={quotation.status === "final" ? "green" : "default"}>
            {quotation.status === "final" ? "완료" : "작성 중"}
          </Tag>
        </Space>
        <Space>
          <Button size="small" icon={showCost ? <EyeInvisibleOutlined /> : <EyeOutlined />}
            onClick={() => setShowCost(!showCost)}>
            {showCost ? "내부계산 숨기기" : "내부계산 보기"}
          </Button>
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

      {/* Meta fields row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "end" }}>
        <div>
          <Text type="secondary" style={{ fontSize: 10, display: "block" }}>Ref No</Text>
          <Input size="small" value={quotation.ref_no} style={{ width: 140 }}
            onChange={(e) => saveQ({ ref_no: e.target.value })} />
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 10, display: "block" }}>날짜</Text>
          <Input size="small" value={quotation.date} style={{ width: 110 }}
            onChange={(e) => saveQ({ date: e.target.value })} />
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 10, display: "block" }}>업체</Text>
          <Input size="small" value={quotation.client_name || ""} placeholder="업체명" style={{ width: 180 }}
            onChange={(e) => saveQ({ client_name: e.target.value })} />
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 10, display: "block" }}>통화</Text>
          <Input size="small" value={quotation.currency} style={{ width: 50 }}
            onChange={(e) => saveQ({ currency: e.target.value })} />
        </div>
        {showCost && (
          <>
            <div style={{ borderLeft: "2px solid #f15f23", paddingLeft: 8 }}>
              <Text type="secondary" style={{ fontSize: 10, display: "block" }}>USD/CNY</Text>
              <InputNumber size="small" value={rates.CNY || 7.2} style={{ width: 70 }}
                onChange={(v) => { const r = { ...rates, CNY: v || 7.2 }; updateQuotation({ resource: "quotations", id, values: { exchange_rates: r } }, { onSuccess: () => qq.refetch() }); }} />
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 10, display: "block" }}>USD/KRW</Text>
              <InputNumber size="small" value={rates.KRW || 1380} style={{ width: 80 }}
                onChange={(v) => { const r = { ...rates, KRW: v || 1380 }; updateQuotation({ resource: "quotations", id, values: { exchange_rates: r } }, { onSuccess: () => qq.refetch() }); }} />
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 10, display: "block" }}>모드</Text>
              <Space size={2}>
                <Text style={{ fontSize: 10 }}>마진→가격</Text>
                <Switch size="small" checked={quotation.margin_mode === "reverse"}
                  onChange={(v) => updateQuotation({ resource: "quotations", id, values: { margin_mode: v ? "reverse" : "forward" } }, { onSuccess: () => qq.refetch() })} />
                <Text style={{ fontSize: 10 }}>가격→마진</Text>
              </Space>
            </div>
          </>
        )}
      </div>

      {/* === UNIFIED TABLE: Customer columns + Internal cost columns in SAME ROW === */}
      <div style={{ overflowX: "auto", border: "1px solid #e0e0e0", borderRadius: 8, background: "#fff" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ padding: "8px 6px", background: "#f5f5f5", borderBottom: "2px solid #e0e0e0", width: 40, textAlign: "center" }}>No</th>

              {quotation.columns.map((col) => (
                <th key={col.key} style={{ padding: "8px 6px", background: "#f5f5f5", borderBottom: "2px solid #e0e0e0", minWidth: col.width || 100, textAlign: "left" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span>{col.label}</span>
                    {col.key !== "amount" && (
                      <DeleteOutlined style={{ fontSize: 9, color: "#ccc", cursor: "pointer" }}
                        onClick={() => updateQuotation({ resource: "quotations", id, values: { columns: quotation.columns.filter((c) => c.key !== col.key) } }, { onSuccess: () => qq.refetch() })} />
                    )}
                  </div>
                </th>
              ))}

              {showCost && (
                <>
                  <th style={{ padding: "8px 2px", background: "#fff7ed", borderBottom: "2px solid #f15f23", borderLeft: "3px solid #f15f23", width: 3 }} />
                  <th style={{ padding: "8px 6px", background: "#fff7ed", borderBottom: "2px solid #f15f23", minWidth: 80, textAlign: "right" }}>원가</th>
                  <th style={{ padding: "8px 6px", background: "#fff7ed", borderBottom: "2px solid #f15f23", width: 55 }}>통화</th>
                  <th style={{ padding: "8px 6px", background: "#fff7ed", borderBottom: "2px solid #f15f23", minWidth: 80, textAlign: "right" }}>원가(USD)</th>
                  {quotation.margin_mode === "forward" ? (
                    <>
                      <th style={{ padding: "8px 6px", background: "#fff7ed", borderBottom: "2px solid #f15f23", minWidth: 60, textAlign: "right" }}>마진%</th>
                      <th style={{ padding: "8px 6px", background: "#fff7ed", borderBottom: "2px solid #f15f23", minWidth: 80, textAlign: "right" }}>판매가</th>
                    </>
                  ) : (
                    <>
                      <th style={{ padding: "8px 6px", background: "#fff7ed", borderBottom: "2px solid #f15f23", minWidth: 80, textAlign: "right" }}>판매가</th>
                      <th style={{ padding: "8px 6px", background: "#fff7ed", borderBottom: "2px solid #f15f23", minWidth: 60, textAlign: "right" }}>마진%</th>
                    </>
                  )}
                  <th style={{ padding: "8px 6px", background: "#fff7ed", borderBottom: "2px solid #f15f23", minWidth: 80, textAlign: "right" }}>마진액</th>
                </>
              )}
              <th style={{ width: 32, background: "#f5f5f5", borderBottom: "2px solid #e0e0e0" }} />
            </tr>
          </thead>

          <tbody>
            {items.map((item, idx) => {
              const costUSD = convertCurrency(item.cost_price || 0, item.cost_currency, rates);
              return (
                <tr key={item.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={{ padding: "4px 6px", textAlign: "center", color: "#999" }}>{idx + 1}</td>

                  {quotation.columns.map((col) => (
                    <td key={col.key} style={{ padding: "4px 6px" }}>{renderCell(item, col)}</td>
                  ))}

                  {showCost && (
                    <>
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
                      {quotation.margin_mode === "forward" ? (
                        <>
                          <td style={{ padding: "4px 4px", background: "#fffbf5", textAlign: "right" }}>
                            <InputNumber size="small" value={item.margin_percent || undefined} style={{ width: 55 }}
                              onChange={(v) => onCostChange(item.id, "margin_percent", v || 0)} />
                          </td>
                          <td style={{ padding: "4px 6px", background: "#fffbf5", textAlign: "right", fontWeight: 600 }}>
                            {formatCurrency(item.selling_price || 0, quotation.currency)}
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ padding: "4px 4px", background: "#fffbf5", textAlign: "right" }}>
                            <InputNumber size="small" value={item.selling_price || undefined} style={{ width: 75 }}
                              onChange={(v) => onCostChange(item.id, "selling_price", v || 0)} />
                          </td>
                          <td style={{ padding: "4px 6px", background: "#fffbf5", textAlign: "right",
                            color: (item.margin_percent || 0) >= 0 ? "#52c41a" : "#ff4d4f" }}>
                            {(item.margin_percent || 0).toFixed(1)}%
                          </td>
                        </>
                      )}
                      <td style={{ padding: "4px 6px", background: "#fffbf5", textAlign: "right", fontWeight: 600,
                        color: (item.margin_amount || 0) >= 0 ? "#52c41a" : "#ff4d4f" }}>
                        {formatCurrency(item.margin_amount || 0, quotation.currency)}
                      </td>
                    </>
                  )}
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
              <td style={{ padding: "8px 6px", fontWeight: 700 }} colSpan={quotation.columns.length}>TTL</td>
              <td style={{ padding: "8px 6px", fontWeight: 700, textAlign: "right" }}>
                {formatCurrency(items.reduce((s, i) => s + (Number(i.cells?.amount) || 0), 0), quotation.currency)}
              </td>
              {showCost && (
                <>
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
                </>
              )}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Action buttons */}
      <Space style={{ marginTop: 8 }}>
        <Button icon={<PlusOutlined />} size="small" onClick={() => createItem({
          resource: "quotation_items",
          values: { quotation_id: id, sort_order: items.length, cells: {}, cost_price: 0, cost_currency: "CNY", selling_price: 0, margin_percent: 0, margin_amount: 0, extra_costs: [] },
        }, { onSuccess: () => iq.refetch() })}>행 추가</Button>
        <Button icon={<PlusCircleOutlined />} size="small" onClick={() => setShowAddCol(true)}>필드 추가</Button>
      </Space>

      {showAddCol && (
        <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
          <Input placeholder="필드명" size="small" value={newColName} onChange={(e) => setNewColName(e.target.value)} style={{ width: 150 }} />
          <select value={newColType} onChange={(e) => setNewColType(e.target.value as "text" | "number" | "currency")}
            style={{ padding: "2px 8px", borderRadius: 4, border: "1px solid #d9d9d9", fontSize: 12 }}>
            <option value="text">텍스트</option><option value="number">숫자</option><option value="currency">통화</option>
          </select>
          <Button size="small" type="primary" onClick={() => {
            if (newColName.trim()) {
              const key = newColName.trim().toLowerCase().replace(/\s+/g, "_");
              updateQuotation({ resource: "quotations", id, values: { columns: [...quotation.columns, { key, label: newColName.trim(), type: newColType, width: 120 }] } },
                { onSuccess: () => { qq.refetch(); setNewColName(""); setShowAddCol(false); } });
            }
          }}>추가</Button>
          <Button size="small" onClick={() => setShowAddCol(false)}>취소</Button>
        </div>
      )}

      {showCost && (
        <Card size="small" title="전체 부대비용" style={{ marginTop: 12 }}
          extra={<Button size="small" icon={<PlusOutlined />}
            onClick={() => updateQuotation({ resource: "quotations", id,
              values: { global_costs: [...(quotation.global_costs || []), { name: "", amount: 0, currency: "USD" }] } },
              { onSuccess: () => qq.refetch() })}>추가</Button>}>
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
        </Card>
      )}

      <Card size="small" title="조건" style={{ marginTop: 12 }}>
        <FooterFields footer={quotation.footer} onChange={(f) => saveQ({ footer: f })} />
      </Card>

      <QuotationPDF quotation={quotation} items={items} open={showPDF} onClose={() => setShowPDF(false)} />
    </div>
  );
}
