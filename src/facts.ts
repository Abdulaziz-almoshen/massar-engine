// ---------------------------------------------------------------------------
// Account facts — what we know about the ENTITY, with provenance.
//
// Why this file exists (founder, 2026-08-18): «does the agent know the potential client needs
// HIS or ERP? because it asks clients.» It did not, and it could not: the only door for prospect
// facts was `ACCOUNTS_JSON`, an env blob that was never set in production, so `accountBlock()`
// returned "" for every conversation and the §٨ discovery ladder fired every time. The customer
// met an interview because the system had nothing to bring to the table.
//
// The rule this module encodes: ASKING IS FINE — ASKING TWICE IS THE BUG. A fact enters from an
// import, a human, or the customer's own sentence; it is stored on the entity (which outlives the
// campaign and the conversation); and it is handed to the next prompt as known.
//
// Provenance is the whole contract, and it is the SAME contract `tracker.decideProp` already
// enforces for the six CRM properties: a human fact is never overwritten by a machine reading —
// the disagreement is kept once, passively, as `contested`. `decideFact` is pure and does no I/O,
// so scripts/check-facts.mjs can falsify every branch without a database.
// ---------------------------------------------------------------------------

/** The closed vocabulary. A key not on this list is REPORTED, never silently dropped
 *  (this repo's recurring defect class: values the system writes but cannot read back). */
export const FACT_KEYS = [
  "systemKind", "hisName", "erpName", "branches", "hisArchitecture", "integrationStatus",
  "currentProducts", "transactionVolume", "usageLevel", "manualUsage", "customerType",
  "technicalNotes", "blocker", "customerName", "pricing", "approvedDiscountRange", "contractStatus",
] as const;
export type FactKey = (typeof FACT_KEYS)[number];

/** Arabic labels — part of the contract (the prompt and the portal both render from here,
 *  so a label can never drift between what the agent is told and what the operator sees). */
export const FACT_LABELS: Record<FactKey, string> = {
  systemKind: "نوع النظام المستخدم",
  hisName: "نظام الـHIS",
  erpName: "نظام الـERP",
  branches: "عدد الفروع",
  hisArchitecture: "بنية النظام",
  integrationStatus: "حالة التكامل",
  currentProducts: "الخدمات المستخدمة حاليًا",
  transactionVolume: "حجم العمليات المقاس",
  usageLevel: "مستوى الاستخدام",
  manualUsage: "ما زال يدويًا",
  customerType: "نوع الجهة",
  technicalNotes: "ملاحظات تقنية",
  blocker: "ما الذي يمنع المضي",
  customerName: "اسم الجهة",
  pricing: "التسعير المعتمد لهذا الحساب",
  approvedDiscountRange: "هامش الخصم المعتمد",
  contractStatus: "حالة العقد",
};

/**
 * Which facts the AGENT may write from a conversation.
 *
 * Commercial terms are human-only for the same reason `decisionMaker` is human-only in
 * `tracker.ts`: the increment that exists to distrust machine inferences is the wrong place to
 * add a new one that moves money. `customerName` is import-only — the WhatsApp display name is
 * already on the contact and is not an entity's legal identity.
 */
const AGENT_WRITABLE: ReadonlySet<FactKey> = new Set<FactKey>([
  "systemKind", "hisName", "erpName", "branches", "hisArchitecture", "integrationStatus",
  "currentProducts", "transactionVolume", "usageLevel", "manualUsage", "customerType",
  "technicalNotes", "blocker",
]);

export function isAgentWritable(key: FactKey): boolean { return AGENT_WRITABLE.has(key); }

/** Bounds. `technicalNotes` is prose; the rest are short scope answers. */
const MAX_LEN: Record<FactKey, number> = {
  systemKind: 60, hisName: 120, erpName: 120, branches: 40, hisArchitecture: 80,
  integrationStatus: 120, currentProducts: 400, transactionVolume: 120, usageLevel: 40,
  manualUsage: 300, customerType: 80, technicalNotes: 1000, blocker: 300, customerName: 160,
  pricing: 300, approvedDiscountRange: 120, contractStatus: 120,
};

/** Who held a value before, so a confirmation and a correction stay distinguishable. */
export type FactStamp = { value: string; by: string; ts: number };

