#!/usr/bin/env python3
"""qa-scale — the portal at the founder's stated production scale.

WHY THIS EXISTS. Every defect it asserts was invisible at the 16 contacts and 6 campaigns the demo
ledger holds, and obvious within one minute of serving 200 campaigns / 3,000 potential clients /
1,000 onboarded. A design reviewed only at demo scale is reviewed at the wrong scale, so the
simulation is a gate rather than a one-off.

NOTHING IS WRITTEN ANYWHERE. The synthetic ledger is served to the deployed portal by request
interception; the database, the app and every real contact are untouched. No WhatsApp path is
exercised — there is no send handler on any screen this file visits.

Each assertion below was falsified against the pre-fix build before being trusted; the commit
message for each names the number it caught.
"""
import json, re, subprocess, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
TOK = re.search(r"^ADMIN_TOKEN=(.+)$", (ROOT / ".env").read_text(), re.M).group(1).strip()
BASE = "https://massar-engine.fly.dev/dashboard"
FIXDIR = Path("/tmp/massar-qa-scale")

def build_fixture():
    FIXDIR.mkdir(exist_ok=True)
    src = (ROOT / "scripts/qa-scale-fixture.py").read_text().replace('"/tmp/fixture', f'"{FIXDIR}')
    subprocess.run([sys.executable, "-c", src], check=True, capture_output=True)

fails, checks = [], 0
def ck(name, got, want):
    global checks
    checks += 1
    ok = got == want
    if not ok: fails.append(f"{name}\n     got  {got!r}\n     want {want!r}")
    print(("ok   " if ok else "FAIL ") + name + (f" — {got!r}" if ok else ""))

build_fixture()
BODY = {"/admin/state": (FIXDIR/"state.json").read_text(),
        "/admin/entities": (FIXDIR/"entities.json").read_text(),
        "/admin/campaigns": (FIXDIR/"campaigns.json").read_text(),
        "/admin/tags": (FIXDIR/"tags.json").read_text()}
N_ENT, N_CON = 3000, 1700

