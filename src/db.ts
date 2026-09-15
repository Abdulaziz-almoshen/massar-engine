import pg from "pg";
import { createHash } from "node:crypto";
import * as facts from "./facts.js";
import { SALES_STAGES, SECTORS, PRODUCT_SECTOR } from "./sales-domain.js";
import * as sales from "./sales-domain.js";
import * as acct from "./account-domain.js";

// ---------------------------------------------------------------------------
// Shadow ledger (architecture §5, first slice): Postgres persistence for the
// tracker. Memory remains the read path; every mutation dual-writes here
// best-effort, and boot hydrates memory from these tables — so a deploy or
// restart no longer wipes conversations. DB absent/down → memory-only, logged,
// never crashes the engine. Campaigns/outbox tables come with the campaign
// engine slice, not this one.
// ---------------------------------------------------------------------------

let pool: pg.Pool | null = null;
let connected = false;
let migrated = false;

export function enabled(): boolean { return Boolean(process.env.DATABASE_URL); }
export function isConnected(): boolean { return connected; }

/**
 * Callbacks for the moment `connected` flips back true AFTER boot. Boot's own hydration sequence
 * runs before anything is registered here, so a clean boot fires nothing; these exist for the two
 * ways the pool comes back mid-life — a reprobe after a drop, or the retry loop below rescuing a
 * boot that raced a Postgres restart (Aug 19–23, 2026: the engine served an empty ledger for 3.7
 * days while Postgres sat healthy, because nothing on the read path ever probed again).
 */
const reconnectCbs: Array<() => void> = [];
export function onReconnect(cb: () => void): void { reconnectCbs.push(cb); }
function markConnected(): void {
  if (connected) return;
  connected = true;
  for (const cb of reconnectCbs) { try { cb(); } catch { /* the callback logs its own failures */ } }
}

/**
 * Re-test a pool that the error handler latched OFF.
 *
 * `connected` was one-way: `pool.on("error")` flips it false when the backend drops, and nothing
 * flipped it back, so a routine Postgres failover left every write refused until the PROCESS
 * restarted — while the panel printed «أعد المحاولة», an instruction it could not honour. QA
 * measured this: three retries after a verified `pg_isready`, three 503s.
 *
 * One cheap round trip, only on the path that would otherwise refuse. Returns the live state.
 */
async function reprobe(): Promise<boolean> {
  if (connected) return true;
  if (!pool || !enabled()) return false;
  try {
    await pool.query("SELECT 1");
    // A boot whose init() died mid-migration reaches here with tables possibly missing — finish
    // the job before declaring the pool usable, or every read after "recovery" would still throw.
    if (!migrated) { await runMigrations(pool); migrated = true; }
    markConnected();
    console.log(JSON.stringify({ at: "db", msg: "reconnected after a pool error" }));
  } catch {
    connected = false;                                  // still down; the caller reports it honestly
  }
  return connected;
}

// reprobe() used to run only on the outbox write path (line ~330), so an idle engine with a
// latched-off pool never recovered and every dashboard read returned [] until a human restarted
// the machine. One cheap probe every 30s bounds the outage instead; if boot's init() never even
// built a pool, retry init() whole.
setInterval(() => {
  if (!enabled() || connected) return;
  if (pool) void reprobe();
  else void init();
}, 30_000).unref();

const MIGRATION = `
CREATE TABLE IF NOT EXISTS contacts (
  phone          TEXT PRIMARY KEY,
  wa_name        TEXT,
  first_seen_at  BIGINT NOT NULL,
  last_event_at  BIGINT NOT NULL,
  status_times   JSONB  NOT NULL DEFAULT '{}'::jsonb,
  outcome        TEXT,
  outcome_reason TEXT,
  opted_out      BOOLEAN NOT NULL DEFAULT FALSE,
  human          BOOLEAN NOT NULL DEFAULT FALSE,
  agent_turns    INT NOT NULL DEFAULT 0,
  last_error     TEXT
);
-- Enrichable client record (cycle crm-record). ONE JSONB column holding the six typed properties
-- with their provenance. It is written ONLY by upsertProps() below and is deliberately absent from
-- upsertContact's INSERT/ON CONFLICT — scheduled_said needed a COALESCE because it rides the shared
-- upsert; props avoids that trap entirely by never riding it. A typed fact must not be nullable by
-- an unrelated delivery receipt.
-- MUST stay immediately after the CREATE above (§90's warning): the whole schema runs as ONE simple
-- query, so an ALTER on a table that does not exist yet aborts every statement after it.
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS props JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE IF NOT EXISTS messages (
  id    BIGSERIAL PRIMARY KEY,
  phone TEXT NOT NULL,
  role  TEXT NOT NULL,
  text  TEXT NOT NULL,
  ts    BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_phone_ts ON messages(phone, ts);
CREATE TABLE IF NOT EXISTS interest_tags (
  id      BIGSERIAL PRIMARY KEY,
  phone   TEXT NOT NULL,
  product TEXT NOT NULL,
  level   TEXT NOT NULL,
  ts      BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  id    BIGSERIAL PRIMARY KEY,
  phone TEXT NOT NULL,
  kind  TEXT NOT NULL,
  note  TEXT,
  ts    BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind);
CREATE TABLE IF NOT EXISTS entities (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  phone      TEXT NOT NULL UNIQUE,
  size       TEXT,
  city       TEXT,
  attrs      JSONB NOT NULL DEFAULT '{}',
  created_at BIGINT NOT NULL
);
ALTER TABLE entities ADD COLUMN IF NOT EXISTS attrs JSONB NOT NULL DEFAULT '{}';
-- Account facts with provenance (cycle account-graph). Distinct from attrs on purpose: attrs is
-- whatever columns the spreadsheet happened to carry, facts are the TYPED, sourced things the
-- agent is allowed to state back to a customer. See src/facts.ts for the contract.
ALTER TABLE entities ADD COLUMN IF NOT EXISTS facts JSONB NOT NULL DEFAULT '{}';
-- Operator-applied product targeting. A THIRD store on purpose, and none of the other two can
-- carry it: attrs is whatever the spreadsheet happened to contain, facts are typed claims about the
-- customer's own operation that the agent may state back to them, and contacts.tags is the agent's
-- reading of a conversation. This is none of those — it is «I decided these accounts are the ones
-- to approach about X», an internal label with no claim about the customer at all. Mailchimp draws
-- exactly this line between a Group (the customer selects it) and a Tag (your team applies it).
ALTER TABLE entities ADD COLUMN IF NOT EXISTS product_tags JSONB NOT NULL DEFAULT '[]';
-- THE TAG REGISTRY. entities.product_tags used to be validated against Lean's health-service
-- catalogue, hard-coded in insights.ts — which made it a product FILTER, not a tagging system: no
-- operator could add a label, so a second department with its own product line had nothing to tag
-- with. Free text is not the fix; two people typing «عيادات الأسنان» and «عيادات أسنان» split one
-- list in silence, which is the emitted-value-unreadable defect wearing a different hat.
-- The registry gives both properties at once: creating a tag is a deliberate act, applying one is
-- always a selection from what exists, and the write path still validates against a CLOSED list —
-- one the operator can extend. Rename and delete exist because near-duplicates happen anyway and
-- the way out must not lose the accounts already tagged.
CREATE TABLE IF NOT EXISTS tags (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  created_at BIGINT NOT NULL,
  created_by TEXT
);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS test BOOLEAN NOT NULL DEFAULT FALSE;
-- The founder's primary outcome had nowhere to live: two of four real conversations already
-- contained a customer-stated time («صباح», «صباحًا») and the system recorded neither.
-- scheduled_said holds the customer's VERBATIM words; scheduled_at is only what we read them as.
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS scheduled_said TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS scheduled_at BIGINT;
-- Which customer turn justifies the outcome. An outcome with no quotable source is an assertion.
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS outcome_evidence TEXT;
-- ---------------------------------------------------------------------------
-- Tasks and notes (cycle massar-entities). Ported from Frappe's CRM Task and FCRM Note, which
-- carry (title, priority, status, start_date, due_date, description, assigned_to) and
-- (title, content) respectively, both linked by (reference_doctype, reference_docname).
--
-- Massar's linkable things are a CONTACT (phone) and a CAMPAIGN (id), so the polymorphic link is
-- stored as ref_kind + ref_id rather than Frappe's doctype pair, and ref_kind is CHECK-constrained
-- to the two that exist. A third kind must add a constraint, not a convention.
--
-- assigned_to is deliberately a free TEXT name and NOT a users FK: Massar has one operator and one
-- admin token, so a users table would be a join to a single row. Recording WHO in text keeps the
-- field honest today and does not pretend a permission model exists.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
  id          BIGSERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'todo'
              CHECK (status IN ('backlog','todo','in_progress','done','canceled')),
  -- nullable ON PURPOSE: a defaulted priority is a value nobody chose. NULL renders «—».
  priority    TEXT CHECK (priority IN ('low','medium','high')),
  start_at    BIGINT,
  due_at      BIGINT,
  assigned_to TEXT,
  ref_kind    TEXT CHECK (ref_kind IN ('contact','campaign')),
  ref_id      TEXT,
  created_at  BIGINT NOT NULL,
  updated_at  BIGINT NOT NULL,
  done_at     BIGINT
);
CREATE INDEX IF NOT EXISTS idx_tasks_ref ON tasks(ref_kind, ref_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_at);

CREATE TABLE IF NOT EXISTS notes (
  id         BIGSERIAL PRIMARY KEY,
  title      TEXT,
  content    TEXT NOT NULL,
  ref_kind   TEXT CHECK (ref_kind IN ('contact','campaign')),
  ref_id     TEXT,
  author     TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notes_ref ON notes(ref_kind, ref_id);

CREATE TABLE IF NOT EXISTS contact_insights (
  phone       TEXT PRIMARY KEY,
  data        JSONB NOT NULL,
  turns_at    INT NOT NULL,
  computed_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS campaigns (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  product    TEXT,
  message    TEXT,
  created_at BIGINT NOT NULL
);
-- A campaign was only "sandbox" if every target happened to be a test contact, so a real launch
-- used as a rehearsal had nowhere to be filed. This makes it an explicit property.
-- MUST stay AFTER the CREATE above: this whole schema runs as ONE simple query, so an ALTER on a
-- table that does not exist yet aborts every statement after it — on a fresh or restored database
-- that means no tables, connected=false, and the engine silently running memory-only.
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS test BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE IF NOT EXISTS campaign_targets (
  campaign_id BIGINT NOT NULL,
  phone       TEXT NOT NULL,
  name        TEXT,
  PRIMARY KEY (campaign_id, phone)
);
CREATE TABLE IF NOT EXISTS product_assets (
  product      TEXT PRIMARY KEY,
  public_id    TEXT NOT NULL UNIQUE,
  filename     TEXT NOT NULL,
  content_type TEXT NOT NULL,
  bytes        BYTEA NOT NULL,
  updated_at   BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS product_kb (
  product         TEXT PRIMARY KEY,
  md              TEXT NOT NULL,
  source_filename TEXT,
  updated_at      BIGINT NOT NULL
);
-- ---------------------------------------------------------------------------
-- فرص البيع — the opportunity ledger (cycle opps-board). The prototype's own model, taken whole:
-- «فرصة = عميل + عدة منتجات», so ONE ROW IS ONE PRODUCT LINE and the board groups lines by account.
-- A group is not a table: it is COALESCE(phone, name), computed on read, which is why moving one
-- line to a different stage can never desynchronise a stored rollup from its lines.
--
-- WHY THIS IS STORED WHILE contacts' CRM STAGE IS DERIVED. The pipeline stage of a CONVERSATION is
-- readable from the ledger — a reply exists or it does not — so storing it could only let it drift.
-- A deal's stage cannot be read from anything we hold: «التقييم الفني والمالي» is a fact about a
-- meeting nobody in this system witnessed. It is a human's claim, so it is stored WITH its author
-- (created_by) and the moment it was last moved (stage_at), and «متوقّف» is derived from stage_at
-- rather than typed by anyone.
--
-- source is the founder's own distinction and the reason this table is not merely a view over
-- contacts: «sometimes the opportunity comes from whatsapp campaign and sometimes we call them or
-- visit them and record the client in our massar». A whatsapp line carries the campaign it came
-- from in source_ref; a visit carries nothing, which is honest — nobody logged the visit here.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opportunities (
  id           BIGSERIAL PRIMARY KEY,
  account_name TEXT NOT NULL,
  -- nullable ON PURPOSE: an account recorded after a visit may have no WhatsApp number at all, and
  -- a defaulted empty string would silently group every such account into one card.
  phone        TEXT,
  product      TEXT NOT NULL,
  stage        TEXT NOT NULL DEFAULT 'contact'
               CHECK (stage IN ('contact','present','tech','negotiate','won','lost')),
  source       TEXT NOT NULL DEFAULT 'other'
               CHECK (source IN ('whatsapp','call','visit','referral','inbound','other')),
  source_ref   TEXT,
  sale_price   BIGINT NOT NULL DEFAULT 0,
  years        INT NOT NULL DEFAULT 1,
  qty          INT NOT NULL DEFAULT 1,
  discount     INT NOT NULL DEFAULT 0,
  owner        TEXT,
  close_on     BIGINT,
  next_step    TEXT,
  lost_reason  TEXT,
  created_by   TEXT,
  created_at   BIGINT NOT NULL,
  updated_at   BIGINT NOT NULL,
  stage_at     BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_opps_phone ON opportunities(phone);
-- THE ONCE-ONLY LEDGER for automatic creation. A hot reading opens an opportunity by itself, and
-- the hard part is not creating it — it is never creating it TWICE, and never RESURRECTING one a
-- human deleted on purpose. Both are the same guarantee, and it cannot live in the opportunities
-- table itself: a deleted row is exactly the state that must still block a second attempt.
-- INSERT … ON CONFLICT DO NOTHING RETURNING makes the claim atomic, so two webhook turns arriving
-- together cannot both win it. The primary key IS the rule.
CREATE TABLE IF NOT EXISTS opp_auto (
  phone   TEXT NOT NULL,
  product TEXT NOT NULL,
  ts      BIGINT NOT NULL,
  opp_id  BIGINT,
  PRIMARY KEY (phone, product)
);
`;

// ---------------------------------------------------------------------------
// Versioned migrations.
//
// WHY THIS EXISTS. Everything above is one idempotent string of CREATE TABLE IF NOT EXISTS, which
// is fine for adding a table and useless for CHANGING one: `IF NOT EXISTS` alters no existing
// CHECK, and re-running an ALTER fails. The commercial engine has to widen
// `opportunities_stage_check` from six stages to eight on live rows, so the engine needs to know
// what it has already applied.
//
// It also closes a race the review found: the 30-second reprobe timer can call the migration while
// init() is still inside it, because `pool` exists while `migrated` is still false. The advisory
// lock serialises that — one connection runs migrations, the other waits and then finds them
// applied. Two machines during a deploy are covered by the same lock.
//
// Each step runs in ONE transaction with its version stamp, so a step either lands completely or
// not at all. A half-applied schema is the failure this replaces.

/** Arbitrary but fixed: the lock key for schema work on this database. */
const MIGRATION_LOCK_KEY = 0x6d61_7361; // "masa"

