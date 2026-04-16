"use client";

import { useOne, useList, useUpdate } from "@refinedev/core";
import { useParams } from "next/navigation";
import { Table, Tag, Card, Statistic, Tabs, Button, Input, Breadcrumb, Typography, Space, Badge } from "antd";
import { HomeOutlined, SearchOutlined, CheckCircleOutlined } from "@ant-design/icons";
import Link from "next/link";
import { useState, useEffect } from "react";
import ScoreWeightsEditor from "@/components/ScoreWeightsEditor";
import RefinementConditionsForm from "@/components/RefinementConditionsForm";
import PatternInsightCard from "@/components/PatternInsightCard";
import DealerCrawler from "@/components/DealerCrawler";
import { DEFAULT_SCORE_WEIGHTS, SCORE_DIMENSION_LABELS } from "@/lib/types";
import type { Project, Prospect, Feedback, Exhibition, ScoreWeights, ScoreBreakdown, ManufacturerDealer } from "@/lib/types";

const { Title, Text, Paragraph } = Typography;

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchText, setSearchText] = useState("");
  const [feedbackNote, setFeedbackNote] = useState("");
  const [weights, setWeights] = useState<ScoreWeights>(DEFAULT_SCORE_WEIGHTS);
  const [activeRound, setActiveRound] = useState<number | "all">("all");
  const { mutate: updateProject } = useUpdate();

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
  const { query: dq } = useList<ManufacturerDealer>({
    resource: "manufacturer_dealers",
    pagination: { pageSize: 1000 },
  });

  const project = pq.data?.data;
  const prospects = prq.data?.data || [];
  const feedback = fq.data?.data || [];
  const exhibitions = eq.data?.data || [];
  const dealers = dq.data?.data || [];

  // 딜러 매칭: prospect ↔ manufacturer_dealers
  function extractDomain(url?: string): string {
    if (!url) return "";
    try { return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace("www.", ""); } catch { return ""; }
  }
  function normalize(name: string): string {
    return name.toLowerCase().replace(/\b(ltd|inc|co|corp|llc|gmbh|bv|sa|srl|pte|pty)\b\.?/gi, "").replace(/[^a-z0-9]/g, "").trim();
  }
  function findDealerMatches(prospect: Prospect): ManufacturerDealer[] {
    const pDomain = extractDomain(prospect.url);
    const pNorm = normalize(prospect.name);
    return dealers.filter((d) => {
      if (pDomain && extractDomain(d.website) === pDomain) return true;
      if (pNorm && normalize(d.company_name) === pNorm) return true;
      return false;
    });
  }

  useEffect(() => {
    if (project?.score_weights) {
      setWeights(project.score_weights);
    }
  }, [project?.score_weights]);

  const filtered = prospects.filter((p) =>
    !searchText || p.name.toLowerCase().includes(searchText.toLowerCase())
  );

  const roundFiltered = activeRound === "all"
    ? filtered
    : filtered.filter((p) => (p.round || 1) === activeRound);

  function computeWeightedScore(breakdown: ScoreBreakdown | undefined, w: ScoreWeights): number {
    if (!breakdown) return 0;
    const dims = Object.keys(w) as (keyof ScoreWeights)[];
    const totalWeight = dims.reduce((sum, k) => sum + w[k], 0);
    if (totalWeight === 0) return 0;
    const weightedSum = dims.reduce((sum, k) => {
      const score = breakdown[k]?.score || 0;
      return sum + score * w[k];
    }, 0);
    return Math.round(weightedSum / totalWeight);
  }

  const sortedProspects = [...roundFiltered].sort((a, b) => {
    const scoreA = a.score_breakdown ? computeWeightedScore(a.score_breakdown, weights) : a.match_score;
    const scoreB = b.score_breakdown ? computeWeightedScore(b.score_breakdown, weights) : b.match_score;
    return scoreB - scoreA;
  });

  const stats = {
    total: prospects.length,
    high: prospects.filter((p) => p.priority === "high").length,
    accepted: prospects.filter((p) => p.feedback_status === "accepted").length,
    rejected: prospects.filter((p) => p.feedback_status === "rejected").length,
  };

  if (pq.isLoading || !project) return null;

  const tabItems = [
    {
      key: "my-profile",
      label: "내 회사/제품",
      children: (
        <div style={{ maxWidth: 800 }}>
          <Card size="small" title="회사 정보" style={{ marginBottom: 12 }}>
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <div>
                <Text strong style={{ fontSize: 12 }}>회사 홈페이지</Text>
                <Input defaultValue={project.company_url || ""}
                  onBlur={(e) => updateProject({ resource: "projects", id, values: { company_url: e.target.value } })}
                  placeholder="https://..." />
              </div>
              <div>
                <Text strong style={{ fontSize: 12 }}>회사 소개</Text>
                <Input.TextArea defaultValue={project.company_profile || ""}
                  onBlur={(e) => updateProject({ resource: "projects", id, values: { company_profile: e.target.value } })}
                  rows={3} placeholder="회사 규모, 설립연도, 강점 등" />
              </div>
              <div>
                <Text strong style={{ fontSize: 12 }}>제품 상세 설명</Text>
                <Input.TextArea defaultValue={project.product_profile || ""}
                  onBlur={(e) => updateProject({ resource: "projects", id, values: { product_profile: e.target.value } })}
                  rows={4} placeholder="제품 스펙, 기술 강점, 인증, 가격 경쟁력 등" />
              </div>
              {(project.attachment_urls?.length || 0) > 0 && (
                <div>
                  <Text strong style={{ fontSize: 12 }}>업로드된 자료</Text>
                  <div style={{ marginTop: 4 }}>
                    {(project.attachment_urls || []).map((url, i) => (
                      <Tag key={i} style={{ marginBottom: 4 }}>
                        <a href={url} target="_blank" rel="noopener">📎 자료 {i + 1}</a>
                      </Tag>
                    ))}
                  </div>
                </div>
              )}
            </Space>
          </Card>
          <Card size="small" title="🤖 AI 분석 결과 (수정 가능)" style={{ background: "#f6ffed", borderColor: "#b7eb8f" }}>
            <Paragraph type="secondary" style={{ fontSize: 11, marginBottom: 12 }}>
              AI가 회사 홈페이지와 업로드한 자료를 분석한 결과입니다. 맞지 않는 부분은 직접 수정하세요.
              수정한 내용은 잠재고객 매칭에 반영됩니다.
            </Paragraph>
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <div>
                <Text strong style={{ fontSize: 12 }}>회사 분석</Text>
                <Input.TextArea defaultValue={project.ai_company_analysis || ""}
                  onBlur={(e) => updateProject({ resource: "projects", id, values: { ai_company_analysis: e.target.value } })}
                  rows={4} placeholder="분석 중... (자료 업로드 후 AI가 자동 분석)" />
              </div>
              <div>
                <Text strong style={{ fontSize: 12 }}>제품 분석</Text>
                <Input.TextArea defaultValue={project.ai_product_analysis || ""}
                  onBlur={(e) => updateProject({ resource: "projects", id, values: { ai_product_analysis: e.target.value } })}
                  rows={4} placeholder="분석 중... (자료 업로드 후 AI가 자동 분석)" />
              </div>
            </Space>
          </Card>
        </div>
      ),
    },
    {
      key: "prospects",
      label: `바이어 리스트 (${prospects.length})`,
      children: (
        <div>
          {(project.refinement_round || 1) > 1 && (
            <Space style={{ marginBottom: 12 }}>
              <Button type={activeRound === "all" ? "primary" : "default"} size="small"
                onClick={() => setActiveRound("all")}>전체</Button>
              {Array.from({ length: project.refinement_round || 1 }, (_, i) => i + 1).map((r) => (
                <Button key={r} type={activeRound === r ? "primary" : "default"} size="small"
                  onClick={() => setActiveRound(r)}>{r}차 분석</Button>
              ))}
            </Space>
          )}
          <Card size="small" title="매칭 가중치 설정" style={{ marginBottom: 16 }}
            extra={<Text type="secondary" style={{ fontSize: 11 }}>가중치를 조절하면 리스트가 즉시 재정렬됩니다</Text>}>
            <ScoreWeightsEditor
              weights={weights}
              onChange={(newWeights) => {
                setWeights(newWeights);
                updateProject({
                  resource: "projects",
                  id,
                  values: { score_weights: newWeights },
                });
              }}
            />
          </Card>
          <Input placeholder="업체명 검색..." prefix={<SearchOutlined />} value={searchText}
            onChange={(e) => setSearchText(e.target.value)} style={{ width: 300, marginBottom: 16 }} allowClear />
          <Table dataSource={sortedProspects} rowKey="id" loading={prq.isLoading} size="middle"
            pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (t) => `총 ${t}개` }}
            onRow={(record) => {
              const brandCount = record.detected_products?.length || 0;
              const isExclusive = brandCount === 1;
              const isMultiBrand = brandCount >= 3;
              return {
                onClick: () => window.location.href = `/dashboard/project/${id}/prospect/${record.id}`,
                style: {
                  cursor: "pointer",
                  opacity: record.feedback_status === "rejected" ? 0.5 : 1,
                  background: isMultiBrand ? "#f6ffed" : isExclusive ? "#fafafa" : undefined,
                },
              };
            }}
            columns={(() => {
              // 동적 필터 옵션 추출
              const countryFilters = [...new Set(prospects.map(p => p.country).filter(Boolean))]
                .sort().map(v => ({ text: v!, value: v! }));
              const brandFilters = [...new Set(prospects.flatMap(p => p.detected_products || []))]
                .sort().map(v => ({ text: v, value: v }));
              const supplierFilters = [...new Set(prospects.flatMap(p => p.current_suppliers || []))]
                .sort().map(v => ({ text: v, value: v }));
              const priorityOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };

              return [
              {
                title: "업체명", dataIndex: "name", key: "name",
                sorter: (a: Prospect, b: Prospect) => a.name.localeCompare(b.name),
                render: (name: string, record: Prospect) => {
                  const matched = findDealerMatches(record);
                  return (
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {name}
                        {matched.length > 0 && matched.map((m) => (
                          <Tag key={m.id} color="purple" style={{ fontSize: 10, marginLeft: 4 }}>{m.brand} 딜러</Tag>
                        ))}
                      </div>
                      <Text type="secondary" style={{ fontSize: 12 }}>{record.url || ""}</Text>
                    </div>
                  );
                },
              },
              {
                title: "국가", dataIndex: "country", key: "country", width: 120,
                filters: countryFilters,
                onFilter: (value: unknown, record: Prospect) => record.country === value,
                sorter: (a: Prospect, b: Prospect) => (a.country || "").localeCompare(b.country || ""),
                render: (country: string) => country || <Text type="secondary">-</Text>,
              },
              {
                title: "점수", dataIndex: "match_score", key: "score", width: 80,
                sorter: (a: Prospect, b: Prospect) => (a.match_score || 0) - (b.match_score || 0),
                defaultSortOrder: "descend" as const,
                render: (_: number, record: Prospect) => {
                  const displayScore = record.score_breakdown
                    ? computeWeightedScore(record.score_breakdown, weights)
                    : record.match_score;
                  return <Tag color={displayScore >= 80 ? "green" : displayScore >= 50 ? "gold" : "default"} style={{ fontWeight: 700 }}>{displayScore}</Tag>;
                },
              },
              {
                title: "취급 브랜드", key: "brands", width: 180,
                filters: brandFilters,
                onFilter: (value: unknown, record: Prospect) => (record.detected_products || []).includes(String(value)),
                sorter: (a: Prospect, b: Prospect) => (a.detected_products?.length || 0) - (b.detected_products?.length || 0),
                render: (_: unknown, record: Prospect) => {
                  const brands = record.detected_products || [];
                  if (!brands.length) return <Text type="secondary">-</Text>;
                  const isMulti = brands.length >= 3;
                  const isExclusive = brands.length === 1;
                  return (
                    <div>
                      {isMulti && <Tag color="green" style={{ fontSize: 10, marginBottom: 2 }}>멀티브랜드</Tag>}
                      {isExclusive && <Tag color="default" style={{ fontSize: 10, marginBottom: 2 }}>단일브랜드</Tag>}
                      <div>
                        {brands.slice(0, 3).map(b => <Tag key={b} style={{ fontSize: 11, marginBottom: 2 }}>{b}</Tag>)}
                        {brands.length > 3 && <Tag style={{ fontSize: 11 }}>+{brands.length - 3}</Tag>}
                      </div>
                    </div>
                  );
                },
              },
              {
                title: "공급업체", key: "suppliers", width: 160,
                filters: supplierFilters,
                onFilter: (value: unknown, record: Prospect) => (record.current_suppliers || []).includes(String(value)),
                render: (_: unknown, record: Prospect) => {
                  const suppliers = record.current_suppliers || [];
                  if (!suppliers.length) return <Text type="secondary">-</Text>;
                  return <Text type="secondary" style={{ fontSize: 12 }}>{suppliers.slice(0, 3).join(", ")}{suppliers.length > 3 ? ` +${suppliers.length - 3}` : ""}</Text>;
                },
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
                sorter: (a: Prospect, b: Prospect) => (priorityOrder[a.priority] || 0) - (priorityOrder[b.priority] || 0),
                render: (p: string) => <Tag color={p === "high" ? "red" : p === "medium" ? "orange" : "default"}>{p?.toUpperCase()}</Tag>,
              },
              {
                title: "상태", dataIndex: "feedback_status", key: "status", width: 100,
                filters: [{ text: "대기", value: "pending" }, { text: "승인", value: "accepted" }, { text: "제외", value: "rejected" }, { text: "추가분석", value: "needs_more" }],
                onFilter: (value: unknown, record: Prospect) => (record.feedback_status || "pending") === value,
                render: (s: string) => s === "accepted" ? <Badge status="success" text="승인" /> : s === "rejected" ? <Badge status="error" text="제외" /> : s === "needs_more" ? <Badge status="warning" text="추가분석" /> : <Badge status="default" text="대기" />,
              },
            ];
            })()}
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
      key: "dealers",
      label: "제조사 딜러",
      children: <DealerCrawler />,
    },
    {
      key: "feedback",
      label: "피드백",
      children: (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <Card size="small" style={{ marginBottom: 16 }}>
              <RefinementConditionsForm
                conditions={project.refinement_conditions || []}
                onSubmit={(conditions) => {
                  updateProject({
                    resource: "projects",
                    id,
                    values: { refinement_conditions: conditions, status: "refining" },
                  });
                }}
              />
            </Card>
            <Card size="small">
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
          </div>
          <div>
            <Card size="small" style={{ marginBottom: 16 }}>
              {(() => {
                const patternFeedback = feedback
                  .filter(f => f.type === "pattern_analysis")
                  .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];

                let patternData = {
                  summary: stats.accepted >= 2
                    ? `${stats.accepted}개의 승인된 바이어에서 패턴을 분석할 수 있습니다.`
                    : `패턴 분석을 위해 최소 2개의 바이어를 승인해주세요. (현재 ${stats.accepted}개)`,
                  preferred_traits: [] as string[],
                  avoided_traits: [] as string[],
                  suggested_conditions: [] as string[],
                };

                if (patternFeedback) {
                  try {
                    const parsed = JSON.parse(patternFeedback.text);
                    patternData = {
                      summary: parsed.summary || patternData.summary,
                      preferred_traits: parsed.preferred_traits || [],
                      avoided_traits: parsed.avoided_traits || [],
                      suggested_conditions: parsed.suggested_conditions || [],
                    };
                  } catch {}
                }

                return (
                  <PatternInsightCard
                    patterns={patternData}
                    onAddCondition={(condition) => {
                      const current = project.refinement_conditions || [];
                      if (!current.includes(condition)) {
                        updateProject({
                          resource: "projects",
                          id,
                          values: { refinement_conditions: [...current, condition], status: "refining" },
                        });
                      }
                    }}
                  />
                );
              })()}
            </Card>
            <Card size="small" title="프로젝트 타임라인">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ padding: "8px 12px", background: "#f0f9ff", borderRadius: 8 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>프로젝트 생성</Text>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{project.created_at?.split("T")[0]}</div>
                </div>
                {feedback.filter((f) => !f.prospect_id).map((f, i) => (
                  <div key={i} style={{ padding: "8px 12px", background: "#fafafa", borderRadius: 8 }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>{f.timestamp?.replace("T", " ").split(".")[0]}</Text>
                    <div style={{ fontSize: 13, color: f.user_email?.includes("tradevoy") || f.user_email?.includes("system") ? "#f15f23" : undefined }}>
                      {f.text?.slice(0, 60)}{(f.text?.length || 0) > 60 ? "..." : ""}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
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
        <Tag color={
          project.status === "active" ? "green" :
          project.status === "analyzing" ? "blue" :
          project.status === "results_ready" ? "cyan" :
          project.status === "refining" ? "orange" :
          "default"
        }>
          {project.status === "active" ? "진행 중" :
           project.status === "analyzing" ? "분석 중" :
           project.status === "results_ready" ? "결과 검토" :
           project.status === "refining" ? "조건 수정 중" :
           "완료"}
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
