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

// ---------------------------------------------------------------------------
// Enrichable client record (cycle crm-record, requirements FR-1…FR-7).
// Exactly six typed properties, each carrying WHO said it and WHEN. Three states per property:
// حقيقة (source:'human') · قراءة (source:'agent') · ناقص (key absent). No seventh key.
// ---------------------------------------------------------------------------

export const PROP_KEYS = [
  "decisionMaker", "orgProfile", "productInterest", "nextStep", "note", "disqualifyReason",
] as const;
export type PropKey = (typeof PROP_KEYS)[number];

/** Arabic labels — part of the contract (requirements §1), not of the view layer. */
export const PROP_LABELS: Record<PropKey, string> = {
  decisionMaker: "صاحب القرار",
  orgProfile: "المنشأة",
  productInterest: "الاهتمام",
  nextStep: "الخطوة التالية",
  note: "ملاحظة",
  disqualifyReason: "سبب الاستبعاد",
};

/** FR-6's closed vocabulary. «other» is the escape hatch that will reveal a missing reason. */
export const DISQUALIFY_REASONS = ["price", "no_need", "wrong_contact", "competitor", "no_response", "other"] as const;

/** Who held a value before, so a confirmation and a correction are distinguishable. */
export type PropStamp = { value: string; by: string; ts: number };

export type Prop = {
  value: string;
  source: "human" | "agent";
  /** The named writer — an admin, or `agent:<tool>`, or `import`. `source` stays two-valued. */
  by: string;
  ts: number;
  /** FR-4 only: what we READ the stated time as, epoch ms. Advisory, never sent from. */
  due?: number;
  /** The value this one replaced. Populated on أكّد (same value) and on صحّح (different value) —
   *  which is what makes the confirmation-rate metric computable at all. */
  prior?: PropStamp;
  /** A refused agent reading that disagrees with the stored human fact. LATEST ONLY, never a
   *  growing list: it is a passive «قراءة مختلفة» line the operator may accept, not a log. */
  contested?: PropStamp;
};

export type PropReject =
  | "unknown_property" | "not_agent_writable" | "unknown_phone"
  | "too_long" | "bad_date" | "human_value_wins" | "not_persisted"
  // Not in the plan's list: the plan's condition 6 clears a key only «from a human». An EMPTY
  // agent write therefore has no defined home, and silently dropping it is this repo's own
  // recurring defect (emitted-values-must-be-readable). It gets a readable reason instead, and
  // never clears a value the agent did not have the right to clear.
  | "empty_value";

/** Which keys an agent may write at all. `note` is human-only (FR-5); `orgProfile` is import-only
 *  (FR-2); `decisionMaker` is HUMAN-ONLY in this increment (plan OQ-1 — adding a new LLM inference
 *  in the increment that exists to distrust inferences is the wrong order). An importer wanting
 *  orgProfile writes it as `source:'human', by:'import'` until FR-2 gets its own path. */
const AGENT_WRITABLE: ReadonlySet<PropKey> = new Set<PropKey>(["productInterest", "nextStep", "disqualifyReason"]);

/** NFR-1 bounds. productInterest is an enum-SET, not short text: the tags route admits 8 products of
 *  up to 80 chars each, so a 120-char cap would reject a legal correction. */
const MAX_LEN: Record<PropKey, number> = {
  decisionMaker: 120, orgProfile: 120, productInterest: 800, nextStep: 120, note: 2000, disqualifyReason: 200,
};
const YEAR_MS = 365 * 24 * 3600e3;

export type PropDecision = {
  applied: boolean;
  reason?: PropReject;
  /** What the ledger and memory should hold for this key afterwards. Absent → write nothing. */
  prop?: Prop;
  /** Delete the key back to «ناقص». */
  remove?: boolean;
};

/**
 * THE GUARD (BR-7). Pure: it reads no module state and performs no I/O, so every branch below is
 * falsifiable by `scripts/check-props.mjs` without a database. `writeProp` supplies `known` and
 * `current` from memory and owns nothing but persistence — there is exactly one place where a
 * property's provenance is decided.
 *
 * The conditions are ordered, and the order is load-bearing: an unknown key must be reported as an
 * unknown key even for an unknown phone, and a refused agent write must be refused before its
 * length is judged.
 */
