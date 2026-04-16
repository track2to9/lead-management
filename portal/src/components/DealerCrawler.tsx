"use client";

import { useState } from "react";
import { useList } from "@refinedev/core";
import { Card, Input, Button, Select, Space, Typography, Tag, Alert, Progress, Table, Popconfirm, message } from "antd";
import { PlusOutlined, DeleteOutlined, LoadingOutlined, CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";
import { supabaseClient } from "@/lib/supabase-client";
import type { ManufacturerDealer } from "@/lib/types";

const { Text, Paragraph } = Typography;

const PRESET_MANUFACTURERS = [
  // Attachments
  { brand: "NPK", category: "attachment", url: "https://www.npke.eu/dealers/" },
  { brand: "Rammer", category: "attachment", url: "https://www.rammer.com/en/contact-us/contact-map/" },
  { brand: "Xcentric", category: "attachment", url: "https://xcentricripper.com/dealers-worldwide/" },
  { brand: "SOOSAN", category: "attachment", url: "https://soosancebotics.com/ko/main" },
  { brand: "EVERDIGM", category: "attachment", url: "https://www.hyundaieverdigm.com" },
  { brand: "DAEMO", category: "attachment", url: "https://www.daemo.co.kr/prd/prd01" },
  { brand: "MSB", category: "attachment", url: "https://www.msb.co.kr/" },
  { brand: "DNA", category: "attachment", url: "https://www.dnabreaker.com/en" },
  { brand: "FURUKAWA", category: "attachment", url: "https://www.frd.eu/en/products/hydraulic-breakers/" },
  // Excavators
  { brand: "KATO", category: "excavator", url: "https://www.kato-works.co.jp/eng/global/index.html" },
  { brand: "KOBELCO", category: "excavator", url: "https://www.kobelcocm-global.com/worldwide/" },
  { brand: "Komatsu", category: "excavator", url: "https://www.komatsu.com/en-us/region" },
  { brand: "Sumitomo", category: "excavator", url: "https://www.sumitomokenki.com/global_network/" },
  { brand: "Hitachi", category: "excavator", url: "https://www.hitachicm.com/global/en/global-network/" },
  { brand: "Mecalac", category: "excavator", url: "https://mecalac.com/en/the-mecalac-distribution.html" },
  { brand: "CAT", category: "excavator", url: "https://www.cat.com/en_US/language-selector.html" },
  { brand: "CASE", category: "excavator", url: "https://www.casece.com/splash" },
  { brand: "JCB", category: "excavator", url: "https://www.jcb.com/" },
  { brand: "New Holland", category: "excavator", url: "https://www.newholland.com/splash" },
  { brand: "SANY", category: "excavator", url: "https://www.sanyglobal.com/network/" },
  { brand: "VOLVO", category: "excavator", url: "https://www.volvoce.com/" },
  { brand: "DEVELON", category: "excavator", url: "https://global.develon-ce.com/" },
  { brand: "HYUNDAI", category: "excavator", url: "https://www.hyundai-ce.com/en/agency/overseas" },
];

interface LogLine {
  type: "status" | "dealer" | "done" | "error";
  message: string;
  timestamp: number;
}

export default function DealerCrawler() {
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState<"attachment" | "excavator">("excavator");
  const [url, setUrl] = useState("");
  const [crawling, setCrawling] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [foundDealers, setFoundDealers] = useState<ManufacturerDealer[]>([]);
  const [progress, setProgress] = useState(0);

  const { query: dq } = useList<ManufacturerDealer>({
    resource: "manufacturer_dealers",
    pagination: { pageSize: 500 },
    sorters: [{ field: "crawled_at", order: "desc" }],
  });
  const dealers = dq.data?.data || [];

  function selectPreset(preset: typeof PRESET_MANUFACTURERS[number]) {
    setBrand(preset.brand);
    setCategory(preset.category as "attachment" | "excavator");
    setUrl(preset.url);
  }

  function addLog(type: LogLine["type"], message: string) {
    setLogs((prev) => [...prev, { type, message, timestamp: Date.now() }]);
  }

  async function startCrawl() {
    if (!brand || !url) {
      message.warning("브랜드명과 URL을 입력해주세요");
      return;
    }

    setCrawling(true);
    setLogs([]);
    setFoundDealers([]);
    setProgress(0);

    try {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { message.error("로그인 세션이 없습니다"); setCrawling(false); return; }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/crawl-dealers`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ brand, category, url }),
      });

      if (!response.ok || !response.body) {
        addLog("error", `요청 실패: ${response.status} ${await response.text()}`);
        setCrawling(false);
        return;
      }

      // Parse SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let expectedTotal = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE parsing: events separated by "\n\n", "event: X\ndata: {...}"
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const lines = part.split("\n");
          let eventName = "";
          let data = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) eventName = line.slice(7);
            else if (line.startsWith("data: ")) data = line.slice(6);
          }
          if (!eventName || !data) continue;

          try {
            const parsed = JSON.parse(data);
            if (eventName === "status") {
              addLog("status", parsed.message);
              if (parsed.count) expectedTotal = parsed.count;
            } else if (eventName === "dealer") {
              setFoundDealers((prev) => {
                const next = [...prev, parsed as ManufacturerDealer];
                if (expectedTotal > 0) setProgress(Math.round((next.length / expectedTotal) * 100));
                return next;
              });
              addLog("dealer", `✓ ${parsed.company_name}${parsed.country ? ` (${parsed.country})` : ""}`);
            } else if (eventName === "done") {
              addLog("done", `완료: ${parsed.count}개 저장됨 (발견 ${parsed.total}개 중)`);
              setProgress(100);
              void dq.refetch();
            } else if (eventName === "error") {
              addLog("error", `오류: ${parsed.message}`);
            }
          } catch (e) {
            console.error("SSE parse error", e);
          }
        }
      }
    } catch (e: any) {
      addLog("error", `예외: ${e?.message || "알 수 없는 오류"}`);
    } finally {
      setCrawling(false);
    }
  }

  async function handleDelete(id: string) {
    const { error } = await supabaseClient.from("manufacturer_dealers").delete().eq("id", id);
    if (error) { message.error(error.message); return; }
    message.success("삭제됨");
    void dq.refetch();
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      {/* 좌측: 입력 + 진행 로그 */}
      <div>
        <Card size="small" title="제조사 딜러 크롤링">
          <Paragraph type="secondary" style={{ fontSize: 12 }}>
            제조사 공식 딜러 페이지 URL을 입력하면 Firecrawl + AI가 딜러 정보를 자동 추출합니다.
          </Paragraph>

          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <div>
              <Text strong style={{ fontSize: 12 }}>프리셋 (클릭해서 채우기)</Text>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4, maxHeight: 120, overflow: "auto" }}>
                {PRESET_MANUFACTURERS.map((p) => (
                  <Tag key={p.brand} color={p.category === "attachment" ? "orange" : "blue"}
                    style={{ cursor: "pointer", margin: 2 }} onClick={() => selectPreset(p)}>
                    {p.brand}
                  </Tag>
                ))}
              </div>
            </div>
            <div>
              <Text strong style={{ fontSize: 12 }}>브랜드</Text>
              <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="예: Rammer" />
            </div>
            <div>
              <Text strong style={{ fontSize: 12 }}>카테고리</Text>
              <Select value={category} onChange={setCategory} style={{ width: "100%" }}
                options={[{ value: "attachment", label: "어태치먼트" }, { value: "excavator", label: "굴삭기" }]} />
            </div>
            <div>
              <Text strong style={{ fontSize: 12 }}>딜러 페이지 URL</Text>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
            </div>
            <Button type="primary" icon={crawling ? <LoadingOutlined /> : <PlusOutlined />}
              onClick={startCrawl} loading={crawling} disabled={!brand || !url} block>
              {crawling ? "크롤링 중..." : "크롤링 시작"}
            </Button>
          </Space>
        </Card>

        {logs.length > 0 && (
          <Card size="small" title="진행 로그" style={{ marginTop: 12 }}>
            {progress > 0 && progress < 100 && (
              <Progress percent={progress} size="small" style={{ marginBottom: 8 }} />
            )}
            <div style={{ maxHeight: 300, overflow: "auto", fontFamily: "monospace", fontSize: 11, lineHeight: 1.6 }}>
              {logs.map((log, i) => (
                <div key={i} style={{
                  color: log.type === "error" ? "#ff4d4f" :
                         log.type === "done" ? "#52c41a" :
                         log.type === "dealer" ? "#1890ff" : "#666",
                }}>
                  {log.type === "error" ? <CloseCircleOutlined /> :
                   log.type === "done" ? <CheckCircleOutlined /> : null}
                  {" "}{log.message}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* 우측: 수집된 딜러 */}
      <div>
        <Card size="small" title={`수집된 딜러 (${dealers.length})`}>
          {crawling && foundDealers.length > 0 && (
            <Alert type="info" message={`이번 크롤링에서 ${foundDealers.length}개 발견`} style={{ marginBottom: 8 }} />
          )}
          <Table
            dataSource={dealers}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 15 }}
            columns={[
              {
                title: "브랜드", dataIndex: "brand", key: "brand", width: 100,
                filters: [...new Set(dealers.map((d) => d.brand))].map((b) => ({ text: b, value: b })),
                onFilter: (v, r) => r.brand === v,
                render: (b: string) => <Tag color="purple">{b}</Tag>,
              },
              {
                title: "회사", dataIndex: "company_name", key: "name",
                sorter: (a, b) => a.company_name.localeCompare(b.company_name),
              },
              {
                title: "국가", dataIndex: "country", key: "country", width: 100,
                filters: [...new Set(dealers.map((d) => d.country).filter(Boolean))].map((c) => ({ text: c!, value: c! })),
                onFilter: (v, r) => r.country === v,
              },
              {
                title: "연락처", key: "contact", width: 160,
                render: (_, r) => (
                  <div style={{ fontSize: 11 }}>
                    {r.phone && <div>📞 {r.phone}</div>}
                    {r.email && <div>✉️ {r.email}</div>}
                    {r.website && <div><a href={r.website.startsWith("http") ? r.website : `https://${r.website}`} target="_blank" rel="noopener">🔗</a></div>}
                  </div>
                ),
              },
              {
                title: "", key: "actions", width: 40,
                render: (_, r) => (
                  <Popconfirm title="삭제?" onConfirm={() => handleDelete(r.id)} okText="삭제" cancelText="취소" okButtonProps={{ danger: true }}>
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                ),
              },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
