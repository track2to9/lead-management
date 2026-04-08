"use client";

import { Modal, Typography, Tag, Space } from "antd";
import type { Evidence } from "@/lib/types";

const { Text, Paragraph } = Typography;

interface Props {
  evidence: Evidence | null;
  open: boolean;
  onClose: () => void;
}

export default function EvidenceModal({ evidence, open, onClose }: Props) {
  if (!evidence) return null;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={800}
      title={
        <Space>
          <span>증거 자료</span>
          <Tag>{evidence.source_type}</Tag>
        </Space>
      }
    >
      {evidence.screenshot_path && (
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <img
            src={evidence.screenshot_path}
            alt="Evidence screenshot"
            style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid #eee" }}
          />
        </div>
      )}
      {evidence.text_excerpt && (
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ fontSize: 12, display: "block", marginBottom: 4 }}>원문</Text>
          <div style={{ background: "#fafafa", padding: 12, borderRadius: 6, fontSize: 12, maxHeight: 200, overflow: "auto" }}>
            {evidence.text_excerpt}
          </div>
        </div>
      )}
      {evidence.text_translated && (
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ fontSize: 12, display: "block", marginBottom: 4 }}>한국어 번역</Text>
          <Paragraph style={{ fontSize: 13 }}>{evidence.text_translated}</Paragraph>
        </div>
      )}
      {evidence.source_url && (
        <a href={evidence.source_url} target="_blank" rel="noopener">
          원본 링크 열기 →
        </a>
      )}
    </Modal>
  );
}
