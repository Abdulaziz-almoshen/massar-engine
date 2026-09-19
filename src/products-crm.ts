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
/* ===== the executive band, rebuilt =====
   The old one spread four facts across 1658px of five-column grid, three columns of which printed
   «—». Density is not decoration here: a row the eye can take in one fixation is a row that gets
   read. Everything below is a three-track grid with ONE flexible column, so the figures line up
   in a column down the page instead of drifting with content width. */
/* THREE COLUMNS. The three sections answer three different questions - which sector, which
   product, which quarter - so they are read side by side and compared, not scrolled through in
   sequence. The lede spans all three because it qualifies all of them.
   A column is ~1/3 of the band, so inside one there is no room for a four-track row: the row
   grid collapses to label+figure with the track on its own line (see .xb-row below). */
.ds6 .xb{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));
  gap:var(--m-3);align-items:start}
.ds6 .xb-lede{grid-column:1 / -1}

/* The one sentence the reader needs before any number. Tinted, because it is context rather than
   data — the same move the reference makes with its hint panel. */
.ds6 .xb-lede{display:flex;align-items:flex-start;gap:var(--m-3);
  padding:var(--m-3) var(--m-4);border-radius:var(--m-r-card);
  background:var(--m-ac-dim);box-shadow:inset 0 0 0 1px var(--m-ac-line)}
.ds6 .xb-lede--none{background:var(--m-warn-dim);box-shadow:inset 0 0 0 1px var(--m-warn-line)}
.ds6 .xb-lede__i{flex:none;inline-size:8px;block-size:8px;border-radius:50%;
  background:var(--m-ac);margin-block-start:7px}
.ds6 .xb-lede--none .xb-lede__i{background:var(--m-warn)}
.ds6 .xb-lede > div{flex:1;min-inline-size:0;max-inline-size:62ch}
.ds6 .xb-lede b{display:block;inline-size:fit-content;max-inline-size:100%;
  font-size:var(--m-t-body);font-weight:600;color:var(--m-ink)}
.ds6 .xb-lede span{display:block;inline-size:fit-content;max-inline-size:100%;
  font-size:var(--m-t-cap);color:var(--m-ink-2);
  line-height:var(--m-leading-meta);margin-block-start:2px}
.ds6 .xb-lede .m-link{flex:none;white-space:nowrap;align-self:center}

.ds6 .xb-sec{background:var(--m-paper);border-radius:var(--m-r-card);
  box-shadow:inset 0 0 0 1px var(--m-line);overflow:hidden}
.ds6 .xb-h{display:flex;align-items:baseline;justify-content:space-between;gap:var(--m-3);
  padding:var(--m-3) var(--m-4);font-size:var(--m-t-cap);font-weight:600;color:var(--m-ink);
  border-block-end:1px solid var(--m-line)}
.ds6 .xb-h span{font-weight:400;color:var(--m-faint)}

/* label | track | figure | percent. The track is the only elastic column, so every figure and
   every percent sits on the same vertical line whatever the label length. */
.ds6 .xb-row{display:grid;
  grid-template-columns:minmax(0,1fr) auto;
  grid-template-areas:"n p" "t t" "v v";
  align-items:center;gap:6px var(--m-3);inline-size:100%;
  padding:10px var(--m-4);font:inherit;text-align:start;background:none;border:0;
  color:inherit;position:relative;cursor:pointer;
  border-block-start:1px solid var(--m-line-soft);
  transition:background var(--m-out) var(--m-ease)}
.ds6 .xb-sec .xb-row:first-of-type{border-block-start:0}
.ds6 .xb-row__n{font-size:var(--m-t-cap);font-weight:600;color:var(--m-ink);min-inline-size:0;
  overflow-wrap:anywhere}
.ds6 .xb-row__n em{display:block;font-style:normal;font-weight:400;font-size:var(--m-t-micro);
  color:var(--m-faint);margin-block-start:2px}
.ds6 .xb-row__n{grid-area:n}
.ds6 .xb-row__p{grid-area:p}
.ds6 .xb-row__t{grid-area:t;block-size:8px;border-radius:999px;background:var(--m-sunk);overflow:hidden}
.ds6 .xb-row__v{grid-area:v}
.ds6 .xb-row__t i{display:block;block-size:100%;border-radius:999px;background:var(--m-ac);
  transition:inline-size var(--m-in) var(--m-move)}
.ds6 .xb-row__v{font-size:var(--m-t-cap);font-weight:600;color:var(--m-ink);white-space:nowrap;
  text-align:start;display:flex;align-items:baseline;gap:6px}
.ds6 .xb-row__v em{font-style:normal;font-weight:400;font-size:var(--m-t-micro);
  color:var(--m-faint)}
.ds6 .xb-row__p{font-size:var(--m-t-body);font-weight:700;color:var(--m-ink);text-align:end;
  white-space:nowrap}
/* Zero is not a failure here, it is an unstarted quarter. Red would say the opposite. */
.ds6 .xb-row__p.is-nil{font-weight:400}

/* The edge marks the row; the ground only separates it. A pseudo-element with
   inset-inline-start, never a box-shadow offset — shadow offsets are physical and land on the
   wrong edge in RTL. */
.ds6 .xb-row::before{content:"";position:absolute;inset-block:0;inset-inline-start:0;
  inline-size:3px;background:var(--m-ac);opacity:0;
  transition:opacity var(--m-out) var(--m-ease)}
@media (hover:hover) and (pointer:fine){
  .ds6 .xb-row:hover{background:var(--m-sunk)}
  .ds6 .xb-row:hover::before{opacity:1}
}
.ds6 .xb-row:active{transform:scale(.997)}
.ds6 .xb-row:focus-visible{outline:none;background:var(--m-ac-dim);box-shadow:var(--m-focus)}

/* Everything unmeasured, on one line. Three identical rows of «—» taught the reader to skip the
   block; the fact that matters about them is that they are unmeasured, and that is one fact. */
.ds6 .xb-idle{display:block;padding:10px var(--m-4);background:var(--m-sunk);
  border-block-start:1px solid var(--m-line);
  font-size:var(--m-t-micro);color:var(--m-mut);line-height:var(--m-leading-meta)}
.ds6 .xb-idle b{font-weight:600;color:var(--m-ink-2)}
.ds6 .xb-idle--q{border-radius:0;background:none;
  border-block-start:1px solid var(--m-line-soft);color:var(--m-faint)}

.ds6 .xb-qs{display:grid;gap:var(--m-2);padding:var(--m-3) var(--m-4)}
.ds6 .xb-q{display:grid;grid-template-columns:minmax(0,1fr);gap:5px}
.ds6 .xb-q__k{font-size:var(--m-t-cap);color:var(--m-ink-2)}
.ds6 .xb-q.is-cur .xb-q__k{font-weight:600;color:var(--m-ink)}
.ds6 .xb-q__t{block-size:8px;border-radius:999px;background:var(--m-sunk);overflow:hidden}
.ds6 .xb-q__t i{display:block;block-size:100%;border-radius:999px;background:var(--m-ac)}
.ds6 .xb-q__v{font-size:var(--m-t-micro);font-weight:600;color:var(--m-ink);white-space:nowrap}
.ds6 .xb-q__v em{font-style:normal;font-weight:400;color:var(--m-faint)}

@media (prefers-reduced-motion:reduce){
  .ds6 .xb-row,.ds6 .xb-row::before,.ds6 .xb-row__t i{transition:none}
  .ds6 .xb-row:active{transform:none}
}
/* Under ~900px the label column stops earning 15rem: the track drops to its own line so the
   figures keep their alignment instead of crushing to two characters. */
/* Below ~1100px a third of the band is narrower than the figures it has to hold, so the three
   columns stack rather than crush. */
@media (max-width:1100px){ .ds6 .xb{grid-template-columns:minmax(0,1fr)} }
.ex-rows{background:var(--paper);border-radius:var(--r-win,14px);overflow:hidden}
.ex-row{display:grid;grid-template-columns:minmax(0,1.3fr) 150px 140px minmax(120px,1fr) 78px;
  align-items:center;gap:var(--s3);width:100%;padding:var(--s3) var(--s4);text-align:start;
  font-family:inherit;background:none;border:0;border-block-start:1px solid var(--line-soft);
  color:inherit;transition:background 120ms var(--ease-out)}
.ex-rows > .ex-row:first-child{border-block-start:0}
.ex-row.go{cursor:pointer}
/* This row is 1658px wide on a desktop, and washing all of it in the accent on hover put a slab
   of colour under the cursor that read as the block jumping. The row is scanned constantly - it
   is a list you run your eye down - so the hover has to be the quietest thing that still says
   "this one". A neutral ground plus a 3px accent edge at the inline-start does that: the edge is
   what the eye catches, and the ground only has to separate the row from its neighbours.
   The edge is drawn with a box-shadow, not a border or padding, so nothing reflows. */
.ds6 .ex-row.go{position:relative;transition:background var(--m-out) var(--m-ease)}
/* The edge is a pseudo-element with inset-inline-start, NOT a box-shadow offset: a shadow's
   offsets are PHYSICAL, so "3px" would draw on the left and land on the wrong edge in RTL. */
.ds6 .ex-row.go::before{content:"";position:absolute;inset-block:0;inset-inline-start:0;
  inline-size:3px;background:var(--m-ac);opacity:0;
  transition:opacity var(--m-out) var(--m-ease)}
@media (hover:hover) and (pointer:fine){
  .ds6 .ex-row.go:hover{background:var(--m-sunk)}
  .ds6 .ex-row.go:hover::before{opacity:1}
}
@media (hover:none){.ds6 .ex-row.go:hover{background:none}}
@media (prefers-reduced-motion:reduce){
  .ds6 .ex-row.go,.ds6 .ex-row.go::before{transition:none}}
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
/* ONE SHAPE ACROSS THE ROW (founder, 2026-09-18). The search is a pill and both buttons are pills,
   while the four filters carried the form radius — three different silhouettes in one strip. In a
   toolbar every control is a pill; the 10px radius stays where it belongs, on form fields. */
.ds6 .px-filters .m-select { border-radius: 999px; }
/* A filter that is NARROWING the list has to look different from one that is not, or the reader
   cannot tell an empty table from a filtered one. The vocabulary has no word for it; this is it. */
.ds6 .px-filters .m-select.px-on { box-shadow: 0 0 0 1px var(--m-ac), 0 1px 2px rgba(0,0,0,.05); color: var(--m-ac-deep); }
/* THE SKILL NOTICE. It was a full-width amber bar whose middle was a raw zip filename, with the one
   thing to do parked at the far end. It is a quiet card now: what is missing, what the skill does,
   and the download — the filename moved onto the link, where a filename belongs. */
