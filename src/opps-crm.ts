// opps-crm.ts — «فرص البيع», the opportunity ledger.
//
// V5, 2026-09-12. REBUILT to one grammar after the founder's verdict on the V4 board: «not
// professional, not enterprise-level, not modern and minimalist, not connected». The spec was
// synthesized from Dribbble/Pinterest references and three design voices (Claude, an independent
// Claude designer, and GPT via Codex) and approved by GPT before a line was written:
// docs/designs/opps-v5-spec.md.
//
// WHAT THE PAGE IS NOW, top to bottom: the shell's ONE tab row (الفرص · فرز الردود · لوحة المتابعة);
// a single SUMMARY panel (one leading figure, the open pipeline drawn as one bar, a legend that is
// also the stage filter, three shortcut metrics); a single LEDGER panel (toolbar, the WhatsApp
// action row, a flush table or the kanban); and ONE DRAWER that is both the detail view and the
// create form. Everything the V4 page stacked as separate furniture — the second view toggle, nine
// stage boxes, a floating triage banner, an inset editor of a different width, a black button —
// is gone, because each one was a second idiom on a screen that needed one.
//
// THE MODEL IS UNCHANGED, and so is every rule that makes a figure on this page true:
// «فرصة = عميل + عدة منتجات». One row in the ledger is ONE PRODUCT LINE; its stage is STORED (a deal's
// stage is a fact about a meeting nobody here witnessed), its SOURCE says where it came from, and
// its value is سعر × سنوات × كمية × (1−خصم). Those rules live in src/opps-domain.ts, which ships its
// compiled source into this scope (OPP_STAGES, OPP_SOURCES, isOpenStage, calculateLineValue …), so
// the UI restates none of them.
//
// NOT HERE, and named so the omission is not mistaken for a bug:
//   · the cards view. It repeated the kanban at a lower density and made every row a card, which
//     DESIGN.md §3.6 forbids on a surface that can exceed twelve rows. List and kanban remain.
//   · an expected-close date and a probability. The schema has close_on and no UI ever set it, and
//     there is no earned probability model; a column of blanks or guesses is not enterprise, it is
//     furniture. Re-trigger: the first time a rep records a close date.
//   · optimistic concurrency. PATCH is last-write-wins (the row has no version column); the row the
//     server returns replaces the local copy, so the screen never shows a value the ledger refused.
//
// Client JS in the dashboard.ts <script> scope (see campaigns-crm.ts for the seam). It borrows
// esc, fmtN, fmtD, ic, clip, contactByPhone, entities, campaigns, cache, tagList, alertBar,
// pageSlice, pageBar, PAGE, TOKEN, showTest and render.
//
// PORTED to the new design system (docs/PORT-SPEC.md), 2026-09-17. vOppsCrm owns the ONE .ds6
// wrapper for the whole screen — the board, both drawers AND the lost-reason dialog, which used to
// be appended outside it and would have rendered in the old system on top of a ported board.
// Everything inside speaks the m-* vocabulary: m-card, m-table in m-tablewrap, m-board/m-col/m-deal
// for the kanban, m-chip, m-btn, m-seg, m-tabs (the drawer's four sections too — the private
// .ox-dtabs strip and its measured indicator are gone), m-dlg__h/__b/__f inside the side-sheet
// frame, m-field/m-label/m-input/m-select/m-form, m-empty, m-alert, and m-n around EVERY digit.
// Absences are typed (m-nil--owed a number someone owes, --unset a classification nobody made,
// --none a legitimate nothing); there is no bare em-dash left on this screen.
//
// WHAT COULD NOT BE DELETED. This module's stylesheet is not private: products-crm.ts, and to a
// lesser extent indicators-crm.ts, revamp.ts and exec-reports-crm.ts, render .ox-sum, .ox-lbl,
// .ox-fig, .ox-leg, .ox-lg, .ox-met, .ox-tb, .ox-srch, .ox-f, .ox-hr, .ox-r, .ox-state, .ox-fld,
// .ox-dr, .ox-scrim, .ox-ico and .ox-dot out of THIS file, and products even sits inside .ox-led so
// it receives the @container oxl rules below. So only rules this screen alone emitted were removed;
// the rest keep the old look for the unported screens and are overridden, inside .ds6 only, by the
// block at the end of this stylesheet. They come out when those screens are ported in turn.

