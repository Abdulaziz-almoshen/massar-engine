// partners-crm.ts — «شركاء المبيعات» (client A, BRD v1.0 §17 BR-PRT-001..004, slice S5).
//
// The prototype's screen, on real records: a week, a product filter, «الإجمالي» plus one tab per partner,
// five tiles (المستهدف · تم التواصل · مهتمون · غير مهتمين · لم يردوا), achievement per product, and per
// partner. Inside a partner: its contact results for the week, a sheet to record them one by one or as a
// pasted list, and a sheet to set the week's targets. Every «مهتم» is handed to the sales team as a partner
// opportunity by the server, and the row then says so and links to it (BR-PRT-003).
//
// PORTED to the new design system (docs/PORT-SPEC.md). The whole screen body — and the sheet, which is a
// sibling of it — is wrapped in .ds6. Rules still come from partner-domain (PARTNER_DOMAIN_JS); the numbers
// still from its summarizeWeek, so a tile and a table row can never count a week two ways.
//
// GRAMMAR. .m-tabs/.m-tab for the partner rail, .m-kpis + .m-stat__* for the five measures, .m-table inside
// .m-tablewrap for all three tables, .m-chip for a result, .m-meter for achievement, .m-seg for the result
// filter and the record mode, .m-btn for every control, and .m-td-nil + one of the three absence kinds
// wherever a cell is empty. The sheet keeps the account sheet's own .ac-scrim/.ac-modal/.ac-box mechanics
// (accounts-crm.ts) so a sheet here opens, moves focus and closes like every other; its body is .m-dlg__b.
//
// MOTION (emil-design-eng). The sheet is the account sheet: 0.96 scale + opacity, 200ms in, 140ms out,
// centred. Achievement bars do not animate: they repaint on every filter change, and a bar that regrows on
// each keystroke is noise. Buttons press to 0.97 through .m-btn. Reduced motion keeps the fade only.
//
// SMOKE LANDMARKS: #partners asserts «غير مهتم», which both the empty state and the loaded tiles carry, and
// «لا شركاء بعد» is the accepted empty render. Neither may be reworded without smoke.py.
//
// NO BACKTICKS ANYWHERE IN THIS FILE, comments included: it is one template literal.

export const PARTNERS_CRM_CSS = `
/* PORTED to the m-* vocabulary (docs/PORT-SPEC.md). Deleted here because the vocabulary carries them:
   the tab rail, the tiles, the three tables and their headers, the pills, the buttons and their press
   and focus treatments, the selects and inputs, the empty and error states, every number and all three
   kinds of absence. What survives is what the vocabulary genuinely lacks — the week stepper, the
   five-tile lead grid, the achievement cell, the result-radio group the keyboard handler keys on, the
   targets sheet's two-column rows, the paste box and its preview. */
.ds6 .pt{display:flex;flex-direction:column;gap:var(--m-4);container-type:inline-size;container-name:ptw}
.ds6 .pt-panel{display:flex;flex-direction:column;gap:var(--m-4)}
.ds6 .pt-bar{display:flex;align-items:center;gap:var(--m-2);flex-wrap:wrap}
/* A filter bar is a row, not a stack: .m-select is authored at inline-size:100% for a form field,
   which is right inside .m-form and wrong beside a week stepper. */
.ds6 .pt-bar .m-select{inline-size:auto;flex:0 1 auto;min-inline-size:176px;max-inline-size:280px}
/* A name that opens its own tab is a BUTTON wearing the link's type. .m-link is authored for an
   anchor, so the button's own chrome has to be taken off here rather than in the vocabulary. */
.ds6 button.m-link{font:inherit;background:none;border:0;padding:0;cursor:pointer;text-align:start}
.ds6 .pt-bar .sp{flex:1}

/* The week stepper: two controls and the range they move. One object, so it is boxed once. */
.ds6 .pt-week{display:inline-flex;align-items:center;gap:4px;background:var(--m-paper);
  border:1px solid var(--m-line);border-radius:var(--m-r-ctl);padding:3px}
.ds6 .pt-week .m-btn{min-block-size:34px;border:0;background:none;padding-inline:var(--m-2)}
.ds6 .pt-week .lbl{font-size:var(--m-t-cap);font-weight:600;color:var(--m-ink);
  padding-inline:var(--m-2);white-space:nowrap}
.ds6 .pt-week .cur{color:var(--m-ac-deep)}
@media (pointer:coarse){.ds6 .pt-week .m-btn{min-block-size:44px}}

/* Five measures read as one sentence, and the first of them leads.
   SPECIFICITY. massar-ds-crm.ts is interpolated AFTER every module stylesheet, so a rule
   that only matches a private class loses to the vocabulary rule it means to override at equal
   weight. Anything overriding an .m-* declaration is written as .m-x.private, one class heavier. */
.ds6 .m-kpis.pt-kpis{grid-template-columns:1.3fr repeat(4,minmax(0,1fr))}
@container ptw (max-width: 900px){.ds6 .m-kpis.pt-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}}
@container ptw (max-width: 560px){.ds6 .m-kpis.pt-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}

.ds6 .pt-tbl .m-table{min-inline-size:880px}
.ds6 .pt-res-tbl .m-table{min-inline-size:720px}
.ds6 .pt-sec .m-card__h{padding-inline:var(--m-5);padding-block:var(--m-4);margin-block-end:0;
  border-block-end:1px solid var(--m-line);align-items:baseline;flex-wrap:wrap;gap:var(--m-3)}
.ds6 .pt-sec .m-card__h .sp{flex:1}
.ds6 .pt-filter{padding-inline:var(--m-5);padding-block:var(--m-3);border-block-end:1px solid var(--m-line)}
.ds6 .pt-sub{display:block;font-weight:400;margin-block-start:2px}
.ds6 .pt-clip{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-inline-size:28ch}
.ds6 .pt-ltr{direction:ltr;unicode-bidi:isolate}

/* achievement: the bar and its figure on one line, inside a table cell */
.ds6 .pt-ach{display:flex;align-items:center;gap:var(--m-2);min-inline-size:0}
.ds6 .pt-ach .m-meter{margin-block:0;flex:1 1 auto;min-inline-size:56px}
.ds6 .pt-ach.hi .m-meter i{background:var(--m-ok)}
.ds6 .pt-ach.lo .m-meter i{background:var(--m-warn)}

/* the result cell: a pill, then either where it went or the control that changes it */
.ds6 .pt-rs{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-inline-size:0}
.ds6 .pt-rs .m-select{min-block-size:36px;font-size:var(--m-t-cap);padding-inline:var(--m-2)}
.ds6 .pt-arm{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:var(--m-t-cap);color:var(--m-ink)}
.ds6 .pt-arm .m-btn{min-block-size:32px;padding-inline:var(--m-3);font-size:var(--m-t-cap)}
.ds6 .m-btn.pt-del--armed{background:var(--m-bad-dim);color:var(--m-bad);border-color:var(--m-bad-line)}

/* a radio group, because the three results are one exclusive choice and the keyboard handler
   walks it with the arrow keys. .m-seg is aria-pressed and cannot carry that contract. */
.ds6 .pt-radio{display:flex;gap:6px;flex-wrap:wrap}
.ds6 .pt-radio button{font:inherit;font-size:var(--m-t-body);font-weight:600;min-block-size:40px;
  padding-inline:var(--m-4);border-radius:var(--m-r-chip);border:1px solid var(--m-line-2);
  cursor:pointer;background:var(--m-paper);color:var(--m-ink);
  transition:background-color var(--m-out) var(--m-ease),transform var(--m-press) var(--m-ease)}
.ds6 .pt-radio button:active{transform:scale(.97)}
.ds6 .pt-radio button[aria-checked="true"]{background:var(--m-ac);color:#fff;border-color:var(--m-ac)}
.ds6 .pt-radio button:focus-visible{outline:none;box-shadow:var(--m-focus)}
.ds6 .pt-radio.bad button{border-color:var(--m-bad)}

/* the targets sheet: one row per product, the number at a fixed width so the column reads */
.ds6 .pt-tg{display:flex;flex-direction:column}
.ds6 .pt-tg .row{display:grid;grid-template-columns:minmax(0,1fr) 128px;gap:var(--m-3);
  align-items:center;padding-block:var(--m-2);border-block-end:1px solid var(--m-line)}
.ds6 .pt-tg .row:last-child{border-block-end:0}
.ds6 .pt-tg .row label{font-size:var(--m-t-body);color:var(--m-ink)}
.ds6 .pt-tg .row .m-input{text-align:center;font-variant-numeric:tabular-nums}

.ds6 .pt-paste{inline-size:100%;min-block-size:160px;font:inherit;font-size:var(--m-t-body);
  line-height:1.7;padding:var(--m-2) var(--m-3);border:1px solid var(--m-line-2);
  border-radius:var(--m-r-ctl);background:var(--m-paper);color:var(--m-ink);resize:vertical;
  box-sizing:border-box}
.ds6 .pt-paste:focus{outline:none;box-shadow:var(--m-focus)}
.ds6 .pt-prev{display:flex;flex-direction:column;gap:4px;font-size:var(--m-t-cap)}
.ds6 .pt-prev .ok{color:var(--m-ac-deep);font-weight:600}
.ds6 .pt-prev .bad{color:var(--m-bad)}

/* the screen-reader-only label, for a control whose name is carried by its row */
.ds6 .pt-say{position:absolute;inline-size:1px;block-size:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

@container ptw (max-width: 900px){
  .ds6 .pt-tbl .m-table, .ds6 .pt-res-tbl .m-table{min-inline-size:640px}
}
@media (prefers-reduced-motion: reduce){
  .ds6 .pt-radio button{transition:none}
  .ds6 .pt-radio button:active{transform:none}
}
`;

