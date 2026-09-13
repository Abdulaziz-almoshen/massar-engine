// product-domain.ts — THE BUSINESS TIER for «المنتجات».
//
// WHY THIS FILE EXISTS. The products section answers one question the assistant's behaviour
// depends on — «does the assistant sell this product right now?» — and before V5 that answer was
// derived four different ways: the wizard read a registry built from the dashboard's own product
// list, the record read a readiness score over kb/asset/campaign booleans, the agent read every
// product_kb row into every prompt, and the launch endpoint checked nothing. Four answers to one
// question is how a product with a draft nobody approved reached a customer conversation.
//
// ONE RULE, EVERY RUNTIME. `isRuntimeEligible` is the single definition (spec B′), and every path
// that can put a product in front of a customer — prompt knowledge, composition, asset selection,
// campaign launch — asks it. The browser needs the same rule to draw the readiness word, so the
// functions ship to the page via `PRODUCT_DOMAIN_JS` exactly as opps-domain.ts ships its rules:
// Function.prototype.toString() of what tsc emitted, so the page runs what the tests exercised.
//
// CONSTRAINT, load-bearing: every function in DOMAIN_FNS is SELF-CONTAINED — its own parameters,
// the two injected constants, and shared JS globals. No imports, no module state, no helper that
// is not itself in DOMAIN_FNS. A reference that resolves in Node and not in the browser is a blank
// page (ADR-0001), and `checkProductDomainClosure()` asserts against it.

import { SERVICE_CATALOGUE } from "./insights.js";

/** The last `/` segment of a `#product/<name>/<section>` route that means a SECTION, not a name.
 *  Product names contain «/» («تكامل الأنظمة (HIS/ERP)»), so the parser can only tell a section
 *  from a name by this list — which is why a name may not END in one of these words. */
export const RESERVED_SECTIONS: readonly string[] = ["performance", "pricing", "targets", "knowledge"];

/** The six products whose pitch, FAQ and objections are coded in agent.ts PRODUCTS. Their
 *  knowledge reaches the assistant without a product_kb row, which makes them eligible with no
 *  approved document — and un-renameable, un-archivable, until that coupling is migrated. */
export const EMBEDDED_PRODUCTS: readonly string[] = SERVICE_CATALOGUE as readonly string[];

export type KbState = "approved" | "legacy" | "none";

export type NameResult =
  | { ok: true; name: string }
  | { ok: false; code: string; reason: string };

export type ReadinessCell = {
  key: "knowledge" | "asset" | "price" | "lock";
  state: "done" | "missing" | "pending";
};

export type Readiness = {
  cells: ReadinessCell[];
  eligible: boolean;
  word: string;
  reason: string | null;
};

// ---------------------------------------------------------------------------
// THE RULES. Self-contained by contract (see the header) — shipped to the browser verbatim.
// ---------------------------------------------------------------------------

/**
 * The ONE name rule, used by create, by `POST /admin/tags` and by rename — and by the drawer
 * before it sends. Whitespace collapses because two names differing only by a double space are
 * one product to a human and two rows to Postgres; `#`, `?` and `%` break the hash route; a
 * leading `__` is the pseudo-product namespace (`__skill__`); and a last segment naming a section
 * would make `#product/<name>` unparseable (see RESERVED_SECTIONS).
 */
