"""
실제 무역 디렉토리 / 산업 협회 / 비즈니스 DB 탐색
- LLM에게 실제 존재하는 데이터 소스를 질의
- URL 유효성 HTTP HEAD 체크
- 가짜 데이터 생성이 아닌, 실제 소스 발견이 목적
"""
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

from .llm_client import LLMClient


def find_sources(
    llm: LLMClient,
    product_category: str,
    country: str,
) -> list[dict]:
    """
    특정 국가/제품 카테고리에 대한 실제 무역 디렉토리 및 비즈니스 DB 탐색.

    Returns:
        list[dict]: [{name, url, type, description, verified}, ...]
            type: "trade_directory" | "industry_association" | "business_database" | "marketplace"
            verified: URL이 실제 접근 가능한지 여부
    """
    prompt = f"""You are an expert in international trade and B2B sourcing.

For the product category "{product_category}" in {country}, list REAL, currently-active online directories,
industry associations, trade platforms, and business databases where actual companies are listed.

Requirements:
- Only include sources that ACTUALLY EXIST with real, working URLs
- Focus on sources where company listings (names, websites, contacts) can be found
- Include both international platforms (e.g., Kompass, Europages) and local/regional ones
- Include relevant industry associations that publish member directories

Return a JSON array. Each entry:
{{
  "name": "source name",
  "url": "https://actual-url.com",
  "type": "trade_directory | industry_association | business_database | marketplace",
  "description": "What kind of companies are listed here",
  "search_url_pattern": "URL pattern to search for specific products (if known, otherwise null)"
}}

Return 8-15 sources. JSON array only, no other text."""

    print(f"\n  🔍 {country} - {product_category} 관련 데이터 소스 탐색 중...")

    try:
        sources = llm.generate_json(prompt, max_tokens=2048)
        # generate_json이 dict을 반환할 수도 있음 (래핑된 경우)
        if isinstance(sources, dict):
            # {"sources": [...]} 형태 처리
            for key in ("sources", "results", "data", "directories"):
                if key in sources and isinstance(sources[key], list):
                    sources = sources[key]
                    break
            else:
                sources = [sources]

        if not isinstance(sources, list):
            print(f"     ⚠️ LLM 응답 형식 오류 - 빈 리스트 반환")
            return []

        print(f"     📋 {len(sources)}개 데이터 소스 발견")

    except Exception as e:
        print(f"     ❌ 소스 탐색 실패: {e}")
        return []

    # URL 유효성 검증 (병렬 처리)
    verified_sources = _verify_urls(sources)

    valid_count = sum(1 for s in verified_sources if s.get("verified"))
    print(f"     ✅ URL 유효성 검증 완료: {valid_count}/{len(verified_sources)}개 접근 가능")

    return verified_sources


def _verify_urls(sources: list[dict], timeout: int = 10) -> list[dict]:
    """소스 URL의 실제 접근 가능 여부를 병렬로 확인"""
    def check_url(source: dict) -> dict:
        url = source.get("url", "")
        if not url or not url.startswith("http"):
            source["verified"] = False
            return source
        try:
            resp = requests.head(
                url,
                timeout=timeout,
                allow_redirects=True,
                headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"},
            )
            source["verified"] = resp.status_code < 400
        except requests.RequestException:
            # HEAD 실패 시 GET으로 재시도 (일부 서버는 HEAD 차단)
            try:
                resp = requests.get(
                    url,
                    timeout=timeout,
                    allow_redirects=True,
                    headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"},
                    stream=True,  # 본문 다운로드 최소화
                )
                source["verified"] = resp.status_code < 400
                resp.close()
            except requests.RequestException:
                source["verified"] = False
        return source

    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(check_url, s): s for s in sources}
        results = []
        for future in as_completed(futures):
            results.append(future.result())

    return results
