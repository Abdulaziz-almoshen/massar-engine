// partners-crm.ts — «شركاء المبيعات» (client A, BRD v1.0 §17 BR-PRT-001..004, slice S5).
//
// The prototype's screen, on real records: a week, a product filter, «الإجمالي» plus one tab per partner,
// five tiles (المستهدف · تم التواصل · مهتمون · غير مهتمين · لم يردوا), achievement per product, and per
// partner. Inside a partner: its contact results for the week, a sheet to record them one by one or as a
// pasted list, and a sheet to set the week's targets. Every «مهتم» is handed to the sales team as a partner
// opportunity by the server, and the row then says so and links to it (BR-PRT-003).
//
// GRAMMAR. The settings table (.cf-sec/.cf-hr/.cf-r), .crm-kpi tiles, .cf-pill, .vtog, and the account
// sheet (.ac-scrim/.ac-modal/.ac-box) so a sheet here opens, moves focus and closes like every other. Rules
// come from partner-domain (PARTNER_DOMAIN_JS); the numbers from its summarizeWeek, so a tile and a table
// row can never count a week two ways.
//
// MOTION (emil-design-eng). The sheet is the account sheet: 0.96 scale + opacity, 200ms in, 140ms out,
// centred. Achievement bars do not animate: they repaint on every filter change, and a bar that regrows on
// each keystroke is noise. Buttons press to 0.97. Reduced motion keeps the fade only.
//
// NO BACKTICKS ANYWHERE IN THIS FILE, comments included: it is one template literal.

