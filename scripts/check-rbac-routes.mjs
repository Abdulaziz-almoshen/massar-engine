// GATE STEP: every /admin route registered in src/index.ts names the permission it needs in rbac-domain (S7).
//
// An unlisted route is refused to every role but the system administrator, so forgetting one fails CLOSED —
// but it fails silently: a sales user meets a 403 on a screen that looks finished. This makes the omission loud
// at build time instead, and catches the opposite drift too (a permission row for a route that no longer exists).
import fs from "node:fs";
const src = fs.readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
const dom = fs.readFileSync(new URL("../src/rbac-domain.ts", import.meta.url), "utf8");
const registered = [...src.matchAll(/app\.(get|post|put|patch|delete)\("(\/admin\/[^"]*)"/g)].map((m) => m[1].toUpperCase() + " " + m[2]);
const listed = [...dom.matchAll(/method: "(\w+)", url: "([^"]+)"/g)].map((m) => m[1] + " " + m[2]);
const unlisted = registered.filter((r) => !listed.includes(r));
const stale = listed.filter((r) => !registered.includes(r));
let bad = 0;
const c = (label, ok, detail) => { console.log((ok ? "ok   " : "FAIL ") + label + (detail ? " — " + detail : "")); if (!ok) bad++; };
c("every /admin route names its permission", unlisted.length === 0, unlisted.join(", "));
c("no permission row for a route that does not exist", stale.length === 0, stale.join(", "));
console.log(bad ? "\nrbac routes: " + bad + " FAILED" : "\nrbac routes: all green (" + registered.length + " routes)");
process.exit(bad ? 1 : 0);
