"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export function DashboardShell({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Topbar */}
      <header className="sticky top-0 z-50 bg-zinc-950 text-white">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/dashboard" className="font-black text-lg">
            Trade<span className="text-[#f15f23]">Voy</span>
          </a>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-zinc-500">{user.email}</span>
            <button
              onClick={handleLogout}
              className="px-3 py-1 border border-zinc-700 rounded text-xs hover:border-zinc-500 transition"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
