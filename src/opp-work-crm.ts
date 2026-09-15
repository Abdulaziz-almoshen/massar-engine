// opp-work-crm.ts — the work recorded on an opportunity, inside the «فرص البيع» drawer (client A, BRD v1.0
// §15, slice S3): the lost-reason dialog every close-as-lost path goes through (BRULE-009), «الأنشطة»
// (meetings, calls, presentations, emails, notes with a dated next step — BR-OPP-003) and «عروض الأسعار»
// (BR-OPP-004). Rules come from opp-work-domain (OPP_WORK_DOMAIN_JS).
//
// GRAMMAR. Sections are the drawer's own .ox-sec/.ox-sech, fields .ox-fld/.inp, lists follow the
// escalation list's rhythm. The dialog is centred (it is a modal, so it scales from the centre), 200ms in
// and 140ms out with a strong ease-out, reduced motion keeps only the fade.
//
// NO BACKTICKS ANYWHERE IN THIS FILE, comments included: it is one template literal.

export const OPP_WORK_CRM_CSS = `
.ow-scrim { position:fixed; inset:0; background:rgba(16,24,40,.42); z-index:var(--z-toast); opacity:0; transition:opacity 140ms var(--ease); }
.ow-scrim.in { opacity:1; transition-duration:200ms; }
.ow-lossm { position:fixed; inset:0; z-index:var(--z-toast); display:flex; align-items:flex-start; justify-content:center; padding:10vh var(--s3) var(--s3); pointer-events:none; }
.ow-box { pointer-events:auto; width:100%; max-width:520px; background:var(--paper); border:1px solid var(--line); border-radius:var(--r-lg);
  box-shadow:0 24px 60px rgba(16,24,40,.22); display:flex; flex-direction:column; max-height:80vh; opacity:0; transform:scale(.96);
  transition:opacity 140ms cubic-bezier(.23,1,.32,1), transform 140ms cubic-bezier(.23,1,.32,1); }
.ow-box.in { opacity:1; transform:none; transition-duration:200ms; }
.ow-box .mh { padding:var(--s4) var(--s4) var(--s2); }
.ow-box .mh h2 { margin:0; font-size:var(--t-lg); font-weight:600; color:var(--ink); }
.ow-box .mh .s { font-size:var(--t-xs); color:var(--muted); margin-top:4px; line-height:1.6; }
.ow-box .mb { padding:var(--s2) var(--s4); overflow:auto; display:flex; flex-direction:column; gap:var(--s3); }
.ow-box .mf { display:flex; gap:var(--s2); align-items:center; flex-wrap:wrap; padding:var(--s3) var(--s4); border-top:1px solid var(--line-soft); }
.ow-box .mf .btn { height:38px; font-size:var(--t-sm); }
.ow-reasons { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:6px; }
.ow-reason { font-family:inherit; display:flex; flex-direction:column; align-items:flex-start; gap:2px; text-align:start; min-height:52px; padding:8px 10px;
  border:none; border-radius:var(--r-md); background:var(--paper); box-shadow:inset 0 0 0 1px var(--s-off-mark); cursor:pointer;
  transition:transform 140ms var(--ease), background var(--fast) var(--ease), box-shadow var(--fast) var(--ease); }
.ow-reason .l { font-size:var(--t-sm); font-weight:600; color:var(--ink); }
.ow-reason .h { font-size:var(--t-xs); color:var(--muted); line-height:1.5; }
.ow-reason[aria-checked="true"] { background:var(--s-fail-soft); box-shadow:inset 0 0 0 2px var(--s-fail); }
.ow-reason[aria-checked="true"] .l { color:var(--s-fail-text); }
.ow-reason:active, .ow-sec .btn:active, .ow-box .btn:active, .ow-kind button:active { transform:scale(.97); }
.ow-reason:focus-visible, .ow-kind button:focus-visible, .ow-lnk:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
.ow-ta { font-family:inherit; width:100%; font-size:var(--t-sm); color:var(--ink); background:var(--paper); border:none; box-shadow:inset 0 0 0 1px var(--s-off-mark);
  border-radius:var(--r-sm); padding:8px 10px; line-height:var(--lh-body); resize:vertical; min-height:60px; }
.ow-ta:focus { outline:none; box-shadow:inset 0 0 0 2px var(--accent), 0 0 0 3px var(--accent-tint); }
.ow-ta[aria-invalid="true"] { box-shadow:inset 0 0 0 2px var(--s-fail); }
.ow-err { font-size:var(--t-xs); color:var(--s-fail-text); display:flex; align-items:center; gap:6px; flex-basis:100%; }
.ow-lost { display:flex; flex-direction:column; gap:4px; margin-top:var(--s2); padding:var(--s2) var(--s3); border-radius:var(--r-md); background:var(--s-fail-soft); font-size:var(--t-sm); color:var(--s-fail-text); }
.ow-lost .r { display:flex; align-items:center; gap:var(--s2); flex-wrap:wrap; }
.ow-lost b { font-weight:600; }
.ow-lost .n { color:var(--ink); font-size:var(--t-xs); line-height:1.6; overflow-wrap:anywhere; }
.ow-lnk { font-family:inherit; font-size:var(--t-xs); font-weight:600; color:var(--accent-deep); background:none; border:none; padding:0 4px; cursor:pointer; min-height:28px; border-radius:var(--r-sm); }
.ow-sec .ow-top { display:flex; align-items:center; gap:var(--s2); flex-wrap:wrap; }
.ow-sec .ow-top .sp { flex:1; }
.ow-sec .ow-top .btn { height:32px; font-size:var(--t-xs); padding-inline:10px; gap:4px; }
.ow-form { display:flex; flex-direction:column; gap:var(--s2); margin-top:var(--s2); padding:var(--s3); border-radius:var(--r-md); background:var(--surface); }
.ow-form .ow-btns { display:flex; gap:var(--s2); align-items:center; flex-wrap:wrap; }
.ow-form .ow-btns .btn { height:36px; font-size:var(--t-sm); }
.ow-kind { display:flex; flex-wrap:wrap; gap:6px; }
.ow-kind button { font-family:inherit; min-height:32px; font-size:var(--t-xs); font-weight:500; color:var(--ink); background:var(--paper); border:none;
  box-shadow:inset 0 0 0 1px var(--s-off-mark); border-radius:var(--r-pill); padding:0 12px; cursor:pointer; transition:transform 140ms var(--ease); }
.ow-kind button[aria-checked="true"] { background:var(--accent-tint); color:var(--accent-deep); box-shadow:inset 0 0 0 1px var(--accent-mark); font-weight:600; }
.ow-list { display:flex; flex-direction:column; margin-top:var(--s2); }
.ow-row { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:4px var(--s2); padding:var(--s2) 0; border-top:1px solid var(--line-soft); font-size:var(--t-sm); color:var(--ink); }
.ow-row .k { font-size:var(--t-xs); font-weight:600; color:var(--accent-deep); }
.ow-row .d { font-size:var(--t-xs); color:var(--muted); white-space:nowrap; text-align:end; }
.ow-row .tx { grid-column:1 / -1; line-height:1.6; overflow-wrap:anywhere; }
.ow-row .nx { grid-column:1 / -1; font-size:var(--t-xs); color:var(--ink-2, #33373E); display:flex; gap:6px; flex-wrap:wrap; align-items:center; }
.ow-row .nx b { font-weight:600; color:var(--ink); }
.ow-row .m { grid-column:1 / -1; font-size:var(--t-xs); color:var(--muted); display:flex; gap:var(--s2); flex-wrap:wrap; align-items:center; }
.ow-row .acts { grid-column:1 / -1; display:flex; gap:6px; flex-wrap:wrap; align-items:center; }
.ow-row .acts .btn { height:30px; font-size:var(--t-xs); padding-inline:10px; }
.ow-amt { font-weight:600; font-variant-numeric:tabular-nums; white-space:nowrap; }
.cf-pill.q-draft { background:var(--surface-2); color:var(--muted); }
.cf-pill.q-sent { background:var(--s-attn-soft); color:var(--s-attn-text); }
.cf-pill.q-accepted { background:var(--s-issued-soft); color:var(--s-issued-text); }
.cf-pill.q-rejected { background:var(--s-fail-soft); color:var(--s-fail-text); }
.ow-total { font-size:var(--t-sm); color:var(--ink); }
.ow-total b { font-variant-numeric:tabular-nums; }
.ow-chk { display:inline-flex; align-items:center; gap:6px; font-size:var(--t-xs); color:var(--ink); }
@media (max-width: 560px) { .ow-reasons { grid-template-columns:minmax(0,1fr); } .ow-lossm { padding:0; align-items:stretch; } .ow-box { max-width:none; max-height:none; border-radius:0; } }
@media (pointer:coarse) { .ow-kind button, .ow-lnk, .ow-sec .ow-top .btn, .ow-row .acts .btn { min-height:44px; } }
@media (prefers-reduced-motion: reduce) {
  .ow-box { transform:none; transition:opacity 140ms linear; }
  .ow-reason, .ow-kind button { transition:none; }
  .ow-reason:active, .ow-sec .btn:active, .ow-box .btn:active, .ow-kind button:active { transform:none; }
}
`;

