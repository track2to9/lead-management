# Dealer Crawler Recipe System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 제조사 딜러 페이지의 다양한 구조를 HITL(Human-in-the-loop) 레시피 시스템으로 커버하고, 성공한 전략은 브랜드별로 저장해 재사용한다.

**Architecture:** 기존 `crawl-dealers` Edge Function에 4개 전략(basic/follow_links/click_sequence/select_dropdown)을 추가하고, 레시피를 `dealer_crawl_recipes` 테이블에 저장. 별도 `analyze-page` 함수로 HTML에서 클릭 가능 엘리먼트를 추출, Claude로 공통 CSS 패턴 추론. 프론트엔드는 `RecipeBuilder.tsx` 컴포넌트로 단계별 UI 제공.

**Tech Stack:** Next.js 15 (App Router) + Ant Design, Supabase Edge Functions (Deno), Firecrawl v2 (scrape + actions), Claude API (pattern inference), PostgreSQL + RLS.

**Phases:**
- **Phase 1 (Tasks 1-4)**: DB + types + crawl-dealers 전략 라우팅 뼈대
- **Phase 2 (Tasks 5-7)**: `click_sequence`, `select_dropdown` 전략 구현
- **Phase 3 (Tasks 8-10)**: `analyze-page` Edge Function + 패턴 추론
- **Phase 4 (Tasks 11-15)**: `RecipeBuilder.tsx` UI
- **Phase 5 (Tasks 16-17)**: 레시피 자동 재사용 + 통합

각 Phase 끝에서 독립적으로 동작하는 기능이 생깁니다. Phase 1-2만 해도 기술 사용자는 CSS 셀렉터 직접 입력으로 사용 가능.

---

## Task 1: DB 마이그레이션 — `dealer_crawl_recipes` 테이블

**Files:**
- Create: `admin/migrate_recipes.sql`

- [ ] **Step 1: SQL 파일 작성**

`admin/migrate_recipes.sql` 생성:

```sql
-- dealer_crawl_recipes: 브랜드별 크롤링 레시피 저장
-- user_id IS NULL = 관리자가 만든 공통 레시피 (향후 기능)
-- 같은 user_id + brand 조합은 한 개만 존재 (덮어쓰기)

CREATE TABLE IF NOT EXISTS dealer_crawl_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  brand TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('attachment', 'excavator')),
  source_url TEXT NOT NULL,
  strategy TEXT NOT NULL CHECK (strategy IN ('basic', 'follow_links', 'click_sequence', 'select_dropdown')),
  config JSONB NOT NULL DEFAULT '{}',
  verified BOOLEAN DEFAULT false,
  last_success_at TIMESTAMPTZ,
  last_dealer_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_recipes_user_brand ON dealer_crawl_recipes(user_id, brand);
CREATE INDEX IF NOT EXISTS idx_recipes_brand ON dealer_crawl_recipes(brand);

ALTER TABLE dealer_crawl_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own or global recipes"
  ON dealer_crawl_recipes FOR SELECT
  USING (auth.role() = 'authenticated' AND (user_id = auth.uid() OR user_id IS NULL));

CREATE POLICY "Users insert own recipes"
  ON dealer_crawl_recipes FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND user_id = auth.uid());

CREATE POLICY "Users update own recipes"
  ON dealer_crawl_recipes FOR UPDATE
  USING (auth.role() = 'authenticated' AND user_id = auth.uid());

CREATE POLICY "Users delete own recipes"
  ON dealer_crawl_recipes FOR DELETE
  USING (auth.role() = 'authenticated' AND user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 2: Supabase Dashboard에서 실행**

1. https://supabase.com/dashboard/project/jktvqcubipmcpihzgbpz/sql/new 접속
2. `admin/migrate_recipes.sql` 전체 내용 붙여넣기
3. "Run" 클릭
4. "Success. No rows returned" 메시지 확인

- [ ] **Step 3: 테이블 생성 확인**

SQL Editor에서 실행:

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'dealer_crawl_recipes' ORDER BY ordinal_position;
```

Expected: 11개 행 (id, user_id, brand, category, source_url, strategy, config, verified, last_success_at, last_dealer_count, created_at, updated_at)

- [ ] **Step 4: 커밋**

```bash
git add admin/migrate_recipes.sql
git commit -m "feat(db): dealer_crawl_recipes table for HITL recipe storage"
```

---

## Task 2: TypeScript 타입 정의

**Files:**
- Modify: `portal/src/lib/types.ts:134-163` (ManufacturerDealer 인터페이스 바로 아래)

- [ ] **Step 1: `DealerCrawlRecipe` 인터페이스 추가**

`portal/src/lib/types.ts`의 `DealerCrawlJob` 인터페이스 바로 아래에 추가:

```typescript
export type DealerCrawlStrategy = "basic" | "follow_links" | "click_sequence" | "select_dropdown";

export interface DealerCrawlRecipeConfig {
  // follow_links
  link_filter?: string;
  max_pages?: number;
  // click_sequence
  click_selectors?: string[];
  pattern?: string;
  wait_after_click_ms?: number;
  // select_dropdown
  select_selector?: string;
  option_values?: string[];
  wait_after_select_ms?: number;
}

export interface DealerCrawlRecipe {
  id: string;
  user_id?: string | null;
  brand: string;
  category: "attachment" | "excavator";
  source_url: string;
  strategy: DealerCrawlStrategy;
  config: DealerCrawlRecipeConfig;
  verified: boolean;
  last_success_at?: string;
  last_dealer_count: number;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: 타입 체크**

```bash
cd portal && npx tsc --noEmit 2>&1 | head -5
```

Expected: (빈 출력 - 에러 없음)

- [ ] **Step 3: 커밋**

```bash
git add portal/src/lib/types.ts
git commit -m "feat(types): DealerCrawlRecipe + DealerCrawlStrategy types"
```

---

## Task 3: `crawl-dealers` Edge Function — payload 확장 + 전략 라우팅 뼈대

기존 함수는 `basic` + `deepScan` 플래그로 작동. 전략 라우팅 구조로 리팩터링하고 새 전략은 "not implemented" stub만 넣는다.

**Files:**
- Modify: `supabase/functions/crawl-dealers/index.ts`

- [ ] **Step 1: CrawlPayload 타입 확장**

기존:
```typescript
interface CrawlPayload {
  brand: string;
  category: "attachment" | "excavator";
  url: string;
  deepScan?: boolean;
  maxSubpages?: number;
}
```

로 바꿈:

```typescript
type StrategyName = "basic" | "follow_links" | "click_sequence" | "select_dropdown";

interface StrategyConfig {
  // follow_links
  link_filter?: string;
  max_pages?: number;
  // click_sequence
  click_selectors?: string[];
  pattern?: string;
  wait_after_click_ms?: number;
  // select_dropdown
  select_selector?: string;
  option_values?: string[];
  wait_after_select_ms?: number;
}

interface CrawlPayload {
  brand: string;
  category: "attachment" | "excavator";
  url: string;

  // 다음 중 하나:
  recipe_id?: string;      // 저장된 레시피 로드
  strategy?: StrategyName; // 즉석 전략
  config?: StrategyConfig; // 즉석 전략 파라미터

  testMode?: boolean;      // 첫 3개만 실행

  // 구버전 호환 (deprecated)
  deepScan?: boolean;
  maxSubpages?: number;
}
```

- [ ] **Step 2: payload 파싱 후 전략 확정 로직 추가**

payload 파싱 직후 (`const { brand, category, url, deepScan = false, maxSubpages = 30 } = payload;` 부분) 를 교체:

```typescript
const { brand, category, url } = payload;
if (!brand || !category || !url) {
  return new Response("Missing fields: brand, category, url", { status: 400, headers: corsHeaders });
}

