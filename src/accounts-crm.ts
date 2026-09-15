// accounts-crm.ts — «العملاء» as ACCOUNTS (client A, BRD v1.0 §9, slice S2): the list the prototype drew
// (العميل · المدينة · القطاع · الموظف المسؤول · مصدر الإضافة · الحالة · عدد الفرص · قيمة الفرص) with its
// الكل / معتمدون / مقترحون tabs, the «إضافة عميل جديد» sheet with repeatable contacts, and the account
// record (#account/<id>) that opens for a customer who has never written to us.
//
// GRAMMAR. The table is the settings table (.cf-sec/.cf-hr/.cf-r), tiles are .crm-kpi, pills .cf-pill,
// segmented tabs .vtog, fields .cf-fl. Rules come from account-domain (ACCOUNT_DOMAIN_JS): the sheet and
// the server refuse the same input with the same sentence.
//
// MOTION (emil-design-eng). The sheet enters from 0.96 scale + opacity over 200ms with a strong ease-out
// and leaves faster (140ms); it is a modal, so it scales from the centre. Buttons press to 0.97. Nothing
// animates on keyboard actions or on repaint, and reduced motion keeps only the opacity fade.
//
// NO BACKTICKS ANYWHERE IN THIS FILE, comments included: it is one template literal.

export const ACCOUNTS_CRM_CSS = `
.ac { display:flex; flex-direction:column; gap:var(--s3); container-type:inline-size; container-name:acw; }
.ac .crm-kpis { margin-block-end:0; }
.ac .crm-kpi.crm-click { cursor:pointer; text-align:start; font-family:inherit; border:none; }
.ac-bar { display:flex; align-items:center; gap:var(--s2); flex-wrap:wrap; padding:var(--s2) var(--s4); border-bottom:1px solid var(--line-soft); }
.ac-bar .sp { flex:1; }
.ac-f { display:flex; align-items:center; gap:var(--s2); flex-wrap:wrap; padding:var(--s2) var(--s4); border-bottom:1px solid var(--line-soft); background:var(--surface); }
.ac-f select { font-family:inherit; height:34px; max-width:180px; font-size:var(--t-xs); color:var(--ink); background:var(--paper); border:none;
  box-shadow:inset 0 0 0 1px var(--s-off-mark); border-radius:var(--r-sm); padding-inline:8px; }
.ac-f select.on { box-shadow:inset 0 0 0 1px var(--accent-mark); background:var(--accent-tint); color:var(--accent-deep); }
.ac-f .lnk { font-family:inherit; font-size:var(--t-xs); font-weight:600; color:var(--accent-deep); background:none; border:none; padding:0 4px; cursor:pointer; min-height:28px; border-radius:var(--r-sm); }
.ac-pend { font-size:var(--t-xs); font-weight:600; color:var(--s-attn-text); background:var(--s-attn-soft); border-radius:var(--r-pill); padding:4px 12px; font-variant-numeric:tabular-nums; }
.ac-t .cf-hr, .ac-t .cf-r { grid-template-columns:minmax(200px,2.2fr) minmax(0,.8fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1.1fr) 124px 44px 100px; column-gap:var(--s2); }
.ac-who { display:flex; align-items:center; gap:var(--s2); min-width:0; }
.ac-av { width:34px; height:34px; flex:none; border-radius:var(--r-pill); background:var(--accent-tint); color:var(--accent-deep); font-weight:600; font-size:var(--t-sm);
  display:flex; align-items:center; justify-content:center; }
.ac-av.lg { width:52px; height:52px; font-size:var(--t-lg); }
.ac-nm { display:flex; flex-direction:column; gap:2px; min-width:0; }
.ac-nm .top { display:flex; align-items:center; gap:6px; flex-wrap:nowrap; min-width:0; }
.ac-nm .cf-sub .cf-pill { padding:0 7px; font-size:var(--t-xs); margin-inline-end:2px; }
.ac-hd h1:focus { outline:none; }
.ac-clip { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0; }
.ac-num { font-variant-numeric:tabular-nums; }
.ac-lbl { display:none; font-size:var(--t-xs); color:var(--muted); }
.cf-pill.imp-high { background:var(--s-fail-soft); color:var(--s-fail-text); }
.cf-pill.imp-medium { background:var(--s-attn-soft); color:var(--s-attn-text); }
.cf-pill.imp-low { background:var(--surface-2); color:var(--muted); }
.cf-pill.ap-proposed { background:var(--s-attn-soft); color:var(--s-attn-text); }
.cf-pill.ap-approved { background:var(--accent-tint); color:var(--accent-deep); }
.cf-pill.ap-rejected { background:var(--surface-2); color:var(--muted); }
.ac-dec { display:flex; gap:6px; }
.ac-dec .btn { height:30px; padding-inline:10px; font-size:var(--t-xs); }
.ac-dec .ok { background:var(--accent-tint); color:var(--accent-deep); }
.ac-dec .no { background:var(--paper); color:var(--s-fail-text); box-shadow:inset 0 0 0 1px var(--s-fail-soft); }
.ac-newtop { display:inline-flex; align-items:center; gap:6px; height:32px; padding:0 12px; border-radius:var(--r-sm); font-size:var(--t-sm); white-space:nowrap; }
.ac-newtop .sm { display:none; }
@media (max-width: 560px) { .ac-newtop .lg { display:none; } .ac-newtop .sm { display:inline; } }
.ac-num, .ac-li .val { white-space:nowrap; }
.ac-more { display:flex; justify-content:center; padding:var(--s3); border-top:1px solid var(--line-soft); }
.ac .btn, .ac-modal .btn { transition:transform 140ms var(--ease), background var(--fast) var(--ease), color var(--fast) var(--ease); }
.ac .btn:active, .ac-modal .btn:active, .ac-f .lnk:active { transform:scale(.97); }
.ac a:focus-visible, .ac button:focus-visible, .ac select:focus-visible, .ac-modal button:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }

/* ---- the account record ---- */
.ac-back { align-self:flex-start; font-size:var(--t-sm); font-weight:500; color:var(--accent-deep); text-decoration:none; padding:4px 0; }
.ac-hd { background:var(--paper); border:1px solid var(--line); border-radius:var(--r-lg); padding:var(--s4); display:flex; gap:var(--s3); flex-wrap:wrap; align-items:flex-start; }
.ac-hd .main { flex:1; min-width:240px; display:flex; flex-direction:column; gap:6px; }
.ac-hd h1 { margin:0; font-size:var(--t-xl); font-weight:600; color:var(--ink); line-height:var(--lh-tight); }
.ac-hd .meta { font-size:var(--t-xs); color:var(--muted); line-height:1.8; }
.ac-hd .acts { display:flex; gap:var(--s2); flex-wrap:wrap; align-items:center; }
.ac-hd .acts .btn { height:36px; text-decoration:none; display:inline-flex; align-items:center; gap:6px; }
.ac-banner { display:flex; align-items:center; gap:var(--s3); flex-wrap:wrap; border-radius:var(--r-md); padding:var(--s3) var(--s4); font-size:var(--t-sm); line-height:1.7;
  background:var(--s-attn-soft); color:var(--s-attn-text); }
.ac-banner.rej { background:var(--surface-2); color:var(--ink); }
.ac-banner .tx { flex:1; min-width:220px; }
.ac-banner .btn { height:34px; }
.ac-grid { display:grid; grid-template-columns:minmax(0,1.55fr) minmax(0,1fr); gap:var(--s3); align-items:start; }
.ac-col { display:flex; flex-direction:column; gap:var(--s3); min-width:0; }
.ac-card { background:var(--paper); border:1px solid var(--line); border-radius:var(--r-lg); overflow:hidden; }
.ac-card .hd { display:flex; align-items:center; gap:var(--s2); flex-wrap:wrap; padding:var(--s3) var(--s4); border-bottom:1px solid var(--line-soft); }
.ac-card .hd h2 { margin:0; font-size:var(--t-md); font-weight:600; color:var(--ink); }
.ac-card .hd .s { font-size:var(--t-xs); color:var(--muted); font-variant-numeric:tabular-nums; }
.ac-card .hd .sp { flex:1; }
.ac-card .hd a, .ac-card .hd .lnk { font-family:inherit; font-size:var(--t-xs); font-weight:600; color:var(--accent-deep); background:none; border:none; cursor:pointer; text-decoration:none; padding:0; }
.ac-card .bd { padding:var(--s2) var(--s4); }
.ac-card .empty { padding:var(--s3) 0; font-size:var(--t-sm); color:var(--muted); line-height:1.7; }
.ac-li { display:flex; align-items:center; gap:var(--s2); flex-wrap:wrap; padding:10px 0; border-bottom:1px solid var(--line-soft); font-size:var(--t-sm); color:var(--ink); min-width:0; }
.ac-li:last-child { border-bottom:none; }
.ac-li .grow { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
.ac-li .sub { font-size:var(--t-xs); color:var(--muted); line-height:1.6; }
.ac-li .val { font-variant-numeric:tabular-nums; font-weight:600; }
.ac-li a { color:var(--ink); text-decoration:none; font-weight:500; }
.ac-li a:hover { color:var(--accent-deep); text-decoration:underline; text-underline-offset:3px; }
.ac-stage { font-size:var(--t-xs); font-weight:600; border-radius:var(--r-pill); padding:2px 9px; background:var(--tn-soft); color:var(--tn-text); white-space:nowrap; }
.ac-person .ac-av { width:36px; height:36px; }
.ac-person .reach { display:flex; gap:4px 12px; flex-wrap:wrap; font-size:var(--t-xs); color:var(--muted); }
.ac-person .reach a { color:var(--accent-deep); font-weight:400; }
.ac-owner { display:flex; align-items:center; gap:var(--s2); padding:var(--s3) var(--s4); }
.ac-owner .nm { font-size:var(--t-sm); font-weight:600; color:var(--ink); }
.ac-owner .rl { font-size:var(--t-xs); color:var(--muted); }
.ac-ev { display:grid; grid-template-columns:10px minmax(0,1fr) auto; gap:var(--s2); align-items:baseline; padding:9px 0; border-bottom:1px solid var(--line-soft); font-size:var(--t-sm); }
.ac-ev:last-child { border-bottom:none; }
.ac-ev i { width:8px; height:8px; border-radius:var(--r-pill); background:var(--s-off-mark); display:block; transform:translateY(1px); }
.ac-ev i.c { background:var(--accent); } .ac-ev i.t { background:var(--s-attn-mark); } .ac-ev i.n { background:var(--s-issued-mark, var(--accent-mark)); }
.ac-ev .tx { min-width:0; color:var(--ink); line-height:1.6; }
.ac-ev .tx .sub { display:block; font-size:var(--t-xs); color:var(--muted); }
.ac-ev time { font-size:var(--t-xs); color:var(--muted); white-space:nowrap; }

/* ---- the add / edit sheet (a modal: it scales from the centre) ---- */
.ac-scrim { position:fixed; inset:0; background:rgba(16,24,40,.42); z-index:var(--z-overlay); opacity:0; transition:opacity 140ms var(--ease); }
.ac-scrim.in { opacity:1; transition-duration:200ms; }
.ac-modal { position:fixed; inset:0; z-index:var(--z-modal); display:flex; align-items:flex-start; justify-content:center; padding:6vh var(--s3) var(--s3); pointer-events:none; overflow:auto; }
.ac-box { pointer-events:auto; width:100%; max-width:680px; background:var(--paper); border:1px solid var(--line); border-radius:var(--r-lg);
  box-shadow:0 24px 60px rgba(16,24,40,.22); display:flex; flex-direction:column; max-height:88vh; opacity:0; transform:scale(.96);
  transition:opacity 140ms cubic-bezier(.23,1,.32,1), transform 140ms cubic-bezier(.23,1,.32,1); }
.ac-box.in { opacity:1; transform:none; transition-duration:200ms; }
.ac-box .mh { display:flex; align-items:flex-start; gap:var(--s2); padding:var(--s4) var(--s4) var(--s3); border-bottom:1px solid var(--line-soft); }
.ac-box .mh h2 { margin:0; font-size:var(--t-lg); font-weight:600; color:var(--ink); }
.ac-box .mh .s { font-size:var(--t-xs); color:var(--muted); line-height:1.6; margin-top:2px; }
.ac-box .mh .sp { flex:1; }
.ac-x { width:36px; height:36px; flex:none; border-radius:var(--r-sm); border:none; background:none; color:var(--muted); cursor:pointer; display:flex; align-items:center; justify-content:center; }
.ac-x:hover { background:var(--surface); color:var(--ink); }
.ac-box .mb { padding:var(--s3) var(--s4); overflow:auto; display:flex; flex-direction:column; gap:var(--s3); }
.ac-box .gl { font-size:var(--t-sm); font-weight:600; color:var(--ink); display:flex; align-items:center; gap:var(--s2); }
.ac-box .gl .sp { flex:1; }
.ac-box .cf-fl .req { color:var(--s-fail-text); }
.ac-box .cf-fl .ferr { font-size:var(--t-xs); color:var(--s-fail-text); display:flex; align-items:center; gap:4px; }
.ac-box .cf-fl select[aria-invalid="true"] { box-shadow:inset 0 0 0 2px var(--s-fail); }
.ac-box .ro { font-size:var(--t-sm); color:var(--ink); height:38px; display:flex; align-items:center; }
.ac-ct { border:1px solid var(--line); border-radius:var(--r-md); padding:var(--s3); display:flex; flex-direction:column; gap:var(--s2); background:var(--paper); }
.ac-ct.primary { box-shadow:inset 0 0 0 1px var(--accent-mark); background:var(--accent-wash); }
.ac-ct .ch { display:flex; align-items:center; gap:var(--s2); font-size:var(--t-xs); color:var(--muted); font-weight:600; }
.ac-ct .ch .sp { flex:1; }
.ac-ct .pr { font-family:inherit; font-size:var(--t-xs); font-weight:600; border:none; border-radius:var(--r-pill); padding:0 10px; min-height:28px; cursor:pointer;
  background:var(--paper); color:var(--muted); box-shadow:inset 0 0 0 1px var(--s-off-mark); }
.ac-ct .pr[aria-pressed="true"] { background:var(--accent); color:var(--on-accent, #FFFFFF); box-shadow:none; }
.ac-ct .rm { font-family:inherit; font-size:var(--t-xs); font-weight:600; color:var(--s-fail-text); background:none; border:none; cursor:pointer; min-height:28px; padding:0 6px; border-radius:var(--r-sm); }
.ac-ct .rm:disabled { color:var(--s-off-text); cursor:default; }
.ac-add { align-self:flex-start; font-family:inherit; font-size:var(--t-xs); font-weight:600; color:var(--accent-deep); background:var(--accent-tint); border:none;
  border-radius:var(--r-pill); padding:0 12px; min-height:30px; cursor:pointer; display:inline-flex; align-items:center; gap:4px; }
.ac-add svg { width:14px; height:14px; }
.ac-box .mf { display:flex; align-items:center; gap:var(--s2); flex-wrap:wrap; padding:var(--s3) var(--s4); border-top:1px solid var(--line-soft); }
.ac-box .mf .btn { height:38px; }
.ac-box .mf .msg { flex-basis:100%; }
@container acw (max-width: 900px) {
  .ac-t .cf-hr { display:none; }
  .ac-t .cf-r { grid-template-columns:minmax(0,1fr) auto; row-gap:6px; padding-block:var(--s3); }
  .ac-t .cf-r > * { min-width:0; }
  .ac-t .cf-r > .ac-who { grid-column:1 / -1; }
  .ac-lbl { display:inline; }
  .ac-grid { grid-template-columns:minmax(0,1fr); }
}
@media (max-width: 560px) { .ac-modal { padding:0; align-items:stretch; } .ac-box { max-width:none; max-height:none; min-height:100%; border-radius:0; } }
@media (pointer:coarse) {
  .ac-f select, .ac-dec .btn, .ac-f .lnk, .ac-ct .pr, .ac-ct .rm, .ac-add, .ac-card .hd a, .ac-card .hd .lnk { min-height:44px; }
}
@media (prefers-reduced-motion: reduce) {
  .ac-box { transform:none; transition:opacity 140ms linear; }
  .ac .btn, .ac-modal .btn { transition:none; }
  .ac .btn:active, .ac-modal .btn:active, .ac-f .lnk:active { transform:none; }
}
`;

