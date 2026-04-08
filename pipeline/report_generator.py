"""
HTML 리포트 생성기
- Jinja2 기반 단일 HTML 파일 생성
- 브라우저에서 열고 Cmd+P로 PDF 저장 가능
- 스크린샷 인라인 (base64), 외부 의존성 없음
"""
import base64
import os
from datetime import datetime
from pathlib import Path

from jinja2 import Environment, FileSystemLoader


TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), "templates")


def generate_report(
    results: list[dict],
    config,
    output_path: str,
    embed_screenshots: bool = True,
) -> str:
    """
    파이프라인 결과를 HTML 리포트로 생성.

    Args:
        results: run_batch() 반환값 (국가별 결과 리스트)
        config: PipelineConfig
        output_path: 출력 HTML 파일 경로
        embed_screenshots: True이면 스크린샷을 base64로 인라인

    Returns:
        생성된 파일 경로
    """
    env = Environment(loader=FileSystemLoader(TEMPLATE_DIR))
    template = env.get_template("report.html")

    # 모든 국가의 회사 통합
    all_companies = []
    all_exhibitions = []
    all_sources = []

    for r in results:
        companies = r.get("companies", [])
        # 스크린샷 base64 인라인
        if embed_screenshots:
            for c in companies:
                path = c.get("screenshot_path", "")
                if path and os.path.exists(path):
                    c["screenshot_path"] = _encode_image(path)
                else:
                    c["screenshot_path"] = ""
        all_companies.extend(companies)
        all_exhibitions.extend(r.get("exhibitions", []))

    # 점수순 정렬
    all_companies.sort(
        key=lambda x: x.get("analysis", {}).get("match_score", 0),
        reverse=True,
    )

    # 통계
    high = sum(1 for c in all_companies if c.get("analysis", {}).get("priority") == "high")
    medium = sum(1 for c in all_companies if c.get("analysis", {}).get("priority") == "medium")
    drafted = sum(1 for c in all_companies if c.get("email_draft", {}).get("subject"))

    context = {
        "project_name": f"{config.client.company_name} - {', '.join(config.target.countries)} 바이어 발굴 리포트",
        "subtitle": f"{config.target.product_category} 관련 잠재 바이어 분석 결과",
        "report_date": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "client_name": config.client.company_name,
        "countries": config.target.countries,
        "product_category": config.target.product_category,
        "total_companies": len(all_companies),
        "high_count": high,
        "medium_count": medium,
        "emails_drafted": drafted,
        "exhibitions_count": len(all_exhibitions),
        "companies": all_companies,
        "exhibitions": all_exhibitions,
        "data_sources": all_sources,
    }

    html = template.render(**context)

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)

    print(f"  📊 HTML 리포트 생성: {output_path}")
    return output_path


def _encode_image(path: str) -> str:
    """이미지 파일을 base64 data URI로 변환"""
    try:
        with open(path, "rb") as f:
            data = base64.b64encode(f.read()).decode()
        ext = Path(path).suffix.lstrip(".")
        mime = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg"}.get(ext, "image/png")
        return f"data:{mime};base64,{data}"
    except Exception:
        return ""
