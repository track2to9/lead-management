"""
일본 Local 5G 업체 홈페이지 크롤링
Playwright로 방문하고 연락처 정보를 추출 + 스크린샷 촬영
"""
import re
import asyncio
from playwright.async_api import async_playwright


async def scrape_company(company: dict, browser, screenshot_dir: str = "screenshots_japan") -> dict:
    """단일 업체 홈페이지 크롤링 + 연락처 추출"""
    url = company["url"]
    name = company["name"]

    if not url:
        company["verification_status"] = "no_url"
        return company

    print(f"\n  🔍 [{company['num']}] {name}")
    print(f"     URL: {url}")

    page = await browser.new_page()
    page.set_default_timeout(15000)

    try:
        # 1. 메인 페이지 접속
        await page.goto(url, wait_until="domcontentloaded", timeout=25000)
        await page.wait_for_timeout(2500)

        # 쿠키 동의 팝업 처리 (일본 사이트)
        await _dismiss_cookie_popup(page)

        # 메인 페이지 스크린샷
        screenshot_path = f"{screenshot_dir}/{company['num']:02d}_{_safe_filename(name)}_main.png"
        await page.screenshot(path=screenshot_path, full_page=False)
        company["screenshot_path"] = screenshot_path

        # 2. 메인 페이지에서 연락처 추출
        main_content = await page.content()
        main_text = await page.evaluate("() => document.body.innerText")

        # 페이지 텍스트 저장 (Claude 분석용) - 일본어 사이트는 더 많은 텍스트 필요
        company["page_text"] = main_text[:6000]

        emails_main = _extract_emails(main_content + " " + main_text)
        phones_main = _extract_phones(main_text)

        # 3. Contact/お問い合わせ 페이지 찾아서 방문
        contact_url = await _find_contact_page(page)
        emails_contact = []
        phones_contact = []

        if contact_url:
            try:
                await page.goto(contact_url, wait_until="domcontentloaded", timeout=15000)
                await page.wait_for_timeout(2000)
                await _dismiss_cookie_popup(page)

                contact_content = await page.content()
                contact_text = await page.evaluate("() => document.body.innerText")

                emails_contact = _extract_emails(contact_content + " " + contact_text)
                phones_contact = _extract_phones(contact_text)

                company["contact_page"] = contact_url

                # Contact 페이지 스크린샷
                contact_screenshot = f"{screenshot_dir}/{company['num']:02d}_{_safe_filename(name)}_contact.png"
                await page.screenshot(path=contact_screenshot, full_page=False)

            except Exception as e:
                print(f"     ⚠️ Contact 페이지 접근 실패: {e}")

        # 4. 결과 종합
        all_emails = list(set(emails_main + emails_contact))
        all_phones = list(set(phones_main + phones_contact))

        # 스팸/무관 이메일 필터링
        all_emails = [e for e in all_emails if not _is_junk_email(e)]

        company["emails_found"] = all_emails
        company["phone_found"] = all_phones
        company["url_accessible"] = True
        company["verification_status"] = "verified"

        print(f"     ✅ 접속 성공")
        print(f"     📧 이메일 발견: {all_emails}")
        print(f"     📞 전화 발견: {all_phones[:3]}")

    except Exception as e:
        company["url_accessible"] = False
        company["verification_status"] = "error"
        print(f"     ❌ 접속 실패: {str(e)[:80]}")

    finally:
        await page.close()

    return company


async def _dismiss_cookie_popup(page):
    """쿠키/同意 팝업 자동 닫기 (일본 사이트)"""
    cookie_selectors = [
        "button:has-text('同意')",
        "button:has-text('同意する')",
        "button:has-text('承認')",
        "button:has-text('了解')",
        "button:has-text('閉じる')",
        "button:has-text('Accept')",
        "button:has-text('OK')",
        "button:has-text('すべて許可')",
        "button:has-text('Cookieを受け入れる')",
        "[class*='cookie'] button",
        "[id*='cookie'] button",
        "[class*='consent'] button",
        "[class*='gdpr'] button",
        "[class*='privacy'] button:has-text('同意')",
    ]
    for selector in cookie_selectors:
        try:
            btn = page.locator(selector).first
            if await btn.is_visible(timeout=1000):
                await btn.click()
                await page.wait_for_timeout(500)
                return
        except:
            continue


