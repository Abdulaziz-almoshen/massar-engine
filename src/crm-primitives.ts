// crm-primitives.ts — the five things every CRM screen draws, declared once.
//
// WHY THIS EXISTS. A status dot was declared five times across four modules, at three different
// sizes, two of them as inline styles with hardcoded hexes:
//
//   sales-crm.ts:61       .perf-rag .dot   7px, class
//   opps-crm.ts:73        .opline .d       7px, class
//   activity-crm.ts:29    .evt .d          6px, class
//   campaigns-crm.ts:431  inline           6px, hardcoded colour
//   campaigns-crm.ts:591  inline           8px, hardcoded colour
//
// DESIGN.md specifies exactly ONE dot and ONE progress bar. The code had five and two, and the
// inline ones are invisible to a token change: edit the ramp and those screens silently keep the
// old colour. The redesign adds four more screens, so without this the count goes to nine.
//
// Extracted BEFORE those screens are written, not after, because the refactor is strictly cheaper
// when there is nothing yet to migrate. The seven existing modules are deliberately NOT retrofitted
// here: they are shipped and a live pilot is running, and route-level smoke asserts a page is not
// blank, not that it still looks right. Retrofit is its own change with its own evidence.
//
// EVERY VALUE BELOW COMES FROM DESIGN.md. Nothing here may invent a colour, a radius or a size.
// (No backticks anywhere in this file, including in comments: it is one template literal, and a
// backtick terminates it. That has happened four times on this project.)

