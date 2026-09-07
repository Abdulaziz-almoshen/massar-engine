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
import os
import sys
from pathlib import Path

# Production by default, because `npm run deploy` is what usually runs this. Overridable so a
# LOCAL build can be smoked before it ships: without this the variable was hardcoded, an operator
# who set BASE in the environment silently tested production instead, and a new screen that works
# locally reads as a broken deploy. That happened while adding #perf.
BASE = os.environ.get("SMOKE_BASE") or os.environ.get("BASE") or "https://massar-engine.fly.dev"

# route → a landmark that must exist if the view actually rendered
ROUTES = [
    ("#home", "مركز القيادة"),
    ("#kmon", "كانبان"),
    # #customers became the العملاء LIST this cycle; the importer moved to #targets, which
    # is why both routes are asserted now — the old landmark would still pass on the wrong screen.
    ("#customers", "تجميع"),
    ("#targets", "الشرائح"),
    # فرص البيع is the opportunity board (cycle opps-board): account cards over stored product
    # lines. Repointed from «جهة في السجل», which now renders only under its SECOND tab («فرز
    # الردود») — a landmark on a tab the route does not open would go red on a page that works.
    # «إضافة فرصة» is the board tab's own control bar and renders before any fetch resolves, so it
    # is green on a slow ledger and red on a broken view, which is the distinction that matters.
    ("#opps", "إضافة فرصة"),
    # المستهدفات والأداء renders its period chips and KPI shells BEFORE the fetch resolves, so
    # «المتوقع من الفرص المفتوحة» is green on a slow ledger and red on a broken view — the same
    # distinction the #opps landmark was chosen for. A landmark inside the table would go red
    # whenever the catalogue is empty, which is a legitimate state, not a failure.
    ("#perf", "المتوقع من الفرص المفتوحة"),
    ("#pipeline", "إخفاقات"),
    # «المنتجات» and «التقارير» stopped being «قريبًا» placeholders. Both landmarks render from the
    # data, so they go red if the endpoint behind the screen breaks — which is the whole reason
    # these two screens exist.
    ("#products", "الكتالوج"),
    ("#reports", "الخسائر بسبب التكامل"),
    ("#tasks", "الأولوية"),
    ("#notes", "ملاحظة"),
    ("#aimkt", "أي خدمة يبيعها المساعد؟"),
    # Repointed after fd01976 redesigned the page and deleted the «خدمات المساعد» heading — the
    # stale landmark turned smoke red on a page that renders fine. The tfoot line below renders
    # unconditionally from vKb and appears nowhere else; the topbar head was rejected because the
    # topbar renders even when the view body is broken.
    ("#kb", "منها بمعرفة معتمدة"),
    # The most-edited surface, and the one the blank-page class would hit hardest.
    # The landmark below is the enrichment panel's sub-line, «ما تكتبه هنا لا يستطيع المساعد
    # تغييره». Repointed in the crm-record cycle from vSalesPath's heading «مسار البيع مع هذا
    # العميل», which the same cycle deleted — an assertion on deleted copy turns smoke red for the
    # wrong reason. The panel's own heading «ملف العميل» was rejected as the replacement because
    # that exact phrase also appears in this view's loading and error states («جارٍ تجميع ملف
    # العميل…», «تعذّر فتح ملف العميل»), so it would go GREEN on a page that never loaded — which
    # is the one thing this script exists to catch. The sub-line renders only from vFactsPanel.
]

# A screen with nothing in it is not a broken screen — but it renders far under MIN_CHARS, so the
# blank-page guard cannot tell the two apart on a fresh database. It can, if the honest empty state
# names itself: a page carrying one of these is passing DELIBERATELY, whatever its length. A truly
# blank render carries neither this nor the landmark, so nothing is weakened.
EMPTY_OK = {
    "#kmon": "لا حملات بعد",
}
MIN_CHARS = 400


