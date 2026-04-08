"use client";

import { useOne, useList } from "@refinedev/core";
import { useParams } from "next/navigation";
import { Table, Tag, Card, Statistic, Tabs, Button, Input, Breadcrumb, Typography, Space, Badge } from "antd";
import { HomeOutlined, SearchOutlined, CheckCircleOutlined } from "@ant-design/icons";
import Link from "next/link";
import { useState } from "react";
import type { Project, Prospect, Feedback, Exhibition } from "@/lib/types";

const { Title, Text, Paragraph } = Typography;

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchText, setSearchText] = useState("");
  const [feedbackNote, setFeedbackNote] = useState("");

  const { query: pq } = useOne<Project>({ resource: "projects", id });
  const { query: prq } = useList<Prospect>({
    resource: "prospects",
    filters: [{ field: "project_id", operator: "eq", value: id }],
    sorters: [{ field: "match_score", order: "desc" }],
    pagination: { pageSize: 100 },
  });
  const { query: fq } = useList<Feedback>({
    resource: "feedback",
    filters: [{ field: "project_id", operator: "eq", value: id }],
    sorters: [{ field: "timestamp", order: "asc" }],
    pagination: { pageSize: 100 },
  });
  const { query: eq } = useList<Exhibition>({
    resource: "exhibitions",
    filters: [{ field: "project_id", operator: "eq", value: id }],
    pagination: { pageSize: 50 },
  });

  const project = pq.data?.data;
  const prospects = prq.data?.data || [];
  const feedback = fq.data?.data || [];
  const exhibitions = eq.data?.data || [];

  const filtered = prospects.filter((p) =>
    !searchText || p.name.toLowerCase().includes(searchText.toLowerCase())
  );

  const stats = {
    total: prospects.length,
    high: prospects.filter((p) => p.priority === "high").length,
    accepted: prospects.filter((p) => p.feedback_status === "accepted").length,
    rejected: prospects.filter((p) => p.feedback_status === "rejected").length,
  };

  if (pq.isLoading || !project) return null;

  const tabItems = [
    {
      key: "prospects",
      label: `바이어 리스트 (${prospects.length})`,
      children: (
        <div>
          <Input placeholder="업체명 검색..." prefix={<SearchOutlined />} value={searchText}
            onChange={(e) => setSearchText(e.target.value)} style={{ width: 300, marginBottom: 16 }} allowClear />
          <Table dataSource={filtered} rowKey="id" loading={prq.isLoading} size="middle"
            pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (t) => `총 ${t}개` }}
            onRow={(record) => ({
              onClick: () => window.location.href = `/dashboard/project/${id}/prospect/${record.id}`,
              style: { cursor: "pointer", opacity: record.feedback_status === "rejected" ? 0.5 : 1 },
            })}
            columns={[
              {
                title: "업체명", dataIndex: "name", key: "name",
                sorter: (a: Prospect, b: Prospect) => a.name.localeCompare(b.name),
                render: (name: string, record: Prospect) => (
                  <div>
                    <div style={{ fontWeight: 600 }}>{name}</div>
                    <Text type="secondary" style={{ fontSize: 12 }}>{record.url || ""}</Text>
                  </div>
                ),
              },
              {
                title: "점수", dataIndex: "match_score", key: "score", width: 80,
                sorter: (a: Prospect, b: Prospect) => (a.match_score || 0) - (b.match_score || 0),
                defaultSortOrder: "descend",
                render: (score: number) => <Tag color={score >= 80 ? "green" : score >= 50 ? "gold" : "default"} style={{ fontWeight: 700 }}>{score}</Tag>,
              },
              {
                title: "분류", dataIndex: "buyer_or_competitor", key: "type", width: 80,
                filters: [{ text: "구매자", value: "buyer" }, { text: "경쟁사", value: "competitor" }],
                onFilter: (value: unknown, record: Prospect) => record.buyer_or_competitor === value,
                render: (type: string) => type === "buyer" ? <Tag color="success">구매자</Tag> : type === "competitor" ? <Tag color="error">경쟁사</Tag> : <Tag>-</Tag>,
              },
              {
                title: "등급", dataIndex: "priority", key: "priority", width: 90,
                filters: [{ text: "HIGH", value: "high" }, { text: "MEDIUM", value: "medium" }, { text: "LOW", value: "low" }],
                onFilter: (value: unknown, record: Prospect) => record.priority === value,
                render: (p: string) => <Tag color={p === "high" ? "red" : p === "medium" ? "orange" : "default"}>{p?.toUpperCase()}</Tag>,
              },
              {
                title: "공급업체", key: "suppliers", width: 160,
                render: (_: unknown, record: Prospect) => <Text type="secondary" style={{ fontSize: 12 }}>{record.current_suppliers?.slice(0, 3).join(", ") || "-"}</Text>,
              },
              {
                title: "상태", dataIndex: "feedback_status", key: "status", width: 100,
                filters: [{ text: "대기", value: "pending" }, { text: "승인", value: "accepted" }, { text: "제외", value: "rejected" }, { text: "추가분석", value: "needs_more" }],
                onFilter: (value: unknown, record: Prospect) => (record.feedback_status || "pending") === value,
                render: (s: string) => s === "accepted" ? <Badge status="success" text="승인" /> : s === "rejected" ? <Badge status="error" text="제외" /> : s === "needs_more" ? <Badge status="warning" text="추가분석" /> : <Badge status="default" text="대기" />,
              },
            ]}
          />
        </div>
      ),
    },
    {
      key: "exhibitions",
      label: `전시회 (${exhibitions.length})`,
      children: (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {exhibitions.map((ex) => (
            <Card key={ex.id} size="small">
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{ex.name}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>📍 {ex.location} · {ex.typical_month}</Text>
              {ex.relevance && <Paragraph style={{ fontSize: 13, marginTop: 4, marginBottom: 4 }}>{ex.relevance}</Paragraph>}
              {ex.action_suggestion && <Text style={{ fontSize: 12, color: "#52c41a" }}>💡 {ex.action_suggestion}</Text>}
            </Card>
          ))}
        </div>
      ),
    },
    {
      key: "feedback",
      label: "피드백",
      children: (
        <Card>
          <Title level={5}>프로젝트 피드백</Title>
          <Input.TextArea value={feedbackNote} onChange={(e) => setFeedbackNote(e.target.value)}
            placeholder="전체 방향에 대한 의견을 남겨주세요..." rows={3} style={{ marginBottom: 12 }} />
          <Button type="primary">피드백 전송</Button>
          <div style={{ marginTop: 16 }}>
            {feedback.filter((f) => !f.prospect_id).map((f, i) => (
              <div key={i} style={{ padding: 12, background: "#fafafa", borderRadius: 8, marginBottom: 8 }}>
                <Text type="secondary" style={{ fontSize: 11 }}>{f.timestamp?.replace("T", " ").split(".")[0]}</Text>
                <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13, marginTop: 4,
                  color: f.user_email?.includes("tradevoy") || f.user_email?.includes("system") ? "#f15f23" : undefined }}>
                  {f.text}
                </pre>
              </div>
            ))}
          </div>
        </Card>
      ),
    },
  ];

  return (
    <div>
      <Breadcrumb className="mb-4" items={[
        { title: <Link href="/dashboard"><HomeOutlined /> 대시보드</Link> },
        { title: project.name },
      ]} />

      <Space align="center" style={{ marginBottom: 4 }}>
        <Title level={4} style={{ margin: 0 }}>{project.name}</Title>
        <Tag color={project.status === "active" ? "green" : project.status === "reviewing" ? "orange" : "default"}>
          {project.status === "active" ? "진행 중" : project.status === "reviewing" ? "검토 중" : "완료"}
        </Tag>
      </Space>
      <Text type="secondary" style={{ display: "block", marginBottom: 24 }}>
        {project.created_at?.split("T")[0]} · {project.countries} · {project.product}
      </Text>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <Card size="small"><Statistic title="분석 대상" value={stats.total} valueStyle={{ color: "#f15f23", fontWeight: 800 }} /></Card>
        <Card size="small"><Statistic title="HIGH 등급" value={stats.high} valueStyle={{ color: "#f15f23", fontWeight: 800 }} prefix={<CheckCircleOutlined />} /></Card>
        <Card size="small"><Statistic title="승인" value={stats.accepted} valueStyle={{ color: "#52c41a", fontWeight: 800 }} /></Card>
        <Card size="small"><Statistic title="제외" value={stats.rejected} valueStyle={{ color: "#999", fontWeight: 800 }} /></Card>
      </div>

      <Tabs items={tabItems} />
    </div>
  );
}
