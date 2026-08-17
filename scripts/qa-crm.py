#!/usr/bin/env python3
"""campaigns-crm delivery evidence — local render assertion + viewport captures.

WHY LOCAL. scripts/smoke.py asserts against the DEPLOYED url, so it cannot prove a change before it
ships. This runs the same class of assertion against a locally booted engine, which is the only way
to get a runtime verdict on code that lives inside a template literal (ADR-0001).

WHAT IT PROVES, per route/state/viewport: the page rendered (>= MIN_CHARS of text), the landmark for
that state is present, and ZERO console errors were emitted. Fixtures are injected client-side
(campaigns = FIXTURE; render(false)) because the states that matter — zero targets, 400 campaigns,
an empty list — do not exist in the ledger and seeding them would be a write we are not taking.

Usage: ./.venv/bin/python scripts/qa-crm.py [base_url]
Exit 0 = every assertion held.
"""
import json
import re
import sys
from pathlib import Path

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8099"
OUT = Path(__file__).resolve().parent.parent.parent / ".orbit/qa/campaigns-crm"
VIEWPORTS = [("375x812", 375, 812), ("768x1024", 768, 1024), ("1440x900", 1440, 900)]
MIN_CHARS = 300

# A fixture campaign set that exercises the states production does not have.
FIXTURE = """
window.__qaFixture = function (kind) {
  var now = Date.now();
  var mk = function (id, name, product, test, nTargets, msg) {
    var t = [];
    for (var i = 0; i < nTargets; i++) t.push({ phone: "9665000000" + (10 + i), name: "جهة " + (i + 1) });
    return { id: id, name: name, product: product, test: test, created_at: now - id * 86400000,
             message: msg, targets: t };
  };
  if (kind === "empty") return [];
  if (kind === "zerotargets") return [mk(1, "حملة بلا جمهور", "الإجازات المرضية", false, 0, "نص الحملة التجريبية")];
  if (kind === "one") return [mk(1, "حملة واحدة", "الإجازات المرضية", false, 3, "مرحبًا، هذه رسالة الحملة.")];
  if (kind === "many") {
    var a = [];
    for (var i = 1; i <= 400; i++) a.push(mk(i, "حملة رقم " + i, i % 3 === 0 ? "الإجازات المرضية" : "التطعيمات", i % 5 === 0, 4, "نص الحملة " + i));
    return a;
  }
  return [mk(1, "حملة العيادات", "الإجازات المرضية", false, 6, "السلام عليكم، نوفّر خدمة الإجازات المرضية الإلكترونية للمنشآت الصحية. هل ترغبون بمعرفة التفاصيل؟"),
          mk(2, "بروفة داخلية", "التطعيمات", true, 2, "رسالة بروفة"),
          mk(3, "حملة بلا ردود", "التطعيمات", false, 5, "نص ثالث")];
};
"""

# Per-case blank-page floor. MIN_CHARS exists to catch a BLANK render, and an empty state is not a
# blank render — it is a short one BY DESIGN, and shorter still at 375/768 where the sidebar
# collapses (measured: 499 chars at 1440, 235 at 375, with the landmark and both actions present in
# the capture). Holding a deliberately-sparse screen to the same floor as a data-bearing one would
# fail it forever, so the floor is per-case and stated. 180 still catches a truly blank body.
FLOORS = {"list-empty": 180}

# (id, fixture kind, hash route, setup js, landmark that must be present)
CASES = [
    ("list-default",   "default",      "#kmon",   "",                                        "الحملات"),
    ("list-group",     "default",      "#kmon",   'crmSetView("group");',                    "تجميع"),
    ("list-kanban",    "default",      "#kmon",   'crmSetView("kanban");',                   "كانبان"),
    ("list-empty",     "empty",        "#kmon",   "",                                        "لا حملات بعد"),
    ("list-one",       "one",          "#kmon",   "",                                        "الحملات"),
    ("list-many",      "many",         "#kmon",   "",                                        "ضيّق بالبحث"),
    ("list-selected",  "default",      "#kmon",   "crmToggle(1);",                           "محدَّدة"),
    ("detail-targets", "default",      "#kmon/1", "",                                        "جهات الاستهداف"),
    ("detail-perf",    "default",      "#kmon/1", 'crmSetDetailTab("perf");',                "شوهدت"),
    ("detail-next",    "default",      "#kmon/1", 'crmSetDetailTab("next");',                "الخطوة التالية"),
    ("detail-spec",    "default",      "#kmon/1", "",                                        "لا يقبل التعديل بعد الإطلاق"),
    ("detail-zero",    "zerotargets",  "#kmon/1", "",                                        "—"),
]