export type Fact = {
  value: string;
  /** Two-valued on purpose. An import writes `human` with `by:"import"` — a spreadsheet a person
   *  filled in is a human fact, and it must outrank a model's reading of a sentence. */
  source: "human" | "agent";
  by: string;
  ts: number;
  /** The customer's VERBATIM words that justify an agent reading. An agent fact without one is
   *  not writable at all (see `decideFact` condition 5) — the same evidence rule `record_schedule`
   *  already applies to a booked time, for the same reason: a fact with no quotable source is an
   *  assertion about the customer's operation. */
  said?: string;
  prior?: FactStamp;
  /** A refused agent reading that disagrees with a human fact. LATEST ONLY — a passive line the
   *  operator may accept, never a growing log and never a competing value. */
  contested?: FactStamp;
};

export type FactSet = Partial<Record<FactKey, Fact>>;

export type FactReject =
  | "unknown_fact" | "not_agent_writable" | "too_long" | "human_value_wins"
  | "empty_value" | "no_evidence" | "not_persisted";

export type FactDecision = {
  applied: boolean;
  reason?: FactReject;
  /** What the entity should hold for this key afterwards. Absent → write nothing. */
  fact?: Fact;
  /** Clear the key back to «ناقص». Human-only. */
  remove?: boolean;
};

/**
 * THE GUARD. Pure: reads no module state, performs no I/O. The condition ORDER is load-bearing —
 * an unknown key is reported as an unknown key before anything else is judged, and a refused
 * agent write is refused before its length is measured.
 */
export function decideFact(args: {
  key: string; value: unknown; source: "human" | "agent"; by: string;
  current?: Fact; said?: string; now?: number;
}): FactDecision {
  const { source, by, current } = args;
  const now = args.now ?? Date.now();

  // 1. An unknown key is never silently dropped.
  if (!(FACT_KEYS as readonly string[]).includes(args.key)) return { applied: false, reason: "unknown_fact" };
  const key = args.key as FactKey;

  // 2. Human-only keys refuse the agent outright, before anything else.
  if (source === "agent" && !AGENT_WRITABLE.has(key)) return { applied: false, reason: "not_agent_writable" };

  const value = String(args.value ?? "").trim();
  const said = String(args.said ?? "").trim();

  // 3. Length bound.
  if (value.length > MAX_LEN[key]) return { applied: false, reason: "too_long" };

  // 4. THE HARD INVARIANT. A human fact is never replaced by a machine reading. The disagreement
  //    is kept ONCE as `contested`; value/source/by/ts are untouched.
  if (current && current.source === "human" && source === "agent") {
    if (current.value === value) return { applied: false, reason: "human_value_wins" };
    return {
      applied: false, reason: "human_value_wins",
      fact: { ...current, contested: { value, by, ts: now } },
    };
  }

  // 5. An agent fact must carry the customer's own words. Without them we would be storing what
  //    the model concluded as if the customer had said it — the invented-state failure this
  //    project keeps catching, made durable across every future campaign.
  if (source === "agent" && !said) return { applied: false, reason: "no_evidence" };

  // 6. Empty from a human is an explicit erase back to «ناقص»; empty from the agent is nothing.
  if (!value) {
    if (source === "human") return { applied: true, remove: true };
    return { applied: false, reason: "empty_value" };
  }

  const fact: Fact = { value, source, by, ts: now };
  if (said) fact.said = said.slice(0, 200);
  // `prior` is what a confirmation IS: same value, new source. A correction is the same shape with
  // a different value — one field serves both, which is what makes the metric computable.
  if (current) fact.prior = { value: current.value, by: current.by, ts: current.ts };
  // An accepted write settles the disagreement, so a stale «قراءة مختلفة» must not survive it.
  return { applied: true, fact };
}

/** Rebuild a fact set from JSONB, keeping only what the contract admits. A hand-edited or legacy
 *  row must not put an unknown key or a non-string value into a typed field. */