export function normalizeProductName(raw: unknown): NameResult {
  const name = String(raw == null ? "" : raw).replace(/\s+/g, " ").trim();
  if (!name) return { ok: false, code: "empty", reason: "اسم المنتج مطلوب" };
  if (name.length > 60) return { ok: false, code: "too_long", reason: "الاسم أطول من 60 حرفًا" };
  if (name.slice(0, 2) === "__") return { ok: false, code: "reserved_prefix", reason: "الأسماء التي تبدأ بـ __ محجوزة للنظام" };
  if (/[#?%]/.test(name)) return { ok: false, code: "invalid_chars", reason: "لا يمكن أن يحتوي الاسم على # أو ? أو %" };
  const segments = name.split("/");
  const last = segments[segments.length - 1].trim().toLowerCase();
  if (segments.length > 1 && RESERVED_SECTIONS.indexOf(last) !== -1) {
    return { ok: false, code: "reserved_segment", reason: "لا يمكن أن ينتهي الاسم بكلمة قسم محجوزة: " + last };
  }
  return { ok: true, name };
}

export function isEmbeddedProduct(name: string): boolean {
  return EMBEDDED_PRODUCTS.indexOf(String(name || "")) !== -1;
}

/** What a product_kb row means to the assistant. `legacy` (text present, nobody recorded approving
 *  it) is NOT used — spec A′: no unapproved text reaches the assistant, and no provenance is
 *  manufactured for text that was live before approval existed. */
export function kbStateOf(md: unknown, approvedAt: unknown): KbState {
  const hasText = String(md == null ? "" : md).trim() !== "";
  if (!hasText) return "none";
  return approvedAt == null ? "legacy" : "approved";
}

/**
 * THE eligibility rule (spec B′). A product the assistant may sell exists as a tag, is not
 * archived, and has knowledge the assistant is allowed to read: an approved document, or the
 * embedded catalogue entry that ships by code review. Nothing else counts — not a legacy row, not
 * a draft, not a PDF on its own.
 */
export function isRuntimeEligible(p: { exists: boolean; archived: boolean; kbState: string; embedded: boolean }): boolean {
  if (!p.exists) return false;
  if (p.archived) return false;
  return p.kbState === "approved" || Boolean(p.embedded);
}

/**
 * The four readiness cells and the ONE word beside them (spec B). The word is derived from runtime
 * eligibility FIRST, so it can never read «جاهز» for a product the assistant refuses — the list,
 * the record and the wizard all print this and must agree with the launch endpoint.
 *
 * `eligible` is passed in rather than recomputed because the server derives it from the agent's
 * LIVE knowledge list (enforced truth), and the word must describe that, not a re-derivation.
 */
export function readinessOf(p: {
  archived: boolean; kbState: string; hasDraft: boolean; embedded: boolean;
  hasAsset: boolean; hasPrice: boolean; eligible: boolean; loadFailed?: boolean;
}): Readiness {
  const approved = p.kbState === "approved";
  const cells: ReadinessCell[] = [
    { key: "knowledge", state: approved ? "done" : (p.hasDraft ? "pending" : "missing") },
    { key: "asset", state: p.hasAsset ? "done" : "missing" },
    { key: "price", state: p.hasPrice ? "done" : "missing" },
    { key: "lock", state: p.embedded ? "done" : "missing" },
  ];
  if (p.loadFailed) return { cells, eligible: false, word: "تعذّر التحقق", reason: null };
  if (!p.eligible) {
    let reason = "بلا معرفة معتمدة";
    if (p.archived) reason = "مؤرشف";
    else if (p.hasDraft && !approved) reason = "مسودة بانتظار الاعتماد";
    else if (p.kbState === "legacy") reason = "بانتظار اعتماد النص الحالي";
    return { cells, eligible: false, word: "لا يبيعه المساعد · " + reason, reason };
  }
  // Eligible. The first gap in cell order names what is still owed; an embedded product with no
  // approved document is eligible (its knowledge is in code) and still owed a knowledge file.
  let gap: string | null = null;
  if (!approved) gap = "ملف المعرفة";
  else if (!p.hasAsset) gap = "ملف تعريفي";
  else if (!p.hasPrice) gap = "سعر منشور";
  else if (!p.embedded) gap = "تحديث كتالوج المساعد";
  if (gap !== null) return { cells, eligible: true, word: "يبيعه المساعد · ينقصه " + gap, reason: gap };
  return { cells, eligible: true, word: "جاهز للمساعد", reason: null };
}

/** null, not 0. «بلا مستهدف» must never render as «0٪» — a product nobody set a target for has no
 *  coverage, which is not zero coverage. */
export function targetCoveragePct(achieved: unknown, target: unknown): number | null {
  const t = Number(target);
  if (target == null || !Number.isFinite(t) || t <= 0) return null;
  const a = Number(achieved) || 0;
  return Math.round((a / t) * 100);
}

/**
 * What the price cell shows: the lowest live package when one exists, else the pricing note
 * («يحدده المختص»), else nothing — and «nothing» is printed as such, never as a zero.
 */
export function priceSummary(
  packages: readonly { name: string; listPrice: number; years: number }[] | null | undefined,
  pricingNote: string | null | undefined,
): { kind: "package" | "note" | "none"; lowest?: { name: string; listPrice: number; years: number }; count: number } {
  const list = Array.isArray(packages) ? packages : [];
  if (list.length) {
    let lowest = list[0];
    for (let i = 1; i < list.length; i++) {
      if (Number(list[i].listPrice) < Number(lowest.listPrice)) lowest = list[i];
    }
    return {
      kind: "package",
      lowest: { name: String(lowest.name), listPrice: Number(lowest.listPrice) || 0, years: Number(lowest.years) || 1 },
      count: list.length,
    };
  }
  if (String(pricingNote || "").trim()) return { kind: "note", count: 0 };
  return { kind: "none", count: 0 };
}

/**
 * «+N سطرًا · −M سطرًا» — a line-multiset diff between the approved text and a draft, so the
 * reviewer sees the SIZE of a change before approving it. Not a real diff: order is ignored, and
 * a moved line counts as nothing, which is the honest answer for a reviewer deciding whether to
 * open the full text.
 */
export function changeSummary(oldMd: unknown, newMd: unknown): { added: number; removed: number } {
  const count = (text: unknown): Record<string, number> => {
    const out: Record<string, number> = {};
    const lines = String(text == null ? "" : text).split("\n");
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i].trim();
      if (!ln) continue;
      out[ln] = (out[ln] || 0) + 1;
    }
    return out;
  };
  const before = count(oldMd);
  const after = count(newMd);
  let added = 0;
  let removed = 0;
  for (const k in after) added += Math.max(0, after[k] - (before[k] || 0));
  for (const k in before) removed += Math.max(0, before[k] - (after[k] || 0));
  return { added, removed };
}

