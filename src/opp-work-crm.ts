// opp-work-crm.ts — the work recorded on an opportunity, inside the «فرص البيع» drawer (client A, BRD v1.0
// §15, slice S3): the lost-reason dialog every close-as-lost path goes through (BRULE-009), «الأنشطة»
// (meetings, calls, presentations, emails, notes with a dated next step — BR-OPP-003) and «عروض الأسعار»
// (BR-OPP-004). Rules come from opp-work-domain (OPP_WORK_DOMAIN_JS).
//
// PORTED to the new design system (docs/PORT-SPEC.md), 2026-09-17. Everything this module renders is
// rendered INSIDE «فرص البيع» — the four sections nest in the record drawer and the lost-reason
// dialog is appended by vOppsCrm — so opps-crm.ts owns the single .ds6 wrapper and every selector
// below is scoped to it. Fields are m-field/m-label/m-input (a textarea is textarea.m-input),
// buttons m-btn (+--primary), statuses m-chip, the journey the vocabulary's own m-tl timeline, and
// every digit rides inside .m-n. What stays local is what the vocabulary genuinely lacks: a centred
// dialog frame that is not <dialog> (it is appended to a re-rendering subtree), the two-column grid
// of loss reasons, the chip radiogroup of activity kinds, and the work-row rhythm.
//
// GRAMMAR. Sections are the drawer's own .ox-sec/.ox-sech. The dialog is centred (it is a modal, so
// it scales from the centre), 200ms in and 140ms out, reduced motion keeps only the fade.
//
// NO BACKTICKS ANYWHERE IN THIS FILE, comments included: it is one template literal.

