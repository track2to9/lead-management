"use client";

import { useOne, useList, useUpdate, useCreate, useGetIdentity } from "@refinedev/core";
import { useParams } from "next/navigation";
import { Card, Tag, Button, Input, Breadcrumb, Typography, Space, Descriptions, Tabs, Progress, Spin, Modal } from "antd";
import {
  HomeOutlined, CheckCircleOutlined, CloseCircleOutlined, SyncOutlined,
  LinkOutlined, GlobalOutlined, TeamOutlined, MailOutlined,
  BulbOutlined, CameraOutlined, FacebookOutlined, LinkedinOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import { useState } from "react";
import type { Project, Prospect, Feedback, Evidence, Exhibition, ScoreBreakdown, ManufacturerDealer } from "@/lib/types";
import { SCORE_DIMENSION_LABELS } from "@/lib/types";

const { Title, Text, Paragraph } = Typography;

// --- helpers ---

const SOURCE_LABELS: Record<string, string> = {
  website: "웹사이트", linkedin: "LinkedIn", facebook: "Facebook",
  instagram: "Instagram", x: "X (Twitter)", forum: "포럼", news: "뉴스",
};
const SOURCE_COLORS: Record<string, string> = {
  website: "#1890ff", linkedin: "#0077b5", facebook: "#1877f2",
  instagram: "#e1306c", x: "#000", forum: "#13c2c2", news: "#fa8c16",
};

function scoreColor(s: number) {
  return s >= 80 ? "#52c41a" : s >= 50 ? "#faad14" : "#ff4d4f";
}

// --- main ---

export default function ProspectDetailPage() {
  const { id, pid } = useParams<{ id: string; pid: string }>();
  const { data: identity } = useGetIdentity<{ id: string; email: string }>();
  const [reason, setReason] = useState("");
  const [screenshotModal, setScreenshotModal] = useState<Evidence | null>(null);

  const { query: pq } = useOne<Project>({ resource: "projects", id });
  const { query: prq } = useOne<Prospect>({ resource: "prospects", id: pid });
  const { query: fq } = useList<Feedback>({
    resource: "feedback",
    filters: [{ field: "prospect_id", operator: "eq", value: pid }],
    sorters: [{ field: "timestamp", order: "asc" }],
    pagination: { pageSize: 50 },
  });
  const { query: evq } = useList<Evidence>({
    resource: "evidence",
    filters: [{ field: "prospect_id", operator: "eq", value: pid }],
    sorters: [{ field: "collected_at", order: "desc" }],
    pagination: { pageSize: 50 },
  });
  const { query: exq } = useList<Exhibition>({
    resource: "exhibitions",
    filters: [{ field: "project_id", operator: "eq", value: id }],
    pagination: { pageSize: 20 },
  });
  const { query: dq } = useList<ManufacturerDealer>({
    resource: "manufacturer_dealers",
    pagination: { pageSize: 1000 },
  });

  const { mutate: updateProspect } = useUpdate();
  const { mutate: createFeedback } = useCreate();

  const project = pq.data?.data;
  const prospect = prq.data?.data;
  const feedback = fq.data?.data || [];
  const allEvidence = evq.data?.data || [];
  const exhibitions = exq.data?.data || [];
  const dealers = dq.data?.data || [];

  function extractDomain(url?: string): string {
    if (!url) return "";
    try { return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace("www.", ""); } catch { return ""; }
  }
  function normalize(name: string): string {
    return name.toLowerCase().replace(/\b(ltd|inc|co|corp|llc|gmbh|bv|sa|srl|pte|pty)\b\.?/gi, "").replace(/[^a-z0-9]/g, "").trim();
  }
  const matchedDealers = prospect ? dealers.filter((d) => {
    const pDomain = extractDomain(prospect.url);
    const pNorm = normalize(prospect.name);
    if (pDomain && extractDomain(d.website) === pDomain) return true;
    if (pNorm && normalize(d.company_name) === pNorm) return true;
    return false;
  }) : [];

  if (prq.isLoading || !prospect || !project) {
    return <div style={{ textAlign: "center", padding: 64 }}><Spin size="large" /></div>;
  }

  const score = prospect.match_score || 0;
  const status = prospect.feedback_status;

  // evidence by type
  const websiteEvidence = allEvidence.filter(e => e.source_type === "website");
  const snsEvidence = allEvidence.filter(e => ["linkedin", "facebook", "instagram", "x"].includes(e.source_type));
  const newsEvidence = allEvidence.filter(e => e.source_type === "news" || e.source_type === "forum");

  function handleAction(newStatus: string) {
    updateProspect({ resource: "prospects", id: pid, values: { feedback_status: newStatus } });
    if (reason.trim()) {
      createFeedback({
        resource: "feedback",
        values: {
          project_id: id, prospect_id: pid,
          user_email: identity?.email || "",
          type: newStatus === "accepted" ? "prospect_accept" : newStatus === "rejected" ? "prospect_reject" : "prospect_more",
          text: reason, timestamp: new Date().toISOString(),
        },
      }, { onSuccess: () => fq.refetch() });
    }
    setReason("");
  }

  // ========== TAB 1: 개요 ==========
  const tabOverview = (
    <div style={{ display: "flex", gap: 24 }}>
      <div style={{ flex: 2, display: "flex", flexDirection: "column", gap: 16 }}>
        <Card size="small">
          <Paragraph style={{ fontSize: 14, lineHeight: 1.8 }}>{prospect.summary || "정보 없음"}</Paragraph>
        </Card>

        {prospect.approach && (
          <div style={{ background: "#fff7ed", padding: 16, borderRadius: 8, borderLeft: "4px solid #f15f23" }}>
            <Text strong>🎯 접근 전략</Text>
            <Paragraph style={{ margin: "8px 0 0", lineHeight: 1.7 }}>{prospect.approach}</Paragraph>
          </div>
        )}

        {prospect.reasoning_chain && (
          <Card title="매칭 판단 근거" size="small">
            <Paragraph style={{ fontSize: 13, lineHeight: 1.7, color: "#555" }}>{prospect.reasoning_chain}</Paragraph>
          </Card>
        )}

        {/* Feedback */}
        <Card size="small" title="피드백">
          <Input.Search placeholder="피드백 (예: 이미 거래 중, 이런 업체를 더 찾아줘...)" enterButton="전송"
            value={reason} onChange={(e) => setReason(e.target.value)}
            onSearch={() => { if (reason.trim()) handleAction(status || "pending"); }}
            style={{ marginBottom: 12 }} />
          {feedback.map((f, i) => (
            <div key={i} style={{ fontSize: 12, background: "#fafafa", borderRadius: 6, padding: "6px 12px", marginBottom: 4 }}>
              <Text type="secondary">{f.timestamp?.split("T")[0]}</Text>{" · "}
              <Tag color={f.type === "prospect_accept" ? "success" : f.type === "prospect_reject" ? "error" : "warning"}>
                {f.type === "prospect_accept" ? "승인" : f.type === "prospect_reject" ? "제외" : "추가요청"}
              </Tag>
              {f.text && <Text>{f.text}</Text>}
            </div>
          ))}
        </Card>
      </div>

      {/* Right: Score breakdown */}
      <div style={{ width: 260, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 }}>
        <Card title="매칭 점수 분석" size="small">
          {prospect.score_breakdown ? (
            <Space direction="vertical" style={{ width: "100%" }} size={10}>
              {(Object.keys(SCORE_DIMENSION_LABELS) as (keyof ScoreBreakdown)[]).map((key) => {
                const dim = prospect.score_breakdown?.[key];
                if (!dim) return null;
                return (
                  <div key={key}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                      <Text style={{ fontSize: 12 }}>{SCORE_DIMENSION_LABELS[key]}</Text>
                      <Text strong style={{ fontSize: 12, color: scoreColor(dim.score) }}>{dim.score}</Text>
                    </div>
                    <Progress percent={dim.score} showInfo={false} strokeColor={scoreColor(dim.score)} size="small" />
                    {dim.reason && <Text type="secondary" style={{ fontSize: 11 }}>{dim.reason}</Text>}
                  </div>
                );
              })}
            </Space>
          ) : (
            <Text type="secondary">5차원 분석 데이터 없음</Text>
          )}
        </Card>

        {(() => {
          const brands = prospect.detected_products || [];
          const suppliers = prospect.current_suppliers || [];
          const isMulti = brands.length >= 3;
          const isExclusive = brands.length === 1;
          if (!brands.length && !suppliers.length) return null;
          return (
            <Card title="브랜드 분석" size="small">
              {brands.length > 0 && (
                <>
                  <div style={{ marginBottom: 8 }}>
                    {isMulti && <Tag color="green" style={{ fontWeight: 600 }}>멀티브랜드 딜러</Tag>}
                    {isExclusive && <Tag color="orange" style={{ fontWeight: 600 }}>단일브랜드 (Exclusive)</Tag>}
                    {brands.length === 2 && <Tag color="blue" style={{ fontWeight: 600 }}>{brands.length}개 브랜드</Tag>}
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>취급 브랜드 ({brands.length})</Text>
                  </div>
                  <Space wrap style={{ marginBottom: 12 }}>
                    {brands.map((b, i) => <Tag key={i} color="blue">{b}</Tag>)}
                  </Space>
                  {isMulti && (
                    <div style={{ background: "#f6ffed", padding: "6px 10px", borderRadius: 6, fontSize: 11, color: "#389e0d", marginBottom: 8 }}>
                      여러 브랜드를 취급하는 딜러로, 신규 브랜드 도입 가능성이 높습니다.
                    </div>
                  )}
                  {isExclusive && (
                    <div style={{ background: "#fff7e6", padding: "6px 10px", borderRadius: 6, fontSize: 11, color: "#d48806", marginBottom: 8 }}>
                      단일 브랜드 전용 딜러일 수 있습니다. 독점 계약 여부를 확인하세요.
                    </div>
                  )}
                </>
              )}
              {suppliers.length > 0 && (
                <>
                  <div style={{ marginBottom: 4 }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>현재 공급업체</Text>
                  </div>
                  <Space wrap>
                    {suppliers.map((s, i) => <Tag key={i}>{s}</Tag>)}
                  </Space>
                </>
              )}
            </Card>
          );
        })()}

        {prospect.match_reason && (
          <Card title="매칭 사유" size="small">
            <Paragraph style={{ fontSize: 13 }}>{prospect.match_reason}</Paragraph>
          </Card>
        )}

        {matchedDealers.length > 0 && (
          <Card title="딜러 네트워크 매칭" size="small">
            <div style={{ background: "#f9f0ff", padding: "6px 10px", borderRadius: 6, fontSize: 11, color: "#722ed1", marginBottom: 8 }}>
              {matchedDealers.length}개 제조사에서 공식 딜러로 등록됨
            </div>
            {matchedDealers.map((d) => (
              <div key={d.id} style={{ padding: "8px 0", borderBottom: "1px solid #f0f0f0", fontSize: 12 }}>
                <Tag color="purple" style={{ marginBottom: 4 }}>{d.brand}</Tag>
                <div style={{ fontWeight: 600 }}>{d.company_name}</div>
                {d.country && <div style={{ color: "#999", fontSize: 11 }}>{d.country}{d.city ? ` · ${d.city}` : ""}</div>}
                {d.phone && <div style={{ fontSize: 11 }}>📞 {d.phone}</div>}
                {d.email && <div style={{ fontSize: 11 }}>✉️ {d.email}</div>}
                {d.website && <div style={{ fontSize: 11 }}><a href={d.website.startsWith("http") ? d.website : `https://${d.website}`} target="_blank" rel="noopener">🔗 {d.website}</a></div>}
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );

  // ========== TAB 2: 홈페이지 분석 ==========
  const tabWebsite = (
    <div>
      {/* Screenshot + Site Info */}
      <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
        <div style={{ flex: 1, background: "#f5f5f5", borderRadius: 8, padding: 24, textAlign: "center", border: "1px solid #e0e0e0", position: "relative", minHeight: 160 }}>
          {websiteEvidence[0]?.screenshot_path ? (
            <img src={websiteEvidence[0].screenshot_path} alt="Homepage" style={{ maxWidth: "100%", borderRadius: 4, cursor: "pointer" }}
              onClick={() => setScreenshotModal(websiteEvidence[0])} />
          ) : (
            <>
              <GlobalOutlined style={{ fontSize: 48, color: "#ccc" }} />
              <div style={{ fontSize: 12, color: "#999", marginTop: 8 }}>홈페이지 스크린샷</div>
            </>
          )}
          {prospect.url && (
            <div style={{ position: "absolute", bottom: 8, left: 12, fontSize: 11, color: "#999" }}>
              <a href={prospect.url} target="_blank" rel="noopener">{prospect.url}</a>
            </div>
          )}
        </div>
        <div style={{ width: 220, flexShrink: 0 }}>
          <div style={{ fontSize: 12, color: "#999", marginBottom: 8, fontWeight: 600 }}>사이트 정보</div>
          <div style={{ fontSize: 12, marginBottom: 6 }}>🌐 <strong>{prospect.url || "URL 없음"}</strong></div>
          <div style={{ fontSize: 12, marginBottom: 6 }}>📍 {prospect.country || "미확인"}</div>
          {prospect.current_suppliers?.length > 0 && (
            <div style={{ fontSize: 12, marginBottom: 6 }}>🏭 {prospect.current_suppliers.join(", ")}</div>
          )}
          <div style={{ marginTop: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>
            {snsEvidence.map((e, i) => (
              <a key={i} href={e.source_url} target="_blank" rel="noopener"
                style={{ background: SOURCE_COLORS[e.source_type] || "#f0f0f0", color: "white", padding: "2px 8px", borderRadius: 4, fontSize: 10 }}>
                {SOURCE_LABELS[e.source_type]}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Evidence quotes — original + translation side by side */}
      {prospect.evidence_quotes?.length > 0 && (
        <>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>📌 핵심 발견 ({prospect.evidence_quotes.length}건)</div>
          {prospect.evidence_quotes.map((eq, i) => (
            <div key={i} style={{ marginBottom: 12, border: "1px solid #f0f0f0", borderRadius: 8, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                <div style={{ background: "#fafafa", padding: 12, borderRight: "1px solid #f0f0f0" }}>
                  <div style={{ fontSize: 10, color: "#999", fontWeight: 600, marginBottom: 4 }}>🌍 원문</div>
                  <div style={{ fontSize: 12, lineHeight: 1.5, fontStyle: "italic" }}>&ldquo;{eq.original}&rdquo;</div>
                </div>
                <div style={{ background: "#fff7ed", padding: 12 }}>
                  <div style={{ fontSize: 10, color: "#f15f23", fontWeight: 600, marginBottom: 4 }}>🇰🇷 한국어 번역</div>
                  <div style={{ fontSize: 12, lineHeight: 1.5, fontWeight: 500 }}>{eq.translated}</div>
                </div>
              </div>
              <div style={{ background: "#f0f9ff", padding: "8px 12px", fontSize: 11 }}>
                💡 <strong>매칭 관련성:</strong> {eq.relevance}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Website evidence text analysis */}
      {websiteEvidence.filter(e => e.text_translated).map((ev, i) => (
        <Card key={i} size="small" title="🤖 AI 홈페이지 분석" style={{ marginTop: 16 }}>
          <Paragraph style={{ fontSize: 13, lineHeight: 1.7 }}>{ev.text_translated}</Paragraph>
          {ev.source_url && (
            <a href={ev.source_url} target="_blank" rel="noopener" style={{ fontSize: 12 }}>
              <LinkOutlined /> 원본 페이지 보기
            </a>
          )}
        </Card>
      ))}

      {/* Detected products */}
      {prospect.detected_products?.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Text strong style={{ fontSize: 12 }}>🏷️ 발견된 제품/서비스</Text>
          <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap" }}>
            {prospect.detected_products.map((p, i) => (
              <Tag key={i} color="blue">{p}</Tag>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // ========== TAB 3: SNS 활동 ==========
  const snsTypes = [...new Set(snsEvidence.map(e => e.source_type))];
  const tabSNS = (
    <div>
      {/* Channel badges */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {snsTypes.length > 0 ? snsTypes.map(type => (
          <div key={type} style={{ background: SOURCE_COLORS[type], color: "white", padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
            {SOURCE_LABELS[type]} · {snsEvidence.filter(e => e.source_type === type).length}건
          </div>
        )) : (
          <Text type="secondary">발견된 SNS 채널이 없습니다. 파이프라인에서 홈페이지의 SNS 링크를 추출하여 수집합니다.</Text>
        )}
      </div>

      {/* Posts */}
      {snsEvidence.length > 0 && (
        <>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>📱 수집된 게시글</div>
          {snsEvidence.map((ev, i) => (
            <div key={i} style={{ border: "1px solid #f0f0f0", borderRadius: 8, padding: 12, marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 12 }}>
                {ev.screenshot_path && (
                  <div style={{ width: 100, height: 70, background: "#f5f5f5", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer", overflow: "hidden" }}
                    onClick={() => setScreenshotModal(ev)}>
                    <CameraOutlined style={{ fontSize: 20, color: "#999" }} />
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ background: SOURCE_COLORS[ev.source_type], color: "white", padding: "1px 8px", borderRadius: 3, fontSize: 10 }}>
                      {SOURCE_LABELS[ev.source_type]}
                    </span>
                    <span style={{ fontSize: 10, color: "#999" }}>{ev.content_date || ev.collected_at?.split("T")[0]}</span>
                  </div>
                  {ev.text_excerpt && (
                    <div style={{ fontSize: 11, color: "#666", fontStyle: "italic", marginBottom: 4 }}>
                      &ldquo;{ev.text_excerpt.slice(0, 150)}{ev.text_excerpt.length > 150 ? "..." : ""}&rdquo;
                    </div>
                  )}
                  {ev.text_translated && (
                    <div style={{ fontSize: 12, color: "#f15f23", fontWeight: 600 }}>
                      → {ev.text_translated}
                    </div>
                  )}
                  {ev.related_scores?.length > 0 && (
                    <div style={{ marginTop: 4, display: "flex", gap: 4 }}>
                      {ev.related_scores.map(s => (
                        <span key={s} style={{ background: "#fff2e8", padding: "2px 6px", borderRadius: 3, fontSize: 10, color: "#f15f23" }}>
                          {SCORE_DIMENSION_LABELS[s as keyof ScoreBreakdown] || s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );

  // ========== TAB 4: 뉴스 & 전시회 ==========
  const tabNewsExhibitions = (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      {/* News */}
      <div>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>📰 관련 뉴스</div>
        {newsEvidence.length > 0 ? newsEvidence.map((ev, i) => (
          <div key={i} style={{ border: "1px solid #f0f0f0", borderRadius: 6, padding: 10, marginBottom: 8 }}>
            {ev.text_excerpt && (
              <div style={{ fontSize: 12, fontWeight: 600 }}>{ev.text_excerpt.slice(0, 80)}</div>
            )}
            {ev.text_translated && (
              <div style={{ fontSize: 12, color: "#f15f23", marginTop: 2 }}>→ {ev.text_translated}</div>
            )}
            <div style={{ fontSize: 10, color: "#999", marginTop: 4 }}>
              {ev.content_date || ev.collected_at?.split("T")[0]}
              {ev.source_url && (
                <a href={ev.source_url} target="_blank" rel="noopener" style={{ marginLeft: 8 }}>🔗 원본 보기</a>
              )}
            </div>
          </div>
        )) : (
          <Card size="small"><Text type="secondary">수집된 뉴스가 없습니다. 파이프라인 재실행 시 관련 뉴스를 수집합니다.</Text></Card>
        )}
      </div>

      {/* Exhibitions */}
      <div>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>🎪 관련 전시회</div>
        {exhibitions.length > 0 ? exhibitions.map((ex) => (
          <div key={ex.id} style={{ border: "1px solid #f0f0f0", borderRadius: 6, padding: 10, marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>{ex.name}</div>
            <div style={{ fontSize: 11, color: "#999" }}>📍 {ex.location} · {ex.typical_month}</div>
            {ex.relevance && <div style={{ fontSize: 11, marginTop: 4 }}>{ex.relevance}</div>}
            {ex.action_suggestion && (
              <div style={{ fontSize: 11, color: "#52c41a", marginTop: 4 }}>💡 {ex.action_suggestion}</div>
            )}
            {ex.website && (
              <a href={ex.website} target="_blank" rel="noopener" style={{ fontSize: 10, marginTop: 2, display: "block" }}>
                🔗 웹사이트
              </a>
            )}
          </div>
        )) : (
          <Card size="small"><Text type="secondary">관련 전시회 정보가 없습니다.</Text></Card>
        )}
      </div>
    </div>
  );

  // ========== TAB 5: 연락 전략 ==========
  const tabContact = (
    <div>
      {/* Email draft */}
      {prospect.email_subject ? (
        <Card title="✉️ 이메일 초안" size="small" style={{ marginBottom: 16 }}>
          <div style={{ background: "#fafafa", borderRadius: 8, padding: 16, border: "1px solid #eee" }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Subject: {prospect.email_subject}</div>
            <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13, color: "#555", lineHeight: 1.7 }}>
              {prospect.email_body}
            </pre>
          </div>
        </Card>
      ) : (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Text type="secondary">이메일 초안이 아직 생성되지 않았습니다. (매칭 점수 30점 이상 시 자동 생성)</Text>
        </Card>
      )}

      {/* Followup sequence */}
      {prospect.followup_sequence?.length > 0 && (
        <>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>📬 팔로업 시퀀스</div>
          <div style={{ display: "flex", gap: 12 }}>
            {prospect.followup_sequence.map((fu) => {
              const color = fu.day <= 3 ? "#52c41a" : fu.day <= 7 ? "#1890ff" : "#999";
              return (
                <div key={fu.day} style={{ flex: 1, background: "#fafafa", padding: 14, borderRadius: 8, borderTop: `3px solid ${color}` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color }}>Day {fu.day}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, margin: "6px 0" }}>{fu.subject}</div>
                  <Paragraph type="secondary" style={{ fontSize: 12, margin: 0 }} ellipsis={{ rows: 4 }}>
                    {fu.body}
                  </Paragraph>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );

  // ========== TAB 6: 바이어 인텔리전스 ==========
  const tabIntelligence = (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <Card size="small">
          <div style={{ fontSize: 11, color: "#999", fontWeight: 600 }}>현재 공급업체</div>
          <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap" }}>
            {prospect.current_suppliers?.length
              ? prospect.current_suppliers.map((s, i) => <Tag key={i}>{s}</Tag>)
              : <Text type="secondary">미확인</Text>}
          </div>
        </Card>
        <Card size="small">
          <div style={{ fontSize: 11, color: "#999", fontWeight: 600 }}>회사 규모</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 6 }}>{prospect.company_size || "미확인"}</div>
        </Card>
        <Card size="small">
          <div style={{ fontSize: 11, color: "#999", fontWeight: 600 }}>의사결정권자</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 6 }}>{prospect.decision_maker || "미확인"}</div>
        </Card>
        <Card size="small">
          <div style={{ fontSize: 11, color: "#999", fontWeight: 600 }}>최적 접근 타이밍</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 6 }}>{prospect.best_timing || "미확인"}</div>
        </Card>
      </div>

      {prospect.competitive_landscape && (
        <Card size="small" title="경쟁 환경 분석">
          <Paragraph style={{ fontSize: 13, lineHeight: 1.7 }}>{prospect.competitive_landscape}</Paragraph>
        </Card>
      )}
    </div>
  );

  // ========== RENDER ==========
  const tabItems = [
    { key: "overview", label: "개요", children: tabOverview },
    { key: "website", label: <><GlobalOutlined /> 홈페이지</>, children: tabWebsite },
    { key: "sns", label: <><TeamOutlined /> SNS{snsEvidence.length > 0 ? ` (${snsEvidence.length})` : ""}</>, children: tabSNS },
    { key: "news", label: <>📰 뉴스 & 전시회</>, children: tabNewsExhibitions },
    { key: "contact", label: <><MailOutlined /> 연락 전략</>, children: tabContact },
    { key: "intelligence", label: <><BulbOutlined /> 인텔리전스</>, children: tabIntelligence },
  ];

  return (
    <div>
      <Breadcrumb className="mb-4" items={[
        { title: <Link href="/dashboard"><HomeOutlined /> 대시보드</Link> },
        { title: <Link href={`/dashboard/project/${id}`}>{project.name}</Link> },
        { title: prospect.name },
      ]} />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <Space align="center" style={{ marginBottom: 4 }}>
            <Title level={4} style={{ margin: 0 }}>{prospect.name}</Title>
            <Tag color={score >= 80 ? "green" : score >= 50 ? "gold" : "default"}
              style={{ fontSize: 16, fontWeight: 800, padding: "2px 12px" }}>{score}점</Tag>
            {prospect.buyer_or_competitor === "buyer" && <Tag color="success">구매자</Tag>}
            {prospect.buyer_or_competitor === "competitor" && <Tag color="error">경쟁사</Tag>}
            <Tag>{prospect.priority?.toUpperCase()}</Tag>
            {status === "accepted" && <Tag icon={<CheckCircleOutlined />} color="success">승인</Tag>}
            {status === "rejected" && <Tag icon={<CloseCircleOutlined />} color="error">제외</Tag>}
            {status === "needs_more" && <Tag icon={<SyncOutlined />} color="warning">추가분석</Tag>}
          </Space>
          {prospect.url && (
            <div>
              <a href={prospect.url} target="_blank" rel="noopener">
                <Text type="secondary"><LinkOutlined /> {prospect.url}</Text>
              </a>
            </div>
          )}
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

      {/* 6 Tabs */}
      <Tabs items={tabItems} size="large" />

      {/* Screenshot Modal */}
      <Modal open={!!screenshotModal} onCancel={() => setScreenshotModal(null)} footer={null} width={900}
        title={<Space><span>스크린샷</span><Tag>{screenshotModal?.source_type}</Tag></Space>}>
        {screenshotModal?.screenshot_path && (
          <img src={screenshotModal.screenshot_path} alt="Screenshot" style={{ maxWidth: "100%", borderRadius: 8 }} />
        )}
        {screenshotModal?.text_excerpt && (
          <div style={{ marginTop: 16, background: "#fafafa", padding: 12, borderRadius: 6, fontSize: 12, maxHeight: 200, overflow: "auto" }}>
            {screenshotModal.text_excerpt}
          </div>
        )}
        {screenshotModal?.text_translated && (
          <div style={{ marginTop: 12 }}>
            <Text strong style={{ fontSize: 12 }}>한국어 번역</Text>
            <Paragraph style={{ fontSize: 13, marginTop: 4 }}>{screenshotModal.text_translated}</Paragraph>
          </div>
        )}
        {screenshotModal?.source_url && (
          <a href={screenshotModal.source_url} target="_blank" rel="noopener" style={{ display: "block", marginTop: 8 }}>
            원본 링크 열기 →
          </a>
        )}
      </Modal>
    </div>
  );
}
