import pg from "pg";
import * as facts from "./facts.js";
import { SALES_STAGES } from "./sales-domain.js";

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
    if (!migrated) { await pool.query(MIGRATION); await runMigrations(pool); migrated = true; }
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
];

/** Applied-version bookkeeping plus the seed that keeps the ladder in sync with sales-domain. */
async function runMigrations(p: pg.Pool): Promise<void> {
  await p.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY, applied_at BIGINT NOT NULL)`);
  const client = await p.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
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
    await seedDefaultPipeline(client);
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]).catch(() => {});
    client.release();
  }
}

/** The ladder is DATA, and sales-domain is its single source of truth. Re-seeded every boot by key
 *  so a weight corrected in code reaches the database without anyone writing a migration for it. */
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
    await client.query(
      `INSERT INTO pipeline_stages (pipeline_id, key, label, weight_pct, position, exit_criterion)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (pipeline_id, key) DO UPDATE
         SET label = EXCLUDED.label, weight_pct = EXCLUDED.weight_pct,
             position = EXCLUDED.position, exit_criterion = EXCLUDED.exit_criterion`,
      [id, st.key, st.label, st.weightPct, st.position, st.exitCriterion]);
  }
}

export async function init(): Promise<void> {
  if (!enabled()) {
    console.log(JSON.stringify({ at: "db", msg: "DATABASE_URL not set — memory-only mode" }));
    return;
  }
  try {
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 8000 });
    // node-pg emits 'error' on idle clients if the backend drops mid-life; unhandled it
    // kills the process. Log, flip connected so /health tells the truth; writes no-op.
    pool.on("error", (e) => {
      connected = false;
      console.error(JSON.stringify({ at: "db", msg: "pool error — memory-only until recovery", err: String(e).slice(0, 200) }));
    });
    await pool.query(MIGRATION);
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
export async function salesPerformance(startMs: number, endMs: number, year: number, quarter: number): Promise<{
  product: string; sector: string | null; target: number; achieved: number;
  weightedOpen: number; openCount: number; wonCount: number;
}[]> {
  if (!(await reprobe()) || !pool) return [];
  const r = await pool.query(
    `WITH won AS (
       SELECT o.product,
              SUM(o.sale_price * o.qty * o.years * (1 - o.discount / 100.0)) AS achieved,
              COUNT(*) AS won_count
         FROM track_stage_events e
         JOIN opportunities o ON o.id = e.opp_id
        WHERE e.to_stage = 'won'
          AND e.effective_at >= to_timestamp($1 / 1000.0)
          AND e.effective_at <  to_timestamp($2 / 1000.0)
        GROUP BY o.product
     ),
     openv AS (
       SELECT o.product,
              SUM(o.sale_price * o.qty * o.years * (1 - o.discount / 100.0) * ps.weight_pct / 100.0) AS weighted,
              COUNT(*) AS open_count
         FROM opportunities o
         JOIN pipeline_stages ps ON ps.key = o.stage
        WHERE o.stage NOT IN ('won','lost')
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
    [startMs, endMs, year, quarter]);
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