export const PARTNERS_CRM_JS = `
/* ================= «شركاء المبيعات» ================= */
var ptData = null, ptLoading = false, ptFailed = false, ptWeek = "", ptPendingWeek = null, ptWant = "";
var ptF = { tab: "all", product: "", res: "all" };
var ptSheet = null;        /* the open sheet: partner form, targets, or results */
var ptArm = {};            /* result id -> "del" | "interest" while a destructive or handing-over change waits for its second press */
var ptBusy = {};           /* result id -> true while a change is being written */

/* PLAIN text, for a toast: opToast writes with textContent, so markup would print as markup.
   The MARKED variants below carry .m-n and are the ones the screen prints. */
function ptPl(n, one, two, few, many) { return pluralizeArabic(n, one, two, few, many, fmtN); }
function ptNOrg(n) { return ptPl(n, "منشأة واحدة", "منشأتان", "منشآت", "منشأة"); }
function ptNRes(n) { return ptPl(n, "نتيجة واحدة", "نتيجتان", "نتائج", "نتيجة"); }
function ptNPartner(n) { return ptPl(n, "شريك واحد", "شريكان", "شركاء", "شريكًا"); }
function ptNOrgN(n) { return mPlOf(n, ptNOrg(n)); }
function ptNResN(n) { return mPlOf(n, ptNRes(n)); }
function ptNPartnerN(n) { return mPlOf(n, ptNPartner(n)); }
function ptIco(n) { return typeof opIco === "function" ? opIco(n) : ""; }
function ptToast(m, bad, act, fn) { if (typeof opToast === "function") opToast(m, bad, act, fn); else alertBar(m, bad); }
function ptDay(iso) { return typeof owDay === "function" ? owDay(iso) : esc(iso); }
function ptWeekLabel(start, end) {
  var a = new Date(start + "T00:00:00"), b = new Date(end + "T00:00:00");
  var fmt = function (d, o) { return d.toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", o); };
  var sameMonth = a.getMonth() === b.getMonth();
  return (sameMonth ? fmt(a, { day: "numeric" }) : fmt(a, { day: "numeric", month: "long" })) + " – " + fmt(b, { day: "numeric", month: "long" }) +
    (b.getFullYear() !== new Date().getFullYear() ? " " + b.getFullYear() : "");
}
/* The same label with its DIGITS marked. The whole phrase cannot go inside .m-n — it sets
   direction:ltr, and «8 – 14 سبتمبر» would then read left-to-right with the Arabic month
   stranded. The dates are formatted nu-latn, so each run of digits is wrapped where it stands. */
function ptWeekLabelN(start, end) {
  return esc(ptWeekLabel(start, end)).replace(/[0-9]+/g, function (d) {
    return '<span class="m-n">' + d + "</span>";
  });
}
/* Every product the week can show: the live catalogue, then any archived one this week's targets or results still name. */
function ptAllProducts() { return ptData ? ptData.products.concat(ptData.archivedProducts || []) : []; }
function ptIsArchived(p) { return !!ptData && (ptData.archivedProducts || []).indexOf(p) >= 0; }
function ptPhone(ph) { return '<bdi class="pt-ltr">' + (String(ph).charAt(0) === "0" ? "" : "+") + esc(ph) + "</bdi>"; }
function ptPartner(id) { return ((ptData && ptData.partners) || []).filter(function (p) { return String(p.id) === String(id); })[0] || null; }

var ptRoute0 = "";
window.addEventListener("hashchange", function () {
  var r = (location.hash || "").slice(1);
  if (r === ptRoute0) return;
  ptRoute0 = r; ptSheet = null; ptArm = {};
  if (r === "partners") ptLoad(ptWeek, true);
});
function ptLoad(week, force) {
  /* Only a deliberate request waits its turn: the repaint that follows a week change calls this with the week
     still on screen, and queueing that one sent the screen straight back to it. */
  if (ptLoading) { if (force) ptPendingWeek = week || ""; return; }
  if (ptData && !force && week === ptWeek) return;
  if (ptFailed && !force) return;
  ptLoading = true;
  pxGet("/admin/partners" + (week ? "?week=" + encodeURIComponent(week) : "")).then(function (j) { ptData = j; ptWeek = j.week; ptFailed = false; })
    .catch(function () { ptFailed = true; })
    .then(function () {
      ptLoading = false;
      if (ptPendingWeek !== null) { var w = ptPendingWeek; ptPendingWeek = null; ptLoad(w, true); return; }
      if (ptF.tab !== "all" && !ptPartner(ptF.tab)) ptF.tab = "all";
      render(false);
    });
}

/* ---------------- the numbers ---------------- */
function ptTargetsFor(pid, product) {
  return (ptData.targets || []).filter(function (t) { return (pid === "all" || String(t.partnerId) === String(pid)) && (!product || t.product === product); });
}
function ptResultsFor(pid, product) {
  return (ptData.results || []).filter(function (r) { return (pid === "all" || String(r.partnerId) === String(pid)) && (!product || r.product === product); });
}
/* A week with no target has no achievement to report. That is a number someone OWES — the target —
   so it takes the owed treatment, not a dash that reads like a legitimate zero. */
function ptAch(line) {
  if (line.pct === null) return '<span class="pt-ach">' + mNil("بلا مستهدف", "owed") + "</span>";
  var cls = line.pct >= 100 ? " hi" : line.pct < 50 ? " lo" : "";
  return '<span class="pt-ach' + cls + '" role="img" aria-label="' + esc("الإنجاز " + fmtN(line.pct) + "٪") + '">' +
    '<span class="m-meter"><i style="--m-pct:' + Math.min(100, line.pct) + '%"></i></span>' +
    mPct(line.pct) + "</span>";
}
/* A share over nothing is UNMEASURED, not zero: a legitimate nothing, so it takes the quiet
   treatment rather than the owed one. */
function ptShare(n, of) { return of > 0 ? mPct(Math.round((n / of) * 100)) + " من المتواصل معهم" : mNil("لم يُقَس", "none"); }

/* The five measures. «تم التواصل» and «مهتمون» are each printed twice — in this strip and in the
   table under it — so both go through dsD/dsFig and cannot drift (PORT-SPEC §6). */
function ptBind(pid, product) {
  dsD("ptContacted", function () {
    return summarizeWeek(ptTargetsFor(pid, product), ptResultsFor(pid, product)).contacted;
  });
  dsD("ptInterested", function () {
    return summarizeWeek(ptTargetsFor(pid, product), ptResultsFor(pid, product)).interested;
  });
}
function ptKpis(line) {
  /* BLOCK children, not spans: .m-stat__k/__v/__s carry type and colour, never layout. */
  var tile = function (k, v, s, lead) {
    return '<div class="m-card' + (lead ? " m-stat--ac" : "") + '"><div class="m-stat__k">' + k + "</div>" +
      '<div class="m-stat__v">' + v + "</div>" +
      '<div class="m-stat__s">' + s + "</div></div>";
  };
  return '<div class="m-kpis pt-kpis">' +
    tile("المستهدف الأسبوعي", line.target ? mN(line.target) : mNil("لم يُحدَّد", "owed"),
      line.target ? "منشآت مطلوب التواصل معها" : "لا مستهدف مسجّل لهذا الأسبوع", true) +
    tile("تم التواصل", dsFig("ptContacted", line.contacted),
      (line.pct === null ? "لا مستهدف يُقاس عليه" : mPct(line.pct) + " من المستهدف") +
      (line.pct !== null && line.contactedTargeted !== line.contacted
        ? " · لمنتجات لها مستهدف: " + mN(line.contactedTargeted) : "")) +
    tile("مهتمون", dsFig("ptInterested", line.interested),
      line.interested
        ? ptShare(line.interested, line.contacted) + " · حُوّل للمبيعات: " + mN(line.handedOver)
        : "لم يُسجَّل مهتم بعد") +
    tile("غير مهتمين", mN(line.notInterested), ptShare(line.notInterested, line.contacted)) +
    tile("لم يردوا", mN(line.noReply), ptShare(line.noReply, line.contacted)) + "</div>";
}

/* ---------------- the screen ---------------- */
function ptPaintCrumb() {
  var act = document.getElementById("crumbact");
  if (!act || (location.hash || "").slice(1) !== "partners") return;
  if (document.getElementById("ptnewtop")) return;
  if (typeof meCan === "function" && !meCan("partners.manage")) return;
  act.innerHTML = '<button class="btn btn-teal ac-newtop" id="ptnewtop" data-pt="newpartner">' + ptIco("plus") + '<span class="lg">إضافة شريك</span><span class="sm">شريك</span></button>';
}
function vPartners() {
  ptLoad(ptWeek, false);
  setTimeout(ptPaintCrumb, 0);
  var h = '<div class="ds6"><div class="pt">';
  if (!ptData && !ptFailed) {
    return h + '<section class="m-card" aria-busy="true"><p class="m-meta" role="status">جارٍ تحميل الشركاء…</p>' +
      moSkeleton(3, ["w40", "w80", "w60"]) + "</section></div></div>" + ptModal();
  }
  if (!ptData) {
    return h + '<div class="m-alert" role="alert">' + ptIco("warn") +
      '<span class="m-alert__d">تعذّر تحميل الشركاء.</span>' +
      '<button class="m-btn" data-pt="retry">أعد المحاولة</button></div></div></div>' + ptModal();
  }
  if (ptFailed) {
    h += '<div class="m-alert" role="alert">' + ptIco("warn") +
      '<span class="m-alert__d">تعذّر التحديث — المعروض آخر نسخة محمّلة.</span>' +
      '<button class="m-btn" data-pt="retry">أعد المحاولة</button></div>';
  }
  var d = ptData;
  if (!d.partners.length) {
    /* SMOKE: «لا شركاء بعد» is the accepted empty render for #partners, and the paragraph below
       carries «غير مهتم», the route's landmark. Neither may be reworded without smoke.py. */
    return h + '<section class="m-card m-empty"><p class="m-empty__t">لا شركاء بعد</p>' +
      '<p class="m-empty__d">الشريك شركة متعاقدة للتواصل الأولي مع عملاء منتج، بمستهدف أسبوعي لكل منتج ونتيجة مسجّلة لكل تواصل: مهتم، غير مهتم، لم يرد؛ وتُحوَّل كل نتيجة «مهتم» إلى فرصة بيع لفريق المبيعات.</p>' +
      (typeof meCan !== "function" || meCan("partners.manage")
        ? '<div class="m-empty__a"><button class="m-btn m-btn--primary" id="ptnewempty" data-pt="newpartner">' + ptIco("plus") + "إضافة شريك</button></div>"
        : "") + "</section></div></div>" + ptModal();
  }
  var isCur = d.week === d.currentWeek;
  h += '<div class="pt-bar"><span class="pt-week" role="group" aria-label="الأسبوع">' +
    '<button class="m-btn" data-pt="week" data-v="-7" aria-label="الأسبوع السابق">&#8250;</button>' +
    '<span class="lbl" aria-live="polite">' + (isCur ? '<span class="cur">الأسبوع الحالي</span> · ' : "") +
      ptWeekLabelN(d.week, d.weekEnd) + (ptLoading ? " …" : "") + "</span>" +
    '<button class="m-btn" data-pt="week" data-v="7" aria-label="الأسبوع التالي"' + (d.week >= d.currentWeek ? " disabled" : "") + ">&#8249;</button></span>" +
    (isCur ? "" : '<button class="m-btn m-btn--quiet" data-pt="thisweek">العودة إلى هذا الأسبوع</button>') +
    '<span class="sp"></span><select class="m-select" aria-label="المنتج" data-ptset="product"><option value="">كل المنتجات</option>' +
    ptAllProducts().map(function (p) { return '<option value="' + esc(p) + '"' + (ptF.product === p ? " selected" : "") + ">" + esc(p) + (ptIsArchived(p) ? " (مؤرشف)" : "") + "</option>"; }).join("") + "</select></div>";
  h += '<div class="m-tabs" role="tablist" aria-label="الشركاء">' +
    [{ id: "all", name: "الإجمالي" }].concat(d.partners).map(function (p) {
      var on = String(ptF.tab) === String(p.id);
      return '<button class="m-tab" role="tab" id="pttab_' + p.id + '" aria-selected="' + on + '" tabindex="' + (on ? 0 : -1) + '" data-pt="tab" data-v="' + p.id + '">' + esc(p.name) +
        (p.status === "paused" ? '<span class="m-chip m-chip--plain">موقوف</span>' : "") + "</button>";
    }).join("") + "</div>";
  var pid = ptF.tab;
  ptBind(pid, ptF.product);
  var line = summarizeWeek(ptTargetsFor(pid, ptF.product), ptResultsFor(pid, ptF.product));
  h += '<div role="tabpanel" aria-labelledby="pttab_' + pid + '" class="pt-panel">';
  var partner = pid === "all" ? null : ptPartner(pid);
  if (partner) h += ptPartnerCard(partner);
  h += ptKpis(line);
  h += '<p class="m-meta">' + ptIco("check") + "تنتهي مسؤولية الشريك عند تحديد الاهتمام: كل «مهتم» يُحوَّل تلقائيًا فرصة بيع لفريق المبيعات، ولا يعدّله الشريك بعدها.</p>";
  h += ptProductTable(pid);
  h += partner ? ptResultsTable(partner) : ptPartnerTable();
  return h + "</div></div></div>" + ptModal();
}
function ptPartnerCard(p) {
  var meta = [esc(PARTNER_KIND_LABELS[p.kind] || p.kind), p.contactName ? "المسؤول: " + esc(p.contactName) : "", p.phone ? ptPhone(p.phone) : "",
    p.email ? '<a class="m-link" href="mailto:' + esc(p.email) + '" dir="ltr">' + esc(p.email) + "</a>" : "",
    p.opps.count ? "فرص منه: " + mN(p.opps.count) + " (قائمة " + mN(p.opps.open) + " · رابحة " + mN(p.opps.won) + ")" : ""].filter(Boolean);
  var h = '<section class="m-card"><div class="m-between" style="flex-wrap:wrap">' +
    '<div style="min-inline-size:0"><h2 class="m-h2">' + esc(p.name) +
      ' <span class="m-chip' + (p.status === "active" ? " m-chip--ok" : " m-chip--bad") + '">' + esc(PARTNER_STATUS_LABELS[p.status]) + "</span></h2>" +
    '<p class="m-meta">' + meta.join(" · ") + "</p>" +
    (p.opps.wonValue || p.opps.openValue
      ? '<p class="m-meta">قيمة الفرص الرابحة: ' + acMoney(p.opps.wonValue) + " · القائمة: " + acMoney(p.opps.openValue) + "</p>"
      : '<p class="m-meta">' + mNil("لا فرص بعد", "none") + "</p>") + "</div>" +
    '<div class="m-head__a">' + (p.status === "active" ? '<button class="m-btn m-btn--primary" id="ptrecord" data-pt="record">' + ptIco("plus") + "تسجيل نتائج</button>" : "") +
    (typeof meCan !== "function" || meCan("partners.manage") ? '<button class="m-btn" id="pttargets" data-pt="targets">تحديد المستهدف</button><button class="m-btn" id="ptedit" data-pt="editpartner">تعديل</button>' : "") + "</div></div>";
  if (p.status !== "active") h += '<div class="m-alert" style="margin-block-start:var(--m-4)">الشريك موقوف: تُعرض نتائجه ولا تُسجَّل له نتائج جديدة. فعّله من «تعديل».</div>';
  return h + "</section>";
}
function ptProductTable(pid) {
  var prods = ptF.product ? [ptF.product] : ptAllProducts().filter(function (p) { return ptTargetsFor(pid, p).length || ptResultsFor(pid, p).length; });
  var h = '<section class="m-card m-card--pad0 pt-sec pt-tbl"><div class="m-card__h">' +
    '<h2 class="m-card__t">حسب المنتج</h2>' +
    '<span class="m-meta">المنشآت التي تم التواصل معها مقابل المستهدف</span></div>';
  if (!prods.length) {
    return h + '<div class="m-empty"><p class="m-empty__t">لا مستهدفات ولا نتائج في هذا الأسبوع' +
      (pid === "all" ? " لأي شريك" : "") + "</p>" +
      (pid !== "all" && (typeof meCan !== "function" || meCan("partners.manage"))
        ? '<div class="m-empty__a"><button class="m-btn" data-pt="targets">تحديد المستهدف</button></div>' : "") +
      "</div></section>";
  }
  h += '<div class="m-tablewrap"><table class="m-table"><thead><tr><th>المنتج</th>' +
    '<th class="num">المستهدف</th><th class="num">تم التواصل</th><th>الإنجاز</th>' +
    '<th class="num">مهتم</th><th class="num">غير مهتم</th><th class="num">لم يرد</th></tr></thead><tbody>';
  prods.forEach(function (p) {
    var l = summarizeWeek(ptTargetsFor(pid, p), ptResultsFor(pid, p));
    h += '<tr><td class="m-td-n"><span class="pt-clip" title="' + esc(p) + '">' + esc(p) + "</span>" +
      (ptIsArchived(p) ? '<span class="pt-sub m-meta">مؤرشف</span>' : "") + "</td>" +
      '<td class="m-td-v">' + (l.target ? mN(l.target) : mNil("لم يُحدَّد", "owed")) + "</td>" +
      '<td class="m-td-v">' + mN(l.contacted) + "</td>" +
      "<td>" + ptAch(l) + "</td>" +
      '<td class="m-td-v">' + mN(l.interested) + "</td>" +
      '<td class="m-td-v">' + mN(l.notInterested) + "</td>" +
      '<td class="m-td-v">' + mN(l.noReply) + "</td></tr>";
  });
  return h + "</tbody></table></div></section>";
}
function ptPartnerTable() {
  var h = '<section class="m-card m-card--pad0 pt-sec pt-tbl"><div class="m-card__h">' +
    '<h2 class="m-card__t">حسب الشريك</h2>' +
    '<span class="m-meta">' + ptNPartnerN(ptData.partners.length) + " · اختر شريكًا لعرض نتائجه وتسجيلها</span></div>" +
    '<div class="m-tablewrap"><table class="m-table"><thead><tr><th>الشريك</th>' +
    '<th class="num">المستهدف</th><th class="num">تم التواصل</th><th>الإنجاز</th>' +
    '<th class="num">مهتم</th><th class="num">غير مهتم</th><th class="num">لم يرد</th>' +
    "<th>فرص البيع منه</th></tr></thead><tbody>";
  ptData.partners.forEach(function (p) {
    var l = summarizeWeek(ptTargetsFor(p.id, ptF.product), ptResultsFor(p.id, ptF.product));
    h += '<tr data-pt="tab" data-v="' + p.id + '"><td class="m-td-n">' +
      '<button class="m-link" data-pt="tab" data-v="' + p.id + '" title="' + esc(p.name) + '">' + esc(p.name) + "</button>" +
      '<span class="pt-sub m-meta">' + esc(PARTNER_KIND_LABELS[p.kind] || p.kind) + (p.status !== "active" ? " · موقوف" : "") + "</span></td>" +
      '<td class="m-td-v">' + (l.target ? mN(l.target) : mNil("لم يُحدَّد", "owed")) + "</td>" +
      '<td class="m-td-v">' + mN(l.contacted) + "</td>" +
      "<td>" + ptAch(l) + "</td>" +
      '<td class="m-td-v">' + mN(l.interested) + "</td>" +
      '<td class="m-td-v">' + mN(l.notInterested) + "</td>" +
      '<td class="m-td-v">' + mN(l.noReply) + "</td>" +
      "<td>" + (p.opps.count
        ? mN(p.opps.count) + '<span class="pt-sub m-meta">رابحة ' + fmtN(p.opps.won) + "</span>"
        : mNil("لا فرص", "none")) + "</td></tr>";
  });
  return h + "</tbody></table></div></section>";
}
function ptResultsTable(p) {
  var all = ptResultsFor(p.id, ptF.product);
  var rows = ptF.res === "all" ? all : all.filter(function (r) { return r.result === ptF.res; });
  var h = '<section class="m-card m-card--pad0 pt-sec pt-res-tbl"><div class="m-card__h">' +
    '<h2 class="m-card__t">نتائج التواصل</h2>' +
    '<span class="m-meta">' + (all.length ? ptNResN(all.length) + " هذا الأسبوع" : "") + '</span><span class="sp"></span>' +
    (p.status === "active" ? '<button class="m-btn" id="ptrecord2" data-pt="record">' + ptIco("plus") + "تسجيل نتائج</button>" : "") + "</div>";
  if (!all.length) {
    return h + '<div class="m-empty"><p class="m-empty__t">لم تُسجَّل نتائج ' + (ptF.product ? "لهذا المنتج " : "") + "في هذا الأسبوع</p>" +
      '<p class="m-empty__d">تظهر هنا فور تسجيل أول تواصل للشريك في هذا الأسبوع.</p></div></section>';
  }
  var counts = { all: all.length }; PARTNER_RESULTS.forEach(function (k) { counts[k] = all.filter(function (r) { return r.result === k; }).length; });
  h += '<div class="pt-filter"><span class="m-seg" role="group" aria-label="النتيجة">' +
    [["all", "الكل"]].concat(PARTNER_RESULTS.map(function (k) { return [k, PARTNER_RESULT_LABELS[k]]; })).map(function (t) {
      return '<button type="button" aria-pressed="' + (ptF.res === t[0]) + '" data-pt="res" data-v="' + t[0] + '">' + t[1] + " " + mN(counts[t[0]]) + "</button>";
    }).join("") + "</span></div>";
  h += '<div class="m-tablewrap"><table class="m-table"><thead><tr><th>المنشأة</th><th>المنتج</th>' +
    '<th>تاريخ التواصل</th><th>النتيجة</th><th><span class="pt-say">حذف</span></th></tr></thead><tbody>';
  if (!rows.length) {
    h += '<tr class="m-table__empty"><td colspan="5"><div class="m-empty"><p class="m-empty__t">لا نتائج «' +
      esc(PARTNER_RESULT_LABELS[ptF.res] || "") + "» في هذا الأسبوع</p></div></td></tr>";
  }
  rows.forEach(function (r) {
    var name = r.entityId
      ? '<a class="m-link pt-clip" href="#account/' + r.entityId + '" title="' + esc(r.accountName) + '">' + esc(r.accountName) + "</a>"
      : '<span class="pt-clip" title="' + esc(r.accountName) + '">' + esc(r.accountName) + "</span>";
    h += '<tr data-ptrow="' + r.id + '"><td class="m-td-n">' + name +
      '<span class="pt-sub m-meta">' + ptPhone(r.phone) + (r.note ? " · " + esc(clip(r.note, 60)) : "") + "</span></td>" +
      '<td><span class="pt-clip">' + esc(r.product) + "</span></td>" +
      "<td>" + ptDay(r.contactedOn) + "</td>" +
      "<td>" + ptResultCell(r, p) + "</td>" +
      "<td>" + ptDelCell(r) + "</td></tr>";
  });
  return h + "</tbody></table></div></section>";
}
/* The result pill's colour is a CLASSIFICATION of what the contact came to, which is the only
   reason it is allowed to be a colour at all. It maps onto the system's own three status tones
   rather than a fourth palette. */
var PT_RESULT_TONE = { interested: " m-chip--ac", not_interested: " m-chip--bad", no_reply: " m-chip--warn" };
function ptResultCell(r, p) {
  var pill = '<span class="m-chip' + (PT_RESULT_TONE[r.result] || "") + '">' + esc(PARTNER_RESULT_LABELS[r.result] || r.result) + "</span>";
  if (!canChangeResult(r)) {
    var st = r.oppStage && typeof opStage === "function" ? opStage(r.oppStage).label : "";
    var linked = r.oppPartnerId !== r.partnerId;
    /* A partner user is not shown a deal it did not bring (-1 from the server): the fact of the handover only. */
    if (r.oppId === -1 || (typeof meCan === "function" && !meCan("opps.view"))) return '<span class="pt-rs">' + pill + '<span class="m-meta">حُوّل للمبيعات</span></span>';
    return '<span class="pt-rs">' + pill + '<a class="m-link" href="#opps/' + r.oppId + '" title="تُتابَع من «فرص البيع»">' + (linked ? "رُبط بفرصة قائمة" : "حُوّل للمبيعات") + (st ? " · " + esc(st) : "") + "</a></span>";
  }
  if (ptArm[r.id] === "interest") {
    return '<span class="pt-arm" role="group" aria-label="تأكيد التحويل"><span>يُحوَّل فرصة بيع ولا يُعدَّل بعدها.</span><button class="m-btn m-btn--primary" id="ptok' + r.id + '" data-pt="confirminterest" data-i="' + r.id + '"' + (ptBusy[r.id] ? " disabled" : "") + '>تأكيد «مهتم»</button><button class="m-btn" data-pt="cancelarm" data-i="' + r.id + '">تراجع</button></span>';
  }
  if (p.status !== "active") return '<span class="pt-rs">' + pill + "</span>";
  return '<span class="pt-rs"><label class="pt-say" for="ptsel' + r.id + '">نتيجة ' + esc(r.accountName) + '</label><select class="m-select" id="ptsel' + r.id + '" data-ptres="' + r.id + '"' + (ptBusy[r.id] ? " disabled" : "") + ">" +
    PARTNER_RESULTS.map(function (k) { return '<option value="' + k + '"' + (r.result === k ? " selected" : "") + ">" + PARTNER_RESULT_LABELS[k] + "</option>"; }).join("") + "</select></span>";
}
function ptDelCell(r) {
  var pp = ptPartner(r.partnerId);
  if (pp && pp.status !== "active") return "";
  if (!canChangeResult(r)) return '<button class="m-btn m-btn--icon" disabled aria-label="لا تُحذف نتيجة حُوّلت للمبيعات" title="لا تُحذف نتيجة حُوّلت للمبيعات">' + ptIco("x") + "</button>";
  if (ptArm[r.id] === "del") return '<button class="m-btn pt-del--armed" id="ptdel' + r.id + '" data-pt="del" data-i="' + r.id + '">احذف</button>';
  return '<button class="m-btn m-btn--icon" id="ptdel' + r.id + '" data-pt="del" data-i="' + r.id + '" aria-label="حذف نتيجة ' + esc(r.accountName) + '">' + ptIco("x") + "</button>";
}

/* ---------------- result changes ---------------- */
function ptResultById(id) { return ((ptData && ptData.results) || []).filter(function (r) { return r.id === id; })[0] || null; }
function ptPatchResult(id, result) {
  var r = ptResultById(id); if (!r) return;
  ptBusy[id] = true; render(false);
  cfJson("PATCH", "/admin/partner-results/" + id, { result: result, note: r.note || "", ifUpdatedAt: r.updatedAt }).then(function (x) {
    delete ptBusy[id]; delete ptArm[id];
    if (!x.ok) {
      ptToast(x.j.detail || "تعذّر الحفظ (" + fmtN(x.status) + ")", true);
      ptLoad(ptWeek, true); return;
    }
    var fresh = x.j.result;
    ptData.results = ptData.results.map(function (y) { return y.id === id ? fresh : y; });
    if (x.j.oppId) ptToast("حُوّل «" + r.accountName + "» لفريق المبيعات" + (x.j.oppCreated ? " — فُتحت فرصة بيع" : " — رُبط بفرصته القائمة"), false, "افتح الفرصة", function () { location.hash = "opps/" + x.j.oppId; });
    else ptToast("حُفظت النتيجة: " + PARTNER_RESULT_LABELS[result], false);
    render(false);
    var sel = document.getElementById("ptsel" + id); if (sel) sel.focus();
    if (x.j.oppId) ptLoad(ptWeek, true);
  }).catch(function () { delete ptBusy[id]; ptToast("تعذّر الاتصال — لم يُحفظ شيء.", true); render(false); });
}
function ptDelete(id) {
  var r = ptResultById(id); if (!r) return;
  ptBusy[id] = true;
  cfJson("DELETE", "/admin/partner-results/" + id).then(function (x) {
    delete ptBusy[id]; delete ptArm[id];
    if (!x.ok && x.status !== 404) { ptToast(x.j.detail || "تعذّر الحذف", true); render(false); return; }
    var idx = ptData.results.indexOf(r);
    ptData.results = ptData.results.filter(function (y) { return y.id !== id; });
    ptToast("حُذفت نتيجة «" + r.accountName + "»", false);
    render(false);
    /* Focus goes to the row that took its place, or to the record button when the list emptied. */
    var next = ptData.results.filter(function (y) { return String(y.partnerId) === String(r.partnerId); })[Math.max(0, idx - 1)];
    var t = next && document.getElementById("ptdel" + next.id) || document.getElementById("ptrecord2") || document.getElementById("ptrecord");
    if (t) t.focus();
  }).catch(function () { delete ptBusy[id]; ptToast("تعذّر الاتصال — لم يُحذف شيء.", true); render(false); });
}

/* ---------------- sheets ---------------- */
function ptOpen(kind, from) {
  var p = ptF.tab === "all" ? null : ptPartner(ptF.tab);
  if (kind === "partner") {
    ptSheet = { kind: "partner", mode: "new", from: from, d: { name: "", kind: "sales", contactName: "", phone: "", email: "", note: "", status: "active" }, focus: "ptf_name" };
  } else if (kind === "editpartner" && p) {
    ptSheet = { kind: "partner", mode: "edit", id: p.id, updatedAt: p.updatedAt, from: from,
      d: { name: p.name, kind: p.kind, contactName: p.contactName || "", phone: p.phone || "", email: p.email || "", note: p.note || "", status: p.status }, focus: "ptf_name" };
  } else if (kind === "targets" && p) {
    var cur = {}; ptTargetsFor(p.id, "").forEach(function (t) { cur[t.product] = String(t.target); });
    /* An archived product appears only while this partner still has a target on it, so it can be cleared. */
    var rowsT = ptData.products.concat((ptData.archivedProducts || []).filter(function (x) { return cur[x]; }));
    ptSheet = { kind: "targets", id: p.id, name: p.name, week: ptData.week, weekEnd: ptData.weekEnd, from: from, d: cur, rows: rowsT, focus: "ptt_0" };
  } else if (kind === "record" && p) {
    ptSheet = { kind: "record", id: p.id, name: p.name, from: from, mode: "one",
      d: { product: ptF.product || (ptData.products.length === 1 ? ptData.products[0] : ""), accountName: "", phone: "", result: "", contactedOn: ptData.today < ptData.weekEnd ? ptData.today : ptData.weekEnd, note: "" },
      paste: "", focus: "ptr_product" };
  } else return;
  ptSheet.err = ""; ptSheet.field = ""; ptSheet.busy = false; ptSheet.dirty = false; ptSheet.shown = false; ptSheet.confirm = false;
  render(false);
}
function ptClose(force) {
  if (!ptSheet) return;
  if (ptSheet.dirty && !force) { ptSheet.confirm = true; render(false); var k = document.getElementById("ptkeep"); if (k) k.focus(); return; }
  var from = ptSheet.from;
  document.querySelectorAll(".ac-scrim, .ac-box").forEach(function (el) { el.classList.remove("in"); });
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  setTimeout(function () { ptSheet = null; render(false); var t = from && document.getElementById(from); if (t) t.focus(); }, reduce ? 0 : 150);
}
function ptFld(f) { return ptSheet && ptSheet.field === f ? ' aria-invalid="true" aria-describedby="err_pt_' + f.replace(/\\./g, "_") + '"' : ""; }
function ptErr(f) { return ptSheet && ptSheet.field === f && ptSheet.err ? '<span class="m-err" id="err_pt_' + f.replace(/\\./g, "_") + '" role="alert">' + ptIco("warn") + esc(ptSheet.err) + "</span>" : ""; }
function ptInp(id, label, key, value, opt) {
  opt = opt || {};
  return '<div class="m-field"><label class="m-label' + (opt.req ? " m-req" : "") + '" for="' + id + '">' + label + "</label>" +
    '<input class="m-input" id="' + id + '" data-ptfld="' + key + '" value="' + esc(value || "") + '"' + (opt.max ? ' maxlength="' + opt.max + '"' : "") + (opt.ph ? ' placeholder="' + esc(opt.ph) + '"' : "") +
    (opt.type ? ' type="' + opt.type + '"' : "") + (opt.ltr ? ' dir="ltr"' : "") + (opt.req ? ' aria-required="true"' : "") + (opt.extra || "") + ptFld(key) + ">" +
    (opt.hint ? '<span class="m-hint">' + opt.hint + "</span>" : "") + ptErr(key) + "</div>";
}
function ptModal() {
  if (!ptSheet) return "";
  var s = ptSheet, cls = s.shown ? " in" : "";
  var title = s.kind === "partner" ? (s.mode === "edit" ? "تعديل الشريك" : "إضافة شريك") : s.kind === "targets" ? "المستهدف الأسبوعي — " + s.name : "تسجيل نتائج التواصل — " + s.name;
  var sub = s.kind === "partner" ? "الشريك شركة متعاقدة تتولى التواصل الأولي مع العملاء." :
    s.kind === "targets" ? "عدد المنشآت التي يتواصل معها الشريك لكل منتج في أسبوع " + ptWeekLabelN(s.week, s.weekEnd) + ". اترك الحقل فارغًا لمنتج بلا مستهدف." :
    "كل «مهتم» يُحوَّل فرصة بيع لفريق المبيعات فور الحفظ، ويُضاف العميل بحالة «مقترح» إن لم يكن مسجّلًا.";
  var h = '<div class="ds6"><div class="ac-scrim' + cls + '" data-pt="close"></div><div class="ac-modal"><div class="ac-box' + cls + '" role="dialog" aria-modal="true" aria-labelledby="ptmt" aria-describedby="ptms">' +
    '<div class="m-dlg__h"><div><h2 class="m-dlg__t" id="ptmt">' + esc(title) + '</h2><p class="m-meta" id="ptms">' + sub + '</p></div>' +
    '<button type="button" class="m-x" data-pt="close" aria-label="إغلاق">&#215;</button></div><div class="m-dlg__b">';
  if (s.kind === "partner") h += ptPartnerForm(s);
  else if (s.kind === "targets") h += ptTargetsForm(s);
  else h += ptRecordForm(s);
  h += '</div><div class="m-dlg__f">';
  if (s.confirm) {
    h += '<span class="m-err" role="alert">لديك تغييرات لم تُحفظ.</span><button class="m-btn" id="ptkeep" data-pt="keep">متابعة</button><button class="m-btn" data-pt="discard">تجاهل التغييرات</button>';
  } else {
    var label = s.kind === "partner" ? (s.mode === "edit" ? "حفظ التعديلات" : "إضافة الشريك") : s.kind === "targets" ? "حفظ المستهدف" :
      s.mode === "paste" ? (ptPastePreview(s).ok.length ? "تسجيل " + ptPl(ptPastePreview(s).ok.length, "نتيجة واحدة", "نتيجتين", "نتائج", "نتيجة") : "تسجيل القائمة") : "تسجيل النتيجة";
    h += '<button class="m-btn m-btn--primary" id="ptsave" data-pt="save"' + (s.busy ? ' disabled aria-busy="true"' : "") + ">" + (s.busy ? "جارٍ الحفظ…" : esc(label)) + "</button>" +
      '<button class="m-btn" data-pt="close">إلغاء</button>' + (s.err && !ptFieldTarget(s.field) ? '<span class="m-err" role="alert">' + ptIco("warn") + esc(s.err) + "</span>" : "");
  }
  return h + "</div></div></div></div>";
}
function ptPartnerForm(s) {
  var d = s.d;
  var h = '<div class="m-form">' + ptInp("ptf_name", "اسم الشريك", "name", d.name, { req: true, max: PARTNER_NAME_MAX, ph: "مثال: شركة إجادة" }) +
    '<div class="m-field"><span class="m-label m-req" id="ptf_kind_l">نوع الشريك</span><span class="pt-radio' + (s.field === "kind" ? " bad" : "") + '" role="radiogroup" aria-labelledby="ptf_kind_l" id="ptf_kind">' +
    PARTNER_KINDS.map(function (k) { return '<button role="radio" aria-checked="' + (d.kind === k) + '" data-pt="kind" data-v="' + k + '">' + PARTNER_KIND_LABELS[k] + "</button>"; }).join("") + "</span>" + ptErr("kind") + "</div>";
  h += ptInp("ptf_contact", "اسم المسؤول لدى الشريك", "contactName", d.contactName, { max: PARTNER_CONTACT_MAX }) +
    ptInp("ptf_phone", "الهاتف", "phone", d.phone, { ltr: true, type: "tel" });
  h += ptInp("ptf_email", "البريد الإلكتروني", "email", d.email, { ltr: true, type: "email", max: PARTNER_EMAIL_MAX }) +
    ptInp("ptf_note", "ملاحظة", "note", d.note, { max: PARTNER_NOTE_MAX, ph: "مثال: متعاقد حتى نهاية السنة" });
  if (s.mode === "edit") {
    h += '<div class="m-field full"><span class="m-label" id="ptf_status_l">الحالة</span><span class="pt-radio" role="radiogroup" aria-labelledby="ptf_status_l">' +
      PARTNER_STATUSES.map(function (k) { return '<button role="radio" aria-checked="' + (d.status === k) + '" data-pt="status" data-v="' + k + '">' + PARTNER_STATUS_LABELS[k] + "</button>"; }).join("") +
      '</span><span class="m-hint">الشريك الموقوف تبقى نتائجه، ولا تُسجَّل له نتائج جديدة.</span></div>';
  }
  return h + "</div>";
}
function ptTargetsForm(s) {
  var h = '<div><button class="m-btn" id="ptcopyprev" data-pt="copyprev"' + (s.copying ? " disabled" : "") + ">" + (s.copying ? "جارٍ النسخ…" : "انسخ مستهدف الأسبوع السابق") + "</button></div>";
  if (s.field === "targets" && s.err) h += '<div class="m-err" role="alert">' + ptIco("warn") + esc(s.err) + "</div>";
  h += '<div class="pt-tg">';
  s.rows.forEach(function (p, i) {
    var bad = s.field === "targets." + i;
    h += '<div class="row"><label for="ptt_' + i + '">' + esc(p) + (ptIsArchived(p) ? ' <span class="m-meta">مؤرشف — مسح مستهدفه فقط</span>' : "") + '</label>' + mNum({ id: "ptt_" + i, value: s.d[p] || "", label: p, min: 0, max: PARTNER_TARGET_MAX, step: 1, mode: "numeric",
        attrs: ' data-pttg="' + esc(p) + '" placeholder="بلا مستهدف"' + (bad ? ' aria-invalid="true" aria-describedby="err_pt_tg"' : "") }) + "</div>" + (bad ? '<span class="m-err" id="err_pt_tg" role="alert">' + ptIco("warn") + esc(s.err) + "</span>" : "");
  });
  return h + "</div>";
}
function ptPastePreview(s) {
  var lines = splitPasteLines(s.paste);
  var ok = [], bad = [];
  var seen = {};
  lines.forEach(function (l) {
    var c = checkResult({ product: s.d.product, accountName: l.accountName, phone: l.phone, result: l.result, contactedOn: s.d.contactedOn, note: l.note }, ptData.products, ptData.today);
    if (!c.ok) { bad.push({ line: l.line, reason: c.reason, field: c.field }); return; }
    /* The same customer twice in one list is refused by the server; the preview says so first. The last nine
       digits are the mobile number whatever prefix it was typed with. */
    var key = c.value.phone.slice(-9);
    if (seen[key]) { bad.push({ line: l.line, reason: "المنشأة مكررة — سبق ذكر رقمها في السطر " + fmtN(seen[key]), field: "phone" }); return; }
    seen[key] = l.line;
    ok.push({ line: l.line, value: c.value });
  });
  return { ok: ok, bad: bad };
}
function ptRecordForm(s) {
  var d = s.d;
  var h = '<span class="m-seg" role="group" aria-label="طريقة التسجيل">' +
    '<button type="button" aria-pressed="' + (s.mode === "one") + '" data-pt="mode" data-v="one">نتيجة واحدة</button>' +
    '<button type="button" aria-pressed="' + (s.mode === "paste") + '" data-pt="mode" data-v="paste">لصق قائمة</button></span>';
  h += '<div class="m-form"><div class="m-field"><label class="m-label m-req" for="ptr_product">المنتج</label><select class="m-select" id="ptr_product" data-ptfld="product"' + ptFld("product") + '><option value="">— اختر المنتج —</option>' +
    ptData.products.map(function (p) { return '<option value="' + esc(p) + '"' + (d.product === p ? " selected" : "") + ">" + esc(p) + "</option>"; }).join("") + "</select>" + ptErr("product") + "</div>" +
    ptInp("ptr_date", "تاريخ التواصل", "contactedOn", d.contactedOn, { req: true, type: "date", extra: ' max="' + ptData.today + '"' }) + "</div>";
  if (s.mode === "one") {
    h += '<div class="m-form">' + ptInp("ptr_name", "اسم المنشأة", "accountName", d.accountName, { req: true, max: RESULT_NAME_MAX, ph: "مثال: مستشفى الأمل" }) +
      ptInp("ptr_phone", "جوال المنشأة", "phone", d.phone, { req: true, ltr: true, type: "tel", ph: "05xxxxxxxx", hint: "به يرتبط العميل بحسابه وفرصه" }) + "</div>";
    h += '<div class="m-field"><span class="m-label m-req" id="ptr_result_l">النتيجة</span><span class="pt-radio' + (s.field === "result" ? " bad" : "") + '" role="radiogroup" aria-labelledby="ptr_result_l" id="ptr_result">' +
      PARTNER_RESULTS.map(function (k, i) { return '<button role="radio" aria-checked="' + (d.result === k) + '" tabindex="' + (d.result === k || (!d.result && i === 0) ? 0 : -1) + '" data-pt="result" data-v="' + k + '">' + PARTNER_RESULT_LABELS[k] + "</button>"; }).join("") + "</span>" +
      (d.result === "interested" ? '<span class="m-hint">يصبح فرصة بيع لفريق المبيعات فور الحفظ.</span>' : "") + ptErr("result") + "</div>";
    h += ptInp("ptr_note", "ملاحظة", "note", d.note, { max: RESULT_NOTE_MAX });
  } else {
    h += '<div class="m-field"><label class="m-label m-req" for="ptr_paste">القائمة</label><textarea class="pt-paste" id="ptr_paste" data-ptfld="paste" dir="auto" placeholder="مستشفى الأمل، 0551234567، مهتم&#10;عيادة النور، 0559876543، لم يرد، اتصلنا مرتين">' + esc(s.paste) + "</textarea>" +
      '<span class="m-hint">يُقبل النسخ من جدول بسطر لكل منشأة: الاسم، الجوال، النتيجة (مهتم/غير مهتم/لم يرد)، ثم ملاحظة اختيارية.</span>' + ptErr("paste") + "</div>";
    var pv = ptPastePreview(s);
    if (s.paste.trim()) {
      var hot = pv.ok.filter(function (x) { return x.value.result === "interested"; }).length;
      h += '<div class="pt-prev" aria-live="polite"><span class="ok">' +
        (pv.ok.length ? mPlOf(pv.ok.length, ptPl(pv.ok.length, "نتيجة واحدة جاهزة", "نتيجتان جاهزتان", "نتائج جاهزة", "نتيجة جاهزة")) : "لا نتيجة جاهزة") +
        " للتسجيل" + (hot ? " · مهتمون يُحوَّلون للمبيعات: " + mN(hot) : "") + "</span>" +
        pv.bad.slice(0, 8).map(function (b) { return '<span class="bad">السطر ' + mN(b.line) + ": " + esc(b.reason) + "</span>"; }).join("") +
        (pv.bad.length > 8 ? '<span class="bad">و' + mPlOf(pv.bad.length - 8, ptPl(pv.bad.length - 8, "سطر آخر فيه خطأ", "سطران آخران فيهما أخطاء", "أسطر أخرى فيها أخطاء", "سطرًا آخر فيها أخطاء")) + ".</span>" : "") + "</div>";
    }
  }
  return h;
}
var PT_FIELD_ID = { name: "ptf_name", kind: "ptf_kind", contactName: "ptf_contact", phone: "ptf_phone", email: "ptf_email", note: "ptf_note",
  product: "ptr_product", contactedOn: "ptr_date", accountName: "ptr_name", result: "ptr_result", paste: "ptr_paste" };
function ptFieldTarget(field) {
  if (!ptSheet) return "";
  if (ptSheet.kind === "record" && field === "phone") return "ptr_phone";
  if (ptSheet.kind === "record" && field === "note") return "ptr_note";
  if (/^targets\\.\\d+$/.test(field || "")) return "ptt_" + field.split(".")[1];
  return PT_FIELD_ID[field] || "";
}
function ptFail(reason, field) {
  var s = ptSheet; if (!s) return;
  s.err = reason; s.field = field || ""; s.busy = false;
  var target = ptFieldTarget(field);
  if (field === "result" || field === "kind") target = "";
  s.focus = target || (field === "result" ? "" : "");
  render(false);
  if (field === "result" || field === "kind") { var b = document.querySelector((field === "result" ? "#ptr_result" : "#ptf_kind") + " button"); if (b) b.focus(); }
}
function ptSave() {
  var s = ptSheet; if (!s || s.busy) return;
  if (s.kind === "partner") {
    var c = checkPartner(s.d);
    if (!c.ok) { ptFail(c.reason, c.field); return; }
    s.busy = true; s.err = ""; s.field = ""; render(false);
    var body = { name: s.d.name, kind: s.d.kind, contactName: s.d.contactName, phone: s.d.phone, email: s.d.email, note: s.d.note };
    var req = s.mode === "edit" ? cfJson("PATCH", "/admin/partners/" + s.id, Object.assign(body, { status: s.d.status, ifUpdatedAt: s.updatedAt })) : cfJson("POST", "/admin/partners", body);
    req.then(function (x) {
      if (ptSheet !== s) return;
      if (!x.ok) {
        if (x.status === 409 && x.j.error === "stale_partner") { ptFail("عدّل شخص آخر هذا الشريك بعد أن فتحته. أغلق النموذج وافتحه من جديد.", ""); ptLoad(ptWeek, true); return; }
        ptFail(x.j.detail || "تعذّر الحفظ (" + fmtN(x.status) + ")", x.j.field || ""); return;
      }
      s.dirty = false; ptClose(true);
      if (s.mode === "new") { ptF.tab = String(x.j.partner.id); ptToast("أُضيف الشريك «" + x.j.partner.name + "» — حدّد مستهدفه الأسبوعي", false); }
      else ptToast("حُفظ الشريك «" + x.j.partner.name + "»", false);
      ptLoad(ptWeek, true);
    }).catch(function () { if (ptSheet === s) ptFail("تعذّر الاتصال — لم يُحفظ شيء.", ""); });
    return;
  }
  if (s.kind === "targets") {
    var list = [];
    for (var i = 0; i < s.rows.length; i++) {
      var p = s.rows[i];
      var ct = checkTarget({ product: p, target: s.d[p] || "" }, s.rows);
      if (!ct.ok) { ptFail(ct.reason, "targets." + i); return; }
      if (ct.value.target > 0 && ptIsArchived(p)) { ptFail("المنتج مؤرشف — لا يُحدَّد له مستهدف جديد", "targets." + i); return; }
      list.push(ct.value);
    }
    s.busy = true; s.err = ""; s.field = ""; render(false);
    cfJson("PUT", "/admin/partners/" + s.id + "/targets", { week: s.week, targets: list }).then(function (x) {
      if (ptSheet !== s) return;
      if (!x.ok) { ptFail(x.j.detail || "تعذّر الحفظ (" + fmtN(x.status) + ")", ""); return; }
      var sum = list.reduce(function (a, t) { return a + t.target; }, 0);
      s.dirty = false; ptClose(true);
      ptToast("حُفظ مستهدف الأسبوع: " + ptNOrg(sum), false);
      ptLoad(ptWeek, true);
    }).catch(function () { if (ptSheet === s) ptFail("تعذّر الاتصال — لم يُحفظ شيء.", ""); });
    return;
  }
  var rows;
  if (s.mode === "one") {
    var cr = checkResult(s.d, ptData.products, ptData.today);
    if (!cr.ok) { ptFail(cr.reason, cr.field); return; }
    rows = [cr.value];
  } else {
    if (!s.d.product) { ptFail("اختر المنتج", "product"); return; }
    if (!isIsoDay(s.d.contactedOn) || s.d.contactedOn > ptData.today) { ptFail("تاريخ التواصل غير صالح", "contactedOn"); return; }
    var pv = ptPastePreview(s);
    if (!pv.ok.length && !pv.bad.length) { ptFail("الصق سطرًا واحدًا على الأقل", "paste"); return; }
    if (pv.bad.length) { ptFail("صحّح الأسطر التي فيها أخطاء قبل التسجيل — لا يُسجَّل جزء من القائمة", "paste"); return; }
    if (pv.ok.length > RESULTS_BATCH_MAX) { ptFail("القائمة أطول من " + fmtN(RESULTS_BATCH_MAX) + " سطر — قسّمها", "paste"); return; }
    rows = pv.ok.map(function (x) { return x.value; });
  }
  s.busy = true; s.err = ""; s.field = ""; render(false);
  cfJson("POST", "/admin/partners/" + s.id + "/results", { results: rows }).then(function (x) {
    if (ptSheet !== s) return;
    if (!x.ok) {
      var m = /^results\\.(\\d+)\\.(\\w+)$/.exec(x.j.field || "");
      if (m && s.mode === "paste") { ptFail("السطر " + fmtN(pv.ok[Number(m[1])] ? pv.ok[Number(m[1])].line : Number(m[1]) + 1) + ": " + (x.j.detail || ""), "paste"); return; }
      ptFail(x.j.detail || "تعذّر الحفظ (" + fmtN(x.status) + ")", m ? m[2] : ""); return;
    }
    var outs = x.j.outcomes || [];
    var locked = outs.filter(function (o) { return o.status === "locked"; }).length;
    var handed = outs.filter(function (o) { return o.oppId && o.status !== "locked"; });
    s.dirty = false; ptClose(true);
    var msg = "سُجّلت " + ptNRes(outs.length - locked) + (handed.length ? " · حُوّل للمبيعات: " + fmtN(handed.length) : "") + (locked ? " · " + ptPl(locked, "نتيجة واحدة لم تتغير لأنها", "نتيجتان لم تتغيرا لأنهما", "نتائج لم تتغير لأنها", "نتيجة لم تتغير لأنها") + " حُوّلت سابقًا" : "");
    ptToast(msg, false, handed.length === 1 ? "افتح الفرصة" : handed.length ? "افتح فرص البيع" : "", handed.length ? function () { location.hash = handed.length === 1 ? "opps/" + handed[0].oppId : "opps"; } : null);
    var wk = weekStartOf(rows[0].contactedOn);
    ptLoad(wk, true);
  }).catch(function () { if (ptSheet === s) ptFail("تعذّر الاتصال — لم يُحفظ شيء.", ""); });
}
function ptCopyPrev() {
  var s = ptSheet; if (!s || s.kind !== "targets") return;
  s.copying = true; render(false);
  pxGet("/admin/partners?week=" + addDays(s.week, -7)).then(function (j) {
    if (ptSheet !== s) return;
    var n = 0;
    j.targets.filter(function (t) { return t.partnerId === s.id; }).forEach(function (t) { if (ptData.products.indexOf(t.product) >= 0) { s.d[t.product] = String(t.target); n++; } });
    s.copying = false; s.dirty = s.dirty || n > 0;
    s.err = n ? "" : "لا مستهدف في الأسبوع السابق لهذا الشريك."; s.field = n ? "" : "targets";
    s.focus = "ptt_0"; render(false);
  }).catch(function () { if (ptSheet !== s) return; s.copying = false; s.err = "تعذّر تحميل الأسبوع السابق."; s.field = "targets"; render(false); });
}
function ptAfterPaint() {
  if (!ptSheet) return;
  if (!ptSheet.shown && document.querySelector(".ac-box")) {
    requestAnimationFrame(function () { if (!ptSheet) return; document.querySelectorAll(".ac-scrim, .ac-box").forEach(function (el) { el.classList.add("in"); }); ptSheet.shown = true; });
  }
  if (ptSheet.focus) { var el = document.getElementById(ptSheet.focus); ptSheet.focus = ""; if (el) el.focus(); }
}

/* ---------------- one delegated listener ---------------- */
document.addEventListener("click", function (ev) {
  var t = ev.target && ev.target.closest ? ev.target.closest("[data-pt]") : null;
  if (!t) return;
  var a = t.getAttribute("data-pt"), v = t.getAttribute("data-v"), id = Number(t.getAttribute("data-i"));
  if (a === "retry") { ptFailed = false; ptLoad(ptWeek, true); render(false); return; }
  if (a === "week") {
    if (t.disabled || !ptData) return;
    /* From the week already asked for, so a second press while the first loads moves on again. */
    ptWant = addDays(ptWant && ptLoading ? ptWant : ptData.week, Number(v));
    if (ptWant > ptData.currentWeek) ptWant = ptData.currentWeek;
    ptArm = {}; ptLoad(ptWant, true); render(false); return;
  }
  if (a === "thisweek") { ptArm = {}; ptLoad(ptData.currentWeek, true); render(false); return; }
  if (a === "tab") { ptF.tab = v; ptF.res = "all"; ptArm = {}; render(false); var tb = document.getElementById("pttab_" + v); if (tb) { tb.focus(); tb.scrollIntoView({ block: "nearest", inline: "nearest" }); } return; }
  if (a === "res") { ptF.res = v; render(false); var rb = document.querySelector('[data-pt="res"][data-v="' + v + '"]'); if (rb) rb.focus(); return; }
  if (a === "newpartner") { ptOpen("partner", t.id || ""); return; }
  if (a === "editpartner" || a === "targets" || a === "record") { ptOpen(a, t.id || ""); return; }
  if (a === "del") {
    if (ptBusy[id]) return;
    if (ptArm[id] !== "del") { ptArm = {}; ptArm[id] = "del"; render(false); var db2 = document.getElementById("ptdel" + id); if (db2) db2.focus(); return; }
    ptDelete(id); return;
  }
  if (a === "confirminterest") { ptPatchResult(id, "interested"); return; }
  if (a === "cancelarm") { delete ptArm[id]; render(false); var sl = document.getElementById("ptsel" + id); if (sl) sl.focus(); return; }
  if (!ptSheet) return;
  if (a === "close") { ptClose(false); return; }
  if (a === "keep") { ptSheet.confirm = false; render(false); var sv = document.getElementById("ptsave"); if (sv) sv.focus(); return; }
  if (a === "discard") { ptClose(true); return; }
  if (a === "save") { ptSave(); return; }
  if (a === "copyprev") { ptCopyPrev(); return; }
  if (a === "kind" || a === "status" || a === "result") {
    var key = a;
    ptSheet.d[key] = v; ptSheet.dirty = true;
    if (ptSheet.field === key) { ptSheet.err = ""; ptSheet.field = ""; }
    render(false);
    var rb2 = document.querySelector('[data-pt="' + a + '"][data-v="' + v + '"]'); if (rb2) rb2.focus();
    return;
  }
  if (a === "mode") { ptSheet.mode = v; ptSheet.err = ""; ptSheet.field = ""; ptSheet.focus = v === "paste" ? "ptr_paste" : "ptr_name"; render(false); return; }
});
document.addEventListener("input", function (ev) {
  var t = ev.target; if (!t || !t.getAttribute || !ptSheet) return;
  var k = t.getAttribute("data-ptfld"), tg = t.getAttribute("data-pttg");
  if (tg !== null) { ptSheet.d[tg] = t.value; ptSheet.dirty = true; if (ptSheet.field.indexOf("targets") === 0 && ptSheet.err) { ptSheet.err = ""; ptSheet.field = ""; var e0 = document.getElementById("err_pt_tg"); if (e0) e0.remove(); t.removeAttribute("aria-invalid"); } return; }
  if (!k) return;
  if (k === "paste") {
    ptSheet.paste = t.value; ptSheet.dirty = true;
    /* The preview repaints after a pause, and the caret is put back where it was. */
    clearTimeout(window.__ptpv);
    window.__ptpv = setTimeout(function () {
      if (!ptSheet) return;
      var el = document.getElementById("ptr_paste"); var pos = el ? el.selectionStart : 0;
      if (ptSheet.field === "paste") { ptSheet.err = ""; ptSheet.field = ""; }
      render(false);
      var el2 = document.getElementById("ptr_paste"); if (el2) { el2.focus(); try { el2.setSelectionRange(pos, pos); } catch (e) {} }
    }, 250);
    return;
  }
  ptSheet.d[k] = t.value; ptSheet.dirty = true;
  if (ptSheet.field === k && ptSheet.err) {
    var er = document.getElementById("err_pt_" + k); if (er) er.remove();
    t.removeAttribute("aria-invalid"); t.removeAttribute("aria-describedby"); ptSheet.err = ""; ptSheet.field = "";
  }
});
document.addEventListener("change", function (ev) {
  var t = ev.target; if (!t || !t.getAttribute) return;
  if (t.getAttribute("data-ptset") === "product") { ptF.product = t.value; render(false); var again = document.querySelector('[data-ptset="product"]'); if (again) again.focus(); return; }
  var rid = t.getAttribute("data-ptres");
  if (rid) {
    var id = Number(rid), r = ptResultById(id); if (!r) return;
    /* Choosing «مهتم» hands the customer to sales and closes the row: it asks once more first. */
    if (t.value === "interested") { ptArm = {}; ptArm[id] = "interest"; render(false); var ok = document.getElementById("ptok" + id); if (ok) ok.focus(); return; }
    /* After a pause: some browsers fire change on every arrow key through a closed select, and each would write. */
    clearTimeout(window.__ptsel); var val = t.value;
    window.__ptsel = setTimeout(function () { var cur = ptResultById(id); if (cur && cur.result !== val) ptPatchResult(id, val); }, 600);
    return;
  }
  if (ptSheet && t.tagName === "SELECT" && t.getAttribute("data-ptfld")) {
    ptSheet.d[t.getAttribute("data-ptfld")] = t.value; ptSheet.dirty = true;
    if (ptSheet.mode === "paste") render(false);
  }
  if (ptSheet && t.getAttribute("data-ptfld") === "contactedOn" && ptSheet.mode === "paste") render(false);
});
document.addEventListener("keydown", function (ev) {
  if (!ptSheet || !document.querySelector(".ac-box")) {
    var tb = ev.target && ev.target.closest ? ev.target.closest(".m-tab") : null;
    if (tb && tb.getAttribute("data-pt") === "tab" && ptData && (ev.key === "ArrowLeft" || ev.key === "ArrowRight" || ev.key === "Home" || ev.key === "End")) {
      ev.preventDefault();
      var order = ["all"].concat(ptData.partners.map(function (p) { return String(p.id); }));
      var at = ev.key === "Home" ? 0 : ev.key === "End" ? order.length - 1 : order.indexOf(String(ptF.tab)) + (ev.key === "ArrowLeft" ? 1 : -1);
      ptF.tab = order[(at + order.length) % order.length]; ptF.res = "all"; ptArm = {}; render(false);
      var nb = document.getElementById("pttab_" + ptF.tab); if (nb) { nb.focus(); nb.scrollIntoView({ block: "nearest", inline: "nearest" }); }
      return;
    }
    if (ev.key === "Escape" && Object.keys(ptArm).length) { var ids = Object.keys(ptArm); ptArm = {}; render(false); var f0 = document.getElementById("ptsel" + ids[0]) || document.getElementById("ptdel" + ids[0]); if (f0) f0.focus(); }
    return;
  }
  var rg = ev.target && ev.target.closest ? ev.target.closest(".pt-radio") : null;
  if (rg && (ev.key === "ArrowLeft" || ev.key === "ArrowRight")) {
    ev.preventDefault();
    var bs = Array.prototype.slice.call(rg.querySelectorAll("button"));
    var i = bs.indexOf(ev.target); var nx = bs[(i + (ev.key === "ArrowLeft" ? 1 : -1) + bs.length) % bs.length];
    if (nx) nx.click();
    return;
  }
  if (ev.key === "Escape") { ev.preventDefault(); if (ptSheet.confirm) { ptSheet.confirm = false; render(false); var sv = document.getElementById("ptsave"); if (sv) sv.focus(); } else ptClose(false); return; }
  if (ev.key === "Enter" && ev.target && ev.target.tagName === "INPUT" && ev.target.type !== "date") { ev.preventDefault(); ptSave(); return; }
  if (ev.key !== "Tab") return;
  var box = document.querySelector(".ac-box");
  var items = Array.prototype.filter.call(box.querySelectorAll("button, input, select, textarea, a[href]"), function (el) { return !el.disabled && el.offsetParent !== null && el.tabIndex !== -1; });
  if (!items.length) return;
  var first = items[0], last = items[items.length - 1];
  if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
  else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
  else if (!box.contains(document.activeElement)) { ev.preventDefault(); first.focus(); }
});
/* ================= end «شركاء المبيعات» ================= */
`;
