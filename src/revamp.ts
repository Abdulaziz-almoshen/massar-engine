// revamp.ts — the V3 shell and component language.
//
// WHY A LATE-CASCADE MODULE AND NOT A REWRITE IN PLACE. dashboard.ts is a 4,400-line template
// literal under ADR-0001: anchored replacements only, never range edits. The V3 geometry touches
// the shell, the rail, the header, every card, every table and every button — that is hundreds of
// rules. Rewriting them in place is hundreds of chances to delete a helper and ship a blank page.
// This module is injected LAST, so it wins on cascade order and the old rules stay as the fallback
// if a selector here ever stops matching. A revamp that cannot ship a blank page is worth the
// specificity cost.
//
// WHAT IT IMPLEMENTS. The two references the founder chose: Pillio for the overview surfaces (a
// floating rail, one accent-gradient hero tile, cards on a tinted canvas) and the AI-Manager leads
// dashboard for the list surfaces (a real table, outlined status pills, per-row quick actions, KPI
// cards with a delta chip). Both are re-authored for RTL and for ledger density.
//
// THE RULES THIS FILE OBEYS, because the gate enforces them:
//   - colours are var() only. A raw hex here is a colour nobody measured (check-design gate 22).
//   - font-size comes off the ladder: 12/14/16/18/22/28/40/44. Nothing else compiles past the gate.
//   - z-index is a token, never an integer.
//   - logical properties only. No left/right, no physical offsets — the document flips.
//   - NO BACKTICKS ANYWHERE IN THIS FILE, comments included.

