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
// No backticks in this file (gate: check-crm-literals).

export const ORG_CRM_CSS = `
.og { display:flex; flex-direction:column; gap:var(--s4); }
.og-tiles { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:var(--s3); }
.og-tile { background:var(--paper); border:1px solid var(--line); border-radius:var(--r-lg); padding:var(--s4);
  display:flex; flex-direction:column; gap:4px; min-width:0; }
.og-tile .l { font-size:var(--t-xs); color:var(--muted); }
.og-tile .n { font-size:var(--t-2xl); font-weight:600; color:var(--ink); font-variant-numeric:tabular-nums; line-height:1.15; }
.og-tile .s { font-size:var(--t-xs); color:var(--muted); }
.og-tile.lead .n { color:var(--accent-deep); }

.og-bar { display:flex; align-items:center; gap:var(--s2); flex-wrap:wrap; }
.og-tab { font-family:inherit; font-size:var(--t-sm); font-weight:500; color:var(--ink-2); background:var(--paper);
  border:1px solid var(--line); border-radius:var(--r-pill); padding:8px 16px; cursor:pointer; min-height:36px;
  transition:background var(--fast) var(--ease), color var(--fast) var(--ease), transform 160ms var(--ease); }
.og-tab .n { font-variant-numeric:tabular-nums; color:var(--muted); margin-inline-start:6px; }
.og-tab[aria-pressed="true"] { background:var(--accent-tint); color:var(--accent-deep); border-color:var(--accent-mark); }
.og-tab[aria-pressed="true"] .n { color:var(--accent-deep); }
@media (hover:hover) and (pointer:fine) { .og-tab:hover { background:var(--surface); } }
.og-tab:active { transform:scale(0.97); }
.og-sp { flex:1; }

.og-card { background:var(--paper); border:1px solid var(--line); border-radius:var(--r-lg); overflow:hidden; }
.og-hd { display:flex; align-items:center; gap:var(--s3); padding:var(--s3) var(--s4); border-bottom:1px solid var(--line-soft); }
.og-hd h3 { margin:0; font-size:var(--t-sm); font-weight:600; color:var(--ink); }
.og-hd .c { font-size:var(--t-xs); color:var(--muted); font-variant-numeric:tabular-nums; }
.og-row { display:grid; align-items:center; gap:var(--s3); padding:var(--s3) var(--s4); border-top:1px solid var(--line-soft);
  font-size:var(--t-sm); color:var(--ink); }
.og-row:first-of-type { border-top:0; }
.og-row.hdr { font-size:var(--t-xs); font-weight:600; color:var(--muted); background:var(--surface); border-top:0; }
.og-row .nm { font-weight:600; color:var(--ink); overflow-wrap:anywhere; }
.og-row .sub { font-size:var(--t-xs); color:var(--muted); }
.og-row .num { font-variant-numeric:tabular-nums; color:var(--ink-2); font-size:var(--t-xs); }
.og-row .mail { font-size:var(--t-xs); color:var(--muted); overflow-wrap:anywhere; }
.og-sec { grid-template-columns:minmax(0,1.4fr) minmax(0,1fr) 92px 92px auto; }
.og-div { grid-template-columns:minmax(0,1.3fr) minmax(0,1.2fr) 88px 88px 96px auto; }
.og-mem { grid-template-columns:minmax(0,1.2fr) minmax(0,1.2fr) minmax(0,1fr) minmax(0,1fr) 96px auto; }
.og-pill { display:inline-flex; align-items:center; font-size:var(--t-xs); font-weight:500; border-radius:var(--r-pill);
  padding:3px 10px; background:var(--surface-2); color:var(--ink-2); }
.og-pill.ok { background:var(--s-ok-soft, #E6F3EC); color:var(--s-ok-text, #12633F); }
.og-pill.off { background:var(--surface-2); color:var(--muted); }
.og-go { font-family:inherit; font-size:var(--t-xs); font-weight:500; color:var(--accent-deep); background:none; border:0;
  cursor:pointer; padding:6px 8px; border-radius:var(--r-sm); text-decoration:none; white-space:nowrap; }
@media (hover:hover) and (pointer:fine) { .og-go:hover { background:var(--accent-bar-hover); } }
.og-go:active { transform:scale(0.97); }
.og-state { padding:var(--s5) var(--s4); text-align:center; font-size:var(--t-sm); color:var(--muted); line-height:1.9; }

@media (max-width: 1100px) { .og-tiles { grid-template-columns:repeat(2, minmax(0,1fr)); } }
@media (max-width: 720px) {
  .og-sec, .og-div, .og-mem { grid-template-columns:minmax(0,1fr) auto; row-gap:4px; }
  .og-row.hdr { display:none; }
  .og-row .num, .og-row .mail { grid-column:1 / -1; }
}
@media (pointer: coarse) { .og-tab, .og-go { min-height:44px; } }
`;

