"""
다중 국가 순차 실행기
- 국가별 파이프라인 실행
- 부분 실패 허용 (한 국가 실패해도 나머지 계속 진행)
- 결과 통합
"""
import asyncio
import traceback
from datetime import datetime

from .config import PipelineConfig
from .llm_client import LLMClient, create_llm_client
from .source_finder import find_sources
from .candidate_collector import collect_from_sources, collect_via_llm_fallback
from .analyzer import analyze_company
from .email_drafter import draft_emails
from .followup_drafter import draft_followup_sequence
from .exhibition_finder import find_exhibitions, match_exhibitions_to_companies
from .run_logger import RunLogger


async def run_single_country(
    country: str,
    config: PipelineConfig,
    llm: LLMClient,
    scrape_fn=None,
    validate_fn=None,
    logger: RunLogger | None = None,
) -> dict:
    """
    단일 국가에 대한 파이프라인 실행.

    Args:
        country: 국가명
        config: 파이프라인 설정
        llm: LLM 클라이언트
        scrape_fn: 웹 스크래핑 함수 (lead-verifier의 scrape_company)
        validate_fn: 검증 함수 (lead-verifier의 validate_company)
        logger: 실행 로거

    Returns:
        {country, companies, stats, error}
    """
    result = {
        "country": country,
        "companies": [],
        "stats": {},
        "error": None,
        "started_at": datetime.now().isoformat(),
    }

    print(f"\n{'='*60}")
    print(f"  🌍 {country} 파이프라인 시작")
    print(f"{'='*60}")

    try:
        # Step 1: 데이터 소스 탐색
        if logger:
            logger.log_step(country, "source_finder", "started")

        sources = find_sources(llm, config.target.product_category, country)

        if logger:
            logger.log_step(country, "source_finder", "completed", {
                "total_sources": len(sources),
                "verified_sources": sum(1 for s in sources if s.get("verified")),
            })

        # Step 2: 업체 수집
        if logger:
            logger.log_step(country, "candidate_collector", "started")

        candidates = collect_from_sources(
            sources, config.target.product_category, country,
            max_per_source=config.max_candidates_per_country,
        )

        # 소스 스크래핑 결과가 부족하면 LLM 폴백
        if len(candidates) < 10:
            llm_candidates = collect_via_llm_fallback(
                llm, config.target.product_category, country,
                existing_count=len(candidates),
                target_count=config.max_candidates_per_country,
            )
            candidates.extend(llm_candidates)

        if logger:
            scraped = sum(1 for c in candidates if c.get("source_type") == "directory_scraped")
            generated = sum(1 for c in candidates if c.get("source_type") == "llm_generated")
            logger.log_step(country, "candidate_collector", "completed", {
                "total_candidates": len(candidates),
                "from_directories": scraped,
                "from_llm": generated,
            })

        # Step 3: 웹 스크래핑 (lead-verifier 재사용)
        if scrape_fn and candidates:
            if logger:
                logger.log_step(country, "web_scraper", "started")

            print(f"\n  🌐 {len(candidates)}개 업체 홈페이지 크롤링 중...")

            # scrape_fn은 async이며 Playwright browser context 필요
            from playwright.async_api import async_playwright

            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                context = await browser.new_context(
                    user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                )

                for i, candidate in enumerate(candidates):
                    # scrape_company 호환 형식으로 변환
                    candidate["num"] = i + 1
                    if "url" not in candidate:
                        candidate["url"] = ""
                    try:
                        await scrape_fn(candidate, context, config.screenshot_dir)
                    except Exception as e:
                        print(f"     ❌ {candidate.get('name', '?')} 크롤링 실패: {str(e)[:60]}")
                        candidate["url_accessible"] = False
                        candidate["verification_status"] = "error"
                    await asyncio.sleep(config.polite_delay)

                await browser.close()

            if logger:
                accessible = sum(1 for c in candidates if c.get("url_accessible"))
                logger.log_step(country, "web_scraper", "completed", {
                    "scraped": len(candidates),
                    "accessible": accessible,
                })

        # Step 4: 검증 (lead-verifier 재사용)
        if validate_fn:
            for candidate in candidates:
                validate_fn(candidate)

        # Step 5: LLM 분석
        if logger:
            logger.log_step(country, "analyzer", "started")

        print(f"\n  🤖 업체 분석 중...")
        client_profile = config.get_client_profile_text()

        for candidate in candidates:
            page_text = candidate.get("page_text", "")
            # --no-scrape 모드에서도 이름/URL/source 정보만으로 분석 시도
            if not page_text and not candidate.get("url_accessible", False):
                # 최소한 업체명과 소스 정보가 있으면 LLM에 분석 요청
                name = candidate.get("name", "")
                source = candidate.get("source", "")
                if name:
                    page_text = f"Company: {name}. Source: {source}. URL: {candidate.get('url', 'N/A')}. Country: {country}."
            if page_text:
                await analyze_company(candidate, page_text, client_profile, llm)
            else:
                candidate["analysis"] = {
                    "sells_relevant_product": False,
                    "confidence": "low",
                    "match_score": 0,
                    "summary": "홈페이지 접속 불가 / 정보 없음",
                    "match_reason": "분석 불가",
                    "approach": "",
                    "priority": "low",
                    "detected_products": [],
                }

        if logger:
            analyzed = sum(1 for c in candidates if c.get("analysis", {}).get("match_score", 0) > 0)
            logger.log_step(country, "analyzer", "completed", {
                "analyzed": analyzed,
                "high_priority": sum(1 for c in candidates if c.get("analysis", {}).get("priority") == "high"),
                "medium_priority": sum(1 for c in candidates if c.get("analysis", {}).get("priority") == "medium"),
            })

        # Step 6: 이메일 초안
        if logger:
            logger.log_step(country, "email_drafter", "started")

        candidates = draft_emails(
            candidates, client_profile, llm,
            sender_name=config.client.company_name,
        )

        if logger:
            drafted = sum(1 for c in candidates if c.get("email_draft", {}).get("subject"))
            logger.log_step(country, "email_drafter", "completed", {"drafted": drafted})

        # Step 7: 팔로업 이메일 시퀀스
        if logger:
            logger.log_step(country, "followup_drafter", "started")

        candidates = draft_followup_sequence(
            candidates, client_profile, llm,
            sender_name=config.client.company_name,
        )

        if logger:
            fu_count = sum(1 for c in candidates if c.get("followup_sequence", {}).get("emails"))
            logger.log_step(country, "followup_drafter", "completed", {"sequences": fu_count})

        # Step 8: 전시회 탐색 및 매칭
        if logger:
            logger.log_step(country, "exhibition_finder", "started")

        exhibitions = find_exhibitions(config.target.product_category, [country], llm)
        candidates = match_exhibitions_to_companies(exhibitions, candidates)

        if logger:
            logger.log_step(country, "exhibition_finder", "completed", {
                "exhibitions_found": len(exhibitions),
            })

        # 매칭 점수 순 정렬
        candidates.sort(
            key=lambda x: x.get("analysis", {}).get("match_score", 0),
            reverse=True,
        )

        result["companies"] = candidates
        result["exhibitions"] = exhibitions
        result["stats"] = _compute_stats(candidates)

    except Exception as e:
        result["error"] = f"{type(e).__name__}: {str(e)}"
        print(f"\n  ❌ {country} 파이프라인 오류: {e}")
        traceback.print_exc()

    result["finished_at"] = datetime.now().isoformat()
    return result


