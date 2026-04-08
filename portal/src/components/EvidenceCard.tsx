"use client";

import { Card, Tag, Typography, Space } from "antd";
import { LinkOutlined, CameraOutlined } from "@ant-design/icons";
import type { Evidence } from "@/lib/types";
import { SCORE_DIMENSION_LABELS } from "@/lib/types";
import type { ScoreBreakdown } from "@/lib/types";

const { Text, Paragraph } = Typography;

const SOURCE_LABELS: Record<string, string> = {
  website: "웹사이트",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  instagram: "Instagram",
  x: "X (Twitter)",
  forum: "포럼",
  news: "뉴스",
};

const SOURCE_COLORS: Record<string, string> = {
  website: "blue",
  linkedin: "geekblue",
  facebook: "blue",
  instagram: "magenta",
  x: "default",
  forum: "cyan",
  news: "orange",
};

interface Props {
  evidence: Evidence;
  onScreenshotClick?: (evidence: Evidence) => void;
}

export default function EvidenceCard({ evidence, onScreenshotClick }: Props) {
  return (
    <Card size="small" style={{ marginBottom: 8 }} hoverable>
      <div style={{ display: "flex", gap: 12 }}>
        {evidence.screenshot_path && (
          <div
            style={{
              width: 80, height: 60, background: "#f5f5f5", borderRadius: 4,
              cursor: "pointer", display: "flex", alignItems: "center",
              justifyContent: "center", flexShrink: 0, overflow: "hidden",
            }}
            onClick={() => onScreenshotClick?.(evidence)}
          >
            <CameraOutlined style={{ fontSize: 20, color: "#999" }} />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Space size={4} style={{ marginBottom: 4 }}>
            <Tag color={SOURCE_COLORS[evidence.source_type] || "default"} style={{ fontSize: 11 }}>
              {SOURCE_LABELS[evidence.source_type] || evidence.source_type}
            </Tag>
            {evidence.content_date && (
              <Text type="secondary" style={{ fontSize: 11 }}>{evidence.content_date}</Text>
            )}
          </Space>
          {evidence.text_translated && (
            <Paragraph style={{ fontSize: 12, margin: "4px 0" }} ellipsis={{ rows: 2 }}>
              {evidence.text_translated}
            </Paragraph>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Space size={2} wrap>
              {evidence.related_scores?.map((key) => (
                <Tag key={key} style={{ fontSize: 10, lineHeight: "16px" }} color="orange">
                  {SCORE_DIMENSION_LABELS[key as keyof ScoreBreakdown] || key}
                </Tag>
              ))}
            </Space>
            {evidence.source_url && (
              <a href={evidence.source_url} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}>
                <LinkOutlined style={{ fontSize: 12 }} />
              </a>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
