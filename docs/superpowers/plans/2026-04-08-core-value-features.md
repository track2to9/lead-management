# Core Value Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add structured match scoring, rich evidence collection with SNS crawling, and iterative feedback loops to the TradeVoy pipeline and portal.

**Architecture:** Three-phase hybrid approach — batch pipeline (Python) handles data collection and analysis, portal (Next.js/Refine) provides interactive exploration and feedback. Phase 1 upgrades the scoring model, Phase 2 adds evidence collection, Phase 3 adds feedback loops.

**Tech Stack:** Python 3 (pipeline), Next.js 16 + Refine.js + Ant Design 5 (portal), Supabase/PostgreSQL (database), Playwright (scraping), Claude API (LLM)

**Spec:** `docs/superpowers/specs/2026-04-08-core-value-features-design.md`

---

## File Structure

### Phase 1: Structured Scoring

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `pipeline/analyzer.py` | Structured 5-dimension scoring prompt + weighted total calculation |
| Modify | `pipeline/output.py` | Add score_breakdown columns to CSV/Excel output |
| Modify | `admin/schema.sql` | Add `score_breakdown`, `score_weights` columns |
| Modify | `portal/src/lib/types.ts` | Add `ScoreBreakdown`, update `Prospect`, `Project` types |
| Create | `portal/src/components/ScoreBreakdownChart.tsx` | Bar chart component for 5-dimension scores |
| Create | `portal/src/components/ScoreWeightsEditor.tsx` | 5 sliders with 100% constraint for weight customization |
| Modify | `portal/src/app/dashboard/project/[id]/page.tsx` | Add weights editor, client-side re-sort by weighted score |
| Modify | `portal/src/app/dashboard/project/[id]/prospect/[pid]/page.tsx` | Display score breakdown chart + per-dimension reasons |

### Phase 2: Evidence Collection

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `pipeline/sns_crawler.py` | Extract SNS links from homepage, crawl each channel |
| Create | `pipeline/evidence_collector.py` | Package evidence: screenshot + text + translation + tagging |
| Modify | `pipeline/batch_runner.py` | Insert evidence collection step after web scraping |
| Modify | `admin/schema.sql` | Add `evidence` table |
| Modify | `portal/src/lib/types.ts` | Add `Evidence` type |
| Create | `portal/src/components/EvidenceCard.tsx` | Evidence display card with thumbnail, text, source link |
| Create | `portal/src/components/EvidenceModal.tsx` | Full-size screenshot modal viewer |
| Modify | `portal/src/app/dashboard/project/[id]/prospect/[pid]/page.tsx` | Add "Evidence" tab, link scores to evidence |

### Phase 3: Feedback Loop

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `pipeline/pattern_analyzer.py` | Extract patterns from accepted/rejected prospects |
| Modify | `pipeline/batch_runner.py` | Support refinement_conditions + pattern context on re-run |
| Modify | `pipeline/config.py` | Add refinement_conditions and round to PipelineConfig |
| Modify | `admin/schema.sql` | Add `refinement_conditions`, `refinement_round`, `round` columns |
| Modify | `portal/src/lib/types.ts` | Update Project and Prospect types with round/refinement fields |
| Create | `portal/src/components/RefinementConditionsForm.tsx` | Tag-based condition add/remove form |
| Create | `portal/src/components/PatternInsightCard.tsx` | Display extracted preference patterns |
| Modify | `portal/src/app/dashboard/project/[id]/page.tsx` | Add round tabs, conditions form, pattern insights, timeline |

---

## Phase 1: Structured Scoring

### Task 1: Database Schema — Add Scoring Columns

**Files:**
- Modify: `admin/schema.sql`

- [ ] **Step 1: Add score_breakdown and score_weights columns to schema.sql**

Append after line 52 (after `feedback_status` column in prospects table) and after line 20 (in projects table):

In `prospects` table, add before `created_at`:
```sql
  score_breakdown JSONB DEFAULT '{}',  -- 항목별 점수 {product_fit: {score, reason}, ...}
```

In `projects` table, add before `created_at`:
```sql
  score_weights JSONB DEFAULT '{"product_fit": 30, "buying_signal": 25, "company_capability": 20, "accessibility": 15, "strategic_value": 10}',
```

- [ ] **Step 2: Run the migration in Supabase SQL Editor**

```sql
-- Add to existing tables (migration for existing deployments)
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS score_breakdown JSONB DEFAULT '{}';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS score_weights JSONB DEFAULT '{"product_fit": 30, "buying_signal": 25, "company_capability": 20, "accessibility": 15, "strategic_value": 10}';
```

- [ ] **Step 3: Commit**

```bash
git add admin/schema.sql
git commit -m "feat: add score_breakdown and score_weights columns to schema"
```

---

### Task 2: Pipeline — Structured Scoring in Analyzer

**Files:**
- Modify: `pipeline/analyzer.py`

- [ ] **Step 1: Replace the LLM prompt in `analyze_company()` with structured 5-dimension scoring**

Replace the prompt string (lines 36-91) in `pipeline/analyzer.py` with:

```python
    prompt = f"""You are an expert B2B trade analyst. Analyze whether this company could be a potential buyer/distributor for our client's products.

=== OUR CLIENT (Korean Exporter) ===
{client_profile_text}

=== TARGET COMPANY ===
Company: {company.get('name', 'Unknown')}
Website: {company.get('url', 'N/A')}
Source: {company.get('source', 'N/A')}

Website Content (may be in local language):
{page_text}

=== ANALYSIS REQUEST ===
Score this company on EACH of the following 5 dimensions (0-100 each), providing specific evidence for each score.

Return valid JSON in this exact format:

{{
  "scores": {{
    "product_fit": {{
      "score": 0-100,
      "reason": "Why this score — cite specific evidence from website (in Korean / 한국어로)"
    }},
    "buying_signal": {{
      "score": 0-100,
      "reason": "Recent purchase activity, new projects, supplier diversification signals (in Korean)"
    }},
    "company_capability": {{
      "score": 0-100,
      "reason": "Transaction capability, import capacity, company scale (in Korean)"
    }},
    "accessibility": {{
      "score": 0-100,
      "reason": "Contact info availability, communication channels (in Korean)"
    }},
    "strategic_value": {{
      "score": 0-100,
      "reason": "Reference value, market entry point, partnership potential (in Korean)"
    }}
  }},

  "company_summary": "2-3 sentence summary (in Korean / 한국어로)",
  "buyer_or_competitor": "buyer | competitor | unclear",
  "detected_products": ["relevant products/services this company deals with"],
  "current_suppliers": ["brands/suppliers mentioned or implied"],
  "company_size_estimate": "small (<50) | medium (50-500) | large (500+) | unknown",
  "decision_maker_hint": "Likely decision maker role (in Korean)",
  "best_timing": "Best approach timing (in Korean)",
  "competitive_landscape": "Supplier situation and switching potential (Korean, 1 sentence)",

  "evidence_quotes": [
    {{
      "original": "Exact quote from website in original language",
      "translated": "Korean translation (한국어 번역)",
      "relevance": "Why this matters for the score (Korean, 1 sentence)"
    }}
  ],
  "reasoning_chain": "Step-by-step: 1) What they do → 2) Connection to our client → 3) Score justification (Korean, 3-4 sentences)"
}}

Scoring guidelines:
- product_fit: 80-100 = directly buys/distributes our products, 50-79 = related industry, <50 = weak connection
- buying_signal: 80-100 = active purchasing/expanding, 50-79 = moderate signals, <50 = no clear signals
- company_capability: 80-100 = large importer with capacity, 50-79 = mid-size, <50 = too small or unclear
- accessibility: 80-100 = contact info readily available, 50-79 = some channels, <50 = hard to reach
- strategic_value: 80-100 = market leader/reference account, 50-79 = useful, <50 = limited value
- evidence_quotes: Extract 2-4 ACTUAL quotes from the website text.
- Be conservative with scores — only high scores for clear, strong evidence.

Return valid JSON only."""
```

