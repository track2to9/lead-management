"""
SNS Crawler Module — Phase 2 evidence collection.

Extracts SNS links from page text and crawls each linked SNS page
using Playwright for screenshot + text content.
"""
import re
import os
from datetime import datetime
from urllib.parse import urlparse, urlunparse

# Maps URL domain fragments to SNS type names
SNS_PATTERNS = [
    ("linkedin", ["linkedin.com"]),
    ("facebook", ["facebook.com", "fb.com"]),
    ("instagram", ["instagram.com"]),
    ("x", ["twitter.com", "x.com"]),
]

# Broad URL regex — capture http/https links
_URL_RE = re.compile(
    r"https?://[^\s\"'<>\]\)]+",
    re.IGNORECASE,
)


def _strip_query(url: str) -> str:
    """Remove query string and fragment from a URL."""
    parsed = urlparse(url)
    return urlunparse(parsed._replace(query="", fragment=""))


def _sns_type(url: str) -> str | None:
    """Return SNS type string if the URL belongs to a known platform, else None."""
    try:
        host = urlparse(url).netloc.lower().lstrip("www.")
    except Exception:
        return None
    for sns_type, domains in SNS_PATTERNS:
        for domain in domains:
            if host == domain or host.endswith("." + domain):
                return sns_type
    return None


def extract_sns_links(page_text: str, page_url: str = "") -> list[dict]:
    """
    Extract SNS links from raw page text.

    Deduplicates by platform — keeps only the first URL seen per SNS type.

    Returns:
        list[dict]: [{"url": str, "type": str}, ...]
    """
    seen_types: set[str] = set()
    results: list[dict] = []

    for match in _URL_RE.finditer(page_text):
        raw_url = match.group(0)
        sns_type = _sns_type(raw_url)
        if sns_type is None:
            continue
        if sns_type in seen_types:
            continue
        seen_types.add(sns_type)
        clean_url = _strip_query(raw_url)
        results.append({"url": clean_url, "type": sns_type})

    return results


async def crawl_sns_page(
    page_url: str,
    sns_type: str,
    browser_context,
    screenshot_dir: str,
    company_name: str = "",
) -> list[dict]:
    """
    Crawl a single SNS page with Playwright and collect evidence.

    Args:
        page_url:         Full URL of the SNS page.
        sns_type:         One of "linkedin", "facebook", "instagram", "x".
        browser_context:  Playwright BrowserContext (already open).
        screenshot_dir:   Directory where screenshots will be saved.
        company_name:     Used to build a human-readable filename.

    Returns:
        list[dict] with one item on success, empty list on failure:
            [{
                "source_url": str,
                "source_type": str,
                "text_excerpt": str,
                "screenshot_path": str,
                "content_date": None,
            }]
    """
    try:
        # Build a safe filename
        safe_name = re.sub(r"[^\w\-]", "_", company_name) if company_name else "unknown"
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = f"{safe_name}_{sns_type}_{timestamp}.png"
        screenshot_path = os.path.join(screenshot_dir, filename)

        os.makedirs(screenshot_dir, exist_ok=True)

        page = await browser_context.new_page()
        try:
            await page.goto(
                page_url,
                wait_until="domcontentloaded",
                timeout=15_000,
            )
            # Wait for dynamic content to settle
            await page.wait_for_timeout(2_000)

            # Screenshot — PNG format (Playwright reliably supports png)
            await page.screenshot(
                path=screenshot_path,
                type="png",
                full_page=False,
            )

            # Extract visible text, capped at 3000 characters
            raw_text: str = await page.evaluate("document.body.innerText")
            text_excerpt = raw_text[:3000] if raw_text else ""

        finally:
            await page.close()

        return [
            {
                "source_url": page_url,
                "source_type": sns_type,
                "text_excerpt": text_excerpt,
                "screenshot_path": screenshot_path,
                "content_date": None,
            }
        ]

    except Exception as exc:  # noqa: BLE001
        print(f"[sns_crawler] Warning: failed to crawl {page_url} ({sns_type}): {exc}")
        return []