export function readFacts(raw: unknown): FactSet {
  const out: FactSet = {};
  if (!raw || typeof raw !== "object") return out;
  for (const key of FACT_KEYS) {
    const r = (raw as Record<string, unknown>)[key];
    if (!r || typeof r !== "object") continue;
    const f = r as Partial<Fact>;
    if (typeof f.value !== "string" || !f.value) continue;
    const source = f.source === "human" ? "human" : "agent";
    const fact: Fact = {
      value: f.value.slice(0, MAX_LEN[key]),
      source,
      by: typeof f.by === "string" && f.by ? f.by : source,
      ts: Number.isFinite(f.ts) ? Number(f.ts) : 0,
    };
    if (typeof f.said === "string" && f.said) fact.said = f.said.slice(0, 200);
    const stamp = (s: unknown): FactStamp | undefined => {
      if (!s || typeof s !== "object") return undefined;
      const p = s as Partial<FactStamp>;
      if (typeof p.value !== "string" || !p.value) return undefined;
      return { value: p.value, by: typeof p.by === "string" ? p.by : "", ts: Number.isFinite(p.ts) ? Number(p.ts) : 0 };
    };
    const prior = stamp(f.prior); if (prior) fact.prior = prior;
    const contested = stamp(f.contested); if (contested) fact.contested = contested;
    out[key] = fact;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Import mapping — the spreadsheet is producer #1.
// ---------------------------------------------------------------------------

/** Header → fact key. Ordered: the first pattern that matches a header wins, so a specific
 *  column («عدد الفروع») is never shadowed by a generic one («العدد»). */
const HEADER_PATTERNS: [RegExp, FactKey][] = [
  [/\bhis\b|نظام\s*المعلومات|النظام\s*الصحي|اسم\s*النظام/i, "hisName"],
  [/\berp\b|تخطيط\s*الموارد|نظام\s*الموارد/i, "erpName"],
  [/نوع\s*النظام|system\s*type|his\s*or\s*erp/i, "systemKind"],
  [/عدد\s*الفروع|الفروع|branch/i, "branches"],
  [/بنية|معمارية|مركزي|architecture/i, "hisArchitecture"],
  [/حالة\s*التكامل|التكامل|integration/i, "integrationStatus"],
  [/الخدمات\s*المستخدمة|الخدمات\s*الحالية|المنتجات|current\s*products|services/i, "currentProducts"],
  [/حجم\s*العمليات|عدد\s*المعاملات|الحجم\s*الشهري|volume/i, "transactionVolume"],
  [/مستوى\s*الاستخدام|الاستخدام|usage/i, "usageLevel"],
  [/يدوي|manual/i, "manualUsage"],
  [/نوع\s*الجهة|القطاع|نوع\s*المنشأة|sector|customer\s*type/i, "customerType"],
  [/التسعير|السعر\s*المعتمد|pricing/i, "pricing"],
  [/حالة\s*العقد|contract/i, "contractStatus"],
  [/ملاحظات\s*تقنية|technical/i, "technicalNotes"],
];

/**
 * Turn an imported attribute map into facts. Everything here is `source:"human", by:"import"` —
 * a person filled the sheet in, and it outranks anything the model reads off a transcript.
 *
 * Unmapped columns are LEFT ALONE, not guessed at: they stay in `attrs` where the segment chips
 * already read them. This function only claims the columns it can name.
 */
export function factsFromAttrs(attrs: Record<string, unknown>, now: number): FactSet {
  const out: FactSet = {};
  for (const [header, raw] of Object.entries(attrs ?? {})) {
    const value = String(raw ?? "").trim();
    if (!value) continue;
    const hit = HEADER_PATTERNS.find(([re]) => re.test(header));
    if (!hit) continue;
    const key = hit[1];
    if (out[key]) continue;                       // first matching column wins
    if (value.length > MAX_LEN[key]) continue;    // an over-long cell is not a fact, it is a paste
    out[key] = { value, source: "human", by: "import", ts: now };
  }
  return out;
}

// ---------------------------------------------------------------------------
// Gaps — what the agent is still allowed to ask about.
// ---------------------------------------------------------------------------

/** The §٨ ladder, in the order the founder set. `systemKind` leads because it is the question he
 *  asked: whether this prospect runs an HIS or an ERP decides which integration story is true. */
const GAP_ORDER: FactKey[] = [
  "systemKind", "hisName", "branches", "hisArchitecture", "integrationStatus", "blocker",
];

/**
 * Which of the ladder's facts are still missing, in ask-order.
 *
 * Two keys satisfy `systemKind` implicitly: knowing the HIS or the ERP by name means we already
 * know which kind they run. That is a READ of facts we hold, not an inference about the customer,
 * so it never writes anything — it only stops us asking a question we can already answer.
 */
export function missingKeys(facts: FactSet): FactKey[] {
  const known = (k: FactKey) => Boolean(facts[k]?.value);
  return GAP_ORDER.filter((k) => {
    if (known(k)) return false;
    if (k === "systemKind") return !known("hisName") && !known("erpName");
    if (k === "hisName") return !known("erpName");
    return true;
  });
}
