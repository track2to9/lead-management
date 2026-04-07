"""
결과 출력 모듈
- CSV 출력 (UTF-8 BOM, Excel 한글 호환)
- Excel 출력 (lead-verifier/excel_writer.py 패턴 재사용)
- Zoho CRM 호환 컬럼 포맷
- 요약 통계
"""
import csv
import os
from datetime import datetime

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side


# ─── CSV 출력 ───────────────────────────────────────────────

def write_csv(results: list[dict], output_path: str, config_summary: dict | None = None):
    """
    CSV 파일 출력 (UTF-8 BOM - Excel 한글 호환).
    Zoho CRM 호환 컬럼 포맷.

    Args:
        results: run_batch()의 반환값 (국가별 결과 리스트)
        output_path: 출력 파일 경로
        config_summary: 설정 요약 정보 (상단 코멘트 출력용)
    """
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

    # 모든 국가의 업체를 하나로 병합
    all_companies = []
    for r in results:
        country = r.get("country", "")
        for c in r.get("companies", []):
            c["_country"] = country
            all_companies.append(c)

    with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)

        # 상단 요약 (코멘트 행)
        if config_summary:
            writer.writerow([f"# 생성일시: {datetime.now().strftime('%Y-%m-%d %H:%M')}"])
            writer.writerow([f"# 클라이언트: {config_summary.get('client', '')}"])
            writer.writerow([f"# 제품: {config_summary.get('product', '')}"])
            writer.writerow([f"# 국가: {', '.join(config_summary.get('countries', []))}"])
            writer.writerow([f"# 총 업체 수: {len(all_companies)}"])
            writer.writerow([])

        # Zoho CRM 호환 헤더
        headers = [
            "Company",          # 회사명
            "Website",          # 웹사이트
            "Country",          # 국가
            "Email",            # 대표 이메일
            "Phone",            # 전화번호
            "Source",           # 데이터 출처
            "Match Score",      # 매칭 점수
            "Priority",         # 우선순위
            "Match Reason",     # 매칭 사유
            "Approach Strategy", # 접근 전략
            "Company Summary",  # 회사 요약
            "Products",         # 취급 제품
            "Contact Page",     # 연락처 페이지
            "Verification",     # 검증 상태
            "Email Subject",    # 이메일 제목 (초안)
            "Email Body",       # 이메일 본문 (초안)
            "Data Source Type", # 소스 유형 (directory/llm)
            "Notes",            # 비고
        ]
        writer.writerow(headers)

        for c in all_companies:
            analysis = c.get("analysis", {})
            validation = c.get("validation", {})
            email_draft = c.get("email_draft", {})
            emails = c.get("emails_found", [])
            phones = c.get("phone_found", [])

            # 검증 상태 라벨
            status = validation.get("overall", c.get("verification_status", "UNVERIFIED"))

            row = [
                c.get("name", ""),
                c.get("url", ""),
                c.get("_country", ""),
                "; ".join(emails) if emails else "",
                "; ".join(phones[:3]) if phones else "",
                c.get("source", ""),
                analysis.get("match_score", 0),
                analysis.get("priority", ""),
                analysis.get("match_reason", ""),
                analysis.get("approach", ""),
                analysis.get("summary", ""),
                ", ".join(analysis.get("detected_products", [])),
                c.get("contact_page", ""),
                status,
                email_draft.get("subject", ""),
                email_draft.get("body", ""),
                c.get("source_type", "unknown"),
                c.get("_warning", ""),
            ]
            writer.writerow(row)

    print(f"\n  📄 CSV 저장: {output_path}")
    print(f"     (UTF-8 BOM - Excel에서 한글 깨짐 없이 열림)")


# ─── Excel 출력 ─────────────────────────────────────────────

