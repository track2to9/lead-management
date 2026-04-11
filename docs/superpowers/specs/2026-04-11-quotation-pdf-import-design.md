# 과거 견적서 PDF 임포트 (Phase 1)

> SMB 무역 고객이 노트북/클라우드에 쌓아둔 과거 견적서 PDF를 어드민에 올려, 기존 견적서 시스템과 통합된 "검색·편집·복제 가능한 1급 시민"으로 승격시킨다. 자유 Q&A는 후속 Phase 2에서 NotebookLM 딥링크로 외주한다.

## 배경

고객(SPS Eng 같은 무역업)은 과거 견적서를 PDF로 노트북·클라우드에 100건 내외 쌓아두고 있다. 포맷은 제각각(템플릿 여러 종)이지만 전부 엑셀/워드에서 출력된 **텍스트 PDF**다.

현재 이 자료는 "참고용 문서 더미"에 불과하다. 새 견적서를 쓸 때 과거 것을 열어보고 수동으로 복붙하거나, 아예 열어보지 않고 새로 쓴다. 검색·재활용이 안 되고, 일관된 가격·payment terms 유지도 힘들다.

## 목표

1. **PDF를 1급 시민 견적서로 승격** — 업로드 즉시 기존 `quotations` 테이블에 편집 가능한 row로 들어간다. 기존 목록/검색/편집/PDF 미리보기 UI가 그대로 작동한다.
2. **과거 견적서 복제로 새 견적서 쓰기** — 핵심 가치 워크플로우. 복제 기능이 아직 코드에 없으므로 Phase 1 에서 함께 구현한다.
3. **검수를 "숙제"로 만들지 않는다** — lazy verification: 실제로 그 견적서를 쓸 때만 확인한다. 안 건드리면 평생 검수 안 해도 된다.
4. **포맷 다양성 수용** — 컬럼 구조가 완전히 다른 임포트본들이 한 테이블에 공존한다. 기존 스키마가 이미 이걸 위해 설계되어 있다 (`quotations.columns` JSONB, `quotation_items.cells` JSONB).
5. **출처는 항상 명확** — 수기 작성 vs 임포트를 DB·UI 양쪽에서 구분한다. 섞여서 검색되되, 눈으로 구분 가능하다.

## 비목표 (Phase 1에서 하지 않는 것)

- ❌ 자체 RAG / 벡터 검색 / pgvector
- ❌ 자연어 Q&A 채팅 UI
- ❌ NotebookLM 연동 (Phase 2)
- ❌ OCR / 스캔 PDF 지원 (고객이 텍스트 PDF만 가지고 있음을 확인)
- ❌ 검수 마법사 풀스크린 2분할 뷰 (YAGNI — 경로 1+2로 커버)
- ❌ Excel/CSV 임포트 (PDF만)
- ❌ 배치 재임포트 UI (한 건씩만)
- ❌ 자동 템플릿 추론/저장

**이 원칙은 강제다.** 진짜로 필요해지기 전엔 짓지 않는다.

## 데이터 모델

### 기존 테이블에 컬럼 4개 추가

```sql
ALTER TABLE quotations
  ADD COLUMN source TEXT DEFAULT 'manual'
    CHECK (source IN ('manual', 'imported_pdf')),
  ADD COLUMN import_pdf_url TEXT,              -- Supabase Storage 원본 PDF
  ADD COLUMN import_confidence JSONB,          -- 필드별 confidence 맵
  ADD COLUMN import_source_snapshot JSONB,     -- 단계 A(결정론적 추출) 결과 아카이브
  ADD COLUMN verified_at TIMESTAMPTZ;          -- NULL이면 아직 검수 안 됨

ALTER TABLE quotations DROP CONSTRAINT quotations_status_check;
ALTER TABLE quotations ADD CONSTRAINT quotations_status_check
  CHECK (status IN ('draft', 'final', 'imported_unverified'));
```

