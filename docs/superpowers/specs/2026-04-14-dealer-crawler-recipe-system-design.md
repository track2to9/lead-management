# Dealer Crawler Recipe System

**Date:** 2026-04-14
**Context:** 제조사 딜러 페이지는 사이트마다 구조가 제각각이라 단일 전략으로 커버 불가능. 사용자(무역회사 직원)가 레시피를 만들고 시스템이 학습/재사용하는 HITL(Human-in-the-loop) 설계.

## Problem

현재 Firecrawl 기반 `scrape` + Deep Scan으로는 아래 패턴을 해결 못 함:
- **지도 클릭형** (SANY): 세계 지도에서 국가를 클릭해야 딜러 정보 노출
- **드롭다운형** (Hyundai): `<select>` 옵션 선택 시 AJAX로 하단 목록 갱신
- **혼합형**: 한 사이트 안에서도 여러 패턴 공존
- **발견 어려움**: 글로벌 딜러 페이지 위치 자체를 찾기 힘든 경우

AI만으로 모든 케이스를 자동 판별하기 어려움 → 사용자 개입이 필요하되 **한 번만** 들게 하는 구조.

## Approach

**HITL + 학습형 레시피 시스템**
1. 사용자가 브랜드 URL 입력
2. 시스템이 전략 시도 (기본 → Deep Scan → Click/Select)
3. 결과 부족 시(딜러 5개 미만) 사용자가 전략/엘리먼트 지정
4. 성공하면 **레시피 DB 저장** → 다음엔 자동 재사용
5. 사이트 구조 변경 시에만 재구축 필요

**"결과 부족" 판단 기준**:
- 추출된 딜러 수 < 5 OR
- 추출된 딜러가 전부 제조사 본사 (예: "NPK JAPAN", "NPK Europe") 패턴
- 사용자가 명시적으로 "부족함" 버튼 클릭

## Architecture

```
[DealerCrawler UI]
  │
  ↓ URL/브랜드 입력
[Recipe lookup: dealer_crawl_recipes]
  │
  ├─ 있음 → 자동 실행 (execute)
  └─ 없음 → [Recipe Builder UI]
       ├─ 기본 크롤 시도
       ├─ 결과 평가 (충분/부족)
       ├─ 전략 선택 (4종)
       ├─ 엘리먼트 목록 → 사용자 선택
       ├─ AI 패턴 추론 (2개 클릭 → 전체 확장)
       ├─ 테스트 실행 (첫 3개)
       └─ 레시피 저장
  │
  ↓
[Edge Function: crawl-dealers]
  │
  ↓ 전략별 Firecrawl 호출
[Firecrawl v2 API]
  │
  ↓ SSE 스트림
[프론트 실시간 진행 로그]
  │
  ↓ 결과 저장
[manufacturer_dealers 테이블]
```

## Components

### 1. Strategy Library (MVP 4종)

| 전략 | 용도 | Firecrawl 매핑 |
|------|------|---------------|
| `basic` | 단일 페이지에 딜러 정보 다 있음 | scrape + json |
| `follow_links` | 메인에서 국가별 링크 → 각 페이지 (현 Deep Scan) | scrape + links, 필터 후 반복 scrape |
| `click_sequence` | 여러 엘리먼트 순차 클릭 (지도 마커 등) | scrape + actions [click, wait] |
| `select_dropdown` | 드롭다운에서 각 옵션 선택 | scrape + actions [executeJavascript, wait] |

**확장 (MVP 이후)**: `paginate`, `search_submit`, `custom_js`

### 2. Recipe Schema

**Table: `dealer_crawl_recipes`**

```sql
CREATE TABLE dealer_crawl_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,  -- NULL = 공통 레시피 (admin)
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

-- 같은 사용자/브랜드는 한 개만 (덮어쓰기)
CREATE UNIQUE INDEX idx_recipes_user_brand ON dealer_crawl_recipes(user_id, brand);
```

**`config` JSON 예시**:

```json
// basic
{}

// follow_links
{
  "link_filter": "/dealers/",
  "max_pages": 30
}

// click_sequence
{
  "click_selectors": [
    "a.country-link[data-country='de']",
    "a.country-link[data-country='fr']"
  ],
  "pattern": "a.country-link[data-country]",
  "wait_after_click_ms": 1000
}

// select_dropdown
{
  "select_selector": "#country-select",
  "option_values": ["de", "fr", "it"],
  "wait_after_select_ms": 1500
}
```

