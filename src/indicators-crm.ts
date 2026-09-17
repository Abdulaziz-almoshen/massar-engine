// indicators-crm.ts — «مؤشرات استخدام العملاء» (a tab under العملاء) and «فرص حملات مقترحة» (on the
// campaigns list and inside the wizard). Client A's first feedback: the prototype added the tab and
// the form; the BRD said what they are FOR — explainable campaign opportunities (BR-IND-007/008,
// BR-CAM-003, BR-MON-002/003).
//
// PORTED to the new design system (docs/PORT-SPEC.md) — but only the three surfaces this module OWNS:
//   · vIndicators()     #indicators           — the list, its tiles, its filter bar, its table
//   · vIndicatorForm()  #indicator/<...>      — the create / edit / replace-data form
//   · inDrawer()        the customers drawer  — it carries its OWN .ds6 wrapper, because it is also
//                                               rendered from accounts-crm.ts (ported) and from
//                                               dashboard.ts's customer view (not ported)
// Each speaks the m-* vocabulary: real tables in .m-tablewrap, .m-card sections, .m-field/.m-label/
// .m-input forms, .m-chip for status, .m-item and .m-tl for lists, and every digit through .m-n.
//
// NOT PORTED, AND DELIBERATELY SO. These render INSIDE screens that are still on the old system, and
// new tokens under old structure is not a half-finished redesign, it is a broken page:
//   · sgPanel / sgCard / sgWizardTop / sgExcl / sgTargetedWord — campaigns-crm.ts (#kmon) and the
//     wizard in dashboard.ts
//   · indCustomerBlock — dashboard.ts's customer view
//   · indWizardSelect (dashboard.ts wizard) · indTargetsSelect (targets-crm.ts)
//   · wizObjectiveStep / wizReviewSummary / wizRepeatBlock / rwBlock — dashboard.ts's wizard
//   · inPaintCrumb — it writes into #crumbact, which is dashboard.ts's breadcrumb bar, above #body
// Their markup and their CSS rules (.sg*, .wz-obj, .rw, .wz-review, .sg-applied, .cf-pill.warn/
// .draft/.sys, .in-mem, .in-link, .in-ev) are kept verbatim below.
//
// RULES come from indicator-domain (serialised into the page as INDICATOR_DOMAIN_JS): the control the
// form disables and the write the server refuses give the same reason in the same words.
//
// Revised after the review round of 2026-09-15 (design, UX, engineering, QA, security, GPT): the table
// fits 1280, the drawer cannot outlive its route, a preview cannot be saved while another is being
// read, two tabs cannot silently overwrite each other, the counted nouns agree with their adjectives,
// and the wizard asks the objective at step 2.
//
// NO BACKTICKS ANYWHERE IN THIS FILE, comments included: it is one template literal.

export const INDICATORS_CRM_CSS = `
/* ============================================================================
   THE PORTED SCREENS. Only what the m-* vocabulary genuinely lacks: overlay
   geometry for the drawer, the file drop zone, the preview table's scroll box
   and column widths, the sticky action bar, the candidate picker, and the two
   or three block/reset rules a vocabulary of text scales cannot supply.
   Everything the module used to declare for tables, pills, tiles, fields and
   buttons is gone: .m-table, .m-chip, .m-card, .m-field and .m-btn carry it.
   ============================================================================ */
.ds6 .in-page { display:flex; flex-direction:column; gap:var(--m-4); min-inline-size:0; }

/* A tile is a card that may also be a link; the vocabulary gives it its type scale. */
.ds6 .in-kpi { display:grid; align-content:start; gap:2px; text-decoration:none; color:inherit; min-inline-size:0; }
.ds6 a.in-kpi { transition:background var(--m-out) var(--m-ease); }
@media (hover: hover) and (pointer: fine) { .ds6 a.in-kpi:hover { background:var(--m-page); } }
.ds6 .in-kpi--lead { background:var(--m-ac-dim); border-color:var(--m-ac-line); }

/* The suggestions teaser. A leading accent rule, because the sentence is «مسار proposes», and the
   card has to read as coming from somewhere rather than as one more section of this screen. */
.ds6 .in-teaser { display:flex; align-items:center; gap:var(--m-4); flex-wrap:wrap;
  border-inline-start:3px solid var(--m-ac); }
.ds6 .in-teaser__b { flex:1 1 260px; min-inline-size:0; }

/* The toolbar's filters. Each control keeps its own width rather than stretching to the row. */
.ds6 .in-filters { display:flex; align-items:center; gap:var(--m-2); flex-wrap:wrap; min-inline-size:0; }
.ds6 .in-filters .m-input, .ds6 .in-filters .m-select { inline-size:auto; min-inline-size:150px; }
.ds6 .in-filters .m-input[type="search"] { flex:1 1 200px; max-inline-size:340px; }
/* A filter that is DOING something says so, or a narrowed list looks like an empty one. */
.ds6 .in-filters .in-on { box-shadow:0 0 0 1px var(--m-ac), 0 1px 2px rgba(0,0,0,.05); color:var(--m-ac-deep); }

.ds6 .in-tbl .m-table { min-inline-size:980px; }
.ds6 .in-clip { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
  min-inline-size:0; max-inline-size:26ch; }
/* .m-meta is a text scale, not a block: a table cell's sub-line needs the line break. */
.ds6 .m-table .in-sub, .ds6 .m-item .in-sub { display:block; font-weight:400; }
/* Two lines of description and no more — a paragraph in a cell pushes every other row off screen. */
.ds6 .in-desc { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
/* A disabled indicator keeps its row and loses its emphasis; it is not an error, it is switched off. */
.ds6 .in-row--off .m-td-n, .ds6 .in-row--off { color:var(--m-mut); }
/* A row's actions wrap rather than widen the table. The buttons are compact at a fine pointer and
   take the full 44px target back on a coarse one (the coarse block at the end of this file). */
.ds6 .in-acts2 { display:flex; align-items:center; gap:var(--m-1); flex-wrap:wrap; }
.ds6 .in-btn-sm { min-block-size:36px; padding-inline:var(--m-3); padding-block:4px;
  font-size:var(--m-t-cap); white-space:nowrap; }
.ds6 .in-btn-off { color:var(--m-bad); border-color:var(--m-bad-line); }
/* A name that opens a record is a link inside a table cell, not a button with a border. */
.ds6 button.in-linkbtn { font:inherit; background:none; border:0; padding:0; cursor:pointer;
  text-align:start; min-block-size:0; }

/* ---- the form ---- */
.ds6 .in-form { max-inline-size:880px; display:flex; flex-direction:column; gap:var(--m-4); }
.ds6 .in-secb { display:flex; flex-direction:column; gap:var(--m-4); min-inline-size:0; }
.ds6 .in-row { display:flex; align-items:center; gap:var(--m-2); flex-wrap:wrap; }
.ds6 .in-grp { display:grid; gap:var(--m-1); justify-items:start; }
/* A segmented control whose options are three long Arabic phrases has to be allowed to wrap. */
.ds6 .in-seg { flex-wrap:wrap; }
/* The vocabulary draws the held segment on [aria-pressed]. These groups are RADIO groups, where
   aria-checked is the correct attribute and aria-pressed would be invalid ARIA on role=radio — so
   the held state is drawn from aria-checked here rather than the markup being bent to the CSS. */
.ds6 .m-seg button[aria-checked="true"] { background:var(--m-paper); color:var(--m-ink); box-shadow:var(--m-low); }
/* Three dates in a row; one per row once the row stops fitting them. */
.ds6 .in-g3 { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:var(--m-4); }
@media (max-width:760px) { .ds6 .in-g3 { grid-template-columns:minmax(0,1fr); } }

/* The drop zone. A dashed edge is the one place in this system where a border is the affordance. */
.ds6 .in-drop { position:relative; display:flex; flex-direction:column; align-items:center; gap:var(--m-2);
  text-align:center; padding:var(--m-5); border-radius:var(--m-r-card); border:1.5px dashed var(--m-line-2);
  background:var(--m-page); cursor:pointer;
  transition:background var(--m-out) var(--m-ease), border-color var(--m-out) var(--m-ease); }
.ds6 .in-drop.over, .ds6 .in-drop:focus-within { border-color:var(--m-ac); background:var(--m-ac-dim); }
.ds6 .in-drop .ico { inline-size:40px; block-size:40px; border-radius:var(--m-r-ctl); background:var(--m-ac-dim);
  color:var(--m-ac-deep); display:flex; align-items:center; justify-content:center; }
.ds6 .in-drop .ico svg { inline-size:20px; block-size:20px; }
.ds6 .in-drop .m-meta { max-inline-size:52ch; }
.ds6 .in-drop .in-pickbtn { pointer-events:none; }
.ds6 .in-file { position:absolute; inline-size:1px; block-size:1px; opacity:0; overflow:hidden; }

/* The preview: its own scroll box, because it is a table inside a form section rather than the
   page's own table, and it is capped so the action bar stays reachable. */
.ds6 .in-totals { display:flex; align-items:center; gap:var(--m-2); flex-wrap:wrap; }
.ds6 .in-pv { max-block-size:380px; overflow:auto; border:1px solid var(--m-line); border-radius:var(--m-r-ctl); }
.ds6 .in-pv .m-table { min-inline-size:900px; }
.ds6 .in-pv .m-select { min-inline-size:200px; inline-size:100%; min-block-size:36px; font-size:var(--m-t-cap); }
.ds6 .in-pager { display:flex; align-items:center; gap:var(--m-2); flex-wrap:wrap; }

/* The manual picker: a bounded, scrollable list of candidates, each one a control. */
.ds6 .in-cands { border:1px solid var(--m-line); border-radius:var(--m-r-ctl); max-block-size:260px; overflow:auto; }
.ds6 .in-cand { display:flex; align-items:center; gap:var(--m-2); inline-size:100%; min-block-size:44px;
  padding-inline:var(--m-3); padding-block:6px; font:inherit; font-size:var(--m-t-body); color:var(--m-ink);
  background:transparent; border:0; border-block-end:1px solid var(--m-line); cursor:pointer; text-align:start;
  transition:background var(--m-out) var(--m-ease), transform var(--m-press) var(--m-ease); }
.ds6 .in-cand:last-child { border-block-end:0; }
.ds6 .in-cand:active { transform:scale(.97); }
@media (hover: hover) and (pointer: fine) { .ds6 .in-cand:hover { background:var(--m-page); } }
.ds6 .in-cand[aria-pressed="true"] { background:var(--m-ac-dim); }
.ds6 .in-box { inline-size:16px; block-size:16px; flex:0 0 auto; border-radius:4px;
  box-shadow:inset 0 0 0 1.5px var(--m-line-2); display:inline-flex; align-items:center; justify-content:center; }
.ds6 .in-cand[aria-pressed="true"] .in-box { background:var(--m-ac); box-shadow:none; color:#FFFFFF; }
.ds6 .in-box svg { inline-size:12px; block-size:12px; }
.ds6 .in-picked { display:flex; flex-direction:column; gap:6px; }
.ds6 .in-pick { display:grid; grid-template-columns:minmax(0,1fr) 180px auto; gap:var(--m-2); align-items:center;
  padding-inline:var(--m-3); padding-block:6px; background:var(--m-ac-dim); border-radius:var(--m-r-ctl); }
.ds6 .in-pick .m-input { min-block-size:36px; font-size:var(--m-t-cap); }
@media (max-width:760px) {
  .ds6 .in-pick { grid-template-columns:minmax(0,1fr) auto; }
  .ds6 .in-pick .m-input { grid-column:1 / -1; grid-row:2; }
}

/* The scroll container (#body) has 48px of bottom padding, and a sticky bar stops at the padding
   edge — the form showed through the gap under it. The negative inset reaches the real edge. */
.ds6 .in-acts { display:flex; align-items:center; gap:var(--m-2); flex-wrap:wrap; position:sticky;
  inset-block-end:calc(-1 * var(--m-7)); margin-block-end:calc(-1 * var(--m-7)); z-index:var(--z-sticky, 100);
  background:var(--m-paper); border:1px solid var(--m-line); border-block-end:0;
  border-start-start-radius:var(--m-r-card); border-start-end-radius:var(--m-r-card);
  padding-inline:var(--m-3); padding-block:var(--m-2) calc(var(--m-2) + var(--m-7)); }
@media (max-width:560px) {
  .ds6 .in-acts { inset-block-end:calc(-1 * var(--m-6)); margin-block-end:calc(-1 * var(--m-6));
    padding-block-end:calc(var(--m-2) + var(--m-6)); }
}

/* ---- the customers drawer: the overlay geometry a .m-dlg panel needs without a <dialog> ----
   It slides from the inline start, which in RTL is the right edge; translateX is not direction
   aware, so the LTR case gets its own sign. */
.ds6 .in-scrim { position:fixed; inset:0; z-index:var(--z-modal, 310); background:rgba(11,13,18,.44);
  opacity:0; transition:opacity var(--m-out) var(--m-ease); }
.ds6 .in-scrim.in { opacity:1; }
.ds6 .in-dr { position:fixed; inset-block:0; inset-inline-start:0; inline-size:min(560px, 100vw);
  z-index:var(--z-modal, 310); background:var(--m-paper); border-inline-end:1px solid var(--m-line);
  box-shadow:var(--m-lift); display:flex; flex-direction:column;
  transform:translateX(100%); opacity:0;
  transition:transform var(--m-out) var(--m-ease), opacity var(--m-out) var(--m-ease); }
[dir="ltr"] .ds6 .in-dr { transform:translateX(-100%); }
.ds6 .in-dr.in, [dir="ltr"] .ds6 .in-dr.in { transform:none; opacity:1; transition-duration:var(--m-in); }
.ds6 .in-dr .m-dlg__b { flex:1 1 auto; max-block-size:none; display:flex; flex-direction:column; gap:var(--m-3); }
.ds6 .in-dr .m-dlg__h { align-items:flex-start; }

@media (pointer:coarse) {
  .ds6 .in-btn-sm, .ds6 .in-pv .m-select, .ds6 .in-pick .m-input, .ds6 button.in-linkbtn { min-block-size:44px; }
}
@media (prefers-reduced-motion: reduce) {
  .ds6 .in-dr, .ds6 .in-scrim, .ds6 .in-cand, .ds6 .in-drop { transition:none; }
  .ds6 .in-cand:active { transform:none; }
}

/* ============================================================================
   NOT PORTED, AND DELIBERATELY SO. Everything below draws a surface that
   renders OUTSIDE a .ds6 subtree — «فرص حملات مقترحة» on #kmon and in the
   wizard, the indicator block on the customer record, the wizard's objective
   step, its repeat warning and its review summary. Their rules are kept
   verbatim, on the old tokens, until those screens are ported in turn.
   .in-mem, .in-link and .in-ev are here for the same reason: the customer
   record and the dismissals list still draw with them.
   ============================================================================ */
.cf-pill.warn { background:var(--s-attn-soft); color:var(--s-attn-text); }
.cf-pill.draft { background:var(--s-attn-soft); color:var(--s-attn-text); }
.cf-pill.sys { background:var(--accent-tint); color:var(--accent-deep); }
.in-link { font-family:inherit; font-size:var(--t-sm); font-weight:500; color:var(--ink); background:none; border:none; padding:0; cursor:pointer;
  text-align:start; line-height:var(--lh-body); border-radius:var(--r-sm); }
a.in-link { text-decoration:none; }
.in-link:hover { color:var(--accent-deep); text-decoration:underline; text-underline-offset:3px; }
.in-link:active { transform:scale(.97); }
.in-ev { display:flex; gap:var(--s2); align-items:baseline; flex-wrap:wrap; font-size:var(--t-xs); color:var(--muted); padding:8px 0; border-bottom:1px solid var(--line-soft); }
.in-ev b { color:var(--ink); font-weight:500; }
.in-mem { display:flex; align-items:baseline; gap:var(--s2); flex-wrap:wrap; padding:10px 0; border-bottom:1px solid var(--line-soft); font-size:var(--t-sm); }
.in-mem .v { font-variant-numeric:tabular-nums; color:var(--ink); font-weight:600; font-size:var(--t-xs); background:var(--surface); border-radius:var(--r-pill); padding:1px 8px; }
.in-mem .m { flex-basis:100%; font-size:var(--t-xs); color:var(--muted); }
.sg .btn:active { transform:scale(.97); }
.sg .btn { transition:transform 140ms var(--ease), background var(--fast) var(--ease), color var(--fast) var(--ease); }
.in-link:focus-visible, .sg a:focus-visible, .sg-f .lnk:focus-visible, .sg-toggle:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }

/* ---- «فرص حملات مقترحة» ---- */
.sg { background:var(--paper); border:1px solid var(--line); border-radius:var(--r-lg); overflow:hidden; }
.sg-h { display:flex; align-items:center; gap:var(--s2) var(--s3); flex-wrap:wrap; padding:var(--s3) var(--s4); }
.sg.open .sg-h { border-bottom:1px solid var(--line-soft); }
.sg-h h2 { margin:0; font-size:var(--t-md); font-weight:600; color:var(--ink); }
.sg-h .s { font-size:var(--t-xs); color:var(--muted); line-height:1.6; flex-basis:100%; }
.sg-h .sp { flex:1; }
.sg-h .cnt { font-size:var(--t-xs); font-weight:600; color:var(--accent-deep); background:var(--accent-tint); border-radius:var(--r-pill); padding:2px 10px; font-variant-numeric:tabular-nums; }
.sg-toggle { font-family:inherit; font-size:var(--t-xs); font-weight:600; color:var(--accent-deep); background:none; border:none; cursor:pointer; min-height:32px; padding:0 4px; border-radius:var(--r-sm); }
.sg-g { display:grid; grid-template-columns:repeat(auto-fill, minmax(290px, 1fr)); gap:var(--s3); padding:var(--s3) var(--s4); }
.sg-c { display:flex; flex-direction:column; gap:var(--s2); border:1px solid var(--line); border-radius:var(--r-lg); padding:var(--s3); background:var(--paper); min-width:0; }
.sg-c.off { background:var(--surface); }
.sg-c .top { display:flex; align-items:center; gap:6px; flex-wrap:wrap; font-size:var(--t-xs); color:var(--muted); }
.sg-c .tt { font-size:var(--t-sm); font-weight:600; color:var(--ink); line-height:var(--lh-tight); }
.sg-c .fig { display:flex; align-items:baseline; gap:6px; flex-wrap:wrap; }
.sg-c .fig .k { font-size:var(--t-xs); color:var(--muted); flex-basis:100%; }
.sg-c .fig .n { font-size:var(--t-xl); font-weight:600; color:var(--ink); font-variant-numeric:tabular-nums; }
.sg-c .fig .u { font-size:var(--t-xs); color:var(--muted); }
.sg-c .why { font-size:var(--t-xs); color:var(--ink-2, #33373E); line-height:1.7; }
.sg-src { display:flex; gap:4px 6px; flex-wrap:wrap; align-items:center; font-size:var(--t-xs); color:var(--muted); }
.sg-chip { font-size:var(--t-xs); border-radius:var(--r-pill); padding:2px 9px; background:var(--surface); color:var(--ink-2, #33373E); max-width:100%;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.sg-chip.ex { background:var(--s-off-soft); color:var(--s-off-text); }
.sg-c .ex-l { font-size:var(--t-xs); color:var(--muted); line-height:1.6; }
.sg-c .warn { font-size:var(--t-xs); color:var(--s-attn-text); line-height:1.6; }
.sg-c .acts { display:flex; gap:var(--s2); align-items:center; flex-wrap:wrap; margin-top:auto; padding-top:var(--s2); }
.sg-c .acts .btn { height:34px; padding-inline:12px; font-size:var(--t-xs); text-decoration:none; display:inline-flex; align-items:center; }
.sg-go { background:var(--accent-tint); color:var(--accent-deep); font-weight:600; }
.sg-go:hover { background:var(--accent-bar-hover, #DCE8FC); }
.sg-f { display:flex; align-items:center; gap:var(--s2) var(--s3); flex-wrap:wrap; padding:var(--s2) var(--s4) var(--s3); font-size:var(--t-xs); color:var(--muted); }
.sg-f .lnk { font-family:inherit; font-size:var(--t-xs); font-weight:600; color:var(--accent-deep); background:none; border:none; padding:0; cursor:pointer; min-height:28px; }
.sg-state { padding:var(--s3) var(--s4); font-size:var(--t-sm); color:var(--muted); display:flex; align-items:center; gap:var(--s3); flex-wrap:wrap; line-height:1.7; }
.sg-applied { display:flex; align-items:flex-start; gap:var(--s3); flex-wrap:wrap; border:1px solid var(--line); background:var(--paper);
  border-radius:var(--r-md); padding:var(--s3) var(--s4); margin-bottom:var(--s3); }
.sg-applied .mk { width:24px; height:24px; flex:none; border-radius:var(--r-pill); background:var(--accent-tint); color:var(--accent-deep); display:flex; align-items:center; justify-content:center; }
.sg-applied .mk svg { width:14px; height:14px; }
.sg-applied .tt { font-size:var(--t-sm); font-weight:600; color:var(--ink); }
.sg-applied .s { font-size:var(--t-xs); color:var(--muted); line-height:1.7; margin-top:2px; }
.wz-obj { display:flex; gap:6px; flex-wrap:wrap; }
.wz-obj button { font-family:inherit; min-height:34px; font-size:var(--t-xs); font-weight:500; color:var(--ink); background:var(--paper);
  border:none; box-shadow:inset 0 0 0 1px var(--s-off-mark); border-radius:var(--r-pill); padding:0 14px; cursor:pointer;
  transition:transform 140ms var(--ease), background var(--fast) var(--ease); }
.wz-obj button:active { transform:scale(.97); }
.wz-obj button:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
.wz-obj button[aria-checked="true"] { background:var(--accent-tint); color:var(--accent-deep); box-shadow:inset 0 0 0 1px var(--accent-mark); font-weight:600; }
.rw { border-radius:var(--r-md); padding:var(--s3) var(--s4); font-size:var(--t-xs); line-height:1.8; background:var(--s-attn-soft); color:var(--s-attn-text); }
.rw b { font-weight:600; }
.rw ul { margin:4px 0 0; padding-inline-start:18px; }
.wz-review { display:flex; flex-direction:column; gap:6px; margin-bottom:var(--s3); font-size:var(--t-sm); color:var(--ink); }
.wz-review .r { display:grid; grid-template-columns:96px minmax(0,1fr); gap:var(--s2); align-items:baseline; }
.wz-review .r .k { font-size:var(--t-xs); color:var(--muted); }
.wz-review .msg { font-size:var(--t-xs); color:var(--ink-2, #33373E); background:var(--surface); border-radius:var(--r-md); padding:8px 10px; line-height:1.7; white-space:pre-wrap; max-height:120px; overflow:auto; }
@media (pointer:coarse) { .sg-c .acts .btn, .wz-obj button, .sg-toggle, .sg-f .lnk, .in-link { min-height:44px; } }
@media (prefers-reduced-motion: reduce) { .sg .btn, .wz-obj button { transition:none; } .sg .btn:active, .wz-obj button:active, .in-link:active { transform:none; } }
`;