def token() -> str:
    env = Path(__file__).resolve().parent.parent / ".env"
    m = re.search(r"^ADMIN_TOKEN=(.+)$", env.read_text(encoding="utf-8"), re.M)
    if not m:
        print("qa-crm: ADMIN_TOKEN not found in .env", file=sys.stderr)
        sys.exit(1)
    return m.group(1).strip()


def main() -> int:
    from playwright.sync_api import sync_playwright

    OUT.mkdir(parents=True, exist_ok=True)
    tok = token()
    results = []
    failures = []

    with sync_playwright() as p:
        browser = p.chromium.launch()
        for vp_name, w, h in VIEWPORTS:
            ctx = browser.new_context(viewport={"width": w, "height": h}, locale="ar-SA")
            page = ctx.new_page()
            errors = []

            # A font-CDN 404 is not a broken build. smoke.py learned this the hard way: the host is
            # in m.location.url, not in m.text, so filtering on text alone never matched and the
            # gate failed about one run in three for a reason outside the repo.
            THIRD_PARTY = ("fonts.gstatic.com", "fonts.googleapis.com")

            def _third_party(m):
                try:
                    loc = (m.location or {}).get("url", "") or ""
                except Exception:
                    loc = ""
                return any(h in f"{m.text} {loc}" for h in THIRD_PARTY)

            page.on("console", lambda m: None if (m.type != "error" or _third_party(m))
                    else errors.append("console: " + m.text[:140]))
            page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))

            for case_id, kind, route, setup, landmark in CASES:
                del errors[:]
                page.goto(f"{BASE}/dashboard?token={tok}{route}", wait_until="domcontentloaded")
                page.wait_for_timeout(3000)
                page.evaluate(FIXTURE)
                # Replace the ledger with the fixture for this case, then re-render.
                page.evaluate(
                    "kind => { if (kind !== 'default' || true) { campaigns = window.__qaFixture(kind); } render(false); }",
                    kind,
                )
                page.wait_for_timeout(250)
                if setup:
                    page.evaluate(setup)
                    page.wait_for_timeout(250)

                text = page.inner_text("body")
                shot = OUT / f"{case_id}@{vp_name}.png"
                page.screenshot(path=str(shot), full_page=False)

                overflow = page.evaluate(
                    "() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth"
                )
                floor = FLOORS.get(case_id, MIN_CHARS)
                ok_render = len(text) >= floor
                ok_landmark = landmark in text
                ok_console = len(errors) == 0
                ok_overflow = overflow <= 1

                rec = {
                    "case": case_id, "viewport": vp_name, "route": route, "fixture": kind,
                    "chars": len(text), "blank_floor": floor, "landmark": landmark,
                    "render_ok": ok_render, "landmark_ok": ok_landmark,
                    "console_errors": errors[:3], "console_ok": ok_console,
                    "page_h_overflow_px": overflow, "overflow_ok": ok_overflow,
                    "capture": str(shot.relative_to(OUT.parent.parent)),
                }
                results.append(rec)
                if not (ok_render and ok_landmark and ok_console and ok_overflow):
                    failures.append(rec)
            ctx.close()
        browser.close()

    (OUT / "results.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[qa-crm] {len(results)} case/viewport assertions, {len(failures)} failed")
    for f in failures:
        why = []
        if not f["render_ok"]: why.append(f"blank ({f['chars']} chars)")
        if not f["landmark_ok"]: why.append(f"missing landmark «{f['landmark']}»")
        if not f["console_ok"]: why.append(f"console: {f['console_errors']}")
        if not f["overflow_ok"]: why.append(f"h-overflow {f['page_h_overflow_px']}px")
        print(f"  FAIL {f['case']}@{f['viewport']}: {'; '.join(why)}")
    print(f"  captures written to {OUT}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
