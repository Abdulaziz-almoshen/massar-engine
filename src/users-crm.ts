// users-crm.ts — who is signed in, what their role opens, «المستخدمون والصلاحيات» and «سجل التدقيق» (client A,
// BRD v1.0 §22, NFR-001/002/007, slice S7).
//
// The page asks /admin/me once per session and hides the doors, tabs and screens the role cannot open (canOpen,
// from rbac-domain). Hiding is courtesy; the server's onRequest gate is the authority and refuses the same things.
// A partner user lands on «شركاء المبيعات», which the server already scopes to its own company.
//
// The users screen issues a sign-in token per person. The token is shown ONCE, in the sheet that created it —
// the server keeps only its hash — so the sheet says so and offers a copy button. The audit screen reads the
// log every successful write leaves.
//
// GRAMMAR. PORTED to the new design system (docs/PORT-SPEC.md): both screens are wrapped in .ds6 and
// drawn in the m-* vocabulary — m-card objects, real m-table tables inside m-tablewrap, m-chip for role
// and status, m-btn / m-link for every action, m-field / m-label / m-input / m-select in the sheet, and
// the sheet panel itself in m-dlg__p / __h / __b / __f. Every digit goes through .m-n.
//
// THE ONE PLACE A DASH SURVIVES is the permissions matrix. There the dash IS the value, read down a
// column against «✓» and «عرض»; replacing it with a worded absence would break the row's grammar. Every
// other empty cell carries one of the three absence kinds (PORT-SPEC 4).
//
// The scrim and its positioning (.ac-scrim/.ac-modal) stay: they are the account sheet's, shared with
// screens that are not ported, and the vocabulary has no non-<dialog> overlay.
// MOTION: the sheet's 200ms/140ms; nothing else animates.
//
// NO BACKTICKS ANYWHERE IN THIS FILE, comments included: it is one template literal.

export const USERS_CRM_CSS = `
.ds6 .us { display:flex; flex-direction:column; gap:var(--m-4); container-type:inline-size; container-name:usw; }
.ds6 .us-tbl { min-inline-size: 760px; }
/* The last four of a token. Monospace so a hint is comparable character by character. */
.ds6 .us-hint { font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:var(--m-t-cap);
  color:var(--m-mut); direction:ltr; unicode-bidi:isolate; }
.ds6 .us-acts { display:flex; gap:var(--m-2); flex-wrap:wrap; justify-content:flex-end; }
.ds6 .us-acts .m-btn { min-block-size:36px; padding-inline:12px; font-size:var(--m-t-cap); }
/* The permissions matrix: a grid of marks, centred, read down a column. */
.ds6 .us-mx { min-inline-size:620px; }
.ds6 .us-mx th, .ds6 .us-mx td { text-align:center; }
.ds6 .us-mx th:first-child, .ds6 .us-mx td:first-child { text-align:start; }
/* The row header names the function; it reads as a row name, not as a column head. */
.ds6 .us-mx th[scope="row"] { color:var(--m-ink); font-weight:600; background:transparent;
  border-block-start:1px solid var(--m-line); border-block-end:0; block-size:auto; }
.ds6 .us-mx td.full { color:var(--m-ok); font-weight:700; }
.ds6 .us-mx td.view { color:var(--m-ac-deep); }
.ds6 .us-mx td.none { color:var(--m-faint); }
.ds6 .us-mx caption { position:absolute; inline-size:1px; block-size:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
/* A radio LIST, not a chip row: each role carries a sentence saying what it opens. */
.ds6 .us-roles { display:flex; flex-direction:column; gap:6px; }
.ds6 .us-role { display:flex; gap:var(--m-2); align-items:flex-start; text-align:start; font:inherit;
  border:1px solid var(--m-line); border-radius:var(--m-r-ctl); padding:10px 12px; cursor:pointer;
  background:var(--m-paper); color:var(--m-ink);
  transition:background var(--m-out) var(--m-ease), border-color var(--m-out) var(--m-ease),
             transform var(--m-press) var(--m-ease); }
.ds6 .us-role[aria-checked="true"] { border-color:var(--m-ac); background:var(--m-ac-dim); }
.ds6 .us-role .t { font-size:var(--m-t-body); font-weight:600; }
.ds6 .us-role .d { font-size:var(--m-t-cap); color:var(--m-mut); line-height:1.6; }
.ds6 .us-role i { inline-size:16px; block-size:16px; flex:none; border-radius:var(--m-r-chip);
  box-shadow:inset 0 0 0 1.5px var(--m-line-2); margin-block-start:2px; }
.ds6 .us-role[aria-checked="true"] i { box-shadow:inset 0 0 0 5px var(--m-ac); }
.ds6 .us-role:active { transform:scale(.97); }
.ds6 .us-role:focus-visible { outline:none; box-shadow:var(--m-focus); }
/* The token, shown once. A warning surface, because it cannot be recovered. */
.ds6 .us-tok { display:flex; flex-direction:column; gap:var(--m-2); border-radius:var(--m-r-ctl);
  padding:var(--m-3); background:var(--m-warn-dim); color:var(--m-warn);
  box-shadow:0 0 0 1px var(--m-warn-line); }
.ds6 .us-tok .v { display:flex; gap:var(--m-2); align-items:center; flex-wrap:wrap; }
.ds6 .us-tok code { font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:var(--m-t-body);
  background:var(--m-paper); color:var(--m-ink); padding:6px 10px; border-radius:var(--m-r-ctl);
  direction:ltr; unicode-bidi:isolate; word-break:break-all; }
.ds6 .au-f { display:flex; gap:var(--m-2); flex-wrap:wrap; align-items:center;
  padding:var(--m-3) var(--m-5); border-block-end:1px solid var(--m-line); }
.ds6 .au-f .m-select { inline-size:auto; max-inline-size:240px; }
.ds6 .au-tbl { min-inline-size:720px; }
.ds6 .au-tbl time { color:var(--m-mut); font-size:var(--m-t-cap); white-space:nowrap; }
.ds6 .au-tbl .dt { display:flex; gap:4px; flex-wrap:wrap; }
.ds6 .au-tbl .dt span { font-size:var(--m-t-micro); background:var(--m-sunk); border-radius:var(--m-r-chip);
  padding:1px 8px; color:var(--m-ink-2); max-inline-size:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
@media (prefers-reduced-motion: reduce) { .ds6 .us-role { transition:none; } .ds6 .us-role:active { transform:none; } }
`;