export function decideProp(args: {
  key: string; value: unknown; source: "human" | "agent"; by: string;
  known: boolean; current?: Prop; due?: number; now?: number;
}): PropDecision {
  const { source, by, known, current } = args;
  const now = args.now ?? Date.now();

  // 1. NFR-2 — an unknown key is never silently dropped.
  if (!(PROP_KEYS as readonly string[]).includes(args.key)) return { applied: false, reason: "unknown_property" };
  const key = args.key as PropKey;

  // 2. AC-3 — human-only / import-only keys refuse the agent outright, before anything else.
  if (source === "agent" && !AGENT_WRITABLE.has(key)) return { applied: false, reason: "not_agent_writable" };

  // 3. A property never manufactures a contact from a typo (the replaceTags precedent).
  if (!known) return { applied: false, reason: "unknown_phone" };

  const value = String(args.value ?? "").trim();

  // 4. NFR-1 — length and date bounds.
  if (value.length > MAX_LEN[key]) return { applied: false, reason: "too_long" };
  if (args.due !== undefined) {
    const due = Number(args.due);
    // Its OWN reason. Sharing "too_long" made the panel tell an operator with a short, perfectly
    // valid phrase and a bad date that «النص أطول من المسموح» — an error about the wrong field, which
    // is unactionable. One rule, one readable code. (QA-3.)
    if (!Number.isFinite(due) || due < now - YEAR_MS || due > now + 2 * YEAR_MS) {
      return { applied: false, reason: "bad_date" };
    }
  }

  // 5. BR-1, the hard invariant. A human fact is never replaced by a machine reading. The
  //    disagreement is kept ONCE as `contested`; value/source/by/ts are untouched.
  if (current && current.source === "human" && source === "agent") {
    if (current.value === value) return { applied: false, reason: "human_value_wins" };
    return {
      applied: false, reason: "human_value_wins",
      prop: { ...current, contested: { value, by, ts: now } },
    };
  }

  // 6. Empty from a human is an explicit erase back to «ناقص» — never a stored empty string.
  if (!value) {
    if (source === "human") return { applied: true, remove: true };
    return { applied: false, reason: "empty_value" };
  }

  const prop: Prop = { value, source, by, ts: now };
  if (args.due !== undefined) prop.due = Number(args.due);
  // `prior` is what a confirmation IS: same value, new source. A correction is the same shape with
  // a different value, which is why one field serves both and the metric can tell them apart.
  if (current) prop.prior = { value: current.value, by: current.by, ts: current.ts };
  // An accepted write settles the disagreement, so a stale «قراءة مختلفة» must not survive it.
  return { applied: true, prop };
}

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
  /** The six typed properties (FR-1…FR-6). Deeply `Readonly` on purpose: `c.props.note = …`
   *  outside this module is a tsc error, so `writeProp` below is the only door. Absent key =
   *  «ناقص», which is why it is Partial and not a full Record. */
  props: Readonly<Partial<Record<PropKey, Readonly<Prop>>>>;
};

/** The module-local key that opens the readonly door — deliberately not exported. */
type MutableProps = { -readonly [K in PropKey]?: Prop };
function propsOf(c: Contact): MutableProps { return c.props as MutableProps; }

/** Rebuild props from JSONB, keeping only what the contract admits. A hand-edited or legacy row
 *  must not put an unknown key or a non-string value into a typed field. */
function readProps(raw: unknown): Partial<Record<PropKey, Prop>> {
  const out: MutableProps = {};
  if (!raw || typeof raw !== "object") return out;
  for (const key of PROP_KEYS) {
    const r = (raw as Record<string, unknown>)[key];
    if (!r || typeof r !== "object") continue;
    const p = r as Partial<Prop>;
    if (typeof p.value !== "string" || !p.value) continue;
    if (p.source !== "human" && p.source !== "agent") continue;
    const prop: Prop = { value: p.value, source: p.source, by: String(p.by ?? ""), ts: Number(p.ts ?? 0) };
    if (typeof p.due === "number") prop.due = p.due;
    if (p.prior && typeof p.prior.value === "string") prop.prior = { value: p.prior.value, by: String(p.prior.by ?? ""), ts: Number(p.prior.ts ?? 0) };
    if (p.contested && typeof p.contested.value === "string") prop.contested = { value: p.contested.value, by: String(p.contested.by ?? ""), ts: Number(p.contested.ts ?? 0) };
    out[key] = prop;
  }
  return out;
}

/** One rendering of an interest set, shared by the human correction route and the agent's tag tool,
 *  so حقيقة and قراءة are comparable strings rather than two formats that always "differ". */
export function formatInterest(tags: readonly { product: string; level: string }[]): string {
  return tags.map((t) => `${t.product}:${t.level}`).join(" · ");
}

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
      statusTimes: {}, transcript: [], tags: [], props: {},
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

/**
 * FR-3 as a READING — and a property write like any other, so it goes through the ONE door.
 *
 * It used to push straight into `c.tags` and call `db.insertTag`, which made it a SECOND tag writer
 * standing outside BR-1: an operator could delete a fabricated tag in ملف العميل and the next
 * inference put it back into the customers table while the record still read حقيقة. `writeProp`
 * now owns the decision, the transaction (`upsertProps` rewrites `interest_tags` inside it) and the
 * memory, so a tag obeys the same refusal ladder as the property it renders as — and the refusal is
 * a value the caller can read instead of a silent divergence.
 *
 * The whole set is sent, with this product replacing any earlier entry for it. An interest whose
 * level did not change keeps its original `ts`: curation fixes what we recorded, it must not
 * restate WHEN the customer showed it.
 */