def token() -> str:
    # The environment wins, so a LOCAL instance can be smoked with a throwaway token instead of
    # the production one. Reading only from .env meant an operator pointing SMOKE_BASE at
    # localhost sent the real admin token to it and got 401 on every route — the same class of
    # gap as the hardcoded BASE above.
    from_env = os.environ.get("SMOKE_ADMIN_TOKEN") or os.environ.get("ADMIN_TOKEN")
    if from_env:
        return from_env.strip()
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
    # WAIT FOR THE MACHINE TO BE AWAKE BEFORE JUDGING A PAGE.
    # `npm run deploy` runs this immediately after `fly deploy`, so the first request lands on a
    # cold machine still booting and hydrating from Postgres. On 2026-08-24 that produced a 160-char
    # #customer render and a red gate on a page that was, on the very next run, 18,882 chars and
    # perfect. A gate that fails for a reason it is not testing is a gate people learn to re-run
    # instead of read — which is exactly how the blank-page class it guards would get back in.
    # Poll /health until the DB is actually connected, then start.
    import urllib.request, json as _json, time as _time
    for attempt in range(30):
        try:
            with urllib.request.urlopen(f"{BASE}/health", timeout=5) as r:
                h = _json.loads(r.read())
            if h.get("ok") and h.get("db", {}).get("connected"):
                if attempt:
                    print(f"  (waited {attempt}s for the machine to finish booting)")
                break
        except Exception:
            pass
        _time.sleep(1)
    else:
        print("smoke: /health never reported a connected database — refusing to judge the pages",
              file=sys.stderr)
        return 1
    detail_route = None
    customer_route = None

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
        # And a real contact, for the client record. This used to be a HARDCODED phone number in
        # ROUTES, which meant the strongest screen in the product was only ever smoked against one
        # database that happened to contain it: red on a fresh CI database and red locally, for the
        # same reason, on every run of this session. Probed, it exercises real data everywhere and
        # skips honestly where there is none.
        try:
            probe2 = browser.new_page()
            probe2.goto(f"{BASE}/dashboard?token={tok}#customers")
            probe2.wait_for_timeout(3500)
            phone = probe2.evaluate(
                "() => (cache && cache.contacts && cache.contacts.length) ? cache.contacts[0].phone : null")
            if phone:
                customer_route = (f"#customer/{phone}", "ما تكتبه هنا لا يستطيع المساعد تغييره")
            probe2.close()
        except Exception:
            pass
        probe.close()

        routes = ROUTES + ([detail_route] if detail_route else []) + ([customer_route] if customer_route else [])
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

            # ONE reload before judging a short page. The client record needs /admin/state and then
            # /admin/customer/<phone>, two sequential fetches behind a fixed 4s sleep, and on a
            # COLD engine that sleep is occasionally not enough: the same route measured 160 chars
            # on the first run against a freshly seeded database and 28,648 on the next, with every
            # request returning 200 both times. A gate that is red at random is worse than no gate,
            # because its operator learns to re-run it — which is how the blank-page class this
            # script exists to catch gets waved through. A genuinely blank page is still blank after
            # a reload, so nothing is hidden; only the race is removed.
            if body_len < MIN_CHARS and route not in EMPTY_OK:
                # The retry waits LONGER than the first pass, deliberately. Measured against a cold
                # engine on a freshly created database, the client record rendered 160 chars on the
                # first run and 28,424 on every run after — a one-time warmup, not a defect, and a
                # same-length retry reproduced the 160 rather than clearing it.
                page.reload()
                page.wait_for_timeout(9000)
                body_len = page.evaluate("() => (document.getElementById('body') || {}).innerHTML?.length || 0")
                text = page.evaluate("() => document.body.innerText")
            # An empty state that NAMES itself is a working screen, not a blank one.
            empty_marker = EMPTY_OK.get(route)
            is_honest_empty = bool(empty_marker) and empty_marker in text
            if body_len < MIN_CHARS and not is_honest_empty:
                failures.append(f"{route}: rendered only {body_len} chars (threshold {MIN_CHARS})")
            # SCOPED TO #body ON PURPOSE. Until 2026-09-07 this searched the whole page, so five
            # routes were asserting a landmark that also appears in the nav rail or the breadcrumb
            # — «الحملات», «العملاء», «جهات الاستهداف», «لوحة المتابعة», «المهام». Every one of
            # them was green on a screen that rendered nothing, because the chrome always renders.
            # A skeleton makes that worse, not better: it clears the char threshold too, so this
            # assertion is now the only thing standing between a stuck fetch and a green deploy.
            body_text = page.evaluate(
                "() => (document.getElementById('body') || {}).innerText || ''")
            if landmark not in body_text and not is_honest_empty:
                failures.append(f"{route}: landmark «{landmark}» missing from #body")
            if errors:
                failures.append(f"{route}: {len(errors)} runtime error(s) — {errors[0]}")

            ok = len(failures) == before
            note = "«" + landmark + "»" + ("  (فارغة بشكل صحيح)" if is_honest_empty else "")
            print(f"  {route:26} {body_len:>7} chars  {'ok' if ok else 'FAIL'}  {note}")
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
