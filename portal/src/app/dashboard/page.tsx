import { createServerSupabase } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import type { Project } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", user?.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-extrabold">내 프로젝트</h1>
        <Link
          href="/dashboard/new"
          className="px-5 py-2.5 bg-[#f15f23] text-white rounded-lg font-bold text-sm hover:bg-[#ff7a45] transition"
        >
          + 새 분석 요청
        </Link>
      </div>

      {!projects || projects.length === 0 ? (
        <div className="mt-8">
          {/* Empty state */}
          <Card className="border-dashed border-2 border-zinc-200">
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🔍</span>
              </div>
              <h3 className="text-lg font-bold mb-2">아직 분석 요청이 없습니다</h3>
              <p className="text-sm text-zinc-500 mb-6 max-w-md mx-auto">
                해외 바이어 발굴을 시작하려면 분석을 요청해주세요.<br />
                제품 정보와 타겟 시장을 알려주시면 AI가 맞춤 바이어를 찾아드립니다.
              </p>
              <Link
                href="/dashboard/new"
                className="inline-flex items-center px-6 py-3 bg-[#f15f23] text-white rounded-lg font-bold hover:bg-[#ff7a45] transition"
              >
                첫 분석 요청하기 →
              </Link>
            </CardContent>
          </Card>

          {/* How it works */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { step: "1", title: "분석 요청", desc: "제품, 타겟 고객, 국가 정보를 입력합니다" },
              { step: "2", title: "AI 발굴", desc: "AI가 바이어를 찾고 전문가가 검증합니다" },
              { step: "3", title: "결과 확인", desc: "매칭 점수, 근거, 접근 전략을 확인합니다" },
              { step: "4", title: "피드백", desc: "승인/제외/추가 요청으로 리스트를 개선합니다" },
            ].map((item) => (
              <Card key={item.step} className="bg-zinc-50 border-none">
                <CardContent className="pt-5 pb-4">
                  <div className="w-8 h-8 bg-[#f15f23] text-white rounded-full flex items-center justify-center font-bold text-sm mb-3">
                    {item.step}
                  </div>
                  <h4 className="font-bold text-sm mb-1">{item.title}</h4>
                  <p className="text-xs text-zinc-500">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(projects as Project[]).map((project) => (
            <Link key={project.id} href={`/dashboard/project/${project.id}`}>
              <Card className="hover:border-[#f15f23] hover:shadow-md transition cursor-pointer">
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg">{project.name}</h3>
                    <Badge
                      variant={project.status === "active" ? "default" : "secondary"}
                      className={project.status === "active" ? "bg-green-100 text-green-700" : ""}
                    >
                      {project.status === "active" ? "진행 중" : project.status === "reviewing" ? "검토 중" : "완료"}
                    </Badge>
                  </div>
                  <p className="text-sm text-zinc-500 mb-4">
                    {project.created_at?.split("T")[0]} · {project.countries} · {project.product}
                  </p>
                  <div className="flex gap-6">
                    <div className="text-center">
                      <div className="text-2xl font-black text-[#f15f23]">{project.total_companies}</div>
                      <div className="text-xs text-zinc-500">분석</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-black text-[#f15f23]">{project.high_count}</div>
                      <div className="text-xs text-zinc-500">HIGH</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-black text-[#f15f23]">{project.emails_drafted}</div>
                      <div className="text-xs text-zinc-500">이메일</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