export const OPP_WORK_CRM_JS = `
/* ================= opportunity work: lost reason · activities · quotes ================= */
var owLoss = null;     /* { ids, name, mode: "close"|"bulk"|"edit", stage, reason, note, err, field, busy, from, shown } */
var owWork = {};       /* oppId -> { data, failed, loading } */
var owAct = null;      /* the activity form: { oppId, kind, occurredOn, summary, nextStep, nextOn, owner, dept, err, field, busy } */
var owQuote = null;    /* the quote form: { oppId, salePrice, years, qty, discount, validUntil, note, err, field, busy } */
var owQBusy = 0, owDelArm = 0;
/* Where focus belongs once the work list has re-read: every save repaints the drawer twice (saved, then
   loaded), and a focus set between the two was dropped on the second (QA). */
var owFocus = { id: "", opp: 0 };
function owFocusAfter(id, oppId) { owFocus = { id: id, opp: oppId }; }

function owToday() { return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" }); }
function owDay(iso) {
  if (!iso) return "";
  var d = new Date(String(iso) + "T00:00:00");
  if (isNaN(d.getTime())) return esc(String(iso));
  var o = d.getFullYear() === new Date().getFullYear() ? { day: "numeric", month: "long" } : { day: "numeric", month: "short", year: "numeric" };
  return d.toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", o);
}
function owBy(b) { return !b || b === "اللوحة" ? "مدير النظام" : b; }
function owLine(id) { return (oppRows || []).find(function (o) { return o.id === id; }) || null; }
function owReasonLabel(k) { return LOSS_REASON_LABELS[k] || k || ""; }

/* ---------------- the lost-reason dialog ---------------- */
function owLossOpen(ids, mode, stage) {
  var first = owLine(ids[0]);
  var el = document.activeElement;
  owLoss = { ids: ids, mode: mode, stage: stage, name: first ? first.account_name + " — " + first.product : "",
    reason: mode === "edit" && first ? first.lost_reason || "" : "", note: mode === "edit" && first ? first.lost_note || "" : "",
    err: "", field: "", busy: false, from: el && el.id ? el.id : "", shown: false };
  opRender();
}
function owLossClose() {
  if (!owLoss) return;
  var from = owLoss.from;
  document.querySelectorAll(".ow-scrim, .ow-box").forEach(function (x) { x.classList.remove("in"); });
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  setTimeout(function () { owLoss = null; opRender(); var t = from && document.getElementById(from); if (t) t.focus(); }, reduce ? 0 : 150);
}
function owLossModal() {
  if (!owLoss) return "";
  var L = owLoss, cls = L.shown ? " in" : "";
  var n = L.ids.length;
  var title = L.mode === "edit" ? "تعديل سبب الخسارة" : n > 1 ? "إغلاق " + opNLine(n) + " خسارة" : "إغلاق البند خسارة";
  var h = '<div class="ow-scrim' + cls + '" data-ow="losscancel"></div><div class="ow-lossm"><div class="ow-box' + cls + '" role="dialog" aria-modal="true" aria-labelledby="owlt">' +
    '<div class="mh"><h2 id="owlt">' + title + "</h2>" + (n === 1 && L.name ? '<div class="s">' + esc(L.name) + "</div>" : "") +
    '<div class="s">السبب يُسجَّل على البند وفي «الخسائر حسب السبب» — لا يُغلق بند خسارة بلا سبب.</div></div><div class="mb">';
  h += '<div class="ow-reasons" role="radiogroup" aria-label="سبب الخسارة"' + (L.field === "lost_reason" ? ' aria-describedby="owlerr"' : "") + ">";
  LOSS_REASONS.forEach(function (r, i) {
    var on = L.reason === r.key;
    var tab = on || (!L.reason && i === 0) ? 0 : -1;
    h += '<button type="button" role="radio" class="ow-reason" id="owr_' + r.key + '" aria-checked="' + on + '" tabindex="' + tab + '" data-ow="reason" data-k="' + r.key + '">' +
      '<span class="l">' + esc(r.label) + '</span><span class="h">' + esc(r.hint) + "</span></button>";
  });
  h += "</div>";
  var needNote = L.reason === LOSS_OTHER_KEY;
  h += '<div class="ox-fld"><label for="owlnote">' + (needNote ? 'اكتب السبب <span class="req" aria-hidden="true">*</span>' : "ملاحظة (اختيارية)") + "</label>" +
    '<textarea class="ow-ta" id="owlnote" maxlength="' + LOSS_NOTE_MAX + '" data-owf="lossnote" placeholder="مثال: اختاروا منصة حكومية مجانية"' +
    (L.field === "lost_note" ? ' aria-invalid="true" aria-describedby="owlerr"' : "") + ">" + esc(L.note) + "</textarea></div></div>";
  h += '<div class="mf"><button class="btn btn-teal" id="owlsave" data-ow="losssave"' + (L.busy ? ' disabled aria-busy="true"' : "") + ">" +
    (L.busy ? "جارٍ الحفظ…" : L.mode === "edit" ? "حفظ السبب" : "سجّل الخسارة") + "</button>" +
    '<button class="btn btn-ghost" data-ow="losscancel">إلغاء</button>' +
    (L.err ? '<span class="ow-err" id="owlerr" role="alert">' + opIco("warn") + esc(L.err) + "</span>" : "") + "</div></div></div>";
  return h;
}
function owLossSave() {
  var L = owLoss; if (!L || L.busy) return;
  var c = checkLossReason(L.reason, L.note);
  if (!c.ok) { L.err = c.message; L.field = c.field; opRender(); var t = document.getElementById(c.field === "lost_note" ? "owlnote" : "owr_" + (L.reason || LOSS_REASONS[0].key)); if (t) t.focus(); return; }
  var extra = { lost_reason: c.reason, lost_note: c.note || "" };
  if (L.mode === "bulk") {
    var label = "أُغلقت خسارة (" + owReasonLabel(c.reason) + ")";
    owLoss = null; opRender();
    void opBulkPatch({ stage: L.stage, lost_reason: c.reason, lost_note: c.note || "" }, label);
    return;
  }
  var id = L.ids[0];
  if (L.mode === "edit") {
    L.busy = true; opRender();
    cfJson("PATCH", "/admin/opps/" + fmtId(id), extra).then(function (r) {
      if (owLoss !== L) return;
      L.busy = false;
      if (!r.ok) { L.err = r.j.detail || "تعذّر الحفظ (" + fmtN(r.status) + ")"; L.field = r.j.field || ""; opRender(); return; }
      oppRows = (oppRows || []).map(function (o) { return o.id === r.j.opp.id ? r.j.opp : o; });
      delete owWork[id];
      owLossClose(); opToast("حُفظ سبب الخسارة", false);
    }).catch(function () { L.busy = false; L.err = "تعذّر الاتصال — لم يُحفظ شيء."; opRender(); });
    return;
  }
  owLoss = null; opRender();
  var back = L.from;
  void window.opSaveField(id, "stage", L.stage, extra).then(function () {
    delete owWork[id];
    var t = back && document.getElementById(back); if (t) t.focus();
  });
}

/* ---------------- the lost line ---------------- */
function owLostBlock(l) {
  if (!opIsLost(l)) return "";
  return '<div class="ow-lost"><div class="r">' + (l.lost_reason ? "السبب: <b>" + esc(owReasonLabel(l.lost_reason)) + "</b>" : "<b>لم يُسجَّل سبب</b> — أُغلق قبل أن يصبح السبب إلزاميًا") +
    '<span style="flex:1"></span><button class="ow-lnk" id="owlossedit_' + l.id + '" data-ow="lossedit" data-i="' + l.id + '">' + (l.lost_reason ? "تعديل السبب" : "سجّل السبب") + "</button></div>" +
    (l.lost_note ? '<div class="n">' + esc(l.lost_note) + "</div>" : "") + "</div>";
}

/* ---------------- loading the work of one line ---------------- */
function owLoad(oppId, force) {
  var w = owWork[oppId];
  if (w && (w.loading || (!force && (w.data || w.failed)))) return;
  owWork[oppId] = { data: w ? w.data : null, failed: false, loading: true };
  pxGet("/admin/opps/" + fmtId(oppId) + "/work").then(function (j) { owWork[oppId] = { data: j, failed: false, loading: false }; })
    .catch(function () { owWork[oppId] = { data: w ? w.data : null, failed: true, loading: false }; })
    .then(function () { if (opOpen === oppId) opRender(); });
}

/* ---------------- «الأنشطة» ---------------- */
function owActivitiesSection(l) {
  owLoad(l.id, false);
  var w = owWork[l.id] || {};
  var rows = w.data ? w.data.activities : [];
  var depts = (w.data && w.data.departments) || [];
  var b = '<section class="ox-sec ow-sec" aria-labelledby="oxsec_act"><div class="ow-top"><div class="ox-sech" id="oxsec_act">الأنشطة' +
    (rows.length ? '<span class="ox-cnt" style="color:var(--muted)">' + fmtN(rows.length) + "</span>" : "") + '</div><span class="sp"></span>' +
    (!owAct || owAct.oppId !== l.id ? '<button class="btn btn-ghost" id="owactnew_' + l.id + '" data-ow="actnew" data-i="' + l.id + '">' + opIco("plus") + "تسجيل نشاط</button>" : "") + "</div>";
  if (owAct && owAct.oppId === l.id) {
    var A = owAct;
    var inv = function (f) { return A.field === f ? ' aria-invalid="true" aria-describedby="owaerr"' : ""; };
    b += '<div class="ow-form" role="group" aria-label="نشاط جديد">' +
      '<div class="ow-kind" role="radiogroup" aria-label="نوع النشاط">' + ACTIVITY_KINDS.map(function (k) {
        var on = A.kind === k;
        return '<button type="button" role="radio" id="owk_' + k + '" aria-checked="' + on + '" tabindex="' + (on ? 0 : -1) + '" data-ow="kind" data-k="' + k + '">' + esc(ACTIVITY_KIND_LABELS[k]) + "</button>";
      }).join("") + "</div>" +
      '<div class="ox-g2"><div class="ox-fld"><label for="owa_on">التاريخ <span class="req" aria-hidden="true">*</span></label><input class="inp" type="date" id="owa_on" max="' + owToday() + '" value="' + esc(A.occurredOn) + '" data-owf="occurredOn"' + inv("occurredOn") + "></div>" +
      '<div class="ox-fld"><label for="owa_owner">المسؤول</label><input class="inp" id="owa_owner" list="oxowners2" maxlength="' + ACTIVITY_OWNER_MAX + '" value="' + esc(A.owner) + '" data-owf="owner"' + inv("owner") + "></div></div>" +
      '<div class="ox-fld"><label for="owa_sum">ما الذي دار؟ <span class="req" aria-hidden="true">*</span></label><textarea class="ow-ta" id="owa_sum" maxlength="' + ACTIVITY_SUMMARY_MAX + '" data-owf="summary" placeholder="مثال: استعراض متطلبات التكامل مع إدارة تقنية المعلومات"' + inv("summary") + ">" + esc(A.summary) + "</textarea></div>" +
      '<div class="ox-g2"><div class="ox-fld"><label for="owa_next">الخطوة التالية</label><input class="inp" id="owa_next" maxlength="' + ACTIVITY_NEXT_MAX + '" value="' + esc(A.nextStep) + '" data-owf="nextStep" placeholder="مثال: إرسال العرض الفني"' + inv("nextStep") + "></div>" +
      '<div class="ox-fld"><label for="owa_nexton">موعدها</label><input class="inp" type="date" id="owa_nexton" value="' + esc(A.nextOn) + '" data-owf="nextOn"' + inv("nextOn") + "></div></div>" +
      '<div class="ox-fld"><label for="owa_dept">الإدارة المعنية</label><select class="inp" id="owa_dept" data-owf="dept"' + inv("dept") + '><option value="">— المبيعات —</option>' +
        depts.map(function (d) { return '<option value="' + esc(d) + '"' + (A.dept === d ? " selected" : "") + ">" + esc(d) + "</option>"; }).join("") + "</select></div>" +
      '<div class="ow-btns"><button class="btn btn-teal" id="owasave" data-ow="actsave"' + (A.busy ? ' disabled aria-busy="true"' : "") + ">" + (A.busy ? "جارٍ الحفظ…" : "حفظ النشاط") + "</button>" +
      '<button class="btn btn-ghost" data-ow="actcancel">إلغاء</button>' +
      (A.err ? '<span class="ow-err" id="owaerr" role="alert">' + opIco("warn") + esc(A.err) + "</span>" : "") +
      '<span class="ox-hint2" style="flex-basis:100%">الخطوة التالية تصبح «الخطوة التالية» على البند.</span></div></div>';
  }
  if (w.failed && !w.data) b += '<div class="ox-hint2" role="alert">' + opIco("warn") + 'تعذّر تحميل الأنشطة.<button class="btn btn-ghost" data-ow="workretry" data-i="' + l.id + '">أعد المحاولة</button></div>';
  else if (!w.data) b += '<div class="ox-hint2" aria-busy="true">جارٍ التحميل…</div>';
  else if (!rows.length && !(owAct && owAct.oppId === l.id)) b += '<div class="ox-hint2">لا أنشطة مسجّلة — سجّل الاجتماعات والمكالمات هنا ليعرف من يتابع البند ما جرى.</div>';
  if (rows.length) {
    b += '<div class="ow-list">' + rows.map(function (a) {
      var armed = owDelArm === a.id;
      return '<div class="ow-row"><span class="k">' + esc(ACTIVITY_KIND_LABELS[a.kind] || a.kind) + '</span><span class="d">' + owDay(a.occurredOn) + "</span>" +
        '<span class="tx">' + esc(a.summary) + "</span>" +
        (a.nextStep ? '<span class="nx">الخطوة التالية: <b>' + esc(a.nextStep) + "</b>" + (a.nextOn ? " · " + owDay(a.nextOn) : "") + "</span>" : "") +
        '<span class="m">' + [a.owner ? "المسؤول: " + esc(a.owner) : "", a.dept ? esc(a.dept) : "", "سجّله " + esc(owBy(a.createdBy))].filter(Boolean).join(" · ") +
        '<span style="flex:1"></span><button class="ow-lnk" id="owdel_' + a.id + '" data-ow="actdel" data-i="' + a.id + '" data-o="' + l.id + '"' + (armed ? ' style="color:var(--s-fail-text)"' : "") + ">" + (armed ? "تأكيد الحذف" : "حذف") + "</button></span></div>";
    }).join("") + "</div>";
  }
  return b + "</section>";
}
function owActOpen(l) {
  owAct = { oppId: l.id, kind: "meeting", occurredOn: owToday(), summary: "", nextStep: "", nextOn: "", owner: String(l.owner || ""), dept: "", err: "", field: "", busy: false };
  opRender();
  setTimeout(function () { var k = document.getElementById("owk_meeting"); if (k) k.focus(); }, 0);
}
function owActSave() {
  var A = owAct; if (!A || A.busy) return;
  var w = owWork[A.oppId];
  var c = checkActivity(A, owToday(), (w && w.data && w.data.departments) || []);
  var ids = { kind: "owk_" + A.kind, occurredOn: "owa_on", summary: "owa_sum", nextStep: "owa_next", nextOn: "owa_nexton", owner: "owa_owner", dept: "owa_dept" };
  if (!c.ok) { A.err = c.message; A.field = c.field; opRender(); var f = document.getElementById(ids[c.field]); if (f) f.focus(); return; }
  A.busy = true; A.err = ""; A.field = ""; opRender();
  cfJson("POST", "/admin/opps/" + fmtId(A.oppId) + "/activities", c.value).then(function (r) {
    if (owAct !== A) return;
    A.busy = false;
    if (!r.ok) { A.err = r.j.detail || "تعذّر الحفظ (" + fmtN(r.status) + ")"; A.field = r.j.field || ""; opRender(); return; }
    var oppId = A.oppId;
    owAct = null;
    if (c.value.nextStep) {
      var label = c.value.nextOn ? c.value.nextStep + " — " + c.value.nextOn : c.value.nextStep;
      oppRows = (oppRows || []).map(function (o) { return o.id === oppId ? Object.assign({}, o, { next_step: label }) : o; });
    }
    owLoad(oppId, true);
    opToast("سُجّل «" + ACTIVITY_KIND_LABELS[c.value.kind] + "»", false);
    owFocusAfter("owactnew_" + oppId, oppId);
  }).catch(function () { if (owAct === A) { A.busy = false; A.err = "تعذّر الاتصال — لم يُحفظ شيء."; opRender(); } });
}

/* ---------------- «عروض الأسعار» ---------------- */
function owQuoteTotal(q) {
  return calculateLineValue({ stage: "quote", salePrice: Number(q.salePrice) || 0, years: Number(q.years) || 1, quantity: Number(q.qty) || 1, discountPercent: Number(q.discount) || 0, stageEnteredAt: 0 });
}
function owQuotesSection(l) {
  owLoad(l.id, false);
  var w = owWork[l.id] || {};
  var rows = w.data ? w.data.quotes : [];
  var b = '<section class="ox-sec ow-sec" aria-labelledby="oxsec_q"><div class="ow-top"><div class="ox-sech" id="oxsec_q">عروض الأسعار' +
    (rows.length ? '<span class="ox-cnt" style="color:var(--muted)">' + fmtN(rows.length) + "</span>" : "") + '</div><span class="sp"></span>' +
    (!owQuote || owQuote.oppId !== l.id ? '<button class="btn btn-ghost" id="owqnew_' + l.id + '" data-ow="qnew" data-i="' + l.id + '">' + opIco("plus") + "عرض سعر جديد</button>" : "") + "</div>";
  if (owQuote && owQuote.oppId === l.id) {
    var Q = owQuote;
    var inv = function (f) { return Q.field === f ? ' aria-invalid="true" aria-describedby="owqerr"' : ""; };
    var num = function (k, id, label) {
      return '<div class="ox-fld"><label for="' + id + '">' + label + '</label><input class="inp num" type="number" inputmode="decimal" id="' + id + '" value="' + esc(Q[k]) + '" data-owq="' + k + '"' + inv(k) + "></div>";
    };
    b += '<div class="ow-form" role="group" aria-label="عرض سعر جديد"><div class="ox-g2">' + num("salePrice", "owq_price", "السعر السنوي (ر.س) *") + num("years", "owq_years", "السنوات") +
      num("qty", "owq_qty", "الكمية") + num("discount", "owq_disc", "الخصم ٪") + "</div>" +
      '<div class="ox-g2"><div class="ox-fld"><label for="owq_valid">صالح حتى</label><input class="inp" type="date" id="owq_valid" min="' + owToday() + '" value="' + esc(Q.validUntil) + '" data-owq="validUntil"' + inv("validUntil") + "></div>" +
      '<div class="ox-fld"><label for="owq_note">ملاحظة</label><input class="inp" id="owq_note" maxlength="' + QUOTE_NOTE_MAX + '" value="' + esc(Q.note) + '" data-owq="note" placeholder="مثال: يشمل التدريب والتفعيل"' + inv("note") + "></div></div>" +
      '<div class="ow-total" id="owq_total" aria-live="polite">إجمالي العرض: <b>' + opMoney(owQuoteTotal(Q)) + "</b></div>" +
      '<div class="ow-btns"><button class="btn btn-teal" id="owqsave" data-ow="qsave"' + (Q.busy ? ' disabled aria-busy="true"' : "") + ">" + (Q.busy ? "جارٍ الحفظ…" : "حفظ كمسودة") + "</button>" +
      '<button class="btn btn-ghost" data-ow="qcancel">إلغاء</button>' +
      (Q.err ? '<span class="ow-err" id="owqerr" role="alert">' + opIco("warn") + esc(Q.err) + "</span>" : "") + "</div></div>";
  }
  if (w.failed && !w.data) b += '<div class="ox-hint2" role="alert">' + opIco("warn") + 'تعذّر تحميل عروض الأسعار.<button class="btn btn-ghost" data-ow="workretry" data-i="' + l.id + '">أعد المحاولة</button></div>';
  else if (w.data && !rows.length && !(owQuote && owQuote.oppId === l.id)) b += '<div class="ox-hint2">لا عروض أسعار — كل سعر يُعرض على العميل يُحفظ هنا ويبقى بعد قبوله أو رفضه.</div>';
  if (rows.length) {
    b += '<div class="ow-list">' + rows.map(function (q) {
      var busy = owQBusy === q.id;
      var acts = "";
      if (q.status === "draft") acts = '<button class="btn btn-ghost" data-ow="qmove" data-i="' + q.id + '" data-o="' + l.id + '" data-to="sent"' + (busy ? " disabled" : "") + ">أُرسل للعميل</button>" +
        '<button class="btn btn-ghost" data-ow="qmove" data-i="' + q.id + '" data-o="' + l.id + '" data-to="rejected"' + (busy ? " disabled" : "") + ">ألغِ المسودة</button>";
      else if (q.status === "sent") acts = '<button class="btn btn-ghost" data-ow="qmove" data-i="' + q.id + '" data-o="' + l.id + '" data-to="accepted"' + (busy ? " disabled" : "") + ">قبله العميل</button>" +
        '<button class="btn btn-ghost" data-ow="qmove" data-i="' + q.id + '" data-o="' + l.id + '" data-to="rejected"' + (busy ? " disabled" : "") + ">رفضه العميل</button>" +
        '<label class="ow-chk"><input type="checkbox" id="owqapply_' + q.id + '" checked> عند القبول: اجعله سعر البند</label>';
      return '<div class="ow-row"><span><span class="ow-amt">' + opMoney(q.amount) + '</span> <span class="cf-pill q-' + esc(q.status) + '">' + esc(QUOTE_STATUS_LABELS[q.status] || q.status) + "</span></span>" +
        '<span class="d">' + fmtD(q.createdAt) + "</span>" +
        '<span class="m"><bdi>' + fmtN(q.salePrice) + " ر.س سنويًا × " + opNYear(q.years) + " × " + fmtN(q.qty) + (q.discount ? " × (1 − " + fmtN(q.discount) + "٪)" : "") + "</bdi>" +
        (q.validUntil ? " · صالح حتى " + owDay(q.validUntil) : "") + "</span>" +
        (q.note ? '<span class="tx">' + esc(q.note) + "</span>" : "") +
        '<span class="m">أعدّه ' + esc(owBy(q.createdBy)) + (q.statusAt && q.status !== "draft" ? " · " + esc(QUOTE_STATUS_LABELS[q.status]) + " بتسجيل " + esc(owBy(q.statusBy)) + " في " + fmtD(q.statusAt) : "") + "</span>" +
        (acts ? '<span class="acts">' + acts + "</span>" : "") + "</div>";
    }).join("") + "</div>";
  }
  return b + "</section>";
}
function owQuoteOpen(l) {
  owQuote = { oppId: l.id, salePrice: Number(l.sale_price) > 0 ? String(l.sale_price) : "", years: String(l.years || 1), qty: String(l.qty || 1), discount: String(l.discount || 0),
    validUntil: "", note: "", err: "", field: "", busy: false };
  opRender();
  setTimeout(function () { var f = document.getElementById("owq_price"); if (f) f.focus(); }, 0);
}
function owQuoteSave() {
  var Q = owQuote; if (!Q || Q.busy) return;
  var c = checkQuote(Q, owToday());
  var ids = { salePrice: "owq_price", years: "owq_years", qty: "owq_qty", discount: "owq_disc", validUntil: "owq_valid", note: "owq_note" };
  if (!c.ok) { Q.err = c.message; Q.field = c.field; opRender(); var f = document.getElementById(ids[c.field]); if (f) f.focus(); return; }
  Q.busy = true; Q.err = ""; Q.field = ""; opRender();
  cfJson("POST", "/admin/opps/" + fmtId(Q.oppId) + "/quotes", c.value).then(function (r) {
    if (owQuote !== Q) return;
    Q.busy = false;
    if (!r.ok) { Q.err = r.j.detail || "تعذّر الحفظ (" + fmtN(r.status) + ")"; Q.field = r.j.field || ""; opRender(); return; }
    var oppId = Q.oppId; owQuote = null;
    owLoad(oppId, true);
    opToast("حُفظ عرض السعر مسودة", false);
    owFocusAfter("owqnew_" + oppId, oppId);
  }).catch(function () { if (owQuote === Q) { Q.busy = false; Q.err = "تعذّر الاتصال — لم يُحفظ شيء."; opRender(); } });
}
function owQuoteMove(id, oppId, to) {
  if (owQBusy) return;
  var applyEl = document.getElementById("owqapply_" + id);
  var apply = to === "accepted" && (!applyEl || applyEl.checked);
  owQBusy = id; opRender();
  cfJson("POST", "/admin/opp-quotes/" + id + "/status", { status: to, apply: apply }).then(function (r) {
    owQBusy = 0;
    if (!r.ok) { opToast(r.j.detail || "تعذّر تحديث العرض", true); opRender(); return; }
    if (r.j.opp) oppRows = (oppRows || []).map(function (o) { return o.id === r.j.opp.id ? r.j.opp : o; });
    owLoad(oppId, true);
    owFocusAfter("owqnew_" + oppId, oppId);
    opToast(to === "accepted" ? (apply ? "قُبل العرض وأصبح سعر البند" : "قُبل العرض") : to === "sent" ? "سُجّل إرسال العرض" : "سُجّل رفض العرض", false);
  }).catch(function () { owQBusy = 0; opToast("تعذّر الاتصال", true); opRender(); });
}

/* Runs after the board paints: the dialog fades in once, focus lands on its checked (or first) reason. */
function owAfterRender() {
  if (owFocus.id) {
    var fe = document.getElementById(owFocus.id);
    var w = owWork[owFocus.opp];
    if (fe) fe.focus({ preventScroll: true });
    if (!w || !w.loading) owFocus = { id: "", opp: 0 };
  }
  if (owLoss && !owLoss.shown && document.querySelector(".ow-box")) {
    requestAnimationFrame(function () {
      if (!owLoss) return;
      document.querySelectorAll(".ow-scrim, .ow-box").forEach(function (x) { x.classList.add("in"); });
      owLoss.shown = true;
      var t = document.getElementById("owr_" + (owLoss.reason || LOSS_REASONS[0].key)); if (t) t.focus();
    });
  }
}

/* ---------------- one delegated listener ---------------- */
document.addEventListener("click", function (ev) {
  var t = ev.target && ev.target.closest ? ev.target.closest("[data-ow]") : null;
  if (!t) return;
  var a = t.getAttribute("data-ow"), id = Number(t.getAttribute("data-i")), oid = Number(t.getAttribute("data-o"));
  if (a !== "actdel" && owDelArm) owDelArm = 0;
  if (a === "reason" && owLoss) {
    owLoss.reason = t.getAttribute("data-k");
    if (owLoss.field) { owLoss.err = ""; owLoss.field = ""; }
    opRender();
    var r0 = document.getElementById("owr_" + owLoss.reason); if (r0) r0.focus();
    return;
  }
  if (a === "losssave") { owLossSave(); return; }
  if (a === "losscancel") { owLossClose(); return; }
  if (a === "lossedit") { owLossOpen([id], "edit", "lost"); return; }
  if (a === "workretry") { owLoad(id, true); return; }
  var l = owLine(id);
  if (a === "actnew" && l) { owActOpen(l); return; }
  if (a === "actcancel") { var o1 = owAct && owAct.oppId; owAct = null; opRender(); var b1 = document.getElementById("owactnew_" + o1); if (b1) b1.focus(); return; }
  if (a === "kind" && owAct) { owAct.kind = t.getAttribute("data-k"); opRender(); var k1 = document.getElementById("owk_" + owAct.kind); if (k1) k1.focus(); return; }
  if (a === "actsave") { owActSave(); return; }
  if (a === "actdel") {
    if (owDelArm !== id) { owDelArm = id; opRender(); var d1 = document.getElementById("owdel_" + id); if (d1) d1.focus(); return; }
    owDelArm = 0;
    cfJson("DELETE", "/admin/opp-activities/" + id).then(function (r) {
      if (!r.ok) { opToast(r.j.detail || "تعذّر الحذف", true); return; }
      owLoad(oid, true); opToast("حُذف النشاط", false);
      owFocusAfter("owactnew_" + oid, oid);
    }).catch(function () { opToast("تعذّر الاتصال", true); });
    return;
  }
  if (a === "qnew" && l) { owQuoteOpen(l); return; }
  if (a === "qcancel") { var o2 = owQuote && owQuote.oppId; owQuote = null; opRender(); var b3 = document.getElementById("owqnew_" + o2); if (b3) b3.focus(); return; }
  if (a === "qsave") { owQuoteSave(); return; }
  if (a === "qmove") { owQuoteMove(id, oid, t.getAttribute("data-to")); return; }
});
document.addEventListener("input", function (ev) {
  var t = ev.target; if (!t || !t.getAttribute) return;
  var f = t.getAttribute("data-owf");
  if (f === "lossnote" && owLoss) { owLoss.note = t.value; if (owLoss.field === "lost_note") { owLoss.err = ""; owLoss.field = ""; var e0 = document.getElementById("owlerr"); if (e0) e0.remove(); t.removeAttribute("aria-invalid"); } return; }
  if (f && owAct) { owAct[f] = t.value; if (owAct.field === f) { owAct.err = ""; owAct.field = ""; var e1 = document.getElementById("owaerr"); if (e1) e1.remove(); t.removeAttribute("aria-invalid"); } return; }
  var q = t.getAttribute("data-owq");
  if (q && owQuote) {
    owQuote[q] = t.value;
    if (owQuote.field === q) { owQuote.err = ""; owQuote.field = ""; var e2 = document.getElementById("owqerr"); if (e2) e2.remove(); t.removeAttribute("aria-invalid"); }
    var tot = document.getElementById("owq_total"); if (tot) tot.innerHTML = "إجمالي العرض: <b>" + opMoney(owQuoteTotal(owQuote)) + "</b>";
  }
});
document.addEventListener("change", function (ev) {
  var t = ev.target; if (!t || !t.getAttribute) return;
  var f = t.getAttribute("data-owf");
  if (f && owAct && t.tagName === "SELECT") owAct[f] = t.value;
});
document.addEventListener("keydown", function (ev) {
  var t = ev.target;
  /* Arrow keys move within the reason and kind radiogroups. */
  var grp = t && t.closest ? t.closest(".ow-reasons, .ow-kind") : null;
  if (grp && (ev.key === "ArrowLeft" || ev.key === "ArrowRight" || ev.key === "ArrowUp" || ev.key === "ArrowDown")) {
    ev.preventDefault();
    var items = Array.prototype.slice.call(grp.querySelectorAll('[role="radio"]'));
    var i = items.indexOf(t);
    var step = ev.key === "ArrowLeft" || ev.key === "ArrowDown" ? 1 : -1;
    var next = items[(i + step + items.length) % items.length];
    if (next) next.click();
    return;
  }
  if (!owLoss || !document.querySelector(".ow-box")) return;
  /* Captured before the drawer's own handler, which would otherwise close the drawer on Escape and pull
     Tab focus back into it from under the dialog. */
  if (ev.key === "Escape") { ev.preventDefault(); ev.stopImmediatePropagation(); owLossClose(); return; }
  if (ev.key !== "Tab") return;
  ev.stopImmediatePropagation();
  var box = document.querySelector(".ow-box");
  var f = Array.prototype.filter.call(box.querySelectorAll("button:not([disabled]), textarea"), function (x) { return x.offsetParent !== null && (x.getAttribute("tabindex") !== "-1"); });
  if (!f.length) return;
  if (ev.shiftKey && document.activeElement === f[0]) { ev.preventDefault(); f[f.length - 1].focus(); }
  else if (!ev.shiftKey && document.activeElement === f[f.length - 1]) { ev.preventDefault(); f[0].focus(); }
  else if (!box.contains(document.activeElement)) { ev.preventDefault(); f[0].focus(); }
}, true);
/* ================= end opportunity work ================= */
`;
