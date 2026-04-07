"""
팔로업 이메일 시퀀스 생성기
- 첫 이메일 발송 후 3일/7일/14일 후속 이메일 자동 생성
- 각 단계별 다른 접근 각도 (가치 제안, 사례 공유, 마지막 기회)
- GPT 단독 사용 대비 핵심 차별화 기능
"""
from .llm_client import LLMClient


# 팔로업 시퀀스 설정
FOLLOWUP_SEQUENCE = [
    {
        "day": 3,
        "label": "3일 후",
        "angle": "value_reminder",
        "description": "첫 이메일의 핵심 가치를 다시 짧게 강조. 바이어가 놓쳤을 수 있는 포인트 보충.",
    },
    {
        "day": 7,
        "label": "7일 후",
        "angle": "social_proof",
        "description": "유사 사례나 레퍼런스 공유. 다른 바이어/시장에서의 성공 경험 언급.",
    },
    {
        "day": 14,
        "label": "14일 후",
        "angle": "last_chance",
        "description": "부드러운 마무리. 관심 없으면 괜찮다는 톤이지만, 향후 기회를 위한 연결고리 유지.",
    },
]


def draft_followup_sequence(
    companies: list[dict],
    client_profile_text: str,
    llm: LLMClient,
    min_score: int = 30,
    sender_name: str = "",
    sender_title: str = "International Sales",
) -> list[dict]:
    """
    적격 잠재고객에 대한 3단계 팔로업 이메일 시퀀스 생성.

    Args:
        companies: 초기 이메일이 이미 생성된 업체 리스트
        client_profile_text: 수출업체 프로필
        llm: LLM 클라이언트
        min_score: 최소 매칭 점수
        sender_name: 발신자 이름
        sender_title: 발신자 직함

    Returns:
        companies에 followup_sequence 키 추가하여 반환
    """
    qualified = [
        c for c in companies
        if c.get("analysis", {}).get("match_score", 0) >= min_score
        and c.get("email_draft", {}).get("subject")  # 초기 이메일이 있는 경우만
    ]

    skipped = len(companies) - len(qualified)
    print(f"\n  📬 팔로업 시퀀스 생성: {len(qualified)}개 업체 대상 (스킵 {skipped}개)")

    for i, company in enumerate(qualified, 1):
        analysis = company.get("analysis", {})
        name = company.get("name", "Unknown")
        print(f"     [{i}/{len(qualified)}] {name} (매칭 {analysis.get('match_score', 0)}점)")

        try:
            sequence = _generate_sequence(
                company=company,
                analysis=analysis,
                initial_email=company.get("email_draft", {}),
                client_profile_text=client_profile_text,
                llm=llm,
                sender_name=sender_name,
                sender_title=sender_title,
            )
            company["followup_sequence"] = sequence
        except Exception as e:
            print(f"       ⚠️ 팔로업 생성 실패: {e}")
            company["followup_sequence"] = {"error": str(e), "emails": []}

    # 미대상 업체
    for c in companies:
        if "followup_sequence" not in c:
            c["followup_sequence"] = {"skipped": True, "emails": []}

    return companies


def _generate_sequence(
    company: dict,
    analysis: dict,
    initial_email: dict,
    client_profile_text: str,
    llm: LLMClient,
    sender_name: str,
    sender_title: str,
) -> dict:
    """단일 업체에 대한 3단계 팔로업 시퀀스 생성 (1회 LLM 호출로 3개 모두 생성)"""

    followup_descriptions = "\n".join([
        f"  {idx+1}. Day {f['day']} ({f['label']}) - Angle: {f['angle']}\n"
        f"     Strategy: {f['description']}"
        for idx, f in enumerate(FOLLOWUP_SEQUENCE)
    ])

    prompt = f"""Generate a 3-step follow-up email sequence for a B2B international trade context.
The initial email has already been sent. These are follow-ups for when there's NO reply.

=== SENDER (Korean Exporter) ===
{client_profile_text}
Sender: {sender_name or '[Name]'}, {sender_title}

=== RECIPIENT ===
Company: {company.get('name', 'Unknown')}
Website: {company.get('url', 'N/A')}
What they do: {analysis.get('summary', 'N/A')}
Products they handle: {', '.join(analysis.get('detected_products', []))}
Country: {company.get('_country', 'N/A')}

=== INITIAL EMAIL SENT ===
Subject: {initial_email.get('subject', '')}
Body: {initial_email.get('body', '')[:300]}

=== FOLLOW-UP SCHEDULE ===
{followup_descriptions}

=== REQUIREMENTS ===
1. Each follow-up must have a DIFFERENT angle (don't repeat the same pitch)
2. Keep each email SHORT (under 100 words for body)
3. Reference the initial email naturally ("I reached out last week...")
4. Day 3: Re-emphasize one specific value point they'd care about
5. Day 7: Mention a success story or reference (can be general industry trend)
6. Day 14: Soft close - no pressure, leave door open, suggest staying connected
7. Subject lines should be conversational, not salesy
8. Professional but warmer tone with each follow-up

Return as JSON:
{{
  "emails": [
    {{
      "day": 3,
      "subject": "Follow-up subject",
      "body": "Follow-up body"
    }},
    {{
      "day": 7,
      "subject": "Follow-up subject",
      "body": "Follow-up body"
    }},
    {{
      "day": 14,
      "subject": "Follow-up subject",
      "body": "Follow-up body"
    }}
  ]
}}

JSON only, no other text."""

    result = llm.generate_json(prompt, max_tokens=1200)

    emails = result.get("emails", [])

    # day 라벨 매핑
    for email in emails:
        day = email.get("day", 0)
        for f in FOLLOWUP_SEQUENCE:
            if f["day"] == day:
                email["label"] = f["label"]
                email["angle"] = f["angle"]
                break

    return {"emails": emails}
