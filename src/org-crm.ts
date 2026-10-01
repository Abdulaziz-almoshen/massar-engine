// org-crm.ts — «إعدادات المنظمة»: segments, sectors, departments, employees and roles, and the
// hierarchy they make, on one screen (founder, 2026-10-01).
//
// It replaces the read-only «الهيكل التنظيمي» and the two tabs «الأقسام» / «الفريق» that edited the
// same rows somewhere else: one screen owns the organisation now, so there is one place to change it.
//
// WHAT IT DOES NOT DO. Products are created and edited in «المنتجات» only. This screen supplies the
// organisational data a product is assigned to (a department, and through it a sector and the two
// managers above it); the product record reads it, it never writes a product.
//
// Hierarchy (ServiceNow-shaped): Sector → Sector manager → Department → Department manager → Members.
// It is DERIVED by config-domain.buildOrgTree from the same three lists the tables print, never
// stored twice, and the two places a row can fall out of it — a department under no sector, a person
// in no department — are drawn, not dropped.
//
// Editing reuses «إعدادات النظام»'s one editor (cfEdit / cfInput / cfSelect / cfHold): same shape,
// same keyboard (Enter saves, Escape closes), same error line, the same rule on both sides of the wire.
//
// MOTION. None added. Tabs, the tree's disclosure and the editors are opened tens of times a day on
// an admin surface; the only movement is the vocabulary's own press feedback on buttons.
//
// No backticks in this file (gate: check-crm-literals).

export const ORG_CRM_CSS = `
.ds6 .oc { display:flex; flex-direction:column; gap:var(--m-4); }
.ds6 .oc-tbl { min-inline-size: 720px; }
.ds6 .oc-tbl th.num, .ds6 .oc-tbl td.num { text-align:end; }
.ds6 .oc-sub { display:block; font-size:var(--m-t-cap); color:var(--m-mut); }
.ds6 .oc-note { padding:var(--m-4) var(--m-5); margin:0; }

/* ---- the hierarchy ----
   A sector is a card; inside it, each level is indented on the inline-start side and hangs off a
   1px rail, so parent → child reads as a line you can follow, not as nesting depth you count. */
.ds6 .oc-tree { display:flex; flex-direction:column; gap:var(--m-3); }
.ds6 .oc-sec { padding:0; overflow:hidden; }
.ds6 .oc-sec > summary { list-style:none; cursor:pointer; display:flex; align-items:center; gap:var(--m-3);
  flex-wrap:wrap; padding:var(--m-4) var(--m-5); }
.ds6 .oc-sec > summary::-webkit-details-marker { display:none; }
.ds6 .oc-sec > summary:focus-visible { outline:none; box-shadow:inset var(--m-focus); border-radius:var(--m-r-card); }
/* The disclosure mark points at the content (down) when open and at the reading direction's start
   when closed. In RTL «start» is the right, so a closed chevron points left — into the line. */
.ds6 .oc-chev { inline-size:16px; block-size:16px; flex:none; color:var(--m-mut); }
.ds6 .oc-chev svg { inline-size:16px; block-size:16px; stroke:currentColor; stroke-width:2; fill:none; display:block; }
.ds6 .oc-sec:not([open]) .oc-chev svg { transform:rotate(90deg); }
.ds6 .oc-lvl { font-size:var(--m-t-micro); color:var(--m-mut); font-weight:600; }
.ds6 .oc-name { font-size:var(--m-t-sub); font-weight:700; color:var(--m-ink); }
.ds6 .oc-mgr { display:inline-flex; align-items:center; gap:6px; font-size:var(--m-t-cap); color:var(--m-ink-2, var(--m-ink)); }
.ds6 .oc-mgr i { font-style:normal; color:var(--m-mut); }
.ds6 .oc-sp { flex:1; }
.ds6 .oc-body { border-block-start:1px solid var(--m-line); padding:var(--m-3) var(--m-5) var(--m-4); display:flex; flex-direction:column; gap:var(--m-2); }
.ds6 .oc-dept { position:relative; margin-inline-start:var(--m-4); padding-inline-start:var(--m-4);
  border-inline-start:1px solid var(--m-line); padding-block:var(--m-2); }
.ds6 .oc-dept__h { display:flex; align-items:center; gap:var(--m-3); flex-wrap:wrap; }
.ds6 .oc-dept__h .oc-name { font-size:var(--m-t-body); }
.ds6 .oc-mem { list-style:none; margin:var(--m-2) 0 0; padding:0; margin-inline-start:var(--m-4);
  padding-inline-start:var(--m-4); border-inline-start:1px dashed var(--m-line);
  display:flex; flex-direction:column; gap:2px; }
.ds6 .oc-mem li { display:flex; align-items:baseline; gap:var(--m-2); font-size:var(--m-t-cap); color:var(--m-ink); min-block-size:28px; padding-block:3px; flex-wrap:wrap; }
.ds6 .oc-mem li .oc-role { color:var(--m-mut); }
.ds6 .oc-mem li.is-off { color:var(--m-mut); }
.ds6 .oc-orphans .oc-body { border-block-start:0; }
@media (max-width: 700px) {
  .ds6 .oc-dept, .ds6 .oc-mem { margin-inline-start:var(--m-2); padding-inline-start:var(--m-3); }
  .ds6 .oc-sec > summary, .ds6 .oc-body { padding-inline:var(--m-4); }
}
`;