export const OPP_WORK_CRM_CSS = `
/* «نتائج المراحل» — the deal's own journey down the ladder, on the vocabulary's timeline. The one
   addition is the TONE: a rung wears its own stage colour, which is data (stage-tone-domain.ts). */
.ds6 .ow-jsub { font-size:var(--m-t-cap); color:var(--m-mut); margin-block-start:2px; }
.ds6 .ow-jpct { display:flex; align-items:center; gap:var(--m-3); margin-block:var(--m-2) var(--m-3); }
.ds6 .ow-jpct .l { font-size:var(--m-t-cap); color:var(--m-mut); white-space:nowrap; }
.ds6 .ow-jpct .m-meter { flex:1; margin-block:0; }
/* THE LOOPS ARE OFF (founder, 2026-09-17: «it keeps moving and dancing stop it»). Both were his own
   keyframes and both were wrong here for the same reason: they ran forever. The log spent most of every
   4.6s cycle below full opacity, so reading a stage outcome meant waiting for it to come back; the bar
   never settled either. The bar keeps his blue-to-green fill and now simply sits at the deal's own
   percentage, and the log entries hold still. */
.ds6 .ow-jpct .m-meter i { background: linear-gradient(to left, #5b8def, #4cd08a); }
.ds6 .ow-jpct .v { font-size:var(--m-t-cap); font-weight:700; color:var(--m-ink); }
/* A closed deal reports its OUTCOME where an open one reports its progress. */
.ds6 .ow-jout { display:flex; align-items:center; gap:var(--m-2); flex-wrap:wrap; margin-block:var(--m-2) var(--m-3); }
.ds6 .ow-j { list-style:none; margin:0; padding:0; }
.ds6 .ow-j .m-tl__d { background:var(--tn, var(--m-ac)); }
.ds6 .ow-js.future .m-tl__d, .ds6 .ow-js.skipped .m-tl__d { background:var(--m-paper); box-shadow:0 0 0 1.5px var(--m-line-2); }
.ds6 .ow-js .hd { display:flex; align-items:baseline; gap:var(--m-2); flex-wrap:wrap; }
.ds6 .ow-jahead { font-size:var(--m-t-cap); color:var(--m-mut); margin-block-start:var(--m-3); }
.ds6 .ow-js .who { display:block; margin-block-start:2px; font-size:var(--m-t-micro); color:var(--m-mut); }
.ds6 .ow-js .hd b { color:var(--m-ink); font-weight:700; }
.ds6 .ow-js.current .hd b { color:var(--m-ac-deep); }
.ds6 .ow-js .m-chip.res { background:var(--tn-soft, var(--m-sunk)); color:var(--tn-text, var(--m-ink-2)); }
.ds6 .ow-js.future .m-chip.res, .ds6 .ow-js.skipped .m-chip.res { background:var(--m-sunk); color:var(--m-mut); }
.ds6 .ow-js .why { display:block; font-size:var(--m-t-cap); color:var(--m-mut); line-height:1.8; margin-block-start:3px; }

/* The lost-reason dialog. The vocabulary's m-dlg is a real <dialog> with a ::backdrop; this one is
   markup inside a subtree that re-renders on every keystroke, so the FRAME is local and everything
   inside it is m-dlg__h / __b / __f. */
.ds6 .ow-scrim { position:fixed; inset:0; background:rgba(11,13,18,.44); z-index:var(--z-toast);
  opacity:0; transition:opacity var(--m-out) var(--m-ease); }
.ds6 .ow-scrim.in { opacity:1; transition-duration:var(--m-in); }
.ds6 .ow-lossm { position:fixed; inset:0; z-index:var(--z-toast); display:flex; align-items:flex-start;
  justify-content:center; padding:10vh var(--m-3) var(--m-3); pointer-events:none; }
.ds6 .ow-box { pointer-events:auto; inline-size:100%; max-inline-size:520px; background:var(--m-paper);
  border:1px solid var(--m-line); border-radius:var(--m-r-card); box-shadow:var(--m-lift);
  display:flex; flex-direction:column; max-block-size:80vh; opacity:0; transform:scale(.97);
  transition:opacity var(--m-out) var(--m-ease), transform var(--m-out) var(--m-ease); }
.ds6 .ow-box.in { opacity:1; transform:none; transition-duration:var(--m-in); }
.ds6 .ow-box .m-dlg__h { flex-direction:column; align-items:flex-start; gap:var(--m-1); }
.ds6 .ow-box .m-dlg__b { display:flex; flex-direction:column; gap:var(--m-3); }
.ds6 .ow-box .m-dlg__f { justify-content:flex-start; align-items:center; flex-wrap:wrap; }
/* Five reasons read as a list, not a paragraph: two columns, each carrying its own hint. */
.ds6 .ow-reasons { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:6px; }
.ds6 .ow-reason { font:inherit; display:flex; flex-direction:column; align-items:flex-start; gap:2px;
  text-align:start; min-block-size:52px; padding:8px 10px; border:1px solid var(--m-line-2);
  border-radius:var(--m-r-ctl); background:var(--m-paper); cursor:pointer;
  transition:transform var(--m-press) var(--m-ease), background var(--m-out) var(--m-ease), border-color var(--m-out) var(--m-ease); }
.ds6 .ow-reason .l { font-size:var(--m-t-body); font-weight:700; color:var(--m-ink); }
.ds6 .ow-reason .h { font-size:var(--m-t-cap); color:var(--m-mut); line-height:1.5; }
.ds6 .ow-reason[aria-checked="true"] { background:var(--m-bad-dim); border-color:var(--m-bad); }
.ds6 .ow-reason[aria-checked="true"] .l { color:var(--m-bad); }
.ds6 .ow-reason:active, .ds6 .ow-kind button:active { transform:scale(.97); }
.ds6 .ow-err { font-size:var(--m-t-cap); color:var(--m-bad); display:flex; align-items:center; gap:6px; flex-basis:100%; }
/* The lost line, said once at the top of a closed deal's record. */
.ds6 .ow-lost { display:flex; flex-direction:column; gap:4px; margin-block-start:var(--m-2);
  padding:var(--m-2) var(--m-3); border-radius:var(--m-r-ctl); background:var(--m-bad-dim);
  font-size:var(--m-t-body); color:var(--m-bad); }
.ds6 .ow-lost .r { display:flex; align-items:center; gap:var(--m-2); flex-wrap:wrap; }
.ds6 .ow-lost .r .sp { flex:1 1 auto; }
.ds6 .ow-lost b { font-weight:700; }
.ds6 .ow-lost .n { color:var(--m-ink); font-size:var(--m-t-cap); line-height:1.6; overflow-wrap:anywhere; }
/* A section's own header row: title, then its one action at the end. */
.ds6 .ow-sec .ow-top { display:flex; align-items:center; gap:var(--m-2); flex-wrap:wrap; }
.ds6 .ow-sec .ow-top .sp { flex:1 1 auto; }
.ds6 .ow-form { display:flex; flex-direction:column; gap:var(--m-3); margin-block-start:var(--m-2);
  padding:var(--m-3); border-radius:var(--m-r-ctl); background:var(--m-page); }
.ds6 .ow-form .ow-btns { display:flex; gap:var(--m-2); align-items:center; flex-wrap:wrap; }
/* Seven activity kinds, one chosen: too many for the vocabulary's segmented control, and they wrap. */
.ds6 .ow-kind { display:flex; flex-wrap:wrap; gap:6px; }
.ds6 .ow-kind button { font:inherit; min-block-size:40px; font-size:var(--m-t-cap); font-weight:600;
  color:var(--m-ink-2); background:var(--m-paper); border:1px solid var(--m-line-2);
  border-radius:var(--m-r-chip); padding-inline:var(--m-3); cursor:pointer;
  transition:transform var(--m-press) var(--m-ease), background var(--m-out) var(--m-ease), border-color var(--m-out) var(--m-ease); }
.ds6 .ow-kind button[aria-checked="true"] { background:var(--m-ac-dim); color:var(--m-ac-deep); border-color:var(--m-ac); }
/* One recorded item per row: what it was, when, what it said, and what it produced. m-item is a
   single-line row; these carry four stacked parts, which is why the grid is local. */
.ds6 .ow-list { display:flex; flex-direction:column; margin-block-start:var(--m-2); }
.ds6 .ow-row { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:var(--m-1) var(--m-2);
  padding-block:var(--m-2); border-block-start:1px solid var(--m-line);
  font-size:var(--m-t-body); color:var(--m-ink); }
.ds6 .ow-row .k { font-size:var(--m-t-cap); font-weight:700; color:var(--m-ac-deep); }
.ds6 .ow-row .d { font-size:var(--m-t-cap); color:var(--m-mut); white-space:nowrap; text-align:end; }
.ds6 .ow-row .tx { grid-column:1 / -1; line-height:1.7; overflow-wrap:anywhere; }
.ds6 .ow-row .nx { grid-column:1 / -1; font-size:var(--m-t-cap); color:var(--m-ink-2);
  display:flex; gap:6px; flex-wrap:wrap; align-items:center; }
.ds6 .ow-row .nx b { font-weight:700; color:var(--m-ink); }
.ds6 .ow-row .m { grid-column:1 / -1; font-size:var(--m-t-cap); color:var(--m-mut);
  display:flex; gap:var(--m-2); flex-wrap:wrap; align-items:center; }
.ds6 .ow-row .m .sp { flex:1 1 auto; }
.ds6 .ow-row .acts { grid-column:1 / -1; display:flex; gap:6px; flex-wrap:wrap; align-items:center; }
.ds6 .ow-amt { font-weight:700; white-space:nowrap; }
.ds6 .ow-total { font-size:var(--m-t-body); color:var(--m-ink); }
.ds6 .ow-total b { font-weight:700; }
.ds6 .ow-chk { display:inline-flex; align-items:center; gap:6px; font-size:var(--m-t-cap); color:var(--m-ink); }
@media (max-width: 560px) {
  .ds6 .ow-reasons { grid-template-columns:minmax(0,1fr); }
  .ds6 .ow-lossm { padding:0; align-items:stretch; }
  .ds6 .ow-box { max-inline-size:none; max-block-size:none; border-radius:0; }
}
@media (prefers-reduced-motion: reduce) {
  .ds6 .ow-box { transform:none; transition:opacity var(--m-out) linear; }
  .ds6 .ow-reason, .ds6 .ow-kind button { transition:none; }
  .ds6 .ow-reason:active, .ds6 .ow-kind button:active { transform:none; }
}
`;

