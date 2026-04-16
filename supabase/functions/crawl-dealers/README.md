# crawl-dealers Edge Function

Firecrawl API로 제조사 딜러 페이지를 스크레이핑하고 SSE로 진행 상황을 스트리밍.

## 배포

```bash
cd /Users/youngminkim/Sites/lead-management
supabase functions deploy crawl-dealers

# 시크릿 설정 (한 번만)
supabase secrets set FIRECRAWL_API_KEY=fc-xxx
```

## 테스트

```bash
curl -N -X POST \
  "${SUPABASE_URL}/functions/v1/crawl-dealers" \
  -H "Authorization: Bearer ${USER_JWT}" \
  -H "Content-Type: application/json" \
  -d '{
    "brand": "Rammer",
    "category": "attachment",
    "url": "https://www.rammer.com/en/contact-us/contact-map/"
  }'
```

## SSE 이벤트

- `status` — 진행 단계 (`init`, `scraping`, `extracting`)
- `dealer` — 발견된 딜러 1건 (스트리밍)
- `done` — 완료 `{ count, total }`
- `error` — 실패 `{ message }`

## 스키마 의존성

- `manufacturer_dealers` 테이블 (user_id 컬럼 필수)
- `dealer_crawl_jobs` 테이블

SQL: `admin/migrate_dealer_user_scope.sql`
