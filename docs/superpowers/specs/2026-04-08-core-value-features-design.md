# TradeVoy 핵심 가치 기능 설계

> 고객 구매 전환을 위한 3가지 핵심 기능: 논리적 매칭 스코어링, 풍부한 증거 수집, 반복적 피드백 루프

## 배경

TradeVoy는 한국 중소 수출기업을 위한 해외 바이어 발굴 파이프라인 SaaS다. 현재 Python 파이프라인(배치 분석)과 Next.js 포털(결과 열람)이 분리된 구조.

고객의 구매 전환을 높이기 위해 3가지 핵심 가치가 필요하다:

1. **매칭 점수가 논리적이고 투명해야** 한다 - 블랙박스가 아닌 항목별 분해
2. **증거 자료가 풍부하고 접근 가능해야** 한다 - 고객이 직접 가는 것보다 나은 접근성
3. **피드백을 통해 점점 정확해져야** 한다 - 일방적 결과 전달이 아닌 반복적 구체화

## 접근 방식

**하이브리드**: 데이터 수집/분석은 파이프라인(배치), 탐색/피드백은 포털(인터랙티브).

## 구현 순서

Phase 1 → Phase 2 → Phase 3 순서. 분석 품질을 올리고, 증거로 뒷받침하고, 그 위에 반복 개선을 얹는다.

---

## Phase 1: 논리적 매칭 스코어링

### 핵심 변경

현재 LLM이 단일 `match_score`(0-100)를 통째로 생성하는 방식에서, **5개 항목별 개별 평가 + 가중치 기반 종합 점수**로 전환한다. 종합 점수는 LLM이 아닌 코드로 계산하여 일관성을 보장한다.

### 평가 항목 (기본 가중치)

| 항목 | 키 | 기본 가중치 | 평가 내용 |
|------|-----|-----------|----------|
| 제품 적합도 | `product_fit` | 30% | 우리 제품/서비스를 실제로 취급하거나 필요로 하는가 |
| 구매 시그널 | `buying_signal` | 25% | 최근 구매 활동, 신규 프로젝트, 공급선 다변화 조짐 |
| 기업 규모/역량 | `company_capability` | 20% | 거래 가능한 규모인가, 수입 역량이 있는가 |
| 접근 가능성 | `accessibility` | 15% | 담당자 정보 확보 가능성, 연락 채널 존재 여부 |
| 전략적 가치 | `strategic_value` | 10% | 레퍼런스 효과, 시장 진입 거점, 장기 파트너십 가능성 |

### 파이프라인 변경

`company_analyzer.py`의 LLM 프롬프트를 수정하여 각 항목별 0-100점 + 근거 텍스트를 출력하도록 한다.

출력 JSON 구조:

```json
{
  "scores": {
    "product_fit": { "score": 85, "reason": "JCB 장비 공식 딜러로 굴삭기 부품 수입 이력 확인" },
    "buying_signal": { "score": 60, "reason": "최근 6개월 내 신규 장비 도입 공고 2건" },
    "company_capability": { "score": 70, "reason": "연매출 약 $30M, 자체 수입 라이센스 보유" },
    "accessibility": { "score": 90, "reason": "LinkedIn에 구매 담당자 프로필 확인, 이메일 공개" },
    "strategic_value": { "score": 40, "reason": "폴란드 내 중견 규모, 레퍼런스 효과 제한적" }
  },
  "weights": {
    "product_fit": 30,
    "buying_signal": 25,
    "company_capability": 20,
    "accessibility": 15,
    "strategic_value": 10
  },
  "total_score": 72,
  "reasoning_summary": "JCB 딜러로서 제품 적합도가 높고 접근 채널이 명확하나, 전략적 거점으로서의 가치는 제한적"
}
```

### 포털 변경

- 프로젝트 설정에 가중치 커스텀 UI 추가 (Ant Design Slider x 5개, 합계 100% 제약)
- prospect 상세 페이지에 항목별 점수 바 차트 표시
- 가중치 변경 시 기존 데이터 내에서 즉시 재정렬 (클라이언트 사이드 계산, 재분석 없음)

### DB 변경

- `prospects` 테이블에 `score_breakdown` (JSONB) 컬럼 추가
- `projects` 테이블에 `score_weights` (JSONB) 컬럼 추가 (고객별 커스텀 가중치, 기본값은 위 표)

---

## Phase 2: 풍부한 증거 수집

### 핵심 변경

