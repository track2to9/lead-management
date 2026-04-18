/**
 * Manufacturer Dealer Crawler
 *
 * Usage:
 *   npx tsx crawl-dealers.ts                  # crawl all configured manufacturers
 *   npx tsx crawl-dealers.ts --brand Rammer   # crawl single brand
 *   npx tsx crawl-dealers.ts --dry-run        # preview without DB write
 *
 * Env vars (from ../.env.local or .env):
 *   FIRECRAWL_API_KEY
 *   SUPABASE_URL
 *   SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY)
 */

import dotenv from "dotenv";
import path from "path";
// Load .env from scripts/ and portal/.env.local
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../portal/.env.local") });
import Firecrawl from "@mendable/firecrawl-js";
import { createClient } from "@supabase/supabase-js";

// ─── Config ──────────────────────────────────────────────

interface ManufacturerConfig {
  brand: string;
  category: "attachment" | "excavator";
  dealer_url: string;
  strategy: "single_page" | "country_pages";
  country_urls?: string[];
}

const MANUFACTURERS: ManufacturerConfig[] = [
  // --- Attachment brands ---
  {
    brand: "Rammer",
    category: "attachment",
    dealer_url: "https://www.rammer.com/en/contact-us/contact-map/",
    strategy: "single_page",
  },
  {
    brand: "Xcentric",
    category: "attachment",
    dealer_url: "https://xcentricripper.com/dealers-worldwide/",
    strategy: "country_pages",
    country_urls: [
      "https://xcentricripper.com/dealers-in-indonesia/",
      "https://xcentricripper.com/dealers-in-india/",
      "https://xcentricripper.com/dealers-in-united-states/",
      "https://xcentricripper.com/dealers-in-australia/",
      "https://xcentricripper.com/dealers-in-united-kingdom/",
      "https://xcentricripper.com/dealers-in-germany/",
      "https://xcentricripper.com/dealers-in-france/",
      "https://xcentricripper.com/dealers-in-spain/",
      "https://xcentricripper.com/dealers-in-brazil/",
      "https://xcentricripper.com/dealers-in-south-korea/",
      "https://xcentricripper.com/dealers-in-japan/",
      "https://xcentricripper.com/dealers-in-china/",
      "https://xcentricripper.com/dealers-in-turkey/",
      "https://xcentricripper.com/dealers-in-saudi-arabia/",
      "https://xcentricripper.com/dealers-in-south-africa/",
      "https://xcentricripper.com/dealers-in-mexico/",
      "https://xcentricripper.com/dealers-in-canada/",
      "https://xcentricripper.com/dealers-in-russia/",
      "https://xcentricripper.com/dealers-in-thailand/",
      "https://xcentricripper.com/dealers-in-vietnam/",
    ],
  },
  // --- Excavator brands ---
  {
    brand: "SANY",
    category: "excavator",
    dealer_url: "https://www.sanyglobal.com/network/",
    strategy: "single_page",
  },
  {
    brand: "Hyundai",
    category: "excavator",
    dealer_url: "https://www.hyundai-ce.com/en/agency/overseas",
    strategy: "single_page",
  },
  {
    brand: "Kobelco",
    category: "excavator",
    dealer_url: "https://www.kobelcocm-global.com/worldwide/",
    strategy: "single_page",
  },
];

// ─── Dealer schema for Firecrawl extraction ──────────────

const DEALER_SCHEMA = {
  type: "object",
  properties: {
    dealers: {
      type: "array",
      items: {
        type: "object",
        properties: {
          company_name: { type: "string", description: "Company/dealer name" },
          country: { type: "string", description: "Country name" },
          city: { type: "string", description: "City name" },
          address: { type: "string", description: "Full address" },
          phone: { type: "string", description: "Phone number" },
          email: { type: "string", description: "Email address" },
          website: { type: "string", description: "Website URL" },
        },
        required: ["company_name"],
      },
    },
  },
  required: ["dealers"],
};

interface CrawledDealer {
  company_name: string;
  country?: string;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
}

// ─── Init ────────────────────────────────────────────────

