// The place where account facts live.
//
// The AE motion is "usage-led account expansion": the customer ALREADY uses a product, their
// manual transaction volume is the buying signal, and the pitch is moving that workflow into
// their HIS. That only works if the agent knows the account — and re-asking «كم فرع عندكم؟»
// when we already know is the single thing that makes it read as a bot.
//
// WHERE THE FACTS COME FROM (changed 2026-08-18). Until this cycle the only source was
// `ACCOUNTS_JSON`, an env blob that was never set on the deployed app — so this module returned
// nothing for every real conversation and the agent interviewed every customer from scratch.
// The source is now the `entities` table: imported columns, operator edits and the customer's own
// answers all land there as typed facts with provenance (src/facts.ts), and the same store feeds
// the next campaign. `snapshot()` is refreshed asynchronously and read synchronously, because
// `systemPrompt` is sync and must never wait on a query mid-conversation.
//
// Facts here are TREATED AS KNOWN and may be stated back to the customer. Anything absent is
// simply absent: the agent must ask, never guess. There is no default, no inferred volume, no
// estimated branch count. (user-model Rule 2 — numbers must be real, sourced, honestly bounded.)
import * as db from "./db.js";
import * as facts from "./facts.js";

export type Account = {
  phone: string;                    // digits only, country code, no +
  customerName?: string;
  customerType?: string;            // مستشفى · مجموعة طبية · مجمع · مزوّد نظام HIS
  /** THE founder's question, 2026-08-18: does this prospect run an HIS, an ERP, both, or neither.
   *  It decides which integration story is true, so it leads the discovery ladder. */
  systemKind?: string;
  hisName?: string;
  erpName?: string;
  hisArchitecture?: string;         // مركزي · لكل فرع
  integrationStatus?: string;       // لا يوجد · قيد الدراسة · جزئي
  currentProducts?: string[];       // what they already pay for — the expansion base
  transactionVolume?: string;       // e.g. "≈1,400 إجازة شهريًا" — as measured, never estimated
  usageLevel?: string;              // مرتفع · متوسط · منخفض
  branches?: string | number;
  manualUsage?: string;             // what is still done by hand
  blocker?: string;                 // what they said is stopping them
  pricing?: string;                 // AUTHORITATIVE for this account; overrides the product table
  approvedDiscountRange?: string;   // internal ceiling — never quoted verbatim to the customer
  contractStatus?: string;
  technicalNotes?: string;
  adjacentProducts?: string[];      // legitimate cross-sell, per Strategy 12
  /** The typed facts this account was folded from, provenance intact. Carried so the prompt can
   *  name what is still MISSING — the half that stops the interview. */
  facts?: facts.FactSet;
};

/** The synchronous read model. Empty until `refresh()` runs — an empty snapshot means every
 *  conversation takes the cold path, which is the correct failure: an agent that talks like an
 *  account manager without the facts is the bot the founder complained about. */
let snap = new Map<string, Account>();
let refreshedAt = 0;

/** Fold one entity's typed facts into the Account shape the prompt renders. Only keys that HOLD
 *  a value appear; there is no default and no placeholder. */
export function accountOf(name: string, raw: unknown): Account | null {
  const f = facts.readFacts(raw);
  const v = (k: facts.FactKey) => f[k]?.value;
  const a: Account = { phone: "" };
  a.customerName = v("customerName") || name || undefined;
  a.customerType = v("customerType");
  a.systemKind = v("systemKind");
  a.erpName = v("erpName");
  a.hisName = v("hisName");
  a.hisArchitecture = v("hisArchitecture");
  a.integrationStatus = v("integrationStatus");
  a.transactionVolume = v("transactionVolume");
  a.usageLevel = v("usageLevel");
  a.manualUsage = v("manualUsage");
  a.technicalNotes = v("technicalNotes");
  a.blocker = v("blocker");
  a.pricing = v("pricing");
  a.approvedDiscountRange = v("approvedDiscountRange");
  a.contractStatus = v("contractStatus");
  const branches = v("branches");
  if (branches) a.branches = branches;
  const products = v("currentProducts");
  if (products) a.currentProducts = products.split(/[،,]/).map((x) => x.trim()).filter(Boolean);
  a.facts = f;
  return a;
}

/** Replace the snapshot wholesale. The only writer besides `refresh()` is a check script — which
 *  is why this exists at all: the guards must be able to seed an account without a database. */