홈페이지 텍스트 분석만 하던 것에서, **홈페이지 → SNS 링크 추출 → 각 채널 크롤링 → 증거 패키지 생성**으로 확장한다. 모든 증거는 URL + 스크린샷 + 핵심 텍스트 발췌/번역을 포함한다.

### 수집 흐름

```
홈페이지 크롤링
  ├── 기존: 회사 정보, 제품 정보 텍스트 추출
  ├── 신규: SNS 링크 자동 추출 (LinkedIn, Facebook, Instagram, X, 업종별 포럼 등)
  └── 신규: 홈페이지 스크린샷 캡처
          │
SNS 채널별 크롤링 (Playwright)
  ├── 최근 3~6개월 게시글 수집
  ├── 각 게시글: 텍스트 + 스크린샷 + URL + 날짜
  └── LLM 분석: 구매 시그널, 관심사, 최근 동향 요약
          │
증거 패키지 생성
  ├── 원본 URL (출처)
  ├── 스크린샷 (Supabase Storage, WebP 압축)
  ├── 핵심 텍스트 발췌 (원문 + 한국어 번역)
  └── 관련성 태그 (Phase 1 평가 항목과 연결)
```

### SNS 링크 추출 전략

회사 홈페이지의 footer/header/contact 페이지에서 SNS 링크를 자동 추출한다. 이렇게 하면 국가/업종별로 자연스럽게 적합한 채널이 결정된다 (일본 업체는 일본 포럼 링크, 유럽 업체는 LinkedIn 등).

### 증거-점수 연결

각 증거 자료가 Phase 1의 어떤 평가 항목을 뒷받침하는지 태깅한다.

- "JCB 장비 수입 계약 체결" 게시글 → `product_fit`, `buying_signal`
- "신규 물류센터 착공" 뉴스 → `buying_signal`, `company_capability`

고객이 점수 항목을 클릭하면 해당 항목의 근거 증거로 바로 이동할 수 있다.

### DB 변경

```sql
CREATE TABLE evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  source_type TEXT NOT NULL, -- website, linkedin, facebook, instagram, x, forum, news
  screenshot_path TEXT,       -- Supabase Storage 경로
  text_excerpt TEXT,          -- 원문 발췌
  text_translated TEXT,       -- 한국어 번역
  related_scores TEXT[],      -- 관련 평가 항목명 배열 (product_fit, buying_signal 등)
  collected_at TIMESTAMPTZ DEFAULT now(),
  content_date DATE           -- 원본 콘텐츠 게시 날짜
);
```

RLS: 사용자는 자기 프로젝트의 prospect에 연결된 evidence만 조회 가능.

### 스토리지 전략

- Supabase Storage `evidence/` 버킷, `{project_id}/{prospect_id}/` 하위 저장
- 스크린샷은 WebP 포맷 압축
- 프로젝트 완료 후 아카이브 정책 적용 가능 (추후 결정)

### 포털 변경

- prospect 상세 페이지에 "증거 자료" 탭 추가
- 증거 카드: 스크린샷 썸네일 + 발췌 텍스트 + 출처 링크 + 관련 항목 태그
- 스크린샷 클릭 → 모달 확대 보기
- 평가 항목별 점수 클릭 → 해당 항목 관련 증거만 필터링

---

## Phase 3: 반복적 피드백 루프

### 핵심 변경

일방적 결과 전달에서, **3가지 피드백 경로를 조합한 반복적 구체화 사이클**로 전환한다.

### 피드백 경로 A: 프로젝트 레벨 조건 추가

고객이 결과를 보고 "이런 조건을 추가/제거해줘" 형태의 피드백을 준다.

- 포털에서 "분석 조건 수정 요청" 폼 제공
- 예: "ISO 9001 인증 보유 업체만", "매출 $10M 이상", "동남아 제외"
- 요청 시 프로젝트 상태 → `refining`
- 파이프라인 재실행 시 이 조건들이 LLM 프롬프트에 컨텍스트로 반영

### 피드백 경로 B: 패턴 기반 추천

고객의 accept/reject 패턴에서 선호 특성을 추출한다.

- accepted prospect들의 공통 특성 추출 (LLM 분석)
  - 예: "accept한 3곳 모두 연매출 $50M 이상, 자체 수입 라이센스 보유"
- rejected prospect들의 공통 특성도 추출
- 패턴 기반으로 미평가 prospect 재정렬 + "이런 업체를 더 찾아볼까요?" 제안 생성