export const PARTNERS_CRM_CSS = `
.pt { display:flex; flex-direction:column; gap:var(--s3); container-type:inline-size; container-name:ptw; }
.pt .crm-kpis { margin-block-end:0; }
/* Five tiles, one row: the BRD's five measures read as one sentence (target, reached, and what reaching came to). */
.pt .crm-kpis.crm-hasLead { grid-template-columns:1.3fr repeat(4, minmax(0,1fr)); }
.pt-bar { display:flex; align-items:center; gap:var(--s2); flex-wrap:wrap; }
.pt-bar .sp { flex:1; }
.pt-week { display:inline-flex; align-items:center; gap:4px; background:var(--paper); border:1px solid var(--line); border-radius:var(--r-md); padding:3px; }
.pt-week .nav { width:34px; height:34px; border:none; background:none; border-radius:var(--r-sm); color:var(--ink); cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:var(--t-md); }
.pt-week .nav:hover { background:var(--surface); }
.pt-week .lbl { font-size:var(--t-sm); font-weight:600; color:var(--ink); padding:0 var(--s2); white-space:nowrap; font-variant-numeric:tabular-nums; }
.pt-week .lbl .cur { color:var(--accent-deep); font-weight:600; }
.pt-bar select { font-family:inherit; height:40px; max-width:220px; font-size:var(--t-sm); color:var(--ink); background:var(--paper); border:none;
  box-shadow:inset 0 0 0 1px var(--s-off-mark); border-radius:var(--r-sm); padding-inline:10px; }
.pt-bar select.on { box-shadow:inset 0 0 0 1px var(--accent-mark); background:var(--accent-tint); color:var(--accent-deep); }
.pt-bar .lnk, .pt .lnk { font-family:inherit; font-size:var(--t-xs); font-weight:600; color:var(--accent-deep); background:none; border:none; padding:0 4px; cursor:pointer; min-height:28px; border-radius:var(--r-sm); }
.pt-tabs { display:flex; gap:0; overflow-x:auto; background:var(--paper); border:1px solid var(--line); border-radius:var(--r-lg); padding:0 var(--s2); scrollbar-width:thin; }
.pt-tab { flex:none; font-family:inherit; font-size:var(--t-sm); font-weight:500; color:var(--muted); background:none; border:none; border-bottom:2px solid transparent;
  padding:12px 14px; cursor:pointer; white-space:nowrap; display:inline-flex; align-items:center; gap:6px; }
.pt-tab:hover { color:var(--ink); }
.pt-tab[aria-selected="true"] { color:var(--accent-deep); font-weight:600; border-bottom-color:var(--accent); }
.pt-tab .off { font-size:var(--t-xs); font-weight:500; color:var(--muted); background:var(--surface-2); border-radius:var(--r-pill); padding:0 7px; }
.pt-note { display:flex; align-items:center; gap:var(--s2); font-size:var(--t-xs); color:var(--muted); line-height:1.7; }
.pt-note svg { width:16px; height:16px; flex:none; color:var(--accent-deep); }
.pt-sec .hd { display:flex; align-items:center; gap:var(--s2); flex-wrap:wrap; padding:var(--s3) var(--s4); border-bottom:1px solid var(--line-soft); }
.pt-sec .hd h2 { margin:0; font-size:var(--t-md); font-weight:600; color:var(--ink); }
.pt-sec .hd .s { font-size:var(--t-xs); color:var(--muted); }
.pt-sec .hd .sp { flex:1; }
.pt-sec .hd .btn { height:34px; display:inline-flex; align-items:center; gap:6px; }
.pt-prod .cf-hr, .pt-prod .cf-r { grid-template-columns:minmax(160px,1.6fr) 84px 96px minmax(140px,1.3fr) 72px 84px 72px; column-gap:var(--s3); }
.pt-part .cf-hr, .pt-part .cf-r { grid-template-columns:minmax(180px,1.6fr) 84px 96px minmax(140px,1.3fr) 72px 84px 72px minmax(110px,1fr); column-gap:var(--s3); }
.pt-res .cf-hr, .pt-res .cf-r { grid-template-columns:minmax(180px,1.6fr) minmax(0,1fr) 110px minmax(150px,1.2fr) 44px; column-gap:var(--s2); }
.pt-part .cf-r { cursor:pointer; }
.pt-part .cf-r:hover { background:var(--surface); }
.pt-num { font-variant-numeric:tabular-nums; white-space:nowrap; }
.pt-lbl { display:none; font-size:var(--t-xs); color:var(--muted); }
.pt-ach { display:flex; align-items:center; gap:var(--s2); min-width:0; padding-inline-end:var(--s3); }
.pt-ach .track { flex:1; height:6px; border-radius:var(--r-pill); background:var(--surface-2); overflow:hidden; min-width:48px; }
.pt-ach .track i { display:block; height:100%; border-radius:inherit; background:var(--accent); }
.pt-ach.hi .track i { background:var(--s-issued); }
.pt-ach.lo .track i { background:var(--s-attn-mark); }
.pt-ach .v { font-size:var(--t-xs); font-weight:600; color:var(--ink); font-variant-numeric:tabular-nums; min-width:40px; text-align:end; }
.pt-ach.none .v { color:var(--muted); font-weight:500; }
.cf-pill.pr-interested { background:var(--accent-tint); color:var(--accent-deep); }
.cf-pill.pr-not_interested { background:var(--s-fail-soft); color:var(--s-fail-text); }
.cf-pill.pr-no_reply { background:var(--s-attn-soft); color:var(--s-attn-text); }
.pt-rs { display:flex; align-items:center; gap:6px; flex-wrap:wrap; min-width:0; }
.pt-rs select { font-family:inherit; height:32px; font-size:var(--t-xs); color:var(--ink); background:var(--paper); border:none; box-shadow:inset 0 0 0 1px var(--s-off-mark); border-radius:var(--r-sm); padding-inline:6px; }
.pt-rs a { font-size:var(--t-xs); font-weight:600; color:var(--accent-deep); text-decoration:none; white-space:nowrap; }
.pt-rs a:hover { text-decoration:underline; text-underline-offset:3px; }
.pt-arm { display:flex; align-items:center; gap:6px; flex-wrap:wrap; font-size:var(--t-xs); color:var(--ink); }
.pt-arm .btn { height:30px; padding-inline:10px; font-size:var(--t-xs); }
.pt-del { width:36px; height:36px; border:none; background:none; border-radius:var(--r-sm); color:var(--muted); cursor:pointer; display:flex; align-items:center; justify-content:center; }
.pt-del:hover { background:var(--s-fail-soft); color:var(--s-fail-text); }
.pt-del.armed { width:auto; padding:0 8px; background:var(--s-fail-soft); color:var(--s-fail-text); font-family:inherit; font-size:var(--t-xs); font-weight:600; }
.pt-del:disabled { opacity:.4; cursor:default; background:none; color:var(--muted); }
.pt-card { display:flex; align-items:flex-start; gap:var(--s3); flex-wrap:wrap; padding:var(--s3) var(--s4); }
.pt-card .main { flex:1; min-width:220px; display:flex; flex-direction:column; gap:4px; }
.pt-card .nm { font-size:var(--t-lg); font-weight:600; color:var(--ink); display:flex; align-items:center; gap:var(--s2); flex-wrap:wrap; }
.pt-card .meta { font-size:var(--t-xs); color:var(--muted); line-height:1.8; display:flex; gap:4px 14px; flex-wrap:wrap; }
.pt-card .acts { display:flex; gap:var(--s2); flex-wrap:wrap; }
.pt-card .acts .btn { height:36px; display:inline-flex; align-items:center; gap:6px; }
.pt-banner { border-radius:var(--r-md); padding:var(--s2) var(--s4); font-size:var(--t-sm); background:var(--s-attn-soft); color:var(--s-attn-text); display:flex; align-items:center; gap:var(--s2); flex-wrap:wrap; }
.pt-rfilter { display:flex; align-items:center; gap:var(--s2); flex-wrap:wrap; padding:var(--s2) var(--s4); border-bottom:1px solid var(--line-soft); background:var(--surface); }
/* sheets reuse the account sheet; only their own content is styled here */
.pt-tg { display:flex; flex-direction:column; }
.pt-tg .row { display:grid; grid-template-columns:minmax(0,1fr) 120px; gap:var(--s2); align-items:center; padding:8px 0; border-bottom:1px solid var(--line-soft); }
.pt-tg .row:last-child { border-bottom:none; }
.pt-tg .row label { font-size:var(--t-sm); color:var(--ink); }
.pt-tg .row input { text-align:center; font-variant-numeric:tabular-nums; }
.pt-tg .row input[aria-invalid="true"] { box-shadow:inset 0 0 0 2px var(--s-fail); }
.pt-radio { display:flex; gap:6px; flex-wrap:wrap; }
.pt-radio button { font-family:inherit; font-size:var(--t-sm); font-weight:500; min-height:38px; padding:0 14px; border-radius:var(--r-pill); border:none; cursor:pointer;
  background:var(--paper); color:var(--ink); box-shadow:inset 0 0 0 1px var(--s-off-mark); }
.pt-radio button[aria-checked="true"] { background:var(--accent); color:var(--on-accent, #FFFFFF); box-shadow:none; }
.pt-radio.bad button { box-shadow:inset 0 0 0 2px var(--s-fail); }
.pt-paste { width:100%; min-height:160px; font-family:inherit; font-size:var(--t-sm); line-height:1.7; padding:var(--s2) var(--s3); border:none; border-radius:var(--r-sm);
  box-shadow:inset 0 0 0 1px var(--s-off-mark); background:var(--paper); color:var(--ink); resize:vertical; box-sizing:border-box; }
.pt-paste:focus { outline:2px solid var(--accent); outline-offset:1px; }
.pt-prev { display:flex; flex-direction:column; gap:4px; font-size:var(--t-xs); }
.pt-prev .ok { color:var(--accent-deep); font-weight:600; }
.pt-prev .bad { color:var(--s-fail-text); }
.pt .btn, .pt-tab, .pt-radio button, .pt-week .nav { transition:transform 140ms var(--ease), background var(--fast) var(--ease), color var(--fast) var(--ease); }
.pt .btn:active, .pt-radio button:active, .pt-week .nav:active, .ac-box .pt-radio button:active { transform:scale(.97); }
.pt a:focus-visible, .pt button:focus-visible, .pt select:focus-visible, .pt-radio button:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
@container ptw (max-width: 760px) { .pt .crm-kpis.crm-hasLead { grid-template-columns:repeat(3, minmax(0,1fr)); } }
@container ptw (max-width: 500px) { .pt .crm-kpis.crm-hasLead { grid-template-columns:repeat(2, minmax(0,1fr)); } }
@container ptw (max-width: 900px) {
  .pt-prod .cf-hr, .pt-part .cf-hr, .pt-res .cf-hr { display:none; }
  .pt-prod .cf-r, .pt-part .cf-r, .pt-res .cf-r { grid-template-columns:repeat(3, minmax(0,1fr)); row-gap:6px; padding-block:var(--s3); }
  .pt-prod .cf-r > :first-child, .pt-part .cf-r > :first-child, .pt-res .cf-r > :first-child, .pt-ach, .pt-rs { grid-column:1 / -1; }
  .pt-lbl { display:inline; }
}
@media (pointer:coarse) { .pt-bar select, .pt-rs select, .pt-bar .lnk, .pt .lnk, .pt-arm .btn { min-height:44px; } .pt-week .nav, .pt-del { width:44px; height:44px; } }
@media (prefers-reduced-motion: reduce) { .pt .btn, .pt-tab, .pt-radio button, .pt-week .nav { transition:none; } .pt .btn:active, .pt-radio button:active, .pt-week .nav:active { transform:none; } }
`;

