"use client";

import { Slider, Space, Typography, Button, Alert } from "antd";
import { useState } from "react";
import type { ScoreWeights } from "@/lib/types";
import { SCORE_DIMENSION_LABELS, DEFAULT_SCORE_WEIGHTS } from "@/lib/types";

const { Text } = Typography;

interface Props {
  weights: ScoreWeights;
  onChange: (weights: ScoreWeights) => void;
}

export default function ScoreWeightsEditor({ weights, onChange }: Props) {
  const [local, setLocal] = useState<ScoreWeights>({ ...weights });
  const dimensions = Object.keys(SCORE_DIMENSION_LABELS) as (keyof ScoreWeights)[];
  const total = dimensions.reduce((sum, key) => sum + local[key], 0);

  function handleChange(key: keyof ScoreWeights, value: number) {
    setLocal((prev) => ({ ...prev, [key]: value }));
  }

  function handleApply() {
    onChange(local);
  }

  function handleReset() {
    setLocal({ ...DEFAULT_SCORE_WEIGHTS });
    onChange({ ...DEFAULT_SCORE_WEIGHTS });
  }

  return (
    <Space direction="vertical" style={{ width: "100%" }} size={8}>
      {dimensions.map((key) => (
        <div key={key}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 12 }}>{SCORE_DIMENSION_LABELS[key]}</Text>
            <Text strong style={{ fontSize: 12 }}>{local[key]}%</Text>
          </div>
          <Slider
            min={0}
            max={100}
            value={local[key]}
            onChange={(v) => handleChange(key, v)}
          />
        </div>
      ))}
      {total !== 100 && (
        <Alert
          message={`합계: ${total}% (100%가 되어야 합니다)`}
          type="warning"
          showIcon
          style={{ fontSize: 12 }}
        />
      )}
      <Space>
        <Button type="primary" size="small" onClick={handleApply} disabled={total !== 100}>
          적용
        </Button>
        <Button size="small" onClick={handleReset}>초기화</Button>
      </Space>
    </Space>
  );
}
