"use client";

import { useOne, useList, useUpdate, useCreate, useGetIdentity } from "@refinedev/core";
import { useParams, useRouter } from "next/navigation";
import { Card, Tag, Button, Input, Breadcrumb, Typography, Space, Descriptions, Timeline, Alert, Divider, Spin } from "antd";
import { HomeOutlined, CheckCircleOutlined, CloseCircleOutlined, SyncOutlined, LinkOutlined } from "@ant-design/icons";
import Link from "next/link";
import { useState } from "react";
import type { Project, Prospect, Feedback } from "@/lib/types";

const { Title, Text, Paragraph } = Typography;

export default function ProspectDetailPage() {
  const { id, pid } = useParams<{ id: string; pid: string }>();
  const router = useRouter();
  const { data: identity } = useGetIdentity<{ id: string; email: string }>();
  const [reason, setReason] = useState("");

  const { query: pq } = useOne<Project>({ resource: "projects", id });
  const { query: prq } = useOne<Prospect>({ resource: "prospects", id: pid });
  const { query: fq } = useList<Feedback>({
    resource: "feedback",
    filters: [{ field: "prospect_id", operator: "eq", value: pid }],
    sorters: [{ field: "timestamp", order: "asc" }],
    pagination: { pageSize: 50 },
  });

  const { mutate: updateProspect } = useUpdate();
  const { mutate: createFeedback } = useCreate();

  const project = pq.data?.data;
  const prospect = prq.data?.data;
  const feedback = fq.data?.data || [];
  const isLoading = prq.isLoading;

  if (isLoading || !prospect || !project) return <div style={{ textAlign: "center", padding: 64 }}><Spin size="large" /></div>;

  const score = prospect.match_score || 0;
  const status = prospect.feedback_status;

  function handleAction(newStatus: string) {
    updateProspect({ resource: "prospects", id: pid, values: { feedback_status: newStatus } });
    if (reason.trim()) {
      createFeedback({
        resource: "feedback",
        values: {
          project_id: id,
          prospect_id: pid,
          user_email: identity?.email || "",
          type: newStatus === "accepted" ? "prospect_accept" : newStatus === "rejected" ? "prospect_reject" : "prospect_more",
          text: reason,
          timestamp: new Date().toISOString(),
        },
      }, { onSuccess: () => fq.refetch() });
    }
    setReason("");
  }

  return (
    <div>
      <Breadcrumb className="mb-4" items={[
        { title: <Link href="/dashboard"><HomeOutlined /> 대시보드</Link> },
        { title: <Link href={`/dashboard/project/${id}`}>{project.name}</Link> },
        { title: prospect.name },
      ]} />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <Space align="center" style={{ marginBottom: 4 }}>
            <Title level={4} style={{ margin: 0 }}>{prospect.name}</Title>
            <Tag color={score >= 80 ? "green" : score >= 50 ? "gold" : "default"} style={{ fontSize: 16, fontWeight: 800, padding: "2px 12px" }}>{score}점</Tag>
            {prospect.buyer_or_competitor === "buyer" && <Tag color="success">구매자</Tag>}
            {prospect.buyer_or_competitor === "competitor" && <Tag color="error">경쟁사</Tag>}
            <Tag>{prospect.priority?.toUpperCase()}</Tag>
            {status === "accepted" && <Tag icon={<CheckCircleOutlined />} color="success">승인</Tag>}
            {status === "rejected" && <Tag icon={<CloseCircleOutlined />} color="error">제외</Tag>}
            {status === "needs_more" && <Tag icon={<SyncOutlined />} color="warning">추가분석</Tag>}
          </Space>
          {prospect.url && <a href={prospect.url} target="_blank" rel="noopener"><Text type="secondary"><LinkOutlined /> {prospect.url}</Text></a>}
        </div>
        <Space>
          <Button icon={<CheckCircleOutlined />} onClick={() => handleAction("accepted")}
            style={status === "accepted" ? { borderColor: "#52c41a", color: "#52c41a" } : {}}>승인</Button>
          <Button danger icon={<CloseCircleOutlined />} onClick={() => handleAction("rejected")}
            style={status === "rejected" ? { borderColor: "#ff4d4f" } : {}}>제외</Button>
          <Button icon={<SyncOutlined />} onClick={() => handleAction("needs_more")}
            style={status === "needs_more" ? { borderColor: "#faad14", color: "#faad14" } : {}}>추가분석</Button>
        </Space>
      </div>

      {/* Feedback input */}
      <Input.Search placeholder="피드백 이유 (예: 이미 거래 중, 이런 업체를 더 찾아줘...)" enterButton="전송"
        value={reason} onChange={(e) => setReason(e.target.value)}
        onSearch={() => { if (reason.trim()) handleAction(status || "pending"); }}
        style={{ marginBottom: 24 }} />

      {feedback.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          {feedback.map((f, i) => (
            <div key={i} style={{ fontSize: 12, background: "#fafafa", borderRadius: 6, padding: "6px 12px", marginBottom: 4 }}>
              <Text type="secondary">{f.timestamp?.split("T")[0]}</Text>
              {" · "}
              <Tag color={f.type === "prospect_accept" ? "success" : f.type === "prospect_reject" ? "error" : "warning"}>
                {f.type === "prospect_accept" ? "승인" : f.type === "prospect_reject" ? "제외" : "추가요청"}
              </Tag>
              {f.text && <Text>{f.text}</Text>}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
        {/* Left */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title="회사 요약" size="small">
            <Paragraph>{prospect.summary || "정보 없음"}</Paragraph>
          </Card>

          {prospect.reasoning_chain && (
            <Card title="매칭 점수 판단 근거" size="small">
              <Alert message={prospect.reasoning_chain} type="info" showIcon={false}
                style={{ background: "#fff7ed", border: "1px solid #fed7aa" }} />
            </Card>
          )}

          {prospect.evidence_quotes?.length > 0 && (
            <Card title={`홈페이지 원문 인용 (${prospect.evidence_quotes.length}건)`} size="small">
              {prospect.evidence_quotes.map((eq, i) => (
                <div key={i} style={{ marginBottom: 12, paddingLeft: 12, borderLeft: "2px solid #f15f23" }}>
                  <Text type="secondary" italic style={{ fontSize: 12 }}>&ldquo;{eq.original}&rdquo;</Text>
                  <div style={{ fontWeight: 500, marginTop: 2 }}>→ {eq.translated}</div>
                  <Text style={{ fontSize: 12, color: "#f15f23" }}>📌 {eq.relevance}</Text>
                </div>
              ))}
            </Card>
          )}

          {prospect.approach && (
            <Card title="접근 전략" size="small"><Paragraph>{prospect.approach}</Paragraph></Card>
          )}

          {prospect.email_subject && (
            <Card title="이메일 초안" size="small">
              <div style={{ background: "#fafafa", borderRadius: 8, padding: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Subject: {prospect.email_subject}</div>
                <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13, color: "#555" }}>{prospect.email_body}</pre>
              </div>
            </Card>
          )}

          {prospect.followup_sequence?.length > 0 && (
            <Card title="팔로업 시퀀스" size="small">
              <Timeline items={prospect.followup_sequence.map((fu) => ({
                color: fu.day === 3 ? "green" : fu.day === 7 ? "blue" : "gray",
                children: (
                  <div>
                    <Tag color={fu.day === 3 ? "green" : fu.day === 7 ? "blue" : "default"}>Day {fu.day}</Tag>
                    <span style={{ fontWeight: 600 }}>{fu.subject}</span>
                    <Paragraph type="secondary" style={{ fontSize: 12, margin: "4px 0 0" }}>{fu.body}</Paragraph>
                  </div>
                ),
              }))} />
            </Card>
          )}
        </div>

        {/* Right */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title="바이어 인텔리전스" size="small">
            <Descriptions column={1} size="small" labelStyle={{ fontWeight: 600, fontSize: 12, color: "#999" }}>
              <Descriptions.Item label="현재 공급업체">
                {prospect.current_suppliers?.length ? <Space wrap>{prospect.current_suppliers.map((s, i) => <Tag key={i}>{s}</Tag>)}</Space> : "미확인"}
              </Descriptions.Item>
              <Descriptions.Item label="회사 규모">{prospect.company_size || "미확인"}</Descriptions.Item>
              <Descriptions.Item label="의사결정권자">{prospect.decision_maker || "미확인"}</Descriptions.Item>
              <Descriptions.Item label="접근 타이밍">{prospect.best_timing || "미확인"}</Descriptions.Item>
              <Descriptions.Item label="경쟁 환경">{prospect.competitive_landscape || "미확인"}</Descriptions.Item>
            </Descriptions>
          </Card>

          {prospect.match_reason && (
            <Card title="매칭 사유" size="small"><Paragraph style={{ fontSize: 13 }}>{prospect.match_reason}</Paragraph></Card>
          )}

          {prospect.detected_products?.length > 0 && (
            <Card title="취급 제품" size="small">
              <Space wrap>{prospect.detected_products.map((p, i) => <Tag key={i} color="blue">{p}</Tag>)}</Space>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
