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
Analyze the target company and provide your assessment in the following JSON format.
All text fields must be written in Korean (한국어로 작성).

{{
  "sells_relevant_product": true/false,
  "confidence": "high" | "medium" | "low",
  "company_summary": "2-3 sentence summary of what this company does (한국어로)",
  "match_reason": "Why this company is or isn't a good match (한국어로, 1-2 sentences)",
  "approach": "Recommended approach strategy if this is a match (한국어로, 1-2 sentences)",
  "detected_products": ["list of relevant products/services this company deals with"],
  "buyer_or_competitor": "buyer | competitor | unclear",
  "current_suppliers": ["brands/suppliers mentioned or implied on their website"],
  "company_size_estimate": "small (<50) | medium (50-500) | large (500+) | unknown",
  "decision_maker_hint": "Likely decision maker role/title (한국어로)",
  "best_timing": "Best timing to approach (한국어로)",
  "competitive_landscape": "Current supplier situation and switching potential (한국어로, 1 sentence)",
  "evidence_quotes": [
    {{
      "original": "Exact quote from their website in original language",
      "translated": "Same quote translated to Korean (한국어 번역)",
      "relevance": "Why this quote matters for the score (한국어로, 1 sentence)"
    }}
  ],
  "reasoning_chain": "Step-by-step reasoning: 1) What this company does → 2) Why it connects to our client → 3) Therefore scores are X (한국어로, 3-4 sentences)",
  "scores": {{
    "product_fit": {{
      "score": 0-100,
      "reason": "제품 적합성 평가 근거 (한국어로, 1 sentence)"
    }},
    "buying_signal": {{
      "score": 0-100,
      "reason": "구매 신호 평가 근거 (한국어로, 1 sentence)"
    }},
    "company_capability": {{
      "score": 0-100,
      "reason": "업체 역량 평가 근거 (한국어로, 1 sentence)"
    }},
    "accessibility": {{
      "score": 0-100,
      "reason": "접근 용이성 평가 근거 (한국어로, 1 sentence)"
    }},
    "strategic_value": {{
      "score": 0-100,
      "reason": "전략적 가치 평가 근거 (한국어로, 1 sentence)"
    }}
  }}
}}

=== SCORING GUIDELINES ===
product_fit (제품 적합성): How well do our client's products match what this company sells or needs?
  80-100 = core product category match, 50-79 = adjacent/possible fit, 0-49 = weak or no fit

buying_signal (구매 신호): Evidence that this company actively buys/imports similar products.
  80-100 = clear import/sourcing activity, 50-79 = indirect signals, 0-49 = no visible signals

company_capability (업체 역량): Does this company have the scale, infrastructure, and channels to handle our products?
  80-100 = strong distribution network or retail presence, 50-79 = moderate, 0-49 = unclear or small

accessibility (접근 용이성): How reachable is this company? (contact info, English presence, responsiveness signals)
  80-100 = easy to contact and engage, 50-79 = moderate, 0-49 = hard to reach

strategic_value (전략적 가치): Long-term value: market position, brand reputation, reference value, growth potential.
  80-100 = strong strategic upside, 50-79 = moderate, 0-49 = limited

- evidence_quotes: Extract 2-4 ACTUAL quotes from the website text. Include original language + Korean translation.
- reasoning_chain: Show your work — explain the logic step by step so the client can verify.
- buyer_or_competitor: A competitor makes similar products; a buyer NEEDS our products.
- Be conservative with scores — only high scores for clear, strong matches.

Return valid JSON only."""

    try:
        result = llm.generate_json(prompt, max_tokens=1500)

        # 5차원 점수 추출 및 score_breakdown 구성
        raw_scores = result.get("scores", {})
        score_breakdown = {
            dim: {
                "score": _safe_score(raw_scores.get(dim, {}).get("score", 0)),
                "reason": raw_scores.get(dim, {}).get("reason", ""),
            }
            for dim in DEFAULT_WEIGHTS
        }

        # 가중 평균 종합 점수 (코드로 계산, LLM 아님)
        total_score = compute_weighted_score(score_breakdown)

        # 종합 점수 기반 우선순위 도출
        if total_score >= 80:
            priority = "high"
        elif total_score >= 50:
            priority = "medium"
        else:
            priority = "low"

        # 필수 필드 기본값 보정
        analysis = {
            "sells_relevant_product": result.get("sells_relevant_product", False),
            "confidence": result.get("confidence", "low"),
            "match_score": total_score,
            "score_breakdown": score_breakdown,
            "summary": result.get("company_summary", ""),
            "match_reason": result.get("match_reason", ""),
            "approach": result.get("approach", ""),
            "priority": priority,
            "detected_products": result.get("detected_products", []),
            "buyer_or_competitor": result.get("buyer_or_competitor", "unclear"),
            # 바이어 인텔리전스 확장 필드
            "current_suppliers": result.get("current_suppliers", []),
            "company_size_estimate": result.get("company_size_estimate", "unknown"),
            "decision_maker_hint": result.get("decision_maker_hint", ""),
            "best_timing": result.get("best_timing", ""),
            "competitive_landscape": result.get("competitive_landscape", ""),
            # 근거 투명성 필드
            "evidence_quotes": result.get("evidence_quotes", []),
            "reasoning_chain": result.get("reasoning_chain", ""),
        }

        company["analysis"] = analysis

        score = analysis["match_score"]
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
        "score_breakdown": {
            dim: {"score": 0, "reason": ""} for dim in ("product_fit", "buying_signal", "company_capability", "accessibility", "strategic_value")
        },
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


DEFAULT_WEIGHTS = {
    "product_fit": 30,
    "buying_signal": 25,
    "company_capability": 20,
    "accessibility": 15,
    "strategic_value": 10,
}


def compute_weighted_score(scores: dict, weights: dict | None = None) -> int:
    """가중 평균 종합 점수 계산. LLM이 아닌 코드로 일관성 보장."""
    w = weights or DEFAULT_WEIGHTS
    total_weight = sum(w.values())
    if total_weight == 0:
        return 0
    weighted_sum = sum(
        _safe_score(scores.get(key, {}).get("score", 0)) * w.get(key, 0)
        for key in DEFAULT_WEIGHTS
    )
    return round(weighted_sum / total_weight)
