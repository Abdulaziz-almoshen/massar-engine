// activity-crm.ts — لوحة المتابعة, the WhatsApp event ledger.
//
// TEMPLATE: Frappe's CallLogs.vue + CallLogsListView.vue. Market research P3 called it the strongest
// remaining structural match in that repo, and the reason is exact: its columns are
// Caller/Receiver/Type/Status/Duration/From/To/Created On — a ledger of communication EVENTS, each
// one observed rather than authored. That is precisely what tracker.ts already stores and what
// Massar had no screen for. Duration and recording_url drop (no telephony).
//
// WHERE THE ROWS COME FROM. Nothing new is stored. Each row is derived from data already in the
// ledger, two sources only:
//   1. transcript turns  -> {role: agent|customer|system, ts, text}
//   2. statusTimes       -> {sent, delivered, read, failed} timestamps per contact
// A delivery status is a real observed event with its own timestamp, so it earns a row exactly like
// a message does. NOTHING here is inferred: if a status was never recorded it produces no row,
// rather than a row saying "not delivered".
//
// Shared chrome (.crmbar/.vtog/.qpill/.crow/.crmflat/.selcell/.cntpill/.thead-narrow) comes from
// CAMPAIGNS_CRM_CSS, injected once globally.

export const ACTIVITY_CRM_CSS = `
  /* FIVE cells, five tracks: selcell · event · details · contact · time. c-meta and c-fig are
     display:contents, so an empty child in either becomes a real grid item and wraps the row. */
  .actflat .crow { grid-template-columns: 40px 1.2fr 2fr 1.5fr 1.1fr; }
  .actflat .crow .c-prog { white-space:nowrap; }
  @media (max-width: 939px) {
    .actflat .crow { grid-template-columns: 40px minmax(0,1fr) auto; }
  }
  .evt { display:inline-flex; align-items:center; gap:7px; white-space:nowrap; }
  .evt .d { width:6px; height:6px; border-radius:999px; flex:none; }
  .evt .lbl { font-size:13px; color:#525252; }
`;

