"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Breadcrumb, Card, Tag, Button, Input, Descriptions, Timeline, Space, Alert, Divider } from "antd";
import { HomeOutlined, CheckCircleOutlined, CloseCircleOutlined, SyncOutlined, LinkOutlined } from "@ant-design/icons";
import Link from "next/link";
import type { Project, Prospect, Feedback } from "@/lib/types";

interface Props {
  project: Project;
  prospect: Prospect;
  feedback: Feedback[];
}

export function ProspectDetail({ project, prospect, feedback: initialFB }: Props) {
  const router = useRouter();
  const [feedback, setFeedback] = useState(initialFB);
  const [status, setStatus] = useState(prospect.feedback_status);
  const [reason, setReason] = useState("");

  const score = prospect.match_score || 0;
  const scoreColor = score >= 80 ? "green" : score >= 50 ? "gold" : "default";

  async function handleAction(newStatus: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("prospects").update({ feedback_status: newStatus }).eq("id", prospect.id);
    if (reason.trim()) {
      const fb: Partial<Feedback> = {
        project_id: project.id, prospect_id: prospect.id,
        user_email: user?.email || "",
        type: newStatus === "accepted" ? "prospect_accept" : newStatus === "rejected" ? "prospect_reject" : "prospect_more",
        text: reason, timestamp: new Date().toISOString(),
      };
      await supabase.from("feedback").insert(fb);
      setFeedback([...feedback, fb as Feedback]);
    }
    setStatus(newStatus as Prospect["feedback_status"]);
    setReason("");
    router.refresh();
  }

  return (
    <div>
      {/* Breadcrumb */}
      <Breadcrumb className="mb-4" items={[
        { title: <Link href="/dashboard"><HomeOutlined /> 대시보드</Link> },
        { title: <Link href={`/dashboard/project/${project.id}`}>{project.name}</Link> },
        { title: prospect.name },
      ]} />

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-xl font-bold">{prospect.name}</h1>
            <Tag color={scoreColor} style={{ fontSize: 16, fontWeight: 800, padding: "2px 12px" }}>{score}점</Tag>
            {prospect.buyer_or_competitor === "buyer" && <Tag color="success">구매자</Tag>}
            {prospect.buyer_or_competitor === "competitor" && <Tag color="error">경쟁사</Tag>}
            <Tag>{prospect.priority?.toUpperCase()}</Tag>
            {status === "accepted" && <Tag icon={<CheckCircleOutlined />} color="success">승인</Tag>}
            {status === "rejected" && <Tag icon={<CloseCircleOutlined />} color="error">제외</Tag>}
            {status === "needs_more" && <Tag icon={<SyncOutlined />} color="warning">추가분석</Tag>}
          </div>
          {prospect.url && (
            <a href={prospect.url} target="_blank" rel="noopener" className="text-sm text-blue-500">
              <LinkOutlined /> {prospect.url}
            </a>
          )}
        </div>
        <Space>
          <Button type="primary" ghost icon={<CheckCircleOutlined />}
            style={status === "accepted" ? { borderColor: "#52c41a", color: "#52c41a" } : {}}
            onClick={() => handleAction("accepted")}>승인</Button>
          <Button danger ghost icon={<CloseCircleOutlined />}
            style={status === "rejected" ? { borderColor: "#ff4d4f", color: "#ff4d4f" } : {}}
            onClick={() => handleAction("rejected")}>제외</Button>
          <Button icon={<SyncOutlined />}
            style={status === "needs_more" ? { borderColor: "#faad14", color: "#faad14" } : {}}
            onClick={() => handleAction("needs_more")}>추가분석</Button>
        </Space>
      </div>

      {/* Feedback input */}
      <div className="mb-6">
        <Input.Search
          placeholder="피드백 이유 (예: 이미 거래 중, 이런 업체를 더 찾아줘...)"
          enterButton="피드백 전송"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onSearch={() => { if (reason.trim()) handleAction(status || "pending"); }}
        />
        {feedback.length > 0 && (
          <div className="mt-2 space-y-1">
            {feedback.map((f, i) => (
              <div key={i} className="text-xs bg-zinc-50 rounded px-3 py-2">
                <span className="text-zinc-400">{f.timestamp?.split("T")[0]}</span>
                {" · "}
                <Tag color={f.type === "prospect_accept" ? "success" : f.type === "prospect_reject" ? "error" : "warning"}>
                  {f.type === "prospect_accept" ? "승인" : f.type === "prospect_reject" ? "제외" : "추가요청"}
                </Tag>
                {f.text && <span className="text-zinc-600">{f.text}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: 2 cols */}
        <div className="col-span-2 space-y-4">
          {/* 회사 요약 */}
          <Card title="회사 요약" size="small">
            <p className="text-sm leading-relaxed">{prospect.summary || "정보 없음"}</p>
          </Card>

          {/* 매칭 근거 */}
          {prospect.reasoning_chain && (
            <Card title="매칭 점수 판단 근거" size="small">
              <Alert message={prospect.reasoning_chain} type="info" showIcon={false}
                style={{ background: "#fff7ed", border: "1px solid #fed7aa" }} />
            </Card>
          )}

          {/* 원문 인용 */}
          {prospect.evidence_quotes?.length > 0 && (
            <Card title={`홈페이지 원문 인용 (${prospect.evidence_quotes.length}건)`} size="small">
              {prospect.evidence_quotes.map((eq, i) => (
                <div key={i} className="mb-3 pl-3 border-l-2 border-[#f15f23]">
                  <p className="text-xs text-zinc-400 italic">&ldquo;{eq.original}&rdquo;</p>
                  <p className="text-sm font-medium mt-1">→ {eq.translated}</p>
                  <p className="text-xs text-[#f15f23] mt-1">📌 {eq.relevance}</p>
                </div>
              ))}
            </Card>
          )}

          {/* 접근 전략 */}
          {prospect.approach && (
            <Card title="접근 전략" size="small">
              <p className="text-sm leading-relaxed">{prospect.approach}</p>
            </Card>
          )}

          {/* 이메일 초안 */}
          {prospect.email_subject && (
            <Card title="이메일 초안" size="small">
              <div className="bg-zinc-50 rounded p-4">
                <div className="font-semibold text-sm mb-2">Subject: {prospect.email_subject}</div>
                <div className="text-sm text-zinc-600 whitespace-pre-wrap">{prospect.email_body}</div>
              </div>
            </Card>
          )}

          {/* 팔로업 시퀀스 */}
          {prospect.followup_sequence?.length > 0 && (
            <Card title="팔로업 시퀀스" size="small">
              <Timeline items={prospect.followup_sequence.map((fu) => ({
                color: fu.day === 3 ? "green" : fu.day === 7 ? "blue" : "gray",
                children: (
                  <div>
                    <Tag color={fu.day === 3 ? "green" : fu.day === 7 ? "blue" : "default"}>Day {fu.day}</Tag>
                    <span className="font-semibold text-sm ml-1">{fu.subject}</span>
                    <p className="text-xs text-zinc-500 mt-1">{fu.body}</p>
                  </div>
                ),
              }))} />
            </Card>
          )}
        </div>

        {/* Right: 1 col */}
        <div className="space-y-4">
          {/* 인텔리전스 */}
          <Card title="바이어 인텔리전스" size="small">
            <Descriptions column={1} size="small" labelStyle={{ fontWeight: 600, fontSize: 12, color: "#999" }}>
              <Descriptions.Item label="현재 공급업체">
                {prospect.current_suppliers?.length ? (
                  <Space size={[0, 4]} wrap>
                    {prospect.current_suppliers.map((s, i) => <Tag key={i}>{s}</Tag>)}
                  </Space>
                ) : "미확인"}
              </Descriptions.Item>
              <Descriptions.Item label="회사 규모">{prospect.company_size || "미확인"}</Descriptions.Item>
              <Descriptions.Item label="의사결정권자">{prospect.decision_maker || "미확인"}</Descriptions.Item>
              <Descriptions.Item label="접근 타이밍">{prospect.best_timing || "미확인"}</Descriptions.Item>
              <Descriptions.Item label="경쟁 환경">{prospect.competitive_landscape || "미확인"}</Descriptions.Item>
            </Descriptions>
          </Card>

          {/* 매칭 사유 */}
          {prospect.match_reason && (
            <Card title="매칭 사유" size="small">
              <p className="text-sm">{prospect.match_reason}</p>
            </Card>
          )}

          {/* 취급 제품 */}
          {prospect.detected_products?.length > 0 && (
            <Card title="취급 제품" size="small">
              <Space size={[0, 4]} wrap>
                {prospect.detected_products.map((p, i) => <Tag key={i} color="blue">{p}</Tag>)}
              </Space>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