export const ORG_CRM_JS = `
var ogTab = "sectors";
window.ogSetTab = function (t) { if (ogTab === t) return; ogTab = t; render(false); };

function ogSectors() {
  var rows = (typeof pcSectors !== "undefined" && pcSectors && pcSectors.sectors) || [];
  return rows.filter(function (s) { return !s.isUnclassified; });
}
function ogDivisionsOf(sector) {
  /* A department belongs to a sector through the products it owns — the ledger links product → sector
     and product → division, and nothing links a division to a sector directly. Deriving it here keeps
     that single source rather than inventing a second one. */
  var cat = (typeof pcCat !== "undefined" && pcCat) || [];
  var names = {};
  cat.forEach(function (p) {
    if (p.sector === sector && p.division) names[p.division] = 1;
  });
  return Object.keys(names);
}

function vOrg() {
  if (typeof pcLoad === "function") pcLoad(false);
  if (typeof cfLoad === "function") cfLoad(false);
  var secs = ogSectors();
  var divs = (typeof cfDivs !== "undefined" && cfDivs) || [];
  var team = (typeof cfTeam !== "undefined" && cfTeam) || [];
  var cat = (typeof pcCat !== "undefined" && pcCat) || [];
  var loading = (typeof pcCat === "undefined" || !pcCat) || (typeof cfStages === "undefined" || !cfStages);
  var h = '<div class="og">';

  var tile = function (cls, label, n, sub) {
    return '<div class="og-tile ' + cls + '"><span class="l">' + label + "</span>" +
      '<span class="n">' + fmtN(n) + "</span><span class=\\"s\\">" + sub + "</span></div>";
  };
  h += '<div class="og-tiles">' +
    tile("lead", "القطاعات", secs.length, "من كتالوج المنتجات") +
    tile("", "الإدارات", divs.length, divs.filter(function (d) { return d.active === false; }).length ? fmtN(divs.filter(function (d) { return d.active === false; }).length) + " موقوفة" : "كلها نشطة") +
    tile("", "أعضاء الفريق", team.length, team.filter(function (m) { return m.active; }).length ? fmtN(team.filter(function (m) { return m.active; }).length) + " نشط" : "لا أحد نشط") +
    tile("", "المنتجات", cat.length, "مرتبطة بقطاعاتها وإداراتها") +
    "</div>";

  var tab = function (key, label, n) {
    return '<button type="button" class="og-tab" aria-pressed="' + (ogTab === key) + '" onclick="ogSetTab(&quot;' + key + '&quot;)">' +
      label + '<span class="n">' + fmtN(n) + "</span></button>";
  };
  h += '<div class="og-bar">' + tab("sectors", "القطاعات", secs.length) + tab("divisions", "الإدارات", divs.length) +
    tab("members", "الموظفون", team.length) + '<span class="og-sp"></span>' +
    '<a class="og-go" href="#divisions">إدارة الأقسام ←</a><a class="og-go" href="#team">إدارة الفريق ←</a></div>';

  if (loading) return h + '<div class="og-card"><div class="og-state" aria-busy="true">جارٍ تحميل الهيكل…</div></div></div>';

  if (ogTab === "sectors") {
    h += '<div class="og-card"><div class="og-hd"><h3>القطاعات</h3><span class="c">' + fmtN(secs.length) + ' قطاع</span></div>';
    if (!secs.length) {
      h += '<div class="og-state">لا قطاعات بعد — يُربط القطاع بالمنتج من سجل المنتج.</div>';
    } else {
      h += '<div class="og-row og-sec hdr"><span>القطاع</span><span>الإدارات</span><span>المنتجات</span><span>فرص مفتوحة</span><span></span></div>';
      secs.forEach(function (s) {
        var ds = ogDivisionsOf(s.sector);
        h += '<div class="og-row og-sec"><span class="nm">' + esc(s.sector) + "</span>" +
          '<span class="sub">' + (ds.length ? esc(ds.join("، ")) : "لم تُربط إدارة بعد") + "</span>" +
          '<span class="num">' + fmtN((s.products || []).length) + "</span>" +
          '<span class="num">' + fmtN(s.openCount || 0) + "</span>" +
          '<a class="og-go" href="#sector/' + encodeURIComponent(s.sector) + '">افتح ←</a></div>';
      });
    }
    h += "</div>";
  } else if (ogTab === "divisions") {
    h += '<div class="og-card"><div class="og-hd"><h3>الإدارات</h3><span class="c">' + fmtN(divs.length) + ' إدارة</span></div>';
    if (!divs.length) {
      h += '<div class="og-state">لا أقسام بعد.<br><a class="og-go" href="#divisions">أضف قسمًا من «الأقسام» ←</a></div>';
    } else {
      h += '<div class="og-row og-div hdr"><span>الإدارة</span><span>المسؤول</span><span>المنتجات</span><span>الأعضاء</span><span>الحالة</span><span></span></div>';
      divs.forEach(function (d) {
        h += '<div class="og-row og-div"><span class="nm">' + esc(d.name) + "</span>" +
          '<span>' + (d.ownerName ? esc(d.ownerName) + (d.ownerEmail ? '<span class="mail">' + esc(d.ownerEmail) + "</span>" : "") : '<span class="sub">بلا مسؤول</span>') + "</span>" +
          '<span class="num">' + fmtN(d.products || 0) + "</span>" +
          '<span class="num">' + fmtN(d.members || 0) + "</span>" +
          '<span><span class="og-pill ' + (d.active === false ? "off" : "ok") + '">' + (d.active === false ? "موقوف" : "نشط") + "</span></span>" +
          '<a class="og-go" href="#divisions">تعديل ←</a></div>';
      });
    }
    h += "</div>";
  } else {
    h += '<div class="og-card"><div class="og-hd"><h3>الموظفون</h3><span class="c">' + fmtN(team.length) + ' عضو</span></div>';
    if (!team.length) {
      h += '<div class="og-state">لا أعضاء بعد — التصعيد وطلب الدعم يحتاجان شخصًا مسجَّلًا ببريده.<br><a class="og-go" href="#team">أضف عضوًا من «الفريق» ←</a></div>';
    } else {
      h += '<div class="og-row og-mem hdr"><span>الاسم</span><span>البريد</span><span>الدور</span><span>الإدارة</span><span>الحالة</span><span></span></div>';
      team.forEach(function (m) {
        h += '<div class="og-row og-mem"><span class="nm">' + esc(m.name) + "</span>" +
          '<span class="mail"><bdi>' + esc(m.email || "—") + "</bdi></span>" +
          '<span class="sub">' + esc((typeof TEAM_ROLE_LABELS !== "undefined" && TEAM_ROLE_LABELS[m.role]) || m.role || "—") + "</span>" +
          '<span class="sub">' + esc(m.division || "بلا إدارة") + "</span>" +
          '<span><span class="og-pill ' + (m.active ? "ok" : "off") + '">' + (m.active ? "نشط" : "موقوف") + "</span></span>" +
          '<a class="og-go" href="#team">تعديل ←</a></div>';
      });
    }
    h += "</div>";
  }
  return h + "</div>";
}
`;