export const ACTIVITY_CRM_JS = `
/* ============================ activity-crm (client) ============================ */
var actTab = "all";      /* all | out | in | delivery | failed */
var actQ = "";
var actWin = 7;          /* days */

/* Every event kind Massar can OBSERVE, with the field that produces it. There is no kind here that
   is not written by the engine — an event type with no writer would be a fabricated row. */
var ACT_KIND = {
  agent:     { label: "رسالة من المساعد", dot: "#1F7A73", group: "out" },
  customer:  { label: "ردّ العميل",        dot: "#027A48", group: "in"  },
  system:    { label: "حدث نظامي",         dot: "#999999", group: "out" },
  sent:      { label: "أُرسلت",            dot: "#2F5F94", group: "delivery" },
  delivered: { label: "وصلت",              dot: "#3FB6B0", group: "delivery" },
  read:      { label: "قُرئت",             dot: "#2E8F89", group: "delivery" },
  failed:    { label: "فشل الإرسال",       dot: "#B42318", group: "failed" }
};

function actEvents() {
  var out = [];
  var cutoff = actWin ? Date.now() - actWin * 86400000 : 0;
  ((cache && cache.contacts) || []).forEach(function (c) {
    if (c.test) return;                       /* sandbox traffic is not the operator's ledger */
    (c.transcript || []).forEach(function (t) {
      if (!t.ts || t.ts < cutoff) return;
      out.push({ ts: t.ts, kind: t.role, phone: c.phone, name: c.waName || "", text: t.text || "" });
    });
    var st = c.statusTimes || {};
    ["sent", "delivered", "read", "failed"].forEach(function (k) {
      if (!st[k] || st[k] < cutoff) return;
      out.push({ ts: st[k], kind: k, phone: c.phone, name: c.waName || "",
                 text: k === "failed" ? (c.lastError || "") : "" });
    });
  });
  var q = actQ.trim();
  out = out.filter(function (e) {
    var meta = ACT_KIND[e.kind];
    if (!meta) return false;                  /* an unknown kind renders nothing, never a guess */
    if (actTab !== "all" && meta.group !== actTab) return false;
    if (!q) return true;
    return (e.name || "").includes(q) || e.phone.includes(q) || (e.text || "").includes(q);
  });
  out.sort(function (a, b) { return b.ts - a.ts; });
  return out;
}

function actRow(e) {
  var meta = ACT_KIND[e.kind];
  var nm = e.name || e.phone;
  return '<div class="trow km krow crow" onclick="location.hash=&quot;customer/' + esc(e.phone) + '&quot;">' +
    '<div class="selcell"></div>' +
    '<div class="c-name"><span class="evt"><span class="d" style="background:' + meta.dot + ';"></span>' +
      '<span class="lbl">' + meta.label + '</span></span></div>' +
    '<div class="c-meta"><div class="c-prod" style="font-size:13px;color:#525252;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
      (e.text ? esc(clip(e.text, 90)) : '<span style="color:#C7C7C7;">—</span>') + '</div></div>' +
    '<div class="c-fig fig"><div class="c-num" style="text-align:start;font-weight:450;">' + esc(nm) +
      '<span style="font-size:12px;color:#999999;direction:ltr;"> ' + esc(e.phone) + '</span></div></div>' +
    '<div class="c-prog" style="font-size:12px;color:#7C7C7C;">' + fmtD(e.ts) + ' · ' + fmtT(e.ts) + '</div>' +
  '</div>';
}

function actHeader() {
  return '<div class="crow thead-wide" style="padding:8px 20px 8px 12px;background:#fff;border-bottom:1px solid #EDEDED;font-size:12px;font-weight:500;color:#7C7C7C;">' +
    '<div class="selcell"></div><div>الحدث</div>' +
    '<div class="c-meta"><div>التفاصيل</div></div>' +
    '<div class="c-fig fig"><div class="c-num" style="text-align:start;color:#7C7C7C;font-size:12px;">الجهة</div></div>' +
    '<div>الوقت</div></div>' +
    '<div class="thead-narrow"><span>الحدث</span><span style="flex:1"></span><span>الوقت</span></div>';
}

function actControlBar(n) {
  var all = actEventsUnfiltered();
  var count = function (g) { return all.filter(function (e) { var m = ACT_KIND[e.kind]; return m && m.group === g; }).length; };
  var tabs = [["all", "الكل", all.length], ["out", "صادر", count("out")],
              ["in", "وارد", count("in")], ["delivery", "التسليم", count("delivery")],
              ["failed", "إخفاقات", count("failed")]];
  var h = '<div class="crmbar rise">';
  h += '<span style="position:relative;display:inline-flex;align-items:center;flex:1;min-width:200px;max-width:320px;">' +
    '<span style="position:absolute;inset-inline-start:13px;color:#999999;display:flex;">' + ic("search", 17) + '</span>' +
    '<input id="actq" class="inp" value="' + esc(actQ) + '" oninput="actSearch(this)" placeholder="ابحث في الأحداث…" style="width:100%;padding-inline-start:40px;height:38px;border-radius:999px;font-size:12px;"></span>';
  h += tabs.map(function (t) {
    return '<button class="qpill' + (actTab === t[0] ? " on" : "") + '" onclick="actSetTab(&quot;' + t[0] + '&quot;)">' + t[1] + " (" + fmtN(t[2]) + ")</button>";
  }).join("");
  h += '<span style="flex:1"></span><span class="hair"></span>';
  h += '<select onchange="actSetWin(this.value)" class="crmsel">' +
    [[1, "آخر يوم"], [7, "آخر ٧ أيام"], [30, "آخر ٣٠ يومًا"], [0, "كل الفترة"]].map(function (w) {
      return '<option value="' + w[0] + '"' + (String(actWin) === String(w[0]) ? " selected" : "") + '>' + w[1] + '</option>';
    }).join("") + '</select>';
  h += '<span class="cntpill">' + fmtN(n) + " حدث</span></div>";
  return h;
}
/* the tab counts must describe the same window the list shows, so they share the window filter
   and differ only in the group filter */
function actEventsUnfiltered() {
  var saveTab = actTab, saveQ = actQ;
  actTab = "all"; actQ = "";
  var all = actEvents();
  actTab = saveTab; actQ = saveQ;
  return all;
}

function vActivityCrm() {
  var rows = actEvents();
  setTimeout(actPaintCrumb, 0);
  if (!((cache && cache.contacts) || []).length) {
    return '<div class="empty" style="padding:60px 20px;"><div class="ic"><span></span></div>' +
      '<div class="t">لا أحداث بعد</div><div class="s">يظهر هنا كل إرسال وتسليم وردّ فور حدوثه.</div></div>';
  }
  var h = actControlBar(rows.length);
  var shown = pageSlice("act", rows);
  h += '<div class="tblwrap crmflat actflat rise"><div style="overflow-x:auto;" class="ms-scroll"><div class="crmgrid">' + actHeader();
  shown.forEach(function (e) { h += actRow(e); });
  if (!shown.length) {
    h += '<div style="padding:44px;text-align:center;color:#7C7C7C;font-size:13px;">' +
      (actQ.trim() ? 'لا حدث يطابق «' + esc(actQ.trim()) + '».' : 'لا أحداث في هذه الفترة.') + '</div>';
  }
  h += '</div></div><div class="tfoot">' + pageBar("act", rows.length, "حدث") +
    '<span>' + ic("clock", 14) + ' كل سطر حدث مسجَّل — رسالة أو حالة تسليم. لا تقديرات.</span></div></div>';
  return h;
}

function actPaintCrumb() {
  var ps = document.getElementById("ps"), act = document.getElementById("crumbact");
  if (ps) ps.textContent = "سجل";
  if (act) act.innerHTML = "";
}

window.actSetTab = function (t) { actTab = t; render(false); };
window.actSetWin = function (w) { actWin = Number(w); render(false); };
window.actSearch = function (el) { actQ = el.value; clearTimeout(window.__aq); window.__aq = setTimeout(function () { render(false); }, 250); };
/* ========================= end activity-crm (client) ========================= */
`;
