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
  outcome?: "interested" | "not_interested" | "later" | "handoff" | "opted_out" | "closed";
  outcomeReason?: string;
  optedOut: boolean;
  human: boolean;        // true → human took over, agent stays silent
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

export function getContact(phone: string, waName?: string): Contact {
  let c = contacts.get(phone);
  if (!c) {
    c = {
      phone, firstSeenAt: Date.now(), lastEventAt: Date.now(),
      statusTimes: {}, transcript: [], tags: [],
      optedOut: false, human: false, agentTurns: 0,
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

export function setOutcome(phone: string, outcome: Contact["outcome"], reason?: string) {
  const c = getContact(phone);
  c.outcome = outcome;
  if (reason) c.outcomeReason = reason;
  if (outcome === "opted_out") c.optedOut = true;
  if (outcome === "handoff") c.human = true;
  persist(c);
  bump(`outcome:${outcome}`);
  logEvent(`outcome:${outcome}`, phone, reason ?? "");
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
      optedOut: Boolean(r.opted_out),
      human: Boolean(r.human),
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
