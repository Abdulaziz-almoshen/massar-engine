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


# Selection-leak regressions. These recreate two bugs a review PROVED at 645c5d8: a selection made
# on one campaign survived navigation and staged the wrong phone numbers into the launch wizard
# under the new campaign's name, and a list selection survived a tab/search change so the bulk bar
# acted on campaigns the operator could not see. Each returns "" on success or a failure reason.
SELECTION_LEAKS = [
    ("leak-tab", "#kmon", """() => {
        campaigns = window.__qaFixture('default'); render(false);
        crmToggle(2);                                  // campaign 2 is تجريبية
        setCampTab('real');                            // now hidden by the quick filter
        var bar = document.querySelector('.bulkbar');
        return (crmSelIds().length === 0 && !bar) ? '' :
          'bulk bar still offers ' + crmSelIds().length + ' hidden campaign(s) after tab change';
     }"""),
    # NB: drive the app's OWN handler. campQ is a top-level `let` (dashboard.ts:289), which is not a
    # window property, so assigning `campQ = ...` from page.evaluate creates a SEPARATE global and
    # the real filter never changes — the first version of this test failed for that reason and
    # would have sent me to patch product code that was fine.
    ("leak-search", "#kmon", """async () => {
        campaigns = window.__qaFixture('default'); render(false);
        crmToggle(1);
        campSearchFn({ value: 'زززز' });               // matches nothing; debounced 250ms
        await new Promise(r => setTimeout(r, 500));
        var bar = document.querySelector('.bulkbar');
        var n = crmSelIds().length;
        campSearchFn({ value: '' });
        await new Promise(r => setTimeout(r, 400));
        return (n === 0 && !bar) ? '' :
          'bulk bar survived a search that matches no rows (' + n + ' still actionable)';
     }"""),
    # QA findings at 645c5d8, each recreated so it cannot silently return.
    ("f2-no-invented-send", "#kmon/1", """() => {
        campaigns = window.__qaFixture('zerotargets'); render(false);
        var t = document.body.innerText;
        if (t.indexOf('أُرسلت، وبانتظار الرد الأول') !== -1)
          return 'zero-target campaign still claims it was sent';
        return t.indexOf('لم يُرسل شيء') !== -1 ? '' : 'no honest zero-audience verdict rendered';
     }"""),
    ("ac5-select-all-matching", "#kmon", """async () => {
        campaigns = window.__qaFixture('many'); render(false);   // 400, LIST_CAP renders 60
        if (document.body.innerText.indexOf('تحديد المطابقين') === -1)
          return 'FR-6 control «تحديد المطابقين» is absent';
        crmSelectAllMatching();
        await new Promise(r => setTimeout(r, 150));
        var n = crmSelIds().length;
        var shown = document.querySelectorAll('.krow').length;
        crmClear();
        return n > shown ? '' : 'select-all-matching selected only ' + n + ' of the rendered ' + shown;
     }"""),
    # Occlusion is measured, not inferred from a selector. alertBar (dashboard.ts:1140) renders a
    # bare <div> with inline styles and NO class or id, so the first version of this test queried
    # '.bar, #alertbar' , matched nothing, scored the alert z-index as 0 and could never fail — it
    # survived a mutation that put the bulk bar back underneath. elementFromPoint asks the question
    # that actually matters: if the operator clicks the button, does the click reach it?
    # Occlusion is measured across the WHOLE bar, not at one point. alertBar (dashboard.ts:1140) is
    # a bare <div> with inline styles and no class, so an earlier selector-based version matched
    # nothing and could never fail. A single elementFromPoint at the first button's centre also
    # could not fail: measured, that centre is x=767 while the alert starts at x~800, so it covered
    # only the button's trailing third. Sampling across the bar is the property that actually
    # matters — no part of it may be unclickable.
    ("bulkbar-not-occluded", "#kmon", """async () => {
        campaigns = window.__qaFixture('many'); render(false); crmClear();
        crmTogglePage();                                  // this path always fires an alertBar
        await new Promise(r => setTimeout(r, 400));
        var bar = document.querySelector('.bulkbar');
        if (!bar) { crmClear(); return 'bulk bar missing'; }
        var pill = bar.firstElementChild;
        var r0 = pill.getBoundingClientRect();
        var cy = r0.top + r0.height / 2, bad = null;
        for (var i = 1; i < 20; i++) {
          var x = r0.left + (r0.width * i / 20);
          var hit = document.elementFromPoint(x, cy);
          if (!(hit && bar.contains(hit))) {
            bad = Math.round(x) + 'px -> ' + (hit ? hit.tagName + ' z=' + getComputedStyle(hit).zIndex : 'nothing');
            break;
          }
        }
        crmClear();
        return bad === null ? '' : 'the bulk bar is covered at ' + bad;
     }"""),
    # CPO round-30 musts, each recreated.
    # innerText holds only the RENDERED tab, so a one-tab version of this assertion was green while
    # being false on الأداء at the same commit. Iterate all three tabs or the test cannot see two
    # thirds of the record it claims to check.
    # TWO states, not one. «no audience» (targeted=0) and «audience but nothing sent» are different,
    # and M6 lived in the SECOND — a zerotargets-only fixture left crmRate returning null anyway, so
    # the first version of this test stayed green through a mutation that reverted M6.
    # The assertion is also per-card, not a blanket «no ٠٪ on the page»: أُرسلت and وصلت describe the
    # send itself, so an honest ٠٪ there is correct and must not be flagged. Only the three
    # recipient-behaviour cards are undefined until something is sent.
    ("m1-unsent-vocabulary", "#kmon/1", """async () => {
        var bad = [];
        var RECIPIENT = ['شوهدت', 'ردّوا', 'جهات مهتمة'];
        for (var f = 0; f < 2; f++) {
          campaigns = window.__qaFixture(f === 0 ? 'zerotargets' : 'default');
          var label = f === 0 ? 'no-audience' : 'never-sent';
          render(false);
          var tabs = ['targets', 'perf', 'next'];
          for (var i = 0; i < tabs.length; i++) {
            crmSetDetailTab(tabs[i]);
            await new Promise(r => setTimeout(r, 120));
            if (document.body.innerText.indexOf('بلا ردود بعد') !== -1)
              bad.push(label + '/' + tabs[i] + ': chipped «بلا ردود بعد»');
            [].slice.call(document.querySelectorAll('.statc')).forEach(function (card) {
              var l = (card.querySelector('.l') || {}).textContent || '';
              var pct = (card.querySelector('.p') || {}).textContent || '';
              if (RECIPIENT.indexOf(l.trim()) !== -1 && pct.indexOf('٪') !== -1)
                bad.push(label + '/' + tabs[i] + ': «' + l.trim() + '» shows «' + pct.trim() + '» on a campaign that was never sent');
            });
          }
          crmSetDetailTab('targets');
          await new Promise(r => setTimeout(r, 120));
          var t0 = document.body.innerText;
          if (t0.indexOf('بلا جمهور') === -1 && t0.indexOf('لم تُرسل') === -1)
            bad.push(label + ': no never-sent vocabulary on the record');
        }
        return bad.length ? bad.slice(0, 4).join('; ') : '';
     }"""),
    ("m2-group-headers", "#kmon", """() => {
        campaigns = window.__qaFixture('default'); render(false);
        crmSetView('group');
        var t = document.body.innerText;
        var missing = ['الخدمة','الحالة','الجمهور','مشاهدة','ردود','التقدّم'].filter(function(h){ return t.indexOf(h) === -1; });
        crmSetView('list');
        return missing.length === 0 ? '' : 'تجميع view has no column headers: ' + missing.join(', ');
     }"""),
    ("m3-board-matches-pill", "#kmon", """() => {
        campaigns = window.__qaFixture('default'); render(false);
        setCampTab('real'); crmSetView('kanban');
        var cols = [].slice.call(document.querySelectorAll('.kcol .lb')).map(function(e){ return e.textContent.trim(); });
        crmSetView('list'); setCampTab('all');
        return cols.indexOf('تجريبية') === -1 ? ''
          : 'class board renders a تجريبية column while the فعلية filter excludes it';
     }"""),
    ("leak-navigate", "#kmon/1", """() => {
        campaigns = window.__qaFixture('default'); render(false);
        crmToggleD('96650000000010'); crmToggleD('96650000000011');
        location.hash = 'kmon/3'; render(false);
        var leaked = crmSelPhones();
        return leaked.length === 0 ? '' :
          'cohort from campaign 1 survived onto campaign 3: ' + JSON.stringify(leaked);
     }"""),
]


