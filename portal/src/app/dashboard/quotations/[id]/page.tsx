"use client";

import { useOne, useList, useUpdate, useCreate, useDelete } from "@refinedev/core";
import { useParams } from "next/navigation";
import { Card, Input, Button, Space, Typography, Breadcrumb, Tag, Spin } from "antd";
import { HomeOutlined, EyeOutlined, CheckCircleOutlined, FilePdfOutlined, EyeInvisibleOutlined } from "@ant-design/icons";
import Link from "next/link";
import { useState, useRef } from "react";
import type { Quotation, QuotationItem, QuotationColumn, ExtraCost } from "@/lib/types";
import { calcForward, calcReverse } from "@/lib/quotation-calc";
import EditableTable from "@/components/quotation/EditableTable";
import CostPanel from "@/components/quotation/CostPanel";
import FooterFields from "@/components/quotation/FooterFields";
import QuotationPDF from "@/components/quotation/QuotationPDF";

const { Title, Text } = Typography;

export default function QuotationEditorPage() {
  const { id } = useParams<{ id: string }>();
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

  if (qq.isLoading || !quotation) {
    return <div style={{ textAlign: "center", padding: 64 }}><Spin size="large" /></div>;
  }

  function saveQuotation(values: Partial<Quotation>) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      updateQuotation({ resource: "quotations", id, values });
    }, 1500);
  }

  function handleItemCellChange(itemId: string, cells: Record<string, string | number>) {
    updateItem({
      resource: "quotation_items",
      id: itemId,
      values: { cells, selling_price: Number(cells.amount) || 0 },
    }, { onSuccess: () => iq.refetch() });
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
    updateQuotation({ resource: "quotations", id, values: { columns: newCols } }, { onSuccess: () => qq.refetch() });
  }

  function handleRemoveColumn(key: string) {
    const newCols = quotation.columns.filter((c) => c.key !== key);
    updateQuotation({ resource: "quotations", id, values: { columns: newCols } }, { onSuccess: () => qq.refetch() });
  }

  function handleItemCostChange(itemId: string, field: string, value: number | string) {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    const updates: Record<string, unknown> = { [field]: value };

    const costPrice = field === "cost_price" ? Number(value) : (item.cost_price || 0);
    const costCurrency = field === "cost_currency" ? String(value) : item.cost_currency;
    const marginPercent = field === "margin_percent" ? Number(value) : (item.margin_percent || 0);
    const sellingPrice = field === "selling_price" ? Number(value) : (item.selling_price || 0);

    if (quotation.margin_mode === "forward") {
      const calc = calcForward(costPrice, costCurrency, marginPercent, item.extra_costs || [], quotation.exchange_rates);
      updates.selling_price = calc.sellingPrice;
      updates.margin_amount = calc.marginAmount;
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
          <Button
            icon={showCostPanel ? <EyeInvisibleOutlined /> : <EyeOutlined />}
            onClick={() => setShowCostPanel(!showCostPanel)}
          >
            {showCostPanel ? "내부계산 숨기기" : "내부계산 보기"}
          </Button>
          <Button icon={<FilePdfOutlined />} onClick={() => setShowPDF(true)}>PDF 미리보기</Button>
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={() => updateQuotation(
              { resource: "quotations", id, values: { status: quotation.status === "final" ? "draft" : "final" } },
              { onSuccess: () => qq.refetch() },
            )}
          >
            {quotation.status === "final" ? "Draft로 변경" : "완료 처리"}
          </Button>
        </Space>
      </div>

      {/* Meta fields */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <Text type="secondary" style={{ fontSize: 11, display: "block" }}>Ref No</Text>
          <Input size="small" value={quotation.ref_no} style={{ width: 160 }}
            onChange={(e) => saveQuotation({ ref_no: e.target.value })} />
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 11, display: "block" }}>날짜</Text>
          <Input size="small" value={quotation.date} style={{ width: 130 }}
            onChange={(e) => saveQuotation({ date: e.target.value })} />
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 11, display: "block" }}>업체</Text>
          <Input size="small" value={quotation.client_name || ""} placeholder="업체명" style={{ width: 200 }}
            onChange={(e) => saveQuotation({ client_name: e.target.value })} />
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 11, display: "block" }}>통화</Text>
          <Input size="small" value={quotation.currency} style={{ width: 60 }}
            onChange={(e) => saveQuotation({ currency: e.target.value })} />
        </div>
      </div>

      {/* Two-panel layout */}
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
                onItemExtraCostChange={(itemId, costs) =>
                  updateItem({ resource: "quotation_items", id: itemId, values: { extra_costs: costs } })
                }
                onMarginModeChange={(mode) => {
                  updateQuotation({ resource: "quotations", id, values: { margin_mode: mode } }, { onSuccess: () => qq.refetch() });
                }}
                onExchangeRateChange={(rates) => {
                  updateQuotation({ resource: "quotations", id, values: { exchange_rates: rates } }, { onSuccess: () => qq.refetch() });
                }}
                onGlobalCostsChange={(costs) => {
                  updateQuotation({ resource: "quotations", id, values: { global_costs: costs } }, { onSuccess: () => qq.refetch() });
                }}
              />
            </Card>
          </div>
        )}
      </div>

      {/* Footer */}
      <Card size="small" title="조건" style={{ marginTop: 16 }}>
        <FooterFields footer={quotation.footer} onChange={(f) => saveQuotation({ footer: f })} />
      </Card>

      {/* PDF Modal */}
      <QuotationPDF quotation={quotation} items={items} open={showPDF} onClose={() => setShowPDF(false)} />
    </div>
  );
}