export const OPPS_CRM_CSS = `
  /* ===== فرص البيع — V5 ===== */
  .ox { display:flex; flex-direction:column; gap:var(--s3); container-type:inline-size; container-name:oxw; }
  .ox :focus { outline:none; }
  .ox :focus-visible, .ox-dr :focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
  .ox .btn-teal:focus-visible, .ox-dr .btn-teal:focus-visible {
    outline:2px solid var(--paper); outline-offset:2px; box-shadow:0 0 0 4px rgba(37,99,235,.35); }
  .ox bdi { unicode-bidi:isolate; }
  .ox-dot { display:inline-block; width:8px; height:8px; border-radius:var(--r-pill); flex:none; }
  .ox-ico { width:16px; height:16px; flex:none; fill:none; stroke:currentColor; stroke-width:1.5;
    stroke-linecap:round; stroke-linejoin:round; }

  /* ---- summary panel ---- */
  .ox-sum { background:var(--paper); border:1px solid var(--line); border-radius:var(--r-lg);
    padding:var(--s4); display:grid; grid-template-columns:minmax(0,1fr) auto; gap:var(--s4);
    align-items:start; }
  .ox-lbl { font-size:var(--t-xs); font-weight:500; color:var(--muted); }
  .ox-fig { font-size:var(--t-2xl); font-weight:600; color:var(--ink); line-height:var(--lh-tight);
    margin-block:var(--s1) var(--s3); font-variant-numeric:tabular-nums; }
  .ox-fig.none { color:var(--muted); font-weight:500; }
  .ox-figsub { font-size:var(--t-xs); color:var(--muted); font-weight:450; margin-inline-start:var(--s2); }
  .ox-bar { display:flex; gap:2px; height:8px; border-radius:var(--r-pill); overflow:hidden;
    background:var(--surface-2); }
  .ox-bar i { display:block; height:100%; min-width:0; cursor:pointer; position:relative;
    transition:opacity var(--fast) var(--ease); }
  .ox-bar i::after { content:""; position:absolute; inset-inline:0; inset-block:-8px; }
  .ox-bar:hover i { opacity:.55; }
  .ox-bar i:hover, .ox-bar i.on { opacity:1; }
  /* The stage ribbon. Rungs are joined by a short connector so the row reads as ONE ladder in order,
     not a tag cloud. A rung holding deals wears its soft tone; the filtered rung goes solid. */
  .ox-leg { display:flex; flex-wrap:wrap; gap:var(--s2) 20px; margin-top:var(--s3); }
  .ox-lg { position:relative; font-family:inherit; font-size:var(--t-xs); font-weight:500; color:var(--tn-text, var(--ink-2)); background:var(--tn-soft, transparent);
    border:1px solid transparent; border-radius:var(--r-pill); min-height:30px; padding:2px 12px 2px 10px;
    display:inline-flex; align-items:center; gap:6px; cursor:pointer;
    transition:background var(--fast) var(--ease), border-color var(--fast) var(--ease), color var(--fast) var(--ease), transform 160ms var(--ease); }
  /* A rung that WRAPS to a new row starts that row: a connector there would point at nothing.
     opMarkRibbonWraps() measures it after paint, because where a row breaks depends on the width. */
  .ox-lg.wrap-start::before { display:none; }
  .ox-lg + .ox-lg::before { content:""; position:absolute; inset-inline-start:-17px; top:50%; width:14px; height:2px;
    margin-top:-1px; background:var(--line); border-radius:var(--r-pill); pointer-events:none; }
  @media (hover:hover) and (pointer:fine) { .ox-lg:hover { border-color:var(--tn, var(--accent-mark)); } }
  .ox-lg:active { transform:scale(0.97); }
  .ox-lg.on { background:var(--tn, var(--accent)); border-color:var(--tn, var(--accent)); color:#FFFFFF; }
  .ox-lg.on .ox-dot { background:#FFFFFF !important; }
  .ox-lg b { font-weight:600; color:inherit; font-variant-numeric:tabular-nums; }
  .ox-lg.on b, .ox-lg.on .n { color:#FFFFFF; border-color:rgba(255,255,255,.45); }
  /* The count sits behind a hairline, never a «·»: beside Arabic-Indic digits a middle dot reads as
     a zero («0»), and «· 5» rendered as «50» in the first screenshot of this legend. */
  .ox-lg .n { color:var(--muted); font-variant-numeric:tabular-nums; padding-inline-start:6px; border-inline-start:1px solid var(--line); line-height:14px; }
  .ox-lg.zero:not(.on) { background:transparent; border-color:var(--line-soft); color:var(--muted); font-weight:450; }
  .ox-lg.zero:not(.on) b { color:var(--muted); }
  .ox-mets { display:flex; align-items:stretch; border:1px solid var(--line-soft); border-radius:var(--r-md); }
  .ox-met { font-family:inherit; background:transparent; border:none; cursor:pointer; text-align:start;
    padding:var(--s2) var(--s3); min-width:112px; display:flex; flex-direction:column; gap:2px;
    transition:background var(--fast) var(--ease); }
  .ox-met + .ox-met { border-inline-start:1px solid var(--line-soft); }
  .ox-met:first-child { border-start-start-radius:var(--r-md); border-end-start-radius:var(--r-md); }
  .ox-met:last-child { border-start-end-radius:var(--r-md); border-end-end-radius:var(--r-md); }
  .ox-met:hover { background:var(--accent-wash); }
  .ox-met.on { background:var(--accent-tint); }
  .ox-met .n { font-size:var(--t-xl); font-weight:600; color:var(--ink); line-height:var(--lh-tight);
    font-variant-numeric:tabular-nums; display:flex; align-items:center; gap:6px; }
  .ox-met .l { font-size:var(--t-xs); color:var(--muted); display:flex; align-items:center; gap:4px; white-space:nowrap; }
  .ox-met.on .l { color:var(--accent-deep); }
  .ox-met.warn .n { color:var(--s-attn-text); }
  .ox-met.zero .n { color:var(--muted); font-weight:500; }
  .ox-met.warn .n .ox-ico { color:var(--s-attn-mark); }
  /* A container cannot restyle itself, so the query is on .ox and the summary is its child. */
  @container oxw (max-width: 760px) {
    .ox-sum { grid-template-columns:1fr; padding:var(--s3); gap:var(--s3); }
    .ox-mets { width:100%; }
    .ox-met { flex:1; min-width:0; padding-inline:var(--s2); }
    /* Two compact columns: the six stage filters stay operable without pushing the first deal
       below the fold. */
    .ox-leg { display:grid; grid-template-columns:1fr 1fr; gap:4px var(--s2); margin-top:var(--s2); }
    .ox-lg { width:100%; display:grid; grid-template-columns:auto minmax(0,max-content) 1fr; grid-template-rows:auto auto;
      column-gap:6px; row-gap:0; align-items:center; text-align:start; border-radius:var(--r-sm); min-height:40px; padding:4px 6px; }
    .ox-lg > .ox-dot { grid-row:1; grid-column:1; }
    .ox-lg + .ox-lg::before { display:none; }
    .ox-lg > span:not(.n) { grid-row:1; grid-column:2; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0; }
    /* The count follows its own label, with no hairline: at the far end of a two-column chip it read
       as belonging to the neighbouring stage. */
    .ox-lg .n { grid-row:1; grid-column:3; justify-self:start; border:none; padding-inline-start:2px; }
    .ox-lg b { grid-row:2; grid-column:2 / 4; font-size:var(--t-xs); }
    .ox-fig { margin-block:2px var(--s2); }
    .ox-met { padding-block:6px; }
    .ox-met .n { font-size:var(--t-lg); }
    .ox-fig { font-size:var(--t-xl); }
    .ox-figsub { display:block; margin-inline-start:0; margin-top:2px; }
  }

  /* ---- ledger panel ---- */
  .ox-led { background:var(--paper); border:1px solid var(--line); border-radius:var(--r-lg);
    overflow:hidden; container-type:inline-size; container-name:oxl; }
  .ox-tb { display:flex; align-items:center; gap:var(--s2); min-height:64px; padding:var(--s2) var(--s3);
    border-bottom:1px solid var(--line-soft); flex-wrap:nowrap; }
  .ox-tb .sp { flex:1; }
  /* On desktop the filters WRAP inside their own group — never scroll, never clip. A scrolling strip
     clipped «الأعلى قيمة» at 1440 and would have hidden «مسح التصفية» (final Claude sign-off). The
     group takes the free width, so search, the view switch and the primary stay on the first row. */
  .ox-filt { display:flex; align-items:center; gap:var(--s2); flex:1 1 0; min-width:0; flex-wrap:wrap; }
  .ox-filt > * { flex:none; }
  .ox-brk { display:none; }
  .ox-srch { position:relative; display:inline-flex; align-items:center; flex:0 1 232px; min-width:180px; }
  .ox-srch .ox-si { position:absolute; inset-inline-start:12px; color:var(--muted); display:flex; pointer-events:none; }
  .ox-srch .inp { width:100%; min-height:36px; height:36px; padding-inline-start:36px; font-size:var(--t-sm); }
  .ox-f { position:relative; display:inline-flex; align-items:center; }
  .ox-f select { font-family:inherit; appearance:none; -webkit-appearance:none; height:36px; max-width:140px;
    font-size:var(--t-sm); font-weight:500; color:var(--ink-2); background:var(--paper);
    border:none; box-shadow:inset 0 0 0 1px var(--line); border-radius:var(--r-sm);
    padding-inline:12px 32px; cursor:pointer; text-overflow:ellipsis;
    transition:box-shadow var(--fast) var(--ease), background var(--fast) var(--ease); }
  .ox-f select:hover { box-shadow:inset 0 0 0 1px var(--ink-2); }
  .ox-f.on select { background:var(--accent-tint); color:var(--accent-deep); box-shadow:inset 0 0 0 1px var(--accent-mark); }
  .ox-f .ox-chev { position:absolute; inset-inline-end:10px; color:var(--muted); pointer-events:none; display:flex; }
  .ox-f.on .ox-chev { color:var(--accent-deep); }
  .ox-fw { display:flex; width:100%; }
  .ox-fw select { width:100%; max-width:none; height:38px; box-shadow:inset 0 0 0 1px var(--s-off-mark); color:var(--ink); font-weight:450; }
  .ox-fw select[aria-invalid="true"] { box-shadow:inset 0 0 0 2px var(--s-fail); }
  .ox-clear { font-family:inherit; font-size:var(--t-sm); font-weight:500; color:var(--accent-deep);
    background:transparent; border:none; cursor:pointer; min-height:36px; padding-inline:6px; border-radius:var(--r-sm);
    display:inline-flex; align-items:center; gap:4px; flex:none; }
  .ox-clear .ox-ico { width:14px; height:14px; }
  .ox-clear:hover { background:var(--accent-wash); }
  /* flex:none + nowrap: beside a crowded filter strip the primary was squeezed until its label
     broke onto two lines. The strip scrolls; the primary action never gives up width. */
  .ox-add.btn { height:36px; padding-inline:14px; font-size:var(--t-sm); gap:6px; flex:none; white-space:nowrap; }
  .ox-add[aria-disabled="true"] { pointer-events:none; }

  /* ---- the WhatsApp action row (Tonomo's action-row component) ---- */
  .ox-wa { border-bottom:1px solid var(--line-soft); }
  .ox-wa-h { font-family:inherit; width:100%; min-height:48px; display:flex; align-items:center; gap:var(--s2);
    padding:var(--s2) var(--s3); background:var(--accent-bar); color:var(--accent-deep); border:none;
    cursor:pointer; font-size:var(--t-sm); font-weight:500; text-align:start;
    transition:background var(--fast) var(--ease); }
  .ox-wa-h:hover { background:var(--accent-bar-hover); }
  .ox-wa-h .sp { flex:1; }
  .ox-wa-h .ox-ico.chev { transition:transform var(--base) var(--ease); }
  .ox-wa-h[aria-expanded="true"] .ox-ico.chev { transform:rotate(180deg); }
  .ox-wa-r { display:grid; grid-template-columns:minmax(0,1.4fr) minmax(0,1fr) auto; align-items:center; gap:var(--s3);
    min-height:52px; padding:var(--s1) var(--s3); border-top:1px solid var(--line-soft); }
  .ox-wa-r .nm { font-size:var(--t-sm); font-weight:600; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .ox-wa-r .pr { font-size:var(--t-xs); color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .ox-wa-r .btn { height:32px; padding-inline:12px; font-size:var(--t-xs); }
  .ox-wa-f { display:flex; justify-content:flex-end; padding:var(--s2) var(--s3); border-top:1px solid var(--line-soft); }
  .ox-lnk { color:var(--accent-deep); font-weight:500; text-decoration:none; border-radius:var(--r-sm); }
  .ox-lnk:hover { text-decoration:underline; text-underline-offset:3px; }

  /* ---- the table ---- */
  .ox-t { display:block; }
  .ox-hr, .ox-r { display:grid; align-items:center; column-gap:16px; padding-inline:var(--s2) var(--s3);
    grid-template-columns:36px minmax(140px,1.2fr) minmax(150px,1.2fr) 150px 116px 108px 100px minmax(120px,1fr) 32px; }
  .ox-hr { min-height:40px; background:var(--surface); border-bottom:1px solid var(--line-soft);
    font-size:var(--t-xs); font-weight:600; color:var(--muted); }
  /* The figure is end-aligned, so it needs its own air on the side that faces the next column, or
     «القيمة المصدر» read as one header. */
  .ox-hr .ox-hv { text-align:end; padding-inline-end:16px; }
  .ox-r { min-height:56px; padding-block:6px; border-bottom:1px solid var(--line-soft); cursor:pointer;
    position:relative; transition:background var(--fast) var(--ease); }
  .ox-r:hover { background:var(--accent-wash); }
  .ox-r.is-sel { background:var(--accent-tint); }
  .ox-r.is-open { background:var(--accent-tint); box-shadow:inset -3px 0 0 var(--accent); }
  [dir="ltr"] .ox-r.is-open { box-shadow:inset 3px 0 0 var(--accent); }
  .ox-go { font-family:inherit; width:32px; height:32px; display:flex; align-items:center; justify-content:center;
    color:var(--muted); background:transparent; border:none; border-radius:var(--r-sm); cursor:pointer; }
  .ox-r:hover .ox-go, .ox-go:hover { color:var(--accent-deep); background:var(--paper); }
  .ox-foot { display:flex; align-items:center; justify-content:space-between; gap:var(--s3); flex-wrap:wrap;
    min-height:52px; padding:var(--s2) var(--s3); font-size:var(--t-xs); color:var(--muted); }
  .ox-foot .tot b { color:var(--ink); font-weight:600; font-variant-numeric:tabular-nums; }
  .ox-state { padding:var(--s5) var(--s4); text-align:center; font-size:var(--t-sm); color:var(--ink-2);
    display:flex; flex-direction:column; align-items:center; gap:var(--s2); }
  .ox-state .s { font-size:var(--t-xs); color:var(--muted); max-width:52ch; line-height:var(--lh-loose); }
  .ox-state .btn { height:36px; font-size:var(--t-sm); }
  .ox-skel { display:grid; grid-template-columns:36px 1.4fr 1fr 176px 124px 1fr; gap:var(--s3); align-items:center;
    min-height:56px; padding-inline:var(--s2) var(--s3); border-bottom:1px solid var(--line-soft); }
  .ox-skel i { display:block; height:12px; border-radius:var(--r-sm); background:var(--skeleton); }
  @container oxl (max-width: 1119px) {
    /* Search and the primary action share the first toolbar row; the filter strip goes beneath. */
    .ox-tb { flex-wrap:wrap; }
    .ox-srch { order:1; }
    .ox-seg { order:2; margin-inline-start:auto; }
    .ox-add { order:2; }
    .ox-tb > .sp { display:none; }
    .ox-filt { order:3; flex:1 0 100%; }
  }
  @container oxl (max-width: 899px) {
    .ox-tb { gap:var(--s2); }
    /* Phone: two rows. Search + primary; then the filters as a strip that scrolls INSIDE itself
       (a phone has no room to wrap four selects) with the view switch beside it. */
    .ox-srch { order:1; flex:1 1 150px; }
    .ox-add { order:2; }
    .ox-brk { display:block; order:3; flex-basis:100%; height:0; }
    .ox-filt { order:4; flex:1 1 0; min-width:0; flex-wrap:nowrap; overflow-x:auto; padding:3px; margin:-3px; scrollbar-width:none; }
    .ox-wa-r { grid-template-columns:minmax(0,1fr) auto; }
    .ox-wa-r .pr { grid-row:2; grid-column:1; }
    .ox-wa-r .btn { grid-row:1 / 3; grid-column:2; }
  }
  @media (pointer:coarse) {
    .ox-f select, .ox-clear, .ox-add.btn { min-height:44px; }
    .ox-go { width:44px; height:44px; }
    .ox-lg { min-height:44px; }
  }

  /* ===================== «بطاقات» — one card per ACCOUNT =====================
     The founder's prototype opens فرص البيع as cards: the customer first, its product lines under it,
     and the deal's health said once at the top. A line-per-row table answers «which line?»; a person
     working a book asks «where does this CUSTOMER stand?» — and in a table that answer is four rows
     apart. Ported from beUI's card / animated-badge / bouncy-accordion idioms into plain CSS: a 2px
     lift on hover (fine pointers only), scale(0.98) on press, and the remaining lines unfolding in
     place rather than navigating away. */
  .ox-cards { display:grid; grid-template-columns:repeat(auto-fill,minmax(336px,1fr)); gap:var(--s3); padding:var(--s3); }
  .ox-card { background:var(--paper); border:1px solid var(--line); border-radius:var(--r-lg);
    padding:var(--s4); display:flex; flex-direction:column; gap:var(--s3); min-width:0;
    transition:box-shadow var(--base) var(--ease), transform var(--base) var(--ease), border-color var(--base) var(--ease); }
  @media (hover:hover) and (pointer:fine) {
    .ox-card:hover { box-shadow:var(--sh-3); transform:translateY(-2px); border-color:var(--accent-mark); }
  }
  .ox-card .top { display:flex; align-items:flex-start; gap:var(--s3); min-width:0; }
  .ox-card .av { width:34px; height:34px; flex:none; border-radius:var(--r-md); background:var(--accent-tint);
    color:var(--accent-deep); font-weight:600; font-size:var(--t-sm); display:flex; align-items:center; justify-content:center; }
  .ox-card .who { flex:1; min-width:0; }
  .ox-card .who b { display:block; font-size:var(--t-sm); font-weight:600; color:var(--ink); overflow-wrap:anywhere; }
  .ox-card .who span { display:block; font-size:var(--t-xs); color:var(--muted); margin-block-start:2px; }
  .ox-card .tot { text-align:end; flex:none; }
  .ox-card .tot b { display:block; font-size:var(--t-md); font-weight:600; color:var(--ink); font-variant-numeric:tabular-nums; }
  .ox-card .tot span { display:block; font-size:var(--t-xs); color:var(--muted); }
  .ox-cb { display:flex; flex-wrap:wrap; gap:5px; align-items:center; }
  .ox-cb b { font-size:var(--t-xs); font-weight:500; border-radius:var(--r-pill); padding:2px 9px;
    background:var(--tn-soft,var(--surface-2)); color:var(--tn-text,var(--ink-2)); display:inline-flex; align-items:center; gap:5px; }
  .ox-cb b i { width:6px; height:6px; border-radius:var(--r-pill); background:currentColor; display:block; }
  .ox-cb .split { font-size:var(--t-xs); color:var(--muted); font-variant-numeric:tabular-nums; }
  .ox-cl { display:flex; flex-direction:column; border-block-start:1px solid var(--line-soft); }
  .ox-cli { display:grid; grid-template-columns:minmax(0,1fr) auto auto; align-items:center; gap:var(--s2);
    padding:9px 6px; margin-inline:-6px; border-radius:var(--r-sm); font-family:inherit; font-size:var(--t-sm);
    text-align:start; background:none; border:0; cursor:pointer; color:inherit; border-block-start:1px solid var(--line-soft);
    transition:background var(--fast) var(--ease), transform 160ms var(--ease); }
  .ox-cli:first-child { border-block-start:0; }
  @media (hover:hover) and (pointer:fine) { .ox-cli:hover { background:var(--surface); } }
  .ox-cli:active { transform:scale(0.98); }
  .ox-cli .pn { font-weight:500; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .ox-cli .st { font-size:var(--t-xs); border-radius:var(--r-pill); padding:2px 9px; white-space:nowrap;
    background:var(--tn-soft); color:var(--tn-text); }
  .ox-cli .vl { font-size:var(--t-xs); font-weight:600; color:var(--ink-2); font-variant-numeric:tabular-nums; white-space:nowrap; }
  .ox-cli .vl.unp { color:var(--muted); font-weight:400; }
  .ox-cmore { font-family:inherit; font-size:var(--t-xs); font-weight:500; color:var(--accent-deep); background:none;
    border:0; cursor:pointer; padding:8px 6px; margin-inline:-6px; border-radius:var(--r-sm); text-align:start;
    border-block-start:1px solid var(--line-soft); transition:background var(--fast) var(--ease); }
  @media (hover:hover) and (pointer:fine) { .ox-cmore:hover { background:var(--accent-bar-hover); } }
  .ox-cmore:active { transform:scale(0.98); }
  /* the unfold: height cannot transition to auto, so the revealed rows fade and rise as a group.
     Reduced motion keeps the fade — something has to say that content appeared. */
  .ox-cl .mor { animation:oxUnfold 220ms cubic-bezier(0.23, 1, 0.32, 1) both; }
  @keyframes oxUnfold { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:none; } }
  @keyframes oxFadeIn { from { opacity:0; } to { opacity:1; } }
  @media (prefers-reduced-motion: reduce) {
    .ox-card { transition:none; }
    .ox-cl .mor { animation:oxFadeIn 160ms linear both; }
  }
  @media (pointer: coarse) { .ox-cli, .ox-cmore { min-height:44px; } }

  /* ---- the drawer: detail and create are one component ---- */
  /* ---- the record drawer (beUI Drawer idioms: blurred backdrop, spring-ish slide, scroll lock,
         esc-to-close). The curve is Ionic's iOS drawer easing, 260ms: a panel this size at the
         default ease reads as sliding TO somewhere; this one arrives. Opacity leads at 140ms so the
         surface is legible before it stops moving. ---- */
  html.ox-lock, html.ox-lock body { overflow:hidden; }
  .ox-scrim { position:fixed; inset:0; background:rgba(16,24,40,.34); z-index:var(--z-overlay);
    opacity:0; transition:opacity 220ms var(--ease), backdrop-filter 220ms var(--ease); }
  .ox-scrim.in { opacity:1; backdrop-filter:blur(3px); }
  .ox-dr { position:fixed; inset-block:0; inset-inline-start:0; width:min(560px,100vw); background:var(--paper);
    border-inline-end:1px solid var(--line); box-shadow:-24px 0 60px rgba(16,24,40,.16);
    border-start-end-radius:var(--r-lg); border-end-end-radius:var(--r-lg);
    z-index:var(--z-modal); display:flex; flex-direction:column;
    transform:translateX(100%); opacity:0;
    transition:transform 260ms cubic-bezier(0.32, 0.72, 0, 1), opacity 140ms linear; }
  [dir="ltr"] .ox-dr { transform:translateX(-100%); box-shadow:24px 0 60px rgba(16,24,40,.16);
    border-start-end-radius:0; border-end-end-radius:0; border-start-start-radius:var(--r-lg); border-end-start-radius:var(--r-lg); }
  .ox-dr.in, [dir="ltr"] .ox-dr.in { transform:none; opacity:1; }
  @media (prefers-reduced-motion: reduce) { .ox-dr, .ox-scrim { transition:opacity 120ms linear; } }
  .ox-dh { flex:none; display:flex; align-items:flex-start; gap:var(--s3); padding:var(--s3) var(--s4);
    min-height:72px; border-bottom:1px solid var(--line-soft); }
  .ox-dh .tt { flex:1; min-width:0; }
  .ox-dh h2:focus, .ox-dh h2:focus-visible { outline:none; }
  .ox-dh h2 { margin:0; font-size:var(--t-lg); font-weight:600; color:var(--ink); line-height:var(--lh-tight);
    overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .ox-dh .st { font-size:var(--t-sm); color:var(--muted); margin-top:2px; display:flex; align-items:center; gap:var(--s2); flex-wrap:wrap; }
  .ox-x { font-family:inherit; flex:none; width:36px; height:36px; display:flex; align-items:center; justify-content:center;
    background:transparent; border:none; border-radius:var(--r-sm); color:var(--muted); cursor:pointer; }
  .ox-x:hover { background:var(--surface); color:var(--ink); }
  .ox-db { flex:1; overflow-y:auto; padding:var(--s4); display:flex; flex-direction:column; gap:var(--s4); }
  .ox-sec { display:flex; flex-direction:column; gap:var(--s2); }
  .ox-sec + .ox-sec { padding-top:var(--s4); border-top:1px solid var(--line-soft); }
  .ox-sech { font-size:var(--t-xs); font-weight:600; color:var(--muted); }
  /* ---- the stage stepper (tones: stage-tone-domain.ts, via --tn / --tn-soft / --tn-text) ---- */
  .ox-steps { list-style:none; margin:0; padding:0; position:relative; display:flex; flex-direction:column; }
  .ox-steps-pill { position:absolute; inset-inline:0; top:0; height:0; border-radius:var(--r-md); pointer-events:none;
    background:var(--tn-soft); border-inline-start:3px solid var(--tn); }
  .ox-step { position:relative; }
  /* The connector runs from this rung's circle to the next one's: toned once the rung is passed. */
  .ox-step:not(:last-of-type)::before { content:""; position:absolute; inset-inline-start:23px; top:32px; bottom:-8px;
    width:2px; background:var(--line); border-radius:var(--r-pill); }
  .ox-step.done::before { background:var(--tn); }
  .ox-stb { position:relative; width:100%; font-family:inherit; display:flex; align-items:center; gap:var(--s2);
    min-height:40px; padding:6px 12px; background:transparent; border:none; border-radius:var(--r-md); text-align:start;
    cursor:pointer; color:var(--ink-2); transition:background var(--fast) var(--ease), transform 160ms var(--ease); }
  .ox-stb[aria-disabled="true"] { cursor:default; }
  @media (hover:hover) and (pointer:fine) {
    .ox-step:not(.current) .ox-stb:not([aria-disabled="true"]):hover { background:var(--surface); }
    .ox-stb:not([aria-disabled="true"]):hover .go { opacity:1; }
  }
  .ox-stb:not([aria-disabled="true"]):active { transform:scale(0.98); }
  @media (pointer:coarse) { .ox-stb { min-height:44px; } }
  .ox-stb .k { flex:none; width:24px; height:24px; border-radius:var(--r-pill); display:inline-flex; align-items:center;
    justify-content:center; font-size:var(--t-xs); font-weight:600; font-variant-numeric:tabular-nums;
    background:var(--paper); color:var(--muted); box-shadow:inset 0 0 0 1.5px var(--s-off-mark); position:relative; }
  .ox-stb .k .ox-ico { width:14px; height:14px; stroke-width:2.25; }
  .ox-stb .tx { display:flex; flex-direction:column; min-width:0; flex:1; }
  .ox-stb .l { font-size:var(--t-sm); line-height:var(--lh-body); }
  .ox-stb .go { font-size:var(--t-xs); font-weight:500; color:var(--accent-deep); opacity:0; transition:opacity var(--fast) var(--ease); }
  .ox-stb:focus-visible .go { opacity:1; }
  .ox-step.done .k { background:var(--tn); color:#FFFFFF; box-shadow:none; }
  .ox-step.done .l { color:var(--tn-text); font-weight:500; }
  .ox-step.current .k { background:var(--tn); color:#FFFFFF; box-shadow:0 0 0 3px var(--paper); }
  .ox-step.current .l { color:var(--ink); font-weight:600; }
  .ox-step.paused .l { color:var(--muted); }
  .ox-steps.is-lost .ox-step .l { color:var(--muted); }
  .ox-exit { display:flex; flex-direction:column; gap:2px; padding:0 12px 10px; padding-inline-start:44px;
    font-size:var(--t-xs); color:var(--ink-2); line-height:var(--lh-body); position:relative; }
  .ox-strow { display:flex; align-items:center; gap:var(--s2); flex-wrap:wrap; }
  .ox-strow .btn { height:36px; padding-inline:12px; font-size:var(--t-sm); gap:6px; }
  .ox-form { font-size:var(--t-xs); color:var(--muted); font-variant-numeric:tabular-nums; }
  .ox-g2 { display:grid; grid-template-columns:1fr 1fr; gap:var(--s3); }
  .ox-fld { display:flex; flex-direction:column; gap:6px; min-width:0; }
  .ox-fld > label, .ox-fld > .l { font-size:var(--t-xs); font-weight:600; color:var(--muted); }
  .ox-fld .req { color:var(--s-fail-text); }
  .ox-fld .inp, .ox-fld select.inp { width:100%; min-height:38px; height:38px; font-size:var(--t-sm); border-radius:var(--r-sm); }
  .ox-fld .inp.num { text-align:end; font-variant-numeric:tabular-nums; }
  .ox-fld .inp.num:placeholder-shown { text-align:start; }
  .ox-fld select.inp { padding-block:0; padding-inline:12px; }
  .ox-dr input[list]::-webkit-calendar-picker-indicator, .ox-tb input[list]::-webkit-calendar-picker-indicator { display:none !important; opacity:0; }
  .ox-fld .inp[aria-invalid="true"] { box-shadow:inset 0 0 0 2px var(--s-fail); }
  /* The save state sits at the END OF THE LABEL ROW, so it reserves no vertical space and nothing
     below it moves when «جارٍ الحفظ…» appears (DESIGN.md §8.1 failure 1). */
  .ox-lr { display:flex; align-items:center; justify-content:space-between; gap:var(--s2); min-height:18px; }
  .ox-lr > label, .ox-lr > .l { font-size:var(--t-xs); font-weight:600; color:var(--muted); }
  .ox-fs { font-size:var(--t-xs); display:flex; align-items:center; gap:4px; white-space:nowrap; }
  .ox-fs .ox-ico { width:14px; height:14px; }
  .ox-fs.pend { color:var(--muted); }
  .ox-fs.ok { color:var(--s-issued-text); }
  .ox-fs.bad { color:var(--s-fail-text); }
  .ox-fs button { font-family:inherit; font-size:var(--t-xs); font-weight:600; color:var(--accent-deep); background:transparent;
    border:none; cursor:pointer; padding:0 4px; border-radius:var(--r-sm); }
  .ox-hint { font-size:var(--t-xs); color:var(--s-attn-text); display:flex; align-items:center; gap:6px; }
  .ox-hint .ox-ico { width:14px; height:14px; color:var(--s-attn-mark); }
  .ox-dl { display:grid; grid-template-columns:112px minmax(0,1fr); gap:var(--s2) var(--s3); margin:0; font-size:var(--t-sm); }
  .ox-dl dt { color:var(--muted); font-size:var(--t-xs); font-weight:600; padding-top:2px; }
  .ox-dl dd { margin:0; color:var(--ink); min-width:0; overflow-wrap:anywhere; }
  .ox-rel { display:flex; flex-direction:column; border:1px solid var(--line-soft); border-radius:var(--r-md); overflow:hidden; }
  .ox-relr { font-family:inherit; display:grid; grid-template-columns:minmax(0,1fr) auto auto; gap:var(--s3); align-items:center;
    min-height:44px; padding:var(--s1) var(--s3); background:transparent; border:none; text-align:start; cursor:pointer;
    font-size:var(--t-sm); color:var(--ink); transition:background var(--fast) var(--ease); }
  .ox-relr + .ox-relr { border-top:1px solid var(--line-soft); }
  .ox-relr:hover { background:var(--accent-wash); }
  .ox-relr .p { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .ox-relr .s { font-size:var(--t-xs); color:var(--muted); display:flex; align-items:center; gap:6px; white-space:nowrap; }
  .ox-relr .v { font-weight:600; font-variant-numeric:tabular-nums; white-space:nowrap; }
  .ox-df { flex:none; display:flex; align-items:center; gap:var(--s2); padding:var(--s3) var(--s4);
    border-top:1px solid var(--line-soft); background:var(--paper); flex-wrap:wrap; }
  .ox-df .sp { flex:1; }
  .ox-df .btn { height:38px; font-size:var(--t-sm); }
  .ox-escacts { display:flex; gap:var(--s2); align-items:center; flex-wrap:wrap; padding-block:var(--s1); }
  .ox-escacts .btn { height:36px; font-size:var(--t-sm); }
  .ox-hint2 { font-size:var(--t-xs); color:var(--muted); line-height:1.6; }
  .ox-escform { display:flex; flex-direction:column; gap:var(--s2); }
  .ox-escbtns { display:flex; gap:var(--s2); align-items:center; flex-wrap:wrap; }
  .ox-escbtns .btn { height:36px; font-size:var(--t-sm); }
  .ox-esclist { display:flex; flex-direction:column; margin-top:var(--s2); }
  .ox-escr { display:grid; grid-template-columns:64px minmax(0,1fr) auto auto; gap:var(--s2); align-items:start;
    padding:var(--s2) 0; border-top:1px solid var(--line-soft); font-size:var(--t-xs); color:var(--muted); }
  .ox-escr .k { font-weight:600; color:var(--accent-deep); }
  .ox-escr .t { color:var(--ink-2); min-width:0; }
  .ox-escr .t b { color:var(--ink); font-weight:600; }
  .ox-escr .t .why { display:block; color:var(--muted); line-height:1.6; overflow-wrap:anywhere; }
  .ox-escr .m { text-align:end; white-space:nowrap; }
  .ox-escr .m .dl { display:block; color:var(--s-attn-text); }
  .ox-escr .ok { color:var(--s-issued-text); font-weight:600; display:inline-flex; align-items:center; gap:4px; }
  .ox-escr.done { opacity:.7; }
  .ox-escr .btn { height:28px; padding-inline:10px; font-size:var(--t-xs); }
  .ox-cnt { font-size:var(--t-xs); font-weight:600; color:var(--s-attn-text); margin-inline-start:var(--s2); }
  .ox-df .rv-hold { height:38px; padding-inline:16px; font-size:var(--t-sm); }
  .ox-df .rv-hold:not(.holding):not(.armed) { background:var(--surface); color:var(--s-fail-text); }
  .ox-df .rv-hold:hover { background:var(--s-fail-soft); }
  .ox-derr { font-size:var(--t-xs); color:var(--s-fail-text); display:flex; align-items:center; gap:6px; flex:1 0 100%; }
  .ox-lblk { border:1px solid var(--line); border-radius:var(--r-md); padding:var(--s3); display:flex; flex-direction:column; gap:var(--s3); }
  .ox-lblk .hd { display:flex; align-items:center; justify-content:space-between; gap:var(--s2);
    font-size:var(--t-xs); font-weight:600; color:var(--muted); }
  .ox-lblk .hd button { font-family:inherit; font-size:var(--t-xs); font-weight:600; color:var(--s-fail-text);
    background:transparent; border:none; cursor:pointer; min-height:28px; padding-inline:6px; border-radius:var(--r-sm); }
  .ox-lblk .lv { font-size:var(--t-sm); font-weight:600; color:var(--ink); font-variant-numeric:tabular-nums; }
  .ox-lblk .lv.unp { color:var(--muted); font-weight:450; }
  .ox-arow { font-family:inherit; width:100%; min-height:44px; display:flex; align-items:center; justify-content:center; gap:6px;
    background:var(--accent-bar); color:var(--accent-deep); border:none; border-radius:var(--r-md); font-size:var(--t-sm);
    font-weight:600; cursor:pointer; transition:background var(--fast) var(--ease); }
  .ox-arow:hover { background:var(--accent-bar-hover); }
  .ox-total { display:flex; align-items:baseline; justify-content:space-between; gap:var(--s3); }
  .ox-total .v { font-size:var(--t-xl); font-weight:600; color:var(--ink); font-variant-numeric:tabular-nums; }
  @media (max-width: 560px) {
    .ox-dh, .ox-db, .ox-df { padding-inline:var(--s3); }
    .ox-g2 { grid-template-columns:1fr; }
  }

  /* ---- toast with an action ---- */
  .ox-toast { position:fixed; inset-block-end:24px; inset-inline:0; margin-inline:auto; width:max-content;
    max-width:min(92vw,56ch); z-index:var(--z-toast); display:flex; align-items:center; gap:var(--s3);
    background:var(--ink); color:var(--paper); border-radius:var(--r-md); padding:10px 12px 10px 16px;
    font-size:var(--t-sm); font-weight:500; box-shadow:var(--sh-2, 0 6px 20px rgba(16,24,40,.10)); }
  .ox-toast.bad { background:var(--s-fail-text); }
  .ox-toast button { font-family:inherit; font-size:var(--t-sm); font-weight:600; color:var(--paper);
    background:transparent; border:1px solid rgba(255,255,255,.45); border-radius:var(--r-sm); min-height:30px;
    padding-inline:10px; cursor:pointer; }
  .ox-toast button.x { border:none; font-size:var(--t-md); padding-inline:6px; }

  /* =========================================================================================
     THE PORTED LAYER — everything above this line is the old system, kept alive for the four
     screens that still render these classes out of this file. Everything below applies ONLY
     inside .ds6, speaks the m-* tokens, and covers the two things the vocabulary genuinely
     lacks on this screen: a ledger table that stacks on a phone instead of scrolling sideways,
     and a side drawer (the vocabulary's dialog is centred).
     Specificity note: this stylesheet is emitted BEFORE massar-ds-crm.ts, so a rule that has to
     beat an m-* rule on the SAME element carries three classes, never two.
     ========================================================================================= */

  /* --- summary --- */
  .ds6 .ox-sum { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:var(--m-5); align-items:start; }
  .ds6 .ox-fig { font-size:var(--m-t-fig); font-weight:800; color:var(--m-ink); line-height:1.2;
    letter-spacing:var(--m-tracking-figure); margin-block:var(--m-2) var(--m-4); }
  .ds6 .ox-figsub { font-size:var(--m-t-cap); color:var(--m-mut); font-weight:500; margin-inline-start:var(--m-2); }
  .ds6 .ox-bar { display:flex; gap:2px; height:8px; border-radius:var(--m-r-chip); overflow:hidden; background:var(--m-sunk); }
  .ds6 .ox-bar i { display:block; height:100%; min-width:0; cursor:pointer; position:relative;
    transition:opacity var(--m-out) var(--m-ease); }
  .ds6 .ox-leg { display:flex; flex-wrap:wrap; gap:var(--m-2) 20px; margin-block-start:var(--m-4); }
  .ds6 .ox-lg { font-family:inherit; font-size:var(--m-t-cap); font-weight:500; color:var(--tn-text, var(--m-ink-2));
    background:var(--tn-soft, transparent); border:1px solid transparent; border-radius:var(--m-r-chip);
    min-height:32px; padding:2px 12px 2px 10px; display:inline-flex; align-items:center; gap:6px; cursor:pointer;
    transition:background var(--m-out) var(--m-ease), color var(--m-out) var(--m-ease), transform var(--m-press) var(--m-ease); }
  .ds6 .ox-lg + .ox-lg::before { background:var(--m-line-2); }
  .ds6 .ox-lg.on { background:var(--tn, var(--m-ac)); border-color:var(--tn, var(--m-ac)); color:#FFFFFF; }
  .ds6 .ox-lg .n { color:var(--m-mut); border-inline-start:1px solid var(--m-line-2); padding-inline-start:6px; }
  .ds6 .ox-lg.zero:not(.on) { background:transparent; border-color:var(--m-line); color:var(--m-faint); font-weight:400; }
  .ds6 .ox-mets { display:flex; align-items:stretch; border:1px solid var(--m-line); border-radius:var(--m-r-ctl); }
  .ds6 .ox-met { font-family:inherit; background:transparent; border:none; cursor:pointer; text-align:start;
    padding:var(--m-2) var(--m-3); min-width:112px; display:flex; flex-direction:column; gap:2px;
    transition:background var(--m-out) var(--m-ease); }
  .ds6 .ox-met + .ox-met { border-inline-start:1px solid var(--m-line); }
  .ds6 .ox-met .n { font-size:var(--m-t-h); font-weight:700; color:var(--m-ink); line-height:1.2;
    display:flex; align-items:center; gap:6px; }
  .ds6 .ox-met .l { font-size:var(--m-t-cap); color:var(--m-mut); display:flex; align-items:center; gap:4px; white-space:nowrap; }
  .ds6 .ox-met.on { background:var(--m-ac-dim); }
  .ds6 .ox-met.on .l { color:var(--m-ac-deep); }
  .ds6 .ox-met.warn .n { color:var(--m-warn); }
  .ds6 .ox-met.zero .n { color:var(--m-faint); font-weight:600; }

  /* --- ledger shell + toolbar --- */
  .ds6 .ox-led { background:var(--m-paper); border:1px solid var(--m-line); border-radius:var(--m-r-card); }
  .ds6 .ox-tb { min-height:60px; padding:var(--m-2) var(--m-3); border-bottom:1px solid var(--m-line); gap:var(--m-2); }
  .ds6 .ox-srch { flex:0 1 240px; min-width:180px; }
  .ds6 .ox-srch .m-input { padding-inline-start:36px; }
  .ds6 .ox-srch .ox-si { color:var(--m-faint); }
  /* An active filter says so on the control itself: the vocabulary has one select, not a filtered one. */
  .ds6 .m-select.is-on { box-shadow:0 0 0 1px var(--m-ac), 0 1px 2px rgba(0,0,0,.05); color:var(--m-ac-deep); background:var(--m-ac-dim); }
  .ds6 .ox-tb .m-select { max-width:170px; }
  .ds6 .ox-clear { color:var(--m-ac-deep); }

  /* --- the WhatsApp action row --- */
  .ds6 .ox-wa { border-bottom:1px solid var(--m-line); }
  .ds6 .ox-wa-h { background:var(--m-ac-dim); color:var(--m-ac-deep); }
  .ds6 .ox-wa-r { border-top:1px solid var(--m-line); }
  .ds6 .ox-wa-r .nm { font-size:var(--m-t-body); font-weight:600; color:var(--m-ink); }
  .ds6 .ox-wa-r .pr { font-size:var(--m-t-cap); color:var(--m-mut); }
  .ds6 .ox-wa-f { border-top:1px solid var(--m-line); }

  /* --- the ledger table: m-table, plus the one thing the vocabulary lacks — stacking on a phone.
         A table that only scrolls sideways hides the value column, which is the column a rep opens
         this screen for. --- */
  .ds6 .ox-t { min-inline-size: 900px; }
  .ds6 .m-table tbody tr.is-open { background:var(--m-ac-dim); box-shadow:inset -3px 0 0 var(--m-ac); }
  .ds6 .m-table tbody tr[data-click] { cursor:pointer; }
  .ds6 .m-table td.ox-sel, .ds6 .m-table th.ox-sel { inline-size:34px; padding-inline:var(--m-3) 0; }
  .ds6 .m-table td.ox-act { inline-size:40px; padding-inline:0 var(--m-3); }
  .ds6 .ox-pn { display:block; overflow-wrap:anywhere; line-height:1.4; }
  .ds6 .ox-stack { display:flex; align-items:center; gap:6px; flex-wrap:wrap; min-inline-size:0; }
  .ds6 .ox-a { color:inherit; font-weight:600; text-decoration:none; }
  @media (hover:hover) and (pointer:fine) { .ds6 .ox-a:hover { color:var(--m-ac-deep); text-decoration:underline; text-underline-offset:3px; } }
  @container oxl (max-width: 899px) {
    .ds6 .ox-t { min-inline-size:0; }
    .ds6 .ox-t thead { display:none; }
    .ds6 .ox-t tbody tr { display:grid; grid-template-columns:34px minmax(0,1fr) auto; align-items:center;
      column-gap:var(--m-2); row-gap:var(--m-1); padding-block:var(--m-3); border-block-start:1px solid var(--m-line); }
    .ds6 .ox-t tbody td { display:block; border:0; padding:0; }
    .ds6 .ox-t tbody td.ox-sel { grid-row:1 / 5; grid-column:1; align-self:start; }
    .ds6 .ox-t tbody td.ox-ac { grid-row:1; grid-column:2; }
    .ds6 .ox-t tbody td.ox-vl { grid-row:1; grid-column:3; text-align:end; }
    .ds6 .ox-t tbody td.ox-pd { grid-row:2; grid-column:2 / 4; }
    .ds6 .ox-t tbody td.ox-st { grid-row:3; grid-column:2 / 4; }
    .ds6 .ox-t tbody td.ox-sr { grid-row:4; grid-column:2; font-size:var(--m-t-cap); }
    .ds6 .ox-t tbody td.ox-ow { grid-row:5; grid-column:2; font-size:var(--m-t-cap); }
    .ds6 .ox-t tbody td.ox-nx { grid-row:5; grid-column:3; font-size:var(--m-t-cap); text-align:end; }
    .ds6 .ox-t tbody td.ox-act { display:none; }
  }
  .ds6 .ox-foot { min-height:52px; padding:var(--m-3); font-size:var(--m-t-cap); color:var(--m-mut);
    border-block-start:1px solid var(--m-line); }
  .ds6 .ox-foot .tot b { color:var(--m-ink); font-weight:600; }
  .ds6 .ox-skel { grid-template-columns:34px 1.4fr 1fr 176px 124px 1fr; border-bottom:1px solid var(--m-line); }
  .ds6 .ox-skel i { background:var(--m-sunk); }

  /* --- cards: one per ACCOUNT. The vocabulary has no account card, so this stays, in m tokens. --- */
  .ds6 .ox-cards { display:grid; grid-template-columns:repeat(auto-fill,minmax(336px,1fr)); gap:var(--m-3); padding:var(--m-3); }
  .ds6 .ox-card { background:var(--m-paper); border:1px solid var(--m-line); border-radius:var(--m-r-card);
    padding:var(--m-4); display:flex; flex-direction:column; gap:var(--m-3); min-width:0;
    transition:box-shadow var(--m-in) var(--m-ease), transform var(--m-in) var(--m-ease), border-color var(--m-in) var(--m-ease); }
  @media (hover:hover) and (pointer:fine) { .ds6 .ox-card:hover { box-shadow:var(--m-lift); transform:translateY(-2px); border-color:var(--m-ac-line); } }
  .ds6 .ox-card .who b { display:block; font-size:var(--m-t-body); font-weight:700; color:var(--m-ink); overflow-wrap:anywhere; }
  .ds6 .ox-card .who span { display:block; font-size:var(--m-t-cap); color:var(--m-mut); margin-block-start:2px; }
  .ds6 .ox-card .tot b { display:block; font-size:var(--m-t-sub); font-weight:700; color:var(--m-ink); }
  .ds6 .ox-card .tot span { display:block; font-size:var(--m-t-cap); color:var(--m-mut); }
  .ds6 .ox-cb .split { font-size:var(--m-t-cap); color:var(--m-mut); }
  .ds6 .ox-cl { border-block-start:1px solid var(--m-line); }
  .ds6 .ox-cli { border-block-start:1px solid var(--m-line); font-size:var(--m-t-body); }
  .ds6 .ox-cli:first-child { border-block-start:0; }
  @media (hover:hover) and (pointer:fine) { .ds6 .ox-cli:hover { background:var(--m-page); } }
  .ds6 .ox-cli .pn { font-weight:500; color:var(--m-ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .ds6 .ox-cmore { color:var(--m-ac-deep); border-block-start:1px solid var(--m-line); }

  /* --- kanban: m-board / m-col / m-deal, plus the drop target and the per-stage tone cap --- */
  .ds6 .m-board { padding:var(--m-3); }
  .ds6 .m-board .m-col { box-shadow:inset 0 3px 0 var(--tn, transparent); }
  .ds6 .m-board .m-col.over { box-shadow:inset 0 3px 0 var(--tn, transparent), inset 0 0 0 2px var(--m-ac-line); }
  .ds6 .m-col__c.ox-tone { background:var(--tn-soft); color:var(--tn-text); box-shadow:none; }
  .ds6 .m-deal.is-open { box-shadow:0 0 0 2px var(--m-ac); }
  .ds6 .m-deal__o { font-size:var(--m-t-micro); color:var(--m-faint); display:inline-flex; align-items:center; gap:4px;
    overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0; }
  .ds6 .m-deal__o .ox-ico { width:14px; height:14px; }
  .ds6 .ox-kmore { font-family:inherit; font-size:var(--m-t-cap); font-weight:600; color:var(--m-ac-deep);
    background:var(--m-ac-dim); border:none; border-radius:var(--m-r-ctl); min-height:36px; cursor:pointer; }

  /* --- the drawer. The vocabulary's dialog is centred; this one is a side sheet, so the frame is
         local and everything inside it is m-dlg__h / __b / __f. --- */
  .ds6 .ox-scrim { background:rgba(11,13,18,.44); }
  .ds6 .ox-dr { background:var(--m-paper); border-inline-end:1px solid var(--m-line);
    border-start-end-radius:var(--m-r-band); border-end-end-radius:var(--m-r-band); box-shadow:var(--m-lift); }
  .ds6 .ox-dr .m-dlg__h { align-items:flex-start; min-height:72px; flex:none; }
  .ds6 .ox-dr .m-dlg__b { flex:1; max-block-size:none; display:flex; flex-direction:column; gap:var(--m-5); }
  .ds6 .ox-dr .m-dlg__f { flex:none; justify-content:flex-start; align-items:center; flex-wrap:wrap; gap:var(--m-2); }
  .ds6 .ox-dr .m-tabs { flex:none; padding-inline:var(--m-5); }
  .ds6 .ox-hd { display:flex; align-items:flex-start; gap:var(--m-3); flex:1; min-width:0; }
  .ds6 .ox-hd .tt { flex:1; min-width:0; }
  .ds6 .ox-hd .m-dlg__t { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .ds6 .ox-hd .m-dlg__t:focus, .ds6 .ox-hd .m-dlg__t:focus-visible { outline:none; }
  .ds6 .ox-hval { display:flex; align-items:baseline; gap:var(--m-3); flex-wrap:wrap;
    padding:var(--m-3) var(--m-5) 0; }
  .ds6 .ox-hval .fig { font-size:var(--m-t-h); font-weight:700; color:var(--m-ink); line-height:1.2; }
  .ds6 .ox-hval .sub { font-size:var(--m-t-cap); color:var(--m-mut); }
  /* A spacer inside the two rows the vocabulary has no layout for: the drawer footer and the stage
     action row. One rule rather than an inline flex on every site. */
  .ds6 .ox-dr .m-dlg__f .sp, .ds6 .ox-strow .sp { flex:1 1 auto; }
  .ds6 .ox-dr .m-dlg__f .rv-hold { min-block-size:44px; padding-inline:var(--m-4); font-size:var(--m-t-body); }
  /* An address or a phone number is not a quantity, so it does not take .m-n — but it is still
     latin inside an RTL line and has to be isolated or the punctuation migrates. */
  .ds6 bdi { unicode-bidi:isolate; }
  /* The create form picks ONE source from five, each with its icon. The vocabulary's segmented
     control is built for two or three and does not wrap; this one wraps and carries icons. */
  .ds6 .ox-srcs { display:flex; flex-wrap:wrap; gap:var(--m-2); }
  .ds6 .ox-srcs button { font:inherit; font-size:var(--m-t-cap); font-weight:600; color:var(--m-ink-2);
    background:var(--m-paper); border:1px solid var(--m-line-2); border-radius:var(--m-r-chip);
    min-block-size:40px; padding-inline:var(--m-3); display:inline-flex; align-items:center; gap:6px;
    cursor:pointer;
    transition:background var(--m-out) var(--m-ease), border-color var(--m-out) var(--m-ease), transform var(--m-press) var(--m-ease); }
  .ds6 .ox-srcs button:active { transform:scale(.97); }
  .ds6 .ox-srcs button[aria-checked="true"] { background:var(--m-ac-dim); color:var(--m-ac-deep); border-color:var(--m-ac); }
  /* A role that may only read gets the stored value printed where its input would be. */
  .ds6 .ox-ro { font-size:var(--m-t-body); color:var(--m-ink); min-block-size:36px; display:flex; align-items:center; }
  /* A quantity typed into a field is still a figure: end-aligned and tabular, but start-aligned while
     only the placeholder shows, or the hint reads as though it were cut off. */
  .ds6 .m-input.num { text-align:end; font-variant-numeric:tabular-nums; }
  .ds6 .m-input.num:placeholder-shown { text-align:start; }
  .ds6 .ox-lblk .lv { font-size:var(--m-t-body); font-weight:700; color:var(--m-ink); }
  .ds6 .ox-sec { display:flex; flex-direction:column; gap:var(--m-2); }
  .ds6 .ox-sec + .ox-sec { padding-block-start:var(--m-5); border-block-start:1px solid var(--m-line); }
  .ds6 .ox-sech { font-size:var(--m-t-cap); font-weight:700; color:var(--m-mut); }
  .ds6 .ox-cnt { font-size:var(--m-t-micro); font-weight:700; color:var(--m-warn); margin-inline-start:var(--m-2); }
  .ds6 .ox-hint2 { font-size:var(--m-t-cap); color:var(--m-mut); line-height:1.7; }
  .ds6 .ox-form { font-size:var(--m-t-cap); color:var(--m-mut); }
  .ds6 .ox-dl { display:grid; grid-template-columns:112px minmax(0,1fr); gap:var(--m-2) var(--m-3); margin:0;
    font-size:var(--m-t-body); }
  .ds6 .ox-dl dt { color:var(--m-mut); font-size:var(--m-t-cap); font-weight:600; padding-block-start:2px; }
  .ds6 .ox-dl dd { margin:0; color:var(--m-ink); min-width:0; overflow-wrap:anywhere; }
  .ds6 .ox-rel { border:1px solid var(--m-line); border-radius:var(--m-r-ctl); overflow:hidden; }
  .ds6 .ox-relr { border-top:1px solid var(--m-line); font-size:var(--m-t-body); color:var(--m-ink); }
  .ds6 .ox-relr:first-child { border-top:0; }
  @media (hover:hover) and (pointer:fine) { .ds6 .ox-relr:hover { background:var(--m-page); } }
  .ds6 .ox-lblk { border:1px solid var(--m-line); border-radius:var(--m-r-ctl); padding:var(--m-3); }
  .ds6 .ox-lblk .hd { font-size:var(--m-t-cap); font-weight:700; color:var(--m-mut); }
  .ds6 .ox-arow { background:var(--m-ac-dim); color:var(--m-ac-deep); border-radius:var(--m-r-ctl);
    font-size:var(--m-t-body); }
  .ds6 .ox-total { display:flex; align-items:baseline; justify-content:space-between; gap:var(--m-3); }
  .ds6 .ox-total .v { font-size:var(--m-t-h); font-weight:700; color:var(--m-ink); }
  .ds6 .ox-esclist, .ds6 .ox-escr { font-size:var(--m-t-cap); }
  .ds6 .ox-escr { border-top:1px solid var(--m-line); color:var(--m-mut); }
  .ds6 .ox-escr .k { color:var(--m-ac-deep); }
  .ds6 .ox-escr .t { color:var(--m-ink-2); }
  .ds6 .ox-escr .t b { color:var(--m-ink); }
  .ds6 .ox-escr .m .dl { color:var(--m-warn); }
  .ds6 .ox-escr .ok { color:var(--m-ok); }
  .ds6 .ox-derr { font-size:var(--m-t-cap); color:var(--m-bad); }
  .ds6 .ox-fs { font-size:var(--m-t-cap); }
  .ds6 .ox-fs.pend { color:var(--m-mut); }
  .ds6 .ox-fs.ok { color:var(--m-ok); }
  .ds6 .ox-fs.bad { color:var(--m-bad); }
  .ds6 .ox-fs button { color:var(--m-ac-deep); }
  .ds6 .ox-hint { font-size:var(--m-t-cap); color:var(--m-warn); }
  .ds6 .ox-hint .ox-ico { color:var(--m-warn); }

  /* --- the stage stepper: a vertical ladder of real buttons. m-steps is a horizontal wizard rail,
         which cannot carry a per-rung age, an exit criterion or a move action. --- */
  .ds6 .ox-steps-pill { background:var(--tn-soft); border-inline-start:3px solid var(--tn); }
  .ds6 .ox-step:not(:last-of-type)::before { background:var(--m-line-2); }
  .ds6 .ox-step.done::before { background:var(--tn); }
  .ds6 .ox-stb { color:var(--m-ink-2); border-radius:var(--m-r-ctl); }
  @media (hover:hover) and (pointer:fine) { .ds6 .ox-step:not(.current) .ox-stb:not([aria-disabled="true"]):hover { background:var(--m-page); } }
  .ds6 .ox-stb .k { background:var(--m-paper); color:var(--m-mut); box-shadow:inset 0 0 0 1.5px var(--m-line-2); }
  .ds6 .ox-stb .l { font-size:var(--m-t-body); }
  .ds6 .ox-stb .go { font-size:var(--m-t-cap); color:var(--m-ac-deep); }
  .ds6 .ox-step.done .k, .ds6 .ox-step.current .k { background:var(--tn); color:#FFFFFF; box-shadow:none; }
  .ds6 .ox-step.current .k { box-shadow:0 0 0 3px var(--m-paper); }
  .ds6 .ox-step.done .l { color:var(--tn-text); font-weight:500; }
  .ds6 .ox-step.current .l { color:var(--m-ink); font-weight:600; }
  .ds6 .ox-step.paused .l, .ds6 .ox-steps.is-lost .ox-step .l { color:var(--m-faint); }
  .ds6 .ox-exit { font-size:var(--m-t-cap); color:var(--m-ink-2); }
  .ds6 .ox-go { color:var(--m-mut); }
  @media (hover:hover) and (pointer:fine) { .ds6 .ox-go:hover { color:var(--m-ac-deep); background:var(--m-page); } }

  /* --- a chip that wears a stage's tone. The tone is data (stage-tone-domain.ts), so it arrives as
         custom properties and this rule decides where they land. --- */
  .ds6 .m-chip.ox-tone { background:var(--tn-soft); color:var(--tn-text); }
  .ds6 .m-chip.ox-tone::before { background:var(--tn); }
`;

