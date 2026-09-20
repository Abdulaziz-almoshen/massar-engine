// org-crm.ts — «الهيكل التنظيمي»: the sectors, the departments and the people, on one screen.
//
// This route existed as a «قريبًا» placeholder. The founder's prototype puts a real screen here and
// the data has been in the ledger for two cycles — sectors from the product catalogue, departments
// and the team directory from «إعدادات النظام». What was missing was the ROLL-UP: who owns what,
// how many products sit under each sector, and where a person fits.
//
// It is a READING, not a second editor. Every row hands the writing back to the screen that owns it
// («الأقسام» and «الفريق») rather than opening a fourth place to change the same row, because two
// editors over one table is how a product starts disagreeing with itself.
//
// PORTED to the new design system (docs/PORT-SPEC.md): the body is wrapped in .ds6 and drawn in the
// m-* vocabulary — m-kpis tiles, an m-seg for the three views, real m-table tables inside m-tablewrap,
// m-chip for state, m-link for the hand-offs. Every figure goes through .m-n; the three counts that
// print twice (tile and tab badge) are bound with dsD/dsFig so they cannot drift; every empty cell
// carries one of the three absence kinds rather than a bare dash.
//
// No backticks in this file (gate: check-crm-literals).

export const ORG_CRM_CSS = `
/* What the vocabulary does not carry: this screen's own stacking, the tab row, and the column
   widths of its three tables. Everything else is m-*. */
.ds6 .og { display:flex; flex-direction:column; gap:var(--m-4); }
.ds6 .og-bar { display:flex; align-items:center; gap:var(--m-2); flex-wrap:wrap; }
.ds6 .og-sp { flex:1; }
/* A table keeps its columns and the WRAP scrolls, never the page (PORT-SPEC 2). */
.ds6 .og-tbl { min-inline-size: 640px; }
.ds6 .og-tbl th.num, .ds6 .og-tbl td.num { text-align:end; }
.ds6 .og-sub { display:block; font-size:var(--m-t-cap); color:var(--m-mut); }
@media (max-width: 1100px) { .ds6 .m-kpis { grid-template-columns:repeat(2, minmax(0,1fr)); } }
`;

