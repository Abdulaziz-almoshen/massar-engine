// settings-crm.ts — «إعدادات النظام»: the sales ladder, the company's divisions, and the team
// directory escalations point at. Three tables, one shape.
//
// Everything here is an ADMIN surface: it changes what every other screen shows. So each table
// states the consequence next to the control — how many opportunities sit on a stage before it can
// be paused, how many products a division owns before it can be deleted — rather than letting the
// operator discover it from a rejected write.
//
// The rules come from config-domain (serialised into the page), so a control this screen disables
// and a write the server refuses give the same reason in the same words.
//
// PORTED to the new design system (docs/PORT-SPEC.md): the three tables are now real m-table tables
// inside m-tablewrap (the WRAP scrolls, never the page), the inline editor is an m-form of m-field /
// m-label / m-input / m-select, state words are m-chip, and every digit goes through .m-n. Every empty
// cell carries one of the three absence kinds; none is a bare dash.
//
// WHAT STAYS. The .cf-sec / .cf-hr / .cf-r / .cf-fl / .cf-pill / .cf-state / .cf-sub grammar below is
// NOT this screen's private CSS — accounts-crm, indicators-crm, opp-work-crm and knowledge-crm all draw
// with it and are not ported yet. Deleting it here would blank four screens, so it stays until they
// are ported in turn. Only the rules this screen ALONE used (.cf-nm, .cf-pos, .cf-dot, .cf-ed and the
// three grid templates) are gone, replaced by the vocabulary.
//
// NO BACKTICKS ANYWHERE IN THIS FILE, comments included: it is one template literal.

export const SETTINGS_CRM_CSS = `
/* ---- the shared settings grammar, still read by four unported screens ---- */
.cf-sec { background:var(--paper); border:1px solid var(--line); border-radius:var(--r-lg); overflow:hidden; }
.cf-h { display:flex; align-items:center; gap:var(--s3); min-height:56px; padding:var(--s2) var(--s4); border-bottom:1px solid var(--line-soft); flex-wrap:wrap; }
.cf-h h2 { margin:0; font-size:var(--t-md); font-weight:600; color:var(--ink); }
.cf-h .s { font-size:var(--t-xs); color:var(--muted); line-height:1.6; }
.cf-h .sp { flex:1; }
.cf-t { display:flex; flex-direction:column; }
.cf-hr, .cf-r { display:grid; gap:var(--s3); align-items:center; padding:var(--s2) var(--s4); }
.cf-hr { min-height:40px; background:var(--surface); font-size:var(--t-xs); font-weight:600; color:var(--muted); }
.cf-r { min-height:56px; border-top:1px solid var(--line-soft); font-size:var(--t-sm); color:var(--ink); }
.cf-r:hover { background:var(--accent-wash); }
.cf-r.off { color:var(--muted); }
.cf-sub { font-size:var(--t-xs); color:var(--muted); }
.cf-num { font-variant-numeric:tabular-nums; }
.cf-pill { font-size:var(--t-xs); font-weight:600; border-radius:var(--r-pill); padding:3px 10px; display:inline-flex; align-items:center; gap:5px; }
.cf-pill.on { background:var(--s-issued-wash, #ECFAF3); color:var(--s-issued-text); }
.cf-pill.off { background:var(--surface-2); color:var(--muted); }
.cf-pill.lock { background:var(--accent-tint); color:var(--accent-deep); }
.cf-acts { display:flex; gap:var(--s2); justify-content:flex-end; flex-wrap:wrap; }
.cf-acts .btn, .cf-acts .rv-hold { height:32px; padding-inline:10px; font-size:var(--t-xs); }
.cf-acts .rv-hold:not(.holding):not(.armed) { background:var(--surface); color:var(--s-fail-text); }
.cf-g { display:grid; grid-template-columns:repeat(auto-fit, minmax(160px,1fr)); gap:var(--s3); }
.cf-fl { display:flex; flex-direction:column; gap:4px; min-width:0; }
.cf-fl label { font-size:var(--t-xs); font-weight:600; color:var(--muted); }
.cf-fl .inp, .cf-fl select { font-family:inherit; width:100%; height:38px; min-height:38px; font-size:var(--t-sm); color:var(--ink);
  background:var(--paper); border:none; box-shadow:inset 0 0 0 1px var(--s-off-mark); border-radius:var(--r-sm); padding-inline:10px; }
.cf-fl .inp.num { text-align:end; font-variant-numeric:tabular-nums; }
.cf-fl .inp[aria-invalid="true"] { box-shadow:inset 0 0 0 2px var(--s-fail); }
.cf-fl .inp:focus, .cf-fl select:focus { box-shadow:inset 0 0 0 2px var(--accent), 0 0 0 3px var(--accent-tint); outline:none; }
.cf-fl .hint { font-size:var(--t-xs); color:var(--muted); }
.cf-err { font-size:var(--t-xs); color:var(--s-fail-text); display:flex; align-items:center; gap:6px; }
.cf-state { padding:var(--s4); font-size:var(--t-sm); color:var(--muted); display:flex; align-items:center; gap:var(--s3); flex-wrap:wrap; }

/* ---- what «إعدادات النظام» itself needs beyond the m-* vocabulary ---- */
.ds6 .cf { display:flex; flex-direction:column; gap:var(--m-4); }
.ds6 .cf-tbl { min-inline-size: 760px; }
.ds6 .cf-tbl th.num, .ds6 .cf-tbl td.num { text-align:end; }
/* The stage colour the admin chose. A dot, not a chip: it carries no status, it identifies a rung. */
.ds6 .cf-dot { inline-size:10px; block-size:10px; border-radius:var(--m-r-chip); display:inline-block;
  flex:none; margin-inline-end:8px; vertical-align:middle; }
/* The row editor opens INSIDE the table, spanning every column, so it cannot drift away from its row. */
.ds6 .cf-ed { background:var(--m-ac-dim); padding:var(--m-4); display:flex; flex-direction:column; gap:var(--m-4); }
.ds6 .cf-ed .m-form { grid-template-columns:repeat(auto-fit, minmax(170px,1fr)); }
.ds6 .cf-row-acts { display:flex; gap:var(--m-2); justify-content:flex-end; flex-wrap:wrap; align-items:center; }
.ds6 .cf-row-acts .m-btn, .ds6 .cf-row-acts .rv-hold { min-block-size:36px; padding-inline:12px; font-size:var(--m-t-cap); }
.ds6 .cf-row-acts .rv-hold:not(.holding):not(.armed) { background:var(--m-paper); color:var(--m-bad); }
.ds6 tr.is-off td { color:var(--m-mut); }
/* A numeric field aligns to the end of its box; the vocabulary's m-input does not say so. */
.ds6 .m-input.num { text-align:end; }
`;

