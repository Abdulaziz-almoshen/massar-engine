// Every dropdown is the design system's Select / Combobox (src/combobox-crm.ts, massar-ds/massar.css),
// measured on coss ui — the founder's reference set (2026-10-02: «the drop down … must come from the
// references I gave you … keep this as a system design»). The browser's native <select> cannot search,
// group or carry a second line, and it looks like another product beside .m-input.
//
// A RATCHET, not a ban: screens not converted yet still carry native selects. The count may only go
// down. Converting a screen lowers BASELINE in the same commit; adding a native select fails the build.
import { readFileSync, readdirSync } from "node:fs";

const BASELINE = 48;
const DONE = ["org-crm.ts", "settings-crm.ts"];   // converted screens: zero allowed, ever

let total = 0, bad = [];
for (const f of readdirSync("src").filter((f) => f.endsWith(".ts") && f !== "massar-ds-crm.ts")) {
  const n = (readFileSync("src/" + f, "utf8").match(/<select\b/g) || []).length;
  total += n;
  if (DONE.includes(f) && n) bad.push(f + " has " + n);
}
const ok = total <= BASELINE && !bad.length;
console.log((ok ? "ok  " : "FAIL") + " native <select>: " + total + " (ratchet " + BASELINE + ")" + (bad.length ? " — converted screens regressed: " + bad.join(", ") : ""));
if (total < BASELINE) console.log("     lower BASELINE to " + total + " in scripts/check-native-selects.mjs");
process.exit(ok ? 0 : 1);
