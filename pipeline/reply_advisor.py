"""
바이어 답장 분석 및 대응 전략 제안
- 바이어가 답장했을 때 내용 분석
- 답장 유형 분류 (긍정/부정/질문/가격문의/샘플요청 등)
- 다음 단계 대응 이메일 초안 생성
- 컨설팅 과정에서 활용하는 도구 (파이프라인 자동 실행은 아님)
"""
from .llm_client import LLMClient


# 답장 유형 분류
REPLY_TYPES = {
    "positive_interest": "긍정적 관심 표현 - 제품/카탈로그 요청",
    "price_inquiry": "가격 문의 - 견적/MOQ/가격표 요청",
    "sample_request": "샘플 요청 - 샘플/테스트 제품 요청",
    "meeting_request": "미팅 요청 - 전화/화상/대면 미팅 제안",
    "technical_question": "기술 질문 - 사양/인증/기술 관련 문의",
    "referral": "다른 담당자 안내 - 적절한 담당자 소개",
    "not_interested": "관심 없음 - 정중한 거절",
    "delayed": "나중에 연락 - 현재는 시기가 아님",
    "already_supplied": "이미 공급사 있음 - 기존 거래처 언급",
    "out_of_office": "자동응답/부재중",
}


def analyze_reply(
    reply_text: str,
    original_email: dict,
    company: dict,
    client_profile_text: str,
    llm: LLMClient,
) -> dict:
    """
    바이어 답장을 분석하고 대응 전략 및 답변 이메일 초안 생성.

    Args:
        reply_text: 바이어의 답장 원문
        original_email: 보낸 이메일 (subject, body)
        company: 업체 정보 dict
        client_profile_text: 수출업체 프로필
        llm: LLM 클라이언트

    Returns:
        {reply_type, sentiment, analysis, next_steps, response_draft}
    """
    analysis = company.get("analysis", {})

    prompt = f"""You are an expert international trade consultant analyzing a buyer's reply email.

=== CONTEXT ===
Sender (Korean Exporter):
{client_profile_text}

Recipient Company: {company.get('name', 'Unknown')}
Country: {company.get('_country', 'N/A')}
Match Score: {analysis.get('match_score', 'N/A')}
Their Products: {', '.join(analysis.get('detected_products', []))}

=== ORIGINAL EMAIL SENT ===
Subject: {original_email.get('subject', '')}
Body: {original_email.get('body', '')[:400]}

=== BUYER'S REPLY ===
{reply_text}

=== ANALYSIS REQUEST ===
Analyze the reply and provide strategic guidance in JSON:

{{
  "reply_type": "one of: positive_interest | price_inquiry | sample_request | meeting_request | technical_question | referral | not_interested | delayed | already_supplied | out_of_office",
  "sentiment": "positive | neutral | negative",
  "urgency": "high | medium | low",
  "key_points": ["bullet points of what the buyer is asking/saying (in Korean)"],
  "buyer_intent_analysis": "What is the buyer really looking for? Read between the lines (in Korean, 2-3 sentences)",
  "next_steps": [
    "Recommended action 1 (in Korean)",
    "Recommended action 2 (in Korean)",
    "Recommended action 3 (in Korean)"
  ],
  "negotiation_tips": "Specific negotiation advice for this situation (in Korean, 2-3 sentences)",
  "response_email": {{
    "subject": "Response email subject",
    "body": "Response email body (professional, addresses their points specifically)"
  }},
  "internal_notes": "Private notes for the Korean exporter about this lead's potential (in Korean)"
}}

Guidelines:
- Be specific about next steps (not generic advice)
- The response email should directly address every point the buyer raised
- If they asked for price: suggest providing a range or requesting their volume needs first
- If they said not interested: suggest a graceful exit that keeps the door open
- If referral: suggest acknowledging and reaching out to the referred person
- Consider the cultural context of {company.get('_country', 'the recipient country')}

Return valid JSON only."""

    result = llm.generate_json(prompt, max_tokens=1200)

    return {
        "reply_type": result.get("reply_type", ""),
        "reply_type_label": REPLY_TYPES.get(result.get("reply_type", ""), ""),
        "sentiment": result.get("sentiment", "neutral"),
        "urgency": result.get("urgency", "medium"),
        "key_points": result.get("key_points", []),
        "buyer_intent_analysis": result.get("buyer_intent_analysis", ""),
        "next_steps": result.get("next_steps", []),
        "negotiation_tips": result.get("negotiation_tips", ""),
        "response_email": result.get("response_email", {}),
        "internal_notes": result.get("internal_notes", ""),
    }


def analyze_replies_batch(
    replies: list[dict],
    client_profile_text: str,
    llm: LLMClient,
) -> list[dict]:
    """
    여러 바이어 답장 일괄 분석.

    Args:
        replies: [{reply_text, original_email, company}, ...]
        client_profile_text: 수출업체 프로필
        llm: LLM 클라이언트

    Returns:
        각 reply에 analysis 추가
    """
    print(f"\n  💬 답장 분석: {len(replies)}건")

    for i, reply in enumerate(replies, 1):
        name = reply.get("company", {}).get("name", "Unknown")
        print(f"     [{i}/{len(replies)}] {name}")

        try:
            result = analyze_reply(
                reply_text=reply["reply_text"],
                original_email=reply.get("original_email", {}),
                company=reply.get("company", {}),
                client_profile_text=client_profile_text,
                llm=llm,
            )
            reply["reply_analysis"] = result
            print(f"       → {result['reply_type_label']} ({result['sentiment']})")
        except Exception as e:
            print(f"       ⚠️ 분석 실패: {e}")
            reply["reply_analysis"] = {"error": str(e)}

    return replies