export const ACCOUNTS_CRM_JS = `
/* ================= «العملاء» — accounts ================= */
var acRows = null, acMembers = [], acLoading = false, acFailed = false, acPending = false;
var acF = { q: "", tab: "all", product: "", sector: "", city: "", owner: "", importance: "", ind: "" };
var acShown = 100;
var acBusy = {};        /* account id -> true while an approval is being written */
var acRec = null;       /* { id, data, failed } — the account record */
var acForm = null;      /* the add / edit sheet */
var AC_PAGE = 100;

function acPl(n, one, two, few, many) { return pluralizeArabic(n, one, two, few, many, fmtN); }
function acNCust(n) { return acPl(n, "عميل واحد", "عميلان", "عملاء", "عميلًا"); }
function acNPerson(n) { return acPl(n, "شخص واحد", "شخصان", "أشخاص", "شخصًا"); }
function acNOpp(n) { return acPl(n, "فرصة واحدة", "فرصتان", "فرص", "فرصة"); }
function acNCamp(n) { return acPl(n, "حملة واحدة", "حملتان", "حملات", "حملة"); }
function acIco(n) { return typeof opIco === "function" ? opIco(n) : ""; }
function acToast(m, bad, act, fn) { if (typeof opToast === "function") opToast(m, bad, act, fn); else alertBar(m, bad); }
function acRoute() { return (location.hash || "").slice(1); }
/* The shared admin token signs as «اللوحة». «المسؤول» would read as the account OWNER on this screen. */
function acBy(b) { return !b || b === "اللوحة" ? "مدير النظام" : b; }
function acDate(ms) {
  if (!ms) return "—";
  var d = new Date(Number(ms));
  /* The year only when it is not this one: «15 سبتمبر 2026» truncated in a 132px column. */
  var o = d.getFullYear() === new Date().getFullYear() ? { day: "numeric", month: "long" } : { day: "numeric", month: "short", year: "numeric" };
  return d.toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", o);
}
function acMoney(v) { return typeof opMoney === "function" ? opMoney(v) : fmtN(Math.round(Number(v) || 0)) + " ر.س"; }
/* The initial a reader recognises: «م. فهد العمري» is F, not the title's م. */
function acIni(name) {
  var s = String(name || "").trim().replace(/^(م|د|أ|ا|أ\\.د)\\.\\s*/, "");
  return esc(s.charAt(0) || "؟");
}
function acImpPill(imp) { return imp ? '<span class="cf-pill imp-' + imp + '">أهمية ' + esc(ACCOUNT_IMPORTANCE_LABELS[imp] || imp) + "</span>" : ""; }
function acApprPill(ap) { return '<span class="cf-pill ap-' + ap + '">' + esc(ACCOUNT_APPROVAL_LABELS[ap] || ap) + "</span>"; }
function acSource(a) { return a.source ? ACCOUNT_SOURCE_LABELS[a.source] || a.source : "غير مسجّل"; }
function acRowById(id) { return (acRows || []).filter(function (r) { return String(r.id) === String(id); })[0] || null; }

/* Every arrival on the list re-reads it: accounts are also created by imports, the indicator form, WhatsApp
   and new opportunities, and a list loaded once per session showed none of them (review). The rows already
   held stay painted while the fresh read runs. The sheet and the record belong to the route they were
   opened on, like the indicators drawer: leaving drops them. */
var acStale = true, acRoute0 = "";
window.addEventListener("hashchange", function () {
  var r = acRoute();
  if (r === acRoute0) return;
  acRoute0 = r;
  acStale = true;
  if (acForm) acForm = null;
  if (acRec && r !== "account/" + acRec.id) acRec = null;
});
function acLoad(force) {
  if (acLoading) { if (force) acPending = true; return; }
  if (acRows && !force) return;
  if (acFailed && !force) return;
  acLoading = true;
  pxGet("/admin/accounts").then(function (j) { acRows = j.accounts || []; acMembers = j.members || []; acFailed = false; })
    .catch(function () { acFailed = true; })
    .then(function () {
      acLoading = false;
      if (acPending) { acPending = false; acLoad(true); return; }
      render(false);
    });
}
/* After a write, the global customer book the wizard and #targets read is refreshed too, so a customer
   added here is selectable in a campaign without a reload. */
function acRefreshEntities() {
  fetch("/admin/entities", { headers: { "x-admin-token": TOKEN } }).then(function (r) { return r.ok ? r.json() : null; })
    .then(function (list) { if (list) entities = list; }).catch(function () {});
}

/* ---------------- the list ---------------- */
function acProducts(a) {
  var seen = {}, out = [];
  [a.productTags || [], a.usesProducts || [], a.oppProducts || []].forEach(function (l) { l.forEach(function (p) { if (!seen[p]) { seen[p] = 1; out.push(p); } }); });
  return out;
}
function acIndSet() {
  if (!acF.ind || typeof inMemSets === "undefined" || !inMembership) return null;
  return inMemSets[acF.ind] || {};
}
function acFiltered(tabOverride) {
  var set = acIndSet();
  var f = { q: acF.q, tab: tabOverride || acF.tab, product: acF.product, sector: acF.sector, city: acF.city, owner: acF.owner, importance: acF.importance, inIndicator: set };
  return (acRows || []).filter(function (a) {
    return accountMatches({ id: a.id, name: a.name, phone: a.phone, city: a.city, sector: a.sector, importance: a.importance, ownerId: a.ownerId,
      approval: a.approval, products: acProducts(a), contactText: a.contactText }, f);
  });
}
function acDistinct(key) {
  var c = {};
  (acRows || []).forEach(function (a) { var v = a[key]; if (v) c[v] = (c[v] || 0) + 1; });
  return Object.keys(c).sort(function (x, y) { return c[y] - c[x] || (x < y ? -1 : 1); });
}
function acSel(key, label, value, opts) {
  return '<select aria-label="' + label + '" data-acset="' + key + '"' + (value ? ' class="on"' : "") + '><option value="">' + label + ": الكل</option>" +
    opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(value) === String(o[0]) ? " selected" : "") + ">" + esc(clip(o[1], 28)) + "</option>"; }).join("") + "</select>";
}
function acKpis() {
  var all = (acRows || []).filter(function (a) { return a.approval !== "rejected"; });
  var pending = all.filter(function (a) { return a.approval === "proposed"; }).length;
  var noOwner = all.filter(function (a) { return a.ownerId == null; }).length;
  var value = all.reduce(function (s, a) { return s + (a.opps ? a.opps.value : 0); }, 0);
  var openN = all.reduce(function (s, a) { return s + (a.opps ? a.opps.open : 0); }, 0);
  var wonN = all.reduce(function (s, a) { return s + (a.opps ? a.opps.won : 0); }, 0);
  var tile = function (k, v, s, lead, act) {
    var open = act ? '<button class="crm-kpi crm-click' + (lead ? " crm-lead" : "") + '" data-ac="' + act + '">' : '<div class="crm-kpi' + (lead ? " crm-lead" : "") + '">';
    return open + '<div class="crm-k">' + k + '</div><div class="crm-v">' + v + "</div>" + (s ? '<div class="crm-s">' + s + "</div>" : "") + (act ? "</button>" : "</div>");
  };
  return '<div class="crm-kpis crm-hasLead">' +
    tile("العملاء", fmtN(all.length), "معتمدون: " + fmtN(all.length - pending), true) +
    tile("بانتظار الاعتماد", fmtN(pending), pending ? "اعرضهم" : "لا أحد", false, pending ? "tabproposed" : "") +
    tile("بلا موظف مسؤول", fmtN(noOwner), noOwner ? "اعرضهم" : "", false, noOwner ? "noowner" : "") +
    /* The value includes won lines (the list column does too), so the caption names both, as counts
       that need no noun agreement (review: «فرصتان قائمة»). */
    tile("قيمة الفرص", acMoney(value), "قائمة: " + fmtN(openN) + " · رابحة: " + fmtN(wonN), false) + "</div>";
}
function acDecisionCell(a) {
  if (a.approval !== "proposed") return "<span>" + acApprPill(a.approval) + "</span>";
  var busy = !!acBusy[a.id];
  return '<span class="ac-dec"><button class="btn ok" data-ac="approve" data-i="' + a.id + '" id="acap' + a.id + '"' + (busy ? ' disabled aria-busy="true"' : "") + ' aria-label="اعتماد ' + esc(a.name) + '">اعتماد</button>' +
    '<button class="btn no" data-ac="reject" data-i="' + a.id + '" id="acrj' + a.id + '"' + (busy ? " disabled" : "") + ' aria-label="رفض ' + esc(a.name) + '">رفض</button></span>';
}
function acRow(a) {
  var pc = a.primaryContact;
  var h = '<div class="cf-r" data-acrow="' + a.id + '">';
  h += '<span class="ac-who"><span class="ac-av" aria-hidden="true">' + acIni(a.name) + '</span><span class="ac-nm"><span class="top">' +
    '<a class="in-link ac-clip" href="#account/' + a.id + '" title="' + esc(a.name) + '">' + esc(a.name) + "</a></span>" +
    /* Importance rides the second line: on the first it took the width the name needs (a 200px cell at 1280). */
    '<span class="cf-sub ac-clip">' + (a.importance ? acImpPill(a.importance) + " " : "") + (pc ? esc(pc.name) + (pc.role ? " · " + esc(pc.role) : "") + (a.contactCount > 1 ? " · +" + fmtN(a.contactCount - 1) : "") : "لا جهة اتصال مسجّلة") + "</span></span></span>";
  h += '<span class="ac-clip"><span class="ac-lbl">المدينة: </span>' + (a.city ? esc(a.city) : '<span class="cf-sub">—</span>') + "</span>";
  h += '<span class="ac-clip"><span class="ac-lbl">القطاع: </span>' + (a.sector ? esc(a.sector) : '<span class="cf-sub">—</span>') + "</span>";
  h += '<span class="ac-clip"><span class="ac-lbl">المسؤول: </span>' + (a.ownerName ? esc(a.ownerName) : '<span class="cf-sub">بلا مسؤول</span>') + "</span>";
  h += '<span class="ac-nm"><span class="ac-clip' + (a.source ? "" : " cf-sub") + '">' + esc(acSource(a)) + '</span><span class="cf-sub ac-clip">' + (a.createdBy ? esc(acBy(a.createdBy)) + " · " : "") + acDate(a.createdAt) + "</span></span>";
  h += acDecisionCell(a);
  h += '<span class="ac-num"><span class="ac-lbl">الفرص: </span>' + (a.opps.count ? fmtN(a.opps.count) : '<span class="cf-sub">—</span>') + "</span>";
  h += '<span class="ac-num"><span class="ac-lbl">القيمة: </span>' + (a.opps.value ? acMoney(a.opps.value) : '<span class="cf-sub">—</span>') + "</span>";
  return h + "</div>";
}
function acPaintCrumb() {
  var act = document.getElementById("crumbact");
  if (!act) return;
  var r = acRoute().split("/")[0];
  if (r !== "accounts" && r !== "account") return;
  /* Painted once per route: rebuilding it on every paint destroyed the button the sheet returns focus to. */
  if (document.getElementById("acnewtop")) return;
  act.innerHTML = '<button class="btn btn-teal ac-newtop" id="acnewtop" data-ac="new" aria-label="إضافة عميل جديد">' + acIco("plus") + '<span class="lg">إضافة عميل جديد</span><span class="sm">عميل</span></button>';
}
function vAccounts() {
  if (acStale) { acStale = false; acLoad(!!acRows); } else acLoad(false);
  if (typeof inMemLoad === "function") inMemLoad();
  acRec = null;
  setTimeout(acPaintCrumb, 0);
  var h = '<div class="ac">';
  if (acRows === null && !acFailed) return h + '<section class="cf-sec"><div class="cf-state" aria-busy="true">جارٍ تحميل العملاء…</div></section></div>' + acModal();
  if (acRows === null) return h + '<section class="cf-sec"><div class="cf-state" role="alert">تعذّر تحميل العملاء.<button class="btn btn-ghost" data-ac="retry">أعد المحاولة</button></div></section></div>' + acModal();
  if (acFailed) h += '<section class="cf-sec"><div class="cf-state" role="alert">' + acIco("warn") + 'تعذّر التحديث — المعروض آخر نسخة محمّلة.<button class="btn btn-ghost" data-ac="retry">أعد المحاولة</button></div></section>';
  if (!acRows.length) {
    return h + '<section class="cf-sec"><div class="crm-empty" style="padding:var(--s5,32px) var(--s4)"><b>لا عملاء بعد</b>' +
      "العميل منشأة تبيع لها Lean: اسمها ومدينتها وقطاعها وأهميتها ومن يتولاها والأشخاص فيها. أضفه يدويًا، أو استورد قائمة من «جهات الاستهداف»." +
      '<div class="in-row" style="margin-top:var(--s3)"><button class="btn btn-teal" id="acnewempty" data-ac="new" style="display:inline-flex;align-items:center;gap:6px">' + acIco("plus") + "إضافة عميل جديد</button>" +
      '<a class="btn btn-ghost" href="#targets" style="text-decoration:none;display:inline-flex;align-items:center">استيراد من ملف</a></div></div></section></div>' + acModal();
  }
  h += acKpis();
  var counts = { all: acFiltered("all").length, approved: acFiltered("approved").length, proposed: acFiltered("proposed").length, rejected: acFiltered("rejected").length };
  var rows = acFiltered();
  /* «M» is the tab before search and filters, so «من» says how much the filters hid (review). */
  var tabTotal = (acRows || []).filter(function (a) { return acF.tab === "all" ? a.approval !== "rejected" : a.approval === acF.tab; }).length;
  var tabs = [["all", "الكل"], ["approved", "معتمدون"], ["proposed", "مقترحون"], ["rejected", "مرفوضون"]];
  h += '<section class="cf-sec ac-t"><div class="ac-bar">' +
    '<span class="vtog" role="radiogroup" aria-label="حالة الاعتماد">' + tabs.map(function (t) {
      var on = acF.tab === t[0];
      return '<button role="radio" aria-checked="' + on + '" tabindex="' + (on ? 0 : -1) + '" class="' + (on ? "on" : "") + '" data-ac="tab" data-v="' + t[0] + '">' + t[1] + " " + fmtN(counts[t[0]]) + "</button>";
    }).join("") + "</span>" +
    (counts.proposed && acF.tab !== "proposed" ? '<span class="ac-pend">' + acNCust(counts.proposed) + " بانتظار الاعتماد</span>" : "") +
    '<span class="sp"></span><input class="in-q" id="acq" value="' + esc(acF.q) + '" placeholder="بحث بالاسم أو جهة الاتصال…" aria-label="بحث في العملاء" data-acset="q"></div>';
  var prods = {}; acRows.forEach(function (a) { acProducts(a).forEach(function (p) { prods[p] = 1; }); });
  var anyF = acF.product || acF.sector || acF.city || acF.owner || acF.importance || acF.ind;
  h += '<div class="ac-f">' +
    acSel("product", "المنتج", acF.product, Object.keys(prods).sort().map(function (p) { return [p, p]; })) +
    acSel("sector", "القطاع", acF.sector, acDistinct("sector").map(function (s) { return [s, s]; })) +
    acSel("city", "المدينة", acF.city, acDistinct("city").map(function (s) { return [s, s]; })) +
    acSel("owner", "المسؤول", acF.owner, [["none", "بلا مسؤول"]].concat(acMembers.map(function (m) { return [String(m.id), m.name]; }))) +
    acSel("importance", "الأهمية", acF.importance, ACCOUNT_IMPORTANCE.map(function (k) { return [k, ACCOUNT_IMPORTANCE_LABELS[k]]; })) +
    (typeof inIndOptions === "function" && (inMembership || []).length ? '<select aria-label="مؤشر الاستخدام" data-acset="ind"' + (acF.ind ? ' class="on"' : "") + '><option value="">المؤشر: الكل</option>' + inIndOptions(acF.ind, true) + "</select>" : "") +
    (anyF ? '<button class="lnk" data-ac="clearf">مسح التصفية</button>' : "") +
    '<span class="sp" style="flex:1"></span><span class="cntpill">' + fmtN(rows.length) + " من " + fmtN(tabTotal) + "</span></div>";
  h += '<div class="cf-t"><div class="cf-hr" role="row"><span>العميل</span><span>المدينة</span><span>القطاع</span><span>الموظف المسؤول</span><span>مصدر الإضافة</span><span>الحالة</span><span>الفرص</span><span>قيمة الفرص</span></div>';
  if (!rows.length) {
    h += '<div class="cf-state">' + (acF.q ? "لا عميل يطابق «" + esc(acF.q) + "»." : acF.tab === "proposed" ? "لا عملاء بانتظار الاعتماد." : acF.tab === "rejected" ? "لا عملاء مرفوضون." : "لا عملاء يطابقون هذه التصفية.") +
      (anyF || acF.q ? '<button class="btn btn-ghost" data-ac="clearall">مسح البحث والتصفية</button>' : "") + "</div>";
  }
  rows.slice(0, acShown).forEach(function (a) { h += acRow(a); });
  h += "</div>";
  if (rows.length > acShown) h += '<div class="ac-more"><button class="btn btn-ghost" data-ac="more">عرض ' + fmtN(Math.min(AC_PAGE, rows.length - acShown)) + " أخرى (المعروض " + fmtN(acShown) + " من " + fmtN(rows.length) + ")</button></div>";
  return h + "</section></div>" + acModal();
}

/* ---------------- approval ---------------- */
function acApplyApproval(id, decision, approvalAt) {
  var r = acRowById(id); if (r) { r.approval = decision; r.approvalAt = approvalAt; }
  if (acRec && acRec.data && acRec.data.account.id === id) { acRec.data.account.approval = decision; acRec.data.account.approvalAt = approvalAt; }
}
function acDecide(id, decision, name, undoTo) {
  if (acBusy[id]) return;
  acBusy[id] = true; render(false);
  cfJson("POST", "/admin/accounts/" + id + "/approval", { decision: decision }).then(function (r) {
    delete acBusy[id];
    if (!r.ok) { acToast(r.j.detail || "تعذّر حفظ القرار", true); render(false); return; }
    /* Where focus goes after the row's buttons are replaced: the row's own link if it is still listed, the
       row that took its place if the tab no longer shows it, the tab otherwise; on the record, its heading. */
    var visible = acFiltered().map(function (x) { return x.id; });
    var at = visible.indexOf(id);
    acApplyApproval(id, decision, r.j.approvalAt);
    if (acRec && acRec.id === id) acRecLoad(id);
    render(false);
    var after = acFiltered().map(function (x) { return x.id; });
    var target = null;
    if (acRoute().split("/")[0] === "account") target = document.getElementById("acrech");
    else if (after.indexOf(id) >= 0) target = document.querySelector('[data-acrow="' + id + '"] a');
    else if (at >= 0 && after.length) target = document.querySelector('[data-acrow="' + after[Math.min(at, after.length - 1)] + '"] a');
    if (!target) target = document.querySelector('[data-ac="tab"][aria-checked="true"]');
    if (target) target.focus({ preventScroll: true });
    var said = decision === "approved" ? "اعتُمد" : decision === "rejected" ? "رُفض" : "أُعيد إلى مقترح";
    acToast(said + " «" + name + "»", false, undoTo ? "تراجع" : "", undoTo ? function () { acDecide(id, undoTo, name, ""); } : null);
  }).catch(function () { delete acBusy[id]; acToast("تعذّر الاتصال", true); render(false); });
}

/* ---------------- the account record ---------------- */
function acRecLoad(id) {
  var rec = acRec;
  pxGet("/admin/accounts/" + id).then(function (j) { if (acRec === rec) { rec.data = j; rec.failed = false; rec.missing = false; } })
    .catch(function (e) { if (acRec === rec) { if (/404|400/.test(String(e && e.message))) rec.missing = true; else rec.failed = true; } })
    .then(function () { if (acRec === rec) render(false); });
}
function acEnsureRec(id) {
  if (acRec && acRec.id === id) return;
  acRec = { id: id, data: null, failed: false, missing: false };
  acRecLoad(id);
}
var AC_FIELD_LABEL = { name: "الاسم", city: "المدينة", sector: "القطاع", importance: "الأهمية", owner: "الموظف المسؤول", contacts: "جهات الاتصال" };
var AC_EVENT = { created: "أُضيف العميل", edited: "عُدّلت بياناته", approved: "اعتُمد", rejected: "رُفض", proposed: "أُعيد إلى مقترح" };
var AC_OUTCOME = { sent: "أُرسلت", opted_out: "لم تُرسل — طلب الإيقاف", outside_window: "لم تُرسل — خارج نافذة 24 ساعة", no_inbound_ever: "لم تُرسل — لم يراسلنا بعد" };
var AC_TASK = { backlog: "مؤجلة", todo: "للتنفيذ", in_progress: "قيد التنفيذ", done: "منجزة", canceled: "ملغاة" };
function acCard(title, sub, link, body) {
  return '<section class="ac-card"><div class="hd"><h2>' + title + "</h2>" + (sub ? '<span class="s">' + sub + "</span>" : "") + '<span class="sp"></span>' + (link || "") + '</div><div class="bd">' + body + "</div></section>";
}
function vAccount(idRaw) {
  var id = Number(idRaw);
  setTimeout(acPaintCrumb, 0);
  var h = '<div class="ac"><a class="ac-back" href="#accounts">→ كل العملاء</a>';
  if (!(id > 0)) return h + '<section class="cf-sec"><div class="cf-state" role="alert">رابط العميل غير صحيح.</div></section></div>';
  acEnsureRec(id);
  if (acRec.missing) return h + '<section class="cf-sec"><div class="cf-state" role="alert">لا عميل بهذا الرقم — ربما حُذف أو الرابط قديم.<a class="btn btn-ghost" href="#accounts" style="text-decoration:none">كل العملاء</a></div></section></div>';
  if (!acRec.data) {
    return h + '<section class="cf-sec"><div class="cf-state" ' + (acRec.failed ? 'role="alert">تعذّر تحميل العميل.<button class="btn btn-ghost" data-ac="recretry">أعد المحاولة</button>' : 'aria-busy="true">جارٍ تحميل العميل…') + "</div></section></div>" + acModal();
  }
  var d = acRec.data, a = d.account;
  /* header */
  var talked = !!d.conversation;
  h += '<div class="ac-hd"><span class="ac-av lg" aria-hidden="true">' + acIni(a.name) + '</span><div class="main">' +
    '<div class="in-row" style="gap:8px"><h1 id="acrech" tabindex="-1">' + esc(a.name) + "</h1>" + acApprPill(a.approval) + acImpPill(a.importance) + "</div>" +
    '<div class="meta">' + [a.sector ? esc(a.sector) : "", a.city ? esc(a.city) : "", '<bdi dir="ltr">+' + esc(a.phone) + "</bdi>"].filter(Boolean).join(" · ") +
    '<br>أُضيف بواسطة ' + esc(acBy(a.createdBy)) + " · " + esc(acSource(a)) + " · " + acDate(a.createdAt) + "</div></div>" +
    '<div class="acts"><button class="btn btn-ghost" id="acedit" data-ac="edit">' + acIco("edit") + "تعديل</button>" +
    (talked ? '<a class="btn btn-ghost" href="#customer/' + esc(a.phone) + '">فتح المحادثة</a>' : "") +
    (typeof opFromEntity === "function" ? '<button class="btn btn-teal" data-ac="opp">فرصة +</button>' : "") + "</div></div>";
  if (a.approval === "proposed") {
    h += '<div class="ac-banner" role="status"><span class="tx">هذا عميل <b>مقترح</b> بانتظار اعتماد فريق المبيعات قبل بدء إجراءات البيع.</span>' +
      '<button class="btn btn-teal" data-ac="approve" data-i="' + a.id + '"' + (acBusy[a.id] ? " disabled" : "") + ">اعتماد العميل</button>" +
      '<button class="btn btn-ghost" data-ac="reject" data-i="' + a.id + '"' + (acBusy[a.id] ? " disabled" : "") + ">رفض</button></div>";
  } else if (a.approval === "rejected") {
    h += '<div class="ac-banner rej" role="status"><span class="tx">رُفض هذا العميل' + (a.approvalBy ? " بواسطة " + esc(acBy(a.approvalBy)) : "") + (a.approvalAt ? " في " + acDate(a.approvalAt) : "") +
      '. لا يظهر في «الكل»، وسجله محفوظ.</span><button class="btn btn-ghost" data-ac="repropose" data-i="' + a.id + '">إعادة إلى مقترح</button></div>';
  }
  /* main column */
  var main = "";
  var liveOpps = d.opps.filter(function (o) { return !isLostStage(o.stage); });
  var liveValue = liveOpps.reduce(function (s, o) { return s + o.value; }, 0);
  main += acCard("فرص العميل", d.opps.length ? acNOpp(liveOpps.length) + " · " + acMoney(liveValue) : "", '<a href="#opps">كل الفرص</a>',
    d.opps.length ? d.opps.map(function (o) {
      var st = typeof opStage === "function" ? opStage(o.stage) : { label: o.stage };
      var tone = typeof opToneVars === "function" ? ' style="' + opToneVars(o.stage) + '"' : "";
      return '<div class="ac-li"><span class="grow"><span>' + esc(o.product) + '</span><span class="sub">' +
        [o.owner ? "المسؤول: " + esc(o.owner) : "", o.closeOn ? "إغلاق متوقع: " + acDate(o.closeOn) : "", o.nextStep ? "الخطوة التالية: " + esc(clip(o.nextStep, 60)) : ""].filter(Boolean).join(" · ") +
        '</span></span><span class="ac-stage"' + tone + ">" + esc(st.label) + '</span><span class="val">' + (o.value ? acMoney(o.value) : '<span class="sub">غير مسعّرة</span>') + "</span></div>";
    }).join("") : '<div class="empty">لا فرص بيع لهذا العميل بعد.' + (typeof opFromEntity === "function" ? ' <button class="sg-toggle" data-ac="opp">افتح فرصة</button>' : "") + "</div>");
  main += acCard("الحملات", d.campaigns.length ? acNCamp(d.campaigns.length) : "", "",
    d.campaigns.length ? d.campaigns.map(function (c) {
      return '<div class="ac-li"><span class="grow"><a href="#kmon/' + c.id + '">' + esc(c.name) + '</a><span class="sub">' +
        [c.product ? esc(c.product) : "", c.objective && typeof CAMPAIGN_OBJECTIVE_LABELS !== "undefined" ? esc(CAMPAIGN_OBJECTIVE_LABELS[c.objective] || "") : "", acDate(c.createdAt)].filter(Boolean).join(" · ") +
        '</span></span><span class="cf-sub">' + esc(c.outcome ? AC_OUTCOME[c.outcome] || c.outcome : "أُدرج في الحملة") + "</span></div>";
    }).join("") : '<div class="empty">لم يُستهدف هذا العميل بأي حملة.</div>');
  var evs = [];
  (a.events || []).forEach(function (e) {
    var extra = e.action === "edited" && e.detail && e.detail.changed && e.detail.changed.length
      ? ": " + e.detail.changed.map(function (k) { return AC_FIELD_LABEL[k] || k; }).join("، ") : "";
    var src0 = e.action === "created" && e.detail && e.detail.source ? " · " + esc(ACCOUNT_SOURCE_LABELS[e.detail.source] || "") : "";
    evs.push({ at: e.at, cls: "", html: esc(AC_EVENT[e.action] || e.action) + esc(extra) + '<span class="sub">' + esc(acBy(e.by)) + src0 + (e.detail && e.detail.note ? " · " + esc(e.detail.note) : "") + "</span>" });
  });
  (d.tasks || []).forEach(function (t) { evs.push({ at: t.dueAt || 0, cls: "t", html: "مهمة: " + esc(t.title) + '<span class="sub">' + esc(AC_TASK[t.status] || t.status) + (t.assignedTo ? " · " + esc(t.assignedTo) : "") + (t.dueAt ? " · تستحق " + acDate(t.dueAt) : "") + "</span>" }); });
  (d.notes || []).forEach(function (n) { evs.push({ at: n.createdAt, cls: "n", html: "ملاحظة" + (n.title ? ": " + esc(n.title) : "") + '<span class="sub">' + esc(clip(n.content, 140)) + (n.author ? " · " + esc(n.author) : "") + "</span>" }); });
  /* BR-OPP-003 work logged on this customer's opportunities. Calendar days sort by their noon so a meeting
     logged today sits among today's other entries. */
  (d.activities || []).forEach(function (x) {
    var at = new Date(x.occurredOn + "T12:00:00").getTime() || x.createdAt;
    var kind = typeof ACTIVITY_KIND_LABELS !== "undefined" ? ACTIVITY_KIND_LABELS[x.kind] || x.kind : x.kind;
    evs.push({ at: at, cls: "t", html: esc(kind) + (x.product ? " · " + esc(x.product) : "") + '<span class="sub">' + esc(clip(x.summary, 140)) +
      (x.nextStep ? " · الخطوة التالية: " + esc(x.nextStep) : "") + (x.owner ? " · " + esc(x.owner) : "") + "</span>" });
  });
  d.campaigns.forEach(function (c) { evs.push({ at: c.createdAt, cls: "c", html: "حملة: " + esc(c.name) + '<span class="sub">' + esc(c.outcome ? AC_OUTCOME[c.outcome] || c.outcome : "أُدرج في الحملة") + "</span>" }); });
  evs.sort(function (x, y) { return y.at - x.at; });
  main += acCard("سجل الأنشطة", "", talked ? '<a href="#customer/' + esc(a.phone) + '">المحادثة</a>' : "",
    evs.length ? evs.slice(0, 15).map(function (e) { return '<div class="ac-ev"><i class="' + e.cls + '"></i><span class="tx">' + e.html + "</span><time>" + (e.at ? acDate(e.at) : "") + "</time></div>"; }).join("") : '<div class="empty">لا أنشطة مسجّلة.</div>');
  /* side column */
  var side = "";
  var owner = a.ownerId != null ? (d.members || []).filter(function (m) { return m.id === a.ownerId; })[0] : null;
  side += '<section class="ac-card"><div class="hd"><h2>مدير الحساب</h2><span class="sp"></span><button class="lnk" id="acedit_owner" data-ac="edit">' + (a.ownerId != null ? "تغيير" : "تعيين") + "</button></div>" +
    (a.ownerName ? '<div class="ac-owner"><span class="ac-av" aria-hidden="true">' + acIni(a.ownerName) + '</span><span><span class="nm">' + esc(a.ownerName) + '</span><br><span class="rl">' +
      esc([owner ? (owner.role === "sales" ? "مبيعات" : owner.role === "support" ? "دعم" : owner.role === "manager" ? "مدير" : owner.role) : "لم يعد نشطًا في الفريق", owner && owner.division ? owner.division : ""].filter(Boolean).join(" · ")) + "</span></span></div>"
      : '<div class="bd"><div class="empty">لا موظف مسؤول عن هذا العميل.</div></div>') + "</section>";
  side += acCard("جهات الاتصال", a.contacts.length ? acNPerson(a.contacts.length) : "", '<button class="lnk" id="acedit_contacts" data-ac="edit">إدارة</button>',
    a.contacts.length ? a.contacts.map(function (c) {
      return '<div class="ac-li ac-person"><span class="ac-av" aria-hidden="true">' + acIni(c.name) + '</span><span class="grow"><span>' + esc(c.name) +
        (c.primary ? ' <span class="cf-pill ap-approved">رئيسية</span>' : "") + "</span>" + (c.role ? '<span class="sub">' + esc(c.role) + "</span>" : "") +
        '<span class="reach">' + (c.phone ? '<bdi dir="ltr">+' + esc(c.phone) + "</bdi>" : "") + (c.email ? '<a href="mailto:' + esc(c.email) + '" dir="ltr">' + esc(c.email) + "</a>" : "") + "</span></span></div>";
    }).join("") : '<div class="empty">لا جهات اتصال مسجّلة — أُضيف هذا العميل قبل أن تُحفظ جهات الاتصال. <button class="sg-toggle" id="acedit_addct" data-ac="edit">أضف جهة اتصال</button></div>');
  var lines = d.opps.map(function (o) { return { product: o.product, stage: o.stage }; });
  var prods = acProducts({ productTags: a.productTags, usesProducts: a.usesProducts, oppProducts: a.oppProducts });
  side += acCard("المنتجات", prods.length ? fmtN(prods.length) : "", "",
    prods.length ? prods.map(function (p) {
      var st = productStatusOf(p, lines);
      var uses = (a.usesProducts || []).indexOf(p) >= 0;
      return '<div class="ac-li"><span class="grow"><a href="#product/' + encodeURIComponent(p) + '">' + esc(p) + "</a>" + (uses ? '<span class="sub">يستخدمه حاليًا</span>' : "") + "</span>" +
        '<span class="cf-pill ' + (st === "won" ? "on" : st === "open" ? "ap-approved" : st === "lost" ? "imp-high" : "off") + '">' + esc(PRODUCT_STATUS_LABELS[st]) + "</span></div>";
    }).join("") : '<div class="empty">لا منتجات مستهدفة. تُضاف من «جهات الاستهداف» أو بفتح فرصة.</div>');
  side += acCard("مؤشرات الاستخدام", d.indicators.length ? fmtN(d.indicators.length) : "", '<a href="#indicators">كل المؤشرات</a>',
    d.indicators.length ? d.indicators.map(function (r) {
      return '<div class="ac-li"><span class="grow"><button class="in-link" id="acind' + r.id + '" data-in="view" data-i="' + r.id + '">' + esc(r.name) + '</button><span class="sub">' +
        [r.product ? esc(r.product) : "", typeof INDICATOR_STATUS_LABELS !== "undefined" ? INDICATOR_STATUS_LABELS[r.status] || "" : ""].filter(Boolean).join(" · ") + "</span></span>" +
        (r.value ? '<span class="val">' + esc(r.value) + "</span>" : "") + "</div>";
    }).join("") : '<div class="empty">هذا العميل ليس في أي مؤشر استخدام.</div>');
  /* BR-PRT-004: what each partner's contact with this customer came to, and whether it reached sales. */
  if ((d.partnerResults || []).length) {
    side += acCard("تواصل الشركاء", fmtN(d.partnerResults.length), '<a href="#partners">شركاء المبيعات</a>',
      d.partnerResults.slice(0, 10).map(function (r) {
        var lbl = typeof PARTNER_RESULT_LABELS !== "undefined" ? PARTNER_RESULT_LABELS[r.result] || r.result : r.result;
        return '<div class="ac-li"><span class="grow"><span>' + esc(r.partnerName) + '</span><span class="sub">' + esc(r.product) + " · " + (typeof owDay === "function" ? owDay(r.contactedOn) : esc(r.contactedOn)) +
          (r.oppId ? ' · <a href="#opps/' + r.oppId + '">حُوّل لفريق المبيعات</a>' : "") + "</span></span>" +
          '<span class="cf-pill ' + (r.result === "interested" ? "ap-approved" : r.result === "not_interested" ? "imp-high" : "imp-low") + '">' + esc(lbl) + "</span></div>";
      }).join(""));
  }
  h += '<div class="ac-grid"><div class="ac-col">' + main + '</div><div class="ac-col">' + side + "</div></div>";
  return h + "</div>" + acModal() + (typeof inDrawer === "function" ? inDrawer() : "");
}

/* ---------------- the add / edit sheet ---------------- */
var acCtSeq = 0;
function acBlankContact(primary) { acCtSeq++; return { key: "c" + acCtSeq, name: "", role: "", phone: "", email: "", primary: !!primary }; }
function acOpenForm(mode, from) {
  if (typeof inMemLoad === "function") inMemLoad();
  if (mode === "edit") {
    var a = acRec && acRec.data && acRec.data.account; if (!a) return;
    acForm = { mode: "edit", id: a.id, updatedAt: a.updatedAt, phone: a.phone, from: from || "",
      d: { name: a.name, city: a.city || "", sector: a.sector || "", importance: a.importance || "", ownerId: a.ownerId == null ? "" : String(a.ownerId) },
      contacts: a.contacts.length ? a.contacts.map(function (c) { acCtSeq++; return { key: "c" + acCtSeq, id: c.id, name: c.name, role: c.role || "", phone: c.phone || "", email: c.email || "", primary: c.primary }; }) : [acBlankContact(true)],
      members: acRec.data.members || [], ownerName: a.ownerName };
  } else {
    acForm = { mode: "new", id: 0, updatedAt: 0, phone: "", from: from || "",
      d: { name: "", city: "", sector: "", importance: "medium", ownerId: "" }, contacts: [acBlankContact(true)], members: acMembers };
    if (!acRows) acLoad(false);
  }
  acForm.err = ""; acForm.field = ""; acForm.busy = false; acForm.dirty = false; acForm.shown = false; acForm.confirm = false; acForm.focus = "acf_name"; acForm.existingId = 0;
  render(false);
}
function acCloseForm(force) {
  if (!acForm) return;
  if (acForm.dirty && !force) { acForm.confirm = true; render(false); var k = document.getElementById("ackeep"); if (k) k.focus(); return; }
  var from = acForm.from;
  document.querySelectorAll(".ac-scrim, .ac-box").forEach(function (el) { el.classList.remove("in"); });
  var done = function () {
    acForm = null; render(false);
    var t = from && document.getElementById(from); if (t) t.focus();
  };
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  setTimeout(done, reduce ? 0 : 150);
}
function acFld(f) { return acForm && acForm.field === f ? ' aria-invalid="true" aria-describedby="err_ac_' + f.replace(/\\./g, "_") + '"' : ""; }
function acFerr(f) { return acForm && acForm.field === f && acForm.err ? '<span class="ferr" id="err_ac_' + f.replace(/\\./g, "_") + '" role="alert">' + acIco("warn") + esc(acForm.err) + "</span>" : ""; }
function acInp(id, label, key, value, opt) {
  opt = opt || {};
  return '<div class="cf-fl"><label for="' + id + '">' + label + (opt.req ? ' <span class="req" aria-hidden="true">*</span>' : "") + "</label>" +
    '<input class="inp" id="' + id + '" ' + (opt.ct ? 'data-acct="' + opt.ct + '"' : 'data-acfld="' + key + '"') + ' value="' + esc(value || "") + '"' +
    (opt.max ? ' maxlength="' + opt.max + '"' : "") + (opt.ph ? ' placeholder="' + esc(opt.ph) + '"' : "") + (opt.type ? ' type="' + opt.type + '"' : "") +
    (opt.ltr ? ' dir="ltr" lang="en"' : "") + (opt.list ? ' list="' + opt.list + '"' : "") + (opt.req ? ' aria-required="true"' : "") + (opt.auto ? ' autocomplete="' + opt.auto + '"' : "") +
    acFld(opt.errKey || key) + ">" + (opt.hint ? '<span class="hint">' + opt.hint + "</span>" : "") + acFerr(opt.errKey || key) + "</div>";
}
function acModal() {
  if (!acForm) return "";
  var f = acForm, d = f.d, isEdit = f.mode === "edit";
  var cls = f.shown ? " in" : "";
  var members = (f.members || []).slice();
  if (isEdit && d.ownerId && !members.some(function (m) { return String(m.id) === d.ownerId; })) members.push({ id: Number(d.ownerId), name: (f.ownerName || "عضو سابق") + " (غير نشط)" });
  var h = '<div class="ac-scrim' + cls + '" data-ac="close"></div><div class="ac-modal"><div class="ac-box' + cls + '" role="dialog" aria-modal="true" aria-labelledby="acmt">';
  h += '<div class="mh"><div><h2 id="acmt">' + (isEdit ? "تعديل بيانات العميل" : "إضافة عميل جديد") + '</h2><div class="s">' +
    (isEdit ? "رقم واتساب العميل ثابت: به ترتبط محادثاته وحملاته وفرصه." : "يُضاف العميل بحالة «مقترح» بانتظار اعتماد فريق المبيعات.") +
    '</div></div><span class="sp"></span><button class="ac-x" data-ac="close" aria-label="إغلاق">' + acIco("x") + "</button></div>";
  h += '<div class="mb"><div class="gl">بيانات المنشأة</div><div class="cf-g">' +
    acInp("acf_name", "اسم العميل / المنشأة", "name", d.name, { req: true, max: ACCOUNT_NAME_MAX, ph: "مثال: مستشفى الرعاية الطبية" }) +
    acInp("acf_city", "المدينة", "city", d.city, { req: true, max: ACCOUNT_CITY_MAX, list: "acl_city", ph: "الرياض" }) + "</div>";
  h += '<div class="cf-g">' + acInp("acf_sector", "القطاع / الشريحة", "sector", d.sector, { max: ACCOUNT_SECTOR_MAX, list: "acl_sector", ph: "رعاية صحية" }) +
    '<div class="cf-fl"><label for="acf_importance">درجة الأهمية</label><select id="acf_importance" data-acfld="importance"' + acFld("importance") + '><option value="">— غير محددة —</option>' +
      ACCOUNT_IMPORTANCE.map(function (k) { return '<option value="' + k + '"' + (d.importance === k ? " selected" : "") + ">" + ACCOUNT_IMPORTANCE_LABELS[k] + "</option>"; }).join("") + "</select>" + acFerr("importance") + "</div>" +
    '<div class="cf-fl"><label for="acf_owner">الموظف المسؤول</label><select id="acf_owner" data-acfld="ownerId"' + acFld("ownerId") + '><option value="">— بلا مسؤول —</option>' +
      members.map(function (m) { return '<option value="' + m.id + '"' + (String(m.id) === d.ownerId ? " selected" : "") + ">" + esc(m.name) + "</option>"; }).join("") + "</select>" +
      (members.length ? "" : '<span class="hint">لا أعضاء نشطون — أضفهم من <a href="#team">الفريق</a>.</span>') + acFerr("ownerId") + "</div></div>";
  if (isEdit) h += '<div class="cf-fl"><span class="cf-sub">رقم واتساب العميل</span><span class="ro"><bdi dir="ltr">+' + esc(f.phone) + "</bdi></span></div>";
  else h += '<div class="cf-g">' + acInp("acf_phone", "رقم واتساب العميل", "phone", d.phone, { req: true, ltr: true, type: "tel", auto: "tel", ph: "05xxxxxxxx", hint: "به ترتبط المحادثات والحملات والفرص" }) + "</div>";
  if (f.field === "phone" && f.existingId) h += '<div><a class="btn btn-ghost" href="#account/' + f.existingId + '" data-ac="gotoexisting" style="text-decoration:none;display:inline-flex;align-items:center;height:34px">افتح العميل الموجود</a></div>';
  var cities = acDistinct("city"), sectors = acDistinct("sector");
  h += '<datalist id="acl_city">' + cities.map(function (c) { return '<option value="' + esc(c) + '">'; }).join("") + "</datalist>" +
    '<datalist id="acl_sector">' + sectors.map(function (c) { return '<option value="' + esc(c) + '">'; }).join("") + "</datalist>";
  h += '<div class="gl" id="acf_contacts" tabindex="-1">جهات الاتصال <span class="cf-sub">' + acNPerson(f.contacts.length) + '</span><span class="sp"></span>' +
    '<button class="ac-add" id="acaddct" data-ac="addct"' + (f.contacts.length >= CONTACTS_MAX ? " disabled" : "") + ">" + acIco("plus") + "إضافة جهة اتصال</button></div>";
  if (f.field === "contacts" && f.err) h += '<div class="cf-err" id="err_ac_contacts" role="alert">' + acIco("warn") + esc(f.err) + "</div>";
  f.contacts.forEach(function (c, i) {
    var only = f.contacts.length === 1;
    h += '<div class="ac-ct' + (c.primary ? " primary" : "") + '" data-ackey="' + c.key + '" role="group" aria-label="جهة الاتصال ' + fmtN(i + 1) + '">' +
      '<div class="ch">جهة الاتصال ' + fmtN(i + 1) + '<span class="sp"></span>' +
      '<button class="pr" data-ac="primary" data-k="' + c.key + '" aria-pressed="' + c.primary + '">' + (c.primary ? "رئيسية" : "اجعلها رئيسية") + "</button>" +
      '<button class="rm" data-ac="rmct" data-k="' + c.key + '"' + (only ? ' disabled title="للعميل جهة اتصال واحدة على الأقل"' : "") + ' aria-label="حذف جهة الاتصال ' + fmtN(i + 1) + '">حذف</button></div>' +
      '<div class="cf-g">' + acInp("acc_" + c.key + "_name", "الاسم", "", c.name, { req: true, max: CONTACT_NAME_MAX, ct: c.key + ":name", errKey: "contacts." + i + ".name" }) +
      acInp("acc_" + c.key + "_role", "المنصب", "", c.role, { max: CONTACT_ROLE_MAX, ct: c.key + ":role", errKey: "contacts." + i + ".role", ph: "مدير تقنية المعلومات" }) + "</div>" +
      '<div class="cf-g">' + acInp("acc_" + c.key + "_phone", "الهاتف", "", c.phone, { ltr: true, type: "tel", ct: c.key + ":phone", errKey: "contacts." + i + ".phone" }) +
      acInp("acc_" + c.key + "_email", "البريد الإلكتروني", "", c.email, { ltr: true, type: "email", max: CONTACT_EMAIL_MAX, ct: c.key + ":email", errKey: "contacts." + i + ".email" }) + "</div></div>";
  });
  h += "</div>";
  h += '<div class="mf">';
  if (f.confirm) {
    h += '<span class="cf-err msg" role="alert">لديك تغييرات لم تُحفظ.</span><button class="btn btn-ghost" id="ackeep" data-ac="keep">متابعة التعديل</button><button class="btn btn-ghost" data-ac="discard" style="color:var(--s-fail-text)">تجاهل التغييرات</button>';
  } else {
    h += '<button class="btn btn-teal" data-ac="save"' + (f.busy ? ' disabled aria-busy="true"' : "") + ">" + (f.busy ? "جارٍ الحفظ…" : isEdit ? "حفظ التعديلات" : "إضافة العميل") + "</button>" +
      '<button class="btn btn-ghost" data-ac="close">إلغاء</button>' +
      (f.err && !acFieldTarget(f.field) ? '<span class="cf-err msg" role="alert">' + acIco("warn") + esc(f.err) + "</span>" : "");
  }
  return h + "</div></div></div>";
}
var AC_FIELD_ID = { name: "acf_name", city: "acf_city", sector: "acf_sector", importance: "acf_importance", ownerId: "acf_owner", phone: "acf_phone", contacts: "acf_contacts" };
function acFieldTarget(field) {
  if (AC_FIELD_ID[field]) return AC_FIELD_ID[field];
  var m = /^contacts\\.(\\d+)\\.(\\w+)$/.exec(field || "");
  if (m && acForm && acForm.contacts[Number(m[1])]) return "acc_" + acForm.contacts[Number(m[1])].key + "_" + m[2];
  return "";
}
function acSave() {
  var f = acForm; if (!f || f.busy) return;
  var payload = { name: f.d.name, city: f.d.city, sector: f.d.sector, importance: f.d.importance, ownerId: f.d.ownerId, phone: f.d.phone,
    contacts: f.contacts.map(function (c) { return { id: c.id || undefined, name: c.name, role: c.role, phone: c.phone, email: c.email, primary: c.primary }; }) };
  var ids = (f.members || []).map(function (m) { return m.id; });
  if (f.mode === "edit" && f.d.ownerId) ids.push(Number(f.d.ownerId));
  var local = checkAccount(payload, ids, f.mode === "edit");
  var fail = function (reason, field, existingId) {
    f.err = reason; f.field = field || ""; f.existingId = existingId || 0; f.busy = false; f.focus = acFieldTarget(field) || ""; render(false);
  };
  if (!local.ok) { fail(local.reason, local.field); return; }
  f.busy = true; f.err = ""; f.field = ""; render(false);
  var req = f.mode === "edit"
    ? cfJson("PATCH", "/admin/accounts/" + f.id, { account: payload, ifUpdatedAt: f.updatedAt })
    : cfJson("POST", "/admin/accounts", { account: payload });
  req.then(function (r) {
    if (acForm !== f) return;
    if (!r.ok) {
      if (r.status === 409 && r.j.error === "phone_exists") { fail("هذا الرقم مسجّل لعميل آخر.", "phone", r.j.existingId); return; }
      if (r.status === 409 && r.j.error === "stale_account") {
        /* Rebase instead of dead-ending: the draft stays, the version moves to what is stored now, and the
           next save applies it knowingly. «Close and reopen» used to reopen the same stale version (review). */
        pxGet("/admin/accounts/" + f.id).then(function (j) {
          if (acForm !== f) return;
          f.updatedAt = j.account.updatedAt;
          if (acRec && acRec.id === f.id) { acRec.data = j; }
          fail("عدّل شخص آخر هذا العميل بعد أن فتحت النموذج. راجع الحقول ثم احفظ مرة أخرى لتطبيق تعديلاتك.", "");
        }).catch(function () { fail("عدّل شخص آخر هذا العميل، وتعذّر تحميل النسخة الأحدث — أعد المحاولة.", ""); });
        return;
      }
      fail(r.j.detail || "تعذّر الحفظ (" + fmtN(r.status) + ")", r.j.field || ""); return;
    }
    var name = payload.name.trim();
    f.dirty = false;
    acCloseForm(true);
    acRefreshEntities();
    if (f.mode === "edit") {
      acToast("حُفظت بيانات «" + name + "»", false);
      if (acRec && acRec.id === f.id) acRecLoad(f.id);
      acLoad(true);
    } else {
      var newId = r.j.id;
      acF.tab = "proposed"; acF.q = ""; acShown = AC_PAGE;
      acLoad(true);
      acToast("أُضيف «" + name + "» بحالة مقترح", false, "افتح السجل", function () { location.hash = "account/" + newId; });
    }
  }).catch(function () { if (acForm === f) fail("تعذّر الاتصال — لم يُحفظ شيء.", ""); });
}
/* Runs after every paint: the sheet fades in once, and focus lands where the last action points —
   the first field on open, a new contact's name, the field an error names. */
function acAfterPaint() {
  if (acRec && acRec.data && !acRec.focused && acRoute().split("/")[0] === "account") {
    acRec.focused = true; var hh = document.getElementById("acrech"); if (hh && !acForm) hh.focus({ preventScroll: true });
  }
  if (!acForm) return;
  if (!acForm.shown && document.querySelector(".ac-box")) {
    requestAnimationFrame(function () {
      if (!acForm) return;
      document.querySelectorAll(".ac-scrim, .ac-box").forEach(function (el) { el.classList.add("in"); });
      acForm.shown = true;
    });
  }
  if (acForm.focus) {
    var el = document.getElementById(acForm.focus);
    acForm.focus = "";
    if (el) el.focus({ preventScroll: false });
  }
}

/* ---------------- one delegated listener ---------------- */
document.addEventListener("click", function (ev) {
  var t = ev.target && ev.target.closest ? ev.target.closest("[data-ac]") : null;
  if (!t) return;
  var a = t.getAttribute("data-ac");
  var id = Number(t.getAttribute("data-i"));
  if (a === "retry") { acFailed = false; acLoad(true); return; }
  if (a === "recretry") { if (acRec) { acRec.failed = false; acRecLoad(acRec.id); render(false); } return; }
  if (a === "tab") { acF.tab = t.getAttribute("data-v"); acShown = AC_PAGE; render(false); var b = document.querySelector('[data-ac="tab"][data-v="' + acF.tab + '"]'); if (b) b.focus(); return; }
  if (a === "tabproposed") { acF.tab = "proposed"; acShown = AC_PAGE; render(false); return; }
  if (a === "noowner") { acF.tab = "all"; acF.owner = "none"; acShown = AC_PAGE; render(false); return; }
  if (a === "clearf") { acF.product = ""; acF.sector = ""; acF.city = ""; acF.owner = ""; acF.importance = ""; acF.ind = ""; render(false); var f0 = document.querySelector('[data-acset="product"]'); if (f0) f0.focus(); return; }
  if (a === "clearall") { acF.q = ""; acF.product = ""; acF.sector = ""; acF.city = ""; acF.owner = ""; acF.importance = ""; acF.ind = ""; render(false); return; }
  if (a === "more") { acShown += AC_PAGE; render(false); return; }
  if (a === "new") { acOpenForm("new", t.id || ""); return; }
  if (a === "edit") { acOpenForm("edit", t.id || "acedit"); return; }
  if (a === "opp") { var ar = acRec && acRec.data && acRec.data.account; if (ar && typeof opFromEntity === "function") opFromEntity(ar.id); return; }
  if (a === "approve" || a === "reject" || a === "repropose") {
    var row = acRowById(id) || (acRec && acRec.data && acRec.data.account.id === id ? acRec.data.account : null);
    if (!row) return;
    var prev = row.approval;
    acDecide(id, a === "approve" ? "approved" : a === "reject" ? "rejected" : "proposed", row.name, prev);
    return;
  }
  if (!acForm) return;
  if (a === "close") { acCloseForm(false); return; }
  if (a === "keep") { acForm.confirm = false; render(false); var s0 = document.querySelector('.ac-box [data-ac="save"]'); if (s0) s0.focus(); return; }
  if (a === "discard") { acCloseForm(true); return; }
  if (a === "gotoexisting") { acForm = null; return; }
  if (a === "save") { acSave(); return; }
  if (a === "addct") {
    var c = acBlankContact(false);
    acForm.contacts.push(c); acForm.dirty = true; acForm.focus = "acc_" + c.key + "_name";
    if (acForm.field === "contacts") { acForm.err = ""; acForm.field = ""; }
    render(false); return;
  }
  var key = t.getAttribute("data-k");
  var idx = acForm.contacts.map(function (x) { return x.key; }).indexOf(key);
  if (idx < 0) return;
  if (a === "primary") {
    acForm.contacts.forEach(function (x) { x.primary = x.key === key; });
    acForm.dirty = true; acForm.focus = t.id || ""; render(false);
    var pb = document.querySelector('[data-ac="primary"][data-k="' + key + '"]'); if (pb) pb.focus();
    return;
  }
  if (a === "rmct") {
    if (acForm.contacts.length <= 1) return;
    var wasPrimary = acForm.contacts[idx].primary;
    acForm.contacts.splice(idx, 1);
    if (wasPrimary) acForm.contacts[0].primary = true;
    acForm.dirty = true;
    /* Focus goes to the contact that took this one's place, or the add button when the last one went. */
    var next = acForm.contacts[Math.min(idx, acForm.contacts.length - 1)];
    acForm.focus = idx < acForm.contacts.length ? "acc_" + next.key + "_name" : "acaddct";
    if (acForm.field.indexOf("contacts.") === 0) { acForm.err = ""; acForm.field = ""; }
    render(false); return;
  }
});
document.addEventListener("input", function (ev) {
  var t = ev.target; if (!t || !t.getAttribute) return;
  var s = t.getAttribute("data-acset");
  if (s === "q") { acF.q = t.value; acShown = AC_PAGE; clearTimeout(window.__acq); window.__acq = setTimeout(function () { render(false); }, 200); return; }
  if (!acForm) return;
  var k = t.getAttribute("data-acfld"), ct = t.getAttribute("data-acct"), errKey = "";
  if (k) { acForm.d[k] = t.value; errKey = k; }
  else if (ct) {
    var p = ct.split(":");
    var i = acForm.contacts.map(function (x) { return x.key; }).indexOf(p[0]);
    if (i < 0) return;
    acForm.contacts[i][p[1]] = t.value; errKey = "contacts." + i + "." + p[1];
    if (acForm.field === "contacts") errKey = "contacts";
  } else return;
  acForm.dirty = true;
  /* An error leaves the moment its field is being fixed — without a repaint, so the caret stays. */
  if (acForm.field === errKey && acForm.err) {
    var er = document.getElementById("err_ac_" + errKey.replace(/\\./g, "_")); if (er) er.remove();
    t.removeAttribute("aria-invalid"); t.removeAttribute("aria-describedby");
    acForm.err = ""; acForm.field = ""; acForm.existingId = 0;
  }
});
document.addEventListener("change", function (ev) {
  var t = ev.target; if (!t || !t.getAttribute) return;
  var s = t.getAttribute("data-acset");
  if (s && s !== "q") { acF[s] = t.value; acShown = AC_PAGE; render(false); var again = document.querySelector('[data-acset="' + s + '"]'); if (again) again.focus(); return; }
  if (acForm && t.tagName === "SELECT" && t.getAttribute("data-acfld")) { acForm.d[t.getAttribute("data-acfld")] = t.value; acForm.dirty = true; }
});
document.addEventListener("keydown", function (ev) {
  if (!acForm || !document.querySelector(".ac-box")) {
    /* Arrow keys move between the approval tabs, as a radiogroup should. */
    var tb = ev.target && ev.target.closest ? ev.target.closest('[data-ac="tab"]') : null;
    if (tb && (ev.key === "ArrowLeft" || ev.key === "ArrowRight" || ev.key === "Home" || ev.key === "End")) {
      ev.preventDefault();
      var order = ["all", "approved", "proposed", "rejected"];
      var at = ev.key === "Home" ? 0 : ev.key === "End" ? order.length - 1 : order.indexOf(acF.tab) + (ev.key === "ArrowLeft" ? 1 : -1);
      acF.tab = order[(at + order.length) % order.length]; acShown = AC_PAGE; render(false);
      var nb = document.querySelector('[data-ac="tab"][data-v="' + acF.tab + '"]'); if (nb) nb.focus();
    }
    return;
  }
  if (ev.key === "Escape") {
    ev.preventDefault();
    if (acForm.confirm) { acForm.confirm = false; render(false); var sv = document.querySelector('.ac-box [data-ac="save"]'); if (sv) sv.focus(); }
    else acCloseForm(false);
    return;
  }
  if (ev.key === "Enter" && ev.target && ev.target.tagName === "INPUT" && !(ev.target.getAttribute("list"))) { ev.preventDefault(); acSave(); return; }
  if (ev.key !== "Tab") return;
  /* Focus stays inside the sheet while it is open. */
  var box = document.querySelector(".ac-box");
  var items = Array.prototype.filter.call(box.querySelectorAll("button, input, select, a[href]"), function (el) { return !el.disabled && el.offsetParent !== null; });
  if (!items.length) return;
  var first = items[0], last = items[items.length - 1];
  if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
  else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
  else if (!box.contains(document.activeElement)) { ev.preventDefault(); first.focus(); }
});
/* ================= end «العملاء» — accounts ================= */
`;