export async function addEntities(rows: { name: string; phone: string; size?: string; city?: string; attrs?: Record<string, string>; tags?: string[] }[]):
  Promise<{ added: number; updated: number; skipped: number }> {
  if (!pool || !connected) return { added: 0, updated: 0, skipped: rows.length };
  let added = 0, updated = 0, skipped = 0;
  for (const r of rows) {
    try {
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
        `INSERT INTO entities (name, phone, size, city, attrs, facts, product_tags, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (phone) DO UPDATE SET
           name = EXCLUDED.name,
           size = COALESCE(EXCLUDED.size, entities.size),
           city = COALESCE(EXCLUDED.city, entities.city),
           attrs = entities.attrs || EXCLUDED.attrs,
           facts = entities.facts || EXCLUDED.facts,
           product_tags = (
             SELECT COALESCE(jsonb_agg(DISTINCT v), '[]'::jsonb)
               FROM jsonb_array_elements(entities.product_tags || EXCLUDED.product_tags) AS v)
         RETURNING (xmax = 0) AS inserted`,
        [r.name, r.phone, r.size ?? null, r.city ?? null, JSON.stringify(r.attrs ?? {}),
         JSON.stringify(imported), JSON.stringify(r.tags ?? []), Date.now()]);
      res.rows[0]?.inserted ? added++ : updated++;
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
export type TagRow = { id: number; name: string; created_at: number; created_by: string | null };

export async function listTags(): Promise<TagRow[]> {
  if (!pool || !connected) return [];
  const r = await pool.query(`SELECT id, name, created_at, created_by FROM tags ORDER BY name`);
  return r.rows.map((x) => ({ ...x, id: Number(x.id), created_at: Number(x.created_at) }));
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
export async function renameTag(from: string, to: string): Promise<boolean> {
  if (!pool || !connected) return false;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const r = await client.query(`UPDATE tags SET name = $2 WHERE name = $1`, [from, to]);
    if (!(r.rowCount ?? 0)) { await client.query("ROLLBACK"); return false; }
    await client.query(
      `UPDATE entities
          SET product_tags = (
            SELECT COALESCE(jsonb_agg(DISTINCT CASE WHEN v = to_jsonb($1::text) THEN to_jsonb($2::text) ELSE v END), '[]'::jsonb)
              FROM jsonb_array_elements(product_tags) AS v)
        WHERE product_tags @> jsonb_build_array($1::text)`, [from, to]);
    await client.query("COMMIT");
    return true;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
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
      `INSERT INTO entities (name, phone, attrs, facts, created_at) VALUES ($1,$2,'{}','{}',$3)
       ON CONFLICT (phone) DO NOTHING`,
      [name || phone, phone, Date.now()]);
    return true;
  } catch { return false; }
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

export async function listKb(): Promise<{ product: string; md: string; source_filename: string | null; updated_at: string }[]> {
  if (!pool || !connected) return [];
  return (await pool.query(`SELECT product, md, source_filename, updated_at FROM product_kb ORDER BY product`)).rows;
}

export async function saveKb(product: string, md: string, sourceFilename: string): Promise<void> {
  if (!pool || !connected) throw new Error("db not connected — product hub requires Postgres");
  await pool.query(
    `INSERT INTO product_kb (product, md, source_filename, updated_at) VALUES ($1,$2,$3,$4)
     ON CONFLICT (product) DO UPDATE SET md = EXCLUDED.md, source_filename = EXCLUDED.source_filename, updated_at = EXCLUDED.updated_at`,
    [product, md, sourceFilename, Date.now()]);
}

// ------------------------------ campaigns (launches) ------------------------------

export async function createCampaign(name: string, product: string, message: string,
  targets: { phone: string; name?: string }[], test = false): Promise<number | null> {
  if (!pool || !connected) return null;
  const r = await pool.query(
    `INSERT INTO campaigns (name, product, message, created_at, test) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [name, product, message, Date.now(), test]);
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
  test: boolean; targets: { phone: string; name: string | null }[];
}[]> {
  if (!pool || !connected) return [];
  const cs = (await pool.query(`SELECT * FROM campaigns ORDER BY created_at DESC`)).rows;
  const ts = (await pool.query(`SELECT campaign_id, phone, name FROM campaign_targets`)).rows;
  return cs.map((c) => ({
    id: Number(c.id), name: c.name, product: c.product, message: c.message, created_at: c.created_at,
    test: Boolean(c.test),
    targets: ts.filter((t) => Number(t.campaign_id) === Number(c.id)).map((t) => ({ phone: t.phone, name: t.name })),
  }));
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
  stage: "contact" | "present" | "tech" | "negotiate" | "won" | "lost";
  source: "whatsapp" | "call" | "visit" | "referral" | "inbound" | "other";
  source_ref: string | null;
  sale_price: number; years: number; qty: number; discount: number;
  owner: string | null; close_on: number | null; next_step: string | null; lost_reason: string | null;
  created_by: string | null; created_at: number; updated_at: number; stage_at: number;
};

export const OPP_STAGES = ["contact", "present", "tech", "negotiate", "won", "lost"] as const;
export const OPP_SOURCES = ["whatsapp", "call", "visit", "referral", "inbound", "other"] as const;

/** Rejects what the CHECK constraints and the arithmetic would reject, before the query runs, so a
 *  bad value is a 400 naming its field rather than a 500 — the same contract validateTask holds.
 *  The numbers are bounded rather than merely typed: a discount of 400 would render a NEGATIVE
 *  pipeline value, and «قيمة الفرصة» is a number the founder reads as money. */
export function validateOppLine(l: Record<string, unknown>): string | null {
  if (typeof l.product !== "string" || !l.product.trim()) return "product";
  if (l.stage != null && !(OPP_STAGES as readonly string[]).includes(String(l.stage))) return "stage";
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

export async function listOpps(): Promise<OppRow[]> {
  if (!pool || !connected) return [];
  return (await pool.query(`SELECT * FROM opportunities ORDER BY id DESC`)).rows.map(rowToOpp);
}

/** One account, N product lines, ONE write. The lines of a deal are created together on the board
 *  and must arrive together: a partial insert would paint a card whose «٣ منتجات» is a lie. */
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

/** stage_at moves ONLY when the stage actually changes, so «متوقّف منذ ١٨ يومًا» counts days in the
 *  stage and not days since anyone last touched the row — editing a next step must not reset a
 *  stall the board exists to show. */
export async function updateOpp(id: number, patch: Partial<OppRow>): Promise<OppRow | null> {
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
  const q = await pool.query(`UPDATE opportunities SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`, vals);
  return q.rows[0] ? rowToOpp(q.rows[0]) : null;
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

export async function deleteOpp(id: number): Promise<boolean> {
  if (!pool || !connected) return false;
  const q = await pool.query(`DELETE FROM opportunities WHERE id = $1`, [id]);
  return (q.rowCount ?? 0) > 0;
}

// ------------------------------ product intro assets (sent by the agent) ------------------------------

export async function saveAsset(product: string, publicId: string, filename: string, contentType: string, bytes: Buffer): Promise<void> {
  if (!pool || !connected) throw new Error("db not connected");
  await pool.query(
    `INSERT INTO product_assets (product, public_id, filename, content_type, bytes, updated_at) VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (product) DO UPDATE SET public_id = EXCLUDED.public_id, filename = EXCLUDED.filename,
       content_type = EXCLUDED.content_type, bytes = EXCLUDED.bytes, updated_at = EXCLUDED.updated_at`,
    [product, publicId, filename, contentType, bytes, Date.now()]);
}

export async function listAssets(): Promise<{ product: string; public_id: string; filename: string }[]> {
  if (!pool || !connected) return [];
  return (await pool.query(`SELECT product, public_id, filename FROM product_assets ORDER BY product`)).rows;
}

export async function getAssetByPublicId(publicId: string):
  Promise<{ filename: string; content_type: string; bytes: Buffer } | null> {
  if (!pool || !connected) return null;
  const r = await pool.query(`SELECT filename, content_type, bytes FROM product_assets WHERE public_id = $1`, [publicId]);
  return r.rows[0] ?? null;
}
