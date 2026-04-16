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

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const FIRECRAWL_URL = "https://api.firecrawl.dev/v2/scrape";

interface CrawlPayload {
  brand: string;
  category: "attachment" | "excavator";
  url: string;
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
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Auth
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response("Missing auth", { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");

  if (!firecrawlKey) {
    return new Response(JSON.stringify({ error: "FIRECRAWL_API_KEY not configured" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { authorization: authHeader } },
  });

  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult?.user;
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: CrawlPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { brand, category, url } = payload;
  if (!brand || !category || !url) {
    return new Response("Missing fields: brand, category, url", { status: 400 });
  }

  const encoder = new TextEncoder();

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
      send("status", { message: "크롤링 시작", step: "init", jobId });

      try {
        // 2) Call Firecrawl
        send("status", { message: "페이지 스크레이핑 중...", step: "scraping" });

        const firecrawlResp = await fetch(FIRECRAWL_URL, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${firecrawlKey}`,
          },
          body: JSON.stringify({
            url,
            formats: [
              {
                type: "json",
                schema: DEALER_SCHEMA,
                prompt:
                  "Extract all dealer/distributor information from this page. For each dealer, extract: company_name, country, city, address, phone, email, website. Be thorough — extract ALL dealers visible, including those in lists, tables, or maps.",
              },
            ],
          }),
        });

        if (!firecrawlResp.ok) {
          const errText = await firecrawlResp.text();
          throw new Error(`Firecrawl ${firecrawlResp.status}: ${errText}`);
        }

        const firecrawlData = await firecrawlResp.json();
        const dealers: Dealer[] = firecrawlData?.data?.json?.dealers || [];

        send("status", {
          message: `${dealers.length}개 딜러 발견, 저장 중...`,
          step: "extracting",
          count: dealers.length,
        });

        // 3) Dedupe
        const seen = new Set<string>();
        const unique = dealers.filter((d) => {
          if (!d.company_name) return false;
          const key = `${d.company_name}::${d.country || ""}`.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        // 4) Upsert dealers + stream each one
        let saved = 0;
        for (const d of unique) {
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
                source_url: url,
                raw_data: d,
                crawled_at: new Date().toISOString(),
              },
              { onConflict: "user_id,brand,company_name,country" },
            );

          if (!upsertErr) {
            saved++;
            send("dealer", d);
          }
        }

        // 5) Update job + send done
        await supabase
          .from("dealer_crawl_jobs")
          .update({
            status: "success",
            dealers_found: saved,
            finished_at: new Date().toISOString(),
          })
          .eq("id", jobId);

        send("done", { count: saved, total: unique.length });
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
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
