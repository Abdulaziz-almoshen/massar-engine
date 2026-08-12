import pg from "pg";

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
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS test BOOLEAN NOT NULL DEFAULT FALSE;
-- A campaign was only "sandbox" if every target happened to be a test contact, so a real
-- launch used as a rehearsal had nowhere to be filed. This makes it an explicit property.
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS test BOOLEAN NOT NULL DEFAULT FALSE;
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
}): void {
  fire(
    `INSERT INTO contacts (phone, wa_name, first_seen_at, last_event_at, status_times, outcome, outcome_reason, opted_out, human, test, agent_turns, last_error)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
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
       last_error = EXCLUDED.last_error`,
    [c.phone, c.waName ?? null, c.firstSeenAt, c.lastEventAt, JSON.stringify(c.statusTimes),
     c.outcome ?? null, c.outcomeReason ?? null, c.optedOut, c.human, Boolean(c.test), c.agentTurns, c.lastError ?? null],
  );
}

export function insertMessage(phone: string, role: string, text: string, ts: number): void {
  fire(`INSERT INTO messages (phone, role, text, ts) VALUES ($1,$2,$3,$4)`, [phone, role, text, ts]);
}
/** Atomic: a failed INSERT halfway through must not leave the contact with its old tags
 *  deleted and its new ones missing. One client, one transaction, rolled back on any throw. */
export async function replaceTags(phone: string, tags: { product: string; level: string; ts: number }[]): Promise<void> {
  if (!pool || !connected) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM interest_tags WHERE phone = $1`, [phone]);
    for (const t of tags) {
      await client.query(`INSERT INTO interest_tags (phone, product, level, ts) VALUES ($1,$2,$3,$4)`, [phone, t.product, t.level, t.ts]);
    }
    await client.query("COMMIT");
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
export function insertTag(phone: string, product: string, level: string, ts: number): void {
  fire(`INSERT INTO interest_tags (phone, product, level, ts) VALUES ($1,$2,$3,$4)`, [phone, product, level, ts]);
}
export function insertEvent(phone: string, kind: string, note: string, ts: number): void {
  fire(`INSERT INTO events (phone, kind, note, ts) VALUES ($1,$2,$3,$4)`, [phone, kind, note, ts]);
}

export type HydratedContact = {
  phone: string; wa_name: string | null; first_seen_at: string; last_event_at: string;
  status_times: Record<string, number>; outcome: string | null; outcome_reason: string | null;
  opted_out: boolean; human: boolean; test?: boolean; agent_turns: number; last_error: string | null;
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
};

export async function listEntities(): Promise<EntityRow[]> {
  if (!pool || !connected) return [];
  const r = await pool.query(`SELECT id, name, phone, size, city, attrs FROM entities ORDER BY name`);
  // Legacy size/city columns fold into attrs so the UI reads one uniform attribute map.
  return r.rows.map((x) => ({
    ...x, id: Number(x.id),
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
      const res = await pool.query(
        `INSERT INTO entities (name, phone, size, city, attrs, created_at) VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (phone) DO UPDATE SET
           name = EXCLUDED.name,
           size = COALESCE(EXCLUDED.size, entities.size),
           city = COALESCE(EXCLUDED.city, entities.city),
           attrs = entities.attrs || EXCLUDED.attrs
         RETURNING (xmax = 0) AS inserted`,
        [r.name, r.phone, r.size ?? null, r.city ?? null, JSON.stringify(r.attrs ?? {}), Date.now()]);
      res.rows[0]?.inserted ? added++ : updated++;
    } catch { skipped++; }
  }
  return { added, updated, skipped };
}

export async function deleteEntity(id: number): Promise<void> {
  if (!pool || !connected) return;
  await pool.query(`DELETE FROM entities WHERE id = $1`, [id]);
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
  targets: { phone: string; name?: string }[]): Promise<number | null> {
  if (!pool || !connected) return null;
  const r = await pool.query(
    `INSERT INTO campaigns (name, product, message, created_at) VALUES ($1,$2,$3,$4) RETURNING id`,
    [name, product, message, Date.now()]);
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