export const ORG_CRM_JS = `
var ogTab = "sectors";
window.ogSetTab = function (t) { if (ogTab === t) return; ogTab = t; render(false); };

/* Every digit on this screen goes through .m-n: direction ltr, isolated, tabular. */
function ogN(v) { return '<span class="m-n">' + fmtN(v) + "</span>"; }
/* kind: owed (a number someone owes), unset (a classification nobody made), none (a legitimate
   nothing). Three treatments, because six grey dashes read as one state repeated. */
function ogNil(t, kind) { return '<span class="m-td-nil m-nil--' + (kind || "none") + '">' + esc(t) + "</span>"; }
/* Arabic counts are four-way, never n + noun. opPl carries the business tier's rule. */
function ogPl(n, one, two, few, many) {
  return (typeof opPl === "function") ? opPl(n, one, two, few, many) : (fmtN(n) + " " + many);
}
function ogNSector(n) { return ogPl(n, "قطاع واحد", "قطاعان", "قطاعات", "قطاعًا"); }
function ogNDiv(n) { return ogPl(n, "إدارة واحدة", "إدارتان", "إدارات", "إدارة"); }
function ogNMember(n) { return ogPl(n, "عضو واحد", "عضوان", "أعضاء", "عضوًا"); }

function ogSectors() {
  var rows = (typeof pcSectors !== "undefined" && pcSectors && pcSectors.sectors) || [];
  return rows.filter(function (s) { return !s.isUnclassified; });
}
function ogDivs() { return (typeof cfDivs !== "undefined" && cfDivs) || []; }
function ogTeam() { return (typeof cfTeam !== "undefined" && cfTeam) || []; }
function ogCat() { return (typeof pcCat !== "undefined" && pcCat) || []; }
function ogDivisionsOf(sector) {
  /* A department belongs to a sector through the products it owns — the ledger links product → sector
     and product → division, and nothing links a division to a sector directly. Deriving it here keeps
     that single source rather than inventing a second one. */
  var names = {};
  ogCat().forEach(function (p) {
    if (p.sector === sector && p.division) names[p.division] = 1;
  });
  return Object.keys(names);
}

/* Each of these three counts prints in two places — the tile and the tab badge. Bound here, so a
   disagreement is a console error on the founder's own screen rather than something the next
   reviewer has to notice (PORT-SPEC 6). */
function ogBind() {
  dsD("ogSecs", function () { return ogSectors().length; });
  dsD("ogDivs", function () { return ogDivs().length; });
  dsD("ogTeam", function () { return ogTeam().length; });
  dsD("ogProds", function () { return ogCat().length; });
}

function vOrg() {
  if (typeof pcLoad === "function") pcLoad(false);
  if (typeof cfLoad === "function") cfLoad(false);
  ogBind();
  var secs = ogSectors();
  var divs = ogDivs();
  var team = ogTeam();
  var cat = ogCat();
  var loading = (typeof pcCat === "undefined" || !pcCat) || (typeof cfStages === "undefined" || !cfStages);
  var h = '<div class="ds6"><div class="og">';

  var tile = function (key, label, n, sub) {
    return '<div class="m-card"><div class="m-stat__k">' + label + "</div>" +
      '<div class="m-stat__v">' + dsFig(key, n) + "</div>" +
      '<div class="m-stat__s">' + sub + "</div></div>";
  };
  var off = divs.filter(function (d) { return d.active === false; }).length;
  var live = team.filter(function (m) { return m.active; }).length;
  h += '<div class="m-kpis">' +
    tile("ogSecs", "القطاعات", secs.length, "من كتالوج المنتجات") +
    tile("ogDivs", "الإدارات", divs.length, off ? ogPl(off, "إدارة واحدة موقوفة", "إدارتان موقوفتان", "إدارات موقوفة", "إدارة موقوفة") : "كلها نشطة") +
    tile("ogTeam", "أعضاء الفريق", team.length, live ? ogPl(live, "عضو واحد نشط", "عضوان نشطان", "أعضاء نشطون", "عضوًا نشطًا") : "لا أحد نشط") +
    tile("ogProds", "المنتجات", cat.length, "مرتبطة بقطاعاتها وإداراتها") +
    "</div>";

  /* A segmented control, aria-pressed, exactly as the vocabulary declares it. */
  var tab = function (key, label, figKey, n) {
    return '<button type="button" aria-pressed="' + (ogTab === key) + '" onclick="ogSetTab(&quot;' + key + '&quot;)">' +
      label + " " + dsFig(figKey, n) + "</button>";
  };
  h += '<div class="og-bar"><div class="m-seg" role="group" aria-label="طريقة العرض">' +
    tab("sectors", "القطاعات", "ogSecs", secs.length) +
    tab("divisions", "الإدارات", "ogDivs", divs.length) +
    tab("members", "الموظفون", "ogTeam", team.length) + "</div>" +
    '<span class="og-sp"></span>' +
    '<a class="m-link" href="#divisions">إدارة الأقسام &#8592;</a>' +
    '<a class="m-link" href="#team">إدارة الفريق &#8592;</a></div>';

  if (loading) {
    return h + '<section class="m-card"><p class="m-body" aria-busy="true">جارٍ تحميل الهيكل…</p></section></div></div>';
  }

  var head = function (title, meta) {
    return '<header class="m-card__h"><div><h2 class="m-card__t">' + title + "</h2>" +
      '<p class="m-meta">' + meta + "</p></div></header>";
  };

  if (ogTab === "sectors") {
    h += '<section class="m-card m-card--pad0"><div style="padding:var(--m-5) var(--m-5) 0">' +
      head("القطاعات", ogNSector(secs.length)) + "</div>";
    if (!secs.length) {
      h += '<div class="m-empty"><p class="m-empty__t">لا قطاعات بعد</p>' +
        '<p class="m-empty__d">يُربط القطاع بالمنتج من سجل المنتج.</p></div>';
    } else {
      h += '<div class="m-tablewrap"><table class="m-table og-tbl"><thead><tr>' +
        "<th>القطاع</th><th>الإدارات</th><th class=\\"num\\">المنتجات</th><th class=\\"num\\">فرص مفتوحة</th><th></th>" +
        "</tr></thead><tbody>";
      secs.forEach(function (s) {
        var ds = ogDivisionsOf(s.sector);
        var open = Number(s.openCount) || 0;
        h += "<tr>" +
          '<td class="m-td-n">' + esc(s.sector) + "</td>" +
          "<td>" + (ds.length ? esc(ds.join("، ")) : ogNil("لم تُربط إدارة بعد", "unset")) + "</td>" +
          '<td class="m-td-v">' + ((s.products || []).length ? ogN((s.products || []).length) : ogNil("لا منتجات", "none")) + "</td>" +
          '<td class="m-td-v">' + (open ? ogN(open) : ogNil("لا فرص مفتوحة", "none")) + "</td>" +
          '<td><a class="m-link" href="#sector/' + encodeURIComponent(s.sector) + '">افتح &#8592;</a></td></tr>';
      });
      h += "</tbody></table></div>";
    }
    h += "</section>";
  } else if (ogTab === "divisions") {
    h += '<section class="m-card m-card--pad0"><div style="padding:var(--m-5) var(--m-5) 0">' +
      head("الإدارات", ogNDiv(divs.length)) + "</div>";
    if (!divs.length) {
      h += '<div class="m-empty"><p class="m-empty__t">لا أقسام بعد</p>' +
        '<p class="m-empty__d">القسم وحدة الشركة التي يتبعها المنتج ويعمل فيها عضو الفريق.</p>' +
        '<p class="m-empty__a"><a class="m-link" href="#divisions">أضف قسمًا من «الأقسام» &#8592;</a></p></div>';
    } else {
      h += '<div class="m-tablewrap"><table class="m-table og-tbl"><thead><tr>' +
        "<th>الإدارة</th><th>المسؤول</th><th class=\\"num\\">المنتجات</th><th class=\\"num\\">الأعضاء</th><th>الحالة</th><th></th>" +
        "</tr></thead><tbody>";
      divs.forEach(function (d) {
        h += "<tr>" +
          '<td class="m-td-n">' + esc(d.name) + "</td>" +
          "<td>" + (d.ownerName
            ? (esc(d.ownerName) + (d.ownerEmail ? '<span class="og-sub"><bdi>' + esc(d.ownerEmail) + "</bdi></span>" : ""))
            : ogNil("بلا مسؤول", "unset")) + "</td>" +
          '<td class="m-td-v">' + (d.products ? ogN(d.products) : ogNil("لا منتجات", "none")) + "</td>" +
          '<td class="m-td-v">' + (d.members ? ogN(d.members) : ogNil("لا أعضاء", "none")) + "</td>" +
          '<td><span class="m-chip' + (d.active === false ? "" : " m-chip--ok") + '">' + (d.active === false ? "موقوف" : "نشط") + "</span></td>" +
          '<td><a class="m-link" href="#divisions">تعديل &#8592;</a></td></tr>';
      });
      h += "</tbody></table></div>";
    }
    h += "</section>";
  } else {
    h += '<section class="m-card m-card--pad0"><div style="padding:var(--m-5) var(--m-5) 0">' +
      head("الموظفون", ogNMember(team.length)) + "</div>";
    if (!team.length) {
      h += '<div class="m-empty"><p class="m-empty__t">لا أعضاء بعد</p>' +
        '<p class="m-empty__d">التصعيد وطلب الدعم يحتاجان شخصًا مسجَّلًا ببريده.</p>' +
        '<p class="m-empty__a"><a class="m-link" href="#team">أضف عضوًا من «الفريق» &#8592;</a></p></div>';
    } else {
      h += '<div class="m-tablewrap"><table class="m-table og-tbl"><thead><tr>' +
        "<th>الاسم</th><th>البريد</th><th>الدور</th><th>الإدارة</th><th>الحالة</th><th></th>" +
        "</tr></thead><tbody>";
      team.forEach(function (m) {
        var role = (typeof TEAM_ROLE_LABELS !== "undefined" && TEAM_ROLE_LABELS[m.role]) || m.role || "";
        h += "<tr>" +
          '<td class="m-td-n">' + esc(m.name) + "</td>" +
          "<td>" + (m.email ? "<bdi>" + esc(m.email) + "</bdi>" : ogNil("لم يُسجَّل بريد", "owed")) + "</td>" +
          "<td>" + (role ? esc(role) : ogNil("لم يُحدَّد", "unset")) + "</td>" +
          "<td>" + (m.division ? esc(m.division) : ogNil("بلا إدارة", "unset")) + "</td>" +
          '<td><span class="m-chip' + (m.active ? " m-chip--ok" : "") + '">' + (m.active ? "نشط" : "موقوف") + "</span></td>" +
          '<td><a class="m-link" href="#team">تعديل &#8592;</a></td></tr>';
      });
      h += "</tbody></table></div>";
    }
    h += "</section>";
  }
  return h + "</div></div>";
}
`;
