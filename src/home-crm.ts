// home-crm.ts — «الرئيسية» as the founder's prototype opens it: four figures, the health of the
// pipeline, and the partners' week. The bands below this one (sectors, products, quarters) are the
// exec band products-crm already ships; this file adds what the prototype has and Massar did not.
//
// The prototype's four health cards are static text. Here every one of them OPENS the deals it
// counted — the BR-RPT-004 rule: a figure a reader cannot follow is a claim, and this screen is read
// by the person who has to act on it.
//
// No backticks in this file (gate: check-crm-literals).

export const HOME_CRM_CSS = `
/* ===== THE HOME DASHBOARD SHELL =====
   الرئيسية was two dashboards stacked: the executive band on top of the older campaign home, each
   with its own page title, its own section-header style and its own KPI card. Three card designs,
   three header styles, two <h1>s, 2,554px of scroll — the reader had to learn the page twice.
   One grammar now. Every band is a .hd-sec with the same header, numbered so the page has a spine,
   and the tail is two columns instead of a ribbon of full-width cards. */
/* ===== THE DECK =====
   Founder's chosen direction A. A full-bleed dark band, continuous with the rail, carrying the
   leading figure and the whole pipeline. It escapes .body's padding with negative margins rather
   than by restructuring the shell — .body owns the page gutter and nothing else may assume it.
   Values and their measured ratios: DESIGN.md §2, "The deck". */
.hm-deck { margin:calc(var(--s4) * -1 - 6px) calc(var(--s5) * -1) var(--s5); padding:34px 40px 30px;
  background:linear-gradient(135deg, var(--deck-1), var(--deck-2)); color:#fff;
  position:relative; overflow:hidden; }
/* one broad accent bloom, top inline-start. Decoration that carries no data gets no more than this. */
.hm-deck::after { content:""; position:absolute; inset:0; pointer-events:none;
  background:radial-gradient(900px 300px at 85% -30%, rgba(37,99,235,.55), transparent 70%); }
.hm-deck > * { position:relative; }
.hm-dtop { display:flex; align-items:baseline; gap:14px; flex-wrap:wrap; margin-block-end:26px; }
.hm-dtop h2 { margin:0; font-size:var(--t-lg); font-weight:700; color:#fff; line-height:var(--lh-tight); }
.hm-dtop .s { font-size:var(--t-xs); color:var(--deck-mut); }
.hm-dtop .sp { flex:1; }
.hm-dtop a { font-size:var(--t-xs); color:var(--deck-lnk); text-decoration:none; font-weight:600;
  padding:6px 8px; border-radius:var(--r-sm); transition:background var(--fast) var(--ease), transform 140ms var(--ease); }
@media (hover:hover) and (pointer:fine) { .hm-dtop a:hover { background:rgba(255,255,255,.10); } }
.hm-dtop a:active { transform:scale(0.97); }

.hm-dbody { display:flex; align-items:flex-end; gap:var(--s6); flex-wrap:wrap; }
.hm-hero { display:flex; align-items:flex-end; gap:var(--s4); min-width:0; }
/* --t-3xl is 40px; the deck's figure is the one place the page goes bigger, and DESIGN.md's ladder
   tops out at --t-num (44). clamp() keeps it from crowding the stats on a laptop. */
.hm-hero .big { font-size:clamp(var(--t-3xl), 7vw, 96px); font-weight:800; line-height:.84;
  letter-spacing:-3px; font-variant-numeric:tabular-nums; }
.hm-hero .cap { margin-block-end:14px; min-width:0; }
.hm-hero .cap b { display:block; font-size:var(--t-sm); font-weight:600; color:var(--deck-ink); }
.hm-hero .cap span { display:block; font-size:var(--t-xs); color:var(--deck-mut); margin-block-start:3px; }
.hm-arc { flex:none; width:118px; height:118px; position:relative; }
.hm-arc svg { transform:rotate(-90deg); }
.hm-arc .track { fill:none; stroke:rgba(255,255,255,.16); stroke-width:11; }
.hm-arc .arc { fill:none; stroke:var(--deck-pc); stroke-width:11; stroke-linecap:round;
  transition:stroke-dashoffset 420ms var(--ease-out); }
.hm-arc .v { position:absolute; inset:0; display:grid; place-items:center;
  font-size:var(--t-sm); font-weight:700; color:var(--deck-lnk); font-variant-numeric:tabular-nums; }

.hm-stats { display:flex; gap:var(--s6); flex-wrap:wrap; margin-inline-start:auto; }
.hm-stat .k { font-size:var(--t-xs); color:var(--deck-mut); margin-block-end:7px; }
.hm-stat .v { display:flex; align-items:baseline; gap:6px; font-size:var(--t-2xl); font-weight:800;
  line-height:1; font-variant-numeric:tabular-nums; }
.hm-stat .v s { text-decoration:none; font-size:var(--t-xs); font-weight:500; color:var(--deck-mut); }
.hm-stat .s { font-size:var(--t-xs); color:var(--deck-mut); margin-block-start:5px; }

/* THE PIPELINE IS ONE RAIL. Four cards made the reader compare four boxes; one rail shows the
   split at a glance and each key opens exactly the deals it counted. */
.hm-prail-wrap { margin-block-start:30px; }
.hm-prail-l { display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; margin-block-end:10px; }
.hm-prail-l b { font-size:var(--t-sm); font-weight:600; color:var(--deck-ink); }
.hm-prail-l span { font-size:var(--t-xs); color:var(--deck-mut); }
.hm-prail { display:flex; height:16px; border-radius:var(--r-pill); overflow:hidden;
  background:rgba(255,255,255,.13); box-shadow:inset 0 1px 2px rgba(0,0,0,.25); }
.hm-prail i { display:block; height:100%; transition:width var(--slow) var(--ease); }
.hm-keys { display:flex; gap:26px; flex-wrap:wrap; margin-block-start:14px; }
.hm-key { font-family:inherit; display:flex; align-items:baseline; gap:8px; font-size:var(--t-xs);
  color:#B9CCE6; background:none; border:0; padding:6px 8px; border-radius:var(--r-sm); cursor:pointer;
  text-align:start; transition:background var(--fast) var(--ease), transform 140ms var(--ease); }
.hm-key[disabled] { cursor:default; color:var(--deck-mut); }
@media (hover:hover) and (pointer:fine) { .hm-key:not([disabled]):hover { background:rgba(255,255,255,.10); color:#fff; } }
.hm-key:not([disabled]):active { transform:scale(0.97); }
.hm-key:focus-visible { outline:2px solid #fff; outline-offset:-2px; }
.hm-key em { width:9px; height:9px; border-radius:3px; flex:none; font-style:normal; align-self:center; }
.hm-key b { font-size:var(--t-lg); font-weight:800; color:#fff; font-variant-numeric:tabular-nums; }
.hm-key[disabled] b { color:var(--deck-mut); }

@media (max-width: 900px) {
  .hm-deck { margin-inline:calc(var(--s3) * -1); padding:var(--s4) var(--s3) var(--s4); }
  .hm-stats { margin-inline-start:0; gap:var(--s4); }
  .hm-arc { width:88px; height:88px; }
}
@media (pointer: coarse) { .hm-key { min-height:44px; align-items:center; } }
@media (prefers-reduced-motion: reduce) { .hm-arc .arc, .hm-prail i { transition:none; } }

.hd { display:flex; flex-direction:column; gap:var(--s6); }
.hd-sec { display:flex; flex-direction:column; gap:var(--s3); scroll-margin-top:var(--s4); }
.hd-h { display:flex; align-items:baseline; gap:var(--s3); flex-wrap:wrap; min-height:28px; }
.hd-h h2 { margin:0; font-size:var(--t-lg); font-weight:600; color:var(--ink); line-height:var(--lh-tight); letter-spacing:0; }
/* The index is the spine: it tells the reader how many questions this page answers and where they
   are in them. Tabular so the column of numbers does not wobble down the page. */
.hd-h .ix { align-self:center; flex:none; font-size:var(--t-xs); font-weight:600; color:var(--muted);
  font-variant-numeric:tabular-nums; background:var(--surface); box-shadow:var(--well);
  border-radius:var(--r-sm); padding:3px 8px; }
.hd-h .s { font-size:var(--t-xs); color:var(--muted); line-height:1.7; }
.hd-h .sp { flex:1; }
.hd-h .go { font-family:inherit; font-size:var(--t-xs); font-weight:500; color:var(--accent-deep);
  background:none; border:0; cursor:pointer; padding:6px 8px; border-radius:var(--r-sm); text-decoration:none;
  transition:background var(--fast) var(--ease), transform 140ms var(--ease); }
@media (hover:hover) and (pointer:fine) { .hd-h .go:hover { background:var(--accent-bar-hover); } }
.hd-h .go:active { transform:scale(0.97); }
/* The tail: the wide chart keeps the room it needs, the lists sit beside it instead of under it. */
.hd-split { display:grid; grid-template-columns:minmax(0,1.7fr) minmax(0,1fr); gap:var(--s3); align-items:start; }
.hd-col { display:flex; flex-direction:column; gap:var(--s3); min-width:0; }
@media (max-width: 1100px) { .hd-split { grid-template-columns:minmax(0,1fr); } }

.hm { display:flex; flex-direction:column; gap:var(--s5); }
.hm-h { display:flex; align-items:baseline; gap:var(--s3); flex-wrap:wrap; }
.hm-h h2 { margin:0; font-size:var(--t-md); font-weight:600; color:var(--ink); }
.hm-h .s { font-size:var(--t-xs); color:var(--muted); }
.hm-h .sp { flex:1; }
.hm-lnk { font-family:inherit; font-size:var(--t-xs); font-weight:500; color:var(--accent-deep); background:none;
  border:0; cursor:pointer; padding:6px 8px; border-radius:var(--r-sm); text-decoration:none; }
@media (hover:hover) and (pointer:fine) { .hm-lnk:hover { background:var(--accent-bar-hover); } }
.hm-lnk:active { transform:scale(0.98); }

/* ===== the four leading figures =====
   They used to be four identical white boxes, each holding one number in the middle of a lot of
   nothing: no point of view, no context, no way to tell at a glance whether the year is going well.
   DESIGN.md list rule 13 says a page must have a point of view — one figure leads at the size that
   says so. «نسبة الإنجاز» is that figure here, and it carries the bar it is a percentage OF. */
/* THE CARD GRAMMAR IS THE PROTOTYPE'S (founder, 2026-09-16). His card is: a small muted label on
   its own line, then a BASELINE ROW of a 28px/800 figure beside a 12px unit. Massar stacked a
   600-weight figure under a label and let the unit wrap to a third line, so the card read as a
   form field rather than as a number. Hierarchy here is carried by WEIGHT (500 label -> 800
   figure), which is why DESIGN.md now allows 800 on a leading figure and nowhere else. */
.hm-kpis { display:grid; grid-template-columns:1.5fr repeat(3, minmax(0,1fr)); gap:var(--s3); }
.hm-kpi { position:relative; background:var(--paper); border:1px solid var(--line); border-radius:var(--r-xl);
  padding:18px 18px 16px; display:flex; flex-direction:column; min-width:0; overflow:hidden;
  box-shadow:var(--specular), var(--sh-0); }
.hm-kpi .l { font-size:var(--t-xs); color:var(--muted); font-weight:500; margin-block-end:12px; }
/* baseline, not center: the unit must sit on the figure's baseline or it floats mid-digit */
.hm-kpi .n { display:flex; align-items:baseline; gap:7px; flex-wrap:wrap;
  font-size:var(--t-2xl); font-weight:800; color:var(--fig); font-variant-numeric:tabular-nums;
  line-height:1; letter-spacing:0; }
.hm-kpi .n.none { color:var(--muted); font-size:var(--t-xl); font-weight:600; }
/* «مليون ر.س» is not part of the figure: it rides beside it at label weight, on its baseline */
.hm-kpi .n .uu { font-size:var(--t-xs); color:var(--muted); font-weight:450; letter-spacing:0; }
.hm-kpi.lead .n .uu { color:var(--ink-2); font-size:var(--t-sm); }
.hm-kpi .u { font-size:var(--t-xs); color:var(--muted); font-weight:450; margin-block-start:10px; }
/* the lead tile: the accent ground, the biggest figure, and the meter that gives the percentage a subject */
.hm-kpi.lead { background:linear-gradient(180deg, var(--accent-tint), var(--paper) 78%);
  border-color:var(--accent-mark); }
.hm-kpi.lead .l { color:var(--accent-deep); font-weight:600; }
.hm-kpi.lead .n { font-size:var(--t-3xl); color:var(--accent-deep); }
.hm-kpi.lead .u { color:var(--ink-2); }
.hm-meter { height:8px; border-radius:var(--r-pill); background:var(--paper);
  box-shadow:inset 0 0 0 1px var(--accent-mark); overflow:hidden; margin-block-start:var(--s2); }
.hm-meter i { display:block; height:100%; border-radius:var(--r-pill); background:var(--accent);
  transition:width var(--slow) var(--ease); }
/* a supporting tile carries a quiet rule in its own tone, so four tiles are not four identical boxes */
.hm-kpi .rule { position:absolute; inset-block-end:0; inset-inline:0; height:2px; background:var(--tn, var(--line)); }
.hm-kpi.lead .rule { display:none; }

/* صحة خط البيع — one card per state, each one a door into its own deals */
.hm-health { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:var(--s3); }
.hm-st { position:relative; text-align:start; font-family:inherit; background:var(--paper); border:1px solid var(--line);
  border-radius:var(--r-lg); padding:var(--s4); display:flex; flex-direction:column; gap:6px; min-width:0; cursor:pointer;
  overflow:hidden; color:inherit; box-shadow:inset 0 1px 0 rgba(255,255,255,.9), var(--sh-0);
  transition:box-shadow var(--base) var(--ease), transform var(--base) var(--ease), border-color var(--fast) var(--ease); }
/* The state's own colour washes the head of the card instead of sitting as a 3px stripe nobody
   reads. The wash runs to paper well before the text, so every label keeps its measured contrast. */
.hm-st::before { content:""; position:absolute; inset-block-start:0; inset-inline:0; height:96px;
  background:linear-gradient(180deg, var(--tn-soft, var(--surface)), transparent); pointer-events:none; }
.hm-st > * { position:relative; }
.hm-st[disabled] { cursor:default; opacity:1; }
/* interior.dev: a hover lift is a promise the thing is clickable — and here it is, each card opens
   exactly the deals it counted. A disabled (zero-count) card makes no such promise. */
@media (hover:hover) and (pointer:fine) {
  .hm-st:not([disabled]):hover { box-shadow:var(--sh-3); transform:translateY(-2px); border-color:var(--tn, var(--line)); }
}
.hm-st:not([disabled]):active { transform:scale(0.98); transition-duration:120ms; }
/* The prototype's own layout: the state's name and its dot at the inline-END of the first row, the
   COUNT big at the inline-start of that same row, then the definition, then the money in the state's
   own colour. Massar had the name on one line and a small count under it, so four cards read as four
   labels rather than as four quantities. */
/* .hm-hd, not .hd — .hd is the page shell above, and a nested .hd inherited its column flow, which
   put the state's name under its own count instead of beside it. */
.hm-hd { display:flex; align-items:baseline; gap:var(--s3); }
.hm-st .t { display:flex; align-items:center; gap:7px; font-size:var(--t-sm); font-weight:700;
  color:var(--tn-text, var(--ink)); margin-inline-start:auto; text-align:end; }
.hm-st .n { font-size:var(--t-2xl); font-weight:800; color:var(--fig); font-variant-numeric:tabular-nums; line-height:1; }
.hm-st .n .u { font-size:var(--t-xs); font-weight:500; color:var(--muted); margin-inline-start:5px; }
.hm-st .hint { font-size:var(--t-xs); color:var(--muted); line-height:1.7; }
.hm-st .v { font-size:var(--t-sm); font-weight:700; color:var(--tn-text, var(--ink-2));
  font-variant-numeric:tabular-nums; margin-top:auto; }
/* the share of the whole pipeline — the figure above is a count, this says how big a slice it is */
.hm-sh { height:6px; border-radius:var(--r-pill); background:var(--surface-2); overflow:hidden; margin-block-start:var(--s2); }
.hm-sh i { display:block; height:100%; border-radius:var(--r-pill); background:var(--tn, var(--accent));
  transition:width var(--slow) var(--ease); }
.hm-st .go { position:absolute; inset-inline-start:var(--s3); inset-block-start:var(--s4); color:var(--accent-deep); display:flex; }
.hm-st .go svg { width:13px; height:13px; }

/* the partners' week */
.hm-pt { background:var(--paper); border:1px solid var(--line); border-radius:var(--r-lg); padding:var(--s4);
  display:flex; align-items:center; gap:var(--s5); flex-wrap:wrap;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.9), var(--sh-0); }
/* The week's outcome as ONE bar, in the order a conversation goes: interested, not interested, no
   reply, then the untouched remainder of the target. Five columns separated by rules made the reader
   compare five numbers; a stacked bar shows the split without arithmetic. */
.hm-split { flex-basis:100%; display:flex; height:10px; border-radius:var(--r-pill); overflow:hidden;
  background:var(--surface-2); margin-block-start:var(--s2); }
.hm-split i { display:block; height:100%; transition:width var(--slow) var(--ease); }
.hm-split i.ok { background:#1E9E63; }
.hm-split i.bad { background:#D9534F; }
.hm-split i.mute { background:var(--s-off-mark, #767D89); }
.hm-legend { flex-basis:100%; display:flex; gap:var(--s3); flex-wrap:wrap; font-size:var(--t-xs); color:var(--muted); }
.hm-legend span { display:inline-flex; align-items:center; gap:6px; }
.hm-legend i { width:8px; height:8px; border-radius:2px; flex:none; }
.hm-ring { flex:none; display:flex; align-items:center; gap:var(--s3); }
.hm-ring svg { width:78px; height:78px; transform:rotate(-90deg); }
.hm-ring .track { fill:none; stroke:var(--surface-2); stroke-width:9; }
.hm-ring .arc { fill:none; stroke:var(--accent); stroke-width:9; stroke-linecap:round;
  transition:stroke-dashoffset 420ms cubic-bezier(0.23, 1, 0.32, 1); }
.hm-ring .cap { font-size:var(--t-sm); font-weight:600; color:var(--ink); }
.hm-ring .cap span { display:block; font-size:var(--t-xs); font-weight:400; color:var(--muted); margin-top:2px; }
.hm-figs { display:flex; flex:1; min-width:0; flex-wrap:wrap; gap:var(--s4) var(--s5); }
.hm-fig { min-width:96px; border-inline-start:2px solid var(--line); padding-inline-start:var(--s3); }
.hm-fig:first-child { border-inline-start:0; padding-inline-start:0; }
/* one fact per line: label, figure, share. Inline spans ran «تم التواصل» and «2» and «33.3٪» together. */
.hm-fig .l, .hm-fig .n, .hm-fig .p { display:block; }
.hm-fig .l { font-size:var(--t-xs); color:var(--muted); }
.hm-fig .n { font-size:var(--t-lg); font-weight:600; font-variant-numeric:tabular-nums; line-height:1.3; margin-top:2px; }
.hm-fig .p { font-size:var(--t-xs); color:var(--muted); font-variant-numeric:tabular-nums; }
.hm-fig.ok .n { color:var(--s-ok-text, #12633F); }
.hm-fig.bad .n { color:var(--s-fail-text); }
.hm-fig.mute .n { color:var(--muted); }
.hm-state { font-size:var(--t-xs); color:var(--muted); padding:var(--s3) 0; display:flex; align-items:center; gap:var(--s2); flex-wrap:wrap; }

/* ===== entrance =====
   Tiles rise 6px and fade in, staggered by --stagger (24ms, capped at 8 items per DESIGN.md §8).
   It plays ONCE per page load: #body is rewritten on every data load and keystroke, and an
   entrance replayed on each one is the jump §8.6 forbids — hence the .hm-in gate, set by
   vHomeExec on the first paint only. Never scale(0): the tiles start at their own size. */
/* The bands themselves arrive, not just the tiles inside the first two: the page reads top to
   bottom, so the choreography follows the reading order. Capped at six by DESIGN.md §8's rule
   (8 items / 200ms total) — beyond that a stagger stops being rhythm and becomes waiting. */
.hm-in .hd-sec { animation:hmRise var(--base) var(--ease-out) both; }
.hm-in .hd-sec:nth-child(2) { animation-delay:var(--stagger); }
.hm-in .hd-sec:nth-child(3) { animation-delay:calc(var(--stagger) * 2); }
.hm-in .hd-sec:nth-child(4) { animation-delay:calc(var(--stagger) * 3); }
.hm-in .hd-sec:nth-child(5) { animation-delay:calc(var(--stagger) * 4); }
.hm-in .hd-sec:nth-child(n+6) { animation-delay:calc(var(--stagger) * 5); }
.hm-in .hm-kpis > :nth-child(2), .hm-in .hm-health > :nth-child(2) { animation:hmRise var(--base) var(--ease-out) both var(--stagger); }
.hm-in .hm-kpis > :nth-child(3), .hm-in .hm-health > :nth-child(3) { animation:hmRise var(--base) var(--ease-out) both calc(var(--stagger) * 2); }
.hm-in .hm-kpis > :nth-child(4), .hm-in .hm-health > :nth-child(4) { animation:hmRise var(--base) var(--ease-out) both calc(var(--stagger) * 3); }
@keyframes hmRise { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }

@media (prefers-reduced-motion: reduce) {
  .hm-ring .arc, .hm-meter i, .hm-sh i { transition:none; }
  .hm-in .hd-sec, .hm-in .hm-kpis > *, .hm-in .hm-health > * { animation:none; }
  .hm-st:not([disabled]):hover { transform:none; }
}
@media (max-width: 1100px) { .hm-kpis, .hm-health { grid-template-columns:repeat(2, minmax(0,1fr)); } }
@media (max-width: 560px) {
  .hm-kpis, .hm-health { grid-template-columns:minmax(0,1fr); }
  .hm-st, .hm-lnk { min-height:44px; }
}
`;