export const PARTNERS_CRM_JS = `
/* ================= «شركاء المبيعات» ================= */
var ptData = null, ptLoading = false, ptFailed = false, ptWeek = "", ptPendingWeek = null, ptWant = "";
var ptF = { tab: "all", product: "", res: "all" };
var ptSheet = null;        /* the open sheet: partner form, targets, or results */
var ptArm = {};            /* result id -> "del" | "interest" while a destructive or handing-over change waits for its second press */
var ptBusy = {};           /* result id -> true while a change is being written */

function ptPl(n, one, two, few, many) { return pluralizeArabic(n, one, two, few, many, fmtN); }
function ptNOrg(n) { return ptPl(n, "منشأة واحدة", "منشأتان", "منشآت", "منشأة"); }
function ptNRes(n) { return ptPl(n, "نتيجة واحدة", "نتيجتان", "نتائج", "نتيجة"); }
function ptNPartner(n) { return ptPl(n, "شريك واحد", "شريكان", "شركاء", "شريكًا"); }
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
/* Every product the week can show: the live catalogue, then any archived one this week's targets or results still name. */
function ptAllProducts() { return ptData ? ptData.products.concat(ptData.archivedProducts || []) : []; }
function ptIsArchived(p) { return !!ptData && (ptData.archivedProducts || []).indexOf(p) >= 0; }
function ptPhone(ph) { return '<bdi dir="ltr">' + (String(ph).charAt(0) === "0" ? "" : "+") + esc(ph) + "</bdi>"; }
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
function ptAch(line) {
  if (line.pct === null) return '<span class="pt-ach none"><span class="track" aria-hidden="true"></span><span class="v">بلا مستهدف</span></span>';
  var cls = line.pct >= 100 ? " hi" : line.pct < 50 ? " lo" : "";
  return '<span class="pt-ach' + cls + '" role="img" aria-label="الإنجاز ' + fmtN(line.pct) + '٪"><span class="track"><i style="width:' + Math.min(100, line.pct) + '%"></i></span><span class="v">' + fmtN(line.pct) + "٪</span></span>";
}
function ptShare(n, of) { return of > 0 ? fmtN(Math.round((n / of) * 100)) + "٪ من المتواصل معهم" : "—"; }
function ptKpis(line) {
  var tile = function (k, v, s, lead) { return '<div class="crm-kpi' + (lead ? " crm-lead" : "") + '"><div class="crm-k">' + k + '</div><div class="crm-v">' + v + "</div>" + (s ? '<div class="crm-s">' + s + "</div>" : "") + "</div>"; };
  return '<div class="crm-kpis crm-hasLead">' +
    tile("المستهدف الأسبوعي", fmtN(line.target), line.target ? "منشآت مطلوب التواصل معها" : "لم يُحدَّد مستهدف", true) +
    tile("تم التواصل", fmtN(line.contacted), (line.pct === null ? "بلا مستهدف" : fmtN(line.pct) + "٪ من المستهدف") +
      (line.pct !== null && line.contactedTargeted !== line.contacted ? " · لمنتجات لها مستهدف: " + fmtN(line.contactedTargeted) : "")) +
    tile("مهتمون", fmtN(line.interested), line.interested ? ptShare(line.interested, line.contacted) + " · حُوّل للمبيعات: " + fmtN(line.handedOver) : "—") +
    tile("غير مهتمين", fmtN(line.notInterested), ptShare(line.notInterested, line.contacted)) +
    tile("لم يردوا", fmtN(line.noReply), ptShare(line.noReply, line.contacted)) + "</div>";
}

/* ---------------- the screen ---------------- */
function ptPaintCrumb() {
  var act = document.getElementById("crumbact");
  if (!act || (location.hash || "").slice(1) !== "partners") return;
  if (document.getElementById("ptnewtop")) return;
  act.innerHTML = '<button class="btn btn-teal ac-newtop" id="ptnewtop" data-pt="newpartner">' + ptIco("plus") + '<span class="lg">إضافة شريك</span><span class="sm">شريك</span></button>';
}
function vPartners() {
  ptLoad(ptWeek, false);
  setTimeout(ptPaintCrumb, 0);
  var h = '<div class="pt">';
  if (!ptData && !ptFailed) return h + '<section class="cf-sec"><div class="cf-state" role="status">جارٍ تحميل الشركاء…</div></section></div>' + ptModal();
  if (!ptData) return h + '<section class="cf-sec"><div class="cf-state" role="alert">تعذّر تحميل الشركاء.<button class="btn btn-ghost" data-pt="retry">أعد المحاولة</button></div></section></div>' + ptModal();
  if (ptFailed) h += '<section class="cf-sec"><div class="cf-state" role="alert">' + ptIco("warn") + 'تعذّر التحديث — المعروض آخر نسخة محمّلة.<button class="btn btn-ghost" data-pt="retry">أعد المحاولة</button></div></section>';
  var d = ptData;
  if (!d.partners.length) {
    return h + '<section class="cf-sec"><div class="crm-empty" style="padding:var(--s5,32px) var(--s4)"><b>لا شركاء بعد</b>' +
      "الشريك شركة متعاقدة تتولى التواصل الأولي مع العملاء لمنتج ما. حدّد لكل شريك مستهدفًا أسبوعيًا لكل منتج، وسجّل ما انتهى إليه كل تواصل: مهتم، غير مهتم، لم يرد. كل «مهتم» يُحوَّل فرصة بيع لفريق المبيعات." +
      '<div class="in-row" style="margin-top:var(--s3)"><button class="btn btn-teal" id="ptnewempty" data-pt="newpartner" style="display:inline-flex;align-items:center;gap:6px">' + ptIco("plus") + "إضافة شريك</button></div></div></section></div>" + ptModal();
  }
  var isCur = d.week === d.currentWeek;
  h += '<div class="pt-bar"><span class="pt-week" role="group" aria-label="الأسبوع">' +
    '<button class="nav" data-pt="week" data-v="-7" aria-label="الأسبوع السابق">›</button>' +
    '<span class="lbl" aria-live="polite">' + (isCur ? '<span class="cur">الأسبوع الحالي</span> · ' : "") + ptWeekLabel(d.week, d.weekEnd) + (ptLoading ? " …" : "") + "</span>" +
    '<button class="nav" data-pt="week" data-v="7" aria-label="الأسبوع التالي"' + (d.week >= d.currentWeek ? " disabled" : "") + ">‹</button></span>" +
    (isCur ? "" : '<button class="lnk" data-pt="thisweek">العودة إلى هذا الأسبوع</button>') +
    '<span class="sp"></span><select aria-label="المنتج" data-ptset="product"' + (ptF.product ? ' class="on"' : "") + '><option value="">كل المنتجات</option>' +
    ptAllProducts().map(function (p) { return '<option value="' + esc(p) + '"' + (ptF.product === p ? " selected" : "") + ">" + esc(p) + (ptIsArchived(p) ? " (مؤرشف)" : "") + "</option>"; }).join("") + "</select></div>";
  h += '<div class="pt-tabs" role="tablist" aria-label="الشركاء">' +
    [{ id: "all", name: "الإجمالي" }].concat(d.partners).map(function (p) {
      var on = String(ptF.tab) === String(p.id);
      return '<button class="pt-tab" role="tab" id="pttab_' + p.id + '" aria-selected="' + on + '" tabindex="' + (on ? 0 : -1) + '" data-pt="tab" data-v="' + p.id + '">' + esc(p.name) +
        (p.status === "paused" ? '<span class="off">موقوف</span>' : "") + "</button>";
    }).join("") + "</div>";
  var pid = ptF.tab;
  var line = summarizeWeek(ptTargetsFor(pid, ptF.product), ptResultsFor(pid, ptF.product));
  h += '<div role="tabpanel" aria-labelledby="pttab_' + pid + '" style="display:flex;flex-direction:column;gap:var(--s3)">';
  var partner = pid === "all" ? null : ptPartner(pid);
  if (partner) h += ptPartnerCard(partner);
  h += ptKpis(line);
  h += '<div class="pt-note">' + ptIco("check") + "تنتهي مسؤولية الشريك عند تحديد الاهتمام: كل «مهتم» يُحوَّل تلقائيًا فرصة بيع لفريق المبيعات، ولا يعدّله الشريك بعدها.</div>";
  h += ptProductTable(pid);
  h += partner ? ptResultsTable(partner) : ptPartnerTable();
  return h + "</div></div>" + ptModal();
}
function ptPartnerCard(p) {
  var meta = [PARTNER_KIND_LABELS[p.kind] || p.kind, p.contactName ? "المسؤول: " + esc(p.contactName) : "", p.phone ? '<bdi dir="ltr">' + esc(p.phone) + "</bdi>" : "",
    p.email ? '<a href="mailto:' + esc(p.email) + '" dir="ltr">' + esc(p.email) + "</a>" : "",
    p.opps.count ? "فرص منه: " + fmtN(p.opps.count) + " (قائمة " + fmtN(p.opps.open) + " · رابحة " + fmtN(p.opps.won) + ")" : ""].filter(Boolean);
  var h = '<section class="cf-sec"><div class="pt-card"><div class="main"><div class="nm">' + esc(p.name) + ' <span class="cf-pill ' + (p.status === "active" ? "ap-approved" : "ap-rejected") + '">' + esc(PARTNER_STATUS_LABELS[p.status]) + "</span></div>" +
    '<div class="meta">' + meta.map(function (m) { return "<span>" + m + "</span>"; }).join("") + "</div>" +
    (p.opps.wonValue || p.opps.openValue ? '<div class="meta"><span>قيمة الفرص الرابحة: ' + acMoney(p.opps.wonValue) + "</span><span>القائمة: " + acMoney(p.opps.openValue) + "</span></div>" : "") + "</div>" +
    '<div class="acts">' + (p.status === "active" ? '<button class="btn btn-teal" id="ptrecord" data-pt="record">' + ptIco("plus") + "تسجيل نتائج</button>" : "") +
    '<button class="btn btn-ghost" id="pttargets" data-pt="targets">تحديد المستهدف</button><button class="btn btn-ghost" id="ptedit" data-pt="editpartner">تعديل</button></div></div>';
  if (p.status !== "active") h += '<div class="bd" style="padding:0 var(--s4) var(--s3)"><div class="pt-banner">الشريك موقوف: تُعرض نتائجه ولا تُسجَّل له نتائج جديدة. فعّله من «تعديل».</div></div>';
  return h + "</section>";
}
function ptProductTable(pid) {
  var prods = ptF.product ? [ptF.product] : ptAllProducts().filter(function (p) { return ptTargetsFor(pid, p).length || ptResultsFor(pid, p).length; });
  var h = '<section class="cf-sec pt-sec pt-prod"><div class="hd"><h2>حسب المنتج</h2><span class="s">المنشآت التي تم التواصل معها مقابل المستهدف</span></div>';
  if (!prods.length) return h + '<div class="cf-state">لا مستهدفات ولا نتائج في هذا الأسبوع' + (pid !== "all" ? '.<button class="btn btn-ghost" data-pt="targets">تحديد المستهدف</button>' : " لأي شريك.") + "</div></section>";
  h += '<div class="cf-t"><div class="cf-hr" role="row"><span>المنتج</span><span>المستهدف</span><span>تم التواصل</span><span>الإنجاز</span><span>مهتم</span><span>غير مهتم</span><span>لم يرد</span></div>';
  prods.forEach(function (p) {
    var l = summarizeWeek(ptTargetsFor(pid, p), ptResultsFor(pid, p));
    h += '<div class="cf-r"><span class="ac-clip" title="' + esc(p) + '">' + esc(p) + (ptIsArchived(p) ? ' <span class="cf-sub">(مؤرشف)</span>' : "") + "</span>" +
      '<span class="pt-num"><span class="pt-lbl">المستهدف: </span>' + (l.target ? fmtN(l.target) : '<span class="cf-sub">—</span>') + "</span>" +
      '<span class="pt-num"><span class="pt-lbl">تم التواصل: </span>' + fmtN(l.contacted) + "</span>" + ptAch(l) +
      '<span class="pt-num"><span class="pt-lbl">مهتم: </span>' + fmtN(l.interested) + '</span><span class="pt-num"><span class="pt-lbl">غير مهتم: </span>' + fmtN(l.notInterested) +
      '</span><span class="pt-num"><span class="pt-lbl">لم يرد: </span>' + fmtN(l.noReply) + "</span></div>";
  });
  return h + "</div></section>";
}
function ptPartnerTable() {
  var h = '<section class="cf-sec pt-sec pt-part"><div class="hd"><h2>حسب الشريك</h2><span class="s">' + ptNPartner(ptData.partners.length) + " · اختر شريكًا لعرض نتائجه وتسجيلها</span></div>" +
    '<div class="cf-t"><div class="cf-hr" role="row"><span>الشريك</span><span>المستهدف</span><span>تم التواصل</span><span>الإنجاز</span><span>مهتم</span><span>غير مهتم</span><span>لم يرد</span><span>فرص البيع منه</span></div>';
  ptData.partners.forEach(function (p) {
    var l = summarizeWeek(ptTargetsFor(p.id, ptF.product), ptResultsFor(p.id, ptF.product));
    h += '<div class="cf-r" data-pt="tab" data-v="' + p.id + '"><span class="ac-nm"><button class="in-link ac-clip" data-pt="tab" data-v="' + p.id + '" title="' + esc(p.name) + '">' + esc(p.name) + '</button><span class="cf-sub">' +
      esc(PARTNER_KIND_LABELS[p.kind] || p.kind) + (p.status !== "active" ? " · موقوف" : "") + "</span></span>" +
      '<span class="pt-num"><span class="pt-lbl">المستهدف: </span>' + (l.target ? fmtN(l.target) : '<span class="cf-sub">—</span>') + "</span>" +
      '<span class="pt-num"><span class="pt-lbl">تم التواصل: </span>' + fmtN(l.contacted) + "</span>" + ptAch(l) +
      '<span class="pt-num"><span class="pt-lbl">مهتم: </span>' + fmtN(l.interested) + '</span><span class="pt-num"><span class="pt-lbl">غير مهتم: </span>' + fmtN(l.notInterested) +
      '</span><span class="pt-num"><span class="pt-lbl">لم يرد: </span>' + fmtN(l.noReply) + "</span>" +
      '<span class="pt-num"><span class="pt-lbl">فرص البيع منه: </span>' + (p.opps.count ? fmtN(p.opps.count) + ' <span class="cf-sub">(رابحة ' + fmtN(p.opps.won) + ")</span>" : '<span class="cf-sub">—</span>') + "</span></div>";
  });
  return h + "</div></section>";
}
function ptResultsTable(p) {
  var all = ptResultsFor(p.id, ptF.product);
  var rows = ptF.res === "all" ? all : all.filter(function (r) { return r.result === ptF.res; });
  var h = '<section class="cf-sec pt-sec pt-res"><div class="hd"><h2>نتائج التواصل</h2><span class="s">' + (all.length ? ptNRes(all.length) + " هذا الأسبوع" : "") + '</span><span class="sp"></span>' +
    (p.status === "active" ? '<button class="btn btn-ghost" id="ptrecord2" data-pt="record">' + ptIco("plus") + "تسجيل نتائج</button>" : "") + "</div>";
  if (!all.length) return h + '<div class="cf-state">لم تُسجَّل نتائج ' + (ptF.product ? "لهذا المنتج " : "") + "في هذا الأسبوع.</div></section>";
  var counts = { all: all.length }; PARTNER_RESULTS.forEach(function (k) { counts[k] = all.filter(function (r) { return r.result === k; }).length; });
  h += '<div class="pt-rfilter"><span class="vtog" role="radiogroup" aria-label="النتيجة">' + [["all", "الكل"]].concat(PARTNER_RESULTS.map(function (k) { return [k, PARTNER_RESULT_LABELS[k]]; })).map(function (t) {
    var on = ptF.res === t[0];
    return '<button role="radio" aria-checked="' + on + '" tabindex="' + (on ? 0 : -1) + '" class="' + (on ? "on" : "") + '" data-pt="res" data-v="' + t[0] + '">' + t[1] + " " + fmtN(counts[t[0]]) + "</button>";
  }).join("") + "</span></div>";
  h += '<div class="cf-t"><div class="cf-hr" role="row"><span>المنشأة</span><span>المنتج</span><span>تاريخ التواصل</span><span>النتيجة</span><span><span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">حذف</span></span></div>';
  if (!rows.length) h += '<div class="cf-state">لا نتائج «' + esc(PARTNER_RESULT_LABELS[ptF.res] || "") + "» في هذا الأسبوع.</div>";
  rows.forEach(function (r) {
    var name = r.entityId ? '<a class="in-link ac-clip" href="#account/' + r.entityId + '" title="' + esc(r.accountName) + '">' + esc(r.accountName) + "</a>" : '<span class="ac-clip" title="' + esc(r.accountName) + '">' + esc(r.accountName) + "</span>";
    h += '<div class="cf-r" data-ptrow="' + r.id + '"><span class="ac-nm">' + name + '<span class="cf-sub ac-clip">' + ptPhone(r.phone) + (r.note ? " · " + esc(clip(r.note, 60)) : "") + "</span></span>" +
      '<span class="ac-clip"><span class="pt-lbl">المنتج: </span>' + esc(r.product) + "</span>" +
      '<span class="pt-num"><span class="pt-lbl">التاريخ: </span>' + ptDay(r.contactedOn) + "</span>" + ptResultCell(r, p) + ptDelCell(r) + "</div>";
  });
  return h + "</div></section>";
}
function ptResultCell(r, p) {
  var pill = '<span class="cf-pill pr-' + r.result + '">' + esc(PARTNER_RESULT_LABELS[r.result] || r.result) + "</span>";
  if (!canChangeResult(r)) {
    var st = r.oppStage && typeof opStage === "function" ? opStage(r.oppStage).label : "";
    var linked = r.oppPartnerId !== r.partnerId;
    return '<span class="pt-rs">' + pill + '<a href="#opps/' + r.oppId + '" title="تُتابَع من «فرص البيع»">' + (linked ? "رُبط بفرصة قائمة" : "حُوّل للمبيعات") + (st ? " · " + esc(st) : "") + "</a></span>";
  }
  if (ptArm[r.id] === "interest") {
    return '<span class="pt-arm" role="group" aria-label="تأكيد التحويل"><span>يُحوَّل فرصة بيع ولا يُعدَّل بعدها.</span><button class="btn btn-teal" id="ptok' + r.id + '" data-pt="confirminterest" data-i="' + r.id + '"' + (ptBusy[r.id] ? " disabled" : "") + '>تأكيد «مهتم»</button><button class="btn btn-ghost" data-pt="cancelarm" data-i="' + r.id + '">تراجع</button></span>';
  }
  if (p.status !== "active") return '<span class="pt-rs">' + pill + "</span>";
  return '<span class="pt-rs"><label style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)" for="ptsel' + r.id + '">نتيجة ' + esc(r.accountName) + '</label><select id="ptsel' + r.id + '" data-ptres="' + r.id + '"' + (ptBusy[r.id] ? " disabled" : "") + ">" +
    PARTNER_RESULTS.map(function (k) { return '<option value="' + k + '"' + (r.result === k ? " selected" : "") + ">" + PARTNER_RESULT_LABELS[k] + "</option>"; }).join("") + "</select></span>";
}
function ptDelCell(r) {
  var pp = ptPartner(r.partnerId);
  if (pp && pp.status !== "active") return "<span></span>";
  if (!canChangeResult(r)) return '<span><button class="pt-del" disabled aria-label="لا تُحذف نتيجة حُوّلت للمبيعات" title="لا تُحذف نتيجة حُوّلت للمبيعات">' + ptIco("x") + "</button></span>";
  if (ptArm[r.id] === "del") return '<span><button class="pt-del armed" id="ptdel' + r.id + '" data-pt="del" data-i="' + r.id + '">احذف</button></span>';
  return '<span><button class="pt-del" id="ptdel' + r.id + '" data-pt="del" data-i="' + r.id + '" aria-label="حذف نتيجة ' + esc(r.accountName) + '">' + ptIco("x") + "</button></span>";
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
function ptErr(f) { return ptSheet && ptSheet.field === f && ptSheet.err ? '<span class="ferr" id="err_pt_' + f.replace(/\\./g, "_") + '" role="alert">' + ptIco("warn") + esc(ptSheet.err) + "</span>" : ""; }
function ptInp(id, label, key, value, opt) {
  opt = opt || {};
  return '<div class="cf-fl"><label for="' + id + '">' + label + (opt.req ? ' <span class="req" aria-hidden="true">*</span>' : "") + "</label>" +
    '<input class="inp" id="' + id + '" data-ptfld="' + key + '" value="' + esc(value || "") + '"' + (opt.max ? ' maxlength="' + opt.max + '"' : "") + (opt.ph ? ' placeholder="' + esc(opt.ph) + '"' : "") +
    (opt.type ? ' type="' + opt.type + '"' : "") + (opt.ltr ? ' dir="ltr"' : "") + (opt.req ? ' aria-required="true"' : "") + (opt.extra || "") + ptFld(key) + ">" +
    (opt.hint ? '<span class="hint">' + opt.hint + "</span>" : "") + ptErr(key) + "</div>";
}
function ptModal() {
  if (!ptSheet) return "";
  var s = ptSheet, cls = s.shown ? " in" : "";
  var title = s.kind === "partner" ? (s.mode === "edit" ? "تعديل الشريك" : "إضافة شريك") : s.kind === "targets" ? "المستهدف الأسبوعي — " + s.name : "تسجيل نتائج التواصل — " + s.name;
  var sub = s.kind === "partner" ? "الشريك شركة متعاقدة تتولى التواصل الأولي مع العملاء." :
    s.kind === "targets" ? "عدد المنشآت التي يتواصل معها الشريك لكل منتج في أسبوع " + ptWeekLabel(s.week, s.weekEnd) + ". اترك الحقل فارغًا لمنتج بلا مستهدف." :
    "كل «مهتم» يُحوَّل فرصة بيع لفريق المبيعات فور الحفظ، ويُضاف العميل بحالة «مقترح» إن لم يكن مسجّلًا.";
  var h = '<div class="ac-scrim' + cls + '" data-pt="close"></div><div class="ac-modal"><div class="ac-box' + cls + '" role="dialog" aria-modal="true" aria-labelledby="ptmt" aria-describedby="ptms">' +
    '<div class="mh"><div><h2 id="ptmt">' + esc(title) + '</h2><div class="s" id="ptms">' + sub + '</div></div><span class="sp"></span><button class="ac-x" data-pt="close" aria-label="إغلاق">' + ptIco("x") + "</button></div><div class=\\"mb\\">";
  if (s.kind === "partner") h += ptPartnerForm(s);
  else if (s.kind === "targets") h += ptTargetsForm(s);
  else h += ptRecordForm(s);
  h += '</div><div class="mf">';
  if (s.confirm) {
    h += '<span class="cf-err msg" role="alert">لديك تغييرات لم تُحفظ.</span><button class="btn btn-ghost" id="ptkeep" data-pt="keep">متابعة</button><button class="btn btn-ghost" data-pt="discard" style="color:var(--s-fail-text)">تجاهل التغييرات</button>';
  } else {
    var label = s.kind === "partner" ? (s.mode === "edit" ? "حفظ التعديلات" : "إضافة الشريك") : s.kind === "targets" ? "حفظ المستهدف" :
      s.mode === "paste" ? (ptPastePreview(s).ok.length ? "تسجيل " + ptPl(ptPastePreview(s).ok.length, "نتيجة واحدة", "نتيجتين", "نتائج", "نتيجة") : "تسجيل القائمة") : "تسجيل النتيجة";
    h += '<button class="btn btn-teal" id="ptsave" data-pt="save"' + (s.busy ? ' disabled aria-busy="true"' : "") + ">" + (s.busy ? "جارٍ الحفظ…" : label) + "</button>" +
      '<button class="btn btn-ghost" data-pt="close">إلغاء</button>' + (s.err && !ptFieldTarget(s.field) ? '<span class="cf-err msg" role="alert">' + ptIco("warn") + esc(s.err) + "</span>" : "");
  }
  return h + "</div></div></div>";
}
function ptPartnerForm(s) {
  var d = s.d;
  var h = '<div class="cf-g">' + ptInp("ptf_name", "اسم الشريك", "name", d.name, { req: true, max: PARTNER_NAME_MAX, ph: "مثال: شركة إجادة" }) +
    '<div class="cf-fl"><span class="cf-sub" id="ptf_kind_l">نوع الشريك <span class="req" aria-hidden="true">*</span></span><span class="pt-radio' + (s.field === "kind" ? " bad" : "") + '" role="radiogroup" aria-labelledby="ptf_kind_l" id="ptf_kind">' +
    PARTNER_KINDS.map(function (k) { return '<button role="radio" aria-checked="' + (d.kind === k) + '" data-pt="kind" data-v="' + k + '">' + PARTNER_KIND_LABELS[k] + "</button>"; }).join("") + "</span>" + ptErr("kind") + "</div></div>";
  h += '<div class="cf-g">' + ptInp("ptf_contact", "اسم المسؤول لدى الشريك", "contactName", d.contactName, { max: PARTNER_CONTACT_MAX }) +
    ptInp("ptf_phone", "الهاتف", "phone", d.phone, { ltr: true, type: "tel" }) + "</div>";
  h += '<div class="cf-g">' + ptInp("ptf_email", "البريد الإلكتروني", "email", d.email, { ltr: true, type: "email", max: PARTNER_EMAIL_MAX }) +
    ptInp("ptf_note", "ملاحظة", "note", d.note, { max: PARTNER_NOTE_MAX, ph: "مثال: متعاقد حتى نهاية 2026" }) + "</div>";
  if (s.mode === "edit") {
    h += '<div class="cf-fl"><span class="cf-sub" id="ptf_status_l">الحالة</span><span class="pt-radio" role="radiogroup" aria-labelledby="ptf_status_l">' +
      PARTNER_STATUSES.map(function (k) { return '<button role="radio" aria-checked="' + (d.status === k) + '" data-pt="status" data-v="' + k + '">' + PARTNER_STATUS_LABELS[k] + "</button>"; }).join("") +
      '</span><span class="hint">الشريك الموقوف تبقى نتائجه، ولا تُسجَّل له نتائج جديدة.</span></div>';
  }
  return h;
}
function ptTargetsForm(s) {
  var h = '<div class="in-row" style="justify-content:flex-start"><button class="ac-add" id="ptcopyprev" data-pt="copyprev"' + (s.copying ? " disabled" : "") + ">" + (s.copying ? "جارٍ النسخ…" : "انسخ مستهدف الأسبوع السابق") + "</button></div>";
  if (s.field === "targets" && s.err) h += '<div class="cf-err" role="alert">' + ptIco("warn") + esc(s.err) + "</div>";
  h += '<div class="pt-tg">';
  s.rows.forEach(function (p, i) {
    var bad = s.field === "targets." + i;
    h += '<div class="row"><label for="ptt_' + i + '">' + esc(p) + (ptIsArchived(p) ? ' <span class="cf-sub">(مؤرشف — امسح مستهدفه فقط)</span>' : "") + '</label><input class="inp" id="ptt_' + i + '" inputmode="numeric" dir="ltr" data-pttg="' + esc(p) + '" value="' + esc(s.d[p] || "") + '" placeholder="—"' +
      (bad ? ' aria-invalid="true" aria-describedby="err_pt_tg"' : "") + "></div>" + (bad ? '<span class="ferr cf-err" id="err_pt_tg" role="alert">' + ptIco("warn") + esc(s.err) + "</span>" : "");
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
  var h = '<span class="vtog" role="radiogroup" aria-label="طريقة التسجيل"><button role="radio" aria-checked="' + (s.mode === "one") + '" class="' + (s.mode === "one" ? "on" : "") + '" data-pt="mode" data-v="one">نتيجة واحدة</button>' +
    '<button role="radio" aria-checked="' + (s.mode === "paste") + '" class="' + (s.mode === "paste" ? "on" : "") + '" data-pt="mode" data-v="paste">لصق قائمة</button></span>';
  h += '<div class="cf-g"><div class="cf-fl"><label for="ptr_product">المنتج <span class="req" aria-hidden="true">*</span></label><select id="ptr_product" data-ptfld="product"' + ptFld("product") + '><option value="">— اختر المنتج —</option>' +
    ptData.products.map(function (p) { return '<option value="' + esc(p) + '"' + (d.product === p ? " selected" : "") + ">" + esc(p) + "</option>"; }).join("") + "</select>" + ptErr("product") + "</div>" +
    ptInp("ptr_date", "تاريخ التواصل", "contactedOn", d.contactedOn, { req: true, type: "date", extra: ' max="' + ptData.today + '"' }) + "</div>";
  if (s.mode === "one") {
    h += '<div class="cf-g">' + ptInp("ptr_name", "اسم المنشأة", "accountName", d.accountName, { req: true, max: RESULT_NAME_MAX, ph: "مثال: مستشفى الأمل" }) +
      ptInp("ptr_phone", "جوال المنشأة", "phone", d.phone, { req: true, ltr: true, type: "tel", ph: "05xxxxxxxx", hint: "به يرتبط العميل بحسابه وفرصه" }) + "</div>";
    h += '<div class="cf-fl"><span class="cf-sub" id="ptr_result_l">النتيجة <span class="req" aria-hidden="true">*</span></span><span class="pt-radio' + (s.field === "result" ? " bad" : "") + '" role="radiogroup" aria-labelledby="ptr_result_l" id="ptr_result">' +
      PARTNER_RESULTS.map(function (k, i) { return '<button role="radio" aria-checked="' + (d.result === k) + '" tabindex="' + (d.result === k || (!d.result && i === 0) ? 0 : -1) + '" data-pt="result" data-v="' + k + '">' + PARTNER_RESULT_LABELS[k] + "</button>"; }).join("") + "</span>" +
      (d.result === "interested" ? '<span class="hint">يُحوَّل فرصة بيع لفريق المبيعات فور الحفظ.</span>' : "") + ptErr("result") + "</div>";
    h += ptInp("ptr_note", "ملاحظة", "note", d.note, { max: RESULT_NOTE_MAX });
  } else {
    h += '<div class="cf-fl"><label for="ptr_paste">القائمة <span class="req" aria-hidden="true">*</span></label><textarea class="pt-paste" id="ptr_paste" data-ptfld="paste" dir="auto" placeholder="مستشفى الأمل، 0551234567، مهتم&#10;عيادة النور، 0559876543، لم يرد، اتصلنا مرتين">' + esc(s.paste) + "</textarea>" +
      '<span class="hint">سطر لكل منشأة: الاسم، الجوال، النتيجة (مهتم / غير مهتم / لم يرد)، ثم ملاحظة اختيارية. يُقبل النسخ من جدول.</span>' + ptErr("paste") + "</div>";
    var pv = ptPastePreview(s);
    if (s.paste.trim()) {
      h += '<div class="pt-prev" aria-live="polite"><span class="ok">' + (pv.ok.length ? ptPl(pv.ok.length, "نتيجة واحدة جاهزة", "نتيجتان جاهزتان", "نتائج جاهزة", "نتيجة جاهزة") : "لا نتيجة جاهزة") + " للتسجيل" + (pv.ok.filter(function (x) { return x.value.result === "interested"; }).length ? " · مهتمون يُحوَّلون للمبيعات: " + fmtN(pv.ok.filter(function (x) { return x.value.result === "interested"; }).length) : "") + "</span>" +
        pv.bad.slice(0, 8).map(function (b) { return '<span class="bad">السطر ' + fmtN(b.line) + ": " + esc(b.reason) + "</span>"; }).join("") +
        (pv.bad.length > 8 ? '<span class="bad">و' + ptPl(pv.bad.length - 8, "سطر آخر فيه خطأ", "سطران آخران فيهما أخطاء", "أسطر أخرى فيها أخطاء", "سطرًا آخر فيها أخطاء") + ".</span>" : "") + "</div>";
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
    var tb = ev.target && ev.target.closest ? ev.target.closest(".pt-tab") : null;
    if (tb && ptData && (ev.key === "ArrowLeft" || ev.key === "ArrowRight" || ev.key === "Home" || ev.key === "End")) {
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