export const REVAMP_CSS = `
/* ============================ 1. THE SHELL ============================
   The page is a tinted canvas and the rail floats on it, inset, with its own radius. That single
   change is most of what separates V3 from the flush admin panel it replaces. */
body { background: var(--canvas); }
.app { background: var(--canvas); gap: var(--s3); padding: var(--s3); }

/* THE RAIL IS NAVY (founder, 2026-09-16). His prototype runs a navy gradient rail with grouped
   labels and a gold-tinted active row; Massar shipped the white version of it and he rejected the
   result twice. A white rail on a white-card page gives the app no spine — every surface is the
   same value, so nothing frames anything. Values and their measured ratios: DESIGN.md §2, "The
   rail". */
aside {
  width: 244px;
  background: linear-gradient(180deg, var(--rail-1), var(--rail-2));
  color: var(--rail-ink);
  border: none;
  border-radius: var(--r-lg);
  box-shadow: none;
  overflow: hidden;
}

/* The brand block stops being a bordered strip and becomes part of the panel. */
.switcher { height: 60px; padding: 12px 14px; border-bottom: none; border-radius: var(--r-lg); color: var(--rail-on-ink); }
.switcher:hover { background: var(--rail-hover); }
.switcher .logo { width: 32px; height: 32px; border-radius: var(--r-sm); background: var(--grad); }
.switcher .t1 { font-weight: 600; color: var(--rail-on-ink); }
.switcher .t2, .switcher .chev { color: var(--rail-ink); }

/* Search leaves the rail on wide screens (it becomes the top bar's anchor, see section 2) and
   stays here on narrow ones, where there is no top bar to hold it. */
.navsearch {
  height: 40px; border-radius: var(--r-md); border: none;
  background: var(--rail-hover); color: var(--rail-ink);
}
.navsearch:hover { background: rgba(255,255,255,.14); border-color: transparent; color: var(--rail-on-ink); }
.navsearch kbd { background: rgba(255,255,255,.14); color: var(--rail-ink); border-color: transparent; border-radius: var(--r-sm); }
.navsearch svg { color: var(--rail-ink); }

nav { padding: var(--s2) 10px; }
/* The group heading is the prototype's: small, heavy, tracked, and the one place a positive
   letter-spacing is legal on Latin-free Arabic — it reads as a divider, not as a label. */
.grp { font-size: var(--t-xs); font-weight: 700; color: var(--rail-grp); letter-spacing: .6px;
  padding: 15px 12px 8px; }

/* The active row is a GOLD tint, not a blue one. The rail is already blue: a blue selection on a
   blue ground has nothing to be selected against, which is why the white-rail version needed the
   accent tint and this one does not. */
.nv {
  height: 42px; border-radius: 10px; padding-inline: 12px; gap: 12px;
  font-weight: 500; color: var(--rail-ink); margin-bottom: 2px;
  transition: background var(--fast) var(--ease), color var(--fast) var(--ease);
}
.nv:hover { background: var(--rail-hover); color: var(--rail-on-ink); }
.nv.on { background: var(--rail-on-bg); color: var(--rail-on-ink); font-weight: 700; }
.nv .gx > * { background-color: var(--rail-ink); border-color: var(--rail-ink); }
.nv.on .gx > * { background-color: var(--rail-on-ink); border-color: var(--rail-on-ink); }
.nv .g-tr { background: none; border-bottom-color: var(--rail-ink); }
.nv.on .g-tr { background: none; border-bottom-color: var(--rail-on-ink); }
.nv:focus-visible { outline: 2px solid var(--rail-on-ink); outline-offset: -2px; }
.nv .bdg { background: rgba(255,255,255,.16); color: var(--rail-on-ink); }

.collapse { height: 40px; border-radius: var(--r-md); color: var(--rail-ink); }
.collapse:hover { background: var(--rail-hover); color: var(--rail-on-ink); }
.userbox { color: var(--rail-ink); border-block-start-color: rgba(255,255,255,.14); }
.userbox .u1 { color: var(--rail-on-ink); }

/* ============================ 2. THE TOP BAR ============================
   The crumb strip becomes the page's own header: taller, on the canvas rather than on white, with
   no rule under it. The card below it is what separates header from content now. */
main { background: transparent; }
header.crumb {
  height: 56px; background: transparent; border-bottom: none;
  padding-inline: var(--s1); gap: 10px;
}
header.crumb .t { font-weight: 700; }
header.crumb .sep { color: var(--line); }

/* The subnav becomes a row of pills on the canvas instead of an underlined tab strip on white.
   The sliding indicator is retired here: a pill that moves and a bar that moves are two answers to
   the same question, and DESIGN.md 5 says the active item is one or the other, never both. */
.subnav {
  height: auto; background: transparent; border-bottom: none;
  padding: 0 var(--s1) var(--s3); gap: var(--s2);
}
.subnav .sub {
  height: 36px; padding-inline: 14px; border-radius: var(--r-sm);
  background: var(--paper); color: var(--muted); font-weight: 600;
  border: 1px solid var(--line);
  transition: background var(--fast) var(--ease), color var(--fast) var(--ease);
}
.subnav .sub:hover { background: var(--accent-wash); color: var(--ink); }
.subnav .sub.on { background: var(--accent-tint); color: var(--accent-deep); font-weight: 700; }
.subnav .ind { display: none; }
@media (pointer:coarse) { .subnav .sub { min-height: 44px; } }

.body { padding: var(--s1) var(--s1) var(--s6); }

/* ============================ 3. SURFACES ============================
   Every bordered box becomes a shadowed card on the canvas. The border is what made the old build
   read as an admin panel; --line at 1.48:1 was never carrying information anyway. */
.card, .kpi, .hero, .panel {
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  background: var(--paper);
  box-shadow: none;
}
.card { padding: var(--s4); }
.kpis { gap: var(--s3); margin-bottom: var(--s3); }

/* The KPI card, in the AI-Manager grammar: a circular glyph, a delta chip on the far inline-end,
   then the label and the figure. The chip is colour PLUS an arrow PLUS a word, because
   DESIGN.md 3.0b forbids colour as the only channel. */
.kpi { padding: var(--s3); gap: 0; }
.kpi .k { font-size: 12px; font-weight: 600; color: var(--muted); margin-block-start: 12px; }
.kpi .v { font-size: 28px; font-weight: 700; margin-block-start: 2px; letter-spacing: 0; }
.kpi .dl { font-size: 12px; color: var(--muted); margin-block-start: 4px; }

.rv-krow { display: flex; align-items: center; }
.rv-ci {
  width: 38px; height: 38px; border-radius: var(--r-pill); flex: none;
  background: var(--surface); color: var(--ink-2);
  display: flex; align-items: center; justify-content: center;
}
.rv-delta {
  margin-inline-start: auto; display: inline-flex; align-items: center; gap: 4px;
  border-radius: var(--r-pill); padding: 4px 10px; font-size: 12px; font-weight: 700;
  background: var(--s-issued-soft); color: var(--s-issued-text);
}
.rv-delta.dn { background: var(--s-fail-soft); color: var(--s-fail-text); }
.rv-delta.flat { background: var(--s-off-soft); color: var(--s-off-text); }

/* ---- the hero tile: the ONE gradient surface on a screen ----
   Its area encodes the leading figure. Both gradient stops carry white text legally (7.60:1 and
   4.86:1) — the reference's own lighter ramp does not, which is why ours is darkened. */
.hero { background: var(--paper); box-shadow: var(--sh-0); }
.rv-hero {
  background: var(--accent); color: var(--paper);
  border-radius: var(--r-lg); padding: var(--s4);
  box-shadow: none;
  display: flex; flex-direction: column;
}
.rv-hero .k { font-size: 12px; font-weight: 600; color: var(--paper); opacity: .88; }
.rv-hero .v {
  font-size: 44px; font-weight: 700; line-height: 1.1; letter-spacing: 0;
  font-variant-numeric: tabular-nums; display: flex; align-items: baseline; gap: 8px;
  margin-block-start: var(--s2);
}
.rv-hero .v small { font-size: 18px; font-weight: 600; opacity: .85; }
.rv-hero .s { font-size: 14px; font-weight: 500; color: var(--paper); opacity: .9; margin-block-start: 4px; }

/* ---- the progress bar, and the hatch that means NOT YET ----
   Hatch is a texture channel on top of colour, so a remainder reads as unfilled even in greyscale.
   The fill grows from the inline-start, which flips with the document. */
.rv-bar {
  height: 14px; border-radius: var(--r-pill); overflow: hidden;
  display: flex; margin-block-start: var(--s3);
  background: rgba(255,255,255,.24);
}
.rv-bar i { display: block; height: 100%; border-radius: var(--r-pill); background: var(--paper); }
.rv-bar .rest { flex: 1; }
.rv-hatch {
  background-image: repeating-linear-gradient(115deg,
    rgba(255,255,255,.85) 0 3px, rgba(255,255,255,.12) 3px 8px);
}
.rv-hatch-g {
  background-color: var(--surface);
  background-image: repeating-linear-gradient(115deg,
    var(--surface-2) 0 3px, transparent 3px 7px);
}

/* ============================ 4. TABLES ============================
   The list surfaces stay TABLES, not stacks of cards. DESIGN.md 3.6, as amended: a row may be a
   card only where the surface shows at most 12 rows at once. The leads list, the campaign list and
   the opportunity list can all exceed that, so they keep a header row and hairline dividers. */
.thead {
  background: var(--surface); border-bottom: none;
  font-size: 12px; font-weight: 700; color: var(--muted);
  padding: 12px var(--s4);
}
.trow {
  border-bottom: 1px solid var(--line-soft);
  padding: 14px var(--s4);
  transition: background var(--fast) var(--ease);
}
.trow:hover { background: var(--accent-wash); }

/* The panel that wraps a table: the radius belongs to the wrapper, never to the row. */
.rv-panel {
  background: var(--paper); border: 1px solid var(--line);
  border-radius: var(--r-lg); box-shadow: none; overflow: hidden;
}
.rv-panel .rv-ph {
  display: flex; align-items: center; gap: 10px; padding: var(--s3) var(--s4) 14px;
}
.rv-panel .rv-ph b { font-size: 16px; font-weight: 700; color: var(--ink); }
.rv-panel .rv-tools { margin-inline-start: auto; display: flex; gap: var(--s2); }
.rv-iconbtn {
  width: 34px; height: 34px; border-radius: var(--r-pill); border: none;
  background: var(--surface); color: var(--ink-2);
  display: flex; align-items: center; justify-content: center; cursor: pointer;
  font-family: inherit; font-size: 14px;
  transition: background var(--fast) var(--ease);
}
.rv-iconbtn:hover { background: var(--accent-tint); color: var(--accent-deep); }
.rv-iconbtn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
/* DESIGN.md 3.10: the visual mark stays 34px, the HIT AREA reaches 44px on a coarse pointer.
   Grown with a pseudo-element so the button does not change size on a phone. */
@media (pointer:coarse) {
  .rv-iconbtn { position: relative; }
  .rv-iconbtn::after { content: ""; position: absolute; inset: -5px; border-radius: var(--r-pill); }
}
.rv-foot {
  display: flex; align-items: center; padding: 14px var(--s4);
  color: var(--muted); font-size: 12px; font-weight: 600;
  border-top: 1px solid var(--line-soft);
}
.rv-foot .end { margin-inline-start: auto; }

/* ---- filter chips: counts of work OWED, never totals (DESIGN.md 7.10) ---- */
.rv-filters { display: flex; gap: var(--s2); flex-wrap: wrap; padding: 0 var(--s4) 14px; }
.rv-fchip {
  background: var(--surface); border: none; border-radius: var(--r-pill);
  padding: 8px 14px; font-family: inherit; font-size: 12px; font-weight: 600;
  color: var(--ink-2); cursor: pointer;
  transition: background var(--fast) var(--ease), color var(--fast) var(--ease);
}
.rv-fchip:hover { background: var(--accent-wash); }
.rv-fchip.on { background: var(--accent-tint); color: var(--accent-deep); font-weight: 700; }
.rv-fchip:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
@media (pointer:coarse) { .rv-fchip { min-height: 44px; } }

/* ---- the outlined status pill: colour + dot + word, three channels ----
   white-space:nowrap is not cosmetic. interior.dev failure 1 is a control that resizes between
   states; a pill that wraps to two lines moves every row under it. */
.rv-pill {
  display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;
  border-radius: var(--r-pill); padding: 4px 12px;
  font-size: 12px; font-weight: 700; background: var(--paper);
}
.rv-pill i { width: 7px; height: 7px; border-radius: var(--r-pill); flex: none; }
.rv-pill.ok   { color: var(--s-issued-text); box-shadow: inset 0 0 0 1.5px var(--s-issued); }
.rv-pill.ok i { background: var(--s-issued); }
.rv-pill.warn   { color: var(--s-attn-text); box-shadow: inset 0 0 0 1.5px var(--s-attn-mark); }
.rv-pill.warn i { background: var(--s-attn-mark); }
.rv-pill.bad   { color: var(--s-fail-text); box-shadow: inset 0 0 0 1.5px var(--s-fail); }
.rv-pill.bad i { background: var(--s-fail); }
.rv-pill.acc   { color: var(--accent-deep); box-shadow: inset 0 0 0 1.5px var(--accent-mark); }
.rv-pill.acc i { background: var(--accent-mark); }
.rv-pill.off   { color: var(--s-off-text); box-shadow: inset 0 0 0 1.5px var(--s-off-mark); }
.rv-pill.off i { background: var(--s-off-mark); }

/* ---- the seriousness meter: an EARNED number, drawn ----
   Ten cells so the count is readable by looking. The band label is the second channel; the number
   is the third. A meter that only reads after animating is a meter that never reads under
   prefers-reduced-motion, so it is correct at rest. */
.rv-meter { display: flex; gap: 2px; margin-block-start: 6px; height: 6px; }
.rv-meter i { flex: 1; border-radius: 2px; background: var(--surface-2); }
.rv-meter i.f { background: var(--accent-mark); }
.rv-meter i.f.hi { background: var(--accent-deep); }
.rv-score { display: flex; align-items: baseline; gap: 6px; }
.rv-score b { font-size: 16px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: 0; }
.rv-score small { font-size: 12px; color: var(--muted); font-weight: 600; }
.rv-score span { font-size: 12px; font-weight: 700; }

/* ============================ 5. CONTROLS ============================ */
.btn {
  border-radius: var(--r-sm); height: 38px; padding-inline: 16px;
  font-weight: 600; box-shadow: none;
  transition: background var(--fast) var(--ease), box-shadow var(--fast) var(--ease);
}
@media (pointer:coarse) { .btn { min-height: 44px; } }
.btn-teal { background: var(--accent); box-shadow: none; }
.btn-teal:hover { background: var(--accent-press); filter: none; }
.btn-dark { background: var(--ink); }
.btn-dark:hover { filter: none; background: var(--ink-2); }
.btn-ghost { background: var(--paper); border: 1px solid var(--line); box-shadow: none; color: var(--ink); }
.btn-ghost:hover { background: var(--accent-wash); filter: none; }
.btn-dis { background: var(--s-off-soft); color: var(--s-off-text); box-shadow: none; }
/* DESIGN.md 3.8, measured: an accent ring on the accent button is 1.00:1 — invisible. On any
   ground where the ring falls under 3:1 it INVERTS to paper plus a halo. This is the rule that a
   previous system shipped wrong for three weeks. */
.btn-teal:focus-visible, .btn-dark:focus-visible {
  outline: 2px solid var(--paper); outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(37,99,235,.35);
}
.btn-ghost:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.chip { border-radius: var(--r-pill); }

/* ============================ 5b. THE SEHA COMPONENT SET, RE-SKINNED ============================
   These classes already carry the product's layout. Re-skinning them here is what makes the
   revamp reach every screen at once instead of screen by screen. */

.sh-tiles { gap: var(--s3); }
.sh-tile { border-radius: var(--r-lg); box-shadow: none; border: 1px solid var(--line); padding: var(--s3) var(--s4); }
.sh-tile.go:hover { box-shadow: var(--sh-1); border-color: transparent; }

/* THE hero. One gradient surface per screen, and it is the tile carrying the leading figure —
   which is exactly what .lead already means, so the marker did not have to be invented. */
.sh-tile.lead {
  background: var(--accent);
  box-shadow: none;
  border: 1px solid var(--accent);
}
/* The lead tile STACKS. .sh-tile is a two-column grid (label | figure), which is right for a
   28px supporting figure and wrong for a 44px leading one: the figure gets squeezed and the label
   wraps beside it. The hero gets the whole width for its number. */
.sh-tile.lead { grid-template-columns: 1fr; gap: var(--s2); align-items: start; }
.sh-tile.lead .k, .sh-tile.lead .s { color: var(--paper); opacity: .88; }
.sh-tile.lead .v {
  color: var(--paper); font-size: 44px; justify-self: start; line-height: 1.1;
}
.sh-tile.lead.go:hover { box-shadow: var(--sh-3); }

.sh-card { border-radius: var(--r-md); box-shadow: none; border: 1px solid var(--line); padding: var(--s3) var(--s4); }
.sh-card.go:hover { box-shadow: var(--sh-1); border-color: transparent; transform: translateY(-1px); }
.sh-sec { border-radius: var(--r-lg); }
.sh-empty { border-radius: var(--r-lg); }
.sh-table { border-radius: var(--r-lg); overflow: hidden; }

/* The CRM primitives: same treatment, so the list screens match the boards. */
.crm-kpis { gap: var(--s3); }
.crm-kpi { border: 1px solid var(--line); border-radius: var(--r-lg); box-shadow: none; }
.crm-tbl { border: 1px solid var(--line); border-radius: var(--r-lg); box-shadow: none; overflow: hidden; }
.crm-row { border-bottom: 1px solid var(--line-soft); }
.crm-row:hover { background: var(--accent-wash); }
.crm-bar { border-radius: var(--r-pill); }
.crm-empty { border-radius: var(--r-lg); }

/* ---- FIELDS ----
   The first pass made .inp a filled --surface box with no border. That works on white and
   DISAPPEARS on a tinted panel: .opexp is --surface too, so on the opportunity editor the fields
   were invisible — four bare numbers floating with no affordance at all. A field must be visible
   on EVERY ground it can land on, so it carries its own ring rather than borrowing contrast from
   the page. --s-off-mark is 3.69:1 on paper, which clears the 3:1 non-text floor a control border
   has to meet; --line at 1.48:1 does not and is why the ring is not drawn in it. */
.inp {
  background: var(--paper);
  border: none;
  box-shadow: inset 0 0 0 1px var(--s-off-mark);
  border-radius: var(--r-sm);
  min-height: 38px; padding-inline: 12px;
  color: var(--ink);
  transition: box-shadow var(--fast) var(--ease);
}
.inp::placeholder { color: var(--muted); }
.inp:hover { box-shadow: inset 0 0 0 1px var(--ink-2); }
.inp:focus, .inp:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 2px var(--accent), 0 0 0 3px var(--accent-tint);
}

/* The opportunity line editor that lived here was retired by the V5 ledger (opps-crm.ts owns its
   own drawer styles now). */

/* ---- truncation is not layout ----
   DESIGN.md 6.5 says a label you truncate is a label you did not draw, and the campaign list was
   proving it: «حملة سجل التطعي…» and «حملة الإجازات المر…» are the same string to a reader
   scanning the column. Two lines and a clamp beat one line and an ellipsis — the name is the only
   thing in the row that identifies the row. Applied late so it overrides the inline styles the
   list emits per cell. */
.trow [style*="text-overflow"],
.crow [style*="text-overflow"],
.crow .c-meta .c-prod {
  white-space: normal !important;
  text-overflow: clip !important;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.35;
}

/* ---- the ACTION ROW ----
   The most distinctive control in the reference: a full-width bar on --accent-tint carrying an
   accent-coloured label and icon. It sits between a primary button (too loud, and there is only
   one per screen) and a text link (too quiet for an action that adds a thing). Used for
   add/manage: «إضافة موقع», «إضافة خدمة», «إدارة الطلب».
   The label measures 6.88:1 on its own bar, so it is a legal text ground, not decoration. */
.rv-actionrow {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; min-height: 40px; padding: 10px 14px;
  background: var(--accent-bar); color: var(--accent-deep);
  border: none; border-radius: var(--r-sm);
  font-family: inherit; font-size: 14px; font-weight: 600;
  cursor: pointer; text-decoration: none;
  transition: background var(--fast) var(--ease);
}
.rv-actionrow:hover { background: var(--accent-bar-hover); }
.rv-actionrow:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.rv-actionrow[disabled], .rv-actionrow.dis {
  background: var(--s-off-soft); color: var(--s-off-text); cursor: not-allowed;
}
/* A destructive action never gets the accent bar. It is a text action in the failure colour, with
   a glyph, so colour is not the only channel (DESIGN.md 3.0b). */
.rv-actionrow.dngr { background: var(--s-fail-soft); color: var(--s-fail-text); }
.rv-actionrow.dngr:hover { background: var(--s-fail-soft); filter: brightness(.97); }
@media (pointer:coarse) { .rv-actionrow { min-height: 44px; } }

/* ---- collapsible section header ----
   The reference groups a long record into named sections that collapse. The chevron rotates rather
   than swapping glyphs, so the control never changes size (DESIGN.md 8.1 failure 1), and the body
   animates on grid-template-rows like every other accordion in this product (motion.ts, .mo-acc). */
.rv-sec { border-block-start: 1px solid var(--line-soft); }
.rv-sec:first-child { border-block-start: none; }
.rv-sechead {
  display: flex; align-items: center; gap: 10px; width: 100%;
  padding: 14px 0 12px; background: none; border: none; cursor: pointer;
  font-family: inherit; font-size: 16px; font-weight: 700; color: var(--ink);
  text-align: start;
}
.rv-sechead .cv {
  margin-inline-start: auto; color: var(--muted); flex: none;
  transition: transform var(--base) var(--ease);
}
.rv-sechead[aria-expanded="false"] .cv { transform: rotate(-90deg); }
[dir="ltr"] .rv-sechead[aria-expanded="false"] .cv { transform: rotate(90deg); }
.rv-sechead:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.rv-secbody { display: grid; grid-template-rows: 1fr; transition: grid-template-rows var(--base) var(--ease); }
.rv-secbody > div { overflow: hidden; min-height: 0; }
.rv-sec.closed .rv-secbody { grid-template-rows: 0fr; }

/* ---- the field label, matching the reference's stacked form ---- */
.rv-field { display: flex; flex-direction: column; gap: 6px; margin-block-end: var(--s3); }
.rv-field > label { font-size: 12px; font-weight: 600; color: var(--muted); }

/* ---- inline text links reach the 24px floor ----
   The audit found «الكل ←» at 37x17 and a note title at 39x17. DESIGN.md 3.10's 24px applies to
   EVERY pointer, not just touch, and an inline link is still a target. Padding grows the hit area;
   the type is untouched. */
/* .m-item is excluded because it is not an inline text link — it is a full-width LIST ROW, already
   far above the 24px floor this rule exists to enforce. The selector carries four :not() classes,
   so it scores (0,5,1) and beat «.ds6 .m-item {display:flex}» at (0,2,0): every list row that
   happened to be a link rendered shrink-to-fit, and two of them sat side by side on one line on
   the product record. Excluding the component is the fix; winning a specificity war is not. */
a[href]:not(.btn):not(.rv-actionrow):not(.nv):not(.sub):not(.m-item) {
  display: inline-flex; align-items: center; min-height: 24px;
}

/* ---- CHECKBOXES: a drawn control with a real hit area ----
   The audit measured 32 interactive elements under the 24x24 floor DESIGN.md 3.10 sets for EVERY
   pointer, across six screens. Almost all were native 16x16 checkboxes in list rows.

   A native checkbox cannot be padded reliably (it is a replaced element), so the box is drawn:
   the input becomes a 24x24 transparent target and its ::before paints a 17px mark inside. The
   VISUAL size is unchanged — DESIGN.md 3.10 is explicit that the hit area grows, not the mark —
   and the control finally answers to the accent instead of the browser's default blue. */
input[type="checkbox"] {
  appearance: none; -webkit-appearance: none;
  width: 24px; height: 24px; margin: 0; flex: none;
  display: inline-grid; place-content: center;
  background: transparent; border: none; cursor: pointer;
}
input[type="checkbox"]::before {
  content: ""; width: 17px; height: 17px; border-radius: 5px;
  background: var(--paper); box-shadow: inset 0 0 0 1.5px var(--s-off-mark);
  transition: background var(--fast) var(--ease), box-shadow var(--fast) var(--ease);
}
input[type="checkbox"]:hover::before { box-shadow: inset 0 0 0 1.5px var(--ink-2); }
input[type="checkbox"]:checked::before {
  background: var(--accent); box-shadow: inset 0 0 0 1.5px var(--accent);
}
/* The tick is drawn, not a glyph: a font that lacks it would render a box. It WAS drawn as two
   crossing gradient bands, which rendered an X — «remove», on every selected row in the product
   (caught by the V5 design sign-off, 2026-09-12). Now an L of two borders rotated 45deg: a real
   check, which is not mirrored in RTL because a tick is not directional text. */
input[type="checkbox"] { place-items: center; }
input[type="checkbox"]::before, input[type="checkbox"]::after { grid-area: 1 / 1; }
input[type="checkbox"]::after {
  content: ""; width: 5px; height: 9px; margin-block-start: -2px;
  border: solid var(--paper); border-width: 0 2px 2px 0;
  transform: rotate(45deg) scale(0); transition: transform var(--fast) var(--ease);
}
input[type="checkbox"]:checked::after { transform: rotate(45deg) scale(1); }
input[type="checkbox"]:focus-visible { outline: none; }
input[type="checkbox"]:focus-visible::before {
  box-shadow: inset 0 0 0 1.5px var(--accent), 0 0 0 3px var(--accent-tint);
}
/* The cell the box sits in stops being a 22px strip. */
.selcell { min-height: 24px; display: flex; align-items: center; }

/* ============================ 6. RESPONSIVE ============================
   Not "stacked on mobile". Each viewport gets a decision. */
@media (max-width: 900px) {
  .app { padding: var(--s2); gap: var(--s2); }
  aside { border-radius: var(--r-lg); }
  header.crumb { height: 48px; }
  .body { padding-block-end: var(--s5); }
  .kpis { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 560px) {
  .app { padding: 0; gap: 0; }
  aside { border-radius: 0; box-shadow: none; }
  .card { padding: var(--s3); }
  .kpis { grid-template-columns: 1fr; }
  .rv-hero .v { font-size: 28px; }
}

/* ============================ 7. THE UNSEEN DETAILS ============================
   Every rule here fixes something no reader will ever name, and every one of them is felt. They
   are declared once, on the shared primitives, so they reach every screen rather than the screen
   whose turn it was.

   7.1 PRESS. A control that does not move when pressed does not feel like it heard you. Every
   pressable thing gets scale(0.97) at 140ms — under the 160ms button-feedback bound, and applied
   to TRANSFORM only so it stays off the layout and paint path. */
.btn, .sh-tile.go, .sh-card.go, .crm-kpi.crm-click {
  transition: transform 140ms var(--ease), filter var(--fast) var(--ease),
              box-shadow var(--base) var(--ease), border-color var(--base) var(--ease);
}
.btn:not([disabled]):active { transform: scale(0.97); }
.sh-card.go:active, .sh-tile.go:active, .crm-kpi.crm-click:active { transform: scale(0.98); }

/* 7.2 HOVER IS NOT A TAP. .btn:hover was unguarded, so on a phone every tap left the button
   sitting in its hover state until something else was touched. Hover belongs to a real pointer. */
.btn:hover { filter: none; }
@media (hover: hover) and (pointer: fine) {
  .btn:not([disabled]):hover { filter: brightness(.97); }
}

/* 7.3 EVERY EDGE IS A RING, NEVER A BORDER (beautifului.dev, adopted whole 2026-09-16).
   «0 0 0 1px» inside the shadow occupies no layout: a surface that gains or loses an edge never
   moves its neighbours, and nested surfaces never double their hairlines. The card shadow is six
   stops at 1-3% ink — invisible one at a time, air as a stack. The single «0 4px 12px» it replaces
   is exactly what read as "old style".
   border-color: transparent, not «border:0» — removing the border would collapse every box by
   2px and reflow six screens. */
.card, .sh-tile, .sh-card, .sh-empty, .crm-kpi, .crm-tbl, .kcard, .hm-kpi, .hm-st, .hm-pt {
  border-color: transparent;
  box-shadow: var(--shadow-card);
  border-radius: var(--r-win);
}
/* The radius ladder is concentric: a chip inside a control inside a card inside a window. */
.chip, .crm-st, .px-chip, .kd { border-radius: var(--r-pill); }
.btn, .inp, .navsearch { border-radius: var(--r-ctl); }
/* One KPI family on الرئيسية. The campaign strip and the executive tiles were two card designs on
   one page — same job, same size, different weight, different padding — which is the reader having
   to learn the page twice. */
.kcard { border-radius: var(--r-lg); padding: var(--s4); }
.kcard .kk { font-weight: 500; }
.kcard .kv { letter-spacing: 0; font-variant-numeric: tabular-nums; }
/* The hero is a solid accent surface: a white highlight on it would be a seam, not a light. */
.sh-tile.lead { box-shadow: none; }

/* 7.3b THE BAR IS THE MOST-DRAWN OBJECT IN MASSAR — coverage, attainment, readiness, quarters,
   partner weeks, pipeline share. Every one of them was a flat grey rectangle with a flat blue
   rectangle inside it. A track is a groove: it takes the recessed ring. A fill is a face: it takes
   the one-pixel specular. Nothing about the data changes; the object stops looking printed. */
.crm-bar, .hm-meter, .hm-sh, .hm-split, .sh-stack, .px-qc .trk, .px-hi .meter,
.kh-meter .bar, .yt-qc .bar, .kb-meter .track, .pc-qc .trk {
  box-shadow: var(--well);
}
.crm-bar i, .hm-meter i, .hm-sh i, .hm-split i, .sh-stack i, .px-qc .trk i, .px-hi .meter i,
.kh-meter .bar i, .yt-qc .bar i, .kb-meter .track i, .pc-qc .trk i {
  box-shadow: var(--fill-face);
}

/* 7.4 NUMBERS ARE A COLUMN, NOT A SENTENCE. Proportional digits make a stack of figures ragged and
   make a changing figure jump. Tabular everywhere a figure is drawn, once. */
.sh-tile .v, .sh-card .money, .crm-kpi .crm-v, .crm-pct, .crm-tbl .crm-money {
  font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1;
}

/* 7.5 THE FOCUS RING IS NOT OPTIONAL. Any pressable element that never declared one picks this up,
   rather than inheriting Chromium's default blue on a blue button. interior.dev's shape: an INSET
   ring plus a 6% wash, so focusing something never changes its box and never overlaps its neighbour
   the way an outset ring on a flush row does. */
.sh-tile.go:focus-visible, .sh-card.go:focus-visible, .crm-kpi.crm-click:focus-visible,
.crm-row.crm-click:focus-visible {
  outline: none; background: var(--accent-wash);
  box-shadow: inset 0 0 0 2px var(--accent), var(--specular);
}

/* 7.6 A COARSE POINTER NEEDS 44px. DESIGN.md 3.10, applied where the query actually requires it. */
@media (pointer: coarse) {
  .btn { min-height: 44px; }
}

/* 7.7 THE PAGE IS WHITE (founder, 2026-09-16). It was a tinted canvas carrying a 45-degree hairline
   weave, which existed to stop white cards floating on flat grey. Direction A removed the reason:
   below the deck there are no cards at all, just ruled rows, so the page can be one white plane and
   the hairlines between rows do the dividing. The weave on a white ground would be visible texture
   for its own sake, so it goes with the tint — decoration that carries no data. */
body, .app {
  background-color: var(--paper);
  background-image: none;
}
/* The rail is a surface ON the weave and covers it. The CONTENT column must not: it is the page,
   and it is where the weave does its work — behind the cards, between them, in every gutter. It
   stays transparent so the fixed weave on .app shows through while the column scrolls over it. */
/* The rail paints its own navy gradient (section 1) — it must not be given the weave or a ground. */
aside { background-image: linear-gradient(180deg, var(--rail-1), var(--rail-2)); background-color: var(--rail-2); }
.body { background-color: transparent; }

/* 7.8 THE PRIMARY BUTTON IS A PRESSED OBJECT. A flat blue rectangle with a soft drop shadow is the
   default every framework ships. A sub-pixel dark rim plus a complete inner white ring reads as a
   bevel from every side, and costs nothing: no layout, no extra element, no colour token. */
.btn-teal, .btn-dark {
  box-shadow: 0 0 0 .5px rgba(20,22,26,.55), inset 0 0 0 1px rgba(255,255,255,.16);
}
.btn-teal:focus-visible, .btn-dark:focus-visible {
  box-shadow: 0 0 0 .5px rgba(20,22,26,.55), inset 0 0 0 1px rgba(255,255,255,.16),
              0 0 0 3px rgba(37,99,235,.45);
}

/* 7.9 A CARD'S SHADOW IS SIX NEARLY-INVISIBLE LAYERS, NOT ONE. Each stop is at 1–3% ink; alone
   none of them is visible, and the stack reads as air under the card. Collapsing them into a
   single 0 4px 12px rgba(0,0,0,.08) is exactly what makes a surface look cheap. Kept off the
   flush list row, which by DESIGN.md 5 never has a shadow. */
aside, .px-rh, .hm-pt, .ox-sum {
  box-shadow: var(--specular),
    0 18px 47px rgba(16,24,40,.03), 0 7.5px 19px rgba(16,24,40,.02),
    0 4px 10.5px rgba(16,24,40,.02), 0 2.3px 5.8px rgba(16,24,40,.012),
    0 1.2px 3.1px rgba(16,24,40,.012), 0 .5px 1.3px rgba(16,24,40,.012);
}

/* 7.10 A MENU BELONGS TO ITS TRIGGER. Scaling from the centre makes a dropdown look like it was
   always there and just became visible; scaling from the trigger's own corner makes it look like
   it came OUT of the button. 160ms, from 0.95 — never from 0, because nothing arrives from
   nothing. */
@keyframes rvPop { from { opacity: 0; transform: scale(.95); } to { opacity: 1; transform: none; } }
.px-menu, .ox-menu, .cf-menu {
  animation: rvPop 160ms var(--ease-out) both;
  transform-origin: 100% 0;   /* RTL: menus open from the inline-start corner, which is the right */
}

/* 7.9b THE SPARKLINE, on the terms of the chart the founder pointed at (21st.dev line-charts-8).
   A 2px monotone curve with NO area fill and one dashed reference line — the old one was straight
   segments under a gradient wash, which reads as a decorative smear rather than as a series.
   The draw is 1500ms decelerating, measured off the reference frame by frame (5% at 100ms, 57% at
   500ms, settled at 1500ms). That is far over the 300ms UI bound on purpose: this is an
   explanatory animation, not a control responding to a press, and it plays ONCE per page load —
   .kstrip.draw is set by vHome on the first paint only, because #body is rewritten on every data
   load and a 1.5s redraw on each one is the jump DESIGN.md §8.6 forbids. */
.spk-base { stroke: var(--line); stroke-width: 1; stroke-dasharray: 3 3; fill: none; }
.spk-line { fill: none; stroke: var(--accent); stroke-width: 2; stroke-linecap: butt; stroke-linejoin: miter; }
.kstrip.draw .spk-line {
  stroke-dasharray: 1; stroke-dashoffset: 1;
  animation: spkDraw 1500ms var(--ease-out) forwards;
}
@keyframes spkDraw { to { stroke-dashoffset: 0; } }
@media (prefers-reduced-motion: reduce) {
  .kstrip.draw .spk-line { animation: none; stroke-dashoffset: 0; }
}
/* the spark gets real room now that it carries a curve instead of a smear */
.kcard .ksp { width: 116px; height: 38px; opacity: 1; }

/* 7.10a BELOW THE DECK, NOTHING IS A CARD (founder's chosen direction A, 2026-09-16).
   The deck is the page's one object with an edge. Everything under it is ruled rows on a single
   white plane: the panels lose their borders, radii and shadows, and the ROWS inside them carry
   hairlines instead. That is the whole reason the direction was picked — a page of bordered
   rectangles reads as an admin panel from 2018, and the founder said exactly that three times. */
.pc-g3 { grid-template-columns: minmax(0,1fr); gap: var(--s5); }
.pc-g3 .sh-sec.card3 {
  background: transparent; border: 0; box-shadow: none; border-radius: 0; padding: 0;
}
/* the list inside a section becomes one white plane with ruled rows */
.pc-g3 .sh-cards { background: var(--paper); border-radius: var(--r-xl); overflow: hidden; gap: 0; }
.pc-g3 .sh-card {
  background: transparent; border: 0; border-radius: 0; box-shadow: none;
  border-block-start: 1px solid var(--line-soft); padding: var(--s3) var(--s4);
}
.pc-g3 .sh-cards > .sh-card:first-child { border-block-start: 0; }
.pc-g3 .sh-card.go:hover { transform: none; box-shadow: none; background: var(--accent-wash); }
/* the two charts sit on the same plane, with the same radius and no edge */
.pc-g3 .pc-chart, .pc-g3 .pcq {
  background: var(--paper); border-radius: var(--r-xl); padding: var(--s4);
}
.pc-g3 .pcq { height: auto; }
.pc-g3 .pcq .sub2 { display: revert; }

/* The partners band takes the same plane: one white surface, no hairline edge. */
.hm-pt { border: 0; border-radius: var(--r-xl); box-shadow: none; }

/* 7.10b THE HOME PAGE IS ONE SYSTEM. Its opening band (hm-*) was rebuilt to the reference
   language; the three report panels below it (pc-g3) were still the old flat boxes, so the screen
   changed grammar halfway down. Same material, same header rhythm, same recessed tracks. */
.pc-g3 .sh-sec.card3 { box-shadow: var(--specular), var(--sh-0); }
@media (hover: hover) and (pointer: fine) {
  .pc-g3 .sh-sec.card3:hover { box-shadow: var(--specular), var(--lift); }
}
.pc-g3 .sh-sec.card3 { transition: box-shadow var(--base) var(--ease); }
/* The panel title takes the same step off the body as «صحة خط البيع» above it, and the strapline
   the same muted --t-xs. Two header styles on one screen is two systems on one screen. */
.pc-g3 .sh-h { font-size: var(--t-md); font-weight: 600; color: var(--ink); }
.pc-g3 .sh-hs { font-size: var(--t-xs); color: var(--muted); line-height: 1.7; }
/* The quarter tiles are tiles, not tinted rectangles: a recessed ground and tabular figures. */
.pc-qc { box-shadow: var(--well); }
.pc-qc .v, .pc-qc .t, .pc-qc .k { font-variant-numeric: tabular-nums; }

/* 7.10c THE ROW, on beautifului.dev's terms. Three mechanics, all measured off its records table:
   (1) hover is a background FILL one step off the surface, applied in 120ms ease-out — not a
       border, not a shadow, so the row never changes size;
   (2) it is applied to the CELLS, not the row, so a sticky column keeps its own opaque ground;
   (3) it is switched OFF under (hover:none) — a touch device fires hover on tap and leaves the
       row highlighted until something else is touched, which reads as a stuck selection. */
.crm-row.crm-click, .rt-row, .trow, .sh-card.go, .px-li, .kh-r, .yt-r {
  transition: background-color 120ms var(--ease-out), color 120ms var(--ease-out);
}
@media (hover: hover) and (pointer: fine) {
  .crm-row.crm-click:hover, .trow:hover, .px-li:hover { background: var(--surface); }
}
@media (hover: none) {
  .crm-row.crm-click:hover, .trow:hover, .px-li:hover, .sh-card.go:hover,
  .crm-tbl tr:hover td { background: none; }
}

/* 7.10d THE SIDEBAR GLIDE. One absolutely-positioned highlight animating top and height, instead
   of each nav item animating its own background. The selected row then MOVES between destinations
   rather than one fading out while another fades in — the same idea as the record's tab indicator,
   which is why both use the 240ms on-screen-movement curve rather than an ease-out. */
nav, #nav { position: relative; }
/* No z-index on either side: the glide is inserted as the FIRST child, and positioned siblings
   paint in DOM order, so the items land on top of it for free. DESIGN.md 2 forbids an integer
   z-index, and a surface that needs one between two steps is usually telling you to fix the order
   instead — here it was. */
.nv-glide { position: absolute; inset-inline: 0; inset-block-start: 0; height: 0; border-radius: 10px;
  background: var(--rail-on-bg); opacity: 0; pointer-events: none;
  transition: transform 240ms var(--ease-io), height 240ms var(--ease-io), opacity var(--fast) var(--ease); }
.nv-glide.noanim { transition: none; }
.nv { position: relative; }
/* The glide carries the selection now, so the item's own fill would double it. */
.nv.on { background: transparent; }
@media (prefers-reduced-motion: reduce) { .nv-glide { transition: none; } }

/* ============================ 8. THE REVAMP, EVERY SCREEN ============================
   Section 7 fixed الرئيسية. An in-page audit of twelve screens then measured the same two defects
   everywhere else, so this section is the same system applied by MEASURED class name rather than
   by the handful section 7 happened to list.

   THE AUDIT, 2026-09-16 (share of visible strings set at 12px · surfaces drawing a real border):
     targets 85%/49 · accounts 81%/1 · settings 75%/9 · home 73%/10 · org 71%/7 · partners 69%/4
     perf 67%/11 · kmon 65%/5 · users 57%/16 · opps 55%/48 · products 52%/2 · reports 50%/6

   8.1 EVERY SURFACE TAKES THE RING. These are the classes the audit actually found drawing a
   border, not a guess: 160 surfaces across the product. border-color goes transparent rather than
   the border being removed, so no box collapses by 2px and no screen reflows. */
.cf-r, .cf-sec, .ox-card, .trow, .tgtopp, .crm-kpi, .yt-r, .yt-sec, .yt-kpi,
.perf-set, .kcard, .rx-card, .ac-card, .in-card, .pt-card, .us-card {
  border-color: transparent;
  box-shadow: var(--shadow-card);
}
/* A row inside a list is NOT a card: it keeps a hairline between siblings and takes no shadow,
   per DESIGN.md 5. The ring above would have given every table row its own floating edge. */
.trow, .yt-r, .cf-r {
  box-shadow: none;
  border-block-start: 1px solid var(--line-soft);
}

/* 8.2 THE BUTTON IS NOT A FOOTNOTE. The audit found 76 buttons set at 12px — DESIGN.md's base is
   --t-sm, and 12px is the LABEL size. A product whose every control is one step below its body
   text reads as provisional, and that is a large part of what "old style" was describing. */
.btn { font-size: var(--t-sm); }
.btn.btn-sm, .ac-dec .btn, .in-a2 .btn { font-size: var(--t-xs); }

/* 8.3 A PERCENTAGE IS A FIGURE, NOT A CHIP. «نسبة الإنجاز» on المستهدفات was 12px/600 — the single
   number that whole screen exists to report, drawn at label size. Same rule as the exec row. */
.yt-pct, .crm-pct, .px-he.px-c-tg { font-size: var(--t-lg); font-weight: 800;
  font-variant-numeric: tabular-nums; }

/* 8.4 THE NAME OF A THING LEADS ITS ROW. Row titles were 12px beside 12px values, so nothing in a
   list ranked. The name takes the body size and the weight; its sub-line keeps the label size. */
.sh-card .nm, .crm-row .crm-nm, .cf-r .nm, .tgtopp .nm, .ox-cl .a, .us-card .nm {
  font-size: var(--t-sm); font-weight: 600;
}

/* 8.5 THE LIST ROW, which is what four of the twelve screens ARE. جهات الاستهداف draws 41 rows
   whose every cell is 12px, so the entity's NAME — the only thing a reader is scanning for — has
   exactly the same weight as its phone number and its stage. A list where nothing ranks is a list
   you read linearly, which is the slowest way to use a table.
   The first cell leads; the rest stay at label size and step back in ink. */
.trow > *:first-child { font-size: var(--t-sm); font-weight: 600; color: var(--ink); }
.trow > *:not(:first-child) { color: var(--ink-2); }
.trow { min-height: 56px; }
/* The header is a label row, not a grey band: on a white plane a filled strip reads as another
   surface, and the table already has an edge. */
.thead { background: transparent; border-block-end: 1px solid var(--line); font-weight: 600; }

/* 8.6 ONE PRIMARY PER SCREEN (DESIGN.md 3.7). «رفع ملف Excel/CSV» was a BLACK button sitting beside
   the accent one, so جهات الاستهداف offered two things that both looked like the main action — and
   neither of them is: the main action there is adding a target. Black is retired to a ghost. */
.btn-dark { background: var(--paper); color: var(--ink); box-shadow: var(--ring-soft); }
@media (hover: hover) and (pointer: fine) { .btn-dark:not([disabled]):hover { background: var(--surface); } }

/* 8.7 THE TWO THINGS LEFT ON «المستهدفات والأداء». The product table still drew its header as a grey
   filled band — a second surface colour inside a card that already has one — and every quarter with
   no data drew a HATCHED bar. Hatching reads as «broken», not as «nothing recorded»: five products
   with no target made the screen look like a rendering fault. A flat well says the same thing and
   says it quietly. The header loses its fill and keeps a rule, like every other header here. */
.yt-r.hdr { background: transparent; border-block-end: 1px solid var(--line); }
.yt-qc.none .bar { background: var(--well); }

/* 8.8 THE GREY FILL, which the ring pass could not see. §8.1 gave these cards a ring and left their
   background alone, so «العملاء» and «الأداء» still drew three GREY KPI cards beside one blue one:
   four filled surfaces, no white, and the tint that was supposed to mark the leading figure marked
   nothing because it was one fill among four. A probe of computed backgrounds found every one —
   --surface #EFF1F5 on .crm-kpi, .perf-kpi, and on the filter and header bands .ac-f / .cf-hr.
   The card goes white and keeps the ring; the LEAD card keeps its blue, and now it is the only
   tinted thing in the strip, which is the whole point of tinting it. */
.crm-kpi:not(.crm-lead), .perf-kpi:not(.lead) { background: var(--paper); }
.ac-f, .cf-hr { background: transparent; border-block-end: 1px solid var(--line-soft); }

/* 7.11 TABULAR FIGURES, EVERYWHERE A FIGURE IS DRAWN. Proportional digits make a column of numbers
   ragged and make a changing number jump sideways. This is the cheapest quality upgrade available
   and it costs one declaration. */
.hm-kpi .n, .hm-st .n, .hm-fig .n, .px-hi .n, .yt-kpi .n, .og-t .n, .rx-n, .in-k .n {
  font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1;
}

@media (prefers-reduced-motion: reduce) {
  .btn, .sh-tile.go, .sh-card.go, .crm-kpi.crm-click { transition: none; }
  .btn:not([disabled]):active, .sh-card.go:active, .sh-tile.go:active,
  .crm-kpi.crm-click:active { transform: none; }
  .sh-card.go:hover, .sh-tile.go:hover, .crm-kpi.crm-click:hover { transform: none; }
}
`;

