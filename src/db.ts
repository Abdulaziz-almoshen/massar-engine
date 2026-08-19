import pg from "pg";
import * as facts from "./facts.js";

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

export function enabled(): boolean { return Boolean(process.env.DATABASE_URL); }
export function isConnected(): boolean { return connected; }

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
    connected = true;
    console.log(JSON.stringify({ at: "db", msg: "reconnected after a pool error" }));
  } catch {
    connected = false;                                  // still down; the caller reports it honestly
  }
  return connected;
}

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
`;

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
    connected = true;
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

export async function addEntities(rows: { name: string; phone: string; size?: string; city?: string; attrs?: Record<string, string> }[]):
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
      const res = await pool.query(
        `INSERT INTO entities (name, phone, size, city, attrs, facts, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (phone) DO UPDATE SET
           name = EXCLUDED.name,
           size = COALESCE(EXCLUDED.size, entities.size),
           city = COALESCE(EXCLUDED.city, entities.city),
           attrs = entities.attrs || EXCLUDED.attrs,
           facts = entities.facts || EXCLUDED.facts
         RETURNING (xmax = 0) AS inserted`,
        [r.name, r.phone, r.size ?? null, r.city ?? null, JSON.stringify(r.attrs ?? {}),
         JSON.stringify(imported), Date.now()]);
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
