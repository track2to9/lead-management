"""
LLM 기반 잠재고객 적합성 분석
- lead-verifier/company_analyzer.py의 일반화 버전
- 클라이언트 프로필을 파라미터로 받음 (하드코딩 제거)
- 구조화된 JSON 출력
- 비영어 사이트 대응 (이중 언어 프롬프트)
"""
from .llm_client import LLMClient


async def analyze_company(
    company: dict,
    page_text: str,
    client_profile_text: str,
    llm: LLMClient,
) -> dict:
    """
    업체 홈페이지 내용을 분석하여 클라이언트 제품과의 매칭도 평가.

    Args:
        company: 업체 정보 dict (name, url 등)
        page_text: 홈페이지에서 추출한 텍스트
        client_profile_text: 수출업체(클라이언트) 프로필 텍스트
        llm: LLM 클라이언트 인스턴스

    Returns:
        company dict에 analysis 키 추가하여 반환
    """
    if not page_text or len(page_text.strip()) < 50:
        company["analysis"] = _empty_analysis("홈페이지 내용 부족 / Insufficient page content")
        return company

    # 텍스트가 너무 길면 잘라냄 (토큰 절약)
    page_text = page_text[:4000]

    prompt = f"""You are an expert B2B trade analyst. Analyze whether this company could be a potential buyer/distributor for our client's products.

=== OUR CLIENT (Korean Exporter) ===
{client_profile_text}

=== TARGET COMPANY ===
Company: {company.get('name', 'Unknown')}
Website: {company.get('url', 'N/A')}
Source: {company.get('source', 'N/A')}

Website Content (may be in local language):
{page_text}

=== ANALYSIS REQUEST ===
Analyze the target company and provide your assessment in the following JSON format:

{{
  "sells_relevant_product": true/false,
  "confidence": "high" | "medium" | "low",
  "match_score": 0-100,
  "company_summary": "2-3 sentence summary of what this company does (in Korean / 한국어로)",
  "match_reason": "Why this company is or isn't a good match (in Korean / 한국어로, 1-2 sentences)",
  "approach": "Recommended approach strategy if this is a match (in Korean / 한국어로, 1-2 sentences)",
  "priority": "high" | "medium" | "low",
  "detected_products": ["list of relevant products/services this company deals with"],

  "current_suppliers": ["brands/suppliers mentioned or implied on their website"],
  "company_size_estimate": "small (<50) | medium (50-500) | large (500+) | unknown",
  "decision_maker_hint": "Likely decision maker role/title based on company type (e.g., 'Procurement Manager', 'Owner/CEO for small firms') (in Korean)",
  "best_timing": "Best timing to approach this company (e.g., trade show season, budget cycle, product launch period) (in Korean / 한국어로)",
  "competitive_landscape": "Brief note on their current supplier situation and switching potential (in Korean / 한국어로, 1 sentence)"
}}

Guidelines:
- match_score: 80-100 = ideal buyer, 50-79 = possible buyer, 30-49 = weak match, 0-29 = not relevant
- priority: high = should contact immediately, medium = worth contacting, low = skip or deprioritize
- If the website content is not in English, still analyze it (you understand multiple languages)
- Be conservative with scores - only give high scores for clear, strong matches
- For current_suppliers: extract brand names, partner logos, or mentions from the website content
- For company_size_estimate: infer from website content (team page, office locations, product range)
- For decision_maker_hint: suggest the most likely title/role to target based on company size and type
- For best_timing: consider industry cycles, trade show seasons, or fiscal year patterns for their country
- For competitive_landscape: note if they seem locked into existing suppliers or open to alternatives

Return valid JSON only."""

    try:
        result = llm.generate_json(prompt, max_tokens=600)

        # 필수 필드 기본값 보정
        analysis = {
            "sells_relevant_product": result.get("sells_relevant_product", False),
            "confidence": result.get("confidence", "low"),
            "match_score": _safe_score(result.get("match_score", 0)),
            "summary": result.get("company_summary", ""),
            "match_reason": result.get("match_reason", ""),
            "approach": result.get("approach", ""),
            "priority": result.get("priority", "low"),
            "detected_products": result.get("detected_products", []),
            # 바이어 인텔리전스 확장 필드
            "current_suppliers": result.get("current_suppliers", []),
            "company_size_estimate": result.get("company_size_estimate", "unknown"),
            "decision_maker_hint": result.get("decision_maker_hint", ""),
            "best_timing": result.get("best_timing", ""),
            "competitive_landscape": result.get("competitive_landscape", ""),
        }

        company["analysis"] = analysis

        score = analysis["match_score"]
        priority = analysis["priority"]
        reason = analysis["match_reason"][:60]
        print(f"     📊 매칭: {score}점 ({priority}) - {reason}")

    except Exception as e:
        print(f"     ⚠️ 분석 실패: {e}")
        company["analysis"] = _empty_analysis(f"분석 오류: {str(e)[:50]}")

    return company


async def analyze_batch(
    companies: list[dict],
    client_profile_text: str,
    llm: LLMClient,
) -> list[dict]:
    """여러 업체 일괄 분석"""
    for c in companies:
        page_text = c.get("page_text", "")
        if c.get("url_accessible", True):
            await analyze_company(c, page_text, client_profile_text, llm)
        else:
            c["analysis"] = _empty_analysis("홈페이지 접속 불가")
    return companies


def _empty_analysis(reason: str) -> dict:
    """빈 분석 결과 생성"""
    return {
        "sells_relevant_product": False,
        "confidence": "low",
        "match_score": 0,
        "summary": reason,
        "match_reason": reason,
        "approach": "",
        "priority": "low",
        "detected_products": [],
    }


def _safe_score(value) -> int:
    """매칭 점수를 안전하게 정수로 변환"""
    try:
        score = int(value)
        return max(0, min(100, score))
    except (TypeError, ValueError):
        return 0
