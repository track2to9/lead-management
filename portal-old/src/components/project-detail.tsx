"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Table, Tag, Breadcrumb, Card, Statistic, Tabs, Button, Input, Space, Badge } from "antd";
import { HomeOutlined, CheckCircleOutlined, CloseCircleOutlined, SyncOutlined, SearchOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import Link from "next/link";
import type { Project, Prospect, Feedback, Exhibition } from "@/lib/types";

interface Props {
  project: Project;
  prospects: Prospect[];
  feedback: Feedback[];
  exhibitions: Exhibition[];
}

export function ProjectDetail({ project, prospects, feedback: initialFB, exhibitions }: Props) {
  const [feedback, setFeedback] = useState(initialFB);
  const [projectNote, setProjectNote] = useState("");
  const [searchText, setSearchText] = useState("");

  const stats = {
    total: prospects.length,
    high: prospects.filter((p) => p.priority === "high").length,
    accepted: prospects.filter((p) => p.feedback_status === "accepted").length,
    rejected: prospects.filter((p) => p.feedback_status === "rejected").length,
  };

  async function submitProjectFeedback() {
    if (!projectNote.trim()) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const newFB: Partial<Feedback> = {
      project_id: project.id,
      user_email: user?.email || "",
      type: "general",
      text: projectNote,
      timestamp: new Date().toISOString(),
    };
    await supabase.from("feedback").insert(newFB);
    setFeedback([...feedback, newFB as Feedback]);
    setProjectNote("");
  }

  const filteredProspects = prospects.filter((p) =>
    !searchText || p.name.toLowerCase().includes(searchText.toLowerCase())
  );

  const columns: ColumnsType<Prospect> = [
    {
      title: "업체명",
      dataIndex: "name",
      key: "name",
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (name: string, record: Prospect) => (
        <Link href={`/dashboard/project/${project.id}/prospect/${record.id}`}>
          <div>
            <div className="font-semibold text-zinc-800 hover:text-[#f15f23] transition">{name}</div>
            <div className="text-xs text-zinc-400 truncate max-w-[250px]">{record.url || ""}</div>
          </div>
        </Link>
      ),
    },
    {
      title: "점수",
      dataIndex: "match_score",
      key: "match_score",
      width: 80,
      sorter: (a, b) => (a.match_score || 0) - (b.match_score || 0),
      defaultSortOrder: "descend",
      render: (score: number) => {
        const color = score >= 80 ? "green" : score >= 50 ? "gold" : "default";
        return <Tag color={color} style={{ fontWeight: 700, fontSize: 13 }}>{score}</Tag>;
      },
    },
    {
      title: "분류",
      dataIndex: "buyer_or_competitor",
      key: "buyer_or_competitor",
      width: 80,
      filters: [
        { text: "구매자", value: "buyer" },
        { text: "경쟁사", value: "competitor" },
      ],
      onFilter: (value, record) => record.buyer_or_competitor === value,
      render: (type: string) => {
        if (type === "buyer") return <Tag color="success">구매자</Tag>;
        if (type === "competitor") return <Tag color="error">경쟁사</Tag>;
        return <Tag>미분류</Tag>;
      },
    },
    {
      title: "등급",
      dataIndex: "priority",
      key: "priority",
      width: 90,
      filters: [
        { text: "HIGH", value: "high" },
        { text: "MEDIUM", value: "medium" },
        { text: "LOW", value: "low" },
      ],
      onFilter: (value, record) => record.priority === value,
      render: (priority: string) => {
        const color = priority === "high" ? "red" : priority === "medium" ? "orange" : "default";
        return <Tag color={color}>{priority?.toUpperCase()}</Tag>;
      },
    },
    {
      title: "주요 공급업체",
      key: "suppliers",
      width: 180,
      render: (_: unknown, record: Prospect) => (
        <span className="text-xs text-zinc-500">
          {record.current_suppliers?.slice(0, 3).join(", ") || "-"}
        </span>
      ),
    },
    {
      title: "상태",
      dataIndex: "feedback_status",
      key: "feedback_status",
      width: 100,
      filters: [
        { text: "대기", value: "pending" },
        { text: "승인", value: "accepted" },
        { text: "제외", value: "rejected" },
        { text: "추가분석", value: "needs_more" },
      ],
      onFilter: (value, record) => (record.feedback_status || "pending") === value,
      render: (status: string) => {
        if (status === "accepted") return <Badge status="success" text="승인" />;
        if (status === "rejected") return <Badge status="error" text="제외" />;
        if (status === "needs_more") return <Badge status="warning" text="추가분석" />;
        return <Badge status="default" text="대기" />;
      },
    },
  ];

  const tabItems = [
    {
      key: "prospects",
      label: `바이어 리스트 (${prospects.length})`,
      children: (
        <div>
          <div className="mb-4">
            <Input
              placeholder="업체명 검색..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 300 }}
              allowClear
            />
          </div>
          <Table
            columns={columns}
            dataSource={filteredProspects}
            rowKey="id"
            size="middle"
            pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (total) => `총 ${total}개` }}
            onRow={(record) => ({
              style: {
                cursor: "pointer",
                opacity: record.feedback_status === "rejected" ? 0.5 : 1,
              },
            })}
          />
        </div>
      ),
    },
    {
      key: "exhibitions",
      label: `전시회 (${exhibitions.length})`,
      children: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {exhibitions.map((ex) => (
            <Card key={ex.id} size="small">
              <h4 className="font-bold text-sm mb-1">{ex.name}</h4>
              <p className="text-xs text-zinc-500 mb-2">📍 {ex.location} · {ex.typical_month}</p>
              {ex.relevance && <p className="text-xs mb-1">{ex.relevance}</p>}
              {ex.action_suggestion && <p className="text-xs text-green-600">💡 {ex.action_suggestion}</p>}
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
          <h3 className="font-bold text-sm mb-2">프로젝트 피드백</h3>
          <p className="text-xs text-zinc-400 mb-3">전체 방향에 대한 의견을 남겨주세요.</p>
          <Input.TextArea
            value={projectNote}
            onChange={(e) => setProjectNote(e.target.value)}
            placeholder="예: 중소형 딜러 위주로 더 찾아주세요..."
            rows={3}
            className="mb-3"
          />
          <Button type="primary" onClick={submitProjectFeedback}
            style={{ background: "#f15f23", borderColor: "#f15f23" }}>
            피드백 전송
          </Button>
          <div className="mt-4 space-y-2">
            {feedback.filter((f) => !f.prospect_id).map((f, i) => (
              <div key={i} className="p-3 bg-zinc-50 rounded-lg text-sm">
                <div className="text-[10px] text-zinc-400 mb-1">{f.timestamp?.replace("T", " ").split(".")[0]}</div>
                <div className={f.user_email?.includes("tradevoy") || f.user_email?.includes("system") ? "text-[#f15f23]" : ""}>
                  <pre className="whitespace-pre-wrap font-sans text-sm">{f.text}</pre>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ),
    },
  ];

  return (
    <div>
      {/* Breadcrumb */}
      <Breadcrumb
        className="mb-4"
        items={[
          { title: <Link href="/dashboard"><HomeOutlined /> 대시보드</Link> },
          { title: project.name },
        ]}
      />

      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-xl font-bold text-zinc-900">{project.name}</h1>
        <Tag color={project.status === "active" ? "green" : project.status === "reviewing" ? "orange" : "default"}>
          {project.status === "active" ? "진행 중" : project.status === "reviewing" ? "검토 중" : "완료"}
        </Tag>
      </div>
      <p className="text-sm text-zinc-400 mb-6">
        {project.created_at?.split("T")[0]} · {project.countries} · {project.product}
      </p>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <Card size="small"><Statistic title="분석 대상" value={stats.total} valueStyle={{ color: "#f15f23", fontWeight: 800 }} /></Card>
        <Card size="small"><Statistic title="HIGH 등급" value={stats.high} valueStyle={{ color: "#f15f23", fontWeight: 800 }} prefix={<CheckCircleOutlined />} /></Card>
        <Card size="small"><Statistic title="승인" value={stats.accepted} valueStyle={{ color: "#52c41a", fontWeight: 800 }} /></Card>
        <Card size="small"><Statistic title="제외" value={stats.rejected} valueStyle={{ color: "#999", fontWeight: 800 }} /></Card>
      </div>

      {/* Tabs */}
      <Tabs items={tabItems} />
    </div>
  );
}
