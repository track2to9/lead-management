// Supabase Edge Function: crawl-dealers
//
// Deploy: supabase functions deploy crawl-dealers
// Secrets: supabase secrets set FIRECRAWL_API_KEY=fc-xxx
//
// POST { brand: string, category: "attachment" | "excavator", url: string }
// Returns SSE stream with events:
//   - status: crawling status updates
//   - dealer: each extracted dealer
//   - done: final count
//   - error: on failure

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FIRECRAWL_URL = "https://api.firecrawl.dev/v2/scrape";

interface CrawlPayload {
  brand: string;
  category: "attachment" | "excavator";
  url: string;
  deepScan?: boolean;      // 서브페이지 자동 탐색 여부
  maxSubpages?: number;    // Deep Scan 시 최대 서브페이지 수 (기본 30)
}

interface Dealer {
  company_name: string;
  country?: string;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
}

const DEALER_SCHEMA = {
  type: "object",
  properties: {
    dealers: {
      type: "array",
      items: {
        type: "object",
        properties: {
          company_name: { type: "string" },
          country: { type: "string" },
          city: { type: "string" },
          address: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
          website: { type: "string" },
        },
        required: ["company_name"],
      },
    },
  },
  required: ["dealers"],
};

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

Deno.serve(async (req) => {
  // CORS preflight
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  // Auth
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response("Missing auth", { status: 401, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  // 서버사이드: secret key 우선, legacy service_role 차선
  const serverKey =
    Deno.env.get("SECRET_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");

  if (!firecrawlKey) {
    return new Response(JSON.stringify({ error: "FIRECRAWL_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  // Service-role 클라이언트 (RLS 우회 + 유저 토큰 검증 가능)
  const supabase = createClient(supabaseUrl, serverKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 명시적으로 사용자 JWT 검증
  const userToken = authHeader.replace(/^Bearer\s+/i, "");
  const { data: userResult, error: userError } = await supabase.auth.getUser(userToken);
  const user = userResult?.user;
  if (!user) {
    return new Response(
      JSON.stringify({ error: "Unauthorized", detail: userError?.message }),
      { status: 401, headers: { ...corsHeaders, "content-type": "application/json" } },
    );
  }

  let payload: CrawlPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400, headers: corsHeaders });
  }

  const { brand, category, url, deepScan = false, maxSubpages = 30 } = payload;
  if (!brand || !category || !url) {
    return new Response("Missing fields: brand, category, url", { status: 400, headers: corsHeaders });
  }

  const encoder = new TextEncoder();

  // Firecrawl 호출 헬퍼 (json + optional links 추출)
  async function firecrawlScrape(pageUrl: string, withLinks = false): Promise<{ dealers: Dealer[]; links: string[] }> {
    const formats: unknown[] = [
      {
        type: "json",
        schema: DEALER_SCHEMA,
        prompt:
          "Extract all dealer/distributor information from this page. For each dealer, extract: company_name, country, city, address, phone, email, website. Be thorough — extract ALL dealers visible, including those in lists, tables, or maps.",
      },
    ];
    if (withLinks) formats.push("links");

    const resp = await fetch(FIRECRAWL_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${firecrawlKey}` },
      body: JSON.stringify({ url: pageUrl, formats }),
    });
    if (!resp.ok) throw new Error(`Firecrawl ${resp.status}: ${await resp.text()}`);
    const data = await resp.json();
    return {
      dealers: (data?.data?.json?.dealers || []) as Dealer[],
      links: (data?.data?.links || []) as string[],
    };
  }

  // 링크 필터 — 소스 URL의 경로로 시작하는 하위 URL만 (국가 페이지 등)
  function filterSubpages(baseUrl: string, links: string[]): string[] {
    try {
      const base = new URL(baseUrl);
      const basePath = base.pathname.endsWith("/") ? base.pathname : base.pathname + "/";
      const out = new Set<string>();
      for (const raw of links) {
        try {
          const u = new URL(raw, baseUrl);
          if (u.origin !== base.origin) continue;
          if (!u.pathname.startsWith(basePath)) continue;
          if (u.pathname === basePath) continue;  // self
          // 해시/쿼리 제거된 깨끗한 URL
          out.add(`${u.origin}${u.pathname}`);
        } catch { /* skip malformed */ }
      }
      return Array.from(out);
    } catch { return []; }
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sseEvent(event, data)));
      };

      // 1) Create job record
      const { data: jobRow, error: jobError } = await supabase
        .from("dealer_crawl_jobs")
        .insert({
          user_id: user.id,
          brand,
          category,
          source_url: url,
          status: "running",
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (jobError || !jobRow) {
        send("error", { message: `Job 생성 실패: ${jobError?.message}` });
        controller.close();
        return;
      }

      const jobId = jobRow.id;
      send("status", { message: deepScan ? "Deep Scan 시작 (서브페이지 포함)" : "크롤링 시작", step: "init", jobId });

      // 전역 dedupe
      const seen = new Set<string>();
      let saved = 0;
      let totalFound = 0;

      async function processPage(pageUrl: string, withLinks: boolean): Promise<string[]> {
        const { dealers, links } = await firecrawlScrape(pageUrl, withLinks);
        totalFound += dealers.length;

        for (const d of dealers) {
          if (!d.company_name) continue;
          const key = `${d.company_name}::${d.country || ""}`.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);

          const { error: upsertErr } = await supabase
            .from("manufacturer_dealers")
            .upsert(
              {
                user_id: user.id,
                brand,
                category,
                company_name: d.company_name,
                country: d.country || null,
                city: d.city || null,
                address: d.address || null,
                phone: d.phone || null,
                email: d.email || null,
                website: d.website || null,
                source_url: pageUrl,
                raw_data: d,
                crawled_at: new Date().toISOString(),
              },
              { onConflict: "user_id,brand,company_name,country" },
            );

          if (!upsertErr) { saved++; send("dealer", d); }
        }
        return links;
      }

      try {
        // 2) 메인 페이지 처리
        send("status", { message: "메인 페이지 스크레이핑 중...", step: "scraping" });
        const mainLinks = await processPage(url, deepScan);

        // 3) Deep Scan 모드라면 서브페이지 순회
        if (deepScan) {
          const subpages = filterSubpages(url, mainLinks).slice(0, maxSubpages);
          send("status", {
            message: `${subpages.length}개 서브페이지 발견 (최대 ${maxSubpages}), 순회 중...`,
            step: "subpages",
            count: subpages.length,
          });

          for (let i = 0; i < subpages.length; i++) {
            const sub = subpages[i];
            send("status", {
              message: `서브페이지 ${i + 1}/${subpages.length}: ${sub}`,
              step: "scraping_sub",
              index: i + 1,
              total: subpages.length,
            });
            try {
              await processPage(sub, false);
            } catch (e: any) {
              send("status", { message: `서브페이지 실패: ${sub} (${e?.message || "err"})`, step: "sub_error" });
            }
          }
        }

        // 4) Update job + done
        await supabase
          .from("dealer_crawl_jobs")
          .update({
            status: "success",
            dealers_found: saved,
            finished_at: new Date().toISOString(),
          })
          .eq("id", jobId);

        send("done", { count: saved, total: totalFound });
        controller.close();
      } catch (err: any) {
        const message = err?.message || "Unknown error";
        await supabase
          .from("dealer_crawl_jobs")
          .update({
            status: "failed",
            error_message: message,
            finished_at: new Date().toISOString(),
          })
          .eq("id", jobId);

        send("error", { message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
  });
});