// ---------------------------------------------------------------------------
// The seam that carries all of the above into the browser.
// ---------------------------------------------------------------------------

const DOMAIN_FNS = [
  normalizeProductName, isEmbeddedProduct, kbStateOf, isRuntimeEligible, readinessOf,
  targetCoveragePct, priceSummary, changeSummary,
] as const;

/** The compiled source of the constants and rules above, as one script the dashboard
 *  interpolates. What the test asserts in Node is byte-for-byte what the page runs. */
export const PRODUCT_DOMAIN_JS: string = [
  "/* ===== product-domain (generated from src/product-domain.ts — do not edit here) ===== */",
  "var RESERVED_SECTIONS = " + JSON.stringify(RESERVED_SECTIONS) + ";",
  "var EMBEDDED_PRODUCTS = " + JSON.stringify(EMBEDDED_PRODUCTS) + ";",
  ...DOMAIN_FNS.map((fn) => fn.toString()),
].join("\n");

/**
 * BOOT/TEST ASSERTION for the constraint that cannot be typed: every shipped function resolves
 * only against its parameters, the two constants and shared globals. Returns the offending names
 * so the caller decides whether to stop or shout. Same scanner as opps-domain's, kept separate on
 * purpose — the two files must not depend on each other's DOMAIN_FNS.
 */
export function checkProductDomainClosure(): string[] {
  const provided = new Set<string>([
    "RESERVED_SECTIONS", "EMBEDDED_PRODUCTS",
    ...DOMAIN_FNS.map((fn) => fn.name),
    "Number", "Math", "String", "Boolean", "Array", "Object", "JSON", "Date", "isNaN",
  ]);
  const problems: string[] = [];
  for (const fn of DOMAIN_FNS) {
    const source = fn.toString();
    const body = source
      .slice(source.indexOf("{"))
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\/\/[^\n]*/g, " ")
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      .replace(/'(?:[^'\\]|\\.)*'/g, "''")
      .replace(/`(?:[^`\\]|\\.)*`/g, "``")
      // regex literals: their contents are not identifiers either
      .replace(/\/(?:[^\/\\\n]|\\.)+\/[gimsuy]*/g, '""');
    // The whole identifier, or nothing: without `(?![\w$]…)` the lookahead lets `count:` match as
    // `coun`, and the scanner reports a truncated name that is a false alarm every time.
    const identifiers = body.match(/(?<![.\w$])[A-Za-z_$][\w$]*(?![\w$]|\s*:)/g) ?? [];
    for (const name of identifiers) {
      if (RESERVED.has(name) || provided.has(name)) continue;
      const header = source.slice(0, source.indexOf("{"));
      if (header.includes(name)) continue;
      if (new RegExp("(?:var|let|const)\\s+" + name + "\\b").test(body)) continue;
      // a parameter of an inner arrow or a `for (const k in …)` binding
      if (new RegExp("\\(\\s*" + name + "\\s*\\)\\s*=>|\\b" + name + "\\s*=>").test(body)) continue;
      problems.push(fn.name + " → " + name);
    }
  }
  return problems;
}

const RESERVED = new Set<string>([
  "return", "if", "else", "for", "of", "in", "let", "const", "var", "function", "true", "false",
  "null", "undefined", "typeof", "new", "this", "break", "continue", "while", "do", "switch",
  "case", "default", "throw", "try", "catch", "finally", "void", "delete", "instanceof",
]);
