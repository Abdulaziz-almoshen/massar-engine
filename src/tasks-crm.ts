// tasks-crm.ts — المهام and الملاحظات, the two modules Frappe has and Massar now has data for.
//
// TEMPLATES: Frappe's Tasks.vue (a list with status/priority columns and a group-by) and Notes.vue
// (a CARD GRID, not a list — P3 measured h-48 cards in a 1/2/3-column responsive grid, which is the
// one place Frappe deliberately breaks its own list chrome).
//
// Both read the tasks/notes tables added this cycle. Every column maps to a stored field; nothing
// is derived, defaulted or inferred. An absent priority renders «—» because the column is nullable
// ON PURPOSE — a defaulted "medium" would be a value nobody chose.
//
// Shared chrome (.crmbar/.qpill/.crow/.crmflat/.selcell/.cntpill/.thead-narrow/.ptab) comes from
// CAMPAIGNS_CRM_CSS, injected once globally.

export const TASKS_CRM_CSS = `
  .tskflat .crow { grid-template-columns: 40px 2.4fr 1fr .9fr 1.1fr 1fr; }
  @media (max-width: 939px) { .tskflat .crow { grid-template-columns: 40px minmax(0,1fr) auto; } }
  .tsk-done .tt { color:#999999; text-decoration:line-through; }
  /* Frappe's Notes are a card grid (h-48 = 192px), the one place it leaves its list chrome */
  .ngrid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:14px; }
  .ncard { border:1px solid #EDEDED; border-radius:10px; padding:14px 16px; background:#fff;
    height:192px; display:flex; flex-direction:column; overflow:hidden; cursor:default; }
  .ncard:hover { border-color:#C7C7C7; }
  .ncard .t { font-size:14px; font-weight:500; color:#171717; }
  .ncard .c { font-size:13px; color:#525252; line-height:1.8; margin-top:8px; flex:1; overflow:hidden;
    white-space:pre-wrap; }
  .ncard .m { font-size:12px; color:#999999; margin-top:8px; display:flex; gap:10px; align-items:center; }
`;

