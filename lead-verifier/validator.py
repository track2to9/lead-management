"""
GPT가 준 데이터 vs 실제 크롤링 데이터 비교 검증
"""


def validate_company(company: dict) -> dict:
    """단일 업체 검증 결과 생성"""
    result = {
        "url_ok": False,
        "emails_match": False,
        "emails_new": [],
        "emails_missing": [],
        "has_contact_page": False,
        "overall": "unknown",
    }

    # URL 접근 가능 여부
    result["url_ok"] = company.get("url_accessible", False)

    # 이메일 비교
    gpt_emails = set(e.lower() for e in company.get("emails_gpt", []))
    found_emails = set(e.lower() for e in company.get("emails_found", []))

    if gpt_emails and found_emails:
        result["emails_match"] = bool(gpt_emails & found_emails)
        result["emails_new"] = list(found_emails - gpt_emails)
        result["emails_missing"] = list(gpt_emails - found_emails)
    elif not gpt_emails and found_emails:
        result["emails_new"] = list(found_emails)
    elif gpt_emails and not found_emails:
        result["emails_missing"] = list(gpt_emails)

    # Contact 페이지
    result["has_contact_page"] = bool(company.get("contact_page"))

    # 종합 판정
    if not result["url_ok"]:
        result["overall"] = "url_fail"
    elif found_emails:
        if result["emails_match"]:
            result["overall"] = "verified"
        else:
            result["overall"] = "updated"
    else:
        result["overall"] = "no_email_found"

    company["validation"] = result
    return company


def validate_all(companies: list[dict]) -> list[dict]:
    """전체 업체 검증"""
    for c in companies:
        validate_company(c)
    return companies


def print_summary(companies: list[dict]):
    """검증 결과 요약 출력"""
    total = len(companies)
    verified = sum(1 for c in companies if c.get("validation", {}).get("overall") == "verified")
    updated = sum(1 for c in companies if c.get("validation", {}).get("overall") == "updated")
    url_fail = sum(1 for c in companies if c.get("validation", {}).get("overall") == "url_fail")
    no_email = sum(1 for c in companies if c.get("validation", {}).get("overall") == "no_email_found")

    total_gpt_emails = sum(len(c.get("emails_gpt", [])) for c in companies)
    total_found_emails = sum(len(c.get("emails_found", [])) for c in companies)
    total_new_emails = sum(len(c.get("validation", {}).get("emails_new", [])) for c in companies)
    total_phones = sum(len(c.get("phone_found", [])) for c in companies)

    print(f"\n{'='*60}")
    print(f"  검증 결과 요약")
    print(f"{'='*60}")
    print(f"  총 업체 수:        {total}")
    print(f"  ✅ 검증 완료:       {verified}")
    print(f"  🔄 정보 업데이트:   {updated}")
    print(f"  ❌ URL 접근 실패:   {url_fail}")
    print(f"  ⚠️  이메일 미발견:  {no_email}")
    print(f"")
    print(f"  GPT 제공 이메일:    {total_gpt_emails}개")
    print(f"  크롤링 발견 이메일: {total_found_emails}개")
    print(f"  신규 발견 이메일:   {total_new_emails}개")
    print(f"  발견 전화번호:      {total_phones}개")
    print(f"{'='*60}")
