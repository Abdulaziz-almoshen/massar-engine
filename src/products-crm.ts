// products-crm.ts — «المنتجات»: ONE products section (V5, Sep 2026). The catalogue, each product's
// record (performance, prices, targets, knowledge and files), create/edit/rename/archive, and the
// proposal-skill download. «معرفة الخدمة» (#kb) was merged into it; #kb routes redirect here.
//
// Earlier header, kept for its history:
//
// This is the screen the sector layer and the package layer were built FOR. Both shipped as
// endpoints with no UI, which meant everything behind them was invisible: the founder opened the
// product and correctly said he could not see any difference.
//
// It is the first screen written on crm-primitives.ts, which was extracted in this same cycle
// precisely so a new screen would not copy a fifth status dot and a third progress bar.
//
// NO BACKTICKS ANYWHERE IN THIS FILE, comments included: it is one template literal and a backtick
// ends it. That has happened four times on this project.

export const PRODUCTS_CRM_CSS = `
/* ============================================================================
   NOT PORTED, AND DELIBERATELY SO. Three surfaces this module draws render
   OUTSIDE the .ds6 subtree and still belong to the old system:
     · vExecBand()      — a band inside «الرئيسية»'s old numbered sections
     · pxReadinessBand()— painted into #subnav by dashboard.ts, above #body
     · pcQuarterChart() — the exec band's own chart
   Their rules are kept verbatim below. Everything else on this page is the
   m-* vocabulary, and the rules that used to draw it are gone.
   ============================================================================ */
/* ===== THE EXEC ROW =====
   An audit of the live الرئيسية found 108 of its 140 visible strings set at 12px: one 96px figure
   on the deck and then a flat field of identical small text. A page with two type sizes has no
   hierarchy, it has a headline and a footnote. This row builds the MIDDLE tier the page was
   missing — name at --t-sm/700, figure at --t-lg/700, share at --t-xl/800 — so a reader scanning
   the body lands on figures instead of on a wall. */
.ex-rows{background:var(--paper);border-radius:var(--r-win,14px);overflow:hidden}
.ex-row{display:grid;grid-template-columns:minmax(0,1.3fr) 150px 140px minmax(120px,1fr) 78px;
  align-items:center;gap:var(--s3);width:100%;padding:var(--s3) var(--s4);text-align:start;
  font-family:inherit;background:none;border:0;border-block-start:1px solid var(--line-soft);
  color:inherit;transition:background 120ms var(--ease-out)}
.ex-rows > .ex-row:first-child{border-block-start:0}
.ex-row.go{cursor:pointer}
@media (hover:hover) and (pointer:fine){.ex-row.go:hover{background:var(--surface)}}
@media (hover:none){.ex-row.go:hover{background:none}}
.ex-row.go:active{transform:scale(.995)}
.ex-row:focus-visible{outline:none;background:var(--accent-wash);box-shadow:inset 0 0 0 2px var(--accent)}
.ex-row .nm{font-size:var(--t-sm);font-weight:700;color:var(--ink);min-width:0;overflow-wrap:anywhere}
.ex-row .nm em{display:block;font-style:normal;font-size:var(--t-xs);font-weight:400;color:var(--muted);margin-block-start:3px}
.ex-row .fig{font-size:var(--t-lg);font-weight:700;color:var(--fig);font-variant-numeric:tabular-nums}
.ex-row .of{font-size:var(--t-xs);color:var(--muted);font-variant-numeric:tabular-nums}
.ex-row .fig.none,.ex-row .of.none{color:var(--muted);font-weight:400;font-size:var(--t-sm)}
.ex-row .trk{height:10px;border-radius:var(--r-pill);background:var(--surface-2);overflow:hidden;
  box-shadow:var(--well)}
.ex-row .trk i{display:block;height:100%;border-radius:var(--r-pill);background:var(--accent);
  box-shadow:var(--fill-face);transition:width var(--slow) var(--ease)}
.ex-row .pct{font-size:var(--t-xl);font-weight:800;font-variant-numeric:tabular-nums;text-align:start;line-height:1}
.ex-row .pct.none{font-size:var(--t-lg);color:var(--muted);font-weight:400}
@media (prefers-reduced-motion:reduce){.ex-row .trk i{transition:none}.ex-row.go:active{transform:none}}
@media (max-width:900px){
  .ex-row{grid-template-columns:minmax(0,1fr) auto;row-gap:8px}
  .ex-row .trk{grid-column:1 / -1}
}

.pc-g3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--s3);
  align-items:stretch;margin-block-end:var(--s4)}
.pc-g3 .sh-sec.card3{margin-block-end:0;background:var(--paper,#fff);
  border:1px solid var(--line,#D8DCE3);border-radius:var(--r-lg,12px);
  padding:var(--s3) var(--s4) var(--s4);display:flex;flex-direction:column;min-width:0}
/* The note is the card's footer, so it sits at the bottom however tall the chart above it is. */
.pc-g3 .sh-sec.card3 .pc-note{margin-block-start:auto;padding-block-start:var(--s3)}
/* Inside a third of the width these two lose their long-form room. */
.pc-g3 .sh-hs{margin-block-end:var(--s3);max-width:none}
.pc-g3 .pcq{height:132px}
.pc-g3 .pcq .sub2{display:none}
.pc-g3 .sh-cards{gap:var(--s2)}
/* 1024, not 1280. The breakpoint is on the VIEWPORT but the grid lives in the CONTENT column,
   which is ~244px of rail plus padding narrower — so a 1280px laptop has ~980px here and fits
   three ~310px reports comfortably. Breaking at 1280 handed two columns to almost every laptop,
   which is not the standard that was asked for. */
@media (max-width:1023px){ .pc-g3{grid-template-columns:repeat(2,minmax(0,1fr))} }
@media (max-width:560px){ .pc-g3{grid-template-columns:minmax(0,1fr)} }

/* ---- the sector chart ----
   Horizontal bars, not columns. Sector names are long Arabic phrases, and DESIGN.md 6.5 is blunt
   about it: a label you truncate is a label you did not draw, so if the category name does not fit
   across, the chart is the wrong orientation. Each bar is direct-labelled with its name and its
   figure, which also removes the need for a colour-only legend (6.4). */
.pcs{display:flex;flex-direction:column;gap:var(--s3);padding:var(--s2) 0 var(--s1)}
.pcs .r{display:grid;grid-template-columns:minmax(96px,auto) 1fr minmax(72px,auto);
  gap:var(--s3);align-items:center;font-family:inherit;text-align:start;
  background:none;border:none;padding:0;width:100%}
.pcs .r.go{cursor:pointer}
.pcs .nm{font-size:12px;font-weight:600;color:var(--ink,#14161A);white-space:nowrap;
  display:flex;flex-direction:column;gap:2px}
.pcs .nm em{font-style:normal;font-weight:450;color:var(--muted,#656B76)}
.pcs .bar{height:22px;border-radius:var(--r-sm,6px);background:var(--surface,#EFF1F5);
  overflow:hidden;display:flex}
.pcs .bar i{display:block;height:100%;border-radius:var(--r-sm,6px)}
.pcs .bar .won{background:var(--accent,#2563EB)}
.pcs .bar .open{background:var(--blue-light,#5B8DEF)}
.pcs .fig{font-size:12px;font-weight:600;color:var(--ink,#14161A);
  font-variant-numeric:tabular-nums;white-space:nowrap;text-align:end}
.pcs .fig.none{color:var(--muted,#656B76);font-weight:450}
.pcs .r.go:hover .nm{color:var(--accent-deep,#1A47BE)}
.pcs-lg{display:flex;gap:var(--s4);flex-wrap:wrap;padding-block-start:var(--s2);
  font-size:12px;color:var(--muted,#656B76)}
.pcs-lg span{display:inline-flex;align-items:center;gap:7px}
.pcs-lg i{width:10px;height:10px;border-radius:3px;flex:none}
.pcs-lg .s-won{background:var(--accent,#2563EB)}
.pcs-lg .s-open{background:var(--blue-light,#5B8DEF)}
@media (max-width:560px){ .pcs .r{grid-template-columns:1fr auto;row-gap:6px}
  .pcs .bar{grid-column:1 / 3} }

/* ---- the quarter chart ----
   Columns, not tiles. A tile gives every quarter the same area regardless of what it holds; a
   column's HEIGHT is the number, which is the whole point (DESIGN.md 6.1). */
.pcq{display:flex;align-items:stretch;gap:var(--s3);height:148px;padding:var(--s1) var(--s1) 0}
.pcq .col{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:var(--s1)}
.pcq .val{font-size:12px;font-weight:600;color:var(--ink,#14161A);white-space:nowrap;
  font-variant-numeric:tabular-nums}
/* The plotting area. Both bars sit on the same baseline and share one scale, so their heights are
   directly comparable — a bullet column rather than a stack. */
.pcq .plot{flex:1;width:100%;position:relative;display:flex;align-items:flex-end;justify-content:center}
.pcq .tgt{position:absolute;inset-inline:0;inset-block-end:0;background:var(--surface-2,#E5E8EE);
  border-start-start-radius:var(--r-sm,6px);border-start-end-radius:var(--r-sm,6px)}
.pcq .ach{position:relative;width:56%;background:var(--blue-light,#5B8DEF);
  border-start-start-radius:var(--r-sm,6px);border-start-end-radius:var(--r-sm,6px)}
.pcq .col.now .ach{background:var(--accent,#2563EB)}
/* No target is not a zero bar. Hatching is the product's texture channel for NOT YET, so the
   absence reads even in greyscale. */
.pcq .notgt{position:absolute;inset-inline:0;inset-block-end:0;height:6px;border-radius:var(--r-pill,999px);
  background-color:var(--surface,#EFF1F5);
  background-image:repeating-linear-gradient(115deg,var(--surface-2,#E5E8EE) 0 3px,transparent 3px 7px)}
.pcq .lbl{font-size:12px;color:var(--muted,#656B76);white-space:nowrap}
.pcq .col.now .lbl{color:var(--ink,#14161A);font-weight:600}
.pcq .sub2{font-size:12px;color:var(--muted,#656B76);text-align:center;line-height:1.5}
.pcq-lg{display:flex;gap:var(--s4);flex-wrap:wrap;padding:var(--s3) var(--s1) 0;
  font-size:12px;color:var(--muted,#656B76)}
.pcq-lg span{display:inline-flex;align-items:center;gap:7px}
.pcq-lg i{width:10px;height:10px;border-radius:3px;flex:none}
.pcq-lg .s-ach{background:var(--accent,#2563EB)}
.pcq-lg .s-tgt{background:var(--surface-2,#E5E8EE)}
.pcq-lg .s-no{background-color:var(--surface,#EFF1F5);
  background-image:repeating-linear-gradient(115deg,var(--surface-2,#E5E8EE) 0 3px,transparent 3px 7px)}
@media (max-width:560px){
  .pcq{height:132px;gap:var(--s2)}
  .pcq .sub2{display:none}
}

.pc-note{font-size:12px;color:var(--muted,#656B76);margin-block-start:8px;line-height:1.7;
  padding-inline-start:9px;border-inline-start:2px solid var(--line2,#D8DCE3);max-width:66ch}

.px-cells { display:inline-flex; gap:2px; flex:none; }
.px-cells i { display:block; width:16px; height:6px; border-radius:var(--r-sm); background:var(--s-issued); }
.px-cells i.miss { background-color:var(--surface-2);
  background-image:repeating-linear-gradient(115deg, var(--s-off-mark) 0 1px, transparent 1px 4px); }
.px-cells i.pend { background:var(--s-attn-mark); }

/* The readiness band, which replaces the tab strip on a product record. It lives inside .subnav
   (36px), so it is one line that scrolls sideways rather than a block that grows the header. */
.px-band { display:flex; align-items:center; gap:var(--s2); height:100%; min-width:0; white-space:nowrap; }
.px-band .w { font-size:var(--t-sm); font-weight:600; color:var(--ink); display:inline-flex; align-items:center; gap:var(--s2); flex:none; }
.px-band .w.no { color:var(--s-attn-text); } .px-band .w.ok { color:var(--s-issued-text); }
.px-band .sep { width:1px; height:14px; background:var(--line); flex:none; margin-inline:2px; }
.px-band .it { display:inline-flex; align-items:center; gap:6px; font-size:var(--t-xs); color:var(--muted); flex:none; }
.px-band .it b { font-weight:500; color:var(--ink-2); }
.px-band .it i { width:14px; height:6px; border-radius:var(--r-sm); background:var(--s-issued); display:block; flex:none; }
.px-band .it i.miss { background-color:var(--surface-2); background-image:repeating-linear-gradient(115deg, var(--s-off-mark) 0 1px, transparent 1px 4px); }
.px-band .it i.pend { background:var(--s-attn-mark); }
.px-band .go { font-family:inherit; font-size:var(--t-xs); font-weight:600; color:var(--accent-deep); background:transparent;
  border:none; cursor:pointer; padding-inline:4px; border-radius:var(--r-sm); min-height:26px; }
.px-band .go:hover { text-decoration:underline; }

/* ============================================================================
   THE PORTED SCREENS. Only what the m-* vocabulary genuinely lacks: overlay
   geometry (a drawer, a modal, a menu), one scrolling rail, and the two or
   three block/reset rules a vocabulary of text scales cannot supply.
   ============================================================================ */

/* The readiness cells are shared with the un-ported band, so they keep their
   markup and take the new palette here rather than growing a second function. */
.ds6 .px-cells i { background: var(--m-ok); }
.ds6 .px-cells i.miss { background-color: var(--m-sunk); background-image:
  repeating-linear-gradient(115deg, var(--m-line-2) 0 1px, transparent 1px 4px); }
.ds6 .px-cells i.pend { background: var(--m-warn); }

/* .m-meta is a text scale, not a block: a table cell's sub-line needs the line break. */
.ds6 .m-table .m-meta, .ds6 .m-item .m-meta { display: block; font-weight: 400; }
/* A chip that is also a control. The vocabulary gives it its colour; this gives it a button reset. */
.ds6 button.m-chip { font: inherit; border: 0; cursor: pointer; text-align: start;
  transition: transform var(--m-press) var(--m-ease); }
.ds6 button.m-chip:active { transform: scale(.97); }
.ds6 .px-acts { display: flex; align-items: center; gap: var(--m-2); flex-wrap: wrap; }
.ds6 .px-acts--end { justify-content: flex-end; }
.ds6 .px-meta { flex-wrap: wrap; }
/* A label a screen reader needs and a sighted reader already has from the column head. */
.ds6 .px-sr { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden;
  clip-path: inset(50%); white-space: nowrap; }
/* A segmented control that is a set of independent toggles has to be allowed to wrap. */
.ds6 .px-wrapseg { display: flex; flex-wrap: wrap; }
/* The toolbar's filters. Each control keeps its own width rather than stretching to the row. */
.ds6 .px-filters { display: flex; align-items: center; gap: var(--m-2); flex-wrap: wrap; min-inline-size: 0; }
.ds6 .px-filters .m-input, .ds6 .px-filters .m-select { inline-size: auto; min-inline-size: 148px; }
/* A card's body: the sections inside a record pane are stacked, never crammed. */
.ds6 .px-secb { display: flex; flex-direction: column; gap: var(--m-4); min-inline-size: 0; }
.ds6 .m-dlg__b > * + * { margin-block-start: var(--m-4); }
/* A related-population row is a control, not a link: same row, a button's reset. */
.ds6 button.m-item { font: inherit; inline-size: 100%; background: transparent; border: 0;
  border-block-start: 1px solid var(--m-line); cursor: pointer; text-align: start; color: inherit;
  transition: background var(--m-out) var(--m-ease); }
.ds6 button.m-item:first-child { border-block-start: 0; }
@media (hover: hover) and (pointer: fine) { .ds6 button.m-item:hover { background: var(--m-page); } }
/* A quarter row carries money, not a two-digit count: the value column is given the room. */
.ds6 .px-qrow { grid-template-columns: minmax(0, 1fr) 120px minmax(0, auto); }
/* The tab that needs completing. A dot, because the count beside it is already the figure. */
.ds6 .px-tab-dot { inline-size: 6px; block-size: 6px; border-radius: 50%; background: var(--m-warn); flex: 0 0 auto; }

/* The switcher rail: every live product, current one held. A horizontal scroller
   is not a segmented control and not a tab strip — it is its own thing. */
.ds6 .px-sw { display: flex; gap: var(--m-1); overflow-x: auto; padding-block: var(--m-2);
  scrollbar-width: none; }
.ds6 .px-sw::-webkit-scrollbar { display: none; }
.ds6 .px-sw > .m-btn { flex: 0 0 auto; }
.ds6 .px-sw > .m-btn[aria-current="page"] { background: var(--m-ac-dim);
  border-color: var(--m-ac-line); color: var(--m-ac-deep); }

/* The record's tab rail sticks, so the record never loses its place. */
.ds6 .px-tabs { position: sticky; inset-block-start: 0; z-index: var(--z-sticky, 100);
  background: var(--m-page); margin-block: var(--m-4) var(--m-5); }
.ds6 .px-tabs .m-tab .m-chip { pointer-events: none; }
/* Entering content, so a 4px rise over --m-in — never scale(0): nothing arrives out of nothing. */
.ds6 .px-pane { animation: pxPane var(--m-in) var(--m-ease) both; }
@keyframes pxPane { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

/* The record body: the open tab, with the related-population rail beside it. */
.ds6 .px-rec { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--m-4); align-items: start; }
.ds6 .px-main { display: flex; flex-direction: column; gap: var(--m-4); min-inline-size: 0; }
.ds6 .px-side { display: flex; flex-direction: column; gap: var(--m-4); order: 1;
  background: transparent; color: var(--m-ink-2); }
@media (min-width: 1100px) {
  .ds6 .px-rec { grid-template-columns: minmax(0, 1fr) 320px; }
  .ds6 .px-side { position: sticky; inset-block-start: var(--m-4); order: 0; }
}

/* The approved / draft knowledge text: a bounded, scrollable reading box. */
.ds6 .px-md { max-block-size: 420px; overflow: auto; border: 1px solid var(--m-line);
  border-radius: var(--m-r-ctl); padding: var(--m-4); line-height: 1.9; background: var(--m-paper); }

/* A quarter track that carries «no target» as a texture, not as a zero-width bar. */
.ds6 .px-nott { background-image:
  repeating-linear-gradient(115deg, var(--m-line-2) 0 1px, transparent 1px 4px); }
.ds6 .m-seg-row__b.px-nott i { inline-size: 0; }

/* ---- overlay geometry: a side drawer, a centred modal, an actions menu ---- */
.ds6 .px-scrim { position: fixed; inset: 0; z-index: var(--z-modal, 400);
  background: rgba(11,13,18,.44); opacity: 0; transition: opacity var(--m-out) var(--m-ease); }
.ds6 .px-scrim.in { opacity: 1; }
.ds6 .px-dr { position: fixed; inset-block: 0; inset-inline-start: 0; inline-size: min(520px, 100vw);
  z-index: var(--z-modal, 400); background: var(--m-paper); border-inline-end: 1px solid var(--m-line);
  box-shadow: var(--m-lift); display: flex; flex-direction: column;
  transform: translateX(100%); opacity: 0;
  transition: transform var(--m-out) var(--m-ease), opacity var(--m-out) var(--m-ease); }
[dir="ltr"] .ds6 .px-dr { transform: translateX(-100%); }
.ds6 .px-dr.in, [dir="ltr"] .ds6 .px-dr.in { transform: none; opacity: 1; transition-duration: var(--m-in); }
.ds6 .px-dr .m-dlg__b { flex: 1 1 auto; max-block-size: none; }
.ds6 .px-modal { position: fixed; inset: 0; z-index: var(--z-modal, 400); display: flex;
  align-items: flex-start; justify-content: center; padding: 10vh var(--m-3) var(--m-3);
  pointer-events: none; }
.ds6 .px-modal .box { pointer-events: auto; inline-size: 100%; max-inline-size: 480px; }
.ds6 .px-menu { position: absolute; inset-block-start: calc(100% + 4px); inset-inline-end: 0;
  z-index: var(--z-dropdown, 200); background: var(--m-paper); border: 1px solid var(--m-line);
  border-radius: var(--m-r-ctl); box-shadow: var(--m-lift); min-inline-size: 240px; padding: var(--m-1); }
.ds6 .px-menu button { font: inherit; display: flex; inline-size: 100%; min-block-size: 44px;
  align-items: center; gap: var(--m-2); padding-inline: var(--m-3); background: transparent;
  border: 0; border-radius: var(--m-r-ctl); font-size: 14px; color: var(--m-ink); cursor: pointer;
  text-align: start; }
@media (hover: hover) and (pointer: fine) { .ds6 .px-menu button:hover { background: var(--m-page); } }
.ds6 .px-menu button[aria-disabled="true"] { color: var(--m-faint); cursor: not-allowed; }
.ds6 .px-rel { position: relative; }

@media (prefers-reduced-motion: reduce) {
  .ds6 .px-dr, .ds6 .px-scrim { transition: none; }
  .ds6 .px-pane { animation: none; }
}
`;