### 3. Recipe Builder UI

새 컴포넌트 `RecipeBuilder.tsx` — 기존 `DealerCrawler.tsx`를 수정하지 않고 신규 모드로 추가.

**좌측 패널** (제어):
- 브랜드, URL, 카테고리 입력
- "1. 기본 크롤 시도" 버튼
- 전략 라디오 선택 (`follow_links` | `click_sequence` | `select_dropdown`)
- "2. 선택한 전략 시도" 버튼
- "레시피 저장" 버튼

**우측 패널** (페이지 분석):
- Firecrawl에서 받은 HTML을 파싱해서 클릭 가능한 엘리먼트 목록 표시
- 엘리먼트 그룹핑 (비슷한 CSS 셀렉터끼리)
- 사용자가 2개 이상 선택 → AI가 공통 패턴 추론 → "이 패턴으로 N개 엘리먼트 자동 선택" 제안
- 결과 미리보기 (첫 3개 테스트 실행)

### 4. Element List Extraction (Edge Function 내)

사용자에게 보여줄 클릭 가능 엘리먼트 추출:

```typescript
// Edge Function: POST /functions/v1/analyze-page
// 입력: { url }
// 출력: { elements: [{ selector, text, type, group }] }

1. Firecrawl scrape {url, formats: ["html"]}
2. deno-dom으로 HTML 파싱
3. 선택자 후보 추출:
   - <a href>, <button>, <select>, [onclick], [role=button]
4. 각 엘리먼트의 CSS 셀렉터 + 텍스트 추출
5. 유사한 셀렉터끼리 그룹화
6. 반환
```

### 5. Pattern Inference (AI 활용)

사용자가 2개 이상 엘리먼트 선택 시, Claude API로 패턴 추론:

```
입력: [
  { selector: "a.country-link[data-country='de']", text: "Germany" },
  { selector: "a.country-link[data-country='fr']", text: "France" }
]

프롬프트: "이 두 엘리먼트의 공통 CSS 패턴을 추출해주세요.
다른 국가도 같은 패턴으로 표현될 것으로 추정됩니다."

출력: {
  "pattern": "a.country-link[data-country]",
  "expected_count_hint": "data-country 속성을 가진 모든 <a.country-link>"
}
```

프론트에서 HTML을 다시 쿼리해서 실제 매칭 엘리먼트 수 확인 → 사용자에게 "30개 매칭됨" 표시.

### 6. Execution Engine (Edge Function 확장)

기존 `crawl-dealers` 함수를 확장해서 `recipe_id`를 받으면 저장된 레시피 실행:

```typescript
interface CrawlPayload {
  brand: string;
  category: "attachment" | "excavator";
  url: string;

  // 다음 중 하나:
  recipe_id?: string;           // 저장된 레시피 실행
  strategy?: StrategyName;      // 즉석 실행
  config?: StrategyConfig;      // 즉석 실행 시 파라미터

  testMode?: boolean;           // 첫 3개만 실행
  force?: boolean;              // 24h 캐시 무시
}
```

**실행 로직**:
1. `recipe_id` 있으면 DB에서 로드
2. 전략에 맞는 실행 함수 호출:
   - `basic` → 기존 로직
   - `follow_links` → 기존 Deep Scan 로직
   - `click_sequence` → 새 로직 (Firecrawl actions)
   - `select_dropdown` → 새 로직
3. 각 페이지당 딜러 추출 → `manufacturer_dealers` upsert
4. 완료 시 레시피의 `last_success_at`, `last_dealer_count` 갱신

### 7. SSE Events (확장)

```
event: strategy_start { strategy, total_steps, estimated_credits }
event: step_start { index, total, label }
event: dealer { ...dealer }
event: step_done { index, dealers_in_step }
event: step_error { index, error }
event: strategy_done { dealers_saved, total_found, credits_used }
event: error { message }
```

### 8. 크레딧 예상 + 캐싱

