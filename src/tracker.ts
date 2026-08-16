import type { InboundMessage, StatusEvent } from "./gupshup.js";
import * as db from "./db.js";

// ---------------------------------------------------------------------------
// In-memory tracking ledger — the MVP spine of §5/§8 of the architecture doc.
// One record per contact: status timeline, transcript, tags, outcome.
// NOTE: memory only — replaced by Postgres (campaign_contacts / events /
// interest_tags) in the next increment. State is lost on redeploy.
// ---------------------------------------------------------------------------

export type Turn = { role: "customer" | "agent" | "system"; text: string; ts: number };
export type Tag = { product: string; level: "hot" | "warm" | "cold"; ts: number };

export type Contact = {
  phone: string;
  waName?: string;
  firstSeenAt: number;
  lastEventAt: number;
  /** latest timestamp per status: sent / delivered / read / failed ... */
  statusTimes: Record<string, number>;
  lastError?: string;
  transcript: Turn[];
  tags: Tag[];
  outcome?: "interested" | "not_interested" | "later" | "handoff" | "opted_out" | "closed" | "scheduled" | "stopped";
  outcomeReason?: string;
  /** The customer's OWN words naming a time — «صباحًا», «بكرة الصبح», «الأحد الساعة ١١».
   *  Stored verbatim and never normalised: two of the four real conversations already contained a
   *  stated time that nothing recorded, because there was nowhere to put it. A parsed datetime is
   *  a guess; the sentence is a fact, and a human confirms the guess. */
  scheduledSaid?: string;
  /** What we READ that phrase as, epoch ms, Asia/Riyadh. Advisory only — never shown as if the
   *  customer said it, and never used to send anything. */
  scheduledAt?: number;
  /** Which customer turn produced the outcome. Without it an outcome is an assertion with no
   *  source, which is the invented-state failure this project keeps catching. */
  outcomeEvidence?: string;
  optedOut: boolean;
  human: boolean;        // true → human took over, agent stays silent
  test: boolean;         // sandbox/demo traffic — excluded from real campaign views
  agentTurns: number;
};

const contacts = new Map<string, Contact>();
const counters: Record<string, number> = {};
const recentEvents: { ts: number; kind: string; phone: string; note: string }[] = [];

function bump(key: string) { counters[key] = (counters[key] ?? 0) + 1; }
function persist(c: Contact) { db.upsertContact(c); }
function logEvent(kind: string, phone: string, note: string) {
  recentEvents.push({ ts: Date.now(), kind, phone, note });
  if (recentEvents.length > 500) recentEvents.shift();
  db.insertEvent(phone, kind, note, Date.now());
  console.log(JSON.stringify({ at: "tracker", kind, phone, note }));
}

/** Read-only lookup — the LIVE contact with its full transcript (no create, no touch). */
export function findContact(phone: string): Contact | undefined {
  return contacts.get(phone);
}

export function getContact(phone: string, waName?: string): Contact {
  let c = contacts.get(phone);
  if (!c) {
    c = {
      phone, firstSeenAt: Date.now(), lastEventAt: Date.now(),
      statusTimes: {}, transcript: [], tags: [],
      optedOut: false, human: false, test: testNumbers.has(phone), agentTurns: 0,
    };
    contacts.set(phone, c);
  }
  if (waName && !c.waName) c.waName = waName;
  c.lastEventAt = Date.now();
  return c;
}

export function recordInbound(m: InboundMessage): Contact {
  const c = getContact(m.from, m.name);
  c.transcript.push({ role: "customer", text: m.text, ts: Date.now() });
  // A reply implies the message was seen even when read receipts are off (§3).
  if (!c.statusTimes.read) c.statusTimes.read = Date.now();
  c.statusTimes.replied = Date.now();
  bump("inbound");
  db.insertMessage(m.from, "customer", m.text, Date.now());
  persist(c);
  logEvent("inbound", m.from, m.text.slice(0, 80));
  return c;
}

