// customers-crm.ts — العملاء, the contact list Massar never had.
//
// WHY THIS FILE EXISTS. #customers has always rendered the IMPORTER (جهات الاستهداف): you could
// upload an audience and open a single customer by deep link, but there was no list to click a
// customer FROM. Frappe's Leads.vue is the template — market research P1 named it the highest-value
// page in that repo for Massar, because its core is identity + an append-only conversation + a small
// editable panel, which is literally what a Massar contact is.
//
// EVERY COLUMN MAPS TO A REAL FIELD on tracker.ts's Contact. Frappe's Leads list leads with
// lead_name/organization/status/email/mobile/_assign — of those, only a name and a phone exist here.
// There is no owner, no organization, no email, no SLA, and delivery state is OBSERVED from
// statusTimes rather than chosen from a dropdown. Porting Frappe's writable status control would
// manufacture state the ledger never saw (P1's caution), so status here is read-only and the only
// operator-writable fields remain outcome, tags and the six props.
//
// PORTED to the new design system (docs/PORT-SPEC.md). The screen is one .ds6 wrapper: a real table
// in .m-tablewrap instead of the .crmgrid/.crow display:contents grid (eight declared tracks that
// had to stay in step with eight cells by hand), .m-tab tabs, .m-seg for the list/group switch,
// .m-chip for the derived stage, .m-n around every digit, and the three absence kinds — a contact
// the assistant never read is «لم يُصنَّف» (unset), which is a different thing from «بلا نشاط»
// (none) two columns over, and the old screen drew both as the same grey dash.
//
// NO BACKTICKS ANYWHERE IN THIS FILE, comments included: it is one template literal.

export const CUSTOMERS_CRM_CSS = `
/* Only what the vocabulary genuinely lacks: the table's minimum width, the stage dot that carries
   its own colour from CRM_STAGE, and the ltr-isolated phone under a contact's name. */
.ds6 .m-cus { display: grid; gap: var(--m-4); }
.ds6 .m-cus-table { min-inline-size: 860px; }
.ds6 .m-cus-k { display: inline-flex; align-items: center; gap: 7px; white-space: nowrap; }
.ds6 .m-cus-k i { inline-size: 7px; block-size: 7px; border-radius: 50%; flex: 0 0 auto; }
.ds6 .m-cus-ph { display: block; direction: ltr; unicode-bidi: isolate; font-size: var(--m-t-micro); color: var(--m-faint); }
.ds6 .m-cus-grp { display: grid; gap: var(--m-4); }
.ds6 .m-bulk {
  position: sticky; inset-block-end: var(--m-4); z-index: var(--z-sticky, 100);
  display: flex; align-items: center; gap: var(--m-3); flex-wrap: wrap;
  background: var(--m-paper); border-radius: var(--m-r-card);
  box-shadow: var(--m-hair), var(--m-lift); padding: var(--m-3) var(--m-4);
}
`;

