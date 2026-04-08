"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

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
        email,
        password,
        options: { data: { company_name: company } },
      });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      setError("인증 이메일을 확인해주세요.");
      setLoading(false);
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      router.push("/dashboard");
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <Card className="w-full max-w-[400px] border-zinc-800 bg-zinc-950">
        <CardHeader className="space-y-1 pb-4">
          <h1 className="text-2xl font-black text-white">
            Trade<span className="text-[#f15f23]">Voy</span>
          </h1>
          <p className="text-sm text-zinc-500">
            고객 포털 — 분석 결과 확인 및 피드백
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-zinc-400">
                이메일
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-zinc-900 border-zinc-800 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-zinc-400">
                비밀번호
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-zinc-900 border-zinc-800 text-white"
              />
            </div>
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="company" className="text-zinc-400">
                  회사명
                </Label>
                <Input
                  id="company"
                  type="text"
                  placeholder="주식회사 OOO"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="bg-zinc-900 border-zinc-800 text-white"
                />
              </div>
            )}
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#f15f23] hover:bg-[#ff7a45] text-white font-bold"
            >
              {loading ? "처리 중..." : isSignUp ? "회원가입" : "로그인"}
            </Button>
          </form>
          <p className="text-center text-sm text-zinc-500 mt-4">
            {isSignUp ? "이미 계정이 있으신가요?" : "계정이 없으신가요?"}{" "}
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError("");
              }}
              className="text-[#f15f23] hover:underline"
            >
              {isSignUp ? "로그인" : "회원가입"}
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
