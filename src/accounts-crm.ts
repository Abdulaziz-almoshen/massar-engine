// accounts-crm.ts — «العملاء» as ACCOUNTS (client A, BRD v1.0 §9, slice S2): the list the prototype drew
// (العميل · المدينة · القطاع · الموظف المسؤول · مصدر الإضافة · الحالة · عدد الفرص · قيمة الفرص) with its
// الكل / معتمدون / مقترحون tabs, the «إضافة عميل جديد» sheet with repeatable contacts, and the account
// record (#account/<id>) that opens for a customer who has never written to us.
//
// PORTED to the new design system (docs/PORT-SPEC.md). Both screens and the sheet are inside .ds6 and
// speak the m-* vocabulary: the list is a real table in .m-tablewrap rather than the settings grid,
// the record is .m-grid--main over .m-card, the activity log is .m-tl, the sheet's fields are
// .m-field/.m-label/.m-input, and every digit goes through .m-n.
//
// THE DEFECT THIS PORT FIXES. The record's «فرص العميل» card filtered out LOST lines and kept WON
// ones, then printed the sum as if it were open pipeline — so a customer with one won deal read as
// having that much still in play. The list KPI had it right («قائمة: X · رابحة: Y»); the record did
// not. The card now separates open from won the way the list does, and NAMES the unpriced open lines
// instead of silently adding them in as zero.
//
// ABSENCES. Six blanks used to render as one grey dash each, which teaches a reader to stop seeing
// dashes. They are now three kinds: a number someone owes (لم تُسعَّر), a classification nobody made
// (لم تُسجَّل · لم يُصنَّف · لم يُسجَّل — an account with no owner is UNSET, not owed), and a legitimate
// nothing (لا فرص).
//
// MOTION (emil-design-eng). The sheet enters from 0.96 scale + opacity over 200ms with a strong ease-out
// and leaves faster (140ms); it is a modal, so it scales from the centre. Buttons press to 0.97. Nothing
// animates on keyboard actions or on repaint, and reduced motion keeps only the opacity fade. The sheet
// keeps its own .ac-scrim/.ac-box mechanics rather than taking .m-dlg__p, whose CSS animation would
// replay on every keystroke — render() rebuilds the sheet's markup on each paint.
//
// NO BACKTICKS ANYWHERE IN THIS FILE, comments included: it is one template literal.

export const ACCOUNTS_CRM_CSS = `
/* Only what the vocabulary genuinely lacks. Everything the old sheet declared for tables, pills,
   tiles, fields and buttons is gone: .m-table, .m-chip, .m-kpis, .m-field and .m-btn carry it. */
.ds6 .m-acc { display: grid; gap: var(--m-4); }
.ds6 .m-acc-table { min-inline-size: 1040px; }
.ds6 .m-acc-clip { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-inline-size: 26ch; }
.ds6 .m-acc-sub { display: block; font-size: var(--m-t-micro); color: var(--m-faint); line-height: 20px; }
.ds6 .m-acc-ltr { direction: ltr; unicode-bidi: isolate; }
.ds6 .m-av--lg { inline-size: 52px; block-size: 52px; font-size: var(--m-t-h); }
.ds6 .m-acc-hd { display: flex; gap: var(--m-4); flex-wrap: wrap; align-items: flex-start; }
.ds6 .m-acc-hd__m { flex: 1 1 260px; min-inline-size: 0; display: grid; gap: var(--m-2); }
.ds6 .m-acc-row { display: flex; align-items: center; gap: var(--m-2); flex-wrap: wrap; }
/* The stage keeps the ladder's own tone (opToneVars), because the admin owns the ladder and a
   stage's colour is its identity on every other screen. */
.ds6 .m-acc-stage { background: var(--tn-soft, var(--m-idle-dim)); color: var(--tn-text, var(--m-idle)); }
.ds6 .m-acc-card { display: grid; gap: 0; }
.ds6 .m-acc-b { padding: 0 var(--m-5) var(--m-4); }
.ds6 .m-acc-b .m-item:first-child { border-block-start: 0; }
.ds6 .m-kpi { text-align: start; font: inherit; display: block; inline-size: 100%; }
.ds6 button.m-kpi { cursor: pointer; }
.ds6 .m-kpi[data-lead] { background: var(--m-ac-dim); box-shadow: 0 0 0 1px var(--m-ac-line); }

/* ---- the add / edit sheet (a modal: it scales from the centre) ---- */
.ac-scrim { position:fixed; inset:0; background:rgba(11,13,18,.44); z-index:var(--z-overlay); opacity:0; transition:opacity 140ms cubic-bezier(.16,1,.3,1); }
.ac-scrim.in { opacity:1; transition-duration:200ms; }
.ac-modal { position:fixed; inset:0; z-index:var(--z-modal); display:flex; align-items:flex-start; justify-content:center; padding:6vh 12px 12px; pointer-events:none; overflow:auto; }
.ds6 .ac-box { pointer-events:auto; width:100%; max-width:680px; background:var(--m-paper); border-radius:var(--m-r-band);
  box-shadow:var(--m-lift); display:flex; flex-direction:column; max-height:88vh; opacity:0; transform:scale(.96);
  transition:opacity 140ms cubic-bezier(.16,1,.3,1), transform 140ms cubic-bezier(.16,1,.3,1); }
.ds6 .ac-box.in { opacity:1; transform:none; transition-duration:200ms; }
.ds6 .ac-box .m-dlg__b { display:flex; flex-direction:column; gap:var(--m-4); max-block-size:none; }
.ds6 .ac-box .m-dlg__f { flex-wrap:wrap; justify-content:flex-start; }
.ds6 .m-gl { display:flex; align-items:center; gap:var(--m-2); font-size:var(--m-t-body); font-weight:600; color:var(--m-ink); }
.ds6 .m-ct { border-radius:var(--m-r-ctl); box-shadow:var(--m-hair); padding:var(--m-3); display:flex; flex-direction:column; gap:var(--m-2); }
.ds6 .m-ct[data-primary] { box-shadow:0 0 0 1px var(--m-ac-line); background:var(--m-ac-dim); }
.ds6 .m-ct__h { display:flex; align-items:center; gap:var(--m-2); font-size:var(--m-t-micro); color:var(--m-mut); font-weight:600; }
.ds6 .m-ro { font-size:var(--m-t-body); color:var(--m-ink); min-block-size:38px; display:flex; align-items:center; }
@media (max-width: 560px) { .ac-modal { padding:0; align-items:stretch; } .ds6 .ac-box { max-width:none; max-height:none; min-height:100%; border-radius:0; } }
@media (pointer:coarse) { .ds6 .m-ct button, .ds6 .m-x { min-block-size:44px; } }
@media (prefers-reduced-motion: reduce) {
  .ds6 .ac-box { transform:none; transition:opacity 140ms linear; }
}
`;

