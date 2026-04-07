"""
Claude API를 활용한 업체 분석
1. 홈페이지 내용 요약
2. SPS Eng 제품과의 매칭 점수
3. 맞춤 접근 전략 제안
"""
import anthropic
from dotenv import load_dotenv

load_dotenv()
client = anthropic.Anthropic()

# SPS Eng 제품 정보 (고정)
SPS_PROFILE = """
SPS Eng (https://spseng.com) - 한국 건설장비 부품 제조사, 25년+ 경력

주요 제품:
1. 브레이커/치즐 부품 - 유압 브레이커용 소모품, 치즐 포인트
2. 굴삭기 암/붐 - 커스텀 굴삭기 작업장치
3. 진동해머/진동리퍼 - 파일 항타, 암반 파쇄용
4. 어태치먼트 - 버킷, 포크, 그래플, 퀵커플러
5. 농업장비 - 프론트로더, 백호로더, 트랙터 크레인

강점: 40개국 수출 경험, 500+ 프로젝트, OEM/ODM 가능
타겟: 건설장비 딜러, 부품 유통사, 렌탈 업체
"""


async def analyze_company(company: dict, page_text: str) -> dict:
    """Claude API로 업체 분석 + SPS 매칭 점수"""

    if not page_text or len(page_text.strip()) < 50:
        company["analysis"] = {
            "summary": "홈페이지 내용 부족",
            "match_score": 0,
            "match_reason": "분석 불가",
            "approach": "",
            "priority": "low",
        }
        return company

    # 텍스트가 너무 길면 잘라냄 (토큰 절약)
    page_text = page_text[:4000]

    prompt = f"""아래는 폴란드 건설장비 딜러의 홈페이지 내용입니다.
이 딜러가 SPS Eng의 잠재 고객(대리점)이 될 수 있는지 분석해주세요.

=== SPS Eng 정보 ===
{SPS_PROFILE}

=== 딜러 정보 ===
업체명: {company['name']}
홈페이지: {company['url']}
GPT가 파악한 취급품목: {company.get('products', '정보 없음')}

홈페이지 내용:
{page_text}

=== 분석 요청 ===
아래 형식으로 정확히 답변해주세요:

SUMMARY: (이 딜러가 뭘 하는 회사인지 2~3문장 요약. 한국어로.)
MATCH_SCORE: (0~100 숫자만. SPS 제품과의 매칭 정도)
MATCH_REASON: (매칭 점수의 이유. 어떤 SPS 제품이 이 딜러에게 맞는지. 한국어 1~2문장)
APPROACH: (이 딜러에게 접근할 때 어떤 제품을 어떻게 제안하면 좋을지. 한국어 1~2문장)
PRIORITY: (high/medium/low 중 하나)"""

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}],
        )

        text = response.content[0].text
        analysis = _parse_analysis(text)
        company["analysis"] = analysis

        print(f"     📊 매칭: {analysis['match_score']}점 ({analysis['priority']}) - {analysis['match_reason'][:60]}")

    except Exception as e:
        print(f"     ⚠️ 분석 실패: {e}")
        company["analysis"] = {
            "summary": f"분석 오류: {str(e)[:50]}",
            "match_score": 0,
            "match_reason": "API 오류",
            "approach": "",
            "priority": "low",
        }

    return company


def _parse_analysis(text: str) -> dict:
    """Claude 응답 파싱"""
    result = {
        "summary": "",
        "match_score": 0,
        "match_reason": "",
        "approach": "",
        "priority": "low",
    }

    for line in text.split("\n"):
        line = line.strip()
        if line.startswith("SUMMARY:"):
            result["summary"] = line.replace("SUMMARY:", "").strip()
        elif line.startswith("MATCH_SCORE:"):
            try:
                score_text = line.replace("MATCH_SCORE:", "").strip()
                result["match_score"] = int("".join(c for c in score_text if c.isdigit())[:3])
            except:
                result["match_score"] = 0
        elif line.startswith("MATCH_REASON:"):
            result["match_reason"] = line.replace("MATCH_REASON:", "").strip()
        elif line.startswith("APPROACH:"):
            result["approach"] = line.replace("APPROACH:", "").strip()
        elif line.startswith("PRIORITY:"):
            p = line.replace("PRIORITY:", "").strip().lower()
            if p in ("high", "medium", "low"):
                result["priority"] = p

    return result
