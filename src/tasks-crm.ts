// tasks-crm.ts — المهام and الملاحظات, the two modules Frappe has and Massar now has data for.
//
// TEMPLATES: Frappe's Tasks.vue (a list with status/priority columns and a group-by) and Notes.vue
// (a CARD GRID, not a list — P3 measured h-48 cards in a 1/2/3-column responsive grid, which is the
// one place Frappe deliberately breaks its own list chrome).
//
// Both read the tasks/notes tables added this cycle. Every column maps to a stored field; nothing
// is derived, defaulted or inferred. An absent priority is NOT defaulted to "medium" — a value
// nobody chose — and it is no longer drawn as a bare dash either: it is «لم تُحدَّد», the
// vocabulary's "unset" absence, which a reader can tell apart from «غير مرتبطة» at a glance.
//
// PORTED to the new design system (docs/PORT-SPEC.md): one .ds6 wrapper per screen, a real table in
// .m-tablewrap, .m-tab tabs carrying their counts, .m-chip for status, .m-n around every digit, and
// the three absence kinds instead of four identical dashes. The old .crmbar/.crow/.crmflat grid
// chrome is gone from these two screens.
//
// NO BACKTICKS ANYWHERE IN THIS FILE, comments included: it is one template literal.

export const TASKS_CRM_CSS = `
/* Only what the vocabulary lacks. The note grid is the one deliberate break from list chrome
   (Frappe's own), so it is the one layout rule that survives the port. */
.ds6 .m-task { display: grid; gap: var(--m-4); }
.ds6 .m-task-table { min-inline-size: 720px; }
.ds6 .m-task-done .m-td-n { color: var(--m-faint); text-decoration: line-through; }
.ds6 .m-note-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: var(--m-4); }
.ds6 .m-note { block-size: 192px; display: flex; flex-direction: column; overflow: hidden; }
.ds6 .m-note__c { flex: 1 1 auto; overflow: hidden; white-space: pre-wrap; color: var(--m-ink-2);
  margin-block-start: var(--m-2); line-height: var(--m-leading-body); }
.ds6 .m-note__m { display: flex; align-items: center; gap: var(--m-3); margin-block-start: var(--m-2); }
.ds6 .m-due-late { color: var(--m-bad); font-weight: 600; }
.ds6 .m-clip { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;

export const TASKS_CRM_JS = `
/* ============================ tasks-crm (client) ============================ */
var tskRows = null, tskLoading = false, tskTab = "open", tskQ = "", tskGroup = "none";
var nteRows = null, nteLoading = false, nteQ = "";

/* tone maps a stored status onto the vocabulary's status colours — colour means status here, never
   decoration, so a cancelled task and a backlogged one share the neutral chip rather than each
   inventing a grey. */
var TSK_ST = { backlog:{l:"مؤجلة",t:"plain"}, todo:{l:"للتنفيذ",t:"ac"},
  in_progress:{l:"قيد التنفيذ",t:"warn"}, done:{l:"منجزة",t:"ok"}, canceled:{l:"ملغاة",t:"plain"} };
var TSK_PRI = { high:"عالية", medium:"متوسطة", low:"منخفضة" };

function tskNil(t, kind) { return '<span class="m-td-nil m-nil--' + (kind || "none") + '">' + esc(t) + "</span>"; }
function tskDate(ms) { return '<span class="m-n">' + fmtD(ms) + "</span>"; }
function tskPl(n) { return typeof opPl === "function" ? opPl(n, "مهمة واحدة", "مهمتان", "مهام", "مهمة") : fmtN(n) + " مهمة"; }
function ntePl(n) { return typeof opPl === "function" ? opPl(n, "ملاحظة واحدة", "ملاحظتان", "ملاحظات", "ملاحظة") : fmtN(n) + " ملاحظة"; }

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

