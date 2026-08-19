// targets-crm.ts — جهات الاستهداف, the imported book, on the Frappe list chrome.
//
// WHAT THIS REPLACES, and why each piece went:
//
// 1. «قائمة الصباح» sat on TOP of this screen — the third rendering of the same ranked list that
//    #home shows as «ما يستحق المتابعة الآن» and #customers shows as its تجميع-by-outcome view.
//    Three surfaces, three visual languages, one question. It is deleted here; #home owns it.
// 2. The list had NO header row, no sort, no facets and no count — while #customers and #kmon
//    beside it in the same sidebar had all four. It was the last un-migrated table in the product.
// 3. Every row carried an always-visible red «×» that deleted an imported target on ONE click with
//    no confirmation. Sixteen red buttons down the left edge of a screen you scroll. The action is
//    hover-revealed and neutral now, and asks once, inline, before it fires.
// 4. The importer was a full card ABOVE the list, so the subject of the page (your book) opened
//    below the fold under a block of instructions. It is two buttons on the control bar plus a
//    collapsed «إضافة جهة يدويًا»; the instructions moved into the empty state, where they are
//    read exactly when they are needed.
//
// Client JS in the dashboard.ts <script> scope (see campaigns-crm.ts for the seam). It borrows
// entities, segGroups, attrChips, contactByPhone, cusOutcome, esc,
// fmtN, fmtD, ic, LIST_CAP — and defines no statistic of its own.

