// check-crm-literals.mjs — a backtick inside a *_CRM_CSS / *_CRM_JS block is a terminated string.
//
// WHY THIS EXISTS. Three times in one session a comment written INSIDE one of these template
// literals used backticks around an identifier — the natural way to quote code in prose — and each
// time it silently closed the string, turning the rest of the CSS into TypeScript. Twice tsc caught
// it. The third time the build failed and the commit landed anyway, because the build check and the
// commit were separate shell lines rather than one chained command.
//
// So the guard is not "remember not to do it". `dashboard.ts` already carries a warning comment
// saying exactly that, and it did not hold. This asserts it instead, on every `npm run check`.
//
// It also verifies the emitted modules PARSE, which is the property that actually matters: a
// broken presentation module is a blank page, and that is the failure class ADR-0001 exists for.
//
// The declaration pattern allows an optional `: string` annotation. Without that, rep-page.ts —
// declared `export const REP_PAGE_HTML: string = ` — was COUNTED as a scanned file but its literal
// was never matched, so a planted backtick sailed past while tsc caught it. A guard that reports
// a file as covered without checking it is worse than one that admits it does not.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
const c = (label, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? " — " + detail : ""}`);
};

// Every module that exports a browser payload as a template literal.
const files = readdirSync(join(root, "src"))
  .filter((f) => f.endsWith(".ts"))
  .filter((f) => /export const [A-Z_]+_(CSS|JS|HTML)\s*(?::\s*string\s*)?=\s*`/.test(readFileSync(join(root, "src", f), "utf8")));

c("found presentation modules exporting template literals", files.length > 0, `${files.length} files`);

for (const file of files) {
  const src = readFileSync(join(root, "src", file), "utf8");
  // Walk each exported template literal and confirm the block that STARTS it also ENDS it, with
  // nothing between that could have closed it early. A stray backtick shows up as a block that
  // terminates at the wrong place, so the simplest reliable test is: the emitted JS must parse.
  const blocks = [...src.matchAll(/export const ([A-Z_]+_(?:CSS|JS|HTML))\s*(?::\s*string\s*)?=\s*`/g)];
  for (const m of blocks) {
    const start = m.index + m[0].length;
    const end = src.indexOf("`;", start);
    c(`${file}: ${m[1]} is a closed literal`, end > start);
    if (end > start) {
      const body = src.slice(start, end);
      const stray = body.indexOf("`");
      c(`${file}: ${m[1]} carries no stray backtick`, stray === -1,
        stray === -1 ? "" : "at offset " + stray + ": " + JSON.stringify(body.slice(Math.max(0, stray - 40), stray + 20)));
    }
  }
}

// The property that actually matters: what tsc emitted is parseable JavaScript.
for (const file of files) {
  const out = join(root, "dist", file.replace(/\.ts$/, ".js"));
  if (!existsSync(out)) { c(`dist/${file.replace(/\.ts$/, ".js")} exists`, false, "run npm run build first"); continue; }
  try {
    execFileSync(process.execPath, ["--check", out], { stdio: "pipe" });
    c(`dist/${file.replace(/\.ts$/, ".js")} parses`, true);
  } catch (e) {
    c(`dist/${file.replace(/\.ts$/, ".js")} parses`, false, String(e.stderr || e).slice(0, 160));
  }
}

console.log(failures ? `\n${failures} FAILURES` : "\ncrm template literals: all green");
console.log("NOTE: this guards the STRING boundary, not the CSS or JS inside it. A valid literal");
console.log("      containing broken CSS still passes here; npm run smoke is what catches that.");
process.exit(failures ? 1 : 0);
