// GATE STEP: every screen the product has must be reachable from the rail.
//
// The rail went from fifteen doors to six. Everything that left kept a destination as a tab under
// a door — but that is an invariant held by two literals sitting next to each other, and nothing
// stops a later edit from dropping a route from SUBS while leaving its handler, its TITLES entry
// and its route case fully intact. The result would be a screen that still builds, still renders
// when you type its hash, and cannot be reached by anyone who does not already know it exists.
//
// tsc cannot see it. The tests cannot see it. Smoke navigates by hash, so it CANNOT see it either:
// smoke proves a screen renders, never that a human can get to it. This is the one check that does.
import fs from "node:fs";

const src = fs.readFileSync(new URL("../src/dashboard.ts", import.meta.url), "utf8");
let bad = 0;
const c = (label, ok, detail) => {
  console.log((ok ? "ok   " : "FAIL ") + label + (detail ? " — " + detail : ""));
  if (!ok) bad++;
};

const grab = (re) => { const m = src.match(re); if (!m) throw new Error("could not find " + re); return m[1]; };

const navBlock  = grab(/const NAV = \[([\s\S]*?)\n\];/);
const subsBlock = grab(/const SUBS = \{([\s\S]*?)\n\};/);
const titleBlk  = grab(/const TITLES = \{([\s\S]*?)\n\};/);

const navIds  = [...navBlock.matchAll(/\{\s*id:\s*"([a-z]+)"/g)].map((m) => m[1]);
const subIds  = [...subsBlock.matchAll(/\["([a-z]+)",/g)].map((m) => m[1]);
// TITLES keys are the screens that exist. `customer` is a detail view reached from a row, not a
// destination of its own, so it is the one legitimate exception.
const DETAIL_VIEWS = new Set(["customer"]);
// Keys anywhere in the block, NOT just at line start: several TITLES entries share a line, and a
// line-anchored pattern silently scanned 10 of 15 while reporting all green. A guard that quietly
// covers less than it claims is worse than no guard — this repo has shipped that exact bug before,
// in the backtick check that skipped rep-page.ts.
const titleKeys = [...titleBlk.matchAll(/([a-z]+):\s*\[/g)].map((m) => m[1])
  .filter((k) => !DETAIL_VIEWS.has(k));

c("the rail has exactly six doors", navIds.length === 6, navIds.join(", "));

const reachable = new Set([...navIds, ...subIds]);
const orphans = titleKeys.filter((k) => !reachable.has(k));
c("every screen is reachable from the rail", orphans.length === 0,
  orphans.length ? "UNREACHABLE: " + orphans.join(", ") + " — has a screen and a title, but no door and no tab"
                 : titleKeys.length + " screens, all reachable");

// A door listed in SUBS that is not in NAV renders a tab strip nobody can open.
const strayDoors = Object.keys(
  Object.fromEntries([...subsBlock.matchAll(/^\s{2}([a-z]+):\s*\[/gm)].map((m) => [m[1], 1])),
).filter((d) => !navIds.includes(d));
c("every door with tabs is in the rail", strayDoors.length === 0, strayDoors.join(", ") || "none stray");

// The first tab under a door must BE that door, or clicking the door lands on a screen whose own
// tab is not selected.
const firstTabWrong = [...subsBlock.matchAll(/^\s{2}([a-z]+):\s*\[\["([a-z]+)"/gm)]
  .filter((m) => m[1] !== m[2]).map((m) => m[1] + " lands on " + m[2]);
c("each door's first tab is the door itself", firstTabWrong.length === 0, firstTabWrong.join(", ") || "all six aligned");

// A route in two doors would highlight whichever DOOR_OF happened to build last.
const dupes = subIds.filter((r, i) => subIds.indexOf(r) !== i);
c("no route sits under two doors", dupes.length === 0, dupes.join(", ") || "no duplicates");

console.log(bad ? "\nnav destinations: " + bad + " FAILED" : "\nnav destinations: all green");
process.exit(bad ? 1 : 0);
