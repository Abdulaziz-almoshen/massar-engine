// targets-crm.ts — جهات الاستهداف, the imported book.
//
// WHAT THIS SCREEN IS, and why each piece is here:
//
// 1. «قائمة الصباح» sat on TOP of this screen — the third rendering of the same ranked list that
//    #home shows as its own work column and #customers shows as its تجميع-by-outcome view.
//    Three surfaces, three visual languages, one question. It is deleted here; #home owns it.
// 2. The list has a header row, sort, facets and a count, like #customers and #kmon beside it.
// 3. Deleting an imported target is a HOLD, not a click: DESIGN.md §8.5. The gesture is the
//    confirmation and releasing early is the undo.
// 4. The importer is two buttons on the control bar plus a collapsed «إضافة جهة يدويًا»; the
//    instructions live in the empty state, where they are read exactly when they are needed.
//
// PORTED to the new design system (docs/PORT-SPEC.md). The screen body is wrapped in .ds6 and the
// book is a real .m-table inside .m-tablewrap, so the eight-track .crow grid, its phone fallback
// and the private avatar/chip/phone cells are all gone. Every count goes through .m-n or dsFig,
// every empty cell states WHICH KIND of absence it is, and the counted nouns come from opPl.
//
// SMOKE LANDMARK: #targets asserts «الشرائح», which is the table's second column header. Do not
// rename it without smoke.py.
//
// TWO ISLANDS OF THE OLD SYSTEM REMAIN, and they are dashboard.ts's, not this file's: the manual
// entry rows come from manualRowsHtml() and the import status lines are written into #entstat and
// #entfstat as .chip markup. Both live in dashboard.ts, which ADR-0001 forbids range-editing, so
// they keep their old classes until that file is ported.
//
// Client JS in the dashboard.ts <script> scope (see campaigns-crm.ts for the seam). It borrows
// entities, segGroups, attrChips, contactByPhone, esc, fmtN, ic, LIST_CAP — and defines no
// statistic of its own.
//
// NO BACKTICKS ANYWHERE IN THIS FILE, comments included: it is one template literal.

