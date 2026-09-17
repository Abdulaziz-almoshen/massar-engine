// massar-ds-shell.ts — the rail and the top bar, moved onto the new system.
//
// WHY THIS IS NOT SCOPED, when massar-ds-crm.ts is. The shell is ONE element, shared by all 26
// screens and living outside every screen's subtree, so it cannot sit inside a .ds6 wrapper the
// way a ported screen does. Scoping it would mean the rail stayed on the old palette until the
// last screen moved, which is the one part of the app the reader sees on every route.
//
// It is safe to restyle in place for the reason the screens are not: there is exactly one rail,
// its markup is known (aside > .switcher, #nav > .grp/.nv, .collapse), and it can be verified by
// looking at it. A screen, by contrast, is 26 different markups sharing class names.
//
// Every value is a --m-* variable, never a literal. Those are declared on :root by
// massar-ds-crm.ts, so when the design system's tokens change the shell follows without an edit
// here. That is the whole point of the indirection: the last redesign moved 1,186 value sites by
// hand because the values had been written out.
//
// (No backticks anywhere below, including in comments: this is one template literal.)

export const MASSAR_DS_SHELL_CSS = `
/* ---- the rail ---- */
aside {
  inline-size: 236px;
  background: var(--m-paper);
  color: var(--m-ink-2);
  border-inline-end: 1px solid var(--m-line);
}

/* The workspace mark. A solid ground, not a gradient: a gradient on a 28px square reads as
   noise at that size, and the new system spends colour on status only. */
.switcher {
  block-size: 56px;
  padding-inline: var(--m-3);
  border-block-end: 1px solid var(--m-line);
  background: transparent;
}
.switcher .logo {
  inline-size: 28px;
  block-size: 28px;
  border-radius: var(--m-r-ctl);
  background: var(--m-ac);
  font-weight: 600;
}
.switcher .t1 { color: var(--m-ink); font-weight: 600; }
.switcher .t2 { color: var(--m-mut); }
.switcher .chev { color: var(--m-faint); }

/* ---- nav items ---- */
.grp {
  color: var(--m-faint);
  font-size: var(--m-t-micro);
  font-weight: 600;
  letter-spacing: 0;
  padding-inline: var(--m-3);
  margin-block-start: var(--m-4);
}
.nv {
  block-size: 34px;
  border-radius: var(--m-r-ctl);
  color: var(--m-ink-2);
  padding-inline: var(--m-3);
  /* Named properties, never "all": the rail repaints on every route change and
     transitioning everything makes a keyboard-driven jump feel laggy. */
  transition: background var(--m-out) var(--m-ease), color var(--m-out) var(--m-ease);
}
.nv .lbl { font-size: var(--m-t-cap); }

/* Navigating the rail happens tens of times a day, so the hover is a colour change and
   nothing moves. Gated, because a touch device fires hover on tap and would leave the
   last-tapped item looking selected. */
@media (hover: hover) and (pointer: fine) {
  .nv:hover { background: var(--m-sunk); color: var(--m-ink); }
  .collapse:hover { background: var(--m-sunk); }
  .switcher:hover { background: var(--m-sunk); }
}

/* The current route is the one thing in the rail allowed to carry the accent. */
.nv.on {
  background: var(--m-ac-dim);
  color: var(--m-ac-deep);
  font-weight: 600;
}
.nv.on .gx > * { background-color: var(--m-ac-deep); border-color: var(--m-ac-deep); }
.nv.on .g-tr { background: none; border-block-end-color: var(--m-ac-deep); }

/* Press feedback on every pressable thing in the rail. 100ms, and the scale is small enough
   to read as the control yielding rather than as the layout moving. */
.nv:active, .collapse:active, .switcher:active { transform: scale(.97); }
.nv, .collapse, .switcher { transition-property: background, color, transform; }

.collapse {
  block-size: 34px;
  border-radius: var(--m-r-ctl);
  color: var(--m-mut);
  font-size: var(--m-t-cap);
}

.navsearch {
  border-radius: var(--m-r-ctl);
  border: 1px solid var(--m-line);
  background: var(--m-page);
  color: var(--m-mut);
  font-size: var(--m-t-cap);
}
.navsearch kbd {
  background: var(--m-paper);
  border: 1px solid var(--m-line);
  border-radius: 6px;
  color: var(--m-faint);
}

/* One focus ring for the whole shell. Keyboard-only: a mouse user who has just clicked a nav
   item does not need to be told which one they clicked. */
.nv:focus-visible, .collapse:focus-visible, .switcher:focus-visible, .navsearch:focus-visible {
  outline: none;
  box-shadow: var(--m-focus);
}

@media (prefers-reduced-motion: reduce) {
  .nv, .collapse, .switcher { transition: none; }
  .nv:active, .collapse:active, .switcher:active { transform: none; }
}
`;
