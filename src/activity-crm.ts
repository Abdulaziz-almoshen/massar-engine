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
// PORTED to the new design system (docs/PORT-SPEC.md). The whole screen is inside one .ds6 wrapper
// and speaks the m-* vocabulary: a real table in .m-tablewrap, .m-tab tabs carrying their own
// counts, .m-chip for the event kind, .m-n around every digit, and the three absence kinds instead
// of a column of identical dashes. The old .crmbar/.crow/.crmflat grid chrome is gone from this
// screen; the counts that appear twice (the tab badge and the pager total) are bound with
// dsD/dsFig so they cannot drift.
//
// NO BACKTICKS ANYWHERE IN THIS FILE, comments included: it is one template literal.

export const ACTIVITY_CRM_CSS = `
/* Only what the vocabulary genuinely lacks: the ledger's minimum width (four columns of Arabic
   prose collapse below this and the wrap, not the page, is what scrolls), the dot that carries the
   event kind's colour, and the ltr-isolated phone under a contact name. */
.ds6 .m-act { display: grid; gap: var(--m-4); }
.ds6 .m-act-table { min-inline-size: 700px; }
.ds6 .m-act-k { display: inline-flex; align-items: center; gap: 7px; white-space: nowrap; }
.ds6 .m-act-k i { inline-size: 7px; block-size: 7px; border-radius: 50%; flex: 0 0 auto; }
.ds6 .m-act-txt { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-inline-size: 42ch; }
.ds6 .m-act-ph { display: block; direction: ltr; unicode-bidi: isolate; font-size: var(--m-t-micro); color: var(--m-faint); }
.ds6 .m-pager { display: flex; align-items: center; gap: var(--m-2); flex-wrap: wrap; }
.ds6 .m-foot { display: flex; align-items: center; justify-content: space-between; gap: var(--m-3);
  flex-wrap: wrap; padding: var(--m-3) var(--m-5); border-block-start: 1px solid var(--m-line); }
`;

