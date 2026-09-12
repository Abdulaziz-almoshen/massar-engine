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
// its value is سعر × سنوات × كمية × (١−خصم). Those rules live in src/opps-domain.ts, which ships its
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
  .ox-leg { display:flex; flex-wrap:wrap; gap:var(--s1) var(--s2); margin-top:var(--s3); }
  .ox-lg { font-family:inherit; font-size:var(--t-xs); color:var(--ink-2); background:transparent;
    border:1px solid transparent; border-radius:var(--r-pill); min-height:28px; padding:2px 10px;
    display:inline-flex; align-items:center; gap:6px; cursor:pointer;
    transition:background var(--fast) var(--ease), border-color var(--fast) var(--ease); }
  .ox-lg:hover { background:var(--accent-wash); }
  .ox-lg.on { background:var(--accent-tint); border-color:var(--accent-mark); color:var(--accent-deep); }
  .ox-lg b { font-weight:600; color:var(--ink); font-variant-numeric:tabular-nums; }
  .ox-lg.on b { color:var(--accent-deep); }
  /* The count sits behind a hairline, never a «·»: beside Arabic-Indic digits a middle dot reads as
     a zero («٠»), and «· ٥» rendered as «٥٠» in the first screenshot of this legend. */
  .ox-lg .n { color:var(--muted); font-variant-numeric:tabular-nums; padding-inline-start:6px; border-inline-start:1px solid var(--line); line-height:14px; }
  .ox-lg.zero b, .ox-lg.zero { color:var(--muted); font-weight:450; }
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
    .ox-leg { display:grid; grid-template-columns:1fr 1fr; gap:2px var(--s2); margin-top:var(--s2); }
    .ox-lg { width:100%; display:grid; grid-template-columns:auto minmax(0,max-content) 1fr; grid-template-rows:auto auto;
      column-gap:6px; row-gap:0; align-items:center; text-align:start; border-radius:var(--r-sm); min-height:40px; padding:4px 6px; }
    .ox-lg > .ox-dot { grid-row:1; grid-column:1; }
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
  /* The filters are ONE strip that scrolls inside itself when the owner list gets long, so the
     primary action never wraps onto a line of its own (it did at 1440 once owner names grew). */
  .ox-filt { display:flex; align-items:center; gap:var(--s2); flex:1 1 auto; min-width:0; overflow-x:auto;
    padding:3px; margin:-3px; scrollbar-width:thin; }
  .ox-filt > * { flex:none; }
  .ox-srch { position:relative; display:inline-flex; align-items:center; flex:0 1 280px; min-width:180px; }
  .ox-srch .ox-si { position:absolute; inset-inline-start:12px; color:var(--muted); display:flex; pointer-events:none; }
  .ox-srch .inp { width:100%; min-height:36px; height:36px; padding-inline-start:36px; font-size:var(--t-sm); }
  .ox-f { position:relative; display:inline-flex; align-items:center; }
  .ox-f select { font-family:inherit; appearance:none; -webkit-appearance:none; height:36px; max-width:170px;
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
    background:transparent; border:none; cursor:pointer; min-height:36px; padding-inline:8px; border-radius:var(--r-sm); }
  .ox-clear:hover { background:var(--accent-wash); }
  .ox-seg { display:inline-flex; background:var(--surface-2); border-radius:var(--r-md); padding:2px; flex:none; }
  .ox-seg button { font-family:inherit; font-size:var(--t-xs); font-weight:600; color:var(--muted-2);
    background:transparent; border:none; border-radius:var(--r-sm); height:32px; padding-inline:10px;
    display:inline-flex; align-items:center; gap:6px; cursor:pointer; }
  .ox-seg button[aria-pressed="true"] { background:var(--paper); color:var(--ink); box-shadow:inset 0 0 0 1px var(--line); }
  .ox-add.btn { height:36px; padding-inline:14px; font-size:var(--t-sm); gap:6px; }
  .ox-add[aria-disabled="true"] { pointer-events:none; }
  .ox-selc { font-size:var(--t-sm); font-weight:600; color:var(--accent-deep); background:var(--accent-tint);
    border-radius:var(--r-sm); min-height:36px; padding-inline:12px; display:inline-flex; align-items:center; gap:6px; }
  .ox-bulk { font-family:inherit; height:36px; font-size:var(--t-sm); color:var(--ink); background:var(--paper);
    border:none; box-shadow:inset 0 0 0 1px var(--s-off-mark); border-radius:var(--r-sm); padding-inline:12px; }
  .ox-bulk:focus { box-shadow:inset 0 0 0 2px var(--accent), 0 0 0 3px var(--accent-tint); }
  input.ox-bulk { width:170px; }

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
  .ox-c { min-width:0; }
  .ox-c-chk { display:flex; align-items:center; justify-content:center; }
  .ox-c-ac { display:flex; align-items:center; gap:6px; min-width:0; }
  .ox-nm, .ox-c-ac .ox-lnk { font-size:var(--t-sm); font-weight:600; color:var(--ink); overflow:hidden;
    text-overflow:ellipsis; white-space:nowrap; min-width:0; }
  .ox-c-ac .ox-lnk:hover { color:var(--accent-deep); }
  .ox-auto { flex:none; font-size:var(--t-xs); font-weight:500; color:var(--s-attend-text);
    box-shadow:inset 0 0 0 1px var(--accent-mark); border-radius:var(--r-pill); padding:0 7px; line-height:20px; }
  .ox-uns { flex:none; color:var(--s-fail-text); display:inline-flex; }
  .ox-c-pr { display:flex; flex-direction:column; gap:2px; }
  /* Two lines, not an ellipsis: «تكامل الأنظمة (HIS/ERP)» truncated mid-parenthesis rendered as
     «…ERP) تكامل الأنظمة», a bidi scramble. A clamp keeps the run whole. */
  .ox-pn { font-size:var(--t-sm); color:var(--ink-2); overflow:hidden; display:-webkit-box; -webkit-line-clamp:2;
    -webkit-box-orient:vertical; line-height:1.35; overflow-wrap:anywhere; }
  .ox-srcsub { display:none; font-size:var(--t-xs); color:var(--muted); align-items:center; gap:4px; }
  .ox-c-st { display:flex; flex-direction:column; gap:3px; }
  .ox-stg { display:flex; align-items:center; gap:7px; font-size:var(--t-sm); color:var(--ink); white-space:nowrap; }
  .ox-sub { font-size:var(--t-xs); color:var(--muted); white-space:nowrap; }
  .ox-warn { align-self:flex-start; display:inline-flex; align-items:center; gap:4px; font-size:var(--t-xs); font-weight:500;
    color:var(--s-attn-text); box-shadow:inset 0 0 0 1px var(--s-attn-mark); border-radius:var(--r-pill);
    padding:0 8px; line-height:20px; white-space:nowrap; }
  .ox-warn .ox-ico { width:12px; height:12px; color:var(--s-attn-mark); }
  .ox-c-vl { padding-inline-end:16px; text-align:end; font-size:var(--t-sm); font-weight:600; color:var(--ink); font-variant-numeric:tabular-nums; white-space:nowrap; }
  .ox-c-vl.unp { font-weight:450; color:var(--muted); }
  .ox-c-src { display:flex; align-items:center; gap:6px; font-size:var(--t-sm); color:var(--ink-2); white-space:nowrap; min-width:0; }
  .ox-c-src .ox-ico, .ox-srcsub .ox-ico { color:var(--muted); }
  .ox-c-src .ox-lnk { display:inline-flex; align-items:center; gap:6px; }
  .ox-c-src .ox-lnk .ox-ico { color:currentColor; }
  .ox-c-ow { font-size:var(--t-sm); color:var(--ink-2); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .ox-none { color:var(--muted); font-weight:450; }
  .ox-c-nx { font-size:var(--t-sm); color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .ox-c-nx .ox-none { border-block-end:1px dashed var(--s-off); }
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
    .ox-hr, .ox-r { grid-template-columns:36px minmax(140px,1.2fr) minmax(150px,1.3fr) 140px 116px 100px minmax(120px,1fr) 32px; }
    .ox-c-src, .ox-hsrc { display:none; }
    .ox-srcsub { display:flex; }
    /* Source sits under the product in this band, so the product gets ONE line — three stacked
       lines made rows 70px tall and uneven. The full name is on the cell's title. */
    .ox-pn { -webkit-line-clamp:1; }
    /* Search and the primary action share the first toolbar row; the filter strip goes beneath. */
    .ox-tb { flex-wrap:wrap; }
    .ox-srch { order:1; }
    .ox-seg { order:2; margin-inline-start:auto; }
    .ox-add { order:2; }
    .ox-tb > .sp { display:none; }
    .ox-filt { order:3; flex:1 0 100%; margin:0; }
  }
  @container oxl (max-width: 899px) {
    .ox-tb { gap:var(--s2); }
    .ox-srch { flex:1 1 200px; }
    .ox-filt { order:3; flex:1 0 100%; }
    .ox-hr { display:none; }
    .ox-r { grid-template-columns:36px minmax(0,1fr) auto; row-gap:4px; padding-block:var(--s3); }
    .ox-r .ox-c-chk { grid-row:1 / 5; grid-column:1; align-self:start; padding-top:2px; }
    .ox-r .ox-c-ac { grid-row:1; grid-column:2; }
    .ox-r .ox-c-vl { grid-row:1; grid-column:3; }
    .ox-r .ox-c-pr { grid-row:2; grid-column:2 / 4; }
    .ox-r .ox-c-st { grid-row:3; grid-column:2 / 4; flex-direction:row; align-items:center; gap:var(--s2); flex-wrap:wrap; }
    .ox-r .ox-c-ow { grid-row:4; grid-column:2; font-size:var(--t-xs); color:var(--muted); }
    .ox-r .ox-c-nx { grid-row:4; grid-column:3; font-size:var(--t-xs); max-width:48vw; text-align:end; }
    .ox-r .ox-c-go { display:none; }
    .ox-wa-r { grid-template-columns:minmax(0,1fr) auto; }
    .ox-wa-r .pr { grid-row:2; grid-column:1; }
    .ox-wa-r .btn { grid-row:1 / 3; grid-column:2; }
  }
  @media (pointer:coarse) {
    .ox-f select, .ox-seg button, .ox-bulk, .ox-clear, .ox-add.btn { min-height:44px; }
    .ox-go { width:44px; height:44px; }
    .ox-lg { min-height:44px; }
    .ox-c-chk input[type="checkbox"] { width:44px; height:44px; }
  }

  /* ---- kanban ---- */
  .ox-kb { display:flex; gap:var(--s3); padding:var(--s3); overflow-x:auto; align-items:flex-start; }
  /* width AND min-width: a flex item's automatic minimum is its content, so one long hospital name
     used to widen its whole column to 520px. */
  .ox-kcol { flex:0 0 272px; width:272px; min-width:0; background:var(--surface); border-radius:var(--r-lg); padding:var(--s2);
    display:flex; flex-direction:column; gap:var(--s2); transition:box-shadow var(--fast) var(--ease); }
  .ox-kcol.over { box-shadow:inset 0 0 0 2px var(--accent-mark); }
  .ox-kh { padding:var(--s1) var(--s1) var(--s2); }
  .ox-kh .t { display:flex; align-items:center; gap:7px; font-size:var(--t-sm); font-weight:600; color:var(--ink); }
  .ox-kh .t .n { margin-inline-start:auto; font-size:var(--t-xs); font-weight:600; color:var(--muted); font-variant-numeric:tabular-nums; }
  .ox-kh .v { font-size:var(--t-xs); color:var(--muted); margin-top:2px; font-variant-numeric:tabular-nums; }
  .ox-kc { background:var(--paper); border:1px solid var(--line); border-radius:var(--r-md); padding:10px 12px;
    display:flex; flex-direction:column; gap:2px; cursor:pointer;
    transition:border-color var(--fast) var(--ease), background var(--fast) var(--ease); }
  .ox-kc:hover { border-color:var(--s-off-mark); }
  .ox-kc.is-open { border-color:var(--accent); background:var(--accent-wash); }
  .ox-kc { min-width:0; }
  .ox-kc .a { font-size:var(--t-sm); font-weight:600; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .ox-kc .p { font-size:var(--t-xs); color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .ox-kc .m { display:flex; align-items:center; justify-content:space-between; gap:var(--s2); margin-top:4px; }
  .ox-kc .m b { font-size:var(--t-sm); font-weight:600; color:var(--ink); font-variant-numeric:tabular-nums; white-space:nowrap; }
  .ox-kc .m b.unp { font-weight:450; color:var(--muted); }
  .ox-kc .o { font-size:var(--t-xs); color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:inline-flex; align-items:center; gap:4px; min-width:0; }
  .ox-kc .o .ox-ico { width:14px; height:14px; }
  .ox-kempty { font-size:var(--t-xs); color:var(--muted); text-align:center; padding:var(--s3) var(--s2);
    border:1px dashed var(--line); border-radius:var(--r-md); }
  .ox-kmore { font-family:inherit; font-size:var(--t-xs); font-weight:600; color:var(--accent-deep); background:var(--accent-bar);
    border:none; border-radius:var(--r-md); min-height:36px; cursor:pointer; }

  /* ---- the drawer: detail and create are one component ---- */
  .ox-scrim { position:fixed; inset:0; background:rgba(16,24,40,.28); z-index:var(--z-overlay);
    opacity:0; transition:opacity var(--base) var(--ease); }
  .ox-scrim.in { opacity:1; }
  .ox-dr { position:fixed; inset-block:0; inset-inline-start:0; width:min(520px,100vw); background:var(--paper);
    border-inline-end:1px solid var(--line); box-shadow:var(--sh-2, 0 6px 20px rgba(16,24,40,.10));
    z-index:var(--z-modal); display:flex; flex-direction:column;
    transform:translateX(100%); opacity:0;
    transition:transform var(--base) var(--ease), opacity var(--fast) var(--ease); }
  [dir="ltr"] .ox-dr { transform:translateX(-100%); }
  .ox-dr.in, [dir="ltr"] .ox-dr.in { transform:none; opacity:1; }
  @media (prefers-reduced-motion: reduce) { .ox-dr, .ox-scrim { transition:none; } }
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
  .ox-track { display:flex; gap:4px; }
  .ox-track i { flex:1; height:6px; border-radius:var(--r-pill); background:var(--surface-2); cursor:pointer; position:relative;
    transition:background var(--fast) var(--ease); }
  .ox-track i::after { content:""; position:absolute; inset-inline:0; inset-block:-9px; }
  .ox-track i:hover { background:var(--accent-mark); }
  .ox-track i.on { background:var(--accent); }
  .ox-stnow { display:flex; align-items:center; gap:var(--s2); flex-wrap:wrap; font-size:var(--t-sm); color:var(--ink); }
  .ox-stnow b { font-weight:600; }
  .ox-stnow .ox-sub { white-space:normal; }
  .ox-strow { display:flex; align-items:center; gap:var(--s2); flex-wrap:wrap; }
  .ox-strow .ox-f select { max-width:220px; }
  .ox-strow .btn { height:36px; padding-inline:12px; font-size:var(--t-sm); gap:6px; }
  .ox-out { display:inline-flex; align-items:center; gap:6px; font-size:var(--t-sm); font-weight:600; border-radius:var(--r-pill);
    padding:4px 12px; }
  .ox-out.won { color:var(--s-issued-text); background:var(--s-issued-soft); }
  .ox-out.lost { color:var(--s-fail-text); background:var(--s-fail-soft); }
  .ox-vfig { font-size:var(--t-xl); font-weight:600; color:var(--ink); font-variant-numeric:tabular-nums; line-height:var(--lh-tight); }
  .ox-vfig.unp { color:var(--muted); font-weight:500; font-size:var(--t-lg); }
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
  .ox-df .rv-hold { height:38px; padding-inline:16px; font-size:var(--t-sm); }
  .ox-df .rv-hold:not(.holding):not(.armed) { background:var(--surface); color:var(--s-fail-text); }
  .ox-df .rv-hold:hover { background:var(--s-fail-soft); }
  .ox-derr { font-size:var(--t-xs); color:var(--s-fail-text); display:flex; align-items:center; gap:6px; flex:1 0 100%; }
  .ox-srcs { display:flex; flex-wrap:wrap; gap:6px; }
  .ox-srcs button { font-family:inherit; font-size:var(--t-sm); color:var(--ink-2); background:var(--paper); border:none;
    box-shadow:inset 0 0 0 1px var(--line); border-radius:var(--r-pill); min-height:34px; padding-inline:12px;
    display:inline-flex; align-items:center; gap:6px; cursor:pointer; }
  .ox-srcs button:hover { box-shadow:inset 0 0 0 1px var(--ink-2); }
  .ox-srcs button[aria-checked="true"] { background:var(--accent-tint); color:var(--accent-deep); box-shadow:inset 0 0 0 1px var(--accent-mark); }
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
`;

export const OPPS_CRM_JS = `
/* ============================ opps-crm V5 (client) ============================ */
/* Own state, own names. oppTab/oppQ belong to «فرز الردود» (vMorningList) and are NOT reused: two
   screens sharing one search box is how a filter typed on one silently narrows the other. */
var oppRows = null, oppLoading = false, oppBusy = false, oppFailed = false;
var opView = "board";        /* retained for dataSignature; triage is now its own route (#triage) */
var opMode = "list";         /* list | kanban */
var opSort = "value";        /* value | recent | stage | account */
var opSel = {};              /* selected LINE ids, keyed by id */
var opQ = "", opStat = "all", opSrc = "all", opStg = "all";
var opOwn = "all";           /* all | __none | <owner name> */
var opShort = "";            /* "" | open | stalled | unpriced — the summary's shortcut metrics */
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

var OPP_ST = OPP_STAGES;
var OPP_SRC = OPP_SOURCES;
var OPP_KCAP = 50;

/* ARABIC COUNTS ARE NOT «n + noun» — four-way, via the business tier's pluralizeArabic. */
function opPl(n, one, two, few, many) { return pluralizeArabic(n, one, two, few, many, fmtN); }
function opNProd(n) { return opPl(n, "منتج واحد", "منتجان", "منتجات", "منتجًا"); }
function opNLine(n) { return opPl(n, "بند واحد", "بندان", "بنود", "بندًا"); }
/* opNOpp is read by sales-crm.ts («المستهدفات والأداء»), not by this page. The V5 rewrite dropped it and
   smoke caught #perf rendering blank on the first deploy; it stays for that caller. */
function opNOpp(n) { return opPl(n, "فرصة واحدة", "فرصتان", "فرص", "فرصة"); }
function opNEnt(n) { return opPl(n, "جهة واحدة", "جهتان", "جهات", "جهة"); }
function opNDay(n) { return opPl(n, "يوم واحد", "يومان", "أيام", "يومًا"); }
function opNYear(n) { return opPl(n, "سنة واحدة", "سنتان", "سنوات", "سنة"); }

function opStage(k) {
  for (var i = 0; i < OPP_ST.length; i++) if (OPP_ST[i].key === k) return OPP_ST[i];
  return OPP_ST[0];
}
function opOpenStages() { return OPP_ST.filter(function (s) { return isOpenStage(s.key); }); }
function opWonKey() { var s = OPP_ST.filter(function (x) { return isWonStage(x.key); })[0]; return s ? s.key : "won"; }
function opLostKey() { var s = OPP_ST.filter(function (x) { return isLostStage(x.key); })[0]; return s ? s.key : "lost"; }
/* ONE colour per stage, used by the summary bar, the legend, the row dot, the kanban header and
   the drawer. Open stages are a single blue ramp that encodes ORDER only (DESIGN.md §5 Bar); the
   two outcomes use the status channel. The domain's own dot colours are not used here: they were
   eight unrelated hues, which is exactly why the V4 board read as a paint chart. */
var OPP_RAMP = ["var(--blue-light)", "var(--accent-mark)", "var(--accent)", "var(--accent-press)", "var(--accent-deep)", "var(--s-review-text)"];
function opColor(k) {
  if (isWonStage(k)) return "var(--s-issued)";
  if (isLostStage(k)) return "var(--s-fail)";
  var open = opOpenStages();
  for (var i = 0; i < open.length; i++) if (open[i].key === k) return OPP_RAMP[Math.min(i, OPP_RAMP.length - 1)];
  return "var(--s-off-mark)";
}
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
function opStalled(o) { return isLineStalled(opFacts(o), Date.now()); }
function opValue(o) { return calculateLineValue(opFacts(o)); }
function opPriced(l) { return isLinePriced(opFacts(l)); }
function opSumLive(ls) { return sumLiveValue(ls.map(opFacts)); }
function opHasLost(ls) { return hasLostLine(ls.map(opFacts)); }
function opKey(o) { return accountKey(o.account_name, o.phone); }
var OPP_UNPRICED = "لم تُسعَّر";

/* A ROW SHOWS THE WHOLE FIGURE. «٤ ألف ر.س» was both rounded (the line is ٤٬٢٠٠) and a counted-noun
   error (٣–١٠ take آلاف). Full amounts in rows and the drawer; the compact form only where space
   genuinely forbids it (kanban headers, legend), and with the right noun. */
function opMoney(v) { return "<bdi>" + fmtN(Math.round(Number(v || 0))) + " ر.س</bdi>"; }
function opMoneyShort(v) {
  v = Number(v || 0);
  if (v >= 1e6) {
    var m = Math.round(v / 1e5) / 10;
    var mNoun = m >= 3 && m <= 10 && m === Math.floor(m) ? "ملايين" : "مليون";
    return "<bdi>" + fmtN(m) + " " + mNoun + " ر.س</bdi>";
  }
  if (v >= 1e4) {
    var k = Math.round(v / 1000);
    var kNoun = k >= 3 && k <= 10 ? "آلاف" : "ألف";
    return "<bdi>" + fmtN(k) + " " + kNoun + " ر.س</bdi>";
  }
  return opMoney(v);
}
function opAgo(o) {
  var d = opDays(o);
  return d <= 0 ? "منذ اليوم" : "منذ " + opNDay(d);
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
  chevS: '<path d="M15 6l-6 6 6 6"/>',
  chevD: '<path d="M6 9l6 6 6-6"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  warn: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
  back: '<path d="M9 6l6 6-6 6"/>'
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

/* ---- filters ---- */
function opBaseMatch(l) {
  var q = opQ.trim();
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
function opFiltered() { return opQ.trim() || opSrc !== "all" || opOwn !== "all" || opStg !== "all" || opShort; }
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
  var h = '<section class="ox-sum" aria-label="ملخص الفرص"><div>';
  h += '<div class="ox-lbl">القيمة المفتوحة</div>';
  h += openVal
    ? '<div class="ox-fig">' + opMoney(openVal) +
      (unpriced ? '<span class="ox-figsub">خارجها: ' + opNLine(unpriced) + " بلا تسعير</span>" : "") + "</div>"
    : '<div class="ox-fig none">—<span class="ox-figsub">' + (open.length ? "لا بند مفتوح مسعَّر بعد" : "لا بنود مفتوحة") + "</span></div>";
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
  h += '<div class="ox-leg" role="group" aria-label="المراحل المفتوحة — اضغط للتصفية">' + stages.map(function (s) {
    var on = opStg === s.st.key;
    return '<button class="ox-lg' + (on ? " on" : "") + (s.n ? "" : " zero") + '" aria-pressed="' + on + '"' +
      ' onclick="opSetStg(&quot;' + s.st.key + '&quot;)">' + opDot(s.st.key) +
      "<span>" + esc(s.st.label) + "</span>" +
      (s.v ? "<b>" + opMoneyShort(s.v) + "</b>" : "") +
      '<span class="n" title="عدد البنود">' + fmtN(s.n) + "</span></button>";
  }).join("") + "</div>";
  h += "</div>";
  var met = function (key, n, label, warn) {
    var on = opShort === key;
    return '<button class="ox-met' + (on ? " on" : "") + (warn && n ? " warn" : "") + (n ? "" : " zero") + '" aria-pressed="' + on + '"' +
      ' onclick="opSetShort(&quot;' + key + '&quot;)">' +
      '<span class="n">' + (warn && n ? opIco("warn") : "") + fmtN(n) + "</span>" +
      '<span class="l">' + (on ? opIco("check") : "") + label + "</span></button>";
  };
  h += '<div class="ox-mets" role="group" aria-label="اختصارات">' +
    met("open", open.length, "بنود مفتوحة", false) +
    met("stalled", stalled, "متوقفة", true) +
    met("unpriced", unpriced, "لم تُسعَّر", false) + "</div>";
  return h + "</section>";
}

/* ================================ TOOLBAR ================================ */
function opSelect(id, label, value, opts, on, handler) {
  return '<span class="ox-f' + (on ? " on" : "") + '"><select id="' + id + '" aria-label="' + label + '" onchange="' + handler + '(this.value)">' +
    opts.map(function (o) {
      return '<option value="' + esc(o[0]) + '"' + (String(value) === String(o[0]) ? " selected" : "") + ">" + esc(o[1]) + "</option>";
    }).join("") + '</select><span class="ox-chev">' + opIco("chevD") + "</span></span>";
}
function opToolbar() {
  var sel = opSelIds();
  var h = '<div class="ox-tb" role="toolbar" aria-label="أدوات الفرص">';
  if (sel.length) {
    var all = opLines();
    h += '<span class="ox-selc">' + opIco("check") + opNLine(sel.length) + " محدّد</span>";
    h += '<span class="ox-f"><select id="oxb_stage" aria-label="نقل المحدَّد إلى مرحلة" onchange="opBulkStage(this)"' + (oppBusy ? " disabled" : "") + ">" +
      '<option value="">نقل إلى مرحلة…</option>' +
      OPP_ST.map(function (st) { return '<option value="' + st.key + '">' + esc(st.label) + "</option>"; }).join("") + '</select><span class="ox-chev">' + opIco("chevD") + "</span></span>";
    h += '<input class="ox-bulk" id="oxb_owner" list="oxowners" aria-label="إسناد المحدَّد إلى" placeholder="أسنِد إلى…" onchange="opBulkOwner(this)"' + (oppBusy ? " disabled" : "") + ">";
    h += '<datalist id="oxowners">' + opOwners().map(function (o) { return '<option value="' + esc(o) + '"></option>'; }).join("") + "</datalist>";
    var pg = pageSlice("opps", opSorted());
    if (sel.length < all.length && pg.length && pg.every(function (l) { return opSel[l.id]; })) {
      h += '<button class="ox-clear" onclick="opSelectAll()">تحديد كل المطابِق (' + fmtN(all.length) + ")</button>";
    }
    h += '<span class="sp"></span><button class="btn btn-ghost ox-add" onclick="opClearSel()">إلغاء التحديد</button>';
    return h + "</div>";
  }
  h += '<span class="ox-srch"><span class="ox-si">' + opIco("search") + "</span>" +
    '<input id="opq" class="inp" type="search" value="' + esc(opQ) + '" oninput="opSearch(this)" aria-label="بحث في الفرص" placeholder="بحث بالجهة أو المنتج أو المسؤول"></span>';
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
  if (opFiltered()) h += '<button class="ox-clear" onclick="opClearFilters()">مسح التصفية</button>';
  h += "</span>";
  /* The view switch sits OUTSIDE the scrolling filter strip, so it can never be scrolled out of
     sight. */
  h += '<span class="ox-seg" role="group" aria-label="طريقة العرض">' +
    '<button aria-pressed="' + (opMode === "list") + '" onclick="opSetMode(&quot;list&quot;)">' + opIco("list") + "قائمة</button>" +
    '<button aria-pressed="' + (opMode === "kanban") + '" onclick="opSetMode(&quot;kanban&quot;)">' + opIco("board") + "كانبان</button></span>";
  /* While the create drawer is open ITS primary is the only blue button in the DOM. */
  h += opSheet
    ? '<button class="btn btn-ghost ox-add" aria-disabled="true" tabindex="-1">' + opIco("plus") + "إضافة فرصة</button>"
    : '<button class="btn btn-teal ox-add" id="oxadd" onclick="opOpenSheet(this.id)">' + opIco("plus") + "إضافة فرصة</button>";
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
        '<span class="pr">' + (pr ? "سأل عن " + esc(pr) : "لم تُقرأ خدمة بعد") + "</span>" +
        '<button class="btn btn-ghost" id="oxwa_' + esc(c.phone) + '" onclick="opFromContact(&quot;' + esc(c.phone) + '&quot;,this.id)">فتح فرصة</button></div>';
    }).join("") +
    '<div class="ox-wa-f"><a class="ox-lnk" href="#triage">' + (un.length > shown.length ? "و" + opNEnt(un.length - shown.length) + " أخرى · " : "") +
      "كل الردود في «فرز الردود» ←</a></div></div>";
  }
  return h + "</div>";
}

/* ================================ LIST ================================ */
function opStageCell(l) {
  var st = opStage(l.stage);
  var h = '<span class="ox-stg">' + opDot(l.stage) + "<span>" + esc(st.label) + "</span></span>";
  if (opStalled(l)) h += '<span class="ox-warn">' + opIco("warn") + "متوقفة منذ " + opNDay(opDays(l)) + "</span>";
  else h += '<span class="ox-sub">' + opAgo(l) + "</span>";
  return h;
}
function opSrcCell(l) {
  var lbl = esc(opSrcLabel(l.source));
  if (l.source === "whatsapp" && l.phone) {
    return '<a class="ox-lnk" href="#customer/' + esc(l.phone) + '" title="فتح المحادثة" onclick="event.stopPropagation()">' + opIco("whatsapp") + lbl + "</a>";
  }
  return opIco(l.source in OPP_ICO ? l.source : "other") + "<span>" + lbl + "</span>";
}
function opRowHtml(l) {
  var nm = esc(l.account_name);
  var h = '<div class="ox-r' + (opSel[l.id] ? " is-sel" : "") + (opOpen === l.id && !opSheet ? " is-open" : "") + '" role="row" onclick="opRowClick(event,' + l.id + ')">';
  h += '<div class="ox-c ox-c-chk" role="cell"><input type="checkbox" id="oxs_' + l.id + '"' + (opSel[l.id] ? " checked" : "") +
    ' aria-label="تحديد ' + nm + " — " + esc(l.product) + '" onclick="event.stopPropagation();opToggleSel(' + l.id + ')"></div>';
  h += '<div class="ox-c ox-c-ac" role="cell">' +
    (l.phone ? '<a class="ox-lnk" href="#customer/' + esc(l.phone) + '" title="ملف العميل" onclick="event.stopPropagation()">' + nm + "</a>"
             : '<span class="ox-nm">' + nm + "</span>") +
    (l.created_by === "المساعد" ? '<span class="ox-auto" title="فتحها المساعد تلقائيًا عند قراءة نية مرتفعة">تلقائي</span>' : "") +
    (opUnsaved(l.id) ? '<span class="ox-uns" title="تعديل لم يُحفظ">' + opIco("warn") + "</span>" : "") + "</div>";
  h += '<div class="ox-c ox-c-pr" role="cell"><span class="ox-pn" title="' + esc(l.product) + '">' + esc(l.product) + "</span>" +
    '<span class="ox-srcsub">' + opIco(l.source in OPP_ICO ? l.source : "other") + esc(opSrcLabel(l.source)) + "</span></div>";
  h += '<div class="ox-c ox-c-st" role="cell">' + opStageCell(l) + "</div>";
  h += '<div class="ox-c ox-c-vl' + (opPriced(l) ? "" : " unp") + '" role="cell">' + (opPriced(l) ? opMoney(opValue(l)) : OPP_UNPRICED) + "</div>";
  h += '<div class="ox-c ox-c-src" role="cell">' + opSrcCell(l) + "</div>";
  h += '<div class="ox-c ox-c-ow" role="cell">' + (String(l.owner || "").trim() ? esc(l.owner) : '<span class="ox-none">بلا مسؤول</span>') + "</div>";
  h += '<div class="ox-c ox-c-nx" role="cell" title="' + esc(l.next_step || "") + '">' +
    (String(l.next_step || "").trim() ? esc(l.next_step) : '<span class="ox-none">لم تُحدَّد</span>') + "</div>";
  h += '<div class="ox-c ox-c-go" role="cell"><button class="ox-go" id="oxt_' + l.id + '" aria-label="فتح تفاصيل ' + nm + " — " + esc(l.product) + '"' +
    ' onclick="event.stopPropagation();opOpenLine(' + l.id + ',this.id)">' + opIco("chevS") + "</button></div>";
  return h + "</div>";
}
function opSkeleton(n) {
  var h = '<div aria-busy="true" aria-live="polite">';
  for (var i = 0; i < n; i++) h += '<div class="ox-skel"><i style="width:16px"></i><i style="width:70%"></i><i style="width:55%"></i><i style="width:60%"></i><i style="width:70%"></i><i style="width:45%"></i></div>';
  return h + "</div>";
}
function opListView() {
  var rows = opSorted();
  var page = pageSlice("opps", rows);
  var allOn = page.length > 0 && page.every(function (l) { return opSel[l.id]; });
  var h = '<div class="ox-t" role="table" aria-label="بنود الفرص">';
  h += '<div class="ox-hr" role="row">' +
    '<div class="ox-c ox-c-chk" role="columnheader"><input type="checkbox" id="oxs_all" aria-label="تحديد الصفحة المعروضة"' + (allOn ? " checked" : "") + ' onclick="opTogglePage()"></div>' +
    '<div role="columnheader">الجهة</div><div role="columnheader">المنتج</div><div role="columnheader">المرحلة</div>' +
    '<div class="ox-hv" role="columnheader">القيمة</div><div class="ox-hsrc" role="columnheader">المصدر</div>' +
    '<div role="columnheader">المسؤول</div><div role="columnheader">الخطوة التالية</div><div role="columnheader"><span class="sr-only" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);">تفاصيل</span></div></div>';
  if (!page.length) {
    h += '<div class="ox-state">' + (oppRows && oppRows.length
      ? "لا بند يطابق التصفية." + '<button class="btn btn-ghost" onclick="opClearFilters()">مسح التصفية</button>'
      : "لا فرص مسجّلة بعد." + '<span class="s">الفرصة تُسجَّل هنا سواء جاءت من ردّ على حملة واتساب أو من مكالمة أو زيارة. النية المرتفعة التي يقرأها المساعد تفتح فرصةً تلقائيًا.</span>') + "</div>";
  }
  page.forEach(function (l) { h += opRowHtml(l); });
  h += "</div>";
  if (rows.length) {
    var live = opSumLive(rows);
    var unp = rows.filter(function (l) { return !opPriced(l); }).length;
    var unit = rows.length >= 3 && rows.length <= 10 ? "بنود" : rows.length >= 11 ? "بندًا" : "بند";
    h += '<div class="ox-foot">' + pageBar("opps", rows.length, unit) +
      '<span class="tot">' + (live ? "قيمة المطابِق <b>" + opMoney(live) + "</b>" + (opHasLost(rows) ? " · دون الخسارة" : "") : "لا قيمة مسعَّرة في المطابِق") +
      (unp ? "، " + opNLine(unp) + " بلا تسعير" : "") + "</span></div>";
  }
  return h;
}

/* ================================ KANBAN ================================ */
function opKanbanView() {
  var rows = opLines();
  var h = '<div class="ox-kb" role="list" aria-label="لوحة المراحل">';
  OPP_ST.forEach(function (st) {
    /* The same ordering the list uses, applied inside each column, so switching views never reorders
       what the reader already scanned. */
    var inStage = {}; rows.forEach(function (l) { if (l.stage === st.key) inStage[l.id] = 1; });
    var cards = opSorted().filter(function (l) { return inStage[l.id]; });
    var val = cards.reduce(function (a, l) { return a + opValue(l); }, 0);
    var unp = cards.filter(function (l) { return !opPriced(l); }).length;
    var cap = opKCap[st.key] || OPP_KCAP;
    h += '<div class="ox-kcol" role="listitem" data-col="' + esc(st.key) + '" ondragover="opDragOver(event,this)" ondragleave="opDragLeave(this)" ondrop="opDrop(event,&quot;' + st.key + '&quot;,this)">';
    h += '<div class="ox-kh"><div class="t">' + opDot(st.key) + "<span>" + esc(st.label) + '</span><span class="n">' + fmtN(cards.length) + "</span></div>" +
      '<div class="v">' + (val ? opMoneyShort(val) + (unp ? "، " + opNLine(unp) + " بلا تسعير" : "")
        : unp ? opNLine(unp) + " بلا تسعير" : "بلا قيمة مسعَّرة") + "</div></div>";
    cards.slice(0, cap).forEach(function (l) {
      h += '<div class="ox-kc' + (opOpen === l.id && !opSheet ? " is-open" : "") + '" id="oxk_' + l.id + '" tabindex="0" role="button" draggable="true"' +
        ' aria-label="' + esc(l.account_name) + " — " + esc(l.product) + '"' +
        ' ondragstart="opDragStart(event,' + l.id + ')" ondragend="opDragEnd()" onclick="opOpenLine(' + l.id + ',this.id)" onkeydown="opCardKey(event,' + l.id + ',this.id)">' +
        '<span class="a">' + esc(l.account_name) + "</span>" +
        '<span class="p">' + esc(l.product) + (l.created_by === "المساعد" ? ' <span class="ox-auto">تلقائي</span>' : "") + "</span>" +
        '<span class="m"><b class="' + (opPriced(l) ? "" : "unp") + '">' + (opPriced(l) ? opMoney(opValue(l)) : OPP_UNPRICED) + "</b>" +
        '<span class="o">' + opIco(l.source in OPP_ICO ? l.source : "other") + " " + (String(l.owner || "").trim() ? esc(l.owner) : "بلا مسؤول") + "</span></span>" +
        (opStalled(l) ? '<span class="ox-warn">' + opIco("warn") + "متوقفة منذ " + opNDay(opDays(l)) + "</span>" : "") + "</div>";
    });
    if (!cards.length) h += '<div class="ox-kempty">لا بنود</div>';
    if (cards.length > cap) {
      h += '<button class="ox-kmore" onclick="opKMore(&quot;' + st.key + '&quot;)">تُعرض ' + fmtN(cap) + " من " + fmtN(cards.length) + " — عرض " + fmtN(Math.min(OPP_KCAP, cards.length - cap)) + " أخرى</button>";
    }
    h += "</div>";
  });
  return h + "</div>";
}

/* ================================ DRAWER ================================ */
function opValidate(key, v) {
  var s = String(v == null ? "" : v).trim();
  if (key === "sale_price") { if (s === "") return ""; var p = Number(s); return isFinite(p) && p >= 0 ? "" : "أدخل سعرًا صفرًا أو أكبر."; }
  if (key === "years") { var y = Number(s); return s !== "" && Math.floor(y) === y && y >= 1 && y <= 20 ? "" : "السنوات عدد صحيح من ١ إلى ٢٠."; }
  if (key === "qty") { var q = Number(s); return s !== "" && Math.floor(q) === q && q >= 1 ? "" : "الكمية عدد صحيح من ١ فأكثر."; }
  if (key === "discount") { if (s === "") return ""; var d = Number(s); return isFinite(d) && d >= 0 && d <= 100 ? "" : "الخصم بين ٠ و١٠٠."; }
  if (key === "owner") return s.length <= 60 ? "" : "اسم المسؤول أطول من ٦٠ حرفًا.";
  if (key === "next_step") return s.length <= 300 ? "" : "الخطوة أطول من ٣٠٠ حرف.";
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
function opField(l, key, label, type) {
  var id = "oxd_" + key + "_" + l.id, sk = l.id + ":" + key, st = opFState[sk];
  var cur = l[key] == null ? "" : l[key];
  if (key === "sale_price" && Number(cur) === 0) cur = "";
  var val = st && st.s !== "saved" ? st.v : cur;
  var num = type === "number";
  var rng = key === "years" ? ' min="1" max="20" step="1"' : key === "discount" ? ' min="0" max="100"' : key === "qty" ? ' min="1" step="1"' : key === "sale_price" ? ' min="0"' : "";
  return '<div class="ox-fld"><div class="ox-lr"><label for="' + id + '">' + label + "</label>" + opFieldStatus(sk, id) + "</div>" +
    '<input class="inp' + (num ? " num" : "") + '" id="' + id + '" type="' + (num ? "number" : "text") + '"' + rng +
    (num ? ' inputmode="decimal"' : "") +
    (key === "sale_price" ? ' placeholder="بلا سعر"' : key === "owner" ? ' placeholder="بلا مسؤول" list="oxowners2"' : key === "next_step" ? ' placeholder="ما الذي يجب فعله بعد؟"' : "") +
    ' value="' + esc(val) + '"' + (st && (st.s === "invalid" || st.s === "failed") ? ' aria-invalid="true"' : "") +
    ' aria-describedby="' + id + '_s" onchange="opSaveField(' + l.id + ',&quot;' + key + '&quot;,this.value)"></div>';
}
function opDrawerShell(labelId, head, body, foot) {
  var cls = opDrShown ? " in" : "";
  return '<div class="ox-scrim' + cls + '" onclick="opCloseDrawer()"></div>' +
    /* Plain divs, not aside/header/footer: the shell styles those ELEMENTS (the rail is an aside that
       becomes a centred top bar on a phone), and the drawer inherited it — its header rendered 216px
       wide inside a 390px drawer. */
    '<div class="ox-dr' + cls + '" role="dialog" aria-modal="true" aria-labelledby="' + labelId + '">' +
    '<div class="ox-dh">' + head + '<button class="ox-x" id="oxclose" aria-label="إغلاق" onclick="opCloseDrawer()">' + opIco("x") + "</button></div>" +
    '<div class="ox-db" id="oxdb" onscroll="opDrScroll=this.scrollTop">' + body + "</div>" +
    '<div class="ox-df">' + foot + "</div></div>";
}
function opDetailDrawer(l) {
  var st = opStage(l.stage);
  var open = opOpenStages();
  var idx = -1; open.forEach(function (s, i) { if (s.key === l.stage) idx = i; });
  var head = '<div class="tt"><h2 id="oxdrt" tabindex="-1">' + esc(l.account_name) + "</h2>" +
    '<div class="st"><span>' + esc(l.product) + "</span>" +
    (l.created_by === "المساعد" ? '<span class="ox-auto">تلقائي</span>' : "") + "</div></div>";
  var b = "";
  /* المرحلة */
  var ssk = l.id + ":stage";
  b += '<section class="ox-sec" aria-labelledby="oxsec_st"><div class="ox-lr"><div class="ox-sech" id="oxsec_st">المرحلة</div>' + opFieldStatus(ssk, "oxd_stage_" + l.id) + "</div>";
  if (opIsOpen(l)) {
    b += '<div class="ox-track" aria-hidden="true">' + open.map(function (s) {
      return '<i class="' + (s.key === l.stage ? "on" : "") + '" title="' + esc(s.label) + '" onclick="opSetStage(' + l.id + ',&quot;' + s.key + '&quot;)"></i>';
    }).join("") + "</div>";
    b += '<div class="ox-stnow">' + opDot(l.stage) + "<b>" + esc(st.label) + "</b>" +
      '<span class="ox-sub">المرحلة ' + fmtN(idx + 1) + " من " + fmtN(open.length) + "، " + opAgo(l) + "</span>" +
      (opStalled(l) ? '<span class="ox-warn">' + opIco("warn") + "متوقفة — تجاوزت " + opNDay(OPP_STALL_DAYS) + "</span>" : "") + "</div>";
    b += '<div class="ox-strow">' +
      opSelect("oxd_stage_" + l.id, "نقل إلى مرحلة", l.stage, OPP_ST.map(function (s) { return [s.key, s.label]; }), false, "opSetStageSel") +
      '<button class="btn btn-ghost" onclick="opSetStage(' + l.id + ',&quot;' + opWonKey() + '&quot;)">' + opIco("check") + "أُغلقت ربحًا</button>" +
      '<button class="btn btn-ghost" onclick="opSetStage(' + l.id + ',&quot;' + opLostKey() + '&quot;)">أُغلقت خسارة</button></div>';
  } else {
    b += '<div class="ox-strow"><span class="ox-out ' + (opIsWon(l) ? "won" : "lost") + '">' + (opIsWon(l) ? opIco("check") + "أُغلقت ربحًا" : "أُغلقت خسارة") + "</span>" +
      '<span class="ox-sub">' + opAgo(l) + '</span><span style="flex:1"></span>' +
      '<button class="btn btn-ghost" onclick="opSetStage(' + l.id + ',&quot;' + open[open.length - 1].key + '&quot;)">إعادة فتح</button></div>';
  }
  b += "</section>";
  /* القيمة */
  var disc = Number(l.discount || 0);
  b += '<section class="ox-sec" aria-labelledby="oxsec_v"><div class="ox-sech" id="oxsec_v">القيمة</div>';
  b += opPriced(l)
    ? '<div class="ox-vfig">' + opMoney(opValue(l)) + "</div>" +
      '<div class="ox-form"><bdi>' + fmtN(Number(l.sale_price)) + " ر.س سنويًا × " + opNYear(Number(l.years || 1)) + " × " + fmtN(Number(l.qty || 1)) +
      (disc ? " × (١ − " + fmtN(disc) + "٪)" : "") + "</bdi></div>"
    : '<div class="ox-vfig unp">' + OPP_UNPRICED + '</div><div class="ox-form">أدخل السعر السنوي ليُحسب البند ويدخل في المجاميع.</div>';
  b += '<div class="ox-g2">' + opField(l, "sale_price", "السعر السنوي (ر.س)", "number") + opField(l, "years", "السنوات", "number") +
    opField(l, "qty", "الكمية", "number") + opField(l, "discount", "الخصم ٪", "number") + "</div>";
  if (disc > 50) b += '<div class="ox-hint">' + opIco("warn") + "خصم مرتفع: " + fmtN(disc) + "٪ من السعر السنوي. تأكّد أنه مقصود.</div>";
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
    (l.source === "whatsapp" && l.phone ? '<dt>المحادثة</dt><dd><a class="ox-lnk" href="#customer/' + esc(l.phone) + '">فتح المحادثة ←</a></dd>' : "") +
    (l.phone ? '<dt>الجوال</dt><dd><bdi dir="ltr">+' + esc(l.phone) + "</bdi></dd>" : "") +
    "<dt>سجّلها</dt><dd>" + (l.created_by ? esc(l.created_by) : '<span class="ox-none">—</span>') + "</dd>" +
    "<dt>أُنشئت</dt><dd>" + (l.created_at ? fmtD(l.created_at) : "—") + "</dd>" +
    "<dt>آخر تحديث</dt><dd>" + (l.updated_at ? fmtD(l.updated_at) : "—") + "</dd></dl></section>";
  /* بنود أخرى لهذه الجهة */
  var key = opKey(l);
  var rel = (oppRows || []).filter(function (o) { return o.id !== l.id && opKey(o) === key; });
  if (rel.length) {
    b += '<section class="ox-sec" aria-labelledby="oxsec_r"><div class="ox-sech" id="oxsec_r">بنود أخرى لهذه الجهة (' + fmtN(rel.length) + ')</div><div class="ox-rel">' +
      rel.map(function (o) {
        return '<button class="ox-relr" onclick="opSwitchLine(' + o.id + ')"><span class="p">' + esc(o.product) + "</span>" +
          '<span class="s">' + opDot(o.stage) + esc(opStage(o.stage).label) + "</span>" +
          '<span class="v">' + (opPriced(o) ? opMoney(opValue(o)) : '<span class="ox-none">' + OPP_UNPRICED + "</span>") + "</span></button>";
      }).join("") + "</div></section>";
  }
  var foot = (opDelErr ? '<span class="ox-derr" role="alert">' + opIco("warn") + esc(opDelErr) + "</span>" : "") +
    (l.phone ? '<a class="btn btn-ghost" href="#customer/' + esc(l.phone) + '" style="text-decoration:none;">ملف العميل ←</a>' : "") +
    '<span class="sp"></span>' +
    '<button class="rv-hold" data-do="opDel" data-arg="' + l.id + '" data-idle="حذف البند" data-holding="استمر بالضغط للحذف…" data-armed="اضغط مرة أخرى للحذف"' +
    ' aria-pressed="false" title="اضغط مع الاستمرار للحذف"><span class="rv-fill"></span><span class="rv-lbl">حذف البند</span></button>';
  return opDrawerShell("oxdrt", head, b, foot);
}

function opCreateDrawer() {
  var d = opSheet;
  var reg = tagList();
  var head = '<div class="tt"><h2 id="oxdrt" tabindex="-1">إضافة فرصة</h2><div class="st">جهة واحدة، ومنتج أو أكثر — ومن أين جاءت</div></div>';
  var errOf = function (f) { return opErrFld === f ? ' aria-invalid="true"' : ""; };
  var b = '<section class="ox-sec"><div class="ox-sech">الجهة</div>';
  b += '<div class="ox-fld"><label for="opd_name">اسم الجهة <span class="req" aria-hidden="true">*</span></label>' +
    '<input class="inp" id="opd_name" list="opaccts" value="' + esc(d.name) + '" placeholder="مثال: مجمع الرعاية الطبي" aria-required="true"' + errOf("name") +
    ' oninput="opDraft(&quot;name&quot;,this.value)"></div>';
  var accts = entities.slice(0, 400);
  b += '<datalist id="opaccts">' + accts.map(function (e) { return '<option value="' + esc(e.name) + '"></option>'; }).join("") + "</datalist>";
  b += '<div class="ox-g2"><div class="ox-fld"><label for="opd_phone">الجوال (اختياري)</label>' +
    '<input class="inp" id="opd_phone" value="' + esc(d.phone) + '" placeholder="9665…" dir="ltr"' + errOf("phone") + ' oninput="opDraft(&quot;phone&quot;,this.value)"></div>' +
    '<div class="ox-fld"><label for="opd_owner">المسؤول (اختياري)</label>' +
    '<input class="inp" id="opd_owner" list="oxowners2" value="' + esc(d.owner || "") + '" placeholder="بلا مسؤول" oninput="opDraft(&quot;owner&quot;,this.value)"></div></div>' +
    '<datalist id="oxowners2">' + opOwners().map(function (o) { return '<option value="' + esc(o) + '"></option>'; }).join("") + "</datalist>";
  b += "</section>";
  b += '<section class="ox-sec"><div class="ox-sech" id="opd_srcl">مصدر الفرصة</div><div class="ox-srcs" role="radiogroup" aria-labelledby="opd_srcl">' +
    Object.keys(OPP_SRC).filter(function (k) { return k !== "other"; }).map(function (k) {
      return '<button role="radio" aria-checked="' + (d.source === k) + '" onclick="opDraftSrc(&quot;' + k + '&quot;)">' + opIco(k) + esc(OPP_SRC[k]) + "</button>";
    }).join("") + "</div>";
  if (d.source === "whatsapp") {
    b += '<div class="ox-fld"><label for="opd_camp">من أي حملة؟</label><span class="ox-f ox-fw"><select id="opd_camp" onchange="opDraft(&quot;source_ref&quot;,this.value)">' +
      '<option value="">— لم تُحدَّد —</option>' +
      (campaigns || []).map(function (cp) {
        return '<option value="' + esc(cp.id) + '"' + (String(d.source_ref) === String(cp.id) ? " selected" : "") + ">" + esc(clip(cp.name, 48)) + "</option>";
      }).join("") + '</select><span class="ox-chev">' + opIco("chevD") + "</span></span></div>";
  }
  b += "</section>";
  var total = 0, unp = 0;
  b += '<section class="ox-sec"><div class="ox-sech">المنتجات</div>';
  d.lines.forEach(function (l, i) {
    var v = opValue(l); total += v; if (!opPriced(l)) unp++;
    var fid = function (k) { return "opd_" + k + "_" + i; };
    var numF = function (k, label, rng, ph) {
      return '<div class="ox-fld"><label for="' + fid(k) + '">' + label + "</label>" +
        '<input class="inp num" id="' + fid(k) + '" type="number" inputmode="decimal"' + rng + (ph ? ' placeholder="' + ph + '"' : "") +
        ' value="' + esc(l[k]) + '"' + errOf(k + "_" + i) + ' oninput="opLineSet(' + i + ',&quot;' + k + '&quot;,this.value)"></div>';
    };
    b += '<div class="ox-lblk"><div class="hd"><span>المنتج ' + fmtN(i + 1) + "</span>" +
      (d.lines.length > 1 ? '<button onclick="opLineDel(' + i + ')">إزالة</button>' : "") + "</div>" +
      '<div class="ox-fld"><label for="' + fid("product") + '">المنتج <span class="req" aria-hidden="true">*</span></label>' +
      '<span class="ox-f ox-fw"><select id="' + fid("product") + '"' + errOf("product_" + i) + ' onchange="opLineSet(' + i + ',&quot;product&quot;,this.value)">' +
      '<option value="">— اختر المنتج —</option>' +
      reg.map(function (t) { return '<option value="' + esc(t.name) + '"' + (l.product === t.name ? " selected" : "") + ">" + esc(t.name) + "</option>"; }).join("") +
      '</select><span class="ox-chev">' + opIco("chevD") + "</span></span></div>" +
      '<div class="ox-g2">' + numF("sale_price", "السعر السنوي (ر.س)", ' min="0"', "بلا سعر") + numF("years", "السنوات", ' min="1" max="20" step="1"', "") +
      numF("qty", "الكمية", ' min="1" step="1"', "") + numF("discount", "الخصم ٪", ' min="0" max="100"', "٠") + "</div>" +
      '<div class="ox-total"><span class="ox-sech">قيمة البند</span><span class="lv' + (opPriced(l) ? "" : " unp") + '">' + (opPriced(l) ? opMoney(v) : OPP_UNPRICED) + "</span></div></div>";
  });
  b += '<button class="ox-arow" onclick="opLineAdd()">' + opIco("plus") + "منتج آخر</button>";
  b += '<div class="ox-total"><span class="ox-lbl">قيمة الفرصة' + (unp && total ? "، " + opNLine(unp) + " بلا تسعير" : "") + "</span>" +
    (total ? '<span class="v">' + opMoney(total) + "</span>" : '<span class="v ox-none" style="font-size:var(--t-md);">' + OPP_UNPRICED + "</span>") + "</div>";
  b += "</section>";
  var foot = (opErr ? '<span class="ox-derr" role="alert">' + opIco("warn") + esc(opErr) + "</span>" : "") +
    '<button class="btn btn-teal" id="opd_submit" style="min-width:132px;justify-content:center;" onclick="opSubmit()"' + (oppBusy ? ' disabled aria-busy="true"' : "") + ">" +
    (oppBusy ? "جارٍ الحفظ…" : "إنشاء الفرصة") + "</button>" +
    '<button class="btn btn-ghost" onclick="opCloseDrawer()">إلغاء</button>';
  return opDrawerShell("oxdrt", head, b, foot);
}

/* After every paint: play the drawer entrance once, restore its scroll, move focus in. */
function opAfterRender() {
  var dr = document.querySelector(".ox-dr");
  if (!dr) return;
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
        e.preventDefault(); opRender(); var hb = document.querySelector(".ox-df .rv-hold"); if (hb) hb.focus(); return;
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
  /* #opps/<id> is the shareable record URL: it opens that line's drawer. */
  var hid = Number(((location.hash || "").split("/")[1]) || 0);
  if (hid && oppRows && opOpen !== hid && !opSheet) {
    if (oppRows.some(function (o) { return o.id === hid; })) { opOpen = hid; opDrShown = false; opDrScroll = 0; }
  }
  var h = '<div class="ox">';
  if (oppRows === null && !oppFailed) {
    h += '<section class="ox-sum" aria-busy="true"><div><div class="ox-lbl">القيمة المفتوحة</div><div class="ox-fig none">—</div><div class="ox-bar"></div></div></section>';
  } else if (oppRows) {
    h += opSummary();
  }
  h += '<section class="ox-led" aria-label="بنود الفرص">' + opToolbar();
  if (oppFailed && !oppRows) {
    h += '<div class="ox-state" role="alert">تعذّر تحميل الفرص.<span class="s">لم يُعرض شيء لأن الطلب فشل، لا لأن السجل فارغ.</span>' +
      '<button class="btn btn-ghost" onclick="opRetry()">أعد المحاولة</button></div>';
  } else if (oppRows === null) {
    h += opSkeleton(5);
  } else {
    if (oppFailed) h += '<div class="ox-state" role="alert" style="padding:var(--s2);">' + opIco("warn") + "تعذّر تحديث الفرص — المعروض آخر نسخة محمّلة." + '<button class="btn btn-ghost" onclick="opRetry()">أعد المحاولة</button></div>';
    h += opWaRow();
    h += opMode === "kanban" ? opKanbanView() : opListView();
  }
  h += "</section></div>";
  if (opSheet) h += opCreateDrawer();
  else if (opOpen && oppRows) {
    var l = oppRows.find(function (x) { return x.id === opOpen; });
    if (l) h += opDetailDrawer(l);
  }
  setTimeout(opAfterRender, 0);
  return h;
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
window.opSetMode = function (v) { if (opMode === v) return; opMode = v; opResetScope(); opRender(); };
window.opSetSort = function (v) { opSort = v; opResetScope(); opRender(); };
window.opSetStg = function (v) { opStg = opStg === v && v !== "all" ? "all" : v; opResetScope(); opRender(); };
window.opSetSrc = function (v) { opSrc = v; opResetScope(); opRender(); };
window.opSetOwn = function (v) { opOwn = v; opResetScope(); opRender(); };
window.opSetShort = function (v) { opShort = opShort === v ? "" : v; opResetScope(); opRender(); };
window.opSetStat = function (v) { opStat = v; opRender(); };
window.opClearFilters = function () { opQ = ""; opSrc = "all"; opOwn = "all"; opStg = "all"; opShort = ""; opResetScope(); opRender(); };
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
  opOpen = id; opOpener = opener || "";
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
window.opSwitchLine = function (id) { opDelErr = ""; opDrScroll = 0; opOpen = id; try { history.replaceState(null, "", "#opps/" + fmtId(id)); } catch (e) {} opRender(); };
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
window.opSaveField = async function (id, key, val) {
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
  if (opFState[sk] && opFState[sk].s === "pending") { opFQueue[sk] = val; opFState[sk].v = val; return; }
  opFState[sk] = { s: "pending", v: val }; opRender();
  var body = {}; body[key] = norm;
  var ok = false;
  try {
    var r = await fetch("/admin/opps/" + fmtId(id), {
      method: "PATCH", headers: { "x-admin-token": TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    var j = await r.json();
    if (r.ok && j.ok) {
      ok = true;
      oppRows = (oppRows || []).map(function (o) { return o.id === j.opp.id ? j.opp : o; });
    }
  } catch (e) { ok = false; }
  if (ok) {
    opFState[sk] = { s: "saved", v: val };
    setTimeout(function () { if (opFState[sk] && opFState[sk].s === "saved") { delete opFState[sk]; opRender(); } }, 1600);
  } else {
    opFState[sk] = { s: "failed", v: val };
    var nm = l.account_name;
    if (opOpen !== id) opToast("لم يُحفظ تعديل على «" + nm + "»", true, "فتح البند", function () { window.opOpenLine(id, ""); });
  }
  opRender();
  if (opFQueue[sk] !== undefined) { var nv = opFQueue[sk]; delete opFQueue[sk]; void window.opSaveField(id, key, nv); }
};
window.opRetryField = function (id, key) {
  var st = opFState[id + ":" + key]; if (!st) return;
  var v = st.v; delete opFState[id + ":" + key]; void window.opSaveField(id, key, v);
};
window.opDiscardField = function (id, key) { delete opFState[id + ":" + key]; opRender(); };
window.opSetStage = function (id, stage) { return window.opSaveField(id, "stage", stage); };
window.opSetStageSel = function (v) { if (opOpen) void window.opSaveField(opOpen, "stage", v); };

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
  opSheet = { name: "", phone: "", source: "call", source_ref: "", owner: "", lines: [opBlankLine()] };
  opOpen = 0; opErr = ""; opErrFld = ""; opDrShown = false; opDrScroll = 0; opOpener = opener || "oxadd";
  opRender();
};
window.opDraft = function (k, v) { opSheet[k] = v; opErr = ""; opErrFld = ""; if (k === "source") opRender(); };
window.opDraftSrc = function (k) { opSheet.source = k; if (k !== "whatsapp") opSheet.source_ref = ""; opRender(); };
window.opLineSet = function (i, k, v) { opSheet.lines[i][k] = v; opErr = ""; opErrFld = ""; opRender(); };
window.opLineAdd = function () { opSheet.lines.push(opBlankLine()); opRender(); };
window.opLineDel = function (i) { opSheet.lines.splice(i, 1); opRender(); };
/* Prefill from a reply the assistant already read: account, number, the service it asked about and
   the campaign that reached it — every value already in the ledger. The form asks only what it is
   worth. */
window.opFromContact = function (phone, opener) {
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
  var idMap = { name: "opd_name", phone: "opd_phone" };
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
        source: d.source, source_ref: d.source === "whatsapp" ? d.source_ref : "",
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