export async function addTag(
  phone: string, product: string, level: Tag["level"], by = "agent:tag_interest",
): Promise<{ applied: boolean; persisted: boolean; reason?: PropReject; prop?: Prop }> {
  const c = getContact(phone);
  const kept = (c.tags || []).find((t) => t.product === product);
  const next: Tag[] = (c.tags || []).filter((t) => t.product !== product)
    .concat([{ product, level, ts: kept && kept.level === level ? kept.ts : Date.now() }]);
  const r = await writeProp(phone, "productInterest", formatInterest(next), "agent", by, { tags: next });
  // The timeline entry belongs to an ACCEPTED tag only. A refused write that still drew a dot on
  // the record would be the same lie in a smaller font.
  if (r.applied) {
    bump("tag");
    logEvent("tag", phone, `${product}:${level}`);
  }
  return r;
}

/** Curation fixes what we recorded — it must not restate WHEN the customer showed interest, so a
 *  tag whose product is unchanged keeps its original ts. */
function mergeTagTs(c: Contact, tags: readonly { product: string; level: Tag["level"]; ts?: number }[]): Tag[] {
  const prior = new Map((c.tags || []).map((t) => [t.product, t.ts]));
  return tags.map((t) => ({ product: t.product, level: t.level, ts: t.ts ?? prior.get(t.product) ?? Date.now() }));
}

/**
 * THE ONLY DOOR onto `contacts.props` (BR-7a). Every caller — route, agent tool, importer — goes
 * through here and performs no source check of its own, so no future tool can bypass BR-1.
 *
 * The decision is `decideProp`'s (pure, above); this function owns only lookup, persistence and
 * memory. DB FIRST, memory second: if the ledger refuses, memory stays as it was, so a re-GET reads
 * «ناقص» consistently instead of showing a value that does not exist anywhere.
 *
 * Never throws. It returns a reason the caller can read and act on — and the two callers act
 * OPPOSITELY on purpose (plan D2): the admin route turns `not_persisted` into a 503 that keeps the
 * editor open, while the agent logs it and keeps talking. See both sites for why.
 */
export async function writeProp(
  phone: string,
  key: PropKey | string,
  value: unknown,
  source: "human" | "agent",
  by: string,
  opts?: { tags?: readonly { product: string; level: Tag["level"]; ts?: number }[]; due?: number },
): Promise<{ applied: boolean; persisted: boolean; reason?: PropReject; prop?: Prop }> {
  const c = findContact(phone);
  const current = c && (PROP_KEYS as readonly string[]).includes(key) ? c.props[key as PropKey] : undefined;
  // Read BEFORE the write: whether the standing appointment is one a human typed decides whether an
  // erase may clear it (see the reconciliation below).
  const heldBefore = c ? humanDue(c) : undefined;
  const d = decideProp({ key, value, source, by, known: Boolean(c), current, due: opts?.due });

  // Nothing to store: a refusal that changes no state (an unknown key, a refused agent write, an
  // identical re-inference). Readable, never a silent no-op.
  if (!c || (!d.prop && !d.remove)) return { applied: false, persisted: false, reason: d.reason };

  const k = key as PropKey;
  const nextTags = d.applied && opts?.tags ? mergeTagTs(c, opts.tags) : undefined;
  try {
    const found = await db.upsertProps(
      phone,
      d.prop ? { [k]: d.prop } : {},
      d.remove ? [k] : [],
      nextTags,
    );
    // The ledger disagrees with memory about this phone existing; believe the ledger.
    if (!found) return { applied: false, persisted: false, reason: "unknown_phone" };
  } catch (e) {
    const reason = e instanceof db.NotPersisted ? String(e.message) : String(e).slice(0, 200);
    console.error(JSON.stringify({ at: "tracker", msg: "prop write not persisted", phone, key: k, source, reason }));
    return { applied: false, persisted: false, reason: "not_persisted" };
  }

  const mp = propsOf(c);
  if (d.remove) delete mp[k];
  else if (d.prop) mp[k] = d.prop;

  // M3 — ONE APPOINTMENT, ONE PLACE. A day typed into الخطوة التالية IS the appointment the rest of
  // the portal reads (قائمة الصباح, the status strip, the record); it used to be a second,
  // unreconciled store, so قائمة الصباح never learned the operator's date and the strip printed
  // «لم تُؤكَّد بعد» forever on a meeting a human had confirmed. The one door writes both, in one
  // call, so they cannot drift. `by`/`source` are NOT copied onto the contact: «مؤكَّد» is derived
  // from this property, which keeps the provenance in exactly one place.
  if (d.applied && k === "nextStep" && source === "human") {
    const due = d.prop?.due;
    if (due !== undefined) {
      c.scheduledAt = Number(due);
      persist(c);
    } else if (heldBefore !== undefined) {
      // He cleared HIS OWN day (or erased the step). The agent's reading of the customer's words is
      // not his to delete by accident, so the appointment is cleared only when it was his. Its own
      // statement: upsertContact COALESCEs scheduled_at, so `persist` alone cannot erase it.
      c.scheduledAt = undefined;
      db.clearSchedule(phone);
    }
  }
  if (nextTags) {
    c.tags = nextTags;
    persist(c);   // bump last_event_at; `props` is NOT in upsertContact and never will be
  }

  if (d.applied) {
    logEvent(`prop:${k}`, phone, d.remove ? `${by} · مسح` : `${by} · ${source} · ${d.prop?.value.slice(0, 80) ?? ""}`);
  } else if (d.reason === "human_value_wins" && d.prop?.contested) {
    // BR-7c: a refusal is normal operation, not an incident — logged, never alerted. Only the
    // DISAGREEING case is logged, so an insights re-run that re-infers the same value does not
    // churn the timeline on every refresh.
    logEvent(`prop_rejected:${k}`, phone, `human_value_wins · قراءة مختلفة: ${d.prop.contested.value.slice(0, 80)}`);
  }
  return { applied: d.applied, persisted: true, reason: d.reason, prop: d.prop };
}