async def _find_contact_page(page) -> str | None:
    """お問い合わせ/Contact ページ リンク 찾기"""
    contact_patterns = [
        "a:has-text('お問い合わせ')",
        "a:has-text('お問合せ')",
        "a:has-text('問い合わせ')",
        "a:has-text('Contact')",
        "a:has-text('contact')",
        "a:has-text('CONTACT')",
        "a[href*='contact']",
        "a[href*='inquiry']",
        "a[href*='toiawase']",
        "a[href*='otoiawase']",
    ]
    for selector in contact_patterns:
        try:
            link = page.locator(selector).first
            if await link.is_visible(timeout=1000):
                href = await link.get_attribute("href")
                if href:
                    if href.startswith("http"):
                        return href
                    elif href.startswith("/"):
                        base = page.url.split("/")[0:3]
                        return "/".join(base) + href
                    else:
                        return page.url.rstrip("/") + "/" + href
        except:
            continue
    return None


def _extract_emails(text: str) -> list[str]:
    """텍스트에서 이메일 추출"""
    pattern = r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"
    emails = re.findall(pattern, text)
    return list(set(e.lower() for e in emails))


def _extract_phones(text: str) -> list[str]:
    """텍스트에서 전화번호 추출 (일본 형식)"""
    patterns = [
        r"\+81[\s\-]?\d{1,4}[\s\-]?\d{1,4}[\s\-]?\d{3,4}",      # +81 국제
        r"0\d{1,4}[\s\-]\d{1,4}[\s\-]\d{3,4}",                     # 0X-XXXX-XXXX
        r"\(0\d{1,4}\)\s?\d{1,4}[\s\-]?\d{3,4}",                   # (0X) XXXX-XXXX
        r"0\d{2,3}\-\d{3,4}\-\d{4}",                                # 0XX-XXX-XXXX
        r"03\-\d{4}\-\d{4}",                                         # 東京 03
        r"0120[\s\-]?\d{2,3}[\s\-]?\d{3,4}",                        # フリーダイヤル
        r"050[\s\-]?\d{4}[\s\-]?\d{4}",                              # IP電話
    ]
    phones = []
    for p in patterns:
        phones.extend(re.findall(p, text))
    return list(set(phones))


def _is_junk_email(email: str) -> bool:
    """스팸/무관 이메일 필터링"""
    junk_patterns = [
        "noreply", "no-reply", "wordpress", "wix",
        "sentry", "cloudflare", "google", "facebook",
        "example.com", "test.com", ".webp", ".png",
        ".jpg", ".svg", ".gif", ".css", ".js",
        "dummy@", "sample@",
    ]
    email_lower = email.lower()
    # 유효한 TLD 체크 (일본 도메인 포함)
    valid_tlds = (".jp", ".com", ".co.jp", ".or.jp", ".ne.jp", ".ac.jp",
                  ".io", ".net", ".org", ".info", ".co", ".eu", ".de")
    if not any(email_lower.endswith(t) for t in valid_tlds):
        return True
    return any(j in email_lower for j in junk_patterns)


def _safe_filename(name: str) -> str:
    """파일명에 쓸 수 없는 문자 제거"""
    return re.sub(r"[^\w\-]", "_", name)[:30]


async def scrape_all(companies: list[dict], screenshot_dir: str = "screenshots_japan") -> list[dict]:
    """모든 업체 크롤링"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            locale="ja-JP",
        )

        for company in companies:
            await scrape_company(company, context, screenshot_dir)
            await asyncio.sleep(1.5)  # 예의 바른 크롤링 (일본 사이트 간격 넓게)

        await browser.close()

    return companies
