"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Project, Prospect, Feedback, Exhibition } from "@/lib/types";
import { ProspectCard } from "./prospect-card";

interface Props {
  project: Project;
  prospects: Prospect[];
  feedback: Feedback[];
  exhibitions: Exhibition[];
}

export function ProjectDetail({ project, prospects: initial, feedback: initialFB, exhibitions }: Props) {
  const [prospects, setProspects] = useState(initial);
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

  async function updateProspectStatus(prospectId: string, status: string, reason: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // prospect 상태 업데이트
    await supabase
      .from("prospects")
      .update({ feedback_status: status })
      .eq("id", prospectId);

    // 피드백 기록
    if (reason) {
      const fb: Partial<Feedback> = {
        project_id: project.id,
        prospect_id: prospectId,
        user_email: user?.email || "",
        type: status === "accepted" ? "prospect_accept" : status === "rejected" ? "prospect_reject" : "prospect_more",
        text: reason,
        timestamp: new Date().toISOString(),
      };
      await supabase.from("feedback").insert(fb);
      setFeedback([...feedback, fb as Feedback]);
    }

    // UI 업데이트
    setProspects(prospects.map((p) =>
      p.id === prospectId ? { ...p, feedback_status: status as Prospect["feedback_status"] } : p
    ));
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <a href="/dashboard" className="text-sm text-zinc-500 hover:text-[#f15f23] mb-2 inline-block">
          &larr; 프로젝트 목록
        </a>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-extrabold">{project.name}</h1>
          <Badge variant={project.status === "active" ? "default" : "secondary"}
            className={project.status === "active" ? "bg-green-100 text-green-700" : ""}>
            {project.status === "active" ? "진행 중" : "완료"}
          </Badge>
        </div>
        <p className="text-sm text-zinc-500">
          {project.created_at?.split("T")[0]} · {project.countries} · {project.product}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { n: stats.total, l: "분석 대상" },
          { n: stats.high, l: "HIGH 등급" },
          { n: stats.accepted, l: "승인됨" },
          { n: stats.rejected, l: "제외됨" },
        ].map((s) => (
          <Card key={s.l}>
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-2xl font-black text-[#f15f23]">{s.n}</div>
              <div className="text-xs text-zinc-500">{s.l}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="prospects">
        <TabsList className="mb-4">
          <TabsTrigger value="prospects">바이어 리스트</TabsTrigger>
          <TabsTrigger value="exhibitions">전시회</TabsTrigger>
          <TabsTrigger value="feedback">프로젝트 피드백</TabsTrigger>
        </TabsList>

        {/* Prospects Tab */}
        <TabsContent value="prospects">
          {/* Filters */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {[
              { key: "all", label: "전체" },
              { key: "high", label: "HIGH" },
              { key: "medium", label: "MEDIUM" },
              { key: "accepted", label: "승인" },
              { key: "rejected", label: "제외" },
              { key: "needs_more", label: "추가요청" },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition ${
                  filter === f.key
                    ? "border-[#f15f23] bg-orange-50 text-[#f15f23]"
                    : "border-zinc-200 text-zinc-600 hover:border-zinc-400"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Prospect Cards */}
          <div className="space-y-3">
            {filtered.map((prospect) => (
              <ProspectCard
                key={prospect.id}
                prospect={prospect}
                feedback={feedback.filter((f) => f.prospect_id === prospect.id)}
                onStatusChange={updateProspectStatus}
              />
            ))}
            {filtered.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center text-zinc-500">
                  해당 조건의 업체가 없습니다.
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Exhibitions Tab */}
        <TabsContent value="exhibitions">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {exhibitions.map((ex) => (
              <Card key={ex.id}>
                <CardContent className="pt-4">
                  <h4 className="font-bold mb-1">{ex.name}</h4>
                  <p className="text-sm text-zinc-500 mb-2">
                    📍 {ex.location} · {ex.typical_month}
                  </p>
                  {ex.relevance && <p className="text-sm mb-2">{ex.relevance}</p>}
                  {ex.action_suggestion && (
                    <p className="text-sm text-green-600">💡 {ex.action_suggestion}</p>
                  )}
                  {ex.website && (
                    <a href={ex.website} target="_blank" rel="noopener" className="text-sm text-[#f15f23] hover:underline">
                      {ex.website}
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Project Feedback Tab */}
        <TabsContent value="feedback">
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-bold mb-2">프로젝트 전체 피드백</h3>
              <p className="text-sm text-zinc-500 mb-4">
                &quot;이런 규모의 업체를 더 찾아줘&quot;, &quot;이 업종은 우리랑 안 맞아&quot; 등
                전체 방향에 대한 의견을 남겨주세요.
              </p>
              <Textarea
                value={projectNote}
                onChange={(e) => setProjectNote(e.target.value)}
                placeholder="예: 중소형 딜러 위주로 더 찾아주세요. 대기업은 의사결정이 느려서..."
                className="mb-3"
              />
              <Button onClick={submitProjectFeedback} className="bg-[#f15f23] hover:bg-[#ff7a45]">
                피드백 전송
              </Button>

              {/* History */}
              <div className="mt-6 space-y-2">
                {feedback
                  .filter((f) => !f.prospect_id && f.type === "general")
                  .map((f, i) => (
                    <div key={i} className="p-3 bg-zinc-50 rounded-lg">
                      <div className="text-xs text-zinc-400 mb-1">
                        {f.timestamp?.replace("T", " ").split(".")[0]}
                        {f.user_email?.includes("tradevoy") && " · TradeVoy"}
                      </div>
                      <div className={f.user_email?.includes("tradevoy") ? "text-[#f15f23]" : ""}>
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