/** Ordered, append-only. NEVER edit or renumber a shipped step — add a new one. */
const MIGRATIONS: readonly { version: string; sql: string }[] = [
  {
    version: "002-commercial-engine",
    sql: `
-- The eight-stage ladder, as data rather than a hardcoded enum.
CREATE TABLE IF NOT EXISTS pipelines (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  product    TEXT,                       -- NULL = the default ladder every product inherits
  created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id          BIGSERIAL PRIMARY KEY,
  pipeline_id BIGINT NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,
  label       TEXT NOT NULL,
  weight_pct  INT  NOT NULL CHECK (weight_pct BETWEEN 0 AND 100),
  position    INT  NOT NULL,
  exit_criterion TEXT,
  UNIQUE (pipeline_id, key)
);

-- THE LEDGER. Append-only. Without it the engine cannot answer "which deals were won in Q1":
-- opportunities.stage_at is the moment the stage LAST MOVED and is overwritten by any later edit,
-- and close_on is a PLANNED date. Every target, forecast and commission figure reads from here.
CREATE TABLE IF NOT EXISTS track_stage_events (
  id           BIGSERIAL PRIMARY KEY,
  opp_id       BIGINT NOT NULL,
  from_stage   TEXT,                     -- NULL on the opening event
  to_stage     TEXT NOT NULL,
  outcome_key  TEXT,                     -- dependent on from_stage; see sales-domain
  outcome_reason TEXT,
  effective_at TIMESTAMPTZ NOT NULL,     -- when it HAPPENED, in a type that carries its zone
  recorded_at  BIGINT NOT NULL,          -- when we heard about it
  actor        TEXT,
  engagement_ref TEXT,                   -- supporting evidence, when there is any
  corrects_id  BIGINT REFERENCES track_stage_events(id),
  note         TEXT
);
CREATE INDEX IF NOT EXISTS tse_opp_idx ON track_stage_events (opp_id, effective_at DESC);
CREATE INDEX IF NOT EXISTS tse_period_idx ON track_stage_events (effective_at, to_stage);

-- CURRENT responsibility, which is a different fact from history. الإدارة المسؤولة lives here and
-- not on an append-only engagement: an engagement records who handled a PAST interaction, so
-- «أين تتعثّر الصفقات» built on it would list every department that ever touched the deal.
CREATE TABLE IF NOT EXISTS actions (
  id           BIGSERIAL PRIMARY KEY,
  opp_id       BIGINT NOT NULL,
  stage_event_id BIGINT REFERENCES track_stage_events(id),
  dept         TEXT NOT NULL,
  person       TEXT,
  title        TEXT NOT NULL,
  due_at       BIGINT,
  state        TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open','done','cancelled')),
  done_at      BIGINT,
  created_at   BIGINT NOT NULL,
  created_by   TEXT
);
CREATE INDEX IF NOT EXISTS actions_open_idx ON actions (state, dept, due_at);
CREATE INDEX IF NOT EXISTS actions_opp_idx ON actions (opp_id, state);

-- The management layer. Products are TEXT names everywhere in this codebase (tags, product_kb,
-- opportunities.product), so these key on the name too rather than introducing an id that nothing
-- else uses yet and half-migrating the whole schema.
CREATE TABLE IF NOT EXISTS sectors (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS product_meta (
  product    TEXT PRIMARY KEY,
  sector_id  BIGINT REFERENCES sectors(id),
  owner      TEXT,
  updated_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS targets (
  product  TEXT   NOT NULL,
  year     INT    NOT NULL,
  quarter  INT    NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  amount   BIGINT NOT NULL CHECK (amount >= 0),
  updated_at BIGINT NOT NULL,
  updated_by TEXT,
  PRIMARY KEY (product, year, quarter)
);

-- Widen the stage ladder from six to eight. The mapping is an identity: every live stage keeps its
-- key, and discover and quote are new, so no row is reclassified and no rep's board changes.
-- DROP then ADD, because CREATE TABLE IF NOT EXISTS alters no existing constraint.
ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS opportunities_stage_check;
ALTER TABLE opportunities ADD  CONSTRAINT opportunities_stage_check
  CHECK (stage IN ('contact','discover','present','tech','quote','negotiate','won','lost'));

-- Seed the opening event for every opportunity that predates the ledger, so a deal that already
-- exists is not invisible to the targets model. effective_at is its best known moment: when the
-- stage last moved. Marked so it can never be mistaken for a witnessed transition.
INSERT INTO track_stage_events (opp_id, from_stage, to_stage, effective_at, recorded_at, actor, note)
SELECT o.id, NULL, o.stage, to_timestamp(o.stage_at / 1000.0), $NOW$, 'migration',
       'backfilled from opportunities.stage_at — the stage was already here, the moment is approximate'
FROM opportunities o
WHERE NOT EXISTS (SELECT 1 FROM track_stage_events e WHERE e.opp_id = o.id);
`,
  },
  {
    version: "003-engagements",
    sql: `
-- WHAT THE REP DID, as distinct from what the DEAL did.
--
-- track_stage_events answers "when did this deal move", and updateOpp only writes a row when the
-- stage actually CHANGES. That is correct for the money query and wrong for Gate A: a rep calls, the
-- clinic says call me next week, the stage does not move, and nothing is recorded. That is most
-- calls. Gate A counts engagements, so engagements need their own record.
--
-- The row is keyed on the CONTACT, not the opportunity. createOppLines deliberately creates several
-- product lines per account, and a rep makes ONE call to ONE human: keying on opp_id would record
-- two engagements for one conversation and inflate the very number the pilot is judged on.
CREATE TABLE IF NOT EXISTS engagements (
  id            BIGSERIAL PRIMARY KEY,
  contact_phone TEXT   NOT NULL,
  -- The line this call moved, when it moved one. ON DELETE SET NULL, not CASCADE: deleting one
  -- product line must not erase the fact that a rep spoke to the person.
  opp_id        BIGINT REFERENCES opportunities(id) ON DELETE SET NULL,
  rep           TEXT   NOT NULL,
  kind          TEXT   NOT NULL CHECK (kind IN ('call','visit','whatsapp','email','note')),
  outcome_key   TEXT,
  -- WHEN IT HAPPENED, as the rep reports it, bounded in code so backdating cannot manufacture
  -- Gate A compliance. Separate from when we heard, because the gap between them IS the metric.
  occurred_at   TIMESTAMPTZ NOT NULL,
  recorded_at   BIGINT NOT NULL,
  note          TEXT,
  -- One command, one row. A retried tap from a phone on a bad connection must not count twice.
  idem_key      TEXT   NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS eng_rep_day_idx  ON engagements (rep, occurred_at DESC);
CREATE INDEX IF NOT EXISTS eng_contact_idx  ON engagements (contact_phone, occurred_at DESC);

-- Provenance for an action raised by a call that changed no stage. stage_event_id cannot carry it,
-- because in that case there IS no stage event — which is the whole reason engagements exist.
ALTER TABLE actions ADD COLUMN IF NOT EXISTS engagement_id BIGINT REFERENCES engagements(id) ON DELETE SET NULL;

-- Close the orphan class. Both tables carried opp_id BIGINT NOT NULL with NO foreign key, so
-- deleting an opportunity left its history pointing at nothing, forever and invisibly. These two
-- ARE about the deal, so they go with it.
DELETE FROM track_stage_events e WHERE NOT EXISTS (SELECT 1 FROM opportunities o WHERE o.id = e.opp_id);
DELETE FROM actions a           WHERE NOT EXISTS (SELECT 1 FROM opportunities o WHERE o.id = a.opp_id);
ALTER TABLE track_stage_events DROP CONSTRAINT IF EXISTS tse_opp_fk;
ALTER TABLE track_stage_events ADD  CONSTRAINT tse_opp_fk
  FOREIGN KEY (opp_id) REFERENCES opportunities(id) ON DELETE CASCADE;
ALTER TABLE actions DROP CONSTRAINT IF EXISTS actions_opp_fk;
ALTER TABLE actions ADD  CONSTRAINT actions_opp_fk
  FOREIGN KEY (opp_id) REFERENCES opportunities(id) ON DELETE CASCADE;
`,
  },
  {
    version: "004-pricing",
    sql: `
-- THE REFERENCE PRICE, and it lives on the PACKAGE.
--
-- A first design put it on the product with packages as named durations. The company's own
-- published price list disproves that: agent.ts carries «الباقة القياسية (فرع واحد): 18,000 ر.س
-- سنويًا · باقة المؤسسات (حتى 10 فروع): 95,000 ر.س سنويًا» — one product, BOTH annual, and the
-- differentiator is BRANCH COUNT, not duration. A single per-year product price cannot produce
-- both numbers. Found by the Codex outside voice; two reviewers and the founder had all chosen
-- the other model before anyone opened that file.
--
-- AND MOST PRODUCTS HAVE NO LIST PRICE AT ALL. Five of the six say «يحدده المختص» — quoted case
-- by case. So an empty price is not a gap waiting to be filled, it is the truth, and the screens
-- must say so rather than render a zero.
CREATE TABLE IF NOT EXISTS packages (
  id          BIGSERIAL PRIMARY KEY,
  product     TEXT   NOT NULL,
  name        TEXT   NOT NULL,
  -- Per YEAR. The published reference, never what was negotiated.
  list_price  BIGINT NOT NULL CHECK (list_price >= 0),
  years       INT    NOT NULL DEFAULT 1 CHECK (years > 0),
  -- What actually differentiates this package from its siblings: «فرع واحد», «حتى 10 فروع».
  -- Text on purpose — the axis differs per product and inventing a numeric one would be a guess.
  scope       TEXT,
  -- Lifecycle is RETIRE, never delete. A won deal must keep pointing at the package it was sold
  -- under, so nothing that a deal references may ever be removed.
  retired_at  BIGINT,
  created_at  BIGINT NOT NULL,
  UNIQUE (product, name),
  -- Not redundant with the primary key: it is what lets the opportunity carry a COMPOSITE foreign
  -- key below, so a deal on product X cannot reference a package belonging to product Y.
  UNIQUE (id, product)
);
CREATE INDEX IF NOT EXISTS packages_product_idx ON packages (product) WHERE retired_at IS NULL;

ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS package_id BIGINT;
-- THE SNAPSHOT. Without it, editing a package's price silently reprices every deal ever quoted
-- from it, including WON ones, and «المحقق» moves with nobody touching a deal. That is the same
-- class of defect as the ledger that had no writer. The quote is a fact about a moment.
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS quoted_list_price BIGINT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS quoted_years INT;

-- Composite FK: (package_id, product) must exist together in packages. MATCH SIMPLE means a NULL
-- package_id satisfies it, so every pre-existing deal passes untouched. RESTRICT rather than
-- CASCADE or SET NULL, because retirement is the lifecycle and a referenced package must not go.
ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS opp_package_product_fk;
ALTER TABLE opportunities ADD  CONSTRAINT opp_package_product_fk
  FOREIGN KEY (package_id, product) REFERENCES packages (id, product) ON DELETE RESTRICT;

-- The two REAL packages, verbatim from agent.ts. The only published prices this company has.
INSERT INTO packages (product, name, list_price, years, scope, created_at)
SELECT 'الإجازات المرضية', 'الباقة القياسية', 18000, 1, 'فرع واحد', $NOW$
WHERE NOT EXISTS (SELECT 1 FROM packages WHERE product = 'الإجازات المرضية' AND name = 'الباقة القياسية');
INSERT INTO packages (product, name, list_price, years, scope, created_at)
SELECT 'الإجازات المرضية', 'باقة المؤسسات', 95000, 1, 'حتى 10 فروع', $NOW$
WHERE NOT EXISTS (SELECT 1 FROM packages WHERE product = 'الإجازات المرضية' AND name = 'باقة المؤسسات');

-- For the five products that are quoted case by case, the verbatim wording, so a screen can say
-- «يحدده المختص» instead of rendering an empty cell that reads as missing data.
ALTER TABLE product_meta ADD COLUMN IF NOT EXISTS pricing_note TEXT;
`,
  },
  {
    version: "005-sector-provenance",
    sql: `
-- WHICH SECTOR ASSIGNMENT IS EVIDENCED, AND WHICH IS A GUESS.
--
-- Four of the six products carry their own answer: agent.ts lists a bestFor audience per product,
-- and it is the closest thing to a stated market this repo has. It also OVERTURNED the mapping I
-- had inferred: «الإجازات المرضية», the only product with a published price and the largest line
-- in the pipeline, lists مجمعات طبية / مراكز طبية / مستشفيات / مراكز أسنان. It is a hospital
-- product. I had placed it under أعمال because the employer is who consumes a sick note, which
-- confuses who USES the document with who BUYS the system.
--
-- Two remain guesses and are flagged, because bestFor contradicts the placement:
--   خدمات التطعيمات → صيدليات, but bestFor leads with مراكز صحية
--   فحص الموظفين    → أعمال,   but bestFor leads with مستشفيات and names شركات third
--
-- Seeding all six keeps a sector rollup complete; the flag keeps it honest, and a screen prints
-- «مُستنتَج» beside a flagged product so nobody reads a guess as a fact. Correcting one is a single
-- UPDATE: a deal never stores a sector, it derives one through product_meta.product.
--
-- «خدمة أخرى» is deliberately NOT seeded. It is the analyst's catch-all, not a product, so it gets
-- no sector — and the sector board must therefore show an explicit unclassified total rather than
-- let those deals fall out of the sum. A rollup that silently drops rows is the defect this
-- project keeps shipping.
ALTER TABLE product_meta ADD COLUMN IF NOT EXISTS sector_assumed BOOLEAN NOT NULL DEFAULT false;
`,
  },
  {
    version: "006-rename-cascade",
    sql: `
-- A PRODUCT RENAME HAS TO MOVE TEN TABLES AT ONCE.
--
-- The product name is a STRING key in ten tables, and renameTag updated exactly one of them plus
-- entities.product_tags. Measured: renaming a tag returned true, moved the tag, and left the
-- «targets» row on the old name — so the quarterly target silently disappeared from the board,
-- because salesPerformance joins targets ON tgt.product = t.name. Same shape as the won deal that
-- vanished from «المحقق»: every figure still rendered, and one of them was quietly wrong.
--
-- opportunities carries a COMPOSITE foreign key (package_id, product) -> packages (id, product).
-- That makes the two sides impossible to update one at a time: whichever moves first violates the
-- constraint against the other. Deferring it to COMMIT lets one transaction move both and still be
-- checked before anything is durable. INITIALLY IMMEDIATE, so it keeps behaving exactly as it does
-- today for every other writer; only renameTag asks for the deferral, and only for its own
-- transaction.
ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS opp_package_product_fk;
ALTER TABLE opportunities ADD CONSTRAINT opp_package_product_fk
  FOREIGN KEY (package_id, product) REFERENCES packages (id, product)
  ON DELETE RESTRICT
  DEFERRABLE INITIALLY IMMEDIATE;
`,
  },
  {
    version: "007-products-v5",
    sql: `
-- KNOWLEDGE IS REVIEWED BEFORE THE ASSISTANT READS IT.
--
-- product_kb.md was written straight from the extraction model on upload, and the assistant read
-- every row on its next refresh. Nobody looked at the text between the upload and the customer.
-- The upload now lands in the draft_* columns; only «اعتماد المعرفة» copies a draft into md, and
-- records WHO did it and WHEN. Rows that predate this step keep approved_at NULL — they were live
-- without anyone recording an approval, and inventing one now would be a manufactured provenance
-- (spec A′). They stop reaching the assistant until a human approves the text they can see.
ALTER TABLE product_kb ADD COLUMN IF NOT EXISTS draft_md     TEXT;
ALTER TABLE product_kb ADD COLUMN IF NOT EXISTS draft_source TEXT;
ALTER TABLE product_kb ADD COLUMN IF NOT EXISTS draft_by     TEXT;
ALTER TABLE product_kb ADD COLUMN IF NOT EXISTS draft_at     BIGINT;
ALTER TABLE product_kb ADD COLUMN IF NOT EXISTS approved_by  TEXT;
ALTER TABLE product_kb ADD COLUMN IF NOT EXISTS approved_at  BIGINT;
-- Archive, never delete: a product referenced by a deal, a campaign or a reading must keep its
-- name resolvable. NULL = live.
ALTER TABLE product_meta ADD COLUMN IF NOT EXISTS archived_at BIGINT;
`,
  },
  {
    version: "008-asset-size-column",
    sql: `
-- THE SIZE IS STORED, NOT MEASURED. The products list showed each PDF's size with
-- octet_length(bytes), which DETOASTS every stored file on every read — and the asset list loads on
-- every dashboard page. On the 256MB production database that turned a smoke run into
-- «instance has hit resource limits» and dropped connections (2026-09-13 07:34 and 07:37 UTC).
-- The size is written once at upload and backfilled here once.
ALTER TABLE product_assets ADD COLUMN IF NOT EXISTS size_bytes BIGINT;
UPDATE product_assets SET size_bytes = octet_length(bytes) WHERE size_bytes IS NULL;
`,
  },
  {
    version: "009-system-configuration",
    sql: `
-- THE LADDER BECOMES THE ADMIN'S, WITHOUT LOSING ITS SPINE.
--
-- Founder, 2026-09-13: an admin adds lead stages with an SLA, renames them, and turns them on and
-- off. Until now SALES_STAGES was code-owned truth and the boot seed DRAGGED the table back to it
-- on every deploy — an edit made on Sunday would vanish on Monday. The ownership line is now:
-- code owns key/dot/terminal (identity — a key change orphans every stored opportunity and every
-- ledger event), the admin owns label/weight/position/sla/active. See src/config-domain.ts.
ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS sla_days INT;
ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS active   BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS dot      TEXT;
ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS terminal TEXT;

-- A stage the admin ADDS is a stage no CHECK constraint knows about. The constraint listed the
-- eight compiled keys, so the first custom rung would be rejected by the database with a message
-- no screen could translate. Validation moves into code, against the live ladder (db.stageKeys()).
ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS opportunities_stage_check;

-- DIVISIONS: the company's own units. NOT «القطاع» (the market a product sells into) — this is who
-- inside the company owns it. A product belongs to one; a team member sits in one.
CREATE TABLE IF NOT EXISTS divisions (
  id              BIGSERIAL PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  owner_member_id BIGINT,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      BIGINT NOT NULL,
  updated_at      BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS team_members (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  role        TEXT NOT NULL CHECK (role IN ('sales','support','manager')),
  division_id BIGINT REFERENCES divisions(id) ON DELETE SET NULL,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  BIGINT NOT NULL,
  updated_at  BIGINT NOT NULL
);
-- Guarded: ADD CONSTRAINT has no IF NOT EXISTS, and a migration that cannot be re-run is a
-- migration that turns a retried boot into memory-only mode (measured here, 2026-09-13).
DO $$ BEGIN
  ALTER TABLE divisions ADD CONSTRAINT divisions_owner_fk
    FOREIGN KEY (owner_member_id) REFERENCES team_members(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE product_meta ADD COLUMN IF NOT EXISTS division_id BIGINT REFERENCES divisions(id) ON DELETE SET NULL;

-- ESCALATIONS AND SUPPORT REQUESTS. delivery is RECORDED, never «sent», until a mail sender is
-- chosen (founder, 2026-09-13). The recipient's name and email are COPIED onto the row: the record
-- of who was asked must survive that person later leaving the directory.
CREATE TABLE IF NOT EXISTS escalations (
  id           BIGSERIAL PRIMARY KEY,
  opp_id       BIGINT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('escalation','support')),
  to_member_id BIGINT REFERENCES team_members(id) ON DELETE SET NULL,
  to_name      TEXT NOT NULL,
  to_email     TEXT NOT NULL,
  reason       TEXT NOT NULL,
  delivery     TEXT NOT NULL DEFAULT 'recorded',
  created_by   TEXT,
  created_at   BIGINT NOT NULL,
  resolved_at  BIGINT,
  resolved_by  TEXT
);
CREATE INDEX IF NOT EXISTS idx_escalations_opp ON escalations (opp_id);

-- The two rungs sales-domain already called stalling keep their 14 days as an SLA, so the board's
-- «متوقفة» does not silently become «never late» the moment it starts reading sla_days.
UPDATE pipeline_stages SET sla_days = 14
 WHERE sla_days IS NULL AND key IN ('tech','negotiate');
`,
  },
  {
    version: "010-western-numerals",
    sql: `
-- ONE NUMERAL SYSTEM (founder, 2026-09-13: «make all numbers in english numerals»). The screens
-- now format every figure with «ar-SA-u-nu-latn», but SEEDED TEXT carries its own digits — the
-- package scope «حتى ١٠ فروع» was written by migration 004 and renders as data, not as a number the
-- formatter ever sees. Only rows this repo seeded are touched; anything a human typed is theirs.
UPDATE packages SET scope = translate(scope, '٠١٢٣٤٥٦٧٨٩', '0123456789')
 WHERE scope ~ '[٠-٩]' AND product IN ('الإجازات المرضية');
`,
  },
  {
    version: "011-usage-indicators",
    sql: `
-- «مؤشرات استخدام العملاء» (client A, BRD v1.0, 2026-09-15). An indicator is a product manager's
-- measured statement about a set of customers — «these 128 facilities use sick leave heavily» — with
-- WHEN it was measured and WHAT membership means (signal), so the opportunity rules in
-- indicator-domain.ts can read it without guessing. Dates are calendar days as the manager typed them.
CREATE TABLE IF NOT EXISTS usage_indicators (
  id              BIGSERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT,
  product         TEXT,
  signal          TEXT NOT NULL DEFAULT 'other'
                  CHECK (signal IN ('high_usage','usage_no_integration','integrated','uses','not_using','other')),
  customer_type   TEXT NOT NULL DEFAULT 'all' CHECK (customer_type IN ('medical','company','all')),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','draft')),
  period_from     TEXT,
  period_to       TEXT,
  data_updated_at TEXT NOT NULL,
  source          TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','file','paste')),
  source_filename TEXT,
  created_by      TEXT,
  created_at      BIGINT NOT NULL,
  updated_by      TEXT,
  updated_at      BIGINT NOT NULL
);
-- A customer appears in many indicators (BRULE-003), once per indicator. The uploaded name is kept
-- beside the link: when a later audit asks why a clinic is in «استخدام مرتفع», the row it came from
-- is the answer.
CREATE TABLE IF NOT EXISTS usage_indicator_members (
  indicator_id BIGINT NOT NULL REFERENCES usage_indicators(id) ON DELETE CASCADE,
  entity_id    BIGINT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  value        TEXT,
  period       TEXT,
  note         TEXT,
  source_name  TEXT,
  matched_by   TEXT,
  PRIMARY KEY (indicator_id, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_uim_entity ON usage_indicator_members (entity_id);
-- NFR-002: indicator changes are audited. Append-only; the screen shows it as «سجل التغييرات».
CREATE TABLE IF NOT EXISTS indicator_events (
  id           BIGSERIAL PRIMARY KEY,
  indicator_id BIGINT NOT NULL REFERENCES usage_indicators(id) ON DELETE CASCADE,
  action       TEXT NOT NULL,
  detail       JSONB NOT NULL DEFAULT '{}'::jsonb,
  by_name      TEXT,
  at           BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_indicator_events ON indicator_events (indicator_id, at);
-- NFR-009: a recommendation can be ignored. The key is indicator-domain's suggestionKey, so the same
-- suggestion stays dismissed across reloads and returns only when what it proposes changes.
CREATE TABLE IF NOT EXISTS suggestion_dismissals (
  key           TEXT PRIMARY KEY,
  title         TEXT,
  indicator_ids BIGINT[] NOT NULL DEFAULT '{}',
  reason        TEXT,
  by_name TEXT,
  at      BIGINT NOT NULL
);
-- Attribution (BR-MON-006, §19.2 step 7, KPI «Recommendation Adoption»): a campaign launched from a
-- suggestion records which one, its rule and its indicators. NULL = built by hand.
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS origin JSONB;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS objective TEXT;
-- Whether each target was actually SENT. campaign_targets is written before the send loop, so a
-- refused recipient (opted out, outside the 24h window, never wrote to us) used to count as
-- «approached» — suppressing them from suggestions for 30 days and telling the repeat warning they
-- had been reached. NULL = a row from before this column: unknown, treated as approached.
ALTER TABLE campaign_targets ADD COLUMN IF NOT EXISTS outcome TEXT;
`,
  },
  {
    version: "012-customer-accounts",
    sql: `
-- «العملاء» as accounts (client A, BRD v1.0 §9, slice S2). An entity was a WhatsApp number with a name;
-- the BRD's customer is an organisation with a city, a sector, an importance, an owner, the people
-- inside it, and a record of where it came from and who added it. The phone stays the identity every
-- other table joins on.
ALTER TABLE entities ADD COLUMN IF NOT EXISTS sector TEXT;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS importance TEXT CHECK (importance IN ('high','medium','low'));
ALTER TABLE entities ADD COLUMN IF NOT EXISTS owner_member_id BIGINT REFERENCES team_members(id) ON DELETE SET NULL;
-- Every account that exists today was already being worked, so it lands «معتمد». From here a new one
-- arrives «مقترح» and waits for the sales team, as the prototype draws it.
ALTER TABLE entities ADD COLUMN IF NOT EXISTS approval TEXT NOT NULL DEFAULT 'approved' CHECK (approval IN ('proposed','approved','rejected'));
ALTER TABLE entities ALTER COLUMN approval SET DEFAULT 'proposed';
ALTER TABLE entities ADD COLUMN IF NOT EXISTS approval_by TEXT;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS approval_at BIGINT;
-- NULL = added before this column existed: shown «غير مسجّل», never back-filled with a guess.
ALTER TABLE entities ADD COLUMN IF NOT EXISTS source TEXT CHECK (source IN ('manual','import','whatsapp','indicator','partner','other'));
ALTER TABLE entities ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS updated_at BIGINT;
UPDATE entities SET updated_at = created_at WHERE updated_at IS NULL;
-- Sector and city were already typed into imported sheets under these headers; they are the same
-- facts, moved from a free attribute into the column the filters read.
UPDATE entities SET sector = left(attrs->>'القطاع', 80) WHERE sector IS NULL AND coalesce(attrs->>'القطاع', '') <> '';
UPDATE entities SET city = left(attrs->>'المدينة', 60) WHERE city IS NULL AND coalesce(attrs->>'المدينة', '') <> '';
CREATE INDEX IF NOT EXISTS idx_entities_owner ON entities (owner_member_id);
-- BR-CUS-002: the people inside an account. One of them is primary.
CREATE TABLE IF NOT EXISTS entity_contacts (
  id         BIGSERIAL PRIMARY KEY,
  entity_id  BIGINT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  role       TEXT,
  phone      TEXT,
  email      TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  position   INT NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL,
  created_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_entity_contacts ON entity_contacts (entity_id, position);
CREATE UNIQUE INDEX IF NOT EXISTS uq_entity_contacts_primary ON entity_contacts (entity_id) WHERE is_primary;
-- NFR-002 for accounts: created, edited, approved, rejected. Append-only.
CREATE TABLE IF NOT EXISTS account_events (
  id        BIGSERIAL PRIMARY KEY,
  entity_id BIGINT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  action    TEXT NOT NULL,
  detail    JSONB NOT NULL DEFAULT '{}'::jsonb,
  by_name   TEXT,
  at        BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_account_events ON account_events (entity_id, at);
`,
  },
];

