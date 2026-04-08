"use client";

import { Progress, Space, Typography } from "antd";
import type { ScoreBreakdown, ScoreWeights } from "@/lib/types";
import { SCORE_DIMENSION_LABELS, DEFAULT_SCORE_WEIGHTS } from "@/lib/types";

const { Text } = Typography;

interface Props {
  breakdown: ScoreBreakdown;
  weights?: ScoreWeights;
}

function scoreColor(score: number): string {
  if (score >= 80) return "#52c41a";
  if (score >= 50) return "#faad14";
  return "#ff4d4f";
}

export default function ScoreBreakdownChart({ breakdown, weights }: Props) {
  const w = weights || DEFAULT_SCORE_WEIGHTS;
  const dimensions = Object.keys(SCORE_DIMENSION_LABELS) as (keyof ScoreBreakdown)[];

  return (
    <Space direction="vertical" style={{ width: "100%" }} size={8}>
      {dimensions.map((key) => {
        const dim = breakdown[key];
        if (!dim) return null;
        return (
          <div key={key}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
              <Text style={{ fontSize: 12 }}>
                {SCORE_DIMENSION_LABELS[key]}
                <Text type="secondary" style={{ fontSize: 11 }}> ({w[key]}%)</Text>
              </Text>
              <Text strong style={{ fontSize: 12, color: scoreColor(dim.score) }}>
                {dim.score}
              </Text>
            </div>
            <Progress
              percent={dim.score}
              showInfo={false}
              strokeColor={scoreColor(dim.score)}
              size="small"
            />
            {dim.reason && (
              <Text type="secondary" style={{ fontSize: 11, display: "block", marginTop: 2 }}>
                {dim.reason}
              </Text>
            )}
          </div>
        );
      })}
    </Space>
  );
}
