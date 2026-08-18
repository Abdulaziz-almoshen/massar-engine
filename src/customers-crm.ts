// customers-crm.ts — العملاء, the contact list Massar never had.
//
// WHY THIS FILE EXISTS. #customers has always rendered the IMPORTER (جهات الاستهداف): you could
// upload an audience and open a single customer by deep link, but there was no list to click a
// customer FROM. Frappe's Leads.vue is the template — market research P1 named it the highest-value
// page in that repo for Massar, because its core is identity + an append-only conversation + a small
// editable panel, which is literally what a Massar contact is.
//
// SHARED CHROME. .crmbar/.vtog/.qpill/.crow/.crmflat/.selcell/.bulkbar/.cntpill and the phone
// breakpoint are all defined once in CAMPAIGNS_CRM_CSS and injected globally, so this module reuses
// them rather than forking a parallel stylesheet. Only genuinely customer-specific rules live here.
//
// EVERY COLUMN MAPS TO A REAL FIELD on tracker.ts's Contact. Frappe's Leads list leads with
// lead_name/organization/status/email/mobile/_assign — of those, only a name and a phone exist here.
// There is no owner, no organization, no email, no SLA, and delivery state is OBSERVED from
// statusTimes rather than chosen from a dropdown. Porting Frappe's writable status control would
// manufacture state the ledger never saw (P1's caution), so status here is read-only and the only
// operator-writable fields remain outcome, tags and the six props.

export const CUSTOMERS_CRM_CSS = `
  /* EIGHT tracks for EIGHT cells: selcell · name · outcome · human · interest · messages ·
     last-activity · chevron. c-meta and c-fig are display:contents, so their children are
     the grid items — a mismatch here wraps the row instead of aligning it. */
  .cusflat .crow { grid-template-columns: 40px 2fr 1.1fr .8fr 1.5fr .6fr 1fr 44px; }
  @media (max-width: 939px) {
    .cusflat .crow { grid-template-columns: 40px minmax(0,1fr) auto; }
  }
  .taglvl { display:inline-flex; align-items:center; gap:6px; white-space:nowrap; }
  .taglvl .d { width:6px; height:6px; border-radius:999px; flex:none; }
`;