export const HOME_CRM_JS = `
/* ---------- the shell ----------
   One header for every band on الرئيسية. Taking the list and numbering it HERE, rather than letting
   each band print its own index, is what keeps the spine contiguous when a band is missing: a role
   without partners.view drops that band and the numbering closes up instead of skipping a number. */
function hdBands(list) {
  var n = 0;
  return '<div class="hd' + hmEnterCls() + '">' + list.filter(function (b) { return b && b[2]; }).map(function (b) {
    n++;
    return '<section class="hd-sec"' + (b[4] ? ' id="' + b[4] + '"' : "") + '><div class="hd-h">' +
      '<span class="ix" aria-hidden="true">' + fmtN(n) + "</span><h2>" + b[0] + "</h2>" +
      (b[1] ? '<span class="s">' + b[1] + "</span>" : "") +
      '<span class="sp"></span>' + (b[3] || "") + "</div>" + b[2] + "</section>";
  }).join("") + "</div>";
}

/* ---------- what the bands read ---------- */
var hmEsc = null, hmEscLoading = false, hmEscFailed = false;
var hmPt = null, hmPtLoading = false, hmPtFailed = false, hmPtWeek = "";

function hmT() { return { headers: { "x-admin-token": TOKEN } }; }

/* Open escalations decide «بانتظار الدعم». One read for the whole board — the drawer's own per-deal
   read stays where it is, because it must reflect a change the moment someone records one. */
function hmEscLoad(force) {
  if (hmEscLoading || (hmEsc && !force) || (hmEscFailed && !force)) return;
  hmEscLoading = true;
  fetch("/admin/escalations", hmT())
    .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
    .then(function (j) { hmEsc = (j && j.escalations) || []; hmEscFailed = false; })
    .catch(function () { hmEscFailed = true; })
    .then(function () { hmEscLoading = false; render(false); });
}
function hmPtLoad(force) {
  if (hmPtLoading || (hmPt && !force) || (hmPtFailed && !force)) return;
  hmPtLoading = true;
  fetch("/admin/partners", hmT())
    .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
    .then(function (j) { hmPt = j; hmPtWeek = (j && j.week) || ""; hmPtFailed = false; })
    .catch(function () { hmPtFailed = true; })
    .then(function () { hmPtLoading = false; render(false); });
}
window.hmRetry = function () { hmEscFailed = false; hmPtFailed = false; hmEscLoad(true); hmPtLoad(true); render(false); };

/* ---------- the health of the pipeline ---------- */
function hmOpenEscIds() {
  var ids = {};
  (hmEsc || []).forEach(function (e) { if (!e.resolvedAt && e.oppId != null) ids[e.oppId] = 1; });
  return ids;
}
function hmHealth() {
  var rows = (typeof oppRows !== "undefined" && oppRows) ? oppRows : [];
  var esc = hmOpenEscIds();
  var now = Date.now();
  return pipelineHealth(rows.map(function (l) {
    return {
      id: l.id,
      value: opValue(l),
      lost: opIsLost(l),
      won: opIsWon(l),
      stalled: opStalled(l),
      /* an escalation that nobody closed, on a line that is still open */
      awaitingSupport: opIsOpen(l) && !!esc[l.id]
    };
  }));
}
/* Each state opens exactly the deals it counted. «بانتظار الدعم» has no board filter of its own — it is
   read from the escalations table — so it travels as ids, the same mechanism the reports use. */
window.hmOpenState = function (key) {
  if (typeof opStg === "undefined") { location.hash = "#opps"; return; }
  var rows = (typeof oppRows !== "undefined" && oppRows) ? oppRows : [];
  var esc = hmOpenEscIds();
  opQ = ""; opStat = "all"; opOwn = "all"; opProd = ""; opStg = "all"; opShort = "";
  if (typeof opSetIds === "function") opSetIds(null, "");
  if (key === "late") opShort = "stalled";
  else if (key === "on_track") {
    var ok = rows.filter(function (l) { return opIsOpen(l) && !opStalled(l) && !esc[l.id]; }).map(function (l) { return l.id; });
    if (typeof opSetIds === "function") opSetIds(ok, "على المسار");
  } else if (key === "support") {
    var sup = rows.filter(function (l) { return opIsOpen(l) && esc[l.id]; }).map(function (l) { return l.id; });
    if (typeof opSetIds === "function") opSetIds(sup, "بانتظار الدعم");
  } else if (key === "rejected") {
    var lost = rows.filter(opIsLost).map(function (l) { return l.id; });
    if (typeof opSetIds === "function") opSetIds(lost, "مرفوضة");
  }
  opSel = {}; if (typeof PAGE !== "undefined") PAGE.opps = 1;
  location.hash = "#opps";
};

/* Split a printed figure into the numeral and whatever trails it, so «6.3 مليون ر.س» draws as a
   28px/800 number with its unit riding on the baseline beside it — the prototype's own shape.
   Falls back to printing the whole string when there is no leading numeral to split on. */
/* hmMoney returns MARKUP (opMoneyShort wraps its figure in <bdi>). Anything that wants to measure,
   split or re-escape a printed figure has to see the text, not the tags. */
function hmPlain(html) { return String(html == null ? "" : html).replace(/<[^>]*>/g, ""); }
function hmFigure(text) {
  var s = hmPlain(text);
  var m = s.match(/^\\s*([0-9][0-9.,]*)\\s*([\\s\\S]*)$/);
  if (!m) return '<span class="n">' + esc(s) + "</span>";
  return '<span class="n">' + esc(m[1]) + (m[2] ? '<span class="uu">' + esc(m[2]) + "</span>" : "") + "</span>";
}
function hmIco(n) { return typeof opIco === "function" ? opIco(n) : ""; }
function hmMoney(v) { return typeof opMoneyShort === "function" ? opMoneyShort(v) : fmtN(Math.round(v || 0)) + " ر.س"; }
/* Mark, soft ground and text — the four-value status contract (DESIGN.md §2). The soft value is the
   card's wash; the text value is the only legal label on it. */
var HM_TONE = {
  on_track: "--tn:#1E9E63;--tn-soft:#E4F5EC;--tn-text:#12633F",
  late: "--tn:#B37F00;--tn-soft:#FFF5D6;--tn-text:#7A5600",
  support: "--tn:#2563EB;--tn-soft:#EAF1FE;--tn-text:#1A47BE",
  rejected: "--tn:#D9534F;--tn-soft:#FBE7E6;--tn-text:#8E2A27"
};

/* Body only — the shell owns the header (hdBands), so every band on الرئيسية wears one. */
function vHomeHealth() {
  if (typeof opLoad === "function") opLoad(false);
  hmEscLoad(false);
  var loading = (typeof oppLoading !== "undefined" && oppLoading) || hmEscLoading;
  var failed = (typeof oppFailed !== "undefined" && oppFailed) || hmEscFailed;
  var h = "";
  if (!((typeof oppRows !== "undefined" && oppRows)) && loading) {
    return '<div class="hm-state" aria-busy="true">جارٍ قراءة الفرص…</div>';
  }
  if (!((typeof oppRows !== "undefined" && oppRows)) && failed) {
    return '<div class="hm-state" role="alert">' + hmIco("warn") + 'تعذّر تحميل الفرص.<button class="hm-lnk" onclick="opRetry()">أعد المحاولة</button></div>';
  }
  var st = hmHealth();
  if (!st.total) {
    return '<div class="hm-state">لا فرص مسجّلة بعد — تظهر الحالات هنا فور تسجيل أول فرصة في «فرص البيع».</div>';
  }
  h += '<div class="hm-health">' + st.buckets.map(function (b) {
    var off = !b.count;
    var share = st.total ? Math.round((b.count / st.total) * 100) : 0;
    return '<button type="button" class="hm-st"' + (off ? " disabled" : "") + ' style="' + (HM_TONE[b.key] || "") + '"' +
      (off ? "" : ' onclick="hmOpenState(&quot;' + b.key + '&quot;)"') +
      ' title="' + esc(b.hint) + (off ? "" : " — افتح هذه الفرص") + '">' +
      (off ? "" : '<span class="go" aria-hidden="true">' + hmIco("chevS") + "</span>") +
      '<span class="hm-hd"><span class="n">' + fmtN(b.count) + '<span class="u">' + fmtN(share) + "٪</span></span>" +
      '<span class="t">' + esc(b.label) + "</span></span>" +
      '<span class="hint">' + esc(b.hint) + "</span>" +
      '<span class="v">' + hmMoney(b.value) + "</span>" +
      '<span class="hm-sh" aria-hidden="true"><i style="width:' + share + '%"></i></span></button>';
  }).join("") + "</div>";
  return h;
}

/* ---------- the partners' week ---------- */
function vHomePartners() {
  if (typeof meCan === "function" && !meCan("partners.view")) return "";
  hmPtLoad(false);
  var h = "";
  if (!hmPt && hmPtLoading) return '<div class="hm-state" aria-busy="true">جارٍ قراءة أسبوع الشركاء…</div>';
  if (!hmPt) {
    return '<div class="hm-state" role="alert">' + hmIco("warn") + 'تعذّر تحميل أداء الشركاء.<button class="hm-lnk" onclick="hmRetry()">أعد المحاولة</button></div>';
  }
  var wk = summarizeWeek(hmPt.targets || [], hmPt.results || []);
  var b = partnerWeekBand(wk);
  if (!b.target && !b.contacted) {
    return '<div class="hm-state">لا مستهدفات ولا نتائج في هذا الأسبوع — تُحدَّد من «شركاء المبيعات».</div>';
  }
  var pct = wholePct(attainmentPct(b.contacted, b.target));
  var R = 33, C = 2 * Math.PI * R;
  var dash = pct === null ? 0 : Math.max(0, Math.min(100, pct)) / 100 * C;
  var fig = function (cls, label, n, p, sub) {
    return '<div class="hm-fig ' + cls + '"><span class="l">' + label + "</span>" +
      '<span class="n">' + fmtN(n) + "</span>" +
      '<span class="p">' + (p === null || p === undefined ? esc(sub || "") : fmtN(p) + "٪ من المستهدف") + "</span></div>";
  };
  h += '<div class="hm-pt"><div class="hm-ring">' +
    '<svg viewBox="0 0 80 80" role="img" aria-label="تحقيق المستهدف ' + (pct === null ? "غير محسوب" : fmtN(pct) + "٪") + '">' +
    '<circle class="track" cx="40" cy="40" r="' + R + '"></circle>' +
    '<circle class="arc" cx="40" cy="40" r="' + R + '" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + (C - dash).toFixed(1) + '"></circle></svg>' +
    '<span class="cap">' + (pct === null ? "—" : fmtN(pct) + "٪") + "<span>تحقيق المستهدف</span></span></div>" +
    '<div class="hm-figs">' +
    fig("", "إجمالي المستهدف الأسبوعي", b.target, null, "منشأة متعاقد عليها") +
    fig("", "تم التواصل", b.contacted, b.contactedPct, "") +
    fig("ok", "العملاء المهتمون", b.interested, b.interestedPct, "") +
    fig("bad", "غير مهتمين", b.notInterested, b.notInterestedPct, "") +
    fig("mute", "لم يردوا", b.noReply, b.noReplyPct, "") +
    "</div>";
  /* Shares of the TARGET, so the untouched remainder is visible as the gap the bar does not fill. */
  var den = b.target || b.contacted || 0;
  var w = function (n) { return den ? Math.max(0, Math.min(100, (n / den) * 100)) : 0; };
  if (den) {
    h += '<span class="hm-split" role="img" aria-label="توزيع الأسبوع: ' +
      esc(fmtN(b.interested) + " مهتم، " + fmtN(b.notInterested) + " غير مهتم، " + fmtN(b.noReply) + " لم يرد، من " + fmtN(den)) + '">' +
      '<i class="ok" style="width:' + w(b.interested).toFixed(1) + '%"></i>' +
      '<i class="bad" style="width:' + w(b.notInterested).toFixed(1) + '%"></i>' +
      '<i class="mute" style="width:' + w(b.noReply).toFixed(1) + '%"></i></span>' +
      '<span class="hm-legend" aria-hidden="true">' +
      '<span><i style="background:#1E9E63"></i>مهتمون</span>' +
      '<span><i style="background:#D9534F"></i>غير مهتمين</span>' +
      '<span><i style="background:#767D89"></i>لم يردوا</span>' +
      '<span><i style="background:#E5E8EE"></i>لم يُتواصل بهم بعد</span></span>';
  }
  h += "</div>";
  return h;
}

/* ---------- the four leading figures ---------- */
function vHomeKpis() {
  if (typeof pcLoad === "function") pcLoad(false);
  if (typeof opLoad === "function") opLoad(false);
  var secs = (typeof pcSectors !== "undefined" && pcSectors && pcSectors.sectors) || [];
  var target = 0, achieved = 0;
  secs.forEach(function (s) { target += Number(s.target) || 0; achieved += Number(s.achieved) || 0; });
  var st = hmHealth();
  var pct = wholePct(attainmentPct(achieved, target));
  var kpi = function (cls, tone, label, value, unit, extra) {
    return '<div class="hm-kpi ' + cls + '"' + (tone ? ' style="--tn:' + tone + '"' : "") + '><span class="l">' + label + "</span>" + value +
      (unit ? '<span class="u">' + unit + "</span>" : "") + (extra || "") +
      (cls === "lead" ? "" : '<span class="rule" aria-hidden="true"></span>') + "</div>";
  };
  var money = function (v) { return hmFigure(hmMoney(v)); };
  /* The meter is what makes the percentage mean something: it is 49٪ OF a bar you can see. */
  var meter = pct === null ? "" :
    '<span class="hm-meter" aria-hidden="true"><i style="width:' + Math.max(0, Math.min(100, pct)) + '%"></i></span>';
  return '<div class="hm-kpis">' +
    kpi("lead", "", "نسبة الإنجاز",
      pct === null ? '<span class="n none">لا مستهدف</span>' : '<span class="n">' + fmtN(pct) + '٪<span class="uu">من المستهدف</span></span>',
      pct === null ? "حدِّد المستهدفات ليُحسب الإنجاز" : hmMoney(achieved) + " من " + hmMoney(target), meter) +
    kpi("", "var(--s-off)", "المستهدف الإجمالي", target ? money(target) : '<span class="n none">—</span>',
      target ? "لكل القطاعات" : "لم يُحدَّد مستهدف بعد", "") +
    kpi("", "var(--s-issued)", "المحقق الإجمالي", money(achieved), "من الصفقات الرابحة", "") +
    kpi("", "var(--accent)", "الفرص المفتوحة",
      '<span class="n">' + fmtN(st.openCount) + '<span class="uu">فرصة</span></span>', hmMoney(st.openValue) + " قيمةً", "") +
    "</div>";
}

/* The executive bands, as data for the shell rather than as finished HTML. vHome appends the
   campaign bands to this list, so the whole page is one numbered sequence with one header style
   instead of an executive dashboard with its own titles sitting on top of a second one with its
   own. Order is the order the questions are asked: where are we, what is stuck, why, who is
   working it.
   hmEntered gates the entrance to the FIRST paint: #body is rewritten on every data load, and an
   entrance that replays on each one is the jump DESIGN.md §8.6 forbids. */
var hmEntered = false;
function hmEnterCls() { var c = hmEntered ? "" : " hm-in"; hmEntered = true; return c; }
/* The deck: one band that answers «أين نحن» and «ما الذي يحتاج تدخلًا» together. It is NOT a
   .hd-sec — it is full-bleed and carries its own header, because the whole point is that it reads
   as one dark object continuous with the rail rather than as a section of the page. */
function vHomeDeck() {
  if (typeof pcLoad === "function") pcLoad(false);
  if (typeof opLoad === "function") opLoad(false);
  hmEscLoad(false);
  var secs = (typeof pcSectors !== "undefined" && pcSectors && pcSectors.sectors) || [];
  var target = 0, achieved = 0;
  secs.forEach(function (s) { target += Number(s.target) || 0; achieved += Number(s.achieved) || 0; });
  var pct = wholePct(attainmentPct(achieved, target));
  var st = hmHealth();
  var left = Math.max(0, target - achieved);

  var R = 50, C = 2 * Math.PI * R;
  var dash = pct === null ? 0 : Math.max(0, Math.min(100, pct)) / 100 * C;
  var h = '<section class="hm-deck" aria-labelledby="hmdeck_h">';
  h += '<div class="hm-dtop"><h2 id="hmdeck_h">الأداء التجاري</h2>' +
    '<span class="s">' + (typeof pcQuarters !== "undefined" && pcQuarters && pcQuarters.year
      ? "السنة المالية " + esc(String(pcQuarters.year)) : "السنة الحالية") + "</span>" +
    '<span class="sp"></span><a href="#perf">المستهدفات والأداء ←</a></div>';

  /* The figure and its ring. The unit rides the caption, not the numeral — a 96px figure with
     «مليون ر.س» inline is unreadable at that size.
     hmMoney returns MARKUP (opMoneyShort wraps the figure in <bdi>), so the tags are stripped
     before the split and the plain parts are escaped. Escaping the markup printed «<bdi>» on the
     deck in 96px type — the first render of this band said so, loudly. */
  var money = hmPlain(hmMoney(achieved)), num = money, unit = "";
  var m = money.match(/^\\s*([0-9][0-9.,]*)\\s*([\\s\\S]*)$/);
  if (m) { num = m[1]; unit = m[2]; }
  h += '<div class="hm-dbody"><div class="hm-hero">' +
    '<div class="hm-arc"><svg viewBox="0 0 118 118" width="118" height="118" role="img" aria-label="' +
      esc("نسبة الإنجاز " + (pct === null ? "غير محسوبة" : fmtN(pct) + "٪")) + '">' +
      '<circle class="track" cx="59" cy="59" r="' + R + '"></circle>' +
      '<circle class="arc" cx="59" cy="59" r="' + R + '" stroke-dasharray="' + C.toFixed(1) +
      '" stroke-dashoffset="' + (C - dash).toFixed(1) + '"></circle></svg>' +
      '<span class="v">' + (pct === null ? "—" : fmtN(pct) + "٪") + "</span></div>" +
    '<span class="big">' + esc(num) + "</span>" +
    '<span class="cap"><b>' + (unit ? esc(unit) + " محققة" : "محققة") + "</b>" +
      '<span>' + (target ? "من مستهدف " + hmMoney(target) : "لم يُحدَّد مستهدف للسنة بعد") + "</span></span></div>";

  var stat = function (k, v, u, s) {
    return '<div class="hm-stat"><div class="k">' + k + '</div><div class="v">' + v +
      (u ? "<s>" + u + "</s>" : "") + '</div><div class="s">' + s + "</div></div>";
  };
  var splitv = function (txt) {
    var p = hmPlain(txt);
    var x = p.match(/^\\s*([0-9][0-9.,]*)\\s*([\\s\\S]*)$/);
    return x ? [x[1], x[2]] : [p, ""];
  };
  var ob = splitv(hmMoney(st.openValue)), lb = splitv(hmMoney(left));
  h += '<div class="hm-stats">' +
    stat("الكتاب المفتوح", esc(ob[0]), esc(ob[1]), fmtN(st.openCount) + " فرصة قائمة") +
    (target ? stat("المتبقّي للمستهدف", esc(lb[0]), esc(lb[1]), left ? "حتى نهاية السنة" : "تحقق المستهدف") : "") +
    "</div></div>";

  /* The pipeline as ONE rail. Each key opens exactly the deals it counted — the same read the
     four cards used, so nothing can disagree. */
  var tone = { on_track: "var(--deck-ok)", late: "var(--deck-warn)", support: "var(--deck-info)", rejected: "var(--deck-bad)" };
  if (st.total) {
    h += '<div class="hm-prail-wrap"><div class="hm-prail-l"><b>صحة خط البيع</b>' +
      '<span>' + fmtN(st.total) + " فرصة، كل واحدة في حالة واحدة فقط</span>" +
      (hmEscFailed ? '<span class="s" role="alert">تعذّر قراءة سجل التصعيد.</span>' : "") + "</div>";
    h += '<div class="hm-prail" role="img" aria-label="' + esc("توزيع خط البيع: " +
      st.buckets.map(function (b) { return b.label + " " + fmtN(b.count); }).join("، ")) + '">' +
      st.buckets.map(function (b) {
        var w = st.total ? (b.count / st.total) * 100 : 0;
        return '<i style="width:' + w.toFixed(2) + "%;background:" + (tone[b.key] || "var(--deck-info)") + '"></i>';
      }).join("") + "</div>";
    h += '<div class="hm-keys">' + st.buckets.map(function (b) {
      var off = !b.count;
      return '<button type="button" class="hm-key"' + (off ? " disabled" : "") +
        (off ? "" : ' onclick="hmOpenState(&quot;' + b.key + '&quot;)"') +
        ' title="' + esc(b.hint) + (off ? "" : " — افتح هذه الفرص") + '">' +
        '<em style="background:' + (tone[b.key] || "var(--deck-info)") + '"></em>' +
        "<b>" + fmtN(b.count) + "</b>" + esc(b.label) +
        (b.value ? " · " + hmMoney(b.value) : "") + "</button>";
    }).join("") + "</div></div>";
  }
  return h + "</section>";
}

/* «الأداء التجاري» and «صحة خط البيع» are no longer bands: the deck above carries both, and
   carrying them twice is the page-duplication defect this project has caught three times. What is
   left here is everything the deck does NOT answer. */
function vHomeExecBands() {
  return [
    ["شركاء المبيعات", (hmPtWeek ? "أسبوع " + esc(hmPtWeek) : "الأسبوع الحالي"), vHomePartners(), '<a class="go" href="#partners">عرض التفاصيل ←</a>']
  ];
}
`;