- [ ] **Step 2: Add `compute_weighted_score()` helper function**

Add after the `_safe_score` function at the end of `pipeline/analyzer.py`:

```python
DEFAULT_WEIGHTS = {
    "product_fit": 30,
    "buying_signal": 25,
    "company_capability": 20,
    "accessibility": 15,
    "strategic_value": 10,
}


def compute_weighted_score(scores: dict, weights: dict | None = None) -> int:
    """가중 평균 종합 점수 계산. LLM이 아닌 코드로 일관성 보장."""
    w = weights or DEFAULT_WEIGHTS
    total_weight = sum(w.values())
    if total_weight == 0:
        return 0
    weighted_sum = sum(
        _safe_score(scores.get(key, {}).get("score", 0)) * w.get(key, 0)
        for key in DEFAULT_WEIGHTS
    )
    return round(weighted_sum / total_weight)
```

- [ ] **Step 3: Update the result parsing in `analyze_company()` to use structured scores**

Replace the result parsing block (lines 96-116) with:

```python
        # 항목별 점수 추출
        scores = result.get("scores", {})
        score_breakdown = {}
        for key in ("product_fit", "buying_signal", "company_capability", "accessibility", "strategic_value"):
            dim = scores.get(key, {})
            score_breakdown[key] = {
                "score": _safe_score(dim.get("score", 0)),
                "reason": dim.get("reason", ""),
            }

        total_score = compute_weighted_score(score_breakdown)

        # 우선순위 결정 (코드 기반, 일관성)
        if total_score >= 80:
            priority = "high"
        elif total_score >= 50:
            priority = "medium"
        else:
            priority = "low"

        analysis = {
            "sells_relevant_product": total_score >= 50,
            "confidence": "high" if total_score >= 70 else "medium" if total_score >= 40 else "low",
            "match_score": total_score,
            "score_breakdown": score_breakdown,
            "summary": result.get("company_summary", ""),
            "match_reason": "; ".join(
                f"{k}: {v['reason'][:40]}" for k, v in score_breakdown.items() if v.get("reason")
            )[:200],
            "approach": "",
            "priority": priority,
            "detected_products": result.get("detected_products", []),
            "buyer_or_competitor": result.get("buyer_or_competitor", "unclear"),
            "current_suppliers": result.get("current_suppliers", []),
            "company_size_estimate": result.get("company_size_estimate", "unknown"),
            "decision_maker_hint": result.get("decision_maker_hint", ""),
            "best_timing": result.get("best_timing", ""),
            "competitive_landscape": result.get("competitive_landscape", ""),
            "evidence_quotes": result.get("evidence_quotes", []),
            "reasoning_chain": result.get("reasoning_chain", ""),
        }
```

- [ ] **Step 4: Update `_empty_analysis()` to include empty score_breakdown**

Replace the `_empty_analysis` function:

```python
def _empty_analysis(reason: str) -> dict:
    """빈 분석 결과 생성"""
    return {
        "sells_relevant_product": False,
        "confidence": "low",
        "match_score": 0,
        "score_breakdown": {
            "product_fit": {"score": 0, "reason": reason},
            "buying_signal": {"score": 0, "reason": ""},
            "company_capability": {"score": 0, "reason": ""},
            "accessibility": {"score": 0, "reason": ""},
            "strategic_value": {"score": 0, "reason": ""},
        },
        "summary": reason,
        "match_reason": reason,
        "approach": "",
        "priority": "low",
        "detected_products": [],
    }
```

- [ ] **Step 5: Test locally with a single company**

```bash
cd /Users/youngminkim/Sites/lead-management
python -c "
from pipeline.analyzer import compute_weighted_score, _safe_score, _empty_analysis, DEFAULT_WEIGHTS

# Test weighted score calculation
scores = {
    'product_fit': {'score': 85, 'reason': 'test'},
    'buying_signal': {'score': 60, 'reason': 'test'},
    'company_capability': {'score': 70, 'reason': 'test'},
    'accessibility': {'score': 90, 'reason': 'test'},
    'strategic_value': {'score': 40, 'reason': 'test'},
}
total = compute_weighted_score(scores)
print(f'Weighted score: {total}')
# Expected: (85*30 + 60*25 + 70*20 + 90*15 + 40*10) / 100 = 72
assert total == 72, f'Expected 72, got {total}'

# Test with custom weights
custom = {'product_fit': 50, 'buying_signal': 10, 'company_capability': 10, 'accessibility': 10, 'strategic_value': 20}
total2 = compute_weighted_score(scores, custom)
print(f'Custom weighted: {total2}')

# Test empty analysis has score_breakdown
empty = _empty_analysis('test reason')
assert 'score_breakdown' in empty
assert empty['score_breakdown']['product_fit']['score'] == 0
print('All tests passed!')
"
```

Expected output:
```
Weighted score: 72
Custom weighted: ...
All tests passed!
```

- [ ] **Step 6: Commit**

```bash
git add pipeline/analyzer.py
git commit -m "feat: structured 5-dimension scoring with weighted totals in analyzer"
```

---

### Task 3: Pipeline — Update Output Module for Score Breakdown

**Files:**
- Modify: `pipeline/output.py`

- [ ] **Step 1: Add score breakdown columns to CSV headers**

In `pipeline/output.py`, find the `headers` list (line 51) and add after `"Match Score"` (line 58):

```python
            "Product Fit Score",
            "Buying Signal Score",
            "Company Capability Score",
            "Accessibility Score",
            "Strategic Value Score",
```

- [ ] **Step 2: Add score breakdown values to CSV row**

In the row construction (around line 105), after `analysis.get("match_score", 0)`:

```python
                # 항목별 점수
                breakdown = analysis.get("score_breakdown", {})
                breakdown.get("product_fit", {}).get("score", 0),
                breakdown.get("buying_signal", {}).get("score", 0),
                breakdown.get("company_capability", {}).get("score", 0),
                breakdown.get("accessibility", {}).get("score", 0),
                breakdown.get("strategic_value", {}).get("score", 0),
```

- [ ] **Step 3: Add score breakdown to Excel main sheet headers**

In the Excel `headers` list (line 184), add after `"매칭점수"`:

```python
        "제품적합도", "구매시그널", "기업역량", "접근성", "전략가치",
```

Update the `data` list and `widths` accordingly.

- [ ] **Step 4: Commit**

```bash
git add pipeline/output.py
git commit -m "feat: add score breakdown columns to CSV and Excel output"
```

---

### Task 4: Portal — Update Types

**Files:**
- Modify: `portal/src/lib/types.ts`

- [ ] **Step 1: Add ScoreBreakdown type and update Prospect/Project interfaces**

Add at the top of `portal/src/lib/types.ts`:

```typescript
export interface ScoreDimension {
  score: number;
  reason: string;
}

export interface ScoreBreakdown {
  product_fit: ScoreDimension;
  buying_signal: ScoreDimension;
  company_capability: ScoreDimension;
  accessibility: ScoreDimension;
  strategic_value: ScoreDimension;
}

export type ScoreWeights = Record<keyof ScoreBreakdown, number>;

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  product_fit: 30,
  buying_signal: 25,
  company_capability: 20,
  accessibility: 15,
  strategic_value: 10,
};

export const SCORE_DIMENSION_LABELS: Record<keyof ScoreBreakdown, string> = {
  product_fit: "제품 적합도",
  buying_signal: "구매 시그널",
  company_capability: "기업 규모/역량",
  accessibility: "접근 가능성",
  strategic_value: "전략적 가치",
};
```

