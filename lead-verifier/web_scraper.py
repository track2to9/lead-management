"""
Playwright로 업체 홈페이지를 방문하고 연락처 정보를 추출
+ 스크린샷 촬영 (증거용)
"""
import re
import asyncio
from playwright.async_api import async_playwright


async def scrape_company(company: dict, browser, screenshot_dir: str = "screenshots") -> dict:
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
        await page.goto(url, wait_until="domcontentloaded", timeout=20000)
        await page.wait_for_timeout(2000)

        # 쿠키 동의 팝업 처리 (폴란드 사이트에 흔함)
        await _dismiss_cookie_popup(page)

        # 메인 페이지 스크린샷
        screenshot_path = f"{screenshot_dir}/{company['num']:02d}_{_safe_filename(name)}_main.png"
        await page.screenshot(path=screenshot_path, full_page=False)
        company["screenshot_path"] = screenshot_path

        # 2. 메인 페이지에서 연락처 추출
        main_content = await page.content()
        main_text = await page.evaluate("() => document.body.innerText")

        # 페이지 텍스트 저장 (Claude 분석용)
        company["page_text"] = main_text[:5000]

        emails_main = _extract_emails(main_content + " " + main_text)
        phones_main = _extract_phones(main_text)

        # 3. Contact/Kontakt 페이지 찾아서 방문
        contact_url = await _find_contact_page(page)
        emails_contact = []
        phones_contact = []

        if contact_url:
            try:
                await page.goto(contact_url, wait_until="domcontentloaded", timeout=15000)
                await page.wait_for_timeout(1500)
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
    """쿠키 동의 팝업 자동 닫기"""
    cookie_selectors = [
        "button:has-text('Accept')",
        "button:has-text('Akceptuję')",
        "button:has-text('Zgadzam')",
        "button:has-text('OK')",
        "button:has-text('Zamknij')",
        "[class*='cookie'] button",
        "[id*='cookie'] button",
        "[class*='consent'] button",
        "[class*='gdpr'] button",
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
    """Contact/Kontakt 페이지 링크 찾기"""
    contact_patterns = [
        "a:has-text('Kontakt')",
        "a:has-text('Contact')",
        "a:has-text('kontakt')",
        "a:has-text('contact')",
        "a[href*='kontakt']",
        "a[href*='contact']",
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
    """텍스트에서 전화번호 추출 (폴란드 형식 포함)"""
    patterns = [
        r"\+48[\s\-]?\d{2,3}[\s\-]?\d{3}[\s\-]?\d{3}",  # 폴란드 국제
        r"\d{2,3}[\s\-]\d{3}[\s\-]\d{2}[\s\-]\d{2}",  # 폴란드 로컬
        r"\(\d{2,3}\)\s?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}",  # (XX) XXX-XX-XX
        r"\+\d{2}[\s\-]?\d{2,3}[\s\-]?\d{3}[\s\-]?\d{3,4}",  # 기타 국제
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
        "adam_kowalski@gmail",  # 폼 placeholder
    ]
    email_lower = email.lower()
    # 이미지 파일명이 이메일로 잘못 매칭된 경우
    if not email_lower.endswith((".pl", ".com", ".eu", ".de", ".net", ".org", ".info", ".io", ".co")):
        return True
    return any(j in email_lower for j in junk_patterns)


def _safe_filename(name: str) -> str:
    """파일명에 쓸 수 없는 문자 제거"""
    return re.sub(r"[^\w\-]", "_", name)[:30]


async def scrape_all(companies: list[dict], screenshot_dir: str = "screenshots") -> list[dict]:
    """모든 업체 크롤링"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            locale="pl-PL",
        )

        for company in companies:
            await scrape_company(company, context, screenshot_dir)
            await asyncio.sleep(1)  # 예의 바른 크롤링

        await browser.close()

    return companies
