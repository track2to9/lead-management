"""
Evidence Collector Module — Phase 2 pipeline.

Orchestrates SNS crawling and LLM analysis to produce enriched evidence
packages for each prospect company.
"""

from .llm_client import LLMClient
from .sns_crawler import extract_sns_links, crawl_sns_page

# Valid scoring dimensions the LLM may reference
_SCORING_DIMENSIONS = {
    "product_fit",
    "buying_signal",
    "company_capability",
    "accessibility",
    "strategic_value",
}

_MAX_SNS_CHANNELS = 3
_MIN_TEXT_CHARS = 30
_MAX_TEXT_CHARS = 1500


async def collect_evidence(
    company: dict,
    browser_context,
    screenshot_dir: str,
    llm: LLMClient,
    client_profile_text: str,
) -> list[dict]:
    """
    Orchestrate evidence collection for a single company.

    Steps:
      1. Extract SNS links from the company's page_text.
      2. Crawl up to 3 SNS channels via Playwright.
      3. Prepend the homepage screenshot as the first evidence item (if available).
      4. Enrich all items with LLM analysis.

    Args:
        company:             Prospect company dict (must have ``page_text`` key;
                             optionally ``screenshot_path`` and ``name``).
        browser_context:     Playwright BrowserContext (already open).
        screenshot_dir:      Directory where SNS screenshots will be saved.
        llm:                 Initialised LLMClient instance.
        client_profile_text: Korean exporter profile used for relevance scoring.

    Returns:
        Enriched list of evidence dicts, each containing:
        source_url, source_type, screenshot_path, text_excerpt,
        text_translated, related_scores, content_date.
    """
    page_text: str = company.get("page_text") or ""
    company_name: str = company.get("name") or ""

    # 1. Extract SNS links from homepage text
    sns_links: list[dict] = extract_sns_links(page_text)

    # 2. Print discovered SNS links
    if sns_links:
        print(f"     🔗 SNS 발견: {', '.join(link['url'] for link in sns_links)}")

    # 3. Crawl up to _MAX_SNS_CHANNELS SNS pages
    sns_items: list[dict] = []
    for link in sns_links[:_MAX_SNS_CHANNELS]:
        crawled = await crawl_sns_page(
            page_url=link["url"],
            sns_type=link["type"],
            browser_context=browser_context,
            screenshot_dir=screenshot_dir,
            company_name=company_name,
        )
        sns_items.extend(crawled)

    # 4. Include homepage as the first evidence item (if screenshot exists)
    items: list[dict] = []
    homepage_screenshot = company.get("screenshot_path")
    if homepage_screenshot:
        homepage_item = {
            "source_url": company.get("url") or "",
            "source_type": "website",
            "screenshot_path": homepage_screenshot,
            "text_excerpt": page_text[:_MAX_TEXT_CHARS],
            "content_date": None,
        }
        items.append(homepage_item)

    items.extend(sns_items)

    # 5. LLM analysis pass
    items = await _analyze_evidence_batch(items, client_profile_text, llm)

    return items


async def _analyze_evidence_batch(
    items: list[dict],
    client_profile_text: str,
    llm: LLMClient,
) -> list[dict]:
    """
    Enrich each evidence item with LLM-generated analysis fields.

    Adds to each item (in-place):
      - text_translated:  Korean summary (2-3 sentences).
      - related_scores:   List of relevant scoring dimensions.
      - content_date:     YYYY-MM-DD string if found in content, else None.

    Items with fewer than 30 characters of text_excerpt are skipped (defaults
    are set but LLM is not called).

    Args:
        items:               Evidence items collected so far.
        client_profile_text: Korean exporter profile for context.
        llm:                 Initialised LLMClient instance.

    Returns:
        The same list with analysis fields added to every item.
    """
    for item in items:
        text_excerpt: str = item.get("text_excerpt") or ""

        # Set safe defaults regardless of whether we call the LLM
        item.setdefault("text_translated", "")
        item.setdefault("related_scores", [])
        item.setdefault("content_date", None)

        if len(text_excerpt) < _MIN_TEXT_CHARS:
            continue

        # Truncate text fed to the LLM
        text_for_llm = text_excerpt[:_MAX_TEXT_CHARS]

        prompt = f"""다음은 해외 바이어 후보 기업의 웹페이지/SNS 콘텐츠입니다.
아래 한국 수출기업 프로필을 참고하여 콘텐츠를 분석해주세요.

[한국 수출기업 프로필]
{client_profile_text}

[분석할 콘텐츠]
출처: {item.get('source_url', '')}
유형: {item.get('source_type', '')}

{text_for_llm}

다음 JSON 형식으로만 응답해주세요:
{{
  "text_translated": "한국어 요약 2-3문장",
  "related_scores": ["product_fit", "buying_signal", "company_capability", "accessibility", "strategic_value"] 중 해당하는 항목들,
  "content_date": "YYYY-MM-DD 또는 null"
}}

related_scores는 이 콘텐츠가 실제로 근거를 제공하는 차원만 포함하세요.
content_date는 콘텐츠에 명시된 날짜가 있을 때만 YYYY-MM-DD 형식으로, 없으면 null."""

        try:
            result: dict = llm.generate_json(prompt, max_tokens=300)

            # text_translated
            item["text_translated"] = str(result.get("text_translated") or "")

            # related_scores — validate against known dimensions
            raw_scores = result.get("related_scores") or []
            if isinstance(raw_scores, list):
                item["related_scores"] = [
                    s for s in raw_scores
                    if isinstance(s, str) and s in _SCORING_DIMENSIONS
                ]
            else:
                item["related_scores"] = []

            # content_date
            raw_date = result.get("content_date")
            item["content_date"] = raw_date if isinstance(raw_date, str) else None

        except Exception as exc:  # noqa: BLE001
            print(
                f"[evidence_collector] Warning: LLM analysis failed for "
                f"{item.get('source_url', '(unknown)')} — {exc}"
            )
            # Defaults already set above; nothing more to do

    return items