export const ACCOUNTS_CRM_JS = `
/* ================= «العملاء» — accounts ================= */
var acRows = null, acMembers = [], acLoading = false, acFailed = false, acPending = false;
var acF = { q: "", tab: "all", product: "", sector: "", city: "", owner: "", importance: "", size: "", ind: "" };
function acMayEdit() { return typeof meCan !== "function" || meCan("customers.edit"); }
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

/* Every digit goes through .m-n — direction:ltr, isolated bidi, tabular figures. A unit that belongs
   to the number lives INSIDE the span, or the ر.س lands on the wrong side of the digits. */
function acN(v) { return '<span class="m-n">' + fmtN(v) + "</span>"; }
function acMoneyN(v) { return '<span class="m-n">' + fmtN(Math.round(Number(v) || 0)) + " ر.س</span>"; }
/* kind: "owed" a number someone owes, "unset" a classification nobody made, "none" a legitimate
   nothing. An account with no owner is UNSET — nobody made the assignment — not a number owed. */
function acNil(t, kind) { return '<span class="m-td-nil m-nil--' + (kind || "none") + '">' + esc(t) + "</span>"; }

function acDate(ms) {
  if (!ms) return acNil("لم يُسجَّل", "unset");
  var d = new Date(Number(ms));
  /* The year only when it is not this one: «15 سبتمبر 2026» truncated in a 132px column. */
  var o = d.getFullYear() === new Date().getFullYear() ? { day: "numeric", month: "long" } : { day: "numeric", month: "short", year: "numeric" };
  return '<span class="m-n">' + d.toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", o) + "</span>";
}
function acMoney(v) { return typeof opMoney === "function" ? opMoney(v) : fmtN(Math.round(Number(v) || 0)) + " ر.س"; }
/* The initial a reader recognises: «م. فهد العمري» is F, not the title's م. */
function acIni(name) {
  var s = String(name || "").trim().replace(/^(م|د|أ|ا|أ\\.د)\\.\\s*/, "");
  return esc(s.charAt(0) || "؟");
}
/* Colour means status. Importance is a risk read, approval is a gate — each maps onto the
   vocabulary's status tones rather than inventing a private palette. */
function acImpPill(imp) {
  if (!imp) return "";
  var t = imp === "high" ? "bad" : imp === "medium" ? "warn" : "plain";
  return '<span class="m-chip m-chip--' + t + '">أهمية ' + esc(ACCOUNT_IMPORTANCE_LABELS[imp] || imp) + "</span>";
}
function acApprPill(ap) {
  var t = ap === "approved" ? "ok" : ap === "proposed" ? "warn" : "plain";
  return '<span class="m-chip m-chip--' + t + '">' + esc(ACCOUNT_APPROVAL_LABELS[ap] || ap) + "</span>";
}
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
  var f = { q: acF.q, tab: tabOverride || acF.tab, product: acF.product, sector: acF.sector, city: acF.city, owner: acF.owner, importance: acF.importance, size: acF.size, inIndicator: set };
  return (acRows || []).filter(function (a) {
    return accountMatches({ id: a.id, name: a.name, phone: a.phone, city: a.city, sector: a.sector, importance: a.importance, sizeTier: a.sizeTier, ownerId: a.ownerId,
      approval: a.approval, products: acProducts(a), contactText: a.contactText }, f);
  });
}
function acDistinct(key) {
  var c = {};
  (acRows || []).forEach(function (a) { var v = a[key]; if (v) c[v] = (c[v] || 0) + 1; });
  return Object.keys(c).sort(function (x, y) { return c[y] - c[x] || (x < y ? -1 : 1); });
}
function acSel(key, label, value, opts) {
  return '<select class="m-select" aria-label="' + label + '" data-acset="' + key + '"><option value="">' + label + ": الكل</option>" +
    opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(value) === String(o[0]) ? " selected" : "") + ">" + esc(clip(o[1], 28)) + "</option>"; }).join("") + "</select>";
}
/* The book, minus the rejected: every KPI on this screen reads the same population, so a tile and
   the list under it cannot disagree about what «العملاء» means. */
function acBook() { return (acRows || []).filter(function (a) { return a.approval !== "rejected"; }); }
/* Each figure printed in more than one place is bound to the array it is rendered from — the KPI
   total against the book, the proposed count against the tab it also badges, the row count against
   the pager note that repeats it. dsVerify re-derives all of them on every paint. */
function acBind() {
  dsD("acAll", function () { return acBook().length; });
  dsD("acApproved", function () { return acBook().filter(function (a) { return a.approval !== "proposed"; }).length; });
  dsD("acPending", function () { return acBook().filter(function (a) { return a.approval === "proposed"; }).length; });
  dsD("acNoOwner", function () { return acBook().filter(function (a) { return a.ownerId == null; }).length; });
  dsD("acProposedTab", function () { return acFiltered("proposed").length; });
  dsD("acShown", function () { return acFiltered().length; });
}
function acKpis() {
  var all = acBook();
  var pending = all.filter(function (a) { return a.approval === "proposed"; }).length;
  var noOwner = all.filter(function (a) { return a.ownerId == null; }).length;
  var value = all.reduce(function (s, a) { return s + (a.opps ? a.opps.value : 0); }, 0);
  var openN = all.reduce(function (s, a) { return s + (a.opps ? a.opps.open : 0); }, 0);
  var wonN = all.reduce(function (s, a) { return s + (a.opps ? a.opps.won : 0); }, 0);
  var tile = function (k, v, s, lead, act) {
    var open = act ? '<button type="button" class="m-card m-kpi" data-ac="' + act + '"' + (lead ? " data-lead" : "") + ">"
      : '<div class="m-card m-kpi"' + (lead ? " data-lead" : "") + ">";
    return open + '<div class="m-stat__k">' + k + '</div><div class="m-stat__v">' + v + "</div>" +
      (s ? '<div class="m-stat__s">' + s + "</div>" : "") + (act ? "</button>" : "</div>");
  };
  return '<div class="m-kpis">' +
    tile("العملاء", dsFig("acAll", all.length), "معتمدون: " + dsFig("acApproved", all.length - pending), true) +
    tile("بانتظار الاعتماد", dsFig("acPending", pending), pending ? "اعرضهم" : "لا أحد", false, pending ? "tabproposed" : "") +
    tile("بلا موظف مسؤول", dsFig("acNoOwner", noOwner), noOwner ? "اعرضهم" : "لا أحد", false, noOwner ? "noowner" : "") +
    /* The value includes won lines (the list column does too), so the caption names both, as counts
       that need no noun agreement (review: «فرصتان قائمة»). */
    tile("قيمة الفرص", acMoneyN(value), "قائمة: " + acN(openN) + " · رابحة: " + acN(wonN), false) + "</div>";
}
function acDecisionCell(a) {
  if (a.approval !== "proposed") return acApprPill(a.approval);
  var busy = !!acBusy[a.id];
  /* A role with customers.view but not customers.edit sees the state, never the gate. */
  if (!acMayEdit()) return acApprPill(a.approval);
  return '<span class="m-acc-row"><button type="button" class="m-btn m-btn--primary" data-ac="approve" data-i="' + a.id + '" id="acap' + a.id + '"' + (busy ? ' disabled aria-busy="true"' : "") + ' aria-label="اعتماد ' + esc(a.name) + '">اعتماد</button>' +
    '<button type="button" class="m-btn" data-ac="reject" data-i="' + a.id + '" id="acrj' + a.id + '"' + (busy ? " disabled" : "") + ' aria-label="رفض ' + esc(a.name) + '">رفض</button></span>';
}
function acRow(a) {
  var pc = a.primaryContact;
  var h = '<tr data-acrow="' + a.id + '">';
  h += '<td class="m-td-n"><span class="m-acc-row"><span class="m-av" aria-hidden="true">' + acIni(a.name) + "</span>" +
    '<span><a class="m-link m-acc-clip" href="#account/' + a.id + '" title="' + esc(a.name) + '">' + esc(a.name) + "</a>" +
    /* Importance rides the second line: on the first it took the width the name needs. */
    '<span class="m-acc-sub">' + (a.importance ? acImpPill(a.importance) + " " : "") +
      (pc ? esc(pc.name) + (pc.role ? " · " + esc(pc.role) : "") + (a.contactCount > 1 ? " · +" + fmtN(a.contactCount - 1) : "") : "لا جهة اتصال مسجّلة") +
    "</span></span></span></td>";
  h += "<td>" + (a.city ? '<span class="m-acc-clip">' + esc(a.city) + "</span>" : acNil("لم تُسجَّل", "unset")) + "</td>";
  h += "<td>" + (a.sector ? '<span class="m-acc-clip">' + esc(a.sector) + "</span>" : acNil("لم يُصنَّف", "unset")) + "</td>";
  h += "<td>" + (a.ownerName ? '<span class="m-acc-clip">' + esc(a.ownerName) + "</span>" : acNil("لم يُسجَّل", "unset")) + "</td>";
  h += '<td><span class="m-acc-clip">' + esc(acSource(a)) + '</span><span class="m-acc-sub">' + (a.createdBy ? esc(acBy(a.createdBy)) + " · " : "") + acDate(a.createdAt) + "</span></td>";
  h += "<td>" + acDecisionCell(a) + "</td>";
  h += '<td class="m-td-v">' + (a.opps.count ? acN(a.opps.count) : acNil("لا فرص", "none")) + "</td>";
  h += '<td class="m-td-v">' + (a.opps.value ? acMoneyN(a.opps.value) : (a.opps.count ? acNil("لم تُسعَّر", "owed") : acNil("لا فرص", "none"))) + "</td>";
  return h + "</tr>";
}
function acPaintCrumb() {
  var act = document.getElementById("crumbact");
  if (!act) return;
  var r = acRoute().split("/")[0];
  if (r !== "accounts" && r !== "account") return;
  /* Painted once per route: rebuilding it on every paint destroyed the button the sheet returns focus to. */
  if (document.getElementById("acnewtop")) return;
  /* A role with customers.view but not customers.edit reads the book and adds nothing to it. */
  act.innerHTML = acMayEdit()
    ? '<button class="btn btn-teal ac-newtop" id="acnewtop" data-ac="new" aria-label="إضافة عميل جديد" style="display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:6px;white-space:nowrap">' + acIco("plus") + "إضافة عميل جديد</button>"
    : "";
}
function vAccounts() {
  if (acStale) { acStale = false; acLoad(!!acRows); } else acLoad(false);
  if (typeof inMemLoad === "function") inMemLoad();
  acRec = null;
  setTimeout(acPaintCrumb, 0);
  var h = '<div class="ds6"><div class="m-acc">';
  if (acRows === null && !acFailed) return h + '<div class="m-card"><p class="m-body" aria-busy="true">جارٍ تحميل العملاء…</p></div></div></div>' + acModal();
  if (acRows === null) {
    return h + '<div class="m-alert" role="alert"><span class="m-alert__t">تعذّر تحميل العملاء</span>' +
      '<span class="m-alert__d">لم يصل ردّ من الخادم.</span><button type="button" class="m-btn" data-ac="retry">أعد المحاولة</button></div></div></div>' + acModal();
  }
  acBind();
  if (acFailed) {
    h += '<div class="m-alert" role="alert"><span class="m-alert__t">تعذّر التحديث</span>' +
      '<span class="m-alert__d">المعروض آخر نسخة محمّلة.</span><button type="button" class="m-btn" data-ac="retry">أعد المحاولة</button></div>';
  }
  if (!acRows.length) {
    return h + '<div class="m-empty"><div class="m-empty__t">لا عملاء بعد</div>' +
      '<div class="m-empty__d">العميل منشأة تبيع لها Lean: اسمها ومدينتها وقطاعها وأهميتها ومن يتولاها والأشخاص فيها. أضفه يدويًا، أو استورد قائمة من «جهات الاستهداف».</div>' +
      (acMayEdit()
        ? '<div class="m-empty__a"><button type="button" class="m-btn m-btn--primary" id="acnewempty" data-ac="new">إضافة عميل جديد</button> ' +
          '<a class="m-btn" href="#targets">استيراد من ملف</a></div>'
        : "") + "</div></div></div>" + acModal();
  }
  h += acKpis();
  var counts = { all: acFiltered("all").length, approved: acFiltered("approved").length, proposed: acFiltered("proposed").length, rejected: acFiltered("rejected").length };
  var rows = acFiltered();
  /* «M» is the tab before search and filters, so «من» says how much the filters hid (review). */
  var tabTotal = (acRows || []).filter(function (a) { return acF.tab === "all" ? a.approval !== "rejected" : a.approval === acF.tab; }).length;
  var tabs = [["all", "الكل"], ["approved", "معتمدون"], ["proposed", "مقترحون"], ["rejected", "مرفوضون"]];
  h += '<div class="m-tabs" role="tablist" aria-label="حالة الاعتماد">' + tabs.map(function (t) {
      var on = acF.tab === t[0];
      return '<button type="button" class="m-tab" role="tab" aria-selected="' + on + '" tabindex="' + (on ? 0 : -1) + '" data-ac="tab" data-v="' + t[0] + '">' +
        t[1] + "<b>" + (t[0] === "proposed" ? dsFig("acProposedTab", counts[t[0]]) : acN(counts[t[0]])) + "</b></button>";
    }).join("") + "</div>";
  if (counts.proposed && acF.tab !== "proposed") {
    h += '<div class="m-alert" role="status"><span class="m-alert__t">' + acNCust(counts.proposed) + " بانتظار الاعتماد</span>" +
      '<span class="m-alert__d">لا يبدأ البيع لعميل مقترح قبل اعتماد فريق المبيعات.</span>' +
      '<button type="button" class="m-btn" data-ac="tabproposed">اعرضهم</button></div>';
  }
  var prods = {}; acRows.forEach(function (a) { acProducts(a).forEach(function (p) { prods[p] = 1; }); });
  var anyF = acF.product || acF.sector || acF.city || acF.owner || acF.importance || acF.size || acF.ind;
  h += '<div class="m-tools"><div class="m-head__a">' +
    mSearch({ id: "acq", value: acF.q, placeholder: "بحث بالاسم أو جهة الاتصال…", label: "بحث في العملاء", wide: true, attrs: ' data-acset="q"' }) +
    acSel("product", "المنتج", acF.product, Object.keys(prods).sort().map(function (p) { return [p, p]; })) +
    acSel("sector", "القطاع", acF.sector, acDistinct("sector").map(function (s) { return [s, s]; })) +
    acSel("city", "المدينة", acF.city, acDistinct("city").map(function (s) { return [s, s]; })) +
    acSel("owner", "المسؤول", acF.owner, [["none", "بلا مسؤول"]].concat(acMembers.map(function (m) { return [String(m.id), m.name]; }))) +
    acSel("importance", "الأهمية", acF.importance, ACCOUNT_IMPORTANCE.map(function (k) { return [k, ACCOUNT_IMPORTANCE_LABELS[k]]; })) +
    acSel("size", "الحجم", acF.size, ACCOUNT_SIZES.map(function (k) { return [k, ACCOUNT_SIZE_LABELS[k]]; }).concat([["__none", "بلا حجم مسجّل"]])) +
    (typeof inIndOptions === "function" && (inMembership || []).length ? '<select class="m-select" aria-label="مؤشر الاستخدام" data-acset="ind"><option value="">المؤشر: الكل</option>' + inIndOptions(acF.ind, true) + "</select>" : "") +
    (anyF ? '<button type="button" class="m-btn" data-ac="clearf">مسح التصفية</button>' : "") +
    '</div><span class="m-cap">' + dsFig("acShown", rows.length) + " من " + acN(tabTotal) + "</span></div>";
  h += '<section class="m-card m-card--pad0"><div class="m-tablewrap"><table class="m-table m-acc-table">' +
    "<thead><tr><th>العميل</th><th>المدينة</th><th>القطاع</th><th>الموظف المسؤول</th><th>مصدر الإضافة</th>" +
    '<th>الحالة</th><th class="num">الفرص</th><th class="num">قيمة الفرص</th></tr></thead><tbody>';
  if (!rows.length) {
    h += '<tr class="m-table__empty"><td colspan="8"><div class="m-empty"><div class="m-empty__t">' +
      (acF.q ? "لا عميل يطابق «" + esc(acF.q) + "»" : acF.tab === "proposed" ? "لا عملاء بانتظار الاعتماد" : acF.tab === "rejected" ? "لا عملاء مرفوضون" : "لا عملاء يطابقون هذه التصفية") + "</div>" +
      (anyF || acF.q ? '<div class="m-empty__a"><button type="button" class="m-btn" data-ac="clearall">مسح البحث والتصفية</button></div>' : "") +
      "</div></td></tr>";
  }
  rows.slice(0, acShown).forEach(function (a) { h += acRow(a); });
  h += "</tbody></table></div>";
  if (rows.length > acShown) {
    h += '<div class="m-foot"><span class="m-cap">المعروض ' + acN(acShown) + " من " + acN(rows.length) + "</span>" +
      '<button type="button" class="m-btn" data-ac="more">عرض ' + acN(Math.min(AC_PAGE, rows.length - acShown)) + " أخرى</button></div>";
  }
  return h + "</section></div></div>" + acModal();
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
    if (!target) target = document.querySelector('[data-ac="tab"][aria-selected="true"]');
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
/* «حجم المنشأة». Three states, and they are different facts:
     a recorded tier            -> the label, with its basis on hover
     a raw «الحجم» that did not map -> shown AS the raw text and marked unrecorded, because the
                                   value is real data someone typed and hiding it loses it
     nothing at all             -> a classification nobody made (PORT-SPEC §4 «unset») */
function acSizePill(tier, raw) {
  if (tier && ACCOUNT_SIZE_LABELS[tier]) {
    return ' <span class="m-chip m-chip--plain" title="' + esc(ACCOUNT_SIZE_BASIS[tier]) + '">' +
      esc(ACCOUNT_SIZE_LABELS[tier]) + "</span>";
  }
  if (raw && String(raw).trim()) {
    return ' <span class="m-chip m-chip--plain" title="قيمة مستوردة لم تطابق تصنيف «منشآت» — تحتاج مراجعة">' +
      esc(String(raw).trim()) + " ⚠</span>";
  }
  return " " + acNil("الحجم غير مسجّل", "unset");
}

var AC_FIELD_LABEL = { name: "الاسم", city: "المدينة", sector: "القطاع", importance: "الأهمية", size: "حجم المنشأة", owner: "الموظف المسؤول", contacts: "جهات الاتصال" };
var AC_EVENT = { created: "أُضيف العميل", edited: "عُدّلت بياناته", approved: "اعتُمد", rejected: "رُفض", proposed: "أُعيد إلى مقترح" };
var AC_OUTCOME = { sent: "أُرسلت", opted_out: "لم تُرسل — طلب الإيقاف", outside_window: "لم تُرسل — خارج نافذة 24 ساعة", no_inbound_ever: "لم تُرسل — لم يراسلنا بعد" };
var AC_TASK = { backlog: "مؤجلة", todo: "للتنفيذ", in_progress: "قيد التنفيذ", done: "منجزة", canceled: "ملغاة" };
function acCard(title, sub, link, body) {
  return '<section class="m-card m-card--pad0 m-acc-card"><div class="m-card__h"><h2 class="m-card__t">' + title + "</h2>" +
    '<span class="m-acc-row">' + (sub ? '<span class="m-card__k">' + sub + "</span>" : "") + (link || "") + "</span></div>" +
    '<div class="m-acc-b">' + body + "</div></section>";
}
function acCardEmpty(t, d) {
  return '<div class="m-empty" style="padding-inline:0"><div class="m-empty__t">' + t + "</div>" + (d ? '<div class="m-empty__d">' + d + "</div>" : "") + "</div>";
}
function vAccount(idRaw) {
  var id = Number(idRaw);
  setTimeout(acPaintCrumb, 0);
  var h = '<div class="ds6"><div class="m-acc"><p class="m-crumb"><a href="#accounts">&#8594; كل العملاء</a></p>';
  if (!(id > 0)) return h + '<div class="m-alert" role="alert"><span class="m-alert__t">رابط العميل غير صحيح</span></div></div></div>';
  acEnsureRec(id);
  if (acRec.missing) {
    return h + '<div class="m-alert" role="alert"><span class="m-alert__t">لا عميل بهذا الرقم</span>' +
      '<span class="m-alert__d">ربما حُذف أو الرابط قديم.</span><a class="m-btn" href="#accounts">كل العملاء</a></div></div></div>';
  }
  if (!acRec.data) {
    return h + '<div class="m-card">' + (acRec.failed
      ? '<p class="m-body" role="alert">تعذّر تحميل العميل.</p><div class="m-actions"><button type="button" class="m-btn" data-ac="recretry">أعد المحاولة</button></div>'
      : '<p class="m-body" aria-busy="true">جارٍ تحميل العميل…</p>') + "</div></div></div>" + acModal();
  }
  var d = acRec.data, a = d.account;
  /* header */
  var talked = !!d.conversation;
  h += '<section class="m-card m-acc-hd"><span class="m-av m-av--lg" aria-hidden="true">' + acIni(a.name) + "</span>" +
    '<div class="m-acc-hd__m"><div class="m-acc-row"><h1 class="m-h1" id="acrech" tabindex="-1">' + esc(a.name) + "</h1>" +
      acApprPill(a.approval) + acImpPill(a.importance) + acSizePill(a.sizeTier, a.sizeText) + "</div>" +
    '<p class="m-meta">' + [a.sector ? esc(a.sector) : "", a.city ? esc(a.city) : "", '<bdi class="m-acc-ltr">+' + esc(a.phone) + "</bdi>"].filter(Boolean).join(" · ") + "</p>" +
    '<p class="m-meta">أُضيف بواسطة ' + esc(acBy(a.createdBy)) + " · " + esc(acSource(a)) + " · " + acDate(a.createdAt) + "</p></div>" +
    '<div class="m-acc-row">' + (acMayEdit() ? '<button type="button" class="m-btn" id="acedit" data-ac="edit">تعديل</button>' : "") +
    (talked ? '<a class="m-btn" href="#customer/' + esc(a.phone) + '">فتح المحادثة</a>' : "") +
    (typeof opFromEntity === "function" && (typeof meCan !== "function" || meCan("opps.edit")) ? '<button type="button" class="m-btn m-btn--primary" data-ac="opp">فرصة +</button>' : "") + "</div></section>";
  if (a.approval === "proposed") {
    h += '<div class="m-alert" role="status"><span class="m-alert__t">عميل مقترح</span>' +
      '<span class="m-alert__d">بانتظار اعتماد فريق المبيعات قبل بدء إجراءات البيع.</span>' +
      (acMayEdit()
        ? '<button type="button" class="m-btn m-btn--primary" data-ac="approve" data-i="' + a.id + '"' + (acBusy[a.id] ? " disabled" : "") + ">اعتماد العميل</button>" +
          '<button type="button" class="m-btn" data-ac="reject" data-i="' + a.id + '"' + (acBusy[a.id] ? " disabled" : "") + ">رفض</button>"
        : "") + "</div>";
  } else if (a.approval === "rejected") {
    h += '<div class="m-alert" role="status"><span class="m-alert__t">عميل مرفوض</span>' +
      '<span class="m-alert__d">رُفض' + (a.approvalBy ? " بواسطة " + esc(acBy(a.approvalBy)) : "") + (a.approvalAt ? " في " + acDate(a.approvalAt) : "") +
      '. لا يظهر في «الكل»، وسجله محفوظ.</span>' +
      (acMayEdit() ? '<button type="button" class="m-btn" data-ac="repropose" data-i="' + a.id + '">إعادة إلى مقترح</button>' : "") + "</div>";
  }
  /* main column */
  var main = "";
  /* THE FIX. isLostStage alone left WON lines in the total and the subtitle called the result open
     pipeline — a closed deal reading as money still in play. Open and won are now separated exactly
     as the list KPI separates them, and the open lines with no price are NAMED rather than summed
     in as zero, because a zero in a money column is a claim and an unpriced line is not one. */
  var openOpps = d.opps.filter(function (o) { return isOpenStage(o.stage); });
  var wonOpps = d.opps.filter(function (o) { return isWonStage(o.stage); });
  var openValue = openOpps.reduce(function (s, o) { return s + (Number(o.value) || 0); }, 0);
  var wonValue = wonOpps.reduce(function (s, o) { return s + (Number(o.value) || 0); }, 0);
  var unpricedOpen = openOpps.filter(function (o) { return !o.value; }).length;
  var oppSub = "";
  if (d.opps.length) {
    oppSub = "قائمة: " + acN(openOpps.length) + " · " + (openValue ? acMoneyN(openValue) : acNil("لم تُسعَّر", "owed"));
    if (unpricedOpen) oppSub += " · " + acN(unpricedOpen) + " بلا تسعير";
    oppSub += " &#183; رابحة: " + acN(wonOpps.length) + (wonValue ? " · " + acMoneyN(wonValue) : "");
  }
  main += acCard("فرص العميل", oppSub, '<a class="m-link" href="#opps">كل الفرص</a>',
    d.opps.length ? d.opps.map(function (o) {
      var st = typeof opStage === "function" ? opStage(o.stage) : { label: o.stage };
      var tone = typeof opToneVars === "function" ? ' style="' + opToneVars(o.stage) + '"' : "";
      return '<div class="m-item"><span class="m-item__b"><span class="m-item__n">' + esc(o.product) + '</span><span class="m-item__s">' +
        [o.owner ? "المسؤول: " + esc(o.owner) : "", o.closeOn ? "إغلاق متوقع: " + acDate(o.closeOn) : "", o.nextStep ? "الخطوة التالية: " + esc(clip(o.nextStep, 60)) : ""].filter(Boolean).join(" · ") +
        '</span></span><span class="m-chip m-acc-stage"' + tone + ">" + esc(st.label) + '</span><span class="m-item__v">' +
        (o.value ? acMoneyN(o.value) : acNil("لم تُسعَّر", "owed")) + "</span></div>";
    }).join("") : acCardEmpty("لا فرص بيع لهذا العميل بعد",
      (typeof opFromEntity === "function" && (typeof meCan !== "function" || meCan("opps.edit")) ? '<button type="button" class="m-btn" data-ac="opp">افتح فرصة</button>' : "")));
  main += acCard("الحملات", d.campaigns.length ? acNCamp(d.campaigns.length) : "", "",
    d.campaigns.length ? d.campaigns.map(function (c) {
      return '<div class="m-item"><span class="m-item__b"><a class="m-item__n m-link" href="#kmon/' + c.id + '">' + esc(c.name) + '</a><span class="m-item__s">' +
        [c.product ? esc(c.product) : "", c.objective && typeof CAMPAIGN_OBJECTIVE_LABELS !== "undefined" ? esc(CAMPAIGN_OBJECTIVE_LABELS[c.objective] || "") : "", acDate(c.createdAt)].filter(Boolean).join(" · ") +
        '</span></span><span class="m-cap">' + esc(c.outcome ? AC_OUTCOME[c.outcome] || c.outcome : "أُدرج في الحملة") + "</span></div>";
    }).join("") : acCardEmpty("لم يُستهدف هذا العميل بأي حملة"));
  var evs = [];
  (a.events || []).forEach(function (e) {
    var extra = e.action === "edited" && e.detail && e.detail.changed && e.detail.changed.length
      ? ": " + e.detail.changed.map(function (k) { return AC_FIELD_LABEL[k] || k; }).join("، ") : "";
    var src0 = e.action === "created" && e.detail && e.detail.source ? " · " + esc(ACCOUNT_SOURCE_LABELS[e.detail.source] || "") : "";
    evs.push({ at: e.at, cls: "", html: esc(AC_EVENT[e.action] || e.action) + esc(extra) + '<span class="m-tl__s">' + esc(acBy(e.by)) + src0 + (e.detail && e.detail.note ? " · " + esc(e.detail.note) : "") + "</span>" });
  });
  (d.tasks || []).forEach(function (t) { evs.push({ at: t.dueAt || 0, cls: "warn", html: "مهمة: " + esc(t.title) + '<span class="m-tl__s">' + esc(AC_TASK[t.status] || t.status) + (t.assignedTo ? " · " + esc(t.assignedTo) : "") + (t.dueAt ? " · تستحق " + acDate(t.dueAt) : "") + "</span>" }); });
  (d.notes || []).forEach(function (n) { evs.push({ at: n.createdAt, cls: "idle", html: "ملاحظة" + (n.title ? ": " + esc(n.title) : "") + '<span class="m-tl__s">' + esc(clip(n.content, 140)) + (n.author ? " · " + esc(n.author) : "") + "</span>" }); });
  /* BR-OPP-003 work logged on this customer's opportunities. Calendar days sort by their noon so a meeting
     logged today sits among today's other entries. */
  (d.activities || []).forEach(function (x) {
    var at = new Date(x.occurredOn + "T12:00:00").getTime() || x.createdAt;
    var kind = typeof ACTIVITY_KIND_LABELS !== "undefined" ? ACTIVITY_KIND_LABELS[x.kind] || x.kind : x.kind;
    evs.push({ at: at, cls: "warn", html: esc(kind) + (x.product ? " · " + esc(x.product) : "") + '<span class="m-tl__s">' + esc(clip(x.summary, 140)) +
      /* The DUE DATE and the DEPARTMENT are recorded on every activity and neither was printed:
         a next step with no date is a promise with no deadline, and «الإدارة المعنية» is the whole
         point of writing down that a step is waiting on someone outside sales. */
      (x.nextStep ? " · الخطوة التالية: " + esc(x.nextStep) + (x.nextOn ? " — " + (typeof owDay === "function" ? owDay(x.nextOn) : esc(String(x.nextOn))) : "") : "") +
      (x.dept ? " · " + esc(x.dept) : "") + (x.owner ? " · " + esc(x.owner) : "") + "</span>" });
  });
  d.campaigns.forEach(function (c) { evs.push({ at: c.createdAt, cls: "ok", html: "حملة: " + esc(c.name) + '<span class="m-tl__s">' + esc(c.outcome ? AC_OUTCOME[c.outcome] || c.outcome : "أُدرج في الحملة") + "</span>" }); });
  evs.sort(function (x, y) { return y.at - x.at; });
  main += acCard("سجل الأنشطة", evs.length ? acN(evs.length) : "", talked ? '<a class="m-link" href="#customer/' + esc(a.phone) + '">المحادثة</a>' : "",
    evs.length ? '<div class="m-tl">' + evs.slice(0, 15).map(function (e) {
      return '<div class="m-tl__i"><span class="m-tl__d ' + e.cls + '"></span><span class="m-tl__n">' + e.html + "</span>" +
        '<span class="m-tl__t">' + (e.at ? acDate(e.at) : acNil("بلا تاريخ", "none")) + "</span></div>";
    }).join("") + "</div>" : acCardEmpty("لا أنشطة مسجّلة"));
  /* side column */
  var side = "";
  var owner = a.ownerId != null ? (d.members || []).filter(function (m) { return m.id === a.ownerId; })[0] : null;
  side += acCard("مدير الحساب", "", acMayEdit() ? '<button type="button" class="m-link" id="acedit_owner" data-ac="edit">' + (a.ownerId != null ? "تغيير" : "تعيين") + "</button>" : "",
    a.ownerName
      ? '<div class="m-item"><span class="m-av" aria-hidden="true">' + acIni(a.ownerName) + '</span><span class="m-item__b">' +
        '<span class="m-item__n">' + esc(a.ownerName) + '</span><span class="m-item__s">' +
        esc([owner ? (owner.role === "sales" ? "مبيعات" : owner.role === "support" ? "دعم" : owner.role === "manager" ? "مدير" : owner.role) : "لم يعد نشطًا في الفريق", owner && owner.division ? owner.division : ""].filter(Boolean).join(" · ")) +
        "</span></span></div>"
      : acCardEmpty("لم يُسجَّل موظف مسؤول", "العميل بلا مدير حساب — عيّنه من «تعيين»."));
  /* «مدراء المنتجات المعنيون بالحساب» (the prototype's 360 screen). The account manager owns the
     RELATIONSHIP; each product this customer is targeted with has its own manager, and when a
     question is about a product it is that person who answers it. Derived from the catalogue —
     product → owner — so nothing new is stored and nobody is named who is not the recorded owner. */
  if (typeof pcLoad === "function") pcLoad(false);
  var acPm = [];
  (function () {
    var cat = (typeof pcCat !== "undefined" && pcCat) || [];
    var mine = acProducts({ productTags: a.productTags, usesProducts: a.usesProducts, oppProducts: a.oppProducts });
    var by = {};
    mine.forEach(function (pn) {
      for (var i = 0; i < cat.length; i++) {
        if (cat[i].product !== pn) continue;
        var who = String(cat[i].owner || "").trim();
        if (!who) return;
        if (!by[who]) { by[who] = { name: who, products: [] }; acPm.push(by[who]); }
        by[who].products.push(pn);
        return;
      }
    });
  })();
  if (acPm.length) {
    side += acCard("مدراء المنتجات المعنيون", acN(acPm.length), '<a class="m-link" href="#products">كل المنتجات</a>',
      acPm.map(function (m) {
        return '<div class="m-item"><span class="m-av" aria-hidden="true">' + acIni(m.name) + "</span>" +
          '<span class="m-item__b"><span class="m-item__n">' + esc(m.name) + '</span><span class="m-item__s">' + esc(m.products.join("، ")) + "</span></span></div>";
      }).join(""));
  }
  side += acCard("جهات الاتصال", a.contacts.length ? acNPerson(a.contacts.length) : "", acMayEdit() ? '<button type="button" class="m-link" id="acedit_contacts" data-ac="edit">إدارة</button>' : "",
    a.contacts.length ? a.contacts.map(function (c) {
      return '<div class="m-item"><span class="m-av" aria-hidden="true">' + acIni(c.name) + '</span><span class="m-item__b"><span class="m-item__n">' + esc(c.name) +
        (c.primary ? ' <span class="m-chip m-chip--ac">رئيسية</span>' : "") + "</span>" +
        '<span class="m-item__s">' + [c.role ? esc(c.role) : "", c.phone ? '<bdi class="m-acc-ltr">+' + esc(c.phone) + "</bdi>" : "",
          c.email ? '<a class="m-link m-acc-ltr" href="mailto:' + esc(c.email) + '">' + esc(c.email) + "</a>" : ""].filter(Boolean).join(" · ") + "</span></span></div>";
    }).join("") : acCardEmpty("لا جهات اتصال مسجّلة", "أُضيف هذا العميل قبل أن تُحفظ جهات الاتصال." +
      (acMayEdit() ? ' <button type="button" class="m-link" id="acedit_addct" data-ac="edit">أضف جهة اتصال</button>' : "")));
  var lines = d.opps.map(function (o) { return { product: o.product, stage: o.stage }; });
  var prodList = acProducts({ productTags: a.productTags, usesProducts: a.usesProducts, oppProducts: a.oppProducts });
  side += acCard("المنتجات", prodList.length ? acN(prodList.length) : "", "",
    prodList.length ? prodList.map(function (p) {
      var st = productStatusOf(p, lines);
      var uses = (a.usesProducts || []).indexOf(p) >= 0;
      var tone = st === "won" ? "ok" : st === "open" ? "ac" : st === "lost" ? "bad" : "plain";
      return '<div class="m-item"><span class="m-item__b"><a class="m-item__n m-link" href="#product/' + encodeURIComponent(p) + '">' + esc(p) + "</a>" +
        (uses ? '<span class="m-item__s">يستخدمه حاليًا</span>' : "") + "</span>" +
        '<span class="m-chip m-chip--' + tone + '">' + esc(PRODUCT_STATUS_LABELS[st]) + "</span></div>";
    }).join("") : acCardEmpty("لا منتجات مستهدفة", "تُضاف من «جهات الاستهداف» أو بفتح فرصة."));
  side += acCard("مؤشرات الاستخدام", d.indicators.length ? acN(d.indicators.length) : "", '<a class="m-link" href="#indicators">كل المؤشرات</a>',
    d.indicators.length ? d.indicators.map(function (r) {
      return '<div class="m-item"><span class="m-item__b"><button type="button" class="m-item__n m-link" id="acind' + r.id + '" data-in="view" data-i="' + r.id + '">' + esc(r.name) + '</button><span class="m-item__s">' +
        [r.product ? esc(r.product) : "", typeof INDICATOR_STATUS_LABELS !== "undefined" ? INDICATOR_STATUS_LABELS[r.status] || "" : ""].filter(Boolean).join(" · ") + "</span></span>" +
        '<span class="m-item__v">' + (r.value ? esc(r.value) : acNil("بلا قيمة", "none")) + "</span></div>";
    }).join("") : acCardEmpty("هذا العميل ليس في أي مؤشر استخدام"));
  /* BR-PRT-004: what each partner's contact with this customer came to, and whether it reached sales. */
  if ((d.partnerResults || []).length) {
    side += acCard("تواصل الشركاء", acN(d.partnerResults.length), '<a class="m-link" href="#partners">شركاء المبيعات</a>',
      d.partnerResults.slice(0, 10).map(function (r) {
        var lbl = typeof PARTNER_RESULT_LABELS !== "undefined" ? PARTNER_RESULT_LABELS[r.result] || r.result : r.result;
        var tone = r.result === "interested" ? "ok" : r.result === "not_interested" ? "bad" : "plain";
        return '<div class="m-item"><span class="m-item__b"><span class="m-item__n">' + esc(r.partnerName) + '</span><span class="m-item__s">' +
          esc(r.product) + " · " + (typeof owDay === "function" ? owDay(r.contactedOn) : esc(r.contactedOn)) +
          (r.oppId ? ' · <a class="m-link" href="#opps/' + r.oppId + '">حُوّل لفريق المبيعات</a>' : "") + "</span></span>" +
          '<span class="m-chip m-chip--' + tone + '">' + esc(lbl) + "</span></div>";
      }).join(""));
  }
  h += '<div class="m-grid m-grid--main"><div class="m-grid">' + main + '</div><div class="m-grid">' + side + "</div></div>";
  return h + "</div></div>" + acModal() + (typeof inDrawer === "function" ? inDrawer() : "");
}

/* ---------------- the add / edit sheet ---------------- */
var acCtSeq = 0;
function acBlankContact(primary) { acCtSeq++; return { key: "c" + acCtSeq, name: "", role: "", phone: "", email: "", primary: !!primary }; }
function acOpenForm(mode, from) {
  if (typeof inMemLoad === "function") inMemLoad();
  if (mode === "edit") {
    var a = acRec && acRec.data && acRec.data.account; if (!a) return;
    acForm = { mode: "edit", id: a.id, updatedAt: a.updatedAt, phone: a.phone, from: from || "",
      d: { name: a.name, city: a.city || "", sector: a.sector || "", importance: a.importance || "", sizeTier: a.sizeTier || "", ownerId: a.ownerId == null ? "" : String(a.ownerId) },
      contacts: a.contacts.length ? a.contacts.map(function (c) { acCtSeq++; return { key: "c" + acCtSeq, id: c.id, name: c.name, role: c.role || "", phone: c.phone || "", email: c.email || "", primary: c.primary }; }) : [acBlankContact(true)],
      members: acRec.data.members || [], ownerName: a.ownerName };
  } else {
    acForm = { mode: "new", id: 0, updatedAt: 0, phone: "", from: from || "",
      d: { name: "", city: "", sector: "", importance: "medium", sizeTier: "", ownerId: "" }, contacts: [acBlankContact(true)], members: acMembers };
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
function acFerr(f) { return acForm && acForm.field === f && acForm.err ? '<span class="m-err" id="err_ac_' + f.replace(/\\./g, "_") + '" role="alert">' + esc(acForm.err) + "</span>" : ""; }
function acInp(id, label, key, value, opt) {
  opt = opt || {};
  return '<div class="m-field"><label class="m-label' + (opt.req ? " m-req" : "") + '" for="' + id + '">' + label + "</label>" +
    '<input class="m-input" id="' + id + '" ' + (opt.ct ? 'data-acct="' + opt.ct + '"' : 'data-acfld="' + key + '"') + ' value="' + esc(value || "") + '"' +
    (opt.max ? ' maxlength="' + opt.max + '"' : "") + (opt.ph ? ' placeholder="' + esc(opt.ph) + '"' : "") + (opt.type ? ' type="' + opt.type + '"' : "") +
    (opt.ltr ? ' dir="ltr" lang="en"' : "") + (opt.list ? ' list="' + opt.list + '"' : "") + (opt.req ? ' aria-required="true"' : "") + (opt.auto ? ' autocomplete="' + opt.auto + '"' : "") +
    acFld(opt.errKey || key) + ">" + (opt.hint ? '<span class="m-hint">' + opt.hint + "</span>" : "") + acFerr(opt.errKey || key) + "</div>";
}
function acModal() {
  if (!acForm) return "";
  var f = acForm, d = f.d, isEdit = f.mode === "edit";
  var cls = f.shown ? " in" : "";
  var members = (f.members || []).slice();
  if (isEdit && d.ownerId && !members.some(function (m) { return String(m.id) === d.ownerId; })) members.push({ id: Number(d.ownerId), name: (f.ownerName || "عضو سابق") + " (غير نشط)" });
  var h = '<div class="ds6"><div class="ac-scrim' + cls + '" data-ac="close"></div><div class="ac-modal"><div class="ac-box' + cls + '" role="dialog" aria-modal="true" aria-labelledby="acmt">';
  h += '<div class="m-dlg__h"><div><h2 class="m-dlg__t" id="acmt">' + (isEdit ? "تعديل بيانات العميل" : "إضافة عميل جديد") + '</h2><p class="m-meta">' +
    (isEdit ? "رقم واتساب العميل ثابت: به ترتبط محادثاته وحملاته وفرصه." : "يُضاف العميل بحالة «مقترح» بانتظار اعتماد فريق المبيعات.") +
    '</p></div><button type="button" class="m-x" data-ac="close" aria-label="إغلاق">&#215;</button></div>';
  h += '<div class="m-dlg__b"><div class="m-gl">بيانات المنشأة</div><div class="m-form">' +
    acInp("acf_name", "اسم العميل / المنشأة", "name", d.name, { req: true, max: ACCOUNT_NAME_MAX, ph: "مثال: مستشفى الرعاية الطبية" }) +
    acInp("acf_city", "المدينة", "city", d.city, { req: true, max: ACCOUNT_CITY_MAX, list: "acl_city", ph: "الرياض" }) +
    acInp("acf_sector", "القطاع / الشريحة", "sector", d.sector, { max: ACCOUNT_SECTOR_MAX, list: "acl_sector", ph: "رعاية صحية" }) +
    '<div class="m-field"><label class="m-label" for="acf_importance">درجة الأهمية</label><select class="m-select" id="acf_importance" data-acfld="importance"' + acFld("importance") + '><option value="">— غير محددة —</option>' +
      ACCOUNT_IMPORTANCE.map(function (k) { return '<option value="' + k + '"' + (d.importance === k ? " selected" : "") + ">" + ACCOUNT_IMPORTANCE_LABELS[k] + "</option>"; }).join("") + "</select>" +
      '<span class="m-hint">تقديرنا نحن لأهمية العميل — لا حجمه.</span>' + acFerr("importance") + "</div>" +
    /* «حجم المنشأة» on the Kingdom's own classification (منشآت). Each choice carries the line it
       sits on, so nobody has to remember where 49 employees stops and 50 begins, and the client
       can confirm it from their own «شهادة حجم المنشأة». */
    '<div class="m-field"><label class="m-label" for="acf_size">حجم المنشأة</label><select class="m-select" id="acf_size" data-acfld="sizeTier"' + acFld("sizeTier") + '><option value="">— غير محدد —</option>' +
      ACCOUNT_SIZES.map(function (k) { return '<option value="' + k + '"' + (d.sizeTier === k ? " selected" : "") + ">" + ACCOUNT_SIZE_LABELS[k] + " — " + ACCOUNT_SIZE_BASIS[k] + "</option>"; }).join("") + "</select>" +
      '<span class="m-hint">تصنيف «منشآت»: عدد الموظفين والإيرادات معًا، والأعلى بينهما يُغلّب.</span>' + acFerr("sizeTier") + "</div>" +
    '<div class="m-field"><label class="m-label" for="acf_owner">الموظف المسؤول</label><select class="m-select" id="acf_owner" data-acfld="ownerId"' + acFld("ownerId") + '><option value="">— بلا مسؤول —</option>' +
      members.map(function (m) { return '<option value="' + m.id + '"' + (String(m.id) === d.ownerId ? " selected" : "") + ">" + esc(m.name) + "</option>"; }).join("") + "</select>" +
      (members.length ? "" : '<span class="m-hint">لا أعضاء نشطون — أضفهم من <a class="m-link" href="#team">الفريق</a>.</span>') + acFerr("ownerId") + "</div>";
  if (isEdit) h += '<div class="m-field full"><span class="m-label">رقم واتساب العميل</span><span class="m-ro"><bdi class="m-acc-ltr">+' + esc(f.phone) + "</bdi></span></div>";
  else h += acInp("acf_phone", "رقم واتساب العميل", "phone", d.phone, { req: true, ltr: true, type: "tel", auto: "tel", ph: "05xxxxxxxx", hint: "به ترتبط المحادثات والحملات والفرص" });
  h += "</div>";
  if (f.field === "phone" && f.existingId) h += '<div><a class="m-btn" href="#account/' + f.existingId + '" data-ac="gotoexisting">افتح العميل الموجود</a></div>';
  var cities = acDistinct("city"), sectors = acDistinct("sector");
  h += '<datalist id="acl_city">' + cities.map(function (c) { return '<option value="' + esc(c) + '">'; }).join("") + "</datalist>" +
    '<datalist id="acl_sector">' + sectors.map(function (c) { return '<option value="' + esc(c) + '">'; }).join("") + "</datalist>";
  h += '<div class="m-gl" id="acf_contacts" tabindex="-1">جهات الاتصال <span class="m-cap">' + acNPerson(f.contacts.length) + '</span><span style="flex:1"></span>' +
    '<button type="button" class="m-btn" id="acaddct" data-ac="addct"' + (f.contacts.length >= CONTACTS_MAX ? " disabled" : "") + ">إضافة جهة اتصال</button></div>";
  if (f.field === "contacts" && f.err) h += '<div class="m-err" id="err_ac_contacts" role="alert">' + esc(f.err) + "</div>";
  f.contacts.forEach(function (c, i) {
    var only = f.contacts.length === 1;
    h += '<div class="m-ct"' + (c.primary ? " data-primary" : "") + ' data-ackey="' + c.key + '" role="group" aria-label="جهة الاتصال ' + fmtN(i + 1) + '">' +
      '<div class="m-ct__h">جهة الاتصال ' + acN(i + 1) + '<span style="flex:1"></span>' +
      '<button type="button" class="m-btn" data-ac="primary" data-k="' + c.key + '" aria-pressed="' + c.primary + '">' + (c.primary ? "رئيسية" : "اجعلها رئيسية") + "</button>" +
      '<button type="button" class="m-btn" data-ac="rmct" data-k="' + c.key + '"' + (only ? ' disabled title="للعميل جهة اتصال واحدة على الأقل"' : "") + ' aria-label="حذف جهة الاتصال ' + fmtN(i + 1) + '">حذف</button></div>' +
      '<div class="m-form">' + acInp("acc_" + c.key + "_name", "الاسم", "", c.name, { req: true, max: CONTACT_NAME_MAX, ct: c.key + ":name", errKey: "contacts." + i + ".name" }) +
      acInp("acc_" + c.key + "_role", "المنصب", "", c.role, { max: CONTACT_ROLE_MAX, ct: c.key + ":role", errKey: "contacts." + i + ".role", ph: "مدير تقنية المعلومات" }) +
      acInp("acc_" + c.key + "_phone", "الهاتف", "", c.phone, { ltr: true, type: "tel", ct: c.key + ":phone", errKey: "contacts." + i + ".phone" }) +
      acInp("acc_" + c.key + "_email", "البريد الإلكتروني", "", c.email, { ltr: true, type: "email", max: CONTACT_EMAIL_MAX, ct: c.key + ":email", errKey: "contacts." + i + ".email" }) + "</div></div>";
  });
  h += "</div>";
  h += '<div class="m-dlg__f">';
  if (f.confirm) {
    h += '<span class="m-err" role="alert">لديك تغييرات لم تُحفظ.</span><button type="button" class="m-btn m-btn--primary" id="ackeep" data-ac="keep">متابعة التعديل</button><button type="button" class="m-btn" data-ac="discard">تجاهل التغييرات</button>';
  } else {
    h += '<button type="button" class="m-btn m-btn--primary" data-ac="save"' + (f.busy ? ' disabled aria-busy="true"' : "") + ">" + (f.busy ? "جارٍ الحفظ…" : isEdit ? "حفظ التعديلات" : "إضافة العميل") + "</button>" +
      '<button type="button" class="m-btn" data-ac="close">إلغاء</button>' +
      (f.err && !acFieldTarget(f.field) ? '<span class="m-err" role="alert">' + esc(f.err) + "</span>" : "");
  }
  return h + "</div></div></div></div>";
}
var AC_FIELD_ID = { name: "acf_name", city: "acf_city", sector: "acf_sector", importance: "acf_importance", sizeTier: "acf_size", ownerId: "acf_owner", phone: "acf_phone", contacts: "acf_contacts" };
function acFieldTarget(field) {
  if (AC_FIELD_ID[field]) return AC_FIELD_ID[field];
  var m = /^contacts\\.(\\d+)\\.(\\w+)$/.exec(field || "");
  if (m && acForm && acForm.contacts[Number(m[1])]) return "acc_" + acForm.contacts[Number(m[1])].key + "_" + m[2];
  return "";
}
function acSave() {
  var f = acForm; if (!f || f.busy) return;
  var payload = { name: f.d.name, city: f.d.city, sector: f.d.sector, importance: f.d.importance, sizeTier: f.d.sizeTier, ownerId: f.d.ownerId, phone: f.d.phone,
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
  if (a === "clearf") { acF.product = ""; acF.sector = ""; acF.city = ""; acF.owner = ""; acF.importance = ""; acF.size = ""; acF.ind = ""; render(false); var f0 = document.querySelector('[data-acset="product"]'); if (f0) f0.focus(); return; }
  if (a === "clearall") { acF.q = ""; acF.product = ""; acF.sector = ""; acF.city = ""; acF.owner = ""; acF.importance = ""; acF.size = ""; acF.ind = ""; render(false); return; }
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
    /* Arrow keys move between the approval tabs, as a tablist should. Nothing animates on a
       keyboard-repeated action: the tab strip is repainted, not transitioned. */
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