def run_selection_leaks(page, base, tok) -> list:
    out = []
    for case_id, route, js in SELECTION_LEAKS:
        page.goto(f"{base}/dashboard?token={tok}{route}", wait_until="domcontentloaded")
        page.wait_for_timeout(3000)
        page.evaluate(FIXTURE)
        why = page.evaluate(js)
        out.append({"case": case_id, "kind": "regression", "verdict": "PASS" if why == "" else "FAIL",
                    "detail": why or "selection did not survive the state change"})
    return out


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
            # reduced_motion is REQUIRED for deterministic captures, not a nicety. dashboard.ts:206
            # gates `.rise` (a 420ms opacity+translateY entrance) behind
            # `@media (prefers-reduced-motion: no-preference)`, so without this every screenshot
            # lands on a different animation frame: measured 43.8% pixel drift between two renders
            # of the SAME commit at 1440x900. Using the app's own accessibility path rather than
            # injecting foreign CSS means we are still capturing a real code path.
            ctx = browser.new_context(viewport={"width": w, "height": h}, locale="ar-SA",
                                      reduced_motion="reduce")
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

        # Selection-leak regressions run once (they are logic, not layout).
        ctx = browser.new_context(viewport={"width": 1440, "height": 900}, locale="ar-SA",
                                  reduced_motion="reduce")
        page = ctx.new_page()
        leaks = run_selection_leaks(page, BASE, tok)
        for rec in leaks:
            results.append(rec)
            if rec["verdict"] != "PASS":
                failures.append({**rec, "viewport": "1440x900", "render_ok": True,
                                 "landmark_ok": True, "console_ok": True, "overflow_ok": True,
                                 "chars": 0, "landmark": "", "console_errors": [],
                                 "page_h_overflow_px": 0})
        ctx.close()
        browser.close()

    (OUT / "results.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[qa-crm] {len(results)} assertions ({len(SELECTION_LEAKS)} selection-leak regressions), {len(failures)} failed")
    for f in failures:
        why = []
        if f.get("kind") == "regression": why.append(f["detail"])
        elif not f["render_ok"]: why.append(f"blank ({f[chr(39)+chr(39)] if False else f[chr(99)+chr(104)+chr(97)+chr(114)+chr(115)]} chars)")
        if not f["landmark_ok"]: why.append(f"missing landmark «{f['landmark']}»")
        if not f["console_ok"]: why.append(f"console: {f['console_errors']}")
        if not f["overflow_ok"]: why.append(f"h-overflow {f['page_h_overflow_px']}px")
        print(f"  FAIL {f['case']}@{f['viewport']}: {'; '.join(why)}")
    print(f"  captures written to {OUT}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
