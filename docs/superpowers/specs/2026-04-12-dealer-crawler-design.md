# Manufacturer Dealer Network Crawler

**Date:** 2026-04-12
**Context:** SPSENG manually checks manufacturer websites for dealer lists. Automate this with Firecrawl.

## Architecture

```
[Crawler CLI Script]
       |
       v
  [Firecrawl API] -- scrape + JSON schema extraction
       |
       v
  [Supabase: manufacturer_dealers table]
       |
       v
  [Matching Logic] -- prospect.name/url ↔ dealer.name/website
       |
       v
  [UI] -- prospect list "공식 딜러" tag + detail page dealer card
```

## 1. Firecrawl Crawler Script

**Location:** `scripts/crawl-dealers.ts` (standalone Node.js script)

**Approach per manufacturer:**
1. Use Firecrawl `map` to discover dealer/network page URLs
2. Use Firecrawl `scrape` with JSON schema to extract dealers
3. For multi-page sites (country-by-country), iterate country URLs
4. Upsert results into `manufacturer_dealers` table

**Dealer extraction schema:**
```typescript
interface CrawledDealer {
  company_name: string;
  country: string;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  lat?: number;
  lng?: number;
}
```

**Manufacturer config:**
```typescript
interface ManufacturerConfig {
  brand: string;           // "Rammer", "CAT", etc.
  category: "attachment" | "excavator";
  dealer_url: string;      // entry point URL
  strategy: "single_page" | "country_pages" | "interactive";
  country_urls?: string[]; // for country_pages strategy
}
```

**1st batch (pilot):** Rammer (JSON embedded), Xcentric (country pages), SANY (API-driven)
**2nd batch:** CAT, Komatsu, Hitachi, Volvo, Kobelco
**3rd batch:** remaining attachment brands

## 2. Database

**New table: `manufacturer_dealers`**

```sql
CREATE TABLE manufacturer_dealers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand TEXT NOT NULL,           -- "Rammer", "CAT"
  category TEXT NOT NULL,        -- "attachment" | "excavator"
  company_name TEXT NOT NULL,
  country TEXT,
  city TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  lat NUMERIC,
  lng NUMERIC,
  raw_data JSONB,               -- original crawled data
  crawled_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brand, company_name, country)
);
```

**RLS:** Read-only for authenticated users, write via service role only.

## 3. Prospect ↔ Dealer Matching

**Matching logic** (run after crawl or on prospect load):
- Normalize company names (lowercase, remove Ltd/Inc/Co/etc.)
- Match by: website domain OR fuzzy company name (>80% similarity)
- Store match in `prospect.matched_dealers` (JSONB array) or a join table

**Lightweight approach for v1:** Client-side matching at render time:
```typescript
function findMatchingDealers(prospect: Prospect, dealers: Dealer[]): Dealer[] {
  const domain = extractDomain(prospect.url);
  return dealers.filter(d =>
    extractDomain(d.website) === domain ||
    normalize(d.company_name) === normalize(prospect.name)
  );
}
```

## 4. UI Changes

### Prospect List
- New column or badge: "공식 딜러" tag if matched with any manufacturer dealer
- Tag shows brand name: `<Tag color="purple">Rammer 딜러</Tag>`

### Prospect Detail Page
- New card in right sidebar: "딜러 네트워크 매칭"
- Shows which manufacturer(s) list this company as official dealer
- Brand name, dealer type, contact from manufacturer site

### Dashboard (future)
- "딜러 네트워크" page showing all crawled dealers, filterable by brand/country

## 5. Execution Plan

1. Add `@mendable/firecrawl-js` package
2. Create DB table + types
3. Build crawler script with 3 pilot manufacturers
4. Add matching logic + UI tags
5. Run crawler, verify data quality
6. Expand to remaining manufacturers

## Out of Scope
- Scheduled/automatic re-crawling (manual CLI for now)
- Dealer data editing UI
- Firecrawl billing optimization