export const TASKS_CRM_JS = `
/* ============================ tasks-crm (client) ============================ */
var tskRows = null, tskLoading = false, tskTab = "open", tskQ = "", tskGroup = "none";
var nteRows = null, nteLoading = false, nteQ = "";

var TSK_ST = { backlog:{l:"مؤجلة",d:"#999999"}, todo:{l:"للتنفيذ",d:"#2F5F94"},
  in_progress:{l:"قيد التنفيذ",d:"#B54708"}, done:{l:"منجزة",d:"#027A48"}, canceled:{l:"ملغاة",d:"#999999"} };
var TSK_PRI = { high:"عالية", medium:"متوسطة", low:"منخفضة" };

function tskLoad(force) {
  if (tskLoading || (tskRows && !force)) return;
  tskLoading = true;
  fetch("/admin/tasks", { headers: { "x-admin-token": TOKEN } })
    .then(function (r) { return r.json(); })
    .then(function (j) { tskRows = j.tasks || []; tskLoading = false; render(false); })
    .catch(function () { tskRows = []; tskLoading = false; render(false); });
}
function nteLoad(force) {
  if (nteLoading || (nteRows && !force)) return;
  nteLoading = true;
  fetch("/admin/notes", { headers: { "x-admin-token": TOKEN } })
    .then(function (r) { return r.json(); })
    .then(function (j) { nteRows = j.notes || []; nteLoading = false; render(false); })
    .catch(function () { nteRows = []; nteLoading = false; render(false); });
}

function tskFiltered() {
  var q = tskQ.trim();
  return (tskRows || []).filter(function (t) {
    if (tskTab === "open" && (t.status === "done" || t.status === "canceled")) return false;
    if (tskTab === "done" && t.status !== "done") return false;
    if (tskTab === "overdue" && !(t.due_at && t.due_at < Date.now() && t.status !== "done" && t.status !== "canceled")) return false;
    if (!q) return true;
    return (t.title || "").includes(q) || (t.description || "").includes(q) || (t.ref_id || "").includes(q);
  });
}

/* The ref is rendered by resolving it; an unresolvable ref reads «سجل محذوف» rather than showing a
   bare id or silently hiding the row — the third obligation of a link with no foreign key. */
function tskRefLabel(t) {
  if (!t.ref_kind) return '<span style="color:#C7C7C7;">—</span>';
  if (t.ref_kind === "contact") {
    var c = contactByPhone(t.ref_id);
    if (c) return '<a href="#customer/' + esc(t.ref_id) + '" style="color:#1F7A73;text-decoration:none;">' + esc(c.waName || t.ref_id) + '</a>';
    return '<span style="color:#B42318;">سجل محذوف</span>';
  }
  var cp = campaigns.find(function (x) { return String(x.id) === String(t.ref_id); });
  if (cp) return '<a href="#kmon/' + esc(t.ref_id) + '" style="color:#1F7A73;text-decoration:none;">' + esc(cp.name) + '</a>';
  return '<span style="color:#B42318;">سجل محذوف</span>';
}

function tskRow(t) {
  var st = TSK_ST[t.status] || { l: t.status, d: "#999999" };
  var done = t.status === "done";
  var overdue = t.due_at && t.due_at < Date.now() && !done && t.status !== "canceled";
  return '<div class="trow km krow crow' + (done ? " tsk-done" : "") + '">' +
    '<div class="selcell"><input type="checkbox" aria-label="إنجاز ' + esc(t.title) + '"' + (done ? " checked" : "") + ' onclick="tskToggle(' + t.id + ',this.checked)"></div>' +
    '<div class="c-name"><span class="tt" style="font-size:14px;font-weight:450;color:#171717;">' + esc(t.title) + '</span></div>' +
    '<div class="c-meta"><div class="c-prod" style="display:flex;align-items:center;gap:7px;"><span style="width:6px;height:6px;border-radius:999px;flex:none;background:' + st.d + ';"></span><span style="font-size:13px;color:#525252;">' + st.l + '</span></div></div>' +
    '<div class="c-fig fig"><div class="c-num" style="text-align:start;font-weight:450;font-size:13px;color:#525252;">' +
      (t.priority ? TSK_PRI[t.priority] : '<span style="color:#C7C7C7;">—</span>') + '</div></div>' +
    '<div style="font-size:13px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + tskRefLabel(t) + '</div>' +
    '<div style="font-size:12px;color:' + (overdue ? "#B42318" : "#7C7C7C") + ';white-space:nowrap;">' +
      (t.due_at ? fmtD(t.due_at) : "—") + '</div>' +
  '</div>';
}

function vTasksCrm() {
  setTimeout(function () { tskPaintCrumb(); }, 0);
  tskLoad(false);
  if (tskRows === null) {
    return '<div class="empty" style="padding:60px 20px;"><div class="t">جارٍ التحميل…</div></div>';
  }
  var all = tskRows;
  var open = all.filter(function (t) { return t.status !== "done" && t.status !== "canceled"; }).length;
  var doneN = all.filter(function (t) { return t.status === "done"; }).length;
  var over = all.filter(function (t) { return t.due_at && t.due_at < Date.now() && t.status !== "done" && t.status !== "canceled"; }).length;
  var rows = tskFiltered();

  var h = '<div class="crmbar rise">';
  h += '<span style="position:relative;display:inline-flex;align-items:center;flex:1;min-width:200px;max-width:320px;">' +
    '<span style="position:absolute;inset-inline-start:13px;color:#999999;display:flex;">' + ic("search", 17) + '</span>' +
    '<input id="tskq" class="inp" value="' + esc(tskQ) + '" oninput="tskSearch(this)" placeholder="ابحث في المهام…" style="width:100%;padding-inline-start:40px;height:38px;border-radius:999px;font-size:12px;"></span>';
  h += [["open", "المفتوحة", open], ["overdue", "متأخرة", over], ["done", "منجزة", doneN], ["all", "الكل", all.length]]
    .map(function (t) { return '<button class="qpill' + (tskTab === t[0] ? " on" : "") + '" onclick="tskSetTab(&quot;' + t[0] + '&quot;)">' + t[1] + " (" + fmtN(t[2]) + ")</button>"; }).join("");
  h += '<span style="flex:1"></span><span class="cntpill">' + fmtN(rows.length) + " مهمة</span></div>";

  h += '<div class="tblwrap crmflat tskflat rise"><div style="overflow-x:auto;" class="ms-scroll"><div class="crmgrid">' +
    '<div class="crow thead-wide" style="padding:8px 20px 8px 12px;background:#fff;border-bottom:1px solid #EDEDED;font-size:12px;font-weight:500;color:#7C7C7C;">' +
      '<div class="selcell"></div><div>المهمة</div>' +
      '<div class="c-meta"><div>الحالة</div></div>' +
      '<div class="c-fig fig"><div class="c-num" style="text-align:start;color:#7C7C7C;font-size:12px;">الأولوية</div></div>' +
      '<div>مرتبطة بـ</div><div>تستحق</div></div>' +
    '<div class="thead-narrow"><span>المهمة</span><span style="flex:1"></span><span>الحالة</span></div>';
  rows.forEach(function (t) { h += tskRow(t); });
  if (!rows.length) {
    h += '<div style="padding:44px;text-align:center;color:#7C7C7C;font-size:13px;line-height:1.9;">' +
      (all.length ? "لا مهام في هذا التبويب." : "لا مهام بعد — أضف مهمة من ملف أي عميل.") + '</div>';
  }
  h += '</div></div><div class="tfoot"><span>' + ic("clock", 14) + ' المهام سجلات داخلية. لا تُرسل شيئًا للعميل.</span></div></div>';
  return h;
}

function vNotesCrm() {
  setTimeout(function () { ntePaintCrumb(); }, 0);
  nteLoad(false);
  if (nteRows === null) return '<div class="empty" style="padding:60px 20px;"><div class="t">جارٍ التحميل…</div></div>';
  var q = nteQ.trim();
  var rows = (nteRows || []).filter(function (n) {
    if (!q) return true;
    return (n.title || "").includes(q) || (n.content || "").includes(q);
  });
  var h = '<div class="crmbar rise">';
  h += '<span style="position:relative;display:inline-flex;align-items:center;flex:1;min-width:200px;max-width:320px;">' +
    '<span style="position:absolute;inset-inline-start:13px;color:#999999;display:flex;">' + ic("search", 17) + '</span>' +
    '<input id="nteq" class="inp" value="' + esc(nteQ) + '" oninput="nteSearch(this)" placeholder="ابحث في الملاحظات…" style="width:100%;padding-inline-start:40px;height:38px;border-radius:999px;font-size:12px;"></span>';
  h += '<span style="flex:1"></span><span class="cntpill">' + fmtN(rows.length) + " ملاحظة</span></div>";
  if (!rows.length) {
    return h + '<div class="empty" style="padding:60px 20px;"><div class="ic"><span></span></div>' +
      '<div class="t">' + (nteRows.length ? "لا ملاحظة تطابق البحث" : "لا ملاحظات بعد") + '</div>' +
      '<div class="s">تُكتب الملاحظات من ملف العميل، وتظهر هنا مجمّعة.</div></div>';
  }
  h += '<div class="ngrid rise">';
  rows.forEach(function (n) {
    h += '<div class="ncard">' +
      (n.title ? '<div class="t">' + esc(n.title) + '</div>' : "") +
      '<div class="c">' + esc(n.content) + '</div>' +
      '<div class="m"><span>' + fmtD(n.created_at) + '</span><span style="flex:1"></span>' + tskRefLabel(n) + '</div>' +
    '</div>';
  });
  h += '</div>';
  return h;
}

function tskPaintCrumb() {
  var ps = document.getElementById("ps"), act = document.getElementById("crumbact");
  if (ps) ps.textContent = "قائمة";
  if (act) act.innerHTML = "";
}
function ntePaintCrumb() {
  var ps = document.getElementById("ps"), act = document.getElementById("crumbact");
  if (ps) ps.textContent = "بطاقات";
  if (act) act.innerHTML = "";
}

window.tskSetTab = function (t) { tskTab = t; render(false); };
window.tskSearch = function (el) { tskQ = el.value; clearTimeout(window.__tq); window.__tq = setTimeout(function () { render(false); }, 250); };
window.nteSearch = function (el) { nteQ = el.value; clearTimeout(window.__nq); window.__nq = setTimeout(function () { render(false); }, 250); };
window.tskToggle = function (id, done) {
  fetch("/admin/tasks/" + id, { method: "PATCH",
    headers: { "content-type": "application/json", "x-admin-token": TOKEN },
    body: JSON.stringify({ status: done ? "done" : "todo" }) })
    .then(function (r) { if (!r.ok) throw 0; tskLoad(true); })
    .catch(function () { alertBar("تعذّر تحديث المهمة", true); });
};
/* ========================= end tasks-crm (client) ========================= */
`;