export const ACTIVITY_CRM_JS = `
/* ============================ activity-crm (client) ============================ */
var actTab = "all";      /* all | out | in | delivery | failed */
var actQ = "";
var actWin = 7;          /* days; -1 = the custom range below */
var actFrom = "", actTo = "";   /* «YYYY-MM-DD», inclusive, when actWin is -1 */

/* Every event kind Massar can OBSERVE, with the field that produces it. There is no kind here that
   is not written by the engine — an event type with no writer would be a fabricated row. tone maps
   the kind onto the vocabulary's status colours: colour means status, never decoration. */
var ACT_KIND = {
  agent:     { label: "رسالة من المساعد", dot: "#2563EB", tone: "ac",    group: "out" },
  customer:  { label: "ردّ العميل",        dot: "#12633F", tone: "ok",    group: "in"  },
  system:    { label: "حدث نظامي",         dot: "#A2A9B4", tone: "plain", group: "out" },
  sent:      { label: "أُرسلت",            dot: "#1E5FCC", tone: "plain", group: "delivery" },
  delivered: { label: "وصلت",              dot: "#5B8DEF", tone: "ac",    group: "delivery" },
  read:      { label: "قُرئت",             dot: "#1E5FCC", tone: "ok",    group: "delivery" },
  failed:    { label: "فشل الإرسال",       dot: "#8E2A27", tone: "bad",   group: "failed" }
};

/* Every digit on this screen goes through .m-n: it sets direction:ltr, isolates the bidi run and
   turns on tabular figures. A raw fmtN() in Arabic prose moves under bidi reordering. */
function actN(v) { return '<span class="m-n">' + fmtN(v) + "</span>"; }
/* kind: "owed" a number someone owes, "unset" a classification nobody made, "none" a legitimate
   nothing. A delivery receipt HAS no text — that is "none", not a gap in the record. */
function actNil(t, kind) { return '<span class="m-td-nil m-nil--' + (kind || "none") + '">' + esc(t) + "</span>"; }
function actPl(n) { return typeof opPl === "function" ? opPl(n, "حدث واحد", "حدثان", "أحداث", "حدثًا") : fmtN(n) + " حدثًا"; }
/* The counted noun ALONE, in the form that agrees with n. A figure bound with dsFig has to be its
   own element whose text is exactly the number, so the noun beside it cannot ride inside opPl's
   string — but it still has to agree four ways rather than read «3 حدث». */
function actNoun(n) { return n === 1 ? "حدث" : n === 2 ? "حدثان" : (n >= 3 && n <= 10) ? "أحداث" : "حدثًا"; }

function actEvents() {
  var out = [];
  /* A custom range is a pair of calendar days, inclusive: its end is the END of that day, or a range
     that begins and ends on the same day would match nothing. */
  var from0 = 0, to0 = Infinity;
  if (actWin === -1) {
    var f0 = parseISODate(actFrom), t0 = parseISODate(actTo);
    if (f0) from0 = new Date(f0.getFullYear(), f0.getMonth(), f0.getDate(), 0, 0, 0, 0).getTime();
    if (t0) to0 = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate(), 23, 59, 59, 999).getTime();
  }
  var cutoff = actWin > 0 ? Date.now() - actWin * 86400000 : from0;
  ((cache && cache.contacts) || []).forEach(function (c) {
    if (c.test) return;                       /* sandbox traffic is not the operator's ledger */
    (c.transcript || []).forEach(function (t) {
      if (!t.ts || t.ts < cutoff || t.ts > to0) return;
      out.push({ ts: t.ts, kind: t.role, phone: c.phone, name: c.waName || "", text: t.text || "" });
    });
    var st = c.statusTimes || {};
    ["sent", "delivered", "read", "failed"].forEach(function (k) {
      if (!st[k] || st[k] < cutoff || st[k] > to0) return;
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

/* One pager for the ported screens, drawn in the vocabulary. It reuses the page state the whole
   dashboard shares (pageOf/pageGo/pageSetSize) — a second pagination implementation is how row 61
   became unreachable on ten lists. */
function dsPageBar(key, total, unit, figKey) {
  var m = pageOf(key, total);
  var tot = figKey ? dsFig(figKey, total) : actN(total);
  var h = '<span class="m-cap">' + (total
    ? actN(m.from) + "&#8211;" + actN(m.to) + " من " + tot + " " + unit
    : "لا " + unit) + "</span>";
  if (total > 25) {
    h += '<span class="m-pager">' +
      '<select class="m-select" onchange="pageSetSize(this.value)" aria-label="عدد الصفوف في الصفحة">' +
      [25, 50, 100, 200].map(function (n) {
        return '<option value="' + n + '"' + (n === m.size ? " selected" : "") + ">" + fmtN(n) + " لكل صفحة</option>";
      }).join("") + "</select>";
    if (m.pages > 1) {
      h += '<button type="button" class="m-btn" onclick="pageGo(&quot;' + key + '&quot;,' + (m.p - 1) + ')"' + (m.p <= 1 ? " disabled" : "") + ">السابق &#8594;</button>" +
        '<span class="m-cap">' + actN(m.p) + " / " + actN(m.pages) + "</span>" +
        '<button type="button" class="m-btn" onclick="pageGo(&quot;' + key + '&quot;,' + (m.p + 1) + ')"' + (m.p >= m.pages ? " disabled" : "") + ">&#8592; التالي</button>";
    }
    h += "</span>";
  }
  return h;
}

function actRow(e) {
  var meta = ACT_KIND[e.kind];
  var nm = e.name || e.phone;
  var go = "location.hash=&quot;customer/" + esc(e.phone) + "&quot;";
  return '<tr role="link" tabindex="0" onclick="' + go + '" onkeydown="if(event.key===&quot;Enter&quot;){' + go + '}">' +
    '<td class="m-td-n"><span class="m-act-k"><i style="background:' + meta.dot + '"></i>' + meta.label + "</span></td>" +
    "<td>" + (e.text ? '<span class="m-act-txt">' + esc(clip(e.text, 90)) + "</span>" : actNil("بلا نص", "none")) + "</td>" +
    "<td>" + esc(nm) + '<span class="m-act-ph">' + esc(e.phone) + "</span></td>" +
    '<td class="m-td-v">' + actN2(e.ts) + "</td></tr>";
}
/* A timestamp is a moment, not a quantity — but its digits still need the .m-n isolation, or the
   date and the hour swap sides inside an Arabic row. */
function actN2(ts) { return '<span class="m-n">' + fmtD(ts) + " · " + fmtT(ts) + "</span>"; }

/* the tab counts must describe the same window the list shows, so they share the window filter
   and differ only in the group filter */
function actEventsUnfiltered() {
  var saveTab = actTab, saveQ = actQ;
  actTab = "all"; actQ = "";
  var all = actEvents();
  actTab = saveTab; actQ = saveQ;
  return all;
}

/* The two counts this screen prints twice — the الكل tab badge and the pager's total — are bound to
   the arrays they are rendered from, so a filter change cannot leave one of them stale. */
function actBind() {
  dsD("actAll", function () { return actEventsUnfiltered().length; });
  dsD("actShown", function () { return actEvents().length; });
}

function actTabs() {
  var all = actEventsUnfiltered();
  var count = function (g) { return all.filter(function (e) { var m = ACT_KIND[e.kind]; return m && m.group === g; }).length; };
  var tabs = [["all", "الكل", all.length], ["out", "صادر", count("out")],
              ["in", "وارد", count("in")], ["delivery", "التسليم", count("delivery")],
              ["failed", "إخفاقات", count("failed")]];
  return '<div class="m-tabs" role="tablist" aria-label="نوع الحدث">' + tabs.map(function (t) {
    var on = actTab === t[0];
    return '<button type="button" class="m-tab" role="tab" aria-selected="' + on + '" tabindex="' + (on ? 0 : -1) + '" onclick="actSetTab(&quot;' + t[0] + '&quot;)">' +
      t[1] + "<b>" + (t[0] === "all" ? dsFig("actAll", t[2]) : actN(t[2])) + "</b></button>";
  }).join("") + "</div>";
}

function actToolbar(n) {
  var h = '<div class="m-tools">';
  h += '<div class="m-head__a">' +
    mSearch({ id: "actq", value: actQ, placeholder: "بحث في الأحداث…", label: "ابحث في الأحداث", wide: true, attrs: ' oninput="actSearch(this)"' }) +
    '<select class="m-select" onchange="actSetWin(this.value)" aria-label="الفترة">' +
    [[1, "آخر يوم"], [7, "آخر 7 أيام"], [30, "آخر 30 يومًا"], [0, "كل الفترة"], [-1, "مدى مخصص"]].map(function (w) {
      return '<option value="' + w[0] + '"' + (String(actWin) === String(w[0]) ? " selected" : "") + ">" + w[1] + "</option>";
    }).join("") + "</select>" +
    /* The range picker (coss p-date-picker-2) appears only when the period is «مدى مخصص», so the
       toolbar does not carry a control that decides nothing. Both ends filter in the browser, the
       same way the day windows beside it always have. */
    (actWin === -1
      ? mDateRange({ id: "actrange", from: actFrom, to: actTo, max: toISODate(new Date()),
          label: "المدى", placeholder: "اختر المدى", attrs: ' data-actrange="1"' })
      : "") + "</div>";
  h += '<span class="m-cap">' + actPl(n) + " في هذه الفترة</span>";
  return h + "</div>";
}

function vActivityCrm() {
  setTimeout(actPaintCrumb, 0);
  actBind();
  if (!((cache && cache.contacts) || []).length) {
    return '<div class="ds6"><div class="m-empty"><div class="m-empty__t">لا أحداث بعد</div>' +
      '<div class="m-empty__d">يظهر كل إرسال وتسليم وردّ فور حدوثه.</div></div></div>';
  }
  var rows = actEvents();
  var shown = pageSlice("act", rows);
  var h = '<div class="ds6"><div class="m-act">';
  h += actToolbar(rows.length);
  h += actTabs();
  h += '<section class="m-card m-card--pad0"><div class="m-tablewrap"><table class="m-table m-act-table">' +
    "<thead><tr><th>الحدث</th><th>التفاصيل</th><th>الجهة</th><th>الوقت</th></tr></thead><tbody>";
  shown.forEach(function (e) { h += actRow(e); });
  if (!shown.length) {
    h += '<tr class="m-table__empty"><td colspan="4"><div class="m-empty"><div class="m-empty__t">' +
      (actQ.trim() ? "لا حدث يطابق «" + esc(actQ.trim()) + "»" : "لا أحداث في هذه الفترة") + "</div></div></td></tr>";
  }
  h += "</tbody></table></div>";
  h += '<div class="m-foot">' + dsPageBar("act", rows.length, actNoun(rows.length), "actShown") +
    '<span class="m-cap">كل سطر حدث مسجَّل — رسالة أو حالة تسليم. لا تقديرات.</span></div></section>';
  return h + "</div></div>";
}

function actPaintCrumb() {
  var ps = document.getElementById("ps"), act = document.getElementById("crumbact");
  if (ps) ps.textContent = "سجل";
  if (act) act.innerHTML = "";
}

window.actSetTab = function (t) { actTab = t; render(false); };
window.actSetWin = function (w) {
  actWin = Number(w);
  /* Choosing «مدى مخصص» with nothing picked yet starts on today, so the table is never silently
     empty while the picker waits for a second click. */
  if (actWin === -1 && !actFrom && !actTo) { actFrom = toISODate(new Date()); actTo = actFrom; }
  render(false);
};
/* The range picker writes «YYYY-MM-DD» into its two hidden inputs and changes them, exactly as the
   type=date fields it is modelled on would. */
document.addEventListener("change", function (ev) {
  var t = ev.target;
  if (!t || !t.getAttribute || !t.getAttribute("data-actrange")) return;
  var f = document.getElementById("actrange"), to = document.getElementById("actrange_to");
  actFrom = f ? f.value : "";
  actTo = to ? to.value : "";
  /* A HALF-PICKED RANGE DOES NOT REPAINT. The first click sets only the start, and repainting the
     screen there replaced the open calendar — so the second click had nothing to land on (measured).
     Half a range filters nothing anyway; the table waits for both ends. */
  if (actFrom && actTo) render(false);
});
window.actSearch = function (el) { actQ = el.value; clearTimeout(window.__aq); window.__aq = setTimeout(function () { render(false); }, 250); };
/* ========================= end activity-crm (client) ========================= */
`;