export const INDICATORS_CRM_JS = `
/* ================= «مؤشرات استخدام العملاء» ================= */
var inRows = null, inCov = { customers: 0, activeCustomers: 0 }, inProducts = [], inToday = "", inSupp = 30;
var inLoading = false, inFailed = false, inPending = false;
var inQ = "", inFProd = "", inFStat = "", inFSig = "";
var inDr = null;        /* { id, data, failed, q, shown, from, route, focus } — the customers drawer */
var inF = null;         /* the create/edit form */
var inFKey = "";        /* the route tail the form state belongs to: "new", "<id>" or "<id>/data" */
var inRowBusy = 0;

/* PLAIN counted nouns, for the places that are NOT parsed as HTML — aria-labels, toasts, and the
   surfaces of this module that are still on the old system. */
function inPl(n, one, two, few, many) { return pluralizeArabic(n, one, two, few, many, fmtN); }
function inNCust(n) { return inPl(n, "عميل واحد", "عميلان", "عملاء", "عميلًا"); }
function inNInd(n) { return inPl(n, "مؤشر واحد", "مؤشران", "مؤشرات", "مؤشرًا"); }
function inNDay(n) { return inPl(n, "يوم واحد", "يومان", "أيام", "يومًا"); }
function inNRow(n) { return inPl(n, "صف واحد", "صفّان", "صفوف", "صفًّا"); }
function inNCamp(n) { return inPl(n, "حملة واحدة", "حملتان", "حملات", "حملة"); }
function inNOpp(n) { return inPl(n, "فرصة واحدة", "فرصتان", "فرص", "فرصة"); }
/* The SAME four-way forms as MARKUP, with the numeral inside .m-n (PORT-SPEC §3 and §5). mPl comes
   from the shared vocabulary helpers; one definition of the rule, two output shapes. */
function inMCust(n) { return mPl(n, "عميل واحد", "عميلان", "عملاء", "عميلًا"); }
function inMInd(n) { return mPl(n, "مؤشر واحد", "مؤشران", "مؤشرات", "مؤشرًا"); }
function inMDay(n) { return mPl(n, "يوم واحد", "يومان", "أيام", "يومًا"); }
function inMRow(n) { return mPl(n, "صف واحد", "صفّان", "صفوف", "صفًّا"); }
function inMOpp(n) { return mPl(n, "فرصة واحدة", "فرصتان", "فرص", "فرصة"); }
function inIco(n) { return typeof opIco === "function" ? opIco(n) : ""; }
function inToast(m, bad, act, fn) { if (typeof opToast === "function") opToast(m, bad, act, fn); else alertBar(m, bad); }
/* indicators.edit — exec and sales read the indicators and create none (§22). */
function inMayEdit() { return typeof meCan !== "function" || meCan("indicators.edit"); }
function inMayCampaign() { return typeof meCan !== "function" || meCan("campaigns.create"); }

function inRoute() { return (location.hash || "").slice(1); }
/* The actor label the server stores for the shared admin token. «اللوحة» means nothing to a reader. */
function inBy(b) { return !b || b === "اللوحة" ? "المسؤول" : b; }
/* Gregorian, western digits: «ar-SA» alone defaults to the Hijri calendar. Returns "" when there is
   no date — the CALL SITE decides which absence that is, because a missing measurement date is not
   the same fact as an optional period nobody filled in (PORT-SPEC §4). */
function inDate(iso) {
  if (!iso) return "";
  var d = new Date(String(iso) + "T00:00:00");
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "long", year: "numeric" });
}
/* A date as a CELL: the digits isolated, or the named absence. */
function inDateC(iso, nilText, kind) {
  var s = inDate(iso);
  return s ? '<span class="m-n">' + esc(s) + "</span>" : mNil(nilText || "لم تُسجَّل", kind || "unset");
}
function inStamp(ms) {
  return new Date(Number(ms)).toLocaleString("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}
function inStampC(ms) { return '<span class="m-n">' + esc(inStamp(ms)) + "</span>"; }
/* Colour means status, never decoration: active is a good state, a draft is unfinished work, and
   an inactive indicator is neither — it is simply switched off, so it takes the idle tone. */
function inStatusPill(st) {
  var tone = st === "active" ? " m-chip--ok" : st === "draft" ? " m-chip--warn" : "";
  return '<span class="m-chip' + tone + '">' + esc(INDICATOR_STATUS_LABELS[st] || st) + "</span>";
}
function inById(id) { return (inRows || []).filter(function (r) { return String(r.id) === String(id); })[0] || null; }

function inLoad(force) {
  if (inLoading) { if (force) inPending = true; return; }
  if (inRows && !force) return;
  if (inFailed && !force) return;
  inLoading = true;
  pxGet("/admin/indicators").then(function (j) {
    inRows = j.indicators || []; inCov = j.coverage || inCov; inProducts = j.products || []; inToday = j.today || ""; inSupp = j.suppressionDays;
    inFailed = false;
  }).catch(function () { inFailed = true; }).then(function () {
    inLoading = false;
    if (inPending) { inPending = false; inLoad(true); return; }
    render(false);
  });
}

/* ---------------- the list ---------------- */
function inFiltered() {
  var q = inQ.trim();
  return (inRows || []).filter(function (r) {
    if (inFProd && r.product !== inFProd) return false;
    if (inFStat && r.status !== inFStat) return false;
    if (inFSig && r.signal !== inFSig) return false;
    if (q && String(r.name).indexOf(q) < 0 && String(r.description || "").indexOf(q) < 0) return false;
    return true;
  });
}
/* PORT-SPEC §6. Every count this screen prints in more than one place is derived ONCE, from the SAME
   array the markup renders, and re-run on every paint by dsVerify. The list total is printed in the
   «المؤشرات النشطة» tile AND in the filter bar; the member count is printed on the row AND in the
   drawer's sub-head. A figure that drifts is outlined and named in the console. */
function inBind() {
  dsD("inNAll", function () { return (inRows || []).length; });
  dsD("inNShown", function () { return inFiltered().length; });
  dsD("inNActive", function () { return (inRows || []).filter(function (r) { return r.status === "active"; }).length; });
  dsD("inNProd", function () {
    var p = {}; (inRows || []).forEach(function (r) { if (r.product) p[r.product] = 1; });
    return Object.keys(p).length;
  });
}
/* The row and the drawer print one fact — «how many customers are in this indicator» — from two
   reads. Binding both to the registry means a stale count cannot sit quietly beside a fresh one.
   When the list was never loaded (the drawer opened from the customer record) the derivation
   returns null and dsVerify skips it rather than crying wolf. */
function inBindMem(id) {
  dsD("inMem_" + id, function () { var r = inById(id); return r ? r.memberCount : null; });
}
function inKpis() {
  var all = inRows || [];
  var active = all.filter(function (r) { return r.status === "active"; }).length;
  var prods = {}; all.forEach(function (r) { if (r.product) prods[r.product] = 1; });
  var last = all.filter(function (r) { return r.status !== "draft"; }).reduce(function (a, r) { return r.dataUpdatedAt > a ? r.dataUpdatedAt : a; }, "");
  var fr = last ? indicatorFreshness(last, inToday) : { days: null, stale: false };
  var tile = function (k, v, s, href, lead) {
    var body = '<span class="m-stat__k">' + k + '</span><span class="m-stat__v">' + v + "</span>" +
      (s ? '<span class="m-stat__s">' + s + "</span>" : "");
    return href
      ? '<a class="m-card in-kpi" href="' + href + '">' + body + "</a>"
      : '<div class="m-card in-kpi' + (lead ? " in-kpi--lead" : "") + '">' + body + "</div>";
  };
  return '<div class="m-kpis">' +
    tile("المؤشرات النشطة", dsFig("inNActive", active),
      "من أصل " + opPlFig("inNAll", all.length, "مؤشر واحد", "مؤشران", "مؤشرات", "مؤشرًا"), "", true) +
    tile("العملاء المشمولون", mN(inCov.customers),
      mN(inCov.activeCustomers) + " منهم في مؤشر نشط · اعرضهم", "#targets/indicators") +
    tile("المنتجات المرتبطة", dsFig("inNProd", Object.keys(prods).length), "") +
    /* No measurement date on record is a date nobody entered, not a legitimate nothing. */
    tile("آخر تحديث للبيانات", last ? inDateC(last) : mNil("لم تُسجَّل", "unset"),
      fr.days == null ? "" : fr.days === 0 ? "اليوم" : "قبل " + inMDay(fr.days)) +
    "</div>";
}
function inTeaser() {
  sgLoad(false);
  if (!sgData) return "";
  var n = (sgData.suggestions || []).length;
  if (!n) return "";
  return '<div class="m-card in-teaser" role="status"><div class="in-teaser__b">' +
    '<p class="m-label">اقترح مسار ' + inMOpp(n) + " لحملات من هذه المؤشرات</p>" +
    '<p class="m-meta">لكل فرصة سببها، والمؤشرات التي بُنيت عليها، وعدد العملاء بعد استبعاد من طلب الإيقاف ومن أُرسلت إليه حملة خلال ' +
      inMDay(sgData.suppressionDays) + ".</p></div>" +
    '<a class="m-btn" href="#kmon">راجع الفرص</a></div>';
}
function inRow(r) {
  var fr = indicatorFreshness(r.dataUpdatedAt, inToday);
  var busy = inRowBusy === r.id;
  var archived = r.product && inProducts.indexOf(r.product) < 0;
  inBindMem(r.id);
  var h = '<tr' + (r.status === "active" ? "" : ' class="in-row--off"') + ' data-inrow="' + r.id + '">';
  h += '<td class="m-td-n"><button class="m-link in-linkbtn in-clip" id="inv' + r.id + '" data-in="view" data-i="' + r.id + '" title="عرض العملاء">' + esc(r.name) + "</button>" +
    (r.description ? '<span class="m-meta in-sub in-desc">' + esc(r.description) + "</span>" : "") + "</td>";
  /* An indicator with no product is a link nobody made — the form requires one, so this is a draft
     that stopped short, not a legitimate nothing. */
  h += '<td><span class="in-clip" title="' + esc(r.product || "") + '">' +
    (r.product ? esc(r.product) + (archived ? ' <span class="m-chip">مؤرشف</span>' : "") : mNil("بلا منتج", "unset")) + "</span></td>";
  h += '<td><span class="in-clip" title="' + esc(INDICATOR_SIGNAL_LABELS[r.signal] || "") + '">' + esc(INDICATOR_SIGNAL_SHORT[r.signal] || r.signal) + "</span></td>";
  h += '<td class="m-td-v"><button class="m-link in-linkbtn" id="invn' + r.id + '" data-in="view" data-i="' + r.id + '" aria-label="عرض ' + esc(inNCust(r.memberCount)) + '">' +
    opPlFig("inMem_" + r.id, r.memberCount, "عميل واحد", "عميلان", "عملاء", "عميلًا") + "</button></td>";
  h += "<td>" + inDateC(r.dataUpdatedAt) +
    (fr.stale ? ' <span class="m-chip m-chip--warn" title="البيانات أقدم من ' + esc(inNDay(INDICATOR_STALE_DAYS)) + '">قديمة</span>' : "") + "</td>";
  h += "<td>" + inStatusPill(r.status) + "</td>";
  h += '<td><span class="in-acts2">' +
    '<button class="m-btn in-btn-sm" id="invb' + r.id + '" data-in="view" data-i="' + r.id + '">عرض العملاء</button>' +
    (inMayEdit()
      ? '<a class="m-btn in-btn-sm" href="#indicator/' + r.id + '">' + (r.status === "draft" ? "أكمل المسودة" : "تعديل") + "</a>" +
        '<a class="m-btn in-btn-sm" href="#indicator/' + r.id + '/data" title="ارفع بيانات أحدث لهذا المؤشر">تحديث البيانات</a>' +
        (r.status === "draft" ? "" : '<button class="m-btn in-btn-sm' + (r.status === "active" ? " in-btn-off" : "") + '" data-in="toggle" data-i="' + r.id + '"' + (busy ? ' disabled aria-busy="true"' : "") + ">" +
          (r.status === "active" ? "تعطيل" : "تفعيل") + "</button>")
      : "") +
    "</span></td></tr>";
  return h;
}
function vIndicators() {
  inLoad(false);
  /* Leaving the form for the list discards its state: an edit reopened later must show the row as it
     is now, not the status it had before someone disabled it from this list (eng review). */
  inF = null; inFKey = "";
  setTimeout(inPaintCrumb, 0);
  inBind();
  var open = '<div class="ds6"><div class="in-page">', shut = "</div></div>";
  if (inRows === null && !inFailed) {
    return open + '<div class="m-card" aria-busy="true">' + moSkeleton(5, ["w40", "w80", "w60"]) + "</div>" + shut + inDrawer();
  }
  if (inRows === null) {
    /* A FAILED LOAD MUST NOT LOOK LIKE AN EMPTY LIST: it says which, and offers the retry. */
    return open + '<div class="m-alert" role="alert"><span class="m-alert__t">تعذّر تحميل المؤشرات</span>' +
      '<span class="m-alert__d">لم يُعرض شيء لأن الطلب فشل، لا لأن القائمة فارغة.</span>' +
      '<button class="m-btn" data-in="retry">أعد المحاولة</button></div>' + shut + inDrawer();
  }
  var h = open;
  if (inFailed) {
    h += '<div class="m-alert" role="alert"><span class="m-alert__d">' + inIco("warn") +
      "تعذّر التحديث — المعروض آخر نسخة محمّلة.</span>" +
      '<button class="m-btn" data-in="retry">أعد المحاولة</button></div>';
  }
  if (!inRows.length) {
    h += '<div class="m-card m-empty"><p class="m-empty__t">لا مؤشرات استخدام بعد</p>' +
      '<p class="m-empty__d">المؤشر قائمة عملاء يجمعهم وصف قابل للقياس — «استخدام مرتفع للإجازات المرضية»، «مرتبطون تقنيًا»، «غير مشتركين». ' +
      'ارفعه من ملف Excel أو اختر عملاءه يدويًا، ويقرؤه مسار ليقترح حملات مبنية عليه ويذكر سبب كل اقتراح.</p>' +
      (inMayEdit()
        ? '<div class="m-empty__a in-row"><a class="m-btn m-btn--primary" href="#indicator/new">' + inIco("plus") + "إضافة مؤشر</a>" +
          '<a class="m-btn" href="/assets/indicator-template.xlsx">تحميل نموذج Excel</a></div>'
        : "") + "</div>";
    return h + shut + inDrawer();
  }
  h += inKpis();
  h += inTeaser();
  var rows = inFiltered();
  var prodOpts = {}; inRows.forEach(function (r) { if (r.product) prodOpts[r.product] = 1; });
  h += '<section class="m-card m-card--pad0 in-tbl" aria-label="مؤشرات الاستخدام"><div class="m-tools">' +
    '<div class="in-filters">' +
    '<input class="m-input" id="inq" type="search" value="' + esc(inQ) + '" placeholder="بحث باسم المؤشر أو وصفه…" aria-label="بحث في المؤشرات" data-inset="q">' +
    '<select class="m-select' + (inFProd ? " in-on" : "") + '" aria-label="المنتج" data-inset="prod"><option value="">كل المنتجات</option>' +
      Object.keys(prodOpts).sort().map(function (p) { return '<option value="' + esc(p) + '"' + (inFProd === p ? " selected" : "") + ">" + esc(clip(p, 28)) + "</option>"; }).join("") + "</select>" +
    '<select class="m-select' + (inFStat ? " in-on" : "") + '" aria-label="الحالة" data-inset="stat"><option value="">كل الحالات</option>' +
      INDICATOR_STATUSES.map(function (s) { return '<option value="' + s + '"' + (inFStat === s ? " selected" : "") + ">" + INDICATOR_STATUS_LABELS[s] + "</option>"; }).join("") + "</select>" +
    '<select class="m-select' + (inFSig ? " in-on" : "") + '" aria-label="دلالة المؤشر" data-inset="sig"><option value="">كل الدلالات</option>' +
      INDICATOR_SIGNALS.map(function (s) { return '<option value="' + s + '"' + (inFSig === s ? " selected" : "") + ">" + esc(INDICATOR_SIGNAL_LABELS[s]) + "</option>"; }).join("") + "</select>" +
    "</div>" +
    '<span class="m-cap">' + dsFig("inNShown", rows.length) + " من " + dsFig("inNAll", inRows.length) + "</span></div>";
  h += '<div class="m-tablewrap"><table class="m-table"><thead><tr>' +
    "<th>اسم المؤشر</th><th>المنتج المرتبط</th><th>الدلالة</th><th>العملاء</th>" +
    "<th>آخر تحديث</th><th>الحالة</th><th>الإجراءات</th></tr></thead><tbody>";
  if (!rows.length) {
    h += '<tr class="m-table__empty"><td colspan="7"><div class="m-empty">' +
      '<p class="m-empty__t">لا مؤشرات مطابقة</p>' +
      '<p class="m-empty__d">لا مؤشر يطابق التصفية الحالية.</p>' +
      '<div class="m-empty__a"><button class="m-btn" data-in="clearf">مسح التصفية</button></div></div></td></tr>';
  }
  rows.forEach(function (r) { h += inRow(r); });
  h += "</tbody></table></div>";
  h += '<p class="m-meta" style="padding-inline:var(--m-4);padding-block:var(--m-3)">المؤشر المعطَّل يبقى بسجله وعملائه ولا يدخل في الفرص المقترحة الجديدة. «تحديث البيانات» يستبدل قائمة العملاء بملف أحدث ويُسجَّل في سجل التغييرات.</p>';
  h += "</section>";
  return h + shut + inDrawer();
}
/* NOT PORTED: this writes into #crumbact, which is dashboard.ts's breadcrumb bar — above #body and
   outside every .ds6 subtree. It keeps the old vocabulary until that bar is ported. */
function inPaintCrumb() {
  var act = document.getElementById("crumbact");
  if (!act || inRoute().split("/")[0] !== "indicators") return;
  act.innerHTML = inMayEdit()
    ? '<a href="#indicator/new" class="btn btn-teal" style="text-decoration:none;display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:var(--r-sm);font-size:var(--t-sm);">' + inIco("plus") + "إضافة مؤشر</a>"
    : "";
}

/* ---------------- the customers drawer ---------------- */
var IN_MATCHED_BY = { phone: "طوبق بالجوال", code: "طوبق بالمعرف", name: "طوبق بالاسم", manual: "اختير يدويًا", review: "اختير بعد مراجعة" };
var IN_EVENT = { created: "أُنشئ", edited: "عُدّل", data_replaced: "استُبدلت البيانات", activated: "فُعّل", deactivated: "عُطّل" };
function inOpenDrawer(id, from) {
  inDr = { id: id, data: null, failed: false, q: "", shown: false, from: from || "", route: inRoute(), focus: true };
  render(false);
  pxGet("/admin/indicators/" + id).then(function (j) { if (inDr && inDr.id === id) inDr.data = j.indicator; })
    .catch(function () { if (inDr && inDr.id === id) inDr.failed = true; })
    .then(function () { if (inDr && inDr.id === id) render(false); });
}
function inCloseDrawer() {
  if (!inDr) return;
  var from = inDr.from;
  document.querySelectorAll(".in-drw .in-dr, .in-drw .in-scrim").forEach(function (el) { el.classList.remove("in"); });
  /* --m-out, the exit duration the panel is actually animating over. */
  setTimeout(function () {
    inDr = null; render(false);
    var t = from && document.getElementById(from); if (t) t.focus();
  }, 120);
}
function inDrawer() {
  if (!inDr) return "";
  /* A drawer belongs to the route it was opened on. Its «تعديل» and customer links change the hash,
     and the drawer used to stay painted, modal, over the screen they led to (eng review). */
  if (inDr.route !== inRoute()) { inDr = null; return ""; }
  var it = inDr.data, row = inById(inDr.id);
  var cls = inDr.shown ? " in" : "";
  var title = it ? it.name : row ? row.name : "المؤشر";
  if (it) inBindMem(it.id);
  var sub = it
    ? opPlFig("inMem_" + it.id, it.members.length, "عميل واحد", "عميلان", "عملاء", "عميلًا") + " · " +
      (it.product ? esc(it.product) : mNil("بلا منتج", "unset")) + " · " + inStatusPill(it.status)
    : "";
  var b = "";
  if (!it && !inDr.failed) b = '<div aria-busy="true">' + moSkeleton(4, ["w80", "w60", "w40"]) + "</div>";
  else if (!it) {
    b = '<div class="m-alert" role="alert"><span class="m-alert__d">تعذّر تحميل المؤشر.</span>' +
      '<button class="m-btn" data-in="drretry">أعد المحاولة</button></div>';
  } else {
    var fr = indicatorFreshness(it.dataUpdatedAt, inToday);
    b += '<p class="m-meta">' + esc(INDICATOR_SIGNAL_LABELS[it.signal] || "") + " · " + esc(CUSTOMER_TYPE_LABELS[it.customerType] || "") +
      " · بيانات " + inDateC(it.dataUpdatedAt) +
      (fr.stale ? ' <span class="m-chip m-chip--warn">أقدم من ' + esc(inNDay(INDICATOR_STALE_DAYS)) + "</span>" : "") +
      /* A period nobody entered is optional metadata, not data anyone owes. */
      (it.periodFrom || it.periodTo ? " · الفترة " + inDateC(it.periodFrom, "بلا بداية", "none") + " ← " + inDateC(it.periodTo, "بلا نهاية", "none") : "") +
      (it.source === "file" && it.sourceFilename ? " · من ملف " + esc(it.sourceFilename) : it.source === "manual" ? " · اختيار يدوي" : "") + "</p>";
    if (it.description) b += '<p class="m-body">' + esc(it.description) + "</p>";
    b += '<input class="m-input" id="indrq" data-inset="drq" value="' + esc(inDr.q) + '" placeholder="ابحث في عملاء المؤشر…" aria-label="بحث في عملاء المؤشر">';
    var q = inDr.q.trim();
    var list = it.members.filter(function (m) { return !q || m.name.indexOf(q) >= 0 || m.phone.indexOf(q) >= 0; });
    var shown = list.slice(0, 200);
    b += "<div>";
    if (!list.length) {
      b += '<div class="m-empty"><p class="m-empty__t">' + (q ? "لا عميل يطابق «" + esc(q) + "»" : "لا عملاء في هذا المؤشر") + "</p></div>";
    }
    shown.forEach(function (m) {
      /* A customer never messaged has no conversation record yet, and #customer/<phone> said so with a
         dead end. Those open their row in the customer book instead (UX review). */
      var talked = typeof contactByPhone === "function" && contactByPhone(m.phone);
      var meta = [m.city ? esc(m.city) : "", m.period ? esc(m.period) : "", m.matchedBy ? IN_MATCHED_BY[m.matchedBy] || "" : "",
        talked ? "" : "لم تُراسل بعد", '<span class="m-n">+' + esc(m.phone) + "</span>"].filter(Boolean).join(" · ");
      b += '<div class="m-item"><span class="m-item__b">' +
        (talked
          ? '<a class="m-item__n" href="#customer/' + esc(m.phone) + '">' + esc(m.name) + "</a>"
          : '<a class="m-item__n" href="#account/' + Number(m.entityId) + '" title="لم تُراسل بعد — افتح سجل العميل">' + esc(m.name) + "</a>") +
        '<span class="m-item__s">' + meta + "</span></span>" +
        (m.value ? '<span class="m-item__v m-n">' + esc(m.value) + "</span>" : "") + "</div>";
    });
    if (list.length > shown.length) {
      b += '<p class="m-meta">يُعرض ' + mN(shown.length) + " من " + mN(list.length) + " — ضيّق البحث.</p>";
    }
    b += "</div>";
    if (it.events && it.events.length) {
      b += '<div><p class="m-label">سجل التغييرات</p><div class="m-tl">';
      it.events.forEach(function (e) {
        var extra = e.action === "data_replaced" && e.detail ? " (" + mN(e.detail.before) + " ← " + mN(e.detail.after) + ")" :
          e.action === "created" && e.detail ? " (" + inMCust(e.detail.members) + ")" : "";
        b += '<div class="m-tl__i"><span class="m-tl__d"></span><span><span class="m-tl__n">' +
          esc(IN_EVENT[e.action] || e.action) + extra + '</span><span class="m-tl__s">' + esc(inBy(e.by)) + "</span></span>" +
          '<span class="m-tl__t">' + inStampC(e.at) + "</span></div>";
      });
      b += "</div></div>";
    }
  }
  var foot = it ? (inMayEdit() ? '<a class="m-btn" href="#indicator/' + it.id + '">تعديل</a>' : "") +
    (it.product && it.members.length && inMayCampaign() ? '<button class="m-btn m-btn--primary" data-in="drcamp">إنشاء حملة لهؤلاء</button>' : "") : "";
  /* Its OWN .ds6: this drawer is also rendered from accounts-crm.ts and from the customer record in
     dashboard.ts, so it cannot rely on a host wrapper that may or may not be there. */
  return '<div class="ds6"><div class="in-drw"><div class="in-scrim' + cls + '" data-in="drclose"></div>' +
    '<div class="in-dr' + cls + '" role="dialog" aria-modal="true" aria-labelledby="indrt">' +
    '<div class="m-dlg__h"><div><h2 class="m-dlg__t" id="indrt" tabindex="-1">' + esc(title) + "</h2>" +
    (sub ? '<p class="m-meta">' + sub + "</p>" : "") + "</div>" +
    '<button class="m-x" aria-label="إغلاق" data-in="drclose">' + inIco("x") + "</button></div>" +
    '<div class="m-dlg__b">' + b + "</div>" + (foot ? '<div class="m-dlg__f">' + foot + "</div>" : "") + "</div></div></div>";
}
/* Runs after every paint. The drawer slides in once (painted without «in», class added next frame);
   the load finishing repaints it, which drops focus from its heading, so focus is put back once. The
   data route scrolls section 2 into view, since «تحديث البيانات» is about nothing else. */
function inAfterPaint() {
  if (inDr && inDr.shown && inDr.focus && (inDr.data || inDr.failed)) {
    inDr.focus = false;
    var h0 = document.getElementById("indrt"); if (h0) h0.focus();
  }
  if (inDr && !inDr.shown && document.querySelector(".in-drw")) {
    requestAnimationFrame(function () {
      if (!inDr) return;
      document.querySelectorAll(".in-drw .in-dr, .in-drw .in-scrim").forEach(function (el) { el.classList.add("in"); });
      inDr.shown = true;
      var hd = document.getElementById("indrt"); if (hd) hd.focus();
    });
  }
  if (inF && inF.scrollTo && inF.loaded) {
    var target = document.getElementById(inF.scrollTo);
    inF.scrollTo = "";
    if (target) {
      target.scrollIntoView({ block: "start" });
      var first = target.querySelector('[role="radio"][aria-checked="true"], input, button');
      if (first) first.focus({ preventScroll: true });
    }
  }
}

/* ---------------- the form ---------------- */
function inBlank() {
  return { id: 0, loaded: true, failed: false, missing: false, updatedAt: 0, origProduct: "",
    d: { name: "", description: "", product: "", signal: "", customerType: "medical", status: "active", periodFrom: "", periodTo: "", dataUpdatedAt: inToday },
    replace: true, mode: "file", preview: null, pvBusy: false, pvErr: "", pvFilter: "all", pvPage: 0, pvSeq: 0, resolve: {}, paste: "", fileName: "", lastFile: null,
    manualQ: "", picked: [], err: "", field: "", busy: false, memberCount: 0, source: "", sourceFilename: "", events: [], scrollTo: "", adding: {} };
}
function inEnsureForm(rest) {
  if (inF && inFKey === rest) return;
  var parts = rest.split("/");
  var key = parts[0] || "new", dataStep = parts[1] === "data";
  inFKey = rest;
  inF = inBlank();
  if (key === "new") return;
  inF.loaded = false; inF.replace = dataStep;
  var f = inF;
  pxGet("/admin/indicators/" + key).then(function (j) {
    if (inF !== f) return;
    var it = j.indicator;
    f.id = it.id; f.updatedAt = it.updatedAt; f.origProduct = it.product || "";
    f.d = { name: it.name, description: it.description || "", product: it.product || "", signal: it.status === "draft" && it.signal === "other" ? "" : it.signal,
      customerType: it.customerType, status: it.status === "draft" ? "active" : it.status, periodFrom: it.periodFrom || "", periodTo: it.periodTo || "",
      dataUpdatedAt: dataStep ? (j.today || inToday) : it.dataUpdatedAt };
    f.memberCount = it.members.length; f.source = it.source; f.sourceFilename = it.sourceFilename || ""; f.events = it.events || [];
    f.wasDraft = it.status === "draft";
    /* An indicator with no customers yet (a draft stopped early) opens on data entry, not on a
       «replace» button over zero rows (QA). */
    if (!it.members.length) f.replace = true;
    /* Manual edits keep where each customer came from: the uploaded name, note and match method are the
       audit trail of why a clinic is in this indicator (eng review). */
    f.picked = it.members.map(function (m) { return { entityId: m.entityId, value: m.value || "", period: m.period || "", note: m.note || "", sourceName: m.sourceName || "", matchedBy: m.matchedBy || "manual", name: m.name }; });
    f.loaded = true;
    if (dataStep) f.scrollTo = "inf_members";
  }).catch(function (e) {
    if (inF !== f) return;
    if (/404|400/.test(String(e && e.message))) f.missing = true; else f.failed = true;
  }).then(function () { render(false); });
}
function inFld(f) { return inF && inF.field === f ? ' aria-invalid="true" aria-describedby="err_' + f + '"' : ""; }
function inFerr(f) { return inF && inF.field === f && inF.err ? '<span class="m-err" id="err_' + f + '" role="alert">' + inIco("warn") + esc(inF.err) + "</span>" : ""; }
function inIncluded() {
  if (!inF) return [];
  var out = [], seen = {};
  var add = function (m) { if (seen[m.entityId]) return; seen[m.entityId] = 1; out.push(m); };
  if (inF.mode === "manual") {
    inF.picked.forEach(function (p) { add({ entityId: p.entityId, value: p.value, period: p.period, note: p.note, sourceName: p.sourceName, matchedBy: p.matchedBy || "manual" }); });
    return out;
  }
  var rows = inF.preview ? inF.preview.rows : [];
  rows.forEach(function (r) {
    if (r.status === "matched") add({ entityId: r.entityId, value: r.value, period: r.period, note: r.note, sourceName: r.name, matchedBy: r.by });
    else if (r.status === "review" && inF.resolve[r.line]) add({ entityId: Number(inF.resolve[r.line]), value: r.value, period: r.period, note: r.note, sourceName: r.name, matchedBy: "review" });
  });
  return out;
}
function inHowText(sig, product) {
  var p = product ? "«" + esc(product) + "»" : "المنتج المرتبط";
  var m = {
    high_usage: "يدخل في قاعدة <b>«استخدام مرتفع دون ربط»</b> مع مؤشر «مرتبطون تقنيًا» لـ" + p + ": من في هذا المؤشر ولا يظهر في مؤشر الربط يُقترح لحملة ربط. وإن لم يوجد مؤشر ربط للمنتج، تُعرض فرصة «توسيع الاستخدام» مع التنبيه بأن بعضهم قد يكون مرتبطًا.",
    usage_no_integration: "القائمة نفسها هي <b>«استخدام مرتفع دون ربط»</b>: تُقترح كما هي لحملة ربط " + p + "، ويُستبعد منها من يظهر في مؤشر «مرتبطون تقنيًا» للمنتج إن وُجد.",
    integrated: "يُطرح من مؤشرات «استخدام مرتفع» لـ" + p + "، فلا تُقترح حملة ربط على من لديه ربط بالفعل. ويُعد أصحابه مستخدمين لـ" + p + " في قاعدة البيع المتقاطع.",
    uses: "يُعد أصحابه مستخدمين لـ" + p + ": يُقترحون لبيع متقاطع لمنتجات القطاع نفسه.",
    not_using: "يُقترح أصحابه لحملة <b>«استهداف غير المشتركين»</b> في " + p + "، ويُستخدم في البيع المتقاطع من منتجات القطاع نفسه.",
    other: "لا يدخل في القواعد الآلية. يظهر شريحةً جاهزة لحملة على " + p + " دون أن يدّعي مسار دلالة لم تُحدَّد.",
  };
  return (m[sig] || "اختر دلالة المؤشر أعلاه ليظهر هنا كيف يستخدمه مسار.") +
    " لا يدخل في أي توصية إلا وهو <b>نشط</b>، ويُستبعد تلقائيًا من طلب الإيقاف، ومن لديه فرصة مفتوحة للمنتج، ومن أُرسلت إليه حملة عنه خلال " + inMDay(inSupp) + ".";
}
function inSel(id, label, k, value, opts, req, hint) {
  return '<div class="m-field"><label class="m-label' + (req ? " m-req" : "") + '" for="' + id + '">' + label + "</label>" +
    '<select class="m-select" id="' + id + '" data-infld="' + k + '"' + (req ? ' aria-required="true"' : "") + inFld(k) + ">" +
    opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(value) === String(o[0]) ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") +
    "</select>" + (hint ? '<span class="m-hint">' + hint + "</span>" : "") + inFerr(k) + "</div>";
}
function inInp(id, label, k, value, extra, req, hint) {
  extra = extra || {};
  return '<div class="m-field"><label class="m-label' + (req ? " m-req" : "") + '" for="' + id + '">' + label + "</label>" +
    '<input class="m-input" id="' + id + '" data-infld="' + k + '" value="' + esc(value || "") + '"' +
    (extra.type ? ' type="' + extra.type + '" lang="en"' : "") + (extra.max ? ' maxlength="' + extra.max + '"' : "") + (extra.ph ? ' placeholder="' + esc(extra.ph) + '"' : "") +
    (req ? ' aria-required="true"' : "") + inFld(k) + ">" + (hint ? '<span class="m-hint">' + hint + "</span>" : "") + inFerr(k) + "</div>";
}
/* A radiogroup, drawn as a segmented control. aria-checked carries the state (aria-pressed would be
   invalid ARIA on role=radio), and the module's own rule draws the held option from it. */
function inSeg(k, value, opts, label) {
  var lid = "seg_" + k;
  return (label ? '<span class="m-label" id="' + lid + '">' + label + "</span>" : "") +
    '<span class="m-seg in-seg" role="radiogroup"' + (label ? ' aria-labelledby="' + lid + '"' : ' aria-label="تصفية الصفوف"') + ">" + opts.map(function (o) {
      return '<button type="button" role="radio" aria-checked="' + (value === o[0]) + '" data-in="seg" data-k="' + k + '" data-v="' + esc(o[0]) + '">' + esc(o[1]) + "</button>";
    }).join("") + "</span>";
}
var IN_PV_PAGE = 100;
function inPreviewView() {
  var pv = inF.preview;
  if (inF.pvBusy) return '<div aria-busy="true">' + moSkeleton(3, ["w60", "w80"]) + "</div>";
  if (inF.pvErr) return '<div class="m-alert" role="alert"><span class="m-alert__d">' + inIco("warn") + esc(inF.pvErr) + "</span></div>";
  if (!pv) return "";
  var t = pv.totals;
  var reviews = pv.rows.filter(function (r) { return r.status === "review"; });
  var resolved = reviews.filter(function (r) { return inF.resolve[r.line]; }).length;
  var inc = inIncluded().length;
  /* PORT-SPEC §6: what will be saved is printed in the totals strip AND again under the table, from
     the same rows and the same resolutions, so the two lines cannot disagree. */
  dsD("inPvInc", function () { return inF ? inIncluded().length : null; });
  dsD("inPvResolved", function () {
    if (!inF || !inF.preview) return null;
    return inF.preview.rows.filter(function (r) { return r.status === "review" && inF.resolve[r.line]; }).length;
  });
  /* A review row resolved to a customer another row already matched is saved once; say so rather than
     let the count silently disagree with the number of choices made. */
  var dupPicks = t.matched + resolved - inc;
  var h = '<div class="in-totals" role="status">' +
    '<span class="m-chip">' + inMRow(t.total) + (pv.filename ? " من " + esc(pv.filename) : "") + "</span>" +
    '<span class="m-chip' + (t.matched ? " m-chip--ok" : "") + '">مطابق ' + mN(t.matched) + "</span>" +
    (t.review ? '<span class="m-chip m-chip--warn">يحتاج مراجعة ' + mN(t.review) + " · روجع " + dsFig("inPvResolved", resolved) + "</span>"
      : '<span class="m-chip">يحتاج مراجعة ' + mN(0) + "</span>") +
    '<span class="m-chip">غير مطابق ' + mN(t.unmatched) + "</span>" +
    (pv.duplicates ? '<span class="m-chip m-chip--warn">' + mPl(pv.duplicates, "عميل مكرر", "عميلان مكرران", "عملاء مكررون", "عميلًا مكررًا") + " — يُحفظ مرة واحدة</span>" : "") +
    (pv.headerFound ? "" : '<span class="m-meta">لم نجد صف عناوين — قُرئت الأعمدة بترتيب النموذج: اسم العميل، المعرف، قيمة المؤشر، الفترة، ملاحظات.</span>') + "</div>";
  h += '<div class="in-row">' + inSeg("pvFilter", inF.pvFilter, [["all", "الكل"], ["matched", "مطابق"], ["review", "يحتاج مراجعة"], ["unmatched", "غير مطابق"]], "") + "</div>";
  var rows = pv.rows.filter(function (r) { return inF.pvFilter === "all" || r.status === inF.pvFilter; });
  var pages = Math.max(1, Math.ceil(rows.length / IN_PV_PAGE));
  if (inF.pvPage >= pages) inF.pvPage = pages - 1;
  var slice = rows.slice(inF.pvPage * IN_PV_PAGE, (inF.pvPage + 1) * IN_PV_PAGE);
  h += '<div class="in-pv ms-scroll"><table class="m-table m-table--sticky"><thead><tr>' +
    "<th>السطر</th><th>الاسم في الملف</th><th>المعرف / الجوال</th><th>القيمة</th><th>الفترة</th><th>الحالة</th><th>العميل في مسار</th>" +
    "</tr></thead><tbody>";
  slice.forEach(function (r) {
    var st = r.status === "matched" ? '<span class="m-chip m-chip--ok">مطابق</span>'
      : r.status === "review" ? '<span class="m-chip m-chip--warn">يحتاج مراجعة</span>'
      : '<span class="m-chip">غير مطابق</span>';
    var who;
    if (r.status === "matched") {
      who = '<span class="in-clip">' + esc(r.candidates[0] ? r.candidates[0].name : "") + '</span>' +
        '<span class="m-meta in-sub">' + (IN_MATCHED_BY[r.by] || "") + "</span>";
    } else if (r.status === "review") {
      who = '<select class="m-select" aria-label="اختر العميل للسطر ' + esc(String(r.line)) + '" data-inres="' + r.line + '"><option value="">اتركه دون ربط</option>' +
        r.candidates.map(function (c) { return '<option value="' + c.id + '"' + (String(inF.resolve[r.line]) === String(c.id) ? " selected" : "") + ">" + esc(clip(c.name, 34)) + " · +" + esc(c.phone) + "</option>"; }).join("") + "</select>";
    } else if (r.phone && String(r.phone).replace(/[^0-9]/g, "").length >= 9 && r.name) {
      who = inF.adding[r.line] ? '<span class="m-meta" aria-busy="true">جارٍ الإضافة…</span>'
        : '<button class="m-btn in-btn-sm" data-in="addent" data-line="' + r.line + '">إضافة كعميل جديد</button>';
    } else {
      who = mNil("غير موجود في قائمة العملاء", "none");
    }
    /* Three different absences in one row: a name or an identifier the FILE did not carry is data
       someone owes the import; a value or a period it legitimately omitted is a nothing. */
    h += '<tr><td class="m-td-v">' + mN(r.line) + "</td>" +
      '<td><span class="in-clip" title="' + esc(r.name || "") + '">' + (r.name ? esc(r.name) : mNil("بلا اسم في الملف", "unset")) + "</span></td>" +
      '<td><span class="in-clip">' + (r.code || r.phone ? '<span class="m-n">' + esc(r.code || r.phone) + "</span>" : mNil("بلا معرِّف", "unset")) + "</span></td>" +
      '<td><span class="in-clip">' + (r.value ? esc(r.value) : mNil("بلا قيمة", "none")) + "</span></td>" +
      '<td><span class="in-clip">' + (r.period ? esc(r.period) : mNil("بلا فترة", "none")) + "</span></td>" +
      "<td>" + st + "</td><td>" + who + "</td></tr>";
  });
  if (!rows.length) {
    h += '<tr class="m-table__empty"><td colspan="7"><div class="m-empty"><p class="m-empty__t">لا صفوف في هذا التبويب</p></div></td></tr>';
  }
  h += "</tbody></table></div>";
  if (pages > 1) {
    h += '<div class="in-pager"><button class="m-btn in-btn-sm" data-in="pvpage" data-v="-1"' + (inF.pvPage === 0 ? " disabled" : "") + ">السابق</button>" +
      '<span class="m-cap">صفحة ' + mN(inF.pvPage + 1) + " من " + mN(pages) + " · " + inMRow(rows.length) + "</span>" +
      '<button class="m-btn in-btn-sm" data-in="pvpage" data-v="1"' + (inF.pvPage >= pages - 1 ? " disabled" : "") + ">التالي</button></div>";
  }
  h += '<div class="in-row"><span class="m-label">' +
    (inc ? "سيُحفظ " + opPlFig("inPvInc", inc, "عميل واحد", "عميلان", "عملاء", "عميلًا") : "لن يُحفظ أي عميل بعد") + "</span>" +
    (t.review - resolved > 0 ? '<span class="m-chip m-chip--warn">' + mPl(t.review - resolved, "صف واحد لم يُراجع", "صفّان لم يُراجعا", "صفوف لم تُراجع", "صفًّا لم يُراجع") + " — لن يُحفظ</span>" : "") +
    (dupPicks > 0 ? '<span class="m-chip m-chip--warn">' + mPl(dupPicks, "صف مكرر", "صفّان مكرران", "صفوف مكررة", "صفًّا مكررًا") + " لعميل مطابق في سطر آخر</span>" : "") +
    (t.unmatched ? '<span class="m-meta">غير المطابقين لا يُحفظون — أضف من له جوال كعميل جديد من الجدول، أو من <a class="m-link" href="#targets">جهات الاستهداف</a>.</span>' : "") + "</div>";
  return h;
}
function inManualView() {
  var q = inF.manualQ.trim();
  var picked = {}; inF.picked.forEach(function (p) { picked[p.entityId] = 1; });
  var cands = (entities || []).filter(function (e) { return !q || e.name.indexOf(q) >= 0 || e.phone.indexOf(q) >= 0; });
  var h = '<input class="m-input" id="inmq" data-infld="manualQ" value="' + esc(inF.manualQ) + '" placeholder="ابحث باسم العميل أو رقمه…" aria-label="ابحث عن عميل">';
  if (!(entities || []).length) {
    return h + '<div class="m-empty"><p class="m-empty__t">لا عملاء في مسار بعد</p>' +
      '<p class="m-empty__d">أضفهم من <a class="m-link" href="#targets">جهات الاستهداف</a>.</p></div>';
  }
  h += '<div class="in-cands ms-scroll">';
  cands.slice(0, 40).forEach(function (e) {
    var on = !!picked[e.id];
    h += '<button type="button" class="in-cand" aria-pressed="' + on + '" data-in="pick" data-i="' + e.id + '"><span class="in-box">' + (on ? inIco("check") : "") + "</span>" +
      '<span class="in-clip" style="flex:1 1 auto;max-inline-size:none">' + esc(e.name) + "</span>" +
      '<span class="m-meta">' + esc((e.attrs && e.attrs["المدينة"]) || "") + "</span></button>";
  });
  if (!cands.length) h += '<div class="m-empty"><p class="m-empty__t">لا عميل يطابق «' + esc(q) + "»</p></div>";
  h += "</div>";
  if (cands.length > 40) h += '<p class="m-meta">تُعرض ' + mN(40) + " نتيجة من " + mN(cands.length) + " — ضيّق البحث.</p>";
  /* A picked customer deleted from the book since the form opened is dropped here, visibly, rather than
     staying ticked and failing the save (QA). */
  var live = {}; (entities || []).forEach(function (e) { live[e.id] = 1; });
  var gone = inF.picked.filter(function (p) { return !live[p.entityId]; }).length;
  if (gone) { inF.picked = inF.picked.filter(function (p) { return live[p.entityId]; }); h += '<span class="m-chip m-chip--warn">' + inMCust(gone) + " لم يعودوا في قائمة العملاء — أُزيلوا من الاختيار</span>"; }
  if (inF.picked.length) {
    h += '<p class="m-label">العملاء المختارون · ' + mN(inF.picked.length) + '</p><div class="in-picked">';
    inF.picked.forEach(function (p) {
      var e = (entities || []).filter(function (x) { return x.id === p.entityId; })[0];
      h += '<div class="in-pick"><span class="in-clip">' + esc(e ? e.name : p.name || "") + "</span>" +
        '<input class="m-input" data-inval="' + p.entityId + '" value="' + esc(p.value || "") + '" placeholder="قيمة المؤشر (اختياري)" aria-label="قيمة المؤشر لـ ' + esc(e ? e.name : "") + '">' +
        '<button type="button" class="m-btn in-btn-sm" data-in="pick" data-i="' + p.entityId + '">إزالة</button></div>';
    });
    h += "</div>";
  }
  return h;
}
function inFormProducts() {
  /* An indicator linked to a product that was archived since can still be edited: its own product stays
     valid for it (QA — every save failed with «المنتج غير موجود»), and is labelled as archived. */
  var list = inProducts.slice();
  if (inF && inF.origProduct && list.indexOf(inF.origProduct) < 0) list.push(inF.origProduct);
  return list;
}
function vIndicatorForm(rest) {
  var open = '<div class="ds6"><div class="in-form">', shut = "</div></div>";
  /* The route is open to indicators.view (DOOR_PERMISSIONS.indicator), which is how «عرض العملاء»
     works — but this screen is the EDITOR. A bookmark or a browser-back must not hand a role without
     indicators.edit a live upload-and-save form; the server refuses it, and so does the screen. */
  if (!inMayEdit()) {
    return open + '<button class="m-btn m-btn--quiet" data-in="cancel">' + inIco("back") + "العودة إلى مؤشرات الاستخدام</button>" +
      '<div class="m-alert" role="alert"><span class="m-alert__t">لا صلاحية للتحرير</span>' +
      '<span class="m-alert__d">لا تملك صلاحية تحرير المؤشرات — يمكنك عرضها وقوائم عملائها فقط.</span>' +
      '<a class="m-btn" href="#indicators">كل المؤشرات</a></div>' + shut;
  }
  if (inToday === "" || inRows === null) inLoad(false);
  inEnsureForm(String(rest || "new"));
  var h = open + '<button class="m-btn m-btn--quiet" data-in="cancel">' + inIco("back") + "العودة إلى مؤشرات الاستخدام</button>";
  if (inF.missing) {
    return h + '<div class="m-card m-empty"><p class="m-empty__t">لا مؤشر بهذا الرقم</p>' +
      '<p class="m-empty__d">ربما الرابط قديم.</p>' +
      '<div class="m-empty__a"><a class="m-btn" href="#indicators">كل المؤشرات</a></div></div>' + shut;
  }
  if (!inF.loaded) {
    return h + (inF.failed
      ? '<div class="m-alert" role="alert"><span class="m-alert__d">تعذّر تحميل المؤشر.</span>' +
        '<button class="m-btn" data-in="formretry">أعد المحاولة</button></div>'
      : '<div class="m-card" aria-busy="true">' + moSkeleton(4, ["w60", "w80", "w40"]) + "</div>") + shut;
  }
  var d = inF.d, isEdit = !!inF.id;
  var prods = [["", "— اختر المنتج —"]].concat(inFormProducts().map(function (p) { return [p, p + (inProducts.indexOf(p) < 0 ? " (مؤرشف)" : "")]; }));
  if (isEdit) h += '<h1 class="m-h1">تعديل: ' + esc(d.name) + "</h1>";
  /* 1 */
  h += '<section class="m-card"><div class="m-card__h"><div><h2 class="m-card__t">1. معلومات المؤشر</h2>' +
    '<p class="m-meta">اسم واضح، ومنتج مرتبط، ودلالة محددة — بها يبني مسار على المؤشر توصية يذكر سببها.</p></div></div><div class="in-secb">';
  h += '<div class="m-form">' + inInp("inf_name", "اسم المؤشر", "name", d.name, { max: INDICATOR_NAME_MAX, ph: "مثال: استخدام مرتفع للإجازات المرضية" }, true) +
    inSel("inf_product", "المنتج المرتبط", "product", d.product, prods, true) + "</div>";
  h += '<div class="m-field"><label class="m-label" for="inf_desc">وصف المؤشر</label>' +
    '<textarea class="m-input" id="inf_desc" rows="2" maxlength="' + INDICATOR_DESC_MAX + '" data-infld="description" placeholder="اشرح بإيجاز ما يمثّله المؤشر وكيف قيس"' + inFld("description") + ">" + esc(d.description) + "</textarea>" + inFerr("description") + "</div>";
  h += inSel("inf_signal", "على ماذا يدل هذا المؤشر؟", "signal", d.signal,
    [["", "— اختر الدلالة —"]].concat(INDICATOR_SIGNALS.map(function (s) { return [s, INDICATOR_SIGNAL_LABELS[s]]; })), true, "على هذه الدلالة تُبنى فرص الحملات المقترحة");
  h += '<div class="in-row" style="gap:var(--m-5);align-items:flex-start"><div class="in-grp">' + inSeg("customerType", d.customerType, CUSTOMER_TYPES.map(function (t) { return [t, CUSTOMER_TYPE_LABELS[t]]; }), "نوع العملاء") + "</div>" +
    '<div class="in-grp">' + inSeg("status", d.status, [["active", "نشط"], ["inactive", "غير نشط"]], "حالة المؤشر") + "</div></div>";
  h += "</div></section>";
  /* 2 */
  h += '<section class="m-card" id="inf_members" tabindex="-1"><div class="m-card__h"><div><h2 class="m-card__t">2. بيانات العملاء</h2>' +
    '<p class="m-meta">زوّد مسار بالعملاء المشمولين — برفع ملف يُطابَق بقائمة العملاء، أو باختيارهم يدويًا.</p></div></div><div class="in-secb">';
  if (isEdit && !inF.replace) {
    h += '<div class="in-row"><span class="m-body">يحتوي المؤشر على ' + inMCust(inF.memberCount) +
      (inF.source === "file" && inF.sourceFilename ? " من ملف " + esc(inF.sourceFilename) : inF.source === "manual" ? " (اختيار يدوي)" : "") + ".</span>" +
      '<button class="m-btn" data-in="replace">استبدال البيانات</button><button class="m-btn" id="infview" data-in="view" data-i="' + inF.id + '">عرض العملاء</button></div>';
  } else {
    if (isEdit && inF.memberCount) h += '<p class="m-meta">البيانات الجديدة تستبدل قائمة العملاء الحالية (' + inMCust(inF.memberCount) + ') عند الحفظ، ويُسجَّل ذلك في سجل التغييرات. <button class="m-btn m-btn--quiet" data-in="keep">إبقاء الحالية</button></p>';
    h += '<div class="in-grp">' + inSeg("mode", inF.mode, [["file", "رفع ملف Excel"], ["paste", "لصق المحتوى"], ["manual", "اختيار عملاء يدويًا"]], "طريقة الإدخال") + "</div>";
    if (inF.mode === "file") {
      h += '<label class="in-drop" id="indrop"><input type="file" class="in-file" id="infile" accept=".xlsx,.xls,.csv" aria-label="ملف بيانات المؤشر">' +
        '<span class="ico">' + inIco("up") + "</span>" +
        '<span class="m-label">' + (inF.fileName ? "الملف: " + esc(inF.fileName) : "اسحب ملف Excel إلى هنا أو اضغط لاختياره") + "</span>" +
        '<span class="m-meta">XLSX · XLS · CSV حتى ' + mN(5) + ' ميغابايت و' + mN(5000) + ' صف — الأعمدة: اسم العميل، المعرف، الجوال، قيمة المؤشر، الفترة، ملاحظات. الجوال أدق مفتاح للمطابقة.</span>' +
        '<span class="in-row" style="justify-content:center"><span class="m-btn m-btn--primary in-pickbtn">' + (inF.fileName ? "اختر ملفًا آخر" : "اختيار ملف") + "</span>" +
        '<a class="m-btn" href="/assets/indicator-template.xlsx" onclick="event.stopPropagation()">تحميل نموذج Excel</a></span></label>';
    } else if (inF.mode === "paste") {
      h += '<div class="m-field"><label class="m-label" for="inpaste">الصق محتوى الملف — سطر لكل عميل</label>' +
        '<textarea class="m-input" id="inpaste" rows="6" dir="auto" data-infld="paste" placeholder="اسم العميل,المعرف,قيمة المؤشر,الفترة,ملاحظات">' + esc(inF.paste) + "</textarea></div>" +
        '<div class="in-row"><button class="m-btn m-btn--primary" data-in="parse"' + (inF.pvBusy ? " disabled" : "") + ">تحليل ومطابقة</button>" +
        '<button class="m-btn" data-in="sample">تعبئة نموذج تجريبي</button></div>';
    }
    h += inF.mode === "manual" ? inManualView() : inPreviewView();
  }
  if (inF.field === "members" && inF.err) h += '<div class="m-alert" id="err_members" role="alert"><span class="m-alert__d">' + inIco("warn") + esc(inF.err) + "</span></div>";
  h += "</div></section>";
  /* 3 */
  h += '<section class="m-card"><div class="m-card__h"><div><h2 class="m-card__t">3. فترة البيانات</h2>' +
    '<p class="m-meta">متى قيست البيانات. البيانات الأقدم من ' + inMDay(INDICATOR_STALE_DAYS) + " تُستخدم، وتقول كل توصية مبنية عليها ذلك.</p></div></div>" +
    '<div class="in-secb"><div class="in-g3">' + inInp("inf_from", "من تاريخ", "periodFrom", d.periodFrom, { type: "date" }) + inInp("inf_to", "إلى تاريخ", "periodTo", d.periodTo, { type: "date" }) +
    inInp("inf_upd", "تاريخ تحديث البيانات", "dataUpdatedAt", d.dataUpdatedAt, { type: "date" }, true) + "</div></div></section>";
  /* 4 */
  h += '<section class="m-card"><div class="m-card__h"><div><h2 class="m-card__t">4. كيف يستخدم مسار هذا المؤشر؟</h2></div></div>' +
    '<p class="m-body">' + inHowText(d.signal, d.product) + "</p></section>";
  if (isEdit && inF.events.length) {
    h += '<section class="m-card"><div class="m-card__h"><div><h2 class="m-card__t">سجل التغييرات</h2></div></div><div class="m-tl">';
    inF.events.slice(0, 10).forEach(function (e) {
      h += '<div class="m-tl__i"><span class="m-tl__d"></span><span><span class="m-tl__n">' + esc(IN_EVENT[e.action] || e.action) + "</span>" +
        '<span class="m-tl__s">' + esc(inBy(e.by)) + "</span></span>" +
        '<span class="m-tl__t">' + inStampC(e.at) + "</span></div>";
    });
    h += "</div></section>";
  }
  var busy = inF.busy || inF.pvBusy;
  h += '<div class="in-acts">' +
    '<button class="m-btn m-btn--primary" data-in="save"' + (busy ? ' disabled aria-busy="true"' : "") + ">" + (inF.busy ? "جارٍ الحفظ…" : inF.pvBusy ? "انتظر قراءة الملف…" : "حفظ المؤشر") + "</button>" +
    (isEdit && !inF.wasDraft ? "" : '<button class="m-btn" data-in="draft"' + (busy ? " disabled" : "") + ">حفظ كمسودة</button>") +
    '<button class="m-btn m-btn--quiet" data-in="cancel">إلغاء</button>' +
    (inF.err ? '<span class="m-err" id="inferr" role="status">' + inIco("warn") + esc(inF.err) + "</span>" : "") + "</div>";
  return h + shut + inDrawer();
}
/* One counter for every preview request, so a slow answer to an earlier file can never land on top of
   a later one, and nothing can be saved while the current file is still being read (GPT review). */
function inPreviewStart() {
  inF.pvSeq++;
  inF.pvBusy = true; inF.pvErr = ""; inF.resolve = {}; inF.preview = null; inF.pvPage = 0;
  if (inF.field === "members") { inF.err = ""; inF.field = ""; }
  return inF.pvSeq;
}
/* An HTTP status inside a message is prose, not a figure: pvErr is written through esc() into the
   DOM, so .m-n markup there would print as literal angle brackets. Same for toasts and aria-labels. */
function inPreviewDone(f, seq, r) {
  if (f.pvSeq !== seq) return;
  f.pvBusy = false;
  if (!r.ok) { f.pvErr = r.j.detail || "تعذّرت القراءة (" + fmtN(r.status) + ")"; f.preview = null; }
  else {
    f.preview = r.j; f.pvFilter = r.j.totals.review ? "review" : "all";
    if (f.err && (f.field === "members" || f.field === "")) { f.err = ""; f.field = ""; }
  }
  if (inF === f) render(false);
}
function inPreviewText(text) {
  var f = inF, seq = inPreviewStart(); render(false);
  cfJson("POST", "/admin/indicators/preview", { text: text }).then(function (r) { inPreviewDone(f, seq, r); })
    .catch(function () { inPreviewDone(f, seq, { ok: false, status: 0, j: { detail: "تعذّر الاتصال — لم يُقرأ شيء." } }); });
}
function inPreviewFile(file) {
  if (!file || !inF) return;
  if (file.size > 5 * 1024 * 1024) { inF.pvErr = "الملف أكبر من 5 ميغابايت."; inF.preview = null; render(false); return; }
  var f = inF;
  f.fileName = file.name; f.lastFile = file;
  var seq = inPreviewStart(); render(false);
  var fd = new FormData(); fd.append("file", file, file.name);
  fetch("/admin/indicators/preview", { method: "POST", headers: { "x-admin-token": TOKEN }, body: fd })
    .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); })
    .then(function (r) { inPreviewDone(f, seq, r); })
    .catch(function () { inPreviewDone(f, seq, { ok: false, status: 0, j: { detail: "تعذّر رفع الملف." } }); });
}
function inRerunPreview() {
  if (!inF) return;
  if (inF.mode === "file" && inF.lastFile) inPreviewFile(inF.lastFile);
  else if (inF.mode === "paste" && inF.paste.trim()) inPreviewText(inF.paste);
}
/* «إضافة كعميل جديد» for an unmatched row that carries a phone: the same paste-import the customer book
   uses, then the preview runs again so the row matches. No leaving the form (UX review). */
function inAddEntity(line) {
  var f = inF; if (!f || !f.preview) return;
  var r = f.preview.rows.filter(function (x) { return String(x.line) === String(line); })[0];
  if (!r) return;
  f.adding[line] = true; render(false);
  cfJson("POST", "/admin/entities", { text: String(r.name).replace(/[,\\n\\t،؛;]/g, " ") + ", " + r.phone, source: "indicator" }).then(function (res) {
    f.adding[line] = false;
    if (!res.ok || res.j.invalid) { inToast("تعذّرت إضافة «" + r.name + "» — تحقق من الجوال", true); render(false); return; }
    return fetch("/admin/entities", { headers: { "x-admin-token": TOKEN } }).then(function (x) { return x.json(); }).then(function (list) {
      entities = list; inToast("أُضيف «" + r.name + "» إلى العملاء", false); inRerunPreview();
    });
  }).catch(function () { f.adding[line] = false; inToast("تعذّر الاتصال", true); render(false); });
}
var IN_FIELD_ID = { name: "inf_name", product: "inf_product", signal: "inf_signal", description: "inf_desc", periodFrom: "inf_from", periodTo: "inf_to", dataUpdatedAt: "inf_upd", members: "inf_members" };
function inSave(asDraft) {
  if (!inF || inF.busy || inF.pvBusy) return;
  var f = inF, isEdit = !!f.id;
  var fail = function (reason, field) {
    f.err = reason; f.field = field || ""; render(false);
    setTimeout(function () { var el = document.getElementById(IN_FIELD_ID[field] || ""); if (el) { el.scrollIntoView({ block: "center" }); if (el.focus) el.focus({ preventScroll: true }); } }, 0);
  };
  var checked = checkIndicator(f.d, inFormProducts(), inToday, asDraft);
  if (!checked.ok) return fail(checked.reason, checked.field);
  if (isDuplicateIndicatorName(checked.value.name, inRows || [], f.id)) return fail("يوجد مؤشر بهذا الاسم — اختر اسمًا يميّزه.", "name");
  var sendMembers = !isEdit || f.replace;
  var members = sendMembers ? inIncluded() : null;
  if (sendMembers && f.mode !== "manual" && !f.preview && !asDraft) return fail(f.mode === "file" ? "ارفع ملف البيانات أولًا." : "حلّل المحتوى الملصق أولًا.", "members");
  var cnt = checkMemberCount(members ? members.length : f.memberCount, asDraft);
  if (!cnt.ok) return fail(cnt.reason, cnt.field);
  var body = { indicator: checked.value, draft: asDraft };
  if (isEdit) body.ifUpdatedAt = f.updatedAt;
  if (members) { body.members = members; body.source = f.mode; body.sourceFilename = f.mode === "file" ? f.fileName : ""; }
  f.busy = true; f.err = ""; f.field = ""; render(false);
  var req = isEdit ? cfJson("PATCH", "/admin/indicators/" + f.id, body) : cfJson("POST", "/admin/indicators", body);
  req.then(function (r) {
    f.busy = false;
    if (!r.ok) return fail(r.j.detail || "تعذّر الحفظ (" + fmtN(r.status) + ")", r.j.field);
    inF = null; inFKey = "";
    sgData = null; inMembership = null;
    inToast(asDraft ? "حُفظت المسودة «" + checked.value.name + "»" : (isEdit ? "حُفظ المؤشر «" : "أُضيف المؤشر «") + checked.value.name + "» · " + inNCust(r.j.members), false);
    location.hash = "indicators";
    inLoad(true);
  }).catch(function () { f.busy = false; fail("تعذّر الاتصال — لم يُحفظ شيء.", ""); });
}
function inToggle(id) {
  var r = inById(id); if (!r || inRowBusy) return;
  var next = r.status === "active" ? "inactive" : "active";
  inRowBusy = r.id; render(false);
  cfJson("POST", "/admin/indicators/" + r.id + "/status", { status: next }).then(function (res) {
    inRowBusy = 0;
    if (!res.ok) { inToast(res.j.detail || "تعذّر تغيير الحالة", true); render(false); return; }
    r.status = next; sgData = null; inMembership = null;
    inToast(next === "active" ? "فُعّل «" + r.name + "» — يدخل في الفرص المقترحة" : "عُطّل «" + r.name + "» — خرج من الفرص المقترحة الجديدة", false,
      "تراجع", function () { inToggle(r.id); });
    render(false); inLoad(true);
  }).catch(function () { inRowBusy = 0; inToast("تعذّر الاتصال — لم تتغير الحالة.", true); render(false); });
}

/* ---------------- membership: wizard audience + customer book filters ---------------- */
var inMembership = null, inMemLoading = false, inMemSets = {};
function inMemLoad() {
  if (inMembership || inMemLoading) return;
  inMemLoading = true;
  pxGet("/admin/indicators/membership").then(function (j) {
    inMembership = j.indicators || [];
    /* One Set per indicator, built once per load. The filter used to run indexOf over the member list
       for every customer on every wizard repaint — 25M comparisons at 5,000 × 5,000 (eng review). */
    inMemSets = { any: {} };
    inMembership.forEach(function (i) {
      var s = {}; i.memberIds.forEach(function (id) { s[id] = 1; if (i.status !== "draft") inMemSets.any[id] = 1; });
      inMemSets[i.id] = s;
    });
  }).catch(function () { inMembership = []; inMemSets = {}; }).then(function () { inMemLoading = false; render(false); });
}
function inInSet(key, e) { var s = inMemSets[key]; return !s || !!s[e.id]; }
var wizIndF = "";
function indEntityInFilter(e) { return !wizIndF || !inMembership ? true : inInSet(wizIndF, e); }
function inIndOptions(sel, withAny) {
  return (withAny ? '<option value="any"' + (sel === "any" ? " selected" : "") + ">في أي مؤشر</option>" : "") +
    (inMembership || []).filter(function (i) { return i.status !== "draft"; }).map(function (i) {
      return '<option value="' + i.id + '"' + (String(sel) === String(i.id) ? " selected" : "") + ">" + esc(clip(i.name, 26)) + " (" + fmtN(i.memberIds.length) + ")" + (i.status === "inactive" ? " · معطَّل" : "") + "</option>";
    }).join("");
}
/* NOT PORTED: renders inside dashboard.ts's wizard toolbar, which is still on the old system. */
function indWizardSelect() {
  inMemLoad();
  if (!(inMembership || []).some(function (i) { return i.status !== "draft"; })) return "";
  return '<span class="fld"><span>المؤشر:</span><select class="' + (wizIndF ? "on" : "") + '" onchange="indSetWizF(this.value)" title="عملاء مؤشر استخدام">' +
    '<option value="">الكل</option>' + inIndOptions(wizIndF, false) + "</select></span>";
}
window.indSetWizF = function (v) { wizIndF = v; entSel.clear(); render(false); };
/* BR-CUS-003: the customer book filters by indicator too. «#targets/indicators» arrives from the
   «العملاء المشمولون» tile and means «in any indicator».
   NOT PORTED: renders inside targets-crm.ts, which is still on the old system. */
var tgtIndF = "";
function indTargetsFilter(e) {
  if (inRoute() === "targets/indicators" && !tgtIndF) tgtIndF = "any";
  return !tgtIndF || !inMembership ? true : inInSet(tgtIndF, e);
}
function indTargetsSelect() {
  inMemLoad();
  if (!(inMembership || []).length) return "";
  return '<select class="crmsel' + (tgtIndF ? " on" : "") + '" onchange="indSetTgtF(this.value)" aria-label="مؤشر الاستخدام"' +
    (tgtIndF ? ' style="border-color:#5B8DEF;color:#1A47BE;background:#DCE8FC;"' : "") + '><option value="">المؤشر: الكل</option>' + inIndOptions(tgtIndF, true) + "</select>";
}
window.indSetTgtF = function (v) {
  tgtIndF = v;
  if (!v && inRoute() === "targets/indicators") { location.hash = "targets"; return; }
  if (typeof tgtSel !== "undefined") tgtSel = {};
  render(false);
};

/* ---------------- the customer record ----------------
   NOT PORTED: this block renders inside dashboard.ts's customer view, above the conversation, and
   that screen is still on the old system. */
var inCust = { phone: "", rows: null, failed: false, busy: false };
function indCustomerBlock(phone) {
  if (!phone) return "";
  if (inCust.phone !== phone) {
    inCust = { phone: phone, rows: null, failed: false, busy: true };
    pxGet("/admin/indicators/for-customer/" + encodeURIComponent(phone)).then(function (j) { if (inCust.phone === phone) inCust.rows = j.indicators || []; })
      .catch(function () { if (inCust.phone === phone) inCust.failed = true; })
      .then(function () { if (inCust.phone === phone) { inCust.busy = false; render(false); } });
  }
  var h = '<div class="card" style="margin-top:14px"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px">' +
    '<div style="font-size:14px;font-weight:600;color:var(--ink)">مؤشرات الاستخدام</div><span style="flex:1"></span><a href="#indicators" style="font-size:12px;font-weight:600;color:var(--accent-deep)">كل المؤشرات</a></div>';
  if (inCust.busy) return h + '<div class="cf-sub" aria-busy="true">جارٍ التحميل…</div></div>';
  if (inCust.failed) return h + '<div class="cf-sub" role="alert">تعذّر تحميل مؤشرات هذا العميل.</div></div>';
  if (!inCust.rows.length) return h + '<div class="cf-sub">هذا العميل ليس في أي مؤشر استخدام.</div></div>';
  inCust.rows.forEach(function (r) {
    h += '<div class="in-mem"><button class="in-link" id="incv' + r.id + '" data-in="view" data-i="' + r.id + '">' + esc(r.name) + "</button>" +
      (r.value ? '<span class="v">' + esc(r.value) + "</span>" : "") +
      '<span class="m">' + [r.product ? esc(r.product) : "", INDICATOR_STATUS_LABELS[r.status] || "", "بيانات " + (inDate(r.dataUpdatedAt) || "لم تُسجَّل")].filter(Boolean).join(" · ") + "</span></div>";
  });
  return h + "</div>";
}

/* ================= «فرص حملات مقترحة» =================
   NOT PORTED: sgPanel renders on #kmon (campaigns-crm.ts) and inside the wizard (dashboard.ts), and
   sgWizardTop renders above the wizard's first step. Both hosts are still on the old system. */
var sgData = null, sgLoading = false, sgFailed = false, sgPending = false, sgAll = false, sgShowDismissed = false, sgBusyKey = "";
/* The monitoring page is for monitoring: the panel opens collapsed there (UX review — it pushed the first
   campaign 1.8 screens down on a phone), and remembers the choice per browser. */
var sgOpen = false;
try { sgOpen = localStorage.getItem("massar.sg.open") === "1"; } catch (e) { sgOpen = false; }
/* The suggestion a wizard draft was built from, and the objective (BR-CAM-001). Cleared by a launch. */
var wizOrigin = null, wizObjective = "";
var SG_RULE = { usage_without_integration: "استخدام مرتفع دون ربط", high_usage: "توسيع الاستخدام", cross_sell: "بيع متقاطع", non_subscribers: "غير المشتركين", segment: "شريحة عامة", indicator: "من مؤشر" };
/* Which approved opener fits which proposal. Both registered templates are integration openers; the
   difference is WHO they are for: «high_usage_upsell» speaks to usage we observed, «intro_integration»
   to a facility that has not used the service yet. A segment has no premise, so it gets no default. */
var SG_TEMPLATE = { usage_without_integration: "high_usage_upsell", high_usage: "high_usage_upsell", cross_sell: "intro_integration", non_subscribers: "intro_integration" };
function sgLoad(force) {
  if (sgLoading) { if (force) sgPending = true; return; }
  if (sgData && !force) return;
  if (sgFailed && !force) return;
  sgLoading = true;
  pxGet("/admin/campaign-suggestions").then(function (j) { sgData = j; sgFailed = false; })
    .catch(function () { sgFailed = true; })
    .then(function () { sgLoading = false; if (sgPending) { sgPending = false; sgLoad(true); return; } render(false); });
}
function sgExcl(x) {
  var days = inNDay(sgData ? sgData.suppressionDays : inSupp);
  var parts = [];
  if (x.optedOut) parts.push(inPl(x.optedOut, "عميل واحد طلب الإيقاف", "عميلان طلبا الإيقاف", "عملاء طلبوا الإيقاف", "عميلًا طلبوا الإيقاف"));
  if (x.recentlyTargeted) parts.push(inPl(x.recentlyTargeted, "عميل واحد أُرسلت إليه حملة", "عميلان أُرسلت إليهما حملة", "عملاء أُرسلت إليهم حملة", "عميلًا أُرسلت إليهم حملة") + " خلال " + days);
  if (x.openOpportunity) parts.push(inPl(x.openOpportunity, "عميل واحد لديه فرصة مفتوحة", "عميلان لديهما فرصة مفتوحة", "عملاء لديهم فرص مفتوحة", "عميلًا لديهم فرص مفتوحة"));
  return parts.length ? "استُبعد: " + parts.join(" · ") : "";
}
function sgTargetedWord(n) { return n === 1 ? "عميل مستهدف" : n === 2 ? "عميلان مستهدفان" : n >= 3 && n <= 10 ? "عملاء مستهدفون" : "عميلًا مستهدفًا"; }
function sgCard(s) {
  var excl = sgExcl(s.excluded);
  var inc = s.indicators.filter(function (i) { return i.role === "include"; });
  var exc = s.indicators.filter(function (i) { return i.role === "exclude"; });
  var uniq = function (list) { var seen = {}; return list.filter(function (i) { if (seen[i.name]) return false; seen[i.name] = 1; return true; }); };
  var h = '<article class="sg-c' + (s.eligible ? "" : " off") + '" aria-label="' + esc(s.title) + '">';
  h += '<div class="top"><span class="cf-pill off">' + esc(SG_RULE[s.rule] || s.rule) + "</span>" +
    "<span>الهدف: " + esc(CAMPAIGN_OBJECTIVE_LABELS[s.objective] || "") + "</span>" +
    (s.segment ? "<span>· الشريحة: " + esc(CUSTOMER_TYPE_LABELS[s.segment] || s.segment) + "</span>" : "") + "</div>";
  h += '<div class="tt">' + esc(s.title) + "</div>";
  h += '<div class="fig"><span class="k">العملاء المتأثرون</span><span class="n">' + fmtN(s.count) + '</span><span class="u">' + sgTargetedWord(s.count) + " · " + esc(s.product) + "</span></div>";
  h += '<div class="why">' + esc(s.reason) + "</div>";
  h += '<div class="sg-src"><span>بناءً على:</span>' + uniq(inc).map(function (i) { return '<span class="sg-chip" title="' + esc(i.name) + '">' + esc(i.name) + "</span>"; }).join("") + "</div>";
  if (exc.length) h += '<div class="sg-src"><span>مع استبعاد:</span>' + uniq(exc).map(function (i) { return '<span class="sg-chip ex" title="' + esc(i.name) + '">' + esc(i.name) + "</span>"; }).join("") + "</div>";
  if (excl) h += '<div class="ex-l">' + excl + "</div>";
  if (s.stale) h += '<div class="warn">' + inIco("warn") + " البيانات من " + (inDate(s.dataUpdatedAt) || "تاريخ غير مسجّل") + " — أقدم من " + inNDay(INDICATOR_STALE_DAYS) + ".</div>";
  if (s.count > 50) h += '<div class="ex-l">الإطلاق الواحد 50 عميلًا كحدٍّ أقصى — تختار في المعالج من تبدأ بهم.</div>';
  /* Acting on a suggestion creates a campaign or dismisses one, both writes: a role that may only
     read sees the reasoning and no buttons. */
  h += '<div class="acts">' + (!inMayCampaign() ? ""
    : s.eligible
      ? '<button class="btn sg-go" data-sg="use" data-k="' + esc(s.key) + '">إنشاء حملة</button>'
      : '<a class="btn btn-ghost" href="#product/' + encodeURIComponent(s.product) + '/knowledge">' + esc(s.blockedWhy || "لا يبيعه المساعد") + " — افتح المنتج</a>") +
    (inMayCampaign() ? '<button class="btn btn-ghost" data-sg="dismiss" data-k="' + esc(s.key) + '"' + (sgBusyKey === s.key ? " disabled" : "") + ">تجاهل</button>" : "") + "</div>";
  return h + "</article>";
}
function sgPanel(where) {
  sgLoad(false);
  var wiz = where === "wizard";
  var list = sgData ? sgData.suggestions || [] : [];
  var open = wiz || sgOpen;
  var h = '<section class="sg' + (open ? " open" : "") + '" aria-labelledby="sgh_' + where + '"><div class="sg-h"><h2 id="sgh_' + where + '">فرص حملات مقترحة</h2>' +
    (sgData && list.length ? '<span class="cnt">' + fmtN(list.length) + "</span>" : "") +
    '<span class="cf-pill sys" title="يقترحها مسار بقواعد ثابتة">من مسار</span><span class="sp"></span>' +
    '<a href="#indicators" style="font-size:var(--t-xs);font-weight:600;color:var(--accent-deep)">المؤشرات</a>' +
    (!wiz && sgData && list.length ? '<button class="sg-toggle" data-sg="toggle" aria-expanded="' + open + '">' + (open ? "إخفاء" : "عرض") + "</button>" : "") +
    (open ? '<div class="s">يقترحها مسار من مؤشرات الاستخدام النشطة، ولكل فرصة سببها وعدد عملائها. لا يُرسل شيء قبل موافقتك في المعالج.</div>' : "") + "</div>";
  if (!sgData && !sgFailed) return h + '<div class="sg-state" aria-busy="true">جارٍ قراءة المؤشرات…</div></section>';
  if (!sgData) return h + '<div class="sg-state" role="alert">تعذّر تحميل الفرص المقترحة.<button class="btn btn-ghost" data-sg="retry">أعد المحاولة</button></div></section>';
  if (!sgData.activeIndicators) {
    return h + '<div class="sg-state">لا مؤشرات استخدام نشطة بعد، فلا شيء يُبنى عليه.' +
      (inMayEdit() ? ' <a class="btn sg-go" href="#indicator/new" style="text-decoration:none;display:inline-flex;align-items:center;height:34px">إضافة مؤشر</a>' : "") + "</div></section>";
  }
  if (!open) {
    var top = list[0];
    return h + '<div class="sg-state" style="padding-top:0">' + (top ? "أولها: <b style=\\"color:var(--ink);font-weight:600\\">" + esc(top.title) + "</b> · " + fmtN(top.count) + " " + sgTargetedWord(top.count) : "لا فرص جديدة الآن.") + "</div></section>";
  }
  if (!list.length) {
    h += '<div class="sg-state">لا فرص جديدة الآن — ' + inNInd(sgData.activeIndicators) + " نشطة، ولم تُنتج قاعدةٌ جمهورًا متبقيًا بعد الاستبعاد" +
      (sgData.adoption.dismissed ? " أو التجاهل" : "") + ".</div>";
  } else {
    var shown = sgAll ? list : list.slice(0, 3);
    h += '<div class="sg-g">' + shown.map(sgCard).join("") + "</div>";
  }
  var a = sgData.adoption;
  h += '<div class="sg-f"><span>' + (a.launched ? "أُطلقت " + inNCamp(a.launched) + " من توصيات مسار" + (a.launched !== a.launchedAsProposed ? " (" + fmtN(a.launchedAsProposed) + " كما اقتُرحت)" : "") : "لم تُطلق حملة من توصية بعد") + "</span>" +
    (list.length > 3 ? '<button class="lnk" data-sg="all">' + (sgAll ? "عرض أقل" : "عرض كل الفرص (" + fmtN(list.length) + ")") + "</button>" : "") +
    (a.dismissed ? '<button class="lnk" data-sg="showdis" aria-expanded="' + sgShowDismissed + '">' + (sgShowDismissed ? "إخفاء الفرص المتجاهلة" : "الفرص المتجاهلة (" + fmtN(a.dismissed) + ")") + "</button>" : "") + "</div>";
  if (sgShowDismissed && sgData.dismissals && sgData.dismissals.length) {
    h += '<div class="sg-f" style="flex-direction:column;align-items:stretch;gap:0">';
    sgData.dismissals.forEach(function (d) {
      var parts = String(d.key).split("|");
      h += '<div class="in-ev"><b>' + esc(d.title || (SG_RULE[parts[0]] || parts[0]) + " · " + (parts[1] || "")) + "</b><span>" + esc(inBy(d.by)) + " · " + inStamp(d.at) + '</span><button class="lnk" style="margin-inline-start:auto" data-sg="restore" data-k="' + esc(d.key) + '">استعادة</button></div>';
    });
    h += "</div>";
  }
  return h + "</section>";
}
/* Build a wizard draft from a set of customers. The operator can still change everything; the launch
   records whether they did (origin.modified), so adoption is not over-counted. */
function sgApply(product, entityIds, origin, objective, name, rule) {
  var reg = wizProducts();
  var i = reg.findIndex(function (x) { return x.name === product; });
  selProdName = product; selLost = ""; selNeedsPick = false;
  if (i >= 0) selProd = i;
  retargetCohort = null; audMode = "file"; wizIndF = "";
  prodFilter = { uses: "", notUses: "", interest: "", candidate: "" };
  Object.keys(entFilters).forEach(function (k) { delete entFilters[k]; });
  entQ = "";
  entSel.clear();
  var have = {}; (entities || []).forEach(function (e) { have[e.id] = 1; });
  var missing = 0;
  entityIds.forEach(function (id) { if (have[id]) entSel.add(id); else missing++; });
  wizOrigin = origin ? Object.assign({}, origin, { entityIds: entityIds.slice(), product: product }) : null;
  wizObjective = objective || "";
  campName = name || "";
  var tplWant = SG_TEMPLATE[rule || ""] || "";
  var ti = tplWant && typeof tpls !== "undefined" ? tpls.findIndex(function (t) { return t.id === tplWant; }) : -1;
  if (ti >= 0) { tplId = tpls[ti].id; campMsg = tpls[ti].body; }
  if (wizOrigin) wizOrigin.template = ti >= 0 ? tpls[ti].label : "";
  rw.sig = "";
  if (missing) setTimeout(function () { inToast(inNCust(missing) + " لم يعودوا في قائمة العملاء — لم يُضافوا", true); }, 300);
  /* Already on the wizard (its own panel): no hashchange will fire, so paint now (GPT review). */
  if (inRoute().split("/")[0] === "aimkt") { render(false); var b = document.getElementById("body"); if (b) b.scrollTop = 0; }
  else location.hash = "aimkt";
}
function sgWizardTop() {
  if (retargetCohort) return "";
  if (wizOrigin) {
    return '<div class="sg-applied" role="status"><span class="mk">' + inIco("check") + '</span><div style="flex:1;min-width:220px"><div class="tt">الحملة مبنية على ' +
      (wizOrigin.rule === "indicator" ? "مؤشر" : "توصية") + ": " + esc(wizOrigin.title || "") + "</div>" +
      '<div class="s">' + esc(wizOrigin.reason || "") + (wizOrigin.template ? " · القالب المقترح: «" + esc(wizOrigin.template) + "»" : "") +
      ". عدّل ما شئت — تُسجَّل الحملة منسوبة إليها، مع ما غيّرته.</div></div>" +
      '<button class="btn btn-ghost" data-sg="unlink">إلغاء الربط بالتوصية</button></div>';
  }
  return '<div style="margin-bottom:var(--s3)">' + sgPanel("wizard") + "</div>";
}
function wizOriginOut(targets) {
  if (!wizOrigin) return undefined;
  var reg = wizProducts(); var prod = reg[selProd] ? reg[selProd].name : "";
  var want = {}; (wizOrigin.entityIds || []).forEach(function (id) { want[id] = 1; });
  var same = entSel.size === (wizOrigin.entityIds || []).length && Array.from(entSel).every(function (id) { return want[id]; });
  return { suggestionKey: wizOrigin.suggestionKey, rule: wizOrigin.rule, indicatorIds: wizOrigin.indicatorIds, modified: !(same && prod === wizOrigin.product) };
}
function wizAfterLaunch() { wizOrigin = null; wizObjective = ""; sgData = null; rw.sig = ""; rw.data = null; }

/* ---------------- objective (step 2), repeat warning, review summary ----------------
   NOT PORTED: all three render inside dashboard.ts's wizard steps. */
var rw = { sig: "", data: null, busy: false, timer: 0, failed: false };
function rwBlock(product, phones) {
  if (!product || !phones.length) return "";
  var sorted = phones.slice().sort();
  /* The WHOLE sorted list: every Saudi number is 12 digits, so a length-and-ends signature could not
     tell one audience from another with a middle recipient swapped (eng + GPT review). */
  var sig = product + "|" + sorted.join(",");
  if (rw.sig !== sig) {
    rw.sig = sig; rw.data = null; rw.failed = false;
    clearTimeout(rw.timer);
    rw.timer = setTimeout(function () {
      var mine = sig; rw.busy = true;
      cfJson("POST", "/admin/campaign/repeat-check", { product: product, phones: phones }).then(function (r) {
        if (rw.sig !== mine) return;
        rw.busy = false; if (r.ok) rw.data = r.j; else rw.failed = true; render(false);
      }).catch(function () { if (rw.sig === mine) { rw.busy = false; rw.failed = true; render(false); } });
    }, 350);
  }
  var d = rw.data;
  if (!d || !d.campaigns.length) return "";
  var h = '<div class="rw" role="status"><b>' + inIco("warn") + " تنبيه تكرار الاستهداف (آخر " + inNDay(d.windowDays) + ")</b>";
  if (d.overlapPhones) h += "<div>" + inPl(d.overlapPhones, "عميل واحد من هذا الجمهور أُرسلت إليه حملة", "عميلان من هذا الجمهور أُرسلت إليهما حملة", "عملاء من هذا الجمهور أُرسلت إليهم حملة", "عميلًا من هذا الجمهور أُرسلت إليهم حملة") + " خلال هذه الفترة.</div>";
  if (d.sameProductRecent) h += "<div>" + inPl(d.sameProductRecent, "حملة واحدة حديثة", "حملتان حديثتان", "حملات حديثة", "حملة حديثة") + " لنفس المنتج «" + esc(product) + "».</div>";
  h += "<ul>" + d.campaigns.slice(0, 4).map(function (c) {
    return '<li><a href="#kmon/' + c.id + '" style="color:inherit;font-weight:600">' + esc(c.name) + "</a> · " + fmtD(c.createdAt) +
      (c.overlap ? " · " + inPl(c.overlap, "عميل واحد مشترك", "عميلان مشتركان", "عملاء مشتركون", "عميلًا مشتركًا") : "") + (c.sameProduct ? " · المنتج نفسه" : "") + "</li>";
  }).join("") + "</ul><div>التنبيه لا يمنع الإطلاق — راجع الجمهور إن كان التكرار غير مقصود.</div></div>";
  return h;
}
function wizObjectiveStep() {
  var h = '<div class="step" id="wzobj"><div class="hd"><span class="num' + (wizObjective ? " done" : "") + '">2</span><div><div class="ht">ما هدف الحملة؟ <span style="color:var(--s-fail-text)" aria-hidden="true">*</span></div>' +
    '<div class="hs">يُسجَّل مع الحملة، فتُقرأ نتائجها في التقارير حسب الهدف.</div></div></div>';
  h += '<div class="wz-obj" role="radiogroup" aria-label="هدف الحملة" aria-required="true">' + CAMPAIGN_OBJECTIVES.map(function (o) {
    return '<button type="button" role="radio" aria-checked="' + (wizObjective === o) + '" data-wzobj="' + o + '">' + esc(CAMPAIGN_OBJECTIVE_LABELS[o]) + "</button>";
  }).join("") + "</div>";
  return h + "</div>";
}
function wizRepeatBlock(selName) {
  var phones = launchTargets().map(function (t) { return t.phone; });
  var warn = rwBlock(selName, phones);
  return warn ? '<div style="margin-bottom:var(--s3)">' + warn + "</div>" : "";
}
/* BR-CAM-006: what is about to happen, in one place, before the human approval. */
function wizReviewSummary(n, product) {
  var msg = (campMsg || "").replaceAll("{product}", product).replaceAll("{{1}}", product);
  var r = function (k, v) { return '<div class="r"><span class="k">' + k + "</span><span>" + v + "</span></div>"; };
  return '<div class="wz-review">' +
    r("الجمهور", inNCust(n)) +
    r("المنتج", esc(product || "لم يُحدَّد")) +
    r("الهدف", esc(CAMPAIGN_OBJECTIVE_LABELS[wizObjective] || "لم يُحدَّد")) +
    r("القناة", "واتساب") +
    r("التوقيت", "فور التأكيد — دفعة واحدة") +
    r("الاسم", esc(campName.trim() || "يُسمّى تلقائيًا")) +
    (wizOrigin ? r("المصدر", (wizOrigin.rule === "indicator" ? "مؤشر: " : "توصية: ") + esc(wizOrigin.title || "")) : "") +
    (rw.data && rw.data.overlapPhones ? r("تكرار", '<span style="color:var(--s-attn-text)">' + inPl(rw.data.overlapPhones, "عميل واحد أُرسلت إليه حملة مؤخرًا", "عميلان أُرسلت إليهما حملة مؤخرًا", "عملاء أُرسلت إليهم حملة مؤخرًا", "عميلًا أُرسلت إليهم حملة مؤخرًا") + "</span>") : "") +
    '<div class="msg">' + esc(msg) + "</div></div>";
}
window.wizGoObjective = function () { var el = document.getElementById("wzobj"); if (el) { el.scrollIntoView({ block: "center" }); var b = el.querySelector("button"); if (b) b.focus({ preventScroll: true }); } };

/* ---------------- one delegated listener ---------------- */
document.addEventListener("click", function (ev) {
  var t = ev.target && ev.target.closest ? ev.target.closest("[data-in],[data-sg],[data-wzobj]") : null;
  if (!t) return;
  var obj = t.getAttribute("data-wzobj");
  if (obj) { wizObjective = obj; render(false); return; }
  var sg = t.getAttribute("data-sg");
  if (sg) {
    var key = t.getAttribute("data-k") || "";
    var s = sgData ? (sgData.suggestions || []).filter(function (x) { return x.key === key; })[0] : null;
    if (sg === "retry") { sgFailed = false; sgLoad(true); return; }
    if (sg === "toggle") { sgOpen = !sgOpen; try { localStorage.setItem("massar.sg.open", sgOpen ? "1" : "0"); } catch (e) {} render(false); return; }
    if (sg === "all") { sgAll = !sgAll; render(false); return; }
    if (sg === "showdis") { sgShowDismissed = !sgShowDismissed; render(false); return; }
    if (sg === "unlink") { wizOrigin = null; render(false); return; }
    if (sg === "use" && s) {
      sgApply(s.product, s.entityIds, { suggestionKey: s.key, rule: s.rule, indicatorIds: s.indicators.map(function (i) { return i.id; }), title: s.title, reason: s.reason },
        s.objective, s.title, s.rule);
      return;
    }
    if (sg === "dismiss" && s) {
      sgBusyKey = key; render(false);
      cfJson("POST", "/admin/campaign-suggestions/dismiss", { key: key, title: s.title, indicatorIds: s.indicators.map(function (i) { return i.id; }) }).then(function (r) {
        sgBusyKey = "";
        if (!r.ok) { inToast(r.j.detail || "تعذّر التجاهل", true); render(false); return; }
        sgData.suggestions = sgData.suggestions.filter(function (x) { return x.key !== key; });
        sgData.adoption.dismissed++;
        render(false); sgLoad(true);
        inToast("تم تجاهل «" + s.title + "»", false, "تراجع", function () {
          cfJson("POST", "/admin/campaign-suggestions/restore", { key: key }).then(function () { sgLoad(true); });
        });
      }).catch(function () { sgBusyKey = ""; inToast("تعذّر الاتصال", true); render(false); });
      return;
    }
    if (sg === "restore") {
      cfJson("POST", "/admin/campaign-suggestions/restore", { key: key }).then(function (r) {
        if (!r.ok) { inToast(r.j.detail || "تعذّرت الاستعادة", true); return; }
        inToast("استُعيدت التوصية", false); sgLoad(true);
      });
      return;
    }
    return;
  }
  var a = t.getAttribute("data-in");
  if (a === "retry") { inFailed = false; inLoad(true); return; }
  if (a === "clearf") { inQ = ""; inFProd = ""; inFStat = ""; inFSig = ""; render(false); return; }
  if (a === "view") { inOpenDrawer(Number(t.getAttribute("data-i")), t.id || ""); return; }
  if (a === "drclose") { inCloseDrawer(); return; }
  if (a === "drretry") { if (inDr) inOpenDrawer(inDr.id, inDr.from); return; }
  if (a === "tgt") { if (typeof tgtQ !== "undefined") tgtQ = t.getAttribute("data-q") || ""; inDr = null; location.hash = "targets"; return; }
  if (a === "drcamp") {
    var it = inDr && inDr.data; if (!it) return;
    var ids = it.members.map(function (m) { return m.entityId; });
    inDr = null;
    sgApply(it.product, ids, { suggestionKey: "indicator|" + it.product + "||" + it.id, rule: "indicator", indicatorIds: [it.id], title: it.name, reason: "جميع عملاء مؤشر «" + it.name + "»" }, "", "حملة — " + it.name, "");
    return;
  }
  if (a === "toggle") { inToggle(Number(t.getAttribute("data-i"))); return; }
  if (!inF) return;
  if (a === "formretry") { var k = inFKey; inF = null; inFKey = ""; inEnsureForm(k); render(false); return; }
  if (a === "cancel") { inF = null; inFKey = ""; location.hash = "indicators"; return; }
  if (a === "seg") {
    var sk = t.getAttribute("data-k"), sv = t.getAttribute("data-v");
    if (sk === "mode") { if (inF.mode !== sv) { inF.mode = sv; if (inF.field === "members") { inF.err = ""; inF.field = ""; } } }
    else if (sk === "pvFilter") { inF.pvFilter = sv; inF.pvPage = 0; }
    else { inF.d[sk] = sv; }
    render(false); return;
  }
  if (a === "pvpage") { inF.pvPage = Math.max(0, inF.pvPage + Number(t.getAttribute("data-v"))); render(false); return; }
  if (a === "addent") { inAddEntity(t.getAttribute("data-line")); return; }
  if (a === "replace") { inF.replace = true; inF.scrollTo = "inf_members"; render(false); return; }
  if (a === "keep") { inF.replace = false; inF.preview = null; render(false); return; }
  if (a === "sample") {
    var ents = (entities || []).slice(0, 3);
    inF.paste = "اسم العميل,المعرف,قيمة المؤشر,الفترة,ملاحظات\\n" +
      (ents.length ? ents.map(function (e, i) { return e.name + ",," + [87, 64, 92][i] + "%,الربع 2 2026,"; }).join("\\n") + "\\n" : "") + "عميل غير مسجّل في مسار,C-0000,40%,الربع 2 2026,";
    render(false); return;
  }
  if (a === "parse") { if (!inF.paste.trim()) { inF.pvErr = "الصق محتوى الملف أولًا."; render(false); return; } inPreviewText(inF.paste); return; }
  if (a === "pick") {
    var id = Number(t.getAttribute("data-i"));
    var has = inF.picked.some(function (p) { return p.entityId === id; });
    inF.picked = has ? inF.picked.filter(function (p) { return p.entityId !== id; }) : inF.picked.concat([{ entityId: id, value: "", period: "", matchedBy: "manual" }]);
    if (inF.field === "members") { inF.err = ""; inF.field = ""; }
    render(false); return;
  }
  if (a === "save") { inSave(false); return; }
  if (a === "draft") { inSave(true); return; }
});
document.addEventListener("input", function (ev) {
  var t = ev.target; if (!t || !t.getAttribute) return;
  var s = t.getAttribute("data-inset");
  if (s === "q") { inQ = t.value; clearTimeout(window.__inq); window.__inq = setTimeout(function () { render(false); }, 200); return; }
  if (s === "drq" && inDr) { inDr.q = t.value; clearTimeout(window.__indrq); window.__indrq = setTimeout(function () { render(false); }, 200); return; }
  if (!inF) return;
  var k = t.getAttribute("data-infld");
  if (k === "paste") { inF.paste = t.value; return; }
  if (k === "manualQ") { inF.manualQ = t.value; clearTimeout(window.__inmq); window.__inmq = setTimeout(function () { render(false); }, 200); return; }
  if (k) {
    inF.d[k] = t.value;
    /* The field's own error goes the moment it is being fixed; no repaint, so typing keeps its caret. */
    if (inF.field === k) {
      inF.err = ""; inF.field = "";
      var er = document.getElementById("err_" + k); if (er) er.remove();
      t.removeAttribute("aria-invalid"); t.removeAttribute("aria-describedby");
      var fe = document.getElementById("inferr"); if (fe) fe.remove();
    }
    return;
  }
  var v = t.getAttribute("data-inval");
  if (v) { inF.picked.forEach(function (p) { if (String(p.entityId) === v) p.value = t.value; }); }
});
document.addEventListener("change", function (ev) {
  var t = ev.target; if (!t || !t.getAttribute) return;
  var s = t.getAttribute("data-inset");
  if (s === "prod") { inFProd = t.value; render(false); return; }
  if (s === "stat") { inFStat = t.value; render(false); return; }
  if (s === "sig") { inFSig = t.value; render(false); return; }
  if (!inF) return;
  if (t.id === "infile" && t.files && t.files[0]) { inPreviewFile(t.files[0]); t.value = ""; return; }
  var r = t.getAttribute("data-inres");
  if (r) { if (t.value) inF.resolve[r] = t.value; else delete inF.resolve[r]; render(false); return; }
  var k = t.getAttribute("data-infld");
  if (k === "product" || k === "signal") { inF.d[k] = t.value; if (inF.field === k) { inF.err = ""; inF.field = ""; } render(false); return; }
  if (k && k !== "paste" && k !== "manualQ") { inF.d[k] = t.value; }
});
["dragenter", "dragover"].forEach(function (n) {
  document.addEventListener(n, function (ev) {
    var z = ev.target && ev.target.closest ? ev.target.closest("#indrop") : null;
    if (!z) return; ev.preventDefault(); z.classList.add("over");
  });
});
["dragleave", "drop"].forEach(function (n) {
  document.addEventListener(n, function (ev) {
    var z = ev.target && ev.target.closest ? ev.target.closest("#indrop") : null;
    if (!z) return; ev.preventDefault(); z.classList.remove("over");
    if (n === "drop" && ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0]) inPreviewFile(ev.dataTransfer.files[0]);
  });
});
document.addEventListener("keydown", function (ev) {
  if (ev.key === "Escape" && inDr && document.querySelector(".in-drw")) { ev.preventDefault(); inCloseDrawer(); }
});
/* ================= end «مؤشرات استخدام العملاء» ================= */
`;
