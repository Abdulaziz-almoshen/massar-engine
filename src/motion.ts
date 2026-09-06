// motion.ts — Massar's motion vocabulary.
//
// The founder's instruction: every motion in Massar that has an equivalent in the transitions.dev
// catalogue should come from there rather than being invented per screen. This module is that
// vocabulary, implemented against Massar's OWN tokens (DESIGN.md §2) and named after the catalogue
// so a reviewer can trace any animation on any screen back to a named pattern.
//
// WHAT IS AND IS NOT HERE. The catalogue is broad and half of it is for marketing surfaces: confetti
// bursts, gooey menus, 3D pointer tilt, like-button particles, smoky delete, card-stack fans. Massar
// is an APP UI — DESIGN.md's own classifier — and its rules say calm surfaces, minimal chrome, and
// no decoration that carries no data. So the decorative half is deliberately absent, and that
// absence is the design decision, not an omission.
//
// EVERY PATTERN HERE OBEYS FOUR RULES:
//   1. transform and opacity only. A non-compositing property drags the element back into the paint
//      path, and this engine is one 512MB shared-CPU box that also serves the Gupshup webhook.
//   2. RTL-correct. Anything with a direction is authored for RTL, the document's own direction.
//   3. Exit is faster than entry, and a state the user is HOLDING uses --fast.
//   4. Reduced motion removes the trip, never the destination — the global
//      prefers-reduced-motion block in dashboard.ts turns every transition here off, and every
//      surface must still be correct and complete without it.
//
// NO BACKTICKS ANYWHERE IN THIS FILE, comments included: it is one template literal.

