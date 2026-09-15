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
// GRAMMAR. Settings table (.cf-sec/.cf-hr/.cf-r), .cf-pill, the account sheet (.ac-scrim/.ac-modal/.ac-box).
// MOTION: the sheet's 200ms/140ms; nothing else animates.
//
// NO BACKTICKS ANYWHERE IN THIS FILE, comments included: it is one template literal.

export const USERS_CRM_CSS = `
.us { display:flex; flex-direction:column; gap:var(--s3); container-type:inline-size; container-name:usw; }
.us-sec .hd { display:flex; align-items:center; gap:var(--s2); flex-wrap:wrap; padding:var(--s3) var(--s4); border-bottom:1px solid var(--line-soft); }
.us-sec .hd h2 { margin:0; font-size:var(--t-md); font-weight:600; color:var(--ink); }
.us-sec .hd .s { font-size:var(--t-xs); color:var(--muted); }
.us-sec .hd .sp { flex:1; }
.us-sec .hd .btn { height:34px; display:inline-flex; align-items:center; gap:6px; }
.us-t .cf-hr, .us-t .cf-r { grid-template-columns:minmax(160px,1.4fr) minmax(0,1fr) minmax(0,1fr) 90px 110px minmax(200px,auto); column-gap:var(--s2); }
.us-t .acts { display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end; }
.us-t .acts .btn { height:30px; padding-inline:10px; font-size:var(--t-xs); }
.us-hint { font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:var(--t-xs); color:var(--muted); direction:ltr; unicode-bidi:isolate; }
.cf-pill.rl-admin { background:var(--accent-tint); color:var(--accent-deep); }
.cf-pill.rl-partner { background:var(--s-attn-soft); color:var(--s-attn-text); }
.cf-pill.st-disabled { background:var(--surface-2); color:var(--muted); }
.us-mx { overflow-x:auto; }
.us-mx table { width:100%; border-collapse:collapse; font-size:var(--t-sm); min-width:620px; }
.us-mx th { font-size:var(--t-xs); font-weight:600; color:var(--muted); background:var(--surface); padding:8px var(--s3); text-align:center; white-space:nowrap; }
.us-mx th:first-child, .us-mx td:first-child { text-align:start; }
.us-mx td { padding:8px var(--s3); border-top:1px solid var(--line-soft); text-align:center; color:var(--ink); }
.us-mx .full { color:var(--s-issued-text); font-weight:600; }
.us-mx .view { color:var(--accent-deep); }
.us-mx .none { color:var(--muted); }
.us-mx caption { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
.us-roles { display:flex; flex-direction:column; gap:6px; }
.us-role { display:flex; gap:var(--s2); align-items:flex-start; text-align:start; font-family:inherit; border:none; border-radius:var(--r-md); padding:10px 12px; cursor:pointer;
  background:var(--paper); box-shadow:inset 0 0 0 1px var(--line); color:var(--ink); }
.us-role[aria-checked="true"] { box-shadow:inset 0 0 0 2px var(--accent); background:var(--accent-wash); }
.us-role .t { font-size:var(--t-sm); font-weight:600; }
.us-role .d { font-size:var(--t-xs); color:var(--muted); line-height:1.6; }
.us-role i { width:16px; height:16px; flex:none; border-radius:var(--r-pill); box-shadow:inset 0 0 0 1.5px var(--s-off-mark); margin-top:2px; }
.us-role[aria-checked="true"] i { box-shadow:inset 0 0 0 5px var(--accent); }
.us-tok { display:flex; flex-direction:column; gap:var(--s2); border-radius:var(--r-md); padding:var(--s3); background:var(--s-attn-soft); color:var(--s-attn-text); }
.us-tok .v { display:flex; gap:var(--s2); align-items:center; flex-wrap:wrap; }
.us-tok code { font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:var(--t-sm); background:var(--paper); color:var(--ink); padding:6px 10px; border-radius:var(--r-sm); direction:ltr; unicode-bidi:isolate; word-break:break-all; }
.au-f { display:flex; gap:var(--s2); flex-wrap:wrap; align-items:center; padding:var(--s2) var(--s4); border-bottom:1px solid var(--line-soft); background:var(--surface); }
.au-f select { font-family:inherit; height:34px; max-width:240px; font-size:var(--t-xs); color:var(--ink); background:var(--paper); border:none; box-shadow:inset 0 0 0 1px var(--s-off-mark); border-radius:var(--r-sm); padding-inline:8px; }
.au-row { display:grid; grid-template-columns:130px minmax(140px,1fr) minmax(180px,1.6fr) minmax(0,1.4fr); gap:var(--s2); padding:10px var(--s4); border-top:1px solid var(--line-soft); font-size:var(--t-sm); align-items:baseline; }
.au-row time { font-size:var(--t-xs); color:var(--muted); font-variant-numeric:tabular-nums; white-space:nowrap; }
.au-row .who .r { display:block; font-size:var(--t-xs); color:var(--muted); }
.au-row .dt { display:flex; gap:4px; flex-wrap:wrap; }
.au-row .dt span { font-size:var(--t-xs); background:var(--surface); border-radius:var(--r-pill); padding:0 8px; color:var(--ink); max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.us-deny { padding:var(--s5, 32px) var(--s4); text-align:center; display:flex; flex-direction:column; gap:var(--s2); align-items:center; }
.us-deny b { font-size:var(--t-md); color:var(--ink); }
.us-deny span { font-size:var(--t-sm); color:var(--muted); }
.us .btn:active, .us-role:active { transform:scale(.97); }
.us .btn, .us-role { transition:transform 140ms var(--ease), background var(--fast) var(--ease), box-shadow var(--fast) var(--ease); }
.us button:focus-visible, .us select:focus-visible, .us-role:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
@container usw (max-width: 860px) {
  .us-t .cf-hr { display:none; }
  .us-t .cf-r { grid-template-columns:minmax(0,1fr) auto; row-gap:6px; padding-block:var(--s3); }
  .us-t .cf-r > :first-child, .us-t .acts { grid-column:1 / -1; justify-content:flex-start; }
  .au-row { grid-template-columns:minmax(0,1fr); gap:2px; }
}
@media (prefers-reduced-motion: reduce) { .us .btn, .us-role { transition:none; } .us .btn:active, .us-role:active { transform:none; } }
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
function vDenied(route) {
  return '<div class="us"><section class="cf-sec"><div class="us-deny" role="alert"><b>لا تملك صلاحية فتح هذه الشاشة</b><span>دورك: ' + esc(ME ? ME.roleLabel : "") +
    ". اطلب الصلاحية من مدير النظام.</span>" + '<a class="btn btn-ghost" href="#' + esc(ME ? ME.home : "home") + '" style="text-decoration:none">العودة إلى شاشتك</a></div></section></div>';
}

/* ---------------- users ---------------- */
var usData = null, usLoading = false, usFailed = false, usSheet = null;
function usLoad(force) {
  if (usLoading || (usData && !force) || (usFailed && !force)) return;
  usLoading = true;
  pxGet("/admin/users").then(function (j) { usData = j; usFailed = false; }).catch(function () { usFailed = true; })
    .then(function () { usLoading = false; render(false); });
}
function usWhen(ms) { return ms ? new Date(Number(ms)).toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "short" }) : "—"; }
function vUsers() {
  usLoad(false);
  setTimeout(function () {
    var act = document.getElementById("crumbact");
    if (act && (location.hash || "").slice(1) === "users" && !document.getElementById("usnewtop"))
      act.innerHTML = '<button class="btn btn-teal ac-newtop" id="usnewtop" data-us="new">' + (typeof opIco === "function" ? opIco("plus") : "") + '<span class="lg">إضافة مستخدم</span><span class="sm">مستخدم</span></button>';
  }, 0);
  var h = '<div class="us">';
  if (!usData) return h + '<section class="cf-sec"><div class="cf-state"' + (usFailed ? ' role="alert">تعذّر تحميل المستخدمين.<button class="btn btn-ghost" data-us="retry">أعد المحاولة</button>' : ' role="status">جارٍ تحميل المستخدمين…') + "</div></section></div>" + usModal();
  var users = usData.users || [];
  h += '<section class="cf-sec us-sec us-t"><div class="hd"><h2>المستخدمون</h2><span class="s">' + (users.length ? pluralizeArabic(users.length, "مستخدم واحد", "مستخدمان", "مستخدمين", "مستخدمًا", fmtN) : "") +
    " · يدخل كل مستخدم برمزه، ويبقى الرمز الرئيسي لمدير النظام صالحًا</span></div>";
  if (!users.length) {
    h += '<div class="crm-empty" style="padding:var(--s4)"><b>لا مستخدمون بعد</b>أضف لكل شخص حسابًا بدور من أدوار الوثيقة: تنفيذي، مدير منتج، مبيعات، شريك، مدير نظام. يرى كل دور ما يسمح به فقط.' +
      '<div class="in-row" style="margin-top:var(--s3)"><button class="btn btn-teal" id="usnewempty" data-us="new">إضافة مستخدم</button></div></div>';
  } else {
    h += '<div class="cf-t"><div class="cf-hr" role="row"><span>الاسم</span><span>الدور</span><span>الشريك</span><span>الرمز</span><span>آخر نشاط</span><span></span></div>';
    users.forEach(function (u) {
      h += '<div class="cf-r"><span class="ac-nm"><span class="ac-clip">' + esc(u.name) + '</span><span class="cf-sub">أضافه ' + esc(u.createdBy === "اللوحة" ? "مدير النظام" : (u.createdBy || "—")) + " · " + usWhen(u.createdAt) + "</span></span>" +
        '<span><span class="cf-pill rl-' + esc(u.role) + '">' + esc(ROLE_LABELS[u.role] || u.role) + "</span>" + (u.status === "disabled" ? ' <span class="cf-pill st-disabled">موقوف</span>' : "") + "</span>" +
        '<span class="ac-clip">' + (u.partnerName ? esc(u.partnerName) : '<span class="cf-sub">—</span>') + "</span>" +
        '<span class="us-hint" title="آخر أربعة أحرف من الرمز">…' + esc(u.tokenHint) + "</span>" +
        '<span class="cf-sub">' + usWhen(u.lastSeenAt) + "</span>" +
        '<span class="acts"><button class="btn btn-ghost" id="usedit' + u.id + '" data-us="edit" data-i="' + u.id + '">تعديل</button>' +
        '<button class="btn btn-ghost" id="ustok' + u.id + '" data-us="token" data-i="' + u.id + '">رمز جديد</button></span></div>';
    });
    h += "</div>";
  }
  h += "</section>";
  h += '<section class="cf-sec us-sec"><div class="hd"><h2>مصفوفة الصلاحيات</h2><span class="s">من الوثيقة (§22): ✓ صلاحية كاملة · عرض · — لا وصول</span></div><div class="us-mx"><table><caption>الصلاحيات حسب الدور</caption><thead><tr><th scope="col">الوظيفة</th>' +
    ROLES.map(function (r) { return '<th scope="col">' + esc(ROLE_LABELS[r]) + "</th>"; }).join("") + "</tr></thead><tbody>" +
    MATRIX_ROWS.map(function (row) {
      return '<tr><th scope="row" style="background:none;font-weight:500;color:var(--ink)">' + esc(row.label) + "</th>" + ROLES.map(function (r) {
        var c = matrixCell(r, row); return '<td class="' + c + '">' + (c === "full" ? "✓" : c === "view" ? "عرض" : "—") + "</td>";
      }).join("") + "</tr>";
    }).join("") + "</tbody></table></div></section>";
  return h + "</div>" + usModal();
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
  var h = '<div class="us"><div class="ac-scrim' + cls + '" data-us="close"></div><div class="ac-modal"><div class="ac-box' + cls + '" role="dialog" aria-modal="true" aria-labelledby="usmt">' +
    '<div class="mh"><div><h2 id="usmt">' + title + '</h2></div><span class="sp"></span><button class="ac-x" data-us="close" aria-label="إغلاق">' + (typeof opIco === "function" ? opIco("x") : "×") + '</button></div><div class="mb">';
  if (s.token) {
    h += '<div class="us-tok" role="alert"><b>انسخ الرمز الآن — لن يظهر مرة أخرى.</b><span>يحفظ مسار بصمته فقط. يدخل به «' + esc(s.tokenFor) + '» من شاشة الدخول. إصدار رمز جديد يُبطل هذا الرمز.</span>' +
      '<div class="v"><code id="ustokv">' + esc(s.token) + '</code><button class="btn btn-teal" id="uscopy" data-us="copy">' + (s.copied ? "نُسخ" : "نسخ الرمز") + "</button></div></div>";
    return h + '</div><div class="mf"><button class="btn btn-ghost" data-us="close">تم</button></div></div></div></div>';
  }
  h += '<div class="cf-fl"><label for="usf_name">الاسم <span class="req" aria-hidden="true">*</span></label><input class="inp" id="usf_name" data-usf="name" maxlength="' + USER_NAME_MAX + '" value="' + esc(d.name) + '"' + (s.field === "name" ? ' aria-invalid="true" aria-describedby="usferr"' : "") + ">" + (s.field === "name" ? '<span class="ferr" id="usferr" role="alert">' + esc(s.err) + "</span>" : "") + "</div>";
  h += '<div class="cf-fl"><span class="cf-sub" id="usrole_l">الدور <span class="req" aria-hidden="true">*</span></span><div class="us-roles" role="radiogroup" aria-labelledby="usrole_l" id="usf_role">' +
    ROLES.map(function (r) { return '<button class="us-role" role="radio" aria-checked="' + (d.role === r) + '" tabindex="' + (d.role === r ? 0 : -1) + '" data-us="role" data-v="' + r + '"><i aria-hidden="true"></i><span><span class="t">' + esc(ROLE_LABELS[r]) + '</span><br><span class="d">' + esc(ROLE_DESCRIPTIONS[r]) + "</span></span></button>"; }).join("") + "</div></div>";
  if (d.role === "partner") {
    var ps = usData.partners || [];
    h += '<div class="cf-fl"><label for="usf_partner">الشريك <span class="req" aria-hidden="true">*</span></label><select id="usf_partner" data-usf="partnerId"' + (s.field === "partnerId" ? ' aria-invalid="true" aria-describedby="usferr"' : "") + '><option value="">— اختر الشريك —</option>' +
      ps.map(function (p) { return '<option value="' + p.id + '"' + (String(p.id) === d.partnerId ? " selected" : "") + ">" + esc(p.name) + "</option>"; }).join("") + "</select>" +
      (ps.length ? '<span class="hint">يرى هذا المستخدم شريكه فقط، ويسجّل نتائجه.</span>' : '<span class="hint">لا شركاء بعد — أضفهم من <a href="#partners">شركاء المبيعات</a>.</span>') +
      (s.field === "partnerId" ? '<span class="ferr" id="usferr" role="alert">' + esc(s.err) + "</span>" : "") + "</div>";
  } else if ((usData.members || []).length) {
    h += '<div class="cf-fl"><label for="usf_member">عضو الفريق (اختياري)</label><select id="usf_member" data-usf="memberId"><option value="">— غير مرتبط —</option>' +
      usData.members.map(function (m) { return '<option value="' + m.id + '"' + (String(m.id) === d.memberId ? " selected" : "") + ">" + esc(m.name) + "</option>"; }).join("") + '</select><span class="hint">يربط الحساب بعضو في «الفريق».</span></div>';
  }
  if (s.mode === "edit") {
    h += '<div class="cf-fl"><span class="cf-sub">الحالة</span><span class="vtog" role="radiogroup" aria-label="حالة المستخدم">' +
      [["active", "نشط"], ["disabled", "موقوف"]].map(function (x) { return '<button role="radio" aria-checked="' + (d.status === x[0]) + '" class="' + (d.status === x[0] ? "on" : "") + '" data-us="status" data-v="' + x[0] + '">' + x[1] + "</button>"; }).join("") +
      '</span><span class="hint">الموقوف لا يدخل برمزه حتى يُفعَّل.</span></div>';
  }
  h += '</div><div class="mf"><button class="btn btn-teal" id="ussave" data-us="save"' + (s.busy ? ' disabled aria-busy="true"' : "") + ">" + (s.busy ? "جارٍ الحفظ…" : s.mode === "edit" ? "حفظ" : "إضافة وإصدار الرمز") + "</button>" +
    '<button class="btn btn-ghost" data-us="close">إلغاء</button>' + (s.err && s.field !== "name" && s.field !== "partnerId" ? '<span class="cf-err msg" role="alert">' + esc(s.err) + "</span>" : "") + "</div></div></div></div>";
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
  var h = '<div class="us">';
  if (!auData) return h + '<section class="cf-sec"><div class="cf-state"' + (auFailed ? ' role="alert">تعذّر تحميل السجل.<button class="btn btn-ghost" data-au="retry">أعد المحاولة</button>' : ' role="status">جارٍ تحميل السجل…') + "</div></section></div>";
  var sel = function (key, label, opts) {
    return '<select aria-label="' + label + '" data-auset="' + key + '"><option value="">' + label + ": الكل</option>" + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (auF[key] === o[0] ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select>";
  };
  h += '<section class="cf-sec us-sec"><div class="hd"><h2>سجل التدقيق</h2><span class="s">كل عملية حفظ ناجحة: من، وبأي دور، وماذا، ومتى</span></div>' +
    '<div class="au-f">' + sel("who", "المستخدم", auData.facets.who.map(function (w) { return [w.key, w.label]; })) + sel("action", "العملية", auData.facets.actions.map(function (a) { return [a, a]; })) + "</div>";
  if (!auData.rows.length) h += '<div class="cf-state">لا عمليات مسجّلة' + (auF.actor || auF.action ? " لهذه التصفية." : " بعد.") + "</div>";
  auData.rows.forEach(function (r) {
    var d = r.detail || {}, chips = Object.keys(d).slice(0, 6).map(function (k) {
      var v = d[k]; var txt = v && typeof v === "object" && "count" in v ? "العدد " + fmtN(v.count) : String(v);
      return "<span>" + esc((AU_DETAIL_LABELS[k] || k) + ": " + txt) + "</span>";
    }).join("");
    h += '<div class="au-row"><time>' + new Date(r.at).toLocaleString("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) + "</time>" +
      '<span class="who">' + esc(r.userId == null ? "مدير النظام" : r.actor) + '<span class="r">' + esc(r.userId == null ? "الرمز الرئيسي" : (ROLE_LABELS[r.role] || r.role)) + "</span></span>" +
      "<span>" + esc(r.action) + (r.entityId ? ' <span class="cf-sub">· ' + esc(r.entityId) + "</span>" : "") + '</span><span class="dt">' + chips + "</span></div>";
  });
  if (auData.next) h += '<div class="ac-more"><button class="btn btn-ghost" data-au="more"' + (auLoading ? " disabled" : "") + ">عرض أقدم</button></div>";
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
