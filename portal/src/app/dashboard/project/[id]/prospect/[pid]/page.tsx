import { createServerSupabase } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ProspectDetail } from "@/components/prospect-detail";
import type { Prospect, Project, Feedback } from "@/lib/types";

export default async function ProspectPage({
  params,
}: {
  params: Promise<{ id: string; pid: string }>;
}) {
  const { id, pid } = await params;
  const supabase = await createServerSupabase();

  const { data: project } = await supabase.from("projects").select("*").eq("id", id).single();
  if (!project) notFound();

  const { data: prospect } = await supabase.from("prospects").select("*").eq("id", pid).single();
  if (!prospect) notFound();

  const { data: feedback } = await supabase.from("feedback").select("*").eq("prospect_id", pid).order("timestamp", { ascending: true });

  return (
    <ProspectDetail
      project={project as Project}
      prospect={prospect as Prospect}
      feedback={(feedback || []) as Feedback[]}
    />
  );
}