/** BR-7d — the human facts, as grounded truth for the agent's context, so it stops re-asking what
 *  the operator already answered. Only حقيقة: a machine reading fed back to the machine that
 *  produced it is not evidence, and re-asserting it as fact is how a guess hardens into a record.
 *  `note` is excluded deliberately — it is the operator's internal commentary about the customer,
 *  and anything in this block can end up paraphrased into a message. */
export function humanFactsBlock(c: Pick<Contact, "props">): string {
  const lines: string[] = [];
  for (const k of PROP_KEYS) {
    // `note` is the team's private scratchpad, and `disqualifyReason` is our INTERNAL judgement of
    // this account — «غير مناسب», «لا حاجة». Neither is a fact about the customer, and the model
    // paraphrases what it is given: telling a clinic we filed them as unsuitable is the kind of
    // sentence that ends a relationship. Both stay out of the prompt. (safety-gate advisory,
    // crm-record cycle.)
    if (k === "note" || k === "disqualifyReason") continue;
    const p = c.props?.[k];
    if (p && p.source === "human") lines.push(`- ${PROP_LABELS[k]}: ${p.value}`);
  }
  if (!lines.length) return "";
  return ["# حقائق مؤكدة من الفريق — لا تسأل عنها ولا تناقضها",
    ...lines,
    "هذه أثبتها زميل بشري. اعتمدها كما هي؛ إن ذكر العميل خلافها فانقل كلامه دون تصحيح السجل بنفسك.",
  ].join("\n");
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

/** M3 — THE APPOINTMENT HAS ONE HOME: `c.scheduledAt`. `props.nextStep.due` is not a second store;
 *  it is the PROVENANCE of that same moment, written by the same door in the same call, which is
 *  what lets the portal derive «مؤكَّد» instead of storing it twice. This reads back the day a human
 *  typed, so BR-1 can govern the appointment exactly as it governs every other value. */
function humanDue(c: Contact): number | undefined {
  const p = c.props.nextStep;
  return p && p.source === "human" && p.due !== undefined ? Number(p.due) : undefined;
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
  // BR-1 on the appointment itself: the customer's WORDS are always a fact and always stored, but a
  // machine reading of them never overwrites a day a human already typed. Without this, one new
  // sentence from the customer would silently replace the operator's confirmed date with a guess —
  // and the disagreement is not lost: the nextStep write that follows this call is refused by
  // decideProp and kept as `contested`, which the record renders as «قراءة مختلفة من المساعد».
  const held = humanDue(c);
  c.scheduledAt = held !== undefined ? held : readTime(said);
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
let hydratedOnce = false;
export async function hydrate(): Promise<number> {
  // Runs at most once per process. On a mid-life RECONNECT the memory is AHEAD of Postgres —
  // every write during the outage was dropped by fire() — so re-reading the rows here would
  // overwrite the newest conversations with the pre-outage snapshot. Only a process that never
  // hydrated (boot raced a Postgres restart) may fill itself from the table.
  if (hydratedOnce) return contacts.size;
  const data = await db.loadAll();
  if (!data) return 0;
  hydratedOnce = true;
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
      props: readProps(r.props),
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
