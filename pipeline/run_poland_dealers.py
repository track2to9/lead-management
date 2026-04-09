"""
폴란드 건설장비 부품 딜러 대상 분석 실행 스크립트
- LLM으로 발굴한 후보 리스트를 직접 크롤링 + 분석
"""
import asyncio
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lead-verifier"))

from pipeline.config import PipelineConfig
from pipeline.llm_client import create_llm_client
from pipeline.analyzer import analyze_company
from pipeline.email_drafter import draft_emails
from pipeline.followup_drafter import draft_followup_sequence
from pipeline.exhibition_finder import find_exhibitions, match_exhibitions_to_companies
from pipeline.evidence_collector import collect_evidence
from pipeline.output import write_csv, write_excel
from pipeline.report_generator import generate_report


# 폴란드 건설장비 부품 딜러/유통사 후보 (LLM + 수동 조사)
POLAND_CANDIDATES = [
    {"name": "Madrom", "url": "https://madrom.pl", "type": "distributor"},
    {"name": "Inter Parts", "url": "https://interparts.pl", "type": "dealer"},
    {"name": "Hydac Polska", "url": "https://hydac.pl", "type": "distributor"},
    {"name": "Waryński", "url": "https://warynski.pl", "type": "dealer"},
    {"name": "PHU Kopex", "url": "https://kopex.com.pl", "type": "distributor"},
    {"name": "Bergerat Monnoyeur (Cat Dealer)", "url": "https://www.bergerat.pl", "type": "dealer"},
    {"name": "Interhandler", "url": "https://www.interhandler.pl", "type": "dealer"},
    {"name": "Boels Polska (Rental)", "url": "https://www.boels.com/pl", "type": "rental"},
    {"name": "Ramirent Polska", "url": "https://www.ramirent.pl", "type": "rental"},
    {"name": "Riwal Polska", "url": "https://www.riwal.com/pl", "type": "rental"},
    {"name": "MTB Budownictwo", "url": "https://www.mtb.com.pl", "type": "dealer"},
    {"name": "Maschinenbau Polska", "url": "https://www.maschinenbau.pl", "type": "importer"},
    {"name": "Kuhn Polska", "url": "https://www.kuhn.pl", "type": "dealer"},
    {"name": "JCB Polska (official)", "url": "https://www.jcb.com/pl-pl", "type": "dealer"},
    {"name": "Volvo CE Polska", "url": "https://www.volvoce.com/poland/pl-pl/", "type": "dealer"},
    {"name": "Liebherr Polska", "url": "https://www.liebherr.com/pl/pol/start/start-page.html", "type": "dealer"},
    {"name": "Komatsu Poland", "url": "https://www.komatsu.eu/pl-pl", "type": "dealer"},
    {"name": "HM Hydraulic Motors", "url": "https://hmhydraulic.pl", "type": "distributor"},
    {"name": "Parker Hannifin Polska", "url": "https://www.parker.com/pl/pl", "type": "distributor"},
    {"name": "Bosch Rexroth Polska", "url": "https://www.boschrexroth.com/pl/pl/", "type": "distributor"},
]


