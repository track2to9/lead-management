"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
  const scoreColor = score >= 80 ? "bg-green-500" : score >= 50 ? "bg-yellow-500" : "bg-zinc-400";

  async function handleAction(newStatus: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from("prospects").update({ feedback_status: newStatus }).eq("id", prospect.id);

    if (reason.trim()) {
      const fb: Partial<Feedback> = {
        project_id: project.id,
        prospect_id: prospect.id,
        user_email: user?.email || "",
        type: newStatus === "accepted" ? "prospect_accept" : newStatus === "rejected" ? "prospect_reject" : "prospect_more",
        text: reason,
        timestamp: new Date().toISOString(),
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
      <nav className="flex items-center gap-1.5 text-sm text-zinc-400 mb-6">
        <Link href="/dashboard" className="hover:text-zinc-600 transition">대시보드</Link>
        <span>/</span>
        <Link href={`/dashboard/project/${project.id}`} className="hover:text-zinc-600 transition">{project.name}</Link>
        <span>/</span>
        <span className="text-zinc-800 font-medium">{prospect.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-zinc-900">{prospect.name}</h1>
            <div className={`w-10 h-10 rounded-full ${scoreColor} flex items-center justify-center text-white font-bold text-sm`}>
              {score}
            </div>
          </div>
          {prospect.url && (
            <a href={prospect.url} target="_blank" rel="noopener" className="text-sm text-[#f15f23] hover:underline">
              {prospect.url}
            </a>
          )}
          <div className="flex items-center gap-2 mt-2">
            {prospect.buyer_or_competitor === "buyer" && <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 text-xs">구매자</Badge>}
            {prospect.buyer_or_competitor === "competitor" && <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 text-xs">경쟁사</Badge>}
            <Badge variant="outline" className="text-zinc-400 text-xs">{prospect.priority?.toUpperCase()}</Badge>
            <Badge variant="outline" className="text-zinc-400 text-xs">{prospect.country}</Badge>
            {status === "accepted" && <Badge className="bg-green-100 text-green-700 text-xs">✓ 승인</Badge>}
            {status === "rejected" && <Badge className="bg-red-100 text-red-700 text-xs">✕ 제외</Badge>}
            {status === "needs_more" && <Badge className="bg-yellow-100 text-yellow-700 text-xs">⟳ 추가분석</Badge>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Main content (2 cols) */}
        <div className="col-span-2 space-y-6">
          {/* 회사 요약 */}
          <Card>
            <CardContent className="pt-5">
              <h3 className="text-xs font-bold text-[#f15f23] uppercase tracking-wider mb-2">회사 요약</h3>
              <p className="text-sm leading-relaxed text-zinc-700">{prospect.summary || "정보 없음"}</p>
            </CardContent>
          </Card>

          {/* 매칭 근거 */}
          {prospect.reasoning_chain && (
            <Card>
              <CardContent className="pt-5">
                <h3 className="text-xs font-bold text-[#f15f23] uppercase tracking-wider mb-2">매칭 점수 판단 근거</h3>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-sm leading-relaxed text-zinc-700">
                  {prospect.reasoning_chain}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 원문 인용 */}
          {prospect.evidence_quotes?.length > 0 && (
            <Card>
              <CardContent className="pt-5">
                <h3 className="text-xs font-bold text-[#f15f23] uppercase tracking-wider mb-3">
                  홈페이지 원문 인용 ({prospect.evidence_quotes.length}건)
                </h3>
                <div className="space-y-3">
                  {prospect.evidence_quotes.map((eq, i) => (
                    <div key={i} className="bg-zinc-50 border-l-2 border-[#f15f23] pl-4 py-3 rounded-r-lg">
                      <p className="text-xs text-zinc-400 italic">&ldquo;{eq.original}&rdquo;</p>
                      <p className="text-sm font-medium text-zinc-700 mt-1">→ {eq.translated}</p>
                      <p className="text-xs text-[#f15f23] mt-1">📌 {eq.relevance}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 접근 전략 */}
          {prospect.approach && (
            <Card>
              <CardContent className="pt-5">
                <h3 className="text-xs font-bold text-[#f15f23] uppercase tracking-wider mb-2">접근 전략</h3>
                <p className="text-sm leading-relaxed text-zinc-700">{prospect.approach}</p>
              </CardContent>
            </Card>
          )}

          {/* 이메일 초안 */}
          {prospect.email_subject && (
            <Card>
              <CardContent className="pt-5">
                <h3 className="text-xs font-bold text-[#f15f23] uppercase tracking-wider mb-2">이메일 초안</h3>
                <div className="bg-zinc-50 rounded-lg p-4">
                  <div className="text-sm font-semibold mb-2">Subject: {prospect.email_subject}</div>
                  <div className="text-sm text-zinc-600 whitespace-pre-wrap leading-relaxed">{prospect.email_body}</div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 팔로업 시퀀스 */}
          {prospect.followup_sequence?.length > 0 && (
            <Card>
              <CardContent className="pt-5">
                <h3 className="text-xs font-bold text-[#f15f23] uppercase tracking-wider mb-3">팔로업 시퀀스</h3>
                <div className="space-y-3">
                  {prospect.followup_sequence.map((fu, i) => (
                    <div key={i} className="flex gap-3">
                      <div className={`w-14 h-7 rounded flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                        fu.day === 3 ? "bg-green-100 text-green-700" : fu.day === 7 ? "bg-yellow-100 text-yellow-700" : "bg-zinc-100 text-zinc-500"
                      }`}>Day {fu.day}</div>
                      <div>
                        <div className="text-sm font-semibold">{fu.subject}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">{fu.body}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Sidebar (1 col) */}
        <div className="space-y-4">
          {/* 피드백 액션 */}
          <Card>
            <CardContent className="pt-5">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">피드백</h3>
              <div className="space-y-2">
                <Button size="sm" variant="outline" className={`w-full justify-start text-green-600 hover:bg-green-50 ${status === "accepted" ? "bg-green-50 border-green-300" : ""}`}
                  onClick={() => handleAction("accepted")}>
                  ✓ 컨택 대상으로 승인
                </Button>
                <Button size="sm" variant="outline" className={`w-full justify-start text-red-600 hover:bg-red-50 ${status === "rejected" ? "bg-red-50 border-red-300" : ""}`}
                  onClick={() => handleAction("rejected")}>
                  ✕ 제외
                </Button>
                <Button size="sm" variant="outline" className={`w-full justify-start text-yellow-600 hover:bg-yellow-50 ${status === "needs_more" ? "bg-yellow-50 border-yellow-300" : ""}`}
                  onClick={() => handleAction("needs_more")}>
                  ⟳ 비슷한 업체 더 찾아줘
                </Button>
              </div>
              <Input value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="이유 (선택)"
                className="mt-3 text-sm" />

              {/* 피드백 히스토리 */}
              {feedback.length > 0 && (
                <div className="mt-4 space-y-2">
                  {feedback.map((f, i) => (
                    <div key={i} className="text-xs bg-zinc-50 rounded p-2">
                      <span className="text-zinc-400">{f.timestamp?.split("T")[0]}</span>
                      {" · "}
                      <span className={
                        f.type === "prospect_accept" ? "text-green-600" :
                        f.type === "prospect_reject" ? "text-red-600" : "text-yellow-600"
                      }>{f.type === "prospect_accept" ? "승인" : f.type === "prospect_reject" ? "제외" : "추가요청"}</span>
                      {f.text && <div className="text-zinc-600 mt-1">{f.text}</div>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 인텔리전스 */}
          <Card>
            <CardContent className="pt-5">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">바이어 인텔리전스</h3>
              <div className="space-y-3">
                {[
                  { label: "현재 공급업체", value: prospect.current_suppliers?.join(", ") },
                  { label: "회사 규모", value: prospect.company_size },
                  { label: "의사결정권자", value: prospect.decision_maker },
                  { label: "접근 타이밍", value: prospect.best_timing },
                  { label: "경쟁 환경", value: prospect.competitive_landscape },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="text-[10px] font-semibold text-zinc-400 uppercase">{item.label}</div>
                    <div className="text-sm text-zinc-700 mt-0.5">{item.value || "미확인"}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 취급 제품 */}
          {prospect.detected_products?.length > 0 && (
            <Card>
              <CardContent className="pt-5">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">취급 제품</h3>
                <div className="flex flex-wrap gap-1">
                  {prospect.detected_products.map((p, i) => (
                    <Badge key={i} variant="outline" className="text-xs text-zinc-600">{p}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