export const TARGETS_CRM_CSS = `
  /* SIX cells, six tracks. Nothing here is display:contents, so cell count and track count are
     the same number in both directions — the arity bug class that wrapped three earlier tables. */
  .tgtflat .crow { grid-template-columns: 2.1fr 2fr 1.15fr 1.05fr 44px; padding-inline:20px 12px; }
  .tgtflat .crow .t-nm { display:flex; align-items:center; gap:10px; min-width:0; }
  .tgtflat .crow .t-nm .av { width:28px; height:28px; flex:none; border-radius:7px; background:#F3F3F3;
    color:#525252; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:500; }
  .tgtflat .crow .t-nm .lb { font-size:13.5px; font-weight:450; color:#171717; overflow:hidden;
    text-overflow:ellipsis; white-space:nowrap; }
  .tgtflat .crow .t-seg { display:flex; align-items:center; gap:5px; flex-wrap:nowrap; overflow:hidden; min-width:0; }
  .tgtflat .crow .t-ph { font-size:12.5px; color:#7C7C7C; direction:ltr; text-align:start; font-variant-numeric:tabular-nums; }
  .tgtflat .crow .t-st { display:flex; align-items:center; gap:7px; font-size:12.5px; color:#525252; min-width:0; }
  .tgtflat .crow .t-st .d { width:6px; height:6px; border-radius:999px; flex:none; }
  .tgtflat .crow .t-st .lb { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .tgtflat .crow .c-act { display:flex; justify-content:flex-end; }
  .tgtdel { font-family:inherit; font-size:12px; color:#7C7C7C; background:transparent; border:1px solid #EDEDED;
    border-radius:6px; height:26px; padding:0 8px; cursor:pointer; white-space:nowrap; }
  .tgtdel:hover { color:#B42318; border-color:#F3C7C2; background:#FEF3F2; }
  .tgtdel.arm { color:#B42318; border-color:#B42318; background:#FEF3F2; opacity:1 !important; }
  @media (max-width: 939px) {
    .tgtflat .crow { grid-template-columns: minmax(0,1fr) auto; row-gap:5px; column-gap:10px; padding:12px 16px; }
    .tgtflat .crow .t-nm { grid-row:1; grid-column:1; }
    .tgtflat .crow .c-act { grid-row:1; grid-column:2; }
    .tgtflat .crow .t-st { grid-row:2; grid-column:1 / 3; }
    .tgtflat .crow .t-seg { grid-row:3; grid-column:1 / 3; flex-wrap:wrap; }
    .tgtflat .crow .t-ph { grid-row:4; grid-column:1 / 3; }
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
function tgtMatches() {
  var q = tgtQ.trim();
  return entities.filter(function (e) {
    return Object.keys(tgtFilters).every(function (k) { return !tgtFilters[k] || ((e.attrs || {})[k] || "") === tgtFilters[k]; }) &&
      (!tgtProd || entUses(e, tgtProd)) &&
      (!q || e.name.includes(q) || e.phone.includes(q));
  });
}

/* Facets come from segGroups() — whatever columns the imported file actually carried. No facet is
   declared here, so a book without a «المدينة» column simply has no المدينة filter rather than an
   empty dropdown promising one. */
function tgtFacetBar() {
  var groups = segGroups();
  var h = '<div class="crmbar rise">';
  h += '<span style="position:relative;display:inline-flex;align-items:center;flex:1;min-width:190px;max-width:300px;">' +
    '<span style="position:absolute;inset-inline-start:13px;color:#999999;display:flex;">' + ic("search", 17) + '</span>' +
    '<input id="tq" class="inp" value="' + esc(tgtQ) + '" oninput="tgtSearch(this)" placeholder="ابحث بالاسم أو الرقم…" ' +
    'style="width:100%;padding-inline-start:40px;height:38px;border-radius:999px;font-size:12px;"></span>';
  groups.forEach(function (g, ki) {
    var on = Boolean(tgtFilters[g.key]);
    h += '<select class="crmsel' + (on ? " on" : "") + '" onchange="tgtSetAttr(' + ki + ', Number(this.value))"' +
      (on ? ' style="border-color:#3FB6B0;color:#2E7D77;background:#DCF1EF;"' : "") + '>' +
      '<option value="-1">' + esc(g.key) + ": الكل</option>" +
      g.values.map(function (v, vi) {
        return '<option value="' + vi + '"' + (tgtFilters[g.key] === v[0] ? " selected" : "") + '>' +
          esc(v[0]) + " (" + fmtN(v[1]) + ")</option>";
      }).join("") + "</select>";
  });
  var withProd = affinityProducts().filter(function (p) { return p.uses > 0 || p.name === tgtProd; });
  if (withProd.length) {
    h += '<select class="crmsel' + (tgtProd ? " on" : "") + '" onchange="tgtSetProd(this.value)"' +
      (tgtProd ? ' style="border-color:#3FB6B0;color:#2E7D77;background:#DCF1EF;"' : "") + '>' +
      '<option value="">الخدمة المستخدمة: الكل</option>' +
      withProd.map(function (p) {
        return '<option value="' + esc(p.name) + '"' + (tgtProd === p.name ? " selected" : "") + '>' +
          esc(clip(p.name, 26)) + " (" + fmtN(p.uses) + ")</option>";
      }).join("") + "</select>";
  }
  h += '<span style="flex:1"></span><span class="hair"></span>';
  h += '<a href="/assets/audience-template.xlsx" download class="btn btn-ghost" style="text-decoration:none;">القالب الجاهز</a>';
  h += '<button class="btn btn-dark" onclick="entFilePick()">رفع ملف Excel/CSV</button>';
  h += "</div>";
  return h;
}

function tgtHeader() {
  return '<div class="crow thead-wide" style="padding:8px 20px 8px 12px;background:#fff;border-bottom:1px solid #EDEDED;font-size:12px;font-weight:500;color:#7C7C7C;">' +
    "<div>الجهة</div><div>الشرائح</div><div>الجوال</div><div>الحالة</div><div></div></div>" +
    '<div class="thead-narrow"><span>الجهة</span><span style="flex:1"></span><span>الحالة</span></div>';
}

function tgtRow(e) {
  /* The state column reports what the ledger holds, in three cases only:
     a conversation exists -> its own outcome word (one table, cusOutcome, shared with #customers);
     no conversation       -> «لم تُراسل بعد», which is a fact about us, not about them;
     and nothing is ever inferred from the attributes. */
  var c = contactByPhone(e.phone);
  var st = c ? cusOutcome(c) : { label: "لم تُراسل بعد", dot: "#E2E2E2" };
  var armed = tgtArm === e.id;
  var open = c ? 'onclick="location.hash=&quot;customer/' + esc(e.phone) + '&quot;" style="cursor:pointer;"' : 'style="cursor:default;"';
  return '<div class="trow km crow" ' + open + ">" +
    '<div class="t-nm"><span class="av">' + esc(e.name.trim().charAt(0)) + "</span>" +
      '<span class="lb">' + esc(e.name) + "</span></div>" +
    '<div class="t-seg">' + (prodChips(e) + attrChips(e, 2) || '<span style="color:#C7C7C7;font-size:12px;">—</span>') + "</div>" +
    '<div class="t-ph">+' + esc(e.phone) + "</div>" +
    '<div class="t-st"><span class="d" style="background:' + st.dot + ';"></span><span class="lb">' + st.label + "</span></div>" +
    '<div class="c-act">' + (armed
      ? '<button class="tgtdel arm" onclick="event.stopPropagation();entDel(' + e.id + ')">تأكيد الحذف</button>' +
        '<button class="tgtdel" style="margin-inline-start:6px;" onclick="event.stopPropagation();tgtArmDel(0)">تراجع</button>'
      : '<button class="tgtdel" title="حذف الجهة" onclick="event.stopPropagation();tgtArmDel(' + e.id + ')">حذف</button>') + "</div>" +
    "</div>";
}

function tgtImportBox() {
  return '<details id="manualbox"' + (manualOpen ? " open" : "") + ' ontoggle="manualOpen=this.open" ' +
    'style="background:#fff;border:1px solid #EDEDED;border-radius:13px;padding:12px 16px;margin-bottom:14px;">' +
    '<summary style="font-size:12.5px;color:#525252;cursor:pointer;font-weight:500;">إضافة جهة يدويًا أو لصق قائمة</summary>' +
    '<div style="font-size:12px;color:#999999;margin:10px 0 12px;line-height:1.9;">الاسم والجوال مطلوبان · كل عمود إضافي (المدينة، الحجم…) يصبح شريحة استهداف · أرقام ٠٥ تتحول إلى ٩٦٦</div>' +
    '<div id="manualrows">' + manualRowsHtml() + "</div>" +
    '<div style="display:flex;align-items:center;gap:10px;margin-top:12px;flex-wrap:wrap;">' +
    '<button class="btn btn-dark" onclick="entManualSave()">حفظ الجهات ←</button>' +
    '<button class="btn btn-ghost" onclick="entAddRow()">+ صف آخر</button>' +
    '<span id="entstat">' + manualStat + '</span><span style="flex:1"></span>' +
    '<button class="btn btn-ghost" onclick="entTogglePaste()">أو الصق قائمة جاهزة</button></div>' +
    '<div id="pastebox" style="display:none;margin-top:12px;">' +
    '<div style="font-size:12px;color:#7C7C7C;margin-bottom:8px;line-height:1.9;">سطر لكل جهة: <b style="color:#171717;font-weight:500;">الاسم، الجوال، الحجم، المدينة</b></div>' +
    '<textarea id="entpaste" rows="4" placeholder="مجمع النور الطبي، 966512345678، كبيرة، الرياض" class="inp" style="width:100%;font-size:12.5px;line-height:2;resize:vertical;"></textarea>' +
    '<button class="btn btn-ghost" style="margin-top:10px;" onclick="entImport()">استيراد الملصق ←</button></div>' +
    "</details>";
}

function vTargetsCrm() {
  setTimeout(tgtPaintCrumb, 0);
  var h = '<input id="entfile" type="file" accept=".xlsx,.xls,.csv" style="display:none" onchange="entFileUpload(this)">';
  if (!entities.length) {
    /* The importer instructions live HERE, where the screen has nothing else to say, instead of
       above a list of sixteen rows that already proved the format works. */
    return h + '<div class="crmbar rise" style="justify-content:flex-end;">' +
      '<a href="/assets/audience-template.xlsx" download class="btn btn-ghost" style="text-decoration:none;">القالب الجاهز</a>' +
      '<button class="btn btn-dark" onclick="entFilePick()">رفع ملف Excel/CSV</button></div>' +
      '<div id="entfstat">' + entImportSummary + "</div>" +
      '<div class="empty" style="padding:56px 20px;"><div class="ic"><span></span></div>' +
      '<div class="t">لا جهات في قائمتك بعد</div>' +
      '<div class="s" style="line-height:2;">ارفع ملفك كما هو: عمود اسم + عمود جوال. كل عمود إضافي — المدينة، الحجم، القطاع — يصبح شريحة استهداف تختار بها في «إنشاء حملة». التكرار يُحدَّث ولا يُضاعف، وأرقام ٠٥ تتحول إلى ٩٦٦ تلقائيًا.</div></div>' +
      tgtImportBox();
  }
  var rows = tgtMatches();
  var shown = pageSlice("tgt", rows);
  h += tgtFacetBar();
  h += '<div id="entfstat">' + entImportSummary + "</div>";
  h += tgtImportBox();
  h += '<div class="tblwrap crmflat tgtflat rise"><div style="overflow-x:auto;" class="ms-scroll"><div class="crmgrid">' + tgtHeader();
  shown.forEach(function (e) { h += tgtRow(e); });
  if (!shown.length) {
    h += '<div style="padding:44px;text-align:center;color:#7C7C7C;font-size:13px;">لا جهة تطابق هذا الفرز.</div>';
  }
  h += '</div></div><div class="tfoot">' + pageBar("tgt", rows.length, "جهة") +
    '<span>' + ic("users", 14) + " من أصل " + fmtN(entities.length) + " في قائمتك</span></div></div>";
  return h;
}

function tgtPaintCrumb() {
  var ps = document.getElementById("ps"), act = document.getElementById("crumbact");
  if (ps) ps.textContent = fmtN(entities.length) + " جهة";
  if (act) act.innerHTML = "";
}

/* Deleting an imported target is irreversible and the row is one of sixteen on a scrolling page.
   Arming is a separate click on a separate button, and only one row can be armed at a time. */
window.tgtArmDel = function (id) { tgtArm = id; render(false); };
window.tgtSetProd = function (v) { tgtProd = v; render(false); };
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