export function recordStatus(e: StatusEvent) {
  if (!e.destination) return;
  const c = getContact(e.destination);
  c.statusTimes[e.status] = Date.now();
  if (e.status === "failed") c.lastError = `${e.errorCode ?? ""} ${e.errorReason ?? ""}`.trim();
  persist(c);
  bump(`status:${e.status}`);
  logEvent(`status:${e.status}`, e.destination, e.errorReason ?? "");
}

export function recordAgentReply(phone: string, text: string) {
  const c = getContact(phone);
  c.transcript.push({ role: "agent", text, ts: Date.now() });
  c.agentTurns += 1;
  db.insertMessage(phone, "agent", text, Date.now());
  persist(c);
  bump("agent_reply");
  logEvent("agent_reply", phone, text.slice(0, 80));
}

export function recordSystem(phone: string, text: string) {
  getContact(phone).transcript.push({ role: "system", text, ts: Date.now() });
  db.insertMessage(phone, "system", text, Date.now());
  logEvent("system", phone, text);
}

export function addTag(phone: string, product: string, level: Tag["level"]) {
  const c = getContact(phone);
  c.tags.push({ product, level, ts: Date.now() });
  db.insertTag(phone, product, level, Date.now());
  persist(c);
  bump("tag");
  logEvent("tag", phone, `${product}:${level}`);
}

/** Curate a contact's interest tags (admin correction path) — memory + ledger together. */
/** Correct a contact's interest tags. Curation fixes what we recorded — it must not restate
 *  WHEN the customer showed interest, so a tag whose product is unchanged keeps its original
 *  ts. Returns false when the phone is unknown, rather than manufacturing a contact from a typo. */
export async function replaceTags(phone: string, tags: { product: string; level: Tag["level"]; ts?: number }[]): Promise<boolean> {
  const c = findContact(phone);
  if (!c) return false;
  const prior = new Map((c.tags || []).map((t) => [t.product, t.ts]));
  const next = tags.map((t) => ({ product: t.product, level: t.level, ts: t.ts ?? prior.get(t.product) ?? Date.now() }));
  // DB first: if it throws, memory still matches the ledger instead of drifting ahead of it.
  await db.replaceTags(phone, next);
  c.tags = next;
  persist(c);
  logEvent("tags_curated", phone, tags.map((t) => `${t.product}:${t.level}`).join(" | "));
  return true;
}

export function setOutcome(phone: string, outcome: Contact["outcome"], reason?: string) {
  const c = getContact(phone);
  c.outcome = outcome;
  if (reason) c.outcomeReason = reason;
  if (outcome === "opted_out") c.optedOut = true;
  // NOTE: handoff no longer flips `human` — that flag now means "a human is ACTIVELY
  // handling this chat" and is set only from the portal takeover toggle. A requested
  // specialist without an active human must never dead-end the customer.
  persist(c);
  bump(`outcome:${outcome}`);
  logEvent(`outcome:${outcome}`, phone, reason ?? "");
}

/**
 * Record a time the CUSTOMER stated, in their own words.
 *
 * `said` is the fact and is stored verbatim. `scheduledAt` is only what we read it as — advisory,
 * for sorting a morning list, never displayed as the customer's words and never used to send.
 * An unreadable phrase leaves scheduledAt undefined rather than guessing a datetime: a wrong
 * meeting time is worse than an unparsed one, because a human will act on it.
 */
export function setSchedule(phone: string, said: string) {
  const c = getContact(phone);
  c.scheduledSaid = said;
  c.scheduledAt = readTime(said);
  c.outcome = "scheduled";
  c.outcomeEvidence = said;
  persist(c);
  bump("outcome:scheduled");
  logEvent("outcome:scheduled", phone, said);
}

