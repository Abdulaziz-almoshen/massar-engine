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

aside {
  width: 244px;
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  box-shadow: none;
  overflow: hidden;
}

/* The brand block stops being a bordered strip and becomes part of the panel. */
.switcher { height: 60px; padding: 12px 14px; border-bottom: none; border-radius: var(--r-lg); }
.switcher:hover { background: var(--accent-wash); }
.switcher .logo { width: 32px; height: 32px; border-radius: var(--r-sm); background: var(--grad); }
.switcher .t1 { font-weight: 600; }

/* Search leaves the rail on wide screens (it becomes the top bar's anchor, see section 2) and
   stays here on narrow ones, where there is no top bar to hold it. */
.navsearch {
  height: 40px; border-radius: var(--r-md); border: none;
  background: var(--surface); color: var(--muted);
}
.navsearch:hover { background: var(--surface-2); border-color: transparent; color: var(--ink-2); }
.navsearch kbd { background: var(--paper); border-radius: var(--r-sm); }

nav { padding: var(--s2) 10px; }
.grp { font-size: 12px; font-weight: 600; color: var(--muted); padding: 6px 12px; }

/* The nav item is a pill with a real touch height, and the active one is the accent tint with an
   accent-weight label — not a grey fill. DESIGN.md 3.10: 44px under a coarse pointer. */
.nv {
  height: 42px; border-radius: var(--r-md); padding-inline: 12px; gap: 12px;
  font-weight: 500; color: var(--muted); margin-bottom: 2px;
  transition: background var(--fast) var(--ease), color var(--fast) var(--ease);
}
.nv:hover { background: var(--accent-wash); color: var(--ink); }
.nv.on { background: var(--accent-tint); color: var(--accent-deep); font-weight: 700; }
.nv.on .gx > * { background-color: var(--accent-deep); border-color: var(--accent-deep); }
.nv.on .g-tr { background: none; border-bottom-color: var(--accent-deep); }
.nv:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }

.collapse { height: 40px; border-radius: var(--r-md); }
.collapse:hover { background: var(--accent-wash); }

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

/* ---- the opportunity line editor ----
   It was full-bleed on the expanded row, so a four-field grid stretched across the whole viewport
   and the labels ended up a screen away from their inputs. It is a contained card now, and the
   fields sit at a readable measure instead of filling whatever width exists. */
.opedit {
  background: var(--paper);
  border-radius: var(--r-lg);
  box-shadow: none;
  border: 1px solid var(--line);
  padding: var(--s3) var(--s4) var(--s4);
  margin-block: var(--s2) var(--s3);
}
.opedit .lb { font-size: 12px; font-weight: 600; color: var(--muted); margin: 0 0 var(--s2); }

/* The rail WRAPS. Scrolling it clipped «إغلاق – خسارة» mid-word with nothing to say more existed,
   and a horizontal scroller with no visible cue is a control the reader does not know they have.
   Eight stages wrap to two tidy rows inside a contained card, and nothing is hidden. */
.opedit .rail {
  flex-wrap: wrap; overflow: visible; gap: var(--s2);
  margin-block-end: var(--s4);
}
.opedit .rung {
  border: none; background: var(--surface); color: var(--ink-2);
  min-height: 36px; padding: 8px 14px; font-weight: 600;
  transition: background var(--fast) var(--ease), color var(--fast) var(--ease);
}
.opedit .rung:hover { background: var(--accent-wash); }
.opedit .rung.on { background: var(--accent-tint); color: var(--accent-deep); border-color: transparent; }
.opedit .rung:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

/* Labelled fields, at a measure a person can read across. */
.opfields {
  display: flex; flex-wrap: wrap; gap: var(--s3);
  margin-block-end: var(--s4); align-items: end;
}
.opf { display: flex; flex-direction: column; gap: 6px; flex: 0 1 150px; min-width: 0; }
.opf.wide { flex: 1 1 320px; max-width: 460px; }
.opf.num { flex: 0 0 120px; }
.opf-l { font-size: 12px; font-weight: 600; color: var(--muted); }
/* A number you type is Latin because the platform's number input is; align it to the inline-end
   and make it tabular so the four boxes read as a row of figures rather than four loose strings. */
.opf.num .inp { text-align: end; font-variant-numeric: tabular-nums; }

.opedit .acts { margin-top: var(--s3); gap: 10px; }
.opedit .acts .btn { height: 36px; padding: 0 16px; font-size: 12px; line-height: normal; }
/* The delete control matches the row of actions it sits in; it was 40px beside 30px buttons. */
.opedit .acts .rv-hold { height: 36px; padding-inline: 16px; font-size: 12px; }
/* Quiet until wanted: destructive actions do not advertise themselves in a resting row. */
.opedit .acts .rv-hold:not(.holding):not(.armed) { background: var(--surface); color: var(--s-fail-text); }
.opedit .acts .rv-hold:hover { background: var(--s-fail-soft); }

/* The expanded row's ground stays tinted so the editor card reads as sitting ON the row. */
.opexp { padding: 0 var(--s4) var(--s2); }

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
a[href]:not(.btn):not(.rv-actionrow):not(.nv):not(.sub) {
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
  /* The tick is drawn, not a glyph: a font that lacks it would render a box. */
  background-image: linear-gradient(45deg, transparent 42%, var(--paper) 42%, var(--paper) 52%, transparent 52%),
                    linear-gradient(-45deg, transparent 58%, var(--paper) 58%, var(--paper) 68%, transparent 68%);
  background-size: 100% 100%;
}
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
