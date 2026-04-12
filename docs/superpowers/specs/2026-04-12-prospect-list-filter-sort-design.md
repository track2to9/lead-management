# Prospect List Filter & Sort Enhancement

**Date:** 2026-04-12
**Context:** SPSENG customer feedback — need to filter prospects by country, brand, and competitor to quickly identify actionable leads.

## Current State

- **File:** `portal/src/app/dashboard/project/[id]/page.tsx`
- **Existing filters:** Company name search, 분류 (buyer/competitor), 등급 (priority), 상태 (feedback status)
- **Existing sort:** Weighted score only (fixed)
- **Missing:** Country, detected brands, current suppliers — all available in data model but not exposed in table

## Changes

### 1. Add 3 Columns

| Column | Field | Render | Filter | Sort |
|--------|-------|--------|--------|------|
| 국가 | `country` | Country name (no emoji — data may be inconsistent) | Dropdown, multi-select, options auto-extracted from data | Alphabetical |
| 취급 브랜드 | `detected_products` | Ant Design `Tag` × 3 max, "+N" overflow | Dropdown, multi-select, options auto-extracted | By count (desc) |
| 현재 공급업체 | `current_suppliers` | Already rendered (max 3) — add filter | Dropdown, multi-select, options auto-extracted | — |

### 2. Column Order

```
업체명 | 국가 | 점수 | 취급 브랜드 | 현재 공급업체 | 분류 | 등급 | 상태
```

### 3. Sorting on Existing Columns

Add `sorter` prop to:
- **점수**: `match_score` numeric (already default sort, make it toggleable)
- **국가**: `country` alphabetical
- **등급**: priority mapped to numeric (high=3, medium=2, low=1)

### 4. Filter Options — Dynamic Extraction

```typescript
// Extract unique values from prospects for filter dropdowns
const countryFilters = [...new Set(prospects.map(p => p.country).filter(Boolean))]
  .sort().map(v => ({ text: v, value: v }));

const brandFilters = [...new Set(prospects.flatMap(p => p.detected_products || []))]
  .sort().map(v => ({ text: v, value: v }));

const supplierFilters = [...new Set(prospects.flatMap(p => p.current_suppliers || []))]
  .sort().map(v => ({ text: v, value: v }));
```

### 5. Filter Logic

- All column filters use AND combination (Ant Design Table default)
- Brand filter: prospect matches if `detected_products` includes ANY of the selected brands
- Supplier filter: prospect matches if `current_suppliers` includes ANY of the selected suppliers
- Country filter: exact match

### 6. Brand Column Rendering

```tsx
// Max 3 tags, overflow as "+N"
const brands = record.detected_products || [];
<>
  {brands.slice(0, 3).map(b => <Tag key={b}>{b}</Tag>)}
  {brands.length > 3 && <Tag>+{brands.length - 3}</Tag>}
</>
```

## Files to Modify

1. `portal/src/app/dashboard/project/[id]/page.tsx` — table columns, filter extraction, sort config

## Out of Scope

- Backend changes (all filtering/sorting is client-side via Ant Design Table)
- New API endpoints
- Brand normalization or deduplication (future work)