// 레시피 ID가 있으면 DB에서 로드
let strategy: StrategyName;
let config: StrategyConfig;
let recipeId: string | null = payload.recipe_id ?? null;

if (payload.recipe_id) {
  const { data: recipe, error } = await supabase
    .from("dealer_crawl_recipes")
    .select("strategy, config")
    .eq("id", payload.recipe_id)
    .single();
  if (error || !recipe) {
    return new Response(
      JSON.stringify({ error: "Recipe not found", detail: error?.message }),
      { status: 404, headers: { ...corsHeaders, "content-type": "application/json" } },
    );
  }
  strategy = recipe.strategy as StrategyName;
  config = (recipe.config || {}) as StrategyConfig;
} else if (payload.strategy) {
  strategy = payload.strategy;
  config = payload.config ?? {};
} else {
  // 구버전 호환: deepScan=true → follow_links, else basic
  strategy = payload.deepScan ? "follow_links" : "basic";
  config = payload.deepScan ? { max_pages: payload.maxSubpages ?? 30 } : {};
}

const testMode = payload.testMode ?? false;
```

- [ ] **Step 3: 전략 디스패치 뼈대 추가**

기존 `const stream = new ReadableStream({ async start(controller) {...` 블록 안에서:

1. 기존 크롤 로직(Firecrawl 호출부터 완료까지)을 함수로 추출: `async function runBasic()`, `async function runFollowLinks()`
2. 새 함수 stub 추가: `async function runClickSequence()`, `async function runSelectDropdown()` — 지금은 `send("error", { message: "Strategy not implemented" })` 만 송출

**기존 크롤 로직을 함수로 추출:**

`try { ... }` 블록 안의 코드를 다음 구조로 변경:

```typescript
try {
  switch (strategy) {
    case "basic":
      await runBasic();
      break;
    case "follow_links":
      await runFollowLinks();
      break;
    case "click_sequence":
      await runClickSequence();
      break;
    case "select_dropdown":
      await runSelectDropdown();
      break;
    default:
      throw new Error(`Unknown strategy: ${strategy}`);
  }

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
  // 기존 에러 처리 동일
}
```

`runBasic()`은 기존 메인 페이지 처리 로직 1번만 실행 (`processPage(url, false)`).
`runFollowLinks()`는 기존 deepScan 경로 전체 (메인 + 서브페이지들).
`runClickSequence()`, `runSelectDropdown()`는 아래처럼 stub:

```typescript
async function runClickSequence() {
  throw new Error("click_sequence not yet implemented");
}

async function runSelectDropdown() {
  throw new Error("select_dropdown not yet implemented");
}
```

- [ ] **Step 4: 배포**

```bash
cd /Users/youngminkim/Sites/lead-management
supabase functions deploy crawl-dealers --no-verify-jwt 2>&1 | tail -3
```

Expected: "Deployed Functions on project jktvqcubipmcpihzgbpz: crawl-dealers"

- [ ] **Step 5: 회귀 테스트 — 기존 기능 동작 확인**

브라우저에서 기존 대로 작동하는지:

1. `cd portal && npm run dev` 실행
2. http://localhost:3000/dashboard/project/{projectId} 접속
3. "제조사 딜러" 탭 → "Rammer" 프리셋 → **Deep Scan 없이** 크롤링 시작
4. 로그에 "크롤링 시작" → 딜러 발견 이벤트 → "완료" 나오는지 확인

Expected: 기존과 동일하게 작동 (Rammer ~300개 딜러 저장)

- [ ] **Step 6: 커밋**

```bash
git add supabase/functions/crawl-dealers/index.ts
git commit -m "refactor(edge): crawl-dealers strategy routing + recipe_id support"
```

---

## Task 4: `follow_links` 전략 — deepScan 로직 정리

Task 3에서 이미 추출했지만, recipe에서 불릴 때도 동작하도록 `config.link_filter`와 `config.max_pages` 사용하도록 한다.

**Files:**
- Modify: `supabase/functions/crawl-dealers/index.ts` (runFollowLinks 함수)

- [ ] **Step 1: runFollowLinks 확정**

```typescript
async function runFollowLinks() {
  send("status", { message: "메인 페이지 스크레이핑 중...", step: "scraping" });
  const mainLinks = await processPage(url, true);

  const maxPages = config.max_pages ?? 30;
  const filter = config.link_filter;

  let subpages = filterSubpages(url, mainLinks);
  if (filter) {
    subpages = subpages.filter((u) => u.includes(filter));
  }
  subpages = subpages.slice(0, maxPages);

  send("status", {
    message: `${subpages.length}개 서브페이지 발견 (최대 ${maxPages}), 순회 중...`,
    step: "subpages",
    count: subpages.length,
  });

  const iterLimit = testMode ? Math.min(3, subpages.length) : subpages.length;
  for (let i = 0; i < iterLimit; i++) {
    const sub = subpages[i];
    send("status", {
      message: `서브페이지 ${i + 1}/${iterLimit}: ${sub}`,
      step: "scraping_sub",
      index: i + 1,
      total: iterLimit,
    });
    try {
      await processPage(sub, false);
    } catch (e: any) {
      send("status", { message: `서브페이지 실패: ${sub} (${e?.message || "err"})`, step: "sub_error" });
    }
  }
}
```

- [ ] **Step 2: 배포**

```bash
supabase functions deploy crawl-dealers --no-verify-jwt 2>&1 | tail -3
```

- [ ] **Step 3: 회귀 테스트 — NPK Deep Scan**

브라우저에서 NPK 프리셋 선택 + Deep Scan 체크 → 크롤링. 서브페이지 순회 로그가 보이는지.

Expected: "서브페이지 N개 발견" 메시지 + 다수 딜러 수집

- [ ] **Step 4: 커밋**

```bash
git add supabase/functions/crawl-dealers/index.ts
git commit -m "refactor(edge): extract follow_links strategy + link_filter support"
```

---

## Task 5: `click_sequence` 전략 구현

Firecrawl scrape에 `actions: [{type: "click", selector}, {type: "wait", milliseconds}]`를 추가해서 각 엘리먼트 클릭 후 나타나는 정보를 추출한다.

**Files:**
- Modify: `supabase/functions/crawl-dealers/index.ts` (runClickSequence + firecrawlScrape 확장)

- [ ] **Step 1: firecrawlScrape를 actions 지원하도록 확장**

기존 `async function firecrawlScrape(pageUrl: string, withLinks = false)` 를 다음으로 교체:

```typescript
interface FirecrawlAction {
  type: "click" | "wait" | "executeJavascript";
  selector?: string;
  milliseconds?: number;
  script?: string;
}

async function firecrawlScrape(
  pageUrl: string,
  opts: { withLinks?: boolean; actions?: FirecrawlAction[] } = {},
): Promise<{ dealers: Dealer[]; links: string[] }> {
  const formats: unknown[] = [
    {
      type: "json",
      schema: DEALER_SCHEMA,
      prompt:
        "Extract all dealer/distributor information from this page. For each dealer, extract: company_name, country, city, address, phone, email, website. Be thorough — extract ALL dealers visible, including those in lists, tables, or maps.",
    },
  ];
  if (opts.withLinks) formats.push("links");

  const body: Record<string, unknown> = { url: pageUrl, formats };
  if (opts.actions && opts.actions.length > 0) body.actions = opts.actions;

  const resp = await fetch(FIRECRAWL_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${firecrawlKey}` },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`Firecrawl ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return {
    dealers: (data?.data?.json?.dealers || []) as Dealer[],
    links: (data?.data?.links || []) as string[],
  };
}
```

기존 호출부 `firecrawlScrape(pageUrl, withLinks)` 를 `firecrawlScrape(pageUrl, { withLinks })` 로 수정 (processPage 안).

- [ ] **Step 2: runClickSequence 구현**

```typescript
async function runClickSequence() {
  const selectors = config.click_selectors ?? [];
  if (selectors.length === 0) {
    throw new Error("click_sequence requires config.click_selectors");
  }

  const waitMs = config.wait_after_click_ms ?? 1000;
  const iterLimit = testMode ? Math.min(3, selectors.length) : selectors.length;

  send("status", {
    message: `Click Sequence 시작 (${iterLimit}/${selectors.length}개)`,
    step: "strategy_start",
    total: iterLimit,
  });

  for (let i = 0; i < iterLimit; i++) {
    const sel = selectors[i];
    send("status", {
      message: `${i + 1}/${iterLimit} 클릭: ${sel}`,
      step: "step_start",
      index: i + 1,
      total: iterLimit,
      label: sel,
    });

    try {
      const { dealers } = await firecrawlScrape(url, {
        actions: [
          { type: "click", selector: sel },
          { type: "wait", milliseconds: waitMs },
        ],
      });
      await saveDealers(dealers, url);
    } catch (e: any) {
      send("status", { message: `실패: ${sel} (${e?.message})`, step: "step_error", index: i + 1 });
    }
  }
}
```

- [ ] **Step 3: saveDealers 헬퍼 함수 추가 (processPage에서 dealer 저장 로직 추출)**

기존 `processPage` 함수에서 dealer 저장 부분을 다음 함수로 추출:

```typescript
async function saveDealers(dealers: Dealer[], pageUrl: string) {
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
}
```

그리고 `processPage` 내부에서 직접 dealer 저장하던 부분을 `await saveDealers(dealers, pageUrl)` 호출로 변경.

- [ ] **Step 4: 배포**

```bash
supabase functions deploy crawl-dealers --no-verify-jwt 2>&1 | tail -3
```

- [ ] **Step 5: 수동 테스트 (cURL)**

Supabase Dashboard > SQL Editor에서 사용자 ID 확인:
```sql
SELECT id, email FROM auth.users WHERE email = 'track2to9@gmail.com';
```

브라우저 DevTools > Application > Local Storage에서 `sb-*-auth-token` 의 `access_token` 복사.

터미널에서:
```bash
TOKEN="<복사한 토큰>"
APIKEY="<NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY 값>"
curl -N -X POST \
  "https://jktvqcubipmcpihzgbpz.supabase.co/functions/v1/crawl-dealers" \
  -H "Authorization: Bearer $TOKEN" \
  -H "apikey: $APIKEY" \
  -H "Content-Type: application/json" \
  -d '{
    "brand": "TestClickSeq",
    "category": "excavator",
    "url": "https://www.sanyglobal.com/network/",
    "strategy": "click_sequence",
    "config": {
      "click_selectors": ["a[href*=\"country\"]"],
      "wait_after_click_ms": 1500
    },
    "testMode": true
  }'
```

Expected: SSE 이벤트 스트림 — `status`, `dealer`, `done` 이벤트

- [ ] **Step 6: 커밋**

```bash
git add supabase/functions/crawl-dealers/index.ts
git commit -m "feat(edge): click_sequence strategy with Firecrawl actions"
```

---

## Task 6: `select_dropdown` 전략 구현

`<select>`의 value를 JS로 바꾸고 change 이벤트 발생시킨 뒤 AJAX 완료를 기다려 딜러 정보 수집.

**Files:**
- Modify: `supabase/functions/crawl-dealers/index.ts` (runSelectDropdown)

- [ ] **Step 1: runSelectDropdown 구현**

```typescript
async function runSelectDropdown() {
  const selectSel = config.select_selector;
  const options = config.option_values ?? [];

  if (!selectSel || options.length === 0) {
    throw new Error("select_dropdown requires config.select_selector + option_values");
  }

  const waitMs = config.wait_after_select_ms ?? 1500;
  const iterLimit = testMode ? Math.min(3, options.length) : options.length;

  send("status", {
    message: `Select Dropdown 시작 (${iterLimit}/${options.length}개)`,
    step: "strategy_start",
    total: iterLimit,
  });

  for (let i = 0; i < iterLimit; i++) {
    const opt = options[i];
    send("status", {
      message: `${i + 1}/${iterLimit} 선택: ${opt}`,
      step: "step_start",
      index: i + 1,
      total: iterLimit,
      label: opt,
    });

    try {
      const jsScript = `
        const sel = document.querySelector(${JSON.stringify(selectSel)});
        if (sel) {
          sel.value = ${JSON.stringify(opt)};
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
      `;
      const { dealers } = await firecrawlScrape(url, {
        actions: [
          { type: "executeJavascript", script: jsScript },
          { type: "wait", milliseconds: waitMs },
        ],
      });
      await saveDealers(dealers, url);
    } catch (e: any) {
      send("status", { message: `실패: ${opt} (${e?.message})`, step: "step_error", index: i + 1 });
    }
  }
}
```

- [ ] **Step 2: 배포**

```bash
supabase functions deploy crawl-dealers --no-verify-jwt 2>&1 | tail -3
```

- [ ] **Step 3: 수동 테스트 (Hyundai 시나리오)**

Task 5 방식으로 cURL:
```bash
curl -N -X POST \
  "https://jktvqcubipmcpihzgbpz.supabase.co/functions/v1/crawl-dealers" \
  -H "Authorization: Bearer $TOKEN" \
  -H "apikey: $APIKEY" \
  -H "Content-Type: application/json" \
  -d '{
    "brand": "TestDropdown",
    "category": "excavator",
    "url": "https://www.hyundai-ce.com/en/agency/overseas",
    "strategy": "select_dropdown",
    "config": {
      "select_selector": "#country",
      "option_values": ["US", "DE"],
      "wait_after_select_ms": 2000
    },
    "testMode": true
  }'
```

Expected: SSE 이벤트 — `step_start`, `dealer`, `step_error`(혹시), `done`

(실제 Hyundai selector는 다를 수 있으므로 "실패"로 나와도 로직이 동작하면 OK)

- [ ] **Step 4: 커밋**

```bash
git add supabase/functions/crawl-dealers/index.ts
git commit -m "feat(edge): select_dropdown strategy via executeJavascript"
```

---

## Task 7: 레시피 완료 시 last_success_at 업데이트

recipe_id로 실행한 경우 끝나면 레시피 통계 갱신.

**Files:**
- Modify: `supabase/functions/crawl-dealers/index.ts` (done 처리 부분)

- [ ] **Step 1: 레시피 통계 갱신 추가**

`try { switch (strategy) ... }` 블록의 success 처리 부분 (`await supabase.from("dealer_crawl_jobs").update(...)` 다음) 에 추가:

```typescript
// recipe_id로 실행한 경우 레시피 통계 갱신
if (recipeId) {
  await supabase
    .from("dealer_crawl_recipes")
    .update({
      last_success_at: new Date().toISOString(),
      last_dealer_count: saved,
      verified: saved > 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", recipeId);
}
```

- [ ] **Step 2: 배포 + 커밋**

```bash
supabase functions deploy crawl-dealers --no-verify-jwt 2>&1 | tail -3
git add supabase/functions/crawl-dealers/index.ts
git commit -m "feat(edge): update recipe stats after successful execution"
```

---

## Task 8: `analyze-page` Edge Function — 뼈대

HTML에서 클릭 가능 엘리먼트를 추출하는 별도 함수. Recipe Builder UI에서 호출.

**Files:**
- Create: `supabase/functions/analyze-page/index.ts`
- Create: `supabase/functions/analyze-page/README.md`
- Modify: `supabase/config.toml` (verify_jwt=false 등록)

- [ ] **Step 1: 함수 뼈대 작성**

`supabase/functions/analyze-page/index.ts` 생성:

```typescript
// Supabase Edge Function: analyze-page
//
// POST { url: string }
// Returns: { elements: [{ selector, text, type, group }] }
//
// Deploy: supabase functions deploy analyze-page --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DOMParser, type Element } from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";

const FIRECRAWL_URL = "https://api.firecrawl.dev/v2/scrape";

interface PageElement {
  selector: string;
  text: string;
  type: "link" | "button" | "select" | "option" | "other";
  group: string;    // CSS 패턴 공통화 (같은 group끼리 유사 엘리먼트)
  href?: string;
  value?: string;   // <option>의 value
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return jsonResponse({ error: "Missing auth" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serverKey = Deno.env.get("SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");

  if (!firecrawlKey) return jsonResponse({ error: "FIRECRAWL_API_KEY not configured" }, 500);

  const supabase = createClient(supabaseUrl, serverKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const userToken = authHeader.replace(/^Bearer\s+/i, "");
  const { data: userResult } = await supabase.auth.getUser(userToken);
  if (!userResult?.user) return jsonResponse({ error: "Unauthorized" }, 401);

  let payload: { url?: string };
  try { payload = await req.json(); } catch { return jsonResponse({ error: "Invalid JSON" }, 400); }

  const { url } = payload;
  if (!url) return jsonResponse({ error: "Missing url" }, 400);

  try {
    // Firecrawl로 HTML 가져오기
    const fcResp = await fetch(FIRECRAWL_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${firecrawlKey}` },
      body: JSON.stringify({ url, formats: ["html"] }),
    });
    if (!fcResp.ok) throw new Error(`Firecrawl ${fcResp.status}: ${await fcResp.text()}`);
    const fcData = await fcResp.json();
    const html = fcData?.data?.html as string | undefined;
    if (!html) return jsonResponse({ error: "No HTML returned" }, 502);

    const elements = extractElements(html);
    return jsonResponse({ elements });
  } catch (e: any) {
    return jsonResponse({ error: e?.message ?? "unknown" }, 500);
  }
});

function extractElements(_html: string): PageElement[] {
  // Task 9에서 구현
  return [];
}
```

- [ ] **Step 2: README 작성**

`supabase/functions/analyze-page/README.md`:

```markdown
# analyze-page Edge Function

Firecrawl로 페이지 HTML을 가져와 클릭 가능 엘리먼트 (`<a>`, `<button>`, `<select>` 등) 목록을 반환.

## Deploy

```bash
supabase functions deploy analyze-page --no-verify-jwt
```

(FIRECRAWL_API_KEY, SECRET_KEY 시크릿은 crawl-dealers와 공유)

## API

`POST /functions/v1/analyze-page`

Body: `{ url: string }`

Response:
```json
{
  "elements": [
    { "selector": "a.country-link[data-country='de']", "text": "Germany", "type": "link", "group": "a.country-link" }
  ]
}
```
```

- [ ] **Step 3: config.toml에 등록**

`supabase/config.toml`에 추가:

```toml
[functions.analyze-page]
verify_jwt = false
```

- [ ] **Step 4: 배포**

```bash
supabase functions deploy analyze-page --no-verify-jwt 2>&1 | tail -3
```

Expected: "Deployed Functions on project jktvqcubipmcpihzgbpz: analyze-page"

- [ ] **Step 5: 커밋**

```bash
git add supabase/functions/analyze-page/ supabase/config.toml
git commit -m "feat(edge): analyze-page function scaffold"
```

---

## Task 9: `extractElements` 구현 — HTML → 엘리먼트 목록

**Files:**
- Modify: `supabase/functions/analyze-page/index.ts` (extractElements 함수)

- [ ] **Step 1: CSS 셀렉터 생성 헬퍼**

`extractElements` 위에 추가:

```typescript
function buildSelector(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.getAttribute("id");
  if (id) return `${tag}#${id}`;

  const classList = (el.getAttribute("class") || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3);   // 최대 3개

  const classSel = classList.length ? "." + classList.join(".") : "";

  // 차별화 속성 (data-*, name, type, href host 등)
  let attrSel = "";
  for (const attr of ["data-country", "data-region", "data-id", "name", "type"]) {
    const v = el.getAttribute(attr);
    if (v) { attrSel = `[${attr}="${v}"]`; break; }
  }

  return `${tag}${classSel}${attrSel}`;
}

// 그룹 키 = 속성 값 제외한 셀렉터 (같은 클래스/태그 구조)
function groupKey(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const classList = (el.getAttribute("class") || "").split(/\s+/).filter(Boolean).slice(0, 3);
  const classSel = classList.length ? "." + classList.join(".") : "";
  return `${tag}${classSel}`;
}
```

- [ ] **Step 2: extractElements 구현**

```typescript
function extractElements(html: string): PageElement[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return [];

  const results: PageElement[] = [];

  // 1) <a href>
  for (const a of doc.querySelectorAll("a[href]")) {
    const el = a as Element;
    const text = (el.textContent || "").trim().slice(0, 100);
    if (!text) continue;
    results.push({
      selector: buildSelector(el),
      text,
      type: "link",
      group: groupKey(el),
      href: el.getAttribute("href") ?? undefined,
    });
  }

  // 2) <button>, [role=button]
  for (const b of doc.querySelectorAll("button, [role='button']")) {
    const el = b as Element;
    const text = (el.textContent || "").trim().slice(0, 100);
    if (!text) continue;
    results.push({
      selector: buildSelector(el),
      text,
      type: "button",
      group: groupKey(el),
    });
  }

  // 3) <select> — 셀렉트 자체
  for (const s of doc.querySelectorAll("select")) {
    const el = s as Element;
    results.push({
      selector: buildSelector(el),
      text: el.getAttribute("name") || el.getAttribute("id") || "select",
      type: "select",
      group: groupKey(el),
    });

    // 3-1) options도 별도 항목으로
    for (const opt of el.querySelectorAll("option")) {
      const optEl = opt as Element;
      const optText = (optEl.textContent || "").trim().slice(0, 100);
      const val = optEl.getAttribute("value");
      if (!val || !optText) continue;
      results.push({
        selector: `${buildSelector(el)} option[value="${val}"]`,
        text: optText,
        type: "option",
        group: buildSelector(el) + " option",
        value: val,
      });
    }
  }

  // 4) [onclick] — 기타 클릭 가능
  for (const c of doc.querySelectorAll("[onclick]")) {
    const el = c as Element;
    if (["a", "button"].includes(el.tagName.toLowerCase())) continue;  // 중복 방지
    const text = (el.textContent || "").trim().slice(0, 100);
    if (!text) continue;
    results.push({
      selector: buildSelector(el),
      text,
      type: "other",
      group: groupKey(el),
    });
  }

  return results;
}
```

- [ ] **Step 3: 배포**

```bash
supabase functions deploy analyze-page --no-verify-jwt 2>&1 | tail -3
```

- [ ] **Step 4: 수동 테스트 (cURL)**

```bash
curl -X POST \
  "https://jktvqcubipmcpihzgbpz.supabase.co/functions/v1/analyze-page" \
  -H "Authorization: Bearer $TOKEN" \
  -H "apikey: $APIKEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.npke.eu/dealers/"}' | jq '.elements[0:3]'
```

Expected: JSON 배열, 각 엘리먼트에 `selector`, `text`, `type`, `group` 포함

- [ ] **Step 5: 커밋**

```bash
git add supabase/functions/analyze-page/index.ts
git commit -m "feat(edge): extract clickable elements from HTML with CSS selector + grouping"
```

---

## Task 10: `infer-pattern` Edge Function — Claude로 CSS 패턴 추론

사용자가 2개 이상 셀렉터를 선택하면 Claude에게 공통 패턴 추론 요청.

**Files:**
- Create: `supabase/functions/infer-pattern/index.ts`
- Modify: `supabase/config.toml`

- [ ] **Step 1: 함수 작성**

`supabase/functions/infer-pattern/index.ts`:

```typescript
// Supabase Edge Function: infer-pattern
//
// POST { selectors: string[], texts: string[] }
// Returns: { pattern: string, hint: string }
//
// Deploy: supabase functions deploy infer-pattern --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CLAUDE_API = "https://api.anthropic.com/v1/messages";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return jsonResponse({ error: "Missing auth" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serverKey = Deno.env.get("SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

  if (!anthropicKey) return jsonResponse({ error: "ANTHROPIC_API_KEY not configured" }, 500);

  const supabase = createClient(supabaseUrl, serverKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const userToken = authHeader.replace(/^Bearer\s+/i, "");
  const { data: userResult } = await supabase.auth.getUser(userToken);
  if (!userResult?.user) return jsonResponse({ error: "Unauthorized" }, 401);

  let payload: { selectors?: string[]; texts?: string[] };
  try { payload = await req.json(); } catch { return jsonResponse({ error: "Invalid JSON" }, 400); }

  const selectors = payload.selectors ?? [];
  const texts = payload.texts ?? [];
  if (selectors.length < 2) return jsonResponse({ error: "Need at least 2 selectors" }, 400);

  const prompt = `주어진 CSS 셀렉터들의 공통 패턴을 추출해주세요. 다른 유사한 엘리먼트도 같은 패턴을 따른다고 가정합니다.

셀렉터 예시:
${selectors.map((s, i) => `${i + 1}. ${s}  (텍스트: ${texts[i] || "?"})`).join("\n")}

응답 형식 (JSON만):
{"pattern": "공통_CSS_셀렉터", "hint": "패턴 설명 한 줄"}

규칙:
- 속성 값(data-country='de' 같은 구체 값)은 제거
- 속성 키는 유지 ([data-country])
- 클래스와 태그는 유지`;

  try {
    const resp = await fetch(CLAUDE_API, {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!resp.ok) throw new Error(`Claude ${resp.status}: ${await resp.text()}`);
    const data = await resp.json();
    const text = data?.content?.[0]?.text ?? "";

    // JSON 추출
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`No JSON in response: ${text.slice(0, 200)}`);
    const parsed = JSON.parse(match[0]);

    return jsonResponse({
      pattern: parsed.pattern,
      hint: parsed.hint,
    });
  } catch (e: any) {
    return jsonResponse({ error: e?.message ?? "unknown" }, 500);
  }
});
```

- [ ] **Step 2: config.toml 등록**

```toml
[functions.infer-pattern]
verify_jwt = false
```

- [ ] **Step 3: ANTHROPIC_API_KEY secret 설정**

```bash
source /Users/youngminkim/Sites/lead-management/.env.local && \
  supabase secrets set ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY 2>&1 | tail -3
```

Expected: "Finished supabase secrets set."

- [ ] **Step 4: 배포**

```bash
supabase functions deploy infer-pattern --no-verify-jwt 2>&1 | tail -3
```

- [ ] **Step 5: 수동 테스트**

```bash
curl -X POST \
  "https://jktvqcubipmcpihzgbpz.supabase.co/functions/v1/infer-pattern" \
  -H "Authorization: Bearer $TOKEN" \
  -H "apikey: $APIKEY" \
  -H "Content-Type: application/json" \
  -d '{
    "selectors": [
      "a.country-link[data-country=\"de\"]",
      "a.country-link[data-country=\"fr\"]"
    ],
    "texts": ["Germany", "France"]
  }' | jq
```

Expected: `{"pattern": "a.country-link[data-country]", "hint": "..."}`

- [ ] **Step 6: 커밋**

```bash
git add supabase/functions/infer-pattern/ supabase/config.toml
git commit -m "feat(edge): infer-pattern function using Claude for CSS pattern extraction"
```

---

## Task 11: RecipeBuilder 컴포넌트 뼈대

기존 `DealerCrawler.tsx`와 별개로 새 UI 컴포넌트 생성. 일단 구조만 — 기본 크롤 시도까지 동작.

**Files:**
- Create: `portal/src/components/RecipeBuilder.tsx`

- [ ] **Step 1: 컴포넌트 스켈레톤**

```typescript
"use client";

import { useState } from "react";
import { Card, Input, Button, Select, Space, Typography, Radio, Alert, message } from "antd";
import { PlusOutlined, LoadingOutlined } from "@ant-design/icons";
import { supabaseClient } from "@/lib/supabase-client";
import type { DealerCrawlStrategy, DealerCrawlRecipeConfig } from "@/lib/types";

const { Text, Paragraph } = Typography;

interface Dealer {
  company_name: string;
  country?: string;
  city?: string;
  phone?: string;
  email?: string;
  website?: string;
}

interface LogLine {
  type: "status" | "dealer" | "done" | "error";
  message: string;
  timestamp: number;
}

type Stage = "input" | "basic_done" | "strategy_pick" | "element_pick" | "test_run" | "saved";

export default function RecipeBuilder() {
  const [stage, setStage] = useState<Stage>("input");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState<"attachment" | "excavator">("excavator");
  const [url, setUrl] = useState("");
  const [strategy, setStrategy] = useState<DealerCrawlStrategy>("follow_links");
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [foundDealers, setFoundDealers] = useState<Dealer[]>([]);
  const [crawling, setCrawling] = useState(false);

  function addLog(type: LogLine["type"], msg: string) {
    setLogs((p) => [...p, { type, message: msg, timestamp: Date.now() }]);
  }

  async function runCrawl(strat: DealerCrawlStrategy, config: DealerCrawlRecipeConfig, testMode: boolean) {
    setCrawling(true);
    setLogs([]);
    setFoundDealers([]);

    try {
      const { data: s } = await supabaseClient.auth.getSession();
      const token = s.session?.access_token;
      if (!token) { message.error("로그인 필요"); setCrawling(false); return; }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const apikey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
      const resp = await fetch(`${supabaseUrl}/functions/v1/crawl-dealers`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "apikey": apikey || "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ brand, category, url, strategy: strat, config, testMode }),
      });

      if (!resp.ok || !resp.body) {
        addLog("error", `요청 실패: ${resp.status} ${await resp.text()}`);
        setCrawling(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() || "";

        for (const part of parts) {
          const lines = part.split("\n");
          let ev = "", data = "";
          for (const l of lines) {
            if (l.startsWith("event: ")) ev = l.slice(7);
            else if (l.startsWith("data: ")) data = l.slice(6);
          }
          if (!ev || !data) continue;

          try {
            const parsed = JSON.parse(data);
            if (ev === "status") addLog("status", parsed.message);
            else if (ev === "dealer") { setFoundDealers((p) => [...p, parsed]); addLog("dealer", `✓ ${parsed.company_name}`); }
            else if (ev === "done") { addLog("done", `완료: ${parsed.count}개 저장`); }
            else if (ev === "error") addLog("error", parsed.message);
          } catch {}
        }
      }
    } catch (e: any) {
      addLog("error", e?.message ?? "unknown");
    } finally {
      setCrawling(false);
    }
  }

  async function handleBasic() {
    await runCrawl("basic", {}, false);
    setStage("basic_done");
  }

  return (
    <Card size="small" title="레시피 빌더">
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <div>
          <Text strong style={{ fontSize: 12 }}>브랜드</Text>
          <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="예: SANY" />
        </div>
        <div>
          <Text strong style={{ fontSize: 12 }}>카테고리</Text>
          <Select value={category} onChange={setCategory} style={{ width: "100%" }}
            options={[{ value: "attachment", label: "어태치먼트" }, { value: "excavator", label: "굴삭기" }]} />
        </div>
        <div>
          <Text strong style={{ fontSize: 12 }}>URL</Text>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
        </div>

        <Button type="primary" icon={crawling ? <LoadingOutlined /> : <PlusOutlined />}
          onClick={handleBasic} loading={crawling} disabled={!brand || !url} block>
          1. 기본 크롤 시도
        </Button>

        {stage === "basic_done" && (
          <Alert type={foundDealers.length < 5 ? "warning" : "success"}
            message={`${foundDealers.length}개 발견`}
            description={foundDealers.length < 5
              ? "결과가 부족합니다. 지도 클릭이나 드롭다운이 필요한 페이지일 수 있습니다."
              : "충분한 것 같습니다. 레시피로 저장하시겠어요?"} />
        )}

        {logs.length > 0 && (
          <Card size="small" title="진행 로그">
            <div style={{ maxHeight: 200, overflow: "auto", fontFamily: "monospace", fontSize: 11 }}>
              {logs.map((l, i) => (
                <div key={i} style={{
                  color: l.type === "error" ? "#ff4d4f" : l.type === "done" ? "#52c41a" : l.type === "dealer" ? "#1890ff" : "#666",
                }}>{l.message}</div>
              ))}
            </div>
          </Card>
        )}
      </Space>
    </Card>
  );
}
```

- [ ] **Step 2: DealerCrawler에 통합 (탭 전환)**

`portal/src/components/DealerCrawler.tsx` 최상단 주석 추가:

```typescript
// 기존 빠른 크롤 UI. 복잡한 사이트는 RecipeBuilder 컴포넌트 사용.
```

일단 RecipeBuilder는 별도 탭으로 추가하지 않고 다음 Task에서 project detail page에 붙임.

- [ ] **Step 3: 타입 체크**

```bash
cd portal && npx tsc --noEmit 2>&1 | head -5
```

Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add portal/src/components/RecipeBuilder.tsx portal/src/components/DealerCrawler.tsx
git commit -m "feat(ui): RecipeBuilder component skeleton with basic crawl"
```

---

## Task 12: RecipeBuilder — 전략 선택 + 엘리먼트 목록

basic 크롤 결과가 부족할 때 "다른 전략 시도" 플로우.

**Files:**
- Modify: `portal/src/components/RecipeBuilder.tsx`

- [ ] **Step 1: state 추가**

컴포넌트 상단 useState 추가:

```typescript
interface PageElement {
  selector: string;
  text: string;
  type: "link" | "button" | "select" | "option" | "other";
  group: string;
  href?: string;
  value?: string;
}

const [elements, setElements] = useState<PageElement[]>([]);
const [selectedSelectors, setSelectedSelectors] = useState<string[]>([]);
const [analyzing, setAnalyzing] = useState(false);
const [inferredPattern, setInferredPattern] = useState<string | null>(null);
const [matchingCount, setMatchingCount] = useState<number>(0);
```

- [ ] **Step 2: analyzePage 함수 추가**

`runCrawl` 함수 아래에 추가:

```typescript
async function analyzePage() {
  setAnalyzing(true);
  try {
    const { data: s } = await supabaseClient.auth.getSession();
    const token = s.session?.access_token;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const apikey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

    const resp = await fetch(`${supabaseUrl}/functions/v1/analyze-page`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "apikey": apikey || "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    });
    const data = await resp.json();
    if (data.error) throw new Error(data.error);
    setElements(data.elements || []);
  } catch (e: any) {
    message.error(`분석 실패: ${e?.message}`);
  } finally {
    setAnalyzing(false);
  }
}
```

- [ ] **Step 3: "전략 선택" 섹션 UI 추가**

`{stage === "basic_done" && ...}` Alert 다음에 추가:

```typescript
{stage === "basic_done" && foundDealers.length < 5 && (
  <Card size="small" title="2. 전략 선택">
    <Radio.Group value={strategy} onChange={(e) => setStrategy(e.target.value)}>
      <Space direction="vertical">
        <Radio value="follow_links">링크 따라가기 (하위 URL 순회)</Radio>
        <Radio value="click_sequence">지도/요소 클릭하기 (SANY 스타일)</Radio>
        <Radio value="select_dropdown">드롭다운 선택하기 (Hyundai 스타일)</Radio>
      </Space>
    </Radio.Group>

    {(strategy === "click_sequence" || strategy === "select_dropdown") && (
      <Button onClick={() => { analyzePage(); setStage("element_pick"); }}
        loading={analyzing} block style={{ marginTop: 12 }}>
        페이지 엘리먼트 분석
      </Button>
    )}

    {strategy === "follow_links" && (
      <Button type="primary" onClick={async () => {
        await runCrawl("follow_links", { max_pages: 10 }, true);
        setStage("test_run");
      }} block style={{ marginTop: 12 }}>
        Deep Scan 테스트 (10개)
      </Button>
    )}
  </Card>
)}
```

- [ ] **Step 4: 엘리먼트 목록 UI 추가**

위 Card 다음에:

```typescript
{stage === "element_pick" && elements.length > 0 && (
  <Card size="small" title="3. 엘리먼트 선택 (2개 이상)">
    <Paragraph type="secondary" style={{ fontSize: 11 }}>
      클릭할 엘리먼트를 2개 이상 선택하면 AI가 공통 패턴을 추론합니다.
    </Paragraph>
    <div style={{ maxHeight: 300, overflow: "auto" }}>
      {Object.entries(
        elements.reduce((acc, el) => {
          (acc[el.group] ||= []).push(el);
          return acc;
        }, {} as Record<string, PageElement[]>),
      ).map(([group, els]) => (
        <div key={group} style={{ marginBottom: 8 }}>
          <Text type="secondary" style={{ fontSize: 10 }}>{group} ({els.length})</Text>
          <div>
            {els.slice(0, 30).map((el) => (
              <Button key={el.selector} size="small"
                type={selectedSelectors.includes(el.selector) ? "primary" : "default"}
                style={{ margin: 2, fontSize: 11 }}
                onClick={() => {
                  setSelectedSelectors((prev) =>
                    prev.includes(el.selector)
                      ? prev.filter((s) => s !== el.selector)
                      : [...prev, el.selector]);
                }}>
                {el.text.slice(0, 20)}
              </Button>
            ))}
            {els.length > 30 && <Text type="secondary" style={{ fontSize: 10 }}>... +{els.length - 30}</Text>}
          </div>
        </div>
      ))}
    </div>
  </Card>
)}
```

- [ ] **Step 5: 타입 체크 + 커밋**

```bash
cd portal && npx tsc --noEmit 2>&1 | head -5
git add portal/src/components/RecipeBuilder.tsx
git commit -m "feat(ui): RecipeBuilder - strategy picker + element list"
```

---

## Task 13: RecipeBuilder — 패턴 추론 연결

선택한 2개 이상 엘리먼트를 `infer-pattern`에 보내 공통 패턴 얻고, 매칭 엘리먼트 수 표시.

**Files:**
- Modify: `portal/src/components/RecipeBuilder.tsx`

- [ ] **Step 1: inferPattern 함수 추가**

```typescript
async function inferPattern() {
  if (selectedSelectors.length < 2) { message.warning("2개 이상 선택"); return; }
  try {
    const { data: s } = await supabaseClient.auth.getSession();
    const token = s.session?.access_token;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const apikey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

    const texts = selectedSelectors.map((sel) => {
      const el = elements.find((e) => e.selector === sel);
      return el?.text ?? "";
    });

    const resp = await fetch(`${supabaseUrl}/functions/v1/infer-pattern`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "apikey": apikey || "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ selectors: selectedSelectors, texts }),
    });
    const data = await resp.json();
    if (data.error) throw new Error(data.error);
    setInferredPattern(data.pattern);

    // 매칭되는 엘리먼트 개수 계산
    const count = elements.filter((el) => el.group === elements.find((e) => e.selector === selectedSelectors[0])?.group).length;
    setMatchingCount(count);
  } catch (e: any) {
    message.error(`패턴 추론 실패: ${e?.message}`);
  }
}
```

- [ ] **Step 2: "패턴 추론" 버튼 + 결과 표시 추가**

엘리먼트 목록 Card 안쪽 (closing `</Card>` 직전):

```typescript
{selectedSelectors.length >= 2 && (
  <div style={{ marginTop: 12 }}>
    <Button onClick={inferPattern} type="dashed" block>
      패턴 추론하기 ({selectedSelectors.length}개 선택됨)
    </Button>
    {inferredPattern && (
      <Alert type="info" style={{ marginTop: 8 }}
        message={`추론된 패턴: ${inferredPattern}`}
        description={`이 페이지에서 ${matchingCount}개 엘리먼트가 매칭됩니다.`} />
    )}
  </div>
)}
```

- [ ] **Step 3: 타입 체크 + 커밋**

```bash
cd portal && npx tsc --noEmit 2>&1 | head -5
git add portal/src/components/RecipeBuilder.tsx
git commit -m "feat(ui): RecipeBuilder - pattern inference via infer-pattern edge function"
```

---

## Task 14: RecipeBuilder — 테스트 실행 + 저장

패턴 기반으로 전체 셀렉터 리스트를 만들고 `testMode: true`로 3개만 실행 → 결과 OK면 레시피 저장 + 전체 실행.

**Files:**
- Modify: `portal/src/components/RecipeBuilder.tsx`

- [ ] **Step 1: 매칭 엘리먼트 셀렉터 목록 생성**

`inferPattern` 함수 안 마지막에 실제 매칭 셀렉터 배열 생성:

```typescript
// 기존 count 계산 부분 교체:
const group = elements.find((e) => e.selector === selectedSelectors[0])?.group;
const matches = elements.filter((el) => el.group === group);
setMatchingCount(matches.length);
// 새 state: matched selectors list
setMatchedSelectors(matches.map((m) => m.selector));
```

state 추가:
```typescript
const [matchedSelectors, setMatchedSelectors] = useState<string[]>([]);
```

- [ ] **Step 2: 테스트 실행 + 전체 실행 버튼**

패턴 추론 Alert 다음에:

```typescript
{inferredPattern && matchedSelectors.length > 0 && (
  <Space style={{ marginTop: 8 }} wrap>
    <Button onClick={async () => {
      const config: DealerCrawlRecipeConfig =
        strategy === "click_sequence"
          ? { click_selectors: matchedSelectors, pattern: inferredPattern, wait_after_click_ms: 1000 }
          : strategy === "select_dropdown"
          ? { select_selector: matchedSelectors[0], option_values: matchedSelectors.map((s) => {
              const el = elements.find((e) => e.selector === s);
              return el?.value || "";
            }).filter(Boolean), wait_after_select_ms: 1500 }
          : {};
      await runCrawl(strategy, config, true);
      setStage("test_run");
    }} type="primary">
      테스트 실행 (3개만)
    </Button>
  </Space>
)}
```

- [ ] **Step 3: "레시피 저장" 섹션**

테스트 결과 긍정이면 저장 + 전체 실행:

```typescript
{stage === "test_run" && (
  <Card size="small" title="4. 저장 및 전체 실행">
    <Paragraph>테스트 결과가 괜찮으면 레시피를 저장하고 전체 실행합니다.</Paragraph>
    <Space>
      <Button type="primary" onClick={async () => {
        // 1) 레시피 저장
        const config: DealerCrawlRecipeConfig =
          strategy === "click_sequence"
            ? { click_selectors: matchedSelectors, pattern: inferredPattern ?? undefined, wait_after_click_ms: 1000 }
            : strategy === "select_dropdown"
            ? { select_selector: matchedSelectors[0], option_values: matchedSelectors.map((s) => {
                const el = elements.find((e) => e.selector === s);
                return el?.value || "";
              }).filter(Boolean), wait_after_select_ms: 1500 }
            : strategy === "follow_links"
            ? { max_pages: 30 }
            : {};

        const { data: s } = await supabaseClient.auth.getSession();
        const userId = s.session?.user.id;

        const { error } = await supabaseClient
          .from("dealer_crawl_recipes")
          .upsert({
            user_id: userId,
            brand, category, source_url: url, strategy, config,
            verified: true,
          }, { onConflict: "user_id,brand" });

        if (error) { message.error(`저장 실패: ${error.message}`); return; }
        message.success("레시피 저장됨");

        // 2) 전체 실행
        await runCrawl(strategy, config, false);
        setStage("saved");
      }}>
        저장 + 전체 실행
      </Button>
      <Button onClick={() => setStage("strategy_pick")}>전략 다시 선택</Button>
    </Space>
  </Card>
)}

{stage === "saved" && (
  <Alert type="success" message="레시피 저장 + 전체 크롤 완료"
    description={`${foundDealers.length}개 딜러 수집됨. 다음부터는 ${brand} 선택 시 자동 실행됩니다.`} />
)}
```

- [ ] **Step 4: 타입 체크 + 커밋**

```bash
cd portal && npx tsc --noEmit 2>&1 | head -5
git add portal/src/components/RecipeBuilder.tsx
git commit -m "feat(ui): RecipeBuilder - test run + recipe save + full execution"
```

---

## Task 15: RecipeBuilder를 project detail 탭에 추가

**Files:**
- Modify: `portal/src/app/dashboard/project/[id]/page.tsx`

- [ ] **Step 1: import 추가**

파일 상단 imports에 추가:

```typescript
import RecipeBuilder from "@/components/RecipeBuilder";
```

- [ ] **Step 2: 탭 추가**

기존 "제조사 딜러" 탭 정의 근처에 RecipeBuilder 탭 추가:

```typescript
{
  key: "recipe-builder",
  label: "레시피 빌더",
  children: <RecipeBuilder />,
},
```

- [ ] **Step 3: 실행 + 확인**

```bash
cd portal && npm run dev
```

브라우저 → 프로젝트 상세 → "레시피 빌더" 탭 클릭 → 폼 렌더링 확인.

- [ ] **Step 4: 커밋**

```bash
git add portal/src/app/dashboard/project/[id]/page.tsx
git commit -m "feat(ui): add RecipeBuilder tab to project detail page"
```

---

## Task 16: DealerCrawler — 저장된 레시피 자동 로드/실행

기존 "제조사 딜러" 탭 (DealerCrawler)에서 사용자가 프리셋 선택 시 `dealer_crawl_recipes`에서 해당 브랜드 레시피가 있으면 자동 적용.

**Files:**
- Modify: `portal/src/components/DealerCrawler.tsx`

- [ ] **Step 1: import + state 추가**

상단 import:
```typescript
import type { DealerCrawlRecipe } from "@/lib/types";
```

컴포넌트 내부 state:
```typescript
const [savedRecipe, setSavedRecipe] = useState<DealerCrawlRecipe | null>(null);
```

- [ ] **Step 2: brand 변경 시 레시피 조회**

`useEffect` 추가:

```typescript
useEffect(() => {
  if (!brand) { setSavedRecipe(null); return; }
  (async () => {
    const { data } = await supabaseClient
      .from("dealer_crawl_recipes")
      .select("*")
      .eq("brand", brand)
      .maybeSingle();
    setSavedRecipe(data as DealerCrawlRecipe | null);
  })();
}, [brand]);
```

import: `import { useEffect, useState } from "react";`

- [ ] **Step 3: 저장된 레시피 알림 + 자동 실행 버튼**

기본 입력 폼 아래 (크롤 시작 버튼 위):

```typescript
{savedRecipe && (
  <Alert
    type="success"
    message={`저장된 레시피 있음: ${savedRecipe.strategy}`}
    description={`마지막 성공 ${savedRecipe.last_success_at?.split("T")[0] ?? "-"}, ${savedRecipe.last_dealer_count}개 수집`}
    action={
      <Button size="small" type="primary" onClick={async () => {
        setCrawling(true);
        setLogs([]);
        setFoundDealers([]);

        const { data: s } = await supabaseClient.auth.getSession();
        const token = s.session?.access_token;
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const apikey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

        const resp = await fetch(`${supabaseUrl}/functions/v1/crawl-dealers`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "apikey": apikey || "",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            brand: savedRecipe.brand,
            category: savedRecipe.category,
            url: savedRecipe.source_url,
            recipe_id: savedRecipe.id,
          }),
        });

        if (!resp.ok || !resp.body) {
          addLog("error", `요청 실패: ${resp.status}`);
          setCrawling(false);
          return;
        }

        // 기존 SSE 처리 재사용 (startCrawl 내부 reader 로직과 동일)
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split("\n\n");
          buf = parts.pop() || "";
          for (const part of parts) {
            const lines = part.split("\n");
            let ev = "", data = "";
            for (const l of lines) {
              if (l.startsWith("event: ")) ev = l.slice(7);
              else if (l.startsWith("data: ")) data = l.slice(6);
            }
            if (!ev || !data) continue;
            try {
              const parsed = JSON.parse(data);
              if (ev === "status") addLog("status", parsed.message);
              else if (ev === "dealer") { setFoundDealers((p) => [...p, parsed]); addLog("dealer", `✓ ${parsed.company_name}`); }
              else if (ev === "done") addLog("done", `완료: ${parsed.count}개`);
              else if (ev === "error") addLog("error", parsed.message);
            } catch {}
          }
        }
        void dq.refetch();
        setCrawling(false);
      }}>
        레시피로 실행
      </Button>
    }
  />
)}
```

- [ ] **Step 4: 타입 체크 + 커밋**

```bash
cd portal && npx tsc --noEmit 2>&1 | head -5
git add portal/src/components/DealerCrawler.tsx
git commit -m "feat(ui): DealerCrawler auto-loads and runs saved recipe for brand"
```

---

## Task 17: 최종 E2E 테스트 + 커밋

**Files:** (none, 수동 테스트)

- [ ] **Step 1: NPK 시나리오 (follow_links)**

1. 프로젝트 상세 → "레시피 빌더" 탭
2. 브랜드 "NPK", 카테고리 "어태치먼트", URL `https://www.npke.eu/dealers/`
3. "기본 크롤 시도" → 5개 미만 예상
4. "링크 따라가기" 선택 → "Deep Scan 테스트 (10개)" → 결과 미리보기
5. "저장 + 전체 실행" → 레시피 저장 + 대부분 국가 페이지 순회
6. "제조사 딜러" 탭 → "NPK" 프리셋 선택 → "레시피로 실행" 버튼 나타남 → 클릭 → 자동 실행

- [ ] **Step 2: SANY 시나리오 (click_sequence)**

1. 레시피 빌더 → 브랜드 "SANY", URL `https://www.sanyglobal.com/network/`
2. 기본 크롤 → 부족
3. "지도/요소 클릭하기" 선택 → "페이지 엘리먼트 분석"
4. 지도의 국가 2개 클릭 선택 → "패턴 추론하기"
5. 매칭 개수 확인 → "테스트 실행 (3개)"
6. OK면 "저장 + 전체 실행"

- [ ] **Step 3: Hyundai 시나리오 (select_dropdown)**

1. 브랜드 "HYUNDAI", URL `https://www.hyundai-ce.com/en/agency/overseas`
2. 기본 크롤 부족
3. "드롭다운 선택" → 페이지 분석 → `<option>` 2개 선택
4. 패턴 추론 (같은 select 내 option들) → 테스트 실행 → 저장

- [ ] **Step 4: push**

```bash
git push origin main
```

- [ ] **Step 5: 이슈/PR 없는 경우 종료 확인**

실제 사용 시나리오 1개만 성공하면 MVP 목표 달성. 부분 실패는 후속 이슈로 문서화:
- Firecrawl actions 크레딧 실측 필요
- 사이트 구조 크게 다른 케이스 (지도가 canvas/WebGL)
- 국가 코드 표준화 (같은 "Germany"가 "DE"/"de"/"Deutschland" 등)

---

## Self-Review

### Spec coverage
- ✅ 전략 라이브러리 4종: Tasks 3-6
- ✅ Recipe Schema: Task 1, 2
- ✅ Recipe Builder UI: Tasks 11-15
- ✅ Element List Extraction: Tasks 8-9
- ✅ Pattern Inference: Task 10
- ✅ Execution Engine: Tasks 3-7
- ✅ SSE Events: Tasks 5, 6 (이벤트 종류 확장)
- ✅ 크레딧 예상: UI에 노출은 생략 (Out of Scope로 볼 수 있음)
- ✅ Timeout 대응: testMode로 부분 실행 대체
- ✅ 저장된 레시피 자동 로드/실행: Task 16
- ✅ 에러 처리: 기존 SSE 에러 이벤트 + UI 로그

**Gap**: "크레딧 예상 표시" UI는 생략됨 (Out of Scope 간주). Spec에서는 언급하지만 MVP 기본 동작에 필수 아님.

### Placeholder scan
- 모든 Step에 실제 코드/명령이 들어감. TODO 없음.

### Type consistency
- `DealerCrawlStrategy`, `DealerCrawlRecipeConfig`, `DealerCrawlRecipe` — Task 2에서 정의, Tasks 11-16에서 그대로 사용. ✅
- Edge Function의 `StrategyName`, `StrategyConfig` — Task 3에서 정의, 이후 일관. ✅
- `PageElement` 구조 — Task 8/9 (Edge Function) vs Task 12 (Client) 동일 필드. ✅

### 의존성 그래프

Tasks 1-2 (독립) → Task 3 → Tasks 4-7 (independent siblings, 순서 무관하지만 크롤러 수정) → Tasks 8-9 → Task 10 → Tasks 11-15 (UI 점진적) → Tasks 16-17.

Phase별 독립 가치:
- Phase 1-2 (Tasks 1-7): 기술자용. cURL로 레시피 실행 가능
- Phase 3 (Tasks 8-10): analyze-page API 사용 가능
- Phase 4 (Tasks 11-15): Recipe Builder 완성
- Phase 5 (Tasks 16-17): 최종 사용자 경험 완성