export const USERS_CRM_JS = `
/* ================= roles in the page, «المستخدمون والصلاحيات» and «سجل التدقيق» ================= */
var ME = null, meLoading = false;
function meLoad() {
  if (ME || meLoading || !TOKEN) return;
  meLoading = true;
  fetch("/admin/me", { headers: { "x-admin-token": TOKEN } }).then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) {
      meLoading = false;
      if (!j) return;
      ME = j;
      /* The rail named the founder for every sign-in; it names the person and role now. */
      var mn = document.getElementById("meName"); if (mn) mn.textContent = ME.mainToken ? "مدير النظام" : ME.name + " · " + ME.roleLabel;
      /* A partner has one screen and is taken to it. Any other role opening a route it cannot use is told why
         (vDenied) rather than moved somewhere it did not ask for — except on an empty address. */
      var cur = (location.hash || "").slice(1).split("/")[0];
      if (ME.role === "partner" ? !canOpen(ME.role, cur || "kmon") : (!cur && !canOpen(ME.role, "kmon"))) location.hash = ME.home;
      render(false);
    }).catch(function () { meLoading = false; setTimeout(meLoad, 5000); });
}
function meRole() { return ME ? ME.role : "admin"; }
/* Until /admin/me answers, nothing is hidden: the server still refuses what the role may not do. */
function meCanOpen(route) { return !ME || canOpen(ME.role, route); }
function meCan(permission) { return !ME || can(ME.role, permission); }
/* Where a door takes this role: its own landing when the role may open it, else the first tab under it the role
   may open («شركاء المبيعات» for a partner, under الحملات), else nowhere — and a door that leads nowhere is not drawn. */
function meDoorTarget(door) {
  if (meCanOpen(door)) return door;
  var subs = (typeof SUBS !== "undefined" && SUBS[door]) || [];
  for (var i = 0; i < subs.length; i++) if (meCanOpen(subs[i][0])) return subs[i][0];
  return "";
}
/* Every digit through .m-n (PORT-SPEC 3). */
function usN(v) { return '<span class="m-n">' + fmtN(v) + "</span>"; }
/* kind: owed · unset · none. The permissions matrix is the one place a bare dash survives, because
   there the dash IS the value, read against a column of check marks (PORT-SPEC 4). */
function usNil(t, kind) { return '<span class="m-td-nil m-nil--' + (kind || "none") + '">' + esc(t) + "</span>"; }
function usPl(n, one, two, few, many) {
  return (typeof opPl === "function") ? opPl(n, one, two, few, many) : (fmtN(n) + " " + many);
}
function vDenied(route) {
  return '<div class="ds6"><div class="us"><section class="m-card"><div class="m-empty" role="alert">' +
    '<p class="m-empty__t">لا صلاحية لفتح هذه الشاشة</p>' +
    '<p class="m-empty__d">دورك: ' + esc(ME ? ME.roleLabel : "") + ". اطلب الصلاحية من مدير النظام.</p>" +
    '<p class="m-empty__a"><a class="m-btn" href="#' + esc(ME ? ME.home : "home") + '">العودة إلى شاشتك</a></p>' +
    "</div></section></div></div>";
}

/* ---------------- users ---------------- */
var usData = null, usLoading = false, usFailed = false, usSheet = null;
function usLoad(force) {
  if (usLoading || (usData && !force) || (usFailed && !force)) return;
  usLoading = true;
  pxGet("/admin/users").then(function (j) { usData = j; usFailed = false; }).catch(function () { usFailed = true; })
    .then(function () { usLoading = false; render(false); });
}
/* A date that was never recorded is not a dash: it is a fact nobody wrote yet. */
function usWhen(ms) { return ms ? new Date(Number(ms)).toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "short" }) : ""; }
function usWhenCell(ms, absent) { return ms ? esc(usWhen(ms)) : usNil(absent, "unset"); }
function vUsers() {
  usLoad(false);
  setTimeout(function () {
    var act = document.getElementById("crumbact");
    if (act && (location.hash || "").slice(1) === "users" && !document.getElementById("usnewtop"))
      act.innerHTML = '<button class="btn btn-teal ac-newtop" id="usnewtop" data-us="new">' + (typeof opIco === "function" ? opIco("plus") : "") + '<span class="lg">إضافة مستخدم</span><span class="sm">مستخدم</span></button>';
  }, 0);
  var h = '<div class="ds6"><div class="us">';
  if (!usData) return h + '<section class="m-card"><p class="m-body"' + (usFailed ? ' role="alert">تعذّر تحميل المستخدمين. <button class="m-btn" data-us="retry">أعد المحاولة</button>' : ' role="status" aria-busy="true">جارٍ تحميل المستخدمين…') + "</p></section></div></div>" + usModal();
  var users = usData.users || [];
  h += '<section class="m-card m-card--pad0"><div style="padding:var(--m-5) var(--m-5) 0">' +
    '<header class="m-card__h"><div><h2 class="m-card__t">المستخدمون</h2><p class="m-meta">' +
    (users.length ? usPl(users.length, "مستخدم واحد", "مستخدمان", "مستخدمين", "مستخدمًا") + " · " : "") +
    "يدخل كل مستخدم برمزه، ويبقى الرمز الرئيسي لمدير النظام صالحًا</p></div></header></div>";
  if (!users.length) {
    h += '<div class="m-empty"><p class="m-empty__t">لا مستخدمين بعد</p>' +
      '<p class="m-empty__d">لكل شخص حساب بدور من أدوار الوثيقة: تنفيذي، مدير منتج، مبيعات، شريك، مدير نظام، ويرى ما يسمح به دوره فقط.</p>' +
      '<p class="m-empty__a"><button class="m-btn m-btn--primary" id="usnewempty" data-us="new">إضافة مستخدم</button></p></div>';
  } else {
    h += '<div class="m-tablewrap"><table class="m-table us-tbl"><thead><tr>' +
      "<th>الاسم</th><th>الدور</th><th>الشريك</th><th>الرمز</th><th>آخر نشاط</th><th></th>" +
      "</tr></thead><tbody>";
    users.forEach(function (u) {
      h += "<tr>" +
        '<td class="m-td-n">' + esc(u.name) +
          '<span class="m-meta" style="display:block">أضافه ' +
          (u.createdBy === "اللوحة" ? "مدير النظام" : (u.createdBy ? esc(u.createdBy) : usNil("غير معروف", "unset"))) +
          " · " + usWhenCell(u.createdAt, "بلا تاريخ") + "</span></td>" +
        '<td><span class="m-chip' + (u.role === "admin" ? " m-chip--ac" : u.role === "partner" ? " m-chip--warn" : "") + '">' + esc(ROLE_LABELS[u.role] || u.role) + "</span>" +
          (u.status === "disabled" ? ' <span class="m-chip">موقوف</span>' : "") + "</td>" +
        "<td>" + (u.partnerName ? esc(u.partnerName) : usNil("ليس شريكًا", "none")) + "</td>" +
        '<td><span class="us-hint" title="آخر أربعة أحرف من الرمز">…' + esc(u.tokenHint) + "</span></td>" +
        "<td>" + usWhenCell(u.lastSeenAt, "لم يدخل بعد") + "</td>" +
        '<td><span class="us-acts"><button class="m-btn" id="usedit' + u.id + '" data-us="edit" data-i="' + u.id + '">تعديل</button>' +
        '<button class="m-btn" id="ustok' + u.id + '" data-us="token" data-i="' + u.id + '">رمز جديد</button></span></td></tr>';
    });
    h += "</tbody></table></div>";
  }
  h += "</section>";
  /* THE MATRIX KEEPS ITS DASH. Here the dash is the value — «لا وصول» read down a column against ✓ and
     «عرض» — and the legend above says so. This is PORT-SPEC 4's single stated exception. */
  h += '<section class="m-card m-card--pad0"><div style="padding:var(--m-5) var(--m-5) 0">' +
    '<header class="m-card__h"><div><h2 class="m-card__t">مصفوفة الصلاحيات</h2>' +
    '<p class="m-meta">من الوثيقة (§22): ✓ صلاحية كاملة · عرض · — لا وصول</p></div></header></div>' +
    '<div class="m-tablewrap"><table class="m-table us-mx"><caption>الصلاحيات حسب الدور</caption><thead><tr><th scope="col">الوظيفة</th>' +
    ROLES.map(function (r) { return '<th scope="col">' + esc(ROLE_LABELS[r]) + "</th>"; }).join("") + "</tr></thead><tbody>" +
    MATRIX_ROWS.map(function (row) {
      return '<tr><th scope="row">' + esc(row.label) + "</th>" + ROLES.map(function (r) {
        var c = matrixCell(r, row); return '<td class="' + c + '">' + (c === "full" ? "✓" : c === "view" ? "عرض" : "—") + "</td>";
      }).join("") + "</tr>";
    }).join("") + "</tbody></table></div></section>";
  return h + "</div></div>" + usModal();
}
function usOpen(mode, id, from) {
  var u = mode === "edit" ? (usData.users || []).filter(function (x) { return x.id === id; })[0] : null;
  if (mode === "edit" && !u) return;
  usSheet = { mode: mode, id: u ? u.id : 0, updatedAt: u ? u.updatedAt : 0, from: from,
    d: { name: u ? u.name : "", role: u ? u.role : "sales", partnerId: u && u.partnerId ? String(u.partnerId) : "", memberId: u && u.memberId ? String(u.memberId) : "", status: u ? u.status : "active" },
    token: null, err: "", field: "", busy: false, dirty: false, shown: false, focus: mode === "token" ? "uscopy" : "usf_name" };
  render(false);
}
function usClose() {
  if (!usSheet) return;
  var from = usSheet.from;
  document.querySelectorAll(".ac-scrim, .ac-box").forEach(function (el) { el.classList.remove("in"); });
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  setTimeout(function () { usSheet = null; render(false); var t = from && document.getElementById(from); if (t) t.focus(); }, reduce ? 0 : 150);
}
function usModal() {
  if (!usSheet) return "";
  var s = usSheet, cls = s.shown ? " in" : "", d = s.d;
  var title = s.token ? "رمز الدخول" : s.mode === "edit" ? "تعديل المستخدم" : "إضافة مستخدم";
  /* The scrim and its positioning stay .ac-*: they are the account sheet's, shared with screens that
     are not ported, and the vocabulary has no overlay outside a real <dialog>. The PANEL is m-dlg. */
  var h = '<div class="ds6 us"><div class="ac-scrim' + cls + '" data-us="close"></div><div class="ac-modal"><div class="ac-box m-dlg__p' + cls + '" role="dialog" aria-modal="true" aria-labelledby="usmt">' +
    '<div class="m-dlg__h"><h2 class="m-dlg__t" id="usmt">' + title + '</h2><button class="m-x" data-us="close" aria-label="إغلاق">' + (typeof opIco === "function" ? opIco("x") : "×") + '</button></div><div class="m-dlg__b">';
  if (s.token) {
    h += '<div class="us-tok" role="alert"><b>انسخ الرمز الآن — لن يظهر مرة أخرى.</b><span>يحفظ مسار بصمته فقط. يدخل به «' + esc(s.tokenFor) + '» من شاشة الدخول. إصدار رمز جديد يُبطل هذا الرمز.</span>' +
      '<div class="v"><code id="ustokv">' + esc(s.token) + '</code><button class="m-btn m-btn--primary" id="uscopy" data-us="copy">' + (s.copied ? "نُسخ" : "نسخ الرمز") + "</button></div></div>";
    return h + '</div><div class="m-dlg__f"><button class="m-btn" data-us="close">تم</button></div></div></div></div>';
  }
  h += '<div class="m-field"><label class="m-label m-req" for="usf_name">الاسم</label><input class="m-input" id="usf_name" data-usf="name" maxlength="' + USER_NAME_MAX + '" value="' + esc(d.name) + '"' + (s.field === "name" ? ' aria-invalid="true" aria-describedby="usferr"' : "") + ">" + (s.field === "name" ? '<span class="m-err" id="usferr" role="alert">' + esc(s.err) + "</span>" : "") + "</div>";
  h += '<div class="m-field"><span class="m-label m-req" id="usrole_l">الدور</span><div class="us-roles" role="radiogroup" aria-labelledby="usrole_l" id="usf_role">' +
    ROLES.map(function (r) { return '<button class="us-role" role="radio" aria-checked="' + (d.role === r) + '" tabindex="' + (d.role === r ? 0 : -1) + '" data-us="role" data-v="' + r + '"><i aria-hidden="true"></i><span><span class="t">' + esc(ROLE_LABELS[r]) + '</span><br><span class="d">' + esc(ROLE_DESCRIPTIONS[r]) + "</span></span></button>"; }).join("") + "</div></div>";
  if (d.role === "partner") {
    var ps = usData.partners || [];
    h += '<div class="m-field"><label class="m-label m-req" for="usf_partner">الشريك</label><select class="m-select" id="usf_partner" data-usf="partnerId"' + (s.field === "partnerId" ? ' aria-invalid="true" aria-describedby="usferr"' : "") + '><option value="">— اختر الشريك —</option>' +
      ps.map(function (p) { return '<option value="' + p.id + '"' + (String(p.id) === d.partnerId ? " selected" : "") + ">" + esc(p.name) + "</option>"; }).join("") + "</select>" +
      (ps.length ? '<span class="m-hint">يرى المستخدم شريكه فقط، ويسجّل نتائجه.</span>' : '<span class="m-hint">لا شركاء بعد؛ يضافون من <a class="m-link" href="#partners">شركاء المبيعات</a>.</span>') +
      (s.field === "partnerId" ? '<span class="m-err" id="usferr" role="alert">' + esc(s.err) + "</span>" : "") + "</div>";
  } else if ((usData.members || []).length) {
    h += '<div class="m-field"><label class="m-label" for="usf_member">عضو الفريق (اختياري)</label><select class="m-select" id="usf_member" data-usf="memberId"><option value="">— غير مرتبط —</option>' +
      usData.members.map(function (m) { return '<option value="' + m.id + '"' + (String(m.id) === d.memberId ? " selected" : "") + ">" + esc(m.name) + "</option>"; }).join("") + '</select><span class="m-hint">يربط الحساب بعضو في «الفريق».</span></div>';
  }
  if (s.mode === "edit") {
    h += '<div class="m-field"><span class="m-label">الحالة</span><span class="m-seg" role="radiogroup" aria-label="حالة المستخدم">' +
      [["active", "نشط"], ["disabled", "موقوف"]].map(function (x) { return '<button type="button" role="radio" aria-checked="' + (d.status === x[0]) + '" aria-pressed="' + (d.status === x[0]) + '" data-us="status" data-v="' + x[0] + '">' + x[1] + "</button>"; }).join("") +
      '</span><span class="m-hint">الموقوف لا يدخل برمزه حتى يُفعَّل.</span></div>';
  }
  h += '</div><div class="m-dlg__f"><button class="m-btn m-btn--primary" id="ussave" data-us="save"' + (s.busy ? ' disabled aria-busy="true"' : "") + ">" + (s.busy ? "جارٍ الحفظ…" : s.mode === "edit" ? "حفظ" : "إضافة وإصدار الرمز") + "</button>" +
    '<button class="m-btn" data-us="close">إلغاء</button>' + (s.err && s.field !== "name" && s.field !== "partnerId" ? '<span class="m-err" role="alert">' + esc(s.err) + "</span>" : "") + "</div></div></div></div>";
  return h;
}
function usSave() {
  var s = usSheet; if (!s || s.busy) return;
  var c = checkUser(s.d, (usData.partners || []).map(function (p) { return p.id; }), (usData.members || []).map(function (m) { return m.id; }));
  if (!c.ok) { s.err = c.reason; s.field = c.field; s.focus = c.field === "name" ? "usf_name" : c.field === "partnerId" ? "usf_partner" : ""; render(false); return; }
  s.busy = true; s.err = ""; s.field = ""; render(false);
  var body = { name: c.value.name, role: c.value.role, partnerId: c.value.partnerId, memberId: c.value.memberId };
  var req = s.mode === "edit" ? cfJson("PATCH", "/admin/users/" + s.id, Object.assign(body, { status: s.d.status, ifUpdatedAt: s.updatedAt })) : cfJson("POST", "/admin/users", body);
  req.then(function (r) {
    if (usSheet !== s) return;
    s.busy = false;
    if (!r.ok) { s.err = r.j.detail || "تعذّر الحفظ (" + fmtN(r.status) + ")"; s.field = r.j.field || ""; render(false); if (r.status === 409) usLoad(true); return; }
    usLoad(true);
    if (s.mode === "edit") { usClose(); if (typeof opToast === "function") opToast("حُفظ المستخدم «" + r.j.user.name + "»", false); return; }
    s.token = r.j.token; s.tokenFor = r.j.user.name; s.focus = "uscopy"; render(false);
  }).catch(function () { if (usSheet === s) { s.busy = false; s.err = "تعذّر الاتصال — لم يُحفظ شيء."; render(false); } });
}
function usRotate(id, from) {
  var u = (usData.users || []).filter(function (x) { return x.id === id; })[0]; if (!u) return;
  cfJson("POST", "/admin/users/" + id + "/token").then(function (r) {
    if (!r.ok) { if (typeof opToast === "function") opToast(r.j.detail || "تعذّر إصدار الرمز", true); return; }
    usLoad(true);
    usSheet = { mode: "token", id: id, from: from, d: {}, token: r.j.token, tokenFor: u.name, err: "", field: "", busy: false, shown: false, focus: "uscopy" };
    render(false);
  });
}

/* ---------------- audit ---------------- */
var auData = null, auLoading = false, auFailed = false, auF = { who: "", action: "" }, auMore = false;
function auLoad(reset) {
  if (auLoading) return;
  auLoading = true;
  var before = !reset && auData && auData.next ? "&before=" + auData.next : "";
  pxGet("/admin/audit?limit=100" + (auF.who ? "&who=" + encodeURIComponent(auF.who) : "") + (auF.action ? "&action=" + encodeURIComponent(auF.action) : "") + before)
    .then(function (j) { if (!reset && auData) { auData.rows = auData.rows.concat(j.rows); auData.next = j.next; } else auData = j; auFailed = false; })
    .catch(function () { auFailed = true; }).then(function () { auLoading = false; render(false); });
}
var AU_DETAIL_LABELS = { product: "المنتج", name: "الاسم", stage: "المرحلة", status: "الحالة", decision: "القرار", verdict: "التقييم", week: "الأسبوع", source: "المصدر", kind: "النوع", role: "الدور", result: "النتيجة", title: "العنوان", lost_reason: "سبب الخسارة", outcome: "النتيجة", account_name: "العميل", objective: "الهدف" };
function vAudit() {
  if (!auData && !auFailed) auLoad(true);
  if (!auData) {
    return '<div class="ds6"><div class="m-empty"' + (auFailed
      ? ' role="alert"><div class="m-empty__t">تعذّر تحميل السجل</div>' +
        '<div class="m-empty__a"><button class="m-btn" data-au="retry">أعد المحاولة</button></div>'
      : ' role="status" aria-busy="true"><div class="m-empty__t">جارٍ تحميل السجل…</div>') +
      "</div></div>";
  }
  var sel = function (key, label, opts) {
    return '<select class="m-select" aria-label="' + label + '" data-auset="' + key + '">' +
      '<option value="">' + label + ": الكل</option>" +
      opts.map(function (o) {
        return '<option value="' + esc(o[0]) + '"' + (auF[key] === o[0] ? " selected" : "") + ">" +
          esc(o[1]) + "</option>";
      }).join("") + "</select>";
  };

  var h = '<div class="ds6"><section class="m-card m-card--pad0">' +
    '<div class="m-card__h"><div class="m-section-head__t">' +
    '<h2 class="m-card__t">سجل التدقيق</h2>' +
    '<p class="m-meta">كل حفظ ناجح: المنفّذ ودوره وما حفظه ووقته</p></div>' +
    '<div class="m-row">' +
      sel("who", "المستخدم", auData.facets.who.map(function (w) { return [w.key, w.label]; })) +
      sel("action", "العملية", auData.facets.actions.map(function (a2) { return [a2, a2]; })) +
    "</div></div>";

  if (!auData.rows.length) {
    h += '<div class="m-empty"><div class="m-empty__t">' +
      (auF.actor || auF.action ? "لا عمليات مطابقة لهذه التصفية" : "لا عمليات مسجّلة بعد") +
      "</div></div>";
  } else {
    h += '<div class="m-tablewrap"><table class="m-table"><thead><tr>' +
      "<th>الوقت</th><th>المستخدم</th><th>العملية</th><th>التفاصيل</th>" +
      "</tr></thead><tbody>";
    auData.rows.forEach(function (r) {
      var d = r.detail || {};
      var chips = Object.keys(d).slice(0, 6).map(function (k) {
        var v = d[k];
        /* A count inside a detail chip is still a number: it goes through the isolate like any
           other, or it renders on the wrong side of its label. */
        var txt = v && typeof v === "object" && "count" in v
          ? 'العدد <span class="m-n">' + fmtN(v.count) + "</span>"
          : esc(String(v));
        return '<span class="m-chip">' + esc(AU_DETAIL_LABELS[k] || k) + ": " + txt + "</span>";
      }).join(" ");
      h += '<tr><td class="m-cap"><time>' +
        esc(new Date(r.at).toLocaleString("ar-SA-u-ca-gregory-nu-latn",
          { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })) + "</time></td>" +
        '<td class="m-td-n">' + esc(r.userId == null ? "مدير النظام" : r.actor) +
          '<span class="m-cap" style="display:block">' +
          esc(r.userId == null ? "الرمز الرئيسي" : (ROLE_LABELS[r.role] || r.role)) + "</span></td>" +
        "<td>" + esc(r.action) +
          (r.entityId ? '<span class="m-cap" style="display:block">' + esc(r.entityId) + "</span>" : "") +
        "</td>" +
        "<td>" + (chips || '<span class="m-td-nil m-nil--none">لا تفاصيل</span>') + "</td></tr>";
    });
    h += "</tbody></table></div>";
  }

  if (auData.next) {
    h += '<div class="m-tools"><button class="m-btn" data-au="more"' +
      (auLoading ? " disabled" : "") + ">عرض أقدم</button></div>";
  }
  return h + "</section></div>";
}

function usAfterPaint() {
  if (!usSheet) return;
  /* The list reloads behind the token sheet; its repaint must not take focus off «نسخ الرمز». */
  if (usSheet.token && !usSheet.focus && (document.activeElement === document.body || !document.activeElement)) usSheet.focus = "uscopy";
  if (!usSheet.shown && document.querySelector(".ac-box")) {
    requestAnimationFrame(function () { if (!usSheet) return; document.querySelectorAll(".ac-scrim, .ac-box").forEach(function (el) { el.classList.add("in"); }); usSheet.shown = true; });
  }
  if (usSheet.focus) { var el = document.getElementById(usSheet.focus); usSheet.focus = ""; if (el) el.focus(); }
}
window.addEventListener("hashchange", function () { usSheet = null; });
document.addEventListener("click", function (ev) {
  var t = ev.target && ev.target.closest ? ev.target.closest("[data-us],[data-au]") : null;
  if (!t) return;
  var a = t.getAttribute("data-us"), au = t.getAttribute("data-au"), id = Number(t.getAttribute("data-i"));
  if (au === "retry") { auFailed = false; auLoad(true); render(false); return; }
  if (au === "more") { auLoad(false); return; }
  if (a === "retry") { usFailed = false; usLoad(true); render(false); return; }
  if (a === "new") { if (usData) usOpen("new", 0, t.id || "usnewtop"); return; }
  if (a === "edit") { usOpen("edit", id, t.id); return; }
  if (a === "token") { usRotate(id, t.id); return; }
  if (!usSheet) return;
  if (a === "close") { usClose(); return; }
  if (a === "save") { usSave(); return; }
  if (a === "copy") {
    var done = function () { if (usSheet) { usSheet.copied = true; usSheet.focus = "uscopy"; render(false); } };
    try { navigator.clipboard.writeText(usSheet.token).then(done, function () { var r = document.createRange(); r.selectNodeContents(document.getElementById("ustokv")); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }); } catch (x) {}
    return;
  }
  if (a === "role" || a === "status") { usSheet.d[a] = t.getAttribute("data-v"); usSheet.dirty = true; if (usSheet.field === "role") { usSheet.err = ""; usSheet.field = ""; } render(false); var b = document.querySelector('[data-us="' + a + '"][data-v="' + usSheet.d[a] + '"]'); if (b) b.focus(); return; }
});
document.addEventListener("input", function (ev) { var t = ev.target; if (usSheet && t && t.getAttribute && t.getAttribute("data-usf") === "name") { usSheet.d.name = t.value; usSheet.dirty = true; } });
document.addEventListener("change", function (ev) {
  var t = ev.target; if (!t || !t.getAttribute) return;
  var k = t.getAttribute("data-usf"); if (usSheet && k && k !== "name") { usSheet.d[k] = t.value; usSheet.dirty = true; if (usSheet.field === k) { usSheet.err = ""; usSheet.field = ""; render(false); } return; }
  var f = t.getAttribute("data-auset"); if (f) { auF[f] = t.value; auData = null; auLoad(true); render(false); var again = document.querySelector('[data-auset="' + f + '"]'); if (again) again.focus(); }
});
document.addEventListener("keydown", function (ev) {
  if (!usSheet || !document.querySelector(".us .ac-box")) return;
  if (ev.key === "Escape") { ev.preventDefault(); usClose(); return; }
  var rg = ev.target && ev.target.closest ? ev.target.closest("#usf_role") : null;
  if (rg && (ev.key === "ArrowDown" || ev.key === "ArrowUp")) {
    ev.preventDefault(); var i = ROLES.indexOf(usSheet.d.role) + (ev.key === "ArrowDown" ? 1 : -1);
    usSheet.d.role = ROLES[(i + ROLES.length) % ROLES.length]; render(false); var nb = document.querySelector('[data-us="role"][data-v="' + usSheet.d.role + '"]'); if (nb) nb.focus(); return;
  }
  if (ev.key !== "Tab") return;
  var box = document.querySelector(".us .ac-box");
  var items = Array.prototype.filter.call(box.querySelectorAll("button, input, select, a[href]"), function (el) { return !el.disabled && el.offsetParent !== null && el.tabIndex !== -1; });
  if (!items.length) return;
  var first = items[0], last = items[items.length - 1];
  if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
  else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
  else if (!box.contains(document.activeElement)) { ev.preventDefault(); first.focus(); }
});
if (typeof TOKEN !== "undefined" && TOKEN) setTimeout(meLoad, 0);
/* ================= end roles and users ================= */
`;