// ---------------------------------------------------------------------------------------------
// hold-to-confirm — the destructive-action gesture DESIGN.md 8.5 names and nothing implemented.
//
// The old pattern was arm-then-confirm: click «حذف», the button turns red and says «تأكيد الحذف»,
// click again. Two clicks, and the second one sits exactly where the first one was — which is the
// classic way to delete something by double-clicking too fast.
//
// This replaces it with ONE deliberate gesture: press and hold while a ring fills. Releasing early
// cancels, and the fill returns from wherever it actually is rather than snapping (interior.dev
// failure 2: a transition must resume from where the element is, so this transitions a property
// and never replays a keyframe).
//
// ACCESSIBILITY. A hold is a pointer gesture, and a keyboard user cannot be asked to hold a key
// for 900ms to delete a row. Keyboard activation therefore falls back to the two-step path:
// Enter/Space arms the control, a second Enter/Space commits. Same for a coarse pointer with
// prefers-reduced-motion on, where an invisible timer would be the only feedback.
// ---------------------------------------------------------------------------------------------
export const HOLD_CSS = `
.rv-hold {
  position: relative; overflow: hidden;
  font-family: inherit; font-size: 14px; font-weight: 600;
  height: 40px; padding-inline: 18px; border-radius: var(--r-pill);
  border: none; cursor: pointer;
  color: var(--s-fail-text); background: var(--s-fail-soft);
  display: inline-flex; align-items: center; gap: 8px;
  touch-action: none; user-select: none; -webkit-user-select: none;
}
.rv-hold:hover { background: var(--s-fail-soft); filter: brightness(.97); }
.rv-hold:focus-visible { outline: 2px solid var(--s-fail); outline-offset: 2px; }
/* The fill. scaleX composites; width does not. Grows from the inline-start so it flips with the
   document, and the label sits above it. */
.rv-hold .rv-fill {
  position: absolute; inset-block: 0; inset-inline-start: 0; width: 100%;
  background: var(--s-fail); opacity: .22;
  transform: scaleX(0); transform-origin: right center;
  transition: transform var(--fast) linear;
  pointer-events: none;
}
[dir="ltr"] .rv-hold .rv-fill { transform-origin: left center; }
.rv-hold.holding .rv-fill { transition-duration: 900ms; transform: scaleX(1); }
.rv-hold .rv-lbl { position: relative; }
/* Armed is the KEYBOARD path, and the reduced-motion path. It says what the next press does. */
.rv-hold.armed { background: var(--s-fail); color: var(--paper); }
.rv-hold.armed .rv-fill { display: none; }
.rv-hold[disabled] { background: var(--s-off-soft); color: var(--s-off-text); cursor: not-allowed; }
/* The row-inline size. Same gesture, smaller mark; the hit area still reaches 44px on touch. */
.rv-hold-sm { height: 30px; padding-inline: 12px; font-size: 12px; }
/* The targets list reveals its row actions on hover; the hold control inherits that. */
.tgtflat .crow .rv-hold { opacity: 0; transition: opacity var(--fast) ease-in; }
.tgtflat .crow:hover .rv-hold, .tgtflat .crow:focus-within .rv-hold,
.tgtflat .crow .rv-hold:focus-visible, .tgtflat .crow .rv-hold.holding,
.tgtflat .crow .rv-hold.armed { opacity: 1; }
@media (pointer:coarse) {
  .rv-hold { min-height: 44px; }
  /* No hover on touch: an action you can never reveal is an action you do not have. */
  .tgtflat .crow .rv-hold { opacity: 1; }
}
`;