- `source` — `'manual'`(기본) / `'imported_pdf'`. UI에서 출처 구분과 필터에 사용.
- `import_pdf_url` — Supabase Storage 경로. 원본 PDF를 계속 보관해 사용자가 필요 시 열람·다운로드·재임포트 가능.
- `import_confidence` — LLM이 필드별로 반환한 confidence 맵. 예: `{client_name: 0.98, date: 0.72, items: [{price: 0.85, qty: 0.95}, ...]}`. UI 시각화 및 재임포트 정책 결정에 사용.
- `import_source_snapshot` — 단계 A 텍스트/표 추출 결과 전체 아카이브. 100건 × 평균 20KB ≈ 2MB. Phase 3 citation 재료·재임포트 입력·디버깅에 쓰임. 지금 당장은 저장만 해두고 읽는 쪽 코드는 재임포트 API만 사용.
- `verified_at` — 사용자가 "확인 완료"를 명시적으로 누른 시각. status 승격과 함께 세팅.

**새 테이블 없음.** 포맷 다양성은 기존 `columns` JSONB + `cells` JSONB 구조가 이미 수용한다. 임포트 A가 `[Model, Tonnage, Price, Qty]` 컬럼을 쓰고 임포트 B가 `[Part Number, Lead Time, Weight, Price, Qty]` 컬럼을 써도, 각 행이 자기 컬럼 정의를 가지고 공존한다.

### Storage 버킷

Supabase Storage에 `quotation-imports` 버킷 생성. RLS로 user_id 기반 접근 제어. 업로드 시 경로 규칙: `{user_id}/{quotation_id}/{original_filename}`.

## 파싱·추출 파이프라인

### 두 단계로 분리

**단계 A — 결정론적 텍스트 추출** (LLM 없음, 공짜, 빠름)

- 라이브러리: `unpdf` (Node, Vercel 호환, 의존성 가벼움)
- 포털이 Next.js(TypeScript)이므로 Node 쪽으로 통일해 별도 워커 인프라를 만들지 않는다. Python `pipeline/` 에 새 워커를 두지 않는다.
- 출력 형태:
  ```ts
  type ExtractedSnapshot = {
    pages: Array<{
      page_number: number;
      text: string;
      tables: Array<string[][]>;  // [row][col]
    }>;
  };
  ```
- 이 출력 전체를 `import_source_snapshot` 컬럼에 그대로 저장.
- LLM 입력을 작게 자르고 원문 좌표를 확보하기 위한 목적.

**단계 B — LLM 구조화 추출** (유료, 1~3 호출/PDF)

- 모델: Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) 기본, 실패 시 Claude Sonnet 4.6으로 폴백.
- 입력: 단계 A의 텍스트. 표가 감지됐으면 마크다운으로 변환해 함께 전달.
- tool use로 **JSON 스키마 강제 출력**:

```jsonc
{
  "ref_no":        { "value": "SPS-2024-0312", "confidence": 0.95 },
  "date":          { "value": "2024-03-12",    "confidence": 0.90 },
  "client_name":   { "value": "ACME GmbH",     "confidence": 0.98 },
  "currency":      { "value": "USD",           "confidence": 0.99 },
  "columns": [
    { "key": "model", "label": "Model",  "type": "text",     "confidence": 0.92 },
    { "key": "qty",   "label": "Q'ty",   "type": "number",   "confidence": 0.95 },
    { "key": "price", "label": "Price",  "type": "currency", "confidence": 0.95 },
    { "key": "amt",   "label": "Amount", "type": "currency", "confidence": 0.95 }
  ],
  "items": [
    {
      "cells": { "model": "XYZ-500", "qty": 3, "price": 2400, "amt": 7200 },
      "confidence": { "model": 0.98, "qty": 0.98, "price": 0.80, "amt": 0.99 }
    }
  ],
  "footer": {
    "payment_terms": { "value": "30% T/T in advance, 70% before shipment", "confidence": 0.88 },
    "delivery":      { "value": "60 days after PO",                         "confidence": 0.85 },
    "validity":      { "value": "2024-04-11",                               "confidence": 0.70 }
  },
  "company_header": { "name": "...", "address": "...", "confidence": 0.9 },
  "notes_for_human": "Column '원가' appeared to be internal cost — NOT imported into cells."
}
```

- 저장 시 값은 `quotations` 필드에, confidence 맵은 `import_confidence` 에 분리해서 저장.
- `notes_for_human` 은 `VerifyBanner` 에 그대로 보여준다 (LLM이 애매한 판단을 사용자에게 에스컬레이트하는 채널).

### 왜 2단계 분리인가

