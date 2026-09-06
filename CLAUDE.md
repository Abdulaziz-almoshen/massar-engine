# massar-engine — repo memory

> **This is a nested repo.** Full project memory, goals and safety rules live one level up in
> `../CLAUDE.md`, and working state in `../docs/STATE.md`. A session opened directly on
> `massar-engine/` does not load them automatically — read `../CLAUDE.md` first.
> This file carries only what is fatal to miss when editing this repo cold.

## The rules that bite hardest here

- **NO WHATSAPP SEND, TO ANY NUMBER, FOR ANY REASON.** Standing instruction, Aug 12 2026. Not for
  tests, not to your own phone. Lifted only when the founder names an explicit allowlist. Verify
  agent behaviour by unit test and by reading stored transcripts; if a claim can only be proven by
  sending, leave it unproven and say so.
- **`src/dashboard.ts` is a 4,127-line template literal — anchored string replacements only, never
  range edits.** A deleted helper is invisible to `tsc` and `node --check` and ships a blank page.
  See `../docs/decisions/0001-dashboard-no-range-edits.md`.
- **No backticks inside any `*-crm.ts` or `rep-page.ts` template literal**, including in comments
  quoting code. A backtick terminates the string and turns the rest into TypeScript. This has
  happened four times. `scripts/check-crm-literals.mjs` asserts it on every build.
- **A table a screen READS must have a writer shipped in the same diff**, and vice versa. Four
  tables have shipped here with no writer; one of them froze the targets screen and made a
  1,440,000 SAR won deal vanish. `tsc`, the tests, a security review and the smoke suite all pass
  against an empty table, because an empty table is a valid empty result.
  `scripts/check-ledger-writers.mjs` is gate step 18.
- **Business rules live in a pure, unit-tested `*-domain.ts`** — never in a UI or data module.
  Some are serialised to the browser via `Function.prototype.toString()`, so those functions may
  reference only their own parameters and the injected constants. See `STANDARDS.md`.

## Commands

- `npm run check` — the gate, 19 steps. Blocks a deploy. Run it before every commit.
- `npm run test:db` — the DB-backed suite. Needs `npm run db:up` first; it refuses any
  `TEST_DATABASE_URL` whose database name does not say it is for tests.
- `npm run deploy` — `check` then `fly deploy --ha=false` then `smoke`. A deploy is not done
  until smoke exits 0.

Deploy of this app is pre-authorized (founder's standing instruction, Aug 10 2026). Real-customer
sends, template submissions, data deletion and spend over $5 are not.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
