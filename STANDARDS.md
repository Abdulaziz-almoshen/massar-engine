# Technical Standards — adoption and deviation register

Source of truth: the organization's **Technical Standards** (Coding Standards v1.0, Enterprise Data
Standards, OpenAPI Validation Rules, Build Pipeline). This file records, honestly, **what this repo
complies with, what it does not, and why** — so a reviewer never has to guess whether a gap is a
decision or a defect.

> An undeclared deviation is indistinguishable from a bug. Everything below is dated and owned.

---

## Status at a glance (2026-08-24)

| § | Area | Status |
|---|---|---|
| 1 | N-Tier / UI-logic separation | 🟡 partial — new work complies, `dashboard.ts` does not |
| 2.1 | Naming | 🟡 partial — new files comply; legacy abbreviations remain |
| 2.2 | Formatters | 🔴 not adopted — see D-2 |
| 2.3 | Comments (why, not what) | 🟢 compliant |
| 3 | Git, small commits | 🟡 partial — branching/review deviate, see D-3 |
| 4 | Testing + coverage gate | 🟢 gate live and build-blocking, see D-4 for scope |
| 5 | Node 22, no APM in code | 🟢 compliant · `openapi.yaml` 🔴 absent, see D-5 |
| 6 | Database standards (SQL Server) | 🔴 mostly inapplicable + real gaps, see D-6 |
| 7 | OpenAPI validation rules | 🔴 not adopted, see D-5 |

---

## What is enforced in CI today

`npm run check` is the release gate and **it now begins with `npm test`**, so a coverage regression
blocks a deploy exactly like a failing assertion:

```
npm test                  # vitest, coverage thresholds 60% — BUILD-BLOCKING (§4.1)
npm run check:*           # 16 domain gates (catalogue, numerals, opt-out, product lock, …)
npm run smoke             # 12 real routes in a real browser; fails on a blank render
```

Current coverage on the in-scope tiers: **lines 92.85% · statements 84.03% · functions 95.12% ·
branches 70.66%** — against a 60% minimum and a 90% target.

---

## Deviation register

### D-1 · §1 N-Tier — partial. `dashboard.ts` is not tiered.
**State.** `src/opps-domain.ts` is a real business tier: pure rules, no UI, unit-tested, and shipped
to the browser as one compiled copy via `OPPS_DOMAIN_JS` so the two runtimes cannot drift.
`src/dashboard.ts` (3,944 lines) and the `*-crm.ts` modules remain one template literal mixing all
three tiers.
**Why not fixed today.** Rewriting that file is a rewrite of the product's entire UI, and ADR-0001
records that range edits there have already shipped a blank page with `tsc` and `node --check` both
green. It is a planned migration, not a cleanup.
**Compensating control.** `npm run smoke` executes twelve real routes in a browser and fails on a
blank render — the failure mode that tier actually has.
**Exit.** Each new surface extracts its rules to a `*-domain.ts` first, as فرص البيع just did.
Migrate existing surfaces opportunistically (§3 Boy Scout Rule), never by bulk edit.

### D-2 · §2.2 Formatters — not adopted repo-wide.
**Why.** Running Prettier across 13k lines would reformat `dashboard.ts`, whose client script lives
inside a template literal; a reflow there is exactly the ADR-0001 blank-page class, and the diff
would be unreviewable.
**Partial compliance.** New files are hand-held to the standard (spaces, ≤120 cols, blank-line
paragraphing). 1,338 legacy lines exceed 120 characters.
**Exit.** Adopt Prettier scoped to `src/*-domain.ts` and `tests/**` first, widening only as files
are migrated under D-1.

### D-3 · §3 Branching and review — single-operator deviation.
**State.** Commits go directly to `master`; there is no second developer to review.
**Why.** One operator, one repo. Git Flow with a mandatory second reviewer cannot be satisfied.
**Compensating control.** Every change passes the gate chain above before deploy, and each cycle is
reviewed by the Orbit reviewer/QA/safety roles with the evidence recorded in `.orbit/STATE.md`.
**Exit.** Adopt feature branches + PRs the moment a second engineer joins.