- 단계 A가 먼저 가면 LLM이 원문을 복붙하는 경향이 강해 환각이 줄어든다.
- 단계 A가 캐싱되면 LLM 호출만 재시도 가능. 재임포트 비용 절감.
- 단계별로 독립 테스트 가능: 단계 A는 샘플 PDF로 스냅샷 테스트, 단계 B는 고정 텍스트 입력의 JSON 출력 검증.

### 실패 처리

| 실패 종류 | 처리 |
|---|---|
| PDF가 깨져서 텍스트 0바이트 | 업로드는 성공, `imported_unverified` 상태로 빈 쉘 저장. `notes: "텍스트 추출 실패 — 원본 PDF 확인 필요"`. 목록에 빨간 뱃지. |
| 단계 A 성공, 단계 B LLM 타임아웃/오류 | 자동 재시도 2회. 모두 실패하면 빈 쉘 저장 + 사유 기록. |
| LLM이 JSON 스키마 어김 | tool use 강제라 드묾. 발생 시 재시도. |
| confidence < 0.5 필드 다수 | 저장은 하되 목록 뱃지를 "낮은 신뢰도"로 표시. |

### 비용 추정

- Claude Haiku 4.5 기준: 평균 견적서 1건당 약 5~15k 입력 토큰 + 2~3k 출력 토큰.
- 100건 초기 임포트 총비용: 대략 $1~3 수준 (실제 샘플 PDF로 구현 중 측정해 기록).
- 재임포트는 드물고 사용자 수동 트리거.

## 프론트엔드 UX

### 진입점

**1. 목록 상단 "PDF 임포트" 버튼**

```
견적서                                          [📄 PDF 임포트] [+ 새 견적서]
```

기존 "새 견적서" 버튼 옆에 나란히 배치. 눈에 띄는 위치.

**2. `ImportDropzone` 모달**

여러 PDF 동시 드래그앤드롭 지원. 파일별 진행 상태 표시:

```
ACME-Q-2024-03.pdf   [●●●●●○] 추출 중...
SPS-PI-2024-Q2.pdf   [●●●●●●] ✓ 완료 (confidence 92%)
old-scan.pdf         [●●●○○○] ⚠ 텍스트 없음 — 스킵
```

- 모달 닫아도 서버 파이프라인은 백그라운드로 계속 진행.
- 완료 시 토스트: `23개 임포트 완료, 검증 필요 5건`.
- 진행률은 단순 폴링 (2초 간격). SSE/Websocket은 YAGNI.

**3. 목록 필터 + 뱃지**

목록 상단 드롭다운:

```
[전체 ▾]  Ref No  업체  ...
  ├ 전체
  ├ 수기 작성
  ├ 임포트됨
  └ 검증 필요 (23)
```

Ref No 셀 옆 뱃지 아이콘:
- 수기 작성: 뱃지 없음 (기본)
- 임포트 + 검증됨: 회색 📎
- 임포트 + 검증 필요: 노란 ⚠

기본 검색/목록은 **수기+임포트 섞인 전체 대상**. 필터는 좁힐 때만 옵션으로.

### Lazy Verification — 두 가지 경로

**경로 1: 목록에서 열기**

- 기존 상세 페이지 `/dashboard/quotations/[id]` 로 진입.
- 상단 `VerifyBanner` (신규): `이 견적서는 PDF에서 자동 추출되었습니다. 틀린 부분이 보이면 바로 고치세요.` + [원본 PDF 보기] 버튼 + LLM이 남긴 `notes_for_human`.
- 셀 confidence 시각화:

| confidence | 표시 |
|---|---|
| ≥ 0.9 | 평범 |
| 0.7~0.9 | 연한 노란 배경 |
| < 0.7 | 진한 노란 + 점선 테두리 |
| null (추출 실패) | 빈 셀 + 빨간 `!` |

- 사용자가 셀을 수정하면 해당 셀 confidence → 1.0 으로 갱신, 시각화 해제.
- 상단 `[확인 완료]` 버튼 → `status: imported_unverified → draft`, `verified_at = now()`. 버튼은 선택 사항이며 누르지 않아도 검색·복제는 작동한다.

**경로 2: "비슷한 것 복제"**

- 목록/상세에서 "복제" 버튼 → 새 견적서 생성.
- 복제본은 `source='manual'`, `status='draft'`, `import_*` 필드 전부 `null`.
- 원본 임포트본은 그대로 유지.
- 이 경로가 실제 주 사용 흐름. 원본 검수를 건너뛰고 바로 새 견적서로 복제해 쓰는 게 자연스럽다.