def handler(route):
    u = route.request.url.split("?")[0]
    for k, b in BODY.items():
        if u.endswith(k):
            route.fulfill(status=200, content_type="application/json; charset=utf-8", body=b); return
    route.continue_()

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx = br.new_context(viewport={"width": 1440, "height": 900}, locale="ar-SA", reduced_motion="reduce")
    ctx.route("**/admin/**", handler)
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(f"{BASE}?token={TOK}#home", wait_until="domcontentloaded")
    pg.wait_for_timeout(9000)

    def go(route, wait=1600):
        pg.evaluate(f"location.hash='{route}'"); pg.wait_for_timeout(wait)
    def txt(sel):
        return pg.evaluate("(s) => [...document.querySelectorAll(s)].map(e=>e.innerText.replace(/\\s+/g,' ').trim()).join(' | ')", sel)
    def height():
        return pg.evaluate("() => document.getElementById('body').scrollHeight")

    # --- 1. PAGINATION EXISTS, AND THE LAST ROW IS REACHABLE ------------------
    # Ten sites truncated at LIST_CAP=60 under «ضيّق بالبحث لرؤية الباقي» — a false claim, because
    # search narrows the same list and slices the same 60. Row 61 was unreachable however you typed.
    # ar-SA digits are Arabic-Indic with a ٬ group separator, so the range is normalised to
    # integers and compared numerically — a substring match on a formatted string proves nothing.
    def rng():
        return pg.evaluate("""() => { const e=document.querySelector('.pgrange'); if(!e) return null;
            const t=e.innerText.replace(/[٠-٩]/g, d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[٬,]/g,'');
            const m=t.match(/(\\d+)\\D+(\\d+)\\D+(\\d+)/); return m?[+m[1],+m[2],+m[3]]:null; }""")

    for route, key in [("kmon", "kmon"), ("customers", "cus"), ("targets", "tgt")]:
        go(route)
        first = rng()
        firstRow = pg.evaluate("() => { const r=document.querySelector('.crow:not(.thead-wide),.oprow'); return r ? r.innerText.slice(0,40) : ''; }")
        ck(f"[{route}] the footer states a range and a total, not a truncation notice",
           bool(first) and first[0] == 1 and first[2] > first[1], True)
        ck(f"[{route}] «ضيّق بالبحث لرؤية الباقي» is gone", "ضيّق بالبحث" in txt(".tfoot"), False)
        total = first[2]
        pg.evaluate("(a) => pageGo(a[0], Math.ceil(a[1] / PAGE_SIZE))", [key, total])
        pg.wait_for_timeout(900)
        last = rng()
        ck(f"[{route}] the LAST page is reachable and ends on row {total}",
           bool(last) and last[1] == total and last[0] > first[1], True)
        # EXACT count, and a different first row than page 1. «>=» passed against restored
        # truncation, which renders 60 rows while the footer claims 1651-1700 — the assertion has
        # to catch a footer that describes a page the list is not showing.
        got = pg.evaluate("""() => { const r=[...document.querySelectorAll('.crow:not(.thead-wide),.oprow')];
            return [r.length, r.length ? r[0].innerText.slice(0, 40) : ""]; }""")
        ck(f"[{route}] …and it renders exactly the rows it claims", got[0], last[1] - last[0] + 1)
        ck(f"[{route}] …and they are not page one's rows again", got[1] != firstRow, True)
        pg.evaluate("(k) => pageGo(k, 1)", key); pg.wait_for_timeout(600)

    # --- 2. NO SCREEN IS A SCROLL OF RECORD ----------------------------------
    # لوحة الفرز rendered every contact in every group: 38,250px and 742 rows in one paint.
    for route in ["home", "kmon", "customers", "targets", "opps", "pipeline", "aimkt", "kb"]:
        go(route)
        h = height()
        ck(f"[{route}] page height stays inside a readable budget at production scale", h < 6000, True)

    # --- 3. A COUNT OF PEOPLE IS NOT A COUNT OF ROWS --------------------------
    # «شاهدوا الرسالة دون ردّ — ٣٬٠٢٢ جهة» with 3,000 people in the whole book: seenNoReply
    # collected (campaign, target) PAIRS, so a contact in three launches counted three times.
    go("home")
    seen = pg.evaluate("""() => { const r=[...document.querySelectorAll('.aq')]
        .find(e=>e.innerText.includes('شاهدوا الرسالة دون ردّ'));
        if(!r) return null; const m=r.innerText.replace(/[٠-٩]/g, d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d))
          .replace(/٬|,/g,'').match(/(\\d+)\\s*جهة/); return m?Number(m[1]):null; }""")
    ck("[home] «شاهدوا دون ردّ» counts people, never more than the whole book",
       seen is not None and 0 < seen <= N_CON, True)

    # --- 4. ELAPSED TIME IN A UNIT A PERSON SAYS ------------------------------
    # «مؤهلة وبلا متابعة منذ ٢٬٨٧٩ ساعة» is arithmetically true and unreadable.
    hours = pg.evaluate("""() => { const t=document.getElementById('body').innerText
        .replace(/[٠-٩]/g, d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/٬|,/g,'');
        return [...t.matchAll(/(\\d+)\\s*(?:ساعة|ساعات)/g)].map(m=>Number(m[1])); }""")
    ck("[home] no elapsed time is stated in hours beyond two days", [h for h in hours if h > 48], [])

    # --- 5. A SHORTLIST NEVER READS AS A TOTAL -------------------------------
    # «٩ إجراء» above 359 qualified contacts reads as nine things to do.
    body = pg.evaluate("() => document.getElementById('body').innerText")
    ck("[home] the action queue says what it is a top-of", "أهمّ" in body and "لوحة الفرز الكاملة" in body, True)

    # --- 5b. THE SERVICE FILTER ACTUALLY FILTERS ------------------------------
    # Founder: «not every client will use every product… I need some filter». The failure mode this
    # guards is a filter that RENDERS but does not filter — and worse, «تحديد المطابقين» selecting
    # the unfiltered set, which would stage the wrong people into a launch.
    go("aimkt")
    P = "الإجازات المرضية"
    total = pg.evaluate("() => entities.length")
    owners = pg.evaluate("(p) => entities.filter(e => entUses(e, p)).length", P)
    ck("[aimkt] the book knows who already owns a service", 0 < owners < total, True)

    pg.evaluate("(p) => setProdFilter('uses', p)", P); pg.wait_for_timeout(700)
    usesN = pg.evaluate("() => entMatches().length")
    ck("[aimkt] «يستخدم» narrows the audience to exactly the owners", usesN, owners)
    # every row on screen must actually carry the service — the filter and the list agree
    allShown = pg.evaluate("(p) => pageSlice('aud', entMatches()).every(e => entUses(e, p))", P)
    ck("[aimkt] …and every row rendered under it owns that service", allShown, True)

    pg.evaluate("() => setProdFilter('uses','')")
    pg.evaluate("(p) => setProdFilter('notUses', p)", P); pg.wait_for_timeout(700)
    notUsesN = pg.evaluate("() => entMatches().length")
    ck("[aimkt] «لا يستخدم» is the exact complement of «يستخدم»", usesN + notUsesN, total)

    # THE HIGH-STAKES ONE. crmSelD-class bug: a selection computed from the wrong set.
    pg.evaluate("() => entAllMatching()"); pg.wait_for_timeout(700)
    staged = pg.evaluate("() => launchTargets().length")
    ck("[aimkt] «تحديد المطابقين» stages the FILTERED set, never the whole book", staged, notUsesN)

    # An absent record is «unknown», not «does not use it» — the screen has to say so.
    known = pg.evaluate("() => entities.filter(e => factProducts(e).length).length")
    caveat = pg.evaluate("() => (document.querySelector('.affin .why')||{}).textContent || ''")
    ck("[aimkt] …and it warns that «لا يستخدم» includes accounts with no record at all",
       ("غياب السجل" in caveat) if known < total else True, True)

    pg.evaluate("() => { entClear(); clearProdFilter(); }"); pg.wait_for_timeout(500)
    ck("[aimkt] clearing the service filter restores the whole book",
       pg.evaluate("() => entMatches().length"), total)

    # --- 5c. THE OPERATOR'S OWN TAG ------------------------------------------
    # Founder: «I want to tag the clients to product so… I can easily find them.» The defect class
    # this guards is the one this codebase has shipped before — a value the system WRITES but
    # cannot READ BACK, because the two sides spell it differently.
    go("targets")
    T = "تكامل الأنظمة (HIS/ERP)"
    tagged = pg.evaluate("(p) => entities.filter(e => (e.productTags||[]).indexOf(p) >= 0).length", T)
    ck("[targets] the book carries operator tags distinct from ownership", tagged > 0, True)

    go("aimkt")
    pg.evaluate("(p) => setProdFilter('candidate', p)", T); pg.wait_for_timeout(700)
    ck("[aimkt] «مرشّح لـ» narrows the audience to exactly the tagged accounts",
       pg.evaluate("() => entMatches().length"), tagged)
    ck("[aimkt] …and it is NOT the same set as «يستخدم» (the two would agree by accident otherwise)",
       pg.evaluate("(p) => entMatches().every(e => entUses(e, p))", T), False)
    pg.evaluate("() => clearProdFilter()"); pg.wait_for_timeout(400)

    # The round trip, through the real client handler with the write intercepted: whatever string
    # the UI offers must be the string the filter finds afterwards.
    go("targets")
    sent = {}
    def tagroute(route):
        import json as _j
        sent.update(_j.loads(route.request.post_data or "{}"))
        route.fulfill(status=200, content_type="application/json; charset=utf-8",
                      body=_j.dumps({"status": "ok", "updated": len(sent.get("ids", [])),
                                     "product": sent.get("product"), "add": True}))
    ctx.route("**/admin/entities/tag", tagroute)
    picked = pg.evaluate("""() => { const rows = pageSlice('tgt', tgtMatches()).slice(0, 3);
        rows.forEach(e => tgtSel[e.id] = true); render(false); return rows.map(e => e.id); }""")
    pg.wait_for_timeout(600)
    offered = pg.evaluate("() => { const s=document.getElementById('tgtagsel'); return s ? s.options[0].value : null; }")
    ck("[targets] selecting rows raises a bulk bar offering a real product name", bool(offered), True)
    pg.evaluate("() => tgtTag(true)"); pg.wait_for_timeout(1200)
    ck("[targets] the tag POSTed is the exact name the control offered", sent.get("product"), offered)
    ck("[targets] …and the rows it names are the ones selected", sorted(sent.get("ids", [])), sorted(picked))
    readback = pg.evaluate("""(a) => a.ids.filter(id => {
        const e = entities.find(x => x.id === id);
        return e && (e.productTags || []).indexOf(a.p) >= 0; }).length""", {"ids": picked, "p": offered})
    ck("[targets] …and every tagged row reads that same string back", readback, len(picked))
    ck("[targets] tagging clears the selection so the bar cannot fire twice",
       pg.evaluate("() => tgtSelIds().length"), 0)
    ctx.unroute("**/admin/entities/tag")

    # --- 5d. THE TAG REGISTRY IS A VOCABULARY, NOT A CATALOGUE ---------------
    # Founder: «maybe other departments want to use Massar to market their products. So tags are
    # not there.» Correct as first shipped: the tag name was validated against Lean's hard-coded
    # health-service catalogue, so no operator could name anything else. The registry has to offer
    # a label that is NOT a service, and a brand-new tag with nobody in it has to be selectable —
    # you create it before you use it, and it must exist in between.
    OUTSIDE = "تأمين المركبات"
    go("aimkt")
    offered = pg.evaluate("() => tagList().map(t => t.name)")
    ck("[aimkt] the tag vocabulary offers a label that is NOT in the product catalogue",
       OUTSIDE in offered, True)
    ck("[aimkt] …and it is genuinely outside the catalogue the agent is locked to",
       pg.evaluate("(n) => PRODUCTS.some(p => p.n === n)", OUTSIDE), False)
    ck("[aimkt] a tag with zero accounts is still selectable",
       pg.evaluate("() => tagList().some(t => t.count === 0)"), True)
    ck("[aimkt] every option in the tag select comes from the registry",
       pg.evaluate("""() => { const reg = new Set(tagReg.map(t => t.name));
         const sels = [...document.querySelectorAll('.affin select')];
         const s = sels.find(x => [...x.options].some(o => o.value && reg.has(o.value)));
         if (!s) return false;
         return [...s.options].filter(o => o.value).every(o => reg.has(o.value)); }"""), True)

    # Create → apply → filter, through the real handlers, with the writes intercepted. What the
    # operator typed must be what the filter finds; nothing may normalise it in between.
    import json as _json
    posts = []
    def tagsroute(route):
        req = route.request
        if req.method != "POST":
            return route.fulfill(status=200, content_type="application/json; charset=utf-8",
                                 body=BODY["/admin/tags"])
        body = _json.loads(req.post_data or "{}")
        posts.append((req.url.split("/admin/tags")[1] or "/", body))
        reg = _json.loads(BODY["/admin/tags"])
        if req.url.endswith("/admin/tags"):
            reg.append({"id": 999, "name": body["name"], "created_at": 0, "created_by": "portal"})
            BODY["/admin/tags"] = _json.dumps(reg, ensure_ascii=False)
            return route.fulfill(status=200, content_type="application/json; charset=utf-8",
                                 body=_json.dumps({"status": "ok", "name": body["name"], "created": True}))
        return route.fulfill(status=200, content_type="application/json; charset=utf-8",
                             body=_json.dumps({"status": "ok", "renamed": True, "cleared": 0}))
    ctx.route("**/admin/tags**", tagsroute)

    go("targets")
    pg.evaluate("() => tgtOpenTags()"); pg.wait_for_timeout(600)
    NEWTAG = "خط منتجات قسم آخر"
    pg.evaluate("(n) => { document.getElementById('tgnew').value = n; tgtCreateTag(); }", NEWTAG)
    pg.wait_for_timeout(1200)
    ck("[targets] creating a tag POSTs exactly the name typed",
       [b for (p_, b) in posts if p_ == "/"][-1].get("name"), NEWTAG)
    ck("[targets] …and the new tag joins the vocabulary the controls offer",
       pg.evaluate("(n) => tagList().some(t => t.name === n)", NEWTAG), True)
    ck("[targets] …and the panel needs no browser dialog to rename or delete",
       pg.evaluate("""() => { const b = [...document.querySelectorAll('.tagsheet .trow2 .btn')]
           .map(x => x.getAttribute('onclick') || '').join(' ');
         return /prompt\(|confirm\(/.test(b); }"""), False)
    pg.evaluate("() => tgtCloseTags()"); pg.wait_for_timeout(400)
    ctx.unroute("**/admin/tags**")

    # --- 5e. THE PIPELINE STAGE ----------------------------------------------
    # Founder: «clients status in the pipeline… they move forward or backward depend on the messages
    # we send.» Ported from frappe/crm's seeded ladders (crm/install.py), keeping the three
    # structural ideas — ordered positions, a type above the stage, and Lost as a POSITION rather
    # than an overlay — and none of the labels, which name things Massar cannot observe.
    go("customers")
    ladder = pg.evaluate("() => CRM_STAGE.map(s => [s.key, s.pos, s.type, s.label])")
    ck("[stage] the ladder is ORDERED with no gaps or ties — «forward» has to mean something",
       [r[1] for r in ladder], list(range(1, len(ladder) + 1)))
    ck("[stage] every rung carries a type, from Frappe's own four",
       sorted(set(r[2] for r in ladder)), ["lost", "ongoing", "open", "won"])
    ck("[stage] a Lost rung sits ON the ladder, as in Frappe — not as a flag beside it",
       [r[1] for r in ladder if r[2] == "lost"] == sorted([r[1] for r in ladder if r[2] == "lost"])
       and max(r[1] for r in ladder if r[2] == "lost") == len(ladder), True)
    ck("[stage] labels are unique — two rungs sharing a word would collapse the board",
       len(set(r[3] for r in ladder)), len(ladder))

    # EVERY contact lands in exactly one rung, and the derivation is total: no contact anywhere in
    # 1,700 falls through to an undefined stage.
    cover = pg.evaluate("""() => { const seen = {};
        (cache.contacts || []).forEach(c => { const s = stageOf(c); seen[s && s.key] = (seen[s && s.key]||0) + 1; });
        return seen; }""")
    ck("[stage] every contact resolves to a real rung", "undefined" in cover, False)
    ck("[stage] the derivation covers the book", sum(cover.values()), pg.evaluate("() => (cache.contacts||[]).length"))
    ck("[stage] and the live book actually spans several rungs", len(cover) >= 4, True)

    # ORDER IS THE CONTRACT: a terminal rung wins over forward progress. Someone who booked a
    # meeting and then asked us to stop is «أوقف التواصل», not «موعد محدَّد».
    ck("[stage] opting out after a meeting reads as stopped, not as the meeting",
       pg.evaluate("""() => stageOf({ optedOut: true, outcome: "scheduled",
          statusTimes: {sent:1, delivered:1, read:1, replied:1},
          transcript:[{role:"customer",ts:1,text:"x"}], tags:[{product:"p",level:"hot",ts:1}] }).key"""), "stopped")
    # …and BACKWARD needs no special case: remove the evidence, the stage falls back on its own.
    ck("[stage] removing the evidence moves the contact BACK down the ladder",
       pg.evaluate("""() => [
          stageOf({ statusTimes:{sent:1,delivered:1}, transcript:[{role:"customer",ts:1,text:"x"}], tags:[] }).key,
          stageOf({ statusTimes:{sent:1,delivered:1}, transcript:[], tags:[] }).key,
          stageOf({ statusTimes:{}, transcript:[], tags:[] }).key ]"""),
       ["engaged", "contacted", "new"])

    # An account nobody has messaged is the ladder's first rung, not a private word on one screen.
    go("targets")
    ck("[targets] an unmessaged account reads as the ladder's first rung",
       pg.evaluate("""() => { const e = entities.find(x => !contactByPhone(x.phone));
          return e ? stageOfEntity(e).key : null; }"""), "new")

    # --- 6. REPAINT COST -----------------------------------------------------
    # contactByPhone was a linear scan: #kmon repainted in 110-123ms EVERY paint — a visible
    # stutter on every keystroke in its search box — while #customers repainted in 4ms.
    go("kmon")
    paints = pg.evaluate("""() => { const o=[]; for(let i=0;i<5;i++){ const t=performance.now();
        render(false); o.push(Math.round(performance.now()-t)); } return o; }""")
    ck("[kmon] repaint stays under 40ms at 200 campaigns over 1,700 contacts",
       max(paints[1:]) < 40, True)

    ck("no runtime errors on any screen at scale", errs[:3], [])
    br.close()

print(f"\n[qa-scale] {checks} assertions at 200 campaigns / {N_ENT:,} targets / 1,000 onboarded, {len(fails)} failed")
for f in fails: print("  FAIL " + f)
sys.exit(1 if fails else 0)