### D-4 · §4 Coverage scope — declared, not silent.
Thresholds apply to `opps-domain.ts`, `facts.ts`, `audience.ts`. Excluded, with reasons a reviewer
can check, in `vitest.config.ts`:
- `dashboard.ts` / `*-crm.ts` — presentation strings; no unit to call (covered by smoke).
- `db.ts`, `index.ts` — Postgres and Fastify IO. §4.3 forbids mocking infrastructure, so these need
  **Testcontainers**. Their *pure* parts (`validateOppLine`) are tested regardless.
- `insights.ts`, `agent.ts`, `gupshup.ts`, `outbound.ts`, `tracker.ts` — model and network adapters,
  same rule. Pure helpers are tested.
**Exit — the next slice.** Testcontainers Postgres, at which point `db.ts` and `index.ts` join the
threshold list. Until then this exclusion is a stated claim, not a way to make 60% cheaper.

### D-5 · §5/§7 `openapi.yaml` and the OpenAPI rules — absent.
**State.** No `openapi.yaml`. The admin API also breaks several CRITICAL/HIGH rules today:
`POST /admin/opps` returns **200, not 201**, with no `Location`; errors are bare JSON rather than
RFC 9457 `application/problem+json`; there is no `Idempotency-Key`, no rate-limit, cache or
versioning headers; `401`/`403`/`429` are undocumented.
**Why not fixed today.** These are *internal* admin endpoints behind `x-admin-token`, consumed only
by this repo's own dashboard — no external client depends on the contract yet. Rewriting the
response shape is a breaking change to the UI and belongs in one deliberate slice.
**Exit — proposed order.** (1) author `openapi.yaml` describing what exists; (2) fix the
release-blocking CRITICAL/HIGH set — 201+`Location`, `problem+json`, documented `401/403/429`,
`Idempotency-Key` on the create path; (3) wire the 55-rule validator into `npm run check`.

### D-6 · §6 Database — different engine, plus real gaps.
**Engine.** This service runs **PostgreSQL on Fly**, not SQL Server. `IDENTITY` vs sequences,
`NVARCHAR`, `datetime2(7)`, `SET NOCOUNT ON`, `usp_`/`fn_`/`v_` prefixes and SQL Agent are
SQL-Server-specific and have no Postgres equivalent to comply with. **This needs a ruling from the
standards owner**, not a unilateral decision here.

Rules that DO port, and where this repo stands:

| Rule | State |
|---|---|
| `ORDER BY id DESC` only | 🟡 `listOpps` complies; 4 queries sort by timestamp |
| No JSON blobs in the DB | 🔴 9 `JSONB` columns (`facts`, `attrs`, `product_tags`, …) |
| No files in the DB | 🔴 `product_assets.bytes BYTEA` stores uploaded PDFs |
| Explicit column lengths | 🔴 57 unbounded `TEXT` columns |
| PascalCase singular tables | 🔴 0 of 15 (all snake_case plural) |
| `CreatedAt`/`UpdatedAt` | 🟡 present as `created_at`/`updated_at` `BIGINT` epoch-ms, not `datetime2(7)` |
| Migration tool (Liquibase/Flyway) | 🔴 hand-rolled idempotent `MIGRATION` string |
| Parameterized queries, no dynamic SQL | 🟢 compliant throughout |
| ACID / set-based / ≥3NF | 🟢 compliant |
| ≤30 columns, ≤5 FKs per table | 🟢 compliant |

**Why not fixed today.** Renaming every table and column, retyping every timestamp and bounding
every `TEXT` is a schema rewrite plus a data migration against a live ledger holding real campaigns
and conversations. It is a project with a rollback plan, not a refactor.
**Exit.** Get the Postgres ruling first (does §6 apply, and in what translation?). Then: adopt a
migration tool, and apply naming/typing via **Expand and Contract** so nothing breaks mid-deploy.

---

## Rules that bind every change from now on

Cheap, and no reason to defer:
1. New business rules go in a `*-domain.ts` — pure, no UI, unit-tested (§1, §4).
2. New code follows §2.1 naming: `is`/`has`/`can` booleans, verb functions, `get` for retrieval,
   kebab-case files, no ambiguous abbreviations.
3. Comments explain **why**; no commented-out code (§2.3) — already the house style.
4. `npm test` must pass before deploy; it is first in `npm run check` (§4.1).
5. No Elastic APM package or config (§5) — the platform injects it.
6. Node 22 (§5).
7. Any new endpoint is designed to the §7 CRITICAL/HIGH rules even before `openapi.yaml` exists —
   `201` + `Location` on creation, `problem+json` errors, documented `401/403/429`.
