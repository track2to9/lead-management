"""
전시회/이벤트 매칭 모듈
- 타겟 바이어가 참가할 가능성 있는 전시회 자동 탐색
- 국가/산업별 주요 전시회 매핑
- 전시회 기반 현장 미팅 제안 이메일 생성
"""
from .llm_client import LLMClient


def find_exhibitions(
    product_category: str,
    countries: list[str],
    llm: LLMClient,
) -> list[dict]:
    """
    제품 카테고리와 타겟 국가에 맞는 전시회/이벤트 탐색.

    Args:
        product_category: 제품 카테고리 (예: "hydraulic breaker parts")
        countries: 타겟 국가 목록
        llm: LLM 클라이언트

    Returns:
        전시회 정보 리스트
    """
    countries_str = ", ".join(countries)

    prompt = f"""You are a trade show expert. Find relevant international trade exhibitions
for the following product category and target markets.

=== PRODUCT CATEGORY ===
{product_category}

=== TARGET COUNTRIES/REGIONS ===
{countries_str}

=== REQUEST ===
List 5-8 REAL, well-known trade exhibitions. Keep it concise.

Return JSON:
{{
  "exhibitions": [
    {{
      "name": "Exhibition name",
      "location": "City, Country",
      "typical_month": "Month range",
      "website": "URL",
      "relevance": "Why relevant (Korean, 1 sentence)",
      "countries_represented": ["{countries_str}"],
      "action_suggestion": "What to do (Korean, 1 sentence)"
    }}
  ]
}}

Only list exhibitions you're confident exist. JSON only, no other text."""

    print(f"\n  🎪 전시회 탐색: {product_category} ({countries_str})")

    try:
        result = llm.generate_json(prompt, max_tokens=2000)
        exhibitions = result.get("exhibitions", [])
        print(f"     → {len(exhibitions)}개 전시회 발견")
    except Exception as e:
        print(f"     ⚠️ 전시회 탐색 실패 (건너뜀): {e}")
        exhibitions = []

    return exhibitions


def match_exhibitions_to_companies(
    exhibitions: list[dict],
    companies: list[dict],
) -> list[dict]:
    """
    전시회와 잠재 바이어를 매칭하여 현장 미팅 기회 식별.

    Args:
        exhibitions: find_exhibitions() 결과
        companies: 분석 완료된 업체 리스트

    Returns:
        companies에 matched_exhibitions 키 추가
    """
    for company in companies:
        country = company.get("_country", "")
        score = company.get("analysis", {}).get("match_score", 0)

        if score < 30:
            company["matched_exhibitions"] = []
            continue

        matched = []
        for ex in exhibitions:
            represented = ex.get("countries_represented", [])
            if country in represented or not represented:
                matched.append({
                    "name": ex.get("name", ""),
                    "location": ex.get("location", ""),
                    "typical_month": ex.get("typical_month", ""),
                    "website": ex.get("website", ""),
                    "action": ex.get("action_suggestion", ""),
                })

        company["matched_exhibitions"] = matched

    matched_count = sum(1 for c in companies if c.get("matched_exhibitions"))
    print(f"     → {matched_count}개 업체에 전시회 매칭 완료")

    return companies


def draft_exhibition_meeting_email(
    company: dict,
    exhibition: dict,
    client_profile_text: str,
    llm: LLMClient,
    sender_name: str = "",
) -> dict:
    """
    특정 전시회에서의 현장 미팅을 제안하는 이메일 생성.

    Args:
        company: 업체 정보
        exhibition: 전시회 정보
        client_profile_text: 수출업체 프로필
        llm: LLM 클라이언트
        sender_name: 발신자 이름

    Returns:
        {subject, body}
    """
    analysis = company.get("analysis", {})

    prompt = f"""Write a brief B2B email suggesting a meeting at a trade exhibition.

=== SENDER ===
{client_profile_text}
Sender: {sender_name or '[Name]'}

=== RECIPIENT ===
Company: {company.get('name', 'Unknown')}
Country: {company.get('_country', 'N/A')}
Their products: {', '.join(analysis.get('detected_products', []))}

=== EXHIBITION ===
Name: {exhibition.get('name', '')}
Location: {exhibition.get('location', '')}
When: {exhibition.get('typical_month', '')}

=== REQUIREMENTS ===
1. Mention you'll be at the exhibition (or are planning to visit)
2. Suggest meeting at their booth or a nearby meeting point
3. Keep it under 120 words
4. Friendly, enthusiastic but professional tone
5. Include specific value of meeting face-to-face for both parties

Return as JSON: {{"subject": "...", "body": "..."}}
JSON only."""

    result = llm.generate_json(prompt, max_tokens=500)

    return {
        "subject": result.get("subject", ""),
        "body": result.get("body", ""),
        "exhibition": exhibition.get("name", ""),
    }