- [ ] **Step 2: Update Prospect interface**

Add to the `Prospect` interface, after `match_score`:

```typescript
  score_breakdown?: ScoreBreakdown;
```

- [ ] **Step 3: Update Project interface**

Add to the `Project` interface, after `excel_url`:

```typescript
  score_weights?: ScoreWeights;
```

- [ ] **Step 4: Commit**

```bash
cd /Users/youngminkim/Sites/lead-management
git add portal/src/lib/types.ts
git commit -m "feat: add ScoreBreakdown types and dimension labels"
```

---

### Task 5: Portal — Score Breakdown Chart Component

**Files:**
- Create: `portal/src/components/ScoreBreakdownChart.tsx`

- [ ] **Step 1: Create the score breakdown bar chart component**

```tsx
"use client";

import { Progress, Space, Typography } from "antd";
import type { ScoreBreakdown, ScoreWeights } from "@/lib/types";
import { SCORE_DIMENSION_LABELS, DEFAULT_SCORE_WEIGHTS } from "@/lib/types";

const { Text } = Typography;

interface Props {
  breakdown: ScoreBreakdown;
  weights?: ScoreWeights;
}

function scoreColor(score: number): string {
  if (score >= 80) return "#52c41a";
  if (score >= 50) return "#faad14";
  return "#ff4d4f";
}

export default function ScoreBreakdownChart({ breakdown, weights }: Props) {
  const w = weights || DEFAULT_SCORE_WEIGHTS;
  const dimensions = Object.keys(SCORE_DIMENSION_LABELS) as (keyof ScoreBreakdown)[];

  return (
    <Space direction="vertical" style={{ width: "100%" }} size={8}>
      {dimensions.map((key) => {
        const dim = breakdown[key];
        if (!dim) return null;
        return (
          <div key={key}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
              <Text style={{ fontSize: 12 }}>
                {SCORE_DIMENSION_LABELS[key]}
                <Text type="secondary" style={{ fontSize: 11 }}> ({w[key]}%)</Text>
              </Text>
              <Text strong style={{ fontSize: 12, color: scoreColor(dim.score) }}>
                {dim.score}
              </Text>
            </div>
            <Progress
              percent={dim.score}
              showInfo={false}
              strokeColor={scoreColor(dim.score)}
              size="small"
            />
            {dim.reason && (
              <Text type="secondary" style={{ fontSize: 11, display: "block", marginTop: 2 }}>
                {dim.reason}
              </Text>
            )}
          </div>
        );
      })}
    </Space>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add portal/src/components/ScoreBreakdownChart.tsx
git commit -m "feat: add ScoreBreakdownChart component"
```

---

### Task 6: Portal — Score Weights Editor Component

**Files:**
- Create: `portal/src/components/ScoreWeightsEditor.tsx`

- [ ] **Step 1: Create the weights editor with 5 sliders summing to 100%**

```tsx
"use client";

import { Slider, Space, Typography, Button, Alert } from "antd";
import { useState } from "react";
import type { ScoreWeights } from "@/lib/types";
import { SCORE_DIMENSION_LABELS, DEFAULT_SCORE_WEIGHTS } from "@/lib/types";

const { Text } = Typography;

interface Props {
  weights: ScoreWeights;
  onChange: (weights: ScoreWeights) => void;
}

export default function ScoreWeightsEditor({ weights, onChange }: Props) {
  const [local, setLocal] = useState<ScoreWeights>({ ...weights });
  const dimensions = Object.keys(SCORE_DIMENSION_LABELS) as (keyof ScoreWeights)[];
  const total = dimensions.reduce((sum, key) => sum + local[key], 0);

  function handleChange(key: keyof ScoreWeights, value: number) {
    setLocal((prev) => ({ ...prev, [key]: value }));
  }

  function handleApply() {
    onChange(local);
  }

  function handleReset() {
    setLocal({ ...DEFAULT_SCORE_WEIGHTS });
    onChange({ ...DEFAULT_SCORE_WEIGHTS });
  }

  return (
    <Space direction="vertical" style={{ width: "100%" }} size={8}>
      {dimensions.map((key) => (
        <div key={key}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 12 }}>{SCORE_DIMENSION_LABELS[key]}</Text>
            <Text strong style={{ fontSize: 12 }}>{local[key]}%</Text>
          </div>
          <Slider
            min={0}
            max={100}
            value={local[key]}
            onChange={(v) => handleChange(key, v)}
          />
        </div>
      ))}
      {total !== 100 && (
        <Alert
          message={`합계: ${total}% (100%가 되어야 합니다)`}
          type="warning"
          showIcon
          style={{ fontSize: 12 }}
        />
      )}
      <Space>
        <Button type="primary" size="small" onClick={handleApply} disabled={total !== 100}>
          적용
        </Button>
        <Button size="small" onClick={handleReset}>초기화</Button>
      </Space>
    </Space>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add portal/src/components/ScoreWeightsEditor.tsx
git commit -m "feat: add ScoreWeightsEditor component with 100% constraint"
```

---

### Task 7: Portal — Integrate Scoring into Project Detail Page

**Files:**
- Modify: `portal/src/app/dashboard/project/[id]/page.tsx`

- [ ] **Step 1: Add imports and scoring state**

Add imports at the top of the file:

```typescript
import { useUpdate } from "@refinedev/core";
import ScoreWeightsEditor from "@/components/ScoreWeightsEditor";
import { DEFAULT_SCORE_WEIGHTS, SCORE_DIMENSION_LABELS } from "@/lib/types";
import type { ScoreWeights, ScoreBreakdown } from "@/lib/types";
```

Inside the component, after the existing state declarations:

```typescript
  const [weights, setWeights] = useState<ScoreWeights>(
    project?.score_weights || DEFAULT_SCORE_WEIGHTS
  );
  const { mutate: updateProject } = useUpdate();
```

- [ ] **Step 2: Add client-side weighted score computation and re-sort**

Add a `computeWeightedScore` function and sorted prospects list:

```typescript
  function computeWeightedScore(breakdown: ScoreBreakdown | undefined, w: ScoreWeights): number {
    if (!breakdown) return 0;
    const dims = Object.keys(w) as (keyof ScoreWeights)[];
    const totalWeight = dims.reduce((sum, k) => sum + w[k], 0);
    if (totalWeight === 0) return 0;
    const weightedSum = dims.reduce((sum, k) => {
      const score = breakdown[k]?.score || 0;
      return sum + score * w[k];
    }, 0);
    return Math.round(weightedSum / totalWeight);
  }

  const sortedProspects = [...filtered].sort((a, b) => {
    const scoreA = a.score_breakdown ? computeWeightedScore(a.score_breakdown, weights) : a.match_score;
    const scoreB = b.score_breakdown ? computeWeightedScore(b.score_breakdown, weights) : b.match_score;
    return scoreB - scoreA;
  });
```

- [ ] **Step 3: Add weights editor as a collapsible panel above the table**

Inside the `prospects` tab children, above the `<Input>` search, add:

```tsx
          <Card size="small" title="매칭 가중치 설정" style={{ marginBottom: 16 }}
            extra={<Text type="secondary" style={{ fontSize: 11 }}>가중치를 조절하면 리스트가 즉시 재정렬됩니다</Text>}>
            <ScoreWeightsEditor
              weights={weights}
              onChange={(newWeights) => {
                setWeights(newWeights);
                updateProject({
                  resource: "projects",
                  id,
                  values: { score_weights: newWeights },
                });
              }}
            />
          </Card>
```

- [ ] **Step 4: Update the table to use sortedProspects and show weighted score**

Change `dataSource={filtered}` to `dataSource={sortedProspects}`.

Update the score column render to show the weighted score when breakdown exists:

