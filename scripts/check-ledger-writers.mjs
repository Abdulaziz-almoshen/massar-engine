// check-ledger-writers.mjs — a table the product READS must have something that WRITES it.
//
// WHY THIS EXISTS. «المستهدفات والأداء» shipped reading track_stage_events, and the only INSERT
// into that table was the one-time migration backfill. So a rep marking a deal won moved
// opportunities.stage, wrote no event, and the deal left the open pipeline without arriving in
// «المحقق». Measured before the fix: a 1,440,000 SAR deal PATCHed to won, achieved unchanged,
// openCount 3 -> 2. The money vanished, and «المحقق» was frozen at migration-day values forever.
//
// Nothing caught it. Not tsc, not the tests, not the security review, not the smoke suite — every
// one of them passes against an empty table, because an empty table is a valid empty result.
//
// This is the same defect class the project already knows by name: a value the system emits but
// cannot read back. The lesson written down when outbound.ts was found bypassed applies here too —
// "a policy everyone must remember is a policy that has already failed here once" — so it is
// asserted on every build instead of remembered.

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dbSrc = readFileSync(join(root, "src", "db.ts"), "utf8");
const lines = dbSrc.split("\n");

let failures = 0;
const c = (label, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? " — " + detail : ""}`);
};

// Schema DDL and migration bodies are not writers: they create the table and backfill it once.
// A writer is an INSERT/UPDATE that runs when a USER does something.
const migrationRanges = [];
let start = -1;
lines.forEach((l, i) => {
  if (/^const MIGRATION = `/.test(l) || /^const MIGRATIONS(:|\s)/.test(l)) start = i;
  if (start >= 0 && i > start && (/^`;/.test(l) || /^\];/.test(l))) { migrationRanges.push([start, i]); start = -1; }
});
const inMigration = (i) => migrationRanges.some(([a, b]) => i >= a && i <= b);

c("located the migration regions to exclude", migrationRanges.length >= 2,
  migrationRanges.map(([a, b]) => `${a + 1}-${b + 1}`).join(", "));

// Tables the shipped screens read. A read with no writer is a screen that shows migration-day
// values forever. Add a table here when a screen starts reading it.
const MUST_HAVE_WRITERS = ["track_stage_events", "opportunities", "targets", "pipeline_stages", "pipelines"];

for (const table of MUST_HAVE_WRITERS) {
  const writers = [];
  lines.forEach((l, i) => {
    if (inMigration(i)) return;
    if (new RegExp(`INSERT INTO ${table}\\b`).test(l) || new RegExp(`UPDATE ${table}\\b`).test(l)) {
      writers.push(i + 1);
    }
  });
  c(`${table} has a runtime writer`, writers.length > 0,
    writers.length ? `db.ts:${writers.join(", ")}` : "ONLY the migration writes it — every screen reading it is frozen");
}

// The specific regression that cost a 1.44M deal: the stage writer must live in updateOpp, in the
// same transaction as the UPDATE. A writer somewhere else in the file is not the same guarantee.
const upd = dbSrc.slice(dbSrc.indexOf("export async function updateOpp"));
const updBody = upd.slice(0, upd.indexOf("\n}\n") + 1);
c("updateOpp itself writes the stage ledger", /INSERT INTO track_stage_events/.test(updBody));
c("updateOpp does it inside a transaction", /BEGIN/.test(updBody) && /COMMIT/.test(updBody));
c("updateOpp only logs a REAL transition", /!==\s*fromStage|toStage !== fromStage/.test(updBody));

console.log(failures ? `\n${failures} FAILURES` : "\nledger writers: all green");
process.exit(failures ? 1 : 0);