### 피드백 경로 C: 가중치 조절

Phase 1의 가중치 슬라이더를 고객이 직접 조정한다.

- 변경 즉시 prospect 리스트 재정렬 (클라이언트 사이드, 재분석 없음)

### 반복 사이클 흐름

```
1차 분석 결과 제공
  → 고객 열람 + accept/reject 태깅 (경로 B 데이터 축적)
  → 고객 가중치 조정 (경로 C, 즉시 반영)
  → 고객 조건 추가 요청 (경로 A)
      → 2차 분석 실행 (기존 조건 + 추가 조건 + 패턴 반영)
          → 신규 prospect 추가 + 기존 prospect 재평가
              → 고객 재열람... 반복
```

### 프로젝트 상태 확장

```
active → analyzing → results_ready → refining → analyzing → results_ready → completed
```

- `results_ready`: 고객이 결과를 검토 중
- `refining`: 고객이 피드백을 줬고, 재분석 대기 중

### DB 변경

```sql
-- projects 테이블에 추가
ALTER TABLE projects ADD COLUMN refinement_conditions JSONB DEFAULT '[]';
ALTER TABLE projects ADD COLUMN refinement_round INTEGER DEFAULT 1;

-- prospects 테이블에 추가
ALTER TABLE prospects ADD COLUMN round INTEGER DEFAULT 1;

-- feedback 테이블의 type 값 확장
-- 기존: general, approval, rejection, additional_analysis
-- 추가: condition_add, condition_remove
```

### 포털 변경

- 프로젝트 상세에 "분석 회차" 탭 (1차, 2차... 결과 비교)
- 조건 수정 요청 폼 (태그 형태로 조건 추가/삭제)
- accept/reject 누적 후 "패턴 인사이트" 카드 표시 ("선호 업체 특성: ...")
- 프로젝트 타임라인 뷰 (피드백 → 변화 이력)

---

## 전체 DB 변경 요약

### 신규 테이블

- `evidence` — 증거 자료 (URL, 스크린샷, 텍스트 발췌, 번역, 관련 평가 항목)

### 기존 테이블 변경

| 테이블 | 추가 컬럼 | 타입 |
|--------|----------|------|
| `projects` | `score_weights` | JSONB |
| `projects` | `refinement_conditions` | JSONB |
| `projects` | `refinement_round` | INTEGER |
| `prospects` | `score_breakdown` | JSONB |
| `prospects` | `round` | INTEGER |
| `feedback` | type에 `condition_add`, `condition_remove` 값 추가 | - |

### 기존 테이블 변경 없음

- `exhibitions` — 변경 없음

---

## 포털 UI 변경 요약

| 위치 | 변경 내용 | Phase |
|------|----------|-------|
| 프로젝트 설정 | 가중치 슬라이더 (5개 항목, 합계 100%) | 1 |
| prospect 리스트 | 가중치 변경 시 즉시 재정렬 | 1 |
| prospect 상세 | 항목별 점수 바 차트 + 근거 텍스트 | 1 |
| prospect 상세 | "증거 자료" 탭 (카드 + 모달 뷰어) | 2 |
| prospect 상세 | 점수 항목 클릭 → 관련 증거 필터링 | 2 |
| 프로젝트 상세 | "분석 회차" 탭 | 3 |
| 프로젝트 상세 | 조건 수정 요청 폼 | 3 |
| 프로젝트 상세 | 패턴 인사이트 카드 | 3 |
| 프로젝트 상세 | 타임라인 뷰 | 3 |

---

## 파이프라인 변경 요약

| 모듈 | 변경 내용 | Phase |
|------|----------|-------|
| `company_analyzer.py` | 항목별 점수 출력 프롬프트 + 종합 점수 코드 계산 | 1 |
| `lead_verifier.py` (Playwright) | SNS 링크 추출 + 채널별 크롤링 + 스크린샷 캡처 | 2 |
| 신규: `evidence_collector.py` | 증거 패키지 생성 + Supabase Storage 업로드 | 2 |
| 신규: `sns_crawler.py` | SNS 채널별 크롤링 로직 (LinkedIn, Facebook 등) | 2 |
| `company_analyzer.py` | 증거-점수 연결 태깅 | 2 |
| `main.py` (batch runner) | refinement_conditions + 패턴 컨텍스트 반영한 재실행 지원 | 3 |
| 신규: `pattern_analyzer.py` | accept/reject 패턴 추출 + 추천 생성 | 3 |
