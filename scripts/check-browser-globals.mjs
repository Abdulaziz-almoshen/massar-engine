// GATE STEP 24: no two top-level declarations in the dashboard's page script share a name.
//
// The dashboard is one classic script assembled from many modules: the pure *-domain.ts rules are
// serialised with Function.prototype.toString() and concatenated beside the *-crm.ts payloads. In a
// classic script a second `function f()` silently REPLACES the first — no error, no warning.
//
// That is how products V5 shipped with every coverage figure reading «—»: product-domain.ts
// exported coveragePct(achieved, target), sales-domain.ts exported coveragePct(achieved,
// weightedOpen, target), and the sales payload was concatenated after the product one. The unit
// test proved the two-argument rule in Node; the browser ran the three-argument one with
// target=undefined. tsc, the tests, the parse gate and smoke all passed.
//
// This parses every inline script in DASHBOARD_HTML (TypeScript's parser, no execution) and fails
// on any top-level function/var/let/const/class name declared more than once.
import ts from "typescript";

const { DASHBOARD_HTML } = await import(new URL("../dist/dashboard.js", import.meta.url).href);

const scripts = [];
const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi;
let m;
while ((m = re.exec(DASHBOARD_HTML))) {
  const attrs = m[1] || "";
  if (/\bsrc=/.test(attrs) || /type=["']?(module|application\/json|text\/template)/.test(attrs)) continue;
  scripts.push(m[2]);
}

const seen = new Map(); // name -> [where...]
const note = (name, where) => { if (!seen.has(name)) seen.set(name, []); seen.get(name).push(where); };

scripts.forEach((src, si) => {
  const sf = ts.createSourceFile("page-" + si + ".js", src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  // TypeScript's parser recovers from syntax errors and would still list names; a script that does
  // not parse is its own failure, and the name list from it cannot be trusted.
  if (sf.parseDiagnostics && sf.parseDiagnostics.length) {
    const d = sf.parseDiagnostics[0];
    const lc = sf.getLineAndCharacterOfPosition(d.start);
    console.log("FAIL script " + si + " does not parse at line " + (lc.line + 1) + ": " + ts.flattenDiagnosticMessageText(d.messageText, " "));
    process.exit(1);
  }
  for (const st of sf.statements) {
    const line = sf.getLineAndCharacterOfPosition(st.getStart()).line + 1;
    const where = "script " + si + " line " + line;
    if (ts.isFunctionDeclaration(st) && st.name) note(st.name.text, where);
    else if (ts.isClassDeclaration(st) && st.name) note(st.name.text, where);
    else if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) note(d.name.text, where);
    }
  }
});

const dups = [...seen.entries()].filter(([, w]) => w.length > 1);
for (const [name, w] of dups) console.log("FAIL " + name + " declared " + w.length + "× — " + w.join(", "));
console.log(dups.length
  ? "\nbrowser globals: " + dups.length + " name(s) declared more than once — the later one silently wins"
  : "browser globals: " + seen.size + " top-level names across " + scripts.length + " script(s), none duplicated");
process.exit(dups.length ? 1 : 0);