.ds6 .px-skill {
  display: flex; align-items: center; gap: var(--m-3); flex-wrap: wrap;
  margin-block-start: var(--m-3);
  padding-block: var(--m-3); padding-inline: var(--m-5);
  border-radius: var(--m-r-card);
  background: var(--m-page);
  box-shadow: inset 0 0 0 1px var(--m-line);
}
.ds6 .px-skill__i { flex: none; inline-size: 18px; block-size: 18px; color: var(--m-mut);
  fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.ds6 .px-skill__t { flex: 1 1 260px; min-inline-size: 0; font-size: var(--m-t-cap); color: var(--m-ink-2); }
.ds6 .px-skill__t b { color: var(--m-ink); }
.ds6 .px-skill .m-btn { flex: none; }
.ds6 .px-sp { flex: 1 1 auto; }
/* A gap someone owes work on, inside the segmented control. Colour means STATUS here, never
   decoration, and it is the only toggle in the row that carries one. */
.ds6 .m-seg .px-owed { color: var(--m-warn); }
.ds6 .m-seg .px-owed[aria-pressed="true"] { background: var(--m-warn-dim); color: var(--m-warn); }
/* A .m-btn used as a toggle. .m-seg already draws aria-pressed; a standalone button did not. */
.ds6 .m-btn[aria-pressed="true"] { background: var(--m-ac-dim); border-color: var(--m-ac-line); color: var(--m-ac-deep); }
/* The name cell is the row's link. It keeps the cell's weight rather than taking .m-link, whose
   44px minimum would push the sub-line out of a table row. */
.ds6 .m-table td.m-td-n a { color: inherit; text-decoration: none; }
@media (hover: hover) and (pointer: fine) {
  .ds6 .m-table td.m-td-n a:hover { color: var(--m-ac-deep); text-decoration: underline; text-underline-offset: 3px; }
}
/* A card's body: the sections inside a record pane are stacked, never crammed. */
.ds6 .px-secb { display: flex; flex-direction: column; gap: var(--m-4); min-inline-size: 0; }
/* A flush card's own body padding, for the one list that lives inside .m-card--pad0. */
.ds6 .px-um { padding: var(--m-4); gap: 0; }
.ds6 .m-dlg__b > * + * { margin-block-start: var(--m-4); }
/* A related-population row is a control, not a link: same row, a button's reset. */
.ds6 button.m-item { font: inherit; inline-size: 100%; background: transparent; border: 0;
  border-block-start: 1px solid var(--m-line); cursor: pointer; text-align: start; color: inherit;
  transition: background var(--m-out) var(--m-ease); }
.ds6 button.m-item:first-child { border-block-start: 0; }
@media (hover: hover) and (pointer: fine) { .ds6 button.m-item:hover { background: var(--m-page); } }
/* A quarter row carries money, not a two-digit count: the value column is given the room. */
.ds6 .px-qrow { grid-template-columns: minmax(0, 1fr) 120px minmax(0, auto); }
/* A share row that is also a filter. The vocabulary draws the row; this gives it a button's reset. */
.ds6 button.m-seg-row { font: inherit; inline-size: 100%; background: transparent; border: 0;
  cursor: pointer; text-align: start; color: inherit; border-radius: var(--m-r-ctl);
  padding-inline: var(--m-1); padding-block: var(--m-1);
  transition: background var(--m-out) var(--m-ease), transform var(--m-press) var(--m-ease); }
.ds6 button.m-seg-row:active { transform: scale(.97); }
.ds6 button.m-seg-row[aria-pressed="true"] { background: var(--m-ac-dim); }
@media (hover: hover) and (pointer: fine) { .ds6 button.m-seg-row:hover { background: var(--m-page); } }
/* THE RECORD'S INDICATORS, as one strip rather than five cards (founder, 2026-09-18: «the dashboard
   is too big here for small indicators»). As .m-card tiles on an auto-fit grid each figure sat in
   24px of padding at card scale, the five together stood about 300px tall, and the fifth stranded
   itself on a second row beside an empty half-screen. Five small facts are a strip: one bordered
   object, hairline dividers, the figure at section scale.

   The dividers are the GAP showing the container's own colour, so they stay correct at every wrap —
   a per-cell border leaves a double line where a row breaks. */
.ds6 .px-ind {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 1px;
  background: var(--m-line);
  border: 1px solid var(--m-line);
  border-radius: var(--m-r-card);
  overflow: hidden;
}
.ds6 .px-ind__i { background: var(--m-paper); min-inline-size: 0;
  padding-block: var(--m-3); padding-inline: var(--m-5); display: flex; flex-direction: column; gap: 2px; }
.ds6 .px-ind__k { font-size: var(--m-t-micro); color: var(--m-mut);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ds6 .px-ind__v { font-size: var(--m-t-h); line-height: var(--m-leading-section); font-weight: 700;
  color: var(--m-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ds6 .px-ind__v .m-nil--owed, .ds6 .px-ind__v .m-nil--unset { font-size: var(--m-t-cap); font-weight: 400; }
.ds6 .px-ind__s { font-size: var(--m-t-micro); color: var(--m-faint);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ds6 .px-ind .m-meter { block-size: 6px; margin-block-start: var(--m-1); }
.ds6 .px-ind__i--ac .px-ind__v { color: var(--m-ac-deep); }
@media (max-width: 1100px) { .ds6 .px-ind { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 700px) { .ds6 .px-ind { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
/* The list's summary: the strip sits flush inside a padding-less card, so the card's own border is
   the strip's border and there is no double frame. */
.ds6 .px-ind--flush { border: 0; border-radius: 0; grid-template-columns: repeat(4, minmax(0, 1fr)); }
@media (max-width: 1100px) { .ds6 .px-ind--flush { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 700px) { .ds6 .px-ind--flush { grid-template-columns: minmax(0, 1fr); } }
.ds6 .px-sum__k { padding-block: var(--m-3) 0; padding-inline: var(--m-5);
  font-size: var(--m-t-micro); color: var(--m-mut); }
.ds6 .px-sum__v { padding-block: 0 var(--m-3); padding-inline: var(--m-5); }
.ds6 .px-sum__f { padding-block: var(--m-3); padding-inline: var(--m-5);
  border-block-start: 1px solid var(--m-line); }
.ds6 .px-sum__n { padding-block: var(--m-3) 0; padding-inline: var(--m-5); }
/* The search takes the room it needs, not the whole row: at flex 1 it stretched to half the toolbar
   and read as the page's subject rather than one of its controls. */
.ds6 .px-filters .m-sf { flex: 0 1 300px; }

/* THE READINESS BAND. One object, hairline dividers drawn as the grid gap (the same construction as
   the indicator strip below it), wrapping instead of compressing. The verdict leads and is wider
   than the rest; each remaining cell is one thing the assistant needs, its state in the dot, and the
   action to fix it where there is one. */
.ds6 .px-rdy-band {
  display: grid;
  grid-template-columns: minmax(200px, 1.4fr) repeat(auto-fit, minmax(180px, 1fr));
  gap: 1px;
  margin-block-start: var(--m-4);
  background: var(--m-line);
  border: 1px solid var(--m-line);
  border-radius: var(--m-r-card);
  overflow: hidden;
}
.ds6 .px-rdy-band__v,
.ds6 .px-rdy-band__i {
  background: var(--m-paper);
  min-inline-size: 0;
  padding-block: var(--m-3);
  padding-inline: var(--m-5);
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ds6 .px-rdy-band__k { display: flex; align-items: center; gap: var(--m-2);
  font-size: var(--m-t-micro); color: var(--m-mut); }
.ds6 .px-rdy-band__k i { inline-size: 8px; block-size: 8px; border-radius: 50%; flex: none;
  background: var(--m-ok); }
.ds6 .px-rdy-band__i.is-miss .px-rdy-band__k i { background: var(--m-bad); }
.ds6 .px-rdy-band__i.is-pend .px-rdy-band__k i { background: var(--m-warn); }
.ds6 .px-rdy-band__w { font-size: var(--m-t-body); font-weight: 700; color: var(--m-ink); }
.ds6 .px-rdy-band__v.ok .px-rdy-band__w { color: var(--m-ok); }
.ds6 .px-rdy-band__v.no .px-rdy-band__w { color: var(--m-warn); }
.ds6 .px-rdy-band__m { margin-block-start: var(--m-1); }
.ds6 .px-rdy-band__t { font-size: var(--m-t-cap); color: var(--m-ink); }
/* The action sits at the cell's end and does not stretch it: a button as wide as its column reads
   as the primary thing to do on the screen, and none of these four are. */
.ds6 .px-rdy-band__i .m-btn { align-self: flex-start; min-block-size: 30px; padding-inline: var(--m-2);
  margin-block-start: var(--m-1); }
@media (max-width: 760px) { .ds6 .px-rdy-band { grid-template-columns: minmax(0, 1fr); } }

/* The readiness cell: the meter and the word beside it on one line, the word shrinking rather than
   the pair wrapping. The full sentence stays reachable as the cell's title. */
.ds6 .px-rdy { display: flex; align-items: center; gap: var(--m-2); min-inline-size: 0; }
.ds6 .px-rdy .m-chip { min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* THE SPINE, on the record's page-level blocks. The crumb, the title, the product switcher and the
   tab rail are not inside a card, so their text sat flush against the container while every card on
   the list screen inset its own text by --m-5 — measured: 0px against 25px, so everything shifted
   sideways when moving between the two screens. They are padded to the same inset instead. */
.ds6.px-rec-page > .m-crumb,
.ds6 .px-rh,
.ds6 .px-sw,
.ds6 .px-tabs { padding-inline: var(--m-5); }
/* The record header: title, the chips that name its classification, and its actions. */
.ds6 .px-rh { display: flex; align-items: flex-start; justify-content: space-between;
  gap: var(--m-4); flex-wrap: wrap; margin-block-end: var(--m-4); }
.ds6 .px-rh__t { min-inline-size: 0; display: grid; gap: var(--m-2); }
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
/* Money in the vocabulary's shape (PORT-SPEC 3): the digits inside .m-n, the currency word outside
   it. mMoney is the ONE definition, declared in exec-reports-crm.ts and hoisted across the whole
   concatenated page script — a second formatter here is how one figure gets printed two ways. */
function pxMoney(v) { return mMoney(v); }
/* A YEAR IS NOT A QUANTITY. fmtN groups thousands and printed «2,026» on the live page the first
   time this shipped, so a year is stringified and only then isolated. */
function pxYear(y) { return '<span class="m-n">' + String(Number(y) || 0) + "</span>"; }
/* Arabic counts are four-way, never «n + noun». Two families, and the difference matters:
   pxN* returns PLAIN TEXT for an aria-label, a toast and the readiness band (which is NOT ported
   and passes these through esc()); pxN*N returns MARKUP with the numeral inside .m-n. Passing a
   markup helper to esc() prints the span as literal angle brackets. */
function pxPl(n, one, two, few, many) { return pluralizeArabic(n, one, two, few, many, fmtN); }
function pxNProd(n) { return pxPl(n, "منتج واحد", "منتجان", "منتجات", "منتجًا"); }
function pxNLine(n) { return pxPl(n, "بند واحد", "بندان", "بنود", "بندًا"); }
function pxNRowTxt(n) { return pxPl(n, "سطر واحد", "سطران", "أسطر", "سطرًا"); }
function pxNRead(n) { return pxPl(n, "قراءة واحدة", "قراءتان", "قراءات", "قراءة"); }
function pxNQtr(n) { return pxPl(n, "ربع واحد", "ربعان", "أرباع", "ربعًا"); }
function pxNPkg(n) { return pxPl(n, "باقة واحدة", "باقتان", "باقات", "باقة"); }
function pxNCamp(n) { return pxPl(n, "حملة واحدة", "حملتان", "حملات", "حملة"); }
function pxNEnt(n) { return pxPl(n, "جهة واحدة", "جهتان", "جهات", "جهة"); }
function pxNProdN(n) { return mPl(n, "منتج واحد", "منتجان", "منتجات", "منتجًا"); }
function pxNLineN(n) { return mPl(n, "بند واحد", "بندان", "بنود", "بندًا"); }
function pxNRowN(n) { return mPl(n, "سطر واحد", "سطران", "أسطر", "سطرًا"); }
function pxNReadN(n) { return mPl(n, "قراءة واحدة", "قراءتان", "قراءات", "قراءة"); }
function pxNQtrN(n) { return mPl(n, "ربع واحد", "ربعان", "أرباع", "ربعًا"); }
function pxNPkgN(n) { return mPl(n, "باقة واحدة", "باقتان", "باقات", "باقة"); }
function pxNCampN(n) { return mPl(n, "حملة واحدة", "حملتان", "حملات", "حملة"); }
function pxNEntN(n) { return mPl(n, "جهة واحدة", "جهتان", "جهات", "جهة"); }
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

/* The four-way counted noun with its NUMERAL bound to a derivation (PORT-SPEC 6). One and two carry
   no numeral in Arabic, so there is nothing to bind there and the plain words are returned — which
   is also why the binding is per-site rather than global. */
function pxPlFig(key, n, one, two, few, many) {
  n = Number(n) || 0;
  if (n === 1) return one;
  if (n === 2) return two;
  return dsFig(key, n) + " " + (n >= 3 && n <= 10 ? few : many);
}
function pxNProdFig(key, n) { return pxPlFig(key, n, "منتج واحد", "منتجان", "منتجات", "منتجًا"); }

/* THE PRODUCT COUNT IS PRINTED IN FOUR PLACES on this screen — the summary chips, the archived
   toggle, the catalogue footer and the record's switcher rail — and every design review this
   project has had found the same defect by reading: the rail said six, the page said five of six,
   the truth was eight. Each count is now derived from the SAME array the markup renders from, and
   dsVerify re-runs every derivation on every paint and outlines a figure that disagrees.
   (The door badge in the rail is dashboard.ts's, outside .ds6 and outside this module; it carries
   no product count today, so there is nothing there to bind.) */
function pxBind() {
  dsD("pxAll", function () { return pxBaseRows().length; });
  dsD("pxShown", function () { return pxRows().length; });
  dsD("pxArch", function () { return (pcCat || []).filter(function (p) { return p.archived; }).length; });
  dsD("pxLive", function () { return (pcCat || []).filter(function (p) { return !p.archived; }).length; });
  dsD("pxNotSelling", function () { return pxBaseRows().filter(function (p) { return !p.eligible; }).length; });
  dsD("pxNoPrice", function () { return pxBaseRows().filter(function (p) { return pxPrice(p).kind === "none"; }).length; });
  dsD("pxAssumed", function () { return pxBaseRows().filter(function (p) { return !!p.sectorAssumed; }).length; });
}

function pxSummary() {
  var perf = pcPerf[pcPerfYear];
  var rows = pxBaseRows();
  var notSelling = rows.filter(function (p) { return !p.eligible; }).length;
  var noPrice = rows.filter(function (p) { return pxPrice(p).kind === "none"; }).length;
  var assumed = rows.filter(function (p) { return !!p.sectorAssumed; }).length;
  /* ONE FIGURE IS NOT A DECK (founder, 2026-09-18: «the top indicator is alone»). «المحقق» sat by
     itself in a full-width card with its number at one end and nothing at the other. It joins the
     three facts it is read against — what was targeted, what is open now, and how much of the
     catalogue carries a target at all — in the same strip the product record uses. */
  var h = '<section class="m-card m-card--pad0" aria-label="ملخص المنتجات">';
  if (!perf) {
    /* A failed read and an empty catalogue look identical to the reader, so the card says which:
       a read that did not happen is a classification nobody made, not a legitimate nothing. */
    h += '<p class="px-sum__k">المحقق ' + pxYear(pcPerfYear) + "</p>" +
      '<p class="px-sum__v">' + (pcPerfFailed[pcPerfYear]
        ? mNil("تعذّر تحميل الأداء", "unset") : mNil("لم يُقرأ الأداء بعد", "unset")) + "</p>";
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
    /* What is open right now, across the products this page is showing — the same lines the table's
       «المفتوح الآن» column counts, summed once here. */
    var openRows = ((typeof oppRows !== "undefined" && oppRows) ? oppRows : []).filter(function (l) {
      return typeof opIsOpen === "function" && opIsOpen(l) &&
        rows.some(function (p) { return p.product === l.product; });
    });
    var openVal = typeof opSumLive === "function" ? opSumLive(openRows) : 0;
    var targeted = rows.length - offN;
    var cell = function (k, v, sub) {
      return '<div class="px-ind__i"><span class="px-ind__k">' + k + "</span>" +
        '<span class="px-ind__v">' + v + "</span>" +
        '<span class="px-ind__s">' + sub + "</span></div>";
    };
    h += '<div class="px-ind px-ind--flush">' +
      cell("المحقق " + pxYear(pcPerfYear), pxMoney(ach),
        anyT ? ("من مستهدف " + pxMoney(tgt) + (cov === null ? "" : " · " + mPct(cov)))
             : mNil("بلا مستهدف سنوي", "owed")) +
      cell("المستهدف المسجّل", anyT ? pxMoney(tgt) : mNil("لا مستهدف", "owed"),
        anyT ? pxNProdN(targeted) + " من " + pxNProdN(rows.length) : "يُحدَّد من «المستهدفات»") +
      cell("المفتوح الآن", openRows.length ? pxMoney(openVal) : mNil("لا بنود مفتوحة", "none"),
        openRows.length ? opNLineN(openRows.length) : "لا شيء مفتوح على هذه المنتجات") +
      cell("خارج النسبة", offN ? pxMoney(offA) : mNil("لا شيء خارجها", "none"),
        offN ? pxNProdN(offN) + " بلا مستهدف" : "كل المنتجات لها مستهدف") +
      "</div>";
    if (won.length) {
      /* Each product's achieved against the LARGEST achieved, not against a target: most products
         carry no target, and a bar drawn against a denominator that does not exist for the row is
         the same defect as the percentage above it. The bar is a share of the biggest, and it says
         so by carrying the money beside it. */
      won.sort(function (a, b) { return b.v - a.v; });
      var mx = won[0].v || 1;
      h += '<div class="m-segs" role="group" aria-label="المنتجات المحققة — اضغط للتصفية">' + won.map(function (w) {
        var on = pxOnly === w.n;
        return '<button type="button" class="m-seg-row px-qrow" aria-pressed="' + on + '" data-px="only" data-nm="' + esc(w.n) + '">' +
          '<span class="m-seg-row__t">' + esc(w.n) + "</span>" +
          '<span class="m-seg-row__b"><i style="--m-pct:' + Math.max(2, Math.round((w.v / mx) * 100)) + '%"></i></span>' +
          '<span class="m-seg-row__v">' + pxMoney(w.v) + "</span></button>";
      }).join("") + "</div>";
    } else {
      h += '<p class="px-sum__n m-meta">لا مبيعات مربوحة بعد في ' + pxYear(pcPerfYear) + ".</p>";
    }
  }
  /* The three gaps, as independent toggles rather than one exclusive control — so the row is a
     segmented control that is allowed to wrap (.px-wrapseg). The tone is a STATUS, which is the
     only thing colour is allowed to mean here. */
  var met = function (key, dkey, n, label, warn) {
    var on = pxShort === key;
    /* The figure sits inside the button as a bound span, not as a nested chip: a chip inside a
       segmented control is a control inside a control, and the count is not a status. */
    return '<button type="button" aria-pressed="' + on + '" data-px="short" data-nm="' + key + '"' +
      (warn && n ? ' class="px-owed"' : "") + ">" + label + " " + dsFig(dkey, n) + "</button>";
  };
  h += '<div class="px-sum__f"><div class="m-seg px-wrapseg" role="group" aria-label="ما يلزم إكماله">' +
    met("notSelling", "pxNotSelling", notSelling, "لا يبيعها المساعد", true) +
    met("noPrice", "pxNoPrice", noPrice, "بلا سعر منشور", false) +
    met("assumed", "pxAssumed", assumed, "قطاع مُستنتَج", false) + "</div></div>";
  return h + "</section>";
}
function pxSelect(id, label, value, opts, on) {
  return '<select class="m-select' + (on ? " px-on" : "") + '" id="' + id + '" aria-label="' + label + '" data-pxchange="' + id + '">' +
    opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(value) === String(o[0]) ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") +
    "</select>";
}
function pxToolbar() {
  var nArch = (pcCat || []).filter(function (p) { return p.archived; }).length;
  var h = '<div class="px-filters" role="toolbar" aria-label="أدوات المنتجات">';
  h += mSearch({ id: "pxq", value: pxQ, placeholder: "ابحث باسم المنتج", label: "ابحث باسم المنتج", wide: true, attrs: ' data-pxinput="q"' });
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
  h += '<button type="button" class="m-btn" aria-pressed="' + pxArchived + '" data-px="archived">المؤرشفة' +
    (nArch ? ' <span class="m-chip m-chip--plain">' + dsFig("pxArch", nArch) + "</span>" : "") + "</button>";
  if (pxFiltered()) h += '<button type="button" class="m-btn m-btn--quiet" data-px="clear">مسح التصفية</button>';
  h += '<span class="px-sp" aria-hidden="true"></span>';
  h += pxSheet
    ? '<button type="button" class="m-btn" aria-disabled="true" tabindex="-1">إضافة منتج</button>'
    : '<button type="button" class="m-btn m-btn--primary" id="pxadd" data-px="create">إضافة منتج</button>';
  return h + "</div>";
}
function pxSkillLink(label) {
  if (!pcSkill) return '<span class="m-td-nil m-nil--none" data-pxskill="missing">المهارة غير مرفوعة بعد</span>';
  return '<a class="m-link" href="/assets/' + esc(pcSkill.publicId) + '" download data-pxskill="list">' + label + " &#8595;</a>";
}
function pxActionRows() {
  var h = "";
  var missing = (pcCat || []).filter(function (p) { return !p.archived && !p.asset; }).length;
  if (missing) {
    h += '<div class="px-skill">' +
      '<svg class="px-skill__i" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
        '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/></svg>' +
      '<span class="px-skill__t"><b>' + pxNProdN(missing) + " بلا ملف تعريفي</b> — " +
        "مهارة إعداد العرض تُنتج الملف بمساعد ذكاء اصطناعي.</span>" +
      (pcSkill
        ? '<a class="m-btn" href="/assets/' + esc(pcSkill.publicId) + '" download data-pxskill="list"' +
          ' title="' + esc(pcSkill.filename) + '">تحميل المهارة</a>'
        : '<span class="m-nil--none" data-pxskill="missing">المهارة غير مرفوعة بعد</span>') +
      "</div>";
  }
  if (pcUnmatched.length) {
    h += '<section class="m-card m-card--pad0"><div class="m-tools">' +
      '<button type="button" class="m-btn m-btn--quiet" aria-expanded="' + pcUnmatchedOpen + '" data-px="unmatched">' +
      "ملفات تحتاج ربطًا بمنتج " + mN(pcUnmatched.length) + "</button>" +
      '<span class="m-meta">' + (pcUnmatchedOpen ? "إخفاء" : "عرض") + "</span></div>";
    if (pcUnmatchedOpen) {
      var tags = (pcCat || []).filter(function (p) { return !p.archived; });
      h += '<div class="px-secb px-um">' + pcUnmatched.map(function (u, i) {
        return '<div class="m-item"><span class="m-item__b"><span class="m-item__n">' + esc(u.name) + "</span>" +
          '<span class="m-item__s">' + (u.kind === "kb" ? "ملف معرفة" : "ملف تعريفي") + " · " +
          (u.filename ? "<bdi>" + esc(u.filename) + "</bdi>" : mNil("بلا اسم ملف", "unset")) + "</span></span>" +
          '<span class="px-acts"><select class="m-select" id="pxum_' + i + '" aria-label="ربط «' + esc(u.name) + '» بمنتج"><option value="">ربط بمنتج…</option>' +
          tags.map(function (t) { return '<option value="' + esc(t.product) + '">' + esc(t.product) + "</option>"; }).join("") + "</select>" +
          '<button type="button" class="m-btn" data-px="reconcile" data-i="' + i + '">ربط</button>' +
          '<button type="button" class="m-btn" data-px="umcreate" data-i="' + i + '">إنشاء منتج بهذا الاسم</button></span></div>';
      }).join("") + "</div>";
    }
    h += "</section>";
  }
  return h;
}
/* ONE ROW OF THE CATALOGUE. Every absence here is one of the three KINDS (PORT-SPEC 4), because a
   target nobody entered, a price nobody published and an opportunity nobody opened are three
   different facts, and a column of identical dashes teaches the reader to see none of them. */
function pxListRow(p) {
  var perf = (pcPerf[pcPerfYear] || {})[p.product];
  var rd = pxReadiness(p), ps = pxPrice(p);
  var nm = esc(p.product);
  var h = '<tr data-pxrow="' + nm + '">';
  h += '<td class="m-td-n"><a href="#product/' + pxEnc(p.product) + '" data-px="open" data-nm="' + nm + '">' + nm + "</a>" +
    '<span class="m-meta">' + (p.sector ? esc(p.sector) : "بلا قطاع") + (p.sectorAssumed ? " (مُستنتَج)" : "") +
    (p.division ? " · " + esc(p.division) : "") +
    (p.owner ? " · " + esc(p.owner) : "") + (p.archived ? " · مؤرشف" : "") + "</span></td>";
  /* ONE ROW, ALWAYS. The meter and the chip used to flow inline, so a longer sentence in the chip
     («ينقصه تحديث كتالوج المساعد») pushed the meter onto a line of its own — and the column read
     ragged, with the meter above the chip on some rows and beside it on others. */
  h += '<td title="' + esc(rd.word) + '"><span class="px-rdy">' + pxCellsHtml(rd) +
    '<span class="m-chip' + (pxWordCls(rd) === "ok" ? " m-chip--ok" : pxWordCls(rd) === "no" ? " m-chip--warn" : "") +
    '" title="' + esc(rd.word) + '">' + esc(rd.word) + "</span></span></td>";
  h += "<td>" + (ps.kind === "package"
      ? "<b>" + pxMoney(ps.lowest.listPrice) + " / سنة</b>" +
        '<span class="m-meta">' + (ps.count > 1 ? "يبدأ من · " + pxNPkgN(ps.count) : esc(ps.lowest.name)) + "</span>"
      : ps.kind === "note" ? '<span class="m-meta">' + esc(p.pricingNote) + "</span>"
      /* A product priced by a committee case by case has NO published price, and that is a
         legitimate nothing — not a number anyone owes. */
      : mNil("لا سعر منشور", "none")) + "</td>";
  var tgt = perf ? perf.annualTarget : null;
  h += '<td class="m-td-v">' + (!perf ? mNil("لم يُقرأ الأداء", "unset")
    /* null is NOT a target of zero: a product nobody set a target for is a number someone owes. */
    : tgt === null || tgt === undefined ? mNil("بلا مستهدف", "owed")
    : pxMoney(tgt) + (perf.targetQuarters < 4 ? '<span class="m-meta">' + pxNQtrN(perf.targetQuarters) + " من أربعة</span>" : "")) + "</td>";
  var cov = perf ? targetCoveragePct(perf.achieved, tgt) : null;
  h += '<td class="m-td-v">' + (!perf ? mNil("لم يُقرأ الأداء", "unset")
    : pxMoney(perf.achieved) +
      '<span class="m-meta">' + (cov === null ? mNil("بلا نسبة — لا مستهدف", "owed") : mPct(cov) + " من المستهدف") + "</span>") + "</td>";
  h += '<td class="m-td-v">' + (!perf ? mNil("لم يُقرأ الأداء", "unset")
    : (perf.openLines
        ? (perf.openValue ? pxMoney(perf.openValue) : mNil("لم تُسعَّر", "owed")) +
          '<span class="m-meta">' + pxNLineN(perf.openLines) +
          (perf.unpricedOpenLines ? " · " + pxNLineN(perf.unpricedOpenLines) + " بلا تسعير" : "") + "</span>"
        : mNil("لا بنود مفتوحة", "none"))) + "</td>";
  return h + "</tr>";
}
function vProductsCrm() {
  pcLoad(false); pcPerfLoad(pcPerfYear, false);
  if (typeof cfLoad === "function") cfLoad(false);   /* the division filter needs «إعدادات النظام» */
  if (typeof opLoad === "function") opLoad(false);
  pxBind();
  if (pcCat === null && !pcFailed) {
    return '<div class="ds6"><section class="m-card" aria-busy="true">' +
      '<p class="m-stat__k">المحقق ' + pxYear(pcPerfYear) + "</p>" + moSkeleton(5, ["w80", "w60", "w40"]) +
      "</section></div>" + pxSheetHtml();
  }
  var h = '<div class="ds6">';
  if (pcCat) h += pxSummary();
  if (pcFailed && !pcCat) {
    return h + '<div class="m-card m-empty" role="alert"><p class="m-empty__t">تعذّر تحميل المنتجات.</p>' +
      '<p class="m-empty__d">لم يُعرض شيء لأن الطلب فشل، لا لأن الكتالوج فارغ.</p>' +
      '<p class="m-empty__a"><button type="button" class="m-btn" data-px="retry">أعد المحاولة</button></p></div></div>';
  }
  if (pcFailed) {
    h += '<div class="m-alert" role="alert"><span class="m-alert__d">تعذّر تحديث المنتجات — المعروض آخر نسخة محمّلة.</span>' +
      '<button type="button" class="m-btn" data-px="retry">أعد المحاولة</button></div>';
  }
  h += pxToolbar();
  h += pxActionRows();
  var rows = pxRows();
  var base = pxBaseRows();
  h += '<section class="m-card m-card--pad0" aria-label="الكتالوج"><div class="m-tablewrap">' +
    '<table class="m-table"><thead><tr><th>المنتج</th><th>جاهزية المساعد</th><th>السعر المنشور</th>' +
    '<th class="num">المستهدف ' + pxYear(pcPerfYear) + '</th><th class="num">المحقق</th><th class="num">المفتوح الآن</th></tr></thead><tbody>';
  if (!rows.length) {
    h += '<tr class="m-table__empty"><td colspan="6"><div class="m-empty">' + ((pcCat || []).length
      ? '<p class="m-empty__t">' + (pxArchived && !pxFiltered() ? "لا منتجات مؤرشفة." : "لا منتج يطابق التصفية.") + "</p>" +
        (pxFiltered() ? '<p class="m-empty__a"><button type="button" class="m-btn" data-px="clear">مسح التصفية</button></p>' : "")
      : '<p class="m-empty__t">لم تُضف منتجات بعد.</p>' +
        '<p class="m-empty__d">أضف منتجًا ثم ارفع ملف معرفته ليبيعه المساعد.</p>' +
        '<p class="m-empty__a"><button type="button" class="m-btn m-btn--primary" data-px="create">إضافة منتج</button></p>') +
      "</div></td></tr>";
  }
  rows.forEach(function (p) { h += pxListRow(p); });
  h += "</tbody></table></div>";
  if (rows.length) {
    var perf = pcPerf[pcPerfYear] || {};
    var ach = rows.reduce(function (n, p) { return n + (Number((perf[p.product] || {}).achieved) || 0); }, 0);
    /* Both halves of «N of M» are bound: the shown count to the filtered array and the catalogue
       count to the unfiltered one, so the footer cannot disagree with the chips above it. */
    h += '<div class="m-tools"><p class="m-meta">المعروض ' + dsFig("pxShown", rows.length) +
      " من " + pxNProdFig("pxAll", base.length) + "</p>" +
      '<p class="m-meta">المحقق للمعروض <b>' + pxMoney(ach) + "</b>" +
      (pcSkill && !(pcCat || []).some(function (p) { return !p.archived && !p.asset; })
        ? ' · <a class="m-link" href="/assets/' + esc(pcSkill.publicId) + '" download data-pxskill="footer">مهارة إعداد العرض &#8595;</a>' : "") + "</p></div>";
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
  var fld = function (id, label, key, value, extra, ph, err) {
    var rest = (extra && extra.req ? ' aria-required="true"' : "") +
      (err ? ' aria-invalid="true" aria-describedby="' + id + '_e"' : "") +
      (ph ? ' placeholder="' + esc(ph) + '"' : "");
    return '<div class="m-field"><label class="m-label' + (extra && extra.req ? " m-req" : "") + '" for="' + id + '">' + label + "</label>" +
      (extra && extra.num
        ? mNum({ id: id, value: value, label: label, min: extra.min, max: extra.hi, step: extra.step || 1, mode: "numeric",
            attrs: ' data-pxsheet="' + key + '"' + rest })
        : '<input class="m-input" id="' + id + '" data-pxsheet="' + key + '" value="' + esc(value) + '"' +
          (extra && extra.max ? ' maxlength="' + extra.max + '"' : "") + rest + ">") +
      (err ? '<span class="m-err" id="' + id + '_e" role="alert">' + esc(err) + "</span>" : "") + "</div>";
  };
  var h = '<div class="ds6"><div class="px-scrim' + cls + '" data-px="sheetclose"></div>';
  h += '<div class="px-dr' + cls + '" role="dialog" aria-modal="true" aria-labelledby="pxdrt">';
  h += '<div class="m-dlg__h"><div><h2 class="m-dlg__t" id="pxdrt" tabindex="-1">إضافة منتج</h2>' +
    '<p class="m-meta">يولد المنتج غير جاهز للمساعد، وسجلّه يوضح ما يلزم</p></div>' +
    '<button type="button" class="m-x" data-px="sheetclose" aria-label="إغلاق">' + pxIco("x") + "</button></div>";
  h += '<div class="m-dlg__b">';
  h += '<section><h3 class="m-label">المنتج</h3><div class="m-form">' +
    '<div class="full">' + fld("pxs_name", "اسم المنتج", "name", d.name, { max: 60, req: true }, "مثال: سجل التطعيمات الوطني", nameErr) + "</div>" +
    '<div class="m-field"><label class="m-label" for="pxs_sector">القطاع</label>' +
    '<select class="m-select" id="pxs_sector" data-pxsheet="sectorId"><option value="">بلا قطاع</option>' +
    pcSectorList.map(function (s) { return '<option value="' + s.id + '"' + (String(d.sectorId) === String(s.id) ? " selected" : "") + ">" + esc(s.name) + "</option>"; }).join("") +
    "</select></div>" +
    '<div class="m-field"><label class="m-label" for="pxs_owner">المسؤول</label>' +
      mCombo({ id: "pxs_owner", value: d.owner, options: pxOwnerList(), placeholder: "بلا مسؤول",
        label: "المسؤول", free: true, wide: true,
        empty: "لا أسماء بعد — اكتب اسمًا، أو أضِف الفريق من «إعدادات النظام»",
        attrs: ' data-pxsheet="owner"' }) + "</div>" +
    '<div class="full">' + fld("pxs_note", "ملاحظة التسعير", "pricingNote", d.pricingNote, { max: 120 }, "مثال: اشتراك سنوي يحدده المختص وفق الحجم", "") + "</div>" +
    "</div></section>";
  h += '<section><h3 class="m-label">الباقة الأولى (اختياري)</h3><div class="m-form">' +
    fld("pxs_pn", "اسم الباقة", "pkgName", d.pkgName, { max: 60 }, "الباقة القياسية", "") +
    fld("pxs_ps", "النطاق", "pkgScope", d.pkgScope, { max: 120 }, "فرع واحد", "") +
    fld("pxs_pp", "السعر السنوي (ر.س)", "pkgPrice", d.pkgPrice, { num: true, min: 0, step: 100 }, "", "") +
    fld("pxs_py", "المدة (سنوات)", "pkgYears", d.pkgYears, { num: true, min: 1, hi: 10 }, "", "") +
    "</div></section>";
  h += "</div>";
  h += '<div class="m-dlg__f">' + (pxSheetErr ? '<span class="m-err" role="alert">' + esc(pxSheetErr) + "</span>" : "") +
    '<button type="button" class="m-btn m-btn--primary" id="pxs_submit" data-px="sheetsubmit"' + (pxSheetBusy ? ' disabled aria-busy="true"' : "") + ">" + (pxSheetBusy ? "جارٍ الإنشاء…" : "إنشاء المنتج") + "</button>" +
    '<button type="button" class="m-btn" data-px="sheetclose">إلغاء</button></div></div></div>';
  setTimeout(function () {
    if (!pxDrShown) {
      pxDrShown = true;
      requestAnimationFrame(function () {
        var s = document.querySelector(".px-scrim"), dr = document.querySelector(".px-dr");
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
  if (!st) return '<span class="m-meta"' + ida + ' aria-live="polite"></span>';
  if (st.s === "pending") return '<span class="m-meta"' + ida + ' aria-live="polite">جارٍ الحفظ…</span>';
  if (st.s === "saved") return '<span class="m-chip m-chip--ok"' + ida + ' aria-live="polite">حُفظ</span>';
  if (st.s === "invalid") return '<span class="m-err"' + ida + ' aria-live="assertive">' + esc(st.m) + "</span>";
  return '<span class="px-acts"' + ida + ' aria-live="assertive"><span class="m-err">تعذّر الحفظ</span>' +
    '<button type="button" class="m-btn m-btn--quiet" data-px="fretry" data-k="' + esc(key) + '">أعد المحاولة</button>' +
    '<button type="button" class="m-btn m-btn--quiet" data-px="fdiscard" data-k="' + esc(key) + '">تجاهل</button></span>';
}
function pxEmbedded(name) { return (typeof PRODUCTS_FULL !== "undefined" ? PRODUCTS_FULL : []).filter(function (x) { return x.n === name; })[0] || null; }
function pxSection(key, title, src, body, extra) {
  return '<section class="m-card" id="pxsec_' + key + '" aria-labelledby="pxsech_' + key + '">' +
    '<div class="m-card__h"><div><h2 class="m-card__t" id="pxsech_' + key + '">' + title + "</h2>" +
    (src ? '<p class="m-meta">' + src + "</p>" : "") + "</div>" + (extra || "") + "</div>" +
    '<div class="px-secb">' + body + "</div></section>";
}
/* A quarter row: the bar is the quarter's achieved against ITS OWN target, and a quarter with no
   target gets the hatched track (.px-nott) rather than a zero-width fill. A zero bar is a claim
   that nothing was achieved against something; no target means the question was never asked. */
function pxQuarterRow(q) {
  var has = q.target !== null && q.target !== undefined && Number(q.target) > 0;
  var pct = has ? Math.min(100, Math.round((Number(q.achieved) || 0) / Number(q.target) * 100)) : 0;
  return '<div class="m-seg-row px-qrow"><span class="m-seg-row__t">الربع ' + mN(q.quarter) + "</span>" +
    '<span class="m-seg-row__b' + (has ? "" : " px-nott") + '"><i style="--m-pct:' + pct + '%"></i></span>' +
    '<span class="m-seg-row__v">' + (has ? pxMoney(q.achieved) : mNil("بلا مستهدف", "owed")) + "</span></div>";
}
function pxPerfSection(p) {
  var name = p.product, perf = (pcPerf[pcPerfYear] || {})[name];
  if (!perf) {
    return pxSection("performance", "الأداء", "من سجل الفرص", pcPerfFailed[pcPerfYear]
      ? '<div class="m-alert" role="alert"><span class="m-alert__d">تعذّر تحميل الأداء.</span>' +
        '<button type="button" class="m-btn" data-px="perfretry">أعد المحاولة</button></div>'
      : moSkeleton(3, ["w60", "w80", "w40"]));
  }
  var cov = targetCoveragePct(perf.achieved, perf.annualTarget);
  /* annualTarget is number|null and null means NO TARGET RECORDED, not a target of zero. The
     sub-line says which, and no percentage is drawn over a denominator that does not exist. */
  var b = '<div><p class="m-stat__k">المحقق ' + pxYear(pcPerfYear) + '</p><p class="m-stat__v">' + pxMoney(perf.achieved) + "</p>" +
    '<p class="m-stat__s">' + (perf.annualTarget === null || perf.annualTarget === undefined
      ? mNil("بلا مستهدف سنوي", "owed")
      : "من مستهدف " + pxMoney(perf.annualTarget) + (cov === null ? "" : " · " + mPct(cov)) +
        (perf.targetQuarters < 4 ? " · مُدخل في " + pxNQtrN(perf.targetQuarters) + " من أربعة" : "")) + "</p></div>";
  b += '<div class="m-segs">' + (perf.quarters || []).map(pxQuarterRow).join("") + "</div>";
  b += '<div class="m-stats"><div><p class="m-stat__k">المفتوح الآن</p>' +
    '<p class="m-stat__v">' + (perf.openValue ? pxMoney(perf.openValue) : mNil("لم تُسعَّر", "owed")) + "</p>" +
    '<p class="m-stat__s">' + pxNLineN(perf.openLines) + (perf.unpricedOpenLines ? " · " + pxNLineN(perf.unpricedOpenLines) + " بلا تسعير" : "") + "</p></div>" +
    '<div><p class="m-stat__k">مربوحة ' + pxYear(pcPerfYear) + '</p><p class="m-stat__v">' +
      (perf.wonLines ? pxNLineN(perf.wonLines) : mNil("لا بنود", "none")) + "</p></div>" +
    '<div><p class="m-stat__k">خاسرة ' + pxYear(pcPerfYear) + '</p><p class="m-stat__v">' +
      (perf.lostLines ? pxNLineN(perf.lostLines) : mNil("لا بنود", "none")) + "</p></div></div>";
  var open = pxOpenLines(name).slice().sort(function (a, b2) { return opValue(b2) - opValue(a); }).slice(0, 3);
  if (open.length) {
    b += '<div><p class="m-stat__k">أعلى الفرص المفتوحة</p>' + open.map(function (o) {
      return '<a class="m-item" href="#opps/' + fmtId(o.id) + '"><span class="m-item__b">' +
        '<span class="m-item__n">' + esc(o.account_name) + "</span>" +
        '<span class="m-item__s">' + esc(opStage(o.stage).label) + "</span></span>" +
        '<span class="m-item__v">' + (opPriced(o) ? pxMoney(opValue(o)) : mNil("لم تُسعَّر", "owed")) + "</span></a>";
    }).join("") + "</div>" +
      '<div class="px-acts"><button type="button" class="m-btn m-btn--quiet" data-px="goopps" data-nm="' + esc(name) + '">كل فرص المنتج &#8592;</button></div>';
  }
  b += '<p class="m-meta">القيمة الإجمالية للعقد — أساس المستهدف لم يُقَرّ بعد.</p>';
  return pxSection("performance", "الأداء", "من سجل الفرص", b);
}
function pxPricingSection(p) {
  var name = p.product, b = "";
  var ed = pxPkgEdit && pxPkgEdit.product === name ? pxPkgEdit : null;
  var editor = function () {
    var d = ed.d;
    return '<div class="px-secb"><div class="m-form">' +
      '<div class="m-field"><label class="m-label m-req" for="pxpk_n">اسم الباقة</label><input class="m-input" id="pxpk_n" maxlength="60" value="' + esc(d.name) + '" data-pxpkg="name"></div>' +
      '<div class="m-field"><label class="m-label" for="pxpk_s">النطاق</label><input class="m-input" id="pxpk_s" maxlength="120" value="' + esc(d.scope) + '" data-pxpkg="scope"></div>' +
      '<div class="m-field"><label class="m-label" for="pxpk_y">المدة (سنوات)</label>' + mNum({ id: "pxpk_y", value: d.years, label: "المدة", min: 1, max: 10, step: 1, mode: "numeric", attrs: ' data-pxpkg="years"' }) +
      '<span class="m-hint">' + mNumRange(1, 10) + "</span></div>" +
      '<div class="m-field"><label class="m-label" for="pxpk_p">السعر السنوي (ر.س)</label>' + mNum({ id: "pxpk_p", value: d.listPrice, label: "السعر السنوي", min: 0, step: 100, attrs: ' data-pxpkg="listPrice"' }) + "</div></div>" +
      (ed.err ? '<span class="m-err" role="alert">' + esc(ed.err) + "</span>" : "") +
      '<div class="px-acts"><button type="button" class="m-btn m-btn--primary" data-px="pkgsave"' + (ed.busy ? " disabled" : "") + ">" + (ed.busy ? "جارٍ الحفظ…" : "حفظ الباقة") + "</button>" +
      '<button type="button" class="m-btn" data-px="pkgcancel">إلغاء</button>' +
      '<span class="m-meta">تعديل السعر لا يغيّر قيم الفرص المسجّلة.</span></div></div>';
  };
  b += '<div class="m-tablewrap"><table class="m-table"><thead><tr><th>الباقة</th><th>النطاق</th>' +
    '<th class="num">المدة</th><th class="num">السعر السنوي</th><th><span class="px-sr">إجراءات</span></th></tr></thead><tbody>';
  if (!(p.packages || []).length && !(ed && ed.id === 0)) {
    b += '<tr class="m-table__empty"><td colspan="5"><div class="m-empty"><p class="m-empty__t">لا باقات منشورة.</p></div></td></tr>';
  }
  (p.packages || []).forEach(function (k) {
    b += '<tr><td class="m-td-n">' + esc(k.name) + "</td>" +
      /* A scope nobody wrote is a classification nobody made, not a legitimate nothing. */
      "<td>" + (k.scope ? esc(k.scope) : mNil("لم يُحدَّد", "unset")) + "</td>" +
      '<td class="m-td-v">' + mN(k.years) + " سنة</td>" +
      '<td class="m-td-v">' + pxMoney(k.listPrice) + "</td>" +
      '<td><span class="px-acts px-acts--end"><button type="button" class="m-btn m-btn--quiet" data-px="pkgedit" data-id="' + k.id + '">تعديل</button>' +
      '<button type="button" class="m-btn m-btn--quiet" data-px="pkgretire" data-id="' + k.id + '">تقاعد</button></span></td></tr>';
  });
  b += "</tbody></table></div>";
  if (ed) b += editor();
  b += '<div class="px-acts">' + (ed ? "" : '<button type="button" class="m-btn" data-px="pkgadd">إضافة باقة</button>') +
    (p.retiredPackageCount ? '<button type="button" class="m-btn m-btn--quiet" data-px="retiredtoggle" aria-expanded="' + !!pxShowRetired[name] + '">' +
      (pxShowRetired[name] ? "إخفاء المتقاعدة" : "عرض المتقاعدة " + mN(p.retiredPackageCount)) + "</button>" : "") + "</div>";
  if (pxShowRetired[name]) {
    var ret = pxRetired[name];
    b += '<div class="m-tablewrap"><table class="m-table"><tbody>' + (!ret ? '<tr><td class="m-meta">جارٍ التحميل…</td></tr>' : ret.filter(function (k) { return k.retiredAt || k.retired_at; }).map(function (k) {
      return '<tr><td class="m-td-n">' + esc(k.name) + "</td><td>" + (k.scope ? esc(k.scope) : mNil("لم يُحدَّد", "unset")) +
        '</td><td class="m-td-v">' + mN(k.years) + ' سنة</td><td class="m-td-v">' + pxMoney(k.listPrice) +
        '</td><td><span class="px-acts px-acts--end"><span class="m-chip">متقاعدة</span>' +
        '<button type="button" class="m-btn m-btn--quiet" data-px="pkgrestore" data-id="' + k.id + '">إعادة التفعيل</button></span></td></tr>';
    }).join("")) + "</tbody></table></div>";
  }
  var nk = name + "|pricingNote";
  b += '<div class="m-field"><span class="px-acts"><label class="m-label" for="pxf_note">ملاحظة التسعير</label>' + pxStatusSlot(nk, "pxf_note") + "</span>" +
    '<input class="m-input" id="pxf_note" aria-describedby="pxf_note_st" maxlength="120" value="' +
    esc(pxFState[nk] && pxFState[nk].s !== "saved" ? pxFState[nk].v : (p.pricingNote || "")) + '" data-pxfield="pricingNote" placeholder="لا ملاحظة تسعير">' +
    '<span class="m-hint">تُعرض حين لا توجد باقة منشورة.</span></div>';
  // The founder's rule, stated on the screen that would break it: a price is a committee decision,
  // so the section says so BEFORE the «إضافة باقة» control, not in a tooltip afterwards.
  return pxSection("pricing", "الأسعار والباقات", "لا بُدّ أن يتم الموافقة عليها مسبقًا من اللجنة قبل إضافة السعر", b);
}
function pxTargetsSection(p) {
  var name = p.product, perf = (pcPerf[pcPerfYear] || {})[name];
  var yrs = [new Date().getFullYear(), new Date().getFullYear() + 1];
  var extra = '<div class="m-seg" role="group" aria-label="السنة">' + yrs.map(function (y) {
    return '<button type="button" aria-pressed="' + (pcPerfYear === y) + '" data-px="year" data-y="' + y + '">' + String(y) + "</button>";
  }).join("") + "</div>";
  if (!perf) return pxSection("targets", "المستهدفات", "", pcPerfFailed[pcPerfYear]
    ? '<div class="m-alert" role="alert"><span class="m-alert__d">تعذّر تحميل المستهدفات.</span>' +
      '<button type="button" class="m-btn" data-px="perfretry">أعد المحاولة</button></div>'
    : moSkeleton(4, ["w80"]), extra);
  var b = "";
  (perf.quarters || []).forEach(function (q) {
    var key = name + "|t|" + pcPerfYear + "|" + q.quarter, st = pxFState[key];
    var saved = q.target === null || q.target === undefined ? "" : String(q.target);
    var val = st && st.s !== "saved" ? st.v : saved;
    var has = saved !== "" && Number(saved) > 0;
    var cov = targetCoveragePct(q.achieved, q.target);
    b += '<div class="m-field"><span class="px-acts">' +
      '<label class="m-label" for="pxq_' + q.quarter + '">مستهدف الربع ' + mN(q.quarter) + "</label>" +
      pxStatusSlot(key, "pxq_" + q.quarter) + "</span>" +
      /* Steps of 1,000: a quarterly target is set in thousands of riyals. Empty stays «بلا مستهدف». */
      mNum({ id: "pxq_" + q.quarter, value: val, label: "مستهدف الربع", min: 0, step: 1000, mode: "numeric",
        attrs: ' placeholder="بلا مستهدف" data-pxtarget="' + q.quarter + '" aria-describedby="pxq_' + q.quarter + '_st"' + (st && st.s === "invalid" ? ' aria-invalid="true"' : "") }) +
      '<div class="m-seg-row px-qrow"><span class="m-seg-row__t">المحقق ' + pxMoney(q.achieved) + "</span>" +
      '<span class="m-seg-row__b' + (has ? "" : " px-nott") + '"><i style="--m-pct:' + (has ? Math.min(100, cov || 0) : 0) + '%"></i></span>' +
      /* No target is not a coverage of zero: there is no denominator for the percentage to be a
         percentage OF, so the cell says what is missing instead of printing a number. */
      '<span class="m-seg-row__v">' + (cov === null ? mNil("بلا مستهدف", "owed") : mPct(cov)) + "</span></div>";
    if (pxQConfirm[key]) {
      b += '<div class="m-alert" role="alert"><span class="m-alert__d">إزالة مستهدف الربع ' + mN(q.quarter) + "؟</span>" +
        '<button type="button" class="m-btn" data-px="tclear" data-q="' + q.quarter + '">إزالة</button>' +
        '<button type="button" class="m-btn" data-px="tundo" data-q="' + q.quarter + '">تراجع</button></div>';
    }
    b += "</div>";
  });
  b += '<p class="m-meta">' + (perf.annualTarget === null || perf.annualTarget === undefined
    ? "لا مستهدفات مدخلة لهذه السنة."
    : "مجموع المستهدفات المدخلة " + pxMoney(perf.annualTarget) +
      (perf.targetQuarters < 4 ? " · " + pxNQtrN(4 - perf.targetQuarters) + " بلا مستهدف" : "")) +
    " · القيم نفسها في «المستهدفات والأداء».</p>";
  return pxSection("targets", "المستهدفات", "", b, extra);
}
function pxKnowledgeSection(p) {
  var name = p.product, b = "", kn = pxKnow[name];
  var upA = pxUp[name + "|asset"], upK = pxUp[name + "|kb"];
  /* The score leads: on a tab named «معرفة المنتج» the first question is «كم نسبة الجاهزية، وأي قسم
     ناقص؟» — the two files are how you fix it, so they come after the answer, not before it. */
  if (typeof kbScoreBlock === "function") b += kbScoreBlock(p, kn);
  if (pxKnowFailed[name]) {
    b += '<div class="m-alert" role="alert"><span class="m-alert__d">تعذّر تحميل نص المعرفة.</span>' +
      '<button type="button" class="m-btn" data-px="knowretry">أعد المحاولة</button></div>';
  }
  /* intro PDF */
  b += '<div class="m-item"><span class="px-cells" aria-hidden="true"><i class="' + (p.asset ? "" : "miss") + '"></i></span>' +
    '<span class="m-item__b"><span class="m-item__n">الملف التعريفي (PDF)</span>' +
    '<span class="m-item__s">يُرسله المساعد للعميل عند طلب التفاصيل' +
    (p.asset ? " · <bdi>" + esc(p.asset.filename) + "</bdi>" +
      (p.asset.size ? " · " + mN(Math.max(1, Math.round(p.asset.size / 1024))) + " ك.ب" : "") +
      (p.asset.updatedAt ? " · " + fmtD(p.asset.updatedAt) : "") : " · " + mNil("لا ملف مرفق", "owed")) +
    (upA && upA.s === "busy" ? " · جارٍ الرفع…" : upA && upA.s === "failed" ? ' · <span class="m-err">' + esc(upA.m) + "</span>" : "") +
    "</span></span>" +
    '<span class="px-acts px-acts--end">' +
    (p.asset ? '<a class="m-btn" href="/assets/' + esc(p.asset.publicId) + '" target="_blank" rel="noopener">معاينة</a>'
      : (pcSkill ? '<a class="m-link" href="/assets/' + esc(pcSkill.publicId) + '" download data-pxskill="record">أنشئه بمهارة إعداد العرض &#8595;</a>'
        : '<span class="m-meta" data-pxskill="missing">مهارة إعداد العرض غير مرفوعة بعد</span>')) +
    '<button type="button" class="m-btn" data-px="pickasset"' + (p.archived ? " disabled" : "") + ">" + (p.asset ? "استبدال" : "رفع PDF") + "</button>" +
    '<input id="pxasset" type="file" accept="application/pdf,.pdf" aria-label="اختر ملفًا تعريفيًا (PDF)" hidden data-pxupload="asset"></span></div>';
  /* knowledge */
  var kst = (p.kb && p.kb.state) || "none";
  var sub = kst === "approved" ? "اعتُمدت" + (p.kb.approvedBy ? " · " + esc(p.kb.approvedBy) : "") + (p.kb.approvedAt ? " · " + fmtD(p.kb.approvedAt) : "") + (p.kb.source ? ' · <bdi>' + esc(p.kb.source) + "</bdi>" : "")
    : kst === "legacy" ? '<span class="m-chip m-chip--warn">بانتظار اعتماد النص الحالي — المساعد لا يستخدمه</span>' + (p.kb.source ? ' · <bdi>' + esc(p.kb.source) + "</bdi>" : "")
    : p.embedded ? "لا ملف — المساعد يبيع من المعرفة المدمجة فقط" : "لا ملف معرفة — المساعد لا يبيع هذا المنتج";
  b += '<div class="m-item"><span class="px-cells" aria-hidden="true"><i class="' + (kst === "approved" ? "" : kst === "legacy" || p.draft ? "pend" : "miss") + '"></i></span>' +
    '<span class="m-item__b"><span class="m-item__n">ملف المعرفة</span>' +
    '<span class="m-item__s">يقرأه المساعد ليجيب عن الأسعار والاعتراضات · ' + sub +
    (upK && upK.s === "busy" ? " · جارٍ استخلاص المعرفة… قد يستغرق دقيقة" : upK && upK.s === "failed" ? ' · <span class="m-err">' + esc(upK.m) + "</span>" : "") +
    "</span></span>" +
    '<span class="px-acts px-acts--end">' +
    /* knowledge.edit — the readiness meter above is a read; uploading, approving and discarding are
       writes, and a role without the permission must not be offered them beside a hidden editor. */
    (pxMayEditKb()
      ? '<button type="button" class="m-btn" data-px="pickkb"' + (p.archived || (upK && upK.s === "busy") ? " disabled" : "") + ">" + (kst === "none" ? "رفع ملف المعرفة" : "استبدال") + "</button>" +
        '<input id="pxkb" type="file" aria-label="اختر ملف معرفة" accept=".pdf,.docx,.pptx,.xlsx,.md,.txt" hidden data-pxupload="kb">'
      : "") + "</span></div>";
  var ap = pxAppr[name] || {};
  if (kn && kn.draftMd) {
    b += '<section class="m-card"><div class="m-card__h"><div>' +
      '<h3 class="m-card__t">مسودة بانتظار الاعتماد — المساعد لا يقرؤها بعد</h3>' +
      '<p class="m-meta"><bdi>' + esc(kn.draftSource || "") + "</bdi>" + (kn.draftBy ? " · رُفعت · " + esc(kn.draftBy) : "") + (kn.draftAt ? " · " + fmtD(kn.draftAt) : "") +
      (kn.changeSummary ? " · أُضيف " + pxNRowN(kn.changeSummary.added) + " · حُذف " + pxNRowN(kn.changeSummary.removed) + " مقارنة بالمعتمد" : "") + "</p></div></div>" +
      (typeof kbDraftLine === "function" ? kbDraftLine(kn) : "") +
      '<div class="px-md">' + mdRender(kn.draftMd) + "</div>" +
      (ap.err ? '<span class="m-err" role="alert">' + esc(ap.err) + "</span>" : "") +
      (pxMayEditKb()
        ? '<div class="px-acts"><button type="button" class="m-btn m-btn--primary" data-px="approve"' + (ap.busy ? " disabled" : "") + ">" + (ap.busy ? "جارٍ الاعتماد…" : "اعتماد المعرفة") + "</button>" +
          '<button class="rv-hold" data-do="pxDiscard" data-arg="' + esc(name) + '" data-idle="تجاهل المسودة" data-holding="استمر بالضغط للتجاهل…" data-armed="اضغط مرة أخرى للتجاهل" aria-pressed="false" title="اضغط مع الاستمرار"><span class="rv-fill"></span><span class="rv-lbl">تجاهل المسودة</span></button></div>'
        : "") + "</section>";
  }
  if (kn && kn.state === "legacy" && kn.md) {
    b += '<section class="m-card"><div class="m-card__h"><div>' +
      '<h3 class="m-card__t">نص مستخدم قبل تسجيل الاعتماد</h3>' +
      '<p class="m-meta">راجعه ثم اعتمده ليعود إليه المساعد.</p></div></div>' +
      '<div class="px-md">' + mdRender(kn.md) + "</div>" + (ap.err ? '<span class="m-err" role="alert">' + esc(ap.err) + "</span>" : "") +
      (pxMayEditKb() ? '<div class="px-acts"><button type="button" class="m-btn' + (kn.draftMd ? "" : " m-btn--primary") + '" data-px="approvecurrent"' + (ap.busy ? " disabled" : "") + ">" + (ap.busy ? "جارٍ الاعتماد…" : "اعتماد النص الحالي") + "</button></div>" : "") + "</section>";
  } else if (kn && kn.state === "approved" && kn.md) {
    b += '<details class="m-evidence"><summary>النص المعتمد' +
      '<span class="m-meta">يُحدَّث برفع ملف جديد أو من «تحرير الأقسام»، ثم اعتماده</span></summary>' +
      '<div class="px-md">' + mdRender(kn.md) + "</div></details>";
  } else if (!kn && !pxKnowFailed[name] && kst !== "none") {
    b += moSkeleton(2, ["w80", "w60"]);
  }
  var emb = pxEmbedded(name);
  if (p.embedded && emb) {
    b += '<details class="m-evidence"><summary>المعرفة المدمجة' +
      '<span class="m-meta">معتمدة بمراجعة الشيفرة — للقراءة فقط</span></summary>' +
      [["العرض", emb.pitch], ["الكفاءة", (emb.eff || []).join(" · ")], ["ملائم لـ", (emb.best || []).join("، ")], ["التسعير المعتمد", emb.pricing]].map(function (x) {
        return '<div class="m-evidence__row"><p class="m-meta">' + esc(x[0]) + "</p><p>" + esc(x[1]) + "</p></div>";
      }).join("") + "</details>";
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
/* Everyone who already manages a product, plus the team directory when «إعدادات النظام» has been
   read — a new manager should be offerable before they own anything. */
function pxOwnerList() {
  var out = [];
  var add = function (o) { if (o && out.indexOf(o) < 0) out.push(o); };
  (pcCat || []).forEach(function (x) { add(x.owner); });
  if (typeof cfTeam !== "undefined" && cfTeam) cfTeam.forEach(function (m) { add(m.name); });
  return out.sort(function (a, b) { return String(a).localeCompare(String(b), "ar"); });
}
/* THE READINESS BAND, in the record rather than in the tab strip (founder, 2026-09-18: «redesign
   and alignment maybe not good as ux»). It used to be one nowrap line inside the subnav bar: the
   verdict, a percentage, an action and four labelled facts, all at 13px with 1px rules between them
   and no room to breathe. Same facts, read as a band now — the verdict leading, then one cell per
   thing that is missing or done, wrapping on its own grid and sharing the record's 24px spine. */
function pxReadinessBandHtml(p) {
  var rd = pxReadiness(p), st = pxReadinessState(p);
  var h = '<div class="px-rdy-band" role="status" aria-label="جاهزية المساعد">';
  h += '<div class="px-rdy-band__v ' + pxWordCls(rd) + '">' +
    '<span class="px-rdy-band__k">جاهزية المساعد</span>' +
    '<span class="px-rdy-band__w">' + esc(rd.word) + "</span>" +
    '<span class="px-rdy-band__m">' + pxCellsHtml(rd) + "</span></div>";
  h += rd.cells.map(function (c) {
    var can = PX_RD_GOTO[c.key] && c.state !== "done";
    return '<div class="px-rdy-band__i' + (c.state === "done" ? " is-done" : c.state === "pending" ? " is-pend" : " is-miss") + '">' +
      '<span class="px-rdy-band__k"><i aria-hidden="true"></i>' + PX_RD_LABELS[c.key] + "</span>" +
      '<span class="px-rdy-band__t">' + esc(st[c.key]) + "</span>" +
      (can ? '<button type="button" class="m-btn m-btn--quiet" data-px="jump" data-s="' + PX_RD_GOTO[c.key] + '">' +
        (c.key === "price" ? "أضف سعرًا" : "أكمله") + "</button>" : "") + "</div>";
  }).join("");
  return h + "</div>";
}
/* Kept as the seam the shell still calls; the record draws the band itself now. */
function pxReadinessBand() { return ""; }
function pxSide(p, rd) {
  var name = p.product;
  // Readiness lives in the band above the record now (pxReadinessBand): the same four rows twice on
  // one screen is not two answers, it is one answer said twice.
  void rd;
  var h = "";
  var open = pxOpenLines(name), openVal = open.reduce(function (n, o) { return n + (opPriced(o) ? opValue(o) : 0); }, 0);
  /* A related-population row is a CONTROL, not a link: it resets the destination's filters and
     sets the exact product, so the page it opens counts what this row counted. */
  var link = function (act, label, count, extra) {
    return '<button type="button" class="m-item" data-px="' + act + '" data-nm="' + esc(name) + '">' +
      '<span class="m-item__b"><span class="m-item__n">' + label + "</span>" +
      (extra ? '<span class="m-item__s">' + extra + "</span>" : "") + "</span>" +
      '<span class="m-item__v">' + mN(count) + "</span></button>";
  };
  h += '<section class="m-card m-card--pad0" aria-labelledby="pxrel_h">' +
    '<div class="m-tools"><h2 class="m-card__k" id="pxrel_h">المرتبط بهذا المنتج</h2></div>' +
    '<div class="px-secb px-um">' +
    link("goopen", "الفرص المفتوحة", open.length, openVal ? pxMoney(openVal) : "") +
    link("gocamps", "الحملات", pxCampaigns(name).length, "") +
    link("gointerest", "اهتمام رصده المساعد", pxInterest(name), "قراءة المساعد") +
    link("gotargets", "الجهات المستهدفة بالوسم", pxTargeted(name), "") + "</div></section>";
  return h;
}
function pxRenameModal() {
  if (!pxModal) return "";
  var m = pxModal;
  var im = m.impact;
  var h = '<div class="ds6"><div class="px-scrim in" data-px="modalclose"></div>' +
    '<div class="px-modal" role="dialog" aria-modal="true" aria-labelledby="pxmt"><div class="box m-dlg__p">';
  h += '<div class="m-dlg__h"><h2 class="m-dlg__t" id="pxmt" tabindex="-1">إعادة تسمية «' + esc(m.product) + "»</h2></div>";
  h += '<div class="m-dlg__b"><div class="m-field"><label class="m-label" for="pxm_to">الاسم الجديد</label>' +
    '<input class="m-input" id="pxm_to" maxlength="60" value="' + esc(m.to) + '" data-pxmodal="to"' + (m.err ? ' aria-invalid="true" aria-describedby="pxm_err"' : "") + "></div>";
  h += '<p class="m-meta">' + (!im ? "جارٍ حساب ما سيتغيّر…" : "سيُغيَّر الاسم في: " + [
    im.openLines ? pxNLineN(im.openLines) + " مفتوحة" : "", im.campaigns ? pxNCampN(im.campaigns) : "", im.kb ? "ملف المعرفة" : "", im.asset ? "الملف التعريفي" : "",
    im.packages ? pxNPkgN(im.packages) : "", im.targetedEntities ? pxNEntN(im.targetedEntities) + " مستهدفة" : "", im.interestReadings ? pxNReadN(im.interestReadings) + " للمساعد" : ""
  ].filter(Boolean).join(" · ") + ".") + "</p>";
  if (m.err) h += '<span class="m-err" id="pxm_err" role="alert">' + esc(m.err) + "</span>";
  h += "</div>";
  h += '<div class="m-dlg__f"><button type="button" class="m-btn m-btn--primary" data-px="renamesave"' + (m.busy || !im ? " disabled" : "") + ">" + (m.busy ? "جارٍ الحفظ…" : "حفظ الاسم") + "</button>" +
    '<button type="button" class="m-btn" data-px="modalclose">إلغاء</button></div>';
  return h + "</div></div></div>";
}

/* Every live product, current one held. Archived ones are left out: this rail is for moving between
   the products someone is actually working. */
function pxSwitcher(p) {
  var live = (pcCat || []).filter(function (x) { return !x.archived; });
  if (live.length < 2) return "";
  return '<div class="px-sw" role="group" aria-label="التنقل بين المنتجات">' + live.map(function (x) {
    var on = x.product === p.product;
    return '<a class="m-btn" href="#product/' + pxEnc(x.product) + '"' + (on ? ' aria-current="page"' : "") + ">" + esc(x.product) + "</a>";
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
  /* annualTarget is number|null. null means NO TARGET RECORDED, which is not a target of zero, so
     the tile prints what is owed rather than «0 ر.س» — and the attainment tile beside it prints no
     percentage at all, because there is no denominator for it to be a percentage OF. */
  var hasTarget = !!q && q.annualTarget !== null && q.annualTarget !== undefined;
  var tile = function (cls, label, value, sub, meter) {
    return '<div class="px-ind__i' + (cls ? " " + cls : "") + '"><span class="px-ind__k">' + label + "</span>" +
      '<span class="px-ind__v">' + value + "</span>" +
      (sub ? '<span class="px-ind__s">' + sub + "</span>" : "") + (meter || "") + "</div>";
  };
  var meter = function (v) {
    return '<span class="m-meter" style="--m-pct:' + Math.max(0, Math.min(100, v)) + '%"><i></i></span>';
  };
  return '<div class="px-ind">' +
    tile("", "المستهدف السنوي", hasTarget ? pxMoney(target) : mNil("بلا مستهدف مسجّل", "owed"),
      hasTarget ? pxYear((typeof pcQuarters !== "undefined" && pcQuarters && pcQuarters.year) || new Date().getFullYear())
        : "يُحدَّد من «المستهدفات»", "") +
    tile("", "المحقق", pxMoney(achieved), "من الصفقات الرابحة", "") +
    tile(pct === null ? "" : pct >= 100 ? "px-ind__i--ac" : "", "نسبة الإنجاز",
      pct === null ? mNil("بلا مستهدف", "owed") : mPct(pct),
      pct === null ? "لا نسبة بلا مستهدف" : "من المستهدف", pct === null ? "" : meter(pct)) +
    tile("", "الفرص المفتوحة", mN(open.length),
      open.length ? pxMoney(openValue) : mNil("لا بنود مفتوحة", "none"), "") +
    tile("", "جاهزية المساعد",
      score === null ? mNil("لم تُقَس", "unset") : mPct(score),
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
    { k: "knowledge", l: "معرفة المنتج", n: score === null ? "" : mPct(score), warn: !!(ks && !ks.ready) },
    { k: "pricing", l: "الأسعار والباقات", n: pkgs ? mN(pkgs) : "", warn: !pkgs && !(p.pricingNote || "") },
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
/* The rail is .m-tabs / .m-tab with aria-selected, and the vocabulary draws the selected tab with
   its own border. The hand-rolled gliding indicator that used to live here is GONE with it: one
   implementation beats two that slide differently, and a strip that has to be measured after paint
   is a strip that renders wrong on the frame before the measurement. dashboard.ts still calls
   pxPlaceTabs behind a typeof guard, so its removal is a no-op there. */
function pxTabStrip(p) {
  var on = pxCurTab(p);
  return '<div class="m-tabs px-tabs" role="tablist" aria-label="أقسام المنتج">' + pxTabsFor(p).map(function (t) {
    return '<button type="button" class="m-tab" role="tab" data-pxtab="' + t.k + '" id="pxtab_' + t.k + '"' +
      ' aria-selected="' + (t.k === on) + '" aria-controls="pxpane_' + t.k + '" tabindex="' + (t.k === on ? "0" : "-1") + '" data-px="tab" data-t="' + t.k + '">' + t.l +
      (t.n ? '<span class="m-chip m-chip--plain">' + t.n + "</span>" : "") +
      (t.warn ? '<span class="px-tab-dot" aria-hidden="true"></span><span class="px-sr">يحتاج إكمالًا</span>' : "") + "</button>";
  }).join("") + "</div>";
}

/* «البيانات والإدارة»: the three editors the header used to wear, plus rename and archive.
   knowledge.edit owns every product write (the same permission /admin/products enforces), so a
   read-only role sees the values and no controls. */
function pxMetaSection(p) {
  var name = p.product, may = pxMayEditKb() && !p.archived;
  var dis = may ? "" : " disabled";
  var b = '<div class="m-form">';
  b += '<div class="m-field"><label class="m-label" for="pxf_sector">القطاع</label>' +
    '<select class="m-select" id="pxf_sector" aria-describedby="pxf_sector_st" data-pxfield="sectorId"' + dis + '><option value="">بلا قطاع</option>' +
    pcSectorList.map(function (s) { return '<option value="' + s.id + '"' + (String(p.sectorId) === String(s.id) ? " selected" : "") + ">" + esc(s.name) + "</option>"; }).join("") + "</select>" +
    '<span class="px-acts">' + (p.sectorAssumed ? '<span class="m-chip m-chip--warn" title="القطاع مُستنتَج — اختر قيمة لتأكيده">مُستنتَج</span>' : "") + pxStatusSlot(name + "|sectorId", "pxf_sector") + "</span></div>";
  if (typeof cfDivs !== "undefined" && cfDivs.length) {
    b += '<div class="m-field"><label class="m-label" for="pxf_division">القسم</label>' +
      '<select class="m-select" id="pxf_division" aria-describedby="pxf_division_st" data-pxfield="divisionId"' + dis + '><option value="">بلا قسم</option>' +
      cfDivs.map(function (d) { return '<option value="' + d.id + '"' + (String(p.divisionId) === String(d.id) ? " selected" : "") + ">" + esc(d.name) + "</option>"; }).join("") +
      '</select><span class="px-acts">' + pxStatusSlot(name + "|divisionId", "pxf_division") + "</span></div>";
  }
  var ov = pxFState[name + "|owner"] && pxFState[name + "|owner"].s !== "saved" ? pxFState[name + "|owner"].v : (p.owner || "");
  /* A PERSON FIELD IS THE COMBOBOX (founder, 2026-09-17), the same control «المسؤول» on an
     opportunity uses: the datalist here showed nothing on a touch device and hinted at no list at all.
     Still a free name — a product manager can be someone no product names yet. */
  b += '<div class="m-field"><label class="m-label" for="pxf_owner">مدير المنتج</label>' +
    mCombo({ id: "pxf_owner", value: ov, options: pxOwnerList(), placeholder: "بلا مسؤول",
      label: "مدير المنتج", free: true, wide: true, disabled: !may,
      empty: "لا أسماء بعد — اكتب اسمًا، أو أضِف الفريق من «إعدادات النظام»",
      attrs: ' aria-describedby="pxf_owner_st" data-pxfield="owner"' }) +
    '<span class="px-acts">' + pxStatusSlot(name + "|owner", "pxf_owner") + "</span></div>";
  b += "</div>";
  b += '<p class="m-meta">' + (p.createdAt ? "أُنشئ " + fmtD(p.createdAt) + " · " : "") +
    (may ? "يُحفظ كل حقل فور تغييره." : "العرض فقط — تعديل بيانات المنتج يتطلب صلاحية إدارة معرفة المنتج.") + "</p>";
  if (pxMayEditKb() && !p.embedded && !p.archived) {
    b += '<div class="px-acts"><button type="button" class="m-btn" data-px="rename">إعادة تسمية المنتج</button></div>';
  }
  return pxSection("settings", "بيانات المنتج", "", b);
}

function vProductDrill(name, section) {
  pcLoad(false); pcPerfLoad(pcPerfYear, false);
  if (typeof cfLoad === "function") cfLoad(false);
  if (typeof opLoad === "function") opLoad(false);
  pxBind();
  var back = '<p class="m-crumb"><a href="#products">&#8592; كل المنتجات</a></p>';
  if (pcCat === null) {
    return '<div class="ds6">' + back + (pcFailed
      ? '<div class="m-card m-empty" role="alert"><p class="m-empty__t">تعذّر تحميل المنتج.</p>' +
        '<p class="m-empty__a"><button type="button" class="m-btn" data-px="retry">أعد المحاولة</button></p></div>'
      : moSkeleton(6, ["w60", "w80", "w40"])) + "</div>";
  }
  var p = pxRow(name);
  if (!p) {
    var words = String(name || "").split(/\s+/).filter(function (w) { return w.length > 2; });
    var close = (pcCat || []).filter(function (x) { return words.some(function (w) { return x.product.indexOf(w) >= 0; }); });
    return '<div class="ds6">' + back + '<div class="m-card m-empty"><p class="m-empty__t">لا منتج بهذا الاسم.</p>' +
      '<p class="m-empty__d"><bdi>' + esc(name) + "</bdi></p>" +
      (close.length ? close.map(function (x) {
        return '<a class="m-item" href="#product/' + pxEnc(x.product) + '"><span class="m-item__b">' +
          '<span class="m-item__n">' + esc(x.product) + "</span></span></a>";
      }).join("") : "") + "</div></div>";
  }
  pxKnowLoad(name, false);
  var rd = pxReadiness(p);
  var kn = pxKnow[name];
  var approvePrimary = !!(kn && (kn.draftMd || (kn.state === "legacy" && kn.md)));
  void section;   /* the route's section picks the TAB now (pxCurTab), it no longer scrolls the page */
  var tab = pxCurTab(p);
  var chip = function (label, value, focusId) {
    var has = !!value;
    var body = label + ": " + (has ? esc(value) : "بلا تحديد");
    var cls = "m-chip" + (has ? " m-chip--plain" : " m-chip--warn");
    return pxMayEditKb() && !p.archived
      ? '<button type="button" class="' + cls + '" data-px="tab" data-t="settings" data-f="' + focusId + '" title="' + esc(label + " — يُحرَّر في «البيانات والإدارة»") + '">' + body + "</button>"
      : '<span class="' + cls + '">' + body + "</span>";
  };
  var sectorName = (pcSectorList || []).filter(function (s) { return String(s.id) === String(p.sectorId); }).map(function (s) { return s.name; })[0] || "";
  var divName = (typeof cfDivs !== "undefined" ? cfDivs : []).filter(function (d) { return String(d.id) === String(p.divisionId); }).map(function (d) { return d.name; })[0] || "";

  var h = '<div class="ds6 px-rec-page">' + back;
  h += '<header class="px-rh"><div class="px-rh__t"><h1 class="m-h1">' + esc(p.product) + "</h1>" +
    '<div class="px-acts px-meta">' + (p.archived ? '<span class="m-chip">مؤرشف</span>' : "") +
    chip("القطاع", sectorName + (sectorName && p.sectorAssumed ? " (مُستنتَج)" : ""), "pxf_sector") +
    (typeof cfDivs !== "undefined" && cfDivs.length ? chip("القسم", divName, "pxf_division") : "") +
    chip("مدير المنتج", p.owner || "", "pxf_owner") +
    (p.embedded ? '<span class="m-chip m-chip--ac">كتالوج المساعد: مضمَّن</span>' : "") + "</div></div>";
  h += '<div class="px-acts px-acts--end px-rel">';
  if (p.archived) {
    h += '<button type="button" class="m-btn m-btn--primary" data-px="restore">استعادة المنتج</button>';
  } else {
    h += (!rd.eligible ? '<span class="m-meta" id="pxwhy">' + esc(rd.reason || rd.word) + "</span>" : "") +
      '<button type="button" class="m-btn' + (approvePrimary ? "" : " m-btn--primary") + '" data-px="launch" data-nm="' + esc(p.product) + '"' + (rd.eligible ? "" : ' disabled aria-disabled="true" aria-describedby="pxwhy"') + ">أطلق حملة بهذا المنتج</button>";
  }
  h += '<button type="button" class="m-btn m-btn--icon" id="pxmenu" data-px="menu" aria-haspopup="menu" aria-expanded="' + pxMenuOpen + '" aria-label="إجراءات أخرى">⋯</button>';
  if (pxMenuOpen) {
    h += '<div class="px-menu" role="menu">' + (p.embedded
      ? '<button type="button" role="menuitem" aria-disabled="true">إعادة تسمية</button><button type="button" role="menuitem" aria-disabled="true">أرشفة المنتج</button><p class="m-meta">مضمَّن في كتالوج المساعد — إعادة التسمية والأرشفة تتطلبان تحديث الكتالوج.</p>'
      : '<button type="button" role="menuitem" data-px="rename">إعادة تسمية</button>' + (p.archived ? '<button type="button" role="menuitem" data-px="restore">استعادة المنتج</button>' : '<button type="button" role="menuitem" data-px="archivejump">أرشفة المنتج</button>')) + "</div>";
  }
  h += "</div></header>";
  h += pxSwitcher(p) + pxReadinessBandHtml(p) + pxHero(p, rd) + pxTabStrip(p);

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
      pane += '<section class="m-card" id="pxsec_archive"><div class="m-card__h"><div>' +
        '<h2 class="m-card__t">أرشفة المنتج</h2>' +
        '<p class="m-meta" id="pxarch_note">' +
        (pxModal && pxModal.kind === "archiveImpact" ? "" : "الأرشفة تُخفي المنتج من القوائم ومعالج الحملات وتوقف استخدام المساعد لمعرفته وملفه، ويبقى تاريخه كما هو. يمكن استعادته.") + "</p></div></div>" +
        '<div class="px-acts"><button class="rv-hold" data-do="pxArchive" data-arg="' + esc(p.product) + '" data-idle="أرشفة المنتج" data-holding="استمر بالضغط للأرشفة…" data-armed="اضغط مرة أخرى للأرشفة" aria-pressed="false" title="اضغط مع الاستمرار"><span class="rv-fill"></span><span class="rv-lbl">أرشفة المنتج</span></button></div></section>';
    }
  }
  /* A DIV with role, not a bare <aside>: dashboard.ts styles the bare tag as the navigation rail,
     and a ported column rendered dark-on-dark the first time home shipped that way. */
  h += '<div class="px-rec"><div class="px-main px-pane" id="pxpane_' + tab + '" role="tabpanel" tabindex="0" aria-labelledby="pxtab_' + tab + '">' + pane + "</div>" +
    '<div class="px-side" role="complementary" aria-label="المرتبط بهذا المنتج">' + pxSide(p, rd) + "</div></div>";
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

/* The sector drill is INSIDE .ds6 (vSectorDrill wraps it), so its back link is the vocabulary own
   breadcrumb rather than an inline-styled anchor carrying the old tokens. */
function pcBack() {
  return '<p class="m-crumb"><a href="#products">&#8592; كل المنتجات</a></p>';
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
          (sc.target > 0 ? mMoney(sc.achieved) + ' من ' + mMoney(sc.target) : pcMoney(sc.weightedOpen) + ' مفتوح') +
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
  /* REDESIGNED 2026-09-17, on the founder's note that the old band was «bad UI».
     What it was: a five-column grid where three columns printed «—» on almost every row, an empty
     grey pill on each one, a dark-red «0٪» as the loudest thing on the page, and a four-quarter
     strip of which three quarters said «بلا مستهدف». The grid existed for data that is not there.

     What the records actually say is one sentence: ONE target is recorded — 34,000 on one product,
     one quarter — and nothing has been won against it. So the band leads with that sentence, gives
     the one sector that carries the target a real track, collapses the sectors that carry none into
     a single quiet line instead of a row of dashes each, and shows the quarter that has a target
     rather than four columns of absence. Nothing is hidden: every count that leaves the foreground
     is still named. */
  var targetedSecs = secs.filter(function (x) { return x.target > 0; });
  var idleSecs = secs.filter(function (x) { return !(x.target > 0); });
  var targeted = prods.filter(function (p) { return p.annualTarget !== null && p.annualTarget > 0; });
  var untargeted = prods.length - targeted.length;

  /* One line for everything unmeasured. Three identical rows of «—» taught the reader to skip
     the block, and the fact that matters about them is that they are unmeasured - one fact. */
  function xbIdleSectors(list) {
    var open = list.reduce(function (n, x) { return n + (x.openCount || 0); }, 0);
    return '<div class="xb-idle">' +
      '<b>' + esc(list.map(function (x) { return x.sector; }).join(" · ")) + '</b>' +
      '<span> — بلا مستهدف لهذا الربع · ' +
      mPl(open, "فرصة واحدة", "فرصتان", "فرص", "فرصة") + ' مفتوحة</span></div>';
  }

  var h = '<div class="xb">';

  /* The state, in one line. An interface that opens on «0٪» tells the reader their performance is
     bad; the truth is that almost nothing has a target to be measured against, which is a
     different problem with a different fix. */
  h += '<div class="xb-lede' + (anyTarget ? "" : " xb-lede--none") + '">' +
    '<span class="xb-lede__i" aria-hidden="true"></span><div>';
  if (!anyTarget) {
    h += '<b>لا مستهدف مسجّل على أي منتج</b>' +
      '<span>لا يمكن قياس الإنجاز قبل تسجيل مستهدف. اضغط «المستهدفات والأداء» لتحديدها.</span>';
  } else {
    h += '<b>' + pxNProdN(targeted.length) + ' يحمل مستهدفًا من ' + mN(prods.length) + '</b>' +
      '<span>' +
      (wonTotal
        ? ('المحقق ' + mMoney(wonTotal) + ' مقابل ' + mMoney(
            targeted.reduce(function (n, x) { return n + x.annualTarget; }, 0)) + ' مسجّلة.')
        : 'لا صفقة رابحة بعد، فالمحقق صفر على كل مستهدف مسجّل.') +
      (untargeted ? ' ' + pxNProdN(untargeted) + ' بلا مستهدف، ومحققها خارج أي نسبة.' : '') +
      '</span>';
  }
  h += '</div><a class="m-link" href="#perf">المستهدفات والأداء &#8592;</a></div>';

  /* The sectors that carry a target get a row each, with a track that shows the gap. The rest get
     ONE line: three identical rows of «—» taught the reader to skip the block, and the fact that
     matters about them is that they are unmeasured, which is one fact, not three. */
  if (targetedSecs.length) {
    h += '<div class="xb-sec"><div class="xb-h">القطاعات المستهدفة' +
      '<span>الربع ' + mN(pcSectors.quarter) + ' · ' + arYear(pcSectors.year) + '</span></div>';
    targetedSecs.forEach(function (sc) {
      /* ATTAINMENT, not sc.coveragePct. Coverage is (achieved + weightedOpen) / target, so a
         sector with nothing won and a weighted pipeline printed «10٪» directly beside
         «0 ر.س من 34,000 ر.س» — two different measures wearing the same clothes, which is the
         exact defect this band was rebuilt to stop. The product rows below already show
         achieved/target; both rows mean the same thing now. The pipeline is not lost: the row
         states how many opportunities are open, and #perf carries the weighted figure. */
      var pct = sc.target > 0 ? Math.round((sc.achieved / sc.target) * 100) : null;
      var w = pct === null ? 0 : Math.max(0, Math.min(100, pct));
      h += '<button type="button" class="xb-row go" data-go="sector" data-nm="' + esc(sc.sector) + '">' +
        '<span class="xb-row__n">' + esc(sc.sector) +
          '<em>' + mPl(sc.openCount, "فرصة واحدة", "فرصتان", "فرص", "فرصة") + ' مفتوحة</em></span>' +
        '<span class="xb-row__t"><i style="inline-size:' + w + '%"></i></span>' +
        '<span class="xb-row__v">' + mMoney(sc.achieved) +
          '<em>من ' + mMoney(sc.target) + '</em></span>' +
        '<span class="xb-row__p' + (pct ? "" : " is-nil") + '">' +
          (pct === null ? '<span class="m-td-nil m-nil--owed">بلا مستهدف</span>'
                        : mN(pct) + '٪') + '</span></button>';
    });
    if (idleSecs.length) { h += xbIdleSectors(idleSecs); }
    h += '</div>';
  } else if (idleSecs.length) {
    h += '<div class="xb-sec"><div class="xb-h">القطاعات</div>' + xbIdleSectors(idleSecs) + '</div>';
  }

  /* Products, only the ones that can be ranked. The others are counted in the lede above. */
  if (targeted.length) {
    h += '<div class="xb-sec"><div class="xb-h">المنتجات حسب الإنجاز' +
      '<span>الأقل أولًا</span></div>';
    targeted.sort(function (x, y) { return (x.coveragePct || 0) - (y.coveragePct || 0); })
      .slice(0, 5).forEach(function (pr) {
        var pct = pr.coveragePct, w = pct === null ? 0 : Math.max(0, Math.min(100, pct));
        h += '<button type="button" class="xb-row go" data-go="product" data-nm="' + esc(pr.product) + '">' +
          '<span class="xb-row__n">' + esc(pr.product) +
            '<em>' + esc(pcSectorOfProduct(pr) || "لم يُصنَّف") + '</em></span>' +
          '<span class="xb-row__t"><i style="inline-size:' + w + '%"></i></span>' +
          '<span class="xb-row__v">' + mMoney(pr.achieved) +
            '<em>من ' + mMoney(pr.annualTarget) + '</em></span>' +
          '<span class="xb-row__p' + (pct ? "" : " is-nil") + '">' +
            (pct === null ? '<span class="m-td-nil m-nil--owed">بلا مستهدف</span>'
                          : mN(pct) + '٪') + '</span></button>';
      });
    h += '</div>';
  }

  /* The quarters. Only the ones carrying a target are drawn; the rest become one line, for the
     same reason the idle sectors did. The current quarter is marked because "where are we" is
     the question this band answers. */
  var qs = (pcQuarters.quarters || []);
  var qTargeted = qs.filter(function (q) { return q.target > 0; });
  var qIdle = qs.length - qTargeted.length;
  if (qTargeted.length) {
    h += '<div class="xb-sec"><div class="xb-h">الأرباع المستهدفة' +
      '<span>' + arYear(pcQuarters.year) + '</span></div><div class="xb-qs">';
    qTargeted.forEach(function (q) {
      var cur = q.quarter === pcQuarters.currentQuarter;
      var w = q.target > 0 ? Math.max(0, Math.min(100, (q.achieved / q.target) * 100)) : 0;
      h += '<div class="xb-q' + (cur ? " is-cur" : "") + '">' +
        '<span class="xb-q__k">الربع ' + mN(q.quarter) + (cur ? " · الحالي" : "") + '</span>' +
        '<span class="xb-q__t"><i style="inline-size:' + w.toFixed(1) + '%"></i></span>' +
        '<span class="xb-q__v">' + mMoney(q.achieved) + ' <em>من ' + mMoney(q.target) + '</em></span>' +
        '</div>';
    });
    h += '</div>';
    if (qIdle) {
      h += '<div class="xb-idle xb-idle--q">' + mN(qIdle) +
        ' من أربعة أرباع بلا مستهدف مسجّل</div>';
    }
    h += '</div>';
  }

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
  if (!pcSectors) return '<div class="ds6">' + pcBack() + moSkeleton(6, ["w60", "w80", "w40"]) + "</div>";
  var sec = pcSectors.sectors.filter(function (x) { return x.sector === name; })[0];
  if (!sec) {
    return '<div class="ds6">' + pcBack() +
      '<div class="m-card m-empty"><p class="m-empty__t">قطاع غير موجود</p>' +
      '<p class="m-empty__d"><bdi>' + esc(name) + "</bdi></p></div></div>";
  }

  var h = '<div class="ds6">' + pcBack();
  h += '<h1 class="m-h1">' + esc(sec.sector) + "</h1>";
  var cov = sec.coveragePct;
  h += '<div class="m-kpis">' +
    '<div class="m-card"><p class="m-stat__k">المحقق</p>' +
      '<p class="m-stat__v">' + mMoney(sec.achieved) + "</p>" +
      /* «من 0 ر.س» asserts a target of zero. An absent target is not a zero one, and the
         التغطية tile below already says «بلا مستهدف» — the row contradicted itself. */
      '<p class="m-stat__s">' + (Number(sec.target) > 0 ? "من " + mMoney(sec.target) : mNil("بلا مستهدف", "owed")) + "</p></div>" +
    '<div class="m-card"><p class="m-stat__k">المتوقع من المفتوح</p>' +
      '<p class="m-stat__v">' + mMoney(sec.weightedOpen) + "</p>" +
      '<p class="m-stat__s">' + mPl(sec.openCount, "فرصة واحدة مفتوحة", "فرصتان مفتوحتان", "فرص مفتوحة", "فرصة مفتوحة") + "</p></div>" +
    '<div class="m-card"><p class="m-stat__k">مربوحة</p>' +
      '<p class="m-stat__v">' + mN(sec.wonCount) + "</p>" +
      '<p class="m-stat__s">في الفترة</p></div>' +
    '<div class="m-card"><p class="m-stat__k">التغطية</p>' +
      '<p class="m-stat__v">' + (cov === null ? mNil("بلا مستهدف", "owed") : mPct(cov)) + "</p>" +
      '<p class="m-stat__s">' + (cov === null ? "لا نسبة بلا مستهدف" : "محقق + متوقع") + "</p></div>" +
  "</div>";

  h += '<section class="m-card m-card--pad0"><div class="m-tools"><div>' +
    '<h2 class="m-card__t">منتجات القطاع حسب الإنجاز</h2>' +
    '<p class="m-meta">اضغط منتجًا لفتح لوحته.</p></div></div><div class="px-secb px-um">';
  (sec.products || []).forEach(function (nm) {
    var pq = (pcQuarters && pcQuarters.byProduct ? pcQuarters.byProduct : []).filter(function (x) { return x.product === nm; })[0];
    var c = pq ? pq.coveragePct : null;
    h += '<a class="m-item" href="#product/' + encodeURIComponent(nm) + '"><span class="m-item__b">' +
      '<span class="m-item__n">' + esc(nm) + "</span>" +
      '<span class="m-item__s">' + (pq
        /* annualTarget null is NO TARGET RECORDED, never a target of zero, so no «من 0 ر.س». */
        ? (mMoney(pq.achieved) + (pq.annualTarget === null || pq.annualTarget === undefined
            ? " · " + mNil("بلا مستهدف سنوي", "owed") : " من " + mMoney(pq.annualTarget)))
        : mNil("لم يُقرأ الأداء", "unset")) + "</span></span>" +
      '<span class="m-item__v">' + (c === null ? mNil("بلا مستهدف", "owed") : mPct(c)) + "</span></a>";
  });
  h += "</div></section></div>";
  return h;
}
`;
