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
    ("#customers", "جهات الاستهداف"),
    ("#aimkt", "أي خدمة يبيعها المساعد؟"),
    ("#kb", "خدمات المساعد"),
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
            errors: list[str] = []
            page = browser.new_page(viewport={"width": 1440, "height": 900})
            page.on("pageerror", lambda e, acc=errors: acc.append(f"pageerror: {e}"))
            page.on("console", lambda m, acc=errors: acc.append(f"console: {m.text[:120]}") if m.type == "error" else None)
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

            status = "ok" if not failures or not failures[-1].startswith(route) else "FAIL"
            print(f"  {route:24} {body_len:>7} chars  {status}")
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
