"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Prospect, Feedback } from "@/lib/types";

interface Props {
  prospect: Prospect;
  feedback: Feedback[];
  onStatusChange: (id: string, status: string, reason: string) => void;
}

export function ProspectCard({ prospect, feedback, onStatusChange }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const score = prospect.match_score || 0;
  const scoreColor = score >= 80 ? "bg-green-500" : score >= 50 ? "bg-yellow-500" : "bg-zinc-400";
  const statusBorder =
    prospect.feedback_status === "accepted" ? "border-l-green-500" :
    prospect.feedback_status === "rejected" ? "border-l-red-500 opacity-60" :
    prospect.feedback_status === "needs_more" ? "border-l-yellow-500" : "";

  function handleAction(status: string) {
    onStatusChange(prospect.id, status, reason);
    setReason("");
  }

  return (
    <Card className={`border-l-4 ${statusBorder || "border-l-transparent"}`}>
      {/* Header - 클릭하면 펼침 */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-zinc-50 transition"
        onClick={() => setOpen(!open)}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-bold truncate">{prospect.name}</h4>
            {prospect.buyer_or_competitor === "buyer" && (
              <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 text-xs">구매자</Badge>
            )}
            {prospect.buyer_or_competitor === "competitor" && (
              <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 text-xs">경쟁사</Badge>
            )}
            {prospect.feedback_status === "accepted" && (
              <Badge className="bg-green-100 text-green-700 text-xs">✓ 승인</Badge>
            )}
            {prospect.feedback_status === "rejected" && (
              <Badge className="bg-red-100 text-red-700 text-xs">✕ 제외</Badge>
            )}
            {prospect.feedback_status === "needs_more" && (
              <Badge className="bg-yellow-100 text-yellow-700 text-xs">⟳ 추가분석</Badge>
            )}
          </div>
          <p className="text-sm text-zinc-500 truncate">{prospect.url}</p>
        </div>
        <div className={`w-12 h-12 rounded-full ${scoreColor} flex items-center justify-center text-white font-black text-lg flex-shrink-0 ml-4`}>
          {score}
        </div>
      </div>

      {/* Body - 상세 정보 */}
      {open && (
        <CardContent className="pt-0 pb-0">
          {/* 요약 */}
          <div className="mb-4">
            <h5 className="text-xs font-bold text-[#f15f23] uppercase tracking-wide mb-1">회사 요약</h5>
            <p className="text-sm leading-relaxed">{prospect.summary}</p>
          </div>

          {/* 추론 근거 */}
          {prospect.reasoning_chain && (
            <div className="mb-4">
              <h5 className="text-xs font-bold text-[#f15f23] uppercase tracking-wide mb-1">매칭 점수 판단 근거</h5>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm leading-relaxed">
                {prospect.reasoning_chain}
              </div>
            </div>
          )}

          {/* 원문 인용 */}
          {prospect.evidence_quotes?.length > 0 && (
            <div className="mb-4">
              <h5 className="text-xs font-bold text-[#f15f23] uppercase tracking-wide mb-2">
                홈페이지 원문 인용 ({prospect.evidence_quotes.length}건)
              </h5>
              {prospect.evidence_quotes.map((eq, i) => (
                <div key={i} className="bg-zinc-50 border-l-2 border-[#f15f23] pl-3 py-2 mb-2 rounded-r">
                  <p className="text-xs text-zinc-400 italic">&quot;{eq.original}&quot;</p>
                  <p className="text-sm font-medium mt-1">→ {eq.translated}</p>
                  <p className="text-xs text-[#f15f23] mt-1">📌 {eq.relevance}</p>
                </div>
              ))}
            </div>
          )}

          {/* 인텔리전스 */}
          <div className="mb-4">
            <h5 className="text-xs font-bold text-[#f15f23] uppercase tracking-wide mb-2">바이어 인텔리전스</h5>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "현재 공급업체", value: prospect.current_suppliers?.join(", ") },
                { label: "회사 규모", value: prospect.company_size },
                { label: "의사결정권자", value: prospect.decision_maker },
                { label: "접근 타이밍", value: prospect.best_timing },
                { label: "경쟁 환경", value: prospect.competitive_landscape },
                { label: "접근 전략", value: prospect.approach },
              ].map((item) => (
                <div key={item.label} className="bg-zinc-50 rounded p-2.5">
                  <div className="text-[10px] font-semibold text-zinc-400 uppercase">{item.label}</div>
                  <div className="text-sm font-medium mt-0.5">{item.value || "미확인"}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 이메일 초안 */}
          {prospect.email_subject && (
            <div className="mb-4">
              <h5 className="text-xs font-bold text-[#f15f23] uppercase tracking-wide mb-1">이메일 초안</h5>
              <div className="bg-zinc-50 rounded-lg p-3">
                <div className="font-semibold text-sm mb-1">Subject: {prospect.email_subject}</div>
                <div className="text-sm text-zinc-600 whitespace-pre-wrap leading-relaxed">
                  {prospect.email_body}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      )}

      {/* Feedback Actions - 항상 보임 */}
      <div className="border-t bg-zinc-50/50 px-5 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm" variant="outline"
            className={`text-green-600 hover:bg-green-50 ${prospect.feedback_status === "accepted" ? "bg-green-50 border-green-300" : ""}`}
            onClick={() => handleAction("accepted")}
          >
            ✓ 컨택 대상
          </Button>
          <Button
            size="sm" variant="outline"
            className={`text-red-600 hover:bg-red-50 ${prospect.feedback_status === "rejected" ? "bg-red-50 border-red-300" : ""}`}
            onClick={() => handleAction("rejected")}
          >
            ✕ 제외
          </Button>
          <Button
            size="sm" variant="outline"
            className={`text-yellow-600 hover:bg-yellow-50 ${prospect.feedback_status === "needs_more" ? "bg-yellow-50 border-yellow-300" : ""}`}
            onClick={() => handleAction("needs_more")}
          >
            ⟳ 비슷한 업체 더 찾아줘
          </Button>
          <div className="flex-1 flex gap-2 ml-2">
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="이유 (예: 이미 거래 중, 규모가 너무 큼...)"
              className="text-sm h-8"
              onKeyDown={(e) => {
                if (e.key === "Enter" && reason.trim()) handleAction(prospect.feedback_status || "pending");
              }}
            />
          </div>
        </div>

        {/* Feedback history */}
        {feedback.length > 0 && (
          <div className="mt-2 space-y-1">
            {feedback.map((f, i) => (
              <div key={i} className="text-xs bg-white rounded px-2 py-1.5 border">
                <span className="text-zinc-400">{f.timestamp?.split("T")[0]}</span>
                {" · "}
                <span className={f.type === "prospect_accept" ? "text-green-600" : f.type === "prospect_reject" ? "text-red-600" : "text-yellow-600"}>
                  {f.type === "prospect_accept" ? "승인" : f.type === "prospect_reject" ? "제외" : "추가요청"}
                </span>
                {f.text && <span className="text-zinc-600"> — {f.text}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
