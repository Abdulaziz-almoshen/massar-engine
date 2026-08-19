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
  .tgtflat .crow { grid-template-columns: 40px 1.9fr 2.4fr 1.1fr 1fr 52px; padding-inline:20px 12px; }
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
  /* إدارة الوسوم */
  .tagsheet { position:fixed; inset:0; z-index:140; background:rgba(23,23,23,.32);
    display:flex; align-items:flex-start; justify-content:center; padding:70px 20px; overflow-y:auto; }
  .tagsheet .sheet { background:#fff; border:1px solid #EDEDED; border-radius:14px; width:100%;
    max-width:520px; padding:20px; box-shadow:0 18px 48px rgba(16,24,40,.22); }
  .tagsheet .sh { display:flex; align-items:center; justify-content:space-between; gap:10px; }
  .tagsheet .sh .t { font-size:16px; font-weight:600; color:#171717; }
  .tagsheet .hint { font-size:12.5px; color:#7C7C7C; line-height:1.8; margin-top:6px; }
  .tagsheet .mk { display:flex; gap:8px; margin:14px 0 4px; }
  .tagsheet .mk input { flex:1; min-width:0; height:34px; }
  .tagsheet .tlist { margin-top:6px; max-height:52vh; overflow-y:auto; }
  .tagsheet .trow2 { display:flex; align-items:center; gap:8px; padding:10px 2px; border-top:1px solid #EDEDED; }
  .tagsheet .trow2 .nm { flex:1; min-width:0; font-size:13.5px; color:#171717;
    overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .tagsheet .trow2 .ct { font-size:12px; color:#999999; white-space:nowrap; font-variant-numeric:tabular-nums; }
  .tagsheet .trow2 .btn { height:28px; padding:0 9px; font-size:12px; }
  .tagsheet .trow2 .dngr:hover { color:#B42318; border-color:#F3C7C2; background:#FEF3F2; }
  @media (max-width: 939px) {
    .tgtflat .crow { grid-template-columns: 40px minmax(0,1fr) auto; row-gap:5px; column-gap:10px; padding:12px 16px; }
    .tgtflat .crow .selcell { grid-row:1 / 5; grid-column:1; align-self:center; }
    .tgtflat .crow .t-nm { grid-row:1; grid-column:2; }
    .tgtflat .crow .c-act { grid-row:1; grid-column:3; }
    .tgtflat .crow .t-st { grid-row:2; grid-column:2 / 4; }
    .tgtflat .crow .t-seg { grid-row:3; grid-column:2 / 4; flex-wrap:wrap; }
    .tgtflat .crow .t-ph { grid-row:4; grid-column:2 / 4; }
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
/* Selection lives here, keyed by id, and is INTERSECTED with the visible match on read — the same
   structural rule the reviewer forced on the campaigns list after a selection survived navigation
   and staged one campaign's phones under another campaign's name. */
var tgtSel = {};
var tgtTagBusy = false;
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
  h += '<button class="btn btn-ghost" onclick="tgtOpenTags()">الوسوم' +
    (tagList().length ? " (" + fmtN(tagList().length) + ")" : "") + "</button>";
  h += '<a href="/assets/audience-template.xlsx" download class="btn btn-ghost" style="text-decoration:none;">القالب الجاهز</a>';
  h += '<button class="btn btn-dark" onclick="entFilePick()">رفع ملف Excel/CSV</button>';
  h += "</div>";
  return h;
}

function tgtHeader(allOn) {
  return '<div class="crow thead-wide" style="padding:8px 20px 8px 12px;background:#fff;border-bottom:1px solid #EDEDED;font-size:12px;font-weight:500;color:#7C7C7C;">' +
    '<div class="selcell" style="opacity:1;"><input type="checkbox" aria-label="تحديد المعروض"' +
      (allOn ? " checked" : "") + ' onclick="tgtTogglePage()"></div>' +
    "<div>الجهة</div><div>الشرائح</div><div>الجوال</div><div>الحالة</div><div></div></div>" +
    '<div class="thead-narrow"><span class="selcell" style="opacity:1;"><input type="checkbox" aria-label="تحديد المعروض"' +
      (allOn ? " checked" : "") + ' onclick="tgtTogglePage()"></span><span>الجهة</span><span style="flex:1"></span><span>الحالة</span></div>';
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
  return '<div class="trow km krow crow' + (tgtSel[e.id] ? " sel" : "") + '" ' + open + ">" +
    '<div class="selcell" onclick="event.stopPropagation()"><input type="checkbox"' +
      (tgtSel[e.id] ? " checked" : "") + ' aria-label="تحديد ' + esc(e.name) + '" onclick="tgtToggle(' + e.id + ')"></div>' +
    '<div class="t-nm"><span class="av">' + esc(e.name.trim().charAt(0)) + "</span>" +
      '<span class="lb">' + esc(e.name) + "</span></div>" +
    '<div class="t-seg">' + (function () {
      var pc = prodChips(e);
      var budget = pc ? (pc.split("<span class=").length - 1 > 1 ? 1 : 2) : 3;
      return pc + attrChips(e, budget) || '<span style="color:#C7C7C7;font-size:12px;">—</span>';
    })() + "</div>" +
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
  var allOn = shown.length > 0 && shown.every(function (e) { return tgtSel[e.id]; });
  h += '<div class="tblwrap crmflat tgtflat rise"><div style="overflow-x:auto;" class="ms-scroll"><div class="crmgrid">' + tgtHeader(allOn);
  shown.forEach(function (e) { h += tgtRow(e); });
  if (!shown.length) {
    h += '<div style="padding:44px;text-align:center;color:#7C7C7C;font-size:13px;">لا جهة تطابق هذا الفرز.</div>';
  }
  h += '</div></div><div class="tfoot">' + pageBar("tgt", rows.length, "جهة") +
    '<span>' + ic("users", 14) + " من أصل " + fmtN(entities.length) + " في قائمتك</span></div></div>";
  h += tgtBulkBar();
  h += tgtTagsPanel();
  return h;
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
      '<span class="cnt">' + fmtN(ids.length) + " محدَّدة</span>" +
      '<span style="font-size:12.5px;">لا وسوم بعد.</span>' +
      '<button class="pri" onclick="tgtOpenTags()">أنشئ أول وسم</button>' +
      '<button class="x" aria-label="إلغاء التحديد" onclick="tgtClearSel()">×</button></div></div>';
  }
  return '<div class="bulkbar"><div>' +
    '<span class="cnt">' + fmtN(ids.length) + " محدَّدة</span>" +
    '<select id="tgtagsel" class="crmsel" style="height:32px;background:#fff;border-color:#fff;color:#171717;border-radius:999px;">' +
    tags.map(function (t) { return '<option value="' + esc(t.name) + '">' + esc(clip(t.name, 30)) + "</option>"; }).join("") +
    "</select>" +
    '<button class="pri"' + (tgtTagBusy ? " disabled" : "") + ' onclick="tgtTag(true)">' +
      (tgtTagBusy ? "جارٍ…" : "وسم") + "</button>" +
    '<button' + (tgtTagBusy ? " disabled" : "") + ' onclick="tgtTag(false)">إزالة الوسم</button>' +
    '<button onclick="tgtOpenTags()">إدارة الوسوم</button>' +
    '<button class="x" aria-label="إلغاء التحديد" onclick="tgtClearSel()">×</button></div></div>';
}

/* إدارة الوسوم — create, rename, delete, with the count each one carries.
   Rename and delete exist because near-duplicates WILL be created («عيادات الأسنان» beside
   «عيادات أسنان»), and without a way out the only remedy is retagging by hand. Both are single
   transactions on the server across the registry and every account. */
function tgtTagsPanel() {
  if (!tgtTagsOpen) return "";
  var tags = tagList();
  return '<div class="tagsheet" onclick="if(event.target===this) tgtCloseTags()"><div class="sheet">' +
    '<div class="sh"><span class="t">إدارة الوسوم</span>' +
    '<button class="btn btn-ghost" onclick="tgtCloseTags()">إغلاق</button></div>' +
    '<div class="hint">الوسم تسمّيه كما تشاء — خدمة، خط منتجات قسم آخر، أو فعالية. يُنشأ مرة، ثم يُختار.</div>' +
    '<div class="mk"><input id="tgnew" class="inp" maxlength="60" placeholder="اسم الوسم الجديد…" ' +
      'onkeydown="if(event.key===&quot;Enter&quot;) tgtCreateTag()">' +
      '<button class="btn btn-dark" onclick="tgtCreateTag()">أضف</button></div>' +
    (tags.length
      ? '<div class="tlist">' + tags.map(function (t) {
          var q = JSON.stringify(t.name).replace(/"/g, "&quot;");
          /* Renaming happens IN the row and deleting arms before it fires — the same two-step this
             screen already uses on a row, and no browser dialog anywhere. */
          if (tgtTagEdit === t.name) {
            return '<div class="trow2"><input id="tgedit" class="inp" maxlength="60" value="' + esc(t.name) + '" ' +
              'onkeydown="if(event.key===&quot;Enter&quot;) tgtRenameSave(' + q + '); if(event.key===&quot;Escape&quot;) tgtRenameCancel()">' +
              '<button class="btn btn-dark" onclick="tgtRenameSave(' + q + ')">حفظ</button>' +
              '<button class="btn btn-ghost" onclick="tgtRenameCancel()">إلغاء</button></div>';
          }
          if (tgtTagArm === t.name) {
            return '<div class="trow2"><span class="nm">' + esc(t.name) + "</span>" +
              '<span class="ct" style="color:#B42318;">' +
                (t.count ? "سيُزال عن " + fmtN(t.count) + " جهة" : "بلا جهات") + "</span>" +
              '<button class="btn btn-ghost dngr" style="border-color:#B42318;color:#B42318;" onclick="tgtDeleteTag(' + q + ')">تأكيد الحذف</button>' +
              '<button class="btn btn-ghost" onclick="tgtArmTag(&quot;&quot;)">تراجع</button></div>';
          }
          return '<div class="trow2"><span class="nm">' + esc(t.name) + "</span>" +
            '<span class="ct">' + (t.count ? fmtN(t.count) + " جهة" : "بلا جهات") + "</span>" +
            '<button class="btn btn-ghost" onclick="tgtEditTag(' + q + ')">إعادة تسمية</button>' +
            '<button class="btn btn-ghost dngr" onclick="tgtArmTag(' + q + ')">حذف</button></div>';
        }).join("") + "</div>"
      : '<div class="hint" style="padding:18px 0;">لا وسوم بعد.</div>') +
    "</div></div>";
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