export function snapshot(list: (Account & { facts?: facts.FactSet })[]): void {
  const m = new Map<string, Account>();
  for (const a of list) {
    const phone = String(a?.phone || "").replace(/\D/g, "");
    if (phone) m.set(phone, { ...a, phone });
  }
  snap = m;
  refreshedAt = Date.now();
}

/** Rebuild the snapshot from the entities table. Called at boot, after an import, and after any
 *  fact write. A failure leaves the previous snapshot standing rather than blanking the agent. */
export async function refresh(): Promise<number> {
  try {
    const rows = await db.listEntities();
    const m = new Map<string, Account>();
    for (const r of rows) {
      const phone = String(r.phone || "").replace(/\D/g, "");
      if (!phone) continue;
      const a = accountOf(r.name, r.facts);
      if (a) m.set(phone, { ...a, phone });
    }
    snap = m;
    refreshedAt = Date.now();
    console.log(JSON.stringify({ at: "accounts", msg: "snapshot refreshed", accounts: m.size, withFacts: withFacts() }));
  } catch (e) {
    console.error(JSON.stringify({ at: "accounts", msg: "snapshot refresh failed", err: String(e).slice(0, 200) }));
  }
  return snap.size;
}

export function getAccount(phone: string): Account | undefined {
  return snap.get(String(phone || "").replace(/\D/g, ""));
}

export function count(): number { return snap.size; }
export function lastRefreshAt(): number { return refreshedAt; }

/**
 * How many accounts carry a real fact — the honest coverage number for /health.
 *
 * Counted over the TYPED facts, not over the rendered lines: every entity has a name, so counting
 * lines made this equal `known()` for any registry at all and reported 15/15 for a table that knew
 * nothing about 15 of them. A number that cannot be wrong is not a measurement.
 */
export function withFacts(): number {
  let n = 0;
  for (const a of snap.values()) if (Object.keys(a.facts ?? {}).length) n++;
  return n;
}

/**
 * Is this an EXPANSION conversation — do we actually know they use us today?
 *
 * The usage-led motion asserts the customer's own operation back to them («بحكم حجم استخدامكم»).
 * A name and a city do not license that sentence; measured usage does. Gating the motion on
 * evidence, rather than on "we have a row", is what keeps a cold prospect from being told what
 * their volume is.
 */
export function isExpansion(phone: string): boolean {
  const a = getAccount(phone);
  if (!a) return false;
  return Boolean((a.currentProducts && a.currentProducts.length) || a.transactionVolume || a.usageLevel);
}

/**
 * THE SINGLE DOOR for writing a fact. Both producers go through here — the agent's `record_fact`
 * and the operator's `POST /admin/entity/facts` — so provenance is decided in exactly one place
 * (the `tracker.writeProp` precedent, and the reason `decideFact` is pure and separately tested).
 *
 * The asymmetry is deliberate and mirrors the CRM properties: a refused agent reading is normal
 * operation and is logged, not raised; the caller decides what a human sees. The reason is always
 * returned so a tool result can tell the model to stop retrying.
 */
export async function writeFact(
  phone: string, key: string, value: string, source: "human" | "agent", by: string,
  opts?: { said?: string; entityName?: string },
): Promise<{ applied: boolean; reason?: facts.FactReject }> {
  const digits = String(phone || "").replace(/\D/g, "");
  // A live thread is proof the number is real, so an inbound stranger's answers still land
  // somewhere. This never overwrites an existing row.
  if (source === "agent") await db.ensureEntity(digits, opts?.entityName || "");
  const raw = await db.getEntityFacts(digits);
  if (raw === null) return { applied: false, reason: "not_persisted" };
  const current = facts.readFacts(raw);
  const d = facts.decideFact({
    key, value, source, by, said: opts?.said,
    current: current[key as facts.FactKey],
  });
  // A refused write can still carry a `fact` — that is how a contested reading is kept.
  if (d.fact || d.remove) {
    const next: Record<string, unknown> = { ...(raw as Record<string, unknown>) };
    if (d.remove) delete next[key];
    else next[key] = d.fact;
    const saved = await db.saveEntityFacts(digits, next);
    if (!saved) return { applied: false, reason: "not_persisted" };
    // Keep the synchronous snapshot honest immediately: the next inbound turn builds its prompt
    // from it, and a fact that is stored but not visible to the very next message is the same
    // defect as not storing it.
    const row = await db.getEntity(digits);
    if (row) {
      const a = accountOf(row.name, row.facts);
      if (a) snap.set(digits, { ...a, phone: digits });
    }
  }
  if (!d.applied) {
    console.log(JSON.stringify({ at: "accounts", msg: "fact not applied", phone: digits, key, source, reason: d.reason ?? null }));
  }
  return { applied: d.applied, reason: d.reason };
}