export const TARGETS_CRM_CSS = `
/* PORTED to the m-* vocabulary (docs/PORT-SPEC.md). Deleted here because the vocabulary carries
   them: the row grid and its narrow-screen fallback, the header strip, the avatar, the segment
   chips, the phone cell, the stage dot, the buttons and their hover and focus treatments. What
   survives is the table's own column width, the two cells whose content the vocabulary has no
   opinion about, and the tag sheet — a panel, not a modal, and the vocabulary's .m-dlg is a
   dialog element this screen does not open as one. */
.ds6 .tgt-tbl .m-table{min-inline-size:880px}
/* A FILTER BAR IS A ROW, NOT A STACK. .m-input and .m-select are authored at inline-size:100%
 for a form field, which is right inside .m-form and wrong inside a filter bar: every control
 then claims a full line and five filters become five rows. Sized here rather than in the
 vocabulary because massar-ds-crm.ts is generated. */
.ds6 .tgt-tools .m-input, .ds6 .tgt-tools .m-select{inline-size:auto;flex:0 1 auto;
  min-inline-size:168px;max-inline-size:300px}
.ds6 .tgt-nm{display:flex;align-items:center;gap:var(--m-2);min-inline-size:0}
/* Two lines, then clamp — an entity name is the only thing identifying its row, and
   «مجمع النور الطبي (مثال — امسح هذا الصف)» was being cut mid-parenthesis. */
.ds6 .tgt-nm .lb{overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
  white-space:normal;line-height:1.4}
.ds6 .tgt-seg{display:flex;align-items:center;gap:5px;flex-wrap:wrap;min-inline-size:0}
/* BRIDGE, not a second vocabulary. The segment chips come from dashboard.ts (prodChips/attrChips)
   and still emit .chip with the old tokens; that file is under ADR-0001 and is not range-edited
   from here. Rather than let two chip designs sit in one table, the old class is re-drawn on the
   new system's tokens INSIDE .ds6 only. It comes out when dashboard.ts is ported. */
.ds6 .tgt-seg .chip{display:inline-flex;align-items:center;gap:4px;font-size:var(--m-t-micro);
  font-weight:600;border-radius:var(--m-r-chip);padding-inline:9px;padding-block:2px;
  background:var(--m-sunk);border:0;color:var(--m-ink-2);white-space:nowrap}
.ds6 .tgt-seg .chip.c-blue, .ds6 .tgt-seg .chip.c-teal{background:var(--m-ac-dim);color:var(--m-ac-deep)}
.ds6 .tgt-ltr{direction:ltr;unicode-bidi:isolate;font-variant-numeric:tabular-nums}
.ds6 .tgt-st{display:flex;align-items:center;gap:7px;min-inline-size:0}
.ds6 .tgt-st .d{inline-size:6px;block-size:6px;border-radius:50%;flex:none}
.ds6 .tgt-act{display:flex;align-items:center;gap:6px;justify-content:flex-end;flex-wrap:wrap}
/* The hold-to-delete gesture is revamp.ts's .rv-hold and keeps its own drawing. In a table cell it
   is always visible: an affordance you must hover to discover is not an answer to «now what». */
.ds6 .tgt-act .rv-hold{opacity:1}

/* The manual-entry disclosure. Its ROWS come from dashboard.ts (manualRowsHtml) and still wear
   .inp, so only the container is stated here. */
.ds6 .tgt-import{background:var(--m-paper);border:1px solid var(--m-line);border-radius:var(--m-r-card);
  padding-inline:var(--m-4);padding-block:var(--m-3)}
.ds6 .tgt-import > summary{font-size:var(--m-t-body);font-weight:600;color:var(--m-ink-2);cursor:pointer}
.ds6 .tgt-import .row{display:flex;align-items:center;gap:var(--m-3);margin-block-start:var(--m-3);flex-wrap:wrap}
.ds6 .tgt-import textarea{inline-size:100%;font:inherit;font-size:var(--m-t-body);line-height:2;
  padding:var(--m-2) var(--m-3);border:1px solid var(--m-line-2);border-radius:var(--m-r-ctl);
  background:var(--m-paper);color:var(--m-ink);resize:vertical;box-sizing:border-box}
.ds6 .tgt-import textarea:focus{outline:none;box-shadow:var(--m-focus)}

/* إدارة الوسوم — a panel over the list, not a dialog element. */
.tgt-sheet{position:fixed;inset:0;z-index:var(--z-toast);background:rgba(11,13,18,.32);
  display:flex;align-items:flex-start;justify-content:center;padding:70px 20px;overflow-y:auto}
.ds6 .tgt-sheet__p{background:var(--m-paper);border:1px solid var(--m-line);border-radius:var(--m-r-band);
  inline-size:100%;max-inline-size:520px;padding:var(--m-5);box-shadow:var(--m-lift);
  display:flex;flex-direction:column;gap:var(--m-3)}
.ds6 .tgt-sheet__mk{display:flex;gap:var(--m-2)}
.ds6 .tgt-sheet__mk .m-input{flex:1;min-inline-size:0}
.ds6 .tgt-sheet__l{max-block-size:52vh;overflow-y:auto}
.ds6 .tgt-trow{display:flex;align-items:center;gap:var(--m-2);padding-block:var(--m-2);
  border-block-start:1px solid var(--m-line);flex-wrap:wrap}
.ds6 .tgt-trow:first-child{border-block-start:0}
.ds6 .tgt-trow .nm{flex:1;min-inline-size:120px;font-size:var(--m-t-body);color:var(--m-ink);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ds6 .tgt-trow .m-input{flex:1;min-inline-size:140px}
.ds6 .tgt-trow .m-btn{min-block-size:36px;padding-inline:var(--m-3);font-size:var(--m-t-cap)}
.ds6 .tgt-trow .danger{color:var(--m-bad);border-color:var(--m-bad-line)}
@media (max-width:640px){
  .ds6 .tgt-tbl .m-table{min-inline-size:640px}
  .tgt-sheet{padding:24px 12px}
}
`;

