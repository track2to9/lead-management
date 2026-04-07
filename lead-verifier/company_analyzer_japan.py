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

    prompt = f"""아래는 일본 Local 5G (ローカル5G) 관련 기업의 홈페이지 내용입니다.
이 기업이 UAngel의 5G Core NF 제품의 잠재 파트너(대리점, SI, OEM)가 될 수 있는지 분석해주세요.

=== UAngel 정보 ===
{UANGEL_PROFILE}

=== 대상 기업 정보 ===
업체명: {company['name']}
홈페이지: {company['url']}
사전 파악 정보: {company.get('products', '정보 없음')}
비고: {company.get('memo', '')}

홈페이지 내용 (일본어 원문 포함):
{page_text}

=== 분석 요청 ===
아래 형식으로 정확히 답변해주세요. 모든 답변은 한국어로 작성하되, 일본어 원문에서 발견한 핵심 키워드는 괄호에 일본어를 병기하세요.

SUMMARY: (이 기업이 뭘 하는 회사인지 2~3문장 요약. 일본어 원문의 핵심 서비스명/제품명은 괄호에 일본어 병기. 예: "~ローカル5Gコアネットワーク~")
MATCH_SCORE: (0~100 숫자만. UAngel 5G Core NF와의 파트너 가능성 점수. 코어 네트워크를 직접 다루거나 SI하는 기업일수록 높게.)
MATCH_REASON: (매칭 점수의 이유. 구체적으로 어떤 부분에서 UAngel과 시너지가 있는지. 홈페이지에서 발견한 구체적 근거 포함. 한국어 2~3문장)
APPROACH: (이 기업에게 접근할 때 어떤 제안을 하면 좋을지. 구체적 전략. 한국어 2~3문장)
PRIORITY: (high/medium/low 중 하나. high=코어NW 직접 관련, medium=SI/구축 관련, low=주변 기기/간접)"""

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