/** The labelled fact lines for one account, in the order the prompt reads best. Shared with
 *  `withFacts()` so "does this account know anything" and "what does it say" can never disagree. */
function factLines(a: Account): string[] {
  const line = (label: string, v?: string | number | string[]) => {
    if (v === undefined || v === null) return "";
    const s2 = Array.isArray(v) ? v.join("، ") : String(v);
    return s2.trim() ? `- ${label}: ${s2}` : "";
  };
  return [
    line("اسم الجهة", a.customerName),
    line("نوع الجهة", a.customerType),
    line("نوع النظام المستخدم", a.systemKind),
    line("نظام الـHIS", a.hisName),
    line("نظام الـERP", a.erpName),
    line("بنية النظام", a.hisArchitecture),
    line("عدد الفروع", a.branches),
    line("حالة التكامل", a.integrationStatus),
    line("الخدمات المستخدمة حاليًا", a.currentProducts),
    line("حجم العمليات المقاس", a.transactionVolume),
    line("مستوى الاستخدام", a.usageLevel),
    line("ما زال يدويًا", a.manualUsage),
    line("ما ذكره العميل كعائق", a.blocker),
    line("التسعير المعتمد لهذا الحساب", a.pricing),
    line("حالة العقد", a.contractStatus),
    line("خدمات مجاورة ذات صلة", a.adjacentProducts),
    line("ملاحظات تقنية", a.technicalNotes),
  ].filter(Boolean);
}

/** The account block injected into the system prompt. Only facts that EXIST are emitted, each
 *  labelled, so the model can restate them as known — and cannot pad the gaps. */
export function accountBlock(phone: string): string {
  const a = getAccount(phone);
  if (!a) return "";
  const lines = factLines(a);
  if (!lines.length) return "";
  return [
    "# ٠) ملف الحساب — حقائق معروفة، لا تسأل عنها",
    "هذه الحقائق مؤكدة لدينا. استخدمها في كلامك واذكرها كمعطى معروف، ولا تطلب من العميل تأكيدها.",
    ...lines,
    "ما لم يُذكر أعلاه فهو غير معروف: اسأل عنه عند الحاجة، ولا تفترضه ولا تقدّره.",
    a.approvedDiscountRange
      ? "ملاحظة داخلية (لا تُذكر للعميل بأي صيغة): هامش الخصم المعتمد محدود، ولا تعلن رقم خصم — استخدم مسار التأهيل التجاري."
      : "",
  ].filter(Boolean).join("\n");
}

/**
 * The other half of the account file: what we still DO NOT know, named, in ask-order.
 *
 * Without this the agent has no way to tell "unknown" from "not worth asking", so it re-runs the
 * whole §٨ ladder every conversation — the founder's complaint. With it, the ladder collapses to
 * the one or two gaps that are actually open, and every answer is written back through
 * `record_fact` so the next campaign starts further along.
 *
 * Empty when nothing is missing: the agent is then told, above, to stop asking entirely.
 */
export function gapBlock(phone: string): string {
  const a = getAccount(phone);
  const missing = facts.missingKeys(a?.facts ?? {});
  if (!missing.length) return "";
  return [
    "# ٠ب) الناقص عن هذا الحساب — وهذا وحده ما يجوز السؤال عنه",
    "الترتيب أدناه هو ترتيب الأولوية. اسأل عن بند واحد فقط في الرسالة، وفقط إن كان جوابه سيغيّر توصية أو سعرًا أو خطوة تنفيذ.",
    ...missing.map((k, i) => `${"١٢٣٤٥٦٧٨٩"[i] ?? String(i + 1)}. ${facts.FACT_LABELS[k]}`),
    "وفور أن يجيب العميل عن أيٍّ منها، استدعِ record_fact بكلماته حرفيًا في said. ما لا يُسجَّل يُسأل عنه مرة أخرى في الحملة القادمة، وهذا أسوأ ما يمكن أن يحدث في المحادثة.",
  ].join("\n");
}