export const PRODUCTS_CRM_JS = `
/* Money, via the same helper the performance screen uses, so two screens cannot format one figure
   two ways. Arabic-Indic numerals come from fmtN. */
function pcMoney(n) { return fmtN(Math.round(Number(n) || 0)) + " ر.س"; }
function pcBar(pct, cap) {
  var w = Math.max(0, Math.min(100, Number(pct) || 0));
  return '<div class="crm-bar" style="max-width:' + (cap || 120) + 'px"><i style="width:' + w + '%"></i></div>';
}

/* ============================ products-crm V5 (client) ============================
   ONE products section. The catalogue (tags) is the only registry; knowledge, the intro PDF,
   prices, targets and performance hang off it. Spec: docs/designs/products-v5-spec.md.
   Rules (readiness, eligibility, name validation, coverage, price summary) come from the business
   tier, PRODUCT_DOMAIN_JS, so the list, the record, the wizard and the server agree by construction. */
var pcCat = null, pcSectors = null, pcQuarters = null, pcLoading = false, pcFailed = false;
var pcUnmatched = [], pcSkill = null, pcSectorList = [];
var pxDivF = "all";     /* «القسم» — the company unit that owns the product, not its market sector */
var pcPerf = {}, pcPerfLoading = {}, pcPerfFailed = {};
var pcPerfYear = new Date().getFullYear();
var pcUnmatchedOpen = false;

/* list state — survives opening a record and pressing Back */
var pxQ = "", pxSector = "all", pxReadyF = "all", pxSort = "name", pxShort = "", pxArchived = false, pxOnly = "";
var pxListScroll = 0;
/* record + write state */
var pxKnow = {}, pxKnowLoading = {}, pxKnowFailed = {};
var pxRetired = {}, pxShowRetired = {};
var pxFState = {};            /* "product|field" -> { s: pending|saved|failed|invalid, v, m } */
var pxPkgEdit = null;         /* { product, id (0 = new), d: {name,listPrice,years,scope}, err, busy } */
var pxQConfirm = {};          /* "product|year|quarter" -> true while a clear awaits confirmation */
var pxUp = {};                /* "product|kind" -> { s: busy|failed|done, m } */
var pxMenuOpen = false;
/* The record's open tab. Keyed by product so moving along the switcher rail keeps the section you
   were reading; "" means «take it from the route, else نظرة عامة». */
var pxTab = {};
var pxTabPrev = "";           /* the tab the indicator sat on before this repaint — it glides from there */
var pxSheet = null;           /* create draft */
var pxSheetErr = "", pxSheetBusy = false, pxDrShown = false;
var pxModal = null;           /* { kind:"rename", product, to, impact, err, busy } */
var pxAppr = {};              /* "product" -> { busy, err } */
var pxOpener = "";

function pxT() { return { headers: { "x-admin-token": TOKEN } }; }
function pxJson(method, url, body) {
  /* No Content-Type without a body: Fastify answers 400 «Body cannot be empty when
     content-type is set to application/json» — which is how a DELETE silently did nothing. */
  var headers = body === undefined ? { "x-admin-token": TOKEN } : { "x-admin-token": TOKEN, "Content-Type": "application/json" };
  return fetch(url, { method: method, headers: headers,
    body: body === undefined ? undefined : JSON.stringify(body) })
    .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, j: j || {} }; }); });
}
/* GET with a short retry on a transient failure (network, 502/503/504). The production database is a
   256MB machine that stalls for a few seconds under a burst; one failed read then painted
   «تعذّر تحميل…» for a blip the next request would have survived. 4xx is never retried. */
function pxGet(url) {
  var delays = [700, 2000];
  var attempt = function (i) {
    return fetch(url, pxT()).then(function (r) {
      if (r.ok) return r.json();
      if (i < delays.length && (r.status === 502 || r.status === 503 || r.status === 504)) {
        return new Promise(function (res) { setTimeout(res, delays[i]); }).then(function () { return attempt(i + 1); });
      }
      throw new Error("HTTP " + r.status);
    }, function (e) {
      if (i < delays.length) return new Promise(function (res) { setTimeout(res, delays[i]); }).then(function () { return attempt(i + 1); });
      throw e;
    });
  };
  return attempt(0);
}
function pxEnc(name) { return encodeURIComponent(name); }
function pxMoney(v) { return "<bdi>" + fmtN(Math.round(Number(v) || 0)) + " ر.س</bdi>"; }
function pxPl(n, one, two, few, many) { return pluralizeArabic(n, one, two, few, many, fmtN); }
function pxNProd(n) { return pxPl(n, "منتج واحد", "منتجان", "منتجات", "منتجًا"); }
function pxNLine(n) { return pxPl(n, "بند واحد", "بندان", "بنود", "بندًا"); }
function pxNRowTxt(n) { return pxPl(n, "سطر واحد", "سطران", "أسطر", "سطرًا"); }
function pxNRead(n) { return pxPl(n, "قراءة واحدة", "قراءتان", "قراءات", "قراءة"); }
function pxNQtr(n) { return pxPl(n, "ربع واحد", "ربعان", "أرباع", "ربعًا"); }
function pxNPkg(n) { return pxPl(n, "باقة واحدة", "باقتان", "باقات", "باقة"); }
function pxNCamp(n) { return pxPl(n, "حملة واحدة", "حملتان", "حملات", "حملة"); }
function pxNEnt(n) { return pxPl(n, "جهة واحدة", "جهتان", "جهات", "جهة"); }
function pxIco(n, cls) { return typeof opIco === "function" ? opIco(n, cls) : ""; }
/* The product record is open to everyone with knowledge.view (DOOR_PERMISSIONS.product); writing the
   knowledge is knowledge.edit, the same permission the section editor is gated on. */
function pxMayEditKb() { return typeof meCan !== "function" || meCan("knowledge.edit"); }
function pxToast(msg, bad, act, fn) { if (typeof opToast === "function") opToast(msg, bad, act, fn); else moToast(msg); }

/* The shared product registry (tagReg) feeds the opps drawer, the customers/targets filters and the
   palette. Every create / archive / restore / rename refreshes it so those pickers change without a
   reload (spec: «every mutation updates the shared stores»). */
function pxTagsRefresh() {
  if (typeof tagReg === "undefined") return;
  fetch("/admin/tags", pxT()).then(function (x) { return x.ok ? x.json() : null; })
    .then(function (t) { if (Array.isArray(t)) { tagReg = t; render(false); } }).catch(function () {});
}
function pcLoad(force) {
  if (pcLoading) return;
  if (pcCat && !force) return;
  if (pcFailed && !force) return;
  pcLoading = true;
  var h = pxT();
  pxGet("/admin/products").then(function (j) {
    pcCat = j.products || []; pcUnmatched = j.unmatched || []; pcSkill = j.skill || null;
    pcSectorList = j.sectors || []; pcFailed = false;
  }).catch(function () { pcFailed = true; })
    .then(function () {
      return Promise.all([
        fetch("/admin/sales/sectors", h).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
        fetch("/admin/sales/quarters", h).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
      ]);
    }).then(function (out) {
      if (out && out[0]) pcSectors = out[0];
      if (out && out[1]) pcQuarters = out[1];
      pcLoading = false; render(false);
    });
}
function pcPerfLoad(year, force) {
  if (pcPerfLoading[year]) return;
  if (pcPerf[year] && !force) return;
  if (pcPerfFailed[year] && !force) return;
  pcPerfLoading[year] = true;
  pxGet("/admin/products/performance?year=" + year).then(function (j) {
    var by = {}; (j.byProduct || []).forEach(function (x) { by[x.product] = x; });
    pcPerf[year] = by; pcPerfFailed[year] = false;
  }).catch(function () { pcPerfFailed[year] = true; })
    .then(function () { pcPerfLoading[year] = false; render(false); });
}
function pxKnowLoad(name, force) {
  if (pxKnowLoading[name]) return;
  if (pxKnow[name] && !force) return;
  if (pxKnowFailed[name] && !force) return;
  pxKnowLoading[name] = true;
  pxGet("/admin/products/knowledge?product=" + pxEnc(name)).then(function (j) { pxKnow[name] = j; pxKnowFailed[name] = false; })
    .catch(function () { pxKnowFailed[name] = true; })
    .then(function () { pxKnowLoading[name] = false; render(false); });
}
function pxRow(name) { return (pcCat || []).filter(function (p) { return p.product === name; })[0] || null; }
function pxPrice(p) { return priceSummary(p.packages || [], p.pricingNote || ""); }
function pxReadiness(p) {
  var ps = pxPrice(p);
  return readinessOf({ archived: !!p.archived, kbState: (p.kb && p.kb.state) || "none", hasDraft: !!p.draft,
    embedded: !!p.embedded, hasAsset: !!p.asset, hasPrice: ps.kind !== "none", eligible: !!p.eligible, loadFailed: false });
}
function pxCellsHtml(rd) {
  return '<span class="px-cells" aria-hidden="true">' + rd.cells.map(function (c) {
    return '<i class="' + (c.state === "missing" ? "miss" : c.state === "pending" ? "pend" : "") + '"></i>';
  }).join("") + "</span>";
}
function pxWordCls(rd) { return rd.eligible ? (rd.cells.every(function (c) { return c.state === "done"; }) ? "ok" : "") : "no"; }

/* ---- the related-population predicates. The record's counts and the destination filters use
   THESE, so a count can never disagree with the page it opens. ---- */
function pxOppLines(name) { return (typeof oppRows !== "undefined" && oppRows ? oppRows : []).filter(function (o) { return o.product === name; }); }
function pxOpenLines(name) { return pxOppLines(name).filter(function (o) { return isOpenStage(o.stage); }); }
function pxCampaigns(name) { return (campaigns || []).filter(function (c) { return (c.product || "") === name; }); }
function pxInterest(name) {
  var seen = {};
  ((cache && cache.contacts) || []).forEach(function (c) {
    if (c.test) return;
    if ((c.tags || []).some(function (t) { return t.product === name; })) seen[c.phone] = 1;
  });
  return Object.keys(seen).length;
}
function pxTargeted(name) { return (entities || []).filter(function (e) { return (e.productTags || []).indexOf(name) >= 0; }).length; }

/* ================================ LIST ================================ */
function pxBaseRows() {
  var q = pxQ.trim();
  return (pcCat || []).filter(function (p) {
    if (!!p.archived !== pxArchived) return false;
    if (pxSector === "__none" && p.sectorId) return false;
    if (pxSector !== "all" && pxSector !== "__none" && String(p.sectorId) !== pxSector) return false;
    if (pxDivF === "__none" && p.divisionId) return false;
    if (pxDivF !== "all" && pxDivF !== "__none" && String(p.divisionId) !== pxDivF) return false;
    if (q && p.product.indexOf(q) === -1 && String(p.owner || "").indexOf(q) === -1) return false;
    return true;
  });
}
function pxShortMatch(p) {
  if (pxShort === "notSelling") return !p.eligible;
  if (pxShort === "noPrice") return pxPrice(p).kind === "none";
  if (pxShort === "assumed") return !!p.sectorAssumed;
  return true;
}
function pxReadyMatch(p) {
  if (pxReadyF === "all") return true;
  var rd = pxReadiness(p);
  if (pxReadyF === "notSelling") return !rd.eligible;
  if (pxReadyF === "ready") return rd.eligible && rd.cells.every(function (c) { return c.state === "done"; });
  if (pxReadyF === "gaps") return rd.eligible && rd.cells.some(function (c) { return c.state !== "done"; });
  return true;
}
function pxRows() {
  var perf = pcPerf[pcPerfYear] || {};
  var rows = pxBaseRows().filter(pxShortMatch).filter(pxReadyMatch).filter(function (p) { return !pxOnly || p.product === pxOnly; });
  return rows.sort(function (a, b) {
    var pa = perf[a.product] || {}, pb = perf[b.product] || {};
    if (pxSort === "achieved") return (Number(pb.achieved) || 0) - (Number(pa.achieved) || 0);
    if (pxSort === "open") return (Number(pb.openValue) || 0) - (Number(pa.openValue) || 0);
    if (pxSort === "readiness") return (pxReadiness(a).eligible - pxReadiness(b).eligible) || a.product.localeCompare(b.product, "ar");
    return a.product.localeCompare(b.product, "ar");
  });
}
function pxFiltered() { return pxQ.trim() || pxSector !== "all" || pxDivF !== "all" || pxReadyF !== "all" || pxShort || pxOnly; }

var PX_RAMP = ["var(--accent-deep)", "var(--accent-press)", "var(--accent)", "var(--accent-mark)", "var(--blue-light)", "var(--s-review-text)"];
function pxSummary() {
  var perf = pcPerf[pcPerfYear];
  var rows = pxBaseRows();
  var notSelling = rows.filter(function (p) { return !p.eligible; }).length;
  var noPrice = rows.filter(function (p) { return pxPrice(p).kind === "none"; }).length;
  var assumed = rows.filter(function (p) { return !!p.sectorAssumed; }).length;
  var h = '<section class="ox-sum" aria-label="ملخص المنتجات"><div>';
  h += '<div class="ox-lbl">المحقق ' + arYear(pcPerfYear) + "</div>";
  if (!perf) {
    h += '<div class="ox-fig none">' + (pcPerfFailed[pcPerfYear] ? "تعذّر تحميل الأداء" : "—") + "</div>";
  } else {
    /* ach was accumulated for EVERY product while tgt only for the targeted ones, so the
       printed «٪» was a percentage of a denominator that did not cover its own numerator.
       One population decides the ratio; revenue outside it is stated, never folded in. */
    var ach = 0, tgt = 0, anyT = false, won = [], offA = 0, offN = 0;
    rows.forEach(function (p) {
      var x = perf[p.product]; if (!x) return;
      var a = Number(x.achieved) || 0;
      if (x.annualTarget !== null && x.annualTarget !== undefined) {
        anyT = true; tgt += Number(x.annualTarget) || 0; ach += a;
      } else { offN++; offA += a; }
      if (a > 0) won.push({ n: p.product, v: a });
    });
    var cov = anyT ? targetCoveragePct(ach, tgt) : null;
    h += '<div class="ox-fig">' + pxMoney(ach) + '<span class="ox-figsub">' +
      (anyT
        ? ("من مستهدف " + pxMoney(tgt) + (cov === null ? "" : " · " + fmtN(cov) + "٪") +
           (offN ? " · " + fmtN(offN) + " بلا مستهدف، محققها " + pxMoney(offA) + " خارج النسبة" : ""))
        : "بلا مستهدف سنوي") + "</span></div>";
    if (won.length || (anyT && tgt > 0)) {
      won.sort(function (a, b) { return b.v - a.v; });
      var denom = Math.max(ach, tgt, 1);
      h += '<div class="ox-bar" aria-hidden="true">' + won.map(function (w, i) {
        return '<i style="flex:' + w.v + ' 1 0;background:' + PX_RAMP[i % PX_RAMP.length] + '" title="' + esc(w.n) + '"></i>';
      }).join("") + (tgt > ach ? '<i style="flex:' + (tgt - ach) + ' 1 0;background-color:var(--surface-2);background-image:repeating-linear-gradient(115deg,var(--s-off-mark) 0 1px,transparent 1px 4px)" title="المتبقي حتى المستهدف"></i>' : "") + "</div>";
      if (won.length) {
        h += '<div class="ox-leg" role="group" aria-label="المنتجات المحققة — اضغط للتصفية">' + won.map(function (w, i) {
          var on = pxOnly === w.n;
          return '<button class="ox-lg' + (on ? " on" : "") + '" aria-pressed="' + on + '" data-px="only" data-nm="' + esc(w.n) + '">' +
            '<i class="px-lg-b" style="background:' + PX_RAMP[i % PX_RAMP.length] + '"></i><span>' + esc(w.n) + "</span><b>" + pxMoney(w.v) + "</b></button>";
        }).join("") + "</div>";
      }
      void denom;
    } else {
      h += '<div class="px-note">لا مبيعات مربوحة بعد في ' + arYear(pcPerfYear) + ".</div>";
    }
  }
  h += "</div>";
  var met = function (key, n, label, warn) {
    var on = pxShort === key;
    return '<button class="ox-met' + (on ? " on" : "") + (warn && n ? " warn" : "") + (n ? "" : " zero") + '" aria-pressed="' + on + '" data-px="short" data-nm="' + key + '">' +
      '<span class="n">' + (warn && n ? pxIco("warn") : "") + fmtN(n) + "</span>" +
      '<span class="l">' + (on ? pxIco("check") : "") + label + "</span></button>";
  };
  h += '<div class="ox-mets" role="group" aria-label="ما يلزم إكماله">' +
    met("notSelling", notSelling, "لا يبيعها المساعد", true) +
    met("noPrice", noPrice, "بلا سعر منشور", false) +
    met("assumed", assumed, "قطاع مُستنتَج", false) + "</div>";
  return h + "</section>";
}
function pxSelect(id, label, value, opts, on) {
  return '<span class="ox-f' + (on ? " on" : "") + '"><select id="' + id + '" aria-label="' + label + '" data-pxchange="' + id + '">' +
    opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(value) === String(o[0]) ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") +
    '</select><span class="ox-chev">' + pxIco("chevD") + "</span></span>";
}
function pxToolbar() {
  var nArch = (pcCat || []).filter(function (p) { return p.archived; }).length;
  var h = '<div class="ox-tb" role="toolbar" aria-label="أدوات المنتجات">';
  h += '<span class="ox-srch"><span class="ox-si">' + pxIco("search") + "</span>" +
    '<input id="pxq" class="inp" type="search" value="' + esc(pxQ) + '" data-pxinput="q" aria-label="ابحث باسم المنتج" placeholder="ابحث باسم المنتج"></span>';
  h += '<span class="ox-filt">';
  h += pxSelect("pxf_sector", "القطاع", pxSector, [["all", "كل القطاعات"], ["__none", "بلا قطاع"]].concat(pcSectorList.map(function (s) { return [String(s.id), s.name]; })), pxSector !== "all");
  // «القسم» is the company unit that owns the product; «القطاع» above is the market it sells into.
  // Two different questions, two selects, and the labels are deliberately not interchangeable.
  var divs = (typeof cfDivs !== "undefined" ? cfDivs : []);
  if (divs.length) {
    h += pxSelect("pxf_div", "القسم", pxDivF, [["all", "كل الأقسام"], ["__none", "بلا قسم"]]
      .concat(divs.map(function (d) { return [String(d.id), d.name]; })), pxDivF !== "all");
  }
  h += pxSelect("pxf_ready", "الجاهزية", pxReadyF, [["all", "كل الحالات"], ["notSelling", "لا يبيعها المساعد"], ["gaps", "يبيعها وتنقصها أشياء"], ["ready", "جاهزة للمساعد"]], pxReadyF !== "all");
  h += pxSelect("pxf_sort", "ترتيب", pxSort, [["name", "حسب الاسم"], ["achieved", "الأعلى تحقيقًا"], ["open", "الأعلى مفتوحًا"], ["readiness", "غير الجاهزة أولًا"]], false);
  h += '<button class="px-toggle" aria-pressed="' + pxArchived + '" data-px="archived">' + (pxArchived ? pxIco("check") : "") + "المؤرشفة" + (nArch ? " (" + fmtN(nArch) + ")" : "") + "</button>";
  if (pxFiltered()) h += '<button class="ox-clear" data-px="clear" aria-label="مسح التصفية" title="مسح التصفية">' + pxIco("x") + "مسح</button>";
  h += "</span>";
  h += pxSheet
    ? '<button class="btn btn-ghost ox-add" aria-disabled="true" tabindex="-1">' + pxIco("plus") + "إضافة منتج</button>"
    : '<button class="btn btn-teal ox-add" id="pxadd" data-px="create">' + pxIco("plus") + "إضافة منتج</button>";
  h += '<span class="ox-brk" aria-hidden="true"></span>';
  return h + "</div>";
}
function pxSkillLink(label) {
  if (!pcSkill) return '<span class="fn" data-pxskill="missing">المهارة غير مرفوعة بعد</span>';
  // a download arrow, not a chevron: a chevron beside a link read as a dropdown
  return '<a href="/assets/' + esc(pcSkill.publicId) + '" download data-pxskill="list"><svg class="ox-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>' + label + "</a>";
}
function pxActionRows() {
  var h = "";
  var missing = (pcCat || []).filter(function (p) { return !p.archived && !p.asset; }).length;
  if (missing) {
    h += '<div class="px-actrow">' + pxIco("plus") + "<span><b>" + pxNProd(missing) + "</b> بلا ملف تعريفي — مهارة إعداد العرض تُنتجه بمساعد ذكاء اصطناعي</span>" +
      '<span class="sp"></span>' + (pcSkill ? '<span class="fn"><bdi>' + esc(pcSkill.filename) + "</bdi></span>" : "") + pxSkillLink("تحميل المهارة") + "</div>";
  }
  if (pcUnmatched.length) {
    h += '<div class="px-actrow" style="padding:0;"><button class="px-actrow px-um-h" style="border:none;" aria-expanded="' + pcUnmatchedOpen + '" data-px="unmatched">' +
      pxIco("warn") + "<span>ملفات تحتاج ربطًا بمنتج · <b>" + fmtN(pcUnmatched.length) + '</b></span><span class="sp"></span><span>' + (pcUnmatchedOpen ? "إخفاء" : "عرض") + "</span>" + pxIco("chevD") + "</button></div>";
    if (pcUnmatchedOpen) {
      var tags = (pcCat || []).filter(function (p) { return !p.archived; });
      h += pcUnmatched.map(function (u, i) {
        return '<div class="px-um-r"><span class="nm" title="' + esc(u.name) + '">' + esc(u.name) + "</span>" +
          '<span class="k">' + (u.kind === "kb" ? "ملف معرفة" : "ملف تعريفي") + "</span>" +
          '<span class="fn"><bdi>' + esc(u.filename || "—") + "</bdi></span>" +
          '<span class="acts"><select id="pxum_' + i + '" aria-label="ربط «' + esc(u.name) + '» بمنتج"><option value="">ربط بمنتج…</option>' +
          tags.map(function (t) { return '<option value="' + esc(t.product) + '">' + esc(t.product) + "</option>"; }).join("") + "</select>" +
          '<button class="btn btn-ghost" data-px="reconcile" data-i="' + i + '">ربط</button>' +
          '<button class="btn btn-ghost" data-px="umcreate" data-i="' + i + '">إنشاء منتج بهذا الاسم</button></span></div>';
      }).join("");
    }
  }
  return h;
}
function pxListRow(p) {
  var perf = (pcPerf[pcPerfYear] || {})[p.product];
  var rd = pxReadiness(p), ps = pxPrice(p);
  var nm = esc(p.product);
  var h = '<div class="ox-r" role="row" data-pxrow="' + nm + '">';
  h += '<div class="px-c-nm" role="cell"><span class="px-nm" title="' + nm + '">' + nm + "</span>" +
    '<span class="px-sub">' + (p.sector ? esc(p.sector) : "بلا قطاع") + (p.sectorAssumed ? '<span class="px-read">مُستنتَج</span>' : "") +
    (p.division ? " · " + esc(p.division) : "") +
    (p.owner ? " · " + esc(p.owner) : "") + (p.archived ? '<span class="px-arch">مؤرشف</span>' : "") + "</span></div>";
  h += '<div class="px-ready px-c-rd" role="cell" title="' + esc(rd.word) + '">' + pxCellsHtml(rd) + '<span class="px-rw ' + pxWordCls(rd) + '">' + esc(rd.word) + "</span></div>";
  h += '<div class="px-price px-c-pr" role="cell">' + (ps.kind === "package"
      ? "<b>" + pxMoney(ps.lowest.listPrice) + " / سنة</b><span>" + (ps.count > 1 ? "يبدأ من · " + pxNPkg(ps.count) : esc(ps.lowest.name)) + "</span>"
      : ps.kind === "note" ? '<span style="color:var(--ink-2);font-size:var(--t-sm);white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">' + esc(p.pricingNote) + "</span>"
      : '<span class="none" style="font-size:var(--t-sm);">لا سعر منشور</span>') + "</div>";
  var tgt = perf ? perf.annualTarget : null;
  h += '<div class="px-num px-c-tg" role="cell">' + (!perf ? '<span class="none">—</span>' : tgt === null || tgt === undefined ? '<span class="none">بلا مستهدف</span>' : "<b>" + pxMoney(tgt) + "</b>" + (perf.targetQuarters < 4 ? "<span>" + pxNQtr(perf.targetQuarters) + " من أربعة</span>" : "")) + "</div>";
  var cov = perf ? targetCoveragePct(perf.achieved, tgt) : null;
  h += '<div class="px-num px-c-ach" role="cell">' + (!perf ? '<span class="none">—</span>' :
    "<b>" + pxMoney(perf.achieved) + "</b><span>" + (cov === null ? "—" : fmtN(cov) + "٪ من المستهدف") +
    '<span class="px-tgsub">' + (tgt ? " · من " + pxMoney(tgt) : "") + "</span></span>") + "</div>";
  h += '<div class="px-num px-c-op" role="cell">' + (!perf ? '<span class="none">—</span>' :
    (perf.openLines ? "<b>" + (perf.openValue ? pxMoney(perf.openValue) : "لم تُسعَّر") + "</b><span>" + pxNLine(perf.openLines) + (perf.unpricedOpenLines ? " · " + pxNLine(perf.unpricedOpenLines) + " بلا تسعير" : "") + "</span>" : '<span class="none">لا بنود مفتوحة</span>')) + "</div>";
  h += '<div class="px-c-go" role="cell"><button class="ox-go" data-px="open" data-nm="' + nm + '" aria-label="فتح سجل ' + nm + '">' + pxIco("chevS") + "</button></div>";
  return h + "</div>";
}
function vProductsCrm() {
  pcLoad(false); pcPerfLoad(pcPerfYear, false);
  if (typeof cfLoad === "function") cfLoad(false);   /* the division filter needs «إعدادات النظام» */
  if (typeof opLoad === "function") opLoad(false);
  var h = '<div class="px">';
  if (pcCat === null && !pcFailed) {
    h += '<section class="ox-sum" aria-busy="true"><div><div class="ox-lbl">المحقق ' + arYear(pcPerfYear) + '</div><div class="ox-fig none">—</div></div></section>';
    h += '<section class="ox-led"><div class="ox-state" aria-busy="true">' + moSkeleton(5, ["w80", "w60", "w40"]) + "</div></section>";
    return h + "</div>" + pxSheetHtml();
  }
  if (pcCat) h += pxSummary();
  h += '<section class="ox-led" aria-label="الكتالوج">' + pxToolbar();
  if (pcFailed && !pcCat) {
    h += '<div class="ox-state" role="alert">تعذّر تحميل المنتجات.<span class="s">لم يُعرض شيء لأن الطلب فشل، لا لأن الكتالوج فارغ.</span>' +
      '<button class="btn btn-ghost" data-px="retry">أعد المحاولة</button></div></section></div>';
    return h;
  }
  if (pcFailed) h += '<div class="ox-state" role="alert" style="padding:var(--s2);">' + pxIco("warn") + "تعذّر تحديث المنتجات — المعروض آخر نسخة محمّلة." + '<button class="btn btn-ghost" data-px="retry">أعد المحاولة</button></div>';
  h += pxActionRows();
  var rows = pxRows();
  h += '<div class="ox-t px-t" role="table" aria-label="الكتالوج">';
  h += '<div class="ox-hr" role="row"><div role="columnheader">المنتج</div><div role="columnheader">جاهزية المساعد</div><div role="columnheader">السعر المنشور</div>' +
    '<div class="px-he px-c-tg" role="columnheader">المستهدف ' + arYear(pcPerfYear) + '</div><div class="px-he" role="columnheader">المحقق</div><div class="px-he" role="columnheader">المفتوح الآن</div><div role="columnheader"><span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);">فتح</span></div></div>';
  if (!rows.length) {
    h += '<div class="ox-state">' + ((pcCat || []).length
      ? (pxArchived && !pxFiltered() ? "لا منتجات مؤرشفة." : "لا منتج يطابق التصفية.") + (pxFiltered() ? '<button class="btn btn-ghost" data-px="clear">مسح التصفية</button>' : "")
      : 'لم تُضف منتجات بعد.<span class="s">أضف منتجًا ثم ارفع ملف معرفته ليبيعه المساعد.</span><button class="btn btn-teal" data-px="create">إضافة منتج</button>') + "</div>";
  }
  rows.forEach(function (p) { h += pxListRow(p); });
  h += "</div>";
  if (rows.length) {
    var perf = pcPerf[pcPerfYear] || {};
    var ach = rows.reduce(function (n, p) { return n + (Number((perf[p.product] || {}).achieved) || 0); }, 0);
    h += '<div class="ox-foot"><span class="pgrange"><b>1–' + fmtN(rows.length) + "</b> من " + pxNProd(rows.length) + "</span>" +
      '<span class="tot">المحقق للمعروض <b>' + pxMoney(ach) + "</b>" + (pcSkill && !(pcCat || []).some(function (p) { return !p.archived && !p.asset; }) ? ' · <a class="ox-lnk" href="/assets/' + esc(pcSkill.publicId) + '" download data-pxskill="footer">مهارة إعداد العرض ↓</a>' : "") + "</span></div>";
  }
  h += "</section></div>";
  if (pxListScroll) { var y = pxListScroll; pxListScroll = 0; setTimeout(function () { window.scrollTo(0, y); }, 0); }
  return h + pxSheetHtml();
}

/* ================================ CREATE DRAWER ================================ */
function pxSheetHtml() {
  if (!pxSheet) return "";
  var d = pxSheet, cls = pxDrShown ? " in" : "";
  var nameCheck = d.name.trim() ? normalizeProductName(d.name) : null;
  var exists = nameCheck && nameCheck.ok && (pcCat || []).some(function (p) { return p.product === nameCheck.name; });
  var nameErr = d.touched && d.name.trim() ? (nameCheck && !nameCheck.ok ? nameCheck.reason : exists ? "يوجد منتج بهذا الاسم." : "") : "";
  var h = '<div class="ox-scrim' + cls + '" data-px="sheetclose"></div>';
  h += '<div class="px-dr' + cls + '" role="dialog" aria-modal="true" aria-labelledby="pxdrt">';
  h += '<div class="ox-dh"><div class="tt"><h2 id="pxdrt" tabindex="-1">إضافة منتج</h2><div class="st">يولد المنتج غير جاهز للمساعد، وسجلّه يوضح ما يلزم</div></div>' +
    '<button class="ox-x" data-px="sheetclose" aria-label="إغلاق">' + pxIco("x") + "</button></div>";
  h += '<div class="ox-db">';
  h += '<section class="ox-sec"><div class="ox-sech">المنتج</div>' +
    '<div class="ox-fld"><div class="ox-lr"><label for="pxs_name">اسم المنتج <span class="req" aria-hidden="true">*</span></label></div>' +
    '<input class="inp" id="pxs_name" maxlength="60" value="' + esc(d.name) + '" data-pxsheet="name" aria-required="true"' + (nameErr ? ' aria-invalid="true" aria-describedby="pxs_name_e"' : "") + ' placeholder="مثال: سجل التطعيمات الوطني">' +
    (nameErr ? '<span class="px-err" id="pxs_name_e">' + pxIco("warn") + esc(nameErr) + "</span>" : "") + "</div>" +
    '<div class="ox-g2"><div class="ox-fld"><div class="ox-lr"><label for="pxs_sector">القطاع</label></div><span class="ox-f ox-fw"><select id="pxs_sector" data-pxsheet="sectorId"><option value="">بلا قطاع</option>' +
    pcSectorList.map(function (s) { return '<option value="' + s.id + '"' + (String(d.sectorId) === String(s.id) ? " selected" : "") + ">" + esc(s.name) + "</option>"; }).join("") +
    '</select><span class="ox-chev">' + pxIco("chevD") + "</span></span></div>" +
    '<div class="ox-fld"><div class="ox-lr"><label for="pxs_owner">المسؤول</label></div><input class="inp" id="pxs_owner" maxlength="60" value="' + esc(d.owner) + '" data-pxsheet="owner" placeholder="بلا مسؤول"></div></div>' +
    '<div class="ox-fld"><div class="ox-lr"><label for="pxs_note">ملاحظة التسعير</label></div><input class="inp" id="pxs_note" maxlength="120" value="' + esc(d.pricingNote) + '" data-pxsheet="pricingNote" placeholder="مثال: اشتراك سنوي يحدده المختص وفق الحجم"></div></section>';
  h += '<section class="ox-sec"><div class="ox-sech">الباقة الأولى (اختياري)</div>' +
    '<div class="ox-g2"><div class="ox-fld"><div class="ox-lr"><label for="pxs_pn">اسم الباقة</label></div><input class="inp" id="pxs_pn" maxlength="60" value="' + esc(d.pkgName) + '" data-pxsheet="pkgName" placeholder="الباقة القياسية"></div>' +
    '<div class="ox-fld"><div class="ox-lr"><label for="pxs_ps">النطاق</label></div><input class="inp" id="pxs_ps" maxlength="120" value="' + esc(d.pkgScope) + '" data-pxsheet="pkgScope" placeholder="فرع واحد"></div>' +
    '<div class="ox-fld"><div class="ox-lr"><label for="pxs_pp">السعر السنوي (ر.س)</label></div><input class="inp num" id="pxs_pp" type="number" min="0" step="1" inputmode="numeric" value="' + esc(d.pkgPrice) + '" data-pxsheet="pkgPrice"></div>' +
    '<div class="ox-fld"><div class="ox-lr"><label for="pxs_py">المدة (سنوات)</label></div><input class="inp num" id="pxs_py" type="number" min="1" max="10" step="1" inputmode="numeric" value="' + esc(d.pkgYears) + '" data-pxsheet="pkgYears"></div></div></section>';
  h += "</div>";
  h += '<div class="ox-df">' + (pxSheetErr ? '<span class="ox-derr" role="alert">' + pxIco("warn") + esc(pxSheetErr) + "</span>" : "") +
    '<button class="btn btn-teal" id="pxs_submit" style="min-width:132px;justify-content:center;" data-px="sheetsubmit"' + (pxSheetBusy ? ' disabled aria-busy="true"' : "") + ">" + (pxSheetBusy ? "جارٍ الإنشاء…" : "إنشاء المنتج") + "</button>" +
    '<button class="btn btn-ghost" data-px="sheetclose">إلغاء</button></div></div>';
  setTimeout(function () {
    if (!pxDrShown) {
      pxDrShown = true;
      requestAnimationFrame(function () {
        var s = document.querySelector(".ox-scrim"), dr = document.querySelector(".px-dr");
        if (s) s.classList.add("in"); if (dr) dr.classList.add("in");
        var n = document.getElementById("pxs_name"); if (n) n.focus();
      });
    }
  }, 0);
  return h;
}
function pxSheetSubmit() {
  var d = pxSheet; if (!d || pxSheetBusy) return;
  d.touched = true;
  var nc = normalizeProductName(d.name || "");
  if (!nc.ok) { pxSheetErr = nc.reason; render(false); var f = document.getElementById("pxs_name"); if (f) f.focus(); return; }
  var body = { name: nc.name };
  if (d.sectorId) body.sectorId = Number(d.sectorId);
  if (d.owner.trim()) body.owner = d.owner.trim();
  if (d.pricingNote.trim()) body.pricingNote = d.pricingNote.trim();
  if (d.pkgName.trim()) {
    var price = Number(d.pkgPrice), years = Number(d.pkgYears || 1);
    if (String(d.pkgPrice).trim() === "" || !isFinite(price) || price < 0 || Math.floor(price) !== price) { pxSheetErr = "سعر الباقة عدد صحيح من 0 فأكثر."; render(false); return; }
    if (!(years >= 1 && years <= 10 && Math.floor(years) === years)) { pxSheetErr = "مدة الباقة من 1 إلى 10 سنوات."; render(false); return; }
    body.firstPackage = { name: d.pkgName.trim(), listPrice: price, years: years, scope: d.pkgScope.trim() };
  }
  pxSheetBusy = true; pxSheetErr = ""; render(false);
  pxJson("POST", "/admin/products", body).then(function (r) {
    pxSheetBusy = false;
    if (!r.ok) {
      pxSheetErr = r.j.error === "name_exists" ? "يوجد منتج بهذا الاسم." : r.j.error === "invalid_name" ? (r.j.detail || "اسم غير صالح.") : r.j.detail || "تعذّر إنشاء المنتج (" + fmtN(r.status) + ")";
      render(false); return;
    }
    var name = (r.j.product && r.j.product.product) || nc.name;
    pxSheet = null; pxDrShown = false;
    pcLoad(true); pcPerfLoad(pcPerfYear, true);
    pxTagsRefresh();
    location.hash = "product/" + pxEnc(name);
    pxToast("أُنشئ «" + name + "» — أضف ملف المعرفة ليبيعه المساعد", false);
  }).catch(function () { pxSheetBusy = false; pxSheetErr = "تعذّر الاتصال — لم يُنشأ المنتج."; render(false); });
}

/* ================================ RECORD ================================ */
/* forId: the input this slot reports on — the slot takes id forId_st and the input carries
   aria-describedby to it, so a screen reader hears «تعذّر الحفظ» on the field, not somewhere nearby. */
function pxStatusSlot(key, forId) {
  var st = pxFState[key];
  var ida = forId ? ' id="' + forId + '_st"' : "";
  if (!st) return '<span class="ox-fs"' + ida + ' aria-live="polite"></span>';
  if (st.s === "pending") return '<span class="ox-fs pend"' + ida + ' aria-live="polite">جارٍ الحفظ…</span>';
  if (st.s === "saved") return '<span class="ox-fs ok"' + ida + ' aria-live="polite">' + pxIco("check") + "حُفظ</span>";
  if (st.s === "invalid") return '<span class="ox-fs bad"' + ida + ' aria-live="assertive">' + pxIco("warn") + esc(st.m) + "</span>";
  return '<span class="ox-fs bad"' + ida + ' aria-live="assertive">' + pxIco("warn") + "تعذّر الحفظ" +
    '<button data-px="fretry" data-k="' + esc(key) + '">أعد المحاولة</button><button data-px="fdiscard" data-k="' + esc(key) + '">تجاهل</button></span>';
}
function pxEmbedded(name) { return (typeof PRODUCTS_FULL !== "undefined" ? PRODUCTS_FULL : []).filter(function (x) { return x.n === name; })[0] || null; }
function pxSection(key, title, src, body, extra) {
  return '<section class="px-sec" id="pxsec_' + key + '" aria-labelledby="pxsech_' + key + '"><div class="px-sech"><h2 id="pxsech_' + key + '">' + title + "</h2>" +
    (src ? '<span class="src">' + src + "</span>" : "") + '<span class="sp"></span>' + (extra || "") + '</div><div class="px-secb">' + body + "</div></section>";
}
function pxPerfSection(p) {
  var name = p.product, perf = (pcPerf[pcPerfYear] || {})[name];
  if (!perf) {
    return pxSection("performance", "الأداء", "من سجل الفرص", pcPerfFailed[pcPerfYear]
      ? '<div class="ox-state" role="alert">تعذّر تحميل الأداء.<button class="btn btn-ghost" data-px="perfretry">أعد المحاولة</button></div>'
      : moSkeleton(3, ["w60", "w80", "w40"]));
  }
  var cov = targetCoveragePct(perf.achieved, perf.annualTarget);
  var b = '<div><div class="ox-lbl">المحقق ' + arYear(pcPerfYear) + '</div><div class="px-fig">' + pxMoney(perf.achieved) +
    '<span class="ox-figsub">' + (perf.annualTarget === null || perf.annualTarget === undefined ? "بلا مستهدف سنوي" :
      "من مستهدف " + pxMoney(perf.annualTarget) + (cov === null ? "" : " · " + fmtN(cov) + "٪") + (perf.targetQuarters < 4 ? " · مُدخل في " + pxNQtr(perf.targetQuarters) + " من أربعة" : "")) + "</span></div></div>";
  b += '<div class="px-qbar">' + (perf.quarters || []).map(function (q) {
    var has = q.target !== null && q.target !== undefined && Number(q.target) > 0;
    var pct = has ? Math.min(100, Math.round((Number(q.achieved) || 0) / Number(q.target) * 100)) : 0;
    return '<div class="px-qc"><div class="trk' + (has ? "" : " not") + '">' + (has ? '<i style="width:' + pct + '%"></i>' : "") + "</div>" +
      '<div class="l"><span>الربع ' + fmtN(q.quarter) + "</span><span>" + (has ? pxMoney(q.achieved) : "—") + "</span></div></div>";
  }).join("") + "</div>";
  b += '<div class="px-stats"><div class="px-stat"><span class="l">المفتوح الآن</span><span class="v">' + (perf.openValue ? pxMoney(perf.openValue) : "—") + '</span><span class="l">' + pxNLine(perf.openLines) + (perf.unpricedOpenLines ? " · " + pxNLine(perf.unpricedOpenLines) + " بلا تسعير" : "") + "</span></div>" +
    '<div class="px-stat"><span class="l">مربوحة ' + arYear(pcPerfYear) + '</span><span class="v">' + (perf.wonLines ? pxNLine(perf.wonLines) : "لا بنود") + '</span></div>' +
    '<div class="px-stat"><span class="l">خاسرة ' + arYear(pcPerfYear) + '</span><span class="v">' + (perf.lostLines ? pxNLine(perf.lostLines) : "لا بنود") + "</span></div></div>";
  var open = pxOpenLines(name).slice().sort(function (a, b2) { return opValue(b2) - opValue(a); }).slice(0, 3);
  if (open.length) {
    b += '<div class="ox-lbl">أعلى الفرص المفتوحة</div><div class="px-list">' + open.map(function (o) {
      return '<a class="px-li" href="#opps/' + fmtId(o.id) + '"><span class="a">' + esc(o.account_name) + '</span><span class="s">' + opDot(o.stage) + esc(opStage(o.stage).label) +
        '</span><span class="v">' + (opPriced(o) ? pxMoney(opValue(o)) : '<span style="color:var(--muted);font-weight:450">لم تُسعَّر</span>') + "</span></a>";
    }).join("") + '</div><button class="px-more" style="background:none;border:none;cursor:pointer;font-family:inherit;padding:0" data-px="goopps" data-nm="' + esc(name) + '">كل فرص المنتج ←</button>';
  }
  b += '<div class="px-note">القيمة الإجمالية للعقد — أساس المستهدف لم يُقَرّ بعد.</div>';
  return pxSection("performance", "الأداء", "من سجل الفرص", b);
}
function pxPricingSection(p) {
  var name = p.product, b = "";
  var ed = pxPkgEdit && pxPkgEdit.product === name ? pxPkgEdit : null;
  var editor = function () {
    var d = ed.d;
    return '<div class="px-pke"><div class="g">' +
      '<div class="px-fl"><label for="pxpk_n">اسم الباقة *</label><input class="inp" id="pxpk_n" maxlength="60" value="' + esc(d.name) + '" data-pxpkg="name"></div>' +
      '<div class="px-fl"><label for="pxpk_s">النطاق</label><input class="inp" id="pxpk_s" maxlength="120" value="' + esc(d.scope) + '" data-pxpkg="scope"></div>' +
      '<div class="px-fl"><label for="pxpk_y">المدة (سنوات)</label><input class="inp num" id="pxpk_y" type="number" min="1" max="10" step="1" value="' + esc(d.years) + '" data-pxpkg="years"></div>' +
      '<div class="px-fl"><label for="pxpk_p">السعر السنوي (ر.س)</label><input class="inp num" id="pxpk_p" type="number" min="0" step="1" value="' + esc(d.listPrice) + '" data-pxpkg="listPrice"></div></div>' +
      (ed.err ? '<span class="px-err" role="alert">' + pxIco("warn") + esc(ed.err) + "</span>" : "") +
      '<div class="acts"><button class="btn btn-ghost" data-px="pkgsave"' + (ed.busy ? " disabled" : "") + ">" + (ed.busy ? "جارٍ الحفظ…" : "حفظ الباقة") + '</button><button class="btn btn-ghost" data-px="pkgcancel">إلغاء</button>' +
      '<span class="px-note">تعديل السعر لا يغيّر قيم الفرص المسجّلة.</span></div></div>';
  };
  b += '<div class="px-pk"><div class="px-pkh"><span>الباقة</span><span>النطاق</span><span class="end">المدة</span><span class="end">السعر السنوي</span><span></span></div>';
  if (!(p.packages || []).length && !(ed && ed.id === 0)) b += '<div class="px-pkr"><span style="color:var(--muted)">لا باقات منشورة.</span></div>';
  (p.packages || []).forEach(function (k) {
    if (ed && ed.id === k.id) { b += editor(); return; }
    b += '<div class="px-pkr"><span>' + esc(k.name) + "</span><span>" + (k.scope ? esc(k.scope) : "—") + '</span><span class="end">' + fmtN(k.years) + ' سنة</span><span class="end"><b>' + pxMoney(k.listPrice) + "</b></span>" +
      '<span class="acts"><button class="btn btn-ghost" data-px="pkgedit" data-id="' + k.id + '">تعديل</button><button class="btn btn-ghost" data-px="pkgretire" data-id="' + k.id + '">تقاعد</button></span></div>';
  });
  if (ed && ed.id === 0) b += editor();
  b += "</div>";
  b += '<div style="display:flex;gap:var(--s2);align-items:center;flex-wrap:wrap;">' + (ed ? "" : '<button class="ox-arow" style="width:auto;padding-inline:14px;" data-px="pkgadd">' + pxIco("plus") + "باقة</button>") +
    (p.retiredPackageCount ? '<button class="ox-clear" data-px="retiredtoggle" aria-expanded="' + !!pxShowRetired[name] + '">' + (pxShowRetired[name] ? "إخفاء المتقاعدة" : "عرض المتقاعدة (" + fmtN(p.retiredPackageCount) + ")") + "</button>" : "") + "</div>";
  if (pxShowRetired[name]) {
    var ret = pxRetired[name];
    b += '<div class="px-pk">' + (!ret ? '<div class="px-pkr"><span style="color:var(--muted)">جارٍ التحميل…</span></div>' : ret.filter(function (k) { return k.retiredAt || k.retired_at; }).map(function (k) {
      return '<div class="px-pkr retired"><span>' + esc(k.name) + '</span><span>' + (k.scope ? esc(k.scope) : "—") + '</span><span class="end">' + fmtN(k.years) + ' سنة</span><span class="end">' + pxMoney(k.listPrice) + '</span><span class="acts"><span class="px-arch">متقاعدة</span><button class="btn btn-ghost" data-px="pkgrestore" data-id="' + k.id + '">إعادة التفعيل</button></span></div>';
    }).join("")) + "</div>";
  }
  var nk = name + "|pricingNote";
  b += '<div class="ox-fld"><div class="ox-lr"><label for="pxf_note">ملاحظة التسعير</label>' + pxStatusSlot(nk, "pxf_note") + '</div><input class="inp" id="pxf_note" aria-describedby="pxf_note_st" maxlength="120" value="' +
    esc(pxFState[nk] && pxFState[nk].s !== "saved" ? pxFState[nk].v : (p.pricingNote || "")) + '" data-pxfield="pricingNote" placeholder="لا ملاحظة تسعير"><span class="px-note">تُعرض حين لا توجد باقة منشورة.</span></div>';
  // The founder's rule, stated on the screen that would break it: a price is a committee decision,
  // so the section says so BEFORE the «إضافة باقة» control, not in a tooltip afterwards.
  return pxSection("pricing", "الأسعار والباقات", "لا بُدّ أن يتم الموافقة عليها مسبقًا من اللجنة قبل إضافة السعر", b);
}
function pxTargetsSection(p) {
  var name = p.product, perf = (pcPerf[pcPerfYear] || {})[name];
  var yrs = [new Date().getFullYear(), new Date().getFullYear() + 1];
  var extra = '<span class="px-yr" role="group" aria-label="السنة">' + yrs.map(function (y) {
    return '<button aria-pressed="' + (pcPerfYear === y) + '" data-px="year" data-y="' + y + '">' + arYear(y) + "</button>";
  }).join("") + "</span>";
  if (!perf) return pxSection("targets", "المستهدفات", "", pcPerfFailed[pcPerfYear] ? '<div class="ox-state" role="alert">تعذّر تحميل المستهدفات.<button class="btn btn-ghost" data-px="perfretry">أعد المحاولة</button></div>' : moSkeleton(4, ["w80"]), extra);
  var b = '<div>';
  (perf.quarters || []).forEach(function (q) {
    var key = name + "|t|" + pcPerfYear + "|" + q.quarter, st = pxFState[key];
    var saved = q.target === null || q.target === undefined ? "" : String(q.target);
    var val = st && st.s !== "saved" ? st.v : saved;
    var has = saved !== "" && Number(saved) > 0;
    var cov = targetCoveragePct(q.achieved, q.target);
    b += '<div class="px-q"><span class="lb">الربع ' + fmtN(q.quarter) + "</span>" +
      '<div class="px-qf"><label class="sr" for="pxq_' + q.quarter + '" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);">مستهدف الربع ' + fmtN(q.quarter) + "</label>" +
      '<input class="inp" id="pxq_' + q.quarter + '" type="number" min="0" step="1" inputmode="numeric" dir="ltr" placeholder="بلا مستهدف" value="' + esc(val) + '" data-pxtarget="' + q.quarter + '" aria-describedby="pxq_' + q.quarter + '_st"' + (st && st.s === "invalid" ? ' aria-invalid="true"' : "") + ">" + pxStatusSlot(key, "pxq_" + q.quarter) + "</div>" +
      '<span class="ach">المحقق ' + pxMoney(q.achieved) + "</span>" +
      '<div class="cov"><div class="trk' + (has ? "" : " not") + '">' + (has ? '<i style="width:' + Math.min(100, cov || 0) + '%"></i>' : "") + "</div><span>" + (cov === null ? "—" : fmtN(cov) + "٪") + "</span></div>";
    if (pxQConfirm[key]) {
      b += '<div class="px-confirm" role="alert">إزالة مستهدف الربع ' + fmtN(q.quarter) + '؟<button class="btn btn-ghost" data-px="tclear" data-q="' + q.quarter + '">إزالة</button><button class="btn btn-ghost" data-px="tundo" data-q="' + q.quarter + '">تراجع</button></div>';
    }
    b += "</div>";
  });
  b += "</div>";
  b += '<div class="px-note">' + (perf.annualTarget === null || perf.annualTarget === undefined ? "لا مستهدفات مدخلة لهذه السنة." : "مجموع المستهدفات المدخلة " + pxMoney(perf.annualTarget) + (perf.targetQuarters < 4 ? " · " + pxNQtr(4 - perf.targetQuarters) + " بلا مستهدف" : "")) + " · القيم نفسها في «المستهدفات والأداء».</div>";
  return pxSection("targets", "المستهدفات", "", b, extra);
}
function pxKnowledgeSection(p) {
  var name = p.product, b = "", kn = pxKnow[name];
  var upA = pxUp[name + "|asset"], upK = pxUp[name + "|kb"];
  /* The score leads: on a tab named «معرفة المنتج» the first question is «كم نسبة الجاهزية، وأي قسم
     ناقص؟» — the two files are how you fix it, so they come after the answer, not before it. */
  if (typeof kbScoreBlock === "function") b += kbScoreBlock(p, kn);
  if (pxKnowFailed[name]) b += '<div class="ox-state" role="alert">تعذّر تحميل نص المعرفة.<button class="btn btn-ghost" data-px="knowretry">أعد المحاولة</button></div>';
  /* intro PDF */
  b += '<div class="px-file"><span class="px-cells"><i class="' + (p.asset ? "" : "miss") + '"></i></span><div><div class="t">الملف التعريفي (PDF)</div><div class="d">يُرسله المساعد للعميل عند طلب التفاصيل' +
    (p.asset ? ' · <bdi>' + esc(p.asset.filename) + "</bdi>" + (p.asset.size ? " · " + fmtN(Math.max(1, Math.round(p.asset.size / 1024))) + " ك.ب" : "") + (p.asset.updatedAt ? " · " + fmtD(p.asset.updatedAt) : "") : " · لا ملف مرفق") +
    (upA && upA.s === "busy" ? ' · <span class="ox-fs pend">جارٍ الرفع…</span>' : upA && upA.s === "failed" ? ' · <span class="px-err">' + esc(upA.m) + "</span>" : "") + '</div></div><div class="acts">' +
    (p.asset ? '<a class="btn btn-ghost" href="/assets/' + esc(p.asset.publicId) + '" target="_blank" rel="noopener" style="text-decoration:none;">معاينة</a>' : (pcSkill ? '<a class="ox-lnk" href="/assets/' + esc(pcSkill.publicId) + '" download data-pxskill="record">أنشئه بمهارة إعداد العرض ↓</a>' : '<span class="px-note" data-pxskill="missing">مهارة إعداد العرض غير مرفوعة بعد</span>')) +
    '<button class="btn btn-ghost" data-px="pickasset"' + (p.archived ? " disabled" : "") + ">" + (p.asset ? "استبدال" : "رفع PDF") + "</button>" +
    '<input id="pxasset" type="file" accept="application/pdf,.pdf" aria-label="اختر ملفًا تعريفيًا (PDF)" style="display:none" data-pxupload="asset"></div></div>';
  /* knowledge */
  var kst = (p.kb && p.kb.state) || "none";
  var sub = kst === "approved" ? "اعتُمدت" + (p.kb.approvedBy ? " · " + esc(p.kb.approvedBy) : "") + (p.kb.approvedAt ? " · " + fmtD(p.kb.approvedAt) : "") + (p.kb.source ? ' · <bdi>' + esc(p.kb.source) + "</bdi>" : "")
    : kst === "legacy" ? '<span style="color:var(--s-attn-text);font-weight:500">بانتظار اعتماد النص الحالي — المساعد لا يستخدمه</span>' + (p.kb.source ? ' · <bdi>' + esc(p.kb.source) + "</bdi>" : "")
    : p.embedded ? "لا ملف — المساعد يبيع من المعرفة المدمجة فقط" : "لا ملف معرفة — المساعد لا يبيع هذا المنتج";
  b += '<div class="px-file"><span class="px-cells"><i class="' + (kst === "approved" ? "" : kst === "legacy" || p.draft ? "pend" : "miss") + '"></i></span><div><div class="t">ملف المعرفة</div><div class="d">يقرأه المساعد ليجيب عن الأسعار والاعتراضات · ' + sub +
    (upK && upK.s === "busy" ? ' · <span class="ox-fs pend">جارٍ استخلاص المعرفة… قد يستغرق دقيقة</span>' : upK && upK.s === "failed" ? ' · <span class="px-err">' + esc(upK.m) + "</span>" : "") + '</div></div><div class="acts">' +
    /* knowledge.edit — the readiness meter above is a read; uploading, approving and discarding are
       writes, and a role without the permission must not be offered them beside a hidden editor. */
    (pxMayEditKb()
      ? '<button class="btn btn-ghost" data-px="pickkb"' + (p.archived || (upK && upK.s === "busy") ? " disabled" : "") + ">" + (kst === "none" ? "رفع ملف المعرفة" : "استبدال") + "</button>" +
        '<input id="pxkb" type="file" aria-label="اختر ملف معرفة" accept=".pdf,.docx,.pptx,.xlsx,.md,.txt" style="display:none" data-pxupload="kb">'
      : "") + "</div></div>";
  var ap = pxAppr[name] || {};
  if (kn && kn.draftMd) {
    b += '<div class="px-draft"><div class="h">' + pxIco("warn") + "مسودة بانتظار الاعتماد — المساعد لا يقرؤها بعد</div>" +
      '<div class="px-note"><bdi>' + esc(kn.draftSource || "") + "</bdi>" + (kn.draftBy ? " · رُفعت · " + esc(kn.draftBy) : "") + (kn.draftAt ? " · " + fmtD(kn.draftAt) : "") +
      (kn.changeSummary ? " · أُضيف " + pxNRowTxt(kn.changeSummary.added) + " · حُذف " + pxNRowTxt(kn.changeSummary.removed) + " مقارنة بالمعتمد" : "") + "</div>" +
      (typeof kbDraftLine === "function" ? kbDraftLine(kn) : "") +
      '<div class="px-md">' + mdRender(kn.draftMd) + "</div>" +
      (ap.err ? '<span class="px-err" role="alert">' + pxIco("warn") + esc(ap.err) + "</span>" : "") +
      (pxMayEditKb()
        ? '<div class="acts"><button class="btn btn-teal" data-px="approve"' + (ap.busy ? " disabled" : "") + ">" + (ap.busy ? "جارٍ الاعتماد…" : "اعتماد المعرفة") + "</button>" +
          '<button class="rv-hold" data-do="pxDiscard" data-arg="' + esc(name) + '" data-idle="تجاهل المسودة" data-holding="استمر بالضغط للتجاهل…" data-armed="اضغط مرة أخرى للتجاهل" aria-pressed="false" title="اضغط مع الاستمرار"><span class="rv-fill"></span><span class="rv-lbl">تجاهل المسودة</span></button></div>'
        : "") + "</div>";
  }
  if (kn && kn.state === "legacy" && kn.md) {
    b += '<div class="px-draft"><div class="h">' + pxIco("warn") + "نص مستخدم قبل تسجيل الاعتماد — راجعه ثم اعتمده ليعود إليه المساعد</div>" +
      '<div class="px-md">' + mdRender(kn.md) + "</div>" + (ap.err ? '<span class="px-err" role="alert">' + pxIco("warn") + esc(ap.err) + "</span>" : "") +
      (pxMayEditKb() ? '<div class="acts"><button class="btn ' + (kn.draftMd ? "btn-ghost" : "btn-teal") + '" data-px="approvecurrent"' + (ap.busy ? " disabled" : "") + ">" + (ap.busy ? "جارٍ الاعتماد…" : "اعتماد النص الحالي") + "</button></div>" : "") + "</div>";
  } else if (kn && kn.state === "approved" && kn.md) {
    b += '<details class="px-acc"><summary>' + pxIco("chevD") + 'النص المعتمد <span class="src">يُحدَّث برفع ملف جديد أو من «تحرير الأقسام»، ثم اعتماده</span></summary><div class="px-md">' + mdRender(kn.md) + "</div></details>";
  } else if (!kn && !pxKnowFailed[name] && kst !== "none") {
    b += moSkeleton(2, ["w80", "w60"]);
  }
  var emb = pxEmbedded(name);
  if (p.embedded && emb) {
    b += '<details class="px-acc"><summary>' + pxIco("chevD") + 'المعرفة المدمجة <span class="src">معتمدة بمراجعة الشيفرة — للقراءة فقط</span></summary><div class="px-list">' +
      [["العرض", emb.pitch], ["الكفاءة", (emb.eff || []).join(" · ")], ["ملائم لـ", (emb.best || []).join("، ")], ["التسعير المعتمد", emb.pricing]].map(function (x) {
        return '<div class="px-li" style="cursor:default;grid-template-columns:120px minmax(0,1fr);"><span class="s">' + esc(x[0]) + '</span><span class="a" style="white-space:normal">' + esc(x[1]) + "</span></div>";
      }).join("") + "</div></details>";
  }
  return pxSection("knowledge", "معرفة المنتج", "ما يقرؤه المساعد قبل أن يردّ على عميل", b);
}
var PX_RD_LABELS = { knowledge: "معرفة المساعد", asset: "ملف تعريفي", price: "سعر منشور", lock: "يميّزه المساعد في المحادثة" };
var PX_RD_GOTO = { knowledge: "knowledge", asset: "knowledge", price: "pricing", lock: "" };
function pxReadinessState(p) {
  var kst = (p.kb && p.kb.state) || "none";
  return {
    knowledge: (kst === "approved" ? "معتمدة" : p.draft ? "مسودة بانتظار الاعتماد" : kst === "legacy" ? "بانتظار اعتماد النص الحالي" : p.embedded ? "مدمجة فقط — لا ملف" : "لا معرفة") +
      (p.knowledgeScore && (kst !== "none" || p.embedded) ? " · " + fmtN(p.knowledgeScore.score) + "٪" : ""),
    asset: p.asset ? "مرفق" : "غير مرفق",
    price: pxPrice(p).kind === "package" ? pxNPkg(pxPrice(p).count) : pxPrice(p).kind === "note" ? "ملاحظة تسعير" : "لا سعر",
    lock: p.embedded ? "ضمن كتالوج المساعد" : "يتطلب تحديث كتالوج المساعد"
  };
}
/* The record's own strip: on a product record this REPLACES the tab row. The first question a
   product record answers is «does the assistant sell this, and what is missing?» — not «which
   screen am I on». render() calls it; the readiness rule is the same one the list row and the
   campaign wizard read, so three surfaces cannot disagree. */
function pxReadinessBand() {
  if (!pcCat) return "";
  var r = typeof pxParseProductRoute === "function" ? pxParseProductRoute() : null;
  var p = r && r.name ? pxRow(r.name) : null;
  if (!p) return "";
  var rd = pxReadiness(p), st = pxReadinessState(p);
  var h = '<div class="px-band" role="status" aria-label="جاهزية المساعد">';
  h += '<span class="w ' + pxWordCls(rd) + '">' + pxCellsHtml(rd) + esc(rd.word) + "</span>";
  h += rd.cells.map(function (c) {
    return '<span class="sep" aria-hidden="true"></span><span class="it' + (c.state === "done" ? " done" : "") + '">' +
      '<i class="' + (c.state === "missing" ? "miss" : c.state === "pending" ? "pend" : "") + '"></i>' +
      PX_RD_LABELS[c.key] + '<b>' + esc(st[c.key]) + "</b>" +
      (PX_RD_GOTO[c.key] && c.state !== "done" ? '<button class="go" data-px="jump" data-s="' + PX_RD_GOTO[c.key] + '">' + (c.key === "price" ? "أضف سعرًا" : "أكمله") + "</button>" : "") + "</span>";
  }).join("");
  return h + "</div>";
}
function pxSide(p, rd) {
  var name = p.product;
  // Readiness lives in the band above the record now (pxReadinessBand): the same four rows twice on
  // one screen is not two answers, it is one answer said twice.
  void rd;
  var h = "";
  var open = pxOpenLines(name), openVal = open.reduce(function (n, o) { return n + (opPriced(o) ? opValue(o) : 0); }, 0);
  var link = function (act, label, count, extra) {
    return '<button class="px-lk" data-px="' + act + '" data-nm="' + esc(name) + '"><span class="l">' + label + '</span><span class="v"><b>' + fmtN(count) + "</b>" + (extra || "") + pxIco("chevS") + "</span></button>";
  };
  h += '<section class="px-sec" aria-labelledby="pxrel_h"><div class="px-sech"><h2 id="pxrel_h">المرتبط بهذا المنتج</h2></div><div class="px-secb" style="gap:0">' +
    link("goopen", "الفرص المفتوحة", open.length, openVal ? " · " + pxMoney(openVal) : "") +
    link("gocamps", "الحملات", pxCampaigns(name).length) +
    link("gointerest", 'اهتمام رصده المساعد <span class="px-read">قراءة المساعد</span>', pxInterest(name)) +
    link("gotargets", "الجهات المستهدفة بالوسم", pxTargeted(name)) + "</div></section>";
  return h;
}
function pxRenameModal() {
  if (!pxModal) return "";
  var m = pxModal;
  var im = m.impact;
  var h = '<div class="ox-scrim in" data-px="modalclose"></div><div class="px-modal" role="dialog" aria-modal="true" aria-labelledby="pxmt"><div class="box">';
  h += '<h2 id="pxmt" tabindex="-1">إعادة تسمية «' + esc(m.product) + "»</h2>";
  h += '<div class="px-fl"><label for="pxm_to">الاسم الجديد</label><input class="inp" id="pxm_to" maxlength="60" value="' + esc(m.to) + '" data-pxmodal="to"' + (m.err ? ' aria-invalid="true" aria-describedby="pxm_err"' : "") + "></div>";
  h += '<div class="px-note">' + (!im ? "جارٍ حساب ما سيتغيّر…" : "سيُغيَّر الاسم في: " + [
    im.openLines ? pxNLine(im.openLines) + " مفتوحة" : "", im.campaigns ? pxNCamp(im.campaigns) : "", im.kb ? "ملف المعرفة" : "", im.asset ? "الملف التعريفي" : "",
    im.packages ? pxNPkg(im.packages) : "", im.targetedEntities ? pxNEnt(im.targetedEntities) + " مستهدفة" : "", im.interestReadings ? pxNRead(im.interestReadings) + " للمساعد" : ""
  ].filter(Boolean).join(" · ") + ".") + "</div>";
  if (m.err) h += '<span class="px-err" id="pxm_err" role="alert">' + pxIco("warn") + esc(m.err) + "</span>";
  h += '<div class="acts"><button class="btn btn-teal" data-px="renamesave"' + (m.busy || !im ? " disabled" : "") + ">" + (m.busy ? "جارٍ الحفظ…" : "حفظ الاسم") + '</button><button class="btn btn-ghost" data-px="modalclose">إلغاء</button></div>';
  return h + "</div></div>";
}

/* Every live product, current one held. Archived ones are left out: this rail is for moving between
   the products someone is actually working. */
function pxSwitcher(p) {
  var live = (pcCat || []).filter(function (x) { return !x.archived; });
  if (live.length < 2) return "";
  return '<div class="px-sw" role="group" aria-label="التنقل بين المنتجات">' + live.map(function (x) {
    var on = x.product === p.product;
    return '<a class="px-swb" href="#product/' + pxEnc(x.product) + '"' + (on ? ' aria-current="page"' : "") + ">" + esc(x.product) + "</a>";
  }).join("") + "</div>";
}

/* The four figures a product manager opens this record for. Target and achieved come from
   /admin/sales/quarters (the same read «المستهدفات» uses), the open book from the board, and the
   readiness from the knowledge score — no figure is computed a second way here. */
function pxHero(p, rd) {
  var q = null;
  var rows = (typeof pcQuarters !== "undefined" && pcQuarters && pcQuarters.byProduct) || [];
  for (var i = 0; i < rows.length; i++) if (rows[i].product === p.product) q = rows[i];
  var target = q ? Number(q.annualTarget) || 0 : 0;
  var achieved = q ? Number(q.achieved) || 0 : 0;
  var pct = typeof wholePct === "function" ? wholePct(attainmentPct(achieved, target)) : null;
  var lines = ((typeof oppRows !== "undefined" && oppRows) ? oppRows : []).filter(function (l) { return l.product === p.product; });
  var open = lines.filter(function (l) { return typeof opIsOpen === "function" ? opIsOpen(l) : false; });
  var openValue = typeof opSumLive === "function" ? opSumLive(open) : 0;
  var ks = p.knowledgeScore || null;
  var score = ks && typeof ks.score === "number" ? ks.score : null;
  var money = function (v) { return typeof opMoneyShort === "function" ? opMoneyShort(v) : fmtN(Math.round(v || 0)) + " ر.س"; };
  var tile = function (cls, label, value, sub, meter) {
    return '<div class="px-hi ' + cls + '"><span class="l">' + label + "</span>" + value +
      (sub ? '<span class="s">' + sub + "</span>" : "") + (meter || "") + "</div>";
  };
  var meter = function (v) { return '<span class="meter"><i style="width:' + Math.max(0, Math.min(100, v)) + '%"></i></span>'; };
  return '<div class="px-hero">' +
    tile("", "المستهدف السنوي", target ? '<span class="n">' + money(target) + "</span>" : '<span class="n none">لم يُحدَّد</span>',
      target ? esc(String((typeof pcQuarters !== "undefined" && pcQuarters && pcQuarters.year) || "")) : "يُحدَّد من «المستهدفات»", "") +
    tile("", "المحقق", '<span class="n">' + money(achieved) + "</span>", "من الصفقات الرابحة", "") +
    tile("lead" + (pct === null ? "" : pct >= 100 ? " ok" : pct >= 70 ? "" : " warn"), "نسبة الإنجاز",
      pct === null ? '<span class="n none">—</span>' : '<span class="n">' + fmtN(pct) + "٪</span>",
      pct === null ? "بلا مستهدف" : "من المستهدف", pct === null ? "" : meter(pct)) +
    tile("", "الفرص المفتوحة", '<span class="n">' + fmtN(open.length) + "</span>", open.length ? money(openValue) : "لا بنود مفتوحة", "") +
    tile(score === null ? "" : score >= KB_READY_MIN ? " ok" : " warn", "جاهزية المساعد",
      score === null ? '<span class="n none">—</span>' : '<span class="n">' + fmtN(score) + "٪</span>",
      esc(rd && rd.word ? rd.word : ""), score === null ? "" : meter(score)) +
    "</div>";
}

/* ===================== the record's tabs ===================== */
/* The deep-link segment a tab answers to. The four keys are RESERVED_SECTIONS, so an old link
   (#product/<name>/knowledge, and the readiness band's «أكمله») still lands on the right tab. */
var PX_SEC_TAB = { performance: "overview", pricing: "pricing", targets: "targets", knowledge: "knowledge" };

function pxTabsFor(p) {
  var ks = p.knowledgeScore || null;
  var score = ks && typeof ks.score === "number" ? ks.score : null;
  var pkgs = (p.packages || []).length;
  var perf = (pcPerf[pcPerfYear] || {})[p.product];
  var blank = perf && typeof perf.targetQuarters === "number" ? 4 - perf.targetQuarters : 0;
  return [
    { k: "overview", l: "نظرة عامة", n: "", warn: false },
    /* The founder's note: «معرفة المنتج» belongs inside the record, not only in the door beside it. */
    { k: "knowledge", l: "معرفة المنتج", n: score === null ? "" : fmtN(score) + "٪", warn: !!(ks && !ks.ready) },
    { k: "pricing", l: "الأسعار والباقات", n: pkgs ? fmtN(pkgs) : "", warn: !pkgs && !(p.pricingNote || "") },
    { k: "targets", l: "المستهدفات", n: "", warn: blank > 0 },
    { k: "settings", l: "البيانات والإدارة", n: "", warn: false }
  ];
}
/* Saved choice first, then the route, then the first tab — so the switcher rail keeps your section. */
function pxCurTab(p) {
  var tabs = pxTabsFor(p), keys = tabs.map(function (t) { return t.k; });
  var saved = pxTab[p.product];
  if (saved && keys.indexOf(saved) >= 0) return saved;
  var r = typeof pxParseProductRoute === "function" ? pxParseProductRoute() : null;
  var sec = r && r.section ? PX_SEC_TAB[r.section] : "";
  return sec && keys.indexOf(sec) >= 0 ? sec : keys[0];
}
function pxSetTab(product, key, focusId) {
  pxTab[product] = key;
  render(false);
  if (focusId) { var el = document.getElementById(focusId); if (el) el.focus(); }
}
function pxTabStrip(p) {
  var on = pxCurTab(p);
  return '<div class="px-tabs" role="tablist" aria-label="أقسام المنتج">' + pxTabsFor(p).map(function (t) {
    return '<button type="button" class="px-tab" role="tab" data-pxtab="' + t.k + '" id="pxtab_' + t.k + '"' +
      ' aria-selected="' + (t.k === on) + '" aria-controls="pxpane_' + t.k + '" tabindex="' + (t.k === on ? "0" : "-1") + '" data-px="tab" data-t="' + t.k + '">' + t.l +
      (t.n ? '<span class="n">' + t.n + "</span>" : "") +
      (t.warn ? '<span class="dot" aria-hidden="true"></span><span class="px-sr">يحتاج إكمالًا</span>' : "") + "</button>";
  }).join("") + '<i class="ind" aria-hidden="true"></i></div>';
}
/* The indicator element is rebuilt with every repaint, so a plain measure would make it JUMP. It is
   placed on the PREVIOUS tab first without a transition, then moved on the next frame — the glide
   the drawer has, across a full re-render. */
function pxPlaceTabs() {
  var strip = document.querySelector(".px-tabs");
  if (!strip) { pxTabPrev = ""; return; }
  var ind = strip.querySelector(".ind"), on = strip.querySelector('[aria-selected="true"]');
  if (!ind || !on) return;
  var put = function (el, anim) {
    var sb = strip.getBoundingClientRect(), ob = el.getBoundingClientRect();
    var rtl = getComputedStyle(strip).direction === "rtl";
    /* Logical offset: in RTL the strip's inline start is its RIGHT edge. */
    var off = rtl ? sb.right - ob.right : ob.left - sb.left;
    if (!anim) ind.classList.add("noanim");
    ind.style.width = ob.width + "px";
    ind.style.transform = "translateX(" + (rtl ? -off : off) + "px)";
  };
  var prev = pxTabPrev ? strip.querySelector('[data-pxtab="' + pxTabPrev + '"]') : null;
  if (prev && prev !== on) {
    put(prev, false);
    requestAnimationFrame(function () {
      void ind.offsetWidth;                /* commit the start position before the transition is armed */
      ind.classList.remove("noanim");
      put(on, true);
    });
  } else put(on, false);
  pxTabPrev = on.getAttribute("data-pxtab");
}

/* «البيانات والإدارة»: the three editors the header used to wear, plus rename and archive.
   knowledge.edit owns every product write (the same permission /admin/products enforces), so a
   read-only role sees the values and no controls. */
function pxMetaSection(p) {
  var name = p.product, may = pxMayEditKb() && !p.archived;
  var dis = may ? "" : " disabled";
  var b = '<div class="px-form">';
  b += '<div class="px-fl"><label for="pxf_sector">القطاع</label>' +
    '<select id="pxf_sector" aria-describedby="pxf_sector_st" data-pxfield="sectorId"' + dis + '><option value="">بلا قطاع</option>' +
    pcSectorList.map(function (s) { return '<option value="' + s.id + '"' + (String(p.sectorId) === String(s.id) ? " selected" : "") + ">" + esc(s.name) + "</option>"; }).join("") + "</select>" +
    '<span class="row">' + (p.sectorAssumed ? '<span class="px-read" title="القطاع مُستنتَج — اختر قيمة لتأكيده">مُستنتَج</span>' : "") + pxStatusSlot(name + "|sectorId", "pxf_sector") + "</span></div>";
  if (typeof cfDivs !== "undefined" && cfDivs.length) {
    b += '<div class="px-fl"><label for="pxf_division">القسم</label>' +
      '<select id="pxf_division" aria-describedby="pxf_division_st" data-pxfield="divisionId"' + dis + '><option value="">بلا قسم</option>' +
      cfDivs.map(function (d) { return '<option value="' + d.id + '"' + (String(p.divisionId) === String(d.id) ? " selected" : "") + ">" + esc(d.name) + "</option>"; }).join("") +
      '</select><span class="row">' + pxStatusSlot(name + "|divisionId", "pxf_division") + "</span></div>";
  }
  var ov = pxFState[name + "|owner"] && pxFState[name + "|owner"].s !== "saved" ? pxFState[name + "|owner"].v : (p.owner || "");
  b += '<div class="px-fl"><label for="pxf_owner">مدير المنتج</label>' +
    '<input id="pxf_owner" aria-describedby="pxf_owner_st" maxlength="60" list="pxowners" placeholder="بلا مسؤول" value="' + esc(ov) + '" data-pxfield="owner"' + dis + ">" +
    '<datalist id="pxowners">' + (pcCat || []).map(function (x) { return x.owner; }).filter(function (o, i, a) { return o && a.indexOf(o) === i; }).map(function (o) { return '<option value="' + esc(o) + '"></option>'; }).join("") + "</datalist>" +
    '<span class="row">' + pxStatusSlot(name + "|owner", "pxf_owner") + "</span></div>";
  b += "</div>";
  b += '<div class="px-note">' + (p.createdAt ? "أُنشئ " + fmtD(p.createdAt) + " · " : "") +
    (may ? "يُحفظ كل حقل فور تغييره." : "العرض فقط — تعديل بيانات المنتج يتطلب صلاحية إدارة معرفة المنتج.") + "</div>";
  if (pxMayEditKb() && !p.embedded && !p.archived) {
    b += '<div style="display:flex;gap:var(--s2);flex-wrap:wrap;align-items:center;">' +
      '<button class="btn btn-ghost" data-px="rename">إعادة تسمية المنتج</button></div>';
  }
  return pxSection("settings", "بيانات المنتج", "", b);
}

function vProductDrill(name, section) {
  pcLoad(false); pcPerfLoad(pcPerfYear, false);
  if (typeof cfLoad === "function") cfLoad(false);
  if (typeof opLoad === "function") opLoad(false);
  var back = '<a class="px-back" href="#products">' + pxIco("back") + "كل المنتجات</a>";
  if (pcCat === null) {
    return '<div class="px">' + back + (pcFailed ? '<div class="ox-state" role="alert">تعذّر تحميل المنتج.<button class="btn btn-ghost" data-px="retry">أعد المحاولة</button></div>' : moSkeleton(6, ["w60", "w80", "w40"])) + "</div>";
  }
  var p = pxRow(name);
  if (!p) {
    var words = String(name || "").split(/\s+/).filter(function (w) { return w.length > 2; });
    var close = (pcCat || []).filter(function (x) { return words.some(function (w) { return x.product.indexOf(w) >= 0; }); });
    return '<div class="px">' + back + '<div class="ox-state">لا منتج بهذا الاسم.<span class="s"><bdi>' + esc(name) + "</bdi></span>" +
      (close.length ? '<div class="px-list" style="width:100%;max-width:420px;">' + close.map(function (x) { return '<a class="px-li" href="#product/' + pxEnc(x.product) + '"><span class="a">' + esc(x.product) + "</span></a>"; }).join("") + "</div>" : "") + "</div></div>";
  }
  pxKnowLoad(name, false);
  var rd = pxReadiness(p);
  var kn = pxKnow[name];
  var approvePrimary = !!(kn && (kn.draftMd || (kn.state === "legacy" && kn.md)));
  void section;   /* the route's section picks the TAB now (pxCurTab), it no longer scrolls the page */
  var tab = pxCurTab(p);
  var chip = function (label, value, focusId) {
    var has = !!value, body = '<span>' + label + "</span><b>" + (has ? esc(value) : "بلا تحديد") + "</b>";
    var cls = "px-chip" + (has ? "" : " none");
    return pxMayEditKb() && !p.archived
      ? '<button type="button" class="' + cls + '" data-px="tab" data-t="settings" data-f="' + focusId + '" title="' + esc(label + " — يُحرَّر في «البيانات والإدارة»") + '">' + body + "</button>"
      : '<span class="' + cls + '">' + body + "</span>";
  };
  var sectorName = (pcSectorList || []).filter(function (s) { return String(s.id) === String(p.sectorId); }).map(function (s) { return s.name; })[0] || "";
  var divName = (typeof cfDivs !== "undefined" ? cfDivs : []).filter(function (d) { return String(d.id) === String(p.divisionId); }).map(function (d) { return d.name; })[0] || "";

  var h = '<div class="px">' + back;
  h += '<header class="px-rh"><div class="tt"><h1>' + esc(p.product) + (p.archived ? '<span class="px-arch">مؤرشف</span>' : "") + "</h1>" +
    '<div class="meta">' + chip("القطاع", sectorName + (sectorName && p.sectorAssumed ? " (مُستنتَج)" : ""), "pxf_sector") +
    (typeof cfDivs !== "undefined" && cfDivs.length ? chip("القسم", divName, "pxf_division") : "") +
    chip("مدير المنتج", p.owner || "", "pxf_owner") +
    (p.embedded ? '<span class="px-chip"><span>كتالوج المساعد</span><b>مضمَّن</b></span>' : "") + "</div></div>";
  h += '<div class="end">';
  if (p.archived) {
    h += '<button class="btn btn-teal" data-px="restore">استعادة المنتج</button>';
  } else {
    h += (!rd.eligible ? '<span class="px-why" id="pxwhy">' + esc(rd.reason || rd.word) + "</span>" : "") +
      '<button class="btn ' + (approvePrimary ? "btn-ghost" : "btn-teal") + '" data-px="launch" data-nm="' + esc(p.product) + '"' + (rd.eligible ? "" : ' disabled aria-disabled="true" aria-describedby="pxwhy"') + ">أطلق حملة بهذا المنتج</button>";
  }
  h += '<button class="btn btn-ghost" id="pxmenu" data-px="menu" aria-haspopup="menu" aria-expanded="' + pxMenuOpen + '" aria-label="إجراءات أخرى">⋯</button>';
  if (pxMenuOpen) {
    h += '<div class="px-menu" role="menu">' + (p.embedded
      ? '<button role="menuitem" aria-disabled="true">إعادة تسمية</button><button role="menuitem" aria-disabled="true">أرشفة المنتج</button><div class="why">مضمَّن في كتالوج المساعد — إعادة التسمية والأرشفة تتطلبان تحديث الكتالوج.</div>'
      : '<button role="menuitem" data-px="rename">إعادة تسمية</button>' + (p.archived ? '<button role="menuitem" data-px="restore">استعادة المنتج</button>' : '<button role="menuitem" data-px="archivejump">أرشفة المنتج</button>')) + "</div>";
  }
  h += "</div></header>";
  h += pxSwitcher(p) + pxHero(p, rd) + pxTabStrip(p);

  /* One tab is painted at a time. Each pane is the tablist's panel, so a screen reader moving off
     the tab lands in the section it names. */
  var pane = "";
  if (tab === "overview") pane = pxPerfSection(p);
  else if (tab === "knowledge") pane = pxKnowledgeSection(p);
  else if (tab === "pricing") pane = pxPricingSection(p);
  else if (tab === "targets") pane = pxTargetsSection(p);
  else {
    pane = pxMetaSection(p);
    if (pxMayEditKb() && !p.embedded && !p.archived) {
      pane += '<section class="px-sec" id="pxsec_archive"><div class="px-sech"><h2>أرشفة المنتج</h2></div><div class="px-secb"><div class="px-note" id="pxarch_note">' +
        (pxModal && pxModal.kind === "archiveImpact" ? "" : "الأرشفة تُخفي المنتج من القوائم ومعالج الحملات وتوقف استخدام المساعد لمعرفته وملفه، ويبقى تاريخه كما هو. يمكن استعادته.") + "</div>" +
        '<div><button class="rv-hold" data-do="pxArchive" data-arg="' + esc(p.product) + '" data-idle="أرشفة المنتج" data-holding="استمر بالضغط للأرشفة…" data-armed="اضغط مرة أخرى للأرشفة" aria-pressed="false" title="اضغط مع الاستمرار"><span class="rv-fill"></span><span class="rv-lbl">أرشفة المنتج</span></button></div></div></section>';
    }
  }
  h += '<div class="px-rec"><div class="px-main px-pane" id="pxpane_' + tab + '" role="tabpanel" tabindex="0" aria-labelledby="pxtab_' + tab + '">' + pane + "</div>" +
    '<aside class="px-side" aria-label="المرتبط بهذا المنتج">' + pxSide(p, rd) + "</aside></div>";
  h += "</div>";
  return h + pxRenameModal() + (typeof kbEditor === "function" ? kbEditor() : "");
}

/* ================================ WRITES ================================ */
function pxUpdateRow(row) {
  if (!row || !pcCat) return;
  pcCat = pcCat.map(function (x) { return x.product === row.product ? Object.assign({}, x, row) : x; });
}
function pxSaveMeta(name, field, raw) {
  var key = name + "|" + field;
  var val = raw;
  if (field === "sectorId" || field === "divisionId") val = raw === "" ? null : Number(raw);
  else { val = String(raw || "").trim(); if (field === "owner" && val.length > 60) { pxFState[key] = { s: "invalid", v: raw, m: "60 حرفًا كحدٍّ أقصى." }; render(false); return; }
    if (field === "pricingNote" && val.length > 120) { pxFState[key] = { s: "invalid", v: raw, m: "120 حرفًا كحدٍّ أقصى." }; render(false); return; }
    if (val === "") val = null; }
  pxFState[key] = { s: "pending", v: raw }; render(false);
  var body = {}; body[field] = val;
  pxJson("PATCH", "/admin/products?product=" + pxEnc(name), body).then(function (r) {
    if (r.ok && r.j.ok) { pxUpdateRow(r.j.product); pxFState[key] = { s: "saved", v: raw };
      setTimeout(function () { if (pxFState[key] && pxFState[key].s === "saved") { delete pxFState[key]; render(false); } }, 1600); }
    else pxFState[key] = { s: r.status === 400 ? "invalid" : "failed", v: raw, m: r.j.detail || "قيمة غير صالحة." };
    render(false);
  }).catch(function () { pxFState[key] = { s: "failed", v: raw }; render(false); });
}
function pxSaveTarget(name, quarter, raw, confirmed) {
  var key = name + "|t|" + pcPerfYear + "|" + quarter;
  var perf = (pcPerf[pcPerfYear] || {})[name];
  var q = perf ? (perf.quarters || []).filter(function (x) { return x.quarter === quarter; })[0] : null;
  var saved = q && q.target !== null && q.target !== undefined ? String(q.target) : "";
  var s = String(raw).trim();
  if (s === saved) { delete pxFState[key]; delete pxQConfirm[key]; render(false); return; }
  if (s === "") {
    if (saved === "") { delete pxFState[key]; render(false); return; }
    if (!confirmed) { pxQConfirm[key] = true; pxFState[key] = { s: "invalid", v: "", m: "بانتظار تأكيد الإزالة" }; render(false); return; }
  } else {
    var n = Number(s);
    if (!isFinite(n) || n < 0 || Math.floor(n) !== n) { pxFState[key] = { s: "invalid", v: raw, m: "عدد صحيح من 0 فأكثر." }; render(false); return; }
  }
  delete pxQConfirm[key];
  pxFState[key] = { s: "pending", v: raw }; render(false);
  pxJson("POST", "/admin/sales/targets", { product: name, year: pcPerfYear, quarter: quarter, amount: s === "" ? null : Number(s) }).then(function (r) {
    if (r.ok && r.j.ok !== false) { pxFState[key] = { s: "saved", v: raw }; pcPerfLoad(pcPerfYear, true); pcQuarters = null; pcLoad(true);
      /* «المستهدفات والأداء» holds the same rows in perfState — invalidate it, in both directions. */
      if (typeof perfState !== "undefined" && perfState) { perfState.data = null; perfState.year = 0; }
      setTimeout(function () { if (pxFState[key] && pxFState[key].s === "saved") { delete pxFState[key]; render(false); } }, 1600); }
    else pxFState[key] = { s: "failed", v: raw };
    render(false);
  }).catch(function () { pxFState[key] = { s: "failed", v: raw }; render(false); });
}
function pxPkgSave() {
  var ed = pxPkgEdit; if (!ed || ed.busy) return;
  var d = ed.d, price = Number(d.listPrice), years = Number(d.years);
  if (!String(d.name).trim()) { ed.err = "اسم الباقة مطلوب."; render(false); return; }
  if (String(d.listPrice).trim() === "" || !isFinite(price) || price < 0 || Math.floor(price) !== price) { ed.err = "السعر السنوي عدد صحيح من 0 فأكثر."; render(false); return; }
  if (!(years >= 1 && years <= 10 && Math.floor(years) === years)) { ed.err = "المدة من 1 إلى 10 سنوات."; render(false); return; }
  ed.busy = true; ed.err = ""; render(false);
  var body = { name: String(d.name).trim(), listPrice: price, years: years, scope: String(d.scope || "").trim() };
  var req = ed.id ? pxJson("PATCH", "/admin/packages/" + ed.id, body) : pxJson("POST", "/admin/packages", Object.assign({ product: ed.product }, body));
  req.then(function (r) {
    ed.busy = false;
    if (!r.ok || r.j.ok === false) { ed.err = r.j.error === "name_exists" ? "توجد باقة بهذا الاسم لهذا المنتج." : r.j.detail || "تعذّر حفظ الباقة (" + fmtN(r.status) + ")"; render(false); return; }
    pxPkgEdit = null; pxRetired = {}; pcLoad(true); pxToast("حُفظت الباقة «" + body.name + "»", false);
  }).catch(function () { ed.busy = false; ed.err = "تعذّر الاتصال — لم تُحفظ الباقة."; render(false); });
}
function pxRetire(id, retire) {
  pxJson("POST", "/admin/packages/" + id + "/retire", { retire: retire }).then(function (r) {
    if (!r.ok || r.j.ok === false) { pxToast(retire ? "تعذّر تقاعد الباقة" : "تعذّر إعادة تفعيل الباقة", true); return; }
    pxRetired = {}; pcLoad(true); pxToast(retire ? "تقاعدت الباقة — تبقى الفرص المرتبطة كما هي" : "أُعيد تفعيل الباقة", false);
  }).catch(function () { pxToast("تعذّر الاتصال — لم يتغيّر شيء", true); });
}
function pxUpload(name, kind, input) {
  var f = input.files && input.files[0]; if (!f) return;
  var key = name + "|" + kind;
  if (kind === "asset" && (f.size > 10 * 1024 * 1024 || !/\.pdf$/i.test(f.name))) { pxUp[key] = { s: "failed", m: "PDF فقط وبحد 10 م.ب." }; input.value = ""; render(false); return; }
  if (kind === "kb" && (f.size > 15 * 1024 * 1024 || !/\.(pdf|docx|pptx|xlsx|md|txt)$/i.test(f.name))) { pxUp[key] = { s: "failed", m: "الأنواع المسموحة: PDF وWord وPowerPoint وExcel وMarkdown ونص، بحد 15 م.ب." }; input.value = ""; render(false); return; }
  pxUp[key] = { s: "busy" }; render(false);
  var fd = new FormData(); fd.append("product", name); fd.append("file", f);
  var url = kind === "asset" ? "/admin/product-asset/upload" : "/admin/kb/upload?product=" + pxEnc(name);
  fetch(url, { method: "POST", headers: { "x-admin-token": TOKEN }, body: fd }).then(function (r) {
    return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, j: j }; });
  }).then(function (r) {
    if (!r.ok || r.j.ok === false) {
      pxUp[key] = { s: "failed", m: r.j.error === "invalid_file" ? (r.j.detail || "ملف غير صالح.") : r.j.error === "extraction_failed" ? "تعذّر استخلاص المعرفة — بقي النص الحالي كما هو." : "تعذّر الرفع (" + fmtN(r.status) + ") — بقي الملف الحالي كما هو." };
      render(false); return;
    }
    delete pxUp[key];
    if (kind === "kb") { delete pxKnow[name]; pxKnowLoad(name, true); pxToast("رُفعت المسودة — راجعها ثم اعتمدها ليقرأها المساعد", false); }
    else { pxToast("رُفع الملف التعريفي", false); }
    pcLoad(true);
    if (typeof prodAssets !== "undefined") { fetch("/admin/product-assets", pxT()).then(function (x) { return x.ok ? x.json() : null; }).then(function (a) { if (Array.isArray(a)) prodAssets = a; }).catch(function () {}); }
  }).catch(function () { pxUp[key] = { s: "failed", m: "تعذّر الاتصال — بقي الملف الحالي كما هو." }; render(false); });
  input.value = "";
}
function pxApprove(name, current) {
  var kn = pxKnow[name]; if (!kn) return;
  pxAppr[name] = { busy: true }; render(false);
  var body = current ? { product: name, contentHash: kn.mdHash } : { product: name, draftHash: kn.draftHash };
  pxJson("POST", current ? "/admin/products/knowledge/approve-current" : "/admin/products/knowledge/approve", body).then(function (r) {
    if (!r.ok || r.j.ok === false) {
      pxAppr[name] = { err: r.j.error === "stale_draft" ? "تغيّرت المسودة منذ فتحها — راجع النسخة الحالية." : r.j.error === "stale_content" ? "تغيّر النص منذ فتحه — راجع النسخة الحالية." : "تعذّر الاعتماد (" + fmtN(r.status) + ")" };
      delete pxKnow[name]; pxKnowLoad(name, true); render(false); return;
    }
    delete pxAppr[name]; delete pxKnow[name]; pxKnowLoad(name, true); pcLoad(true);
    pxToast("اعتُمدت المعرفة — يقرؤها المساعد الآن", false);
  }).catch(function () { pxAppr[name] = { err: "تعذّر الاتصال — لم يُعتمد شيء." }; render(false); });
}
window.pxDiscard = function (name) {
  pxJson("POST", "/admin/products/knowledge/discard", { product: name }).then(function (r) {
    if (!r.ok || r.j.ok === false) { pxToast("تعذّر تجاهل المسودة", true); return; }
    delete pxKnow[name]; pxKnowLoad(name, true); pcLoad(true); pxToast("تُجوهلت المسودة — بقيت المعرفة المعتمدة كما هي", false);
  }).catch(function () { pxToast("تعذّر الاتصال — بقيت المسودة", true); });
};
window.pxArchive = function (name) {
  pxJson("POST", "/admin/products/archive", { product: name, archived: true }).then(function (r) {
    if (!r.ok || r.j.ok === false) { pxToast(r.j.error === "embedded_product" ? "منتج مضمَّن في كتالوج المساعد — لا يُؤرشف" : "تعذّر أرشفة المنتج", true); return; }
    pcLoad(true); pxTagsRefresh(); pxToast("أُرشف «" + name + "» — توقف المساعد عن استخدام معرفته", false, "تراجع", function () { pxRestore(name); });
  }).catch(function () { pxToast("تعذّر الاتصال — لم يتغيّر شيء", true); });
};
function pxRestore(name) {
  pxJson("POST", "/admin/products/archive", { product: name, archived: false }).then(function (r) {
    if (!r.ok || r.j.ok === false) { pxToast("تعذّر استعادة المنتج", true); return; }
    pcLoad(true); pxTagsRefresh(); pxToast("استُعيد «" + name + "»", false);
  }).catch(function () { pxToast("تعذّر الاتصال — لم يتغيّر شيء", true); });
}
function pxOpenRename(name) {
  pxMenuOpen = false;
  pxModal = { kind: "rename", product: name, to: name, impact: null, err: "", busy: false };
  render(false);
  fetch("/admin/products/impact?product=" + pxEnc(name), pxT()).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
    if (pxModal && pxModal.product === name) { pxModal.impact = j || { openLines: 0 }; if (!j) pxModal.err = "تعذّر حساب ما سيتغيّر."; render(false); var f = document.getElementById("pxm_to"); if (f) f.focus(); }
  });
}
/* A closed dialog hands focus back to the control that opened it (the record's ⋯ menu). */
function pxFocusMenu() { var b = document.getElementById("pxmenu"); if (b) b.focus(); }
function pxRenameSave() {
  var m = pxModal; if (!m || m.busy) return;
  var nc = normalizeProductName(m.to || "");
  if (!nc.ok) { m.err = nc.reason; render(false); return; }
  if (nc.name === m.product) { pxModal = null; render(false); return; }
  m.busy = true; m.err = ""; render(false);
  pxJson("POST", "/admin/tags/rename", { from: m.product, to: nc.name }).then(function (r) {
    m.busy = false;
    if (!r.ok || r.j.ok === false) { m.err = r.status === 409 && r.j.error !== "embedded_product" ? "الاسم مستخدم لمنتج آخر." : r.j.error === "embedded_product" ? "منتج مضمَّن في كتالوج المساعد — لا تُعاد تسميته." : r.j.detail || "تعذّرت إعادة التسمية (" + fmtN(r.status) + ")"; render(false); return; }
    pxModal = null; pxKnow = {}; pcLoad(true); pcPerf = {}; pcPerfLoad(pcPerfYear, true); pxTagsRefresh();
    if (typeof opLoad === "function") opLoad(true);
    try { history.replaceState(null, "", "#product/" + pxEnc(nc.name)); } catch (e) {}
    render(false); pxFocusMenu();
    pxToast("أُعيدت التسمية إلى «" + nc.name + "»", false);
  }).catch(function () { m.busy = false; m.err = "تعذّر الاتصال — لم يتغيّر شيء."; render(false); });
}
function pxReconcile(i) {
  var u = pcUnmatched[i]; if (!u) return;
  var sel = document.getElementById("pxum_" + i), to = sel ? sel.value : "";
  if (!to) { pxToast("اختر منتجًا للربط", true); return; }
  pxJson("POST", "/admin/products/reconcile", { from: u.name, to: to, kind: u.kind }).then(function (r) {
    if (!r.ok || r.j.ok === false) { pxToast(r.status === 409 ? "لـ«" + to + "» ملف من هذا النوع بالفعل — لم يُستبدل" : "تعذّر الربط", true); return; }
    pcLoad(true); pxToast("رُبط الملف بـ«" + to + "»", false);
  }).catch(function () { pxToast("تعذّر الاتصال — لم يتغيّر شيء", true); });
}
function pxUmCreate(i) {
  var u = pcUnmatched[i]; if (!u) return;
  pxJson("POST", "/admin/products", { name: u.name }).then(function (r) {
    if (!r.ok || r.j.ok === false) { pxToast(r.j.error === "name_exists" ? "يوجد منتج بهذا الاسم — استخدم «ربط»" : r.j.detail || "تعذّر إنشاء المنتج", true); return; }
    pcLoad(true); pxTagsRefresh();   /* a product created from a stray file is still a new product */
    pxToast("أُنشئ «" + u.name + "» وارتبطت ملفاته", false);
  }).catch(function () { pxToast("تعذّر الاتصال — لم يتغيّر شيء", true); });
}

/* ---- links that reproduce their populations: reset the destination, set the exact product ---- */
function pxGoOpps(name, openOnly) {
  if (typeof opQ !== "undefined") { opQ = ""; opStg = "all"; opSrc = "all"; opOwn = "all"; opShort = openOnly ? "open" : ""; opMode = "list"; opProd = name; if (typeof PAGE !== "undefined") PAGE.opps = 1; }
  location.hash = "opps";
}
function pxGoCampaigns(name) { campQ = ""; campTab = "all"; campProd = name; location.hash = "kmon"; }
function pxGoInterest(name) { cusQ = ""; cusTagF = ""; cusTab = "all"; cusProdF = name; location.hash = "customers"; }
function pxGoTargets(name) { tgtQ = ""; tgtFilters = {}; tgtProd = ""; tgtTagProd = name; location.hash = "targets"; }

/* ---- legacy routes: #kb and #kb/<name> land on the one products section ---- */
function pxRedirectLegacy() {
  var raw = (location.hash || "").slice(1);
  if (raw.split("/")[0] !== "kb") return;
  var rest = raw.split("/").slice(1).join("/");
  var name = ""; try { name = decodeURIComponent(rest); } catch (e) { name = rest; }
  var target = "#products";
  if (name) {
    var known = pcCat ? pcCat.some(function (p) { return p.product === name; }) : (typeof tagReg !== "undefined" && tagReg.some(function (t) { return t.name === name; }));
    if (known) target = "#product/" + pxEnc(name) + "/knowledge";
    else pcUnmatchedOpen = true;
  }
  try { history.replaceState(null, "", target); } catch (e) { location.hash = target.slice(1); }
}
/* ---- the product route: encoded name, optional reserved last segment ---- */
function pxParseProductRoute() {
  var parts = (location.hash || "").slice(1).split("/").slice(1);
  var section = "";
  if (parts.length > 1 && RESERVED_SECTIONS.indexOf(parts[parts.length - 1]) >= 0) section = parts.pop();
  var joined = parts.join("/"), name = joined;
  try { name = decodeURIComponent(joined); } catch (e) { name = joined; }
  return { name: name, section: section };
}

/* ================================ EVENTS ================================ */
document.addEventListener("click", function (ev) {
  var t = ev.target && ev.target.closest ? ev.target.closest("[data-px]") : null;
  if (!t) {
    var row = ev.target && ev.target.closest ? ev.target.closest("[data-pxrow]") : null;
    if (row && !(ev.target.closest("a,button,input,select"))) { pxListScroll = window.scrollY; location.hash = "product/" + pxEnc(row.getAttribute("data-pxrow")); }
    if (pxMenuOpen && !(ev.target.closest && ev.target.closest(".px-menu"))) { pxMenuOpen = false; render(false); }
    return;
  }
  var a = t.getAttribute("data-px"), nm = t.getAttribute("data-nm");
  var cur = (location.hash || "").slice(1).split("/")[0] === "product" ? pxParseProductRoute().name : "";
  if (a !== "menu" && pxMenuOpen) pxMenuOpen = false;
  if (a === "open") { pxListScroll = window.scrollY; location.hash = "product/" + pxEnc(nm); }
  else if (a === "only") { pxOnly = pxOnly === nm ? "" : nm; render(false); }
  else if (a === "short") { pxShort = pxShort === nm ? "" : nm; render(false); }
  else if (a === "archived") { pxArchived = !pxArchived; render(false); }
  else if (a === "clear") { pxQ = ""; pxSector = "all"; pxDivF = "all"; pxReadyF = "all"; pxShort = ""; pxOnly = ""; render(false); }
  else if (a === "retry") { pcFailed = false; pcLoad(true); render(false); }
  else if (a === "perfretry") { pcPerfFailed[pcPerfYear] = false; pcPerfLoad(pcPerfYear, true); }
  else if (a === "knowretry") { pxKnowFailed[cur] = false; pxKnowLoad(cur, true); }
  else if (a === "unmatched") { pcUnmatchedOpen = !pcUnmatchedOpen; render(false); }
  else if (a === "reconcile") { pxReconcile(Number(t.getAttribute("data-i"))); }
  else if (a === "umcreate") { pxUmCreate(Number(t.getAttribute("data-i"))); }
  else if (a === "create") { pxOpener = t.id || "pxadd"; pxSheet = { name: "", sectorId: "", owner: "", pricingNote: "", pkgName: "", pkgScope: "", pkgPrice: "", pkgYears: "1", touched: false }; pxSheetErr = ""; pxDrShown = false; render(false); }
  else if (a === "sheetclose") { pxSheet = null; pxSheetErr = ""; pxDrShown = false; render(false); var o = document.getElementById(pxOpener || "pxadd"); if (o) o.focus(); }
  else if (a === "sheetsubmit") { pxSheetSubmit(); }
  else if (a === "menu") { pxMenuOpen = !pxMenuOpen; render(false); }
  else if (a === "rename") { pxOpenRename(cur); }
  else if (a === "renamesave") { pxRenameSave(); }
  else if (a === "modalclose") { pxModal = null; render(false); pxFocusMenu(); }
  else if (a === "tab") { if (cur) pxSetTab(cur, t.getAttribute("data-t"), t.getAttribute("data-f") || ""); }
  else if (a === "archivejump") {
    if (cur) pxTab[cur] = "settings";
    render(false);
    var s = document.getElementById("pxsec_archive"); if (s) { s.scrollIntoView({ block: "center" }); var hb = s.querySelector(".rv-hold"); if (hb) hb.focus(); }
  }
  else if (a === "restore") { pxRestore(cur); }
  else if (a === "launch") { if (typeof launchWithProduct === "function") launchWithProduct(nm); }
  /* The readiness band's «أكمله» names a SECTION; on the record that section is a tab. */
  else if (a === "jump") { var sk = t.getAttribute("data-s"); if (cur) pxSetTab(cur, PX_SEC_TAB[sk] || sk); }
  else if (a === "year") { pcPerfYear = Number(t.getAttribute("data-y")); pcPerfLoad(pcPerfYear, false); render(false); }
  else if (a === "pkgadd") { pxPkgEdit = { product: cur, id: 0, d: { name: "", scope: "", years: "1", listPrice: "" }, err: "", busy: false }; render(false); var f = document.getElementById("pxpk_n"); if (f) f.focus(); }
  else if (a === "pkgedit") { var p = pxRow(cur), id = Number(t.getAttribute("data-id")); var k = p ? (p.packages || []).filter(function (x) { return x.id === id; })[0] : null;
    if (k) { pxPkgEdit = { product: cur, id: id, d: { name: k.name, scope: k.scope || "", years: String(k.years), listPrice: String(k.listPrice) }, err: "", busy: false }; render(false); var f2 = document.getElementById("pxpk_n"); if (f2) f2.focus(); } }
  else if (a === "pkgcancel") { pxPkgEdit = null; render(false); }
  else if (a === "pkgsave") { pxPkgSave(); }
  else if (a === "pkgretire") { pxRetire(Number(t.getAttribute("data-id")), true); }
  else if (a === "pkgrestore") { pxRetire(Number(t.getAttribute("data-id")), false); }
  else if (a === "retiredtoggle") { pxShowRetired[cur] = !pxShowRetired[cur];
    if (pxShowRetired[cur] && !pxRetired[cur]) fetch("/admin/packages?product=" + pxEnc(cur) + "&retired=1", pxT()).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { pxRetired[cur] = (j && (j.packages || j)) || []; render(false); });
    render(false); }
  else if (a === "tclear") { var q = Number(t.getAttribute("data-q")); pxSaveTarget(cur, q, "", true); }
  else if (a === "tundo") { var q2 = Number(t.getAttribute("data-q")), k2 = cur + "|t|" + pcPerfYear + "|" + q2; delete pxQConfirm[k2]; delete pxFState[k2]; render(false); }
  else if (a === "fretry") { var kk = t.getAttribute("data-k"), stt = pxFState[kk]; if (stt) { var parts = kk.split("|"); if (parts[1] === "t") pxSaveTarget(parts[0], Number(parts[3]), stt.v, false); else pxSaveMeta(parts[0], parts[1], stt.v); } }
  else if (a === "fdiscard") { delete pxFState[t.getAttribute("data-k")]; render(false); }
  else if (a === "pickasset") { var ia = document.getElementById("pxasset"); if (ia) ia.click(); }
  else if (a === "pickkb") { var ik = document.getElementById("pxkb"); if (ik) ik.click(); }
  else if (a === "approve") { pxApprove(cur, false); }
  else if (a === "approvecurrent") { pxApprove(cur, true); }
  else if (a === "goopps") { pxGoOpps(nm, false); }
  else if (a === "goopen") { pxGoOpps(nm, true); }
  else if (a === "gocamps") { pxGoCampaigns(nm); }
  else if (a === "gointerest") { pxGoInterest(nm); }
  else if (a === "gotargets") { pxGoTargets(nm); }
});
document.addEventListener("change", function (ev) {
  var t = ev.target; if (!t || !t.getAttribute) return;
  var cur = (location.hash || "").slice(1).split("/")[0] === "product" ? pxParseProductRoute().name : "";
  var ch = t.getAttribute("data-pxchange");
  if (ch === "pxf_sector") { pxSector = t.value; render(false); return; }
  if (ch === "pxf_div") { pxDivF = t.value; render(false); return; }
  if (ch === "pxf_ready") { pxReadyF = t.value; render(false); return; }
  if (ch === "pxf_sort") { pxSort = t.value; render(false); return; }
  var fld = t.getAttribute("data-pxfield");
  if (fld && cur) { pxSaveMeta(cur, fld, t.value); return; }
  var tq = t.getAttribute("data-pxtarget");
  if (tq && cur) { pxSaveTarget(cur, Number(tq), t.value, false); return; }
  var up = t.getAttribute("data-pxupload");
  if (up && cur) { pxUpload(cur, up, t); return; }
  var sh = t.getAttribute("data-pxsheet");
  if (sh && pxSheet) { pxSheet[sh] = t.value; if (sh === "name") pxSheet.touched = true; render(false); }
});
document.addEventListener("input", function (ev) {
  var t = ev.target; if (!t || !t.getAttribute) return;
  if (t.getAttribute("data-pxinput") === "q") { pxQ = t.value; clearTimeout(window.__pxq); window.__pxq = setTimeout(function () { render(false); }, 250); return; }
  var sh = t.getAttribute("data-pxsheet"); if (sh && pxSheet) { pxSheet[sh] = t.value; pxSheetErr = ""; return; }
  var pk = t.getAttribute("data-pxpkg"); if (pk && pxPkgEdit) { pxPkgEdit.d[pk] = t.value; pxPkgEdit.err = ""; return; }
  var md = t.getAttribute("data-pxmodal"); if (md && pxModal) { pxModal[md] = t.value; pxModal.err = ""; }
});
document.addEventListener("keydown", function (ev) {
  /* A real tablist moves with the arrows. RTL reverses them: ArrowLeft walks FORWARD because the
     next tab sits to the left of the current one. */
  var tb = ev.target && ev.target.getAttribute ? ev.target.getAttribute("data-pxtab") : null;
  if (tb && ["ArrowRight", "ArrowLeft", "Home", "End"].indexOf(ev.key) >= 0) {
    var strip = ev.target.closest(".px-tabs");
    var nm = (location.hash || "").slice(1).split("/")[0] === "product" ? pxParseProductRoute().name : "";
    if (strip && nm) {
      var all = [].slice.call(strip.querySelectorAll("[data-pxtab]")), i = all.indexOf(ev.target);
      var rtl = getComputedStyle(strip).direction === "rtl";
      var n = ev.key === "Home" ? 0 : ev.key === "End" ? all.length - 1
        : i + (ev.key === "ArrowLeft" ? (rtl ? 1 : -1) : (rtl ? -1 : 1));
      n = (n + all.length) % all.length;
      ev.preventDefault();
      var k = all[n].getAttribute("data-pxtab");
      pxSetTab(nm, k, "pxtab_" + k);
      return;
    }
  }
  var dr = document.querySelector(".px-dr") || document.querySelector(".px-modal .box");
  if (ev.key === "Enter" && pxModal && ev.target && ev.target.id === "pxm_to") { ev.preventDefault(); pxRenameSave(); return; }
  if (!dr) { if (ev.key === "Escape" && pxMenuOpen) { pxMenuOpen = false; render(false); } return; }
  if (ev.key === "Escape") {
    if (document.activeElement && document.activeElement.classList && document.activeElement.classList.contains("armed")) return;
    ev.preventDefault();
    if (pxModal) { pxModal = null; render(false); pxFocusMenu(); } else { pxSheet = null; pxDrShown = false; render(false); var o = document.getElementById(pxOpener || "pxadd"); if (o) o.focus(); }
    return;
  }
  if (ev.key !== "Tab") return;
  var f = Array.prototype.slice.call(dr.querySelectorAll("a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex='-1'])")).filter(function (x) { return x.offsetParent !== null; });
  if (!f.length) return;
  var first = f[0], last = f[f.length - 1];
  if (!dr.contains(document.activeElement)) { ev.preventDefault(); first.focus(); return; }
  if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
  else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
});
`;