// Serialised into the page. Depends only on the DOM and on window.moToast when it exists.
export const HOLD_JS = `
(function () {
  var HOLD_MS = 900;
  var timer = null, active = null;

  function label(el, txt) {
    var l = el.querySelector(".rv-lbl");
    if (l) l.textContent = txt;
  }
  function reset(el) {
    if (!el) return;
    el.classList.remove("holding");
    label(el, el.getAttribute("data-idle") || "حذف");
    el.setAttribute("aria-pressed", "false");
  }
  function fire(el) {
    reset(el);
    el.classList.remove("armed");
    var fn = el.getAttribute("data-do");
    if (fn && window[fn]) window[fn](el.getAttribute("data-arg"));
    else if (fn) { try { (new Function(fn)).call(el); } catch (e) {} }
  }
  function stop() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (active) { reset(active); active = null; }
  }
  // Reduced motion means the filling ring is not drawn, so the hold would have NO feedback at all.
  // DESIGN.md 8.1 failure 3: the trip is optional, the destination is not — so under reduced
  // motion the control becomes the two-step arm/confirm instead of a silent timer.
  function reduced() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function armStep(el) {
    if (el.classList.contains("armed")) { el.classList.remove("armed"); fire(el); return; }
    document.querySelectorAll(".rv-hold.armed").forEach(function (o) {
      o.classList.remove("armed"); reset(o);
    });
    el.classList.add("armed");
    label(el, el.getAttribute("data-armed") || "اضغط مرة أخرى للحذف");
    el.setAttribute("aria-pressed", "true");
  }

  document.addEventListener("pointerdown", function (e) {
    var el = e.target.closest && e.target.closest(".rv-hold");
    if (!el || el.hasAttribute("disabled")) return;
    e.preventDefault();
    if (reduced()) { armStep(el); return; }
    active = el;
    el.classList.add("holding");
    label(el, el.getAttribute("data-holding") || "استمر بالضغط…");
    timer = setTimeout(function () { timer = null; var t = active; active = null; if (t) fire(t); }, HOLD_MS);
  });
  document.addEventListener("pointerup", stop);
  document.addEventListener("pointercancel", stop);
  document.addEventListener("pointerleave", stop, true);

  // Keyboard NEVER holds. Enter/Space arms, a second press commits.
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var el = document.activeElement;
    if (!el || !el.classList || !el.classList.contains("rv-hold")) return;
    if (el.hasAttribute("disabled")) return;
    e.preventDefault();
    armStep(el);
  });
  // Leaving the control disarms it, so an armed delete never waits around for a stray Enter.
  document.addEventListener("focusout", function (e) {
    var el = e.target;
    if (el && el.classList && el.classList.contains("rv-hold") && el.classList.contains("armed")) {
      el.classList.remove("armed"); reset(el);
    }
  });
})();
`;