export const CUSTOMERS_CRM_JS = `
/* ============================ customers-crm (client) ============================ */
var cusView = "list";       /* list | group */
var cusGroupKey = "stage";
var cusTab = "all";         /* all | engaged | interested | stopped | test */
var cusQ = "";
var cusSort = "recent";
var cusSel = {};

/* Outcome is a STORED field with eight values. It is rendered, never invented: a contact with no
   outcome reads «جديد», not a guessed state. */
var CUS_OUTCOME = [
  { key: "interested",     label: "مهتم",           dot: "#12633F" },
  { key: "scheduled",      label: "موعد محدَّد",     dot: "#2563EB" },
  { key: "handoff",        label: "تحويل لمندوب",   dot: "#1E5FCC" },
  { key: "later",          label: "لاحقًا",          dot: "#7A5600" },
  { key: "not_interested", label: "غير مهتم",       dot: "#656B76" },
  { key: "closed",         label: "مغلق",           dot: "#656B76" },
  { key: "stopped",        label: "أوقف الرسائل",   dot: "#8E2A27" },
  { key: "opted_out",      label: "ألغى الاشتراك",  dot: "#8E2A27" }
];
function cusOutcome(c) {
  if (c.optedOut) return { key: "opted_out", label: "ألغى الاشتراك", dot: "#8E2A27" };
  for (var i = 0; i < CUS_OUTCOME.length; i++) if (CUS_OUTCOME[i].key === c.outcome) return CUS_OUTCOME[i];
  return { key: "new", label: "جديد", dot: "#A2A9B4" };
}
/* Interest is the STRONGEST tag the assistant recorded, with its product. Tags are the assistant's
   reading, so the level is shown with its own word and never merged into the outcome column. */
var CUS_LVL = { hot: { label: "نية مرتفعة", dot: "#12633F" }, warm: { label: "اهتمام", dot: "#7A5600" }, cold: { label: "فاتر", dot: "#A2A9B4" } };
function cusTopTag(c) {
  var tags = c.tags || [], best = null;
  var rank = { hot: 3, warm: 2, cold: 1 };
  for (var i = 0; i < tags.length; i++) if (!best || (rank[tags[i].level] || 0) > (rank[best.level] || 0)) best = tags[i];
  return best;
}

function cusN(v) { return '<span class="m-n">' + fmtN(v) + "</span>"; }
/* kind: "owed" a number someone owes, "unset" a classification nobody made, "none" a legitimate
   nothing. The assistant not having read a contact yet is unset; a contact with no recorded
   activity is none. Both used to render the same dash. */
function cusNil(t, kind) { return '<span class="m-td-nil m-nil--' + (kind || "none") + '">' + esc(t) + "</span>"; }
function cusPl(n) { return typeof opPl === "function" ? opPl(n, "جهة واحدة", "جهتان", "جهات", "جهة") : fmtN(n) + " جهة"; }
/* The counted noun ALONE, agreeing four ways: a figure bound with dsFig has to be its own element
   whose text is exactly the number, so the noun cannot ride inside opPl's string. */
function cusNoun(n) { return n === 1 ? "جهة" : n === 2 ? "جهتان" : (n >= 3 && n <= 10) ? "جهات" : "جهة"; }

/* «مَن عملائي أنا؟» on the clients screen. The tab counts stay whole-book on purpose: narrowing to
   one department's list must not change what the pills report the ledger contains. Its own state,
   because a filter set while reading العملاء must not follow you into the campaign wizard. */
var cusTagF = "";
/* The assistant's interest READING (contacts.tags[].product), exact — not the operator's targeting label
   (cusTagF). Set by the product record's «اهتمام رصده المساعد» link. */
var cusProdF = "";
window.cusClearProd = function () { cusProdF = ""; render(false); };
function cusContacts() {
  var all = ((cache && cache.contacts) || []).slice();
  var q = cusQ.trim();
  var out = all.filter(function (c) {
    /* الكل counts REAL contacts, so it must also SHOW only real ones. The first version let test
       rows through on الكل while the pill excluded them — a count and a list disagreeing about the
       same word, which is the defect the campaigns board already had to fix once. */
    if (cusTab === "test") { if (!c.test) return false; }
    else if (c.test) return false;
    if (cusTab === "engaged" && !(c.transcript || []).some(function (t) { return t.role === "customer"; })) return false;
    if (cusTab === "interested" && !cusTopTag(c) && c.outcome !== "interested") return false;
    if (cusTab === "stopped" && !(c.optedOut || c.outcome === "stopped")) return false;
    if (cusTagF && !contactTagged(c, cusTagF)) return false;
    if (cusProdF && !(c.tags || []).some(function (t) { return t.product === cusProdF; })) return false;
    if (!q) return true;
    return (c.waName || "").includes(q) || (c.phone || "").includes(q) ||
      (c.tags || []).some(function (t) { return (t.product || "").includes(q); });
  });
  if (cusSort === "messages") out.sort(function (a, b) { return (b.transcript || []).length - (a.transcript || []).length; });
  else if (cusSort === "name") out.sort(function (a, b) { return String(a.waName || a.phone).localeCompare(String(b.waName || b.phone), "ar"); });
  else out.sort(function (a, b) { return Number(b.lastEventAt || 0) - Number(a.lastEventAt || 0); });
  return out;
}
function cusVisible() { var v = {}; cusContacts().forEach(function (c) { v[c.phone] = true; }); return v; }
function cusSelPhones() { var v = cusVisible(); return Object.keys(cusSel).filter(function (k) { return cusSel[k] && v[k]; }); }
function cusDropSel() {
  var n = Object.keys(cusSel).length; cusSel = {};
  if (n && typeof alertBar === "function") alertBar("أُلغي تحديد " + cusPl(n) + " عند تغيير العرض", false);
}

/* The tab counts and the list total are printed in more than one place (a badge, a pill, the pager),
   so each is bound to the array it is rendered from. dsVerify re-derives them on every paint and
   outlines any figure that disagrees — the whole reason the mechanism exists. */
function cusBook() { return ((cache && cache.contacts) || []); }
function cusTabCount(tab) {
  var all = cusBook();
  if (tab === "test") return all.filter(function (c) { return c.test; }).length;
  var real = all.filter(function (c) { return !c.test; });
  if (tab === "all") return real.length;
  if (tab === "engaged") return real.filter(function (c) { return (c.transcript || []).some(function (t) { return t.role === "customer"; }); }).length;
  if (tab === "interested") return real.filter(function (c) { return cusTopTag(c) || c.outcome === "interested"; }).length;
  return real.filter(function (c) { return c.optedOut || c.outcome === "stopped"; }).length;
}
function cusBind() {
  dsD("cusAll", function () { return cusTabCount("all"); });
  dsD("cusEngaged", function () { return cusTabCount("engaged"); });
  dsD("cusInterested", function () { return cusTabCount("interested"); });
  dsD("cusStopped", function () { return cusTabCount("stopped"); });
  dsD("cusTest", function () { return cusTabCount("test"); });
  dsD("cusShown", function () { return cusContacts().length; });
}

/* --------------------------------- the row --------------------------------- */
function cusRow(c) {
  var oc = stageOf(c);
  var since = stageSince(c);
  var tag = cusTopTag(c);
  var lvl = tag ? CUS_LVL[tag.level] : null;
  var msgs = (c.transcript || []).length;
  var on = !!cusSel[c.phone];
  var nm = c.waName || c.phone;
  var go = "location.hash=&quot;customer/" + esc(c.phone) + "&quot;";
  return "<tr" + (on ? ' aria-selected="true"' : "") + ' role="link" tabindex="0" onclick="' + go + '"' +
    ' onkeydown="if(event.key===&quot;Enter&quot;){' + go + '}">' +
    '<td class="m-sel"><input type="checkbox" class="m-cb" aria-label="تحديد ' + esc(nm) + '"' + (on ? " checked" : "") +
      ' onclick="event.stopPropagation();cusToggle(&quot;' + esc(c.phone) + '&quot;)"></td>' +
    '<td class="m-td-n"><span class="m-cus-k"><i style="background:' + (c.test ? "#D8DCE3" : "#2563EB") + '" title="' +
      (c.test ? "جهة تجريبية" : "جهة فعلية") + '"></i>' + esc(nm) + "</span>" +
      /* only show the phone as a SECOND line when the name is not already the phone — a nameless
         contact was rendering the same number twice, at two different weights. */
      (c.waName ? '<span class="m-cus-ph">' + esc(c.phone) + "</span>" : "") + "</td>" +
    '<td><span class="m-cus-k" title="' + esc(oc.hint) + '"><i style="background:' + oc.dot + '"></i>' + esc(oc.label) + "</span>" +
      (c.human ? '<span class="m-cus-ph" style="color:var(--m-warn)">تدخّل بشري</span>'
        : (since ? '<span class="m-cus-ph">منذ ' + fmtAgo(Date.now() - since) + "</span>" : "")) + "</td>" +
    "<td>" + (lvl
      ? '<span class="m-cus-k"><i style="background:' + lvl.dot + '"></i>' + esc(lvl.label) + "</span>" +
        '<span class="m-cus-ph">' + esc(tag.product) + "</span>"
      : cusNil("لم يُصنَّف", "unset")) + "</td>" +
    '<td class="m-td-v">' + cusN(msgs) + "</td>" +
    '<td class="m-td-v">' + (c.lastEventAt ? '<span class="m-n">' + fmtD(c.lastEventAt) + "</span>" : cusNil("بلا نشاط", "none")) + "</td></tr>";
}

function cusHead(allOn) {
  return '<thead><tr><th class="m-sel"><input type="checkbox" class="m-cb" aria-label="تحديد المعروض"' +
    (allOn ? " checked" : "") + ' onclick="cusTogglePage()"></th>' +
    "<th>العميل</th><th>المرحلة</th><th>اهتمام المساعد</th>" +
    '<th class="num">الرسائل</th><th class="num">آخر نشاط</th></tr></thead>';
}

/* ------------------------------- control bar ------------------------------- */
function cusControlBar(nTotal) {
  var h = '<div class="m-tools"><div class="m-head__a">';
  h += '<input id="cusq" class="m-input" value="' + esc(cusQ) + '" oninput="cusSearch(this)" placeholder="ابحث بالاسم أو الرقم أو الخدمة…" aria-label="ابحث في العملاء">';
  h += '<div class="m-seg" role="group" aria-label="طريقة العرض">' + [["list", "قائمة"], ["group", "تجميع"]].map(function (v) {
      return '<button type="button" aria-pressed="' + (cusView === v[0]) + '" onclick="cusSetView(&quot;' + v[0] + '&quot;)">' + v[1] + "</button>";
    }).join("") + "</div>";
  if (cusView === "list") {
    h += '<select class="m-select" aria-label="الترتيب" onchange="cusSetSort(this.value)">' +
      '<option value="recent"' + (cusSort === "recent" ? " selected" : "") + ">الأحدث نشاطًا</option>" +
      '<option value="messages"' + (cusSort === "messages" ? " selected" : "") + ">الأكثر رسائل</option>" +
      '<option value="name"' + (cusSort === "name" ? " selected" : "") + ">الاسم</option></select>";
  } else {
    h += '<select class="m-select" aria-label="التجميع" onchange="cusSetGroup(this.value)">' +
      '<option value="stage"' + (cusGroupKey === "stage" ? " selected" : "") + ">تجميع حسب: المرحلة</option>" +
      '<option value="outcome"' + (cusGroupKey === "outcome" ? " selected" : "") + ">تجميع حسب: النتيجة المسجَّلة</option>" +
      '<option value="interest"' + (cusGroupKey === "interest" ? " selected" : "") + ">تجميع حسب: اهتمام المساعد</option>" +
      '<option value="product"' + (cusGroupKey === "product" ? " selected" : "") + ">تجميع حسب: الخدمة</option></select>";
  }
  var tags = tagList();
  if (tags.length) {
    h += '<select class="m-select" aria-label="الوسم" onchange="cusSetTag(this.value)"><option value="">الوسم: الكل</option>' +
      tags.map(function (t) {
        return '<option value="' + esc(t.name) + '"' + (cusTagF === t.name ? " selected" : "") + ">" + esc(clip(t.name, 26)) + "</option>";
      }).join("") + "</select>";
  }
  if (cusProdF) {
    h += '<button type="button" class="m-btn" onclick="cusClearProd()" aria-label="إزالة تصفية المنتج">اهتمام رصده المساعد: ' +
      esc(cusProdF) + " &#215;</button>";
  }
  h += '<button type="button" class="m-btn" onclick="cusExport()">تصدير CSV</button>';
  h += '</div><span class="m-cap">' + cusPl(nTotal) + "</span></div>";
  return h;
}

function cusTabs() {
  var tabs = [["all", "الكل", "cusAll"], ["engaged", "ردّوا", "cusEngaged"],
              ["interested", "مهتمون", "cusInterested"], ["stopped", "أوقفوا", "cusStopped"],
              ["test", "تجريبية", "cusTest"]];
  return '<div class="m-tabs" role="tablist" aria-label="تصفية العملاء">' + tabs.map(function (t) {
    var on = cusTab === t[0];
    return '<button type="button" class="m-tab" role="tab" aria-selected="' + on + '" tabindex="' + (on ? 0 : -1) + '" onclick="cusSetTab(&quot;' + t[0] + '&quot;)">' +
      t[1] + "<b>" + dsFig(t[2], cusTabCount(t[0])) + "</b></button>";
  }).join("") + "</div>";
}

/* --------------------------------- views --------------------------------- */
function cusListView(rows) {
  var shown = pageSlice("cus", rows);
  var allOn = shown.length > 0 && shown.every(function (c) { return cusSel[c.phone]; });
  var h = '<section class="m-card m-card--pad0"><div class="m-tablewrap"><table class="m-table m-cus-table">' + cusHead(allOn) + "<tbody>";
  shown.forEach(function (c) { h += cusRow(c); });
  if (!shown.length) {
    h += '<tr class="m-table__empty"><td colspan="6"><div class="m-empty"><div class="m-empty__t">' +
      (cusQ.trim() ? "لا جهة تطابق «" + esc(cusQ.trim()) + "»" : "لا جهات في هذا التبويب") + "</div></div></td></tr>";
  }
  h += "</tbody></table></div>";
  h += '<div class="m-foot">' + dsPageBar("cus", rows.length, cusNoun(rows.length), "cusShown") +
    '<span class="m-cap">المرحلة مشتقّة من السجل — التسليم والردّ والوسم والنتيجة. لا تُكتب يدويًا ولا تُقدَّر.</span></div></section>';
  return h;
}

function cusGroupView(rows) {
  var by = {}, order = [];
  rows.forEach(function (c) {
    var k;
    if (cusGroupKey === "stage") k = stageOf(c).label;
    else if (cusGroupKey === "outcome") k = cusOutcome(c).label;
    else if (cusGroupKey === "interest") { var t = cusTopTag(c); k = t ? CUS_LVL[t.level].label : "بلا قراءة"; }
    else { var t2 = cusTopTag(c); k = t2 ? t2.product : "بلا خدمة"; }
    if (!by[k]) { by[k] = []; order.push(k); }
    by[k].push(c);
  });
  /* A pipeline board has to run in LADDER order. order[] is first-seen order, which for stages is
     whatever the ledger happened to return — and an out-of-order pipeline throws away the one
     property (position) that makes «forward» and «backward» mean anything. */
  if (cusGroupKey === "stage") {
    var pos = {};
    CRM_STAGE.forEach(function (st) { pos[st.label] = st.pos; });
    order.sort(function (a, b) { return (pos[a] || 99) - (pos[b] || 99); });
  }
  if (order.length <= 1) {
    return '<div class="m-alert" role="status"><span class="m-alert__t">مجموعة واحدة</span>' +
      '<span class="m-alert__d">كل الجهات في مجموعة واحدة — التجميع لا يضيف شيئًا هنا.</span>' +
      '<button type="button" class="m-btn" onclick="cusSetView(&quot;list&quot;)">عد إلى القائمة</button></div>' + cusListView(rows);
  }
  var h = '<div class="m-cus-grp">';
  order.forEach(function (k) {
    var g = by[k].slice(0, LIST_CAP);   /* per-group preview; the flat list paginates */
    h += '<section class="m-card m-card--pad0"><div class="m-card__h" style="padding:var(--m-3) var(--m-5)">' +
      '<h2 class="m-card__t">' + esc(k) + '</h2><span class="m-chip m-chip--plain">' + cusN(by[k].length) + "</span></div>" +
      '<div class="m-tablewrap"><table class="m-table m-cus-table">' + cusHead(false) + "<tbody>";
    g.forEach(function (c) { h += cusRow(c); });
    h += "</tbody></table></div>";
    if (by[k].length > g.length) {
      h += '<div class="m-foot"><span class="m-cap">تُعرض ' + cusN(g.length) + " من " + cusN(by[k].length) + " " + cusNoun(by[k].length) + "</span></div>";
    }
    h += "</section>";
  });
  return h + "</div>";
}

function cusBulkBar() {
  var ph = cusSelPhones();
  if (!ph.length) return "";
  return '<div class="m-bulk" role="status">' +
    '<span class="m-card__t">' + cusN(ph.length) + " محدَّدة</span>" +
    '<button type="button" class="m-btn m-btn--primary" onclick="cusRetarget()">إعادة استهداف المحدد</button>' +
    '<button type="button" class="m-btn" onclick="cusExportSel()">تصدير المحدد CSV</button>' +
    '<span style="flex:1"></span>' +
    '<button type="button" class="m-x" aria-label="إلغاء التحديد" onclick="cusClear()">&#215;</button></div>';
}

function vCustomersCrm() {
  setTimeout(cusPaintCrumb, 0);
  cusBind();
  if (!cusBook().length) {
    return '<div class="ds6"><div class="m-empty"><div class="m-empty__t">لا جهات بعد</div>' +
      '<div class="m-empty__d">ارفع ملف جهات الاستهداف — كل جهة تظهر هنا بعد أول رسالة.</div>' +
      '<div class="m-empty__a"><a class="m-btn m-btn--primary" href="#targets">جهات الاستهداف</a></div></div></div>';
  }
  var rows = cusContacts();
  var h = '<div class="ds6"><div class="m-cus">';
  h += cusControlBar(rows.length);
  h += cusTabs();
  h += cusView === "group" ? cusGroupView(rows) : cusListView(rows);
  h += cusBulkBar();
  return h + "</div></div>";
}

function cusPaintCrumb() {
  var ps = document.getElementById("ps"), act = document.getElementById("crumbact");
  if (ps) ps.textContent = cusView === "group" ? "تجميع" : "قائمة";
  if (act) {
    act.innerHTML = '<a href="#targets" class="btn" style="text-decoration:none;display:inline-flex;' +
      'align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:6px;font-size:14px;' +
      'font-weight:500;color:#fff;background:#2563EB;border:none;">' + ic("up", 15, "#fff") + ' استيراد جهات</a>';
  }
}

/* ================================= handlers ================================= */
window.cusSetView = function (v) { cusView = v; cusDropSel(); render(false); };
window.cusSetTab = function (t) { cusTab = t; cusDropSel(); render(false); };
window.cusSetGroup = function (k) { cusGroupKey = k; render(false); };
window.cusSetSort = function (v) { cusSort = v; render(false); };
window.cusSetTag = function (v) { cusTagF = v; cusDropSel(); render(false); };
window.cusSearch = function (el) { cusQ = el.value; cusDropSel(); clearTimeout(window.__cq3); window.__cq3 = setTimeout(function () { render(false); }, 250); };
window.cusToggle = function (ph) { if (cusSel[ph]) delete cusSel[ph]; else cusSel[ph] = true; render(false); };
window.cusClear = function () { cusSel = {}; render(false); };
window.cusTogglePage = function () {
  var shown = pageSlice("cus", cusContacts());
  var allOn = shown.length > 0 && shown.every(function (c) { return cusSel[c.phone]; });
  shown.forEach(function (c) { if (allOn) delete cusSel[c.phone]; else cusSel[c.phone] = true; });
  render(false);
};
function cusCsv(list) {
  var rows = [["الاسم", "الرقم", "المرحلة", "اهتمام المساعد", "الخدمة", "الرسائل", "آخر نشاط"]];
  list.forEach(function (c) {
    var t = cusTopTag(c);
    rows.push([c.waName || "", c.phone, stageOf(c).label, t ? CUS_LVL[t.level].label : "",
      t ? t.product : "", (c.transcript || []).length, c.lastEventAt ? fmtD(c.lastEventAt) : ""]);
  });
  crmDownloadCsv(rows, "massar-customers.csv");
}
window.cusExport = function () { var r = cusContacts(); cusCsv(r); alertBar("صُدّرت " + cusPl(r.length), false); };
window.cusExportSel = function () {
  var ph = cusSelPhones();
  cusCsv(ph.map(contactByPhone).filter(Boolean));
  alertBar("صُدّرت " + cusPl(ph.length), false);
};
/* Stages the selected contacts as a wizard cohort and stops — the launch itself stays behind the
   wizard's human gate. No send path exists in this module. */
window.cusRetarget = function () {
  var ph = cusSelPhones();
  if (!ph.length) return;
  lastDetailCohort = {
    label: "مختارة من العملاء", campaign: "",
    targets: ph.map(function (p) { var c = contactByPhone(p); return { phone: p, name: (c && c.waName) || "" }; })
  };
  cusSel = {};
  startRetarget();
};
/* ========================= end customers-crm (client) ========================= */
`;
