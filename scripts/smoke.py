#!/usr/bin/env python3
"""Post-deploy render assertion.

A syntactically valid bundle can still render nothing: on 2026-08-12 a range edit
deleted five helper functions, `tsc` and `node --check` both passed, and the campaign
detail page shipped blank. Only a screenshot caught it. This script is the guard —
it loads the real routes in a real browser and fails loudly on an empty page,
a missing landmark, or any console error.

Usage:  python3 scripts/smoke.py            # reads ADMIN_TOKEN from .env
Exit 0 = safe, exit 1 = do not leave this deploy live.
"""
import json
import re
import sys
from pathlib import Path

BASE = "https://massar-engine.fly.dev"

# route → a landmark that must exist if the view actually rendered
ROUTES = [
    ("#home", "مركز القيادة"),
    ("#kmon", "الحملات"),
    # #customers became the العملاء LIST this cycle; the importer moved to #targets, which
    # is why both routes are asserted now — the old landmark would still pass on the wrong screen.
    ("#customers", "العملاء"),
    ("#targets", "جهات الاستهداف"),
    ("#pipeline", "لوحة المتابعة"),
    ("#aimkt", "أي خدمة يبيعها المساعد؟"),
    ("#kb", "خدمات المساعد"),
    # The most-edited surface, and the one the blank-page class would hit hardest.
    # The landmark below is the enrichment panel's sub-line, «ما تكتبه هنا لا يستطيع المساعد
    # تغييره». Repointed in the crm-record cycle from vSalesPath's heading «مسار البيع مع هذا
    # العميل», which the same cycle deleted — an assertion on deleted copy turns smoke red for the
    # wrong reason. The panel's own heading «ملف العميل» was rejected as the replacement because
    # that exact phrase also appears in this view's loading and error states («جارٍ تجميع ملف
    # العميل…», «تعذّر فتح ملف العميل»), so it would go GREEN on a page that never loaded — which
    # is the one thing this script exists to catch. The sub-line renders only from vFactsPanel.
    ("#customer/966500000850", "ما تكتبه هنا لا يستطيع المساعد تغييره"),
]
MIN_CHARS = 400


def token() -> str:
    env = Path(__file__).resolve().parent.parent / ".env"
    m = re.search(r"^ADMIN_TOKEN=(.+)$", env.read_text(encoding="utf-8"), re.M)
    if not m:
        print("smoke: ADMIN_TOKEN not found in .env", file=sys.stderr)
        sys.exit(1)
    return m.group(1).strip()


def main() -> int:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("smoke: playwright not installed — install it or run the QA venv", file=sys.stderr)
        return 1

    tok = token()
    failures: list[str] = []
    detail_route = None

    with sync_playwright() as p:
        browser = p.chromium.launch()

        # Pick a real campaign so the detail view is exercised with real data.
        probe = browser.new_page()
        probe.goto(f"{BASE}/dashboard?token={tok}#kmon")
        probe.wait_for_timeout(3500)
        try:
            campaigns = probe.evaluate("() => (typeof campaigns !== 'undefined' && campaigns.length) ? campaigns[0].id : null")
            if campaigns:
                detail_route = (f"#kmon/{campaigns}", "حكم الحملة")
        except Exception:
            pass
        probe.close()

        routes = ROUTES + ([detail_route] if detail_route else [])
        for route, landmark in routes:
            before = len(failures)
            errors: list[str] = []
            page = browser.new_page(viewport={"width": 1440, "height": 900})
            page.on("pageerror", lambda e, acc=errors: acc.append(f"pageerror: {e}"))
            # A third-party CDN 404 is not a broken deploy. Google's font CDN failed on 3 of 6 runs,
            # and a gate that fails half the time for a reason outside the repo teaches its operator
            # to re-run it — which is how the blank-page class this guard exists to catch comes back.
            # The host is in m.location.url, NOT in m.text — a resource 404 reads «Failed to load
            # resource: the server responded with a status of 404 ()» with no URL in it. Filtering
            # on m.text therefore never matched, and Google's Cairo CDN kept failing the deploy
            # about one run in three. Check both, and treat a bare resource-404 as third-party too.
            THIRD_PARTY = ("fonts.gstatic.com", "fonts.googleapis.com")
            def _is_third_party(m):
                loc = ""
                try:
                    loc = (m.location or {}).get("url", "") or ""
                except Exception:
                    loc = ""
                blob = f"{m.text} {loc}"
                return any(h in blob for h in THIRD_PARTY)
            page.on("console", lambda m, acc=errors: (
                None if (m.type != "error" or _is_third_party(m))
                else acc.append(f"console: {m.text[:120]} @ {((m.location or {}).get('url') or '')[:80]}")))
            page.goto(f"{BASE}/dashboard?token={tok}{route}")
            page.wait_for_timeout(4000)

            body_len = page.evaluate("() => (document.getElementById('body') || {}).innerHTML?.length || 0")
            text = page.evaluate("() => document.body.innerText")
            if body_len < MIN_CHARS:
                failures.append(f"{route}: rendered only {body_len} chars (threshold {MIN_CHARS})")
            if landmark not in text:
                failures.append(f"{route}: landmark «{landmark}» missing")
            if errors:
                failures.append(f"{route}: {len(errors)} runtime error(s) — {errors[0]}")

            ok = len(failures) == before
            print(f"  {route:26} {body_len:>7} chars  {'ok' if ok else 'FAIL'}  «{landmark}»")
            page.close()

        browser.close()

    if failures:
        print("\nSMOKE FAILED — this deploy renders broken:", file=sys.stderr)
        for f in failures:
            print("  •", f, file=sys.stderr)
        return 1
    print(f"\nsmoke: {len(ROUTES) + (1 if detail_route else 0)} routes render, 0 runtime errors")
    return 0


if __name__ == "__main__":
    sys.exit(main())
