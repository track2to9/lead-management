"""
피드백 패턴 분석기
- 수락/거절된 잠재고객 목록에서 공통 패턴을 LLM으로 추출
- 향후 분석 라운드에서 필터 조건 개선에 활용
"""
from .llm_client import LLMClient

DEFAULT_RESULT = {
    "preferred_traits": [],
    "avoided_traits": [],
    "summary": "아직 충분한 피드백이 없습니다.",
    "suggested_conditions": [],
}


def analyze_feedback_patterns(
    accepted: list[dict],
    rejected: list[dict],
    llm: LLMClient,
) -> dict:
    """
    수락/거절된 잠재고객 목록을 분석하여 선호 패턴을 추출.

    Args:
        accepted: 수락된 잠재고객 dict 목록 (각각 analysis 서브딕트 포함)
        rejected: 거절된 잠재고객 dict 목록 (각각 analysis 서브딕트 포함)
        llm: LLM 클라이언트 인스턴스

    Returns:
        {
            "preferred_traits": [...],    # 수락 업체의 공통 특성 (한국어, 1문장씩)
            "avoided_traits": [...],      # 거절 업체의 공통 특성 (한국어, 1문장씩)
            "summary": "...",             # 전체 패턴 요약 (한국어, 2-3문장)
            "suggested_conditions": [...] # 구체적 필터 조건 제안 (한국어)
        }
    """
    if not accepted and not rejected:
        return dict(DEFAULT_RESULT)

    try:
        accepted_summary = _build_company_summary(accepted, label="수락")
        rejected_summary = _build_company_summary(rejected, label="거절")

        prompt = f"""당신은 B2B 무역 전문 분석가입니다. 아래는 한국 수출업체의 해외 잠재 바이어 발굴 과정에서 수집된 피드백 데이터입니다.

수락된 업체(고객이 선택한 업체)와 거절된 업체(고객이 제외한 업체)를 비교 분석하여, 고객이 어떤 유형의 바이어를 선호하는지 패턴을 파악해주세요.

=== 수락된 업체 목록 ({len(accepted[:10])}개) ===
{accepted_summary}

=== 거절된 업체 목록 ({len(rejected[:10])}개) ===
{rejected_summary}

=== 분석 요청 ===
위 데이터를 바탕으로 다음 JSON 형식으로 응답해주세요. 모든 텍스트는 한국어로 작성하세요.

{{
  "preferred_traits": [
    "수락된 업체들의 공통 특성 1 (1문장)",
    "수락된 업체들의 공통 특성 2 (1문장)"
  ],
  "avoided_traits": [
    "거절된 업체들의 공통 특성 1 (1문장)",
    "거절된 업체들의 공통 특성 2 (1문장)"
  ],
  "summary": "전체 패턴에 대한 요약 설명 (2-3문장으로, 고객이 어떤 유형의 바이어를 원하는지 전반적으로 서술)",
  "suggested_conditions": [
    "향후 검색에 적용할 구체적인 필터 조건 1 (예: 특정 규모, 국가, 제품 카테고리 등)",
    "향후 검색에 적용할 구체적인 필터 조건 2"
  ]
}}

- preferred_traits와 avoided_traits는 각각 2~5개 항목으로 작성하세요.
- suggested_conditions는 실제 검색/필터링에 바로 활용할 수 있는 구체적인 조건으로 작성하세요.
- 데이터가 충분하지 않은 항목은 빈 배열([])로 남겨두세요.

반드시 유효한 JSON 형식으로만 응답해주세요."""

        result = llm.generate_json(prompt, max_tokens=1000)

        return {
            "preferred_traits": result.get("preferred_traits", []),
            "avoided_traits": result.get("avoided_traits", []),
            "summary": result.get("summary", DEFAULT_RESULT["summary"]),
            "suggested_conditions": result.get("suggested_conditions", []),
        }

    except Exception as e:
        return {
            **DEFAULT_RESULT,
            "summary": f"패턴 분석 중 오류가 발생했습니다: {str(e)[:100]}",
        }


def _build_company_summary(companies: list[dict], label: str) -> str:
    """업체 목록을 LLM 프롬프트용 텍스트로 변환 (최대 10개)"""
    if not companies:
        return f"({label}된 업체 없음)"

    lines = []
    for i, company in enumerate(companies[:10], 1):
        name = company.get("name", company.get("company_name", f"업체 {i}"))
        country = company.get("country", "")
        analysis = company.get("analysis", {})

        score_breakdown = analysis.get("score_breakdown", {})
        match_score = analysis.get("match_score")

        # 점수 요약: score_breakdown이 있으면 상세, 없으면 총점만
        if score_breakdown:
            score_parts = []
            for dim, info in score_breakdown.items():
                score = info.get("score", 0) if isinstance(info, dict) else info
                score_parts.append(f"{dim}={score}")
            score_text = ", ".join(score_parts)
        elif match_score is not None:
            score_text = f"총점={match_score}"
        else:
            score_text = "점수 없음"

        products = analysis.get("detected_products", [])
        products_text = ", ".join(products[:5]) if products else "없음"

        size = analysis.get("company_size_estimate", "unknown")

        suppliers = analysis.get("current_suppliers", [])
        suppliers_text = ", ".join(suppliers[:3]) if suppliers else "없음"

        line = (
            f"{i}. {name}"
            + (f" ({country})" if country else "")
            + f"\n   - 점수: {score_text}"
            + f"\n   - 취급 제품: {products_text}"
            + f"\n   - 규모: {size}"
            + f"\n   - 현재 공급업체: {suppliers_text}"
        )
        lines.append(line)

    return "\n".join(lines)