export const CRM_PRIMITIVES_CSS = `
/* ---- the flush list row. DESIGN.md invariant 8: flush, border-top 1px #E3E9F1, block padding 8,
       gutters 20/12, min-height 36. No card wrapper, no shadow, ever. ---- */
.crm-row{display:flex;align-items:center;gap:12px;min-height:36px;padding-block:8px;
  border-block-start:1px solid var(--line, #E3E9F1)}
.crm-row:first-child{border-block-start:0}
.crm-row .crm-nm{font-weight:600;font-size:14px;min-width:150px}
.crm-row .crm-sub{font-size:12px;color:var(--muted, #536170);font-weight:450}
.crm-row .crm-end{margin-inline-start:auto;display:flex;align-items:center;gap:10px;flex-wrap:wrap;
  justify-content:flex-end}
.crm-row.crm-click{cursor:pointer;transition:background var(--fast) var(--ease)}
.crm-row.crm-click:hover{background:var(--surface)}

/* ---- progress. DESIGN.md invariant 3 lists progress fill among the teal-only uses, and chart
       rule 4 is blunter: teal is the ONLY saturated hue in a chart. A single-hue ramp may encode
       ORDER; it may never encode a second meaning. Status goes on the dot beside the bar. ---- */
.crm-bar{position:relative;height:6px;border-radius:999px;background:var(--line, #E3E9F1);
  flex:1;min-width:56px}
.crm-bar i{position:absolute;inset-block:0;inset-inline-start:0;border-radius:var(--r-pill);display:block;
  background:var(--blue);
  /* A bar grows to its value once. It animates WIDTH because there is no transform equivalent that
     keeps the track's rounded end honest — so it is deliberately a one-shot on paint, never a
     per-frame loop. Under reduced motion the bar is simply already at its value, which is the
     whole point of failure 3: the destination is not optional. */
  transition:width var(--slow) var(--ease)}
/* The pace marker rides ABOVE the fill and must survive both grounds, so it takes the darkest ink
   at full opacity and is allowed to overhang. At .45 over teal it vanished on exactly the rows
   that are ahead of pace, which is the only comparison it exists to make. */
.crm-bar .crm-pace{position:absolute;inset-block:-3px;width:2px;background:var(--ink, #212529)}
.crm-pct{font-size:12px;font-variant-numeric:tabular-nums;min-width:38px;text-align:end;
  color:var(--ink2, #3A3A3A)}

/* ---- state. DESIGN.md invariant 8: row state is a dot plus a label, NEVER a filled chip.
       One size, 7px. The three status hues are the product's shipped ok/warn/bad, not a fourth
       palette: a design review found three invented hexes on the newest screen and replaced them
       with these. Teal is for a neutral or in-progress state, never for good-versus-bad. ---- */
.crm-st{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;
  white-space:nowrap}
.crm-st i{width:7px;height:7px;border-radius:999px;flex:none}
.crm-st.crm-ok{color:#12633F}   .crm-st.crm-ok i{background:#12633F}
.crm-st.crm-warn{color:#7A5600} .crm-st.crm-warn i{background:#7A5600}
.crm-st.crm-bad{color:#8E2A27}  .crm-st.crm-bad i{background:#8E2A27}
.crm-st.crm-none{color:var(--muted, #536170)} .crm-st.crm-none i{background:var(--line2, #CBD7E4)}
.crm-st.crm-teal{color:var(--teal, #306DB5)}  .crm-st.crm-teal i{background:var(--teal, #306DB5)}

/* ---- the number tile. Radius 10 per invariant 7 (cards), strip background per invariant 2.
       crm-lead exists because DESIGN.md list rule 13 says a page must have a point of view:
       one figure leads at the size that says so, the rest support it. ---- */
.crm-kpis{display:grid;grid-template-columns:repeat(4, 1fr);gap:10px;margin-block-end:20px}
.crm-kpis.crm-hasLead{grid-template-columns:1.5fr 1fr 1fr 1fr}
.crm-kpi{background:var(--surface);border-radius:var(--r-md);padding:13px 15px;
  transition:box-shadow var(--base) var(--ease), transform var(--base) var(--ease)}
/* interior.dev: a hover lift is a promise that the thing is clickable. A tile that only reports a
   number does not get one — DESIGN.md forbids decoration that carries no data. */
.crm-kpi.crm-click{cursor:pointer}
.crm-kpi.crm-click:hover{box-shadow:var(--sh-3);transform:translateY(-2px)}
.crm-kpi.crm-lead{background:#EAF1F8}
.crm-kpi .crm-k{font-size:12px;color:var(--muted, #536170);font-weight:600}
.crm-kpi .crm-v{font-size:22px;font-weight:600;margin-block-start:3px;letter-spacing:0;
  font-variant-numeric:tabular-nums}
.crm-kpi.crm-lead .crm-v{font-size:28px}
.crm-kpi .crm-s{font-size:12px;color:var(--muted, #536170);margin-block-start:2px}

/* ---- table. Same flush idiom as the row, for the cases that genuinely need columns. Logical
       properties only: a physical padding-right lands correctly here ONLY because the document is
       RTL, and flips the moment anything renders LTR. ---- */
.crm-tbl{width:100%;border-collapse:collapse;font-size:14px}
.crm-tbl th{text-align:start;font-size:12px;font-weight:600;color:var(--muted, #536170);
  padding-inline-end:12px;padding-block-end:8px;white-space:nowrap;
  border-block-end:1px solid var(--line2, #CBD7E4)}
.crm-tbl td{padding-inline-end:12px;border-block-start:1px solid var(--line, #E3E9F1);
  height:36px;vertical-align:middle}
.crm-tbl tr:hover td{background:var(--strip, #F4F6F9)}
.crm-tbl .crm-money{text-align:end;font-variant-numeric:tabular-nums;white-space:nowrap}
.crm-scroll{overflow-x:auto}

/* ---- the honest empty state. A screen with nothing in it still has to say why, because an empty
       grid and a broken query look identical to the reader. ---- */
.crm-empty{padding:26px 4px;color:var(--muted, #536170);font-size:14px;max-width:58ch;
  line-height:1.6}
.crm-empty b{display:block;color:var(--ink, #212529);font-size:14px;margin-block-end:5px}

/* ---- focus. Every control on a new screen is expected to pick this up; the product's older
       focus-ring list lives in campaigns-crm and had to be extended by hand for each new class,
       which is how the performance screen shipped with Chromium's default blue. ---- */
.crm-focusable:focus{outline:none}
.crm-focusable:focus-visible{outline:2px solid var(--blue);outline-offset:1px}
/* interior.dev failure 1, "the button jumps": a control whose label changes between states must
   reserve the widest state up front. Set --w to the longest label's width and the row beneath it
   never moves when «حفظ» becomes «جارٍ الحفظ». */
.crm-hold{display:inline-flex;align-items:center;justify-content:center;min-width:var(--w,auto);
  transition:background var(--fast) var(--ease), color var(--fast) var(--ease)}

@media (pointer:coarse){
  .crm-focusable{min-height:44px}
}

/* T2. Measured at 390px before this existed: four KPI tiles at 73.7px each, labels wrapping to
   four lines. repeat(4,1fr) does not become responsive by being asked nicely.
   The breakpoint VALUE is written literally because a media query cannot read a custom property —
   @media (max-width: var(--bp-sm)) is invalid CSS. DESIGN.md 2 remains the source of the number;
   this is its only legal transcription. 560 = --bp-sm. */
@media (max-width:560px){
  .crm-kpis, .crm-kpis.crm-hasLead{grid-template-columns:repeat(2,1fr)}
  .crm-row{flex-wrap:wrap}
  .crm-row .crm-end{margin-inline-start:0;width:100%;justify-content:flex-start}
  .crm-row .crm-nm{min-width:0}
}
`;
