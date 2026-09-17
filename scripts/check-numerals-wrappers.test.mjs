// Does the widened blankFormatted still catch what it must?
import { readFileSync } from "node:fs";
const src = readFileSync("scripts/check-numerals.mjs", "utf8");
const m = src.match(/const WRAPPERS = \[[^\]]*\];[\s\S]*?\n}\n/);
const fn = new Function(m[0] + "; return blankFormatted;")();
const cases = [
  ['" · " + mN(x) + " ك.ب"',            true,  "mN is accepted"],
  ['" · " + dsFig("k", x) + " بند"',    true,  "dsFig is accepted"],
  ['" · " + fmtN(x) + " ر.س"',          true,  "fmtN still accepted"],
  ['" · " + Math.roundmN(x) + " ر.س"',  false, "glued Math.roundmN must NOT be accepted"],
  ['" · " + a.mN(x) + " ر.س"',          false, "member call a.mN must NOT be accepted"],
  ['" · " + x.length + " بند"',         false, "raw .length must NOT be accepted"],
];
let bad = 0;
for (const [line, shouldBlank, why] of cases) {
  const out = fn(line);
  // "accepted" = the checker rewrote the call away. If the line is unchanged, it was not
  // recognised, which is the correct outcome for a glued or member-call lookalike.
  const accepted = out !== line;
  const ok = accepted === shouldBlank;
  if (!ok) bad++;
  console.log((ok ? "ok   " : "FAIL ") + why + "   -> " + out);
}
process.exit(bad ? 1 : 0);
