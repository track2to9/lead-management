"use client";

import { InputNumber, Select, Switch, Typography, Space, Button, Input } from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import type { QuotationItem, ExtraCost } from "@/lib/types";
import { calcSummary, formatCurrency, convertCurrency } from "@/lib/quotation-calc";

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
              <Switch checked={marginMode === "reverse"} onChange={(v) => onMarginModeChange(v ? "reverse" : "forward")} size="small" />
              <Text type="secondary">판매가→마진</Text>
            </Space>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div>
              <Text type="secondary" style={{ fontSize: 10 }}>USD/CNY</Text>
              <InputNumber size="small" value={exchangeRates.CNY || 7.2}
                onChange={(v) => onExchangeRateChange({ ...exchangeRates, CNY: v || 7.2 })} style={{ width: 80 }} />
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 10 }}>USD/KRW</Text>
              <InputNumber size="small" value={exchangeRates.KRW || 1380}
                onChange={(v) => onExchangeRateChange({ ...exchangeRates, KRW: v || 1380 })} style={{ width: 80 }} />
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
              <><th style={{ padding: "6px 4px", textAlign: "right" }}>마진%</th><th style={{ padding: "6px 4px", textAlign: "right" }}>판매가</th></>
            ) : (
              <><th style={{ padding: "6px 4px", textAlign: "right" }}>판매가</th><th style={{ padding: "6px 4px", textAlign: "right" }}>마진%</th></>
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
                  <InputNumber size="small" value={item.cost_price || undefined}
                    onChange={(v) => onItemCostChange(item.id, "cost_price", v || 0)} style={{ width: 80 }} />
                </td>
                <td style={{ padding: "4px" }}>
                  <Select size="small" value={item.cost_currency}
                    onChange={(v) => onItemCostChange(item.id, "cost_currency", v)}
                    style={{ width: 60 }} options={[{ value: "CNY" }, { value: "KRW" }]} />
                </td>
                <td style={{ padding: "4px", textAlign: "right", color: "#999" }}>{formatCurrency(costUSD, "USD")}</td>
                {marginMode === "forward" ? (
                  <>
                    <td style={{ padding: "4px", textAlign: "right" }}>
                      <InputNumber size="small" value={item.margin_percent || undefined}
                        onChange={(v) => onItemCostChange(item.id, "margin_percent", v || 0)} style={{ width: 60 }} />
                    </td>
                    <td style={{ padding: "4px", textAlign: "right", fontWeight: 600 }}>{formatCurrency(item.selling_price || 0, currency)}</td>
                  </>
                ) : (
                  <>
                    <td style={{ padding: "4px", textAlign: "right" }}>
                      <InputNumber size="small" value={item.selling_price || undefined}
                        onChange={(v) => onItemCostChange(item.id, "selling_price", v || 0)} style={{ width: 80 }} />
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
          <Button size="small" icon={<PlusOutlined />}
            onClick={() => onGlobalCostsChange([...globalCosts, { name: "", amount: 0, currency: "USD" }])}>추가</Button>
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