export const OPP_WORK_CRM_JS = `
/* ================= opportunity work: lost reason · activities · quotes ================= */
var owLoss = null;     /* { ids, name, mode: "close"|"bulk"|"edit", stage, reason, note, err, field, busy, from, shown } */
var owWork = {};       /* oppId -> { data, failed, loading } */
var owAct = null;      /* the activity form: { oppId, kind, occurredOn, summary, nextStep, nextOn, owner, dept, err, field, busy } */
var owQuote = null;    /* the quote form: { oppId, salePrice, years, qty, discount, validUntil, note, err, field, busy } */
var owQBusy = 0, owDelArm = 0;
var owActDrafts = {}, owQApply = {};  /* unsaved activity drafts per line; «apply price» choice per quote */
/* The dialog belongs to the board it was opened on (review: it reappeared after #home → #opps). */
window.addEventListener("hashchange", function () { if ((location.hash || "").slice(1).split("/")[0] !== "opps") { owLoss = null; owDelArm = 0; } });
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
  /* Where focus returns: the control that opened the dialog, or — for a kanban drop or a bulk menu, whose
     element is gone after the repaint — the drawer heading, the bulk menu, or the board toolbar. */
  var from = el && el.id ? el.id : mode === "bulk" ? "oxb_stage" : "oxdrt";
  owLoss = { ids: ids, mode: mode, stage: stage, name: first ? first.account_name + " — " + first.product : "",
    reason: mode === "edit" && first ? first.lost_reason || "" : "", note: mode === "edit" && first ? first.lost_note || "" : "",
    err: "", field: "", busy: false, from: from, shown: false };
  opRender();
}
function owLossClose() {
  if (!owLoss) return;
  var from = owLoss.from;
  document.querySelectorAll(".ow-scrim, .ow-box").forEach(function (x) { x.classList.remove("in"); });
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  setTimeout(function () { owLoss = null; opRender(); owFocusBack(from); }, reduce ? 0 : 150);
}
function owFocusBack(id) {
  var t = (id && document.getElementById(id)) || document.getElementById("oxdrt") || document.getElementById("oxb_stage") || document.querySelector(".ox-tb button");
  if (t) t.focus({ preventScroll: true });
}
function owLossModal() {
  if (!owLoss) return "";
  var L = owLoss, cls = L.shown ? " in" : "";
  var n = L.ids.length;
  /* After «إغلاق» the count is the object: «بندين», not «بندان» (review). */
  var title = L.mode === "edit" ? "تعديل سبب الخسارة" : n === 2 ? "إغلاق بندين خسارة" : n > 1 ? "إغلاق " + opNLineN(n) + " خسارة" : "إغلاق البند خسارة";
  var h = '<div class="ow-scrim' + cls + '" data-ow="losscancel"></div><div class="ow-lossm"><div class="ow-box' + cls + '" role="dialog" aria-modal="true" aria-labelledby="owlt">' +
    '<div class="m-dlg__h"><h2 class="m-dlg__t" id="owlt">' + title + "</h2>" +
    (n === 1 && L.name ? '<div class="m-meta">' + esc(L.name) + "</div>" : "") +
    '<div class="m-meta">السبب يُسجَّل على البند وفي «الخسائر حسب السبب» — لا يُغلق بند خسارة بلا سبب.</div></div><div class="m-dlg__b">';
  h += '<div class="ow-reasons" role="radiogroup" aria-label="سبب الخسارة"' + (L.field === "lost_reason" ? ' aria-describedby="owlerr"' : "") + ">";
  LOSS_REASONS.forEach(function (r, i) {
    var on = L.reason === r.key;
    var tab = on || (!L.reason && i === 0) ? 0 : -1;
    h += '<button type="button" role="radio" class="ow-reason" id="owr_' + r.key + '" aria-checked="' + on + '" tabindex="' + tab + '" data-ow="reason" data-k="' + r.key + '">' +
      '<span class="l">' + esc(r.label) + '</span><span class="h">' + esc(r.hint) + "</span></button>";
  });
  h += "</div>";
  var needNote = L.reason === LOSS_OTHER_KEY;
  h += '<div class="m-field"><label class="m-label' + (needNote ? " m-req" : "") + '" for="owlnote">' +
    (needNote ? "اكتب السبب" : "ملاحظة (اختيارية)") + "</label>" +
    '<textarea class="m-input" id="owlnote" rows="3" maxlength="' + LOSS_NOTE_MAX + '" data-owf="lossnote" placeholder="مثال: اختاروا منصة حكومية مجانية"' +
    (L.field === "lost_note" ? ' aria-invalid="true" aria-describedby="owlerr"' : "") + ">" + esc(L.note) + "</textarea></div></div>";
  h += '<div class="m-dlg__f"><button class="m-btn m-btn--primary" id="owlsave" data-ow="losssave"' + (L.busy ? ' disabled aria-busy="true"' : "") + ">" +
    (L.busy ? "جارٍ الحفظ…" : L.mode === "edit" ? "حفظ السبب" : "سجّل الخسارة") + "</button>" +
    '<button class="m-btn" data-ow="losscancel">إلغاء</button>' +
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
    owLoss = null;
    opSel = {}; L.ids.forEach(function (x) { opSel[x] = 1; });
    opRender();
    void opBulkPatch({ stage: L.stage, lost_reason: c.reason, lost_note: c.note || "" }, label).then(function () { owFocusBack("oxb_stage"); });
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
    owFocusBack(back === "oxlost_" + id ? "owlossedit_" + id : back);
  });
}

/* ---------------- the lost line ---------------- */
function owLostBlock(l) {
  if (!opIsLost(l)) return "";
  /* A reason nobody recorded on a deal that WAS lost is data someone owes, not a legitimate nothing
     (PORT-SPEC §4) — and the sentence beside it says why it can be missing at all. */
  return '<div class="ow-lost"><div class="r">' + (l.lost_reason
      ? "السبب: <b>" + esc(owReasonLabel(l.lost_reason)) + "</b>"
      : opNil("لم يُسجَّل سبب", "owed") + " — أُغلق قبل أن يصبح السبب إلزاميًا") +
    '<span class="sp"></span><button class="m-btn m-btn--quiet" id="owlossedit_' + l.id + '" data-ow="lossedit" data-i="' + l.id + '">' + (l.lost_reason ? "تعديل السبب" : "سجّل السبب") + "</button></div>" +
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

/* ---------------- «نتائج المراحل» ----------------
   The prototype's opportunity screen answers «ماذا حدث في كل مرحلة؟» — the outcome recorded when the
   deal left each rung, its reason, and the action it produced. Massar logged every one of those
   transitions from the first day of the stage ledger and never showed them on the record.
   A rung the deal skipped says so; a rung it never reached says «لم تُسجَّل». */
function owOutcomeOf(key) {
  var all = (typeof STAGE_OUTCOMES !== "undefined" && STAGE_OUTCOMES) || [];
  for (var i = 0; i < all.length; i++) if (all[i].key === key) return all[i];
  return null;
}
function owStamp(ms) {
  if (!ms) return "";
  try { return fmtD(ms); } catch (e) { return ""; }
}
/* WHO MOVED IT, as a person. The server stamps the signed-in user's own name on the event
   (index.ts authorize -> Caller.actor); «اللوحة» is what it stamps when the move was made with the
   SHARED admin token, which is a credential, not a person. Printing it verbatim asks the reader who
   «the board» is, so it is named for what it is — the same rule the accounts screen already applies. */
function owActorName(a) { return !a || a === "اللوحة" ? "مدير النظام" : a; }
function owJourneySection(l) {
  owLoad(l.id, false);
  var w = owWork[l.id] || {};
  var ladder = (typeof OPP_ST !== "undefined" ? OPP_ST : []).map(function (s) { return s.key; });
  var b = '<section class="ox-sec" aria-labelledby="oxsec_j"><div class="ox-sech" id="oxsec_j">نتائج المراحل</div>' +
    '<div class="ow-jsub">نتيجة كل مرحلة وسببها عبر دورة البيع</div>';
  if (!w.data && w.loading) return b + '<div class="ox-hint2" aria-busy="true">جارٍ قراءة سجل المراحل…</div></section>';
  if (!w.data && w.failed) {
    return b + '<div class="ox-hint2" role="alert">' + opIco("warn") + 'تعذّر قراءة سجل المراحل.' +
      '<button class="m-btn" data-ow="workretry" data-i="' + l.id + '">أعد المحاولة</button></div></section>';
  }
  var evs = (w.data && w.data.stageEvents) || [];
  var steps = stageJourney(ladder, evs, l.stage);
  /* THE FRACTION IS MEASURED ON THE OPEN RUNGS ONLY, and a CLOSED deal gets no fraction at all.
     Measured over the whole eight-rung ladder — «won» and «lost» included — a LOST deal sat on the
     last rung and printed «نسبة الإنجاز في الدورة: 100٪» behind a full accent bar, while a WON deal
     printed 88٪. The arithmetic was right and the sentence it made was false: losing is not
     finishing. A deal that has closed has no progress left to report, so it reports its outcome. */
  var openKeys = (typeof opOpenStages === "function" ? opOpenStages() : []).map(function (s) { return s.key; });
  var closed = typeof opIsOpen === "function" && !opIsOpen(l);
  if (closed) {
    b += '<div class="ow-jout"><span class="m-chip ' + (opIsWon(l) ? "m-chip--ok" : "m-chip--bad") + '">' +
      (opIsWon(l) ? "أُغلقت ربحًا" : "أُغلقت خسارة") + "</span>" +
      '<span class="m-meta">الصفقة مغلقة — لا نسبة إنجاز تُقاس على دورة انتهت</span></div>';
  } else {
    var pct = journeyPct(openKeys, l.stage);
    b += '<div class="ow-jpct"><span class="l">نسبة الإنجاز في الدورة المفتوحة</span>';
    /* A rung that is not on the open ladder at all — a paused or deleted stage a line still sits on —
       is a position nobody can place, which is the «unset» absence, never a made-up number. */
    b += pct === null
      ? '<span class="v">' + opNil("مرحلة خارج الدورة المفتوحة", "unset") + "</span>"
      : '<span class="m-meter" style="--m-pct:' + pct + '%"><i></i></span><span class="v">' + mPct(pct) + "</span>";
    b += "</div>";
  }
  /* A rung the deal has NOT reached is hidden (founder, 2026-09-17: «if stage is not reached hide
     it»): seven rows of «لم تُسجَّل · بلا تاريخ» pushed the rungs that did happen off the screen. The
     ones ahead are still counted in one line under the list, so nothing silently disappears. */
  var shown = steps.filter(function (st) { return st.state !== "future"; });
  var ahead = steps.length - shown.length;
  b += '<ol class="ow-j m-tl">' + shown.map(function (st) {
    var stage = typeof opStage === "function" ? opStage(st.key) : { label: st.key };
    var o = st.outcomeKey ? owOutcomeOf(st.outcomeKey) : null;
    var said = st.state === "current" ? "الحالية"
      : st.state === "skipped" ? "لم تمرّ بها"
      : st.state === "future" ? "لم تُسجَّل"
      : o ? o.label : (st.leftAt ? "انتقلت دون تسجيل نتيجة" : "لم تُسجَّل");
    var why = st.reason || (o ? o.reason : "");
    var act = o ? o.nextAction : "";
    return '<li class="ow-js m-tl__i ' + st.state + '"' + (typeof opToneVars === "function" ? ' style="' + opToneVars(st.key) + '"' : "") + ">" +
      '<span class="m-tl__d" aria-hidden="true"></span>' +
      '<span class="m-tl__n"><span class="hd"><b>' + esc(stage.label) + "</b>" +
      '<span class="m-chip res">' + esc(said) + "</span></span>" +
      (st.state === "done" && (why || act)
        ? '<span class="why">' + (why ? "السبب: " + esc(why) : "") + (why && act ? " · " : "") + (act ? "الإجراء: " + esc(act) : "") + "</span>"
        : st.state === "current" && typeof opAgo === "function" ? '<span class="why">' + esc(opAgo(l)) + "</span>" : "") +
      /* WHO MOVED IT (founder, 2026-09-17). The actor is stamped on the event that LEFT this rung, so
         only a rung the deal has left can name one. A rung it left with nobody recorded says that —
         a classification nobody made, never a blank (PORT-SPEC §4). */
      (st.state === "done"
        ? '<span class="who">' + (st.actor ? "نقلها " + esc(owActorName(st.actor)) : opNil("لم يُسجَّل من نقلها", "unset")) + "</span>"
        : "") +
      "</span>" +
      '<span class="m-tl__t">' + (st.leftAt || st.reachedAt
        ? esc(owStamp(st.leftAt || st.reachedAt))
        : opNil("بلا تاريخ", "unset")) + "</span></li>";
  }).join("") + "</ol>";
  if (ahead) {
    b += '<div class="ow-jahead">' + mPl(ahead, "مرحلة واحدة لاحقة", "مرحلتان لاحقتان", "مراحل لاحقة", "مرحلة لاحقة") +
      " لم يصل إليها البند بعد.</div>";
  }
  if (!evs.length) {
    b += '<div class="ox-hint2">لا انتقالات مسجّلة لهذا البند بعد — يُسجَّل الانتقال تلقائيًا عند تغيير المرحلة.</div>';
  }
  return b + "</section>";
}

/* ---------------- «الأنشطة» ---------------- */
function owActivitiesSection(l) {
  owLoad(l.id, false);
  var w = owWork[l.id] || {};
  var rows = w.data ? w.data.activities : [];
  var depts = (w.data && w.data.departments) || [];
  /* The count is printed HERE and on the drawer's tab, so both sites carry the owActs derivation
     (PORT-SPEC §6) and cannot drift apart. */
  var b = '<section class="ox-sec ow-sec" aria-labelledby="oxsec_act"><div class="ow-top"><div class="ox-sech" id="oxsec_act">الأنشطة' +
    (rows.length ? ' <span class="m-chip m-chip--plain">' + dsFig("owActs", rows.length) + "</span>" : "") + '</div><span class="sp"></span>' +
    (!owAct || owAct.oppId !== l.id ? '<button class="m-btn" id="owactnew_' + l.id + '" data-ow="actnew" data-i="' + l.id + '">' + opIco("plus") + (owActDrafts[l.id] ? "متابعة مسودة النشاط" : "تسجيل نشاط") + "</button>" : "") + "</div>";
  if (owAct && owAct.oppId === l.id) {
    var A = owAct;
    var inv = function (f) { return A.field === f ? ' aria-invalid="true" aria-describedby="owaerr"' : ""; };
    b += '<div class="ow-form" role="group" aria-label="نشاط جديد">' +
      '<div class="ow-kind" role="radiogroup" aria-label="نوع النشاط">' + ACTIVITY_KINDS.map(function (k) {
        var on = A.kind === k;
        return '<button type="button" role="radio" id="owk_' + k + '" aria-checked="' + on + '" tabindex="' + (on ? 0 : -1) + '" data-ow="kind" data-k="' + k + '">' + esc(ACTIVITY_KIND_LABELS[k]) + "</button>";
      }).join("") + "</div>" +
      '<div class="m-form"><div class="m-field"><label class="m-label m-req" for="owa_on">التاريخ</label>' + mDate({ id: "owa_on", value: A.occurredOn, max: owToday(), label: "تاريخ النشاط", wide: true,
        attrs: ' data-owf="occurredOn"' + inv("occurredOn") }) + "</div>" +
      '<div class="m-field"><label class="m-label" for="owa_owner">المسؤول</label><input class="m-input" id="owa_owner" list="oxowners2" maxlength="' + ACTIVITY_OWNER_MAX + '" value="' + esc(A.owner) + '" data-owf="owner"' + inv("owner") + "></div></div>" +
      '<div class="m-field"><label class="m-label m-req" for="owa_sum">ما الذي دار؟</label><textarea class="m-input" id="owa_sum" rows="3" maxlength="' + ACTIVITY_SUMMARY_MAX + '" data-owf="summary" placeholder="مثال: استعراض متطلبات التكامل مع إدارة تقنية المعلومات"' + inv("summary") + ">" + esc(A.summary) + "</textarea></div>" +
      '<div class="m-form"><div class="m-field"><label class="m-label" for="owa_next">الخطوة التالية</label><input class="m-input" id="owa_next" maxlength="' + ACTIVITY_NEXT_MAX + '" value="' + esc(A.nextStep) + '" data-owf="nextStep" placeholder="مثال: إرسال العرض الفني"' + inv("nextStep") + "></div>" +
      '<div class="m-field"><label class="m-label" for="owa_nexton">موعدها</label>' + mDate({ id: "owa_nexton", value: A.nextOn, label: "موعد الخطوة التالية", placeholder: "بلا موعد", wide: true,
        attrs: ' data-owf="nextOn"' + inv("nextOn") }) + "</div></div>" +
      '<div class="m-field"><label class="m-label" for="owa_dept">الإدارة المعنية</label><select class="m-select" id="owa_dept" data-owf="dept"' + inv("dept") + '><option value="">المبيعات</option>' +
        depts.map(function (d) { return '<option value="' + esc(d) + '"' + (A.dept === d ? " selected" : "") + ">" + esc(d) + "</option>"; }).join("") + "</select></div>" +
      '<div class="ow-btns"><button class="m-btn m-btn--primary" id="owasave" data-ow="actsave"' + (A.busy ? ' disabled aria-busy="true"' : "") + ">" + (A.busy ? "جارٍ الحفظ…" : "حفظ النشاط") + "</button>" +
      '<button class="m-btn" data-ow="actcancel">إلغاء</button>' +
      (A.err ? '<span class="ow-err" id="owaerr" role="alert">' + opIco("warn") + esc(A.err) + "</span>" : "") +
      '<span class="m-hint" style="flex-basis:100%">الخطوة التالية تصبح «الخطوة التالية» على البند.</span></div></div>';
  }
  if (w.failed && !w.data) b += '<div class="ox-hint2" role="alert">' + opIco("warn") + 'تعذّر تحميل الأنشطة.<button class="m-btn" data-ow="workretry" data-i="' + l.id + '">أعد المحاولة</button></div>';
  else if (!w.data) b += '<div class="ox-hint2" aria-busy="true">جارٍ التحميل…</div>';
  else if (!rows.length && !(owAct && owAct.oppId === l.id)) {
    b += '<div class="m-empty"><p class="m-empty__t">لا أنشطة مسجّلة</p>' +
      '<p class="m-empty__d">سجّل الاجتماعات والمكالمات هنا ليعرف من يتابع البند ما جرى.</p></div>';
  }
  if (rows.length) {
    b += '<div class="ow-list">' + rows.map(function (a) {
      var armed = owDelArm === a.id;
      /* An activity nobody attributed to a person is a classification nobody made, not an em-dash. */
      return '<div class="ow-row"><span class="k">' + esc(ACTIVITY_KIND_LABELS[a.kind] || a.kind) + '</span><span class="d">' + owDay(a.occurredOn) + "</span>" +
        '<span class="tx">' + esc(a.summary) + "</span>" +
        (a.nextStep ? '<span class="nx">الخطوة التالية: <b>' + esc(a.nextStep) + "</b>" + (a.nextOn ? " · " + owDay(a.nextOn) : "") + "</span>" : "") +
        '<span class="m">' + ["المسؤول: " + (a.owner ? esc(a.owner) : opNil("بلا مسؤول", "unset")),
          a.dept ? esc(a.dept) : "", "سجّله " + esc(owBy(a.createdBy))].filter(Boolean).join(" · ") +
        '<span class="sp"></span><button class="m-btn m-btn--quiet" id="owdel_' + a.id + '" data-ow="actdel" data-i="' + a.id + '" data-o="' + l.id + '"' + (armed ? ' style="color:var(--m-bad)"' : "") + ">" + (armed ? "تأكيد الحذف" : "حذف") + "</button></span></div>";
    }).join("") + "</div>";
  }
  return b + "</section>";
}
function owActOpen(l) {
  /* A draft on another line is kept, not discarded (review): opening this line's form parks it. */
  if (owAct && owAct.oppId !== l.id && (owAct.summary || owAct.nextStep)) owActDrafts[owAct.oppId] = owAct;
  if (owActDrafts[l.id]) { owAct = owActDrafts[l.id]; delete owActDrafts[l.id]; owAct.err = ""; owAct.field = ""; opRender(); setTimeout(function () { var s0 = document.getElementById("owa_sum"); if (s0) s0.focus(); }, 0); return; }
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
      /* The same words the server stored (db.addActivity), so the board does not change on the next load. */
      var day = c.value.nextOn ? new Date(c.value.nextOn + "T00:00:00Z").toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "long", timeZone: "UTC" }) : "";
      var label = day ? c.value.nextStep + " — " + day : c.value.nextStep;
      oppRows = (oppRows || []).map(function (o) { return o.id === oppId && isOpenStage(o.stage) ? Object.assign({}, o, { next_step: label }) : o; });
    }
    owLoad(oppId, true);
    opToast("سُجّل «" + ACTIVITY_KIND_LABELS[c.value.kind] + "»", false);
    owFocusAfter("owactnew_" + oppId, oppId);
  }).catch(function () { if (owAct === A) { A.busy = false; A.err = "تعذّر الاتصال — لم يُحفظ شيء."; opRender(); } });
}

/* ---------------- «عروض الأسعار» ---------------- */
/* A quote's status is a STATE, which is the one thing colour is allowed to carry (PORT-SPEC §2), so
   it wears the vocabulary's own chip tones rather than the four private .cf-pill.q-* rules. A draft
   is not yet a claim on anything, so it stays neutral. */
function owQuoteTone(st) {
  return st === "accepted" ? "m-chip--ok" : st === "rejected" ? "m-chip--bad" : st === "sent" ? "m-chip--warn" : "";
}
function owQuoteTotal(q) {
  return calculateLineValue({ stage: "quote", salePrice: Number(q.salePrice) || 0, years: Number(q.years) || 1, quantity: Number(q.qty) || 1, discountPercent: Number(q.discount) || 0, stageEnteredAt: 0 });
}
function owQuotesSection(l) {
  owLoad(l.id, false);
  var w = owWork[l.id] || {};
  var rows = w.data ? w.data.quotes : [];
  /* Printed here AND on the drawer's tab — one bound derivation for both (PORT-SPEC §6). */
  var b = '<section class="ox-sec ow-sec" aria-labelledby="oxsec_q"><div class="ow-top"><div class="ox-sech" id="oxsec_q">عروض الأسعار' +
    (rows.length ? ' <span class="m-chip m-chip--plain">' + dsFig("owQuotes", rows.length) + "</span>" : "") + '</div><span class="sp"></span>' +
    (!owQuote || owQuote.oppId !== l.id ? '<button class="m-btn" id="owqnew_' + l.id + '" data-ow="qnew" data-i="' + l.id + '">' + opIco("plus") + "عرض سعر جديد</button>" : "") + "</div>";
  if (owQuote && owQuote.oppId === l.id) {
    var Q = owQuote;
    var inv = function (f) { return Q.field === f ? ' aria-invalid="true" aria-describedby="owqerr"' : ""; };
    /* The quote's own bounds (opp-work-domain checkQuote): years 1–10 — tighter than a line's 20 —
       quantity 1–10,000, a whole-percent discount. */
    var QB = { salePrice: { min: 0, step: 100, mode: "decimal" }, years: { min: 1, max: 10, step: 1, mode: "numeric" },
      qty: { min: 1, max: 10000, step: 1, mode: "numeric" }, discount: { min: 0, max: 100, step: 1, mode: "numeric" } };
    var num = function (k, id, label, req) {
      var bd = QB[k] || { step: 1 };
      return '<div class="m-field"><label class="m-label' + (req ? " m-req" : "") + '" for="' + id + '">' + label + "</label>" +
        mNum({ id: id, value: Q[k], label: label, min: bd.min, max: bd.max, step: bd.step, mode: bd.mode,
          attrs: ' data-owq="' + k + '"' + inv(k) }) +
        (bd.max && bd.max <= 100 ? '<span class="m-hint">' + mNumRange(bd.min, bd.max) + "</span>" : "") + "</div>";
    };
    b += '<div class="ow-form" role="group" aria-label="عرض سعر جديد"><div class="m-form">' +
      num("salePrice", "owq_price", "السعر السنوي (ر.س)", true) + num("years", "owq_years", "السنوات") +
      num("qty", "owq_qty", "الكمية") + num("discount", "owq_disc", "الخصم ٪") + "</div>" +
      '<div class="m-form"><div class="m-field"><label class="m-label" for="owq_valid">صالح حتى</label>' + mDate({ id: "owq_valid", value: Q.validUntil, min: owToday(), label: "صالح حتى", placeholder: "بلا تاريخ", wide: true,
        attrs: ' data-owq="validUntil"' + inv("validUntil") }) + "</div>" +
      '<div class="m-field"><label class="m-label" for="owq_note">ملاحظة</label><input class="m-input" id="owq_note" maxlength="' + QUOTE_NOTE_MAX + '" value="' + esc(Q.note) + '" data-owq="note" placeholder="مثال: يشمل التدريب والتفعيل"' + inv("note") + "></div></div>" +
      '<div class="ow-total" id="owq_total" aria-live="polite">إجمالي العرض: <b>' + opMoney(owQuoteTotal(Q)) + "</b></div>" +
      '<div class="ow-btns"><button class="m-btn m-btn--primary" id="owqsave" data-ow="qsave"' + (Q.busy ? ' disabled aria-busy="true"' : "") + ">" + (Q.busy ? "جارٍ الحفظ…" : "حفظ كمسودة") + "</button>" +
      '<button class="m-btn" data-ow="qcancel">إلغاء</button>' +
      (Q.err ? '<span class="ow-err" id="owqerr" role="alert">' + opIco("warn") + esc(Q.err) + "</span>" : "") + "</div></div>";
  }
  if (w.failed && !w.data) b += '<div class="ox-hint2" role="alert">' + opIco("warn") + 'تعذّر تحميل عروض الأسعار.<button class="m-btn" data-ow="workretry" data-i="' + l.id + '">أعد المحاولة</button></div>';
  else if (w.data && !rows.length && !(owQuote && owQuote.oppId === l.id)) {
    b += '<div class="m-empty"><p class="m-empty__t">لا عروض أسعار</p>' +
      '<p class="m-empty__d">كل سعر يُعرض على العميل يُحفظ هنا ويبقى بعد قبوله أو رفضه.</p></div>';
  }
  if (rows.length) {
    b += '<div class="ow-list">' + rows.map(function (q) {
      var busy = owQBusy === q.id;
      var acts = "";
      if (q.status === "draft") acts = '<button class="m-btn" data-ow="qmove" data-i="' + q.id + '" data-o="' + l.id + '" data-to="sent"' + (busy ? " disabled" : "") + ">أُرسل للعميل</button>" +
        '<button class="m-btn" data-ow="qmove" data-i="' + q.id + '" data-o="' + l.id + '" data-to="rejected"' + (busy ? " disabled" : "") + ">ألغِ المسودة</button>";
      else if (q.status === "sent") acts = '<button class="m-btn" data-ow="qmove" data-i="' + q.id + '" data-o="' + l.id + '" data-to="accepted"' + (busy ? " disabled" : "") + ">قبله العميل</button>" +
        '<button class="m-btn" data-ow="qmove" data-i="' + q.id + '" data-o="' + l.id + '" data-to="rejected"' + (busy ? " disabled" : "") + ">رفضه العميل</button>" +
        /* The choice lives in state: a repaint used to re-check a box the user had cleared (review). A closed
           line keeps the value it closed at, so the choice is not offered there. */
        (opIsOpen(l) ? '<label class="ow-chk"><input class="m-cb" type="checkbox" id="owqapply_' + q.id + '" data-owapply="' + q.id + '"' + (owQApply[q.id] === false ? "" : " checked") + "> عند القبول: اجعله سعر البند</label>" : "");
      /* The percent sign rides INSIDE its own .m-n or bidi lands it left of its digits; .m-n also
         isolates, which is what the <bdi> around the formula used to do (PORT-SPEC §3). */
      return '<div class="ow-row"><span><span class="ow-amt">' + opMoney(q.amount) + '</span> <span class="m-chip ' + owQuoteTone(q.status) + '">' + esc(QUOTE_STATUS_LABELS[q.status] || q.status) + "</span></span>" +
        '<span class="d">' + fmtD(q.createdAt) + "</span>" +
        '<span class="m">' + opNU(q.salePrice, "ر.س") + " سنويًا × " + opNYearN(q.years) + " × " + opN(q.qty) +
        (q.discount ? " × (1 − " + mPct(q.discount) + ")" : "") +
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
  var line = owLine(oppId);
  var apply = to === "accepted" && !!line && opIsOpen(line) && owQApply[id] !== false;
  owQBusy = id; opRender();
  cfJson("POST", "/admin/opp-quotes/" + id + "/status", { status: to, apply: apply }).then(function (r) {
    owQBusy = 0;
    if (!r.ok) { opToast(r.j.detail || "تعذّر تحديث العرض", true); opRender(); return; }
    if (r.j.opp) oppRows = (oppRows || []).map(function (o) { return o.id === r.j.opp.id ? r.j.opp : o; });
    owLoad(oppId, true);
    owFocusAfter("owqnew_" + oppId, oppId);
    opToast(to === "accepted" ? (apply && r.j.opp ? "قُبل العرض وأصبح سعر البند" : "قُبل العرض — لم يتغيّر سعر البند") : to === "sent" ? "سُجّل إرسال العرض" : "سُجّل رفض العرض", false);
  }).catch(function () { owQBusy = 0; opToast("تعذّر الاتصال", true); opRender(); });
}

/* Runs after the board paints: the dialog fades in once, focus lands on its checked (or first) reason. */
function owAfterRender() {
  /* Leaving a drawer disarms a pending delete: reopening it used to show «تأكيد الحذف» one click from gone. */
  if (owDelArm && !document.getElementById("owdel_" + owDelArm)) owDelArm = 0;
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
  var qa = t.getAttribute("data-owapply");
  if (qa) { owQApply[qa] = !!t.checked; return; }
  var f = t.getAttribute("data-owf");
  if (f && owAct && t.tagName === "SELECT") owAct[f] = t.value;
});
document.addEventListener("keydown", function (ev) {
  var t = ev.target;
  if (ev.key === "Escape" && owDelArm && !owLoss) { owDelArm = 0; opRender(); ev.stopImmediatePropagation(); ev.preventDefault(); return; }
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