**실행 전 예상** (Firecrawl v2 가격 기준, 2026년 4월):
```
basic: 5 credits (scrape + json)
follow_links: 5 + (max_pages × 5)
click_sequence: 5 + (click_selectors.length × 5)  // 각 click마다 1 scrape + 1 json
select_dropdown: 5 + (option_values.length × 5)
```

**주의**: Firecrawl actions (click, executeJavascript) 사용 시 추가 크레딧이 발생할 수 있음.
구현 시 실제 청구 내역 확인 필요. 현재는 보수적으로 page당 5로 추정.

**캐싱**:
- `manufacturer_dealers`에 `crawled_at` 있음 → 같은 user+brand+country 조합이 24h 이내면 skip
- 사용자 "강제 재크롤" 체크박스로 우회

### 9. Timeout 대응

Edge Function 400s 한계 대응:
- 예상 소요 시간 > 350s → UI에서 "배치 실행" 경고
- 진행 중 타임아웃 시 `dealer_crawl_jobs.status = 'partial'`, 저장된 만큼 유지
- 프론트에서 "이어서 실행" 버튼 (미처리 인덱스부터 재시작)

## Data Flow

### 첫 사용 (레시피 없음)

```
User: URL + Brand 입력
  ↓
Recipe Builder: Firecrawl scrape (basic)
  ↓ 결과 부족 (예: 5개)
User: "지도 클릭하기" 선택
  ↓
Edge Function: analyze-page → 엘리먼트 목록
  ↓
User: "Germany", "France" 선택
  ↓
AI: 공통 패턴 `a.country-link[data-country]` 추론 → 30개 매칭
  ↓
User: "테스트 실행 (3개만)" 클릭
  ↓
Edge Function: click_sequence로 3개 실행 → 결과 미리보기
  ↓
User: "OK, 저장"
  ↓
DB: dealer_crawl_recipes + 전체 30개 실행 결과 manufacturer_dealers
```

### 두 번째 사용 (레시피 있음)

```
User: Brand "SANY" 선택 → 자동 로드
  ↓
Edge Function: recipe 로드 → click_sequence 즉시 실행
  ↓
SSE: 실시간 진행 표시
  ↓
DB: 업데이트된 딜러 저장
```

## Error Handling

- **개별 페이지 실패**: `step_error` 이벤트, 다음 계속
- **3회 연속 실패**: 중단, 사용자에게 사이트 구조 바뀐 것 경고
- **Firecrawl 크레딧 부족**: 즉시 중단, 알림
- **패턴 추론 실패**: 사용자가 직접 CSS 셀렉터 입력 (escape hatch)
- **레시피로 0개 반환**: `verified=false`로 마킹 + 재구축 UI로 유도

## Testing Strategy

- **Edge Function 단위 테스트**: Deno test로 전략별 Firecrawl 호출 모킹
- **E2E 시나리오**: 실제 SPSENG 유스케이스 3개 (NPK=follow_links, SANY=click_sequence, Hyundai=select_dropdown)
- **회귀 방지**: 저장된 레시피를 CI에서 주기적으로 재실행, 딜러 수 기준 20% 이상 감소하면 알림 (사이트 구조 변경 감지)

## Files to Create/Modify

### 신규
- `admin/migrate_recipes.sql` — `dealer_crawl_recipes` 테이블 + 인덱스
- `portal/src/components/RecipeBuilder.tsx` — 레시피 빌드 UI
- `portal/src/lib/types.ts` — `DealerCrawlRecipe` 인터페이스 추가
- `supabase/functions/analyze-page/index.ts` — HTML 파싱 + 엘리먼트 추출

### 수정
- `portal/src/components/DealerCrawler.tsx` — 레시피 자동 로드/실행
- `supabase/functions/crawl-dealers/index.ts` — 4개 전략 지원, recipe_id 수신

## Out of Scope (MVP)

- 시각적 스크린샷 위 직접 클릭 (섹션 4 Option A/B/C)
- Paginate / Search 전략
- 커스텀 JavaScript 전략
- 관리자가 만든 공통 레시피 (user_id IS NULL) 배포/관리 UI
- 레시피 버전 관리 (현재는 덮어쓰기)
- CI 회귀 테스트 자동화 (수동 점검으로 시작)
- 다중 사용자 간 레시피 공유/마켓플레이스
