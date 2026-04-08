"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [filter, setFilter] = useState("all");
  const [projectNote, setProjectNote] = useState("");

  const filtered = prospects.filter((p) => {
    if (filter === "all") return true;
    if (filter === "high") return p.priority === "high";
    if (filter === "medium") return p.priority === "medium";
    return p.feedback_status === filter;
  });

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

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-zinc-400 mb-6">
        <Link href="/dashboard" className="hover:text-zinc-600 transition">대시보드</Link>
        <span>/</span>
        <span className="text-zinc-800 font-medium">{project.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-xl font-bold text-zinc-900">{project.name}</h1>
        <Badge variant="outline"
          className={
            project.status === "active" ? "border-green-200 bg-green-50 text-green-700 text-xs"
            : project.status === "reviewing" ? "border-yellow-200 bg-yellow-50 text-yellow-700 text-xs"
            : "border-zinc-200 bg-zinc-50 text-zinc-500 text-xs"
          }
        >
          {project.status === "active" ? "진행 중" : project.status === "reviewing" ? "검토 중" : "완료"}
        </Badge>
      </div>
      <p className="text-sm text-zinc-400 mb-6">
        {project.created_at?.split("T")[0]} · {project.countries} · {project.product}
      </p>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { n: stats.total, l: "분석 대상" },
          { n: stats.high, l: "HIGH 등급" },
          { n: stats.accepted, l: "승인" },
          { n: stats.rejected, l: "제외" },
        ].map((s) => (
          <div key={s.l} className="bg-white rounded-xl border border-zinc-200 px-4 py-3 text-center">
            <div className="text-xl font-black text-[#f15f23]">{s.n}</div>
            <div className="text-[11px] text-zinc-400">{s.l}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="prospects">
        <TabsList className="mb-4">
          <TabsTrigger value="prospects">바이어 리스트</TabsTrigger>
          <TabsTrigger value="exhibitions">전시회</TabsTrigger>
          <TabsTrigger value="feedback">피드백</TabsTrigger>
        </TabsList>

        {/* Prospects Table */}
        <TabsContent value="prospects">
          <div className="flex gap-2 mb-4 flex-wrap">
            {[
              { key: "all", label: `전체 (${prospects.length})` },
              { key: "high", label: `HIGH (${stats.high})` },
              { key: "medium", label: "MEDIUM" },
              { key: "accepted", label: `승인 (${stats.accepted})` },
              { key: "rejected", label: `제외 (${stats.rejected})` },
              { key: "needs_more", label: "추가요청" },
            ].map((f) => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${
                  filter === f.key ? "border-[#f15f23] bg-orange-50 text-[#f15f23]" : "border-zinc-200 text-zinc-500 hover:border-zinc-300"
                }`}
              >{f.label}</button>
            ))}
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
            <div className="grid grid-cols-[1fr_80px_80px_120px_100px] gap-4 px-5 py-2.5 border-b border-zinc-100 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              <div>업체명</div>
              <div className="text-right">점수</div>
              <div className="text-center">분류</div>
              <div>주요 브랜드</div>
              <div className="text-right">상태</div>
            </div>

            {filtered.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-zinc-400">해당 조건의 업체가 없습니다.</div>
            ) : (
              filtered.map((p) => {
                const score = p.match_score || 0;
                return (
                  <Link key={p.id} href={`/dashboard/project/${project.id}/prospect/${p.id}`}
                    className="grid grid-cols-[1fr_80px_80px_120px_100px] gap-4 px-5 py-3 border-b border-zinc-50 hover:bg-zinc-50 transition items-center group"
                  >
                    <div>
                      <div className="text-sm font-semibold text-zinc-800 group-hover:text-[#f15f23] transition truncate">
                        {p.name}
                      </div>
                      <div className="text-xs text-zinc-400 truncate mt-0.5">{p.url || ''}</div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full text-xs font-bold text-white ${
                        score >= 80 ? "bg-green-500" : score >= 50 ? "bg-yellow-500" : "bg-zinc-300"
                      }`}>{score}</span>
                    </div>
                    <div className="text-center">
                      {p.buyer_or_competitor === "buyer" && (
                        <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 text-[10px]">구매자</Badge>
                      )}
                      {p.buyer_or_competitor === "competitor" && (
                        <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 text-[10px]">경쟁사</Badge>
                      )}
                    </div>
                    <div className="text-xs text-zinc-500 truncate">
                      {p.current_suppliers?.slice(0, 3).join(", ") || "-"}
                    </div>
                    <div className="text-right">
                      {p.feedback_status === "accepted" && <Badge className="bg-green-100 text-green-700 text-[10px]">승인</Badge>}
                      {p.feedback_status === "rejected" && <Badge className="bg-red-100 text-red-700 text-[10px]">제외</Badge>}
                      {p.feedback_status === "needs_more" && <Badge className="bg-yellow-100 text-yellow-700 text-[10px]">추가분석</Badge>}
                      {(!p.feedback_status || p.feedback_status === "pending") && <Badge variant="outline" className="text-zinc-400 text-[10px]">대기</Badge>}
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* Exhibitions */}
        <TabsContent value="exhibitions">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {exhibitions.map((ex) => (
              <Card key={ex.id}>
                <CardContent className="pt-4">
                  <h4 className="font-bold text-sm mb-1">{ex.name}</h4>
                  <p className="text-xs text-zinc-500 mb-2">📍 {ex.location} · {ex.typical_month}</p>
                  {ex.relevance && <p className="text-xs mb-2">{ex.relevance}</p>}
                  {ex.action_suggestion && <p className="text-xs text-green-600">💡 {ex.action_suggestion}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Feedback */}
        <TabsContent value="feedback">
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-bold text-sm mb-2">프로젝트 피드백</h3>
              <p className="text-xs text-zinc-400 mb-4">전체 방향에 대한 의견을 남겨주세요.</p>
              <Textarea value={projectNote} onChange={(e) => setProjectNote(e.target.value)}
                placeholder="예: 중소형 딜러 위주로 더 찾아주세요..." className="mb-3 text-sm" />
              <Button onClick={submitProjectFeedback} size="sm" className="bg-[#f15f23] hover:bg-[#ff7a45] text-xs">
                피드백 전송
              </Button>
              <div className="mt-6 space-y-2">
                {feedback.filter((f) => !f.prospect_id).map((f, i) => (
                  <div key={i} className="p-3 bg-zinc-50 rounded-lg text-sm">
                    <div className="text-[10px] text-zinc-400 mb-1">{f.timestamp?.replace("T", " ").split(".")[0]}</div>
                    <div className={f.user_email?.includes("tradevoy") || f.user_email?.includes("system") ? "text-[#f15f23]" : ""}>
                      {f.text}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