export const MOTION_CSS = `
/* ---- 1. number-pop-in ------------------------------------------------------------------
   A figure that CHANGED announces itself; a figure that merely rendered does not. Applied by
   adding .mo-pop when a value differs from the last paint, then removed on animation end so a
   re-render does not replay it (DESIGN.md §8.6 forbids replaying an entrance on every render). */
@keyframes mo-pop { from { opacity:0; transform:translateY(4px) } to { opacity:1; transform:none } }
.mo-pop { animation: mo-pop var(--base) var(--ease) both }

/* ---- 2. value-flash --------------------------------------------------------------------
   The changed figure holds its status ground for --flash, then returns. It may only re-state a
   change the number itself already shows (DESIGN.md §3.0b: colour is never the only channel). */
.mo-flash { transition: background var(--flash) var(--ease); border-radius: var(--r-sm) }
.mo-flash.up { background: var(--s-issued-soft) }
.mo-flash.down { background: var(--s-fail-soft) }

/* ---- 3. texts-reveal -------------------------------------------------------------------
   Rows rise with an offset stagger. --stagger per item, CAPPED at 8 items: a list of forty does
   not stagger forty times, and item nine onward arrives with item eight. */
@keyframes mo-rise { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:none } }
.mo-stagger > * { animation: mo-rise var(--base) var(--ease) both }
.mo-stagger > :nth-child(1){animation-delay:0ms}      .mo-stagger > :nth-child(2){animation-delay:24ms}
.mo-stagger > :nth-child(3){animation-delay:48ms}     .mo-stagger > :nth-child(4){animation-delay:72ms}
.mo-stagger > :nth-child(5){animation-delay:96ms}     .mo-stagger > :nth-child(6){animation-delay:120ms}
.mo-stagger > :nth-child(7){animation-delay:144ms}    .mo-stagger > :nth-child(8){animation-delay:168ms}
.mo-stagger > :nth-child(n+9){animation-delay:192ms}

/* ---- 4. skeleton-swap ------------------------------------------------------------------
   Blocks at the EXACT size of the content they stand in for — a skeleton that resizes on swap is
   interior.dev failure 1. Shimmer is one translateX sweep, never a background-position loop, which
   repaints every frame. */
@keyframes mo-shimmer { to { transform: translateX(-220%) } }
.mo-sk { position:relative; overflow:hidden; background:var(--skeleton); border-radius:var(--r-sm);
  height:1em; margin-block:4px }
.mo-sk::after { content:""; position:absolute; inset-block:0; inset-inline-start:0; width:60%;
  background:linear-gradient(90deg,transparent,var(--skeleton-hi),transparent);
  transform:translateX(220%); animation:mo-shimmer var(--slow) var(--ease) infinite }
.mo-sk.w40{width:40%} .mo-sk.w60{width:60%} .mo-sk.w80{width:80%}

/* ---- 5. accordion ---------------------------------------------------------------------
   grid-template-rows 0fr -> 1fr, which animates without measuring a height in JS. The chevron
   points toward the inline-START when collapsed, because the document is RTL (DESIGN.md §4). */
.mo-acc { display:grid; grid-template-rows:0fr; transition:grid-template-rows var(--base) var(--ease) }
.mo-acc.open { grid-template-rows:1fr }
.mo-acc > * { overflow:hidden; min-height:0 }
.mo-chev { transition:transform var(--base) var(--ease); display:inline-block }
.mo-chev.open { transform:rotate(-90deg) }

/* ---- 6. toast -------------------------------------------------------------------------
   Rises with fade and scale. EXIT IS FASTER THAN ENTRY. Sits at --z-toast, inline-centred so it
   needs no mirroring. */
.mo-toast { position:fixed; inset-block-end:24px; inset-inline:0; margin-inline:auto; width:max-content;
  max-width:min(90vw,44ch); z-index:var(--z-toast); background:var(--ink); color:var(--paper);
  padding:10px 16px; border-radius:var(--r-pill); box-shadow:var(--sh-3); font-size:var(--t-xs);
  font-weight:600; opacity:0; transform:translateY(12px) scale(.96);
  transition:opacity var(--fast) var(--ease), transform var(--fast) var(--ease); pointer-events:none }
.mo-toast.in { opacity:1; transform:none; transition-duration:var(--base) }

/* ---- 7. panel-reveal ------------------------------------------------------------------
   A drawer enters from the INLINE-START, which in this RTL document is the right edge. Written as
   a logical translate so it mirrors with the document rather than being hard-coded to a side. */
.mo-panel { transform:translateX(100%); opacity:0;
  transition:transform var(--base) var(--ease), opacity var(--fast) var(--ease) }
.mo-panel.in { transform:none; opacity:1 }
[dir="ltr"] .mo-panel { transform:translateX(-100%) }
[dir="ltr"] .mo-panel.in { transform:none }
.mo-scrim { position:fixed; inset:0; background:rgba(33,37,41,.38); z-index:var(--z-overlay);
  opacity:0; transition:opacity var(--base) var(--ease) }
.mo-scrim.in { opacity:1 }

/* ---- 8. modal -------------------------------------------------------------------------
   Scale from just under 1. Anything smaller reads as a zoom, which on a data surface is theatre. */
.mo-modal { transform:scale(.97); opacity:0; z-index:var(--z-modal);
  transition:transform var(--base) var(--ease), opacity var(--fast) var(--ease) }
.mo-modal.in { transform:none; opacity:1 }

/* ---- 9. icon-swap ---------------------------------------------------------------------
   Two glyphs occupying ONE grid cell, so the control never resizes when the state changes —
   interior.dev failure 1 again, in miniature. */
.mo-swap { display:inline-grid; place-items:center }
.mo-swap > * { grid-area:1/1; transition:opacity var(--fast) var(--ease), transform var(--fast) var(--ease) }
.mo-swap > .off { opacity:0; transform:scale(.7) }

/* ---- 10. success-check ----------------------------------------------------------------
   The check DRAWS ON; it does not fade in. A fade says "a thing appeared"; a draw says "it
   completed", which is the actual message. */
@keyframes mo-draw { to { stroke-dashoffset:0 } }
.mo-check path { stroke-dasharray:22; stroke-dashoffset:22; animation:mo-draw var(--base) var(--ease) forwards }

/* ---- 11. error-shake ------------------------------------------------------------------
   ONE shake, never a loop. Small amplitude: this is a data-entry surface, not a game. */
@keyframes mo-shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-5px)}
  40%{transform:translateX(4px)} 60%{transform:translateX(-3px)} 80%{transform:translateX(2px)} }
.mo-shake { animation:mo-shake var(--base) var(--ease) 1 }

/* ---- 12. tooltip ----------------------------------------------------------------------
   APPEAR-ONLY DELAY, INSTANT EXIT. A tooltip that lingers on the way out follows the cursor
   around the screen. */
.mo-tip { position:absolute; z-index:var(--z-tooltip); background:var(--ink); color:var(--paper);
  font-size:var(--t-xs); padding:5px 9px; border-radius:var(--r-sm); white-space:nowrap;
  opacity:0; transform:translateY(3px); pointer-events:none; transition:opacity var(--fast) var(--ease) }
.mo-tipwrap:hover .mo-tip, .mo-tipwrap:focus-visible .mo-tip {
  opacity:1; transform:none; transition-delay:400ms }

/* ---- 13. text-states-swap -------------------------------------------------------------
   A label changing from «حفظ» to «جارٍ الحفظ» must NOT resize the control. --w is set from the
   longest state before the first click. interior.dev failure 1, stated as a token. */
.mo-label { display:inline-flex; align-items:center; justify-content:center; min-width:var(--w,auto);
  transition:opacity var(--fast) var(--ease) }
.mo-label.busy { opacity:.65 }

/* ---- 14. learn-more-hover -------------------------------------------------------------
   The chevron shifts toward the inline-END on hover. Logical, so it mirrors. */
.mo-more .mo-arrow { display:inline-block; transition:transform var(--fast) var(--ease) }
.mo-more:hover .mo-arrow { transform:translateX(-3px) }
[dir="ltr"] .mo-more:hover .mo-arrow { transform:translateX(3px) }

/* ---- 15. new-items-pill ---------------------------------------------------------------
   New rows arriving during a read are ANNOUNCED, never injected under the cursor. */
.mo-nip { position:absolute; inset-block-start:8px; inset-inline:0; margin-inline:auto; width:max-content;
  background:var(--blue); color:var(--paper); border:0; border-radius:var(--r-pill); padding:4px 12px;
  font:inherit; font-size:var(--t-xs); font-weight:600; box-shadow:var(--sh-2); cursor:pointer;
  z-index:var(--z-dropdown); transform:translateY(-140%); opacity:0;
  transition:transform var(--base) var(--ease), opacity var(--base) var(--ease) }
.mo-nip.in { transform:none; opacity:1 }
`;