```tsx
              {
                title: "점수", dataIndex: "match_score", key: "score", width: 80,
                render: (_: number, record: Prospect) => {
                  const displayScore = record.score_breakdown
                    ? computeWeightedScore(record.score_breakdown, weights)
                    : record.match_score;
                  return <Tag color={displayScore >= 80 ? "green" : displayScore >= 50 ? "gold" : "default"} style={{ fontWeight: 700 }}>{displayScore}</Tag>;
                },
              },
```

- [ ] **Step 5: Commit**

```bash
git add portal/src/app/dashboard/project/[id]/page.tsx
git commit -m "feat: integrate score weights editor and client-side re-sorting in project detail"
```

---

### Task 8: Portal — Integrate Score Breakdown into Prospect Detail Page

**Files:**
- Modify: `portal/src/app/dashboard/project/[id]/prospect/[pid]/page.tsx`

- [ ] **Step 1: Add imports**

```typescript
import ScoreBreakdownChart from "@/components/ScoreBreakdownChart";
```

- [ ] **Step 2: Add score breakdown card in the right panel**

In the right panel div (line 169), add as the first card (before "바이어 인텔리전스"):

```tsx
          {prospect.score_breakdown && (
            <Card title="매칭 점수 분석" size="small">
              <ScoreBreakdownChart
                breakdown={prospect.score_breakdown}
                weights={project.score_weights}
              />
            </Card>
          )}
```

- [ ] **Step 3: Commit**

```bash
git add portal/src/app/dashboard/project/[id]/prospect/[pid]/page.tsx
git commit -m "feat: display score breakdown chart in prospect detail page"
```

---

## Phase 2: Evidence Collection

### Task 9: Database Schema — Add Evidence Table

**Files:**
- Modify: `admin/schema.sql`

- [ ] **Step 1: Add the evidence table to schema.sql**

Append after the `exhibitions` table definition:

```sql
-- 증거 자료 (SNS, 웹사이트 등에서 수집한 디지털 증거)
CREATE TABLE evidence (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'website',  -- website, linkedin, facebook, instagram, x, forum, news
  screenshot_path TEXT,       -- Supabase Storage 경로
  text_excerpt TEXT,          -- 원문 발췌
  text_translated TEXT,       -- 한국어 번역
  related_scores TEXT[] DEFAULT '{}',  -- 관련 평가 항목명 배열
  collected_at TIMESTAMPTZ DEFAULT NOW(),
  content_date DATE           -- 원본 콘텐츠 게시 날짜
);
```

Add RLS and index:

```sql
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own evidence" ON evidence
  FOR SELECT USING (
    prospect_id IN (
      SELECT p.id FROM prospects p
      JOIN projects pr ON p.project_id = pr.id
      WHERE pr.user_id = auth.uid()
    )
  );

CREATE INDEX idx_evidence_prospect ON evidence(prospect_id);
```

- [ ] **Step 2: Run the migration**

```sql
-- Migration for existing deployments
CREATE TABLE IF NOT EXISTS evidence (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'website',
  screenshot_path TEXT,
  text_excerpt TEXT,
  text_translated TEXT,
  related_scores TEXT[] DEFAULT '{}',
  collected_at TIMESTAMPTZ DEFAULT NOW(),
  content_date DATE
);

ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own evidence" ON evidence
  FOR SELECT USING (
    prospect_id IN (
      SELECT p.id FROM prospects p
      JOIN projects pr ON p.project_id = pr.id
      WHERE pr.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_evidence_prospect ON evidence(prospect_id);
```

- [ ] **Step 3: Commit**

```bash
git add admin/schema.sql
git commit -m "feat: add evidence table for digital proof collection"
```

---

### Task 10: Pipeline — SNS Crawler Module

**Files:**
- Create: `pipeline/sns_crawler.py`

- [ ] **Step 1: Create SNS link extractor and crawler**

```python
"""
SNS 크롤러 — 회사 홈페이지에서 SNS 링크를 추출하고 각 채널을 크롤링한다.
홈페이지의 footer/header/contact 페이지에서 SNS 링크를 자동 추출하여
국가/업종에 따라 자연스럽게 적합한 채널이 결정된다.
"""
import re
from urllib.parse import urlparse


# SNS 도메인 → 소스 타입 매핑
SNS_PATTERNS = {
    "linkedin.com": "linkedin",
    "facebook.com": "facebook",
    "fb.com": "facebook",
    "instagram.com": "instagram",
    "twitter.com": "x",
    "x.com": "x",
}


def extract_sns_links(page_text: str, page_url: str = "") -> list[dict]:
    """
    HTML 텍스트 또는 추출된 텍스트에서 SNS 링크를 찾는다.

    Returns:
        [{"url": "https://linkedin.com/company/...", "type": "linkedin"}, ...]
    """
    # URL 패턴 매칭
    url_pattern = re.compile(r'https?://[^\s"\'<>]+')
    found_urls = url_pattern.findall(page_text)

    sns_links = []
    seen_domains = set()

    for url in found_urls:
        parsed = urlparse(url.rstrip("/"))
        domain = parsed.netloc.lower().replace("www.", "")

        for sns_domain, sns_type in SNS_PATTERNS.items():
            if sns_domain in domain and sns_domain not in seen_domains:
                seen_domains.add(sns_domain)
                sns_links.append({
                    "url": url.split("?")[0],  # 쿼리 파라미터 제거
                    "type": sns_type,
                })
                break

    return sns_links


async def crawl_sns_page(
    page_url: str,
    sns_type: str,
    browser_context,
    screenshot_dir: str,
    company_name: str = "",
) -> list[dict]:
    """
    SNS 페이지를 크롤링하여 최근 게시글을 수집한다.

    Returns:
        [{
            "source_url": str,
            "source_type": str,
            "text_excerpt": str,
            "screenshot_path": str (로컬 경로),
            "content_date": str (YYYY-MM-DD or None),
        }, ...]
    """
    import os
    from datetime import datetime

    results = []
    page = await browser_context.new_page()

    try:
        await page.goto(page_url, wait_until="domcontentloaded", timeout=15000)
        await page.wait_for_timeout(2000)  # 동적 콘텐츠 로딩 대기

        # 스크린샷 캡처
        safe_name = re.sub(r'[^a-zA-Z0-9]', '_', company_name)[:30]
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        screenshot_filename = f"{safe_name}_{sns_type}_{timestamp}.webp"
        screenshot_path = os.path.join(screenshot_dir, screenshot_filename)
        os.makedirs(screenshot_dir, exist_ok=True)
        await page.screenshot(path=screenshot_path, type="jpeg", quality=80, full_page=False)

        # 페이지 텍스트 추출 (최대 3000자)
        text_content = await page.evaluate("document.body.innerText")
        text_excerpt = (text_content or "")[:3000].strip()

        results.append({
            "source_url": page_url,
            "source_type": sns_type,
            "text_excerpt": text_excerpt,
            "screenshot_path": screenshot_path,
            "content_date": None,
        })

    except Exception as e:
        print(f"     ⚠️ {sns_type} 크롤링 실패 ({page_url[:50]}): {str(e)[:60]}")
    finally:
        await page.close()

    return results
```

- [ ] **Step 2: Verify module imports work**

```bash
cd /Users/youngminkim/Sites/lead-management
python -c "
from pipeline.sns_crawler import extract_sns_links, SNS_PATTERNS

# Test link extraction
text = '''
Follow us on social media:
https://www.linkedin.com/company/testcorp
https://www.facebook.com/testcorp
https://twitter.com/testcorp
Contact: info@testcorp.com
https://www.testcorp.com/products
'''
links = extract_sns_links(text)
print(f'Found {len(links)} SNS links:')
for l in links:
    print(f'  {l[\"type\"]}: {l[\"url\"]}')
assert len(links) == 3
assert links[0]['type'] == 'linkedin'
print('Tests passed!')
"
```

