"use client";

import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

const NAV_ITEMS = [
  { href: "/dashboard", label: "대시보드", icon: "📊" },
  { href: "/dashboard/new", label: "새 분석 요청", icon: "✚" },
];

const BOTTOM_ITEMS = [
  { href: "/dashboard/settings", label: "설정", icon: "⚙" },
];

export function DashboardShell({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const companyName = user.user_metadata?.company_name || user.email?.split("@")[0] || "";

  return (
    <div className="flex h-screen bg-[#fafafa]">
      {/* Sidebar */}
      <aside className="w-[240px] bg-white border-r border-zinc-200 flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="h-14 flex items-center px-5 border-b border-zinc-100">
          <a href="/dashboard" className="font-black text-lg tracking-tight">
            Trade<span className="text-[#f15f23]">Voy</span>
          </a>
        </div>

        {/* Company */}
        <div className="px-4 py-3 border-b border-zinc-100">
          <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">workspace</div>
          <div className="text-sm font-bold text-zinc-800 truncate">{companyName}</div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
            return (
              <a
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                  active
                    ? "bg-zinc-100 text-zinc-900 font-semibold"
                    : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700"
                }`}
              >
                <span className="text-base w-5 text-center">{item.icon}</span>
                {item.label}
              </a>
            );
          })}

          <div className="pt-4 pb-2">
            <div className="text-[10px] font-semibold text-zinc-300 uppercase tracking-wider px-3">내 프로젝트</div>
          </div>
          {/* 프로젝트 리스트는 서버에서 주입 가능 - 추후 확장 */}
          <a
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600 transition"
          >
            <span className="text-base w-5 text-center">📁</span>
            전체 프로젝트 보기
          </a>
        </nav>

        {/* Bottom */}
        <div className="border-t border-zinc-100 px-3 py-3 space-y-0.5">
          {BOTTOM_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600 transition"
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              {item.label}
            </a>
          ))}
        </div>

        {/* User */}
        <div className="border-t border-zinc-100 px-4 py-3 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-sm font-medium text-zinc-700 truncate">{user.email}</div>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs text-zinc-400 hover:text-zinc-600 flex-shrink-0 ml-2"
            title="로그아웃"
          >
            ↗
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 bg-white border-b border-zinc-200 flex items-center justify-between px-8 flex-shrink-0">
          <div />
          <div className="flex items-center gap-3">
            <a
              href="https://tradevoy.devpartner.org"
              target="_blank"
              rel="noopener"
              className="text-xs text-zinc-400 hover:text-zinc-600"
            >
              TradeVoy 홈
            </a>
            <button
              onClick={handleLogout}
              className="text-xs text-zinc-400 hover:text-zinc-600 border border-zinc-200 rounded px-2.5 py-1"
            >
              로그아웃
            </button>
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-8 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
