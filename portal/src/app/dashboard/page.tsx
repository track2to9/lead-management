import { createServerSupabase } from "@/lib/supabase/server";
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

  const hasProjects = projects && projects.length > 0;

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">프로젝트</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {hasProjects ? `${projects.length}개의 분석 프로젝트` : "해외 바이어 발굴을 시작하세요"}
          </p>
        </div>
        <Link
          href="/dashboard/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 transition"
        >
          <span className="text-base leading-none">+</span>
          새 분석 요청
        </Link>
      </div>

      {!hasProjects ? (
        /* Empty state */
        <div>
          <div className="bg-white rounded-xl border border-zinc-200 p-12 text-center mb-8">
            <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-xl">🔍</span>
            </div>
            <h3 className="text-base font-semibold text-zinc-800 mb-1.5">아직 프로젝트가 없습니다</h3>
            <p className="text-sm text-zinc-400 mb-6 max-w-sm mx-auto">
              제품과 타겟 시장 정보를 입력하면<br />AI가 맞춤 바이어를 찾아드립니다.
            </p>
            <Link
              href="/dashboard/new"
              className="inline-flex items-center px-5 py-2.5 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 transition"
            >
              첫 분석 요청하기 →
            </Link>
          </div>

          {/* Steps guide */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { n: "01", title: "분석 요청", desc: "제품, 타겟 고객, 국가 입력", color: "bg-[#f15f23]" },
              { n: "02", title: "AI 발굴", desc: "10,000+ 소스에서 바이어 탐색", color: "bg-zinc-700" },
              { n: "03", title: "결과 확인", desc: "매칭 점수, 근거, 전략 확인", color: "bg-zinc-700" },
              { n: "04", title: "피드백", desc: "승인/제외로 리스트 개선", color: "bg-zinc-700" },
            ].map((s) => (
              <div key={s.n} className="bg-white rounded-xl border border-zinc-200 p-5">
                <div className={`w-7 h-7 ${s.color} text-white rounded-md flex items-center justify-center text-xs font-bold mb-3`}>
                  {s.n}
                </div>
                <h4 className="text-sm font-semibold text-zinc-800 mb-0.5">{s.title}</h4>
                <p className="text-xs text-zinc-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Project table (Mercury style) */
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_120px_80px_80px_80px_100px] gap-4 px-5 py-3 border-b border-zinc-100 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            <div>프로젝트</div>
            <div>국가</div>
            <div className="text-right">분석</div>
            <div className="text-right">HIGH</div>
            <div className="text-right">이메일</div>
            <div className="text-right">상태</div>
          </div>

          {/* Table rows */}
          {(projects as Project[]).map((project) => (
            <Link
              key={project.id}
              href={`/dashboard/project/${project.id}`}
              className="grid grid-cols-[1fr_120px_80px_80px_80px_100px] gap-4 px-5 py-4 border-b border-zinc-50 hover:bg-zinc-50 transition items-center group"
            >
              <div>
                <div className="text-sm font-semibold text-zinc-800 group-hover:text-[#f15f23] transition">
                  {project.name}
                </div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  {project.product} · {project.created_at?.split("T")[0]}
                </div>
              </div>
              <div className="text-sm text-zinc-600">{project.countries}</div>
              <div className="text-sm font-semibold text-zinc-800 text-right">{project.total_companies}</div>
              <div className="text-sm font-semibold text-[#f15f23] text-right">{project.high_count}</div>
              <div className="text-sm text-zinc-600 text-right">{project.emails_drafted}</div>
              <div className="text-right">
                <Badge
                  variant="outline"
                  className={
                    project.status === "active"
                      ? "border-green-200 bg-green-50 text-green-700 text-xs"
                      : project.status === "reviewing"
                      ? "border-yellow-200 bg-yellow-50 text-yellow-700 text-xs"
                      : "border-zinc-200 bg-zinc-50 text-zinc-500 text-xs"
                  }
                >
                  {project.status === "active" ? "진행 중" : project.status === "reviewing" ? "검토 중" : "완료"}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