function tskIsOpen(t) { return t.status !== "done" && t.status !== "canceled"; }
function tskIsOverdue(t) { return !!(t.due_at && t.due_at < Date.now() && tskIsOpen(t)); }
function tskFiltered() {
  var q = tskQ.trim();
  return (tskRows || []).filter(function (t) {
    if (tskTab === "open" && !tskIsOpen(t)) return false;
    if (tskTab === "done" && t.status !== "done") return false;
    if (tskTab === "overdue" && !tskIsOverdue(t)) return false;
    if (!q) return true;
    return (t.title || "").includes(q) || (t.description || "").includes(q) || (t.ref_id || "").includes(q);
  });
}

/* Every count on these two screens is derived from the SAME array the rows are rendered from, so a
   tab badge and the list beneath it cannot report different populations of the same word. */
function tskBind() {
  dsD("tskAll", function () { return (tskRows || []).length; });
  dsD("tskOpen", function () { return (tskRows || []).filter(tskIsOpen).length; });
  dsD("tskOver", function () { return (tskRows || []).filter(tskIsOverdue).length; });
  dsD("tskDone", function () { return (tskRows || []).filter(function (t) { return t.status === "done"; }).length; });
}

/* The ref is rendered by resolving it; an unresolvable ref reads «سجل محذوف» rather than showing a
   bare id or silently hiding the row — the third obligation of a link with no foreign key. A task
   attached to nothing is a legitimate nothing, not a gap in the record. */
function tskRefLabel(t) {
  if (!t.ref_kind) return tskNil("غير مرتبطة", "none");
  if (t.ref_kind === "contact") {
    var c = contactByPhone(t.ref_id);
    if (c) return '<a class="m-link" href="#customer/' + esc(t.ref_id) + '">' + esc(c.waName || t.ref_id) + "</a>";
    return '<span class="m-chip m-chip--bad">سجل محذوف</span>';
  }
  var cp = campaigns.find(function (x) { return String(x.id) === String(t.ref_id); });
  if (cp) return '<a class="m-link" href="#kmon/' + esc(t.ref_id) + '">' + esc(cp.name) + "</a>";
  return '<span class="m-chip m-chip--bad">سجل محذوف</span>';
}

function tskRow(t) {
  var st = TSK_ST[t.status] || { l: t.status, t: "plain" };
  var done = t.status === "done";
  var overdue = tskIsOverdue(t);
  return "<tr" + (done ? ' class="m-task-done"' : "") + ">" +
    '<td class="m-sel"><input type="checkbox" class="m-cb" aria-label="إنجاز ' + esc(t.title) + '"' + (done ? " checked" : "") + ' onclick="tskToggle(' + t.id + ',this.checked)"></td>' +
    '<td class="m-td-n"><span class="m-clip">' + esc(t.title) + "</span></td>" +
    '<td><span class="m-chip m-chip--' + st.t + '">' + esc(st.l) + "</span></td>" +
    "<td>" + (t.priority ? esc(TSK_PRI[t.priority] || t.priority) : tskNil("لم تُحدَّد", "unset")) + "</td>" +
    '<td><span class="m-clip">' + tskRefLabel(t) + "</span></td>" +
    '<td class="m-td-v">' + (t.due_at
      ? (overdue ? '<span class="m-due-late">' + tskDate(t.due_at) + "</span>" : tskDate(t.due_at))
      : tskNil("لم يُحدَّد", "unset")) + "</td></tr>";
}

