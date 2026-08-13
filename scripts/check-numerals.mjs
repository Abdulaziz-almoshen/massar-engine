#!/usr/bin/env node
// One numeral system, enforced — because six review rounds proved it will not hold by intent.
//
// The failure mode is never the screen someone is looking at. It is the adjacent screen (rounds
// 17-18) or the adjacent STATE (round 19: a card that only renders once a contact passes 24h
// idle, invisible to any count taken before then). A rendered-DOM audit cannot see those; only
// reading the source can.
//
// Rule: every number that reaches Arabic UI text goes through fmtN(). Raw concatenation of a
// numeric expression into a string is the defect this catches.
//
// Usage:  npm run check:numerals   → exit 1 and print file:line for each raw concat.
import { readFileSync } from "node:fs";

const FILE = "src/dashboard.ts";
const src = readFileSync(FILE, "utf8").split("\n");

// A numeric-looking expression concatenated straight into a quoted string.
const NUMERIC = String.raw`(?:Math\.(?:round|floor|ceil|abs)\(.*?\)|[\w$]+(?:\.[\w$]+)*\.(?:length|count|score)\b|\bLIST_CAP\b)`;
// Only unambiguously-numeric shapes. Array indexing (m2[0], r[1]) is deliberately NOT here:
// this file uses it for string lookups far more often than for numbers, so including it turned
// the check into noise — and a check that cries wolf gets muted, which is how the class returns.
const RAW = [
  new RegExp(NUMERIC + String.raw`\s*\+\s*["']`),
  new RegExp(String.raw`["']\s*\+\s*` + NUMERIC + String.raw`\s*\+`),
];
// width:' + w + '%  ·  height:' + n + 'px  — CSS, not UI copy.
const CSS_CTX = /(?::\s*["']?\s*\+|\+\s*["'](?:%|px|em|rem|fr|deg|s\b|;))/;
// Percent glyph: the product's convention is ٪ (U+066A) beside Arabic-Indic digits.
const LATIN_PCT = /["'][^"']*%<\/(?:span|div)>/;


// Remove every fmtN(...) span, counting parens so arbitrarily nested arguments are handled.
// A regex cannot do this: fmtN(Math.round((a - b) / c)) is three levels deep, and the naive
// pattern both missed real defects and flagged already-correct lines.
function blankFormatted(line) {
  let out = "", i = 0;
  while (i < line.length) {
    const at = line.indexOf("fmtN(", i);
    if (at === -1) { out += line.slice(i); break; }
    // Require a left boundary. Without it "Math.roundfmtN(" blanks to "Math.roundN" and the
    // check clears a line that throws at runtime — exactly what shipped at aed03a3, concealed
    // by this very function.
    if (at > 0 && /[\w$.]/.test(line[at - 1])) { out += line.slice(i, at + 5); i = at + 5; continue; }
    out += line.slice(i, at) + "N";
    let depth = 0, j = at + 4;
    for (; j < line.length; j++) {
      if (line[j] === "(") depth++;
      else if (line[j] === ")") { depth--; if (depth === 0) { j++; break; } }
    }
    i = j;
  }
  return out;
}

const hits = [];
src.forEach((line, i) => {
  if (/^\s*(\/\/|\*)/.test(line)) return;                 // comments
  // Do NOT skip a line just because it contains fmtN somewhere — one formatted value on a
  // line says nothing about the next value on the same line. Blank the formatted spans and
  // test what is left.
  line = blankFormatted(line);
  if (line.includes("check:numerals")) return;
  for (const re of RAW) {
    const m = re.exec(line);
    if (!m) continue;
    const around = line.slice(Math.max(0, m.index - 24), m.index + m[0].length + 8);
    if (CSS_CTX.test(around)) continue;              // a CSS length/percentage, not UI copy
    hits.push([i + 1, "raw number concatenated into UI text", line.trim().slice(0, 96)]);
    return;
  }
  if (LATIN_PCT.test(line)) hits.push([i + 1, "Latin % glyph in UI text (use ٪)", line.trim().slice(0, 96)]);
});

// A mangled identifier is not a numeral defect, so the rules above cannot see it — and at
// aed03a3 `Math.round(x).toLocaleString(...)` was rewritten to `Math.roundfmtN(x)`, which is
// syntactically valid, type-checks, passes node --check, and throws at runtime inside the client
// template string. Verify every Math.<name> actually exists on Math.
const MATH_OK = new Set(Object.getOwnPropertyNames(Math));
src.forEach((line, i) => {
  if (/^\s*(\/\/|\*)/.test(line)) return;
  for (const m of line.matchAll(/\bMath\.([A-Za-z_$][\w$]*)/g)) {
    if (!MATH_OK.has(m[1])) hits.push([i + 1, `Math.${m[1]} does not exist — this throws at runtime`, line.trim().slice(0, 96)]);
  }
});

if (hits.length) {
  console.error(`numeral-consistency check failed — ${hits.length} site(s) in ${FILE}:\n`);
  for (const [ln, why, text] of hits) console.error(`  ${FILE}:${ln}  ${why}\n     ${text}\n`);
  console.error("Wrap the value in fmtN(). Rendered-DOM audits miss state-gated cards; this does not.");
  process.exit(1);
}
console.log(`numeral regression-lock clear: ${FILE} has none of the shapes this check knows.\nNOTE: this is a regression lock, not a property check — it catches the defect shapes prior\nreview rounds named (raw concat of .length/.count/.score/Math.*/LIST_CAP, Latin % in markup,\nnon-existent Math methods). It does NOT prove every number routes through fmtN(); a review\nwrote 21 mutations and 18 passed. Treat a clean run as "no known regression", not "correct".`);
