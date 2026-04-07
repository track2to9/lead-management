"""
잠재고객 초기 접촉 이메일 생성
- 분석 결과 기반 맞춤형 이메일
- match_score < 30 이하는 스킵
- 국가별 비즈니스 커뮤니케이션 톤 자동 조정
"""
from .llm_client import LLMClient


# 국가별 비즈니스 커뮤니케이션 가이드
COUNTRY_TONE_GUIDE = {
    # 동아시아
    "Japan": {
        "tone": "Extremely polite, formal, relationship-focused",
        "tips": [
            "Use honorific language patterns (even in English)",
            "Emphasize company history, reliability, long-term partnership",
            "Mention mutual benefit and harmony",
            "Include proper seasonal greeting if applicable",
            "Avoid being too direct about pricing in first contact",
            "Reference any Japanese clients or partners if available",
        ],
        "greeting_style": "Dear [Title] [Last Name]-san",
        "avoid": "Being too casual, pushing for immediate response, aggressive sales language",
    },
    "China": {
        "tone": "Respectful, relationship-building, emphasize mutual benefit",
        "tips": [
            "Mention guanxi (relationship) building potential",
            "Emphasize win-win cooperation",
            "Reference market size and growth opportunity",
            "Show respect for their company's achievements",
        ],
        "greeting_style": "Dear [Title] [Name]",
        "avoid": "Being overly casual, ignoring hierarchy",
    },
    # 유럽 - 서유럽
    "Germany": {
        "tone": "Direct, technical, efficiency-focused",
        "tips": [
            "Lead with technical specifications and certifications",
            "Mention quality standards (ISO, CE, DIN)",
            "Be precise about delivery times and MOQ",
            "Germans appreciate directness - get to the point quickly",
            "Include technical data sheets or test reports",
        ],
        "greeting_style": "Dear Mr./Ms. [Last Name]",
        "avoid": "Vague claims, excessive small talk, emotional appeals",
    },
    "France": {
        "tone": "Formal, elegant, culturally aware",
        "tips": [
            "Show appreciation for French business culture",
            "Mention quality and design aspects",
            "Be formal but not stiff",
        ],
        "greeting_style": "Dear Mr./Ms. [Last Name]",
        "avoid": "Being too American-style casual, ignoring formalities",
    },
    "Netherlands": {
        "tone": "Direct, pragmatic, egalitarian",
        "tips": [
            "Dutch appreciate directness and honesty",
            "Focus on practical benefits and cost-efficiency",
            "Be informal but professional",
        ],
        "greeting_style": "Dear [First Name]",
        "avoid": "Excessive formality, beating around the bush",
    },
    # 유럽 - 동유럽
    "Poland": {
        "tone": "Professional, warm, relationship-oriented",
        "tips": [
            "Polish business culture values personal relationships",
            "Show interest in their market/region",
            "Mention competitive pricing and reliable delivery",
            "Reference EU market standards",
        ],
        "greeting_style": "Dear Mr./Ms. [Last Name]",
        "avoid": "Being condescending, ignoring Polish market specifics",
    },
    "Turkey": {
        "tone": "Warm, relationship-focused, flexible on negotiation",
        "tips": [
            "Turkish business culture values personal relationships highly",
            "Show warmth and genuine interest in their business",
            "Leave room for price negotiation (expected)",
            "Mention flexibility in payment terms or MOQ",
            "Express interest in visiting or meeting at trade shows",
        ],
        "greeting_style": "Dear Mr./Ms. [Last Name]",
        "avoid": "Being too rigid on terms, cold/impersonal tone",
    },
    # 중동
    "UAE": {
        "tone": "Respectful, relationship-first, patient",
        "tips": [
            "Emphasize trust, reliability, and long-term partnership",
            "Mention any Middle East references or certifications",
            "Be patient - business decisions take time",
            "Show respect for cultural values",
        ],
        "greeting_style": "Dear [Title] [Name]",
        "avoid": "Rushing, being too informal, ignoring cultural norms",
    },
    "Saudi Arabia": {
        "tone": "Formal, respectful, patience-oriented",
        "tips": [
            "Emphasize reliability and long-term commitment",
            "Reference Vision 2030 alignment if relevant",
            "Show willingness to build relationship before business",
        ],
        "greeting_style": "Dear [Title] [Name]",
        "avoid": "Being pushy, overly casual tone",
    },
    # 동남아
    "Vietnam": {
        "tone": "Respectful, relationship-oriented, price-conscious",
        "tips": [
            "Emphasize competitive pricing and value",
            "Show understanding of their growing market",
            "Mention Korean brand reputation in Vietnam",
        ],
        "greeting_style": "Dear Mr./Ms. [Name]",
        "avoid": "Being condescending about market development",
    },
    "Indonesia": {
        "tone": "Polite, warm, community-focused",
        "tips": [
            "Emphasize partnership and mutual growth",
            "Show respect for local business practices",
            "Mention regional distribution capability",
        ],
        "greeting_style": "Dear Mr./Ms. [Name]",
        "avoid": "Being too aggressive or pushy",
    },
    # 미주
    "USA": {
        "tone": "Professional, confident, value-proposition focused",
        "tips": [
            "Lead with clear value proposition",
            "Be concise and action-oriented",
            "Mention any US certifications or partnerships",
            "Include ROI or cost-savings data if available",
        ],
        "greeting_style": "Dear [First Name]",
        "avoid": "Being too formal or overly wordy",
    },
    "Brazil": {
        "tone": "Warm, personal, relationship-building",
        "tips": [
            "Brazilians value personal connection in business",
            "Show genuine interest in their business",
            "Be flexible and open to discussion",
        ],
        "greeting_style": "Dear [First Name]",
        "avoid": "Being too cold or transactional",
    },
}

