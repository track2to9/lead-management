"use client";

import { useState } from "react";
import { Button, Input, Select, Space, Popover, Typography } from "antd";
import { PlusOutlined, DeleteOutlined, ArrowLeftOutlined, ArrowRightOutlined, SettingOutlined } from "@ant-design/icons";
import type { QuotationColumn } from "@/lib/types";

const { Text } = Typography;

interface Props {
  columns: QuotationColumn[];
  onChange: (cols: QuotationColumn[]) => void;
}

const COL_TYPE_OPTIONS = [
  { label: "텍스트", value: "text" },
  { label: "숫자", value: "number" },
  { label: "통화", value: "currency" },
];

export default function ColumnManager({ columns, onChange }: Props) {
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<"text" | "number" | "currency">("text");

  function addColumn() {
    if (!newLabel.trim()) return;
    const key = newLabel.trim().toLowerCase().replace(/[^a-z0-9]/g, "_") + "_" + Date.now().toString(36);
    onChange([...columns, { key, label: newLabel.trim(), type: newType, width: 100 }]);
    setNewLabel("");
    setNewType("text");
  }

  function removeColumn(idx: number) {
    onChange(columns.filter((_, i) => i !== idx));
  }

  function moveColumn(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= columns.length) return;
    const arr = [...columns];
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    onChange(arr);
  }

  function renameColumn(idx: number, label: string) {
    const arr = [...columns];
    arr[idx] = { ...arr[idx], label };
    onChange(arr);
  }

  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
      {columns.map((col, idx) => (
        <Popover
          key={col.key}
          trigger="click"
          placement="bottom"
          content={
            <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 160 }}>
              <Input size="small" value={col.label} onChange={(e) => renameColumn(idx, e.target.value)} placeholder="칼럼명" />
              <Space size={4}>
                <Button size="small" icon={<ArrowLeftOutlined />} disabled={idx === 0} onClick={() => moveColumn(idx, -1)} />
                <Button size="small" icon={<ArrowRightOutlined />} disabled={idx === columns.length - 1} onClick={() => moveColumn(idx, 1)} />
                <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeColumn(idx)} />
              </Space>
            </div>
          }
        >
          <Tag
            style={{ cursor: "pointer", fontSize: 11, padding: "2px 8px", margin: 0 }}
          >
            {col.label} <SettingOutlined style={{ fontSize: 9, marginLeft: 2 }} />
          </Tag>
        </Popover>
      ))}

      <Popover
        trigger="click"
        placement="bottomRight"
        content={
          <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 200 }}>
            <Input size="small" value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
              placeholder="칼럼명 (예: Lead Time)" onKeyDown={(e) => { if (e.key === "Enter") addColumn(); }} />
            <Select size="small" value={newType} onChange={setNewType} options={COL_TYPE_OPTIONS} />
            <Button size="small" type="primary" onClick={addColumn} disabled={!newLabel.trim()}>추가</Button>
          </div>
        }
      >
        <Button type="dashed" size="small" icon={<PlusOutlined />} style={{ fontSize: 10 }}>칼럼</Button>
      </Popover>
    </div>
  );
}

// antd Tag import needed in parent — re-export for convenience
import { Tag } from "antd";