### 컴포넌트 변화

| 파일 | 상태 | 변경 |
|---|---|---|
| `portal/src/app/dashboard/quotations/page.tsx` | 수정 | 임포트 버튼 + 복제 버튼(행 액션) + 필터 + 뱃지 + `ImportDropzone` 모달 연결 |
| `portal/src/app/dashboard/quotations/[id]/page.tsx` | 수정 | `VerifyBanner` 상단 표시 (source=imported_pdf 일 때만) + "이 견적서 복제" 버튼 |
| `portal/src/components/quotation/EditableTable.tsx` | 수정 | 셀 렌더러에 confidence 시각화 주입 + 수정 시 confidence 업데이트 hook |
| `portal/src/components/quotation/ImportDropzone.tsx` | 신규 | 드래그앤드롭 모달 |
| `portal/src/components/quotation/VerifyBanner.tsx` | 신규 | 상단 노란 스트립 + 원본 보기 + notes 표시 |
| `portal/src/lib/types.ts` | 수정 | `Quotation` 에 `source`, `import_pdf_url`, `import_confidence`, `import_source_snapshot`, `verified_at` 추가 |

## API

### `POST /api/quotations/import`

- Content-Type: `multipart/form-data`
- Body: 하나 이상의 PDF 파일
- 처리:
  1. 각 파일을 Supabase Storage `quotation-imports/{user_id}/{quotation_id}/` 에 저장
  2. 각 파일당 `quotations` row 를 `imported_unverified` 상태로 즉시 생성 (비어 있음)
  3. 백그라운드 job 큐에 추출 작업 등록
  4. 즉시 응답: `{ jobId: string, quotationIds: string[] }`

### `GET /api/quotations/import/:jobId`

- 폴링용 진행 상태 조회
- 응답:
  ```ts
  {
    total: number;
    done: number;
    failed: number;
    items: Array<{
      filename: string;
      quotationId: string;
      status: "pending" | "extracting" | "done" | "failed";
      error?: string;
      confidence_avg?: number;
    }>;
  }
  ```

### `POST /api/quotations/:id/reimport`

- 기존 임포트 견적서를 재추출 (LLM만 다시 호출, 원본 PDF는 재업로드 불필요)
- `import_source_snapshot` 을 그대로 단계 B 입력으로 재사용
- 사용자가 "이 추출 결과가 이상해" 판단 시 사용
- 응답: 업데이트된 `Quotation`

### `POST /api/quotations/:id/clone` (신규)

견적서 복제 기능 자체가 코드베이스에 아직 없다. 이 Phase 에서 최초로 구현한다.

- 기존 `quotations` row 를 읽어 새 row 를 생성한다.
- 복사되는 필드: `columns`, `cost_columns`, `currency`, `exchange_rates`, `margin_mode`, `footer`, `company_header`, `global_costs`, 그리고 모든 `quotation_items`.
- 새 row 의 필드:
  - `ref_no` — 원본 ref_no + `-copy` 접미사 (사용자가 편집 가능)
  - `date` — `CURRENT_DATE`
  - `status` — `'draft'`
  - `source` — `'manual'` (원본이 임포트본이어도 복제본은 항상 수기로 리셋)
  - `import_pdf_url`, `import_confidence`, `import_source_snapshot`, `verified_at` — 모두 `null`
- 원본은 변경하지 않는다.
- 응답: 새 `Quotation`

## 테스트 전략

### 단위 테스트

- `PdfTextExtractor`: 샘플 PDF 파일(텍스트 PDF 3~5개, 표 있음/없음/깨진 것) 고정 입력 → 스냅샷.
- `QuotationLlmExtractor`: 고정 텍스트 입력 → JSON 출력 구조 검증. LLM 호출은 모킹 + 실제 호출 통합 테스트 각각.
- `EditableTable` confidence 렌더링: 셀 confidence 값별 CSS 클래스 매핑 검증.

### 통합 테스트

- 전체 업로드 플로우: PDF 업로드 → 폴링 → 완료 → 목록에 뱃지 표시 → 상세 진입 → VerifyBanner 표시 → 셀 수정 → confidence 해제 → 확인 완료 → 상태 승격. Playwright 또는 Supabase 테스트 DB.
- 복제 플로우: 임포트본 복제 → 새 row 의 source·status·import_* 필드 검증.
- 실패 플로우: 깨진 PDF 업로드 → 빈 쉘 생성 → 빨간 뱃지 확인.