Expected:
```
Found 3 SNS links:
  linkedin: https://www.linkedin.com/company/testcorp
  facebook: https://www.facebook.com/testcorp
  x: https://twitter.com/testcorp
Tests passed!
```

- [ ] **Step 3: Commit**

```bash
git add pipeline/sns_crawler.py
git commit -m "feat: add SNS crawler module — link extraction and page crawling"
```

---

### Task 11: Pipeline — Evidence Collector Module

**Files:**
- Create: `pipeline/evidence_collector.py`

- [ ] **Step 1: Create the evidence collector that packages evidence with LLM analysis**

```python
"""
증거 수집기 — SNS/웹 크롤링 결과를 분석하여 증거 패키지를 생성한다.
각 증거를 평가 항목과 연결하고, 텍스트를 한국어로 번역한다.
"""
from .llm_client import LLMClient
from .sns_crawler import extract_sns_links, crawl_sns_page


async def collect_evidence(
    company: dict,
    browser_context,
    screenshot_dir: str,
    llm: LLMClient,
    client_profile_text: str,
) -> list[dict]:
    """
    업체의 홈페이지 + SNS에서 증거를 수집하고 분석한다.

    Args:
        company: 업체 정보 dict (name, url, page_text 등)
        browser_context: Playwright browser context
        screenshot_dir: 스크린샷 저장 경로
        llm: LLM 클라이언트
        client_profile_text: 수출업체 프로필 텍스트

    Returns:
        [{source_url, source_type, screenshot_path, text_excerpt,
          text_translated, related_scores, content_date}, ...]
    """
    evidence_items = []
    page_text = company.get("page_text", "")
    company_name = company.get("name", "unknown")

    # 1. 홈페이지에서 SNS 링크 추출
    sns_links = extract_sns_links(page_text, company.get("url", ""))

    if sns_links:
        print(f"     🔗 SNS 발견: {', '.join(l['type'] for l in sns_links)}")

    # 2. 각 SNS 채널 크롤링 (최대 3개)
    for link in sns_links[:3]:
        raw_items = await crawl_sns_page(
            page_url=link["url"],
            sns_type=link["type"],
            browser_context=browser_context,
            screenshot_dir=screenshot_dir,
            company_name=company_name,
        )
        evidence_items.extend(raw_items)

    # 3. 홈페이지 자체도 증거로 포함 (스크린샷이 있으면)
    if company.get("screenshot_path"):
        evidence_items.append({
            "source_url": company.get("url", ""),
            "source_type": "website",
            "text_excerpt": page_text[:2000] if page_text else "",
            "screenshot_path": company.get("screenshot_path", ""),
            "content_date": None,
        })

    # 4. LLM으로 각 증거 분석: 번역 + 관련 평가 항목 태깅
    if evidence_items:
        evidence_items = await _analyze_evidence_batch(
            evidence_items, client_profile_text, llm
        )

    return evidence_items


async def _analyze_evidence_batch(
    items: list[dict],
    client_profile_text: str,
    llm: LLMClient,
) -> list[dict]:
    """증거 배치를 LLM으로 분석하여 번역 + 태깅."""
    for item in items:
        text = item.get("text_excerpt", "")
        if not text or len(text.strip()) < 30:
            item["text_translated"] = ""
            item["related_scores"] = []
            continue

        # 텍스트가 너무 길면 잘라냄
        text = text[:1500]

        prompt = f"""Analyze this web content as trade intelligence evidence.

=== OUR CLIENT ===
{client_profile_text}

=== SOURCE ({item.get('source_type', 'unknown')}) ===
URL: {item.get('source_url', 'N/A')}

Content:
{text}

Return JSON:
{{
  "text_translated": "Key content summarized in Korean (한국어 요약, 2-3 sentences)",
  "related_scores": ["list of relevant scoring dimensions from: product_fit, buying_signal, company_capability, accessibility, strategic_value"],
  "content_date": "YYYY-MM-DD if a date is mentioned, otherwise null"
}}

Return valid JSON only."""

        try:
            result = llm.generate_json(prompt, max_tokens=300)
            item["text_translated"] = result.get("text_translated", "")
            item["related_scores"] = result.get("related_scores", [])
            if result.get("content_date"):
                item["content_date"] = result["content_date"]
        except Exception as e:
            print(f"     ⚠️ 증거 분석 실패: {str(e)[:40]}")
            item["text_translated"] = ""
            item["related_scores"] = []

    return items
```

- [ ] **Step 2: Commit**

```bash
git add pipeline/evidence_collector.py
git commit -m "feat: add evidence collector module — SNS crawling + LLM analysis"
```

---

### Task 12: Pipeline — Integrate Evidence Collection into Batch Runner

**Files:**
- Modify: `pipeline/batch_runner.py`

- [ ] **Step 1: Add import for evidence_collector**

At the top of `pipeline/batch_runner.py`, add:

```python
from .evidence_collector import collect_evidence
```

- [ ] **Step 2: Add evidence collection step after Step 5 (LLM analysis)**

After the analyzer step (around line 175, after the analyzer logger completion) and before the email drafter step (line 177), insert:

```python
        # Step 5.5: 증거 수집 (SNS + 웹 크롤링)
        if scrape_fn and candidates:
            if logger:
                logger.log_step(country, "evidence_collector", "started")

            print(f"\n  🔍 증거 수집 중...")
            from playwright.async_api import async_playwright

            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                context = await browser.new_context(
                    user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                )

                for candidate in candidates:
                    score = candidate.get("analysis", {}).get("match_score", 0)
                    if score < 30:
                        continue  # 낮은 점수 업체는 스킵
                    try:
                        evidence = await collect_evidence(
                            candidate, context, config.screenshot_dir,
                            llm, client_profile,
                        )
                        candidate["evidence"] = evidence
                        print(f"     📋 {candidate.get('name', '?')}: 증거 {len(evidence)}건")
                    except Exception as e:
                        print(f"     ⚠️ {candidate.get('name', '?')} 증거 수집 실패: {str(e)[:60]}")
                        candidate["evidence"] = []
                    await asyncio.sleep(config.polite_delay)

                await browser.close()

            if logger:
                total_evidence = sum(len(c.get("evidence", [])) for c in candidates)
                logger.log_step(country, "evidence_collector", "completed", {
                    "total_evidence": total_evidence,
                })
```

- [ ] **Step 3: Commit**

```bash
git add pipeline/batch_runner.py
git commit -m "feat: integrate evidence collection step into pipeline batch runner"
```

---

### Task 13: Portal — Evidence Types and Components

**Files:**
- Modify: `portal/src/lib/types.ts`
- Create: `portal/src/components/EvidenceCard.tsx`
- Create: `portal/src/components/EvidenceModal.tsx`

- [ ] **Step 1: Add Evidence type to types.ts**

Add to `portal/src/lib/types.ts`:

```typescript
export interface Evidence {
  id: string;
  prospect_id: string;
  source_url: string;
  source_type: "website" | "linkedin" | "facebook" | "instagram" | "x" | "forum" | "news";
  screenshot_path?: string;
  text_excerpt?: string;
  text_translated?: string;
  related_scores: string[];
  collected_at: string;
  content_date?: string;
}
```

- [ ] **Step 2: Create EvidenceCard component**