async def main():
    config = PipelineConfig.from_args(
        client_name="SPS Eng",
        client_url="https://spseng.com",
        product="excavator attachments and hydraulic breaker parts",
        countries=["Poland"],
        product_description="25년+ 건설장비 부품 제조 전문기업. 굴삭기 어태치먼트, 유압 브레이커 부품, OEM/ODM 가능, 40개국 수출 실적",
        strengths="OEM/ODM 가능, 25년 경력, 40개국 수출, 가격 경쟁력, 빠른 납기",
        target_buyers="건설장비 딜러, 부품 유통사, 렌탈 업체, JCB/Caterpillar/Volvo 딜러",
        output_dir="output",
    )

    os.makedirs(config.output_dir, exist_ok=True)
    os.makedirs(config.screenshot_dir, exist_ok=True)

    llm = create_llm_client(config.llm)
    client_profile = config.get_client_profile_text()

    candidates = []
    for c in POLAND_CANDIDATES:
        candidates.append({
            "name": c["name"],
            "url": c["url"],
            "source": f"LLM curated ({c['type']})",
            "source_type": "llm_generated",
            "country": "Poland",
        })

    print(f"\n{'='*60}")
    print(f"  폴란드 건설장비 딜러 분석")
    print(f"  {len(candidates)}개 대상 업체")
    print(f"{'='*60}")

    # Step 1: 웹 크롤링
    print(f"\n  🌐 홈페이지 크롤링 중...")
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        )

        for i, candidate in enumerate(candidates):
            url = candidate.get("url", "")
            if not url:
                continue
            print(f"  [{i+1}/{len(candidates)}] {candidate['name']}: {url}")
            page = await context.new_page()
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=15000)
                await page.wait_for_timeout(2000)
                candidate["page_text"] = await page.evaluate("document.body.innerText")
                candidate["page_text"] = (candidate["page_text"] or "")[:5000]
                candidate["url_accessible"] = True

                # 스크린샷
                screenshot_path = os.path.join(
                    config.screenshot_dir,
                    f"{i+1}_{candidate['name'].replace(' ', '_')[:20]}.png"
                )
                await page.screenshot(path=screenshot_path, type="png", full_page=False)
                candidate["screenshot_path"] = screenshot_path

                # 이메일 찾기
                import re
                emails = re.findall(r'[\w.+-]+@[\w-]+\.[\w.]+', candidate["page_text"])
                candidate["emails_found"] = list(set(emails))[:5]

                print(f"     ✅ 접속 성공 ({len(candidate['page_text'])} chars)")
            except Exception as e:
                candidate["url_accessible"] = False
                candidate["page_text"] = ""
                print(f"     ❌ 실패: {str(e)[:60]}")
            finally:
                await page.close()
            await asyncio.sleep(1)

        # Step 2: LLM 분석 (5차원 구조화 스코어링)
        print(f"\n  🤖 5차원 구조화 분석 중...")
        for candidate in candidates:
            page_text = candidate.get("page_text", "")
            if not page_text and candidate.get("url_accessible", False) is False:
                name = candidate.get("name", "")
                page_text = f"Company: {name}. URL: {candidate.get('url', 'N/A')}. Country: Poland. Type: {candidate.get('source', '')}"

            if page_text:
                await analyze_company(candidate, page_text, client_profile, llm)
            else:
                from pipeline.analyzer import _empty_analysis
                candidate["analysis"] = _empty_analysis("홈페이지 접속 불가")

        # Step 3: 증거 수집 (접근 가능 + score >= 30)
        print(f"\n  🔍 증거 수집 중...")
        for candidate in candidates:
            score = candidate.get("analysis", {}).get("match_score", 0)
            if score >= 30 and candidate.get("url_accessible"):
                try:
                    evidence = await collect_evidence(
                        candidate, context, config.screenshot_dir,
                        llm, client_profile,
                    )
                    candidate["evidence"] = evidence
                    print(f"     📋 {candidate['name']}: 증거 {len(evidence)}건")
                except Exception as e:
                    candidate["evidence"] = []
                    print(f"     ⚠️ {candidate['name']}: {str(e)[:50]}")
                await asyncio.sleep(1)

        await browser.close()

    # Step 4: 이메일 초안
    print(f"\n  📧 이메일 생성 중...")
    candidates = draft_emails(candidates, client_profile, llm, sender_name="SPS Eng")

    # Step 5: 팔로업
    print(f"\n  📬 팔로업 시퀀스 생성 중...")
    candidates = draft_followup_sequence(candidates, client_profile, llm, sender_name="SPS Eng")

    # Step 6: 전시회
    print(f"\n  🎪 전시회 탐색 중...")
    exhibitions = find_exhibitions(config.target.product_category, ["Poland"], llm)
    candidates = match_exhibitions_to_companies(exhibitions, candidates)

    # 점수순 정렬
    candidates.sort(
        key=lambda x: x.get("analysis", {}).get("match_score", 0),
        reverse=True,
    )

    # 결과 출력
    results = [{
        "country": "Poland",
        "companies": candidates,
        "exhibitions": exhibitions,
        "stats": {
            "total": len(candidates),
            "high_match": sum(1 for c in candidates if c.get("analysis", {}).get("priority") == "high"),
            "medium_match": sum(1 for c in candidates if c.get("analysis", {}).get("priority") == "medium"),
        },
    }]

    timestamp = datetime.now().strftime("%Y%m%d_%H%M")
    config_summary = {
        "client": "SPS Eng",
        "product": config.target.product_category,
        "countries": ["Poland"],
        "llm_provider": config.llm.provider,
    }

    csv_path = os.path.join(config.output_dir, f"poland_dealers_{timestamp}.csv")
    excel_path = os.path.join(config.output_dir, f"poland_dealers_{timestamp}.xlsx")
    report_path = os.path.join(config.output_dir, f"poland_dealers_report_{timestamp}.html")

    write_csv(results, csv_path, config_summary)
    write_excel(results, excel_path, config_summary)
    generate_report(results, config, report_path)

    # 요약
    print(f"\n{'='*60}")
    print(f"  ✅ 분석 완료!")
    high = sum(1 for c in candidates if c.get("analysis", {}).get("priority") == "high")
    medium = sum(1 for c in candidates if c.get("analysis", {}).get("priority") == "medium")
    print(f"  총 {len(candidates)}개 분석, HIGH: {high}개, MEDIUM: {medium}개")
    print(f"\n  Top 5:")
    for c in candidates[:5]:
        a = c.get("analysis", {})
        bd = a.get("score_breakdown", {})
        print(f"    {a.get('match_score', 0):3d}점 | {c['name']}")
        if bd:
            print(f"         제품적합: {bd.get('product_fit', {}).get('score', 0)} | "
                  f"구매시그널: {bd.get('buying_signal', {}).get('score', 0)} | "
                  f"기업역량: {bd.get('company_capability', {}).get('score', 0)} | "
                  f"접근성: {bd.get('accessibility', {}).get('score', 0)} | "
                  f"전략가치: {bd.get('strategic_value', {}).get('score', 0)}")
    print(f"\n  결과 파일:")
    print(f"    CSV:    {csv_path}")
    print(f"    Excel:  {excel_path}")
    print(f"    Report: {report_path}")
    print(f"{'='*60}")


if __name__ == "__main__":
    asyncio.run(main())