export const MOTION_JS = `
/* ============================ motion (client) ============================
   The JS half of the vocabulary. Every helper is a no-op under reduced motion, because the CSS
   above is already neutralised there and the DESTINATION must still arrive. */

var MO_REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

/* number-pop-in. Called with the element and the value it now shows. Animates ONLY when the value
   actually changed since the last paint — #body is rewritten on every keystroke, and replaying an
   entrance on each one is the jump the designer measured. */
function moNumber(el, value) {
  if (!el) return;
  var prev = el.getAttribute("data-mo-v");
  el.setAttribute("data-mo-v", String(value));
  if (MO_REDUCED || prev === null || prev === String(value)) return;
  el.classList.remove("mo-pop");
  void el.offsetWidth;                 /* restart the animation without a timer */
  el.classList.add("mo-pop");
}
window.moNumber = moNumber;

/* value-flash. Direction is passed in, never inferred from the colour — the sign is the channel
   and the colour only repeats it (DESIGN.md 3.0b). */
function moFlash(el, dir) {
  if (!el || MO_REDUCED) return;
  el.classList.add("mo-flash", dir === "down" ? "down" : "up");
  setTimeout(function () { el.classList.remove("up", "down"); }, 900);
}
window.moFlash = moFlash;

/* toast. One at a time: a stack of toasts on an app surface is a notification centre nobody asked
   for. Exit is faster than entry, which the CSS carries. */
var moToastEl = null, moToastT = null;
function moToast(msg, ms) {
  var el = moToastEl;
  if (!el) {
    el = document.createElement("div"); el.className = "mo-toast";
    document.body.appendChild(el); moToastEl = el;
  }
  el.textContent = String(msg || "");
  el.setAttribute("role", "status");
  void el.offsetWidth;
  el.classList.add("in");
  clearTimeout(moToastT);
  moToastT = setTimeout(function () { el.classList.remove("in"); }, Math.max(1600, ms || 2600));
}
window.moToast = moToast;

/* accordion. Toggles the grid-rows class and the chevron together, and keeps aria-expanded in step
   so the state is announced, not only drawn. */
function moAcc(btn, panel) {
  if (!btn || !panel) return;
  var open = panel.classList.toggle("open");
  btn.setAttribute("aria-expanded", open ? "true" : "false");
  var ch = btn.querySelector(".mo-chev");
  if (ch) ch.classList.toggle("open", open);
}
window.moAcc = moAcc;

/* error-shake. One shake, and the class is removed on end so a second failure shakes again. The
   shake is decorative: the MESSAGE is what carries the error (DESIGN.md 5, Field error). */
function moShake(el) {
  if (!el || MO_REDUCED) return;
  el.classList.remove("mo-shake");
  void el.offsetWidth;
  el.classList.add("mo-shake");
  setTimeout(function () { el.classList.remove("mo-shake"); }, 260);
}
window.moShake = moShake;

/* text-states-swap. Reserve the widest state BEFORE the first click, so the control never resizes
   and the row beneath it never moves. Measures by rendering each label off-screen once. */
function moReserve(btn, labels) {
  if (!btn || !labels || !labels.length) return;
  var probe = document.createElement("span");
  probe.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;font:inherit";
  btn.appendChild(probe);
  var w = 0;
  for (var i = 0; i < labels.length; i++) { probe.textContent = labels[i]; w = Math.max(w, probe.offsetWidth); }
  btn.removeChild(probe);
  btn.style.setProperty("--w", w + "px");
  btn.classList.add("mo-label");
}
window.moReserve = moReserve;

/* The busy state that goes with it: label swaps, width does not. */
function moBusy(btn, busyLabel) {
  if (!btn) return;
  if (!btn.getAttribute("data-mo-idle")) btn.setAttribute("data-mo-idle", btn.textContent);
  btn.textContent = busyLabel;
  btn.classList.add("busy");
  btn.setAttribute("aria-busy", "true");
  btn.disabled = true;
}
function moIdle(btn) {
  if (!btn) return;
  var idle = btn.getAttribute("data-mo-idle");
  if (idle) btn.textContent = idle;
  btn.classList.remove("busy");
  btn.removeAttribute("aria-busy");
  btn.disabled = false;
}
window.moBusy = moBusy; window.moIdle = moIdle;

/* skeleton-swap. Renders N blocks at the caller's widths; the caller is responsible for matching
   the real content's geometry, which is the half a helper cannot do for it. */
function moSkeleton(n, widths) {
  var out = "", w = widths || ["w80", "w60", "w40"];
  for (var i = 0; i < (n || 3); i++) out += '<div class="mo-sk ' + w[i % w.length] + '"></div>';
  return out;
}
window.moSkeleton = moSkeleton;
`;
