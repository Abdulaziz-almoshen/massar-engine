// GATE STEP 23: the JS inside every presentation literal must actually PARSE.
//
// check-crm-literals guards the STRING BOUNDARY — that a backtick has not terminated the literal
// early. Its own closing note says the rest is unguarded: "this guards the STRING boundary, not the
// CSS or JS inside it. A valid literal containing broken CSS still passes here."
//
// That gap is real and it cost a screen. A single missing backslash in an onclick — `\'` where the
// template literal needed `\\'` — emitted a bare quote that closed the JS string early. tsc was
// happy (the TypeScript is a valid string either way), check-crm-literals was happy (the literal is
// closed), and the browser threw "Unexpected identifier" at load, taking out EVERY function in the
// same script block. Not one screen worked and no gate said a word.
//
// new Function() parses without executing, which is exactly the assertion that was missing.
import fs from "node:fs";

const dist = new URL("../dist/", import.meta.url);
let bad = 0, checked = 0;
const files = fs.readdirSync(dist).filter((f) => f.endsWith(".js"));

for (const f of files) {
  const mod = await import(new URL(f, dist).href).catch(() => null);
  if (!mod) continue;
  for (const [name, val] of Object.entries(mod)) {
    if (typeof val !== "string") continue;
    if (!/_JS$/.test(name)) continue;      // the JS payloads, not the CSS ones
    checked++;
    try {
      new Function(val);
      console.log(`ok   ${f}:${name} parses (${val.length} chars)`);
    } catch (e) {
      bad++;
      console.log(`FAIL ${f}:${name} — ${e.message}`);
    }
  }
}
console.log(bad ? `\ncrm JS parse: ${bad} of ${checked} FAILED`
                : `\ncrm JS parse: all ${checked} payloads parse`);
process.exit(bad ? 1 : 0);
