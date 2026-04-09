"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const STEPS = [
  { id: 1, title: "제품/서비스 정보", desc: "어떤 제품을 해외에 판매하고 싶으신가요?" },
  { id: 2, title: "타겟 고객", desc: "이 제품을 누가 구매하나요?" },
  { id: 3, title: "국내 레퍼런스", desc: "한국에서는 어디에 납품하고 있나요?" },
  { id: 4, title: "타겟 국가", desc: "어떤 나라에서 바이어를 찾고 싶으신가요?" },
  { id: 5, title: "확인 및 요청", desc: "입력 내용을 확인하고 분석을 요청합니다" },
];

const COUNTRIES = [
  "일본", "유럽 (EU)", "북미 (미국/캐나다)", "동남아시아",
  "중동", "중국", "중남미", "아프리카", "기타",
];

export default function NewRequestPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    productName: "",
    productUrl: "",
    productDetail: "",
    targetCustomer: "",
    domesticClients: "",
    countries: [] as string[],
    countriesOther: "",
    additionalNotes: "",
  });

  function update(key: string, value: string | string[]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleCountry(c: string) {
    setForm((prev) => ({
      ...prev,
      countries: prev.countries.includes(c)
        ? prev.countries.filter((x) => x !== c)
        : [...prev.countries, c],
    }));
  }

  function canNext() {
    if (step === 1) return form.productName.trim().length > 0;
    if (step === 2) return form.targetCustomer.trim().length > 0;
    if (step === 3) return true; // optional
    if (step === 4) return form.countries.length > 0;
    return true;
  }

  async function handleSubmit() {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const countriesStr = form.countries.join(", ") + (form.countriesOther ? `, ${form.countriesOther}` : "");

    const { error } = await supabase.from("projects").insert({
      user_id: user.id,
      name: `${form.productName} - ${countriesStr}`,
      status: "active",
      client_name: user.email,
      product: form.productName,
      countries: countriesStr,
      total_companies: 0,
      high_count: 0,
      medium_count: 0,
      emails_drafted: 0,
    });

    // 프로젝트 피드백에 상세 정보 기록
    if (!error) {
      const { data: project } = await supabase
        .from("projects")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (project) {
        await supabase.from("feedback").insert({
          project_id: project.id,
          user_email: user.email,
          type: "general",
          text: [
            `📋 분석 요청 정보`,
            ``,
            `제품/서비스: ${form.productName}`,
            form.productUrl ? `홈페이지: ${form.productUrl}` : "",
            form.productDetail ? `상세 설명: ${form.productDetail}` : "",
            `타겟 고객: ${form.targetCustomer}`,
            form.domesticClients ? `국내 거래처: ${form.domesticClients}` : "국내 거래처: (없음/미입력)",
            `타겟 국가: ${countriesStr}`,
            form.additionalNotes ? `추가 요청: ${form.additionalNotes}` : "",
          ].filter(Boolean).join("\n"),
          timestamp: new Date().toISOString(),
        });
      }
    }

    setLoading(false);

    if (error) {
      alert("요청 실패: " + error.message);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <a href="/dashboard" className="text-sm text-zinc-500 hover:text-[#f15f23] mb-4 inline-block">
        ← 대시보드
      </a>
      <h1 className="text-2xl font-extrabold mb-2">새 분석 요청</h1>
      <p className="text-sm text-zinc-500 mb-8">
        5단계로 제품과 타겟 정보를 입력하시면, AI가 맞춤 바이어를 찾아드립니다.
      </p>

      {/* Progress */}
      <div className="flex items-center gap-1 mb-8">
        {STEPS.map((s) => (
          <div key={s.id} className="flex-1 flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-1 transition ${
                s.id < step
                  ? "bg-[#f15f23] text-white"
                  : s.id === step
                  ? "bg-[#f15f23] text-white ring-4 ring-orange-100"
                  : "bg-zinc-100 text-zinc-400"
              }`}
            >
              {s.id < step ? "✓" : s.id}
            </div>
            <span className={`text-[10px] ${s.id === step ? "text-[#f15f23] font-bold" : "text-zinc-400"}`}>
              {s.title}
            </span>
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          <h2 className="text-lg font-bold mb-1">{STEPS[step - 1].title}</h2>
          <p className="text-sm text-zinc-500 mb-6">{STEPS[step - 1].desc}</p>

          {/* Step 1: 제품 정보 */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label>제품/서비스 분야 <span className="text-[#f15f23]">*</span></Label>
                <Input
                  value={form.productName}
                  onChange={(e) => update("productName", e.target.value)}
                  placeholder="예: 굴삭기 어태치먼트, 5G 코어 네트워크, 화장품 OEM"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>홈페이지 주소 <span className="text-zinc-400 text-xs font-normal">(있으면 AI가 분석합니다)</span></Label>
                <Input
                  value={form.productUrl}
                  onChange={(e) => update("productUrl", e.target.value)}
                  placeholder="https://www.example.com"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>제품 상세 설명 <span className="text-zinc-400 text-xs font-normal">(선택)</span></Label>
                <Textarea
                  value={form.productDetail}
                  onChange={(e) => update("productDetail", e.target.value)}
                  placeholder="주력 제품 라인업, 기술 강점, 가격 경쟁력 등을 자유롭게 적어주세요."
                  rows={4}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          {/* Step 2: 타겟 고객 */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <Label>타겟 고객 업종/유형 <span className="text-[#f15f23]">*</span></Label>
                <p className="text-xs text-zinc-400 mt-1 mb-2">
                  이 제품을 실제로 구매/도입하는 곳을 적어주세요. 같은 업종이 아닌, 실제 &quot;구매자&quot;를 찾기 위함입니다.
                </p>
                <Textarea
                  value={form.targetCustomer}
                  onChange={(e) => update("targetCustomer", e.target.value)}
                  placeholder="예: 건설장비 딜러, 조선소, 통신사, 스마트팩토리 구축 SI, 화장품 유통사, 병원/의료기관 등"
                  rows={3}
                  className="mt-1"
                />
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-xs text-[#f15f23] font-semibold mb-1">💡 왜 이 질문이 중요한가요?</p>
                <p className="text-xs text-zinc-600">
                  &quot;5G 코어 네트워크&quot;로 검색하면 같은 제품을 만드는 경쟁사가 나옵니다.
                  &quot;조선소, 스마트팩토리&quot;처럼 실제 도입 기업을 알려주시면 정확한 구매자를 찾을 수 있습니다.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: 국내 레퍼런스 */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <Label>국내 거래처/납품처 <span className="text-zinc-400 text-xs font-normal">(선택)</span></Label>
                <p className="text-xs text-zinc-400 mt-1 mb-2">
                  정확한 회사명이 아니어도 됩니다. &quot;조선소&quot;, &quot;통신사&quot;, &quot;자동차 부품사&quot; 등 업종 수준으로 적어도 충분합니다.
                </p>
                <Input
                  value={form.domesticClients}
                  onChange={(e) => update("domesticClients", e.target.value)}
                  placeholder="예: 조선소, 통신사(KT), 자동차 부품 유통사"
                  className="mt-1"
                />
              </div>
              <button
                onClick={() => {
                  update("domesticClients", "국내 납품 없음");
                  setStep(4);
                }}
                className="text-sm text-zinc-400 hover:text-zinc-600 underline"
              >
                국내 납품 이력이 없습니다 → 건너뛰기
              </button>
            </div>
          )}

          {/* Step 4: 타겟 국가 */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <Label>타겟 국가 <span className="text-[#f15f23]">*</span> <span className="text-zinc-400 text-xs font-normal">(복수 선택 가능)</span></Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {COUNTRIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => toggleCountry(c)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${
                        form.countries.includes(c)
                          ? "border-[#f15f23] bg-orange-50 text-[#f15f23]"
                          : "border-zinc-200 text-zinc-600 hover:border-zinc-400"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              {form.countries.includes("기타") && (
                <div>
                  <Label>기타 국가명</Label>
                  <Input
                    value={form.countriesOther}
                    onChange={(e) => update("countriesOther", e.target.value)}
                    placeholder="예: 터키, 인도, 폴란드"
                    className="mt-1"
                  />
                </div>
              )}
              <div>
                <Label>추가 요청사항 <span className="text-zinc-400 text-xs font-normal">(선택)</span></Label>
                <Textarea
                  value={form.additionalNotes}
                  onChange={(e) => update("additionalNotes", e.target.value)}
                  placeholder="특별히 원하는 바이어 조건, 제외할 업체, 참고 사항 등"
                  rows={3}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          {/* Step 5: 확인 */}
          {step === 5 && (
            <div className="space-y-3">
              <div className="bg-zinc-50 rounded-lg p-4 space-y-2">
                <div className="flex gap-2">
                  <span className="text-xs font-bold text-zinc-400 w-24 flex-shrink-0">제품/서비스</span>
                  <span className="text-sm font-medium">{form.productName}</span>
                </div>
                {form.productUrl && (
                  <div className="flex gap-2">
                    <span className="text-xs font-bold text-zinc-400 w-24 flex-shrink-0">홈페이지</span>
                    <span className="text-sm text-[#f15f23]">{form.productUrl}</span>
                  </div>
                )}
                {form.productDetail && (
                  <div className="flex gap-2">
                    <span className="text-xs font-bold text-zinc-400 w-24 flex-shrink-0">상세 설명</span>
                    <span className="text-sm">{form.productDetail}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <span className="text-xs font-bold text-zinc-400 w-24 flex-shrink-0">타겟 고객</span>
                  <span className="text-sm font-medium">{form.targetCustomer}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-xs font-bold text-zinc-400 w-24 flex-shrink-0">국내 거래처</span>
                  <span className="text-sm">{form.domesticClients || "(미입력)"}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-xs font-bold text-zinc-400 w-24 flex-shrink-0">타겟 국가</span>
                  <span className="text-sm font-medium text-[#f15f23]">
                    {form.countries.join(", ")}{form.countriesOther ? `, ${form.countriesOther}` : ""}
                  </span>
                </div>
                {form.additionalNotes && (
                  <div className="flex gap-2">
                    <span className="text-xs font-bold text-zinc-400 w-24 flex-shrink-0">추가 요청</span>
                    <span className="text-sm">{form.additionalNotes}</span>
                  </div>
                )}
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-xs text-zinc-600">
                  🔔 분석 요청이 접수되면 TradeVoy 팀이 확인 후 48시간 내에 첫 결과를 업데이트합니다.
                  진행 상황은 이 대시보드에서 실시간으로 확인할 수 있습니다.
                </p>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8">
            {step > 1 ? (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                ← 이전
              </Button>
            ) : (
              <div />
            )}
            {step < 5 ? (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={!canNext()}
                className="bg-[#f15f23] hover:bg-[#ff7a45] text-white"
              >
                다음 →
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="bg-[#f15f23] hover:bg-[#ff7a45] text-white px-8"
              >
                {loading ? "요청 중..." : "분석 요청하기"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
