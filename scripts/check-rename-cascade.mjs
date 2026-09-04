// GATE STEP: every table keyed by PRODUCT NAME must be in the rename cascade.
//
// The product name is a string key, not an id, so it is written down in ten tables. renameTag
// updated ONE of them and returned true. Measured against Postgres: after a rename the `targets`
// row still carried the old name, and because salesPerformance joins targets ON tgt.product =
// t.name, the founder's quarterly target silently left the board while every figure still rendered.
//
// A new table with a `product` column joins that failure mode the day it is created, and nothing
// would say so: tsc sees a valid CREATE TABLE, the tests pass, and the orphaned rows only show up
// as a number that is quietly too small. This asks the schema the same question the fix was derived
// from — which tables have a `product` column — and fails until the answer is handled.
import fs from "node:fs";

const src = fs.readFileSync(new URL("../src/db.ts", import.meta.url), "utf8");
let bad = 0;
const c = (label, ok, detail) => {
  console.log((ok ? "ok   " : "FAIL ") + label + (detail ? " — " + detail : ""));
  if (!ok) bad++;
};

// Tables declared with a `product` column, from the migration bodies.
const declared = new Set();
for (const m of src.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)\s*\(([\s\S]*?)\n\);/g)) {
  if (/^\s*product\s+(TEXT|VARCHAR)/m.test(m[2])) declared.add(m[1]);
}
// …plus any added later by ALTER.
for (const m of src.matchAll(/ALTER TABLE (\w+) ADD COLUMN IF NOT EXISTS product\b/g)) declared.add(m[1]);

const listed = new Set(
  [...(src.match(/const PRODUCT_NAME_TABLES = \[([\s\S]*?)\] as const;/) ?? [])[1]
    .matchAll(/"(\w+)"/g)].map((m) => m[1]));

// `tags` keys BY name, not by a `product` column, and renameTag updates it explicitly first.
const HANDLED_ELSEWHERE = new Set(["tags"]);

const missing = [...declared].filter((t) => !listed.has(t) && !HANDLED_ELSEWHERE.has(t));
c("every table with a product column is in the rename cascade", missing.length === 0,
  missing.length ? "NOT CASCADED: " + missing.join(", ") + " — a rename will orphan these rows"
                 : declared.size + " tables declare a product column, all cascaded");

const stale = [...listed].filter((t) => !declared.has(t));
c("the cascade lists no table that no longer has the column", stale.length === 0,
  stale.join(", ") || "no stale entries");

c("the cascade runs in one transaction", /BEGIN[\s\S]{0,3000}PRODUCT_NAME_TABLES/.test(src),
  "a partial rename is worse than none");

c("the composite FK is deferred for the rename", /SET CONSTRAINTS opp_package_product_fk DEFERRED/.test(src),
  "opportunities(package_id, product) -> packages(id, product) cannot move one side at a time");

c("migration 006 made that constraint DEFERRABLE", /opp_package_product_fk[\s\S]{0,200}DEFERRABLE/.test(src),
  "SET CONSTRAINTS throws on a non-deferrable constraint");

console.log(bad ? "\nrename cascade: " + bad + " FAILED" : "\nrename cascade: all green");
process.exit(bad ? 1 : 0);
