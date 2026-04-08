"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [company, setCompany] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { company_name: company } },
      });
      if (error) { setError(error.message); setLoading(false); return; }
      setError("인증 이메일을 확인해주세요.");
      setLoading(false);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setError(error.message); setLoading(false); return; }
      router.push("/dashboard");
    }
  }

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left - branding */}
      <div className="hidden lg:flex lg:w-[480px] bg-zinc-950 flex-col justify-between p-10">
        <div>
          <h1 className="text-2xl font-black text-white">
            Trade<span className="text-[#f15f23]">Voy</span>
          </h1>
        </div>
        <div>
          <h2 className="text-3xl font-bold text-white leading-tight mb-4">
            해외 바이어,<br />
            AI가 찾아드립니다.
          </h2>
          <p className="text-zinc-500 text-sm leading-relaxed">
            제품 정보만 알려주시면 AI가 10,000+ 소스에서<br />
            맞춤 바이어를 발굴하고, 전문가가 검증합니다.
          </p>
          <div className="flex gap-6 mt-8">
            <div>
              <div className="text-2xl font-black text-white">50+</div>
              <div className="text-xs text-zinc-500">분석 국가</div>
            </div>
            <div>
              <div className="text-2xl font-black text-white">92%</div>
              <div className="text-xs text-zinc-500">검증 정확도</div>
            </div>
            <div>
              <div className="text-2xl font-black text-white">48h</div>
              <div className="text-xs text-zinc-500">평균 전달</div>
            </div>
          </div>
        </div>
        <div className="text-xs text-zinc-600">
          &copy; 2026 TradeVoy · trade.devpartner.org
        </div>
      </div>

      {/* Right - form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-[360px]">
          <div className="lg:hidden mb-8">
            <h1 className="text-xl font-black">
              Trade<span className="text-[#f15f23]">Voy</span>
            </h1>
          </div>

          <h2 className="text-xl font-bold text-zinc-900 mb-1">
            {isSignUp ? "회원가입" : "로그인"}
          </h2>
          <p className="text-sm text-zinc-400 mb-6">
            {isSignUp ? "계정을 만들고 바이어 발굴을 시작하세요." : "고객 포털에 접속합니다."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-zinc-500 block mb-1">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-200 transition"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 block mb-1">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-200 transition"
              />
            </div>
            {isSignUp && (
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">회사명</label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="주식회사 OOO"
                  className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-200 transition"
                />
              </div>
            )}
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 disabled:opacity-50 transition mt-2"
            >
              {loading ? "처리 중..." : isSignUp ? "회원가입" : "로그인"}
            </button>
          </form>

          <p className="text-center text-xs text-zinc-400 mt-4">
            {isSignUp ? "이미 계정이 있으신가요?" : "계정이 없으신가요?"}{" "}
            <button onClick={() => { setIsSignUp(!isSignUp); setError(""); }} className="text-zinc-700 font-medium hover:underline">
              {isSignUp ? "로그인" : "회원가입"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