def write_excel(results: list[dict], output_path: str, config_summary: dict | None = None):
    """
    Excel 파일 출력 (lead-verifier/excel_writer.py 패턴 재사용).
    우선순위별 색상, 필터, 요약 시트 포함.
    """
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

    wb = Workbook()

    # 모든 국가 병합
    all_companies = []
    for r in results:
        country = r.get("country", "")
        for c in r.get("companies", []):
            c["_country"] = country
            all_companies.append(c)

    # ── 메인 시트: 잠재고객 리스트 ──
    ws = wb.active
    ws.title = "잠재고객 리스트"

    # 스타일 정의
    header_font = Font(bold=True, color="FFFFFF", size=11)
    header_fill = PatternFill(start_color="2B5797", end_color="2B5797", fill_type="solid")
    high_fill = PatternFill(start_color="E2EFDA", end_color="E2EFDA", fill_type="solid")
    medium_fill = PatternFill(start_color="FCE4D6", end_color="FCE4D6", fill_type="solid")
    verified_fill = PatternFill(start_color="C6EFCE", end_color="C6EFCE", fill_type="solid")
    warning_fill = PatternFill(start_color="FFEB9C", end_color="FFEB9C", fill_type="solid")
    error_fill = PatternFill(start_color="FFC7CE", end_color="FFC7CE", fill_type="solid")
    thin_border = Border(
        left=Side(style="thin"), right=Side(style="thin"),
        top=Side(style="thin"), bottom=Side(style="thin"),
    )

    headers = [
        "No", "국가", "매칭점수", "우선순위", "업체명", "홈페이지",
        "이메일", "전화번호", "데이터 출처", "소스 유형",
        "회사 요약", "매칭 사유", "접근 전략", "취급 제품",
        "검증 상태", "이메일 제목(초안)", "비고",
    ]

    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = thin_border

    for row_idx, c in enumerate(all_companies, 2):
        analysis = c.get("analysis", {})
        validation = c.get("validation", {})
        email_draft = c.get("email_draft", {})

        status = validation.get("overall", c.get("verification_status", "UNVERIFIED"))

        data = [
            row_idx - 1,
            c.get("_country", ""),
            analysis.get("match_score", 0),
            analysis.get("priority", ""),
            c.get("name", ""),
            c.get("url", ""),
            "; ".join(c.get("emails_found", [])),
            "; ".join(c.get("phone_found", [])[:3]),
            c.get("source", ""),
            c.get("source_type", ""),
            analysis.get("summary", ""),
            analysis.get("match_reason", ""),
            analysis.get("approach", ""),
            ", ".join(analysis.get("detected_products", [])),
            status,
            email_draft.get("subject", ""),
            c.get("_warning", ""),
        ]

        for col, value in enumerate(data, 1):
            cell = ws.cell(row=row_idx, column=col, value=value)
            cell.alignment = Alignment(vertical="top", wrap_text=True)
            cell.border = thin_border

        # 우선순위별 행 색상
        priority = analysis.get("priority", "")
        if priority == "high":
            for col in range(1, len(headers) + 1):
                ws.cell(row=row_idx, column=col).fill = high_fill
        elif priority == "medium":
            for col in range(1, len(headers) + 1):
                ws.cell(row=row_idx, column=col).fill = medium_fill

        # 검증 상태 색상
        status_col = 15
        status_cell = ws.cell(row=row_idx, column=status_col)
        if status == "verified":
            status_cell.fill = verified_fill
        elif status in ("url_fail", "error"):
            status_cell.fill = error_fill
        elif status in ("no_email_found", "UNVERIFIED"):
            status_cell.fill = warning_fill

    # 컬럼 너비
    widths = [5, 10, 8, 8, 30, 35, 30, 18, 20, 12, 40, 40, 40, 30, 12, 35, 20]
    for i, w in enumerate(widths):
        col_letter = chr(65 + i) if i < 26 else chr(64 + i // 26) + chr(65 + i % 26)
        ws.column_dimensions[col_letter].width = w

    ws.auto_filter.ref = ws.dimensions

    # ── 요약 시트 ──
    ws2 = wb.create_sheet("요약")

    summary_data = [
        ["항목", "값"],
        ["생성 일시", datetime.now().strftime("%Y-%m-%d %H:%M")],
        ["", ""],
    ]

    if config_summary:
        summary_data.extend([
            ["클라이언트", config_summary.get("client", "")],
            ["제품 카테고리", config_summary.get("product", "")],
            ["대상 국가", ", ".join(config_summary.get("countries", []))],
            ["LLM 프로바이더", config_summary.get("llm_provider", "")],
            ["", ""],
        ])

    # 국가별 통계
    for r in results:
        stats = r.get("stats", {})
        country = r.get("country", "?")
        if r.get("error"):
            summary_data.append([f"{country} (실패)", r["error"]])
            continue
        summary_data.extend([
            [f"── {country} ──", ""],
            ["  총 업체", stats.get("total", 0)],
            ["  디렉토리 수집", stats.get("from_directories", 0)],
            ["  LLM 생성", stats.get("from_llm", 0)],
            ["  URL 접근 가능", stats.get("url_accessible", 0)],
            ["  High 매칭", stats.get("high_match", 0)],
            ["  Medium 매칭", stats.get("medium_match", 0)],
            ["  평균 매칭 점수", stats.get("avg_match_score", 0)],
            ["  발견 이메일 수", stats.get("emails_found", 0)],
            ["  이메일 초안 수", stats.get("emails_drafted", 0)],
            ["  할루시네이션 비율", f"{stats.get('hallucination_rate_pct', 0)}%"],
            ["", ""],
        ])

    summary_data.extend([
        ["", ""],
        ["생성", "AI DevPartner Pipeline (ai.devpartner.org)"],
    ])

    for r, row_data in enumerate(summary_data, 1):
        for c_idx, val in enumerate(row_data, 1):
            cell = ws2.cell(row=r, column=c_idx, value=val)
            if r == 1:
                cell.font = Font(bold=True)

    ws2.column_dimensions["A"].width = 25
    ws2.column_dimensions["B"].width = 45

    # ── 이메일 초안 시트 ──
    ws3 = wb.create_sheet("이메일 초안")

    email_headers = ["No", "국가", "업체명", "매칭점수", "이메일주소", "제목", "본문"]
    for col, h in enumerate(email_headers, 1):
        cell = ws3.cell(row=1, column=col, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center", wrap_text=True)
        cell.border = thin_border

    email_row = 2
    for c in all_companies:
        draft = c.get("email_draft", {})
        if not draft.get("subject"):
            continue
        data = [
            email_row - 1,
            c.get("_country", ""),
            c.get("name", ""),
            c.get("analysis", {}).get("match_score", 0),
            "; ".join(c.get("emails_found", [])),
            draft.get("subject", ""),
            draft.get("body", ""),
        ]
        for col, val in enumerate(data, 1):
            cell = ws3.cell(row=email_row, column=col, value=val)
            cell.alignment = Alignment(vertical="top", wrap_text=True)
            cell.border = thin_border
        email_row += 1

    ws3.column_dimensions["A"].width = 5
    ws3.column_dimensions["B"].width = 10
    ws3.column_dimensions["C"].width = 25
    ws3.column_dimensions["D"].width = 8
    ws3.column_dimensions["E"].width = 30
    ws3.column_dimensions["F"].width = 40
    ws3.column_dimensions["G"].width = 80

    wb.save(output_path)
    print(f"  📊 Excel 저장: {output_path}")