export const CUSTOMERS_CRM_JS = `
/* ============================ customers-crm (client) ============================ */
var cusView = "list";       /* list | group */
var cusGroupKey = "outcome";
var cusTab = "all";         /* all | engaged | interested | stopped | test */
var cusQ = "";
var cusSort = "recent";
var cusSel = {};

/* Outcome is a STORED field with eight values. It is rendered, never invented: a contact with no
   outcome reads «جديد», not a guessed state. */
var CUS_OUTCOME = [
  { key: "interested",     label: "مهتم",           dot: "#027A48" },
  { key: "scheduled",      label: "موعد محدَّد",     dot: "#1F7A73" },
  { key: "handoff",        label: "تحويل لمندوب",   dot: "#2F5F94" },
  { key: "later",          label: "لاحقًا",          dot: "#B54708" },
  { key: "not_interested", label: "غير مهتم",       dot: "#7C7C7C" },
  { key: "closed",         label: "مغلق",           dot: "#7C7C7C" },
  { key: "stopped",        label: "أوقف الرسائل",   dot: "#B42318" },
  { key: "opted_out",      label: "ألغى الاشتراك",  dot: "#B42318" }
];
function cusOutcome(c) {
  if (c.optedOut) return { key: "opted_out", label: "ألغى الاشتراك", dot: "#B42318" };
  for (var i = 0; i < CUS_OUTCOME.length; i++) if (CUS_OUTCOME[i].key === c.outcome) return CUS_OUTCOME[i];
  return { key: "new", label: "جديد", dot: "#C7C7C7" };
}
/* Interest is the STRONGEST tag the assistant recorded, with its product. Tags are the assistant's
   reading, so the level is shown with its own word and never merged into the outcome column. */
var CUS_LVL = { hot: { label: "نية مرتفعة", dot: "#027A48" }, warm: { label: "اهتمام", dot: "#B54708" }, cold: { label: "فاتر", dot: "#999999" } };
function cusTopTag(c) {
  var tags = c.tags || [], best = null;
  var rank = { hot: 3, warm: 2, cold: 1 };
  for (var i = 0; i < tags.length; i++) if (!best || (rank[tags[i].level] || 0) > (rank[best.level] || 0)) best = tags[i];
  return best;
}
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
  if (n && typeof alertBar === "function") alertBar("أُلغي تحديد " + fmtN(n) + " عند تغيير العرض", false);
}

/* --------------------------------- the row --------------------------------- */
function cusRow(c) {
  var oc = cusOutcome(c);
  var tag = cusTopTag(c);
  var lvl = tag ? CUS_LVL[tag.level] : null;
  var msgs = (c.transcript || []).length;
  var on = !!cusSel[c.phone];
  var nm = c.waName || c.phone;
  return '<div class="trow km krow crow' + (on ? " sel" : "") + '" onclick="location.hash=&quot;customer/' + esc(c.phone) + '&quot;">' +
    '<div class="selcell"><input type="checkbox" aria-label="تحديد ' + esc(nm) + '"' + (on ? " checked" : "") + ' onclick="event.stopPropagation();cusToggle(&quot;' + esc(c.phone) + '&quot;)"></div>' +
    '<div class="c-name" style="display:flex;align-items:center;gap:12px;min-width:0;">' +
      '<span role="img" aria-label="' + (c.test ? "جهة تجريبية" : "جهة فعلية") + '" style="width:9px;height:9px;border-radius:999px;flex:none;background:' + (c.test ? "#E2E2E2" : "#1F7A73") + ';"></span>' +
      '<div style="min-width:0;"><div style="font-size:14px;font-weight:500;color:#171717;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(nm) + '</div></div>' +
      '<span style="font-size:12px;color:#7C7C7C;flex:none;direction:ltr;">' + esc(c.phone) + '</span></div>' +
    '<div class="c-meta">' +
      '<div class="c-prod taglvl"><span class="d" style="background:' + oc.dot + ';"></span><span style="font-size:13px;color:#525252;">' + oc.label + '</span></div>' +
      '<div class="c-state">' + (c.human ? '<span style="font-size:12px;color:#B54708;">تدخّل بشري</span>' : "") + '</div>' +
    '</div>' +
    '<div class="c-fig fig">' +
      '<div class="c-num" style="text-align:start;">' + (lvl
        ? '<span class="taglvl"><span class="d" style="background:' + lvl.dot + ';"></span><span style="font-size:13px;color:#525252;">' + lvl.label + '</span></span>' +
          '<span style="font-size:12px;color:#999999;"> · ' + esc(tag.product) + '</span>'
        : '<span style="font-size:13px;color:#999999;">—</span>') + '</div>' +
      '<div class="c-num">' + fmtN(msgs) + '</div>' +
      '<div class="c-num" style="text-align:start;font-weight:450;color:#7C7C7C;font-size:12px;">' + (c.lastEventAt ? fmtD(c.lastEventAt) : "—") + '</div>' +
    '</div>' +
    '<div class="c-act" style="text-align:center;"><span style="color:#C7C7C7;font-size:14px;">‹</span></div>' +
  '</div>';
}

function cusHeader(allOn) {
  return '<div class="crow thead-wide" style="padding:8px 20px 8px 12px;background:#fff;border-bottom:1px solid #EDEDED;font-size:12px;font-weight:500;color:#7C7C7C;">' +
    '<div class="selcell" style="opacity:1;"><input type="checkbox" aria-label="تحديد المعروض"' + (allOn ? " checked" : "") + ' onclick="cusTogglePage()"></div>' +
    '<div>العميل</div>' +
    '<div class="c-meta"><div>الحالة</div><div></div></div>' +
    '<div class="c-fig fig">' +
      '<div class="c-num" style="text-align:start;color:#7C7C7C;font-size:12px;">اهتمام المساعد</div>' +
      '<div class="c-num" style="color:#7C7C7C;font-size:12px;">الرسائل</div>' +
      '<div class="c-num" style="text-align:start;color:#7C7C7C;font-size:12px;">آخر نشاط</div>' +
    '</div>' +
    '<div></div></div>';
}

/* ------------------------------- control bar ------------------------------- */
function cusControlBar(nTotal) {
  var all = ((cache && cache.contacts) || []);
  var tabs = [
    ["all", "الكل", all.filter(function (c) { return !c.test; }).length],
    ["engaged", "ردّوا", all.filter(function (c) { return !c.test && (c.transcript || []).some(function (t) { return t.role === "customer"; }); }).length],
    ["interested", "مهتمون", all.filter(function (c) { return !c.test && (cusTopTag(c) || c.outcome === "interested"); }).length],
    ["stopped", "أوقفوا", all.filter(function (c) { return !c.test && (c.optedOut || c.outcome === "stopped"); }).length],
    ["test", "تجريبية", all.filter(function (c) { return c.test; }).length]
  ];
  var h = '<div class="crmbar rise">';
  h += '<span style="position:relative;display:inline-flex;align-items:center;flex:1;min-width:200px;max-width:320px;">' +
    '<span style="position:absolute;inset-inline-start:13px;color:#999999;display:flex;">' + ic("search", 17) + '</span>' +
    '<input id="cusq" class="inp" value="' + esc(cusQ) + '" oninput="cusSearch(this)" placeholder="ابحث بالاسم أو الرقم أو الخدمة…" style="width:100%;padding-inline-start:40px;height:38px;border-radius:999px;font-size:12px;"></span>';
  h += '<span class="vtog">' + [["list", "قائمة"], ["group", "تجميع"]].map(function (v) {
      return '<button class="' + (cusView === v[0] ? "on" : "") + '" onclick="cusSetView(&quot;' + v[0] + '&quot;)">' + v[1] + '</button>';
    }).join("") + '</span>';
  h += tabs.map(function (t) {
    return '<button class="qpill' + (cusTab === t[0] ? " on" : "") + '" onclick="cusSetTab(&quot;' + t[0] + '&quot;)">' + t[1] + " (" + fmtN(t[2]) + ")</button>";
  }).join("");
  h += '<span style="flex:1"></span><span class="hair"></span>';
  if (cusView === "list") {
    h += '<select onchange="cusSetSort(this.value)" class="crmsel">' +
      '<option value="recent"' + (cusSort === "recent" ? " selected" : "") + '>الأحدث نشاطًا</option>' +
      '<option value="messages"' + (cusSort === "messages" ? " selected" : "") + '>الأكثر رسائل</option>' +
      '<option value="name"' + (cusSort === "name" ? " selected" : "") + '>الاسم</option></select>';
  } else {
    h += '<select onchange="cusSetGroup(this.value)" class="crmsel">' +
      '<option value="outcome"' + (cusGroupKey === "outcome" ? " selected" : "") + '>تجميع حسب: الحالة</option>' +
      '<option value="interest"' + (cusGroupKey === "interest" ? " selected" : "") + '>تجميع حسب: اهتمام المساعد</option>' +
      '<option value="product"' + (cusGroupKey === "product" ? " selected" : "") + '>تجميع حسب: الخدمة</option></select>';
  }
  h += '<button class="btn btn-ghost" style="height:32px;padding:0 12px;border-radius:6px;font-size:12.5px;" onclick="cusExport()">' + ic("doc", 15) + ' تصدير CSV</button>';
  h += '<span class="cntpill">' + fmtN(nTotal) + " جهة</span></div>";
  return h;
}

/* --------------------------------- views --------------------------------- */
function cusListView(rows) {
  var shown = rows.slice(0, LIST_CAP);
  var over = rows.length - shown.length;
  var allOn = shown.length > 0 && shown.every(function (c) { return cusSel[c.phone]; });
  var h = '<div class="tblwrap crmflat cusflat rise"><div style="overflow-x:auto;" class="ms-scroll"><div class="crmgrid">' + cusHeader(allOn);
  shown.forEach(function (c) { h += cusRow(c); });
  if (!shown.length) {
    h += '<div style="padding:44px;text-align:center;color:#7C7C7C;font-size:13px;line-height:1.9;">' +
      (cusQ.trim() ? 'لا جهة تطابق «' + esc(cusQ.trim()) + '».' : 'لا جهات في هذا التبويب.') + '</div>';
  }
  h += '</div></div>';
  h += '<div class="tfoot"><span>' + ic("clock", 14) + ' الحالة تُقرأ من سجل المحادثة وحالات التسليم. لا تقديرات.</span>' +
    (over > 0 ? '<span style="color:#B54708;font-weight:500;">تُعرض ' + fmtN(shown.length) + " من " + fmtN(rows.length) + ". ضيّق بالبحث لرؤية الباقي.</span>" : "") + '</div></div>';
  return h;
}

function cusGroupView(rows) {
  var by = {}, order = [];
  rows.forEach(function (c) {
    var k;
    if (cusGroupKey === "outcome") k = cusOutcome(c).label;
    else if (cusGroupKey === "interest") { var t = cusTopTag(c); k = t ? CUS_LVL[t.level].label : "بلا قراءة"; }
    else { var t2 = cusTopTag(c); k = t2 ? t2.product : "بلا خدمة"; }
    if (!by[k]) { by[k] = []; order.push(k); }
    by[k].push(c);
  });
  if (order.length <= 1) {
    return '<div class="sparse rise">' + ic("eye", 16, "#1F7A73") +
      '<div>كل الجهات في مجموعة واحدة — التجميع لا يضيف شيئًا هنا. ' +
      '<span class="lnk" onclick="cusSetView(&quot;list&quot;)" style="color:#1F7A73;font-weight:500;cursor:pointer;">→ عد إلى القائمة</span></div></div>' + cusListView(rows);
  }
  var h = "";
  order.forEach(function (k) {
    var g = by[k].slice(0, LIST_CAP);
    h += '<div class="tblwrap crmflat cusflat rise" style="margin-bottom:14px;">' +
      '<div style="display:flex;align-items:center;gap:9px;padding:8px 20px 8px 12px;border-bottom:1px solid #EDEDED;background:#F8F8F8;">' +
      '<span style="font-size:13px;font-weight:500;color:#171717;">' + esc(k) + '</span>' +
      '<span class="cntpill">' + fmtN(by[k].length) + '</span></div>' +
      '<div style="overflow-x:auto;" class="ms-scroll"><div class="crmgrid">' + cusHeader(false);
    g.forEach(function (c) { h += cusRow(c); });
    h += '</div></div>';
    if (by[k].length > g.length) h += '<div class="tfoot"><span style="color:#B54708;font-weight:500;">تُعرض ' + fmtN(g.length) + " من " + fmtN(by[k].length) + '</span></div>';
    h += '</div>';
  });
  return h;
}

function cusBulkBar() {
  var ph = cusSelPhones();
  if (!ph.length) return "";
  return '<div class="bulkbar"><div>' +
    '<span class="cnt">' + fmtN(ph.length) + ' محدَّدة</span>' +
    '<button class="pri" onclick="cusRetarget()">إعادة استهداف المحدد (' + fmtN(ph.length) + ')</button>' +
    '<button onclick="cusExportSel()">تصدير المحدد CSV</button>' +
    '<button class="x" aria-label="إلغاء التحديد" onclick="cusClear()">×</button></div></div>';
}

function vCustomersCrm() {
  var rows = cusContacts();
  setTimeout(cusPaintCrumb, 0);
  if (!((cache && cache.contacts) || []).length) {
    return '<div class="empty" style="padding:60px 20px;"><div class="ic"><span></span></div>' +
      '<div class="t">لا جهات بعد</div><div class="s">ارفع ملف جهات الاستهداف من ' +
      '<a href="#targets" style="color:#1F7A73;font-weight:500;">جهات الاستهداف</a> — كل جهة تظهر هنا بعد أول رسالة.</div></div>';
  }
  var h = cusControlBar(rows.length);
  h += cusView === "group" ? cusGroupView(rows) : cusListView(rows);
  h += cusBulkBar();
  return h;
}

function cusPaintCrumb() {
  var ps = document.getElementById("ps"), act = document.getElementById("crumbact");
  if (ps) ps.textContent = cusView === "group" ? "تجميع" : "قائمة";
  if (act) {
    act.innerHTML = '<a href="#targets" class="btn" style="text-decoration:none;display:inline-flex;' +
      'align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:6px;font-size:13px;' +
      'font-weight:500;color:#fff;background:#1F7A73;border:none;">' + ic("up", 15, "#fff") + ' استيراد جهات</a>';
  }
}

/* ================================= handlers ================================= */
window.cusSetView = function (v) { cusView = v; cusDropSel(); render(false); };
window.cusSetTab = function (t) { cusTab = t; cusDropSel(); render(false); };
window.cusSetGroup = function (k) { cusGroupKey = k; render(false); };
window.cusSetSort = function (v) { cusSort = v; render(false); };
window.cusSearch = function (el) { cusQ = el.value; cusDropSel(); clearTimeout(window.__cq3); window.__cq3 = setTimeout(function () { render(false); }, 250); };
window.cusToggle = function (ph) { if (cusSel[ph]) delete cusSel[ph]; else cusSel[ph] = true; render(false); };
window.cusClear = function () { cusSel = {}; render(false); };
window.cusTogglePage = function () {
  var shown = cusContacts().slice(0, LIST_CAP);
  var allOn = shown.length > 0 && shown.every(function (c) { return cusSel[c.phone]; });
  shown.forEach(function (c) { if (allOn) delete cusSel[c.phone]; else cusSel[c.phone] = true; });
  render(false);
};
function cusCsv(list) {
  var rows = [["الاسم", "الرقم", "الحالة", "اهتمام المساعد", "الخدمة", "الرسائل", "آخر نشاط"]];
  list.forEach(function (c) {
    var t = cusTopTag(c);
    rows.push([c.waName || "", c.phone, cusOutcome(c).label, t ? CUS_LVL[t.level].label : "",
      t ? t.product : "", (c.transcript || []).length, c.lastEventAt ? fmtD(c.lastEventAt) : ""]);
  });
  crmDownloadCsv(rows, "massar-customers.csv");
}
window.cusExport = function () { var r = cusContacts(); cusCsv(r); alertBar("صُدّرت " + fmtN(r.length) + " جهة", false); };
window.cusExportSel = function () {
  var ph = cusSelPhones();
  cusCsv(ph.map(contactByPhone).filter(Boolean));
  alertBar("صُدّرت " + fmtN(ph.length) + " جهة", false);
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