export const SETTINGS_CRM_JS = `
/* ================= «إعدادات النظام» ================= */
var cfStages = null, cfDivs = [], cfTeam = [], cfLoading = false, cfFailed = false;
var cfEdit = null;      /* { kind:"stage"|"division"|"member", id, d:{}, err, field, busy } */
var cfShowOff = false;  /* paused rows are hidden by default: the ladder people work is the live one */

function cfT() { return { headers: { "x-admin-token": TOKEN } }; }
function cfJson(method, url, body) {
  /* No Content-Type without a body: Fastify answers 400 «Body cannot be empty when
     content-type is set to application/json» — which is how a DELETE silently did nothing. */
  var headers = body === undefined ? { "x-admin-token": TOKEN } : { "x-admin-token": TOKEN, "Content-Type": "application/json" };
  return fetch(url, { method: method, headers: headers,
    body: body === undefined ? undefined : JSON.stringify(body) })
    .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, j: j || {} }; }); });
}
function cfIco(n) { return typeof opIco === "function" ? opIco(n) : ""; }
function cfToast(m, bad) { if (typeof opToast === "function") opToast(m, bad); else if (typeof moToast === "function") moToast(m); }
function cfPl(n, one, two, few, many) { return pluralizeArabic(n, one, two, few, many, fmtN); }
/* Every digit through .m-n; a unit that belongs to the number goes INSIDE the span (PORT-SPEC 3). */
function cfN(v) { return '<span class="m-n">' + fmtN(v) + "</span>"; }
/* kind: owed (a number someone owes) · unset (a classification nobody made) · none (a legitimate
   nothing). «بلا مدة» is a choice the admin made, so it is a none, not an unset. */
function cfNil(t, kind) { return '<span class="m-td-nil m-nil--' + (kind || "none") + '">' + esc(t) + "</span>"; }
function cfNOpp(n) { return cfPl(n, "فرصة واحدة", "فرصتان", "فرص", "فرصة"); }
function cfNProd(n) { return cfPl(n, "منتج واحد", "منتجان", "منتجات", "منتجًا"); }
function cfNMember(n) { return cfPl(n, "عضو واحد", "عضوان", "أعضاء", "عضوًا"); }
function cfNDay(n) { return cfPl(n, "يوم واحد", "يومان", "أيام", "يومًا"); }

var cfPending = false;   /* a forced reload asked for WHILE one is in flight */
function cfLoad(force) {
  /* A write finishes, asks for a reload, and gets dropped because a read was already running — so
     the screen keeps showing the row the server just deleted. Remember the request instead. */
  if (cfLoading) { if (force) cfPending = true; return; }
  if (cfStages && !force) return;
  if (cfFailed && !force) return;
  cfLoading = true;
  fetch("/admin/config", cfT()).then(function (r) {
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }).then(function (j) {
    cfStages = j.stages || []; cfDivs = j.divisions || []; cfTeam = j.team || []; cfFailed = false;
    /* The board, the drawer and every stage select read the LIVE ladder from here on: an admin who
       adds a rung sees it on the board without a reload, and a paused rung stops being offered. */
    if (typeof OPP_ST !== "undefined") {
      OPP_ST = cfStages.map(function (s) {
        return { key: s.key, label: s.label, dot: s.dot, position: s.position, active: s.active, slaDays: s.slaDays, terminal: s.terminal, exitCriterion: s.exitCriterion || "" };
      });
    }
  }).catch(function () { cfFailed = true; })
    .then(function () {
      cfLoading = false;
      if (cfPending) { cfPending = false; cfLoad(true); return; }
      render(false);
    });
}
/* The engine re-seeds these on every boot, so «حذف» on one would undo itself at the next restart. */
var CF_SEEDED = ["contact", "discover", "present", "tech", "quote", "negotiate", "won", "lost"];
function cfSeeded(key) { return CF_SEEDED.indexOf(key) >= 0; }
function cfStage(key) { return (cfStages || []).filter(function (s) { return s.key === key; })[0] || null; }
function cfMember(id) { return cfTeam.filter(function (m) { return String(m.id) === String(id); })[0] || null; }
function cfDivision(id) { return cfDivs.filter(function (d) { return String(d.id) === String(id); })[0] || null; }
function cfRoleLabel(r) { return TEAM_ROLE_LABELS[r] || r; }

/* ---- one editor for all three tables: same shape, same keyboard, same error line ---- */
function cfOpen(kind, id, d) { cfEdit = { kind: kind, id: id, d: d, err: "", field: "", busy: false }; render(false); }
function cfClose() { cfEdit = null; render(false); }
function cfSet(k, v) { if (cfEdit) { cfEdit.d[k] = v; cfEdit.err = ""; cfEdit.field = ""; } }
function cfFieldErr(f) { return cfEdit && cfEdit.field === f ? ' aria-invalid="true"' : ""; }
function cfInput(id, label, value, extra, hint) {
  return '<div class="m-field"><label class="m-label" for="' + id + '">' + label + '</label><input class="m-input' + (extra && extra.num ? " num" : "") + '" id="' + id +
    '" data-cfset="' + (extra && extra.k) + '" value="' + esc(value == null ? "" : String(value)) + '"' +
    (extra && extra.type ? ' type="' + extra.type + '"' : "") + (extra && extra.max ? ' maxlength="' + extra.max + '"' : "") +
    (extra && extra.ph ? ' placeholder="' + esc(extra.ph) + '"' : "") + cfFieldErr(extra && extra.k) + ">" +
    (hint ? '<span class="m-hint">' + hint + "</span>" : "") + "</div>";
}
function cfSelect(id, label, k, value, opts, hint) {
  return '<div class="m-field"><label class="m-label" for="' + id + '">' + label + '</label><select class="m-select" id="' + id + '" data-cfset="' + k + '">' +
    opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(value) === String(o[0]) ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") +
    "</select>" + (hint ? '<span class="m-hint">' + hint + "</span>" : "") + "</div>";
}
/* DELETE IS A HOLD, like every other destructive control in this product (DESIGN.md 8.5): one
   click must not remove a stage, a division or a person. And it is only OFFERED where it would
   succeed — a rung with opportunities on it, a division that still owns products or people, and a
   member who has been escalated to say so instead, because a button that always refuses is a lie. */
function cfHold(fn, arg, idle) {
  return '<button class="rv-hold" data-do="' + fn + '" data-arg="' + esc(String(arg)) + '" data-idle="' + idle +
    '" data-holding="استمر بالضغط للحذف…" data-armed="اضغط مرة أخرى للحذف" aria-pressed="false" title="اضغط مع الاستمرار للحذف">' +
    '<span class="rv-fill"></span><span class="rv-lbl">' + idle + "</span></button>";
}
function cfEditorActions(saveLabel) {
  return '<div class="m-row">' +
    '<button class="m-btn m-btn--primary" data-cf="save"' + (cfEdit.busy ? ' disabled aria-busy="true"' : "") + ">" + (cfEdit.busy ? "جارٍ الحفظ…" : saveLabel) + "</button>" +
    '<button class="m-btn" data-cf="cancel">إلغاء</button>' +
    (cfEdit.err ? '<span class="m-err" role="alert">' + cfIco("warn") + esc(cfEdit.err) + "</span>" : "") + "</div>";
}

/* ================= the ladder ================= */
function cfStageEditor() {
  var d = cfEdit.d, isNew = !cfEdit.id;
  var terminal = !isNew && isTerminalStageKey(cfEdit.id);
  var h = '<div class="cf-ed">';
  h += '<div class="m-form">' +
    cfInput("cf_label", "اسم المرحلة", d.label, { k: "label", max: 40, ph: "مثال: مراجعة قانونية" }) +
    cfInput("cf_weight", "الوزن ٪", d.weightPct, { k: "weightPct", num: true, type: "number" }, terminal ? "وزن مرحلتي الربح والخسارة ثابت" : "احتمال الإغلاق على هذه المرحلة") +
    cfInput("cf_pos", "الترتيب", d.position, { k: "position", num: true, type: "number" }) +
    cfInput("cf_sla", "مدة الالتزام (أيام)", d.slaDays, { k: "slaDays", num: true, type: "number", ph: "بلا مدة" }, "بعدها تُعلَّم الفرصة «متأخرة» — اتركها فارغة بلا التزام") +
    cfSelect("cf_active", "الحالة", "active", d.active ? "1" : "", [["1", "مفعّلة"], ["", "موقوفة"]], terminal ? "لا تُوقف" : "الموقوفة لا تُعرض للاختيار") +
    "</div>";
  h += '<div class="m-field">' + cfInput("cf_exit", "شرط الانتقال منها", d.exitCriterion, { k: "exitCriterion", max: 200, ph: "ما الذي يجب أن يتحقق قبل نقل الفرصة من هنا؟" }) + "</div>";
  return h + cfEditorActions(isNew ? "أضف المرحلة" : "احفظ التغييرات") + "</div>";
}
/* The editor opens as a full-width row inside the table it edits, so it can never drift from the row. */
function cfEditorRow(cols, inner) { return '<tr><td colspan="' + cols + '" style="padding:0">' + inner + "</td></tr>"; }
function cfSecHead(title, sub, actions) {
  return '<header class="m-card__h"><div><h2 class="m-card__t">' + title + "</h2>" +
    '<p class="m-meta">' + sub + "</p></div>" +
    '<div class="m-head__a">' + actions + "</div></header>";
}
function cfStagesView() {
  var h = '<section class="m-card m-card--pad0"><div style="padding:var(--m-5) var(--m-5) 0">' +
    cfSecHead("مراحل البيع",
      "الترتيب والأوزان تُستخدم في اللوحة والتوقعات · «مدة الالتزام» تحدد متى تُعلَّم الفرصة متأخرة",
      '<span class="m-seg"><button type="button" aria-pressed="' + cfShowOff + '" data-cf="showoff">إظهار الموقوفة</button></span>' +
      (cfEdit && cfEdit.kind === "stage" && !cfEdit.id ? '<button class="m-btn" aria-disabled="true" tabindex="-1">' + cfIco("plus") + "إضافة مرحلة</button>"
        : '<button class="m-btn m-btn--primary" id="cfaddstage" data-cf="addstage">' + cfIco("plus") + "إضافة مرحلة</button>")) + "</div>";
  if (cfEdit && cfEdit.kind === "stage" && !cfEdit.id) h += cfStageEditor();
  var rows = (cfStages || []).filter(function (s) { return cfShowOff || s.active || s.openLines; });
  h += '<div class="m-tablewrap"><table class="m-table cf-tbl"><thead><tr>' +
    '<th class="num">#</th><th>المرحلة</th><th class="num">الوزن</th><th>مدة الالتزام</th><th>الحالة</th><th>الفرص عليها</th><th></th>' +
    "</tr></thead><tbody>";
  if (!rows.length) {
    h += '<tr class="m-table__empty"><td colspan="7"><div class="m-empty"><p class="m-empty__t">لا مراحل مطابقة</p>' +
      '<p class="m-empty__d">أظهر الموقوفة لرؤية المراحل التي أُوقفت.</p></div></td></tr>';
  }
  rows.forEach(function (s) {
    var editing = cfEdit && cfEdit.kind === "stage" && cfEdit.id === s.key;
    var terminal = isTerminalStageKey(s.key);
    h += '<tr class="' + (s.active ? "" : "is-off") + '" data-cfrow="' + esc(s.key) + '">';
    h += '<td class="m-td-v">' + cfN(s.position) + "</td>";
    h += '<td class="m-td-n"><i class="cf-dot" style="background:' + esc(s.dot || "#A2A9B4") + '"></i>' + esc(s.label) +
      (s.exitCriterion ? '<span class="m-meta"> · ' + esc(s.exitCriterion) + "</span>" : "") + "</td>";
    h += '<td class="m-td-v"><span class="m-n">' + fmtN(s.weightPct) + "٪</span></td>";
    h += "<td>" + (s.slaDays ? cfNDay(s.slaDays) : cfNil("بلا مدة", "none")) + "</td>";
    h += "<td>" + (terminal ? '<span class="m-chip m-chip--ac">أساسية</span>'
      : s.active ? '<span class="m-chip m-chip--ok">مفعّلة</span>' : '<span class="m-chip">موقوفة</span>') + "</td>";
    h += "<td>" + (s.openLines ? cfNOpp(s.openLines) : cfNil("لا فرص", "none")) + "</td>";
    h += '<td><span class="cf-row-acts">' +
      '<button class="m-btn" data-cf="editstage" data-k="' + esc(s.key) + '">تعديل</button>' +
      (terminal || cfSeeded(s.key) ? '<span class="m-meta" title="مرحلة أساسية في المحرك — أوقفها بدل حذفها">أساسية</span>'
        : s.openLines ? '<span class="m-meta" title="أوقفها بدل حذفها">عليها فرص</span>'
        : cfHold("cfDeleteStage", s.key, "حذف")) + "</span></td>";
    h += "</tr>";
    if (editing) h += cfEditorRow(7, cfStageEditor());
  });
  h += "</tbody></table></div>";
  h += '<p class="m-meta" style="padding:var(--m-4) var(--m-5)">مفتاح المرحلة (' + esc((cfStages || []).map(function (s) { return s.key; }).slice(0, 3).join(" · ")) +
    " …) لا يتغيّر بعد إنشائها: الفرص المسجّلة وسجل التحركات تشير إليه. الاسم والوزن والترتيب والمدة والحالة تُعدَّل متى شئت.</p>";
  return h + "</section>";
}

/* ================= divisions ================= */
function cfDivisionEditor() {
  var d = cfEdit.d;
  var owners = [["", "بلا مسؤول"]].concat(cfTeam.filter(function (m) { return m.active; }).map(function (m) { return [String(m.id), m.name + " · " + cfRoleLabel(m.role)]; }));
  var h = '<div class="cf-ed"><div class="m-form">' +
    cfInput("cf_dname", "اسم القسم", d.name, { k: "name", max: 60, ph: "مثال: قسم الصحة" }) +
    cfSelect("cf_downer", "مسؤول القسم", "ownerMemberId", d.ownerMemberId == null ? "" : String(d.ownerMemberId), owners, "من سجل الفريق") +
    cfSelect("cf_dactive", "الحالة", "active", d.active ? "1" : "", [["1", "مفعّل"], ["", "موقوف"]]) +
    "</div>";
  return h + cfEditorActions(cfEdit.id ? "احفظ التغييرات" : "أضف القسم") + "</div>";
}
function cfDivisionsView() {
  var h = '<section class="m-card m-card--pad0"><div style="padding:var(--m-5) var(--m-5) 0">' +
    cfSecHead("الأقسام",
      "وحدات الشركة — كل منتج يتبع قسمًا، وكل عضو فريق يعمل داخل قسم. غير «القطاع»، الذي يصف سوق المنتج.",
      (cfEdit && cfEdit.kind === "division" && !cfEdit.id ? '<button class="m-btn" aria-disabled="true" tabindex="-1">' + cfIco("plus") + "إضافة قسم</button>"
        : '<button class="m-btn m-btn--primary" id="cfadddiv" data-cf="adddiv">' + cfIco("plus") + "إضافة قسم</button>")) + "</div>";
  if (cfEdit && cfEdit.kind === "division" && !cfEdit.id) h += cfDivisionEditor();
  h += '<div class="m-tablewrap"><table class="m-table cf-tbl"><thead><tr>' +
    "<th>القسم</th><th>المسؤول</th><th>المنتجات</th><th>الأعضاء</th><th>الحالة</th><th></th>" +
    "</tr></thead><tbody>";
  if (!cfDivs.length) {
    h += '<tr class="m-table__empty"><td colspan="6"><div class="m-empty"><p class="m-empty__t">لا أقسام بعد</p>' +
      '<p class="m-empty__d">أضف قسمًا ثم اربط به منتجاته وأعضاءه.</p></div></td></tr>';
  }
  cfDivs.forEach(function (d) {
    var editing = cfEdit && cfEdit.kind === "division" && cfEdit.id === d.id;
    h += '<tr class="' + (d.active ? "" : "is-off") + '" data-cfrow="div' + d.id + '">';
    h += '<td class="m-td-n">' + esc(d.name) + "</td>";
    h += "<td>" + (d.ownerName
      ? esc(d.ownerName) + (d.ownerEmail ? '<span class="m-meta"> · <bdi>' + esc(d.ownerEmail) + "</bdi></span>" : "")
      : cfNil("بلا مسؤول", "unset")) + "</td>";
    h += "<td>" + (d.products ? cfNProd(d.products) : cfNil("لا منتجات", "none")) + "</td>";
    h += "<td>" + (d.members ? cfNMember(d.members) : cfNil("لا أعضاء", "none")) + "</td>";
    h += "<td>" + (d.active ? '<span class="m-chip m-chip--ok">مفعّل</span>' : '<span class="m-chip">موقوف</span>') + "</td>";
    h += '<td><span class="cf-row-acts"><button class="m-btn" data-cf="editdiv" data-i="' + d.id + '">تعديل</button>' +
      (d.products || d.members ? '<span class="m-meta" title="انقل منتجاته وأعضاءه أولًا، أو أوقفه">مرتبط</span>'
        : cfHold("cfDeleteDivision", d.id, "حذف")) + "</span></td></tr>";
    if (editing) h += cfEditorRow(6, cfDivisionEditor());
  });
  return h + "</tbody></table></div></section>";
}

/* ================= the team ================= */
function cfMemberEditor() {
  var d = cfEdit.d;
  var divs = [["", "بلا قسم"]].concat(cfDivs.map(function (x) { return [String(x.id), x.name]; }));
  var roles = TEAM_ROLES.map(function (r) { return [r, cfRoleLabel(r)]; });
  var h = '<div class="cf-ed"><div class="m-form">' +
    cfInput("cf_mname", "الاسم", d.name, { k: "name", max: 60 }) +
    cfInput("cf_memail", "البريد", d.email, { k: "email", max: 120, type: "email", ph: "name@company.com" }, "إليه يذهب التصعيد وطلب الدعم") +
    cfSelect("cf_mrole", "الدور", "role", d.role, roles, "الدعم يستقبل طلبات الدعم · الإدارة تستقبل التصعيد") +
    cfSelect("cf_mdiv", "القسم", "divisionId", d.divisionId == null ? "" : String(d.divisionId), divs) +
    cfSelect("cf_mactive", "الحالة", "active", d.active ? "1" : "", [["1", "مفعّل"], ["", "موقوف"]]) +
    "</div>";
  return h + cfEditorActions(cfEdit.id ? "احفظ التغييرات" : "أضف العضو") + "</div>";
}
function cfTeamView() {
  var h = '<section class="m-card m-card--pad0"><div style="padding:var(--m-5) var(--m-5) 0">' +
    cfSecHead("الفريق",
      "الأشخاص الذين يُصعَّد إليهم ويُطلب منهم الدعم — الاسم والبريد والدور والقسم.",
      (cfEdit && cfEdit.kind === "member" && !cfEdit.id ? '<button class="m-btn" aria-disabled="true" tabindex="-1">' + cfIco("plus") + "إضافة عضو</button>"
        : '<button class="m-btn m-btn--primary" id="cfaddmember" data-cf="addmember">' + cfIco("plus") + "إضافة عضو</button>")) + "</div>";
  if (cfEdit && cfEdit.kind === "member" && !cfEdit.id) h += cfMemberEditor();
  h += '<div class="m-tablewrap"><table class="m-table cf-tbl"><thead><tr>' +
    "<th>الاسم</th><th>البريد</th><th>الدور</th><th>القسم</th><th>الحالة</th><th></th>" +
    "</tr></thead><tbody>";
  if (!cfTeam.length) {
    h += '<tr class="m-table__empty"><td colspan="6"><div class="m-empty"><p class="m-empty__t">لا أعضاء بعد</p>' +
      '<p class="m-empty__d">التصعيد وطلب الدعم يحتاجان شخصًا مسجّلًا ببريده.</p></div></td></tr>';
  }
  cfTeam.forEach(function (m) {
    var editing = cfEdit && cfEdit.kind === "member" && cfEdit.id === m.id;
    h += '<tr class="' + (m.active ? "" : "is-off") + '" data-cfrow="mem' + m.id + '">';
    h += '<td class="m-td-n">' + esc(m.name) + "</td>";
    h += "<td>" + (m.email ? "<bdi>" + esc(m.email) + "</bdi>" : cfNil("لم يُسجَّل بريد", "owed")) + "</td>";
    h += "<td>" + (m.role ? esc(cfRoleLabel(m.role)) : cfNil("لم يُحدَّد", "unset")) + "</td>";
    h += "<td>" + (m.division ? esc(m.division) : cfNil("بلا قسم", "unset")) + "</td>";
    h += "<td>" + (m.active ? '<span class="m-chip m-chip--ok">مفعّل</span>' : '<span class="m-chip">موقوف</span>') + "</td>";
    h += '<td><span class="cf-row-acts"><button class="m-btn" data-cf="editmember" data-i="' + m.id + '">تعديل</button>' +
      (m.escalations ? '<span class="m-meta" title="عليه تصعيدات مسجّلة — أوقفه بدل حذفه">عليه تصعيدات</span>'
        : cfHold("cfDeleteMember", m.id, "حذف")) + "</span></td></tr>";
    if (editing) h += cfEditorRow(6, cfMemberEditor());
  });
  return h + "</tbody></table></div></section>";
}

function vSettings(which) {
  cfLoad(false);
  var h = '<div class="ds6"><div class="cf">';
  if (cfStages === null && !cfFailed) {
    return h + '<section class="m-card"><p class="m-body" aria-busy="true">جارٍ تحميل الإعدادات…</p></section></div></div>';
  }
  if (cfFailed && cfStages === null) {
    return h + '<section class="m-card"><p class="m-body" role="alert">تعذّر تحميل الإعدادات. ' +
      '<button class="m-btn" data-cf="retry">أعد المحاولة</button></p></section></div></div>';
  }
  if (cfFailed) h += '<section class="m-card"><p class="m-body" role="alert">' + cfIco("warn") +
    'تعذّر التحديث — المعروض آخر نسخة محمّلة. <button class="m-btn" data-cf="retry">أعد المحاولة</button></p></section>';
  h += which === "divisions" ? cfDivisionsView() : which === "team" ? cfTeamView() : cfStagesView();
  return h + "</div></div>";
}

/* ---- writes ---- */
function cfSaveStage() {
  var e = cfEdit, d = e.d;
  var taken = (cfStages || []).map(function (s) { return s.key; });
  var checked = checkStage({
    label: d.label, weightPct: Number(d.weightPct), position: Number(d.position),
    slaDays: d.slaDays, active: !!d.active, exitCriterion: d.exitCriterion,
  }, taken, e.id || undefined);
  if (!checked.ok) { e.err = checked.reason; e.field = checked.field; render(false); return; }
  e.busy = true; render(false);
  var req = e.id ? cfJson("PATCH", "/admin/config/stages/" + encodeURIComponent(e.id), checked.value)
    : cfJson("POST", "/admin/config/stages", checked.value);
  req.then(function (r) {
    e.busy = false;
    if (!r.ok) { e.err = r.j.detail || "تعذّر الحفظ (" + fmtN(r.status) + ")"; e.field = r.j.field || ""; render(false); return; }
    cfEdit = null; cfLoad(true);
    cfToast(e.id ? "حُفظت المرحلة" : "أُضيفت المرحلة «" + checked.value.label + "»", false);
  }).catch(function () { e.busy = false; e.err = "تعذّر الاتصال — لم يُحفظ شيء."; render(false); });
}
window.cfDeleteStage = function (key) {
  var s = cfStage(key); if (!s) return;
  var checked = checkStageDelete(key, s.openLines, CF_SEEDED);
  if (!checked.ok) { cfToast(checked.reason, true); return; }
  cfJson("DELETE", "/admin/config/stages/" + encodeURIComponent(key)).then(function (r) {
    if (!r.ok) { cfToast(r.j.detail || "تعذّر الحذف", true); return; }
    cfLoad(true); cfToast("حُذفت المرحلة «" + s.label + "»", false);
  }).catch(function () { cfToast("تعذّر الاتصال — لم يُحذف شيء.", true); });
};
function cfSaveDivision() {
  var e = cfEdit, d = e.d;
  var owner = d.ownerMemberId ? cfMember(d.ownerMemberId) : null;
  var checked = checkDivision({ name: d.name, ownerMemberId: d.ownerMemberId, active: !!d.active },
    cfDivs.map(function (x) { return x.name; }), owner, e.id ? (cfDivision(e.id) || {}).name : undefined);
  if (!checked.ok) { e.err = checked.reason; e.field = checked.field; render(false); return; }
  e.busy = true; render(false);
  var req = e.id ? cfJson("PATCH", "/admin/config/divisions/" + e.id, checked.value)
    : cfJson("POST", "/admin/config/divisions", checked.value);
  req.then(function (r) {
    e.busy = false;
    if (!r.ok) { e.err = r.j.detail || "تعذّر الحفظ (" + fmtN(r.status) + ")"; e.field = r.j.field || ""; render(false); return; }
    cfEdit = null; cfLoad(true);
    if (typeof pcLoad === "function") pcLoad(true);
    cfToast(e.id ? "حُفظ القسم" : "أُضيف القسم «" + checked.value.name + "»", false);
  }).catch(function () { e.busy = false; e.err = "تعذّر الاتصال — لم يُحفظ شيء."; render(false); });
}
window.cfDeleteDivision = function (id) {
  id = Number(id);
  var d = cfDivision(id); if (!d) return;
  var checked = checkDivisionDelete(d.products, d.members);
  if (!checked.ok) { cfToast(checked.reason, true); return; }
  cfJson("DELETE", "/admin/config/divisions/" + id).then(function (r) {
    if (!r.ok) { cfToast(r.j.detail || "تعذّر الحذف", true); return; }
    cfLoad(true); if (typeof pcLoad === "function") pcLoad(true);
    cfToast("حُذف القسم «" + d.name + "»", false);
  }).catch(function () { cfToast("تعذّر الاتصال — لم يُحذف شيء.", true); });
};
function cfSaveMember() {
  var e = cfEdit, d = e.d;
  var checked = checkMember({ name: d.name, email: d.email, role: d.role, divisionId: d.divisionId, active: !!d.active });
  if (!checked.ok) { e.err = checked.reason; e.field = checked.field; render(false); return; }
  e.busy = true; render(false);
  var req = e.id ? cfJson("PATCH", "/admin/config/team/" + e.id, checked.value)
    : cfJson("POST", "/admin/config/team", checked.value);
  req.then(function (r) {
    e.busy = false;
    if (!r.ok) { e.err = r.j.detail || "تعذّر الحفظ (" + fmtN(r.status) + ")"; e.field = r.j.field || ""; render(false); return; }
    cfEdit = null; cfLoad(true);
    cfToast(e.id ? "حُفظ العضو" : "أُضيف «" + checked.value.name + "» إلى الفريق", false);
  }).catch(function () { e.busy = false; e.err = "تعذّر الاتصال — لم يُحفظ شيء."; render(false); });
}
window.cfDeleteMember = function (id) {
  id = Number(id);
  var m = cfMember(id); if (!m) return;
  if (m.escalations) { cfToast("عليه تصعيدات مسجّلة — أوقفه بدل حذفه.", true); return; }
  cfJson("DELETE", "/admin/config/team/" + id).then(function (r) {
    if (!r.ok) { cfToast(r.j.detail || "تعذّر الحذف", true); return; }
    cfLoad(true); cfToast("حُذف «" + m.name + "» من الفريق", false);
  }).catch(function () { cfToast("تعذّر الاتصال — لم يُحذف شيء.", true); });
};

/* ---- one delegated listener, like every other CRM surface here ---- */
document.addEventListener("click", function (ev) {
  var t = ev.target && ev.target.closest ? ev.target.closest("[data-cf]") : null;
  if (!t) return;
  var a = t.getAttribute("data-cf");
  if (a === "retry") { cfFailed = false; cfLoad(true); return; }
  if (a === "showoff") { cfShowOff = !cfShowOff; render(false); return; }
  if (a === "addstage") {
    var nextPos = ((cfStages || []).reduce(function (n, s) { return Math.max(n, s.position); }, 0)) + 1;
    cfOpen("stage", "", { label: "", weightPct: 50, position: nextPos, slaDays: "", active: true, exitCriterion: "" });
    setTimeout(function () { var f = document.getElementById("cf_label"); if (f) f.focus(); }, 0); return;
  }
  if (a === "editstage") {
    var s = cfStage(t.getAttribute("data-k")); if (!s) return;
    cfOpen("stage", s.key, { label: s.label, weightPct: s.weightPct, position: s.position, slaDays: s.slaDays == null ? "" : s.slaDays, active: s.active, exitCriterion: s.exitCriterion || "" });
    setTimeout(function () { var f = document.getElementById("cf_label"); if (f) f.focus(); }, 0); return;
  }

  if (a === "adddiv") { cfOpen("division", 0, { name: "", ownerMemberId: "", active: true }); setTimeout(function () { var f = document.getElementById("cf_dname"); if (f) f.focus(); }, 0); return; }
  if (a === "editdiv") {
    var d = cfDivision(Number(t.getAttribute("data-i"))); if (!d) return;
    cfOpen("division", d.id, { name: d.name, ownerMemberId: d.ownerMemberId == null ? "" : d.ownerMemberId, active: d.active });
    setTimeout(function () { var f = document.getElementById("cf_dname"); if (f) f.focus(); }, 0); return;
  }

  if (a === "addmember") { cfOpen("member", 0, { name: "", email: "", role: "sales", divisionId: "", active: true }); setTimeout(function () { var f = document.getElementById("cf_mname"); if (f) f.focus(); }, 0); return; }
  if (a === "editmember") {
    var m = cfMember(Number(t.getAttribute("data-i"))); if (!m) return;
    cfOpen("member", m.id, { name: m.name, email: m.email, role: m.role, divisionId: m.divisionId == null ? "" : m.divisionId, active: m.active });
    setTimeout(function () { var f = document.getElementById("cf_mname"); if (f) f.focus(); }, 0); return;
  }

  if (a === "cancel") { cfClose(); return; }
  if (a === "save") {
    if (!cfEdit) return;
    if (cfEdit.kind === "stage") cfSaveStage();
    else if (cfEdit.kind === "division") cfSaveDivision();
    else cfSaveMember();
  }
});
document.addEventListener("input", function (ev) {
  var t = ev.target; if (!t || !t.getAttribute) return;
  var k = t.getAttribute("data-cfset"); if (!k || !cfEdit) return;
  cfSet(k, t.value);
});
document.addEventListener("change", function (ev) {
  var t = ev.target; if (!t || !t.getAttribute) return;
  var k = t.getAttribute("data-cfset"); if (!k || !cfEdit) return;
  cfSet(k, k === "active" ? !!t.value : t.value);
});
document.addEventListener("keydown", function (ev) {
  if (!cfEdit) return;
  if (ev.key === "Escape") { ev.preventDefault(); cfClose(); return; }
  if (ev.key === "Enter" && ev.target && ev.target.getAttribute && ev.target.getAttribute("data-cfset")) {
    ev.preventDefault();
    if (cfEdit.kind === "stage") cfSaveStage(); else if (cfEdit.kind === "division") cfSaveDivision(); else cfSaveMember();
  }
});
`;