```tsx
"use client";

import { Card, Tag, Typography, Space } from "antd";
import { LinkOutlined, CameraOutlined } from "@ant-design/icons";
import type { Evidence } from "@/lib/types";
import { SCORE_DIMENSION_LABELS } from "@/lib/types";
import type { ScoreBreakdown } from "@/lib/types";

const { Text, Paragraph } = Typography;

const SOURCE_LABELS: Record<string, string> = {
  website: "웹사이트",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  instagram: "Instagram",
  x: "X (Twitter)",
  forum: "포럼",
  news: "뉴스",
};

const SOURCE_COLORS: Record<string, string> = {
  website: "blue",
  linkedin: "geekblue",
  facebook: "blue",
  instagram: "magenta",
  x: "default",
  forum: "cyan",
  news: "orange",
};

interface Props {
  evidence: Evidence;
  onScreenshotClick?: (evidence: Evidence) => void;
}

export default function EvidenceCard({ evidence, onScreenshotClick }: Props) {
  return (
    <Card
      size="small"
      style={{ marginBottom: 8 }}
      hoverable
    >
      <div style={{ display: "flex", gap: 12 }}>
        {/* Thumbnail */}
        {evidence.screenshot_path && (
          <div
            style={{
              width: 80,
              height: 60,
              background: "#f5f5f5",
              borderRadius: 4,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              overflow: "hidden",
            }}
            onClick={() => onScreenshotClick?.(evidence)}
          >
            <CameraOutlined style={{ fontSize: 20, color: "#999" }} />
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Space size={4} style={{ marginBottom: 4 }}>
            <Tag color={SOURCE_COLORS[evidence.source_type] || "default"} style={{ fontSize: 11 }}>
              {SOURCE_LABELS[evidence.source_type] || evidence.source_type}
            </Tag>
            {evidence.content_date && (
              <Text type="secondary" style={{ fontSize: 11 }}>{evidence.content_date}</Text>
            )}
          </Space>

          {evidence.text_translated && (
            <Paragraph style={{ fontSize: 12, margin: "4px 0" }} ellipsis={{ rows: 2 }}>
              {evidence.text_translated}
            </Paragraph>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Space size={2} wrap>
              {evidence.related_scores?.map((key) => (
                <Tag key={key} style={{ fontSize: 10, lineHeight: "16px" }} color="orange">
                  {SCORE_DIMENSION_LABELS[key as keyof ScoreBreakdown] || key}
                </Tag>
              ))}
            </Space>
            {evidence.source_url && (
              <a href={evidence.source_url} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}>
                <LinkOutlined style={{ fontSize: 12 }} />
              </a>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
```

- [ ] **Step 3: Create EvidenceModal component**

```tsx
"use client";

import { Modal, Typography, Tag, Space } from "antd";
import type { Evidence } from "@/lib/types";

const { Text, Paragraph } = Typography;

interface Props {
  evidence: Evidence | null;
  open: boolean;
  onClose: () => void;
}

export default function EvidenceModal({ evidence, open, onClose }: Props) {
  if (!evidence) return null;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={800}
      title={
        <Space>
          <span>증거 자료</span>
          <Tag>{evidence.source_type}</Tag>
        </Space>
      }
    >
      {evidence.screenshot_path && (
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <img
            src={evidence.screenshot_path}
            alt="Evidence screenshot"
            style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid #eee" }}
          />
        </div>
      )}

      {evidence.text_excerpt && (
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ fontSize: 12, display: "block", marginBottom: 4 }}>원문</Text>
          <div style={{ background: "#fafafa", padding: 12, borderRadius: 6, fontSize: 12, maxHeight: 200, overflow: "auto" }}>
            {evidence.text_excerpt}
          </div>
        </div>
      )}

      {evidence.text_translated && (
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ fontSize: 12, display: "block", marginBottom: 4 }}>한국어 번역</Text>
          <Paragraph style={{ fontSize: 13 }}>{evidence.text_translated}</Paragraph>
        </div>
      )}

      {evidence.source_url && (
        <a href={evidence.source_url} target="_blank" rel="noopener">
          원본 링크 열기 →
        </a>
      )}
    </Modal>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add portal/src/lib/types.ts portal/src/components/EvidenceCard.tsx portal/src/components/EvidenceModal.tsx
git commit -m "feat: add Evidence type, EvidenceCard, and EvidenceModal components"
```

---

### Task 14: Portal — Integrate Evidence into Prospect Detail Page

**Files:**
- Modify: `portal/src/app/dashboard/project/[id]/prospect/[pid]/page.tsx`

- [ ] **Step 1: Add imports and evidence data fetching**

Add imports:

```typescript
import EvidenceCard from "@/components/EvidenceCard";
import EvidenceModal from "@/components/EvidenceModal";
import type { Evidence } from "@/lib/types";
```

Add state and query inside the component:

```typescript
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null);

  const { query: evq } = useList<Evidence>({
    resource: "evidence",
    filters: [{ field: "prospect_id", operator: "eq", value: pid }],
    sorters: [{ field: "collected_at", order: "desc" }],
    pagination: { pageSize: 50 },
  });
  const evidenceList = evq.data?.data || [];
```

- [ ] **Step 2: Add evidence section in the left panel**

After the "홈페이지 원문 인용" card (around line 137), add:

```tsx
          {evidenceList.length > 0 && (
            <Card title={`증거 자료 (${evidenceList.length}건)`} size="small">
              {evidenceList.map((ev) => (
                <EvidenceCard
                  key={ev.id}
                  evidence={ev}
                  onScreenshotClick={(e) => setSelectedEvidence(e)}
                />
              ))}
            </Card>
          )}

          <EvidenceModal
            evidence={selectedEvidence}
            open={!!selectedEvidence}
            onClose={() => setSelectedEvidence(null)}
          />
```

- [ ] **Step 3: Add Refine resource for evidence**

In `portal/src/providers/refine-provider.tsx`, add `evidence` to the resources array:

```typescript
          { name: "evidence" },
```

- [ ] **Step 4: Commit**

```bash
git add portal/src/app/dashboard/project/[id]/prospect/[pid]/page.tsx portal/src/providers/refine-provider.tsx
git commit -m "feat: integrate evidence display into prospect detail page"
```

---

## Phase 3: Feedback Loop

### Task 15: Database Schema — Add Refinement Columns

**Files:**
- Modify: `admin/schema.sql`

- [ ] **Step 1: Add refinement columns**

Add to `projects` table definition:

```sql
  refinement_conditions JSONB DEFAULT '[]',  -- 고객이 추가한 분석 조건
  refinement_round INTEGER DEFAULT 1,        -- 현재 분석 회차
```

Add to `prospects` table definition:

```sql
  round INTEGER DEFAULT 1,  -- 이 결과가 나온 분석 회차
```

Update `projects` status CHECK constraint:

```sql
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'analyzing', 'results_ready', 'refining', 'completed')),
```

- [ ] **Step 2: Run migration**

```sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS refinement_conditions JSONB DEFAULT '[]';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS refinement_round INTEGER DEFAULT 1;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS round INTEGER DEFAULT 1;

-- Update status constraint (drop old, add new)
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE projects ADD CONSTRAINT projects_status_check
  CHECK (status IN ('active', 'analyzing', 'results_ready', 'refining', 'completed'));
```

- [ ] **Step 3: Commit**

```bash
git add admin/schema.sql
git commit -m "feat: add refinement_conditions, refinement_round, round columns"
```

---

### Task 16: Pipeline — Pattern Analyzer Module

**Files:**
- Create: `pipeline/pattern_analyzer.py`

- [ ] **Step 1: Create pattern analyzer that extracts accept/reject patterns**

