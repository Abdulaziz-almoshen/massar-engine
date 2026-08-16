// Product lock — the active product context for a conversation.
//
// Founder review, 2026-08-16: «customer asked about NVR, but the agent sent Sick Leave material.
// This should never happen.» It happened because send_asset resolved the file with
// `x.product.includes(key)` — a loose substring match against whatever string the model passed,
// with no reference to what the conversation was actually about. A prompt line cannot stop the
// wrong PDF leaving; the check has to sit on the send path. (CLAUDE.md §4: hard rules live in
// code, never only in prompts.)
//
// Rule: once a product is established, every attachment, price, feature and question stays scoped
// to it until the CUSTOMER explicitly changes product. The customer moves the lock; we never do.
import type { Contact } from "./tracker.js";
import { SERVICE_CATALOGUE, OTHER_SERVICE, canonicalService } from "./insights.js";

const CATALOGUE = SERVICE_CATALOGUE as readonly string[];

/** Vaccination registry is the founder's «NVR» and appears under several names in real
 *  transcripts. Anchored to the catalogue entry it belongs to. */
const NVR = "خدمات التطعيمات";
const EXTRA_PATTERNS: [RegExp, string][] = [
  [/\bNVR\b/i, NVR],
  [/السجل\s*الوطني|سجل\s*التطعيم|التطعيم/, NVR],
];

// Integration is CROSS-CUTTING: it is the thing we sell for every product, so «تفاصيل التكامل»
// — one of our own button titles — is a request ABOUT the current product, not a switch to a
// different one. Falling through to canonicalService() classified that tap as the integration
// product and moved the lock off NVR, which is the founder's exact complaint in a new place.
// It may only lock when the customer names the full catalogue entry.
const INTEGRATION = "تكامل الأنظمة (HIS/ERP)";

/** What product is this text about? Returns a catalogue name, or null when it names none. */
export function productOf(text: string): string | null {
  const s = String(text || "");
  if (!s.trim()) return null;
  for (const name of CATALOGUE) if (s.includes(name)) return name;
  for (const [re, name] of EXTRA_PATTERNS) if (re.test(s)) return name;
  const norm = canonicalService(s);
  if (!norm || norm === OTHER_SERVICE) return null;
  // Reached only by pattern inference. Integration needs its full name, handled above.
  return norm === INTEGRATION ? null : norm;
}

/**
 * The product this conversation is currently about, or null when none is established.
 *
 * The CUSTOMER owns the lock. We read their turns newest-first, because an explicit mention is
 * how they change product — that is the only thing that may move it. Our own turns are read only
 * as a fallback, so a campaign opener about NVR establishes NVR before the customer has named it.
 * Tags are the weakest signal and come last: a tag can be stale or model-written.
 */
export function activeProduct(contact: Contact): string | null {
  const turns = contact.transcript || [];
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i];
    if (t?.role !== "customer") continue;
    const p = productOf(t.text);
    if (p) return p;
  }
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i];
    if (t?.role !== "agent") continue;
    const p = productOf(t.text);
    if (p) return p;
  }
  const tag = (contact.tags || []).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0))[0];
  return tag ? productOf(tag.product) : null;
}

/**
 * May we send material for `candidate` in this conversation?
 *
 * Returns null when allowed, or the reason it is blocked. Blocks ONLY on a real mismatch: with no
 * active product, or a candidate we cannot classify, the send proceeds — this guard exists to stop
 * a confident wrong send, not to become a second way for the agent to go silent.
 */
export function blockedProduct(contact: Contact, candidate: string): string | null {
  const active = activeProduct(contact);
  if (!active) return null;
  const want = productOf(candidate) ?? (CATALOGUE.includes(candidate) ? candidate : null);
  if (!want) return null;
  return want === active ? null : active;
}
