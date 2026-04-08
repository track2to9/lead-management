"use client";

import { useState } from "react";
import { useCreate, useGetIdentity } from "@refinedev/core";
import { useRouter } from "next/navigation";
import { Card, Button, Input, Typography, Steps, Space, Tag, Breadcrumb } from "antd";
import { HomeOutlined } from "@ant-design/icons";
import Link from "next/link";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const COUNTRIES = ["일본", "유럽 (EU)", "북미 (미국/캐나다)", "동남아시아", "중동", "중국", "중남미", "아프리카", "기타"];

export default function NewRequestPage() {
  const router = useRouter();
  const { data: identity } = useGetIdentity<{ id: string; email: string }>();
  const { mutate: createProject } = useCreate();
  const { mutate: createFeedback } = useCreate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    productName: "", productUrl: "", productDetail: "",
    targetCustomer: "", domesticClients: "",
    countries: [] as string[], countriesOther: "", additionalNotes: "",
  });

  function update(key: string, value: string | string[]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleCountry(c: string) {
    setForm((prev) => ({
      ...prev,
      countries: prev.countries.includes(c) ? prev.countries.filter((x) => x !== c) : [...prev.countries, c],
    }));
  }

  function canNext() {
    if (step === 0) return form.productName.trim().length > 0;
    if (step === 1) return form.targetCustomer.trim().length > 0;
    if (step === 2) return true;
    if (step === 3) return form.countries.length > 0;
    return true;
  }

  async function handleSubmit() {
    if (!identity?.id) return;
    setLoading(true);
    const countriesStr = form.countries.join(", ") + (form.countriesOther ? `, ${form.countriesOther}` : "");

    createProject(
      {
        resource: "projects",
        values: {
          user_id: identity.id,
          name: `${form.productName} - ${countriesStr}`,
          status: "active",
          client_name: identity.email,
          product: form.productName,
          countries: countriesStr,
          total_companies: 0, high_count: 0, medium_count: 0, emails_drafted: 0,
        },
      },
      {
        onSuccess: (data) => {
          const projectId = data?.data?.id;
          if (projectId) {
            createFeedback({
              resource: "feedback",
              values: {
                project_id: projectId,
                user_email: identity.email,
                type: "general",
                text: `📋 분석 요청 정보\n\n제품/서비스: ${form.productName}\n${form.productUrl ? `홈페이지: ${form.productUrl}\n` : ""}${form.productDetail ? `상세 설명: ${form.productDetail}\n` : ""}타겟 고객: ${form.targetCustomer}\n국내 거래처: ${form.domesticClients || "(없음)"}\n타겟 국가: ${countriesStr}\n${form.additionalNotes ? `추가 요청: ${form.additionalNotes}` : ""}`,
                timestamp: new Date().toISOString(),
              },
            });
          }
          router.push("/dashboard");
        },
        onError: () => setLoading(false),
      }
    );
  }

  const steps = [
    { title: "제품 정보" },
    { title: "타겟 고객" },
    { title: "국내 레퍼런스" },
    { title: "타겟 국가" },
    { title: "확인" },
  ];

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <Breadcrumb className="mb-4" items={[
        { title: <Link href="/dashboard"><HomeOutlined /> 대시보드</Link> },
        { title: "새 분석 요청" },
      ]} />

      <Title level={4}>새 분석 요청</Title>
      <Paragraph type="secondary" style={{ marginBottom: 24 }}>
        5단계로 제품과 타겟 정보를 입력하시면, AI가 맞춤 바이어를 찾아드립니다.
      </Paragraph>

      <Steps current={step} size="small" items={steps} style={{ marginBottom: 32 }} />

      <Card>
        {/* Step 0: 제품 */}
        {step === 0 && (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <div>
              <Text strong>제품/서비스 분야 <Text type="danger">*</Text></Text>
              <Input value={form.productName} onChange={(e) => update("productName", e.target.value)}
                placeholder="예: 굴삭기 어태치먼트, 5G 코어 솔루션" size="large" style={{ marginTop: 4 }} />
            </div>
            <div>
              <Text strong>홈페이지 <Text type="secondary" style={{ fontWeight: 400 }}>(AI가 분석)</Text></Text>
              <Input value={form.productUrl} onChange={(e) => update("productUrl", e.target.value)}
                placeholder="https://..." size="large" style={{ marginTop: 4 }} />
            </div>
            <div>
              <Text strong>상세 설명 <Text type="secondary" style={{ fontWeight: 400 }}>(선택)</Text></Text>
              <TextArea value={form.productDetail} onChange={(e) => update("productDetail", e.target.value)}
                placeholder="주력 제품, 기술 강점, 가격 경쟁력 등" rows={4} style={{ marginTop: 4 }} />
            </div>
          </Space>
        )}

        {/* Step 1: 타겟 고객 */}
        {step === 1 && (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <div>
              <Text strong>타겟 고객 업종/유형 <Text type="danger">*</Text></Text>
              <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 4, marginBottom: 8 }}>
                제품을 실제로 구매/도입하는 곳을 적어주세요. 같은 업종이 아닌 &quot;구매자&quot;를 찾기 위함입니다.
              </Paragraph>
              <TextArea value={form.targetCustomer} onChange={(e) => update("targetCustomer", e.target.value)}
                placeholder="예: 건설장비 딜러, 조선소, 통신사, 화장품 유통사..." rows={3} />
            </div>
            <Card size="small" style={{ background: "#fff7ed", border: "1px solid #fed7aa" }}>
              <Text style={{ fontSize: 12, color: "#f15f23" }} strong>💡 왜 이 질문이 중요한가요?</Text>
              <Paragraph style={{ fontSize: 12, margin: "4px 0 0" }}>
                &quot;5G 코어&quot;로 검색하면 경쟁사가 나옵니다. &quot;조선소, 스마트팩토리&quot;처럼 도입 기업을 알려주시면 정확한 구매자를 찾습니다.
              </Paragraph>
            </Card>
          </Space>
        )}

        {/* Step 2: 국내 레퍼런스 */}
        {step === 2 && (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <div>
              <Text strong>국내 거래처 <Text type="secondary" style={{ fontWeight: 400 }}>(업종명으로도 OK)</Text></Text>
              <Input value={form.domesticClients} onChange={(e) => update("domesticClients", e.target.value)}
                placeholder="예: 조선소, 통신사(KT), 자동차 부품사" size="large" style={{ marginTop: 4 }} />
            </div>
            <Button type="link" onClick={() => { update("domesticClients", "국내 납품 없음"); setStep(3); }}>
              국내 납품 없음 → 건너뛰기
            </Button>
          </Space>
        )}

        {/* Step 3: 타겟 국가 */}
        {step === 3 && (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <div>
              <Text strong>타겟 국가 <Text type="danger">*</Text></Text>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                {COUNTRIES.map((c) => (
                  <Tag key={c} onClick={() => toggleCountry(c)} style={{ cursor: "pointer", padding: "4px 12px", fontSize: 14 }}
                    color={form.countries.includes(c) ? "orange" : undefined}>
                    {c}
                  </Tag>
                ))}
              </div>
            </div>
            {form.countries.includes("기타") && (
              <div>
                <Text strong>기타 국가명</Text>
                <Input value={form.countriesOther} onChange={(e) => update("countriesOther", e.target.value)}
                  placeholder="예: 터키, 인도, 폴란드" style={{ marginTop: 4 }} />
              </div>
            )}
            <div>
              <Text strong>추가 요청 <Text type="secondary" style={{ fontWeight: 400 }}>(선택)</Text></Text>
              <TextArea value={form.additionalNotes} onChange={(e) => update("additionalNotes", e.target.value)}
                placeholder="특별히 원하는 조건, 제외할 업체 등" rows={3} style={{ marginTop: 4 }} />
            </div>
          </Space>
        )}

        {/* Step 4: 확인 */}
        {step === 4 && (
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <Card size="small" style={{ background: "#fafafa" }}>
              <Space direction="vertical" size={4}>
                <div><Text type="secondary" style={{ width: 100, display: "inline-block" }}>제품/서비스</Text> <Text strong>{form.productName}</Text></div>
                {form.productUrl && <div><Text type="secondary" style={{ width: 100, display: "inline-block" }}>홈페이지</Text> <Text style={{ color: "#f15f23" }}>{form.productUrl}</Text></div>}
                <div><Text type="secondary" style={{ width: 100, display: "inline-block" }}>타겟 고객</Text> <Text strong>{form.targetCustomer}</Text></div>
                <div><Text type="secondary" style={{ width: 100, display: "inline-block" }}>국내 거래처</Text> <Text>{form.domesticClients || "(미입력)"}</Text></div>
                <div><Text type="secondary" style={{ width: 100, display: "inline-block" }}>타겟 국가</Text> <Text strong style={{ color: "#f15f23" }}>{form.countries.join(", ")}{form.countriesOther ? `, ${form.countriesOther}` : ""}</Text></div>
              </Space>
            </Card>
            <Card size="small" style={{ background: "#fff7ed", border: "1px solid #fed7aa" }}>
              <Text style={{ fontSize: 12 }}>🔔 분석 요청이 접수되면 TradeVoy 팀이 48시간 내에 첫 결과를 업데이트합니다.</Text>
            </Card>
          </Space>
        )}

        {/* Nav */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
          {step > 0 ? <Button onClick={() => setStep(step - 1)}>← 이전</Button> : <div />}
          {step < 4 ? (
            <Button type="primary" onClick={() => setStep(step + 1)} disabled={!canNext()}>다음 →</Button>
          ) : (
            <Button type="primary" onClick={handleSubmit} loading={loading}>분석 요청하기</Button>
          )}
        </div>
      </Card>
    </div>
  );
}