### 실제 샘플 검증

- 고객 PDF 샘플 5~10건 확보해 수동으로 추출 결과 검증. 실제 비용·정확도·confidence 분포를 Phase 1 개발 중 측정해 spec 에 반영.

## 마이그레이션

- 기존 `quotations` row 들은 `source` 기본값 `'manual'` 로 자동 마이그레이션됨. 추가 작업 없음.
- 기존 status enum `CHECK` 제약 교체는 down-time 없이 가능.
- Storage 버킷 `quotation-imports` 는 Supabase 콘솔에서 수동 생성 후 RLS 정책 적용.

## 보안 / RLS

- `quotations.import_pdf_url` 은 Supabase Storage 경로. 직접 URL 노출하지 않고 signed URL 로 접근.
- Storage RLS: `user_id = auth.uid()` 기반.
- `/api/quotations/import` 는 사용자 세션 검증 후 `user_id` 주입.
- 임포트 job 은 본인 소유 quotation 에만 작동.

## 파일 크기 / 성능 경계

- PDF 최대 20MB/파일 (Supabase Storage 기본 한도 고려).
- 한 번에 최대 50개 파일 업로드 (UX 부담 방지).
- 파일당 LLM 호출 타임아웃 60초, 재시도 2회.
- 목록 검색은 100~1000건 규모를 전제. 수만 건 이상은 지금 설계 범위 밖 (Phase 3 에서 재검토).

## Future: Phase 2 (NotebookLM 딥링크)

Phase 1 완료 후 수요가 확인되면 진행할 후속 단계. **지금은 짓지 않는다.**

- Google Drive 자동 동기화 — Phase 1의 `quotation-imports` 버킷 PDF를 고객 Drive 폴더로 복사.
- 사용자가 NotebookLM 노트북을 수동으로 1회 생성 → 노트북 URL을 어드민에 저장.
- 어드민 각 곳에 "NotebookLM에 물어보기" 버튼 → 저장된 URL 을 새 탭으로 열기.
- 데이터 레지던시 경고 모달 필수.
- NotebookLM 공개 API 가 없으므로 답변은 NotebookLM 탭에서만 소비되고 어드민으로 돌아오지 않는다.

**Phase 3 (자체 RAG)** 는 오직 다음 중 하나라도 증명됐을 때만 고려:
1. Phase 2 를 쓰고 싶은데 데이터 레지던시 때문에 못 쓰는 고객이 2곳 이상 생김.
2. NotebookLM 사용자의 50% 이상이 "어드민 안에서 물어보고 싶다"고 적극 요청.
3. Q&A 답변이 자동으로 폼 필드를 채우는 등의 2차 자동화가 매출과 직결.

증명되기 전에 RAG 짓는 것은 과잉 엔지니어링이다.

## 완료 기준 (Phase 1)

- [ ] 고객이 드래그앤드롭으로 100건 PDF 를 한 번에 업로드할 수 있다.
- [ ] 업로드 후 모달에서 진행 상태를 실시간으로 확인할 수 있다.
- [ ] 임포트된 견적서가 기존 목록에 섞여서 검색·필터된다.
- [ ] 출처(수기/임포트)가 뱃지로 구분된다.
- [ ] 임포트본을 클릭하면 기존 편집 UI에서 그대로 열리고, 저confidence 셀이 시각적으로 구분된다.
- [ ] 셀을 수정하면 confidence 표시가 해제된다.
- [ ] "확인 완료" 버튼으로 검증 상태를 명시 승격할 수 있다.
- [ ] 임포트본을 포함해 모든 견적서를 복제할 수 있다 (복제 기능 자체도 이 Phase 에서 최초 구현).
- [ ] 임포트본을 복제하면 새 row 는 완전한 수기 견적서로 초기화된다 (`source='manual'`, `import_*` 필드 모두 `null`).
- [ ] 재임포트 API 로 단일 견적서를 다시 추출할 수 있다.
- [ ] 실패(깨진 PDF/LLM 오류)가 UI에 명확히 표시되고 데이터를 오염시키지 않는다.
- [ ] 실제 고객 샘플 PDF 5~10건으로 정확도·비용을 측정해 spec 에 기록한다.
