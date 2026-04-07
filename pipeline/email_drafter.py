"""
잠재고객 초기 접촉 이메일 생성
- 분석 결과 기반 맞춤형 이메일
- match_score < 30 이하는 스킵
- 영어 기본 (타겟 시장 언어)
"""
from .llm_client import LLMClient


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


def _generate_email(
    company: dict,
    analysis: dict,
    client_profile_text: str,
    llm: LLMClient,
    sender_name: str,
    sender_title: str,
) -> dict:
    """단일 업체에 대한 이메일 초안 생성"""

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

=== REQUIREMENTS ===
1. Write in English (professional, concise, not salesy)
2. Subject line: specific, mentioning their company or product relevance
3. Body:
   - Brief introduction of the sender company
   - Specific reason why you're reaching out to THIS company (show you did research)
   - 1-2 specific product categories that match their business
   - Clear call to action (suggest a brief call or request to send catalog)
   - Professional closing
4. Keep it under 200 words
5. Do NOT use generic templates - make it specific to this company

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
    }