const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!FIRECRAWL_KEY) { console.error("Missing FIRECRAWL_API_KEY"); process.exit(1); }
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY"); process.exit(1); }

const firecrawl = new Firecrawl({ apiKey: FIRECRAWL_KEY });
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Crawl logic ─────────────────────────────────────────

async function scrapeDealers(url: string): Promise<CrawledDealer[]> {
  console.log(`  Scraping: ${url}`);
  try {
    const result = await firecrawl.scrape(url, {
      formats: [
        {
          type: "json",
          schema: DEALER_SCHEMA,
          prompt: "Extract all dealer/distributor information from this page. Include company name, country, city, address, phone, email, website for each dealer. Be thorough - extract ALL dealers visible.",
        },
      ],
    });

    if (result.json?.dealers) {
      return result.json.dealers as CrawledDealer[];
    }

    // Fallback: retry with simpler prompt
    console.log(`  No dealers in first pass, retrying...`);
    const retry = await firecrawl.scrape(url, {
      formats: [
        {
          type: "json",
          schema: DEALER_SCHEMA,
          prompt: "This page lists dealers or distributors. Extract every company name, country, city, phone, email, website you can find.",
        },
      ],
    });

    if (retry.json?.dealers) {
      return retry.json.dealers as CrawledDealer[];
    }

    console.log(`  Warning: no dealers extracted from ${url}`);
    return [];
  } catch (err: any) {
    console.error(`  Error scraping ${url}:`, err?.message || err);
    return [];
  }
}

async function crawlManufacturer(config: ManufacturerConfig, dryRun: boolean): Promise<number> {
  console.log(`\n🏭 Crawling ${config.brand} (${config.category})...`);
  let allDealers: CrawledDealer[] = [];

  if (config.strategy === "single_page") {
    allDealers = await scrapeDealers(config.dealer_url);
  } else if (config.strategy === "country_pages") {
    for (const url of config.country_urls || []) {
      const dealers = await scrapeDealers(url);
      allDealers.push(...dealers);
      // Rate limit: 1 sec between requests
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // Deduplicate by company_name + country
  const seen = new Set<string>();
  const unique = allDealers.filter((d) => {
    const key = `${d.company_name}::${d.country || ""}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`  Found ${unique.length} unique dealers (${allDealers.length} total)`);

  if (dryRun) {
    unique.slice(0, 5).forEach((d) => console.log(`    - ${d.company_name} (${d.country || "?"}) ${d.phone || ""}`));
    if (unique.length > 5) console.log(`    ... and ${unique.length - 5} more`);
    return unique.length;
  }

  // Upsert to DB
  const rows = unique.map((d) => ({
    brand: config.brand,
    category: config.category,
    company_name: d.company_name,
    country: d.country || null,
    city: d.city || null,
    address: d.address || null,
    phone: d.phone || null,
    email: d.email || null,
    website: d.website || null,
    raw_data: d,
    crawled_at: new Date().toISOString(),
  }));

  // Batch upsert (50 at a time)
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const { error } = await supabase
      .from("manufacturer_dealers")
      .upsert(batch, { onConflict: "brand,company_name,country" });
    if (error) {
      console.error(`  DB error (batch ${i}):`, error.message);
    }
  }

  console.log(`  ✅ Saved ${rows.length} dealers to DB`);
  return rows.length;
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const brandFilter = args.find((a, i) => args[i - 1] === "--brand");

  const configs = brandFilter
    ? MANUFACTURERS.filter((m) => m.brand.toLowerCase() === brandFilter.toLowerCase())
    : MANUFACTURERS;

  if (!configs.length) {
    console.error(`No manufacturer found for: ${brandFilter}`);
    process.exit(1);
  }

  console.log(`🚀 Dealer Crawler ${dryRun ? "(DRY RUN)" : ""}`);
  console.log(`   Manufacturers: ${configs.map((c) => c.brand).join(", ")}`);

  let totalDealers = 0;
  for (const config of configs) {
    totalDealers += await crawlManufacturer(config, dryRun);
  }

  console.log(`\n🏁 Done! Total dealers: ${totalDealers}`);
}

main().catch(console.error);