/** Best-effort reading of an Arabic time phrase → epoch ms, Asia/Riyadh. Returns undefined when
 *  it cannot be read with confidence. Deliberately small: it covers the phrases that actually
 *  appear in this ledger and refuses everything else rather than inventing a slot. */
function readTime(said: string, now = Date.now()): number | undefined {
  const s = said.trim();
  const RIYADH_OFFSET = 3 * 3600e3;
  const dayMs = 24 * 3600e3;
  const morning = /صباح/.test(s);
  const evening = /مساء|بعد\s*الظهر|العصر/.test(s);
  if (!morning && !evening) return undefined;      // no part-of-day → do not guess a date
  const tomorrow = /بكرة|بكره|غدًا|غدا/.test(s);
  const base = new Date(now + RIYADH_OFFSET + (tomorrow ? dayMs : 0));
  base.setUTCHours(morning ? 9 : 15, 0, 0, 0);
  const at = base.getTime() - RIYADH_OFFSET;
  return at > now ? at : at + dayMs;               // never schedule into the past
}

export function setHuman(phone: string, human: boolean) {
  const c = getContact(phone);
  c.human = human;
  persist(c);
  logEvent(human ? "human_takeover" : "agent_resumed", phone, "");
}

let testNumbers = new Set<string>();
export function setTestNumbers(nums: string[]) { testNumbers = new Set(nums.filter(Boolean)); }
export function setTest(phone: string, test: boolean) {
  const c = getContact(phone);
  c.test = test;
  persist(c);
  logEvent(test ? "marked_test" : "unmarked_test", phone, "");
}

/** Full contacts, untruncated. snapshot() caps each transcript at the last 30 turns for the
 *  portal payload — segmentation counts reply occurrences, so it must not read a truncated one. */
export function listContacts(): readonly Contact[] {
  return [...contacts.values()];
}

export function snapshot() {
  return {
    counters,
    contacts: [...contacts.values()].map((c) => ({
      ...c,
      transcript: c.transcript.slice(-30),
    })),
    recentEvents: recentEvents.slice(-100),
  };
}

/** Rebuild the in-memory tracker from Postgres at boot (deploys no longer wipe state). */
export async function hydrate(): Promise<number> {
  const data = await db.loadAll();
  if (!data) return 0;
  for (const r of data.contacts) {
    const c: Contact = {
      phone: r.phone,
      waName: r.wa_name ?? undefined,
      firstSeenAt: Number(r.first_seen_at),
      lastEventAt: Number(r.last_event_at),
      statusTimes: (r.status_times as Record<string, number>) ?? {},
      lastError: r.last_error ?? undefined,
      transcript: [],
      tags: [],
      outcome: (r.outcome as Contact["outcome"]) ?? undefined,
      outcomeReason: r.outcome_reason ?? undefined,
      scheduledSaid: r.scheduled_said ?? undefined,
      scheduledAt: r.scheduled_at != null ? Number(r.scheduled_at) : undefined,
      outcomeEvidence: r.outcome_evidence ?? undefined,
      optedOut: Boolean(r.opted_out),
      human: Boolean(r.human),
      test: Boolean(r.test) || testNumbers.has(r.phone),
      agentTurns: Number(r.agent_turns),
    };
    contacts.set(c.phone, c);
  }
  for (const m of data.messages) {
    const c = contacts.get(m.phone);
    if (c && (m.role === "customer" || m.role === "agent" || m.role === "system")) {
      c.transcript.push({ role: m.role, text: m.text, ts: Number(m.ts) });
    }
  }
  for (const t of data.tags) {
    const c = contacts.get(t.phone);
    if (c) c.tags.push({ product: t.product, level: t.level as Tag["level"], ts: Number(t.ts) });
  }
  for (const e of data.eventCounts) counters[e.kind] = Number(e.n);
  console.log(JSON.stringify({ at: "tracker", msg: "hydrated from postgres", contacts: contacts.size }));
  return contacts.size;
}
