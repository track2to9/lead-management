"use client";

import { Table, Input, InputNumber, Button, Space } from "antd";
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
          {!["price", "qty", "amount"].includes(col.key) &&
           !["price", "qty", "q'ty", "amount"].includes(col.label.toLowerCase()) && (
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
        <Button icon={<PlusOutlined />} size="small" onClick={onAddItem}>행 추가</Button>
        <Button icon={<PlusCircleOutlined />} size="small" onClick={() => setShowAddCol(true)}>필드 추가</Button>
      </Space>

      {showAddCol && (
        <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
          <Input placeholder="필드명" size="small" value={newColName}
            onChange={(e) => setNewColName(e.target.value)} style={{ width: 150 }} />
          <select value={newColType} onChange={(e) => setNewColType(e.target.value as "text" | "number" | "currency")}
            style={{ padding: "2px 8px", borderRadius: 4, border: "1px solid #d9d9d9" }}>
            <option value="text">텍스트</option>
            <option value="number">숫자</option>
            <option value="currency">통화</option>
          </select>
          <Button size="small" type="primary" onClick={() => {
            if (newColName.trim()) {
              const key = newColName.trim().toLowerCase().replace(/\s+/g, "_");
              onAddColumn({ key, label: newColName.trim(), type: newColType, width: 120 });
              setNewColName("");
              setShowAddCol(false);
            }
          }}>추가</Button>
          <Button size="small" onClick={() => setShowAddCol(false)}>취소</Button>
        </div>
      )}
    </div>
  );
}