async def run_batch(
    config: PipelineConfig,
    scrape_fn=None,
    validate_fn=None,
) -> list[dict]:
    """
    여러 국가에 대해 순차적으로 파이프라인 실행.
    한 국가 실패해도 나머지 계속 진행.
    """
    llm = create_llm_client(config.llm)
    logger = RunLogger(config.output_dir)

    logger.start_run({
        "client": config.client.company_name,
        "product": config.target.product_category,
        "countries": config.target.countries,
        "llm_provider": config.llm.provider,
        "llm_model": config.llm.default_model,
    })

    all_results = []

    for country in config.target.countries:
        country_result = await run_single_country(
            country=country,
            config=config,
            llm=llm,
            scrape_fn=scrape_fn,
            validate_fn=validate_fn,
            logger=logger,
        )
        all_results.append(country_result)

    # 실행 통계 기록
    total_companies = sum(len(r["companies"]) for r in all_results)
    failed_countries = [r["country"] for r in all_results if r.get("error")]
    succeeded_countries = [r["country"] for r in all_results if not r.get("error")]

    logger.finish_run({
        "total_countries": len(config.target.countries),
        "succeeded": len(succeeded_countries),
        "failed": len(failed_countries),
        "failed_countries": failed_countries,
        "total_companies": total_companies,
        "llm_calls": llm.call_count,
        "estimated_cost_usd": round(llm.estimated_cost_usd, 4),
        "total_input_tokens": llm.total_input_tokens,
        "total_output_tokens": llm.total_output_tokens,
    })

    # 최종 요약
    print(f"\n{'='*60}")
    print(f"  배치 실행 완료")
    print(f"{'='*60}")
    print(f"  성공: {len(succeeded_countries)}개 국가")
    if failed_countries:
        print(f"  실패: {', '.join(failed_countries)}")
    print(f"  총 업체: {total_companies}개")
    print(f"  LLM 호출: {llm.call_count}회")
    print(f"  예상 비용: ${llm.estimated_cost_usd:.4f}")
    print(f"{'='*60}")

    return all_results


def _compute_stats(companies: list[dict]) -> dict:
    """국가별 통계 계산"""
    total = len(companies)
    if total == 0:
        return {"total": 0}

    from_dirs = sum(1 for c in companies if c.get("source_type") == "directory_scraped")
    from_llm = sum(1 for c in companies if c.get("source_type") == "llm_generated")
    accessible = sum(1 for c in companies if c.get("url_accessible"))
    verified = sum(1 for c in companies if c.get("validation", {}).get("overall") == "verified")

    scores = [c.get("analysis", {}).get("match_score", 0) for c in companies]
    high_match = sum(1 for s in scores if s >= 80)
    medium_match = sum(1 for s in scores if 50 <= s < 80)

    emails_found = sum(len(c.get("emails_found", [])) for c in companies)
    emails_drafted = sum(1 for c in companies if c.get("email_draft", {}).get("subject"))

    # 할루시네이션 비율 (LLM 생성 중 URL 접근 불가 비율)
    hallucination_rate = 0.0
    if from_llm > 0:
        llm_accessible = sum(
            1 for c in companies
            if c.get("source_type") == "llm_generated" and c.get("url_accessible")
        )
        hallucination_rate = round((1 - llm_accessible / from_llm) * 100, 1)

    return {
        "total": total,
        "from_directories": from_dirs,
        "from_llm": from_llm,
        "url_accessible": accessible,
        "verified": verified,
        "high_match": high_match,
        "medium_match": medium_match,
        "avg_match_score": round(sum(scores) / total, 1) if total else 0,
        "emails_found": emails_found,
        "emails_drafted": emails_drafted,
        "hallucination_rate_pct": hallucination_rate,
    }
