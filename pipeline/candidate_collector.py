"""
데이터 소스에서 실제 업체 정보 수집
- 무역 디렉토리에서 업체 리스트 스크래핑
- BeautifulSoup HTML 파싱
- 중복 제거
- LLM 폴백 (할루시네이션 경고 포함)
"""
import re
import requests
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup

from .llm_client import LLMClient


def collect_from_sources(
    sources: list[dict],
    product_category: str,
    country: str,
    max_per_source: int = 20,
) -> list[dict]:
    """
    검증된 데이터 소스들에서 업체 리스트 수집.

    Returns:
        list[dict]: [{name, url, source, description, source_type}, ...]
            source_type: "directory_scraped" (실제 스크래핑)
    """
    all_candidates = []
    seen_domains = set()

    verified_sources = [s for s in sources if s.get("verified")]
    print(f"\n  📥 {len(verified_sources)}개 소스에서 업체 수집 시작...")

    for source in verified_sources:
        try:
            companies = _scrape_directory(source, product_category, max_per_source)
            new_count = 0
            for company in companies:
                domain = _extract_domain(company.get("url", ""))
                if domain and domain not in seen_domains:
                    seen_domains.add(domain)
                    company["source"] = source["name"]
                    company["source_type"] = "directory_scraped"
                    all_candidates.append(company)
                    new_count += 1

            if new_count > 0:
                print(f"     ✅ {source['name']}: {new_count}개 업체 수집")
            else:
                print(f"     ⚠️ {source['name']}: 업체 추출 실패 (구조 미지원)")

        except Exception as e:
            print(f"     ❌ {source['name']} 스크래핑 실패: {str(e)[:80]}")

    print(f"  📊 소스 스크래핑 결과: 총 {len(all_candidates)}개 업체 (중복 제거 후)")
    return all_candidates


def collect_via_llm_fallback(
    llm: LLMClient,
    product_category: str,
    country: str,
    existing_count: int = 0,
    target_count: int = 30,
) -> list[dict]:
    """
    LLM 기반 후보 생성 (폴백).

    ⚠️ 주의: LLM이 생성한 업체 정보는 할루시네이션을 포함할 수 있음.
    반드시 후속 검증(웹 스크래핑)이 필요.

    Returns:
        list[dict]: [{name, url, description, source, source_type}, ...]
            source_type: "llm_generated" (검증 필요)
    """
    needed = max(0, target_count - existing_count)
    if needed == 0:
        return []

    print(f"\n  🤖 LLM 폴백: {country}에서 {needed}개 추가 후보 생성 중...")
    print(f"     ⚠️ 경고: LLM 생성 데이터는 할루시네이션을 포함할 수 있습니다.")

    prompt = f"""List {needed} REAL companies in {country} that are buyers, distributors, or dealers
of "{product_category}".

IMPORTANT: Only list companies you are confident actually exist. Include their real website URLs.
It is better to list fewer companies with accurate information than many with fabricated data.

For each company, provide:
{{
  "name": "Company Name",
  "url": "https://their-real-website.com",
  "description": "Brief description of what they do, in relation to {product_category}"
}}

Return a JSON array only."""

    try:
        candidates = llm.generate_json(prompt, max_tokens=3000)
        if isinstance(candidates, dict):
            for key in ("companies", "results", "data"):
                if key in candidates and isinstance(candidates[key], list):
                    candidates = candidates[key]
                    break
            else:
                candidates = [candidates]

        if not isinstance(candidates, list):
            return []

        results = []
        for c in candidates:
            if isinstance(c, dict) and c.get("name"):
                c["source"] = "LLM Generated"
                c["source_type"] = "llm_generated"
                c["_warning"] = "할루시네이션 가능 - 검증 필요"
                results.append(c)

        print(f"     📋 LLM이 {len(results)}개 후보 생성 완료")
        return results

    except Exception as e:
        print(f"     ❌ LLM 폴백 실패: {e}")
        return []


def _scrape_directory(source: dict, product_category: str, max_results: int = 20) -> list[dict]:
    """
    단일 무역 디렉토리에서 업체 정보 추출.
    범용 HTML 파서 - 링크와 업체명 패턴을 탐색.
    """
    url = source.get("search_url_pattern") or source.get("url", "")
    if not url:
        return []

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept-Language": "en-US,en;q=0.9",
    }

    try:
        resp = requests.get(url, headers=headers, timeout=15, allow_redirects=True)
        resp.raise_for_status()
    except requests.RequestException:
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    companies = []

    # 전략 1: 구조화된 리스트 항목 탐색 (카드, 리스트 아이템)
    # 일반적인 디렉토리 패턴: .company, .listing, .result, article 등
    selectors = [
        "[class*='company']", "[class*='listing']", "[class*='result']",
        "[class*='vendor']", "[class*='supplier']", "[class*='member']",
        "article", ".card", "[class*='item']",
    ]

    for selector in selectors:
        items = soup.select(selector)
        if len(items) >= 3:  # 최소 3개 이상 발견 시 유효한 패턴
            for item in items[:max_results]:
                company = _extract_company_from_element(item, url)
                if company:
                    companies.append(company)
            if companies:
                break

    # 전략 2: 외부 링크 수집 (디렉토리 페이지의 외부 링크)
    if not companies:
        base_domain = urlparse(url).netloc
        for a_tag in soup.find_all("a", href=True):
            href = a_tag.get("href", "")
            full_url = urljoin(url, href)
            link_domain = urlparse(full_url).netloc

            # 외부 도메인 링크만 (디렉토리 내부 링크 제외)
            if link_domain and link_domain != base_domain and full_url.startswith("http"):
                name = a_tag.get_text(strip=True)
                if name and len(name) > 2 and len(name) < 100:
                    companies.append({
                        "name": name,
                        "url": full_url,
                        "description": "",
                    })
                    if len(companies) >= max_results:
                        break

    return companies


def _extract_company_from_element(element, base_url: str) -> dict | None:
    """HTML 요소에서 업체 정보 추출"""
    # 이름 추출 시도: h2, h3, h4, strong, .name, .title 순서
    name = ""
    for tag in ["h2", "h3", "h4", "strong", "[class*='name']", "[class*='title']", "a"]:
        found = element.select_one(tag)
        if found:
            name = found.get_text(strip=True)
            if name and len(name) > 1:
                break

    if not name:
        return None

    # URL 추출
    url = ""
    link = element.select_one("a[href]")
    if link:
        href = link.get("href", "")
        url = urljoin(base_url, href)

    # 설명 추출
    desc = ""
    for tag in ["p", "[class*='desc']", "[class*='detail']", "[class*='info']"]:
        found = element.select_one(tag)
        if found:
            desc = found.get_text(strip=True)[:200]
            break

    if not url:
        return None

    return {
        "name": _clean_name(name),
        "url": url,
        "description": desc,
    }


def _extract_domain(url: str) -> str:
    """URL에서 도메인 추출 (중복 체크용)"""
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        # www. 제거
        if domain.startswith("www."):
            domain = domain[4:]
        return domain
    except Exception:
        return ""


def _clean_name(name: str) -> str:
    """업체명 정리"""
    # 불필요한 공백 제거
    name = re.sub(r"\s+", " ", name).strip()
    # 너무 긴 이름 자르기
    if len(name) > 80:
        name = name[:80].rsplit(" ", 1)[0]
    return name