export const OPPS_CRM_JS = `
/* ============================ opps-crm V5 (client) ============================ */
/* Own state, own names. oppTab/oppQ belong to «فرز الردود» (vMorningList) and are NOT reused: two
   screens sharing one search box is how a filter typed on one silently narrows the other. */
var oppRows = null, oppLoading = false, oppBusy = false, oppFailed = false;
var opView = "board";        /* retained for dataSignature; triage is now its own route (#triage) */
var opMode = "cards";        /* cards | list | kanban — cards is the landing view (the founder's prototype) */
var opSort = "value";        /* value | recent | stage | account */
var opSel = {};              /* selected LINE ids, keyed by id */
var opQ = "", opStat = "all", opSrc = "all", opStg = "all";
var opOwn = "all";           /* all | __none | <owner name> */
/* Exact product, set by links from a product record so the list reproduces that record's count. */
var opProd = "";
var opShort = "";            /* "" | open | stalled | unpriced — the summary's shortcut metrics */
/* BR-RPT-004 — the drill from a report card that names a population no board filter can express
   («راكدة»: open lines with no stage movement in the window, which is read from the stage ledger and
   not from anything a line carries). The report hands over the very ids it counted, so the list that
   opens is the one the sentence measured — never a similar-looking recomputation. Cleared like any
   other filter, and the chip says where it came from. */
var opIds = null;            /* null = off, else { id: 1 } */
var opIdsLabel = "";
var opDragId = null;
var opOpen = 0;              /* id of the line whose drawer is open; 0 = none */
var opArm = 0;
var opSheet = null;          /* the create draft; non-null means the drawer is in CREATE mode */
var opErr = "", opErrFld = "";
var opWaOpen = false;        /* the WhatsApp action row, expanded */
var opFState = {};           /* "id:key" -> { s: pending|saved|failed|invalid, v, m } */
var opFQueue = {};           /* "id:key" -> the next value, written after the pending one returns */
var opOpener = "";           /* id of the element that opened the drawer, for focus return */
var opDrShown = false;       /* the drawer's entrance has played for the current open */
var opDrScroll = 0;
var opKCap = {};             /* kanban: per-stage render cap */
var opDelErr = "";

/* The compiled ladder is the FALLBACK shape, and it must carry the same fields the live one does:
   isStageSelectable reads .active, and an undefined there would make every stage unselectable until
   «إعدادات النظام» had been loaded once. */
var OPP_ST = OPP_STAGES.map(function (s) {
  var def = (typeof SALES_STAGES !== "undefined" ? SALES_STAGES : []).filter(function (x) { return x.key === s.key; })[0];
  return { key: s.key, label: s.label, dot: s.dot, position: s.position, active: true, slaDays: null, terminal: null,
    exitCriterion: def && def.exitCriterion ? def.exitCriterion : "" };
});
var OPP_SRC = OPP_SOURCES;
var OPP_KCAP = 50;

/* ARABIC COUNTS ARE NOT «n + noun» — four-way, via the business tier's pluralizeArabic. */
function opPl(n, one, two, few, many) { return pluralizeArabic(n, one, two, few, many, fmtN); }
/* The same four-way rule, with the NUMERAL bound to a derivation (PORT-SPEC §6) so a count printed
   in two places cannot drift. One and two carry no numeral in Arabic, so there is nothing to bind
   there and the plain words are returned — which is also why the binding is per-site, not global. */
function opPlFig(key, n, one, two, few, many) {
  n = Number(n) || 0;
  if (n === 1) return one;
  if (n === 2) return two;
  return dsFig(key, n) + " " + (n >= 3 && n <= 10 ? few : many);
}
/* The counts this screen prints in more than one place, derived ONCE from the arrays the screen
   renders. dsVerify re-runs them on every paint and outlines any figure that disagrees. */
dsD("opOpen", function () { return opBaseRows().filter(opIsOpen).length; });
dsD("opStalled", function () { return opBaseRows().filter(opStalled).length; });
dsD("opUnpriced", function () { return opBaseRows().filter(function (l) { return opIsOpen(l) && !opPriced(l); }).length; });
dsD("opMatch", function () { return opLines().length; });
/* The drawer's three tab counts, printed on the tab AND on the section heading inside it. */
dsD("owActs", function () { var w = owWork[opOpen]; return w && w.data ? (w.data.activities || []).length : 0; });
dsD("owQuotes", function () { var w = owWork[opOpen]; return w && w.data ? (w.data.quotes || []).length : 0; });
dsD("owEsc", function () { return (opEscRows[opOpen] || []).filter(function (r) { return !r.resolvedAt; }).length; });
function opNProd(n) { return opPl(n, "منتج واحد", "منتجان", "منتجات", "منتجًا"); }
function opNLine(n) { return opPl(n, "بند واحد", "بندان", "بنود", "بندًا"); }
/* opNOpp is read by sales-crm.ts («المستهدفات والأداء»), not by this page. The V5 rewrite dropped it and
   smoke caught #perf rendering blank on the first deploy; it stays for that caller. */
function opNOpp(n) { return opPl(n, "فرصة واحدة", "فرصتان", "فرص", "فرصة"); }
function opNEnt(n) { return opPl(n, "جهة واحدة", "جهتان", "جهات", "جهة"); }
function opNDay(n) { return opPl(n, "يوم واحد", "يومان", "أيام", "يومًا"); }
function opNYear(n) { return opPl(n, "سنة واحدة", "سنتان", "سنوات", "سنة"); }
/* The same four-way rule for MARKUP, with the numeral inside .m-n. opPl stays plain because
   opToast writes through textContent and an aria-label is not parsed as HTML — a span there would
   print as literal angle brackets or be read out as markup. */
function opPlN(n, one, two, few, many) { return pluralizeArabic(n, one, two, few, many, opN); }
function opNLineN(n) { return opPlN(n, "بند واحد", "بندان", "بنود", "بندًا"); }
function opNEntN(n) { return opPlN(n, "جهة واحدة", "جهتان", "جهات", "جهة"); }
function opNDayN(n) { return opPlN(n, "يوم واحد", "يومان", "أيام", "يومًا"); }
function opNYearN(n) { return opPlN(n, "سنة واحدة", "سنتان", "سنوات", "سنة"); }
function opNProdN(n) { return opPlN(n, "منتج واحد", "منتجان", "منتجات", "منتجًا"); }

function opStage(k) {
  for (var i = 0; i < OPP_ST.length; i++) if (OPP_ST[i].key === k) return OPP_ST[i];
  /* A key the ladder does not carry (a config read that failed, or a rung deleted while a line sat
     on it) is shown AS ITSELF. Falling back to OPP_ST[0] labelled it «تواصل أولي» — a wrong stage
     printed with full confidence. */
  /* A line with NO stage key at all is a classification nobody made; it is named as one rather than
     drawn as a bare em-dash, which PORT-SPEC §4 leaves no room for. */
  return { key: k, label: String(k || "مرحلة غير مسجّلة"), dot: "#A2A9B4", position: 99, active: true, slaDays: null, terminal: null };
}
function opOpenStages() { return OPP_ST.filter(function (s) { return isOpenStage(s.key); }); }
/* A paused rung is not offered for new work, but never traps a line already on it (config-domain's
   isStageSelectable, the same rule the server applies on the write). */
function opSelectableStages(current) {
  return OPP_ST.filter(function (s) { return isStageSelectable(s, current); });
}
function opWonKey() { var s = OPP_ST.filter(function (x) { return isWonStage(x.key); })[0]; return s ? s.key : "won"; }
function opLostKey() { var s = OPP_ST.filter(function (x) { return isLostStage(x.key); })[0]; return s ? s.key : "lost"; }
/* ONE identity per stage, used by the summary bar, the stage ribbon, the row badge, the kanban
   header, the drawer stepper and «نظرة تنفيذية». V5 drew open stages from a single blue ramp — six
   shades a reader could not tell apart, which is what the founder rejected on 2026-09-15. The tones
   now come from stage-tone-domain.ts (measured, unit-tested); the label is always printed beside the
   colour, so colour is never the only channel (DESIGN.md §3.0b). */
function opTone(k) {
  return stageToneOf(k, opStage(k).terminal, customToneIndex(opOpenStages().map(function (s) { return s.key; }), k));
}
function opColor(k) { return opTone(k).solid; }
/* The three custom properties every toned element reads, so CSS decides WHERE a tone applies and the
   domain decides WHAT it is. */
function opToneVars(k) { var t = opTone(k); return "--tn:" + t.solid + ";--tn-soft:" + t.soft + ";--tn-text:" + t.text; }
function opDot(k) { return '<i class="ox-dot" style="background:' + opColor(k) + '"></i>'; }

/* Thin adapters: a ledger ROW (snake_case, as Postgres returns it) into the business tier's shape. */
function opFacts(o) {
  return { stage: o.stage, salePrice: Number(o.sale_price || 0), years: Number(o.years || 1),
    quantity: Number(o.qty || 1), discountPercent: Number(o.discount || 0),
    stageEnteredAt: Number(o.stage_at || o.created_at || 0) };
}
function opIsWon(o) { return isWonStage(o.stage); }
function opIsLost(o) { return isLostStage(o.stage); }
function opIsOpen(o) { return isOpenStage(o.stage); }
function opDays(o) { return daysInStage(opFacts(o), Date.now()); }
/* The stage's own SLA decides «متأخرة» once an admin has set one in «إعدادات النظام»; the compiled
   two-rung / 14-day rule is the fallback for a ladder that carries no SLA at all. */
function opStageSla(o) {
  var st = opStage(o.stage);
  return st && st.slaDays ? Number(st.slaDays) : null;
}
function opStalled(o) {
  var sla = opStageSla(o);
  if (sla === null) return isLineStalled(opFacts(o), Date.now());
  return isOpenStage(o.stage) && opDays(o) >= sla;
}
function opValue(o) { return calculateLineValue(opFacts(o)); }
function opPriced(l) { return isLinePriced(opFacts(l)); }
function opSumLive(ls) { return sumLiveValue(ls.map(opFacts)); }
function opHasLost(ls) { return hasLostLine(ls.map(opFacts)); }
function opKey(o) { return accountKey(o.account_name, o.phone); }
var OPP_UNPRICED = "لم تُسعَّر";
/* A price nobody has entered is a number someone OWES, not a legitimate nothing — it is the one
   absence on this screen that is work outstanding, and it is drawn as such. */
function opUnpricedNil() { return opNil(OPP_UNPRICED, "owed"); }

/* EVERY DIGIT GOES THROUGH .m-n (PORT-SPEC §3): it sets direction:ltr, unicode-bidi:isolate and
   tabular figures, and the unit rides INSIDE the span or the bidi algorithm puts «ر.س» on the wrong
   side of the amount. It replaces the bare <bdi> this screen used to wrap money in. */
function opN(v) { return '<span class="m-n">' + fmtN(v) + "</span>"; }
function opNU(v, unit) { return '<span class="m-n">' + fmtN(v) + " " + unit + "</span>"; }
/* Three kinds of absence, drawn three ways (PORT-SPEC §4): owed = a number someone owes,
   unset = a classification nobody made, none = a legitimate nothing. Never a bare em-dash. */
function opNil(t, kind) { return '<span class="m-td-nil m-nil--' + (kind || "none") + '">' + esc(t) + "</span>"; }
/* A ROW SHOWS THE WHOLE FIGURE. «4 ألف ر.س» was both rounded (the line is 4٬200) and a counted-noun
   error (3–10 take آلاف). Full amounts in rows and the drawer; the compact form only where space
   genuinely forbids it (kanban headers, legend), and with the right noun. */
function opMoney(v) { return opNU(Math.round(Number(v || 0)), "ر.س"); }
function opMoneyShort(v) {
  v = Number(v || 0);
  if (v >= 1e6) {
    var m = Math.round(v / 1e5) / 10;
    var mNoun = m >= 3 && m <= 10 && m === Math.floor(m) ? "ملايين" : "مليون";
    return opNU(m, mNoun + " ر.س");
  }
  if (v >= 1e4) {
    var k = Math.round(v / 1000);
    var kNoun = k >= 3 && k <= 10 ? "آلاف" : "ألف";
    return opNU(k, kNoun + " ر.س");
  }
  return opMoney(v);
}
function opAgo(o) {
  var d = opDays(o);
  /* «منذ» governs the genitive: «منذ يومين», not «منذ يومان» (GPT review, 2026-09-15). */
  return d <= 0 ? "منذ اليوم" : "منذ " + opPl(d, "يوم واحد", "يومين", "أيام", "يومًا");
}
/* opAgo stays plain: owJourneySection runs it through esc(). This is the markup form. */
function opAgoN(o) {
  var d = opDays(o);
  return d <= 0 ? "منذ اليوم" : "منذ " + opPlN(d, "يوم واحد", "يومين", "أيام", "يومًا");
}

/* ---- icons: 16px, stroke 1.5, currentColor (DESIGN.md §5 Icon) ---- */
var OPP_ICO = {
  whatsapp: '<path d="M4 5h16v11H9l-5 4z"/>',
  call: '<path d="M6 3h3l2 5-2 1.5a11 11 0 0 0 5.5 5.5L16 13l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z"/>',
  visit: '<path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  referral: '<path d="M15 6l5 5-5 5"/><path d="M20 11H10a6 6 0 0 0-6 6v1"/>',
  inbound: '<path d="M3 13h5l2 3h4l2-3h5"/><path d="M5 5h14l2 8v6H3v-6z"/>',
  other: '<circle cx="12" cy="12" r="8"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h1M4 12h1M4 18h1"/>',
  board: '<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="10" rx="1"/><rect x="17" y="4" width="4" height="13" rx="1"/>',
  cards: '<rect x="3" y="4" width="8" height="7" rx="1.5"/><rect x="13" y="4" width="8" height="7" rx="1.5"/><rect x="3" y="13" width="8" height="7" rx="1.5"/><rect x="13" y="13" width="8" height="7" rx="1.5"/>',
  chevS: '<path d="M15 6l-6 6 6 6"/>',
  chevD: '<path d="M6 9l6 6 6-6"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  warn: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
  back: '<path d="M9 6l6 6-6 6"/>',
  up: '<path d="M12 20V6"/><path d="M6 12l6-6 6 6"/>',
  help: '<circle cx="12" cy="12" r="8.4"/><path d="M9.6 9.6a2.4 2.4 0 1 1 3.2 2.3c-.7.3-.8.8-.8 1.5"/><path d="M12 16.6v.4"/>'
};
function opIco(n, cls) {
  return '<svg class="ox-ico' + (cls ? " " + cls : "") + '" viewBox="0 0 24 24" aria-hidden="true">' + (OPP_ICO[n] || "") + "</svg>";
}
function opSrcLabel(k) { return OPP_SRC[k] || OPP_SRC.other; }

function opLoad(force) {
  // A FAILED LOAD MUST NOT LOOK LIKE AN EMPTY LEDGER (DESIGN.md §4). The failure stays null so the
  // next render retries, and it is SAID.
  /* …and a failure is NOT retried by the next paint. It used to be, so a persistent outage became a
     fetch loop that re-rendered forever and flashed the error away before anyone could read it. The
     retry is the button's job (opRetry passes force). */
  if (oppLoading || (oppRows && !force) || (oppFailed && !force)) return;
  oppLoading = true; oppFailed = false;
  fetch("/admin/opps", { headers: { "x-admin-token": TOKEN } })
    .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(function (j) { oppRows = j.opps || []; oppLoading = false; opRender(); })
    .catch(function () { oppFailed = true; oppLoading = false; opRender(); });
}

/* Every re-render from this module goes through here, so the drawer keeps its scroll position
   across the #body rewrite that every change causes. */
function opRender() { render(false); }

/* A role that may READ deals but not change them (exec, and the product manager per §22) gets the
   board without its write controls. The server refuses the write either way — this is so the screen
   stops offering work the reader cannot do, which is the whole of BR-SEC-002's «view only». */
function opMayEdit() { return typeof meCan !== "function" || meCan("opps.edit"); }

/* ---- filters ---- */
function opBaseMatch(l) {
  var q = opQ.trim();
  if (opIds && !opIds[l.id]) return false;
  if (opProd && l.product !== opProd) return false;
  if (opSrc !== "all" && l.source !== opSrc) return false;
  if (opOwn === "__none" && String(l.owner || "").trim()) return false;
  if (opOwn !== "all" && opOwn !== "__none" && String(l.owner || "").trim() !== opOwn) return false;
  if (!q) return true;
  return String(l.account_name).includes(q) || String(l.product).includes(q) ||
    String(l.phone || "").includes(q) || String(l.owner || "").includes(q) || String(l.next_step || "").includes(q);
}
/* The summary reflects search/source/owner but NOT the stage filter or the shortcut — it is the
   navigator for those two, and a navigator that shrinks to the one stage you chose cannot take you
   to another. */
function opBaseRows() { return (oppRows || []).filter(opBaseMatch); }
function opShortMatch(l) {
  if (opShort === "open") return opIsOpen(l);
  if (opShort === "stalled") return opStalled(l);
  if (opShort === "unpriced") return opIsOpen(l) && !opPriced(l);
  return true;
}
/* ONE filter over LINES, read by the list, the kanban and every total. */
function opLines() {
  return opBaseRows().filter(function (l) {
    if (opStg !== "all" && l.stage !== opStg) return false;
    return opShortMatch(l);
  });
}
function opFiltered() { return opQ.trim() || opSrc !== "all" || opOwn !== "all" || opStg !== "all" || opShort || opProd || !!opIds; }
function opSorted() {
  var rows = opLines().slice();
  var pos = {}; OPP_ST.forEach(function (st, i) { pos[st.key] = i; });
  return rows.sort(function (a, b) {
    if (opSort === "recent") return (b.updated_at || 0) - (a.updated_at || 0);
    if (opSort === "stage") return (pos[a.stage] - pos[b.stage]) || (opValue(b) - opValue(a));
    if (opSort === "account") return String(a.account_name).localeCompare(String(b.account_name), "ar");
    return (opPriced(b) - opPriced(a)) || (opValue(b) - opValue(a));
  });
}
function opSelIds() {
  var live = {};
  opLines().forEach(function (l) { live[l.id] = true; });
  return Object.keys(opSel).map(Number).filter(function (id) { return live[id]; });
}
function opOwners() {
  var seen = [];
  (oppRows || []).forEach(function (l) { var o = String(l.owner || "").trim(); if (o && seen.indexOf(o) === -1) seen.push(o); });
  return seen.sort(function (a, b) { return a.localeCompare(b, "ar"); });
}
function opUnsaved(id) {
  return Object.keys(opFState).some(function (k) { return k.indexOf(id + ":") === 0 && opFState[k].s === "failed"; });
}

/* ---- the WhatsApp band's source: interested contacts with NO line on the board ----
   It lists what is MISSING, never what exists, so it empties itself as the board fills. */
function opUnrecorded() {
  var have = {};
  (oppRows || []).forEach(function (o) { if (o.phone) have[o.phone] = 1; });
  return ((cache && cache.contacts) || []).filter(function (c) {
    if (c.test && !showTest) return false;
    if (c.optedOut || c.outcome === "stopped" || c.outcome === "not_interested") return false;
    if (have[c.phone]) return false;
    var warm = (c.tags || []).some(function (t) { return t.level === "hot" || t.level === "warm"; });
    return warm || c.outcome === "interested" || c.outcome === "scheduled" || c.outcome === "handoff";
  }).sort(function (a, b) { return (b.lastEventAt || 0) - (a.lastEventAt || 0); });
}
function opReadProduct(c) {
  var t = (c.tags || []).filter(function (x) { return x.product; })
    .sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); })[0];
  return t ? t.product : "";
}
function opLastCampaign(phone) {
  var hit = null;
  (campaigns || []).forEach(function (cp) {
    if ((cp.targets || []).some(function (t) { return t.phone === phone; })) {
      if (!hit || Number(cp.id) > Number(hit.id)) hit = cp;
    }
  });
  return hit;
}
function opCampName(id) {
  var cp = (campaigns || []).find(function (x) { return String(x.id) === String(id); });
  return cp ? cp.name : "حملة محذوفة";
}

/* ================================ SUMMARY ================================ */
function opSummary() {
  var rows = opBaseRows();
  var open = rows.filter(opIsOpen);
  var openVal = opSumLive(open);
  var stalled = rows.filter(opStalled).length;
  var unpriced = open.filter(function (l) { return !opPriced(l); }).length;
  var stages = opOpenStages().map(function (st) {
    var ls = open.filter(function (l) { return l.stage === st.key; });
    return { st: st, n: ls.length, v: ls.reduce(function (a, l) { return a + opValue(l); }, 0) };
  });
  var h = '<section class="m-card ox-sum" aria-label="ملخص الفرص"><div>';
  h += '<h2 class="m-label">القيمة المفتوحة</h2>';
  h += openVal
    ? '<div class="ox-fig">' + opMoney(openVal) +
      (unpriced ? '<span class="ox-figsub">خارجها: ' +
        opPlFig("opUnpriced", unpriced, "بند واحد", "بندان", "بنود", "بندًا") + " بلا تسعير</span>" : "") + "</div>"
    : '<div class="ox-fig">' + opNil(open.length ? "لا بند مفتوح مسعَّر بعد" : "لا بنود مفتوحة", "none") + "</div>";
  /* The bar's geometry IS the priced open value per stage. It is a pointer shortcut; the legend
     below it is the operable, readable form, so zero and hair-thin stages never need a target. */
  h += '<div class="ox-bar" aria-hidden="true">';
  if (openVal) {
    stages.forEach(function (s) {
      if (!s.v) return;
      h += '<i class="' + (opStg === s.st.key ? "on" : "") + '" tabindex="-1" style="flex:' + s.v + ' 1 0;background:' + opColor(s.st.key) + '"' +
        ' title="' + esc(s.st.label) + '" onclick="opSetStg(&quot;' + s.st.key + '&quot;)"></i>';
    });
  }
  h += "</div>";
  /* The stage RIBBON: every open rung by name, in ladder order, joined by a connector, each in its own
     tone. A rung holding deals is filled with its soft tone; the filtered one goes solid. */
  h += '<div class="ox-leg" role="group" aria-label="المراحل المفتوحة — اضغط للتصفية">' + stages.map(function (s) {
    var on = opStg === s.st.key;
    return '<button class="ox-lg' + (on ? " on" : "") + (s.n ? "" : " zero") + '" aria-pressed="' + on + '"' +
      ' style="' + opToneVars(s.st.key) + '" onclick="opSetStg(&quot;' + s.st.key + '&quot;)">' + opDot(s.st.key) +
      "<span>" + esc(s.st.label) + "</span>" +
      (s.v ? "<b>" + opMoneyShort(s.v) + "</b>" : "") +
      '<span class="n" title="عدد البنود">' + opN(s.n) + "</span></button>";
  }).join("") + "</div>";
  h += "</div>";
  var met = function (key, n, label, warn, fig) {
    var on = opShort === key;
    return '<button class="ox-met' + (on ? " on" : "") + (warn && n ? " warn" : "") + (n ? "" : " zero") + '" aria-pressed="' + on + '"' +
      ' onclick="opSetShort(&quot;' + key + '&quot;)">' +
      '<span class="n">' + (warn && n ? opIco("warn") : "") + dsFig(fig, n) + "</span>" +
      '<span class="l">' + (on ? opIco("check") : "") + label + "</span></button>";
  };
  h += '<div class="ox-mets" role="group" aria-label="اختصارات">' +
    met("open", open.length, "بنود مفتوحة", false, "opOpen") +
    met("stalled", stalled, "متوقفة", true, "opStalled") +
    met("unpriced", unpriced, "لم تُسعَّر", false, "opUnpriced") + "</div>";
  return h + "</section>";
}

/* ================================ TOOLBAR ================================ */
/* One m-select, no custom chevron: the vocabulary's select draws its own. A filter that is ACTIVE
   still has to say so, which the vocabulary does not cover, so is-on is the one local addition. */
function opSelect(id, label, value, opts, on, handler) {
  return '<select class="m-select' + (on ? " is-on" : "") + '" id="' + id + '" aria-label="' + label + '" onchange="' + handler + '(this.value)">' +
    opts.map(function (o) {
      return '<option value="' + esc(o[0]) + '"' + (String(value) === String(o[0]) ? " selected" : "") + ">" + esc(o[1]) + "</option>";
    }).join("") + "</select>";
}
/* The selection bar takes the resting toolbar's MEASURED height. When the filters wrap to a second
   row the resting bar is taller than the one-row selection bar, and selecting a row made the whole
   table jump ~34px (final Claude sign-off). The height is read after each resting paint. */
var opTbH = 0;
/* The board runs on the ladder «إعدادات النظام» owns. If that read failed, the board is working from
   the compiled fallback and should say so rather than quietly mislabelling a custom rung. */
function opLadderNotice() {
  if (typeof cfFailed === "undefined" || !cfFailed) return "";
  return '<div class="m-alert" role="alert">' + opIco("warn") +
    '<span class="m-alert__d">تعذّر تحميل مراحل البيع — المعروض المراحل الأساسية، وقد تظهر مرحلة مخصصة باسمها البرمجي.</span>' +
    '<button class="m-btn" data-op="ladderretry">أعد المحاولة</button></div>';
}
function opToolbar() {
  /* Selection exists to drive the bulk stage move and owner assign — both writes. A role that may
     only read never selects, so the branch below cannot be reached; the guard keeps it explicit. */
  var sel = opMayEdit() ? opSelIds() : [];
  var h = '<div class="ox-tb" role="toolbar" aria-label="أدوات الفرص"' + (sel.length && opTbH ? ' style="min-height:' + opTbH + 'px"' : "") + ">";
  if (sel.length) {
    var all = opLines();
    h += '<span class="m-chip m-chip--ac m-chip--plain">' + opIco("check") + opNLine(sel.length) + " محدّد</span>";
    h += '<select class="m-select" id="oxb_stage" aria-label="نقل المحدَّد إلى مرحلة" onchange="opBulkStage(this)"' + (oppBusy ? " disabled" : "") + ">" +
      '<option value="">نقل إلى مرحلة…</option>' +
      opSelectableStages().map(function (st) { return '<option value="' + st.key + '">' + esc(st.label) + "</option>"; }).join("") + "</select>";
    h += '<input class="m-input" id="oxb_owner" style="max-inline-size:170px" list="oxowners" aria-label="إسناد المحدَّد إلى" placeholder="أسنِد إلى…" onchange="opBulkOwner(this)"' + (oppBusy ? " disabled" : "") + ">";
    h += '<datalist id="oxowners">' + opOwners().map(function (o) { return '<option value="' + esc(o) + '"></option>'; }).join("") + "</datalist>";
    var pg = pageSlice("opps", opSorted());
    if (sel.length < all.length && pg.length && pg.every(function (l) { return opSel[l.id]; })) {
      h += '<button class="m-btn m-btn--quiet" onclick="opSelectAll()">تحديد كل المطابِق (' + dsFig("opMatch", all.length) + ")</button>";
    }
    h += '<span class="sp"></span><button class="m-btn ox-add" onclick="opClearSel()">إلغاء التحديد</button>';
    return h + "</div>";
  }
  h += '<span class="ox-srch m-rel"><span class="ox-si">' + opIco("search") + "</span>" +
    '<input id="opq" class="m-input" type="search" value="' + esc(opQ) + '" oninput="opSearch(this)" aria-label="بحث في الفرص" placeholder="بحث بالجهة أو المنتج أو المسؤول"></span>';
  h += '<span class="ox-filt">';
  h += opSelect("oxf_stg", "المرحلة", opStg,
    [["all", "كل المراحل"]].concat(OPP_ST.map(function (s) { return [s.key, s.label]; })), opStg !== "all", "opSetStg");
  h += opSelect("oxf_src", "المصدر", opSrc,
    [["all", "كل المصادر"]].concat(Object.keys(OPP_SRC).filter(function (k) { return k !== "other"; }).map(function (k) { return [k, OPP_SRC[k]]; })),
    opSrc !== "all", "opSetSrc");
  h += opSelect("oxf_own", "المسؤول", opOwn,
    [["all", "كل المسؤولين"], ["__none", "بلا مسؤول"]].concat(opOwners().map(function (o) { return [o, o]; })), opOwn !== "all", "opSetOwn");
  {
    h += opSelect("oxf_sort", opMode === "kanban" ? "ترتيب البطاقات داخل كل مرحلة" : "ترتيب", opSort,
      [["value", "الأعلى قيمة"], ["recent", "الأحدث حركة"], ["stage", "حسب المرحلة"], ["account", "حسب الجهة"]], false, "opSetSort");
  }
  if (opProd) h += '<button class="m-btn m-btn--quiet" aria-pressed="true" onclick="opClearProd()" title="إزالة تصفية المنتج">المنتج: ' + esc(opProd) + " " + opIco("x") + "</button>";
  /* A drill from «التقارير» is a filter like any other, and it says so — landing on a shortened list
     with no visible reason is how a reader concludes the board lost their deals. */
  if (opIds) h += '<button class="m-btn m-btn--quiet" aria-pressed="true" onclick="opClearIds()" title="إزالة تصفية التقرير">من التقرير: ' + esc(opIdsLabel || "بنود محدّدة") + " " + opIco("x") + "</button>";
  if (opFiltered()) h += '<button class="m-btn m-btn--quiet ox-clear" onclick="opClearFilters()" aria-label="مسح التصفية" title="مسح التصفية">' + opIco("x") + "مسح</button>";
  h += "</span>";
  /* The view switch sits OUTSIDE the scrolling filter strip, so it can never be scrolled out of
     sight. */
  h += '<span class="m-seg" role="group" aria-label="طريقة العرض">' +
    '<button type="button" aria-pressed="' + (opMode === "list") + '" aria-label="عرض القائمة" title="قائمة" onclick="opSetMode(&quot;list&quot;)">' + opIco("list") + "</button>" +
    '<button type="button" aria-pressed="' + (opMode === "cards") + '" aria-label="عرض البطاقات" title="بطاقات — بطاقة لكل عميل" onclick="opSetMode(&quot;cards&quot;)">' + opIco("cards") + "</button>" +
    '<button type="button" aria-pressed="' + (opMode === "kanban") + '" aria-label="عرض كانبان" title="كانبان" onclick="opSetMode(&quot;kanban&quot;)">' + opIco("board") + "</button></span>";
  /* While the create drawer is open ITS primary is the only blue button in the DOM. */
  h += !opMayEdit() ? ""
    : opSheet
    ? '<button class="m-btn ox-add" aria-disabled="true" tabindex="-1">' + opIco("plus") + "إضافة فرصة</button>"
    : '<button class="m-btn m-btn--primary ox-add" id="oxadd" onclick="opOpenSheet(this.id)">' + opIco("plus") + "إضافة فرصة</button>";
  h += '<span class="ox-brk" aria-hidden="true"></span>';
  return h + "</div>";
}

/* ================================ WHATSAPP ROW ================================ */
function opWaRow() {
  var un = opUnrecorded();
  if (!un.length) return "";
  var h = '<div class="ox-wa">';
  h += '<button class="ox-wa-h" aria-expanded="' + opWaOpen + '" aria-controls="oxwa" onclick="opToggleWa()">' +
    opIco("whatsapp") + "<span><b>" + opPl(un.length, "جهة واحدة مهتمّة", "جهتان مهتمّتان", "جهات مهتمّة", "جهة مهتمّة") + "</b> عبر واتساب بلا فرصة</span>" +
    '<span class="sp"></span><span>' + (opWaOpen ? "إخفاء" : "عرض") + "</span>" + opIco("chevD", "chev") + "</button>";
  if (opWaOpen) {
    var shown = un.slice(0, 8);
    h += '<div id="oxwa">' + shown.map(function (c) {
      var pr = opReadProduct(c);
      return '<div class="ox-wa-r"><span class="nm">' + esc(c.waName || c.phone) + "</span>" +
        '<span class="pr">' + (pr ? "سأل عن " + esc(pr) : opNil("لم تُقرأ خدمة بعد", "unset")) + "</span>" +
        (opMayEdit()
          ? '<button class="m-btn" id="oxwa_' + esc(c.phone) + '" onclick="opFromContact(&quot;' + esc(c.phone) + '&quot;,this.id)">فتح فرصة</button>'
          : '<a class="m-link" href="#customer/' + esc(c.phone) + '">افتح المحادثة</a>') + "</div>";
    }).join("") +
    '<div class="ox-wa-f"><a class="m-link" href="#triage">' + (un.length > shown.length ? "و" + opNEnt(un.length - shown.length) + " أخرى · " : "") +
      "كل الردود في «فرز الردود» ←</a></div></div>";
  }
  return h + "</div>";
}

/* ================================ LIST ================================ */
/* The stage is a toned chip: colour carries the rung, the label always beside it (DESIGN.md §3.0b).
   m-chip draws its own dot from currentColor, so opDot is no longer needed in the list. */
function opStageCell(l) {
  var st = opStage(l.stage);
  var h = '<span class="m-chip ox-tone" style="' + opToneVars(l.stage) + '">' + esc(st.label) + "</span>";
  if (opStalled(l)) h += '<span class="m-chip m-chip--warn">متوقفة منذ ' + opNDayN(opDays(l)) + "</span>";
  else h += '<span class="m-meta">' + opAgoN(l) + "</span>";
  return h;
}
function opSrcCell(l) {
  var lbl = esc(opSrcLabel(l.source));
  if (l.source === "whatsapp" && l.phone) {
    return '<a class="ox-a ox-stack" href="#customer/' + esc(l.phone) + '" title="فتح المحادثة" onclick="event.stopPropagation()">' + opIco("whatsapp") + lbl + "</a>";
  }
  return '<span class="ox-stack">' + opIco(l.source in OPP_ICO ? l.source : "other") + "<span>" + lbl + "</span></span>";
}
function opRowHtml(l) {
  var nm = esc(l.account_name);
  var h = "<tr" + (opOpen === l.id && !opSheet ? ' class="is-open"' : "") +
    (opSel[l.id] ? ' aria-selected="true"' : "") + ' data-click="1" onclick="opRowClick(event,' + l.id + ')">';
  h += '<td class="ox-sel">' + (opMayEdit()
    ? '<input class="m-cb" type="checkbox" id="oxs_' + l.id + '"' + (opSel[l.id] ? " checked" : "") +
      ' aria-label="تحديد ' + nm + " — " + esc(l.product) + '" onclick="event.stopPropagation();opToggleSel(' + l.id + ')">'
    : "") + "</td>";
  h += '<td class="m-td-n ox-ac"><span class="ox-stack">' +
    (l.phone ? '<a class="ox-a" href="#customer/' + esc(l.phone) + '" title="ملف العميل" onclick="event.stopPropagation()">' + nm + "</a>" : nm) +
    (l.created_by === "المساعد" ? '<span class="m-chip m-chip--ac" title="فتحها المساعد تلقائيًا عند قراءة نية مرتفعة">تلقائي</span>' : "") +
    (opUnsaved(l.id) ? '<span class="m-chip m-chip--bad" title="تعديل لم يُحفظ">لم يُحفظ</span>' : "") + "</span></td>";
  h += '<td class="ox-pd"><span class="ox-pn" title="' + esc(l.product) + '">' + esc(l.product) + "</span></td>";
  h += '<td class="ox-st"><span class="ox-stack">' + opStageCell(l) + "</span></td>";
  h += '<td class="m-td-v ox-vl">' + (opPriced(l) ? opMoney(opValue(l)) : opUnpricedNil()) + "</td>";
  h += '<td class="ox-sr">' + opSrcCell(l) + "</td>";
  h += '<td class="ox-ow">' + (String(l.owner || "").trim() ? esc(l.owner) : opNil("بلا مسؤول", "unset")) + "</td>";
  h += '<td class="ox-nx" title="' + esc(l.next_step || "") + '">' +
    (String(l.next_step || "").trim() ? esc(l.next_step) : opNil("لم تُحدَّد", "unset")) + "</td>";
  h += '<td class="ox-act"><button class="ox-go" id="oxt_' + l.id + '" aria-label="فتح تفاصيل ' + nm + " — " + esc(l.product) + '"' +
    ' onclick="event.stopPropagation();opOpenLine(' + l.id + ',this.id)">' + opIco("chevS") + "</button></td>";
  return h + "</tr>";
}
/* One empty state, three views. m-empty says WHICH nothing this is: a filter that matched nothing
   is not the same as a ledger with no deals in it, and the second one needs the sentence that says
   where a deal comes from. */
function opEmpty() {
  if (oppRows && oppRows.length) {
    return '<div class="m-empty"><p class="m-empty__t">لا بند يطابق التصفية.</p>' +
      '<p class="m-empty__d">التصفية الحالية لا تطابق أي بند في السجل.</p>' +
      '<div class="m-empty__a"><button class="m-btn" onclick="opClearFilters()">مسح التصفية</button></div></div>';
  }
  return '<div class="m-empty"><p class="m-empty__t">لا فرص مسجّلة بعد.</p>' +
    '<p class="m-empty__d">الفرصة تُسجَّل هنا سواء جاءت من ردّ على حملة واتساب أو من مكالمة أو زيارة. ' +
    "النية المرتفعة التي يقرأها المساعد تفتح فرصةً تلقائيًا.</p></div>";
}
function opSkeleton(n) {
  var h = '<div aria-busy="true" aria-live="polite">';
  for (var i = 0; i < n; i++) h += '<div class="ox-skel"><i style="width:16px"></i><i style="width:70%"></i><i style="width:55%"></i><i style="width:60%"></i><i style="width:70%"></i><i style="width:45%"></i></div>';
  return h + "</div>";
}
/* One card per ACCOUNT. Everything on it is counted from that account's own lines — nothing is
   summed across accounts, and the total obeys the ONE money rule (a lost line is worth nothing). */
var opCardOpen = {};   /* accountKey -> true while its extra lines are unfolded */
window.opCardMore = function (k) { opCardOpen[k] = !opCardOpen[k]; opRender(); };
var OP_CARD_LINES = 3;

function opAccountGroups(rows) {
  var by = {}, order = [];
  rows.forEach(function (l) {
    var k = opKey(l);
    if (!by[k]) { by[k] = { key: k, name: l.account_name, phone: l.phone, owner: l.owner || "", lines: [] }; order.push(by[k]); }
    if (!by[k].owner && l.owner) by[k].owner = l.owner;
    by[k].lines.push(l);
  });
  order.forEach(function (g) {
    g.open = g.lines.filter(opIsOpen);
    g.won = g.lines.filter(opIsWon);
    g.lost = g.lines.filter(opIsLost);
    g.value = opSumLive(g.lines);
    g.stalled = g.open.some(opStalled);
    g.priced = g.open.some(opPriced) || g.won.some(opPriced);
  });
  /* Live money first: the card grid is read top-left to bottom-right, and the accounts worth the most
     open money are the ones a sales lead is looking for. Accounts with no open line sink. */
  order.sort(function (a, b) {
    if (!a.open.length !== !b.open.length) return a.open.length ? -1 : 1;
    if (b.value !== a.value) return b.value - a.value;
    return String(a.name).localeCompare(String(b.name), "ar");
  });
  return order;
}

function opCardsView() {
  /* «بانتظار الدعم» is read from the escalations table, the same source الرئيسية uses — so the two
     screens cannot disagree about which deals are blocked. */
  if (typeof hmEscLoad === "function") hmEscLoad(false);
  var esc2 = typeof hmOpenEscIds === "function" ? hmOpenEscIds() : {};
  var groups = opAccountGroups(opLines());
  var page = pageSlice("opps", groups);
  if (!page.length) return opEmpty();
  var h = '<div class="ox-cards">';
  page.forEach(function (g) {
    var openEsc = g.open.some(function (l) { return !!esc2[l.id]; });
    var shown = opCardOpen[g.key] ? g.lines : g.lines.slice(0, OP_CARD_LINES);
    var rest = g.lines.length - shown.length;
    h += '<article class="ox-card">' +
      '<div class="top"><span class="m-av m-av--sq" aria-hidden="true">' + esc(String(g.name || "؟").trim().charAt(0)) + "</span>" +
      '<span class="who"><b>' + esc(g.name) + "</b><span>" + opNProdN(g.lines.length) +
        (g.owner ? " · " + esc(g.owner) : " · " + opNil("بلا مسؤول", "unset")) + "</span></span>" +
      '<span class="tot">' + (g.priced ? "<b>" + opMoneyShort(g.value) + "</b>" : "<b>" + opUnpricedNil() + "</b>") +
      "<span>قيمة قائمة</span></span></div>";
    /* the health of THIS account, said once */
    h += '<div class="ox-cb">' +
      (g.open.length ? '<span class="m-chip m-chip--ac">قائمة</span>' : "") +
      (g.stalled ? '<span class="m-chip m-chip--warn">متوقّف</span>' : "") +
      (openEsc ? '<span class="m-chip m-chip--ac">دعم</span>' : "") +
      '<span class="split">' + ["قائمة " + opN(g.open.length), g.won.length ? "ربح " + opN(g.won.length) : "", g.lost.length ? "خسارة " + opN(g.lost.length) : ""]
        .filter(Boolean).join(" · ") + "</span></div>";
    h += '<div class="ox-cl">' + shown.map(function (l, i) {
      var st = opStage(l.stage);
      return '<button type="button" class="ox-cli' + (opCardOpen[g.key] && i >= OP_CARD_LINES ? " mor" : "") + '" id="oxc_' + l.id + '"' +
        ' onclick="opOpenLine(' + l.id + ',this.id)" aria-label="' + esc(l.product) + " — " + esc(st.label) + '">' +
        '<span class="pn">' + esc(l.product) + "</span>" +
        '<span class="m-chip ox-tone" style="' + opToneVars(l.stage) + '">' + esc(st.label) + "</span>" +
        '<span class="m-td-v">' + (opPriced(l) ? opMoneyShort(opValue(l)) : opUnpricedNil()) + "</span></button>";
    }).join("") +
      (rest > 0 ? '<button type="button" class="ox-cmore" onclick="opCardMore(&quot;' + esc(g.key) + '&quot;)">و' + opNLineN(rest) + " أخرى ↓</button>"
        : g.lines.length > OP_CARD_LINES ? '<button type="button" class="ox-cmore" onclick="opCardMore(&quot;' + esc(g.key) + '&quot;)">طيّ ↑</button>' : "") +
      "</div></article>";
  });
  return h + "</div>";
}

/* A REAL TABLE, inside m-tablewrap — the wrap is what scrolls, never the page (PORT-SPEC §2). The
   grid of divs this replaced could not carry m-td-n / m-td-v / m-th and had to restate every cell
   style; what it bought was the phone layout, which the stacking rules at the end of this module's
   stylesheet give back. */
function opListView() {
  var rows = opSorted();
  var page = pageSlice("opps", rows);
  var allOn = page.length > 0 && page.every(function (l) { return opSel[l.id]; });
  var h = '<div class="m-tablewrap"><table class="m-table ox-t"><thead><tr>' +
    '<th class="ox-sel" scope="col">' + (opMayEdit()
      ? '<input class="m-cb" type="checkbox" id="oxs_all" aria-label="تحديد الصفحة المعروضة"' + (allOn ? " checked" : "") + ' onclick="opTogglePage()">' : "") + "</th>" +
    '<th scope="col">الجهة</th><th scope="col">المنتج</th><th scope="col">المرحلة</th>' +
    '<th class="num" scope="col">القيمة</th><th scope="col">المصدر</th>' +
    '<th scope="col">المسؤول</th><th scope="col">الخطوة التالية</th>' +
    '<th class="ox-act" scope="col"><span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);">تفاصيل</span></th></tr></thead><tbody>';
  if (!page.length) h += '<tr class="m-table__empty"><td colspan="9">' + opEmpty() + "</td></tr>";
  page.forEach(function (l) { h += opRowHtml(l); });
  h += "</tbody></table></div>";
  if (rows.length) {
    var live = opSumLive(rows);
    var unp = rows.filter(function (l) { return !opPriced(l); }).length;
    var unit = rows.length >= 3 && rows.length <= 10 ? "بنود" : rows.length >= 11 ? "بندًا" : "بند";
    h += '<div class="ox-foot">' + pageBar("opps", rows.length, unit) +
      '<span class="tot">' + (live ? "قيمة المطابِق <b>" + opMoney(live) + "</b>" + (opHasLost(rows) ? " · دون الخسارة" : "") : opNil("لا قيمة مسعَّرة في المطابِق", "none")) +
      (unp ? "، " + opNLineN(unp) + " بلا تسعير" : "") + "</span></div>";
  }
  return h;
}

/* ================================ KANBAN ================================ */
function opKanbanView() {
  var rows = opLines();
  var h = '<div class="m-board" role="list" aria-label="لوحة المراحل">';
  var withLines = {};
  (oppRows || []).forEach(function (o) { withLines[o.stage] = 1; });
  /* A stage the ladder does not carry AT ALL — a custom rung whose config read failed — still has
     deals on it. Give it a column built from opStage(), or those cards render nowhere: not in a
     column, not in a count, just gone. */
  var cols = OPP_ST.filter(function (st) { return st.active !== false || withLines[st.key]; });
  Object.keys(withLines).forEach(function (k) {
    if (!cols.some(function (st) { return st.key === k; })) cols.push(opStage(k));
  });
  cols.forEach(function (st) {
    /* The same ordering the list uses, applied inside each column, so switching views never reorders
       what the reader already scanned. */
    var inStage = {}; rows.forEach(function (l) { if (l.stage === st.key) inStage[l.id] = 1; });
    var cards = opSorted().filter(function (l) { return inStage[l.id]; });
    var val = cards.reduce(function (a, l) { return a + opValue(l); }, 0);
    var unp = cards.filter(function (l) { return !opPriced(l); }).length;
    var cap = opKCap[st.key] || OPP_KCAP;
    h += '<div class="m-col" role="listitem" style="' + opToneVars(st.key) + ";--m-tone:" + opColor(st.key) + '" data-col="' + esc(st.key) + '"' +
      (opMayEdit() ? ' ondragover="opDragOver(event,this)" ondragleave="opDragLeave(this)" ondrop="opDrop(event,&quot;' + st.key + '&quot;,this)"' : "") + ">";
    h += '<div class="m-col__t"><i class="m-col__dot"></i><span class="m-col__n">' + esc(st.label) + "</span>" +
      '<span class="m-col__c ox-tone">' + opN(cards.length) + "</span></div>" +
      '<div class="m-col__v">' + (val ? opMoneyShort(val) + (unp ? "، " + opNLineN(unp) + " بلا تسعير" : "")
        : unp ? opNLineN(unp) + " بلا تسعير" : opNil("بلا قيمة مسعَّرة", "none")) + "</div>";
    h += '<div class="m-col__b">';
    cards.slice(0, cap).forEach(function (l) {
      /* Dragging a card IS a stage change, so a read-only role gets a card that opens and does not move. */
      h += '<div class="m-deal' + (opOpen === l.id && !opSheet ? " is-open" : "") + '" id="oxk_' + l.id + '" tabindex="0" role="button" draggable="' + (opMayEdit() ? "true" : "false") + '"' +
        ' aria-label="' + esc(l.account_name) + " — " + esc(l.product) + '"' +
        (opMayEdit() ? ' ondragstart="opDragStart(event,' + l.id + ')" ondragend="opDragEnd()"' : "") +
        ' onclick="opOpenLine(' + l.id + ',this.id)" onkeydown="opCardKey(event,' + l.id + ',this.id)">' +
        '<span class="m-deal__n">' + esc(l.account_name) +
        (l.created_by === "المساعد" ? '<span class="m-chip m-chip--ac">تلقائي</span>' : "") + "</span>" +
        '<span class="m-deal__p">' + esc(l.product) + "</span>" +
        '<span class="m-deal__f"><span class="' + (opPriced(l) ? "m-deal__v" : "m-deal__v--nil") + '">' +
        (opPriced(l) ? opMoney(opValue(l)) : opUnpricedNil()) + "</span>" +
        '<span class="m-deal__o">' + opIco(l.source in OPP_ICO ? l.source : "other") + " " +
        (String(l.owner || "").trim() ? esc(l.owner) : opNil("بلا مسؤول", "unset")) + "</span></span>" +
        (opStalled(l) ? '<span class="m-deal__age m-deal__age--old">متوقفة منذ ' + opNDayN(opDays(l)) + "</span>" : "") + "</div>";
    });
    if (!cards.length) h += '<div class="m-empty-col">' + opNil("لا بنود في هذه المرحلة", "none") + "</div>";
    if (cards.length > cap) {
      h += '<button class="ox-kmore" onclick="opKMore(&quot;' + st.key + '&quot;)">تُعرض ' + opN(cap) + " من " + opN(cards.length) + " — عرض " + opN(Math.min(OPP_KCAP, cards.length - cap)) + " أخرى</button>";
    }
    h += "</div></div>";
  });
  return h + "</div>";
}

/* ================================ DRAWER ================================ */
function opValidate(key, v) {
  var s = String(v == null ? "" : v).trim();
  if (key === "sale_price") { if (s === "") return ""; var p = Number(s); return isFinite(p) && p >= 0 ? "" : "أدخل سعرًا صفرًا أو أكبر."; }
  if (key === "years") { var y = Number(s); return s !== "" && Math.floor(y) === y && y >= 1 && y <= 20 ? "" : "السنوات عدد صحيح من 1 إلى 20."; }
  if (key === "qty") { var q = Number(s); return s !== "" && Math.floor(q) === q && q >= 1 ? "" : "الكمية عدد صحيح من 1 فأكثر."; }
  if (key === "discount") { if (s === "") return ""; var d = Number(s); return isFinite(d) && d >= 0 && d <= 100 ? "" : "الخصم بين 0 و100."; }
  if (key === "owner") return s.length <= 60 ? "" : "اسم المسؤول أطول من 60 حرفًا.";
  if (key === "next_step") return s.length <= 300 ? "" : "الخطوة أطول من 300 حرف.";
  return "";
}
function opFieldStatus(sk, id) {
  var st = opFState[sk];
  if (!st) return '<span class="ox-fs" id="' + id + '_s" aria-live="polite"></span>';
  if (st.s === "pending") return '<span class="ox-fs pend" id="' + id + '_s" aria-live="polite">جارٍ الحفظ…</span>';
  if (st.s === "saved") return '<span class="ox-fs ok" id="' + id + '_s" aria-live="polite">' + opIco("check") + "حُفظ</span>";
  if (st.s === "invalid") return '<span class="ox-fs bad" id="' + id + '_s" aria-live="assertive">' + opIco("warn") + esc(st.m) + "</span>";
  var p = sk.split(":");
  return '<span class="ox-fs bad" id="' + id + '_s" aria-live="assertive">' + opIco("warn") + "تعذّر الحفظ" +
    '<button onclick="opRetryField(' + p[0] + ',&quot;' + p[1] + '&quot;)">أعد المحاولة</button>' +
    '<button onclick="opDiscardField(' + p[0] + ',&quot;' + p[1] + '&quot;)">تجاهل</button></span>';
}
/* Which stored fields on a line are quantities, so a read-only render can put them through .m-n. */
function opIsNumField(key) { return key === "sale_price" || key === "years" || key === "qty" || key === "discount"; }
function opField(l, key, label, type) {
  var id = "oxd_" + key + "_" + l.id, sk = l.id + ":" + key, st = opFState[sk];
  var cur = l[key] == null ? "" : l[key];
  if (key === "sale_price" && Number(cur) === 0) cur = "";
  /* Read-only role: the same fact, printed. An input the reader can type into and never save is a
     promise the screen cannot keep. */
  if (!opMayEdit()) {
    /* A role that may only read gets the same fact, printed — and a value nobody has entered says
       so as an absence, never as a dash. */
    return '<div class="m-field"><div class="ox-lr"><span class="m-label">' + label + "</span></div>" +
      '<div class="ox-ro">' + (String(cur) === "" ? opNil("لم يُحدَّد", "unset") :
        (opIsNumField(key) ? opN(Number(cur)) : esc(String(cur)))) + "</div></div>";
  }
  var val = st && st.s !== "saved" ? st.v : cur;
  var num = type === "number";
  var rng = key === "years" ? ' min="1" max="20" step="1"' : key === "discount" ? ' min="0" max="100"' : key === "qty" ? ' min="1" step="1"' : key === "sale_price" ? ' min="0"' : "";
  return '<div class="m-field"><div class="ox-lr"><label class="m-label" for="' + id + '">' + label + "</label>" + opFieldStatus(sk, id) + "</div>" +
    '<input class="m-input' + (num ? " num" : "") + '" id="' + id + '" type="' + (num ? "number" : "text") + '"' + rng +
    (num ? ' inputmode="decimal"' : "") +
    (key === "sale_price" ? ' placeholder="بلا سعر"' : key === "owner" ? ' placeholder="بلا مسؤول" list="oxowners2"' : key === "next_step" ? ' placeholder="ما الذي يجب فعله بعد؟"' : "") +
    ' value="' + esc(val) + '"' + (st && (st.s === "invalid" || st.s === "failed") ? ' aria-invalid="true"' : "") +
    ' aria-describedby="' + id + '_s" onchange="opSaveField(' + l.id + ',&quot;' + key + '&quot;,this.value)"></div>';
}
/* ===== التصعيد وطلب الدعم =====
   Recorded, never sent: no mail sender is configured (founder, 2026-09-13), so the row says
   «مسجّل — لم يُرسل بريد بعد» rather than claiming an email left the building. Recipients come from
   the team directory in «إعدادات النظام»; the role rule (support → الدعم الفني / الإدارة,
   escalation → الإدارة / مبيعات) is config-domain's, which the server enforces on the same write. */
var opEsc = null;          /* { oppId, kind, memberId, reason, err, field, busy } */
var opEscRows = {};        /* oppId -> rows */
var opEscLoading = {};
var opEscFailed = {};      /* a failed read STAYS failed until asked again */
/* A failure that is only swallowed is a failure that repeats: the drawer re-renders, finds no rows,
   and fires the same request again, forever. The failed state is remembered and shown with a retry,
   the same contract the ledger and the products list hold. */
function opEscLoad(oppId, force) {
  if (opEscLoading[oppId]) return;
  if (opEscRows[oppId] && !force) return;
  if (opEscFailed[oppId] && !force) return;
  opEscLoading[oppId] = true;
  fetch("/admin/escalations?opp=" + oppId, { headers: { "x-admin-token": TOKEN } })
    .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(function (j) { opEscRows[oppId] = (j && j.escalations) || []; opEscFailed[oppId] = false; })
    .catch(function () { opEscFailed[oppId] = true; })
    .then(function () { opEscLoading[oppId] = false; opRender(); });
}
function opEscCandidates(kind) {
  var roles = (typeof ESCALATION_ROLES !== "undefined" && ESCALATION_ROLES[kind]) || [];
  return (typeof cfTeam !== "undefined" ? cfTeam : []).filter(function (m) {
    return m.active && roles.indexOf(m.role) >= 0;
  });
}
function opEscSection(l) {
  if (typeof cfLoad === "function") cfLoad(false);
  opEscLoad(l.id, false);
  var rows = opEscRows[l.id] || [];
  var open = rows.filter(function (r) { return !r.resolvedAt; });
  var failed = !!opEscFailed[l.id] && !opEscRows[l.id];
  var b = '<section class="ox-sec" aria-labelledby="oxsec_e"><div class="ox-sech" id="oxsec_e">التصعيد والدعم' +
    (open.length ? '<span class="ox-cnt">' + dsFig("owEsc", open.length) + " مفتوح</span>" : "") + "</div>";
  if (!opMayEdit()) {
    /* Recording an escalation writes to the opportunity, so a read-only role reads the log and adds
       nothing to it. */
    b += rows.length ? "" : '<div class="ox-hint2">' + opNil("لا تصعيد مسجّل على هذه الفرصة", "none") + "</div>";
  } else if (!opEsc || opEsc.oppId !== l.id) {
    b += '<div class="ox-escacts">' +
      '<button class="m-btn" data-op="escalate" data-i="' + l.id + '">' + opIco("up") + "تصعيد</button>" +
      '<button class="m-btn" data-op="support" data-i="' + l.id + '">' + opIco("help") + "طلب دعم</button>" +
      '<span class="ox-hint2">يُسجَّل على الفرصة باسم من اخترته — لا بريد بعد، ولا يُرسل شيء للعميل.</span></div>';
  } else {
    var cands = opEscCandidates(opEsc.kind);
    b += '<div class="ox-escform">';
    b += '<div class="m-field"><label class="m-label" for="opesc_to">' + (opEsc.kind === "support" ? "إلى مسؤول الدعم" : "تصعيد إلى") + "</label>";
    if (!cands.length) {
      b += '<div class="ox-hint2">لا أحد مسجّل لهذا الدور — أضِفه في <a class="m-link" href="#team">إعدادات النظام · الفريق</a>.</div>';
    } else {
      b += '<select class="m-select" id="opesc_to" data-opesc="memberId"><option value="">اختر الشخص…</option>' +
        cands.map(function (m) {
          return '<option value="' + m.id + '"' + (String(opEsc.memberId) === String(m.id) ? " selected" : "") + ">" +
            esc(m.name) + " · " + esc(TEAM_ROLE_LABELS[m.role] || m.role) + (m.division ? " · " + esc(m.division) : "") + "</option>";
        }).join("") + "</select>";
    }
    b += "</div>";
    b += '<div class="m-field"><label class="m-label" for="opesc_why">' + (opEsc.kind === "support" ? "ما الذي تحتاجه؟" : "سبب التصعيد") + "</label>" +
      '<input class="m-input" id="opesc_why" maxlength="300" value="' + esc(opEsc.reason || "") + '" data-opesc="reason" placeholder="' +
      (opEsc.kind === "support" ? "مثال: العميل يسأل عن تكامل HIS ويحتاج مهندسًا" : "مثال: العميل ينتظر قرار تسعير منذ أسبوع") + '"></div>';
    b += '<div class="ox-escbtns"><button class="m-btn m-btn--primary" data-op="escsave"' + (opEsc.busy ? ' disabled aria-busy="true"' : "") + ">" +
      (opEsc.busy ? "جارٍ التسجيل…" : opEsc.kind === "support" ? "سجّل طلب الدعم" : "سجّل التصعيد") + "</button>" +
      '<button class="m-btn" data-op="esccancel">إلغاء</button>' +
      (opEsc.err ? '<span class="ox-derr" role="alert">' + opIco("warn") + esc(opEsc.err) + "</span>" : "") + "</div></div>";
  }
  if (failed) {
    b += '<div class="ox-hint2" role="alert">' + opIco("warn") + "تعذّر تحميل سجل التصعيد — لم يُعرض شيء لأن الطلب فشل." +
      '<button class="m-btn" data-op="escretry" data-i="' + l.id + '">أعد المحاولة</button></div>';
  }
  if (rows.length) {
    b += '<div class="ox-esclist">' + rows.map(function (r) {
      return '<div class="ox-escr' + (r.resolvedAt ? " done" : "") + '"><span class="k">' + esc(ESCALATION_LABELS[r.kind] || r.kind) + "</span>" +
        '<span class="t"><b>' + esc(r.toName) + "</b> · <bdi>" + esc(r.toEmail) + '</bdi><span class="why">' + esc(r.reason) + "</span></span>" +
        '<span class="m">' + (r.createdAt ? fmtD(r.createdAt) : "") + (r.createdBy ? " · " + esc(r.createdBy) : "") +
        '<span class="dl">' + esc((typeof DELIVERY_LABELS !== "undefined" && DELIVERY_LABELS[r.delivery]) || r.delivery) + "</span></span>" +
        (r.resolvedAt ? '<span class="ok">' + opIco("check") + "أُغلق</span>"
          : opMayEdit() ? '<button class="m-btn" data-op="escdone" data-i="' + r.id + '" data-o="' + r.oppId + '">تم</button>'
          : '<span class="m-chip m-chip--warn">مفتوح</span>') + "</div>";
    }).join("") + "</div>";
  }
  return b + "</section>";
}
function opEscOpen(oppId, kind) {
  opEsc = { oppId: oppId, kind: kind, memberId: "", reason: "", err: "", field: "", busy: false };
  if (typeof cfLoad === "function") cfLoad(false);
  opRender();
  setTimeout(function () { var f = document.getElementById("opesc_to") || document.getElementById("opesc_why"); if (f) f.focus(); }, 0);
}
function opEscSave() {
  var e = opEsc; if (!e || e.busy) return;
  var member = (typeof cfTeam !== "undefined" ? cfTeam : []).filter(function (m) { return String(m.id) === String(e.memberId); })[0] || null;
  var checked = checkEscalation({ kind: e.kind, memberId: Number(e.memberId), reason: e.reason }, member);
  if (!checked.ok) { e.err = checked.reason; e.field = checked.field; opRender(); return; }
  e.busy = true; e.err = ""; opRender();
  fetch("/admin/opps/" + e.oppId + "/escalate", {
    method: "POST", headers: { "x-admin-token": TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({ kind: checked.value.kind, memberId: checked.value.memberId, reason: checked.value.reason }),
  }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); })
    .then(function (r) {
      e.busy = false;
      if (!r.ok) { e.err = r.j.detail || "تعذّر التسجيل (" + fmtN(r.status) + ")"; e.field = r.j.field || ""; opRender(); return; }
      var oppId = e.oppId; opEsc = null;
      opEscLoad(oppId, true);
      opToast((checked.value.kind === "support" ? "سُجّل طلب الدعم إلى " : "سُجّل التصعيد إلى ") + member.name + " — لم يُرسل بريد بعد", false);
    }).catch(function () { e.busy = false; e.err = "تعذّر الاتصال — لم يُسجَّل شيء."; opRender(); });
}
function opEscResolve(id, oppId) {
  fetch("/admin/escalations/" + id + "/resolve", { method: "POST", headers: { "x-admin-token": TOKEN } })
    .then(function (r) { if (!r.ok) throw new Error("http"); opEscLoad(oppId, true); opToast("أُغلق البند", false); })
    .catch(function () { opToast("تعذّر الإغلاق", true); });
}

/* The record's tabs. A deal's drawer used to be one column eight sections long: the stage ladder,
   its results, the money, the follow-up, the activities, the quotes, the escalations and the account's
   other lines. Scrolling past six of them to record a call is the cost of a screen that never decided
   what it is FOR. Four panels now, and the tab carries its own count so nobody opens an empty one. */
var opTab = "deal";
window.opSetTab = function (t) { if (opTab === t) return; opTab = t; opDrScroll = 0; opRender(); };
/* The vocabulary's own tab rail (PORT-SPEC §2): .m-tabs / .m-tab with aria-selected, the selected
   tab drawn by its border rather than by a strip measured after paint — so the private .ox-dtabs and
   its sliding indicator are gone, and with them the moveInd call in opAfterRender.
   Each count is printed HERE and again on its section heading, so both sites carry the same bound
   derivation (PORT-SPEC §6: owActs / owQuotes / owEsc, registered at the top of this module). */
function opTabStrip(counts) {
  var tabs = [["deal", "الفرصة", null, ""], ["acts", "الأنشطة", counts.acts, "owActs"],
    ["quotes", "عروض الأسعار", counts.quotes, "owQuotes"], ["esc", "التصعيد والدعم", counts.esc, "owEsc"]];
  return '<div class="m-tabs" role="tablist" aria-label="أقسام الفرصة">' + tabs.map(function (t) {
    return '<button type="button" class="m-tab" role="tab" id="oxdt_' + t[0] + '" aria-selected="' + (opTab === t[0]) + '"' +
      ' onclick="opSetTab(&quot;' + t[0] + '&quot;)">' + t[1] +
      (t[2] ? "<b>" + dsFig(t[3], t[2]) + "</b>" : "") + "</button>";
  }).join("") + "</div>";
}

/* The FRAME stays local — the vocabulary's dialog is centred and this one is a side sheet — but
   everything inside it is the vocabulary's: m-dlg__h / __b / __f and m-x for the close control.
   lead is the band between the header and the tabs (the deal's leading figure); it is its own slot
   because its padding is the drawer's, not the header row's. */
function opDrawerShell(labelId, head, body, foot, tabs, lead) {
  var cls = opDrShown ? " in" : "";
  return '<div class="ox-scrim' + cls + '" onclick="opCloseDrawer()"></div>' +
    /* Plain divs, not aside/header/footer: the shell styles those ELEMENTS (the rail is an aside that
       becomes a centred top bar on a phone), and the drawer inherited it — its header rendered 216px
       wide inside a 390px drawer. */
    '<div class="ox-dr' + cls + '" role="dialog" aria-modal="true" aria-labelledby="' + labelId + '">' +
    '<div class="m-dlg__h">' + head + '<button class="m-x" id="oxclose" aria-label="إغلاق" onclick="opCloseDrawer()">' + opIco("x") + "</button></div>" +
    (lead || "") + (tabs || "") +
    '<div class="m-dlg__b" id="oxdb" onscroll="opDrScroll=this.scrollTop">' + body + "</div>" +
    '<div class="m-dlg__f">' + foot + "</div></div>";
}
/* The STAGE STEPPER. Every open rung by name, top to bottom: passed rungs carry their tone and a
   check, the current one sits on a tinted pill with its age and its exit criterion, later rungs are
   quiet. Each rung is a real button — the 6px bars it replaces were aria-hidden and named their
   stage only in a tooltip, so the ladder could not be read without hovering every bar. A paused rung
   stays visible and is disabled, the same rule isStageSelectable applies to the write. */
var opStepPrev = null, opStepAnim = null, opStepFocus = "";
/* A stepper click remembers WHICH rung was pressed, so every repaint the save causes (pending, saved,
   failed) can put focus back on that rung's button instead of dropping it. */
window.opStepTo = function (id, key) {
  var el = document.activeElement;
  opStepFocus = el && el.classList && el.classList.contains("ox-stb") ? "oxst_" + id + "_" + key : "";
  return window.opSetStage(id, key);
};
function opStepper(l, open, idx) {
  var states = stageSteps(open.map(function (s) { return s.key; }), l.stage);
  var selectable = {};
  opSelectableStages(l.stage).forEach(function (s) { selectable[s.key] = 1; });
  var h = '<ol class="ox-steps' + (opIsLost(l) ? " is-lost" : "") + '" aria-label="مراحل البيع">';
  if (idx !== -1) h += '<li class="ox-steps-pill" aria-hidden="true" style="' + opToneVars(l.stage) + '"></li>';
  open.forEach(function (s, i) {
    var state = states[i], isCur = state === "current";
    var paused = !selectable[s.key] && !isCur;
    var can = !isCur && !paused && !oppBusy && opMayEdit();
    var said = state === "done" ? "مرحلة مكتملة" : isCur ? "المرحلة الحالية" : "مرحلة قادمة";
    h += '<li class="ox-step ' + state + (paused ? " paused" : "") + '" style="' + opToneVars(s.key) + '"' + (isCur ? ' aria-current="step"' : "") + ">";
    h += '<button type="button" class="ox-stb" id="oxst_' + l.id + "_" + esc(s.key) + '"' +
      /* aria-disabled, not disabled: a disabled button cannot hold focus, and the rung a keyboard user
         just chose BECOMES the current (inert) rung on the next paint — focus would fall to <body>. */
      (can ? ' onclick="opStepTo(' + l.id + ',&quot;' + s.key + '&quot;)"' : ' aria-disabled="true"') +
      ' aria-label="' + esc(s.label) + "، " + said + (paused ? "، موقوفة" : can ? "، نقل إليها" : "") + '">' +
      '<span class="k" aria-hidden="true">' + (state === "done" ? opIco("check") : opN(i + 1)) + "</span>" +
      '<span class="tx"><span class="l">' + esc(s.label) + "</span>" +
      (isCur ? '<span class="m-meta">' + opAgoN(l) + "</span>" : paused ? '<span class="m-meta">موقوفة</span>' : "") + "</span>" +
      (can ? '<span class="go" aria-hidden="true">نقل</span>' : "") + "</button>";
    if (isCur && s.exitCriterion) {
      h += '<div class="ox-exit"><span class="m-label">شرط الانتقال للمرحلة التالية</span><span>' + esc(s.exitCriterion) + "</span></div>";
    }
    h += "</li>";
  });
  return h + "</ol>";
}
/* The pill slides from the rung it sat on to the new one and takes the new rung's tone on the way:
   the move is the confirmation that the stage changed. On-screen movement, so ease-in-out, 240ms,
   transform only for position; reduced motion gets the new place with no travel. */
function opPlaceStepPill() {
  var steps = document.querySelector(".ox-steps");
  var pill = steps && steps.querySelector(".ox-steps-pill");
  var cur = steps && steps.querySelector(".ox-step.current");
  if (!pill || !cur) { opStepPrev = null; return; }
  var top = cur.offsetTop, hgt = cur.offsetHeight;
  pill.style.transform = "translateY(" + top + "px)";
  pill.style.height = hgt + "px";
  var bg = getComputedStyle(pill).backgroundColor, bar = getComputedStyle(pill).borderInlineStartColor;
  var prev = opStepPrev;
  opStepPrev = { id: opOpen, top: top, h: hgt, bg: bg, bar: bar };
  if (!pill.animate || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
  var now = performance.now();
  /* A save repaints the drawer within milliseconds of the click (pending, then saved), and innerHTML
     replaces the pill that was sliding. The slide is therefore remembered and RESUMED on the new pill
     at its elapsed time, or the move would be cut to a jump by its own confirmation. */
  var run = opStepAnim && opStepAnim.id === opOpen && opStepAnim.to === top && now - opStepAnim.start < 240 ? opStepAnim : null;
  if (!run) {
    if (!prev || prev.id !== opOpen || prev.top === top) return;
    run = opStepAnim = { id: opOpen, to: top, start: now, frames: [
      { transform: "translateY(" + prev.top + "px)", height: prev.h + "px", backgroundColor: prev.bg, borderInlineStartColor: prev.bar },
      { transform: "translateY(" + top + "px)", height: hgt + "px", backgroundColor: bg, borderInlineStartColor: bar },
    ] };
  }
  var a = pill.animate(run.frames, { duration: 240, easing: "cubic-bezier(0.77, 0, 0.175, 1)" });
  a.currentTime = now - run.start;
}
function opDetailDrawer(l) {
  var st = opStage(l.stage);
  var open = opOpenStages();
  var idx = -1; open.forEach(function (s, i) { if (s.key === l.stage) idx = i; });
  var head = '<div class="ox-hd"><span class="m-av m-av--sq" aria-hidden="true">' + esc(String(l.account_name || "؟").trim().charAt(0)) + "</span>" +
    '<div class="tt"><h2 class="m-dlg__t" id="oxdrt" tabindex="-1">' + esc(l.account_name) + "</h2>" +
    '<div class="m-meta">' + esc(l.product) +
    (l.created_by === "المساعد" ? ' <span class="m-chip m-chip--ac">تلقائي</span>' : "") + "</div></div></div>";
  /* The three facts a reader opens this drawer for, before any scrolling: what it is worth, where it
     stands, and whether it is late. An unpriced line is a number someone OWES, drawn as that
     absence rather than as grey prose (PORT-SPEC §4). */
  var lead = '<div class="ox-hval">' +
    '<span class="fig">' + (opPriced(l) ? opMoney(opValue(l)) : opUnpricedNil()) + "</span>" +
    '<span class="sub">' + (opIsOpen(l) ? opAgoN(l) : opIsWon(l) ? "أُغلقت ربحًا" : "أُغلقت خسارة") + "</span>" +
    (opStalled(l) ? '<span class="m-chip m-chip--warn">متأخرة</span>' : "") +
    '<span class="m-chip ox-tone" style="' + opToneVars(l.stage) + '">' + esc(st.label) + "</span></div>";
  var b = "";
  /* المرحلة */
  var ssk = l.id + ":stage";
  b += '<section class="ox-sec" aria-labelledby="oxsec_st"><div class="ox-lr"><div class="ox-sech" id="oxsec_st">المرحلة</div>' + opFieldStatus(ssk, "oxd_stage_" + l.id) + "</div>";
  b += opStepper(l, open, idx);
  if (opIsOpen(l)) {
    b += '<div class="ox-strow">' +
      (opStalled(l) ? '<span class="m-chip m-chip--warn">متوقفة — تجاوزت ' + opNDayN(opStageSla(l) === null ? OPP_STALL_DAYS : opStageSla(l)) + "</span>" : "") +
      '<span class="sp"></span>' +
      (opMayEdit()
        ? '<button class="m-btn" onclick="opSetStage(' + l.id + ',&quot;' + opWonKey() + '&quot;)">' + opIco("check") + "أُغلقت ربحًا</button>" +
          '<button class="m-btn" id="oxlost_' + l.id + '" onclick="opSetStage(' + l.id + ',&quot;' + opLostKey() + '&quot;)">أُغلقت خسارة</button>'
        : "") + "</div>";
  } else {
    b += '<div class="ox-strow"><span class="m-chip ' + (opIsWon(l) ? "m-chip--ok" : "m-chip--bad") + '">' +
      (opIsWon(l) ? "أُغلقت ربحًا" : "أُغلقت خسارة") + "</span>" +
      '<span class="m-meta">' + opAgoN(l) + '</span><span class="sp"></span>' +
      (opMayEdit() ? '<button class="m-btn" onclick="opSetStage(' + l.id + ',&quot;' + open[open.length - 1].key + '&quot;)">إعادة فتح</button>' : "") + "</div>";
    if (typeof owLostBlock === "function") b += owLostBlock(l);
  }
  b += "</section>";
  /* القيمة */
  var disc = Number(l.discount || 0);
  b += '<section class="ox-sec" aria-labelledby="oxsec_v"><div class="ox-sech" id="oxsec_v">القيمة</div>';
  /* The figure itself now leads the drawer (ox-hval), so this section carries only HOW it is
     reached — printing the same number twice on one screen is how a reader starts checking whether
     the two agree. */
  /* Every figure in the formula rides inside .m-n, the percent sign INSIDE its own span — outside it
     the bidi algorithm lands «٪» to the left of its digits (PORT-SPEC §3). The <bdi> the line used to
     carry is what .m-n already does. */
  b += opPriced(l)
    ? '<div class="ox-form">' + opNU(Number(l.sale_price), "ر.س") + " سنويًا × " + opNYearN(Number(l.years || 1)) + " × " + opN(Number(l.qty || 1)) +
      (disc ? " × (1 − " + mPct(disc) + ")" : "") + " = " + opMoney(opValue(l)) + "</div>"
    : '<div class="ox-form">أدخل السعر السنوي ليُحسب البند ويدخل في المجاميع.</div>';
  b += '<div class="m-form">' + opField(l, "sale_price", "السعر السنوي (ر.س)", "number") + opField(l, "years", "السنوات", "number") +
    opField(l, "qty", "الكمية", "number") + opField(l, "discount", "الخصم ٪", "number") + "</div>";
  if (disc > 50) b += '<div class="ox-hint">' + opIco("warn") + "خصم مرتفع: " + mPct(disc) + " من السعر السنوي. تأكّد أنه مقصود.</div>";
  b += "</section>";
  /* المتابعة */
  b += '<section class="ox-sec" aria-labelledby="oxsec_f"><div class="ox-sech" id="oxsec_f">المتابعة</div>' +
    opField(l, "next_step", "الخطوة التالية", "text") + opField(l, "owner", "المسؤول", "text") +
    '<datalist id="oxowners2">' + opOwners().map(function (o) { return '<option value="' + esc(o) + '"></option>'; }).join("") + "</datalist></section>";
  /* التفاصيل */
  var srcDD = esc(opSrcLabel(l.source));
  if (l.source === "whatsapp") srcDD = opIco("whatsapp") + " " + srcDD;
  /* One fact per row. Joined with «·», the conversation link wrapped to its own line and left a
     dangling separator at the end of the campaign name. */
  b += '<section class="ox-sec" aria-labelledby="oxsec_d"><div class="ox-sech" id="oxsec_d">التفاصيل</div><dl class="ox-dl">' +
    "<dt>المصدر</dt><dd>" + srcDD + "</dd>" +
    (l.source === "whatsapp" && l.source_ref ? "<dt>الحملة</dt><dd>" + esc(opCampName(l.source_ref)) + "</dd>" : "") +
    (l.source === "partner" && l.source_ref ? "<dt>الشريك</dt><dd>" + esc(l.source_ref) + "</dd>" : "") +
    (l.source === "whatsapp" && l.phone ? '<dt>المحادثة</dt><dd><a class="m-link" href="#customer/' + esc(l.phone) + '">فتح المحادثة ←</a></dd>' : "") +
    (l.phone ? '<dt>الجوال</dt><dd><bdi dir="ltr">+' + esc(l.phone) + "</bdi></dd>" : "") +
    /* Three absences, and they are not one state repeated: nobody recorded WHO entered the line, and
       nobody stamped it — both are classifications nobody made, never a bare dash (PORT-SPEC §4). */
    "<dt>سجّلها</dt><dd>" + (l.created_by ? esc(l.created_by) : opNil("لم يُسجَّل مُدخِلها", "unset")) + "</dd>" +
    "<dt>أُنشئت</dt><dd>" + (l.created_at ? fmtD(l.created_at) : opNil("لم يُسجَّل تاريخ الإنشاء", "unset")) + "</dd>" +
    "<dt>آخر تحديث</dt><dd>" + (l.updated_at ? fmtD(l.updated_at) : opNil("لم يُسجَّل تحديث بعد", "none")) + "</dd></dl></section>";
  /* «نتائج المراحل» closes the deal panel: what each rung came to is the story of the line, and the
     work done inside it lives in its own tab. */
  if (typeof owJourneySection === "function") b += owJourneySection(l);
  /* بنود أخرى لهذه الجهة */
  var key = opKey(l);
  var rel = (oppRows || []).filter(function (o) { return o.id !== l.id && opKey(o) === key; });
  if (rel.length) {
    b += '<section class="ox-sec" aria-labelledby="oxsec_r"><div class="ox-sech" id="oxsec_r">بنود أخرى لهذه الجهة · ' +
      opNLineN(rel.length) + '</div><div class="ox-rel">' +
      rel.map(function (o) {
        return '<button class="ox-relr" onclick="opSwitchLine(' + o.id + ')"><span class="p">' + esc(o.product) + "</span>" +
          '<span class="s">' + opDot(o.stage) + esc(opStage(o.stage).label) + "</span>" +
          '<span class="v">' + (opPriced(o) ? opMoney(opValue(o)) : opUnpricedNil()) + "</span></button>";
      }).join("") + "</div></section>";
  }
  /* The tabs. The deal panel is everything built above; the other three are their own sections, each
     already responsible for its own loading and failure states. */
  var w0 = (typeof owWork !== "undefined" && owWork[l.id] && owWork[l.id].data) || null;
  var escRows = (typeof opEscRows !== "undefined" && opEscRows[l.id]) || [];
  var counts = {
    acts: w0 ? (w0.activities || []).length : 0,
    quotes: w0 ? (w0.quotes || []).length : 0,
    esc: escRows.filter(function (r) { return !r.resolvedAt; }).length
  };
  if (opTab === "acts") b = typeof owActivitiesSection === "function" ? owActivitiesSection(l) : "";
  else if (opTab === "quotes") b = typeof owQuotesSection === "function" ? owQuotesSection(l) : "";
  else if (opTab === "esc") b = opEscSection(l);
  else {
    /* The deal panel keeps the counts honest even when its own tab is open: both reads are cheap and
       already de-duplicated by their loaders. */
    if (typeof owLoad === "function") owLoad(l.id, false);
    opEscLoad(l.id, false);
  }
  var foot = (opDelErr ? '<span class="ox-derr" role="alert">' + opIco("warn") + esc(opDelErr) + "</span>" : "") +
    (l.phone ? '<a class="m-btn" href="#customer/' + esc(l.phone) + '">ملف العميل ←</a>' : "") +
    '<span class="sp"></span>' +
    (opMayEdit()
      ? '<button class="rv-hold" data-do="opDel" data-arg="' + l.id + '" data-idle="حذف البند" data-holding="استمر بالضغط للحذف…" data-armed="اضغط مرة أخرى للحذف"' +
        ' aria-pressed="false" title="اضغط مع الاستمرار للحذف"><span class="rv-fill"></span><span class="rv-lbl">حذف البند</span></button>'
      : "");
  return opDrawerShell("oxdrt", head, b, foot, opTabStrip(counts), lead);
}

function opCreateDrawer() {
  var d = opSheet;
  // Archived products are not offered for new work; the server refuses them too (400), but a picker
  // that offers what the save will reject is a dead control.
  var reg = tagList().filter(function (t) { return !t.archived; });
  var head = '<div class="ox-hd"><div class="tt"><h2 class="m-dlg__t" id="oxdrt" tabindex="-1">إضافة فرصة</h2>' +
    '<div class="m-meta">جهة واحدة، ومنتج أو أكثر — ومن أين جاءت</div></div></div>';
  var errOf = function (f) { return opErrFld === f ? ' aria-invalid="true"' : ""; };
  var b = '<section class="ox-sec"><div class="ox-sech">الجهة</div>';
  b += '<div class="m-field"><label class="m-label m-req" for="opd_name">اسم الجهة</label>' +
    '<input class="m-input" id="opd_name" list="opaccts" value="' + esc(d.name) + '" placeholder="مثال: مجمع الرعاية الطبي" aria-required="true"' + errOf("name") +
    ' oninput="opDraft(&quot;name&quot;,this.value)"></div>';
  var accts = entities.slice(0, 400);
  b += '<datalist id="opaccts">' + accts.map(function (e) { return '<option value="' + esc(e.name) + '"></option>'; }).join("") + "</datalist>";
  b += '<div class="m-form"><div class="m-field"><label class="m-label" for="opd_phone">الجوال (اختياري)</label>' +
    '<input class="m-input" id="opd_phone" value="' + esc(d.phone) + '" placeholder="9665…" dir="ltr"' + errOf("phone") + ' oninput="opDraft(&quot;phone&quot;,this.value)"></div>' +
    '<div class="m-field"><label class="m-label" for="opd_owner">مسؤول المبيعات (اختياري)</label>' +
    '<input class="m-input" id="opd_owner" list="oxowners2" value="' + esc(d.owner || "") + '" placeholder="بلا مسؤول" oninput="opDraft(&quot;owner&quot;,this.value)"></div></div>' +
    '<datalist id="oxowners2">' + opOwners().map(function (o) { return '<option value="' + esc(o) + '"></option>'; }).join("") + "</datalist>";
  b += "</section>";
  b += '<section class="ox-sec"><div class="ox-sech" id="opd_srcl">مصدر الفرصة</div><div class="ox-srcs" role="radiogroup" aria-labelledby="opd_srcl">' +
    Object.keys(OPP_SRC).filter(function (k) { return k !== "other"; }).map(function (k) {
      return '<button role="radio" aria-checked="' + (d.source === k) + '" onclick="opDraftSrc(&quot;' + k + '&quot;)">' + opIco(k) + esc(OPP_SRC[k]) + "</button>";
    }).join("") + "</div>";
  if (d.source === "whatsapp") {
    b += '<div class="m-field"><label class="m-label" for="opd_camp">من أي حملة؟</label>' +
      '<select class="m-select" id="opd_camp" onchange="opDraft(&quot;source_ref&quot;,this.value)">' +
      '<option value="">لم تُحدَّد حملة</option>' +
      (campaigns || []).map(function (cp) {
        return '<option value="' + esc(cp.id) + '"' + (String(d.source_ref) === String(cp.id) ? " selected" : "") + ">" + esc(clip(cp.name, 48)) + "</option>";
      }).join("") + "</select></div>";
  }
  if (d.source === "partner") {
    b += '<div class="m-field"><label class="m-label m-req" for="opd_partner">اسم الشريك</label>' +
      '<input class="m-input" id="opd_partner" maxlength="120" value="' + esc(d.source_ref || "") + '" placeholder="مثال: شركة الحلول الصحية"' + errOf("source_ref") +
      ' oninput="opDraft(&quot;source_ref&quot;,this.value)"></div>';
  }
  b += "</section>";
  var total = 0, unp = 0;
  b += '<section class="ox-sec"><div class="ox-sech">المنتجات</div>';
  d.lines.forEach(function (l, i) {
    var v = opValue(l); total += v; if (!opPriced(l)) unp++;
    var fid = function (k) { return "opd_" + k + "_" + i; };
    var numF = function (k, label, rng, ph) {
      return '<div class="m-field"><label class="m-label" for="' + fid(k) + '">' + label + "</label>" +
        '<input class="m-input num" id="' + fid(k) + '" type="number" inputmode="decimal"' + rng + (ph ? ' placeholder="' + ph + '"' : "") +
        ' value="' + esc(l[k]) + '"' + errOf(k + "_" + i) + ' oninput="opLineSet(' + i + ',&quot;' + k + '&quot;,this.value)"></div>';
    };
    b += '<div class="ox-lblk"><div class="hd"><span>البند ' + opN(i + 1) + "</span>" +
      (d.lines.length > 1 ? '<button type="button" class="m-btn m-btn--quiet" onclick="opLineDel(' + i + ')">إزالة</button>' : "") + "</div>" +
      '<div class="m-field"><label class="m-label m-req" for="' + fid("product") + '">المنتج</label>' +
      '<select class="m-select" id="' + fid("product") + '"' + errOf("product_" + i) + ' onchange="opLineSet(' + i + ',&quot;product&quot;,this.value)">' +
      '<option value="">اختر المنتج</option>' +
      reg.map(function (t) { return '<option value="' + esc(t.name) + '"' + (l.product === t.name ? " selected" : "") + ">" + esc(t.name) + "</option>"; }).join("") +
      "</select></div>" +
      '<div class="m-form">' + numF("sale_price", "السعر السنوي (ر.س)", ' min="0"', "بلا سعر") + numF("years", "السنوات", ' min="1" max="20" step="1"', "") +
      numF("qty", "الكمية", ' min="1" step="1"', "") + numF("discount", "الخصم ٪", ' min="0" max="100"', "0") + "</div>" +
      '<div class="ox-total"><span class="ox-sech">قيمة البند</span><span class="lv">' +
      (opPriced(l) ? opMoney(v) : opUnpricedNil()) + "</span></div></div>";
  });
  b += '<button class="ox-arow" onclick="opLineAdd()">' + opIco("plus") + "منتج آخر</button>";
  b += '<div class="ox-total"><span class="m-label">قيمة الفرصة' + (unp && total ? "، " + opNLineN(unp) + " بلا تسعير" : "") + "</span>" +
    '<span class="v">' + (total ? opMoney(total) : opUnpricedNil()) + "</span></div>";
  b += "</section>";
  var foot = (opErr ? '<span class="ox-derr" role="alert">' + opIco("warn") + esc(opErr) + "</span>" : "") +
    '<button class="m-btn m-btn--primary" id="opd_submit" onclick="opSubmit()"' + (oppBusy ? ' disabled aria-busy="true"' : "") + ">" +
    (oppBusy ? "جارٍ الحفظ…" : "إنشاء الفرصة") + "</button>" +
    '<button class="m-btn" onclick="opCloseDrawer()">إلغاء</button>';
  return opDrawerShell("oxdrt", head, b, foot);
}

/* After every paint: remember the resting toolbar height; play the drawer entrance once, restore
   its scroll, move focus in. */
function opMarkRibbonWraps() {
  var prev = null;
  Array.prototype.forEach.call(document.querySelectorAll(".ox-leg .ox-lg"), function (el) {
    el.classList.toggle("wrap-start", !!prev && Math.abs(el.offsetTop - prev.offsetTop) > 4);
    prev = el;
  });
}
if (!window.__oxStepFocusOut) {
  window.__oxStepFocusOut = 1;
  document.addEventListener("focusin", function (e) {
    if (opStepFocus && e.target && e.target.closest && !e.target.closest(".ox-steps")) opStepFocus = "";
  });
  /* A pointer press elsewhere is also a choice to leave, even on something that cannot take focus. */
  document.addEventListener("pointerdown", function (e) {
    if (opStepFocus && e.target && e.target.closest && !e.target.closest(".ox-steps")) opStepFocus = "";
  });
}
if (!window.__oxRibbonResize) {
  window.__oxRibbonResize = 1;
  window.addEventListener("resize", function () { opMarkRibbonWraps(); });
}
function opAfterRender() {
  opMarkRibbonWraps();
  var tb = document.querySelector(".ox-tb");
  if (tb && !opSelIds().length) opTbH = Math.round(tb.getBoundingClientRect().height);
  var dr = document.querySelector(".ox-dr");
  /* The page behind a modal drawer must not scroll under it (beUI Drawer: body scroll lock). The
     class goes on <html> and is removed the moment the drawer leaves the DOM, including the paint
     after a close — a lock that outlives its dialog is a frozen page. */
  try { document.documentElement.classList.toggle("ox-lock", !!dr); } catch (e) {}
  /* No indicator to place: .m-tab draws the selected tab with its own border, so nothing has to be
     measured after paint (PORT-SPEC §2). */
  if (!dr) { opStepPrev = null; opStepFocus = ""; return; }
  opPlaceStepPill();
  if (opStepFocus) {
    /* Only put focus back when the repaint DROPPED it (to <body>) or it is still on the stepper — a
       user who has since tabbed to «السعر» keeps their place. Once the save is no longer pending
       the memory ends, so a later failed or saved repaint cannot pull focus back either. */
    var ae = document.activeElement;
    var lost = !ae || ae === document.body || (ae.closest && ae.closest(".ox-steps"));
    var sf = document.getElementById(opStepFocus);
    if (sf && lost && ae !== sf) sf.focus({ preventScroll: true });
    /* Remembered until the user deliberately focuses something OUTSIDE the stepper (the focusin
       listener below): the «حُفظ» status clears itself 1.6s later with one more repaint, and
       forgetting at «saved» dropped focus to <body> on that repaint (Claude review, round 2). */
  }
  var db = document.getElementById("oxdb");
  if (db && opDrScroll) db.scrollTop = opDrScroll;
  if (!opDrShown) {
    opDrShown = true;
    requestAnimationFrame(function () {
      var s = document.querySelector(".ox-scrim"), d = document.querySelector(".ox-dr");
      if (s) s.classList.add("in"); if (d) d.classList.add("in");
      var h = document.getElementById(opSheet ? "opd_name" : "oxdrt");
      if (h) h.focus();
    });
  }
}
if (!window.__oxKeys) {
  window.__oxKeys = 1;
  document.addEventListener("keydown", function (e) {
    var dr = document.querySelector(".ox-dr");
    if (!dr) return;
    if (e.key === "Escape") {
      /* Escape on an ARMED delete disarms it and keeps the drawer: the first Escape cancels the
         most recent intent, not the whole surface. */
      if (document.activeElement && document.activeElement.classList && document.activeElement.classList.contains("armed")) {
        e.preventDefault(); opRender(); var hb = document.querySelector(".ox-dr .rv-hold"); if (hb) hb.focus(); return;
      }
      e.preventDefault(); window.opCloseDrawer(); return;
    }
    if (e.key !== "Tab") return;
    var f = Array.prototype.slice.call(dr.querySelectorAll("a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex='-1'])"))
      .filter(function (x) { return x.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (!dr.contains(document.activeElement)) { e.preventDefault(); first.focus(); return; }
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
}

function opToast(msg, bad, act, actFn) {
  var old = document.getElementById("oxtoast"); if (old) old.remove();
  var el = document.createElement("div");
  el.id = "oxtoast"; el.className = "ox-toast" + (bad ? " bad" : "");
  el.setAttribute("role", bad ? "alert" : "status");
  var t = document.createElement("span"); t.textContent = msg; el.appendChild(t);
  if (act) {
    var b = document.createElement("button"); b.textContent = act;
    b.onclick = function () { el.remove(); actFn(); }; el.appendChild(b);
  }
  var x = document.createElement("button"); x.className = "x"; x.textContent = "×"; x.setAttribute("aria-label", "إغلاق");
  x.onclick = function () { el.remove(); }; el.appendChild(x);
  document.body.appendChild(el);
  if (!bad) setTimeout(function () { if (el.parentNode) el.remove(); }, 4200);
}

/* ================================ THE VIEW ================================ */
function vOppsCrm() {
  opLoad(false);
  /* The LADDER, not just the lines: an admin may have added or paused a rung, and until «إعدادات
     النظام» had been opened the board rendered a custom stage as OPP_ST[0] («تواصل أولي»). */
  if (typeof cfLoad === "function") cfLoad(false);
  /* #opps/<id> is the shareable record URL: it opens that line's drawer. */
  var hid = Number(((location.hash || "").split("/")[1]) || 0);
  if (hid && oppRows && opOpen !== hid && !opSheet) {
    if (oppRows.some(function (o) { return o.id === hid; })) { opOpen = hid; opDrShown = false; opDrScroll = 0; }
  }
  var h = '<div class="ox">';
  if (oppRows === null && !oppFailed) {
    /* A ledger that has not been read yet is not a ledger worth nothing: the figure says which
       nothing it is (PORT-SPEC §4) rather than standing in as an em-dash. */
    h += '<section class="m-card ox-sum" aria-busy="true"><div><div class="m-label">القيمة المفتوحة</div>' +
      '<div class="ox-fig">' + opNil("لم تُقرأ بعد", "none") + '</div><div class="ox-bar"></div></div></section>';
  } else if (oppRows) {
    h += opSummary();
  }
  h += '<section class="ox-led" aria-label="بنود الفرص">' + opToolbar() + opLadderNotice();
  if (oppFailed && !oppRows) {
    h += '<div class="m-empty" role="alert"><p class="m-empty__t">تعذّر تحميل الفرص.</p>' +
      '<p class="m-empty__d">لم يُعرض شيء لأن الطلب فشل، لا لأن السجل فارغ.</p>' +
      '<div class="m-empty__a"><button class="m-btn" onclick="opRetry()">أعد المحاولة</button></div></div>';
  } else if (oppRows === null) {
    h += opSkeleton(5);
  } else {
    if (oppFailed) h += '<div class="m-alert" role="alert">' + opIco("warn") +
      '<span class="m-alert__d">تعذّر تحديث الفرص — المعروض آخر نسخة محمّلة.</span>' +
      '<button class="m-btn" onclick="opRetry()">أعد المحاولة</button></div>';
    h += opWaRow();
    h += opMode === "kanban" ? opKanbanView() : opMode === "cards" ? opCardsView() : opListView();
  }
  h += "</section></div>";
  if (opSheet) h += opCreateDrawer();
  else if (opOpen && oppRows) {
    var l = oppRows.find(function (x) { return x.id === opOpen; });
    if (l) h += opDetailDrawer(l);
  }
  /* The lost-reason dialog belongs to this screen, so it lives INSIDE the .ds6 subtree — outside it,
     it would render in the old system on top of a ported board. */
  if (typeof owLossModal === "function") h += owLossModal();
  setTimeout(opAfterRender, 0);
  if (typeof owAfterRender === "function") setTimeout(owAfterRender, 0);
  /* The ONE wrapper for the whole screen (PORT-SPEC §1): the board, both drawers and the dialog. */
  return '<div class="ds6">' + h + "</div>";
}

/* ================================ HANDLERS ================================ */
/* Anything that changes WHAT is listed resets the page and clears the selection, and says so: a
   checkbox the reader can no longer see is a write they did not authorise. */
function opResetScope() {
  var n = Object.keys(opSel).length;
  opSel = {}; PAGE.opps = 1;
  if (n) opToast("أُلغي تحديد " + opNLine(n) + " عند تغيير التصفية", false);
}
window.opRetry = function () { oppFailed = false; opLoad(true); opRender(); };
window.opSetMode = function (v) { if (opMode === v) return; opMode = v; opCardOpen = {}; opResetScope(); opRender(); };
/* «لوحة المتابعة» (#board) is this same board in kanban mode — one screen, one set of rules, entered
   two ways. It is NOT a copy: a second board would drift from this one the first time a stage moved. */
function vOppsBoard() { opMode = "kanban"; return vOppsCrm(); }
window.opSetSort = function (v) { opSort = v; opResetScope(); opRender(); };
window.opSetStg = function (v) { opStg = opStg === v && v !== "all" ? "all" : v; opResetScope(); opRender(); };
window.opSetSrc = function (v) { opSrc = v; opResetScope(); opRender(); };
window.opSetOwn = function (v) { opOwn = v; opResetScope(); opRender(); };
window.opSetShort = function (v) { opShort = opShort === v ? "" : v; opResetScope(); opRender(); };
window.opSetStat = function (v) { opStat = v; opRender(); };
window.opClearFilters = function () { opQ = ""; opSrc = "all"; opOwn = "all"; opStg = "all"; opShort = ""; opProd = ""; opIds = null; opIdsLabel = ""; opResetScope(); opRender(); };
/* The report's drill: ids it counted, and the words it counted them with. */
window.opClearIds = function () { opIds = null; opIdsLabel = ""; opResetScope(); opRender(); };
window.opSetIds = function (ids, label) {
  opIds = null;
  if (ids && ids.length) { opIds = {}; for (var i = 0; i < ids.length; i++) opIds[ids[i]] = 1; opIdsLabel = String(label || ""); }
  else opIdsLabel = "";
};
window.opClearProd = function () { opProd = ""; opResetScope(); opRender(); };
window.opSearch = function (el) {
  opQ = el.value; clearTimeout(window.__opq);
  window.__opq = setTimeout(function () { opResetScope(); opRender(); }, 250);
};
window.opToggleWa = function () { opWaOpen = !opWaOpen; opRender(); };
window.opKMore = function (k) { opKCap[k] = (opKCap[k] || OPP_KCAP) + OPP_KCAP; opRender(); };
window.opToggleSel = function (id) { if (opSel[id]) delete opSel[id]; else opSel[id] = 1; opRender(); };
window.opTogglePage = function () {
  var page = pageSlice("opps", opSorted());
  var allOn = page.length > 0 && page.every(function (l) { return opSel[l.id]; });
  page.forEach(function (l) { if (allOn) delete opSel[l.id]; else opSel[l.id] = 1; });
  opRender();
};
window.opSelectAll = function () { opLines().forEach(function (l) { opSel[l.id] = 1; }); opRender(); };
window.opClearSel = function () { opSel = {}; opRender(); };

/* ---- the drawer ---- */
window.opOpenLine = function (id, opener) {
  opSheet = null; opErr = ""; opDelErr = "";
  if (opOpen !== id) { opDrScroll = 0; }
  if (!opOpen) opDrShown = false;
  opOpen = id; opOpener = opener || ""; opTab = "deal";
  try { history.replaceState(null, "", "#opps/" + fmtId(id)); } catch (e) {}
  opRender();
};
window.opRowClick = function (e, id) {
  var t = e.target;
  if (t && t.closest && t.closest("a,button,input,select,label")) return;
  window.opOpenLine(id, "oxt_" + id);
};
window.opCardKey = function (e, id, opener) {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); window.opOpenLine(id, opener); }
};
window.opSwitchLine = function (id) { opDelErr = ""; opDrScroll = 0; opOpen = id; opTab = "deal"; try { history.replaceState(null, "", "#opps/" + fmtId(id)); } catch (e) {} opRender(); };
window.opCloseDrawer = function () {
  var wasSheet = !!opSheet;
  var pend = Object.keys(opFState).filter(function (k) { return opFState[k].s === "pending"; }).length;
  opOpen = 0; opSheet = null; opErr = ""; opErrFld = ""; opDelErr = ""; opDrShown = false; opDrScroll = 0;
  if ((location.hash || "").split("/")[1]) { try { history.replaceState(null, "", "#opps"); } catch (e) {} }
  opRender();
  if (pend) opToast("يُستكمل حفظ " + opNLine(pend) + " في الخلفية", false);
  var back = document.getElementById(opOpener) || (wasSheet ? document.getElementById("oxadd") : null);
  if (back) back.focus();
};

/* ---- autosave: one PATCH path, per-field state, ordered writes ---- */
window.opSaveField = async function (id, key, val, extra) {
  var l = (oppRows || []).find(function (o) { return o.id === id; });
  if (!l) return;
  var sk = id + ":" + key;
  var msg = key === "stage" ? "" : opValidate(key, val);
  if (msg) {
    opFState[sk] = { s: "invalid", v: val, m: msg }; opRender();
    var f = document.getElementById("oxd_" + key + "_" + id); if (f) f.focus();
    return;
  }
  var num = key === "sale_price" || key === "years" || key === "qty" || key === "discount";
  var norm = num ? (String(val).trim() === "" ? 0 : Number(val)) : String(val == null ? "" : val).trim();
  var cur = l[key] == null ? (num ? 0 : "") : l[key];
  /* An unchanged value is not a write — the server answers 404 not_found_or_no_change to one. */
  if (String(num ? Number(cur) : cur) === String(norm)) { delete opFState[sk]; opRender(); return; }
  /* The lost reason travels WITH the value through the queue and the retry: both used to resend the bare
     stage and hit lost_reason_required forever (review, S3). */
  if (opFState[sk] && opFState[sk].s === "pending") { opFQueue[sk] = val; opFQueueX[sk] = extra; opFState[sk].v = val; return; }
  opFState[sk] = { s: "pending", v: val, x: extra }; opRender();
  var body = {}; body[key] = norm;
  /* A stage move to lost carries its reason in the same write (opp-work-crm's dialog). */
  if (extra) Object.keys(extra).forEach(function (k) { body[k] = extra[k]; });
  var ok = false;
  try {
    var r = await fetch("/admin/opps/" + fmtId(id), {
      method: "PATCH", headers: { "x-admin-token": TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    var j = await r.json();
    if (r.ok && j.ok) {
      ok = true;
      oppRows = (oppRows || []).map(function (o) { return o.id === j.opp.id ? j.opp : o; });
    } else if (j && j.detail) { opToast(j.detail, true); }
  } catch (e) { ok = false; }
  if (ok) {
    opFState[sk] = { s: "saved", v: val };
    setTimeout(function () { if (opFState[sk] && opFState[sk].s === "saved") { delete opFState[sk]; opRender(); } }, 1600);
  } else {
    opFState[sk] = { s: "failed", v: val, x: extra };
    var nm = l.account_name;
    if (opOpen !== id) opToast("لم يُحفظ تعديل على «" + nm + "»", true, "فتح البند", function () { window.opOpenLine(id, ""); });
  }
  opRender();
  if (opFQueue[sk] !== undefined) { var nv = opFQueue[sk], nx = opFQueueX[sk]; delete opFQueue[sk]; delete opFQueueX[sk]; void window.opSaveField(id, key, nv, nx); }
};
window.opRetryField = function (id, key) {
  var st = opFState[id + ":" + key]; if (!st) return;
  var v = st.v, x = st.x; delete opFState[id + ":" + key]; void window.opSaveField(id, key, v, x);
};
window.opDiscardField = function (id, key) { delete opFState[id + ":" + key]; opRender(); };
/* BRULE-009: every path that closes a line as lost goes through the reason dialog first. */
var opFQueueX = {};
function opNeedsLossReason(id, stage) {
  var l = (oppRows || []).find(function (o) { return o.id === id; });
  return !!l && typeof isLossClose === "function" && isLossClose(l.stage, stage);
}
window.opSetStage = function (id, stage) {
  if (opNeedsLossReason(id, stage)) { owLossOpen([id], "close", stage); return Promise.resolve(); }
  return window.opSaveField(id, "stage", stage);
};
window.opSetStageSel = function (v) { if (!opOpen) return; if (opNeedsLossReason(opOpen, v)) { owLossOpen([opOpen], "close", v); return; } void window.opSaveField(opOpen, "stage", v); };

/* The escalation controls are delegated rather than inline-onclick: they live inside a drawer that
   re-renders on every keystroke, and an inline handler would be re-parsed on each paint. */
document.addEventListener("click", function (ev) {
  var t = ev.target && ev.target.closest ? ev.target.closest("[data-op]") : null;
  if (!t) return;
  var a = t.getAttribute("data-op");
  if (a === "escalate") { opEscOpen(Number(t.getAttribute("data-i")), "escalation"); return; }
  if (a === "support") { opEscOpen(Number(t.getAttribute("data-i")), "support"); return; }
  if (a === "esccancel") { opEsc = null; opRender(); return; }
  if (a === "escsave") { opEscSave(); return; }
  if (a === "escdone") { opEscResolve(Number(t.getAttribute("data-i")), Number(t.getAttribute("data-o"))); return; }
  if (a === "escretry") { var oid = Number(t.getAttribute("data-i")); opEscFailed[oid] = false; opEscLoad(oid, true); return; }
  if (a === "ladderretry") { if (typeof cfLoad === "function") { cfFailed = false; cfLoad(true); } return; }
});
document.addEventListener("input", function (ev) {
  var t = ev.target; if (!t || !t.getAttribute) return;
  var k = t.getAttribute("data-opesc"); if (!k || !opEsc) return;
  opEsc[k] = t.value; opEsc.err = "";
});
document.addEventListener("change", function (ev) {
  var t = ev.target; if (!t || !t.getAttribute) return;
  var k = t.getAttribute("data-opesc"); if (!k || !opEsc) return;
  opEsc[k] = t.value; opEsc.err = ""; opRender();
});

window.opDel = async function (id) {
  id = Number(id); opDelErr = "";
  try {
    var r = await fetch("/admin/opps/" + fmtId(id), { method: "DELETE", headers: { "x-admin-token": TOKEN } });
    var j = r.ok ? await r.json() : null;
    if (!r.ok || !j || !j.ok) { opDelErr = "تعذّر الحذف — أعد المحاولة."; opRender(); return; }
    oppRows = (oppRows || []).filter(function (o) { return o.id !== id; });
    delete opSel[id];
    window.opCloseDrawer();
    opToast("حُذف البند", false);
  } catch (e) { opDelErr = "تعذّر الاتصال بالخادم — أعد المحاولة."; opRender(); }
};

/* ---- bulk: N single writes through the ONE endpoint; failures stay selected ---- */
async function opBulkPatch(patch, label) {
  var ids = opSelIds();
  if (!ids.length || oppBusy) return;
  oppBusy = true; opRender();
  var ok = 0, bad = [];
  for (var i = 0; i < ids.length; i++) {
    try {
      var r = await fetch("/admin/opps/" + fmtId(ids[i]), {
        method: "PATCH", headers: { "x-admin-token": TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      var j = await r.json();
      if (r.ok && j.ok) { ok++; oppRows = oppRows.map(function (o) { return o.id === j.opp.id ? j.opp : o; }); }
      else if (r.status === 404 && j && j.error === "not_found_or_no_change") ok++;
      else bad.push(ids[i]);
    } catch (e) { bad.push(ids[i]); }
  }
  oppBusy = false;
  opSel = {}; bad.forEach(function (id) { opSel[id] = 1; });
  opRender();
  opToast(label + " — " + opNLine(ok) + (bad.length ? " · تعذّر " + fmtN(bad.length) + " (ما زالت محدّدة)" : ""), bad.length > 0);
}
window.opBulkStage = function (el) {
  var v = el.value; el.value = "";
  if (!v) return;
  if (isLostStage(v)) {
    /* Only lines that are CLOSING get the reason: a line already lost keeps the reason it was lost for, which
       a bulk close used to overwrite silently (review). */
    var toClose = opSelIds().filter(function (id) { return opNeedsLossReason(id, v); });
    if (!toClose.length) { opToast("البنود المحدّدة مغلقة خسارة بالفعل", false); return; }
    owLossOpen(toClose, "bulk", v); return;
  }
  void opBulkPatch({ stage: v }, "نُقلت إلى «" + opStage(v).label + "»");
};
window.opBulkOwner = function (el) {
  var v = String(el.value || "").trim(); el.value = "";
  if (!v) return;
  void opBulkPatch({ owner: v }, "أُسندت إلى " + v);
};

/* ---- kanban drag: the column KEY is the payload, never its rendered label ---- */
window.opDragStart = function (e, id) { opDragId = id; if (e.dataTransfer) e.dataTransfer.effectAllowed = "move"; };
window.opDragEnd = function () { opDragId = null; };
window.opDragOver = function (e, el) { e.preventDefault(); if (el) el.classList.add("over"); };
window.opDragLeave = function (el) { if (el) el.classList.remove("over"); };
window.opDrop = async function (e, stage, el) {
  e.preventDefault();
  if (el) el.classList.remove("over");
  var id = opDragId; opDragId = null;
  if (id === null) return;
  var l = (oppRows || []).find(function (x) { return x.id === id; });
  if (!l || l.stage === stage) return;
  if (opNeedsLossReason(id, stage)) { owLossOpen([id], "close", stage); return; }
  await window.opSaveField(id, "stage", stage);
  var st = opFState[id + ":stage"];
  if (st && st.s === "failed") {
    delete opFState[id + ":stage"]; opRender();
    opToast("تعذّر نقل «" + l.account_name + "»", true, "أعد المحاولة", function () { void window.opSaveField(id, "stage", stage); });
  }
};

/* ---- create ---- */
function opBlankLine() { return { product: "", sale_price: "", years: 1, qty: 1, discount: 0 }; }
window.opOpenSheet = function (opener) {
  if (!opMayEdit()) return;  // the button is hidden; this closes the keyboard/console path too
  opSheet = { name: "", phone: "", source: "call", source_ref: "", owner: "", lines: [opBlankLine()] };
  opOpen = 0; opErr = ""; opErrFld = ""; opDrShown = false; opDrScroll = 0; opOpener = opener || "oxadd";
  opRender();
};
window.opDraft = function (k, v) { opSheet[k] = v; opErr = ""; opErrFld = ""; if (k === "source") opRender(); };
window.opDraftSrc = function (k) { if (opSheet.source !== k) opSheet.source_ref = ""; opSheet.source = k; opRender(); if (k === "partner") { var pf = document.getElementById("opd_partner"); if (pf) pf.focus(); } };
window.opLineSet = function (i, k, v) { opSheet.lines[i][k] = v; opErr = ""; opErrFld = ""; opRender(); };
window.opLineAdd = function () { opSheet.lines.push(opBlankLine()); opRender(); };
window.opLineDel = function (i) { opSheet.lines.splice(i, 1); opRender(); };
/* Prefill from a reply the assistant already read: account, number, the service it asked about and
   the campaign that reached it — every value already in the ledger. The form asks only what it is
   worth. */
window.opFromContact = function (phone, opener) {
  if (!opMayEdit()) return;  // the create drawer is a write; the control is hidden, this seals the path
  var c = contactByPhone(phone);
  var ent = entities.find(function (e) { return e.phone === phone; });
  var cp = opLastCampaign(phone);
  var pr = c ? opReadProduct(c) : "";
  var line = opBlankLine();
  if (pr) line.product = pr;
  opSheet = { name: (ent && ent.name) || (c && c.waName) || phone, phone: phone, source: "whatsapp",
    source_ref: cp ? String(cp.id) : "", owner: "", lines: [line] };
  opOpen = 0; opErr = ""; opErrFld = ""; opDrShown = false; opDrScroll = 0; opOpener = opener || "";
  opRender();
};
/* The door from جهات الاستهداف: record the deal on the object you are standing on, then land on the
   board that will hold it. One candidate tag prefills the service; two prefill nothing. */
window.opFromEntity = function (id) {
  if (!opMayEdit()) return;  // «فرصة +» on an account or a target row — same write, same gate
  var e = entities.find(function (x) { return x.id === id; });
  if (!e) return;
  var line = opBlankLine();
  var tags = e.productTags || [];
  if (tags.length === 1) line.product = tags[0];
  opSheet = { name: e.name, phone: e.phone, source: "call", source_ref: "", owner: "", lines: [line] };
  opOpen = 0; opErr = ""; opErrFld = ""; opDrShown = false; opDrScroll = 0; opView = "board";
  if ((location.hash || "").slice(1).split("/")[0] === "opps") opRender();
  else location.hash = "#opps";
};
function opCreateInvalid(f, msg) {
  opErr = msg; opErrFld = f; opRender();
  var idMap = { name: "opd_name", phone: "opd_phone", source_ref: "opd_partner" };
  var p = f.split("_"); var idx = p.pop();
  var el = document.getElementById(idMap[f] || ("opd_" + p.join("_") + "_" + idx));
  if (el) el.focus();
}
window.opSubmit = async function () {
  if (oppBusy) return;
  var d = opSheet;
  if (!d) return;
  if (!String(d.name || "").trim()) return opCreateInvalid("name", "اسم الجهة مطلوب.");
  var lines = d.lines.filter(function (l) { return String(l.product || "").trim(); });
  if (!lines.length) return opCreateInvalid("product_0", "اختر منتجًا واحدًا على الأقل.");
  for (var i = 0; i < d.lines.length; i++) {
    if (!String(d.lines[i].product || "").trim()) continue;
    var ks = ["sale_price", "years", "qty", "discount"];
    for (var k = 0; k < ks.length; k++) {
      var m = opValidate(ks[k], d.lines[i][ks[k]]);
      if (m) return opCreateInvalid(ks[k] + "_" + i, "المنتج " + fmtN(i + 1) + ": " + m);
    }
  }
  oppBusy = true; opRender();
  try {
    var r = await fetch("/admin/opps", {
      method: "POST",
      headers: { "x-admin-token": TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({
        account_name: String(d.name).trim(), phone: String(d.phone || "").trim(),
        source: d.source, source_ref: d.source === "whatsapp" || d.source === "partner" ? String(d.source_ref || "").trim() : "",
        lines: lines.map(function (l) {
          return { product: l.product, sale_price: Number(l.sale_price || 0), years: Number(l.years || 1),
            qty: Number(l.qty || 1), discount: Number(l.discount || 0), owner: d.owner || "" };
        })
      })
    });
    var j = await r.json();
    oppBusy = false;
    if (!r.ok || !j.ok) {
      /* The server names the field it rejected; repeating that name is what makes it fixable. */
      if (j.error === "invalid_field" && j.field === "phone") return opCreateInvalid("phone", "رقم الجوال غير صالح.");
      if (j.error === "invalid_field" && j.field === "account_name") return opCreateInvalid("name", "اسم الجهة مطلوب.");
      if (j.error === "invalid_field" && j.field === "source_ref") return opCreateInvalid("source_ref", "اكتب اسم الشريك.");
      opErr = j.error === "unknown_product" ? "خدمة غير معروفة: " + String(j.product || "")
        : j.error === "unknown_ref" ? "الحملة المختارة لم تعد موجودة."
        : j.error === "invalid_field" ? "قيمة غير صالحة في الحقل: " + String(j.field || "")
        : j.error === "db_unavailable" ? "قاعدة البيانات غير متاحة — لم تُحفظ الفرصة."
        : "تعذّر الحفظ (" + fmtN(r.status) + ")";
      return opRender();
    }
    var made = j.opps || [];
    oppRows = made.concat(oppRows || []);
    opSheet = null; opErr = ""; opErrFld = ""; opDrShown = false;
    opRender();
    var visible = {}; opLines().forEach(function (l) { visible[l.id] = 1; });
    var hidden = made.some(function (l) { return !visible[l.id]; });
    if (hidden) opToast("أُنشئت الفرصة خارج التصفية الحالية", false, "عرض", function () { window.opClearFilters(); });
    else opToast("سُجّلت الفرصة — " + opNLine(made.length), false);
    var back = document.getElementById("oxadd"); if (back) back.focus();
  } catch (e) {
    oppBusy = false; opErr = "تعذّر الاتصال بالخادم — لم تُحفظ الفرصة. أعد المحاولة."; opRender();
  }
};
/* A URL segment is not UI copy: fmtN would put Arabic-Indic digits in the path and the route would
   404. One named helper so the distinction is visible at every call site. */
function fmtId(id) { return String(Number(id)); }
`;
