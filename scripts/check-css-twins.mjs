#!/usr/bin/env node
// Gate step: NO CLASS NAME MAY DESCRIBE TWO COMPONENTS.
//
// On 2026-09-20 `.m-cb` was BOTH the checkbox (five modules use it) and the combobox root. The
// combobox inherited `inline-size:16px; block-size:16px; appearance:none` from the checkbox, so its
// trigger overflowed its own box and rendered on top of the label above it — «المسؤول» and «مدير
// المنتج» were half covered on two live screens. Nothing failed: tsc passed, the payload parsed,
// smoke rendered the route, and the design ratchet saw only legal tokens.
//
// This is the CSS twin of `scripts/check-browser-globals.mjs` (a top-level name declared twice, the
// page running whichever was concatenated last). The failure mode is identical — one name, two
// meanings, last one partially wins — and so is the fix: forbid the collision.
//
// WHAT COUNTS AS A COLLISION. Not mere re-declaration - this sheet legitimately layers a base rule
// with a motion block and a responsive block further down, and line distance flags forty of those.
// The signal that separates layering from twinning is CONFLICTING LAYOUT MODE: two bare rules that
// give one class two different `display` values are two components, because a component's display
// mode is the one thing a later layer never changes. `.m-cb` had `display:grid` (the checkbox, with
// a 16x16 box) and `display:inline-flex` (the combobox root). That is the whole bug in one line.
import { readFileSync } from "node:fs";

const FILE = new URL("../../massar-ds/massar.css", import.meta.url);

// Known and accepted: a class that deliberately changes layout mode in a later layer. Each entry
// needs a reason, because an allowlist with no reasons becomes where defects hide.
const ALLOWED = new Map([
  // e.g. ["m-foo", "collapses to block inside the print sheet"],
]);

const raw = readFileSync(FILE, "utf8");

// TOP-LEVEL RULES ONLY. A rule inside @media or @supports changing display is a responsive layer,
// which is legitimate and expected (.m-shell goes flex -> block under 900px). Only two rules at the
// sheet's top level claiming one class are two components. At-rule bodies are blanked rather than
// removed so reported line numbers still point at the real file.
const css = (() => {
  const out = raw.split("");
  let i = 0;
  while (i < raw.length) {
    if (raw[i] !== "@") { i++; continue; }
    let j = raw.indexOf("{", i);
    if (j < 0) break;
    let depth = 1, k = j + 1;
    while (k < raw.length && depth > 0) {
      if (raw[k] === "{") depth++;
      else if (raw[k] === "}") depth--;
      k++;
    }
    for (let z = i; z < k && z < raw.length; z++) if (out[z] !== "\n") out[z] = " ";
    i = k;
  }
  return out.join("");
})();

/** Bare class rule heads only: `.name {` with nothing else in the selector, plus its body. */
const RULE = /(^|\n)\s*\.([a-zA-Z][\w-]*)\s*\{([^}]*)\}/g;
const DISPLAY = /(?:^|;)\s*display\s*:\s*([^;!]+)/i;

const lineOf = (idx) => css.slice(0, idx).split("\n").length;
const seen = new Map();
for (const m of css.matchAll(RULE)) {
  const d = DISPLAY.exec(m[3]);
  if (!d) continue;
  const name = m[2], mode = d[1].trim();
  if (!seen.has(name)) seen.set(name, []);
  seen.get(name).push({ mode, line: lineOf(m.index) });
}

const bad = [];
for (const [name, hits] of seen) {
  const modes = [...new Set(hits.map((h) => h.mode))];
  if (modes.length < 2) continue;
  if (ALLOWED.has(name)) continue;
  bad.push({ name, hits });
}

if (bad.length) {
  console.error(`css twins: ${bad.length} class name(s) given two layout modes by two bare rules —\n`);
  for (const b of bad) {
    console.error(`  .${b.name}`);
    for (const h of b.hits) console.error(`      line ${h.line}: display: ${h.mode}`);
  }
  console.error(
    "\nOne class name, two components. The second inherits the first's box and breaks in a way tsc,\n" +
    "the payload parse, smoke and the design ratchet all pass. Rename one of them, or add it to\n" +
    "ALLOWED in this script WITH the reason it legitimately changes layout mode.");
  process.exit(1);
}

console.log(`css twins: ${seen.size} bare class rules with a display, none given two layout modes`);
