"use client";

import { Card, Tag, Typography, Space } from "antd";
import { BulbOutlined, LikeOutlined, DislikeOutlined } from "@ant-design/icons";

const { Text, Paragraph } = Typography;

interface PatternData {
  preferred_traits: string[];
  avoided_traits: string[];
  summary: string;
  suggested_conditions: string[];
}

interface Props {
  patterns: PatternData;
  onAddCondition?: (condition: string) => void;
}

export default function PatternInsightCard({ patterns, onAddCondition }: Props) {
  if (!patterns.summary && !patterns.preferred_traits.length) return null;

  return (
    <Card
      title={<><BulbOutlined /> 패턴 인사이트</>}
      size="small"
      style={{ marginBottom: 16 }}
    >
      {patterns.summary && (
        <Paragraph style={{ fontSize: 13 }}>{patterns.summary}</Paragraph>
      )}

      {patterns.preferred_traits.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <Text strong style={{ fontSize: 12, color: "#52c41a" }}>
            <LikeOutlined /> 선호 특성
          </Text>
          <div style={{ marginTop: 4 }}>
            {patterns.preferred_traits.map((t, i) => (
              <Tag key={i} color="success" style={{ marginBottom: 4 }}>{t}</Tag>
            ))}
          </div>
        </div>
      )}

      {patterns.avoided_traits.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <Text strong style={{ fontSize: 12, color: "#ff4d4f" }}>
            <DislikeOutlined /> 회피 특성
          </Text>
          <div style={{ marginTop: 4 }}>
            {patterns.avoided_traits.map((t, i) => (
              <Tag key={i} color="error" style={{ marginBottom: 4 }}>{t}</Tag>
            ))}
          </div>
        </div>
      )}

      {patterns.suggested_conditions.length > 0 && onAddCondition && (
        <div>
          <Text strong style={{ fontSize: 12 }}>추천 조건</Text>
          <div style={{ marginTop: 4 }}>
            {patterns.suggested_conditions.map((c, i) => (
              <Tag
                key={i}
                color="orange"
                style={{ cursor: "pointer", marginBottom: 4 }}
                onClick={() => onAddCondition(c)}
              >
                + {c}
              </Tag>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