/** Applied-version bookkeeping plus the seed that keeps the ladder in sync with sales-domain. */
async function runMigrations(p: pg.Pool): Promise<void> {
  const client = await p.connect();
  try {
    // The lock comes FIRST, and the bookkeeping table is created on the locked client. Taking it
    // after the CREATE left the one window the lock exists to close: CREATE TABLE IF NOT EXISTS is
    // not concurrency-safe in Postgres, so two sessions racing it (a deploy overlap, or reprobe()
    // landing on a boot) raise 23505/42P07 on pg_type_typname_nsp_index. That throw escapes init(),
    // and the process falls back to memory-only — every write silently dropped until a restart.
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
    // MIGRATION (the base schema) runs here too, for the same reason: it is a wall of
    // CREATE TABLE IF NOT EXISTS, and it used to run on the bare pool before the lock was taken.
    await client.query(MIGRATION);
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY, applied_at BIGINT NOT NULL)`);
    const done = new Set<string>(
      (await client.query("SELECT version FROM schema_migrations")).rows.map((r: any) => String(r.version)));
    for (const m of MIGRATIONS) {
      if (done.has(m.version)) continue;
      try {
        await client.query("BEGIN");
        await client.query(m.sql.replaceAll("$NOW$", String(Date.now())));
        await client.query("INSERT INTO schema_migrations (version, applied_at) VALUES ($1,$2)",
          [m.version, Date.now()]);
        await client.query("COMMIT");
        console.log(JSON.stringify({ at: "db", msg: "migration applied", version: m.version }));
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        throw new Error(`migration ${m.version} failed: ${String(e).slice(0, 300)}`);
      }
    }
    await assertSchemaShape(client);
    await seedDefaultPipeline(client);
    await seedSectors(client);
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]).catch(() => {});
    client.release();
  }
}

/** The columns the code will actually read and write. Asserted AFTER migrations run.
 *
 * WHY. `CREATE TABLE IF NOT EXISTS` is idempotent but NOT verifying: if a table already exists with
 * the wrong shape — from a partial run, a hand-created table, or a future migration that collides —
 * the step is skipped, the version is stamped applied, and the engine boots believing a schema it
 * does not have. Measured, not assumed: planting `CREATE TABLE targets (wrong_column int)` and
 * booting produced "migration applied" with `targets` still holding one wrong column.
 *
 * That defeats the whole reason the migration system was added. So the shape is checked, and a
 * mismatch fails the boot loudly instead of surfacing later as a confusing runtime error on a write.
 * `/health` reports ok:false in that state, so the failure is visible rather than silent. */
const REQUIRED_SHAPE: Readonly<Record<string, readonly string[]>> = {
  pipelines: ["id", "name", "product", "created_at"],
  pipeline_stages: ["id", "pipeline_id", "key", "label", "weight_pct", "position", "sla_days", "active"],
  divisions: ["id", "name", "owner_member_id", "active"],
  team_members: ["id", "name", "email", "role", "division_id", "active"],
  escalations: ["id", "opp_id", "kind", "to_member_id", "to_name", "to_email", "reason", "delivery", "created_at"],
  track_stage_events: ["id", "opp_id", "from_stage", "to_stage", "outcome_key", "effective_at", "recorded_at"],
  actions: ["id", "opp_id", "dept", "title", "state", "created_at"],
  sectors: ["id", "name"],
  product_meta: ["product", "sector_id", "archived_at", "division_id"],
  product_kb: ["product", "md", "source_filename", "updated_at", "draft_md", "draft_source", "draft_by", "draft_at", "approved_by", "approved_at"],
  product_assets: ["product", "public_id", "filename", "content_type", "bytes", "updated_at", "size_bytes"],
  targets: ["product", "year", "quarter", "amount"],
  engagements: ["id", "contact_phone", "opp_id", "rep", "kind", "outcome_key", "occurred_at", "recorded_at", "idem_key"],
  packages: ["id", "product", "name", "list_price", "years", "scope", "retired_at", "created_at"],
  usage_indicators: ["id", "name", "description", "product", "signal", "customer_type", "status", "period_from", "period_to", "data_updated_at", "source", "source_filename", "created_by", "created_at", "updated_by", "updated_at"],
  usage_indicator_members: ["indicator_id", "entity_id", "value", "period", "note", "source_name", "matched_by"],
  indicator_events: ["id", "indicator_id", "action", "detail", "by_name", "at"],
  suggestion_dismissals: ["key", "title", "indicator_ids", "reason", "by_name", "at"],
  campaign_targets: ["campaign_id", "phone", "name", "outcome"],
  campaigns: ["id", "name", "product", "message", "created_at", "test", "origin", "objective"],
  entities: ["id", "name", "phone", "city", "attrs", "facts", "product_tags", "sector", "importance", "owner_member_id", "approval", "approval_by", "approval_at", "source", "created_by", "created_at", "updated_at"],
  entity_contacts: ["id", "entity_id", "name", "role", "phone", "email", "is_primary", "position", "created_at", "created_by"],
  account_events: ["id", "entity_id", "action", "detail", "by_name", "at"],
};

async function assertSchemaShape(client: pg.PoolClient): Promise<void> {
  const want = Object.entries(REQUIRED_SHAPE);
  const r = await client.query(
    `SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ANY($1)`,
    [want.map(([t]) => t)]);
  const have = new Map<string, Set<string>>();
  for (const row of r.rows) {
    const t = String(row.table_name);
    if (!have.has(t)) have.set(t, new Set());
    have.get(t)!.add(String(row.column_name));
  }
  const missing: string[] = [];
  for (const [table, cols] of want) {
    const got = have.get(table);
    if (!got) { missing.push(`${table} (table absent)`); continue; }
    for (const c of cols) if (!got.has(c)) missing.push(`${table}.${c}`);
  }
  if (missing.length) {
    throw new Error(
      `schema shape mismatch after migration — the engine would run against a schema it does not ` +
      `have. Missing: ${missing.join(", ")}`);
  }
}

/** The ladder is DATA, and sales-domain is its single source of truth. Re-seeded every boot by key
 *  so a weight corrected in code reaches the database without anyone writing a migration for it. */
/**
 * The three market sectors and which product sells into each.
 *
 * WHY THIS IS A BOOT SEED AND NOT MIGRATION SQL. Two reasons, and the second is the important one.
 *
 * 1. It is the ONLY writer these two tables have. Nothing in the product creates a sector: there is
 *    no admin screen for it, and the eng review's answer was that there should not be one for three
 *    rows that change once a year. But `scripts/check-ledger-writers.mjs` (gate step 18) exists
 *    because four tables shipped here that a screen read and nothing ever wrote — one of them made
 *    a 1,440,000 SAR won deal vanish. The guard deliberately ignores migration bodies, since SQL
 *    frozen in a versioned string is not a writer: it runs once, on one database, and never again.
 *    Putting the seed here makes the claim true rather than exempting the table from the check.
 *    That was open item R7, and this is its resolution.
 *
 * 2. It is INSERT-IF-ABSENT, never an update. seedDefaultPipeline above uses DO UPDATE because
 *    SALES_STAGES is code-owned truth and the database should be dragged back to it on every boot.
 *    A sector mapping is the opposite: it is a business fact that two rows below are openly a
 *    guess. If a founder corrects «فحص الموظفين» with one UPDATE, the next deploy must not silently
 *    revert it. So a row that already exists is left exactly as found.
 */
async function seedSectors(client: pg.PoolClient): Promise<void> {
  const now = Date.now();
  for (const name of SECTORS) {
    await client.query(
      "INSERT INTO sectors (name, created_at) VALUES ($1,$2) ON CONFLICT (name) DO NOTHING",
      [name, now]);
  }
  const ids = new Map<string, number>();
  for (const r of (await client.query("SELECT id, name FROM sectors")).rows) {
    ids.set(String(r.name), Number(r.id));
  }
  for (const [product, sector, assumed, note] of PRODUCT_SECTOR) {
    const sectorId = ids.get(sector);
    if (sectorId === undefined) continue; // unreachable: SECTORS was just inserted above
    await client.query(
      `INSERT INTO product_meta (product, sector_id, owner, updated_at, sector_assumed, pricing_note)
       VALUES ($1,$2,NULL,$3,$4,$5) ON CONFLICT (product) DO NOTHING`,
      [product, sectorId, now, assumed, note]);
  }
}

async function seedDefaultPipeline(client: pg.PoolClient): Promise<void> {
  const r = await client.query("SELECT id FROM pipelines WHERE product IS NULL LIMIT 1");
  let id: number;
  if (r.rowCount) id = Number(r.rows[0].id);
  else {
    const ins = await client.query(
      "INSERT INTO pipelines (name, product, created_at) VALUES ($1,NULL,$2) RETURNING id",
      ["المسار الافتراضي", Date.now()]);
    id = Number(ins.rows[0].id);
  }
  for (const st of SALES_STAGES) {
    // INSERT-IF-ABSENT for everything the admin owns (label, weight, position, SLA, active), and
    // DO UPDATE only for what code owns (dot, terminal). Before «إعدادات النظام» this statement
    // overwrote label/weight/position on every boot, which would have silently undone every edit
    // an admin made — the seed would have been the loudest bug in the feature.
    await client.query(
      `INSERT INTO pipeline_stages (pipeline_id, key, label, weight_pct, position, exit_criterion, sla_days, active, dot, terminal)
       VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,$8,$9)
       ON CONFLICT (pipeline_id, key) DO UPDATE
         SET dot = EXCLUDED.dot, terminal = EXCLUDED.terminal`,
      [id, st.key, st.label, st.weightPct, st.position, st.exitCriterion,
        st.stalls ? sales.STALL_DAYS : null, st.dot, st.terminal]);
  }
}

export async function init(): Promise<void> {
  if (!enabled()) {
    console.log(JSON.stringify({ at: "db", msg: "DATABASE_URL not set — memory-only mode" }));
    return;
  }
  try {
    // idleTimeoutMillis + keepAlive: the backend closes connections that sit idle, and node-pg's
    // default keeps idle clients forever, so the next request was handed a dead socket — measured
    // 2026-09-12 as «Connection terminated unexpectedly» on /admin/entities, /admin/kb and
    // /admin/campaigns minutes after every deploy, 500s in the dashboard, and the pool latched to
    // memory-only until the 30s reprobe. Closing idle clients ourselves after 10s means a request
    // opens a fresh socket instead of inheriting one the server already dropped.
    // max 3 (DB_POOL_MAX overrides): massar-db is a 256MB machine with ~40MB free; every extra
    // backend a dashboard burst opens is memory it does not have, and at 5 the VM spent 2–3s of
    // every 10 waiting on memory and dropped every connection (fly logs, 2026-09-13). Queuing a
    // request for a few ms in the engine is cheaper than a stalled database.
    const poolMax = Math.max(1, Math.min(10, Number(process.env.DB_POOL_MAX) || 3));
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: poolMax, connectionTimeoutMillis: 8000,
      idleTimeoutMillis: 10_000, keepAlive: true });
    // node-pg emits 'error' on idle clients if the backend drops mid-life; unhandled it
    // kills the process. Log, flip connected so /health tells the truth; writes no-op.
    pool.on("error", (e) => {
      connected = false;
      console.error(JSON.stringify({ at: "db", msg: "pool error — memory-only until recovery", err: String(e).slice(0, 200) }));
    });
    await runMigrations(pool);
    migrated = true;
    markConnected();
    console.log(JSON.stringify({ at: "db", msg: "connected + migrated" }));
  } catch (e) {
    connected = false;
    console.error(JSON.stringify({ at: "db", msg: "init failed — memory-only mode", err: String(e).slice(0, 300) }));
  }
}

function fire(q: string, params: unknown[]): void {
  if (!pool || !connected) return;
  void pool.query(q, params).catch((e) =>
    console.error(JSON.stringify({ at: "db", msg: "write failed", err: String(e).slice(0, 200) })));
}

export function upsertContact(c: {
  phone: string; waName?: string; firstSeenAt: number; lastEventAt: number;
  statusTimes: Record<string, number>; outcome?: string; outcomeReason?: string;
  optedOut: boolean; human: boolean; test?: boolean; agentTurns: number; lastError?: string;
  scheduledSaid?: string; scheduledAt?: number; outcomeEvidence?: string;
}): void {
  fire(
    `INSERT INTO contacts (phone, wa_name, first_seen_at, last_event_at, status_times, outcome, outcome_reason, opted_out, human, test, agent_turns, last_error, scheduled_said, scheduled_at, outcome_evidence)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     ON CONFLICT (phone) DO UPDATE SET
       wa_name = COALESCE(EXCLUDED.wa_name, contacts.wa_name),
       last_event_at = EXCLUDED.last_event_at,
       status_times = EXCLUDED.status_times,
       outcome = EXCLUDED.outcome,
       outcome_reason = EXCLUDED.outcome_reason,
       opted_out = EXCLUDED.opted_out,
       human = EXCLUDED.human,
       test = EXCLUDED.test,
       agent_turns = EXCLUDED.agent_turns,
       last_error = EXCLUDED.last_error,
       -- COALESCE, not overwrite: a stated time and its evidence are facts the customer produced
       -- once. A later turn that carries neither must not erase them.
       scheduled_said = COALESCE(EXCLUDED.scheduled_said, contacts.scheduled_said),
       scheduled_at = COALESCE(EXCLUDED.scheduled_at, contacts.scheduled_at),
       outcome_evidence = COALESCE(EXCLUDED.outcome_evidence, contacts.outcome_evidence)`,
    [c.phone, c.waName ?? null, c.firstSeenAt, c.lastEventAt, JSON.stringify(c.statusTimes),
     c.outcome ?? null, c.outcomeReason ?? null, c.optedOut, c.human, Boolean(c.test), c.agentTurns, c.lastError ?? null,
     c.scheduledSaid ?? null, c.scheduledAt ?? null, c.outcomeEvidence ?? null],
  );
}

/** Clear a contact's appointment — the operator removing the day HE typed.
 *  `upsertContact` COALESCEs `scheduled_at` on purpose (a later turn that carries no time must not
 *  erase one the customer stated), so a deliberate clear needs its own statement or the day comes
 *  back on the next redeploy. Its own call, never `persist` + this together: both are
 *  fire-and-forget on a pool, so ordering between them is not guaranteed. */
export function clearSchedule(phone: string): void {
  fire(`UPDATE contacts SET scheduled_at = NULL WHERE phone = $1`, [phone]);
}

export function insertMessage(phone: string, role: string, text: string, ts: number): void {
  fire(`INSERT INTO messages (phone, role, text, ts) VALUES ($1,$2,$3,$4)`, [phone, role, text, ts]);
}
// NOTE: `replaceTags` was removed with the props write path. Correcting a contact's interest tags
// without also stamping `props.productInterest` leaves a human correction rendering as a machine
// reading (BR-2), so the two now commit together inside `upsertProps` above — one door, one
// transaction. A second tag-only writer would re-open exactly that gap.
/** Thrown when a property write could not reach Postgres. NOT an ordinary Error: the caller has to
 *  distinguish "the ledger refused" from "the code broke", because the two get opposite treatment
 *  (a human write becomes a 503, an agent write is logged and swallowed). */
export class NotPersisted extends Error {
  constructor(reason: "no_database_url" | "db_unreachable") { super(reason); this.name = "NotPersisted"; }
}

/**
 * Write typed properties (+ optionally the interest tags that belong with them) in ONE transaction.
 *
 * Diverges from fire() on purpose (NFR-3): fire() is fire-and-forget, which is right for status
 * telemetry and wrong for a fact a human typed once. It MUST throw rather than return early the way
 * replaceTags does — a silent early return is how local dev pretends a save succeeded, and the
 * field then reads «ناقص» after the next hydrate with nothing having reported a failure.
 *
 * Tags ride the same transaction (BR-2): a crash between two separate commits would leave the tags
 * corrected and the provenance missing, i.e. a human fact rendering as a machine reading.
 * Returns false when the phone is unknown — never manufactures a contact.
 */
export async function upsertProps(
  phone: string,
  set: Record<string, unknown>,
  del: string[],
  tags?: { product: string; level: string; ts: number }[],
): Promise<boolean> {
  // A human just typed a fact. Before refusing it, re-test a pool the error handler latched off —
  // otherwise «أعد المحاولة» is a lie until the next deploy.
  if (!pool || !(await reprobe())) throw new NotPersisted(enabled() ? "db_unreachable" : "no_database_url");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const r = await client.query(
      `UPDATE contacts SET props = (COALESCE(props,'{}'::jsonb) || $2::jsonb) - $3::text[] WHERE phone = $1`,
      [phone, JSON.stringify(set), del]);
    if ((r.rowCount ?? 0) === 0) { await client.query("ROLLBACK"); return false; }
    if (tags) {
      await client.query(`DELETE FROM interest_tags WHERE phone = $1`, [phone]);
      for (const t of tags) {
        await client.query(`INSERT INTO interest_tags (phone, product, level, ts) VALUES ($1,$2,$3,$4)`,
          [phone, t.product, t.level, t.ts]);
      }
    }
    await client.query("COMMIT");
    return true;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/** Mark a campaign as a sandbox/rehearsal launch so the real views stop counting it. */
export async function setCampaignTest(id: number, test: boolean): Promise<boolean> {
  if (!pool || !connected) return false;
  const r = await pool.query(`UPDATE campaigns SET test = $2 WHERE id = $1`, [id, test]);
  return (r.rowCount ?? 0) > 0;
}
// insertTag is deleted with its only caller (tracker.addTag). It was a fire-and-forget INSERT into
// interest_tags outside any transaction — the second write path that let a curated tag set drift
// from its provenance. `upsertProps` is now the only writer of that table, and it is transactional.
export function insertEvent(phone: string, kind: string, note: string, ts: number): void {
  fire(`INSERT INTO events (phone, kind, note, ts) VALUES ($1,$2,$3,$4)`, [phone, kind, note, ts]);
}

export type HydratedContact = {
  phone: string; wa_name: string | null; first_seen_at: string; last_event_at: string;
  status_times: Record<string, number>; outcome: string | null; outcome_reason: string | null;
  opted_out: boolean; human: boolean; test?: boolean; agent_turns: number; last_error: string | null;
  scheduled_said?: string | null; scheduled_at?: string | number | null; outcome_evidence?: string | null;
  /** The six typed properties + provenance. `loadAll` is SELECT *, so it comes back for free. */
  props?: Record<string, unknown> | null;
};

/** Load everything needed to rebuild the in-memory tracker at boot. */
export async function loadAll(): Promise<{
  contacts: HydratedContact[];
  messages: { phone: string; role: string; text: string; ts: string }[];
  tags: { phone: string; product: string; level: string; ts: string }[];
  eventCounts: { kind: string; n: string }[];
} | null> {
  if (!pool || !connected) return null;
  try {
    const contacts = (await pool.query(`SELECT * FROM contacts ORDER BY last_event_at ASC`)).rows;
    const messages = (await pool.query(
      `SELECT phone, role, text, ts FROM messages
       WHERE id IN (SELECT id FROM (
         SELECT id, ROW_NUMBER() OVER (PARTITION BY phone ORDER BY ts DESC) rn FROM messages
       ) x WHERE rn <= 50)
       ORDER BY ts ASC`)).rows;
    const tags = (await pool.query(`SELECT phone, product, level, ts FROM interest_tags ORDER BY ts ASC`)).rows;
    const eventCounts = (await pool.query(`SELECT kind, COUNT(*) n FROM events GROUP BY kind`)).rows;
    return { contacts, messages, tags, eventCounts };
  } catch (e) {
    console.error(JSON.stringify({ at: "db", msg: "hydrate load failed", err: String(e).slice(0, 300) }));
    return null;
  }
}

/** ONE grouped query for the whole performance screen, deliberately.
 *
 *  The review's finding: "computed" must not mean recomputing every tile from the ledger on each
 *  request. This machine is 512 MB with a pool of five and a health check already holding a
 *  connection every 30 seconds, so the executive view takes ONE connection and returns every figure
 *  from ONE snapshot — which also stops two tiles disagreeing mid-request.
 *
 *  `achieved` reads the stage-event ledger, not opportunities: a deal's stage_at is overwritten by
 *  any later edit, so it cannot say WHEN a deal was won. That is the whole reason the ledger exists.
 *
 *  Returns raw money and raw counts. Attainment, coverage and the RAG band are computed by
 *  sales-domain in the browser, so the arithmetic has exactly one home. */
/**
 * «قيمة الفرصة», as SQL, in ONE place.
 *
 * Unit price times quantity times years, then the discount taken off. This expression was written
 * out by hand in three separate queries — the targets rollup, the weighted-pipeline rollup and the
 * account drilldown — which is three chances for a fourth screen to disagree with the first three
 * about what a deal is worth. The sector rollup below would have been the fourth copy.
 *
 * IT ROUNDS PER ROW, and that is the whole point. calculateLineValue (opps-domain.ts) rounds each
 * line, because a deal is worth a whole number of riyals and that rounded figure is what «فرص
 * البيع» prints on the card. SUMming the UNROUNDED expression therefore produced a different total
 * from adding up the cards the reader can see. Measured on three deals at a 50% discount on an odd
 * price: the cards read 4 + 2 + 51 = 57 and «المستهدفات والأداء» read 56. One riyal, on twelve
 * rows — but it scales with the row count, it always favours neither side predictably, and a
 * founder who adds up the board and gets a different number stops trusting both screens.
 *
 * So the rounding boundary is the LINE, in both languages, and tests/value-parity.test.ts drives
 * the same inputs through this string and through calculateLineValue and asserts they agree —
 * including the .5 ties, where JS Math.round and Postgres ROUND(numeric) both go away from zero.
 * That test is the unification: the two implementations cannot literally share code, so what is
 * shared is a proof that they answer identically.
 */
export const OPP_VALUE_SQL = "ROUND(o.sale_price * o.qty * o.years * (1 - o.discount / 100.0))";

export async function salesPerformance(
  startMs: number, endMs: number, year: number, quarter: number, isCurrentPeriod: boolean,
): Promise<{
  product: string; sector: string | null; target: number; achieved: number;
  weightedOpen: number; openCount: number; wonCount: number;
}[]> {
  if (!(await reprobe()) || !pool) return [];
  const r = await pool.query(
    // The ledger says WHEN it happened; the row says whether it is STILL true. Joining the events
    // alone got both wrong: a deal won and then corrected back out stayed in «المحقق» AND returned
    // to open pipeline, so coverage counted the same money twice (measured: achieved held at
    // 1,820,000 with openCount back to 3). And a deal won, reversed, then won again has two win
    // events and would be summed twice. So: only opportunities currently at 'won', counted once,
    // at the date of their LATEST transition into it.
    `WITH won AS (
       SELECT o.product,
              SUM(${OPP_VALUE_SQL}) AS achieved,
              COUNT(*) AS won_count
         FROM opportunities o
         JOIN LATERAL (
           SELECT e.effective_at
             FROM track_stage_events e
            WHERE e.opp_id = o.id AND e.to_stage = 'won'
            ORDER BY e.effective_at DESC
            LIMIT 1
         ) w ON TRUE
        WHERE o.stage = 'won'
          AND w.effective_at >= to_timestamp($1 / 1000.0)
          AND w.effective_at <  to_timestamp($2 / 1000.0)
        GROUP BY o.product
     ),
     -- Two bugs lived in this block and both were silent.
     --
     -- 1. The join had no pipeline_id, so it was 1:1 only while exactly one ladder existed. The
     --    schema deliberately allows a per-product ladder (pipelines.product), and pipeline_stages
     --    is unique on (pipeline_id, key) — NOT on key. The first second pipeline anyone inserted
     --    would have doubled every product's weightedOpen and openCount with nothing on screen
     --    saying so. Pinned to the default ladder until per-product ladders are actually resolved.
     --
     -- 2. It ignored $1/$2 entirely, so picking Q1 2024 returned TODAY's open pipeline and the
     --    coverage tile added current deals to a closed quarter's achieved figure. Open value is
     --    now what is expected to close IN the selected period. A deal with no close_on has no
     --    period to belong to, so it counts only when the period is the one we are inside —
     --    $5 is that flag, decided by the caller rather than guessed in SQL.
     openv AS (
       SELECT o.product,
              SUM(${OPP_VALUE_SQL} * ps.weight_pct / 100.0) AS weighted,
              COUNT(*) AS open_count
         FROM opportunities o
         JOIN pipeline_stages ps
           ON ps.key = o.stage
          AND ps.pipeline_id = (SELECT id FROM pipelines WHERE product IS NULL ORDER BY id LIMIT 1)
        WHERE o.stage NOT IN ('won','lost')
          AND ( (o.close_on IS NOT NULL AND o.close_on >= $1 AND o.close_on < $2)
             OR (o.close_on IS NULL AND $5) )
        GROUP BY o.product
     ),
     tgt AS (
       SELECT product, SUM(amount) AS amount FROM targets
        WHERE year = $3 AND quarter = $4 GROUP BY product
     )
     SELECT t.name AS product, s.name AS sector,
            COALESCE(tgt.amount, 0)      AS target,
            COALESCE(won.achieved, 0)    AS achieved,
            COALESCE(openv.weighted, 0)  AS weighted_open,
            COALESCE(openv.open_count,0) AS open_count,
            COALESCE(won.won_count, 0)   AS won_count
       FROM tags t
       LEFT JOIN product_meta pm ON pm.product = t.name
       LEFT JOIN sectors s       ON s.id = pm.sector_id
       LEFT JOIN won   ON won.product   = t.name
       LEFT JOIN openv ON openv.product = t.name
       LEFT JOIN tgt   ON tgt.product   = t.name
      ORDER BY COALESCE(tgt.amount,0) DESC, t.name`,
    [startMs, endMs, year, quarter, isCurrentPeriod]);
  return r.rows.map((x: any) => ({
    product: String(x.product), sector: x.sector ? String(x.sector) : null,
    target: Number(x.target) || 0, achieved: Math.round(Number(x.achieved) || 0),
    weightedOpen: Math.round(Number(x.weighted_open) || 0),
    openCount: Number(x.open_count) || 0, wonCount: Number(x.won_count) || 0,
  }));
}

/** Set one quarter's target for one product. Entered, never computed — it is the only figure on the
 *  performance screen a human types, and that is deliberate: everything else is earned. */
export async function setTarget(product: string, year: number, quarter: number, amount: number, by: string): Promise<boolean> {
  if (!(await reprobe()) || !pool) return false;
  await pool.query(
    `INSERT INTO targets (product, year, quarter, amount, updated_at, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (product, year, quarter)
       DO UPDATE SET amount = EXCLUDED.amount, updated_at = EXCLUDED.updated_at,
                     updated_by = EXCLUDED.updated_by`,
    [product, year, quarter, Math.round(amount), Date.now(), by]);
  return true;
}

export async function counts(): Promise<{ contacts: number; messages: number; events: number } | null> {
  if (!pool || !connected) return null;
  try {
    const r = await pool.query(
      `SELECT (SELECT COUNT(*) FROM contacts) c, (SELECT COUNT(*) FROM messages) m, (SELECT COUNT(*) FROM events) e`);
    return { contacts: Number(r.rows[0].c), messages: Number(r.rows[0].m), events: Number(r.rows[0].e) };
  } catch { return null; }
}

// ------------------------------ entities (campaign targets) ------------------------------

export type EntityRow = {
  id: number; name: string; phone: string; size: string | null; city: string | null;
  attrs: Record<string, string>;
  /** Raw JSONB. Callers pass it through `facts.readFacts` — this layer stores, it does not judge. */
  facts: Record<string, unknown>;
  /** Product names an operator marked this account as a candidate for. Catalogue names verbatim. */
  productTags: string[];
};

export async function listEntities(): Promise<EntityRow[]> {
  if (!pool || !connected) return [];
  const r = await pool.query(`SELECT id, name, phone, size, city, attrs, facts, product_tags FROM entities ORDER BY name`);
  // Legacy size/city columns fold into attrs so the UI reads one uniform attribute map.
  return r.rows.map((x) => ({
    ...x, id: Number(x.id),
    facts: x.facts ?? {},
    productTags: Array.isArray(x.product_tags) ? x.product_tags.filter((t: unknown) => typeof t === "string") : [],
    attrs: {
      ...(x.size ? { "الحجم": x.size } : {}),
      ...(x.city ? { "المدينة": x.city } : {}),
      ...(x.attrs ?? {}),
    },
  }));
}

export async function addEntities(rows: { name: string; phone: string; size?: string; city?: string; attrs?: Record<string, string>; tags?: string[] }[],
  meta: { source: acct.AccountSource; by: string } = { source: "manual", by: "" }):
  Promise<{ added: number; updated: number; skipped: number }> {
  if (!pool || !connected) return { added: 0, updated: 0, skipped: rows.length };
  let added = 0, updated = 0, skipped = 0;
  for (const r of rows) {
    try {
      // BR-CUS-001/002/005: a customer sheet's القطاع · الأهمية · جهة الاتصال · المنصب · البريد columns
      // fill the account columns and its first contact. A re-import never overwrites what a person set.
      const fields = acct.accountFieldsFromAttrs(r.attrs ?? {});
      // The sheet is fact producer #1 (src/facts.ts). Mapped columns become TYPED facts with
      // `source:'human', by:'import'` in the same upsert, so an import can never land a fact the
      // agent then re-asks for. `||` merges at key level: a re-import updates the columns it
      // carries and leaves every other fact — including the agent's readings — standing.
      const imported = facts.factsFromAttrs(
        { ...(r.attrs ?? {}), ...(r.size ? { "الحجم": r.size } : {}), ...(r.city ? { "المدينة": r.city } : {}) },
        Date.now());
      // Tags UNION rather than replace, matching the `||` merge on attrs and facts one line up: a
      // re-import adds the lines its column names and leaves every tag an operator applied by hand
      // standing. jsonb_agg(DISTINCT …) is what stops a re-import doubling a tag already present.
      const res = await pool.query(
        `INSERT INTO entities (name, phone, size, city, attrs, facts, product_tags, created_at, updated_at, sector, importance, source, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,$9,$10,$11,$12)
         ON CONFLICT (phone) DO UPDATE SET
           name = EXCLUDED.name,
           size = COALESCE(EXCLUDED.size, entities.size),
           city = COALESCE(EXCLUDED.city, entities.city),
           sector = COALESCE(entities.sector, EXCLUDED.sector),
           importance = COALESCE(entities.importance, EXCLUDED.importance),
           updated_at = EXCLUDED.updated_at,
           attrs = entities.attrs || EXCLUDED.attrs,
           facts = entities.facts || EXCLUDED.facts,
           product_tags = (
             SELECT COALESCE(jsonb_agg(DISTINCT v), '[]'::jsonb)
               FROM jsonb_array_elements(entities.product_tags || EXCLUDED.product_tags) AS v)
         RETURNING id, (xmax = 0) AS inserted`,
        [r.name, r.phone, r.size ?? null, r.city ?? (r.attrs?.["المدينة"] || null), JSON.stringify(r.attrs ?? {}),
         JSON.stringify(imported), JSON.stringify(r.tags ?? []), Date.now(),
         fields.sector, fields.importance, meta.source, meta.by || null]);
      const row = res.rows[0];
      row?.inserted ? added++ : updated++;
      // The sheet's contact becomes the account's first person only while the account has none — a
      // re-import must not stack a copy of the same person on every upload.
      if (row && fields.contact) {
        await pool.query(
          `INSERT INTO entity_contacts (entity_id, name, role, phone, email, is_primary, position, created_at, created_by)
           SELECT $1, $2, $3, $4, $5, true, 0, $6, $7
            WHERE NOT EXISTS (SELECT 1 FROM entity_contacts WHERE entity_id = $1)`,
          [Number(row.id), fields.contact.name, fields.contact.role, r.phone, fields.contact.email, Date.now(), meta.by || meta.source]);
      }
    } catch { skipped++; }
  }
  return { added, updated, skipped };
}

/**
 * Add or remove ONE product tag across a set of accounts, in one statement.
 *
 * The value written is the catalogue name VERBATIM, because the filter reads it back by exact
 * match — the emitted-value-must-be-readable rule this codebase has broken before. The caller
 * validates the name against the catalogue; this layer refuses an empty one and nothing else.
 *
 * jsonb set semantics by hand: Postgres has no array-set type here, so add is a de-duplicating
 * concat and remove is a filter. Both are idempotent, which is what makes a bulk action over a
 * selection that partially already carries the tag behave the way the operator expects.
 */
export async function setProductTag(ids: number[], product: string, add: boolean): Promise<number> {
  if (!pool || !connected) return 0;
  if (!product.trim() || !ids.length) return 0;
  const r = add
    ? await pool.query(
        `UPDATE entities
            SET product_tags = (
              SELECT COALESCE(jsonb_agg(DISTINCT v), '[]'::jsonb)
                FROM jsonb_array_elements(product_tags || to_jsonb($2::text)) AS v)
          WHERE id = ANY($1::bigint[])`, [ids, product])
    : await pool.query(
        `UPDATE entities
            SET product_tags = (
              SELECT COALESCE(jsonb_agg(v), '[]'::jsonb)
                FROM jsonb_array_elements(product_tags) AS v
               WHERE v <> to_jsonb($2::text))
          WHERE id = ANY($1::bigint[])`, [ids, product]);
  return r.rowCount ?? 0;
}

// --------------------------------------------------------------------------- tag registry
export type TagRow = { id: number; name: string; created_at: number; created_by: string | null; archived: boolean };

export async function listTags(): Promise<TagRow[]> {
  if (!pool || !connected) return [];
  // archived rides along so every picker that offers a product for NEW work (the opps drawer) can
  // leave archived ones out, while filters over existing data still see them (spec: archive, not delete).
  const r = await pool.query(
    `SELECT t.id, t.name, t.created_at, t.created_by, (m.archived_at IS NOT NULL) AS archived
       FROM tags t LEFT JOIN product_meta m ON m.product = t.name ORDER BY t.name`);
  return r.rows.map((x) => ({ ...x, id: Number(x.id), created_at: Number(x.created_at), archived: !!x.archived }));
}

/** Idempotent. Returns false when the name already exists — a duplicate is not an error, it is a
 *  no-op, because the caller's intent («this label should exist») is already satisfied. */
export async function createTag(name: string, by: string): Promise<boolean> {
  if (!pool || !connected) return false;
  const r = await pool.query(
    `INSERT INTO tags (name, created_at, created_by) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING`,
    [name, Date.now(), by]);
  return (r.rowCount ?? 0) > 0;
}

/**
 * Rename in ONE transaction across BOTH stores. The registry and every entity carrying the old name
 * must move together: a crash between two separate commits leaves a tag that exists on accounts and
 * not in the registry, which then fails its own write validation forever.
 *
 * DISTINCT is load-bearing. An account already carrying the destination name would otherwise end up
 * holding it twice, and a duplicate inside the array makes every count off by one.
 */
/**
 * Every table that keys work by PRODUCT NAME. The name is a string key in ten places, so a rename
 * is a ten-table write or it is data loss.
 *
 * Derived by asking the database, not by memory:
 *   SELECT table_name FROM information_schema.columns WHERE column_name = 'product'
 * The old renameTag moved ONE of them. `scripts/check-rename-cascade.mjs` re-asks that question on
 * every build, so a new table with a `product` column fails the gate until it is listed here.
 */
const PRODUCT_NAME_TABLES = [
  "opportunities", "targets", "packages", "product_meta", "pipelines",
  "campaigns", "interest_tags", "opp_auto", "product_assets", "product_kb", "usage_indicators",
] as const;

export type RenameResult = { ok: boolean; moved: Record<string, number> };

/**
 * Rename a product, everywhere it is written down.
 *
 * WHAT THIS FIXES. The old version updated `tags` and `entities.product_tags` and returned true.
 * Measured against Postgres: after a rename the `targets` row still carried the OLD name, and
 * salesPerformance joins targets ON tgt.product = t.name — so the founder's quarterly target
 * silently left the board while every figure on it still rendered. Nine tables behaved that way.
 *
 * WHY THE CONSTRAINT IS DEFERRED. opportunities has a composite FK (package_id, product) into
 * packages (id, product). Whichever side moves first violates it against the other, so neither can
 * move alone. Deferring to COMMIT lets both move and still be checked before anything is durable —
 * the check is not skipped, only postponed. Migration 006 made the constraint DEFERRABLE for this.
 *
 * Returns per-table counts rather than a boolean, because «تم» after a ten-table write says nothing
 * about whether the write found anything, and this function's whole history is of silently missing
 * rows.
 */
export async function renameTag(from: string, to: string): Promise<RenameResult> {
  const moved: Record<string, number> = {};
  if (!pool || !connected) return { ok: false, moved };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Postponed, not skipped: still verified at COMMIT, so a rename that would break the package
    // link still rolls the whole thing back.
    await client.query("SET CONSTRAINTS opp_package_product_fk DEFERRED");
    const r = await client.query(`UPDATE tags SET name = $2 WHERE name = $1`, [from, to]);
    if (!(r.rowCount ?? 0)) { await client.query("ROLLBACK"); return { ok: false, moved }; }
    moved.tags = r.rowCount ?? 0;

    for (const t of PRODUCT_NAME_TABLES) {
      // Identifier is from a frozen const list, never from a caller; the VALUES are parameterised.
      const u = await client.query(`UPDATE ${t} SET product = $2 WHERE product = $1`, [from, to]);
      if (u.rowCount) moved[t] = u.rowCount;
    }

    const e = await client.query(
      `UPDATE entities
          SET product_tags = (
            SELECT COALESCE(jsonb_agg(DISTINCT CASE WHEN v = to_jsonb($1::text) THEN to_jsonb($2::text) ELSE v END), '[]'::jsonb)
              FROM jsonb_array_elements(product_tags) AS v)
        WHERE product_tags @> jsonb_build_array($1::text)`, [from, to]);
    if (e.rowCount) moved.entities = e.rowCount;

    // Suggestion dismissals are keyed «rule|product|fromProduct|ids». Without this a rename brought
    // every dismissed suggestion for the product back (eng review).
    const dk = await client.query(
      `UPDATE suggestion_dismissals
          SET key = concat_ws('|', split_part(key, '|', 1),
                CASE WHEN split_part(key, '|', 2) = $1 THEN $2 ELSE split_part(key, '|', 2) END,
                CASE WHEN split_part(key, '|', 3) = $1 THEN $2 ELSE split_part(key, '|', 3) END,
                split_part(key, '|', 4))
        WHERE split_part(key, '|', 2) = $1 OR split_part(key, '|', 3) = $1`, [from, to]);
    if (dk.rowCount) moved.suggestion_dismissals = dk.rowCount;

    await client.query("COMMIT");
    return { ok: true, moved };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally { client.release(); }
}

/** Delete the tag AND strip it from every account, in one transaction. Returns how many accounts
 *  lost it, so the UI can report a real number rather than «تم». */
export async function deleteTag(name: string): Promise<{ ok: boolean; cleared: number }> {
  if (!pool || !connected) return { ok: false, cleared: 0 };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const r = await client.query(`DELETE FROM tags WHERE name = $1`, [name]);
    const u = await client.query(
      `UPDATE entities
          SET product_tags = (
            SELECT COALESCE(jsonb_agg(v), '[]'::jsonb)
              FROM jsonb_array_elements(product_tags) AS v
             WHERE v <> to_jsonb($1::text))
        WHERE product_tags @> jsonb_build_array($1::text)`, [name]);
    await client.query("COMMIT");
    return { ok: (r.rowCount ?? 0) > 0, cleared: u.rowCount ?? 0 };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally { client.release(); }
}

export async function deleteEntity(id: number): Promise<void> {
  if (!pool || !connected) return;
  await pool.query(`DELETE FROM entities WHERE id = $1`, [id]);
}

/** One entity by phone. The agent's account snapshot is built from `listEntities`; this is the
 *  read-modify-write path for a single fact and must see the CURRENT row, not the snapshot. */
export async function getEntityFacts(phone: string): Promise<Record<string, unknown> | null> {
  if (!pool || !connected) return null;
  const r = await pool.query(`SELECT facts FROM entities WHERE phone = $1`, [phone]);
  return r.rows.length ? (r.rows[0].facts ?? {}) : null;
}

/** Name + facts for one entity. Used by the fact write path so a single write does not have to
 *  scan the whole table to refresh one row of the snapshot. */
export async function getEntity(phone: string): Promise<{ name: string; facts: Record<string, unknown> } | null> {
  if (!pool || !connected) return null;
  const r = await pool.query(`SELECT name, facts FROM entities WHERE phone = $1`, [phone]);
  return r.rows.length ? { name: String(r.rows[0].name ?? ""), facts: r.rows[0].facts ?? {} } : null;
}

/** Persist the whole fact set for one entity. Returns false when the row does not exist — a fact
 *  never manufactures an entity from a typo (the `unknown_phone` precedent in tracker.ts). */
export async function saveEntityFacts(phone: string, value: Record<string, unknown>): Promise<boolean> {
  if (!pool || !connected) return false;
  const r = await pool.query(`UPDATE entities SET facts = $2 WHERE phone = $1`, [phone, JSON.stringify(value)]);
  return (r.rowCount ?? 0) > 0;
}

/**
 * Make sure an entity row exists for a phone we are ALREADY in a WhatsApp conversation with.
 *
 * This is not the typo case the guard above protects against: a live thread is proof the number
 * is real. Without this an inbound stranger's facts would have nowhere to land and the loop would
 * only ever close for imported targets. Never overwrites an existing row.
 */
export async function ensureEntity(phone: string, name: string): Promise<boolean> {
  if (!pool || !connected) return false;
  try {
    await pool.query(
      `INSERT INTO entities (name, phone, attrs, facts, created_at, updated_at, source, created_by) VALUES ($1,$2,'{}','{}',$3,$3,'whatsapp','المساعد')
       ON CONFLICT (phone) DO NOTHING`,
      [name || phone, phone, Date.now()]);
    return true;
  } catch { return false; }
}

// ------------------------------ customer accounts (BRD §9, slice S2) ------------------------------

export type ContactRow = { id: number; name: string; role: string | null; phone: string | null; email: string | null; primary: boolean };
export type AccountRow = {
  id: number; name: string; phone: string; city: string | null; sector: string | null; importance: string | null;
  ownerId: number | null; ownerName: string | null; approval: string; approvalBy: string | null; approvalAt: number | null;
  source: string | null; createdBy: string | null; createdAt: number; updatedAt: number;
  productTags: string[]; usesProducts: string[];
  contactCount: number; primaryContact: Omit<ContactRow, "id"> | null; contactText: string;
  opps: { count: number; open: number; won: number; value: number }; oppProducts: string[];
};

const ACCOUNT_SELECT = `
  SELECT e.id, e.name, e.phone, e.city, e.sector, e.importance, e.owner_member_id, m.name AS owner_name,
         e.approval, e.approval_by, e.approval_at, e.source, e.created_by, e.created_at, e.updated_at, e.product_tags,
         e.facts->'currentProducts'->>'value' AS uses,
         (SELECT json_agg(json_build_object('id', c.id, 'name', c.name, 'role', c.role, 'phone', c.phone, 'email', c.email, 'primary', c.is_primary)
                          ORDER BY c.is_primary DESC, c.position, c.id)
            FROM entity_contacts c WHERE c.entity_id = e.id) AS contacts,
         (SELECT json_agg(json_build_object('product', o.product, 'stage', o.stage, 'sale_price', o.sale_price, 'years', o.years, 'qty', o.qty, 'discount', o.discount))
            FROM opportunities o WHERE o.phone = e.phone) AS opp_lines
    FROM entities e LEFT JOIN team_members m ON m.id = e.owner_member_id`;

function accountFrom(x: any): AccountRow & { contacts: ContactRow[] } {
  const contacts: ContactRow[] = (Array.isArray(x.contacts) ? x.contacts : []).map((c: any) => ({
    id: Number(c.id), name: String(c.name), role: c.role ?? null, phone: c.phone ?? null, email: c.email ?? null, primary: c.primary === true,
  }));
  const lines = (Array.isArray(x.opp_lines) ? x.opp_lines : []).map((l: any) => ({
    product: String(l.product), stage: String(l.stage), salePrice: Number(l.sale_price) || 0, years: Number(l.years) || 1,
    quantity: Number(l.qty) || 1, discountPercent: Number(l.discount) || 0,
  }));
  const p = contacts[0];
  return {
    id: Number(x.id), name: String(x.name), phone: String(x.phone), city: x.city ?? null, sector: x.sector ?? null, importance: x.importance ?? null,
    ownerId: x.owner_member_id == null ? null : Number(x.owner_member_id), ownerName: x.owner_name ?? null,
    approval: String(x.approval), approvalBy: x.approval_by ?? null, approvalAt: x.approval_at == null ? null : Number(x.approval_at),
    source: x.source ?? null, createdBy: x.created_by ?? null, createdAt: Number(x.created_at), updatedAt: Number(x.updated_at ?? x.created_at),
    productTags: Array.isArray(x.product_tags) ? x.product_tags.filter((t: unknown) => typeof t === "string") : [],
    usesProducts: String(x.uses ?? "").split(/[،,]/).map((s) => s.trim()).filter(Boolean),
    contactCount: contacts.length,
    primaryContact: p ? { name: p.name, role: p.role, phone: p.phone, email: p.email, primary: p.primary } : null,
    contactText: contacts.map((c) => [c.name, c.role ?? "", c.email ?? "", c.phone ?? ""].join(" ")).join(" "),
    opps: acct.summarizeAccountOpps(lines),
    oppProducts: [...new Set<string>(lines.map((l: { product: string }) => l.product))],
    contacts,
  };
}

export async function listAccounts(): Promise<AccountRow[]> {
  if (!pool || !connected) return [];
  const r = await pool.query(ACCOUNT_SELECT + " ORDER BY e.name");
  return r.rows.map((x) => { const { contacts: _c, ...row } = accountFrom(x); return row; });
}

export async function accountById(id: number): Promise<(AccountRow & { contacts: ContactRow[]; events: { action: string; detail: unknown; by: string | null; at: number }[] }) | null> {
  if (!pool || !connected) return null;
  const r = await pool.query(ACCOUNT_SELECT + " WHERE e.id = $1", [id]);
  if (!r.rows.length) return null;
  const ev = await pool.query(`SELECT action, detail, by_name, at FROM account_events WHERE entity_id = $1 ORDER BY at DESC, id DESC LIMIT 30`, [id]);
  return { ...accountFrom(r.rows[0]), events: ev.rows.map((e) => ({ action: String(e.action), detail: e.detail ?? {}, by: e.by_name ?? null, at: Number(e.at) })) };
}

export async function accountIdByPhone(phone: string): Promise<number | null> {
  if (!pool || !connected) return null;
  const r = await pool.query(`SELECT id FROM entities WHERE phone = $1`, [phone]);
  return r.rows.length ? Number(r.rows[0].id) : null;
}

async function writeContacts(client: pg.PoolClient, entityId: number, contacts: readonly acct.ContactValue[], by: string): Promise<void> {
  await client.query(`DELETE FROM entity_contacts WHERE entity_id = $1`, [entityId]);
  if (!contacts.length) return;
  await client.query(
    `INSERT INTO entity_contacts (entity_id, name, role, phone, email, is_primary, position, created_at, created_by)
     SELECT $1, u.name, u.role, u.phone, u.email, u.is_primary, u.position, $2, $3
       FROM unnest($4::text[], $5::text[], $6::text[], $7::text[], $8::boolean[], $9::int[]) AS u(name, role, phone, email, is_primary, position)`,
    [entityId, Date.now(), by,
     contacts.map((c) => c.name), contacts.map((c) => c.role), contacts.map((c) => c.phone), contacts.map((c) => c.email),
     contacts.map((c) => c.primary), contacts.map((_, i) => i)]);
}

/** BR-CUS-001/005. The account arrives «مقترح» with its source and author; a phone already on file is a
 *  conflict naming that account, never a silent merge into it. */
export async function createAccount(v: acct.AccountValue, source: acct.AccountSource, by: string): Promise<{ id: number } | { conflict: number } | null> {
  if (!pool || !connected) return null;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const now = Date.now();
    const ins = await client.query(
      `INSERT INTO entities (name, phone, city, sector, importance, owner_member_id, approval, source, created_by, created_at, updated_at, attrs, facts)
       VALUES ($1,$2,$3,$4,$5,$6,'proposed',$7,$8,$9,$9,'{}','{}')
       ON CONFLICT (phone) DO NOTHING RETURNING id`,
      [v.name, v.phone, v.city, v.sector, v.importance, v.ownerId, source, by, now]);
    if (!ins.rows.length) {
      await client.query("ROLLBACK");
      const ex = await pool.query(`SELECT id FROM entities WHERE phone = $1`, [v.phone]);
      return { conflict: ex.rows.length ? Number(ex.rows[0].id) : 0 };
    }
    const id = Number(ins.rows[0].id);
    await writeContacts(client, id, v.contacts, by);
    await client.query(`INSERT INTO account_events (entity_id, action, detail, by_name, at) VALUES ($1,'created',$2,$3,$4)`,
      [id, JSON.stringify({ source, contacts: v.contacts.length }), by, now]);
    await client.query("COMMIT");
    return { id };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally { client.release(); }
}

/** Edit everything but the phone. `ifUpdatedAt` is the version the editor loaded: two people editing the
 *  same account in two tabs get a conflict, not a silent last-write-wins. */
export async function updateAccount(id: number, v: acct.AccountValue, ifUpdatedAt: number | null, by: string):
  Promise<{ ok: true; updatedAt: number } | { stale: true } | null> {
  if (!pool || !connected) return null;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cur = await client.query(`SELECT name, city, sector, importance, owner_member_id, updated_at, created_at FROM entities WHERE id = $1 FOR UPDATE`, [id]);
    if (!cur.rows.length) { await client.query("ROLLBACK"); return null; }
    const was = cur.rows[0];
    const version = Number(was.updated_at ?? was.created_at);
    if (ifUpdatedAt != null && ifUpdatedAt !== version) { await client.query("ROLLBACK"); return { stale: true }; }
    const now = Math.max(Date.now(), version + 1);
    await client.query(
      `UPDATE entities SET name=$2, city=$3, sector=$4, importance=$5, owner_member_id=$6, updated_at=$7 WHERE id=$1`,
      [id, v.name, v.city, v.sector, v.importance, v.ownerId, now]);
    await writeContacts(client, id, v.contacts, by);
    const changed = [
      was.name !== v.name ? "name" : "", (was.city ?? null) !== v.city ? "city" : "", (was.sector ?? null) !== v.sector ? "sector" : "",
      (was.importance ?? null) !== v.importance ? "importance" : "",
      (was.owner_member_id == null ? null : Number(was.owner_member_id)) !== v.ownerId ? "owner" : "",
    ].filter(Boolean);
    await client.query(`INSERT INTO account_events (entity_id, action, detail, by_name, at) VALUES ($1,'edited',$2,$3,$4)`,
      [id, JSON.stringify({ changed, contacts: v.contacts.length }), by, now]);
    await client.query("COMMIT");
    return { ok: true, updatedAt: now };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally { client.release(); }
}

export async function setAccountApproval(id: number, decision: acct.AccountApproval, note: string | null, by: string):
  Promise<{ ok: true; updatedAt: number } | { refused: string } | null> {
  if (!pool || !connected) return null;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cur = await client.query(`SELECT approval, updated_at, created_at FROM entities WHERE id = $1 FOR UPDATE`, [id]);
    if (!cur.rows.length) { await client.query("ROLLBACK"); return null; }
    const check = acct.checkApproval(String(cur.rows[0].approval), decision);
    if (!check.ok) { await client.query("ROLLBACK"); return { refused: check.reason }; }
    const now = Math.max(Date.now(), Number(cur.rows[0].updated_at ?? cur.rows[0].created_at) + 1);
    await client.query(`UPDATE entities SET approval=$2, approval_by=$3, approval_at=$4, updated_at=$4 WHERE id=$1`, [id, decision, by, now]);
    await client.query(`INSERT INTO account_events (entity_id, action, detail, by_name, at) VALUES ($1,$2,$3,$4,$5)`,
      [id, decision, JSON.stringify({ from: cur.rows[0].approval, note }), by, now]);
    await client.query("COMMIT");
    return { ok: true, updatedAt: now };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally { client.release(); }
}

/** The account's side of every other record: opportunity lines and campaigns sent to its number. */
export async function accountActivity(phone: string): Promise<{
  opps: { id: number; product: string; stage: string; value: number; owner: string | null; closeOn: number | null; source: string; nextStep: string | null; updatedAt: number }[];
  campaigns: { id: number; name: string; product: string | null; objective: string | null; createdAt: number; outcome: string | null }[];
}> {
  if (!pool || !connected) return { opps: [], campaigns: [] };
  const [o, c] = await Promise.all([
    pool.query(`SELECT id, product, stage, sale_price, years, qty, discount, owner, close_on, source, next_step, updated_at FROM opportunities WHERE phone = $1 ORDER BY updated_at DESC LIMIT 100`, [phone]),
    pool.query(`SELECT c.id, c.name, c.product, c.objective, c.created_at, t.outcome
                  FROM campaign_targets t JOIN campaigns c ON c.id = t.campaign_id
                 WHERE t.phone = $1 AND c.test = false ORDER BY c.created_at DESC LIMIT 50`, [phone]),
  ]);
  return {
    opps: o.rows.map((x) => ({
      id: Number(x.id), product: String(x.product), stage: String(x.stage), owner: x.owner ?? null, source: String(x.source),
      closeOn: x.close_on == null ? null : Number(x.close_on), nextStep: x.next_step ?? null, updatedAt: Number(x.updated_at),
      value: acct.summarizeAccountOpps([{ product: String(x.product), stage: "contact", salePrice: Number(x.sale_price) || 0, years: Number(x.years) || 1, quantity: Number(x.qty) || 1, discountPercent: Number(x.discount) || 0 }]).value,
    })),
    campaigns: c.rows.map((x) => ({ id: Number(x.id), name: String(x.name), product: x.product ?? null, objective: x.objective ?? null, createdAt: Number(x.created_at), outcome: x.outcome ?? null })),
  };
}

// ------------------------------ contact insights (فهم المساعد cache) ------------------------------

export async function getInsightsRow(phone: string): Promise<{ data: unknown; turns_at: number; computed_at: number } | null> {
  if (!pool || !connected) return null;
  try {
    const r = await pool.query(`SELECT data, turns_at, computed_at FROM contact_insights WHERE phone = $1`, [phone]);
    return r.rows[0] ? { data: r.rows[0].data, turns_at: Number(r.rows[0].turns_at), computed_at: Number(r.rows[0].computed_at) } : null;
  } catch { return null; }
}

export async function listInsights(): Promise<{ phone: string; data: unknown }[]> {
  if (!pool || !connected) return [];
  try {
    const r = await pool.query(`SELECT phone, data FROM contact_insights`);
    return r.rows;
  } catch { return []; }
}

export function saveInsights(phone: string, data: unknown, turnsAt: number): void {
  fire(
    `INSERT INTO contact_insights (phone, data, turns_at, computed_at) VALUES ($1,$2,$3,$4)
     ON CONFLICT (phone) DO UPDATE SET data = EXCLUDED.data, turns_at = EXCLUDED.turns_at, computed_at = EXCLUDED.computed_at`,
    [phone, JSON.stringify(data), turnsAt, Date.now()]);
}

// ------------------------------ product hub (agent-readable KB) ------------------------------

export type KbRow = {
  product: string; md: string; source_filename: string | null; updated_at: number;
  draft_md: string | null; draft_source: string | null; draft_by: string | null; draft_at: number | null;
  approved_by: string | null; approved_at: number | null;
};

const KB_COLS = "product, md, source_filename, updated_at, draft_md, draft_source, draft_by, draft_at, approved_by, approved_at";
function rowToKb(x: any): KbRow {
  return {
    product: String(x.product), md: String(x.md ?? ""),
    source_filename: x.source_filename == null ? null : String(x.source_filename),
    updated_at: Number(x.updated_at) || 0,
    draft_md: x.draft_md == null ? null : String(x.draft_md),
    draft_source: x.draft_source == null ? null : String(x.draft_source),
    draft_by: x.draft_by == null ? null : String(x.draft_by),
    draft_at: x.draft_at == null ? null : Number(x.draft_at),
    approved_by: x.approved_by == null ? null : String(x.approved_by),
    approved_at: x.approved_at == null ? null : Number(x.approved_at),
  };
}

/** Every product_kb row, drafts and provenance included. The ADMIN read — the assistant never
 *  reads this; it reads runtimeKb(). */
export async function listKb(): Promise<KbRow[]> {
  if (!pool || !connected) return [];
  return (await pool.query(`SELECT ${KB_COLS} FROM product_kb ORDER BY product`)).rows.map(rowToKb);
}

export async function knowledgeOf(product: string): Promise<KbRow | null> {
  if (!(await reprobe()) || !pool) return null;
  const r = await pool.query(`SELECT ${KB_COLS} FROM product_kb WHERE product = $1`, [product]);
  return r.rows[0] ? rowToKb(r.rows[0]) : null;
}

/** Hex SHA-256 of the exact UTF-8 text. The approval handshake: the reviewer approves the bytes
 *  they were shown, and the server approves only if the stored bytes still hash the same. */
export function sha256Hex(text: string): string {
  return createHash("sha256").update(String(text ?? ""), "utf8").digest("hex");
}

/**
 * The upload writer — and it writes the DRAFT, never md. kb.processDeck calls this with what the
 * model extracted; nothing the model wrote reaches the assistant until approveKbDraft copies it.
 * A product with no row yet gets one with md = '' so the draft has somewhere to live.
 */
export async function saveKb(product: string, md: string, sourceFilename: string, by: string | null = null): Promise<void> {
  if (!pool || !connected) throw new Error("db not connected — product hub requires Postgres");
  await pool.query(
    `INSERT INTO product_kb (product, md, source_filename, updated_at, draft_md, draft_source, draft_by, draft_at)
     VALUES ($1, '', NULL, $4, $2, $3, $5, $4)
     ON CONFLICT (product) DO UPDATE SET draft_md = EXCLUDED.draft_md, draft_source = EXCLUDED.draft_source,
       draft_by = EXCLUDED.draft_by, draft_at = EXCLUDED.draft_at`,
    [product, md, sourceFilename, Date.now(), by]);
}

/** kb.processDeck does not know who is uploading; the endpoint does, and stamps it after. */
export async function setKbDraftBy(product: string, by: string): Promise<void> {
  if (!pool || !connected) return;
  await pool.query(`UPDATE product_kb SET draft_by = $2 WHERE product = $1 AND draft_md IS NOT NULL`, [product, by]);
}

/**
 * «اعتماد المعرفة»: draft → md, atomically, and only if the draft is still the one the reviewer
 * saw. FOR UPDATE so two reviewers cannot both approve different drafts of one product.
 */
export async function approveKbDraft(product: string, draftHash: string, by: string):
  Promise<"ok" | "no_draft" | "stale"> {
  if (!pool || !connected) throw new Error("db not connected");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const r = await client.query(`SELECT draft_md, draft_source FROM product_kb WHERE product = $1 FOR UPDATE`, [product]);
    const row = r.rows[0];
    if (!row || row.draft_md == null) { await client.query("ROLLBACK"); return "no_draft"; }
    if (sha256Hex(String(row.draft_md)) !== draftHash) { await client.query("ROLLBACK"); return "stale"; }
    const now = Date.now();
    await client.query(
      `UPDATE product_kb SET md = draft_md, source_filename = draft_source, approved_by = $2, approved_at = $3,
              updated_at = $3, draft_md = NULL, draft_source = NULL, draft_by = NULL, draft_at = NULL
        WHERE product = $1`, [product, by, now]);
    await client.query("COMMIT");
    return "ok";
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally { client.release(); }
}

/** «اعتماد النص الحالي» for a legacy row: records who approved the text as it stands. Content is
 *  untouched — this is a signature, not an edit. */
export async function approveKbCurrent(product: string, contentHash: string, by: string):
  Promise<"ok" | "no_knowledge" | "stale"> {
  if (!pool || !connected) throw new Error("db not connected");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const r = await client.query(`SELECT md FROM product_kb WHERE product = $1 FOR UPDATE`, [product]);
    const row = r.rows[0];
    if (!row || !String(row.md ?? "").trim()) { await client.query("ROLLBACK"); return "no_knowledge"; }
    if (sha256Hex(String(row.md)) !== contentHash) { await client.query("ROLLBACK"); return "stale"; }
    await client.query(`UPDATE product_kb SET approved_by = $2, approved_at = $3 WHERE product = $1`,
      [product, by, Date.now()]);
    await client.query("COMMIT");
    return "ok";
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally { client.release(); }
}

/** Discard a draft. A row that held ONLY a draft (md = '') is removed with it, so «none» is a
 *  missing row rather than an empty one. Approved text is never touched. */
export async function discardKbDraft(product: string): Promise<boolean> {
  if (!pool || !connected) throw new Error("db not connected");
  const r = await pool.query(
    `UPDATE product_kb SET draft_md = NULL, draft_source = NULL, draft_by = NULL, draft_at = NULL
      WHERE product = $1 AND draft_md IS NOT NULL`, [product]);
  if (!(r.rowCount ?? 0)) return false;
  await pool.query(`DELETE FROM product_kb WHERE product = $1 AND md = '' AND draft_md IS NULL`, [product]);
  return true;
}

/**
 * WHAT THE ASSISTANT READS (spec B′ rule 1). Approved text only, for a product that is a live,
 * non-archived tag. Drafts, legacy rows, archived products and `__*` pseudo-products never
 * appear here — not filtered later, not filtered by the prompt; they are not in the result.
 */
export async function runtimeKb(): Promise<{ product: string; md: string }[]> {
  if (!pool || !connected) return [];
  const r = await pool.query(
    `SELECT k.product, k.md
       FROM product_kb k
       JOIN tags t ON t.name = k.product
       LEFT JOIN product_meta pm ON pm.product = k.product
      WHERE k.approved_at IS NOT NULL AND k.md <> ''
        AND pm.archived_at IS NULL
        AND k.product NOT LIKE '\\_\\_%'
      ORDER BY k.product`);
  return r.rows.map((x: any) => ({ product: String(x.product), md: String(x.md) }));
}

/**
 * WHAT THE ASSISTANT MAY SEND (spec B′ rule 3): the intro PDF of a runtime-eligible product —
 * live tag, not archived, and either approved knowledge or membership of the embedded catalogue
 * (passed in, because the catalogue constant lives above this tier).
 */
export async function runtimeAssets(embedded: readonly string[]):
  Promise<{ product: string; public_id: string; filename: string }[]> {
  if (!pool || !connected) return [];
  const r = await pool.query(
    `SELECT a.product, a.public_id, a.filename
       FROM product_assets a
       JOIN tags t ON t.name = a.product
       LEFT JOIN product_meta pm ON pm.product = a.product
       LEFT JOIN product_kb k ON k.product = a.product
      WHERE pm.archived_at IS NULL
        AND a.product NOT LIKE '\\_\\_%'
        AND ((k.approved_at IS NOT NULL AND k.md <> '') OR a.product = ANY($1::text[]))
      ORDER BY a.product`, [[...embedded]]);
  return r.rows.map((x: any) => ({ product: String(x.product), public_id: String(x.public_id), filename: String(x.filename) }));
}

/** Live (non-archived) tag names — what the wizard, the opps select and the launch guard treat
 *  as the product line. */
export async function activeTagNames(): Promise<string[]> {
  if (!pool || !connected) return [];
  const r = await pool.query(
    `SELECT t.name FROM tags t LEFT JOIN product_meta pm ON pm.product = t.name
      WHERE pm.archived_at IS NULL ORDER BY t.name`);
  return r.rows.map((x: any) => String(x.name));
}

export async function tagState(name: string): Promise<{ exists: boolean; archived: boolean }> {
  if (!(await reprobe()) || !pool) return { exists: false, archived: false };
  const r = await pool.query(
    `SELECT pm.archived_at FROM tags t LEFT JOIN product_meta pm ON pm.product = t.name WHERE t.name = $1`, [name]);
  if (!r.rows[0]) return { exists: false, archived: false };
  return { exists: true, archived: r.rows[0].archived_at != null };
}

// ------------------------------ campaigns (launches) ------------------------------

export async function createCampaign(name: string, product: string, message: string,
  targets: { phone: string; name?: string }[], test = false,
  origin: Record<string, unknown> | null = null, objective: string | null = null): Promise<number | null> {
  if (!pool || !connected) return null;
  // origin/objective ride the same INSERT: a campaign's attribution written in a second statement is
  // one that can be lost between the two.
  const r = await pool.query(
    `INSERT INTO campaigns (name, product, message, created_at, test, origin, objective) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [name, product, message, Date.now(), test, origin ? JSON.stringify(origin) : null, objective]);
  const id = Number(r.rows[0].id);
  for (const t of targets) {
    await pool.query(
      `INSERT INTO campaign_targets (campaign_id, phone, name) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
      [id, t.phone, t.name ?? null]);
  }
  return id;
}

export async function listCampaigns(): Promise<{
  id: number; name: string; product: string | null; message: string | null; created_at: string;
  test: boolean; origin: Record<string, unknown> | null; objective: string | null;
  targets: { phone: string; name: string | null }[];
}[]> {
  if (!pool || !connected) return [];
  const cs = (await pool.query(`SELECT * FROM campaigns ORDER BY created_at DESC`)).rows;
  const ts = (await pool.query(`SELECT campaign_id, phone, name FROM campaign_targets`)).rows;
  return cs.map((c) => ({
    id: Number(c.id), name: c.name, product: c.product, message: c.message, created_at: c.created_at,
    test: Boolean(c.test), origin: c.origin ?? null, objective: c.objective ?? null,
    targets: ts.filter((t) => Number(t.campaign_id) === Number(c.id)).map((t) => ({ phone: t.phone, name: t.name })),
  }));
}

// ------------------------------ «مؤشرات استخدام العملاء» ------------------------------
// Writers and readers ship together (gate step 18): the list, the record, the rule input and the
// customer record all read what createIndicator/updateIndicator/setIndicatorStatus write.

export type IndicatorRow = {
  id: number; name: string; description: string | null; product: string | null; signal: string;
  customerType: string; status: string; periodFrom: string | null; periodTo: string | null;
  dataUpdatedAt: string; source: string; sourceFilename: string | null;
  createdBy: string | null; createdAt: number; updatedBy: string | null; updatedAt: number;
  memberCount: number;
};
export type IndicatorMemberIn = { entityId: number; value?: string | null; period?: string | null; note?: string | null; sourceName?: string | null; matchedBy?: string | null };
export type IndicatorWrite = {
  name: string; description: string | null; product: string | null; signal: string; customerType: string;
  status: string; periodFrom: string | null; periodTo: string | null; dataUpdatedAt: string;
};

function indicatorOf(x: any): IndicatorRow {
  return {
    id: Number(x.id), name: String(x.name), description: x.description ?? null, product: x.product ?? null,
    signal: String(x.signal), customerType: String(x.customer_type), status: String(x.status),
    periodFrom: x.period_from ?? null, periodTo: x.period_to ?? null, dataUpdatedAt: String(x.data_updated_at),
    source: String(x.source), sourceFilename: x.source_filename ?? null,
    createdBy: x.created_by ?? null, createdAt: Number(x.created_at), updatedBy: x.updated_by ?? null,
    updatedAt: Number(x.updated_at), memberCount: Number(x.member_count) || 0,
  };
}

export async function listIndicators(): Promise<IndicatorRow[]> {
  if (!(await reprobe()) || !pool) return [];
  const r = await pool.query(
    `SELECT i.*, (SELECT COUNT(*) FROM usage_indicator_members m WHERE m.indicator_id = i.id) AS member_count
       FROM usage_indicators i ORDER BY i.updated_at DESC`);
  return r.rows.map(indicatorOf);
}

/** Distinct customers across ALL indicators — the «العملاء المشمولون» tile. Summing per-indicator
 *  counts (as the prototype did) counts a clinic in three indicators three times. */
export async function indicatorCoverage(): Promise<{ customers: number; activeCustomers: number }> {
  if (!(await reprobe()) || !pool) return { customers: 0, activeCustomers: 0 };
  const r = await pool.query(
    `SELECT COUNT(DISTINCT m.entity_id) AS n,
            COUNT(DISTINCT m.entity_id) FILTER (WHERE i.status = 'active') AS a
       FROM usage_indicator_members m JOIN usage_indicators i ON i.id = m.indicator_id`);
  return { customers: Number(r.rows[0]?.n) || 0, activeCustomers: Number(r.rows[0]?.a) || 0 };
}

export async function indicatorById(id: number): Promise<(IndicatorRow & {
  members: { entityId: number; name: string; phone: string; city: string | null; value: string | null; period: string | null; note: string | null; sourceName: string | null; matchedBy: string | null }[];
  events: { action: string; detail: Record<string, unknown>; by: string | null; at: number }[];
}) | null> {
  if (!(await reprobe()) || !pool) return null;
  const r = await pool.query(
    `SELECT i.*, (SELECT COUNT(*) FROM usage_indicator_members m WHERE m.indicator_id = i.id) AS member_count
       FROM usage_indicators i WHERE i.id = $1`, [id]);
  if (!r.rowCount) return null;
  const [m, ev] = await Promise.all([
    pool.query(
      `SELECT m.entity_id, e.name, e.phone, e.city, m.value, m.period, m.note, m.source_name, m.matched_by
         FROM usage_indicator_members m JOIN entities e ON e.id = m.entity_id
        WHERE m.indicator_id = $1 ORDER BY e.name`, [id]),
    pool.query(`SELECT action, detail, by_name, at FROM indicator_events WHERE indicator_id = $1 ORDER BY at DESC LIMIT 50`, [id]),
  ]);
  return {
    ...indicatorOf(r.rows[0]),
    members: m.rows.map((x: any) => ({ entityId: Number(x.entity_id), name: String(x.name), phone: String(x.phone), city: x.city ?? null,
      value: x.value ?? null, period: x.period ?? null, note: x.note ?? null, sourceName: x.source_name ?? null, matchedBy: x.matched_by ?? null })),
    events: ev.rows.map((x: any) => ({ action: String(x.action), detail: x.detail ?? {}, by: x.by_name ?? null, at: Number(x.at) })),
  };
}

async function writeMembers(client: pg.PoolClient, id: number, members: readonly IndicatorMemberIn[]): Promise<number> {
  await client.query("DELETE FROM usage_indicator_members WHERE indicator_id = $1", [id]);
  const seen = new Set<number>();
  const cols: { eid: number[]; value: (string | null)[]; period: (string | null)[]; note: (string | null)[]; src: (string | null)[]; by: (string | null)[] } =
    { eid: [], value: [], period: [], note: [], src: [], by: [] };
  for (const mm of members) {
    const eid = Number(mm.entityId);
    if (!Number.isInteger(eid) || seen.has(eid)) continue;
    seen.add(eid);
    cols.eid.push(eid); cols.value.push(mm.value || null); cols.period.push(mm.period || null);
    cols.note.push(mm.note || null); cols.src.push(mm.sourceName || null); cols.by.push(mm.matchedBy || null);
  }
  if (!cols.eid.length) return 0;
  // ONE statement for up to 5,000 rows. Row-by-row inserts held one of the pool's 3 connections for
  // thousands of round trips on a 256MB database (eng review). The JOIN skips a customer deleted
  // between preview and save instead of failing the whole save on a foreign key.
  const r = await client.query(
    `INSERT INTO usage_indicator_members (indicator_id, entity_id, value, period, note, source_name, matched_by)
     SELECT $1, e.id, u.value, u.period, u.note, u.src, u.by
       FROM unnest($2::bigint[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[]) AS u(eid, value, period, note, src, by)
       JOIN entities e ON e.id = u.eid
     ON CONFLICT DO NOTHING`,
    [id, cols.eid, cols.value, cols.period, cols.note, cols.src, cols.by]);
  return r.rowCount || 0;
}

/** `gone: true` = a non-draft save whose customers all vanished before it committed; nothing was
 *  written. The first version committed the empty active indicator and THEN answered 409, so a retry
 *  created a second copy. */
export async function createIndicator(v: IndicatorWrite, members: readonly IndicatorMemberIn[], source: string, sourceFilename: string | null, by: string, asDraft = false): Promise<{ id: number; members: number; gone?: boolean } | null> {
  if (!(await reprobe()) || !pool) return null;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const now = Date.now();
    const r = await client.query(
      `INSERT INTO usage_indicators (name, description, product, signal, customer_type, status, period_from, period_to,
         data_updated_at, source, source_filename, created_by, created_at, updated_by, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$12,$13) RETURNING id`,
      [v.name, v.description, v.product, v.signal, v.customerType, v.status, v.periodFrom, v.periodTo, v.dataUpdatedAt, source, sourceFilename, by, now]);
    const id = Number(r.rows[0].id);
    const n = await writeMembers(client, id, members);
    if (!asDraft && n < 1) { await client.query("ROLLBACK"); return { id: 0, members: 0, gone: true }; }
    await client.query(`INSERT INTO indicator_events (indicator_id, action, detail, by_name, at) VALUES ($1,'created',$2,$3,$4)`,
      [id, JSON.stringify({ status: v.status, members: n, source, product: v.product }), by, now]);
    await client.query("COMMIT");
    return { id, members: n };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally { client.release(); }
}

/** `members === null` keeps the customer list untouched (a metadata edit); an array REPLACES it
 *  (a data update). The audit row says which happened, with before/after counts. */
export async function updateIndicator(id: number, v: IndicatorWrite, members: readonly IndicatorMemberIn[] | null, source: string | null, sourceFilename: string | null, by: string, asDraft = false): Promise<{ members: number; gone?: boolean } | null> {
  if (!(await reprobe()) || !pool) return null;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cur = await client.query(
      `SELECT i.status, (SELECT COUNT(*) FROM usage_indicator_members m WHERE m.indicator_id = i.id) AS n
         FROM usage_indicators i WHERE i.id = $1 FOR UPDATE`, [id]);
    if (!cur.rowCount) { await client.query("ROLLBACK"); return null; }
    const now = Date.now();
    await client.query(
      `UPDATE usage_indicators SET name=$2, description=$3, product=$4, signal=$5, customer_type=$6, status=$7,
         period_from=$8, period_to=$9, data_updated_at=$10, source=COALESCE($11, source),
         source_filename=CASE WHEN $11::text IS NULL THEN source_filename ELSE $12 END, updated_by=$13, updated_at=$14
       WHERE id=$1`,
      [id, v.name, v.description, v.product, v.signal, v.customerType, v.status, v.periodFrom, v.periodTo, v.dataUpdatedAt, source, sourceFilename, by, now]);
    const before = Number(cur.rows[0].n) || 0;
    let n = before;
    if (members) {
      n = await writeMembers(client, id, members);
      if (!asDraft && n < 1) { await client.query("ROLLBACK"); return { members: 0, gone: true }; }
      await client.query(`INSERT INTO indicator_events (indicator_id, action, detail, by_name, at) VALUES ($1,'data_replaced',$2,$3,$4)`,
        [id, JSON.stringify({ before, after: n, source, dataUpdatedAt: v.dataUpdatedAt }), by, now]);
      // New customers mean a new proposal: a suggestion dismissed against the old list must be able
      // to come back. The dismissal row records which indicators it was built from.
      await client.query(`DELETE FROM suggestion_dismissals WHERE $1::bigint = ANY(indicator_ids)`, [id]);
    }
    await client.query(`INSERT INTO indicator_events (indicator_id, action, detail, by_name, at) VALUES ($1,'edited',$2,$3,$4)`,
      [id, JSON.stringify({ status: v.status, previousStatus: String(cur.rows[0].status), product: v.product, signal: v.signal }), by, now]);
    await client.query("COMMIT");
    return { members: n };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally { client.release(); }
}

export async function setIndicatorStatus(id: number, status: "active" | "inactive", by: string): Promise<boolean> {
  if (!(await reprobe()) || !pool) return false;
  const now = Date.now();
  const r = await pool.query(`UPDATE usage_indicators SET status=$2, updated_by=$3, updated_at=$4 WHERE id=$1 AND status <> 'draft' RETURNING id`, [id, status, by, now]);
  if (!r.rowCount) return false;
  await pool.query(`INSERT INTO indicator_events (indicator_id, action, detail, by_name, at) VALUES ($1,$2,'{}',$3,$4)`,
    [id, status === "active" ? "activated" : "deactivated", by, now]);
  return true;
}

/** What the opportunity rules read: every indicator with its member ids. One query, no N+1. */
export async function indicatorRuleInput(): Promise<{ id: number; name: string; product: string | null; signal: string; status: string; dataUpdatedAt: string; customerType: string; memberIds: number[] }[]> {
  if (!(await reprobe()) || !pool) return [];
  const r = await pool.query(
    `SELECT i.id, i.name, i.product, i.signal, i.status, i.data_updated_at, i.customer_type,
            COALESCE(array_agg(m.entity_id) FILTER (WHERE m.entity_id IS NOT NULL), '{}') AS ids
       FROM usage_indicators i LEFT JOIN usage_indicator_members m ON m.indicator_id = i.id
      GROUP BY i.id`);
  return r.rows.map((x: any) => ({ id: Number(x.id), name: String(x.name), product: x.product ?? null, signal: String(x.signal),
    status: String(x.status), dataUpdatedAt: String(x.data_updated_at), customerType: String(x.customer_type), memberIds: (x.ids || []).map(Number) }));
}

/** The indicators one customer sits in — the «المؤشرات» block of the customer record (BR-CUS-004). */
export async function indicatorsForPhone(phone: string): Promise<{ id: number; name: string; product: string | null; status: string; value: string | null; dataUpdatedAt: string }[]> {
  if (!(await reprobe()) || !pool) return [];
  const r = await pool.query(
    `SELECT i.id, i.name, i.product, i.status, i.data_updated_at, m.value
       FROM usage_indicator_members m JOIN usage_indicators i ON i.id = m.indicator_id
       JOIN entities e ON e.id = m.entity_id
      WHERE e.phone = $1 ORDER BY i.status = 'active' DESC, i.name`, [phone]);
  return r.rows.map((x: any) => ({ id: Number(x.id), name: String(x.name), product: x.product ?? null, status: String(x.status), value: x.value ?? null, dataUpdatedAt: String(x.data_updated_at) }));
}

export async function dismissSuggestion(key: string, title: string | null, indicatorIds: readonly number[], reason: string | null, by: string): Promise<boolean> {
  if (!(await reprobe()) || !pool) return false;
  await pool.query(
    `INSERT INTO suggestion_dismissals (key, title, indicator_ids, reason, by_name, at) VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (key) DO UPDATE SET title = EXCLUDED.title, indicator_ids = EXCLUDED.indicator_ids, reason = EXCLUDED.reason, by_name = EXCLUDED.by_name, at = EXCLUDED.at`,
    [key, title, indicatorIds, reason, by, Date.now()]);
  return true;
}
export async function restoreSuggestion(key: string): Promise<boolean> {
  if (!(await reprobe()) || !pool) return false;
  const r = await pool.query(`DELETE FROM suggestion_dismissals WHERE key = $1`, [key]);
  return (r.rowCount || 0) > 0;
}
export async function listDismissals(): Promise<{ key: string; title: string | null; reason: string | null; by: string | null; at: number }[]> {
  if (!(await reprobe()) || !pool) return [];
  const r = await pool.query(`SELECT key, title, reason, by_name, at FROM suggestion_dismissals ORDER BY at DESC`);
  return r.rows.map((x: any) => ({ key: String(x.key), title: x.title ?? null, reason: x.reason ?? null, by: x.by_name ?? null, at: Number(x.at) }));
}

/** Non-test campaigns inside a window, with the phones that were actually approached (sent, or of
 *  unknown outcome on rows older than the outcome column). Windowed in SQL: the unbounded version
 *  aggregated every target ever sent on every suggestions read and every repeat check. */
export async function recentCampaignTargets(sinceMs: number): Promise<{ id: number; name: string; product: string | null; createdAt: number; test: boolean; phones: string[] }[]> {
  if (!(await reprobe()) || !pool) return [];
  const r = await pool.query(
    `SELECT c.id, c.name, c.product, c.created_at, c.test,
            COALESCE(array_agg(t.phone) FILTER (WHERE t.phone IS NOT NULL AND (t.outcome IS NULL OR t.outcome = 'sent')), '{}') AS phones
       FROM campaigns c LEFT JOIN campaign_targets t ON t.campaign_id = c.id
      WHERE c.created_at >= $1 AND NOT c.test
      GROUP BY c.id ORDER BY c.created_at DESC`, [sinceMs]);
  return r.rows.map((x: any) => ({ id: Number(x.id), name: String(x.name), product: x.product ?? null, createdAt: Number(x.created_at),
    test: Boolean(x.test), phones: (x.phones || []).map(String) }));
}

/** Campaigns launched from a suggestion — the numerator of «Recommendation Adoption». Small by
 *  construction: only rows that carry an origin. */
export async function campaignsWithOrigin(): Promise<{ id: number; name: string; product: string | null; createdAt: number; origin: Record<string, unknown> }[]> {
  if (!(await reprobe()) || !pool) return [];
  const r = await pool.query(`SELECT id, name, product, created_at, origin FROM campaigns WHERE origin IS NOT NULL AND NOT test ORDER BY created_at DESC LIMIT 500`);
  return r.rows.map((x: any) => ({ id: Number(x.id), name: String(x.name), product: x.product ?? null, createdAt: Number(x.created_at), origin: x.origin }));
}

/** The launch loop's writer for campaign_targets.outcome: «sent», or the refusal code. */
export async function markTargetOutcome(campaignId: number | null, phone: string, outcome: string): Promise<void> {
  if (campaignId == null || !pool || !connected) return;
  await pool.query(`UPDATE campaign_targets SET outcome = $3 WHERE campaign_id = $1 AND phone = $2`, [campaignId, phone, outcome.slice(0, 40)])
    .catch((e) => console.error(JSON.stringify({ at: "db", msg: "target outcome write failed", err: String(e).slice(0, 200) })));
}

/** Only what the rules need from a customer — not the attrs/facts JSON of the whole book. */
export async function entityIdentities(): Promise<{ id: number; name: string; phone: string }[]> {
  if (!(await reprobe()) || !pool) return [];
  const r = await pool.query(`SELECT id, name, phone FROM entities`);
  return r.rows.map((x: any) => ({ id: Number(x.id), name: String(x.name), phone: String(x.phone) }));
}

// ------------------------------ tasks & notes ------------------------------

export type TaskRow = {
  id: number; title: string; description: string | null;
  status: "backlog" | "todo" | "in_progress" | "done" | "canceled";
  priority: "low" | "medium" | "high" | null;
  start_at: number | null; due_at: number | null; assigned_to: string | null;
  ref_kind: "contact" | "campaign" | null; ref_id: string | null;
  created_at: number; updated_at: number; done_at: number | null;
};
export type NoteRow = {
  id: number; title: string | null; content: string;
  ref_kind: "contact" | "campaign" | null; ref_id: string | null;
  author: string | null; created_at: number; updated_at: number;
};

const TASK_STATUS = ["backlog", "todo", "in_progress", "done", "canceled"] as const;
const TASK_PRIORITY = ["low", "medium", "high"] as const;
const REF_KIND = ["contact", "campaign"] as const;

/** Rejects anything the CHECK constraints would reject, before the query runs, so a bad value
 *  surfaces as a 400 naming the field rather than a 500 from Postgres. */
export function validateTask(t: Record<string, unknown>): string | null {
  if (typeof t.title !== "string" || !t.title.trim()) return "title";
  if (t.status != null && !TASK_STATUS.includes(String(t.status) as typeof TASK_STATUS[number])) return "status";
  if (t.priority != null && !TASK_PRIORITY.includes(String(t.priority) as typeof TASK_PRIORITY[number])) return "priority";
  if (t.ref_kind != null && !REF_KIND.includes(String(t.ref_kind) as typeof REF_KIND[number])) return "ref_kind";
  if (t.ref_kind != null && !String(t.ref_id || "").trim()) return "ref_id";
  return null;
}

export async function listTasks(ref?: { kind: string; id: string }): Promise<TaskRow[]> {
  if (!pool || !connected) return [];
  const q = ref
    ? await pool.query(`SELECT * FROM tasks WHERE ref_kind = $1 AND ref_id = $2 ORDER BY
        CASE status WHEN 'done' THEN 1 WHEN 'canceled' THEN 1 ELSE 0 END, due_at NULLS LAST, id DESC`, [ref.kind, ref.id])
    : await pool.query(`SELECT * FROM tasks ORDER BY
        CASE status WHEN 'done' THEN 1 WHEN 'canceled' THEN 1 ELSE 0 END, due_at NULLS LAST, id DESC`);
  return q.rows.map(rowToTask);
}
function rowToTask(r: Record<string, unknown>): TaskRow {
  return {
    id: Number(r.id), title: String(r.title), description: (r.description as string) ?? null,
    status: r.status as TaskRow["status"], priority: r.priority as TaskRow["priority"],
    start_at: r.start_at == null ? null : Number(r.start_at),
    due_at: r.due_at == null ? null : Number(r.due_at),
    assigned_to: (r.assigned_to as string) ?? null,
    ref_kind: (r.ref_kind as TaskRow["ref_kind"]) ?? null,
    ref_id: (r.ref_id as string) ?? null,
    created_at: Number(r.created_at), updated_at: Number(r.updated_at),
    done_at: r.done_at == null ? null : Number(r.done_at),
  };
}

export async function createTask(t: Partial<TaskRow>): Promise<TaskRow | null> {
  if (!pool || !connected) return null;
  const now = Date.now();
  const q = await pool.query(
    `INSERT INTO tasks (title, description, status, priority, start_at, due_at, assigned_to,
       ref_kind, ref_id, created_at, updated_at)
     VALUES ($1,$2,COALESCE($3,'todo'),$4,$5,$6,$7,$8,$9,$10,$10) RETURNING *`,
    [t.title, t.description ?? null, t.status ?? null, t.priority ?? null, t.start_at ?? null,
     t.due_at ?? null, t.assigned_to ?? null, t.ref_kind ?? null, t.ref_id ?? null, now]);
  return rowToTask(q.rows[0]);
}

/** done_at is stamped only on the transition INTO done, and cleared on the way out, so a reopened
 *  task does not keep claiming it was completed at a time it was not. */
export async function updateTask(id: number, patch: Partial<TaskRow>): Promise<TaskRow | null> {
  if (!pool || !connected) return null;
  const sets: string[] = [], vals: unknown[] = []; let i = 1;
  for (const k of ["title", "description", "status", "priority", "start_at", "due_at", "assigned_to", "ref_kind", "ref_id"] as const) {
    if (patch[k] !== undefined) { sets.push(`${k} = $${i++}`); vals.push(patch[k]); }
  }
  if (!sets.length) return null;
  sets.push(`updated_at = $${i++}`); vals.push(Date.now());
  if (patch.status !== undefined) {
    sets.push(`done_at = CASE WHEN $${i} = 'done' THEN COALESCE(done_at, $${i + 1}) ELSE NULL END`);
    vals.push(patch.status, Date.now()); i += 2;
  }
  vals.push(id);
  const q = await pool.query(`UPDATE tasks SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`, vals);
  return q.rows[0] ? rowToTask(q.rows[0]) : null;
}

export async function deleteTask(id: number): Promise<boolean> {
  if (!pool || !connected) return false;
  const q = await pool.query(`DELETE FROM tasks WHERE id = $1`, [id]);
  return (q.rowCount ?? 0) > 0;
}

/** With no FK on (ref_kind, ref_id) — contacts are phone-keyed and campaigns are BIGSERIAL, so one
 *  column cannot reference both — the cascade is an app-level obligation. Without it a deleted
 *  contact leaves tasks and notes pointing at a record that no longer exists. */
export async function deleteRefRecords(kind: "contact" | "campaign", id: string): Promise<{ tasks: number; notes: number }> {
  if (!pool || !connected) return { tasks: 0, notes: 0 };
  const t = await pool.query(`DELETE FROM tasks WHERE ref_kind = $1 AND ref_id = $2`, [kind, id]);
  const n = await pool.query(`DELETE FROM notes WHERE ref_kind = $1 AND ref_id = $2`, [kind, id]);
  return { tasks: t.rowCount ?? 0, notes: n.rowCount ?? 0 };
}

/** Obligation 1: the write path refuses an unknown ref rather than creating a dangling row.
 *  A contact ref is accepted if it exists in EITHER contacts or entities — an imported audience
 *  row has an entities record long before it has a contacts one, and a task on a prospect you
 *  have not messaged yet is a legitimate thing to write. */
export async function refExists(kind: string, id: string): Promise<boolean> {
  if (!pool || !connected) return false;
  if (kind === "contact") {
    const q = await pool.query(
      `SELECT 1 FROM contacts WHERE phone = $1 UNION ALL SELECT 1 FROM entities WHERE phone = $1 LIMIT 1`, [id]);
    return q.rows.length > 0;
  }
  if (kind === "campaign") {
    const q = await pool.query(`SELECT 1 FROM campaigns WHERE id = $1 LIMIT 1`, [Number(id)]);
    return q.rows.length > 0;
  }
  return false;
}

export async function listNotes(ref?: { kind: string; id: string }): Promise<NoteRow[]> {
  if (!pool || !connected) return [];
  const q = ref
    ? await pool.query(`SELECT * FROM notes WHERE ref_kind = $1 AND ref_id = $2 ORDER BY id DESC`, [ref.kind, ref.id])
    : await pool.query(`SELECT * FROM notes ORDER BY id DESC`);
  return q.rows.map(rowToNote);
}
function rowToNote(r: Record<string, unknown>): NoteRow {
  return {
    id: Number(r.id), title: (r.title as string) ?? null, content: String(r.content),
    ref_kind: (r.ref_kind as NoteRow["ref_kind"]) ?? null, ref_id: (r.ref_id as string) ?? null,
    author: (r.author as string) ?? null,
    created_at: Number(r.created_at), updated_at: Number(r.updated_at),
  };
}
export async function createNote(n: Partial<NoteRow>): Promise<NoteRow | null> {
  if (!pool || !connected) return null;
  const now = Date.now();
  const q = await pool.query(
    `INSERT INTO notes (title, content, ref_kind, ref_id, author, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$6) RETURNING *`,
    [n.title ?? null, n.content, n.ref_kind ?? null, n.ref_id ?? null, n.author ?? null, now]);
  return rowToNote(q.rows[0]);
}
export async function updateNote(id: number, patch: Partial<NoteRow>): Promise<NoteRow | null> {
  if (!pool || !connected) return null;
  const sets: string[] = [], vals: unknown[] = []; let i = 1;
  for (const k of ["title", "content", "ref_kind", "ref_id"] as const) {
    if (patch[k] !== undefined) { sets.push(`${k} = $${i++}`); vals.push(patch[k]); }
  }
  if (!sets.length) return null;
  sets.push(`updated_at = $${i++}`); vals.push(Date.now());
  vals.push(id);
  const q = await pool.query(`UPDATE notes SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`, vals);
  return q.rows[0] ? rowToNote(q.rows[0]) : null;
}
export async function deleteNote(id: number): Promise<boolean> {
  if (!pool || !connected) return false;
  const q = await pool.query(`DELETE FROM notes WHERE id = $1`, [id]);
  return (q.rowCount ?? 0) > 0;
}

// ------------------------------ opportunities (فرص البيع) ------------------------------

export type OppRow = {
  id: number; account_name: string; phone: string | null; product: string;
  stage: (typeof SALES_STAGES)[number]["key"];
  source: "whatsapp" | "call" | "visit" | "referral" | "inbound" | "other";
  source_ref: string | null;
  sale_price: number; years: number; qty: number; discount: number;
  owner: string | null; close_on: number | null; next_step: string | null; lost_reason: string | null;
  created_by: string | null; created_at: number; updated_at: number; stage_at: number;
};

/** DERIVED from the one ladder in sales-domain.ts. Was a fifth hand-maintained copy of the stage
 *  set, and the drift between it and opps-domain.ts is what made «اكتشاف الحاجة» and «عرض السعر»
 *  unreachable: validateOppLine below rejected them with 400 invalid_field even though the Postgres
 *  CHECK already accepted all eight.
 *
 *  SEQUENCING NOTE. Migration 002-commercial-engine already widened opportunities_stage_check to
 *  eight values and is applied in production, so the immutable half of expand-then-migrate has
 *  ALREADY shipped. This change is the second deploy: the application list catches up to the
 *  constraint. The one combination that would break — a new bundle offering eight against a server
 *  accepting six — cannot occur, because the bundle is generated by the same server that validates. */
export const OPP_STAGES = SALES_STAGES.map((s) => s.key);
export const OPP_SOURCES = ["whatsapp", "call", "visit", "referral", "inbound", "other"] as const;

/** Rejects what the CHECK constraints and the arithmetic would reject, before the query runs, so a
 *  bad value is a 400 naming its field rather than a 500 — the same contract validateTask holds.
 *  The numbers are bounded rather than merely typed: a discount of 400 would render a NEGATIVE
 *  pipeline value, and «قيمة الفرصة» is a number the founder reads as money. */
export function validateOppLine(l: Record<string, unknown>, allowedStages?: readonly string[]): string | null {
  if (typeof l.product !== "string" || !l.product.trim()) return "product";
  // The LIVE ladder when the caller passes it (an admin may have added a rung since this file was
  // compiled), the compiled list when it does not. The Postgres CHECK that used to be the backstop
  // was dropped in migration 009 precisely because it could not know about a stage added at runtime.
  const stages = allowedStages && allowedStages.length ? allowedStages : (OPP_STAGES as readonly string[]);
  if (l.stage != null && stages.indexOf(String(l.stage)) === -1) return "stage";
  // ABSENT IS THE DEFAULT, NOT ZERO. Reading a missing years as 0 rejected every line that simply
  // did not carry the field — and because years is checked before product, it rejected them with
  // the wrong field name, which hid an unknown product behind a complaint about a number nobody
  // sent. The defaults here are the SAME ones the INSERT and the route apply; a validator that
  // disagrees with the write it guards is worse than no validator.
  const num = (v: unknown, dflt: number) => (v == null || v === "" ? dflt : Number(v));
  const price = num(l.sale_price, 0), years = num(l.years, 1), qty = num(l.qty, 1), disc = num(l.discount, 0);
  if (!Number.isFinite(price) || price < 0 || price > 1e12) return "sale_price";
  if (!Number.isFinite(years) || years < 1 || years > 20 || years % 1 !== 0) return "years";
  if (!Number.isFinite(qty) || qty < 1 || qty > 10000 || qty % 1 !== 0) return "qty";
  if (!Number.isFinite(disc) || disc < 0 || disc > 100) return "discount";
  if (l.close_on != null && l.close_on !== "" && !Number.isFinite(Number(l.close_on))) return "close_on";
  return null;
}

function rowToOpp(r: Record<string, unknown>): OppRow {
  return {
    id: Number(r.id), account_name: String(r.account_name), phone: (r.phone as string) ?? null,
    product: String(r.product), stage: r.stage as OppRow["stage"], source: r.source as OppRow["source"],
    source_ref: (r.source_ref as string) ?? null,
    sale_price: Number(r.sale_price), years: Number(r.years), qty: Number(r.qty), discount: Number(r.discount),
    owner: (r.owner as string) ?? null,
    close_on: r.close_on == null ? null : Number(r.close_on),
    next_step: (r.next_step as string) ?? null, lost_reason: (r.lost_reason as string) ?? null,
    created_by: (r.created_by as string) ?? null,
    created_at: Number(r.created_at), updated_at: Number(r.updated_at), stage_at: Number(r.stage_at),
  };
}

/** A READ must not mistake «the database is briefly down» for «the table is empty». With a pool
 *  latched off, listOpps() returns [] and the board rendered «لا فرص مسجّلة بعد» over six real
 *  deals — captured on production 2026-09-12 during a massar-db health-check failure. Callers ask
 *  this first and answer 503 instead. One probe on the latched path; free when already connected. */
export async function canRead(): Promise<boolean> {
  if (!enabled()) return true;          // memory-only mode by design: an empty ledger IS the truth
  return reprobe();
}

export async function listOpps(): Promise<OppRow[]> {
  if (!pool || !connected) return [];
  return (await pool.query(`SELECT * FROM opportunities ORDER BY id DESC`)).rows.map(rowToOpp);
}

/** One account, N product lines, ONE write. The lines of a deal are created together on the board
 *  and must arrive together: a partial insert would paint a card whose «3 منتجات» is a lie. */
export async function createOppLines(head: {
  account_name: string; phone: string | null; source: string; source_ref: string | null; created_by: string | null;
}, lines: Partial<OppRow>[]): Promise<OppRow[]> {
  if (!pool || !connected) return [];
  const now = Date.now();
  const out: OppRow[] = [];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const l of lines) {
      const q = await client.query(
        `INSERT INTO opportunities (account_name, phone, product, stage, source, source_ref,
           sale_price, years, qty, discount, owner, close_on, next_step, created_by,
           created_at, updated_at, stage_at)
         VALUES ($1,$2,$3,COALESCE($4,'contact'),$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15,$15) RETURNING *`,
        [head.account_name, head.phone, l.product, l.stage ?? null, head.source, head.source_ref,
         l.sale_price ?? 0, l.years ?? 1, l.qty ?? 1, l.discount ?? 0, l.owner ?? null,
         l.close_on ?? null, l.next_step ?? null, head.created_by, now]);
      // The opening event, same transaction. Without it a deal created directly at a closed stage
      // (an import of already-won business, or a rep logging a deal after the fact) would never
      // appear in «المحقق» — the won CTE reads the ledger, and the migration backfill runs once
      // and never sees rows created after it.
      await client.query(
        `INSERT INTO track_stage_events (opp_id, from_stage, to_stage, effective_at, recorded_at, actor, note)
         VALUES ($1, NULL, $2, to_timestamp($3 / 1000.0), $3, $4, 'فتح الفرصة')`,
        [q.rows[0].id, String(q.rows[0].stage), now, head.created_by || "اللوحة"]);
      out.push(rowToOpp(q.rows[0]));
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => { /* the original error is the one that matters */ });
    throw e;
  } finally {
    client.release();
  }
  return out;
}

/** stage_at moves ONLY when the stage actually changes, so «متوقّف منذ 18 يومًا» counts days in the
 *  stage and not days since anyone last touched the row — editing a next step must not reset a
 *  stall the board exists to show. */
export async function updateOpp(id: number, patch: Partial<OppRow>, actor?: string): Promise<OppRow | null> {
  if (!pool || !connected) return null;
  const sets: string[] = [], vals: unknown[] = []; let i = 1;
  for (const k of ["product", "stage", "sale_price", "years", "qty", "discount", "owner",
    "close_on", "next_step", "lost_reason", "source", "source_ref", "account_name"] as const) {
    if (patch[k] !== undefined) { sets.push(`${k} = $${i++}`); vals.push(patch[k]); }
  }
  if (!sets.length) return null;
  sets.push(`updated_at = $${i++}`); vals.push(Date.now());
  if (patch.stage !== undefined) {
    sets.push(`stage_at = CASE WHEN stage = $${i} THEN stage_at ELSE $${i + 1} END`);
    vals.push(patch.stage, Date.now()); i += 2;
  }
  vals.push(id);

  // THE LEDGER GETS ITS ROW HERE, IN THE SAME TRANSACTION AS THE UPDATE.
  //
  // Without this the whole targets screen is decoration, and it was: the ONLY insert into
  // track_stage_events was the one-time migration backfill, so a rep marking a deal won moved
  // opportunities.stage and wrote no event. The won CTE reads the ledger and never saw it; the
  // openv CTE excludes won and lost. Measured on a real instance before the fix — a 1,440,000 SAR
  // deal PATCHed to won: achieved stayed at 3,100,000 and openCount fell 3 to 2. The deal left the
  // pipeline and never arrived anywhere. «المحقق» was frozen at migration-day values forever.
  //
  // One transaction, not two statements: a crash between the UPDATE and the INSERT would leave a
  // won deal with no event, which is precisely the state this exists to make impossible.
  // FOR UPDATE takes the row lock so two concurrent edits cannot both read the same from_stage
  // and write two events for one transition.
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const prev = await client.query("SELECT stage FROM opportunities WHERE id = $1 FOR UPDATE", [id]);
    if (!prev.rows[0]) { await client.query("ROLLBACK"); return null; }
    const fromStage = String(prev.rows[0].stage);
    const q = await client.query(
      `UPDATE opportunities SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`, vals);
    if (!q.rows[0]) { await client.query("ROLLBACK"); return null; }
    const toStage = String(q.rows[0].stage);
    // Only a real transition is an event. Re-saving a row without touching the stage must not
    // write one, or every edit would look like movement and «المحقق» would count a deal twice.
    if (toStage !== fromStage) {
      await client.query(
        `INSERT INTO track_stage_events (opp_id, from_stage, to_stage, effective_at, recorded_at, actor)
         VALUES ($1, $2, $3, to_timestamp($4 / 1000.0), $4, $5)`,
        [id, fromStage, toStage, Date.now(), actor || "اللوحة"]);
    }
    await client.query("COMMIT");
    return rowToOpp(q.rows[0]);
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/**
 * A HOT READING BECOMES AN OPPORTUNITY, ONCE. The founder's question — «are they added auto once
 * user interest is high?» — answered at the only place that can answer it honestly: the moment the
 * assistant records a HIGH-intent reading, which is the single qualification event this system can
 * actually witness. Warm is NOT enough; it stays a one-click suggestion on the board's band.
 *
 * FOUR REFUSALS, each of which would otherwise put a lie on the money board:
 *   · a product outside the tag registry (the agent files an unknown service as «خدمة أخرى») —
 *     an opportunity nobody can filter for is worse than none, and the claim is NOT taken, so a
 *     later real product for the same account still gets its chance.
 *   · a test contact — the board has no test flag, so a rehearsal would sit beside real money.
 *   · a contact who opted out or was read as not-interested — a hot tag from an earlier turn does
 *     not survive «إيقاف».
 *   · a claim already taken — including one whose opportunity a human has since DELETED. Deleting
 *     an auto-created line is a decision, and a system that undoes it is worse than one that never
 *     created it.
 *
 * It is created UNPRICED (sale_price 0). The conversation contains no number and inventing one
 * would be a forecast dressed as a reading; the board renders it «لم تُسعَّر» and the pipeline total
 * is untouched until a human prices it.
 */
export async function autoOppFromHot(phone: string, product: string, waName?: string): Promise<OppRow | null> {
  if (!pool || !connected) return null;
  const name = String(product || "").trim();
  if (!name) return null;
  // Registry check BEFORE the claim, so a refused product does not burn the account's one chance.
  const known = await pool.query(`SELECT 1 FROM tags WHERE name = $1 LIMIT 1`, [name]);
  if (!known.rows.length) return null;
  const c = await pool.query(`SELECT test, opted_out, outcome FROM contacts WHERE phone = $1`, [phone]);
  const row = c.rows[0];
  if (row && (row.test || row.opted_out || row.outcome === "stopped" || row.outcome === "not_interested")) return null;
  const claim = await pool.query(
    `INSERT INTO opp_auto (phone, product, ts) VALUES ($1,$2,$3)
     ON CONFLICT (phone, product) DO NOTHING RETURNING phone`, [phone, name, Date.now()]);
  if (!claim.rows.length) return null;
  // The account's own name if the book has it — the board groups by phone, but the card is read by
  // a human, and «966543464327» is not a client. Falls back to the WhatsApp profile name, then the
  // number, which is the last honest thing left to show.
  const ent = await pool.query(`SELECT name FROM entities WHERE phone = $1`, [phone]);
  const account = (ent.rows[0] && ent.rows[0].name) || waName || phone;
  const camp = await pool.query(
    `SELECT campaign_id FROM campaign_targets WHERE phone = $1 ORDER BY campaign_id DESC LIMIT 1`, [phone]);
  const rows = await createOppLines(
    { account_name: account, phone, source: "whatsapp",
      source_ref: camp.rows[0] ? String(camp.rows[0].campaign_id) : null, created_by: "المساعد" },
    [{ product: name, stage: "contact", sale_price: 0, years: 1, qty: 1, discount: 0 }]);
  const made = rows[0] ?? null;
  if (made) await pool.query(`UPDATE opp_auto SET opp_id = $1 WHERE phone = $2 AND product = $3`, [made.id, phone, name]);
  return made;
}

/** Every (phone, product) the assistant has read as HOT, for the boot backfill. Contacts already
 *  hot when this shipped must get the same treatment as the next one, or the board's behaviour
 *  depends on the deploy date — which is the kind of inconsistency nobody can explain later. */
export async function hotReadings(): Promise<{ phone: string; product: string; wa_name: string | null }[]> {
  if (!pool || !connected) return [];
  return (await pool.query(
    `SELECT DISTINCT t.phone, t.product, c.wa_name
       FROM interest_tags t LEFT JOIN contacts c ON c.phone = t.phone
      WHERE t.level = 'hot'`)).rows;
}

// ---------------------------------------------------------------------------
// THE TRANSCRIPT HAS INCOMPATIBLE CONSUMERS, so it stopped being served by one policy.
//
// hydrate() keeps the last 50 messages per contact BY COUNT. Three things read that, and they want
// different windows:
//
//   · readSeriousness is DELIBERATELY LIFETIME — index.ts states it: «a prospect who priced the
//     deal last month is serious today». Truncating to 50 silently makes it a recent-50 question.
//   · activityByDay draws 21 days. A chatty account blows past 50 messages inside a week, so the
//     chart was already wrong today for exactly the accounts anyone would look at.
//   · the agent needs recent context only, which is what the resident Map is genuinely for.
//
// A first attempt swapped the count for a 90-day window, which was the same mistake in a different
// unit — it would have quietly redefined a lifetime signal. So the consumers were split instead:
// the two exact questions are answered by SQL over the full table, and the Map stays what it always
// should have been, the agent's working set.
// ---------------------------------------------------------------------------

/** Every message for one contact, oldest first. Loaded per-record, on demand, because the lifetime
 *  read is a question about a person and a resident cache cannot bound it honestly. */
export async function fullTranscript(phone: string): Promise<{ role: string; text: string; ts: number }[]> {
  if (!(await reprobe()) || !pool) return [];
  const r = await pool.query(
    `SELECT role, text, ts FROM messages WHERE phone = $1 ORDER BY ts ASC`, [phone]);
  // messages.ts is BIGINT epoch-ms, not a timestamp. node-pg returns bigint as a STRING, so
  // new Date(x.ts) yields Invalid Date and every signal silently reads NaN.
  return r.rows.map((x: any) => ({
    role: String(x.role), text: String(x.text ?? ""), ts: Number(x.ts),
  }));
}

/** Per-day message counts, aggregated in Postgres over the WHOLE table rather than over whatever
 *  50 messages happen to be resident.
 *
 *  Buckets on the UTC day, matching activityByDay's existing boundary EXACTLY. Riyadh days would
 *  arguably be more correct for a Saudi product, but moving the boundary would silently redraw a
 *  shipped chart, and that is a design decision, not a side effect of making the data exact. The
 *  only change here is correctness for talkative accounts. */
export async function activityCountsByDay(phone: string, days: number): Promise<{ day: number; inbound: number; outbound: number }[]> {
  if (!(await reprobe()) || !pool) return [];
  const r = await pool.query(
    // ts is BIGINT epoch-ms. Bucketing is integer division, not date arithmetic, and the window is
    // a plain lower bound — `extract(epoch FROM ts)` and `now() - interval` both fail on a bigint,
    // which is how this surfaced: a 500 on the client record the first time it ran.
    `SELECT (ts / 86400000) * 86400000 AS day,
            COUNT(*) FILTER (WHERE role = 'customer') AS inbound,
            COUNT(*) FILTER (WHERE role = 'agent')    AS outbound
       FROM messages
      WHERE phone = $1 AND ts >= $2
      GROUP BY 1 ORDER BY 1`,
    [phone, Date.now() - Math.max(1, Math.min(365, days)) * 86_400_000]);
  return r.rows.map((x: any) => ({
    day: Number(x.day), inbound: Number(x.inbound) || 0, outbound: Number(x.outbound) || 0,
  }));
}

/** How many messages this contact has ever exchanged. Used for sorting «العملاء»; the resident
 *  transcript length was a truncated proxy that ranked a 400-message account level with a 50. */
export async function transcriptCounts(): Promise<Record<string, number>> {
  if (!(await reprobe()) || !pool) return {};
  const r = await pool.query(`SELECT phone, COUNT(*) n FROM messages GROUP BY phone`);
  const out: Record<string, number> = {};
  for (const x of r.rows) out[String(x.phone)] = Number(x.n) || 0;
  return out;
}

/** The raw rows Gate A is computed from. Deliberately raw: the arithmetic lives in sales-domain
 *  where it is pure and unit-tested, so the gate's verdict cannot be one thing in SQL and another
 *  on screen. */
export async function gateARows(startMs: number, endMs: number, rep?: string): Promise<{
  rep: string; occurredAt: number; recordedAt: number;
}[]> {
  if (!(await reprobe()) || !pool) return [];
  const params: unknown[] = [startMs, endMs];
  let where = "e.occurred_at >= to_timestamp($1 / 1000.0) AND e.occurred_at < to_timestamp($2 / 1000.0)";
  if (rep) { params.push(rep); where += ` AND e.rep = $${params.length}`; }
  const r = await pool.query(
    `SELECT e.rep, e.occurred_at, e.recorded_at FROM engagements e WHERE ${where} ORDER BY e.occurred_at`,
    params);
  return r.rows.map((x: any) => ({
    rep: String(x.rep),
    occurredAt: new Date(x.occurred_at).getTime(),
    recordedAt: Number(x.recorded_at),
  }));
}

/** «أين تتعثّر الصفقات» — open work grouped by the department that owes it.
 *
 *  The founder's vision doc calls this "the screen Zoho's defaults do not give you and the reason
 *  this product exists". It reads the actions table over actions_open_idx (state, dept, due_at),
 *  which was built for exactly this and had never been read by anything. */
export async function stalledByDept(): Promise<{
  dept: string; openCount: number; oldestDays: number;
  items: { id: number; oppId: number; account: string; product: string; stage: string;
           title: string; ageDays: number; rep: string | null }[];
}[]> {
  if (!(await reprobe()) || !pool) return [];
  const r = await pool.query(
    `SELECT a.id, a.opp_id, a.dept, a.title, a.created_at, a.created_by,
            o.account_name, o.product, o.stage
       FROM actions a
       JOIN opportunities o ON o.id = a.opp_id
      WHERE a.state = 'open'
      ORDER BY a.dept, a.created_at ASC`);
  const now = Date.now();
  const byDept = new Map<string, any[]>();
  for (const x of r.rows) {
    const dept = String(x.dept);
    const ageDays = Math.floor((now - Number(x.created_at)) / 86_400_000);
    if (!byDept.has(dept)) byDept.set(dept, []);
    byDept.get(dept)!.push({
      id: Number(x.id), oppId: Number(x.opp_id), account: String(x.account_name ?? ""),
      product: String(x.product ?? ""), stage: String(x.stage ?? ""), title: String(x.title ?? ""),
      ageDays, rep: x.created_by ? String(x.created_by) : null,
    });
  }
  return [...byDept.entries()]
    .map(([dept, items]) => ({
      dept, openCount: items.length,
      oldestDays: items.reduce((m, i) => Math.max(m, i.ageDays), 0),
      items,
    }))
    .sort((a, b) => b.oldestDays - a.oldestDays || b.openCount - a.openCount);
}

/** Close or cancel one action. Without this the screen above fills with rows nobody can clear and
 *  stops being read, which is how a dashboard dies — the mirror of the table-with-no-writer defect
 *  and the reason the writer and this shipped in one diff. */
export async function closeAction(id: number, state: "done" | "cancelled", by: string): Promise<boolean> {
  if (!(await reprobe()) || !pool) return false;
  const q = await pool.query(
    `UPDATE actions SET state = $1, done_at = $2 WHERE id = $3 AND state = 'open'`,
    [state, Date.now(), id]);
  if ((q.rowCount ?? 0) > 0) {
    console.log(JSON.stringify({ at: "actions", msg: "closed", id, state, by }));
    return true;
  }
  return false;
}

export type PackageRow = {
  id: number; product: string; name: string; listPrice: number; years: number;
  scope: string | null; retiredAt: number | null;
};

/** Live packages for a product, or all of them. Retired ones are excluded by default: a retired
 *  package must stay readable for the deals that reference it, but must not be offerable on a new
 *  quote. */
export async function listPackages(product?: string, includeRetired = false): Promise<PackageRow[]> {
  if (!(await reprobe()) || !pool) return [];
  const where: string[] = [], vals: unknown[] = [];
  if (product) { vals.push(product); where.push(`product = $${vals.length}`); }
  if (!includeRetired) where.push("retired_at IS NULL");
  const r = await pool.query(
    `SELECT id, product, name, list_price, years, scope, retired_at FROM packages
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY product, list_price`, vals);
  return r.rows.map((x: any) => ({
    id: Number(x.id), product: String(x.product), name: String(x.name),
    listPrice: Number(x.list_price), years: Number(x.years),
    scope: x.scope ? String(x.scope) : null,
    retiredAt: x.retired_at == null ? null : Number(x.retired_at),
  }));
}

/** Create or update one package. Keyed on (product, name), which is the pair a human actually
 *  names it by. */
export async function upsertPackage(p: {
  product: string; name: string; listPrice: number; years: number; scope: string | null;
}): Promise<PackageRow | null> {
  if (!(await reprobe()) || !pool) return null;
  const known = new Set((await listTags()).map((t) => t.name));
  if (!known.has(p.product)) return null;
  const r = await pool.query(
    `INSERT INTO packages (product, name, list_price, years, scope, created_at)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (product, name) DO UPDATE
       SET list_price = EXCLUDED.list_price, years = EXCLUDED.years, scope = EXCLUDED.scope
     RETURNING id, product, name, list_price, years, scope, retired_at`,
    [p.product, p.name, Math.round(p.listPrice), Math.round(p.years), p.scope, Date.now()]);
  const x = r.rows[0];
  return { id: Number(x.id), product: String(x.product), name: String(x.name),
           listPrice: Number(x.list_price), years: Number(x.years),
           scope: x.scope ? String(x.scope) : null,
           retiredAt: x.retired_at == null ? null : Number(x.retired_at) };
}

/** RETIRE, never delete. A won deal must keep pointing at the package it was sold under, and the
 *  database enforces that: the composite foreign key is ON DELETE RESTRICT, so a DELETE of a
 *  referenced package is refused outright. Retirement is the only exit. */
export async function retirePackage(id: number, retire: boolean): Promise<boolean> {
  if (!(await reprobe()) || !pool) return false;
  const q = await pool.query(
    `UPDATE packages SET retired_at = $1 WHERE id = $2`, [retire ? Date.now() : null, id]);
  return (q.rowCount ?? 0) > 0;
}

/** THE REP'S DAY, filtered in SQL and grouped by the human being called.
 *
 *  Two shapes were wrong before this and both mattered:
 *
 *  · Scoring every contact in memory and filtering afterwards is O(all contacts) forever, on one
 *    shared CPU that also serves the Gupshup webhook. Eligibility is a WHERE clause, so the JS only
 *    ever scores rows a rep could actually call.
 *
 *  · One row per OPPORTUNITY tells a rep to phone the same clinic twice, because createOppLines
 *    deliberately creates a line per product against one account. It also double-counts the
 *    engagements Gate A is judged on. The row is the human; their open lines ride along.
 *
 *  Unowned deals are INCLUDED. Requiring owner to be set first would have made the pilot's queue
 *  empty on day one, and the fix for that is not a backfill script, it is admitting that an
 *  unclaimed deal is exactly what a rep should be shown. */
export async function repQueue(rep: string, limit = 50): Promise<{
  phone: string; account: string; owner: string | null;
  lines: { id: number; product: string; stage: string; value: number }[];
  lastEngagementAt: number | null;
}[]> {
  if (!(await reprobe()) || !pool) return [];
  const r = await pool.query(
    `SELECT o.phone,
            MIN(o.account_name)                       AS account,
            MIN(o.owner)                              AS owner,
            json_agg(json_build_object(
              'id', o.id, 'product', o.product, 'stage', o.stage,
              'value', ${OPP_VALUE_SQL}
            ) ORDER BY o.stage_at DESC)               AS lines,
            (SELECT MAX(e.occurred_at) FROM engagements e WHERE e.contact_phone = o.phone) AS last_eng
       FROM opportunities o
       LEFT JOIN contacts c ON c.phone = o.phone
      WHERE o.stage NOT IN ('won','lost')
        AND o.phone IS NOT NULL
        AND (o.owner IS NULL OR o.owner = $1)
        AND COALESCE(c.opted_out, false) = false
      GROUP BY o.phone
      ORDER BY last_eng ASC NULLS FIRST
      LIMIT $2`,
    [rep, limit]);
  return r.rows.map((x: any) => ({
    phone: String(x.phone),
    account: String(x.account ?? ""),
    owner: x.owner ? String(x.owner) : null,
    lines: (x.lines || []).map((l: any) => ({
      id: Number(l.id), product: String(l.product), stage: String(l.stage), value: Number(l.value) || 0,
    })),
    lastEngagementAt: x.last_eng ? new Date(x.last_eng).getTime() : null,
  }));
}

/** How far back a rep may say a call happened. Gate A is judged on the gap between when a call
 *  happened and when it was logged, so an unbounded occurred_at lets backdating manufacture
 *  compliance. Two days covers a Thursday call logged on Sunday; anything older is a correction and
 *  should be visibly one. */
export const ENGAGEMENT_BACKDATE_LIMIT_MS = 2 * 24 * 60 * 60 * 1000;

export type EngagementInput = {
  idemKey: string;
  contactPhone: string;
  oppId: number | null;
  rep: string;
  kind: "call" | "visit" | "whatsapp" | "email" | "note";
  outcomeKey: string | null;
  occurredAt: number;
  note: string | null;
};
export type EngagementResult =
  | { ok: true; engagementId: number; replayed: boolean; fromStage: string | null; toStage: string | null; actionsCreated: number }
  | { ok: false; error: string; field?: string };

/**
 * ONE COMMAND, ONE KEY, ONE TRANSACTION.
 *
 * A rep tapping an outcome on a phone produces up to four writes: the opportunity moves, the stage
 * ledger gains a row, an engagement is recorded, and a department is put on the hook. Scoping
 * idempotency per-table is not enough — an idempotent engagement insert followed by a retried
 * action writer still duplicates the action. So the whole command lives or dies together, keyed on
 * one idem_key the client generates and reuses across retries.
 *
 *     BEGIN
 *       idem_key seen?  ── yes ──▶ return the original result, write nothing   (replay)
 *            │ no
 *            ▼
 *       SELECT stage FOR UPDATE          ← the stage the outcome is judged against
 *            ▼
 *       resolveOutcome(fromStage, key)   ← target stage DERIVED, never taken from the request
 *            ▼
 *       stage moved?  ── yes ──▶ UPDATE opportunities + INSERT track_stage_events
 *            ▼
 *       INSERT engagements (idem_key UNIQUE)
 *            ▼
 *       dept owed?    ── yes ──▶ INSERT actions
 *     COMMIT
 *
 * A call that moves no stage still lands an engagement, which is the entire reason this exists:
 * updateOpp writes a ledger row ONLY on a real transition, and most calls do not move the stage.
 */
export async function recordEngagement(input: EngagementInput): Promise<EngagementResult> {
  if (!(await reprobe()) || !pool) return { ok: false, error: "db_unavailable" };
  const now = Date.now();
  if (!input.idemKey || input.idemKey.length > 200) return { ok: false, error: "invalid_field", field: "idemKey" };
  if (!input.contactPhone) return { ok: false, error: "invalid_field", field: "contactPhone" };
  if (!input.rep) return { ok: false, error: "invalid_field", field: "rep" };
  if (!Number.isFinite(input.occurredAt)) return { ok: false, error: "invalid_field", field: "occurredAt" };
  // Bounded in both directions: the future is not a place a call can have happened, and a backdate
  // beyond the limit would let a quiet week be rewritten into a compliant one.
  if (input.occurredAt > now + 60_000) return { ok: false, error: "occurred_at_in_future", field: "occurredAt" };
  if (input.occurredAt < now - ENGAGEMENT_BACKDATE_LIMIT_MS) return { ok: false, error: "occurred_at_too_old", field: "occurredAt" };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const prior = await client.query(
      "SELECT id, opp_id FROM engagements WHERE idem_key = $1", [input.idemKey]);
    if (prior.rows[0]) {
      await client.query("COMMIT");
      return { ok: true, engagementId: Number(prior.rows[0].id), replayed: true,
               fromStage: null, toStage: null, actionsCreated: 0 };
    }

    let fromStage: string | null = null, toStage: string | null = null;
    let dept = "", nextAction = "";
    // The ledger row this engagement produced, when it produced one. Null when the outcome moved no
    // stage, which is the common case for a blocking outcome like «بانتظار المشتريات».
    let stageEventId: number | null = null;

    if (input.oppId != null) {
      const cur = await client.query(
        "SELECT stage FROM opportunities WHERE id = $1 FOR UPDATE", [input.oppId]);
      if (!cur.rows[0]) { await client.query("ROLLBACK"); return { ok: false, error: "opp_not_found" }; }
      fromStage = String(cur.rows[0].stage);

      if (input.outcomeKey) {
        const resolved = sales.resolveOutcome(fromStage, input.outcomeKey, sales.SALES_STAGES, sales.STAGE_OUTCOMES);
        if (!resolved.ok) { await client.query("ROLLBACK"); return { ok: false, error: resolved.error, field: "outcomeKey" }; }
        toStage = resolved.toStage; dept = resolved.dept; nextAction = resolved.nextAction;

        if (toStage !== fromStage) {
          await client.query(
            `UPDATE opportunities SET stage = $1, stage_at = $2, updated_at = $2 WHERE id = $3`,
            [toStage, now, input.oppId]);
          const ev = await client.query(
            `INSERT INTO track_stage_events (opp_id, from_stage, to_stage, outcome_key, effective_at, recorded_at, actor)
             VALUES ($1,$2,$3,$4, to_timestamp($5 / 1000.0), $6, $7) RETURNING id`,
            [input.oppId, fromStage, toStage, input.outcomeKey, input.occurredAt, now, input.rep]);
          stageEventId = Number(ev.rows[0].id);
        }
      }
    }

    const ins = await client.query(
      `INSERT INTO engagements (contact_phone, opp_id, rep, kind, outcome_key, occurred_at, recorded_at, note, idem_key)
       VALUES ($1,$2,$3,$4,$5, to_timestamp($6 / 1000.0), $7,$8,$9) RETURNING id`,
      [input.contactPhone, input.oppId, input.rep, input.kind, input.outcomeKey,
       input.occurredAt, now, input.note, input.idemKey]);
    const engagementId = Number(ins.rows[0].id);

    // An action is owed only when a department other than sales is on the hook, and only for an
    // outcome that did not close the deal. Deduped on the open action for the same deal and
    // department: a rep chasing the same blocker three times owes التقنية one task, not three.
    let actionsCreated = 0;
    if (input.oppId != null && dept && toStage !== "lost" && toStage !== "won") {
      const dup = await client.query(
        `SELECT id FROM actions WHERE opp_id = $1 AND dept = $2 AND state = 'open' LIMIT 1`,
        [input.oppId, dept]);
      if (!dup.rows[0]) {
        await client.query(
          `INSERT INTO actions (opp_id, stage_event_id, engagement_id, dept, title, state, created_at, created_by)
           VALUES ($1, $7, $2, $3, $4, 'open', $5, $6)`,
          // Was a literal NULL. The column exists to say WHICH transition owed this action, and a
          // column nothing writes is the defect this project keeps shipping — here it silently
          // broke three reports that joined on it. Null stays legitimate when the outcome moved no
          // stage, which is most of them.
          [input.oppId, engagementId, dept, nextAction || "متابعة", now, input.rep, stageEventId]);
        actionsCreated = 1;
      }
    }

    await client.query("COMMIT");
    return { ok: true, engagementId, replayed: false, fromStage, toStage, actionsCreated };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function deleteOpp(id: number): Promise<boolean> {
  if (!pool || !connected) return false;
  const q = await pool.query(`DELETE FROM opportunities WHERE id = $1`, [id]);
  return (q.rowCount ?? 0) > 0;
}

// ------------------------------ product intro assets (sent by the agent) ------------------------------

export async function saveAsset(product: string, publicId: string, filename: string, contentType: string, bytes: Buffer): Promise<void> {
  if (!pool || !connected) throw new Error("db not connected");
  await pool.query(
    `INSERT INTO product_assets (product, public_id, filename, content_type, bytes, updated_at, size_bytes) VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (product) DO UPDATE SET public_id = EXCLUDED.public_id, filename = EXCLUDED.filename,
       content_type = EXCLUDED.content_type, bytes = EXCLUDED.bytes, updated_at = EXCLUDED.updated_at,
       size_bytes = EXCLUDED.size_bytes`,
    [product, publicId, filename, contentType, bytes, Date.now(), bytes.length]);
}

export async function listAssets():
  Promise<{ product: string; public_id: string; filename: string; size: number; updated_at: number }[]> {
  if (!pool || !connected) return [];
  return (await pool.query(
    `SELECT product, public_id, filename, COALESCE(size_bytes, 0) AS size, updated_at FROM product_assets ORDER BY product`))
    .rows.map((x: any) => ({
      product: String(x.product), public_id: String(x.public_id), filename: String(x.filename),
      size: Number(x.size) || 0, updated_at: Number(x.updated_at) || 0,
    }));
}

/** The proposal-deck skill zip rides in product_assets under the `__skill__` pseudo-product. */
export async function skillAsset(): Promise<{ publicId: string; filename: string } | null> {
  if (!pool || !connected) return null;
  const r = await pool.query(`SELECT public_id, filename FROM product_assets WHERE product = '__skill__'`);
  return r.rows[0] ? { publicId: String(r.rows[0].public_id), filename: String(r.rows[0].filename) } : null;
}

/** Files whose product name is not a tag — an LLM-named upload, or a tag deleted from under its
 *  files. Surfaced as «غير مطابق» rows, never hidden and never counted as products. */
export async function unmatchedFiles(): Promise<{ name: string; kind: "kb" | "asset"; filename: string | null }[]> {
  if (!pool || !connected) return [];
  const r = await pool.query(
    `SELECT k.product AS name, 'kb' AS kind, COALESCE(k.draft_source, k.source_filename) AS filename
       FROM product_kb k WHERE k.product NOT LIKE '\\_\\_%' AND NOT EXISTS (SELECT 1 FROM tags t WHERE t.name = k.product)
     UNION ALL
     SELECT a.product, 'asset', a.filename
       FROM product_assets a WHERE a.product NOT LIKE '\\_\\_%' AND NOT EXISTS (SELECT 1 FROM tags t WHERE t.name = a.product)
     ORDER BY 1, 2`);
  return r.rows.map((x: any) => ({
    name: String(x.name), kind: x.kind === "asset" ? "asset" : "kb", filename: x.filename == null ? null : String(x.filename),
  }));
}

/**
 * Move an off-registry kb row or asset row onto an existing tag, whole — md, draft and provenance
 * travel together because they are one row. Refused when the target already has that kind: two
 * knowledge files for one product is a merge decision, not a move.
 */
export async function reconcileFile(from: string, to: string, kind: "kb" | "asset"):
  Promise<"ok" | "unknown_source" | "target_has"> {
  if (!pool || !connected) throw new Error("db not connected");
  const table = kind === "kb" ? "product_kb" : "product_assets";     // frozen pair, never a caller's string
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const src = await client.query(`SELECT 1 FROM ${table} WHERE product = $1 FOR UPDATE`, [from]);
    if (!src.rowCount) { await client.query("ROLLBACK"); return "unknown_source"; }
    const dst = await client.query(`SELECT 1 FROM ${table} WHERE product = $1`, [to]);
    if (dst.rowCount) { await client.query("ROLLBACK"); return "target_has"; }
    await client.query(`UPDATE ${table} SET product = $2 WHERE product = $1`, [from, to]);
    await client.query("COMMIT");
    return "ok";
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally { client.release(); }
}

export async function getAssetByPublicId(publicId: string):
  Promise<{ filename: string; content_type: string; bytes: Buffer } | null> {
  if (!pool || !connected) return null;
  const r = await pool.query(`SELECT filename, content_type, bytes FROM product_assets WHERE public_id = $1`, [publicId]);
  return r.rows[0] ?? null;
}

export type CatalogueRow = {
  product: string; sector: string | null; sectorId: number | null; sectorAssumed: boolean;
  owner: string | null; pricingNote: string | null;
  /** The company unit that owns this product — «القسم», not «القطاع» (the market it sells into). */
  divisionId: number | null; division: string | null;
  packages: { id: number; name: string; listPrice: number; years: number; scope: string | null }[];
  retiredPackageCount: number;
  archived: boolean; archivedAt: number | null;
  createdAt: number;
  /** The product_kb row's facts; the STATE is derived above this tier (kbStateOf). */
  kb: { md: string; source: string | null; approvedBy: string | null; approvedAt: number | null; updatedAt: number } | null;
  draft: { source: string | null; by: string | null; at: number | null; md: string } | null;
  asset: { filename: string; publicId: string; size: number; updatedAt: number } | null;
};

/**
 * Every product the product actually sells, with its sector, its provenance flag and its published
 * packages. Feeds the products screen and the package selector.
 *
 * Driven off `tags`, NOT off the catalogue constant in agent.ts, because tags is what a deal stores
 * and what every board groups by. Production carries 8 tags where agent.ts knows 6, so reading the
 * constant here would silently hide two live products. product_meta is LEFT JOINed for the same
 * reason: a product with no sector row must still appear, carrying null, so the gap is visible
 * instead of the row vanishing.
 */
export async function productCatalogue(): Promise<CatalogueRow[]> {
  if (!(await reprobe()) || !pool) return [];
  const r = await pool.query(
    `SELECT t.name AS product, t.created_at, s.name AS sector, pm.sector_id,
            COALESCE(pm.sector_assumed, false) AS sector_assumed,
            pm.owner, pm.pricing_note, pm.archived_at, pm.division_id, d.name AS division,
            COALESCE(
              (SELECT json_agg(json_build_object(
                        'id', p.id, 'name', p.name, 'listPrice', p.list_price,
                        'years', p.years, 'scope', p.scope) ORDER BY p.list_price)
                 FROM packages p
                WHERE p.product = t.name AND p.retired_at IS NULL), '[]'::json) AS packages,
            (SELECT COUNT(*) FROM packages p WHERE p.product = t.name AND p.retired_at IS NOT NULL) AS retired_count,
            k.md AS kb_md, k.source_filename AS kb_source, k.approved_by, k.approved_at, k.updated_at AS kb_updated_at,
            k.draft_md, k.draft_source, k.draft_by, k.draft_at,
            a.filename AS asset_filename, a.public_id AS asset_public_id,
            COALESCE(a.size_bytes, 0) AS asset_size, a.updated_at AS asset_updated_at
       FROM tags t
       LEFT JOIN product_meta pm   ON pm.product = t.name
       LEFT JOIN sectors s         ON s.id = pm.sector_id
       LEFT JOIN divisions d       ON d.id = pm.division_id
       LEFT JOIN product_kb k      ON k.product = t.name
       LEFT JOIN product_assets a  ON a.product = t.name
      WHERE t.name NOT LIKE '\\_\\_%'
      ORDER BY t.name`);
  return r.rows.map((x: any) => ({
    product: String(x.product),
    sector: x.sector ? String(x.sector) : null,
    sectorId: x.sector_id == null ? null : Number(x.sector_id),
    sectorAssumed: Boolean(x.sector_assumed),
    owner: x.owner ? String(x.owner) : null,
    pricingNote: x.pricing_note ? String(x.pricing_note) : null,
    divisionId: x.division_id == null ? null : Number(x.division_id),
    division: x.division ? String(x.division) : null,
    packages: (x.packages ?? []).map((p: any) => ({
      id: Number(p.id), name: String(p.name), listPrice: Number(p.listPrice),
      years: Number(p.years), scope: p.scope ? String(p.scope) : null,
    })),
    retiredPackageCount: Number(x.retired_count) || 0,
    archived: x.archived_at != null,
    archivedAt: x.archived_at == null ? null : Number(x.archived_at),
    createdAt: Number(x.created_at) || 0,
    kb: x.kb_md == null ? null : {
      md: String(x.kb_md), source: x.kb_source == null ? null : String(x.kb_source),
      approvedBy: x.approved_by == null ? null : String(x.approved_by),
      approvedAt: x.approved_at == null ? null : Number(x.approved_at),
      updatedAt: Number(x.kb_updated_at) || 0,
    },
    draft: x.draft_md == null ? null : {
      source: x.draft_source == null ? null : String(x.draft_source),
      by: x.draft_by == null ? null : String(x.draft_by),
      at: x.draft_at == null ? null : Number(x.draft_at),
      md: String(x.draft_md),
    },
    asset: x.asset_public_id == null ? null : {
      filename: String(x.asset_filename), publicId: String(x.asset_public_id),
      size: Number(x.asset_size) || 0, updatedAt: Number(x.asset_updated_at) || 0,
    },
  }));
}

// ------------------------------ «المنتجات» V5 writers ------------------------------

export type ProductImpact = {
  openLines: number; campaigns: number; targetedEntities: number; interestReadings: number;
  kb: boolean; asset: boolean; packages: number; targets: number;
};

/**
 * What a product touches, for the rename modal, the archive hold and the delete guard. The
 * predicates are the SAME ones the related links use (spec H′): campaigns by exact `product`,
 * entities by product_tags membership, readings as distinct non-test phones in interest_tags.
 */
export async function impactOf(product: string): Promise<ProductImpact> {
  const zero: ProductImpact = { openLines: 0, campaigns: 0, targetedEntities: 0, interestReadings: 0,
    kb: false, asset: false, packages: 0, targets: 0 };
  if (!(await reprobe()) || !pool) return zero;
  const r = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM opportunities o WHERE o.product = $1 AND o.stage NOT IN ('won','lost')) AS open_lines,
       (SELECT COUNT(*) FROM campaigns c WHERE c.product = $1) AS campaigns,
       (SELECT COUNT(*) FROM entities e WHERE e.product_tags @> jsonb_build_array($1::text)) AS targeted,
       (SELECT COUNT(DISTINCT i.phone) FROM interest_tags i LEFT JOIN contacts c ON c.phone = i.phone
         WHERE i.product = $1 AND COALESCE(c.test, false) = false) AS readings,
       EXISTS (SELECT 1 FROM product_kb k WHERE k.product = $1) AS kb,
       EXISTS (SELECT 1 FROM product_assets a WHERE a.product = $1) AS asset,
       (SELECT COUNT(*) FROM packages p WHERE p.product = $1 AND p.retired_at IS NULL) AS packages,
       (SELECT COUNT(*) FROM targets t WHERE t.product = $1) AS targets`, [product]);
  const x = r.rows[0];
  return {
    openLines: Number(x.open_lines) || 0, campaigns: Number(x.campaigns) || 0,
    targetedEntities: Number(x.targeted) || 0, interestReadings: Number(x.readings) || 0,
    kb: Boolean(x.kb), asset: Boolean(x.asset),
    packages: Number(x.packages) || 0, targets: Number(x.targets) || 0,
  };
}

/** Every row, in every product-keyed table, that still carries this name. Non-zero anywhere means
 *  a delete would orphan data — the answer is archive. */
export async function productReferences(name: string): Promise<{ total: number; counts: Record<string, number> }> {
  const counts: Record<string, number> = {};
  if (!(await reprobe()) || !pool) return { total: 0, counts };
  for (const t of PRODUCT_NAME_TABLES) {
    if (t === "product_meta") continue;      // the product's own metadata row is not a reference
    const r = await pool.query(`SELECT COUNT(*) AS n FROM ${t} WHERE product = $1`, [name]);
    const n = Number(r.rows[0]?.n) || 0;
    if (n) counts[t] = n;
  }
  const e = await pool.query(`SELECT COUNT(*) AS n FROM entities WHERE product_tags @> jsonb_build_array($1::text)`, [name]);
  if (Number(e.rows[0]?.n)) counts.entities = Number(e.rows[0].n);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return { total, counts };
}

/**
 * Create a product: tag + product_meta + optional first package in ONE transaction, so the drawer
 * never leaves a tag with no metadata row or a package on a tag that failed. "exists" rather than
 * an exception on collision — the drawer shows it inline.
 */
export async function createProduct(p: {
  name: string; sectorId: number | null; owner: string | null; pricingNote: string | null;
  firstPackage: { name: string; listPrice: number; years: number; scope: string | null } | null;
}, by: string): Promise<"ok" | "exists" | "unknown_sector"> {
  if (!pool || !connected) throw new Error("db not connected");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const now = Date.now();
    const t = await client.query(
      `INSERT INTO tags (name, created_at, created_by) VALUES ($1,$2,$3) ON CONFLICT (name) DO NOTHING RETURNING id`,
      [p.name, now, by]);
    if (!t.rowCount) { await client.query("ROLLBACK"); return "exists"; }
    if (p.sectorId != null) {
      const s = await client.query(`SELECT 1 FROM sectors WHERE id = $1`, [p.sectorId]);
      if (!s.rowCount) { await client.query("ROLLBACK"); return "unknown_sector"; }
    }
    // A metadata row can predate the tag (a deleted product re-created, or a seed row); the
    // drawer's values win, and a chosen sector is a fact rather than a guess.
    await client.query(
      `INSERT INTO product_meta (product, sector_id, owner, pricing_note, sector_assumed, archived_at, updated_at)
       VALUES ($1,$2,$3,$4,false,NULL,$5)
       ON CONFLICT (product) DO UPDATE SET sector_id = EXCLUDED.sector_id, owner = EXCLUDED.owner,
         pricing_note = EXCLUDED.pricing_note, sector_assumed = false, archived_at = NULL, updated_at = EXCLUDED.updated_at`,
      [p.name, p.sectorId, p.owner, p.pricingNote, now]);
    if (p.firstPackage) {
      await client.query(
        `INSERT INTO packages (product, name, list_price, years, scope, created_at) VALUES ($1,$2,$3,$4,$5,$6)`,
        [p.name, p.firstPackage.name, Math.round(p.firstPackage.listPrice), Math.round(p.firstPackage.years),
          p.firstPackage.scope, now]);
    }
    await client.query("COMMIT");
    return "ok";
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally { client.release(); }
}

/**
 * The product_meta writer the screens never had: sector, owner and pricing note were seeded once
 * at boot and corrected by hand in SQL. Only the fields SENT change; sending sectorId — even the
 * same value — is a human confirming it, so the «مُستنتَج» flag clears.
 */
export async function patchProductMeta(product: string, patch: {
  sectorId?: number | null; owner?: string | null; pricingNote?: string | null; divisionId?: number | null;
}): Promise<boolean> {
  if (!(await reprobe()) || !pool) return false;
  const sendSector = patch.sectorId !== undefined;
  const sendOwner = patch.owner !== undefined;
  const sendNote = patch.pricingNote !== undefined;
  const sendDivision = patch.divisionId !== undefined;
  const r = await pool.query(
    `INSERT INTO product_meta (product, sector_id, owner, pricing_note, division_id, sector_assumed, updated_at)
     VALUES ($1, $2, $3, $4, $5, false, $10)
     ON CONFLICT (product) DO UPDATE SET
       sector_id      = CASE WHEN $6::boolean THEN EXCLUDED.sector_id    ELSE product_meta.sector_id END,
       sector_assumed = CASE WHEN $6::boolean THEN false                 ELSE product_meta.sector_assumed END,
       owner          = CASE WHEN $7::boolean THEN EXCLUDED.owner        ELSE product_meta.owner END,
       pricing_note   = CASE WHEN $8::boolean THEN EXCLUDED.pricing_note ELSE product_meta.pricing_note END,
       division_id    = CASE WHEN $9::boolean THEN EXCLUDED.division_id  ELSE product_meta.division_id END,
       updated_at     = EXCLUDED.updated_at`,
    [product, patch.sectorId ?? null, patch.owner ?? null, patch.pricingNote ?? null, patch.divisionId ?? null,
      sendSector, sendOwner, sendNote, sendDivision, Date.now()]);
  return (r.rowCount ?? 0) > 0;
}

// ===========================================================================
// «إعدادات النظام» — the ladder, the divisions, the team, and what was escalated.
// ===========================================================================

/** The rungs the boot seed re-creates. Deleting one would come back on the next restart, so the
 *  config route refuses it and offers «أوقفها» instead. */
export const SEEDED_STAGE_KEYS: readonly string[] = SALES_STAGES.map((s) => s.key);

export type StageRow = {
  key: string; label: string; weightPct: number; position: number;
  slaDays: number | null; active: boolean; dot: string; terminal: "won" | "lost" | null;
  exitCriterion: string | null; openLines: number;
};

/** The LIVE ladder: what the board, the wizard and every stage select must read. Falls back to the
 *  compiled SALES_STAGES when the database is unreachable — a screen with no stages is a screen
 *  where no deal can be moved, and that is worse than a stale ladder. */
export async function listStages(): Promise<StageRow[]> {
  if (!(await reprobe()) || !pool) return compiledStages();
  const r = await pool.query(
    `SELECT ps.key, ps.label, ps.weight_pct, ps.position, ps.sla_days, ps.active, ps.dot, ps.terminal,
            ps.exit_criterion,
            (SELECT COUNT(*) FROM opportunities o WHERE o.stage = ps.key) AS open_lines
       FROM pipeline_stages ps
       JOIN pipelines p ON p.id = ps.pipeline_id AND p.product IS NULL
      ORDER BY ps.position, ps.id`);
  if (!r.rowCount) return compiledStages();
  return r.rows.map((x: any) => ({
    key: String(x.key), label: String(x.label),
    weightPct: Number(x.weight_pct) || 0, position: Number(x.position) || 0,
    slaDays: x.sla_days == null ? null : Number(x.sla_days),
    active: x.active !== false,
    dot: x.dot ? String(x.dot) : "#A2A9B4",
    terminal: x.terminal === "won" || x.terminal === "lost" ? x.terminal : null,
    exitCriterion: x.exit_criterion == null ? null : String(x.exit_criterion),
    openLines: Number(x.open_lines) || 0,
  }));
}

function compiledStages(): StageRow[] {
  return SALES_STAGES.map((st) => ({
    key: st.key, label: st.label, weightPct: st.weightPct, position: st.position,
    slaDays: st.stalls ? sales.STALL_DAYS : null, active: true, dot: st.dot, terminal: st.terminal,
    exitCriterion: st.exitCriterion ?? null, openLines: 0,
  }));
}

/** Every key a line may be stored on, active or not: an existing deal on a paused rung is still a
 *  valid row, and a write that refused it would strand it. */
export async function stageKeys(): Promise<string[]> {
  return (await listStages()).map((s) => s.key);
}

/** One line's stage, by id — a single indexed read. The opportunity PATCH route needs it to decide
 *  whether a move is onto the rung the line already sits on; doing that with listOpps() read the
 *  whole table on every edit. */
export async function oppStageOf(id: number): Promise<string | null> {
  if (!(await reprobe()) || !pool) return null;
  const r = await pool.query("SELECT stage FROM opportunities WHERE id = $1", [id]);
  return r.rowCount ? String(r.rows[0].stage) : null;
}

/** The keys NEW work may start on. A paused rung is not offered and not accepted — the picker and
 *  the write agree, which is the whole point of pausing one. */
export async function activeStageKeys(): Promise<string[]> {
  return (await listStages()).filter((s) => s.active).map((s) => s.key);
}

/** Where a line with no stage of its own STARTS: the first active, non-terminal rung in ladder
 *  order. The INSERT used to default to 'contact' after validation had already passed, so pausing
 *  «تواصل أولي» rejected a line that named it and accepted one that omitted it — the guard read a
 *  field the database was about to fill in. The caller resolves the stage BEFORE validating now. */
export async function defaultStageKey(): Promise<string> {
  const live = (await listStages()).filter((s) => s.active && s.terminal === null)
    .sort((a, b) => a.position - b.position);
  return live.length ? live[0].key : "contact";
}

async function defaultPipelineId(): Promise<number | null> {
  if (!pool) return null;
  const r = await pool.query("SELECT id FROM pipelines WHERE product IS NULL ORDER BY id LIMIT 1");
  return r.rowCount ? Number(r.rows[0].id) : null;
}

export async function createStage(v: {
  key: string; label: string; weightPct: number; position: number;
  slaDays: number | null; active: boolean; exitCriterion: string | null;
}): Promise<boolean> {
  if (!(await reprobe()) || !pool) return false;
  const id = await defaultPipelineId();
  if (id == null) return false;
  const r = await pool.query(
    `INSERT INTO pipeline_stages (pipeline_id, key, label, weight_pct, position, exit_criterion, sla_days, active, dot, terminal)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NULL) ON CONFLICT (pipeline_id, key) DO NOTHING`,
    [id, v.key, v.label, v.weightPct, v.position, v.exitCriterion, v.slaDays, v.active, "#656B76"]);
  return (r.rowCount ?? 0) > 0;
}

export async function updateStage(key: string, v: {
  label: string; weightPct: number; position: number; slaDays: number | null;
  active: boolean; exitCriterion: string | null;
}): Promise<boolean> {
  if (!(await reprobe()) || !pool) return false;
  const r = await pool.query(
    `UPDATE pipeline_stages ps SET label = $2, weight_pct = $3, position = $4, sla_days = $5,
            active = $6, exit_criterion = $7
       FROM pipelines p
      WHERE ps.pipeline_id = p.id AND p.product IS NULL AND ps.key = $1`,
    [key, v.label, v.weightPct, v.position, v.slaDays, v.active, v.exitCriterion]);
  return (r.rowCount ?? 0) > 0;
}

export async function deleteStage(key: string): Promise<boolean> {
  if (!(await reprobe()) || !pool) return false;
  const r = await pool.query(
    `DELETE FROM pipeline_stages ps USING pipelines p
      WHERE ps.pipeline_id = p.id AND p.product IS NULL AND ps.key = $1`, [key]);
  return (r.rowCount ?? 0) > 0;
}

export type DivisionRow = {
  id: number; name: string; ownerMemberId: number | null; ownerName: string | null;
  ownerEmail: string | null; active: boolean; products: number; members: number;
};

export async function listDivisions(): Promise<DivisionRow[]> {
  if (!(await reprobe()) || !pool) return [];
  const r = await pool.query(
    `SELECT d.id, d.name, d.owner_member_id, d.active, m.name AS owner_name, m.email AS owner_email,
            (SELECT COUNT(*) FROM product_meta pm WHERE pm.division_id = d.id) AS products,
            (SELECT COUNT(*) FROM team_members tm WHERE tm.division_id = d.id) AS members
       FROM divisions d LEFT JOIN team_members m ON m.id = d.owner_member_id
      ORDER BY d.name`);
  return r.rows.map((x: any) => ({
    id: Number(x.id), name: String(x.name),
    ownerMemberId: x.owner_member_id == null ? null : Number(x.owner_member_id),
    ownerName: x.owner_name ? String(x.owner_name) : null,
    ownerEmail: x.owner_email ? String(x.owner_email) : null,
    active: x.active !== false,
    products: Number(x.products) || 0, members: Number(x.members) || 0,
  }));
}

export async function createDivision(v: { name: string; ownerMemberId: number | null; active: boolean }): Promise<number | null> {
  if (!(await reprobe()) || !pool) return null;
  const now = Date.now();
  const r = await pool.query(
    `INSERT INTO divisions (name, owner_member_id, active, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$4) ON CONFLICT (name) DO NOTHING RETURNING id`,
    [v.name, v.ownerMemberId, v.active, now]);
  return r.rowCount ? Number(r.rows[0].id) : null;
}

export async function updateDivision(id: number, v: { name: string; ownerMemberId: number | null; active: boolean }): Promise<boolean> {
  if (!(await reprobe()) || !pool) return false;
  const r = await pool.query(
    `UPDATE divisions SET name = $2, owner_member_id = $3, active = $4, updated_at = $5 WHERE id = $1`,
    [id, v.name, v.ownerMemberId, v.active, Date.now()]);
  return (r.rowCount ?? 0) > 0;
}

export async function deleteDivision(id: number): Promise<boolean> {
  if (!(await reprobe()) || !pool) return false;
  const r = await pool.query("DELETE FROM divisions WHERE id = $1", [id]);
  return (r.rowCount ?? 0) > 0;
}

export type MemberRow = {
  id: number; name: string; email: string; role: string;
  divisionId: number | null; division: string | null; active: boolean; escalations: number;
};

export async function listMembers(): Promise<MemberRow[]> {
  if (!(await reprobe()) || !pool) return [];
  const r = await pool.query(
    `SELECT m.id, m.name, m.email, m.role, m.division_id, m.active, d.name AS division,
            (SELECT COUNT(*) FROM escalations e WHERE e.to_member_id = m.id) AS escalations
       FROM team_members m LEFT JOIN divisions d ON d.id = m.division_id
      ORDER BY m.name`);
  return r.rows.map((x: any) => ({
    id: Number(x.id), name: String(x.name), email: String(x.email), role: String(x.role),
    divisionId: x.division_id == null ? null : Number(x.division_id),
    division: x.division ? String(x.division) : null,
    active: x.active !== false, escalations: Number(x.escalations) || 0,
  }));
}

export async function memberById(id: number): Promise<MemberRow | null> {
  const all = await listMembers();
  return all.find((m) => m.id === id) ?? null;
}

export async function createMember(v: { name: string; email: string; role: string; divisionId: number | null; active: boolean }): Promise<number | null> {
  if (!(await reprobe()) || !pool) return null;
  const now = Date.now();
  const r = await pool.query(
    `INSERT INTO team_members (name, email, role, division_id, active, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$6) ON CONFLICT (email) DO NOTHING RETURNING id`,
    [v.name, v.email, v.role, v.divisionId, v.active, now]);
  return r.rowCount ? Number(r.rows[0].id) : null;
}

export async function updateMember(id: number, v: { name: string; email: string; role: string; divisionId: number | null; active: boolean }): Promise<"ok" | "missing" | "email_taken"> {
  if (!(await reprobe()) || !pool) return "missing";
  const clash = await pool.query("SELECT 1 FROM team_members WHERE email = $1 AND id <> $2", [v.email, id]);
  if (clash.rowCount) return "email_taken";
  const r = await pool.query(
    `UPDATE team_members SET name = $2, email = $3, role = $4, division_id = $5, active = $6, updated_at = $7 WHERE id = $1`,
    [id, v.name, v.email, v.role, v.divisionId, v.active, Date.now()]);
  return (r.rowCount ?? 0) > 0 ? "ok" : "missing";
}

/** A member who has been escalated to is never deleted — the record of who was asked outlives the
 *  directory entry. The caller turns that into «أوقفه بدل حذفه». */
export async function deleteMember(id: number): Promise<"ok" | "missing" | "referenced"> {
  if (!(await reprobe()) || !pool) return "missing";
  const used = await pool.query("SELECT 1 FROM escalations WHERE to_member_id = $1 LIMIT 1", [id]);
  if (used.rowCount) return "referenced";
  const r = await pool.query("DELETE FROM team_members WHERE id = $1", [id]);
  return (r.rowCount ?? 0) > 0 ? "ok" : "missing";
}

export type EscalationRow = {
  id: number; oppId: number; kind: string; toMemberId: number | null; toName: string; toEmail: string;
  reason: string; delivery: string; createdBy: string | null; createdAt: number;
  resolvedAt: number | null; resolvedBy: string | null;
  account: string | null; product: string | null;
};

export async function listEscalations(oppId?: number): Promise<EscalationRow[]> {
  if (!(await reprobe()) || !pool) return [];
  const r = await pool.query(
    `SELECT e.*, o.account_name, o.product
       FROM escalations e LEFT JOIN opportunities o ON o.id = e.opp_id
      WHERE ($1::bigint IS NULL OR e.opp_id = $1)
      ORDER BY e.created_at DESC LIMIT 500`, [oppId ?? null]);
  return r.rows.map((x: any) => ({
    id: Number(x.id), oppId: Number(x.opp_id), kind: String(x.kind),
    toMemberId: x.to_member_id == null ? null : Number(x.to_member_id),
    toName: String(x.to_name), toEmail: String(x.to_email), reason: String(x.reason),
    delivery: String(x.delivery), createdBy: x.created_by ? String(x.created_by) : null,
    createdAt: Number(x.created_at) || 0,
    resolvedAt: x.resolved_at == null ? null : Number(x.resolved_at),
    resolvedBy: x.resolved_by ? String(x.resolved_by) : null,
    account: x.account_name ? String(x.account_name) : null,
    product: x.product ? String(x.product) : null,
  }));
}

export async function createEscalation(v: {
  oppId: number; kind: string; member: { id: number; name: string; email: string };
  reason: string; by: string; delivery: string;
}): Promise<EscalationRow | null> {
  if (!(await reprobe()) || !pool) return null;
  const r = await pool.query(
    `INSERT INTO escalations (opp_id, kind, to_member_id, to_name, to_email, reason, delivery, created_by, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [v.oppId, v.kind, v.member.id, v.member.name, v.member.email, v.reason, v.delivery, v.by, Date.now()]);
  if (!r.rowCount) return null;
  const rows = await listEscalations(v.oppId);
  return rows.find((e) => e.id === Number(r.rows[0].id)) ?? null;
}

export async function resolveEscalation(id: number, by: string): Promise<boolean> {
  if (!(await reprobe()) || !pool) return false;
  const r = await pool.query(
    "UPDATE escalations SET resolved_at = $2, resolved_by = $3 WHERE id = $1 AND resolved_at IS NULL",
    [id, Date.now(), by]);
  return (r.rowCount ?? 0) > 0;
}

/** Archive or restore. Idempotent: archiving an archived product keeps its original moment. */
export async function setArchived(product: string, archived: boolean): Promise<void> {
  if (!pool || !connected) throw new Error("db not connected");
  const now = Date.now();
  await pool.query(
    `INSERT INTO product_meta (product, archived_at, updated_at) VALUES ($1, $2, $3)
     ON CONFLICT (product) DO UPDATE SET
       archived_at = CASE WHEN $4::boolean THEN COALESCE(product_meta.archived_at, EXCLUDED.archived_at) ELSE NULL END,
       updated_at  = EXCLUDED.updated_at`,
    [product, archived ? now : null, now, archived]);
}

/** Identity-preserving package edit. A deal points at the package by id, so the id must survive
 *  a rename; the composite FK and the quoted snapshot on the deal are what keep its money fixed. */
export async function updatePackage(id: number, p: { name: string; listPrice: number; years: number; scope: string | null }):
  Promise<PackageRow | null | "name_exists"> {
  if (!(await reprobe()) || !pool) return null;
  try {
    const r = await pool.query(
      `UPDATE packages SET name = $2, list_price = $3, years = $4, scope = $5 WHERE id = $1
       RETURNING id, product, name, list_price, years, scope, retired_at`,
      [id, p.name, Math.round(p.listPrice), Math.round(p.years), p.scope]);
    const x = r.rows[0];
    if (!x) return null;
    return { id: Number(x.id), product: String(x.product), name: String(x.name),
             listPrice: Number(x.list_price), years: Number(x.years),
             scope: x.scope ? String(x.scope) : null,
             retiredAt: x.retired_at == null ? null : Number(x.retired_at) };
  } catch (e: any) {
    if (e?.code === "23505") return "name_exists";
    throw e;
  }
}

/** «إزالة مستهدف الربع»: the row goes, so the quarter reads «بلا مستهدف» rather than «0». */
export async function deleteTarget(product: string, year: number, quarter: number): Promise<boolean> {
  if (!(await reprobe()) || !pool) return false;
  const r = await pool.query(`DELETE FROM targets WHERE product = $1 AND year = $2 AND quarter = $3`, [product, year, quarter]);
  return (r.rowCount ?? 0) > 0;
}

export type ProductPerformanceRow = {
  product: string;
  achieved: number; wonLines: number; lostLines: number;
  openValue: number; openLines: number; unpricedOpenLines: number;
  annualTarget: number | null; targetQuarters: number;
  quarters: { quarter: number; target: number | null; achieved: number }[];
};

/**
 * «الأداء — من سجل الفرص», one query for every product (spec G, G′).
 *
 *  · achieved / quarter achieved: lines CURRENTLY won whose LATEST transition into won falls in
 *    the window — the salesPerformance rule, so this screen reconciles to «المستهدفات والأداء».
 *  · won / lost lines: same predicate per terminal stage, over the fiscal year.
 *  · open value: UNWEIGHTED, all periods, PRICED lines only; unpriced lines are counted, not summed,
 *    because «0 ر.س» over a line nobody priced is a claim, not a figure. open_lines counts EVERY open
 *    line (priced or not) — the same predicate as impactOf and the opps list, so the record's
 *    «بند واحد · 1 بلا تسعير» and its «الفرص المفتوحة 2» link can no longer disagree. No weighted number leaves
 *    this function — the home band keeps its own and labels it «المرجَّح».
 *  · target: NULL when no row, so «بلا مستهدف» is distinguishable from an explicit zero.
 */
export async function productPerformance(
  year: number, bounds: readonly { quarter: number; startMs: number; endMs: number }[],
): Promise<ProductPerformanceRow[]> {
  if (!(await reprobe()) || !pool) return [];
  const vals = bounds.map((_, i) => `($${i * 3 + 1}::int, $${i * 3 + 2}::bigint, $${i * 3 + 3}::bigint)`).join(",");
  const params = bounds.flatMap((b) => [b.quarter, b.startMs, b.endMs]);
  const yearParam = `$${params.length + 1}`;
  const r = await pool.query(
    `WITH q(quarter, start_ms, end_ms) AS (VALUES ${vals}),
     yr AS (SELECT MIN(start_ms) AS start_ms, MAX(end_ms) AS end_ms FROM q),
     closed AS (
       SELECT o.product, o.stage, ${OPP_VALUE_SQL} AS value, w.effective_at
         FROM opportunities o
         JOIN LATERAL (
           SELECT e.effective_at FROM track_stage_events e
            WHERE e.opp_id = o.id AND e.to_stage = o.stage
            ORDER BY e.effective_at DESC LIMIT 1
         ) w ON TRUE
        WHERE o.stage IN ('won','lost')
     ),
     yr_closed AS (
       SELECT c.product,
              COALESCE(SUM(c.value) FILTER (WHERE c.stage = 'won'), 0) AS achieved,
              COUNT(*) FILTER (WHERE c.stage = 'won')  AS won_lines,
              COUNT(*) FILTER (WHERE c.stage = 'lost') AS lost_lines
         FROM closed c, yr
        WHERE c.effective_at >= to_timestamp(yr.start_ms / 1000.0)
          AND c.effective_at <  to_timestamp(yr.end_ms / 1000.0)
        GROUP BY c.product
     ),
     q_won AS (
       SELECT c.product, q.quarter, COALESCE(SUM(c.value), 0) AS achieved
         FROM closed c
         JOIN q ON c.effective_at >= to_timestamp(q.start_ms / 1000.0)
               AND c.effective_at <  to_timestamp(q.end_ms / 1000.0)
        WHERE c.stage = 'won'
        GROUP BY c.product, q.quarter
     ),
     openv AS (
       SELECT o.product,
              COALESCE(SUM(${OPP_VALUE_SQL}) FILTER (WHERE o.sale_price > 0), 0) AS open_value,
              COUNT(*)                                  AS open_lines,
              COUNT(*) FILTER (WHERE o.sale_price <= 0) AS unpriced
         FROM opportunities o
        WHERE o.stage NOT IN ('won','lost')
        GROUP BY o.product
     ),
     grid AS (SELECT t.name AS product, q.quarter FROM tags t CROSS JOIN q WHERE t.name NOT LIKE '\\_\\_%')
     SELECT g.product, g.quarter,
            tg.amount AS target,
            COALESCE(qw.achieved, 0) AS q_achieved,
            COALESCE(yc.achieved, 0) AS achieved,
            COALESCE(yc.won_lines, 0) AS won_lines,
            COALESCE(yc.lost_lines, 0) AS lost_lines,
            COALESCE(ov.open_value, 0) AS open_value,
            COALESCE(ov.open_lines, 0) AS open_lines,
            COALESCE(ov.unpriced, 0) AS unpriced
       FROM grid g
       LEFT JOIN targets tg   ON tg.product = g.product AND tg.year = ${yearParam} AND tg.quarter = g.quarter
       LEFT JOIN q_won qw     ON qw.product = g.product AND qw.quarter = g.quarter
       LEFT JOIN yr_closed yc ON yc.product = g.product
       LEFT JOIN openv ov     ON ov.product = g.product
      ORDER BY g.product, g.quarter`,
    [...params, year]);

  const by = new Map<string, ProductPerformanceRow>();
  for (const x of r.rows as any[]) {
    const p = String(x.product);
    const row = by.get(p) ?? {
      product: p, achieved: Number(x.achieved) || 0,
      wonLines: Number(x.won_lines) || 0, lostLines: Number(x.lost_lines) || 0,
      openValue: Number(x.open_value) || 0, openLines: Number(x.open_lines) || 0,
      unpricedOpenLines: Number(x.unpriced) || 0,
      annualTarget: null, targetQuarters: 0, quarters: [],
    };
    const target = x.target == null ? null : Number(x.target);
    row.quarters.push({ quarter: Number(x.quarter), target, achieved: Number(x.q_achieved) || 0 });
    if (target !== null) { row.annualTarget = (row.annualTarget ?? 0) + target; row.targetQuarters++; }
    by.set(p, row);
  }
  return [...by.values()];
}

/** The three sectors as stored, for a selector. Ordered as seeded. */
export async function listSectors(): Promise<{ id: number; name: string }[]> {
  if (!(await reprobe()) || !pool) return [];
  const r = await pool.query("SELECT id, name FROM sectors ORDER BY id");
  return r.rows.map((x: any) => ({ id: Number(x.id), name: String(x.name) }));
}

export type ReportRow = {
  oppId: number; account: string | null; product: string; stage: string;
  outcomeKey: string | null; title: string | null; dept: string | null;
  since: number;            // epoch ms of the blocking event / the loss
  daysWaiting: number;      // whole days, computed in SQL against now()
  value: number;            // «قيمة الفرصة», the ONE definition
};

/**
 * Run one of the four named reports (R11).
 *
 * The definition comes from reports-domain.ts, not from here: this function knows how to ASK, and
 * the report knows what it IS. That separation is what lets assertReportKeys check the filters
 * against the shipped ladder without a database.
 *
 * Both shapes order OLDEST FIRST. A stalled-deal report sorted newest-first buries the deal that
 * has been stuck longest under the ones that just arrived, which inverts the only reason to read it.
 */
export async function runReport(def: {
  source: "open_actions" | "lost_deals"; outcomeKeys: readonly string[]; dept: string | null;
}): Promise<ReportRow[]> {
  if (!(await reprobe()) || !pool) return [];

  if (def.source === "open_actions") {
    // Open actions only: a closed action is answered work, and leaving it here would grow the
    // report forever and make «كم عالق؟» unanswerable.
    const r = await pool.query(
      `SELECT a.opp_id, o.account_name, o.product, o.stage, a.title, a.dept,
              e.outcome_key,
              a.created_at AS since,
              GREATEST(0, FLOOR((EXTRACT(EPOCH FROM now()) * 1000 - a.created_at) / 86400000))::int AS days_waiting,
              ${OPP_VALUE_SQL} AS value
         FROM actions a
         JOIN opportunities o ON o.id = a.opp_id
         -- Through ENGAGEMENTS, not the stage ledger. Most of these outcomes do not move the
         -- stage — «بانتظار المشتريات» leaves the deal at negotiate — so no ledger row exists to
         -- join to, and actions.stage_event_id was written as a literal NULL besides. Joining it
         -- returned zero rows for three of the four reports, on demo data where every deal was
         -- correctly blocked. engagements.outcome_key is the value the writer actually records.
         LEFT JOIN engagements e ON e.id = a.engagement_id
        WHERE a.state = 'open'
          AND ($1::text IS NULL OR a.dept = $1)
          AND (cardinality($2::text[]) = 0 OR e.outcome_key = ANY($2))
        ORDER BY a.created_at ASC`,
      [def.dept, def.outcomeKeys]);
    return r.rows.map((x: any) => ({
      oppId: Number(x.opp_id), account: x.account_name ?? null, product: String(x.product),
      stage: String(x.stage), outcomeKey: x.outcome_key ?? null, title: x.title ?? null,
      dept: x.dept ?? null, since: Number(x.since), daysWaiting: Number(x.days_waiting),
      value: Number(x.value),
    }));
  }

  // lost_deals: the row's CURRENT stage decides it is lost, the ledger dates it. Same rule the won
  // CTE uses — a deal lost and then reopened must not still appear on a loss report.
  const r = await pool.query(
    `SELECT o.id AS opp_id, o.account_name, o.product, o.stage, e.outcome_key,
            NULL::text AS title, NULL::text AS dept,
            (EXTRACT(EPOCH FROM e.effective_at) * 1000)::bigint AS since,
            GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - e.effective_at)) / 86400))::int AS days_waiting,
            ${OPP_VALUE_SQL} AS value
       FROM opportunities o
       -- BOTH sources, because one key is unreachable in the other. «فشل التكامل» is recorded at
       -- the tech stage and MOVES the deal to lost, so it lands in the ledger. «خسارة – تكامل» is
       -- recorded on a deal that is ALREADY lost — no transition, therefore no ledger row, ever.
       -- Measured: a deal lost that way had one ledger row (null -> lost, no outcome_key) and the
       -- report missed it entirely while the deal sat there plainly lost to integration.
       -- The engagement always carries the outcome; the ledger only sometimes does.
       JOIN LATERAL (
         SELECT src.effective_at, src.outcome_key FROM (
           SELECT ee.effective_at, ee.outcome_key
             FROM track_stage_events ee
            WHERE ee.opp_id = o.id AND ee.outcome_key = ANY($1)
           UNION ALL
           SELECT en.occurred_at AS effective_at, en.outcome_key
             FROM engagements en
            WHERE en.opp_id = o.id AND en.outcome_key = ANY($1)
         ) src
          ORDER BY src.effective_at DESC LIMIT 1
       ) e ON TRUE
      WHERE o.stage = 'lost'
      ORDER BY e.effective_at ASC`,
    [def.outcomeKeys]);
  return r.rows.map((x: any) => ({
    oppId: Number(x.opp_id), account: x.account_name ?? null, product: String(x.product),
    stage: String(x.stage), outcomeKey: x.outcome_key ?? null, title: null, dept: null,
    since: Number(x.since), daysWaiting: Number(x.days_waiting), value: Number(x.value),
  }));
}

/**
 * The whole stage ledger, oldest first, for «نظرة تنفيذية». An event that a later row CORRECTS is
 * left out: the correction is the fact, and counting both would move a deal twice. The table is one
 * row per real stage change (a few per deal), so a full read is the honest size of the question.
 */
export async function listStageEvents(): Promise<{
  oppId: number; fromStage: string | null; toStage: string; at: number; actor: string | null;
}[]> {
  if (!(await reprobe()) || !pool) return [];
  const r = await pool.query(
    `SELECT e.opp_id, e.from_stage, e.to_stage, (EXTRACT(EPOCH FROM e.effective_at) * 1000)::bigint AS at, e.actor
       FROM track_stage_events e
      WHERE NOT EXISTS (SELECT 1 FROM track_stage_events c WHERE c.corrects_id = e.id)
      ORDER BY e.effective_at, e.id`);
  return r.rows.map((x: any) => ({
    oppId: Number(x.opp_id), fromStage: x.from_stage ?? null, toStage: String(x.to_stage),
    at: Number(x.at), actor: x.actor ?? null,
  }));
}

export type QuarterLine = {
  quarter: number; startMs: number; endMs: number;
  target: number; achieved: number; wonCount: number; coveragePct: number | null;
};

/**
 * All four quarters of a fiscal year, in ONE query (R13).
 *
 * `targets` is keyed (product, year, quarter) and always has been, but the screen asked for one
 * quarter at a time — so «الإنجاز الربعي: أربعة أشرطة» meant four round trips, four chances for the
 * clock to tick between them, and no way to see the shape of a year at all.
 *
 * The quarter BOUNDS are computed by the caller and passed in, not derived in SQL, for the same
 * reason isCurrentPeriod is: Riyadh is UTC+3 with no DST, and the fiscal start month is a config
 * value. SQL would have to be told both anyway, and a second implementation of a calendar is a
 * second calendar to get wrong.
 */
export async function quarterlyPerformance(
  year: number, bounds: readonly { quarter: number; startMs: number; endMs: number }[],
): Promise<QuarterLine[]> {
  const empty = bounds.map((b) => ({ ...b, target: 0, achieved: 0, wonCount: 0, coveragePct: null }));
  if (!(await reprobe()) || !pool) return empty;
  const vals = bounds.map((b, i) => `($${i * 3 + 1}::int, $${i * 3 + 2}::bigint, $${i * 3 + 3}::bigint)`).join(",");
  const params = bounds.flatMap((b) => [b.quarter, b.startMs, b.endMs]);
  const r = await pool.query(
    `WITH q(quarter, start_ms, end_ms) AS (VALUES ${vals}),
     won AS (
       SELECT q.quarter,
              COALESCE(SUM(${OPP_VALUE_SQL}), 0) AS achieved,
              COUNT(o.id) AS won_count
         FROM q
         LEFT JOIN opportunities o ON o.stage = 'won'
          AND EXISTS (
            SELECT 1 FROM LATERAL (
              SELECT e.effective_at FROM track_stage_events e
               WHERE e.opp_id = o.id AND e.to_stage = 'won'
               ORDER BY e.effective_at DESC LIMIT 1
            ) w
             WHERE w.effective_at >= to_timestamp(q.start_ms / 1000.0)
               AND w.effective_at <  to_timestamp(q.end_ms / 1000.0))
        GROUP BY q.quarter
     ),
     tgt AS (
       SELECT q.quarter, COALESCE(SUM(t.amount), 0) AS amount
         FROM q LEFT JOIN targets t ON t.year = $${params.length + 1} AND t.quarter = q.quarter
        GROUP BY q.quarter
     )
     SELECT q.quarter, q.start_ms, q.end_ms,
            COALESCE(tgt.amount, 0) AS target,
            COALESCE(won.achieved, 0) AS achieved,
            COALESCE(won.won_count, 0) AS won_count
       FROM q
       LEFT JOIN won ON won.quarter = q.quarter
       LEFT JOIN tgt ON tgt.quarter = q.quarter
      ORDER BY q.quarter`,
    [...params, year]);
  return r.rows.map((x: any) => {
    const target = Number(x.target), achieved = Number(x.achieved);
    return {
      quarter: Number(x.quarter), startMs: Number(x.start_ms), endMs: Number(x.end_ms),
      target, achieved, wonCount: Number(x.won_count),
      // null, not 0. A quarter with no target set has no coverage; printing 0% paints an
      // untargeted quarter red on a board whose job is showing where to worry.
      coveragePct: target > 0 ? Math.round((achieved / target) * 100) : null,
    };
  });
}

export type DeptBlock = { dept: string; openCount: number; oldestDays: number; value: number };
export type LossReason = { outcomeKey: string; count: number; value: number; oldestDays: number };

/**
 * «أين تتعثّر الصفقات» — open work grouped by the department that owes it.
 *
 * The mockup's second report block. Ordered by the OLDEST blockage, not by count: a department
 * holding one deal for forty days is a worse problem than one holding six for three, and sorting by
 * count buries exactly the row the screen exists to surface.
 */
export async function blockedByDept(): Promise<DeptBlock[]> {
  if (!(await reprobe()) || !pool) return [];
  const r = await pool.query(
    `SELECT a.dept,
            COUNT(*)::int AS open_count,
            GREATEST(0, FLOOR((EXTRACT(EPOCH FROM now()) * 1000 - MIN(a.created_at)) / 86400000))::int AS oldest_days,
            COALESCE(SUM(${OPP_VALUE_SQL}), 0) AS value
       FROM actions a
       JOIN opportunities o ON o.id = a.opp_id
      WHERE a.state = 'open' AND a.dept <> ''
      GROUP BY a.dept
      ORDER BY oldest_days DESC`);
  return r.rows.map((x: any) => ({
    dept: String(x.dept), openCount: Number(x.open_count),
    oldestDays: Number(x.oldest_days), value: Number(x.value),
  }));
}

/**
 * «الخسائر حسب السبب» — lost deals grouped by the outcome that closed them.
 *
 * Reads the ENGAGEMENT's outcome as well as the ledger's, for the reason documented on runReport:
 * an outcome recorded on a deal that is already lost produces no stage transition and therefore no
 * ledger row, so a ledger-only query silently misses a whole class of loss.
 */
export async function lossesByReason(): Promise<LossReason[]> {
  if (!(await reprobe()) || !pool) return [];
  const r = await pool.query(
    `WITH latest AS (
       SELECT o.id, o.sale_price, o.qty, o.years, o.discount, src.outcome_key, src.at
         FROM opportunities o
         JOIN LATERAL (
           SELECT k.outcome_key, k.at FROM (
             SELECT e.outcome_key, e.effective_at AS at FROM track_stage_events e
              WHERE e.opp_id = o.id AND e.outcome_key IS NOT NULL
             UNION ALL
             SELECT en.outcome_key, en.occurred_at AS at FROM engagements en
              WHERE en.opp_id = o.id AND en.outcome_key IS NOT NULL
           ) k ORDER BY k.at DESC LIMIT 1
         ) src ON TRUE
        WHERE o.stage = 'lost'
     )
     SELECT outcome_key,
            COUNT(*)::int AS n,
            COALESCE(SUM(ROUND(sale_price * qty * years * (1 - discount / 100.0))), 0) AS value,
            GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - MIN(at))) / 86400))::int AS oldest_days
       FROM latest
      GROUP BY outcome_key
      ORDER BY value DESC`);
  return r.rows.map((x: any) => ({
    outcomeKey: String(x.outcome_key), count: Number(x.n),
    value: Number(x.value), oldestDays: Number(x.oldest_days),
  }));
}

export type ProductQuarter = {
  product: string; annualTarget: number;
  quarters: { quarter: number; target: number; achieved: number; coveragePct: number | null }[];
  achieved: number; coveragePct: number | null;
};

/**
 * The brief's own table:每 product, its annual target, the split across four quarters, and what it
 * achieved in each. ONE query for the whole grid.
 *
 * Driven off `tags` so a product with no target still appears as a row of zeros — a product missing
 * from a targets table reads as "no target set" only if you can see it is missing, and a filtered
 * row cannot be seen at all.
 */
export async function quarterlyByProduct(
  year: number, bounds: readonly { quarter: number; startMs: number; endMs: number }[],
): Promise<ProductQuarter[]> {
  if (!(await reprobe()) || !pool) return [];
  const vals = bounds.map((_, i) => `($${i * 3 + 1}::int, $${i * 3 + 2}::bigint, $${i * 3 + 3}::bigint)`).join(",");
  const params = bounds.flatMap((b) => [b.quarter, b.startMs, b.endMs]);
  const r = await pool.query(
    `WITH q(quarter, start_ms, end_ms) AS (VALUES ${vals}),
     grid AS (SELECT t.name AS product, q.quarter, q.start_ms, q.end_ms FROM tags t CROSS JOIN q),
     won AS (
       SELECT o.product, q.quarter, COALESCE(SUM(${OPP_VALUE_SQL}), 0) AS achieved
         FROM q JOIN opportunities o ON o.stage = 'won'
          AND EXISTS (
            SELECT 1 FROM LATERAL (
              SELECT e.effective_at FROM track_stage_events e
               WHERE e.opp_id = o.id AND e.to_stage = 'won'
               ORDER BY e.effective_at DESC LIMIT 1) w
             WHERE w.effective_at >= to_timestamp(q.start_ms / 1000.0)
               AND w.effective_at <  to_timestamp(q.end_ms / 1000.0))
        GROUP BY o.product, q.quarter
     )
     SELECT g.product, g.quarter,
            COALESCE(tg.amount, 0) AS target,
            COALESCE(won.achieved, 0) AS achieved
       FROM grid g
       LEFT JOIN targets tg ON tg.product = g.product AND tg.year = $${params.length + 1} AND tg.quarter = g.quarter
       LEFT JOIN won ON won.product = g.product AND won.quarter = g.quarter
      ORDER BY g.product, g.quarter`,
    [...params, year]);

  const by = new Map<string, ProductQuarter>();
  for (const x of r.rows as any[]) {
    const p = String(x.product);
    const row = by.get(p) ?? { product: p, annualTarget: 0, quarters: [], achieved: 0, coveragePct: null };
    const target = Number(x.target), achieved = Number(x.achieved);
    row.quarters.push({
      quarter: Number(x.quarter), target, achieved,
      // null, not 0 — a quarter with no target has no coverage, which is not 0% coverage.
      coveragePct: target > 0 ? Math.round((achieved / target) * 100) : null,
    });
    row.annualTarget += target; row.achieved += achieved;
    by.set(p, row);
  }
  const out = [...by.values()];
  for (const r2 of out) r2.coveragePct = r2.annualTarget > 0 ? Math.round((r2.achieved / r2.annualTarget) * 100) : null;
  return out.sort((a, b) => b.annualTarget - a.annualTarget || a.product.localeCompare(b.product, "ar"));
}
