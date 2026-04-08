"use client";

import { Tag, Input, Button, Space, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useState } from "react";

const { Text } = Typography;

interface Props {
  conditions: string[];
  onSubmit: (conditions: string[]) => void;
  loading?: boolean;
}

export default function RefinementConditionsForm({ conditions, onSubmit, loading }: Props) {
  const [local, setLocal] = useState<string[]>([...conditions]);
  const [inputValue, setInputValue] = useState("");

  function handleAdd() {
    const trimmed = inputValue.trim();
    if (trimmed && !local.includes(trimmed)) {
      setLocal([...local, trimmed]);
      setInputValue("");
    }
  }

  function handleRemove(index: number) {
    setLocal(local.filter((_, i) => i !== index));
  }

  const hasChanges = JSON.stringify(local) !== JSON.stringify(conditions);

  return (
    <Space direction="vertical" style={{ width: "100%" }} size={8}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        분석 조건을 추가하면 다음 회차 분석에 반영됩니다
      </Text>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {local.map((cond, i) => (
          <Tag
            key={i}
            closable
            onClose={() => handleRemove(i)}
            style={{ marginBottom: 4 }}
          >
            {cond}
          </Tag>
        ))}
      </div>

      <Input.Search
        placeholder="예: ISO 9001 인증 보유 업체만, 연매출 $10M 이상..."
        enterButton={<><PlusOutlined /> 추가</>}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onSearch={handleAdd}
      />

      {hasChanges && (
        <Button
          type="primary"
          onClick={() => onSubmit(local)}
          loading={loading}
        >
          조건 변경 요청 (재분석)
        </Button>
      )}
    </Space>
  );
}