export const PRODUCTS_DRILL_JS = `
/* ============================ product / sector drill-downs ============================
   Built entirely from data the products screen and the opportunity board already load — pcCat,
   pcQuarters and oppRows. No new endpoint: a drill-down that refetches what is already in memory
   adds a spinner and a failure mode for nothing. */

function pcBack() {
  return '<a href="#products" class="mo-more" style="display:inline-flex;align-items:center;gap:6px;' +
    'font-size:var(--t-xs);font-weight:600;color:var(--muted);text-decoration:none;margin-block-end:14px;">' +
    '<span class="mo-arrow">\u2192</span> كل المنتجات</a>';
}

function pcOppsFor(pred) {
  return (typeof oppRows !== "undefined" && oppRows ? oppRows : []).filter(pred);
}

/* Value uses the ONE definition, via the same arithmetic the server sums. */
function pcVal(o) {
  return Math.round((Number(o.sale_price) || 0) * (Number(o.qty) || 1) * (Number(o.years) || 1) *
    (1 - (Number(o.discount) || 0) / 100));
}

/* ONE delegated listener for every drill row. No code in an attribute: JSON.stringify emits double
   quotes that close a double-quoted attribute, and esc() turns them into &quot; which then has to
   survive a decode — the exact shape of the stored XSS this project already fixed. A data attribute
   carries the name as DATA and the handler reads it with getAttribute, which decodes once, safely. */
document.addEventListener("click", function (ev) {
  var row = ev.target && ev.target.closest ? ev.target.closest("[data-go]") : null;
  if (!row) return;
  var kind = row.getAttribute("data-go"), nm = row.getAttribute("data-nm");
  if (!kind) return;
  /* «بلا قطاع» has no board of its own — it is a catalogue gap, so it routes to the list where the
     gap is closed. Without this branch the row built #products/بلا قطاع, a record that cannot exist. */
  if (kind === "products") { location.hash = "products"; return; }
  if (!nm) return;
  location.hash = kind + "/" + encodeURIComponent(nm);
});

/* The mockup's V.exec, as a band at the top of الرئيسية.
 *
 * A DELIBERATE DEPARTURE from the mockup, stated rather than slipped in. The mockup switched a
 * state.role between four homes: exec, sector manager, product manager, sales rep. Three of those
 * four are now real DESTINATIONS in the product — #sector/<name>, #product/<name>, and /rep, which
 * is a separate page on a phone. A mode toggle that re-renders one screen into four is chrome on
 * top of navigation that already exists, and it hides three views behind a control instead of
 * putting them one click away. So: the exec band lives on الرئيسية, and every row in it is a link
 * into the role board it summarises.
 *
 * #home is off the 5s tick (R14), so this band does not inherit a poll. */
function vExecBand() {
  pcLoad(false);
  if (typeof opLoad === "function") opLoad(false);
  if (!pcSectors || !pcQuarters) return "";

  var secs = pcSectors.sectors || [];
  var prods = pcQuarters.byProduct || [];
  var anyTarget = secs.some(function (x) { return x.target > 0; }) ||
                  prods.some(function (x) { return x.annualTarget > 0; });
  var openTotal = secs.reduce(function (n, x) { return n + (x.weightedOpen || 0); }, 0);
  var openCount = secs.reduce(function (n, x) { return n + (x.openCount || 0); }, 0);
  var wonTotal = secs.reduce(function (n, x) { return n + (x.achieved || 0); }, 0);
  var COL = ["#2563EB", "#5B8DEF", "#1E5FCC", "#A2A9B4"];

  /* One card per sector, on the same components as المنتجات. This band and that screen render the
     SAME three sections, and until now they rendered them two different ways — the founder spotted
     it. Two visual languages for one set of facts is how a product starts feeling assembled. */
  function sectorCards() {
    var out = '<div class="sh-cards">';
    secs.forEach(function (sc) {
      var cov = sc.coveragePct;
      var cls = sc.isUnclassified ? "crm-none" : (cov === null ? "crm-none" : (cov >= 100 ? "crm-ok" : (cov >= 70 ? "crm-warn" : "crm-bad")));
      var mine = (typeof oppRows !== "undefined" && oppRows ? oppRows : []).filter(function (o) {
        return (sc.products || []).indexOf(o.product) >= 0;
      });
      var units = mine.map(function (o) { return o.stage === "won" ? "won" : (o.stage === "lost" ? "lost" : "on"); });
      out += '<div class="sh-card' + (sc.isUnclassified ? "" : " go") + '"' +
        (sc.isUnclassified ? "" : ' data-go="sector" data-nm="' + esc(sc.sector) + '"') + '>' +
        '<div><div class="nm">' + esc(sc.sector) + '</div>' +
        '<div class="sub">' + fmtN(sc.openCount) + ' فرصة مفتوحة</div>' +
        (units.length ? shUnits(units, 40) : "") + '</div>' +
        '<div class="end"><span class="money">' +
          (sc.target > 0 ? pcMoney(sc.achieved) + ' من ' + pcMoney(sc.target) : pcMoney(sc.weightedOpen) + ' مفتوح') +
        '</span><span class="crm-st ' + cls + '"><i></i>' +
          (cov === null ? "بلا مستهدف" : fmtN(cov) + "٪") + '</span></div></div>';
    });
    return out + '</div>';
  }

  /* ---- no target anywhere: lead with what exists, say the gap once, offer the fix ---- */
  if (!anyTarget) {
    var h0 = '<div class="sh-tiles">' +
      '<div class="sh-tile lead"><div><div class="k">المتوقع من الفرص المفتوحة</div>' +
        '<div class="s">' + fmtN(openCount) + ' فرصة · مرجّحة بوزن المرحلة</div></div>' +
        '<div class="v">' + fmtN(Math.round(openTotal)) + '</div></div>' +
      '<div class="sh-tile"><div><div class="k">المحقق</div><div class="s">في الفترة الحالية</div></div>' +
        '<div class="v">' + fmtN(Math.round(wonTotal)) + '</div></div>' +
      '<div class="sh-tile"><div><div class="k">القطاعات</div><div class="s">' + fmtN(prods.length) + ' منتجًا</div></div>' +
        '<div class="v">' + fmtN(secs.filter(function (x) { return !x.isUnclassified; }).length) + '</div></div>' +
      '<div class="sh-tile"><div><div class="k">المستهدفات</div><div class="s">لا تغطية بلا مستهدف</div></div>' +
        '<div class="v" style="font-size:var(--t-lg)">لم تُحدَّد</div></div></div>';
    h0 += '<div class="sh-sec">' + shEmpty("chart", "لا مستهدف محدَّد لهذه السنة",
      "التغطية نسبةٌ إلى رقم، وبلا مستهدف لا يوجد رقم تُنسب إليه — فالمعروض أعلاه هو ما في السجل فعلًا. " +
      "حدِّد المستهدف الربعي من «المستهدفات والأداء» وتعود لوحة التغطية كما هي.") +
      '<div style="text-align:center;margin-block-start:var(--s3)">' +
      '<a class="btn btn-teal crm-focusable" href="#perf" style="text-decoration:none;display:inline-flex;align-items:center;">حدِّد المستهدفات</a></div></div>';
    var withOpen = secs.filter(function (x) { return x.openCount > 0; });
    if (withOpen.length) {
      h0 += '<div class="sh-sec"><div class="sh-h">أين المفتوح الآن</div>' +
        '<div class="sh-hs">المتوقع من الفرص المفتوحة لكل قطاع. اضغط قطاعًا للوحته.</div>' +
        shStack(withOpen.map(function (sc, i) { return { n: sc.sector, v: sc.weightedOpen || 0, c: COL[i % COL.length] }; })) +
        '<div style="margin-block-start:var(--s3)"></div>' + sectorCards() + '</div>';
    }
    return h0;
  }

  /* ---- targets exist: the coverage layout, same components ---- */
  // THREE REPORTS PER ROW (founder, 2026-09-08). The band was a vertical stack of full-width
  // sections, so a 1440px screen showed one report and a lot of margin. Three per row is the
  // standard now; the grid drops to two at --bp-lg and one at --bp-sm, because three columns of
  // Arabic labels below 1280px stops being readable.
  // The card list under the chart repeated all three sector names and all three figures — the
  // page-duplication audit found each one printed twice. The chart rows are already buttons to the
  // same drill-down, so the list is gone and its one extra fact, the open count, moved onto the
  // chart row itself.
  var h = '<div class="pc-g3">';
  h += '<div class="sh-sec card3"><div class="sh-h">القطاعات</div>' +
    /* pcSectors is /admin/sales/sectors with no query string, and index.ts defaults that to the
       CURRENT QUARTER. These are one quarter's figures; the heading called them the year's. */
      '<div class="sh-hs">المحقق مقابل مستهدف الربع '
      + fmtN(pcSectors.quarter) + ' · ' + esc(String(pcSectors.year))
      + '. اضغط قطاعًا للوحته.</div>' +
    pcSectorRows(secs) + '</div>';

  var targeted = prods.filter(function (p) { return p.annualTarget > 0; });
  var untargeted = prods.length - targeted.length;
  if (targeted.length) {
    h += '<div class="sh-sec card3"><div class="sh-h">المنتجات حسب الإنجاز</div>' +
      '<div class="sh-hs">الأقل إنجازًا أولًا' +
      (untargeted ? ' · ' + pxNProd(untargeted) + ' بلا مستهدف لا تُرتَّب هنا' : '') + '.</div><div class="ex-rows">';
    targeted.sort(function (a, b) { return a.coveragePct - b.coveragePct; }).slice(0, 5).forEach(function (p) {
      h += exRow({
        go: "product", nm: p.product, sub: pcSectorOfProduct(p),
        fig: p.achieved, of: p.annualTarget, pct: p.coveragePct
      });
    });
    h += '</div></div>';
  }

  /* The accounting-basis caveat («قيمة العقد الكاملة… الأساس المحاسبي لم يُحسم») is OFF the home
     screen by founder instruction, 2026-09-16. It is not deleted: it belongs where someone is
     acting on the figure — «التقارير» (rp-basis) and the executive report (rx-basis) both still
     print it — not on the opening band a founder reads for position. */
  h += '<div class="sh-sec card3"><div class="sh-h">الإنجاز الربعي · ' + arYear(pcQuarters.year) + '</div>' +
    pcQuarterChart(pcQuarters) + '</div>';
  h += '</div>';
  return h;
}

/* THE SECTOR CHART. Replaces a single stacked share bar, which answered «what proportion of the
   book is each sector» and nothing else — at three sectors that is a question nobody asks, and the
   colour key was the only way to read it.

   One horizontal bar per sector instead, split into MEACHIEVED and WEIGHTED-OPEN. Horizontal
   because sector names are long Arabic phrases: DESIGN.md 6.5 says a label you truncate is a label
   you did not draw, so a column chart here would either clip every name or turn them sideways.
   Each row is direct-labelled with its name and figure, so the colour key supports the reading
   rather than carrying it (6.4).

   A sector with nothing in it still gets a row, at «—». Dropping empty sectors would quietly
   change the denominator of what the reader thinks they are looking at. */
/* ONE row, used by both exec lists. It carries the middle tier of type the page was missing:
   the name at --t-sm/700, the figure at --t-lg/700, the share at --t-xl/800. Tone is on the SHARE
   only — the figure stays ink, because a coloured figure and a coloured percentage of the same
   fact is one meaning said twice in two channels. */
function exRow(o) {
  var pct = o.pct === null || o.pct === undefined ? null : Math.round(o.pct);
  var tone = pct === null ? "var(--muted)"
    : pct >= 100 ? "#12633F" : pct >= 70 ? "var(--accent-deep)" : pct >= 30 ? "#7A5600" : "#8E2A27";
  var w = pct === null ? 0 : Math.max(0, Math.min(100, pct));
  var has = Number(o.fig) > 0;
  var hasT = Number(o.of) > 0;
  return '<button type="button" class="ex-row go" data-go="' + o.go + '" data-nm="' + esc(o.nm) + '">' +
    '<span class="nm">' + esc(o.nm) + (o.sub ? "<em>" + esc(o.sub) + "</em>" : "") + "</span>" +
    '<span class="fig' + (has ? "" : " none") + '">' + (has ? pcMoney(o.fig) : "—") + "</span>" +
    '<span class="of' + (hasT ? "" : " none") + '">' + (hasT ? "من " + pcMoney(o.of) : "لم يُحدَّد") + "</span>" +
    '<span class="trk"><i style="width:' + w + "%;background:" + tone + '"></i></span>' +
    '<span class="pct' + (pct === null ? " none" : "") + '"' + (pct === null ? "" : ' style="color:' + tone + '"') + ">" +
    (pct === null ? "—" : fmtN(pct) + "٪") + "</span></button>";
}
/* The sector a product sells into, for the row's sub-line. The catalogue owns the mapping. */
function pcSectorOfProduct(p) {
  if (p.sector) return p.sector;
  var cat = (typeof pcCat !== "undefined" && pcCat) || [];
  for (var i = 0; i < cat.length; i++) if (cat[i].product === p.product) return cat[i].sector || "";
  return "";
}
/* The sectors, in the same row grammar as the products — they answer the same shape of question,
   so drawing one as a bar chart and the other as cards taught a difference that does not exist. */
function pcSectorRows(secs) {
  /* «بلا قطاع» IS SHOWN when it carries value. Filtering it out silently changed the denominator
     the reader thinks they are looking at — the same rule the old chart stated for empty sectors,
     applied to the bucket that is not empty. It is not cosmetic here: «تكامل الأنظمة» carries
     3,100,000 of the year's 3,111,000 achieved and has NO sector, so hiding the bucket made
     «قطاع المستشفيات» read 11,000 / 0٪ directly under a deck reading 3.1 مليون / 49٪. Two figures
     on one screen that cannot both be right is the defect this row exists to expose, not hide. */
  var list = (secs || []).filter(function (sc) {
    return !sc.isUnclassified || Number(sc.achieved) > 0 || Number(sc.weightedOpen) > 0 || Number(sc.target) > 0;
  });
  if (!list.length) return "";
  return '<div class="ex-rows">' + list.map(function (sc) {
    var opens = Number(sc.openCount) || 0;
    var tgt = Number(sc.target) || 0, won = Number(sc.achieved) || 0;
    var sub = opens ? fmtN(opens) + " فرصة مفتوحة" : "بلا فرص مفتوحة";
    /* The unclassified bucket says WHY it is here and what to do, because a row called «بلا قطاع»
       carrying most of the year's revenue is a catalogue problem, not a sales one. */
    if (sc.isUnclassified) sub = "منتجات بلا قطاع — حدِّد قطاعها من «المنتجات» لتدخل الحساب أعلاه · " + sub;
    return exRow({
      go: sc.isUnclassified ? "products" : "sector", nm: sc.sector,
      sub: sub,
      fig: won, of: tgt,
      pct: tgt > 0 ? (won / tgt) * 100 : null
    });
  }).join("") + "</div>";
}
function pcSectorChart(secs) {
  var list = (secs || []).filter(function (sc) { return !sc.isUnclassified; });
  if (!list.length) return "";
  var vals = list.map(function (sc) {
    return { sc: sc, won: Number(sc.achieved) || 0, open: Number(sc.weightedOpen) || 0 };
  });
  var mx = 1;
  vals.forEach(function (v) { mx = Math.max(mx, v.won + v.open); });
  var anyOpen = vals.some(function (v) { return v.open > 0; });
  var anyWon = vals.some(function (v) { return v.won > 0; });

  var rows = vals.map(function (v) {
    var total = v.won + v.open;
    var wPct = Math.round(v.won / mx * 100);
    var oPct = Math.round(v.open / mx * 100);
    var bars = (v.won > 0 ? '<i class="won" style="width:' + Math.max(wPct, 1) + '%"></i>' : "") +
               (v.open > 0 ? '<i class="open" style="width:' + Math.max(oPct, 1) + '%"></i>' : "");
    var opens = Number(v.sc.openCount) || 0;
    return '<button class="r go" data-go="sector" data-nm="' + esc(v.sc.sector) + '">' +
      '<span class="nm">' + esc(v.sc.sector) +
        '<em>' + (opens ? fmtN(opens) + " فرصة مفتوحة" : "بلا فرص مفتوحة") + "</em></span>" +
      '<span class="bar">' + bars + "</span>" +
      '<span class="fig' + (total > 0 ? "" : " none") + '">' +
        (total > 0 ? pcMoney(total) : "—") + "</span></button>";
  }).join("");

  return '<div class="pcs">' + rows + "</div>" +
    (anyWon || anyOpen
      ? '<div class="pcs-lg">' +
          (anyWon ? '<span><i class="s-won"></i>المحقق</span>' : "") +
          (anyOpen ? '<span><i class="s-open"></i>المتوقع من المفتوح</span>' : "") +
        "</div>"
      : "");
}

/* THE QUARTER CHART. Four tiles side by side made every quarter the same size on screen no matter
   what it held, so the year had no shape: a quarter at 0 looked exactly like a quarter at target.
   This draws it, and the geometry IS the data (DESIGN.md 6.1) — a wide light bar is the TARGET and
   a narrower solid bar in front of it is the ACHIEVED, both scaled against the same maximum, so
   the gap between them is the shortfall at a glance.

   A quarter with NO target does not get a zero bar. A zero bar is a claim that nothing was
   achieved against something; no target means the question was never asked (DESIGN.md 4), so it
   draws a hatched baseline and says so in words.

   Time runs right to left, like the language (DESIGN.md 6.3): quarters render in order and the
   RTL row places الربع 1 at the inline-start, which is the right. */
function pcQuarterChart(qs) {
  var list = qs.quarters || [];
  var mx = 1;
  list.forEach(function (q) {
    mx = Math.max(mx, Number(q.target) || 0, Number(q.achieved) || 0);
  });
  var anyTarget = list.some(function (q) { return (Number(q.target) || 0) > 0; });
  var anyValue = list.some(function (q) { return (Number(q.achieved) || 0) > 0; });

  var cols = list.map(function (q) {
    var isNow = q.quarter === qs.currentQuarter;
    var tgt = Number(q.target) || 0, ach = Number(q.achieved) || 0;
    var tPct = Math.round(tgt / mx * 100);
    var aPct = Math.round(ach / mx * 100);
    var bars = tgt > 0
      ? '<span class="tgt" style="height:' + Math.max(tPct, 2) + '%"></span>' +
        (ach > 0 ? '<span class="ach" style="height:' + Math.max(aPct, 2) + '%"></span>' : "")
      : '<span class="notgt"></span>';
    // The figure above the column is the ACHIEVED. Zero achieved against a real target is a true
    // «0»; no target at all is «—», because there is no denominator to be zero against.
    var top = tgt > 0 ? pcMoney(ach) : "—";
    var sub = tgt > 0
      ? "من " + pcMoney(tgt) + (q.coveragePct === null ? "" : " · " + fmtN(q.coveragePct) + "٪")
      : "بلا مستهدف";
    return '<div class="col' + (isNow ? " now" : "") + '">' +
      '<div class="val">' + top + "</div>" +
      '<div class="plot">' + bars + "</div>" +
      '<div class="lbl">الربع ' + fmtN(q.quarter) + (isNow ? " · الحالي" : "") + "</div>" +
      '<div class="sub2">' + sub + "</div></div>";
  }).join("");

  if (!anyTarget && !anyValue) {
    return '<div class="crm-empty" style="margin-block-end:var(--s3)"><b>لا مستهدف ولا محقق لهذه السنة</b>' +
      '<div>حدِّد المستهدف الربعي من «المستهدفات والأداء» وتظهر الأرباع هنا مرسومة.</div></div>';
  }
  // A colour-only legend is banned (DESIGN.md 6.4): each key carries its swatch AND its word.
  return '<div class="pcq">' + cols + "</div>" +
    '<div class="pcq-lg">' +
      '<span><i class="s-ach"></i>المحقق</span>' +
      '<span><i class="s-tgt"></i>المستهدف</span>' +
      (anyTarget && list.some(function (q) { return !(Number(q.target) > 0); })
        ? '<span><i class="s-no"></i>بلا مستهدف</span>' : "") +
    "</div>";
}

function vSectorDrill(name) {
  pcLoad(false);
  if (typeof opLoad === "function") opLoad(false);
  if (!pcSectors) return pcBack() + moSkeleton(6, ["w60", "w80", "w40"]);
  var sec = pcSectors.sectors.filter(function (x) { return x.sector === name; })[0];
  if (!sec) return pcBack() + '<div class="crm-empty"><b>قطاع غير موجود</b></div>';

  var h = pcBack();
  var cov = sec.coveragePct;
  h += '<div class="sh-tiles">' +
    '<div class="sh-tile lead"><div><div class="k">المحقق</div>' +
      /* «من 0 ر.س» asserts a target of zero. An absent target is not a zero one, and the
         التغطية tile eight lines down already says «بلا مستهدف» — the row contradicted itself. */
      '<div class="s">' + (Number(sec.target) > 0 ? "من " + pcMoney(sec.target) : "بلا مستهدف") + '</div></div>' +
      '<div class="v">' + fmtN(Math.round(sec.achieved)) + '</div></div>' +
    '<div class="sh-tile"><div><div class="k">المتوقع من المفتوح</div>' +
      '<div class="s">' + fmtN(sec.openCount) + ' فرصة مفتوحة</div></div>' +
      '<div class="v">' + fmtN(Math.round(sec.weightedOpen)) + '</div></div>' +
    '<div class="sh-tile"><div><div class="k">مربوحة</div><div class="s">في الفترة</div></div>' +
      '<div class="v">' + fmtN(sec.wonCount) + '</div></div>' +
    '<div class="sh-tile"><div><div class="k">التغطية</div>' +
      '<div class="s">' + (cov === null ? "بلا مستهدف" : "محقق + متوقع") + '</div></div>' +
      '<div class="v">' + (cov === null ? "—" : fmtN(cov) + "٪") + '</div></div>' +
  '</div>';

  h += '<div class="sh-sec"><div class="sh-h">منتجات القطاع حسب الإنجاز</div>' +
    '<div class="sh-hs">اضغط منتجًا لفتح لوحته.</div><div class="sh-cards">';
  (sec.products || []).forEach(function (nm) {
    var pq = (pcQuarters && pcQuarters.byProduct ? pcQuarters.byProduct : []).filter(function (x) { return x.product === nm; })[0];
    var c = pq ? pq.coveragePct : null;
    var cls = c === null ? "crm-none" : (c >= 100 ? "crm-ok" : (c >= 70 ? "crm-warn" : "crm-bad"));
    h += '<div class="sh-card go" data-go="product" data-nm="' + esc(nm) + '">' +
      '<div><div class="nm">' + esc(nm) + '</div>' +
      '<div class="sub">' + (pq
        ? (pcMoney(pq.achieved) + (pq.annualTarget === null || pq.annualTarget === undefined
            ? " · بلا مستهدف سنوي" : " من " + pcMoney(pq.annualTarget)))
        : '<span class="crm-none">لم يُقرأ الأداء</span>') + '</div></div>' +
      '<div class="end"><span class="crm-st ' + cls + '"><i></i>' +
        (c === null ? "بلا مستهدف" : fmtN(c) + "٪") + '</span></div></div>';
  });
  h += '</div></div>';
  return h;
}
`;
