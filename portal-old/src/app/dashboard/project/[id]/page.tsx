import { createServerSupabase } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ProjectDetail } from "@/components/project-detail";
import type { Project, Prospect, Feedback, Exhibition } from "@/lib/types";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (!project) notFound();

  const { data: prospects } = await supabase
    .from("prospects")
    .select("*")
    .eq("project_id", id)
    .order("match_score", { ascending: false });

  const { data: feedback } = await supabase
    .from("feedback")
    .select("*")
    .eq("project_id", id)
    .order("timestamp", { ascending: true });

  const { data: exhibitions } = await supabase
    .from("exhibitions")
    .select("*")
    .eq("project_id", id);

  return (
    <ProjectDetail
      project={project as Project}
      prospects={(prospects || []) as Prospect[]}
      feedback={(feedback || []) as Feedback[]}
      exhibitions={(exhibitions || []) as Exhibition[]}
    />
  );
}