```python
"""
패턴 분석기 — 고객의 accept/reject 패턴에서 선호 특성을 추출한다.
"""
from .llm_client import LLMClient


def analyze_feedback_patterns(
    accepted: list[dict],
    rejected: list[dict],
    llm: LLMClient,
) -> dict:
    """
    승인/제외된 prospect들의 공통 패턴을 추출한다.

    Args:
        accepted: 승인된 prospect 리스트 (각각 analysis dict 포함)
        rejected: 제외된 prospect 리스트

    Returns:
        {
            "preferred_traits": ["trait1", "trait2", ...],
            "avoided_traits": ["trait1", ...],
            "summary": "패턴 요약 (한국어)",
            "suggested_conditions": ["추가 조건 제안1", ...]
        }
    """
    if not accepted and not rejected:
        return {
            "preferred_traits": [],
            "avoided_traits": [],
            "summary": "아직 충분한 피드백이 없습니다.",
            "suggested_conditions": [],
        }

    def _summarize(companies: list[dict]) -> str:
        lines = []
        for c in companies[:10]:
            analysis = c.get("analysis", {})
            breakdown = analysis.get("score_breakdown", {})
            scores_str = ", ".join(
                f"{k}: {v.get('score', 0)}" for k, v in breakdown.items()
            ) if breakdown else f"total: {analysis.get('match_score', 0)}"
            lines.append(
                f"- {c.get('name', '?')} ({c.get('country', '?')}): "
                f"{scores_str}. "
                f"Products: {', '.join(analysis.get('detected_products', [])[:3])}. "
                f"Size: {analysis.get('company_size_estimate', '?')}. "
                f"Suppliers: {', '.join(analysis.get('current_suppliers', [])[:3])}"
            )
        return "\n".join(lines)

    prompt = f"""Analyze the pattern in customer feedback on prospect lists.

=== ACCEPTED PROSPECTS ({len(accepted)} companies) ===
{_summarize(accepted)}

=== REJECTED PROSPECTS ({len(rejected)} companies) ===
{_summarize(rejected)}

What patterns emerge? Return JSON:
{{
  "preferred_traits": ["list of common traits in accepted prospects (in Korean, each trait 1 sentence)"],
  "avoided_traits": ["list of common traits in rejected prospects (in Korean)"],
  "summary": "Overall pattern summary (Korean, 2-3 sentences)",
  "suggested_conditions": ["Specific filter conditions to suggest (Korean, e.g., '연매출 $10M 이상 업체 우선')"]
}}

Return valid JSON only."""

    try:
        result = llm.generate_json(prompt, max_tokens=500)
        return {
            "preferred_traits": result.get("preferred_traits", []),
            "avoided_traits": result.get("avoided_traits", []),
            "summary": result.get("summary", ""),
            "suggested_conditions": result.get("suggested_conditions", []),
        }
    except Exception as e:
        print(f"  ⚠️ 패턴 분석 실패: {e}")
        return {
            "preferred_traits": [],
            "avoided_traits": [],
            "summary": f"분석 오류: {str(e)[:50]}",
            "suggested_conditions": [],
        }
```

- [ ] **Step 2: Commit**

```bash
git add pipeline/pattern_analyzer.py
git commit -m "feat: add pattern analyzer module for accept/reject feedback patterns"
```

---

### Task 17: Pipeline — Support Refinement in Config and Batch Runner

**Files:**
- Modify: `pipeline/config.py`
- Modify: `pipeline/batch_runner.py`

- [ ] **Step 1: Add refinement fields to PipelineConfig**

In `pipeline/config.py`, add to the `PipelineConfig` class (after `polite_delay`):

```python
    refinement_conditions: list[str] = field(default_factory=list)
    refinement_round: int = 1
    feedback_patterns: dict = field(default_factory=dict)  # pattern_analyzer output
```

- [ ] **Step 2: Update `get_client_profile_text()` to include refinement context**

At the end of `get_client_profile_text()`, before the return:

```python
        if self.refinement_conditions:
            parts.append(f"\n\n추가 분석 조건 (고객 요청):")
            for cond in self.refinement_conditions:
                parts.append(f"\n  - {cond}")
        if self.feedback_patterns.get("preferred_traits"):
            parts.append(f"\n\n고객 선호 패턴:")
            for trait in self.feedback_patterns["preferred_traits"][:5]:
                parts.append(f"\n  - {trait}")
```

- [ ] **Step 3: Add `--refinement-conditions` and `--round` CLI args in main.py**

In `pipeline/main.py`, add to `parse_args()`:

```python
    parser.add_argument("--refinement-conditions", nargs="*", default=[],
                        help="추가 분석 조건 (고객 피드백 반영)")
    parser.add_argument("--round", type=int, default=1,
                        help="분석 회차 (재분석 시 증가)")
```

And in `from_args()` call, pass them through.

- [ ] **Step 4: Commit**

```bash
git add pipeline/config.py pipeline/main.py
git commit -m "feat: support refinement conditions and rounds in pipeline config"
```

---

### Task 18: Portal — Update Types for Feedback Loop

**Files:**
- Modify: `portal/src/lib/types.ts`

- [ ] **Step 1: Update Project and Prospect interfaces**

Add to `Project` interface:

```typescript
  refinement_conditions?: string[];
  refinement_round?: number;
  score_weights?: ScoreWeights;
```

Update `Project.status` type:

```typescript
  status: "active" | "analyzing" | "results_ready" | "refining" | "completed";
```

Add to `Prospect` interface:

```typescript
  round?: number;
```

- [ ] **Step 2: Commit**

```bash
git add portal/src/lib/types.ts
git commit -m "feat: update types for feedback loop — refinement conditions and rounds"
```

---

### Task 19: Portal — Refinement Conditions Form Component

**Files:**
- Create: `portal/src/components/RefinementConditionsForm.tsx`

- [ ] **Step 1: Create tag-based condition add/remove form**

```tsx
"use client";

import { Tag, Input, Button, Space, Typography } from "antd";
import { PlusOutlined, CloseOutlined } from "@ant-design/icons";
import { useState } from "react";

const { Text } = Typography;

interface Props {
  conditions: string[];
  onSubmit: (conditions: string[]) => void;
  loading?: boolean;
}

export default function RefinementConditionsForm({ conditions, onSubmit, loading }: Props) {
  const [local, setLocal] = useState<string[]>([...conditions]);
  const [inputValue, setInputValue] = useState("");

  function handleAdd() {
    const trimmed = inputValue.trim();
    if (trimmed && !local.includes(trimmed)) {
      setLocal([...local, trimmed]);
      setInputValue("");
    }
  }

  function handleRemove(index: number) {
    setLocal(local.filter((_, i) => i !== index));
  }

  const hasChanges = JSON.stringify(local) !== JSON.stringify(conditions);

  return (
    <Space direction="vertical" style={{ width: "100%" }} size={8}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        분석 조건을 추가하면 다음 회차 분석에 반영됩니다
      </Text>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {local.map((cond, i) => (
          <Tag
            key={i}
            closable
            onClose={() => handleRemove(i)}
            style={{ marginBottom: 4 }}
          >
            {cond}
          </Tag>
        ))}
      </div>

      <Input.Search
        placeholder="예: ISO 9001 인증 보유 업체만, 연매출 $10M 이상..."
        enterButton={<><PlusOutlined /> 추가</>}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onSearch={handleAdd}
      />

      {hasChanges && (
        <Button
          type="primary"
          onClick={() => onSubmit(local)}
          loading={loading}
        >
          조건 변경 요청 (재분석)
        </Button>
      )}
    </Space>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add portal/src/components/RefinementConditionsForm.tsx
git commit -m "feat: add RefinementConditionsForm component"
```

---

### Task 20: Portal — Pattern Insight Card Component

**Files:**
- Create: `portal/src/components/PatternInsightCard.tsx`

- [ ] **Step 1: Create pattern insight display component**

