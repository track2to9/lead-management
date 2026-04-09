# 견적서 빌더 (Quotation Builder)

> 무역업 고객을 위한 견적서 생성/편집/관리 도구. TradeVoy 포털의 메뉴 기능으로 통합.

## 배경

고객(SPS Eng)은 중국/한국에서 부품/장비를 구매해 해외에 수출하는 무역업. 현재 Excel로 견적서를 만들고 있으나:
- 견적서마다 필드가 달라져서 A4 PDF 맞추기 힘듦
- 내부 원가/마진 계산을 숨긴 채 고객용 견적서만 PDF로 뽑아야 함
- 상품군이 다양해서 제품 DB를 미리 구축하기 어려움 → 매번 직접 입력
- 저장/관리/이력 추적이 안 됨

## 핵심 기능

### 1. 견적서 에디터 (인라인 편집)

**2영역 구조:**
- 좌측: 고객용 견적서 (PDF에 나가는 부분)
- 우측: 내부 계산 (원가/마진, PDF에 절대 안 나감, 토글로 표시/숨김)

**인라인 편집:**
- 셀 클릭 → 바로 편집 (Excel 느낌)
- Tab/Enter로 셀 이동
- 행 추가/삭제, 컬럼(필드) 추가/삭제 가능
- 필드 타입: text, number, currency

**헤더 영역:**
- Ref No (자동 생성 또는 수동 입력, unique)
- 날짜
- 대상업체명
- 템플릿 선택

**아이템 테이블 (고객용):**
- 템플릿에 따라 기본 컬럼이 다름
- 사용자가 컬럼 추가/삭제/이름 변경 가능
- Amount = Price × Q'ty 자동 계산
- 합계(TTL) 자동 계산

**내부 계산 영역:**
- 아이템 테이블과 행 1:1 매핑
- 고정 필드: 원가(CNY 또는 KRW), 환율, 원가(USD 환산), 마진%, 마진액
- 유동 필드: 사용자가 추가 (운송비, 관세, 보험 등)
- 부대비용: 아이템별 또는 견적서 전체 레벨
- 하단 요약: 총 원가 / 총 부대비용 / 총 마진(금액, %) / 총 판매가

**마진 계산 모드 (토글):**
- Forward: 원가 + 부대비용 + 마진% → 판매가 산출
- Reverse: 판매가 입력 → 마진% 역산

**통화:**
- 원가 입력: CNY 또는 KRW (아이템별 선택 가능)
- 환율: 견적서 레벨 설정 (USD/CNY, USD/KRW)
- 출력 통화: USD 기본, EUR 등 선택 가능
- 환율 변경 시 전체 재계산

**하단 조건 (모든 견적서 공통):**
- Payment Terms (텍스트, 자주 쓰는 값 드롭다운)
- Delivery (텍스트)
- Packing (텍스트)
- Validity (날짜)
- Remarks (텍스트)

### 2. 템플릿 시스템

**기본 제공:**
- Proforma Invoice: Model, Applicable Carrier(ton), Price, Q'ty, Amount, Supply Scope
- Parts Quotation: Part Name, Part Number, Lead Time, Weight, Price, Q'ty, Amount, Remark
- Blank: No, Description, Price, Q'ty, Amount

**동작:**
- 새 견적서 시 템플릿 선택 → 기본 필드 세팅
- 필드 추가/삭제/순서 변경 자유
- "현재 상태를 새 템플릿으로 저장" 가능
- 회사 헤더(로고, 주소, 연락처)는 설정에서 1회 입력 → 모든 견적서 적용

### 3. PDF 미리보기/출력

- 에디터 내 A4 비율 실시간 프리뷰 (모달)
- 고객용 영역만 출력 (내부 계산 절대 미포함)
- 구성: 회사 헤더 + Ref No/날짜 + 대상업체 + 아이템 테이블 + 합계 + 하단 조건
- 상태: Draft(워터마크) / Final
- PDF 다운로드

### 4. 견적서 관리

- 목록: Ref No, 대상업체, 합계금액, 상태(draft/final), 날짜
- 검색/필터
- 복제 (기존 견적서 기반으로 새 견적서 생성)

## DB 스키마

```sql
CREATE TABLE quotation_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  columns JSONB NOT NULL DEFAULT '[]',  -- [{key, label, type, width}]
  footer_defaults JSONB DEFAULT '{}',   -- {payment_terms, delivery, packing, ...}
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE quotations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID REFERENCES quotation_templates(id),
  ref_no TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  client_name TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'final')),
  columns JSONB NOT NULL DEFAULT '[]',        -- 이 견적서의 실제 컬럼 정의
  currency TEXT DEFAULT 'USD',
  exchange_rates JSONB DEFAULT '{}',          -- {CNY: 7.2, KRW: 1380}
  margin_mode TEXT DEFAULT 'forward' CHECK (margin_mode IN ('forward', 'reverse')),
  footer JSONB DEFAULT '{}',                  -- {payment_terms, delivery, packing, validity, remarks}
  company_header JSONB DEFAULT '{}',          -- {name, address, tel, fax, web, email}
  global_costs JSONB DEFAULT '[]',            -- [{name, amount, currency}] 전체 레벨 부대비용
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE quotation_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_id UUID REFERENCES quotations(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  cells JSONB NOT NULL DEFAULT '{}',          -- {col_key: value} 고객용 필드
  cost_price NUMERIC,                         -- 원가
  cost_currency TEXT DEFAULT 'CNY',           -- CNY or KRW
  selling_price NUMERIC,                      -- 판매가 (출력 통화 기준)
  margin_percent NUMERIC,
  margin_amount NUMERIC,
  extra_costs JSONB DEFAULT '[]',             -- [{name, amount, currency}] 아이템별 부대비용
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

RLS: 모든 테이블에 user_id 기반 SELECT/INSERT/UPDATE/DELETE 정책.

## 포털 라우팅

- `/dashboard/quotations` — 견적서 목록
- `/dashboard/quotations/new` — 새 견적서 (템플릿 선택 → 에디터)
- `/dashboard/quotations/[id]` — 견적서 편집
- `/dashboard/quotations/[id]/preview` — PDF 미리보기 (또는 모달)

사이드바에 "견적서" 메뉴 추가.

## 기술 스택

- 인라인 편집 테이블: Ant Design Table의 editable cells 또는 가벼운 커스텀 구현
- PDF 생성: @react-pdf/renderer 또는 html2canvas + jsPDF
- 통화 포맷: Intl.NumberFormat
- 자동저장: debounced useUpdate (2초 디바운스)
