import { createServerSupabase } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import type { Project } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  // Supabase에서 프로젝트 로드
  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", user?.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-6">내 프로젝트</h1>

      {!projects || projects.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-zinc-500">
            <p className="text-lg font-semibold mb-2">아직 프로젝트가 없습니다</p>
            <p className="text-sm">
              TradeVoy 팀이 분석을 시작하면 여기에 표시됩니다.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(projects as Project[]).map((project) => (
            <Link key={project.id} href={`/dashboard/project/${project.id}`}>
              <Card className="hover:border-[#f15f23] hover:shadow-md transition cursor-pointer">
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg">{project.name}</h3>
                    <Badge
                      variant={
                        project.status === "active" ? "default" : "secondary"
                      }
                      className={
                        project.status === "active"
                          ? "bg-green-100 text-green-700"
                          : ""
                      }
                    >
                      {project.status === "active"
                        ? "진행 중"
                        : project.status === "reviewing"
                        ? "검토 중"
                        : "완료"}
                    </Badge>
                  </div>
                  <p className="text-sm text-zinc-500 mb-4">
                    {project.created_at?.split("T")[0]} · {project.countries} ·{" "}
                    {project.product}
                  </p>
                  <div className="flex gap-6">
                    <div className="text-center">
                      <div className="text-2xl font-black text-[#f15f23]">
                        {project.total_companies}
                      </div>
                      <div className="text-xs text-zinc-500">분석</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-black text-[#f15f23]">
                        {project.high_count}
                      </div>
                      <div className="text-xs text-zinc-500">HIGH</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-black text-[#f15f23]">
                        {project.emails_drafted}
                      </div>
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