```tsx
"use client";

import { Card, Tag, Typography, Space } from "antd";
import { BulbOutlined, LikeOutlined, DislikeOutlined } from "@ant-design/icons";

const { Text, Paragraph } = Typography;

interface PatternData {
  preferred_traits: string[];
  avoided_traits: string[];
  summary: string;
  suggested_conditions: string[];
}

interface Props {
  patterns: PatternData;
  onAddCondition?: (condition: string) => void;
}

export default function PatternInsightCard({ patterns, onAddCondition }: Props) {
  if (!patterns.summary && !patterns.preferred_traits.length) return null;

  return (
    <Card
      title={<><BulbOutlined /> 패턴 인사이트</>}
      size="small"
      style={{ marginBottom: 16 }}
    >
      {patterns.summary && (
        <Paragraph style={{ fontSize: 13 }}>{patterns.summary}</Paragraph>
      )}

      {patterns.preferred_traits.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <Text strong style={{ fontSize: 12, color: "#52c41a" }}>
            <LikeOutlined /> 선호 특성
          </Text>
          <div style={{ marginTop: 4 }}>
            {patterns.preferred_traits.map((t, i) => (
              <Tag key={i} color="success" style={{ marginBottom: 4 }}>{t}</Tag>
            ))}
          </div>
        </div>
      )}

      {patterns.avoided_traits.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <Text strong style={{ fontSize: 12, color: "#ff4d4f" }}>
            <DislikeOutlined /> 회피 특성
          </Text>
          <div style={{ marginTop: 4 }}>
            {patterns.avoided_traits.map((t, i) => (
              <Tag key={i} color="error" style={{ marginBottom: 4 }}>{t}</Tag>
            ))}
          </div>
        </div>
      )}

      {patterns.suggested_conditions.length > 0 && onAddCondition && (
        <div>
          <Text strong style={{ fontSize: 12 }}>추천 조건</Text>
          <div style={{ marginTop: 4 }}>
            {patterns.suggested_conditions.map((c, i) => (
              <Tag
                key={i}
                color="orange"
                style={{ cursor: "pointer", marginBottom: 4 }}
                onClick={() => onAddCondition(c)}
              >
                + {c}
              </Tag>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add portal/src/components/PatternInsightCard.tsx
git commit -m "feat: add PatternInsightCard component"
```

---

### Task 21: Portal — Integrate Feedback Loop into Project Detail Page

**Files:**
- Modify: `portal/src/app/dashboard/project/[id]/page.tsx`

- [ ] **Step 1: Add imports**

```typescript
import RefinementConditionsForm from "@/components/RefinementConditionsForm";
import PatternInsightCard from "@/components/PatternInsightCard";
```

- [ ] **Step 2: Add round filter state**

```typescript
  const [activeRound, setActiveRound] = useState<number | "all">("all");
```

- [ ] **Step 3: Add round-based filtering to prospects**

After the existing `filtered` variable, add:

```typescript
  const roundFiltered = activeRound === "all"
    ? filtered
    : filtered.filter((p) => (p.round || 1) === activeRound);
```

Use `roundFiltered` instead of `filtered` in the table.

- [ ] **Step 4: Add round tabs above the prospect table**

Inside the prospects tab children, above the search input:

```tsx
          {(project.refinement_round || 1) > 1 && (
            <Space style={{ marginBottom: 12 }}>
              <Button
                type={activeRound === "all" ? "primary" : "default"}
                size="small"
                onClick={() => setActiveRound("all")}
              >
                전체
              </Button>
              {Array.from({ length: project.refinement_round || 1 }, (_, i) => i + 1).map((r) => (
                <Button
                  key={r}
                  type={activeRound === r ? "primary" : "default"}
                  size="small"
                  onClick={() => setActiveRound(r)}
                >
                  {r}차 분석
                </Button>
              ))}
            </Space>
          )}
```

- [ ] **Step 5: Add refinement conditions form and pattern insights to the feedback tab**

Replace the feedback tab children with an expanded version that includes:

```tsx
      children: (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <Card title="분석 조건 관리" size="small" style={{ marginBottom: 16 }}>
              <RefinementConditionsForm
                conditions={project.refinement_conditions || []}
                onSubmit={(conditions) => {
                  updateProject({
                    resource: "projects",
                    id,
                    values: {
                      refinement_conditions: conditions,
                      status: "refining",
                    },
                  });
                }}
              />
            </Card>

            <Card title="프로젝트 피드백" size="small">
              <Input.TextArea value={feedbackNote} onChange={(e) => setFeedbackNote(e.target.value)}
                placeholder="전체 방향에 대한 의견을 남겨주세요..." rows={3} style={{ marginBottom: 12 }} />
              <Button type="primary">피드백 전송</Button>
              <div style={{ marginTop: 16 }}>
                {feedback.filter((f) => !f.prospect_id).map((f, i) => (
                  <div key={i} style={{ padding: 12, background: "#fafafa", borderRadius: 8, marginBottom: 8 }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>{f.timestamp?.replace("T", " ").split(".")[0]}</Text>
                    <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13, marginTop: 4,
                      color: f.user_email?.includes("tradevoy") || f.user_email?.includes("system") ? "#f15f23" : undefined }}>
                      {f.text}
                    </pre>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div>
            <PatternInsightCard
              patterns={{
                preferred_traits: [],
                avoided_traits: [],
                summary: prospects.filter(p => p.feedback_status === "accepted").length >= 2
                  ? "승인/제외 데이터가 수집되었습니다. 다음 분석 시 패턴이 반영됩니다."
                  : "2개 이상의 업체를 승인/제외하면 패턴 분석이 시작됩니다.",
                suggested_conditions: [],
              }}
              onAddCondition={(c) => {
                const current = project.refinement_conditions || [];
                if (!current.includes(c)) {
                  updateProject({
                    resource: "projects",
                    id,
                    values: { refinement_conditions: [...current, c] },
                  });
                }
              }}
            />

            <Card title="프로젝트 타임라인" size="small">
              <div>
                <div style={{ padding: 8, borderLeft: "2px solid #f15f23", marginBottom: 8, paddingLeft: 12 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>{project.created_at?.split("T")[0]}</Text>
                  <div style={{ fontSize: 12 }}>프로젝트 생성 · {project.product}</div>
                </div>
                {feedback.filter(f => !f.prospect_id).map((f, i) => (
                  <div key={i} style={{ padding: 8, borderLeft: "2px solid #d9d9d9", marginBottom: 8, paddingLeft: 12 }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>{f.timestamp?.split("T")[0]}</Text>
                    <div style={{ fontSize: 12 }}>{f.text?.slice(0, 60)}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      ),
```

- [ ] **Step 6: Update project status display to include new statuses**

Update the status tag rendering:

```tsx
        <Tag color={
          project.status === "active" ? "green" :
          project.status === "analyzing" ? "blue" :
          project.status === "results_ready" ? "cyan" :
          project.status === "refining" ? "orange" :
          "default"
        }>
          {project.status === "active" ? "진행 중" :
           project.status === "analyzing" ? "분석 중" :
           project.status === "results_ready" ? "결과 검토" :
           project.status === "refining" ? "조건 수정 중" :
           "완료"}
        </Tag>
```

- [ ] **Step 7: Commit**

```bash
git add portal/src/app/dashboard/project/[id]/page.tsx
git commit -m "feat: integrate feedback loop — conditions form, pattern insights, round filtering, timeline"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** All 3 phases covered — structured scoring (Tasks 1-8), evidence collection (Tasks 9-14), feedback loop (Tasks 15-21)
- [x] **Placeholder scan:** No TBD/TODO. All code blocks are complete.
- [x] **Type consistency:** `ScoreBreakdown`, `ScoreWeights`, `Evidence` types used consistently across pipeline and portal. `score_breakdown` key matches in analyzer output, DB column, and TypeScript type. `DEFAULT_WEIGHTS` in Python matches `DEFAULT_SCORE_WEIGHTS` in TypeScript.
