"""
잠재고객 리스트 검증 도구
━━━━━━━━━━━━━━━━━━━━━━━━

입력: GPT가 생성한 딜러 리스트 (엑셀)
출력: 홈페이지 검증 + 연락처 보완 완료 리스트 (엑셀)

실행: python main.py
"""
import asyncio
import sys
import os
from datetime import datetime

# 프로젝트 루트를 path에 추가
sys.path.insert(0, os.path.dirname(__file__))

from excel_reader import parse_dealer_list
from web_scraper import scrape_all
from validator import validate_all, print_summary
from excel_writer import write_results
from company_analyzer import analyze_company


async def main():
    # ── 설정 ──
    INPUT_FILE = "/Users/youngminkim/Sites/ai.devpartner.org/case-study/개인사업자-건설부품 제공/폴란드 굴삭기 어태치 딜러 리스트.xlsx"
    OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")
    SCREENSHOT_DIR = os.path.join(os.path.dirname(__file__), "screenshots")

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M")
    OUTPUT_FILE = os.path.join(OUTPUT_DIR, f"검증결과_{timestamp}.xlsx")

    # ── Step 1: 엑셀 파싱 ──
    print("=" * 60)
    print("  잠재고객 리스트 검증 도구")
    print("  AI DevPartner (ai.devpartner.org)")
    print("=" * 60)
    print(f"\n📂 입력 파일: {INPUT_FILE}")

    companies = parse_dealer_list(INPUT_FILE)
    print(f"✅ {len(companies)}개 업체 파싱 완료")

    # ── Step 2: 홈페이지 크롤링 ──
    print(f"\n🌐 홈페이지 크롤링 시작...")
    companies = await scrape_all(companies, SCREENSHOT_DIR)

    # ── Step 3: 검증 ──
    print(f"\n🔍 GPT 데이터 vs 실제 데이터 검증 중...")
    companies = validate_all(companies)

    # ── Step 4: Claude AI 분석 (SPS 매칭) ──
    print(f"\n🤖 Claude AI 분석 중 (SPS Eng 제품 매칭)...")
    for c in companies:
        page_text = c.get("page_text", "")
        if c.get("url_accessible"):
            await analyze_company(c, page_text)
        else:
            c["analysis"] = {
                "summary": "홈페이지 접속 불가",
                "match_score": 0,
                "match_reason": "분석 불가",
                "approach": "",
                "priority": "low",
            }

    # 매칭 점수 순으로 정렬
    companies.sort(key=lambda x: x.get("analysis", {}).get("match_score", 0), reverse=True)

    # ── Step 5: 결과 출력 ──
    print_summary(companies)

    # 매칭 순위 출력
    print(f"\n{'='*60}")
    print(f"  SPS Eng 매칭 순위 (상위)")
    print(f"{'='*60}")
    for c in companies[:10]:
        a = c.get("analysis", {})
        print(f"  {a.get('match_score', 0):>3}점 [{a.get('priority', '?'):>6}] {c['name'][:35]}")
        print(f"       → {a.get('match_reason', '')[:70]}")
    print(f"{'='*60}")
    write_results(companies, OUTPUT_FILE)

    print(f"\n📸 스크린샷: {SCREENSHOT_DIR}/")
    print(f"📄 결과 파일: {OUTPUT_FILE}")
    print(f"\n✅ 완료!")


if __name__ == "__main__":
    asyncio.run(main())