export const TARGETS_CRM_JS = `
/* ============================ targets-crm (client) ============================ */
var tgtArm = 0;   /* id of the row whose delete is armed; 0 = none. One at a time, by construction. */
/* SEPARATE state from the wizard's entQ/entFilters on purpose. Sharing them would mean a search
   typed while browsing the book silently narrowed the audience of the next campaign — the same
   shape of leak the reviewer blocked when a campaign's selection survived navigation. */
var tgtQ = "";
var tgtFilters = {};
/* The book is browsable by service too — same dimension as the wizard's band, its own state for the
   same reason the search is: browsing the book must not silently narrow the next campaign. ONE field
   here rather than three; «who owns what» is the question you ask of a list, and the negation and the
   interest reading belong where an audience is being chosen. */
var tgtProd = "";
/* Exact operator tag (entities.productTags), set by the product record's «الجهات المستهدفة» link. */
var tgtTagProd = "";
window.tgtClearTagProd = function () { tgtTagProd = ""; render(false); };
/* Selection lives here, keyed by id, and is INTERSECTED with the visible match on read — the same
   structural rule the reviewer forced on the campaigns list after a selection survived navigation
   and staged one campaign's phones under another campaign's name. */
var tgtSel = {};
var tgtTagBusy = false;
var tgtOppBusy = false;
var tgtTagsOpen = false;
var tgtTagEdit = "";   /* the tag whose name is being edited, inline */
var tgtTagArm = "";    /* the tag armed for deletion — arm, then confirm, like the row delete */
function tgtSelIds() {
  var live = {};
  tgtMatches().forEach(function (e) { live[e.id] = true; });
  return Object.keys(tgtSel).map(Number).filter(function (id) { return live[id]; });
}
function tgtMatches() {
  var q = tgtQ.trim();
  return entities.filter(function (e) {
    return Object.keys(tgtFilters).every(function (k) { return !tgtFilters[k] || ((e.attrs || {})[k] || "") === tgtFilters[k]; }) &&
      (!tgtProd || entUses(e, tgtProd)) &&
      (!tgtTagProd || (e.productTags || []).indexOf(tgtTagProd) >= 0) &&
      (typeof indTargetsFilter !== "function" || indTargetsFilter(e)) &&
      (!q || e.name.includes(q) || e.phone.includes(q));
  });
}
/* The match count is printed on the control bar AND in the table's foot, so it is bound to the
   filter it is counted from rather than passed twice (PORT-SPEC §6). */
function tgtBind() {
  dsD("tgtShown", function () { return tgtMatches().length; });
  dsD("tgtAll", function () { return entities.length; });
}

/* Facets come from segGroups() — whatever columns the imported file actually carried. No facet is
   declared here, so a book without a «المدينة» column simply has no المدينة filter rather than an
   empty dropdown promising one. */
function tgtFacetBar() {
  var groups = segGroups();
  var h = '<div class="m-tools tgt-tools"><div class="m-head__a">';
  h += '<input class="m-input" id="tq" value="' + esc(tgtQ) + '" oninput="tgtSearch(this)" ' +
    'placeholder="ابحث بالاسم أو الرقم…" aria-label="بحث في جهات الاستهداف">';
  if (tgtTagProd) h += '<button type="button" class="m-btn" aria-pressed="true" onclick="tgtClearTagProd()" title="إزالة تصفية المنتج">موسومة بـ: ' + esc(tgtTagProd) + " &#215;</button>";
  groups.forEach(function (g, ki) {
    h += '<select class="m-select" aria-label="' + esc(g.key) + '" onchange="tgtSetAttr(' + ki + ', Number(this.value))">' +
      '<option value="-1">' + esc(g.key) + ": الكل</option>" +
      g.values.map(function (v, vi) {
        return '<option value="' + vi + '"' + (tgtFilters[g.key] === v[0] ? " selected" : "") + ">" +
          esc(v[0]) + " (" + fmtN(v[1]) + ")</option>";
      }).join("") + "</select>";
  });
  var withProd = affinityProducts().filter(function (p) { return p.uses > 0 || p.name === tgtProd; });
  if (withProd.length) {
    h += '<select class="m-select" aria-label="الخدمة المستخدمة" onchange="tgtSetProd(this.value)">' +
      '<option value="">الخدمة المستخدمة: الكل</option>' +
      withProd.map(function (p) {
        return '<option value="' + esc(p.name) + '"' + (tgtProd === p.name ? " selected" : "") + ">" +
          esc(clip(p.name, 26)) + " (" + fmtN(p.uses) + ")</option>";
      }).join("") + "</select>";
  }
  /* BR-CUS-003: filter the book by usage indicator (indicators-crm owns the membership read). */
  if (typeof indTargetsSelect === "function") h += indTargetsSelect();
  if (tgtMayEdit()) {
    h += '<button type="button" class="m-btn" onclick="tgtOpenTags()">الوسوم' +
      (tagList().length ? " (" + fmtN(tagList().length) + ")" : "") + "</button>";
    h += '<a href="/assets/audience-template.xlsx" download class="m-btn">القالب الجاهز</a>';
    h += '<button type="button" class="m-btn m-btn--primary" onclick="entFilePick()">رفع ملف Excel/CSV</button>';
  }
  h += "</div></div>";
  return h;
}
/* The unit noun is four-way and agrees with its own count (PORT-SPEC §5): dsPageBar prints the
   number itself, so this returns the noun alone. */
function tgtNoun(n) { return n === 1 ? "جهة" : n === 2 ? "جهتان" : (n >= 3 && n <= 10) ? "جهات" : "جهة"; }

function tgtHeader(allOn) {
  /* Selecting rows here exists only to drive the bulk bar (tag, untag, open deals). With the bar
     hidden, a checkbox is a control that highlights rows and can never do anything. */
  var box = tgtMayEdit()
    ? '<input type="checkbox" class="m-cb" aria-label="تحديد المعروض"' + (allOn ? " checked" : "") + ' onclick="tgtTogglePage()">'
    : "";
  /* SMOKE: «الشرائح» is the landmark smoke.py asserts for #targets. */
  return "<thead><tr>" +
    '<th class="m-sel">' + box + "</th>" +
    "<th>الجهة</th><th>الشرائح</th><th>الجوال</th><th>المرحلة</th><th>إجراءات</th></tr></thead>";
}

function tgtRow(e) {
  /* The state column reports what the ledger holds, in three cases only:
     the pipeline stage of its conversation, or «مستهدَف» when it has never been messaged — which is
     the ladder's own first rung, so this screen invents no word of its own. Nothing is ever
     inferred from the imported attributes. */
  var st = stageOfEntity(e);
  var c = contactByPhone(e.phone);
  /* A customer never messaged has an account record now (BRD §9, S2), so every row opens something. */
  var href = c ? ("#customer/" + esc(e.phone)) : ("#account/" + Number(e.id));
  var seg = (function () {
    var pc = prodChips(e);
    var budget = pc ? (pc.split("<span class=").length - 1 > 1 ? 1 : 2) : 3;
    return pc + attrChips(e, budget);
  })();
  return "<tr" + (tgtSel[e.id] ? ' aria-selected="true"' : "") + ">" +
    '<td class="m-sel" onclick="event.stopPropagation()">' + (tgtMayEdit()
      ? '<input type="checkbox" class="m-cb"' + (tgtSel[e.id] ? " checked" : "") + ' aria-label="تحديد ' + esc(e.name) + '" onclick="tgtToggle(' + e.id + ')">'
      : "") + "</td>" +
    '<td class="m-td-n"><span class="tgt-nm"><span class="m-av m-av--sq">' + esc(e.name.trim().charAt(0)) + "</span>" +
      '<a class="m-link lb" href="' + href + '">' + esc(e.name) + "</a></span></td>" +
    /* A row with no segment columns is not a failure: the imported file simply had none, which is
       a legitimate nothing rather than data somebody owes. */
    '<td><span class="tgt-seg">' + (seg || mNil("لا شرائح مستوردة", "none")) + "</span></td>" +
    '<td><bdi class="tgt-ltr">+' + esc(e.phone) + "</bdi></td>" +
    '<td><span class="tgt-st"><span class="d" style="background:' + st.dot + '"></span>' + st.label + "</span></td>" +
    /* Two row actions, and the constructive one comes first. «فرصة +» is the answer to «I onboarded
       leads, I called one, now what» — the act belongs on the lead, not on a form three screens
       away that makes you retype its name. Nothing here writes on one click: it opens a prefilled
       form the operator still submits.
       The delete is hold-to-confirm (DESIGN.md §8.5): the gesture IS the confirmation and
       releasing early is the undo. Keyboard still arms in two steps. */
    '<td><span class="tgt-act">' +
      (tgtMayOpenOpp()
        ? '<button type="button" class="m-btn" title="تسجيل فرصة بيع للجهة" onclick="opFromEntity(' + e.id + ')">فرصة +</button>' : "") +
      (tgtMayEdit()
        ? '<button class="rv-hold rv-hold-sm" data-do="entDel" data-arg="' + e.id + '"' +
          ' data-idle="حذف" data-holding="استمر…" data-armed="اضغط مرة أخرى" aria-pressed="false"' +
          ' title="حذف الجهة بالضغط المطوّل">' +
          '<span class="rv-fill"></span><span class="rv-lbl">حذف</span></button>' : "") +
    "</span></td></tr>";
}

/* The manual-entry disclosure. Its ROWS are dashboard.ts's manualRowsHtml() and still wear .inp —
   that file is under ADR-0001 and is not range-edited from here. */
function tgtImportBox() {
  return '<details class="tgt-import" id="manualbox"' + (manualOpen ? " open" : "") + ' ontoggle="manualOpen=this.open">' +
    "<summary>إضافة جهة يدويًا أو لصق قائمة</summary>" +
    '<p class="m-meta">الاسم والجوال مطلوبان · كل عمود إضافي (المدينة، الحجم…) يصبح شريحة استهداف · أرقام 05 تتحول إلى 966</p>' +
    '<div id="manualrows">' + manualRowsHtml() + "</div>" +
    '<div class="row">' +
    '<button type="button" class="m-btn m-btn--primary" onclick="entManualSave()">حفظ الجهات &#8592;</button>' +
    '<button type="button" class="m-btn" onclick="entAddRow()">+ صف آخر</button>' +
    '<span id="entstat">' + manualStat + '</span><span style="flex:1"></span>' +
    '<button type="button" class="m-btn" onclick="entTogglePaste()">أو الصق قائمة جاهزة</button></div>' +
    '<div id="pastebox" style="display:none" class="row">' +
    '<p class="m-meta">سطر لكل جهة: <b>الاسم، الجوال، الحجم، المدينة</b></p>' +
    '<textarea id="entpaste" rows="4" placeholder="مجمع النور الطبي، 966512345678، كبيرة، الرياض"></textarea>' +
    '<button type="button" class="m-btn" onclick="entImport()">استيراد الملصق &#8592;</button></div>' +
    "</details>";
}

/* customers.edit — a role that may read the audience book imports nothing into it and tags nothing. */
function tgtMayEdit() { return typeof meCan !== "function" || meCan("customers.edit"); }
function tgtMayOpenOpp() { return typeof meCan !== "function" || meCan("opps.edit"); }
function vTargetsCrm() {
  setTimeout(tgtPaintCrumb, 0);
  tgtBind();
  var h = '<div class="ds6"><input id="entfile" type="file" accept=".xlsx,.xls,.csv" style="display:none" onchange="entFileUpload(this)">';
  if (!entities.length) {
    /* The importer instructions live HERE, where the screen has nothing else to say, instead of
       above a list of sixteen rows that already proved the format works. */
    return h + (tgtMayEdit()
      ? '<div class="m-tools tgt-tools"><span></span><div class="m-head__a">' +
        '<a href="/assets/audience-template.xlsx" download class="m-btn">القالب الجاهز</a>' +
        '<button type="button" class="m-btn m-btn--primary" onclick="entFilePick()">رفع ملف Excel/CSV</button></div></div>'
      : "") +
      '<div id="entfstat">' + entImportSummary + "</div>" +
      '<section class="m-card m-empty"><p class="m-empty__t">لا جهات في قائمتك بعد</p>' +
      '<p class="m-empty__d">ارفع ملفك كما هو: عمود اسم + عمود جوال. كل عمود إضافي — المدينة، الحجم، القطاع — يصبح شريحة استهداف تختار بها في «إنشاء حملة». التكرار يُحدَّث ولا يُضاعف، وأرقام 05 تتحول إلى 966 تلقائيًا.</p></section>' +
      (tgtMayEdit() ? tgtImportBox() : "") + "</div>";
  }
  var rows = tgtMatches();
  var shown = pageSlice("tgt", rows);
  h += tgtFacetBar();
  h += '<div id="entfstat">' + entImportSummary + "</div>";
  if (tgtMayEdit()) h += tgtImportBox();
  var allOn = shown.length > 0 && shown.every(function (e) { return tgtSel[e.id]; });
  h += '<section class="m-card m-card--pad0 tgt-tbl"><div class="m-tablewrap">' +
    '<table class="m-table m-table--sticky">' + tgtHeader(allOn) + "<tbody>";
  shown.forEach(function (e) { h += tgtRow(e); });
  if (!shown.length) {
    h += '<tr class="m-table__empty"><td colspan="6"><div class="m-empty">' +
      '<p class="m-empty__t">لا جهة تطابق هذا الفرز</p>' +
      '<p class="m-empty__d">يمكن مسح البحث أو تغيير إحدى الشرائح.</p></div></td></tr>';
  }
  h += '</tbody></table></div><div class="m-foot">' +
    dsPageBar("tgt", rows.length, tgtNoun(rows.length), "tgtShown") +
    '<span class="m-cap">' + ic("users", 14) + " من أصل " + dsFig("tgtAll", entities.length) + " في قائمتك</span></div></section>";
  if (tgtMayEdit()) h += tgtBulkBar();
  h += tgtTagsPanel();
  return h + "</div>";
}

/* «وسم كمرشّح» — the whole point of this screen for someone building a target list by hand. It
   writes the OPERATOR dimension (entities.productTags) and nothing else: not the account's facts,
   not the assistant's reading. Those two have their own writers and neither of them is a decision.
   NOTHING HERE SENDS A MESSAGE — the only call is a label write. */
function tgtBulkBar() {
  var ids = tgtSelIds();
  if (!ids.length) return "";
  var tags = tagList();
  if (!tags.length) {
    /* No vocabulary yet. Offering an empty dropdown and a live «وسم» button is a control that can
       only fail; the bar says what is missing and where to fix it. */
    return '<div class="bulkbar"><div>' +
      '<span class="cnt">' + mN(ids.length) + " محدَّدة</span>" +
      "<span>لا وسوم بعد.</span>" +
      '<button class="pri" onclick="tgtOpenTags()">أنشئ أول وسم</button>' +
      '<button class="x" aria-label="إلغاء التحديد" onclick="tgtClearSel()">&#215;</button></div></div>';
  }
  return '<div class="bulkbar"><div>' +
    '<span class="cnt">' + mN(ids.length) + " محدَّدة</span>" +
    '<select id="tgtagsel" aria-label="الوسم">' +
    tags.map(function (t) { return '<option value="' + esc(t.name) + '">' + esc(clip(t.name, 30)) + "</option>"; }).join("") +
    "</select>" +
    '<button class="pri"' + (tgtTagBusy ? " disabled" : "") + ' onclick="tgtTag(true)">' +
      (tgtTagBusy ? "جارٍ…" : "وسم") + "</button>" +
    '<button' + (tgtTagBusy ? " disabled" : "") + ' onclick="tgtTag(false)">إزالة الوسم</button>' +
    '<button onclick="tgtOpenTags()">إدارة الوسوم</button>' +
    /* The bulk half of «فرصة +», and it reads the SAME service select the tagging uses. A second
       dropdown sat beside the first looking identical, and no reader could tell which act it
       governed — but the deeper point is that it was never a second question: «مرشّح لـ فحص
       الموظفين» is the decision to approach them about that service, and opening a deal on it is
       the next step in the same sentence. One service chosen, two acts on it.
       The row action opens a FORM because one deal has a price and a next step worth typing; N
       deals do not — what you know after working a list is «these eleven are live on فحص
       الموظفين», and the money comes later, one card at a time. So each line opens UNPRICED at
       «تواصل أولي», the same shape the assistant's own auto-created lines take, which is why the
       board needs no new vocabulary to show them.
       opps.edit, not customers.edit: the product manager may tag this book and may not open deals
       in it, and the per-row «فرصة +» is gated the same way. */
    (tgtMayOpenOpp()
      ? '<button' + (tgtOppBusy ? " disabled" : "") + ' onclick="tgtBulkOpp()" ' +
        'title="فرصة بالخدمة المختارة لكل جهة محدَّدة">' +
        (tgtOppBusy ? "جارٍ…" : "افتح فرصة") + "</button>"
      : "") +
    '<button class="x" aria-label="إلغاء التحديد" onclick="tgtClearSel()">&#215;</button></div></div>';
}

/* إدارة الوسوم — create, rename, delete, with the count each one carries.
   Rename and delete exist because near-duplicates WILL be created («عيادات الأسنان» beside
   «عيادات أسنان»), and without a way out the only remedy is retagging by hand. Both are single
   transactions on the server across the registry and every account. */
function tgtTagsPanel() {
  if (!tgtTagsOpen) return "";
  var tags = tagList();
  return '<div class="tgt-sheet" onclick="if(event.target===this) tgtCloseTags()"><div class="tgt-sheet__p" role="dialog" aria-modal="true" aria-labelledby="tgtagt">' +
    '<div class="m-between"><h2 class="m-h2" id="tgtagt">إدارة الوسوم</h2>' +
    '<button type="button" class="m-x" onclick="tgtCloseTags()" aria-label="إغلاق">&#215;</button></div>' +
    '<p class="m-meta">تختار اسم الوسم: خدمة، خط منتجات قسم آخر، أو فعالية؛ يُنشأ مرة ثم يُختار.</p>' +
    '<div class="tgt-sheet__mk"><input id="tgnew" class="m-input" maxlength="60" placeholder="اسم الوسم الجديد…" aria-label="اسم الوسم الجديد" ' +
      'onkeydown="if(event.key===&quot;Enter&quot;) tgtCreateTag()">' +
      '<button type="button" class="m-btn m-btn--primary" onclick="tgtCreateTag()">أضف</button></div>' +
    (tags.length
      ? '<div class="tgt-sheet__l">' + tags.map(function (t) {
          /* esc(), not a hand-rolled quote swap. JSON.stringify escapes the quote and the backslash
             but leaves & alone, so a tag literally named with an &quot; entity came back through
             the HTML parser as a real quote and broke out of the JS string. esc() escapes & first,
             which closes it. */
          var q = esc(JSON.stringify(t.name));
          /* Renaming happens IN the row and deleting arms before it fires — the same two-step this
             screen already uses on a row, and no browser dialog anywhere. */
          if (tgtTagEdit === t.name) {
            return '<div class="tgt-trow"><input id="tgedit" class="m-input" maxlength="60" value="' + esc(t.name) + '" aria-label="الاسم الجديد" ' +
              'onkeydown="if(event.key===&quot;Enter&quot;) tgtRenameSave(' + q + '); if(event.key===&quot;Escape&quot;) tgtRenameCancel()">' +
              '<button type="button" class="m-btn m-btn--primary" onclick="tgtRenameSave(' + q + ')">حفظ</button>' +
              '<button type="button" class="m-btn" onclick="tgtRenameCancel()">إلغاء</button></div>';
          }
          if (tgtTagArm === t.name) {
            return '<div class="tgt-trow"><span class="nm">' + esc(t.name) + "</span>" +
              '<span class="m-cap">' + (t.count
                ? "سيُزال عن " + mPl(t.count, "جهة واحدة", "جهتين", "جهات", "جهة")
                : mNil("بلا جهات", "none")) + "</span>" +
              '<button type="button" class="m-btn danger" onclick="tgtDeleteTag(' + q + ')">تأكيد الحذف</button>' +
              '<button type="button" class="m-btn" onclick="tgtArmTag(&quot;&quot;)">تراجع</button></div>';
          }
          return '<div class="tgt-trow"><span class="nm">' + esc(t.name) + "</span>" +
            '<span class="m-cap">' + (t.count
              ? mPl(t.count, "جهة واحدة", "جهتان", "جهات", "جهة")
              : mNil("بلا جهات", "none")) + "</span>" +
            '<button type="button" class="m-btn" onclick="tgtEditTag(' + q + ')">إعادة تسمية</button>' +
            '<button type="button" class="m-btn danger" onclick="tgtArmTag(' + q + ')">حذف</button></div>';
        }).join("") + "</div>"
      : '<p class="m-meta">لا وسوم بعد.</p>') +
    "</div></div>";
}

function tgtPaintCrumb() {
  var ps = document.getElementById("ps"), act = document.getElementById("crumbact");
  if (ps) ps.textContent = fmtN(entities.length) + " جهة";
  if (act) act.innerHTML = "";
}

window.tgtArmDel = function (id) { tgtArm = id; render(false); };
window.tgtSetProd = function (v) { tgtProd = v; render(false); };
window.tgtToggle = function (id) { if (tgtSel[id]) delete tgtSel[id]; else tgtSel[id] = true; render(false); };
window.tgtClearSel = function () { tgtSel = {}; render(false); };
window.tgtTogglePage = function () {
  var shown = pageSlice("tgt", tgtMatches());
  var allOn = shown.length > 0 && shown.every(function (e) { return tgtSel[e.id]; });
  shown.forEach(function (e) { if (allOn) delete tgtSel[e.id]; else tgtSel[e.id] = true; });
  render(false);
};
window.tgtOpenTags = function () { tgtTagsOpen = true; render(false);
  setTimeout(function () { var el = document.getElementById("tgnew"); if (el) el.focus(); }, 0); };
window.tgtCloseTags = function () { tgtTagsOpen = false; render(false); };

/* Every registry write re-reads the registry from the server before repainting. The alternative —
   mirroring locally — is how a vocabulary drifts from the one the write path validates against, and
   this is the one screen where that divergence is invisible until a tag silently stops applying. */
function tagPost(path, body, done) {
  return fetch("/admin/tags" + path, { method: "POST",
    headers: { "x-admin-token": TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(body) })
    .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
    .then(function (res) {
      if (!res.ok) { alertBar("تعذّر: " + esc(String(res.j.error || "")), true); return null; }
      return fetch("/admin/tags", { headers: { "x-admin-token": TOKEN } })
        .then(function (r) { return r.json(); })
        .then(function (list) { tagReg = list; if (done) done(res.j); render(false); return res.j; });
    })
    .catch(function () { alertBar("تعذّر الاتصال.", true); return null; });
}

window.tgtCreateTag = function () {
  var el = document.getElementById("tgnew");
  var name = el ? el.value.trim() : "";
  if (!name) return;
  tagPost("", { name: name }, function (j) {
    var e2 = document.getElementById("tgnew"); if (e2) e2.value = "";
    alertBar(j.created ? "أُضيف الوسم «" + j.name + "»" : "«" + j.name + "» موجود مسبقًا");
  });
};

window.tgtEditTag = function (name) { tgtTagEdit = name; tgtTagArm = ""; render(false);
  setTimeout(function () { var el = document.getElementById("tgedit"); if (el) { el.focus(); el.select(); } }, 0); };
window.tgtRenameCancel = function () { tgtTagEdit = ""; render(false); };
window.tgtArmTag = function (name) { tgtTagArm = name; tgtTagEdit = ""; render(false); };

window.tgtRenameSave = function (from) {
  var el = document.getElementById("tgedit");
  var to = el ? el.value.trim() : "";
  if (!to || to === from) { tgtTagEdit = ""; render(false); return; }
  tgtTagEdit = "";
  tagPost("/rename", { from: from, to: to }, function () {
    /* Mirror onto the accounts already loaded so the list and the filter agree before the next
       full refresh — the server moved both stores in one transaction. */
    entities.forEach(function (e) {
      var t = e.productTags || [];
      if (t.indexOf(from) < 0) return;
      e.productTags = t.map(function (x) { return x === from ? to : x; })
        .filter(function (x, i, a) { return a.indexOf(x) === i; });
    });
    if (prodFilter.candidate === from) prodFilter.candidate = to;
    if (tgtProd === from) tgtProd = to;
    alertBar("أُعيدت التسمية إلى «" + to + "»");
  });
};

window.tgtDeleteTag = function (name) {
  tgtTagArm = "";
  tagPost("/delete", { name: name }, function (j) {
    entities.forEach(function (e) {
      var t = e.productTags || [];
      if (t.indexOf(name) >= 0) e.productTags = t.filter(function (x) { return x !== name; });
    });
    if (prodFilter.candidate === name) prodFilter.candidate = "";
    if (tgtProd === name) tgtProd = "";
    alertBar("حُذف الوسم · أُزيل عن " + fmtN(j.cleared) + " جهة");
  });
};

window.tgtTag = function (add) {
  var ids = tgtSelIds();
  var el = document.getElementById("tgtagsel");
  var product = el ? el.value : "";
  if (!ids.length || !product || tgtTagBusy) return;
  tgtTagBusy = true; render(false);
  fetch("/admin/entities/tag", { method: "POST",
    headers: { "x-admin-token": TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({ ids: ids, product: product, add: add }) })
    .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
    .then(function (res) {
      if (!res.ok) { alertBar("تعذّر الوسم: " + esc(String(res.j.error || "")), true); return; }
      /* Mirror locally on the SAME string the server stored, so the filter that reads the tag back
         and the row that displays it cannot disagree until the next fetch. */
      entities.forEach(function (e) {
        if (ids.indexOf(e.id) < 0) return;
        var t = (e.productTags || []).filter(function (x) { return x !== product; });
        if (add) t.push(product);
        e.productTags = t;
      });
      tgtSel = {};
      alertBar((add ? "وُسمت " : "أُزيل الوسم عن ") + fmtN(res.j.updated) + " جهة · " + product);
    })
    .catch(function () { alertBar("تعذّر الوسم — تحقّق من الاتصال.", true); })
    .finally(function () { tgtTagBusy = false; render(false); });
};
/* افتح فرصة للمحدَّد — N accounts, one service, one line each.
 *
 * N calls through the SAME endpoint a single create uses, never a bulk server path that could
 * validate differently from the one a lone row goes through. It is slower and it is correct: one
 * definition of what an opportunity may be.
 *
 * IT SKIPS WHAT ALREADY EXISTS. Opening a second line on the same (account, service) while the
 * first is still live is the fastest way to make a pipeline total lie — the same deal counted
 * twice. The skip is reported, not silent, because a bar that says «فُتحت 11» when it opened 7 is
 * the invented-number defect this product keeps paying for.
 *
 * oppRows may be null here: #targets never loads the board. It is fetched first rather than
 * assumed empty, because assuming empty is exactly how the duplicate check would pass by doing
 * nothing.
 */
window.tgtBulkOpp = async function () {
  var ids = tgtSelIds();
  var el = document.getElementById("tgtagsel");   /* ONE select governs both acts — see tgtBulkBar */
  var product = el ? el.value : "";
  if (!ids.length || !product || tgtOppBusy) return;
  tgtOppBusy = true; render(false);
  try {
    if (oppRows === null) {
      var lr = await fetch("/admin/opps", { headers: { "x-admin-token": TOKEN } });
      oppRows = lr.ok ? (await lr.json()).opps || [] : [];
    }
    var livePairs = {};
    oppRows.forEach(function (o) {
      if (o.phone && !opIsLost(o) && !opIsWon(o)) livePairs[o.phone + "|" + o.product] = 1;
    });
    var made = 0, skipped = 0, failed = 0, fresh = [];
    for (var i = 0; i < ids.length; i++) {
      var e = entities.find(function (x) { return x.id === ids[i]; });
      if (!e) { failed++; continue; }
      if (livePairs[e.phone + "|" + product]) { skipped++; continue; }
      try {
        var r = await fetch("/admin/opps", { method: "POST",
          headers: { "x-admin-token": TOKEN, "Content-Type": "application/json" },
          body: JSON.stringify({ account_name: e.name, phone: e.phone, source: "call",
            lines: [{ product: product, sale_price: 0, years: 1, qty: 1 }] }) });
        var j = await r.json();
        if (r.ok && j.ok) { made++; fresh = fresh.concat(j.opps || []); }
        else failed++;
      } catch (err) { failed++; }
    }
    oppRows = fresh.concat(oppRows);
    tgtSel = {};
    /* Every outcome is named. A silent skip and a silent failure are indistinguishable from
       success to the person reading the bar. */
    var msg = "فُتحت " + opPl(made, "فرصة واحدة", "فرصتان", "فرص", "فرصة") + " · " + product;
    if (skipped) msg += " · تُخطّيت " + fmtN(skipped) + " لوجود فرصة قائمة بالخدمة نفسها";
    if (failed) msg += " · تعذّرت " + fmtN(failed);
    alertBar(msg, failed > 0);
  } catch (e2) {
    alertBar("تعذّر فتح الفرص — تحقّق من الاتصال.", true);
  } finally {
    tgtOppBusy = false; render(false);
  }
};
window.tgtSearch = function (el) { tgtQ = el.value; clearTimeout(window.__tq); window.__tq = setTimeout(function () { render(false); }, 250); };
/* Indexes only in the attribute string — Arabic keys stay out of onchange, and both sides re-derive
   the same ordering from segGroups(), exactly as entSetAttr does for the wizard. */
window.tgtSetAttr = function (ki, vi) {
  var g = segGroups()[ki]; if (!g) return;
  tgtFilters[g.key] = vi < 0 ? "" : (g.values[vi] ? g.values[vi][0] : "");
  render(false);
};
/* ========================= end targets-crm (client) ========================= */
`;
