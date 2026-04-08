"""
해외 바이어 발굴 파이프라인 - CLI 엔트리포인트
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

한국 수출업체를 위한 잠재고객 자동 발굴 도구.
실제 무역 디렉토리에서 바이어 정보를 수집하고,
LLM으로 적합성을 분석한 뒤, 맞춤 이메일 초안까지 생성합니다.

실행 예시:
  python -m pipeline.main \\
    --client-name "SPS Eng" \\
    --client-url "https://spseng.com" \\
    --product "excavator attachments and hydraulic breaker parts" \\
    --countries Poland Germany Turkey \\
    --output-dir output

또는 최소 옵션:
  python -m pipeline.main \\
    --client-name "회사명" \\
    --product "제품 카테고리" \\
    --countries USA
"""
import argparse
import asyncio
import os
import sys
from datetime import datetime

# lead-verifier 모듈 임포트를 위한 경로 설정
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lead-verifier"))

from .config import PipelineConfig
from .batch_runner import run_batch
from .output import write_csv, write_excel
from .report_generator import generate_report


def parse_args() -> argparse.Namespace:
    """CLI 인자 파싱"""
    parser = argparse.ArgumentParser(
        description="해외 바이어 발굴 파이프라인 - 한국 수출업체를 위한 잠재고객 자동 탐색",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
예시:
  # 기본 사용
  python -m pipeline.main --client-name "SPS Eng" --product "hydraulic breakers" --countries Poland Germany

  # 상세 옵션
  python -m pipeline.main \\
    --client-name "SPS Eng" \\
    --client-url "https://spseng.com" \\
    --product "excavator attachments, hydraulic breaker parts" \\
    --product-desc "25년+ 건설장비 부품 제조, OEM/ODM 가능, 40개국 수출" \\
    --target-buyers "건설장비 딜러, 부품 유통사, 렌탈 업체" \\
    --countries Poland Germany Turkey \\
    --output-dir output \\
    --llm claude
        """,
    )

    # 필수 인자
    parser.add_argument(
        "--client-name", required=True,
        help="수출업체 회사명 (예: 'SPS Eng')",
    )
    parser.add_argument(
        "--product", required=True,
        help="제품 카테고리 (예: 'hydraulic breakers and excavator attachments')",
    )
    parser.add_argument(
        "--countries", nargs="+", required=True,
        help="타겟 국가 리스트 (예: Poland Germany Turkey)",
    )

    # 선택 인자
    parser.add_argument(
        "--client-url", default="",
        help="수출업체 웹사이트 URL",
    )
    parser.add_argument(
        "--product-desc", default="",
        help="제품/서비스 상세 설명",
    )
    parser.add_argument(
        "--strengths", default="",
        help="수출업체 강점 (예: 'OEM/ODM, 25년 경력, 40개국 수출')",
    )
    parser.add_argument(
        "--target-buyers", default="",
        help="타겟 바이어 유형 (예: '건설장비 딜러, 부품 유통사')",
    )
    parser.add_argument(
        "--output-dir", default="output",
        help="출력 디렉토리 (기본: output)",
    )
    parser.add_argument(
        "--llm", default="", choices=["claude", "openai", "gemini", ""],
        help="LLM 프로바이더 (기본: .env의 LLM_PROVIDER 또는 claude)",
    )
    parser.add_argument(
        "--llm-model", default="",
        help="LLM 모델명 (비어있으면 프로바이더 기본값)",
    )
    parser.add_argument(
        "--max-candidates", type=int, default=50,
        help="국가당 최대 후보 수 (기본: 50)",
    )
    parser.add_argument(
        "--no-scrape", action="store_true",
        help="웹 스크래핑 건너뛰기 (소스 탐색 + LLM 분석만)",
    )
    parser.add_argument(
        "--csv-only", action="store_true",
        help="CSV만 출력 (Excel 생성 안 함)",
    )
    parser.add_argument("--refinement-conditions", nargs="*", default=[],
                        help="추가 분석 조건 (고객 피드백 반영)")
    parser.add_argument("--round", type=int, default=1,
                        help="분석 회차 (재분석 시 증가)")

    # Supabase upload options
    parser.add_argument(
        "--project-id", default="",
        help="Supabase project UUID — required when using --upload",
    )
    parser.add_argument(
        "--upload", action="store_true",
        help="Upload prospects + evidence to Supabase after the pipeline finishes",
    )

    return parser.parse_args()


async def async_main():
    """비동기 메인 함수"""
    args = parse_args()

    # 설정 생성
    config = PipelineConfig.from_args(
        client_name=args.client_name,
        client_url=args.client_url,
        product=args.product,
        countries=args.countries,
        product_description=args.product_desc or args.product,
        strengths=args.strengths,
        target_buyers=args.target_buyers,
        output_dir=args.output_dir,
        llm_provider=args.llm,
        llm_model=args.llm_model,
    )
    config.max_candidates_per_country = args.max_candidates
    config.refinement_conditions = args.refinement_conditions or []
    config.refinement_round = args.round

    # 출력 디렉토리 생성
    os.makedirs(config.output_dir, exist_ok=True)
    os.makedirs(config.screenshot_dir, exist_ok=True)

    # 설정 검증
    try:
        config.validate()
    except ValueError as e:
        print(f"\n❌ {e}")
        sys.exit(1)

    # 배너
    print("=" * 60)
    print("  해외 바이어 발굴 파이프라인")
    print("  AI DevPartner (ai.devpartner.org)")
    print("=" * 60)
    print(f"  클라이언트: {config.client.company_name}")
    print(f"  제품: {config.target.product_category}")
    print(f"  대상 국가: {', '.join(config.target.countries)}")
    print(f"  LLM: {config.llm.provider} ({config.llm.default_model})")
    print(f"  출력: {config.output_dir}/")
    print("=" * 60)

    # lead-verifier 함수 임포트
    scrape_fn = None
    validate_fn = None

    if not args.no_scrape:
        try:
            from web_scraper import scrape_company
            from validator import validate_company
            scrape_fn = scrape_company
            validate_fn = validate_company
            print("  ✅ lead-verifier 모듈 로드 완료")
        except ImportError as e:
            print(f"  ⚠️ lead-verifier 모듈 로드 실패: {e}")
            print("     --no-scrape 옵션으로 스크래핑 없이 실행 가능")
    else:
        print("  ℹ️ 웹 스크래핑 건너뛰기 (--no-scrape)")

    # 파이프라인 실행
    results = await run_batch(config, scrape_fn=scrape_fn, validate_fn=validate_fn)

    # 결과 출력
    timestamp = datetime.now().strftime("%Y%m%d_%H%M")
    config_summary = {
        "client": config.client.company_name,
        "product": config.target.product_category,
        "countries": config.target.countries,
        "llm_provider": config.llm.provider,
    }

    # CSV 출력
    csv_path = os.path.join(config.output_dir, f"prospects_{timestamp}.csv")
    write_csv(results, csv_path, config_summary)

    # Excel 출력
    if not args.csv_only:
        excel_path = os.path.join(config.output_dir, f"prospects_{timestamp}.xlsx")
        write_excel(results, excel_path, config_summary)

    # HTML 리포트 출력
    report_path = os.path.join(config.output_dir, f"report_{timestamp}.html")
    generate_report(results, config, report_path)

    # Supabase 업로드 (--upload --project-id 옵션 제공 시)
    if args.upload and args.project_id:
        print(f"\n  📤 Supabase 업로드 중 (project: {args.project_id[:8]}…)")
        from .supabase_uploader import upload_evidence
        all_companies = [c for r in results for c in r.get("companies", [])]
        upload_evidence(args.project_id, all_companies)
    elif args.upload and not args.project_id:
        print("\n  ⚠️  --upload 옵션은 --project-id 와 함께 사용해야 합니다.")

    # 완료
    total = sum(len(r.get("companies", [])) for r in results)
    high = sum(
        1 for r in results
        for c in r.get("companies", [])
        if c.get("analysis", {}).get("priority") == "high"
    )

    print(f"\n{'='*60}")
    print(f"  ✅ 파이프라인 완료!")
    print(f"  총 {total}개 잠재고객 발굴, {high}개 High Priority")
    print(f"  결과: {config.output_dir}/")
    print(f"{'='*60}")


def main():
    """동기 엔트리포인트"""
    asyncio.run(async_main())


if __name__ == "__main__":
    main()