# 기본 톤 가이드 (매핑에 없는 국가용)
DEFAULT_TONE_GUIDE = {
    "tone": "Professional, respectful, internationally aware",
    "tips": [
        "Be professional and courteous",
        "Show genuine interest in their business",
        "Mention relevant certifications or quality standards",
        "Keep it concise and focused on mutual benefit",
    ],
    "greeting_style": "Dear Mr./Ms. [Last Name]",
    "avoid": "Being too casual or too aggressive",
}


def draft_emails(
    companies: list[dict],
    client_profile_text: str,
    llm: LLMClient,
    min_score: int = 30,
    sender_name: str = "",
    sender_title: str = "International Sales",
) -> list[dict]:
    """
    적격 잠재고객에 대한 초기 접촉 이메일 초안 생성.

    Args:
        companies: 분석 완료된 업체 리스트
        client_profile_text: 수출업체 프로필
        llm: LLM 클라이언트
        min_score: 최소 매칭 점수 (미만은 스킵)
        sender_name: 발신자 이름
        sender_title: 발신자 직함

    Returns:
        companies에 email_draft 키 추가하여 반환
    """
    qualified = [c for c in companies if c.get("analysis", {}).get("match_score", 0) >= min_score]
    skipped = len(companies) - len(qualified)

    if skipped > 0:
        print(f"\n  📧 이메일 생성: {len(qualified)}개 업체 대상 (매칭 {min_score}점 미만 {skipped}개 스킵)")
    else:
        print(f"\n  📧 이메일 생성: {len(qualified)}개 업체 대상")

    for i, company in enumerate(qualified, 1):
        analysis = company.get("analysis", {})
        name = company.get("name", "Unknown")

        print(f"     [{i}/{len(qualified)}] {name} (매칭 {analysis.get('match_score', 0)}점)")

        try:
            email = _generate_email(
                company=company,
                analysis=analysis,
                client_profile_text=client_profile_text,
                llm=llm,
                sender_name=sender_name,
                sender_title=sender_title,
            )
            company["email_draft"] = email
        except Exception as e:
            print(f"       ⚠️ 이메일 생성 실패: {e}")
            company["email_draft"] = {
                "subject": "",
                "body": "",
                "error": str(e),
            }

    # 미달 업체에는 빈 이메일
    for c in companies:
        if "email_draft" not in c:
            c["email_draft"] = {"subject": "", "body": "", "skipped": True}

    return companies


def _get_tone_guide(country: str) -> dict:
    """국가별 비즈니스 톤 가이드 반환"""
    return COUNTRY_TONE_GUIDE.get(country, DEFAULT_TONE_GUIDE)


def _generate_email(
    company: dict,
    analysis: dict,
    client_profile_text: str,
    llm: LLMClient,
    sender_name: str,
    sender_title: str,
) -> dict:
    """단일 업체에 대한 이메일 초안 생성 (국가별 톤 반영)"""

    country = company.get("_country", "")
    tone_guide = _get_tone_guide(country)
    tone_section = f"""
=== COUNTRY-SPECIFIC COMMUNICATION GUIDE ({country}) ===
Tone: {tone_guide['tone']}
Tips:
{chr(10).join(f'  - {tip}' for tip in tone_guide['tips'])}
Greeting style: {tone_guide['greeting_style']}
Avoid: {tone_guide['avoid']}
"""

    # 인텔리전스 정보가 있으면 프롬프트에 포함
    intel_section = ""
    current_suppliers = analysis.get("current_suppliers", [])
    decision_maker = analysis.get("decision_maker_hint", "")
    if current_suppliers or decision_maker:
        intel_section = "\n=== BUYER INTELLIGENCE ===\n"
        if current_suppliers:
            intel_section += f"Current suppliers/brands: {', '.join(current_suppliers)}\n"
        if decision_maker:
            intel_section += f"Likely decision maker: {decision_maker}\n"
        intel_section += "Use this intel subtly - don't mention you know their suppliers, but tailor the pitch.\n"

    prompt = f"""Write a professional B2B initial contact email for international trade.

=== SENDER (Korean Exporter) ===
{client_profile_text}
Sender: {sender_name or '[Name]'}, {sender_title}

=== RECIPIENT ===
Company: {company.get('name', 'Unknown')}
Website: {company.get('url', 'N/A')}
What they do: {analysis.get('summary', 'N/A')}
Relevant products they handle: {', '.join(analysis.get('detected_products', []))}
Recommended approach: {analysis.get('approach', 'N/A')}
{tone_section}{intel_section}
=== REQUIREMENTS ===
1. Write in English (professional, concise, not salesy)
2. IMPORTANT: Follow the country-specific tone guide above precisely
3. Subject line: specific, mentioning their company or product relevance
4. Body:
   - Brief introduction of the sender company
   - Specific reason why you're reaching out to THIS company (show you did research)
   - 1-2 specific product categories that match their business
   - Clear call to action (suggest a brief call or request to send catalog)
   - Professional closing matching the cultural tone
5. Keep it under 200 words
6. Do NOT use generic templates - make it specific to this company

Return as JSON:
{{
  "subject": "Email subject line",
  "body": "Full email body text"
}}

JSON only, no other text."""

    result = llm.generate_json(prompt, max_tokens=800)

    return {
        "subject": result.get("subject", ""),
        "body": result.get("body", ""),
        "tone_country": country,
    }
