"""
Claude API를 활용한 일본 Local 5G 업체 분석
1. 홈페이지 내용 요약 (일본어 → 한국어)
2. UAngel 5G Core NF와의 매칭 점수
3. 맞춤 접근 전략 제안
"""
import anthropic
from dotenv import load_dotenv

load_dotenv()
client = anthropic.Anthropic()

# UAngel 제품 정보
UANGEL_PROFILE = """
UAngel (유엔젤, https://www.uangel.com) - 한국 통신 솔루션 기업

주요 제품 및 역량:
1. 5G Core NF (Network Function)
   - SBA(Service-Based Architecture) / MSA(Micro Service Architecture) 기반
   - Cloud Native 아키텍처 (CI/CD 환경)
   - AMF, SMF, UPF, NRF, AUSF, UDM 등 5GC 전체 기능
   - NSA/SA 모두 지원

2. EPC (Evolved Packet Core) - LTE 코어
   - 4G/LTE 코어 네트워크 검증 완료
   - KT 등 한국 통신사 상용 운영 경험

3. 5G 특화망 (이음5G) 구축 경험
   - 한국 정부 이음5G 사업 참여
   - 스마트팩토리, 스마트시티, 항만 등 산업용 5G 구축
   - 4.72~4.82 GHz (n79) 대역 경험

4. 부가 솔루션
   - 실시간 빌링 시스템
   - 네트워크 관리/운영 솔루션
   - AI Contact Center (AICC)

강점:
- 16개국 30+ 고객사 실적
- 모바일 통신 초기부터 LTE/5G까지 20년+ 기술력
- 코어 네트워크 자체 개발 (OEM/화이트라벨 가능)
- 한국 이음5G 실증/상용 경험

타겟 파트너:
- 일본 Local 5G 시스템 인테그레이터 (코어 NW OEM 파트너)
- Local 5G 전문 벤더 (코어 NW 보완/교체)
- 대기업 SI (5G 사업 확장시 코어 NW 공급)
- 기존 Athonet, Nokia 코어 사용 업체 (대안 제안)

주파수 호환성:
- 한국 이음5G: 4.72~4.82 GHz (n79)
- 일본 Local 5G: 4.6~4.9 GHz (n79 계열) → 거의 동일
- 일본 mmWave: 28.2~28.3 GHz 도 지원 가능
"""


async def analyze_company(company: dict, page_text: str) -> dict:
    """Claude API로 업체 분석 + UAngel 매칭 점수"""

    if not page_text or len(page_text.strip()) < 50:
        company["analysis"] = {
            "summary": "홈페이지 내용 부족",
            "match_score": 0,
            "match_reason": "분석 불가",
            "approach": "",
            "priority": "low",
        }
        return company

    page_text = page_text[:5000]

    prompt = f"""아래는 일본 기업의 홈페이지 내용입니다.
이 기업이 UAngel의 5G Core NF 제품을 **구매/도입할 가능성**이 있는지 분석해주세요.

중요: UAngel과 같은 제품(5G 코어 네트워크)을 만드는 "경쟁사"가 아니라,
5G 특화망을 자사 사업장에 **도입하려는 기업** 또는 **고객을 위해 구축해주는 SI**를 찾고 있습니다.

=== UAngel 정보 ===
{UANGEL_PROFILE}

=== UAngel의 한국 판매처 (참고용) ===
한국에서 UAngel은 아래와 같은 곳에 납품/구축했습니다:
- 통신사 (KT 등): LTE/5G 코어 네트워크 납품
- 조선소: 현대중공업 등 5G 특화망 구축
- 스마트 제조공장: 산업용 5G 특화망 구축
- 스마트시티: 지자체/공공기관 5G 인프라
- 발전소: 에너지 시설 5G 특화망

=== 대상 기업 정보 ===
업체명: {company['name']}
홈페이지: {company['url']}
업종/분류: {company.get('products', '정보 없음')}
비고: {company.get('memo', '')}

홈페이지 내용 (일본어 원문 포함):
{page_text}

=== 분석 요청 ===
이 기업이 Local 5G(ローカル5G)를 **도입하거나 구축할 니즈**가 있는지 판단해주세요.
- 자체 코어NW를 개발하는 기업이면 "경쟁사"로 분류하고 점수를 낮게 주세요.
- 5G를 필요로 하는 제조/에너지/물류/조선/건설 기업이면 점수를 높게 주세요.
- SI 기업 중 코어NW를 외부 조달하는 곳이면 점수를 높게 주세요.

아래 형식으로 답변:

SUMMARY: (이 기업이 뭘 하는 회사인지 2~3문장. 일본어 키워드 병기.)
MATCH_SCORE: (0~100. 5G 특화망 도입/구축 니즈가 높을수록 높은 점수. 경쟁사이면 20 이하.)
MATCH_REASON: (매칭 이유. "이 기업은 ~를 하기 때문에 5G 특화망이 필요하다" 형태로. 홈페이지 근거 포함. 2~3문장)
APPROACH: (접근 전략. "한국 조선소/공장에서의 구축 경험을 레퍼런스로 ~를 제안" 형태. 2~3문장)
PRIORITY: (high=직접 도입 니즈 or 구축 SI, medium=도입 가능성, low=간접/경쟁사)"""

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=700,
            messages=[{"role": "user", "content": prompt}],
        )

        text = response.content[0].text
        analysis = _parse_analysis(text)
        company["analysis"] = analysis

        print(f"     📊 매칭: {analysis['match_score']}점 ({analysis['priority']}) - {analysis['match_reason'][:70]}")

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