export const ORG_CRM_JS = `
/* ================= «إعدادات المنظمة» ================= */
var ocTab = "tree";
var OC_TABS = [["tree", "الهيكل"], ["segments", "الشرائح"], ["sectors", "القطاعات"], ["departments", "الإدارات"], ["employees", "الموظفون"], ["roles", "الأدوار"]];

function ocCanEdit() { return typeof meCan !== "function" || meCan("org.manage"); }
function ocN(v) { return '<span class="m-n">' + fmtN(v) + "</span>"; }
function ocNil(t, kind) { return '<span class="m-td-nil m-nil--' + (kind || "none") + '">' + esc(t) + "</span>"; }
function ocPl(n, one, two, few, many) { return pluralizeArabic(n, one, two, few, many, fmtN); }
function ocNDept(n) { return ocPl(n, "إدارة واحدة", "إدارتان", "إدارات", "إدارة"); }
function ocNEmp(n) { return ocPl(n, "موظف واحد", "موظفان", "موظفين", "موظفًا"); }
function ocNProd(n) { return ocPl(n, "منتج واحد", "منتجان", "منتجات", "منتجًا"); }
function ocNSector(n) { return ocPl(n, "قطاع واحد", "قطاعان", "قطاعات", "قطاعًا"); }
function ocNSeg(n) { return ocPl(n, "شريحة واحدة", "شريحتان", "شرائح", "شريحة"); }
function ocNRole(n) { return ocPl(n, "دور واحد", "دوران", "أدوار", "دورًا"); }

function ocSector(id) { return (cfOrgSecs || []).filter(function (s) { return String(s.id) === String(id); })[0] || null; }
function ocSegment(id) { return (cfSegs || []).filter(function (s) { return String(s.id) === String(id); })[0] || null; }
function ocRole(key) { return (cfRoles || []).filter(function (r) { return r.key === key; })[0] || null; }
function ocChip(on, onT, offT) { return on ? '<span class="m-chip m-chip--ok">' + onT + "</span>" : '<span class="m-chip">' + offT + "</span>"; }
function ocMemberOpts(emptyLabel) {
  return [["", emptyLabel]].concat(cfTeam.filter(function (m) { return m.active; }).map(function (m) { return [String(m.id), m.name + " · " + cfRoleLabel(m.role)]; }));
}

/* ---- for the product record (requirement 7): a department picked UNDER its sector, and who that
   makes responsible. Read here, rendered there; the product screen never edits the organisation. */
function ocDivisionOptions(selectedId) {
  var sel = function (d) { return '<option value="' + d.id + '"' + (String(selectedId) === String(d.id) ? " selected" : "") + ">" + esc(d.name) + "</option>"; };
  var divs = (typeof cfDivs !== "undefined" && cfDivs) || [];
  var h = "";
  (cfOrgSecs || []).forEach(function (s) {
    var under = divs.filter(function (d) { return d.sectorId === s.id; });
    if (under.length) h += '<optgroup label="' + esc(s.name) + '">' + under.map(sel).join("") + "</optgroup>";
  });
  var loose = divs.filter(function (d) { return d.sectorId == null || !ocSector(d.sectorId); });
  if (loose.length) h += (h ? '<optgroup label="بلا قطاع">' : "") + loose.map(sel).join("") + (h ? "</optgroup>" : "");
  return h;
}
function ocResponsibleFor(divisionId) {
  if (!divisionId) return "";
  var d = (cfDivs || []).filter(function (x) { return String(x.id) === String(divisionId); })[0];
  if (!d) return "";
  var s = d.sectorId ? ocSector(d.sectorId) : null;
  var parts = [];
  parts.push("مدير الإدارة: " + (d.ownerName || "لم يُعيَّن"));
  if (s) parts.push("القطاع: " + s.name + " · مديره: " + (s.managerName || "لم يُعيَّن"));
  return parts.join(" — ");
}

function ocBind() {
  dsD("ocSegs", function () { return (cfSegs || []).length; });
  dsD("ocSecs", function () { return (cfOrgSecs || []).length; });
  dsD("ocDepts", function () { return (cfDivs || []).length; });
  dsD("ocEmps", function () { return (cfTeam || []).length; });
  dsD("ocRoles", function () { return (cfRoles || []).length; });
}

function ocAddBtn(kind, label, id) {
  if (!ocCanEdit()) return "";
  if (cfEdit && cfEdit.kind === kind && !cfEdit.id) return '<button class="m-btn" aria-disabled="true" tabindex="-1">' + cfIco("plus") + label + "</button>";
  return '<button class="m-btn m-btn--primary" id="' + id + '" data-oc="add" data-k="' + kind + '">' + cfIco("plus") + label + "</button>";
}
function ocEditBtn(kind, id) {
  return ocCanEdit() ? '<button class="m-btn" data-oc="edit" data-k="' + kind + '" data-i="' + esc(String(id)) + '">تعديل</button>' : "";
}
function ocCard(title, meta, actions, inner) {
  return '<section class="m-card m-card--pad0"><div style="padding:var(--m-5) var(--m-5) 0">' +
    cfSecHead(title, meta, actions) + "</div>" + inner + "</section>";
}
function ocTable(cols, headHtml, bodyHtml) {
  return '<div class="m-tablewrap"><table class="m-table oc-tbl"><thead><tr>' + headHtml + "</tr></thead><tbody>" + bodyHtml + "</tbody></table></div>";
}
function ocEmptyRow(cols, t, d) {
  return '<tr class="m-table__empty"><td colspan="' + cols + '"><div class="m-empty"><p class="m-empty__t">' + t + "</p>" +
    (d ? '<p class="m-empty__d">' + d + "</p>" : "") + "</div></td></tr>";
}

/* ================= editors ================= */
function ocSegmentEditor() {
  var d = cfEdit.d;
  return '<div class="cf-ed"><div class="m-form">' +
    cfInput("oc_sgname", "اسم الشريحة", d.name, { k: "name", max: NAME_MAX, ph: "مثال: المستشفيات الخاصة" }) +
    cfSelect("oc_sgkind", "النوع", "kind", d.kind, SEGMENT_KINDS.map(function (k) { return [k, SEGMENT_KIND_LABELS[k]]; })) +
    cfSelect("oc_sgactive", "الحالة", "active", d.active ? "1" : "", [["1", "مفعّلة"], ["", "موقوفة"]]) +
    "</div>" + cfEditorActions(cfEdit.id ? "احفظ التغييرات" : "أضف الشريحة") + "</div>";
}
function ocSectorEditor() {
  var d = cfEdit.d;
  return '<div class="cf-ed"><div class="m-form">' +
    cfInput("oc_scname", "اسم القطاع", d.name, { k: "name", max: NAME_MAX, ph: "مثال: قطاع الأعمال" }) +
    cfSelect("oc_sckind", "التصنيف", "kind", d.kind, ORG_SECTOR_KINDS.map(function (k) { return [k, ORG_SECTOR_KIND_LABELS[k]]; })) +
    cfSelect("oc_scmgr", "مدير القطاع", "managerMemberId", d.managerMemberId == null ? "" : String(d.managerMemberId), ocMemberOpts("بلا مدير"), "من سجل الموظفين") +
    cfSelect("oc_scactive", "الحالة", "active", d.active ? "1" : "", [["1", "مفعّل"], ["", "موقوف"]]) +
    "</div>" + cfEditorActions(cfEdit.id ? "احفظ التغييرات" : "أضف القطاع") + "</div>";
}
function ocDeptEditor() {
  var d = cfEdit.d;
  var secs = [["", "بلا قطاع"]].concat((cfOrgSecs || []).map(function (s) { return [String(s.id), s.name + " · " + (ORG_SECTOR_KIND_LABELS[s.kind] || s.kind)]; }));
  return '<div class="cf-ed"><div class="m-form">' +
    cfInput("oc_dname", "اسم الإدارة", d.name, { k: "name", max: NAME_MAX, ph: "مثال: إدارة حلول المستشفيات" }) +
    cfSelect("oc_dsec", "القطاع", "sectorId", d.sectorId == null ? "" : String(d.sectorId), secs, "الإدارة تتبع قطاعًا واحدًا") +
    cfSelect("oc_downer", "مدير الإدارة", "ownerMemberId", d.ownerMemberId == null ? "" : String(d.ownerMemberId), ocMemberOpts("بلا مدير"), "من سجل الموظفين") +
    cfSelect("oc_dactive", "الحالة", "active", d.active ? "1" : "", [["1", "مفعّلة"], ["", "موقوفة"]]) +
    "</div>" + cfEditorActions(cfEdit.id ? "احفظ التغييرات" : "أضف الإدارة") + "</div>";
}
function ocDeptChoices() {
  return [["", "بلا إدارة"]].concat((cfDivs || []).map(function (x) {
    var s = x.sectorId ? ocSector(x.sectorId) : null;
    return [String(x.id), x.name + (s ? " · " + s.name : "")];
  }));
}
function ocRoleChoices(current) {
  var live = (cfRoles || []).filter(function (r) { return r.active || r.key === current; });
  if (!live.length) return TEAM_ROLES.map(function (r) { return [r, cfRoleLabel(r)]; });
  return live.map(function (r) { return [r.key, r.label]; });
}
function ocMemberEditor() {
  var d = cfEdit.d;
  return '<div class="cf-ed"><div class="m-form">' +
    cfInput("oc_mname", "الاسم", d.name, { k: "name", max: 60 }) +
    cfInput("oc_memail", "البريد", d.email, { k: "email", max: 120, type: "email", ph: "name@company.com" }, "إليه يذهب التصعيد وطلب الدعم") +
    cfSelect("oc_mrole", "الدور", "role", d.role, ocRoleChoices(d.role), "الدعم يستقبل طلبات الدعم · الإدارة تستقبل التصعيد") +
    cfSelect("oc_mdiv", "الإدارة", "divisionId", d.divisionId == null ? "" : String(d.divisionId), ocDeptChoices()) +
    cfSelect("oc_mactive", "الحالة", "active", d.active ? "1" : "", [["1", "مفعّل"], ["", "موقوف"]]) +
    "</div>" + cfEditorActions(cfEdit.id ? "احفظ التغييرات" : "أضف الموظف") + "</div>";
}
/* «نقل»: the one field that changes when someone moves, alone, so a move cannot touch anything else. */
function ocMoveEditor() {
  var d = cfEdit.d, m = cfMember(cfEdit.id);
  var from = m && m.division ? m.division : "بلا إدارة";
  return '<div class="cf-ed"><div class="m-form">' +
    cfSelect("oc_mvdiv", "نقل إلى إدارة", "divisionId", d.divisionId == null ? "" : String(d.divisionId), ocDeptChoices(), "الإدارة الحالية: " + esc(from)) +
    "</div>" + cfEditorActions("انقل") + "</div>";
}
function ocRoleEditor() {
  var d = cfEdit.d, r = cfEdit.id ? ocRole(cfEdit.id) : null;
  return '<div class="cf-ed"><div class="m-form">' +
    cfInput("oc_rlabel", "اسم الدور", d.label, { k: "label", max: 40, ph: "مثال: مدير حساب" }) +
    (r && r.system ? "" : cfSelect("oc_ractive", "الحالة", "active", d.active ? "1" : "", [["1", "مفعّل"], ["", "موقوف"]], "الموقوف لا يُعرض عند إضافة موظف")) +
    "</div>" + cfEditorActions(cfEdit.id ? "احفظ التغييرات" : "أضف الدور") + "</div>";
}

/* ================= the hierarchy ================= */
var OC_CHEV = '<span class="oc-chev" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></span>';
var ocClosed = {};   /* sector ids the admin folded; open is the default */
function ocMgr(label, m) {
  return '<span class="oc-mgr"><i>' + label + "</i>" + (m ? esc(m.name) : ocNil("لم يُعيَّن", "unset")) + "</span>";
}
function ocDeptHtml(d) {
  var h = '<div class="oc-dept"><div class="oc-dept__h">' +
    '<span class="oc-lvl">الإدارة</span><span class="oc-name">' + esc(d.name) + "</span>" +
    (d.active ? "" : '<span class="m-chip">موقوفة</span>') +
    ocMgr("مدير الإدارة", d.manager) + '<span class="oc-sp"></span>' +
    '<span class="m-meta">' + ocNEmp(d.members.length + (d.manager && d.manager.divisionId === d.id ? 1 : 0)) + "</span>" +
    (ocCanEdit() ? '<button class="m-btn" data-oc="addunder" data-k="member" data-i="' + d.id + '">' + cfIco("plus") + "موظف</button>" : "") +
    "</div>";
  if (d.members.length) {
    h += '<ul class="oc-mem">' + d.members.map(function (m) {
      return '<li class="' + (m.active ? "" : "is-off") + '"><span>' + esc(m.name) + '</span><span class="oc-role">' + esc(cfRoleLabel(m.role)) + "</span>" +
        (m.active ? "" : '<span class="m-chip">موقوف</span>') + "</li>";
    }).join("") + "</ul>";
  }
  return h + "</div>";
}
function ocTreeView() {
  var tree = buildOrgTree(cfOrgSecs || [], cfDivs || [], cfTeam || []);
  var h = '<div class="oc-tree">';
  if (!tree.sectors.length) {
    h += '<section class="m-card"><div class="m-empty"><p class="m-empty__t">لا قطاعات بعد</p>' +
      '<p class="m-empty__d">ابدأ بالقطاع، ثم أضف تحته إداراته وموظفيها.</p>' +
      (ocCanEdit() ? '<p class="m-empty__a"><button class="m-btn m-btn--primary" data-oc="goadd" data-k="sector">' + cfIco("plus") + "أضف قطاعًا</button></p>" : "") +
      "</div></section>";
  }
  tree.sectors.forEach(function (s) {
    var emps = s.departments.reduce(function (n, d) { return n + d.members.length + (d.manager && d.manager.divisionId === d.id ? 1 : 0); }, 0);
    h += '<details class="m-card m-card--pad0 oc-sec" data-ocsec="' + s.id + '"' + (ocClosed[s.id] ? "" : " open") + "><summary>" + OC_CHEV +
      '<span class="oc-lvl">القطاع</span><span class="oc-name">' + esc(s.name) + "</span>" +
      '<span class="m-chip m-chip--ac">' + esc(ORG_SECTOR_KIND_LABELS[s.kind] || s.kind) + "</span>" +
      (s.active ? "" : '<span class="m-chip">موقوف</span>') +
      ocMgr("مدير القطاع", s.manager) + '<span class="oc-sp"></span>' +
      '<span class="m-meta">' + (s.departments.length ? ocNDept(s.departments.length) : "لا إدارات") + " · " + (emps ? ocNEmp(emps) : "لا موظفين") + "</span>" +
      "</summary><div class=\\"oc-body\\">";
    if (!s.departments.length) h += '<p class="m-meta">لا إدارات تحت هذا القطاع بعد.</p>';
    s.departments.forEach(function (d) { h += ocDeptHtml(d); });
    if (ocCanEdit()) h += '<div><button class="m-btn" data-oc="addunder" data-k="department" data-i="' + s.id + '">' + cfIco("plus") + "إدارة تحت «" + esc(s.name) + "»</button></div>";
    h += "</div></details>";
  });
  if (tree.unsectored.length) {
    h += '<section class="m-card m-card--pad0 oc-sec oc-orphans"><div style="padding:var(--m-4) var(--m-5) 0">' +
      '<span class="oc-name">إدارات بلا قطاع</span> <span class="m-meta">' + ocNDept(tree.unsectored.length) + " — لا تظهر تحت أي قطاع حتى يُحدَّد قطاعها</span></div>" +
      '<div class="oc-body">' + tree.unsectored.map(ocDeptHtml).join("") + "</div></section>";
  }
  if (tree.unplaced.length) {
    h += '<section class="m-card m-card--pad0 oc-sec oc-orphans"><div style="padding:var(--m-4) var(--m-5) 0">' +
      '<span class="oc-name">موظفون بلا إدارة</span> <span class="m-meta">' + ocNEmp(tree.unplaced.length) + "</span></div>" +
      '<div class="oc-body"><ul class="oc-mem" style="border:0;margin:0;padding:0">' + tree.unplaced.map(function (m) {
        return '<li class="' + (m.active ? "" : "is-off") + '"><span>' + esc(m.name) + '</span><span class="oc-role">' + esc(cfRoleLabel(m.role)) + "</span>" +
          (ocCanEdit() ? '<button class="m-btn" data-oc="move" data-i="' + m.id + '">نقل إلى إدارة</button>' : "") + "</li>";
      }).join("") + "</ul></div></section>";
  }
  return h + "</div>";
}

/* ================= the five tables ================= */
function ocSegmentsView() {
  var rows = cfSegs || [];
  var body = "";
  if (cfEdit && cfEdit.kind === "segment" && !cfEdit.id) body += cfEditorRow(5, ocSegmentEditor());
  if (!rows.length) body += ocEmptyRow(5, "لا شرائح بعد", "الشريحة هي السوق الذي يُباع فيه المنتج: مستشفيات أو صيدليات أو قطاع الأعمال.");
  rows.forEach(function (s) {
    body += '<tr class="' + (s.active ? "" : "is-off") + '"><td class="m-td-n">' + esc(s.name) + "</td>" +
      "<td>" + (s.kind ? esc(SEGMENT_KIND_LABELS[s.kind] || s.kind) : ocNil("لم يُحدَّد النوع", "unset")) + "</td>" +
      "<td>" + (s.products ? ocNProd(s.products) : ocNil("لا منتجات", "none")) + "</td>" +
      "<td>" + ocChip(s.active, "مفعّلة", "موقوفة") + "</td>" +
      '<td><span class="cf-row-acts">' + ocEditBtn("segment", s.id) +
      (!ocCanEdit() ? "" : s.products ? '<span class="m-meta" title="انقل منتجاتها أو أوقفها">مرتبطة</span>' : cfHold("ocDeleteSegment", s.id, "حذف")) +
      "</span></td></tr>";
    if (cfEdit && cfEdit.kind === "segment" && String(cfEdit.id) === String(s.id)) body += cfEditorRow(5, ocSegmentEditor());
  });
  return ocCard("الشرائح", ocNSeg(rows.length) + " · السوق الذي يُباع فيه المنتج — يُربط المنتج بشريحته من سجل المنتج (حيث تظهر باسم «القطاع»)",
    ocAddBtn("segment", "إضافة شريحة", "ocaddseg"),
    ocTable(5, "<th>الشريحة</th><th>النوع</th><th>المنتجات</th><th>الحالة</th><th></th>", body));
}
function ocSectorsView() {
  var rows = cfOrgSecs || [];
  var body = "";
  if (cfEdit && cfEdit.kind === "osector" && !cfEdit.id) body += cfEditorRow(7, ocSectorEditor());
  if (!rows.length) body += ocEmptyRow(7, "لا قطاعات بعد", "القطاع أعلى وحدة في الهيكل: أعمال أو مبيعات أو دعم، له مدير وتحته إدارات.");
  rows.forEach(function (s) {
    body += '<tr class="' + (s.active ? "" : "is-off") + '"><td class="m-td-n">' + esc(s.name) + "</td>" +
      '<td><span class="m-chip m-chip--ac">' + esc(ORG_SECTOR_KIND_LABELS[s.kind] || s.kind) + "</span></td>" +
      "<td>" + (s.managerName ? esc(s.managerName) : ocNil("بلا مدير", "unset")) + "</td>" +
      "<td>" + (s.departments ? ocNDept(s.departments) : ocNil("لا إدارات", "none")) + "</td>" +
      "<td>" + (s.members ? ocNEmp(s.members) : ocNil("لا موظفين", "none")) + "</td>" +
      "<td>" + ocChip(s.active, "مفعّل", "موقوف") + "</td>" +
      '<td><span class="cf-row-acts">' + ocEditBtn("osector", s.id) +
      (!ocCanEdit() ? "" : s.departments ? '<span class="m-meta" title="انقل إداراته أو أوقفه">تحته إدارات</span>' : cfHold("ocDeleteSector", s.id, "حذف")) +
      "</span></td></tr>";
    if (cfEdit && cfEdit.kind === "osector" && String(cfEdit.id) === String(s.id)) body += cfEditorRow(7, ocSectorEditor());
  });
  return ocCard("القطاعات", ocNSector(rows.length) + " · وحدات الشركة العليا، ولكل قطاع مدير",
    ocAddBtn("osector", "إضافة قطاع", "ocaddsec"),
    ocTable(7, "<th>القطاع</th><th>التصنيف</th><th>مدير القطاع</th><th>الإدارات</th><th>الموظفون</th><th>الحالة</th><th></th>", body));
}
function ocDepartmentsView() {
  var rows = cfDivs || [];
  var body = "";
  if (cfEdit && cfEdit.kind === "division" && !cfEdit.id) body += cfEditorRow(7, ocDeptEditor());
  if (!rows.length) body += ocEmptyRow(7, "لا إدارات بعد", "الإدارة تتبع قطاعًا، ولها مدير، ويعمل فيها الموظفون وتُسند إليها المنتجات.");
  rows.forEach(function (d) {
    body += '<tr class="' + (d.active ? "" : "is-off") + '"><td class="m-td-n">' + esc(d.name) + "</td>" +
      "<td>" + (d.sector ? esc(d.sector) : ocNil("بلا قطاع", "unset")) + "</td>" +
      "<td>" + (d.ownerName ? esc(d.ownerName) + (d.ownerEmail ? '<span class="oc-sub"><bdi>' + esc(d.ownerEmail) + "</bdi></span>" : "") : ocNil("بلا مدير", "unset")) + "</td>" +
      "<td>" + (d.products ? ocNProd(d.products) : ocNil("لا منتجات", "none")) + "</td>" +
      "<td>" + (d.members ? ocNEmp(d.members) : ocNil("لا موظفين", "none")) + "</td>" +
      "<td>" + ocChip(d.active, "مفعّلة", "موقوفة") + "</td>" +
      '<td><span class="cf-row-acts">' + ocEditBtn("division", d.id) +
      (!ocCanEdit() ? "" : d.products || d.members ? '<span class="m-meta" title="انقل منتجاتها وموظفيها أو أوقفها">مرتبطة</span>' : cfHold("cfDeleteDivision", d.id, "حذف")) +
      "</span></td></tr>";
    if (cfEdit && cfEdit.kind === "division" && String(cfEdit.id) === String(d.id)) body += cfEditorRow(7, ocDeptEditor());
  });
  return ocCard("الإدارات", ocNDept(rows.length) + " · كل إدارة تحت قطاع، ولها مدير",
    ocAddBtn("division", "إضافة إدارة", "ocadddept"),
    ocTable(7, "<th>الإدارة</th><th>القطاع</th><th>مدير الإدارة</th><th>المنتجات</th><th>الموظفون</th><th>الحالة</th><th></th>", body));
}
function ocEmployeesView() {
  var rows = cfTeam || [];
  var body = "";
  if (cfEdit && cfEdit.kind === "member" && !cfEdit.id) body += cfEditorRow(6, ocMemberEditor());
  if (!rows.length) body += ocEmptyRow(6, "لا موظفين بعد", "التصعيد وطلب الدعم وإسناد المنتجات تحتاج شخصًا مسجّلًا ببريده.");
  rows.forEach(function (m) {
    var d = m.divisionId ? cfDivision(m.divisionId) : null;
    body += '<tr class="' + (m.active ? "" : "is-off") + '"><td class="m-td-n">' + esc(m.name) + "</td>" +
      "<td>" + (m.email ? "<bdi>" + esc(m.email) + "</bdi>" : ocNil("لم يُسجَّل بريد", "owed")) + "</td>" +
      "<td>" + (m.role ? esc(cfRoleLabel(m.role)) : ocNil("لم يُحدَّد", "unset")) + "</td>" +
      "<td>" + (m.division ? esc(m.division) + (d && d.sector ? '<span class="oc-sub">' + esc(d.sector) + "</span>" : "") : ocNil("بلا إدارة", "unset")) + "</td>" +
      "<td>" + ocChip(m.active, "مفعّل", "موقوف") + "</td>" +
      '<td><span class="cf-row-acts">' +
      (ocCanEdit() ? '<button class="m-btn" data-oc="move" data-i="' + m.id + '">نقل</button>' : "") + ocEditBtn("member", m.id) +
      (!ocCanEdit() ? "" : m.escalations ? '<span class="m-meta" title="عليه تصعيدات مسجّلة — أوقفه بدل حذفه">عليه تصعيدات</span>' : cfHold("cfDeleteMember", m.id, "حذف")) +
      "</span></td></tr>";
    if (cfEdit && (cfEdit.kind === "member" || cfEdit.kind === "move") && String(cfEdit.id) === String(m.id)) {
      body += cfEditorRow(6, cfEdit.kind === "move" ? ocMoveEditor() : ocMemberEditor());
    }
  });
  return ocCard("الموظفون", ocNEmp(rows.length) + " · الاسم والبريد والدور والإدارة",
    ocAddBtn("member", "إضافة موظف", "ocaddemp"),
    ocTable(6, "<th>الاسم</th><th>البريد</th><th>الدور</th><th>الإدارة</th><th>الحالة</th><th></th>", body));
}
function ocRolesView() {
  var rows = cfRoles || [];
  var body = "";
  if (cfEdit && cfEdit.kind === "role" && !cfEdit.id) body += cfEditorRow(5, ocRoleEditor());
  if (!rows.length) body += ocEmptyRow(5, "لم تُحمَّل الأدوار", "");
  rows.forEach(function (r) {
    body += '<tr class="' + (r.active ? "" : "is-off") + '"><td class="m-td-n">' + esc(r.label) + "</td>" +
      "<td>" + (r.system ? '<span class="m-chip m-chip--ac">أساسي</span>' : '<span class="m-chip">مخصّص</span>') + "</td>" +
      "<td>" + (r.members ? ocNEmp(r.members) : ocNil("لا أحد", "none")) + "</td>" +
      "<td>" + ocChip(r.active, "مفعّل", "موقوف") + "</td>" +
      '<td><span class="cf-row-acts">' + ocEditBtn("role", r.key) +
      (!ocCanEdit() ? "" : r.system ? '<span class="m-meta" title="يعتمد عليه النظام — يُعاد تسميته ولا يُحذف">أساسي</span>'
        : r.members ? '<span class="m-meta" title="غيّر أدوار حامليه أو أوقفه">مستخدم</span>' : cfHold("ocDeleteRole", r.key, "حذف")) +
      "</span></td></tr>";
    if (cfEdit && cfEdit.kind === "role" && cfEdit.id === r.key) body += cfEditorRow(5, ocRoleEditor());
  });
  return ocCard("الأدوار", ocNRole(rows.length) + " · الدور الوظيفي للموظف في الهيكل",
    ocAddBtn("role", "إضافة دور", "ocaddrole"),
    ocTable(5, "<th>الدور</th><th>النوع</th><th>الموظفون</th><th>الحالة</th><th></th>", body) +
    '<p class="m-meta oc-note">هذه أدوار وظيفية تحدد موقع الشخص في الهيكل. صلاحيات الدخول إلى النظام تُدار في <a class="m-link" href="#users">المستخدمون والصلاحيات</a>.</p>');
}

/* #divisions and #team were their own tabs until 2026-10-01; a bookmark or an old link lands on the
   matching tab here. Runs at the top of render(), before the route is read, so the rail, the tab
   strip and the title all see #org — the same shape as pxRedirectLegacy. */
function ocRedirectLegacy() {
  var h = (location.hash || "").slice(1).split("/")[0];
  if (h !== "divisions" && h !== "team") return;
  ocTab = h === "divisions" ? "departments" : "employees";
  try { history.replaceState(null, "", "#org"); } catch (e) { location.hash = "#org"; }
}

function vOrg() {
  cfLoad(false);
  ocBind();
  var h = '<div class="ds6"><div class="oc">';
  /* The top bar already prints the title; this line says only what the screen does NOT own. */
  h += '<p class="m-meta">المنتجات تُنشأ وتُعدَّل من <a class="m-link" href="#products">المنتجات</a>، وتُسند هناك إلى إدارتها المسؤولة.</p>';
  if (cfStages === null && !cfFailed) {
    return h + '<section class="m-card"><p class="m-body" aria-busy="true">جارٍ تحميل الهيكل…</p></section></div></div>';
  }
  if (cfFailed && cfStages === null) {
    return h + '<section class="m-card"><p class="m-body" role="alert">تعذّر تحميل الهيكل. ' +
      '<button class="m-btn" data-cf="retry">أعد المحاولة</button></p></section></div></div>';
  }
  if (cfFailed) h += '<section class="m-card"><p class="m-body" role="alert">' + cfIco("warn") +
    'تعذّر التحديث — المعروض آخر نسخة محمّلة. <button class="m-btn" data-cf="retry">أعد المحاولة</button></p></section>';

  var counts = { segments: ["ocSegs", (cfSegs || []).length], sectors: ["ocSecs", (cfOrgSecs || []).length],
    departments: ["ocDepts", (cfDivs || []).length], employees: ["ocEmps", (cfTeam || []).length], roles: ["ocRoles", (cfRoles || []).length] };
  h += '<div class="m-tabs" role="tablist" aria-label="إعدادات المنظمة">' + OC_TABS.map(function (t) {
    var c = counts[t[0]];
    return '<button type="button" class="m-tab" role="tab" id="octab_' + t[0] + '" aria-selected="' + (ocTab === t[0]) + '"' +
      ' tabindex="' + (ocTab === t[0] ? "0" : "-1") + '" data-oc="tab" data-k="' + t[0] + '">' + t[1] +
      (c ? " <b>" + dsFig(c[0], c[1]) + "</b>" : "") + "</button>";
  }).join("") + "</div>";
  h += '<div role="tabpanel" aria-labelledby="octab_' + ocTab + '">';
  h += ocTab === "segments" ? ocSegmentsView()
    : ocTab === "sectors" ? ocSectorsView()
    : ocTab === "departments" ? ocDepartmentsView()
    : ocTab === "employees" ? ocEmployeesView()
    : ocTab === "roles" ? ocRolesView()
    : ocTreeView();
  return h + "</div></div></div>";
}

/* ================= writes ================= */
function ocWrite(e, method, url, value, okMsg, after) {
  e.busy = true; render(false);
  cfJson(method, url, value).then(function (r) {
    e.busy = false;
    if (!r.ok) { e.err = r.j.detail || "تعذّر الحفظ (" + fmtN(r.status) + ")"; e.field = r.j.field || ""; render(false); return; }
    cfEdit = null; cfLoad(true);
    if (after) after();
    cfToast(okMsg, false);
  }).catch(function () { e.busy = false; e.err = "تعذّر الاتصال — لم يُحفظ شيء."; render(false); });
}
function ocFail(e, checked) { e.err = checked.reason; e.field = checked.field; render(false); }
function ocSaveSegment() {
  var e = cfEdit, d = e.d, cur = e.id ? ocSegment(e.id) : null;
  var checked = checkSegment({ name: d.name, kind: d.kind, active: !!d.active }, (cfSegs || []).map(function (x) { return x.name; }), cur ? cur.name : undefined);
  if (!checked.ok) return ocFail(e, checked);
  ocWrite(e, e.id ? "PATCH" : "POST", "/admin/config/segments" + (e.id ? "/" + e.id : ""), checked.value,
    e.id ? "حُفظت الشريحة" : "أُضيفت الشريحة «" + checked.value.name + "»", function () { if (typeof pcLoad === "function") pcLoad(true); });
}
function ocSaveSector() {
  var e = cfEdit, d = e.d, cur = e.id ? ocSector(e.id) : null;
  var mgr = d.managerMemberId ? cfMember(d.managerMemberId) : null;
  var checked = checkOrgSector({ name: d.name, kind: d.kind, managerMemberId: d.managerMemberId, active: !!d.active },
    (cfOrgSecs || []).map(function (x) { return x.name; }), mgr, cur ? cur.name : undefined);
  if (!checked.ok) return ocFail(e, checked);
  ocWrite(e, e.id ? "PATCH" : "POST", "/admin/config/sectors" + (e.id ? "/" + e.id : ""), checked.value,
    e.id ? "حُفظ القطاع" : "أُضيف القطاع «" + checked.value.name + "»");
}
function ocSaveDept() {
  var e = cfEdit, d = e.d, cur = e.id ? cfDivision(e.id) : null;
  var owner = d.ownerMemberId ? cfMember(d.ownerMemberId) : null;
  var checked = checkDivision({ name: d.name, ownerMemberId: d.ownerMemberId, active: !!d.active, sectorId: d.sectorId },
    (cfDivs || []).map(function (x) { return x.name; }), owner, cur ? cur.name : undefined,
    d.sectorId ? ocSector(d.sectorId) : undefined);
  if (!checked.ok) return ocFail(e, checked);
  ocWrite(e, e.id ? "PATCH" : "POST", "/admin/config/divisions" + (e.id ? "/" + e.id : ""), checked.value,
    e.id ? "حُفظت الإدارة" : "أُضيفت الإدارة «" + checked.value.name + "»", function () { if (typeof pcLoad === "function") pcLoad(true); });
}
function ocSaveMember() {
  var e = cfEdit, d = e.d, cur = e.id ? cfMember(e.id) : null;
  var keys = (cfRoles || []).filter(function (r) { return r.active; }).map(function (r) { return r.key; });
  if (cur) keys.push(cur.role);
  var checked = checkMember({ name: d.name, email: d.email, role: d.role, divisionId: d.divisionId, active: !!d.active }, keys);
  if (!checked.ok) return ocFail(e, checked);
  ocWrite(e, e.id ? "PATCH" : "POST", "/admin/config/team" + (e.id ? "/" + e.id : ""), checked.value,
    e.id ? "حُفظ الموظف" : "أُضيف «" + checked.value.name + "»");
}
function ocSaveMove() {
  var e = cfEdit, m = cfMember(e.id);
  if (!m) { cfClose(); return; }
  var to = e.d.divisionId === "" || e.d.divisionId == null ? null : Number(e.d.divisionId);
  if (to === m.divisionId) { cfClose(); return; }
  var dn = to ? (cfDivision(to) || {}).name : "";
  ocWrite(e, "PATCH", "/admin/config/team/" + m.id, { divisionId: to },
    to ? "نُقل «" + m.name + "» إلى «" + dn + "»" : "أُخرج «" + m.name + "» من إدارته");
}
function ocSaveRole() {
  var e = cfEdit, d = e.d, cur = e.id ? ocRole(e.id) : null;
  var checked = checkRole({ label: d.label, active: cur && cur.system ? true : !!d.active },
    (cfRoles || []).map(function (r) { return r.label; }), cur ? cur.label : undefined, cur ? cur.system : false);
  if (!checked.ok) return ocFail(e, checked);
  ocWrite(e, e.id ? "PATCH" : "POST", "/admin/config/roles" + (e.id ? "/" + encodeURIComponent(e.id) : ""), checked.value,
    e.id ? "حُفظ الدور" : "أُضيف الدور «" + checked.value.label + "»");
}
/* Called by settings-crm's one save dispatcher for every kind it does not own. */
function ocSave() {
  if (!cfEdit) return;
  var k = cfEdit.kind;
  if (k === "segment") ocSaveSegment();
  else if (k === "osector") ocSaveSector();
  else if (k === "division") ocSaveDept();
  else if (k === "member") ocSaveMember();
  else if (k === "move") ocSaveMove();
  else if (k === "role") ocSaveRole();
}
function ocDelete(url, okMsg, after) {
  cfJson("DELETE", url).then(function (r) {
    if (!r.ok) { cfToast(r.j.detail || "تعذّر الحذف", true); return; }
    cfLoad(true); if (after) after(); cfToast(okMsg, false);
  }).catch(function () { cfToast("تعذّر الاتصال — لم يُحذف شيء.", true); });
}
window.ocDeleteSegment = function (id) {
  var s = ocSegment(id); if (!s) return;
  var c = checkSegmentDelete(s.products); if (!c.ok) { cfToast(c.reason, true); return; }
  ocDelete("/admin/config/segments/" + Number(id), "حُذفت الشريحة «" + s.name + "»", function () { if (typeof pcLoad === "function") pcLoad(true); });
};
window.ocDeleteSector = function (id) {
  var s = ocSector(id); if (!s) return;
  var c = checkOrgSectorDelete(s.departments); if (!c.ok) { cfToast(c.reason, true); return; }
  ocDelete("/admin/config/sectors/" + Number(id), "حُذف القطاع «" + s.name + "»");
};
window.ocDeleteRole = function (key) {
  var r = ocRole(key); if (!r) return;
  var c = checkRoleDelete(key, r.members); if (!c.ok) { cfToast(c.reason, true); return; }
  ocDelete("/admin/config/roles/" + encodeURIComponent(key), "حُذف الدور «" + r.label + "»");
};

function ocFocus(id) { setTimeout(function () { var f = document.getElementById(id); if (f) f.focus(); }, 0); }
var OC_FIRST = { segment: "oc_sgname", osector: "oc_scname", division: "oc_dname", member: "oc_mname", role: "oc_rlabel", move: "oc_mvdiv" };
var OC_TAB_OF = { segment: "segments", osector: "sectors", division: "departments", member: "employees", role: "roles" };
function ocBlank(kind, preset) {
  var p = preset || {};
  if (kind === "segment") return { name: "", kind: "hospitals", active: true };
  if (kind === "osector") return { name: "", kind: "business", managerMemberId: "", active: true };
  if (kind === "division") return { name: "", sectorId: p.sectorId || "", ownerMemberId: "", active: true };
  if (kind === "member") {
    var first = (cfRoles || []).filter(function (r) { return r.active; })[0];
    return { name: "", email: "", role: first ? first.key : "sales", divisionId: p.divisionId || "", active: true };
  }
  return { label: "", active: true };
}
function ocRowData(kind, id) {
  if (kind === "segment") { var s = ocSegment(id); return s && [s.id, { name: s.name, kind: s.kind || "hospitals", active: s.active }]; }
  if (kind === "osector") { var o = ocSector(id); return o && [o.id, { name: o.name, kind: o.kind, managerMemberId: o.managerMemberId == null ? "" : o.managerMemberId, active: o.active }]; }
  if (kind === "division") { var d = cfDivision(id); return d && [d.id, { name: d.name, sectorId: d.sectorId == null ? "" : d.sectorId, ownerMemberId: d.ownerMemberId == null ? "" : d.ownerMemberId, active: d.active }]; }
  if (kind === "member") { var m = cfMember(id); return m && [m.id, { name: m.name, email: m.email, role: m.role, divisionId: m.divisionId == null ? "" : m.divisionId, active: m.active }]; }
  var r = ocRole(id); return r && [r.key, { label: r.label, active: r.active }];
}

document.addEventListener("click", function (ev) {
  var t = ev.target && ev.target.closest ? ev.target.closest("[data-oc]") : null;
  if (!t) return;
  var a = t.getAttribute("data-oc"), k = t.getAttribute("data-k"), i = t.getAttribute("data-i");
  if (a === "tab") { if (ocTab !== k) { ocTab = k; cfEdit = null; render(false); } return; }
  if (!ocCanEdit()) return;
  if (a === "add") { cfOpen(k, 0, ocBlank(k)); ocFocus(OC_FIRST[k]); return; }
  if (a === "goadd") { ocTab = OC_TAB_OF[k]; cfOpen(k, 0, ocBlank(k)); ocFocus(OC_FIRST[k]); return; }
  /* From the tree: a department under THIS sector, a person in THIS department. */
  if (a === "addunder") {
    ocTab = OC_TAB_OF[k];
    cfOpen(k, 0, ocBlank(k, k === "division" ? { sectorId: Number(i) } : { divisionId: Number(i) }));
    ocFocus(OC_FIRST[k]); return;
  }
  if (a === "edit") { var row = ocRowData(k, k === "role" ? i : Number(i)); if (!row) return; cfOpen(k, row[0], row[1]); ocFocus(OC_FIRST[k]); return; }
  if (a === "move") {
    var m = cfMember(Number(i)); if (!m) return;
    if (ocTab !== "employees") ocTab = "employees";
    cfOpen("move", m.id, { divisionId: m.divisionId == null ? "" : m.divisionId }); ocFocus("oc_mvdiv"); return;
  }
});
/* Arrow keys move between tabs, as a tablist promises (WAI-ARIA). In RTL the next tab is to the LEFT. */
document.addEventListener("keydown", function (ev) {
  var t = ev.target;
  if (!t || !t.getAttribute || t.getAttribute("data-oc") !== "tab") return;
  if (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight" && ev.key !== "Home" && ev.key !== "End") return;
  ev.preventDefault();
  var keys = OC_TABS.map(function (x) { return x[0]; });
  var at = keys.indexOf(ocTab);
  var next = ev.key === "Home" ? 0 : ev.key === "End" ? keys.length - 1
    : (at + (ev.key === "ArrowLeft" ? 1 : -1) + keys.length) % keys.length;
  ocTab = keys[next]; cfEdit = null; render(false); ocFocus("octab_" + ocTab);
});
/* A folded sector stays folded across re-renders (every save re-renders the screen). */
document.addEventListener("toggle", function (ev) {
  var t = ev.target;
  if (!t || !t.getAttribute) return;
  var id = t.getAttribute("data-ocsec");
  if (id) ocClosed[id] = !t.open;
}, true);
`;