function vTasksCrm() {
  setTimeout(function () { tskPaintCrumb(); }, 0);
  tskLoad(false);
  /* A skeleton, not the word «جارٍ التحميل». Frappe holds the list's SHAPE while it loads so the
     page does not jump when rows arrive; a centred word is a layout shift waiting to happen. */
  if (tskRows === null) return crmSkeleton(6);
  tskBind();
  var all = tskRows;
  var open = all.filter(tskIsOpen).length;
  var doneN = all.filter(function (t) { return t.status === "done"; }).length;
  var over = all.filter(tskIsOverdue).length;
  var rows = tskFiltered();

  var h = '<div class="ds6"><div class="m-task">';
  h += '<div class="m-tools"><div class="m-head__a">' +
    mSearch({ id: "tskq", value: tskQ, placeholder: "بحث في المهام…", label: "ابحث في المهام", wide: true, attrs: ' oninput="tskSearch(this)"' }) + "</div>" +
    '<span class="m-cap">' + tskPl(rows.length) + " في هذا التبويب</span></div>";

  h += '<div class="m-tabs" role="tablist" aria-label="حالة المهام">' +
    [["open", "المفتوحة", open, "tskOpen"], ["overdue", "متأخرة", over, "tskOver"],
     ["done", "منجزة", doneN, "tskDone"], ["all", "الكل", all.length, "tskAll"]].map(function (t) {
      var on = tskTab === t[0];
      return '<button type="button" class="m-tab" role="tab" aria-selected="' + on + '" tabindex="' + (on ? 0 : -1) + '" onclick="tskSetTab(&quot;' + t[0] + '&quot;)">' +
        t[1] + "<b>" + dsFig(t[3], t[2]) + "</b></button>";
    }).join("") + "</div>";

  h += '<section class="m-card m-card--pad0"><div class="m-tablewrap"><table class="m-table m-task-table">' +
    '<thead><tr><th class="m-sel"><span class="m-cap">تم</span></th><th>المهمة</th><th>الحالة</th>' +
    "<th>الأولوية</th><th>مرتبطة بـ</th><th>تستحق</th></tr></thead><tbody>";
  rows.forEach(function (t) { h += tskRow(t); });
  if (!rows.length) {
    h += '<tr class="m-table__empty"><td colspan="6"><div class="m-empty"><div class="m-empty__t">' +
      (all.length ? "لا مهام في هذا التبويب" : "لا مهام بعد") + "</div>" +
      (all.length ? "" : '<div class="m-empty__d">تُضاف المهام من ملف أي عميل، وتظهر هنا مجمّعة.</div>') +
      "</div></td></tr>";
  }
  h += '</tbody></table></div><div class="m-foot"><span class="m-cap">المهام سجلات داخلية. لا تُرسل شيئًا للعميل.</span></div></section>';
  return h + "</div></div>";
}

function vNotesCrm() {
  setTimeout(function () { ntePaintCrumb(); }, 0);
  nteLoad(false);
  if (nteRows === null) return crmSkeleton(4);
  var q = nteQ.trim();
  var rows = (nteRows || []).filter(function (n) {
    if (!q) return true;
    return (n.title || "").includes(q) || (n.content || "").includes(q);
  });
  var h = '<div class="ds6"><div class="m-task">';
  h += '<div class="m-tools"><div class="m-head__a">' +
    mSearch({ id: "nteq", value: nteQ, placeholder: "بحث في الملاحظات…", label: "ابحث في الملاحظات", wide: true, attrs: ' oninput="nteSearch(this)"' }) + "</div>" +
    /* The count had no label: a bare «ملاحظة واحدة» floating in a toolbar says what it is only
       if you already know. Naming the surface also gives smoke a landmark that does not depend
       on how many rows happen to exist - the counted noun alone reads «ملاحظات» at three rows
       and «ملاحظة» at one, so an assertion on it passes or fails by row count. */
    '<span class="m-cap">الملاحظات · ' + ntePl(rows.length) + "</span></div>";
  if (!rows.length) {
    return h + '<div class="m-empty"><div class="m-empty__t">' +
      (nteRows.length ? "لا ملاحظة تطابق البحث" : "لا ملاحظات بعد") + "</div>" +
      '<div class="m-empty__d">تُكتب الملاحظات من ملف العميل، وتظهر هنا مجمّعة.</div></div></div></div>';
  }
  h += '<div class="m-note-grid">';
  rows.forEach(function (n) {
    h += '<article class="m-card m-note">' +
      (n.title ? '<h2 class="m-card__t">' + esc(n.title) + "</h2>" : "") +
      '<div class="m-note__c">' + esc(n.content) + "</div>" +
      '<div class="m-note__m"><span class="m-cap">' + tskDate(n.created_at) + '</span><span style="flex:1"></span>' +
      '<span class="m-cap">' + tskRefLabel(n) + "</span></div></article>";
  });
  h += "</div>";
  return h + "</div></div>";
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
