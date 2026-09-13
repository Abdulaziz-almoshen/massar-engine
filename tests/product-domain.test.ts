// Unit tests for the «المنتجات» business tier (Technical Standards §4).
//
// FIRST: pure functions, no IO, no clock, no randomness. Each test pins a rule the screens and
// the assistant's runtime both depend on — the readiness word in particular, which must agree
// with what POST /admin/campaign/launch refuses.

import { describe, it, expect } from "vitest";
import {
  EMBEDDED_PRODUCTS,
  PRODUCT_DOMAIN_JS,
  RESERVED_SECTIONS,
  changeSummary,
  checkProductDomainClosure,
  targetCoveragePct,
  isEmbeddedProduct,
  isRuntimeEligible,
  kbStateOf,
  normalizeProductName,
  priceSummary,
  readinessOf,
} from "../src/product-domain.js";

describe("normalizeProductName — the one name rule", () => {
  it("collapses whitespace and trims", () => {
    expect(normalizeProductName("  صحة   أعمال \t Plus  ")).toEqual({ ok: true, name: "صحة أعمال Plus" });
  });
  it("refuses an empty or whitespace-only name", () => {
    expect(normalizeProductName("")).toMatchObject({ ok: false, code: "empty" });
    expect(normalizeProductName("   ")).toMatchObject({ ok: false, code: "empty" });
    expect(normalizeProductName(null)).toMatchObject({ ok: false, code: "empty" });
    expect(normalizeProductName(undefined)).toMatchObject({ ok: false, code: "empty" });
  });
  it("accepts exactly 60 characters and refuses 61", () => {
    expect(normalizeProductName("م".repeat(60))).toMatchObject({ ok: true });
    expect(normalizeProductName("م".repeat(61))).toMatchObject({ ok: false, code: "too_long" });
    // length is measured AFTER collapsing: 61 chars with a double space inside is 60
    expect(normalizeProductName("م".repeat(30) + "  " + "م".repeat(29))).toMatchObject({ ok: true });
  });
  it("refuses the __ pseudo-product namespace", () => {
    expect(normalizeProductName("__skill__")).toMatchObject({ ok: false, code: "reserved_prefix" });
    expect(normalizeProductName("  __x")).toMatchObject({ ok: false, code: "reserved_prefix" });
    expect(normalizeProductName("_x")).toMatchObject({ ok: true, name: "_x" });
  });
  it("refuses # ? % which break the hash route", () => {
    for (const ch of ["#", "?", "%"]) {
      expect(normalizeProductName("منتج " + ch + " جديد")).toMatchObject({ ok: false, code: "invalid_chars" });
    }
  });
  it("refuses a name whose last / segment is a reserved section word", () => {
    for (const s of RESERVED_SECTIONS) {
      expect(normalizeProductName("منتج/" + s)).toMatchObject({ ok: false, code: "reserved_segment" });
      expect(normalizeProductName("منتج / " + s.toUpperCase())).toMatchObject({ ok: false, code: "reserved_segment" });
    }
  });
  it("keeps names with «/» whose last segment is not reserved — HIS/ERP stays valid", () => {
    expect(normalizeProductName("تكامل الأنظمة (HIS/ERP)")).toEqual({ ok: true, name: "تكامل الأنظمة (HIS/ERP)" });
    expect(normalizeProductName("a/b/c")).toEqual({ ok: true, name: "a/b/c" });
  });
  it("a bare reserved word with no slash is a valid name", () => {
    expect(normalizeProductName("pricing")).toEqual({ ok: true, name: "pricing" });
  });
  it("every production name passes", () => {
    for (const n of EMBEDDED_PRODUCTS) expect(normalizeProductName(n)).toEqual({ ok: true, name: n });
  });
  it("carries an Arabic reason for the screen", () => {
    const r = normalizeProductName("__x");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/محجوزة/);
  });
});

describe("kbStateOf", () => {
  it("none / legacy / approved", () => {
    expect(kbStateOf("", null)).toBe("none");
    expect(kbStateOf(null, 1)).toBe("none");
    expect(kbStateOf("  \n ", 1)).toBe("none");
    expect(kbStateOf("# نص", null)).toBe("legacy");
    expect(kbStateOf("# نص", undefined)).toBe("legacy");
    expect(kbStateOf("# نص", 1788000000000)).toBe("approved");
  });
});

describe("isRuntimeEligible — truth table (spec B′)", () => {
  const cases: [boolean, boolean, string, boolean, boolean][] = [
    // exists, archived, kbState, embedded → eligible
    [false, false, "approved", true, false],
    [true, true, "approved", true, false],
    [true, false, "approved", false, true],
    [true, false, "approved", true, true],
    [true, false, "legacy", false, false],   // A′: legacy text is NOT used until approved
    [true, false, "legacy", true, true],
    [true, false, "none", false, false],
    [true, false, "none", true, true],
  ];
  for (const [exists, archived, kbState, embedded, want] of cases) {
    it(`exists=${exists} archived=${archived} kb=${kbState} embedded=${embedded} → ${want}`, () => {
      expect(isRuntimeEligible({ exists, archived, kbState, embedded })).toBe(want);
    });
  }
});

describe("readinessOf — the word follows eligibility first", () => {
  const base = { archived: false, kbState: "approved", hasDraft: false, embedded: false, hasAsset: true, hasPrice: true, eligible: true };
  it("all four cells done → «جاهز للمساعد»", () => {
    const r = readinessOf({ ...base, embedded: true });
    expect(r.word).toBe("جاهز للمساعد");
    expect(r.eligible).toBe(true);
    expect(r.reason).toBeNull();
    expect(r.cells.map((c) => c.state)).toEqual(["done", "done", "done", "done"]);
    expect(r.cells.map((c) => c.key)).toEqual(["knowledge", "asset", "price", "lock"]);
  });
  it("eligible, no asset → «يبيعه المساعد · ينقصه ملف تعريفي»", () => {
    expect(readinessOf({ ...base, hasAsset: false, embedded: true }).word).toBe("يبيعه المساعد · ينقصه ملف تعريفي");
  });
  it("eligible, no price → «يبيعه المساعد · ينقصه سعر منشور»", () => {
    expect(readinessOf({ ...base, hasPrice: false, embedded: true }).word).toBe("يبيعه المساعد · ينقصه سعر منشور");
  });
  it("eligible, not in the assistant catalogue → «ينقصه تحديث كتالوج المساعد»", () => {
    const r = readinessOf({ ...base, embedded: false });
    expect(r.word).toBe("يبيعه المساعد · ينقصه تحديث كتالوج المساعد");
    expect(r.cells[3].state).toBe("missing");
  });
  it("embedded-only (no approved document) is eligible and owed «ملف المعرفة» first", () => {
    const r = readinessOf({ ...base, kbState: "none", embedded: true, hasAsset: false });
    expect(r.word).toBe("يبيعه المساعد · ينقصه ملف المعرفة");
    expect(r.cells[0].state).toBe("missing");
  });
  it("not eligible, no knowledge → «لا يبيعه المساعد · بلا معرفة معتمدة»", () => {
    const r = readinessOf({ ...base, kbState: "none", eligible: false });
    expect(r.word).toBe("لا يبيعه المساعد · بلا معرفة معتمدة");
    expect(r.reason).toBe("بلا معرفة معتمدة");
    expect(r.eligible).toBe(false);
  });
  it("not eligible, draft pending → «مسودة بانتظار الاعتماد» and a pending cell", () => {
    const r = readinessOf({ ...base, kbState: "none", hasDraft: true, eligible: false });
    expect(r.word).toBe("لا يبيعه المساعد · مسودة بانتظار الاعتماد");
    expect(r.cells[0].state).toBe("pending");
  });
  it("not eligible, legacy text → «بانتظار اعتماد النص الحالي»", () => {
    expect(readinessOf({ ...base, kbState: "legacy", eligible: false }).word)
      .toBe("لا يبيعه المساعد · بانتظار اعتماد النص الحالي");
  });
  it("archived wins over every other reason", () => {
    const r = readinessOf({ ...base, archived: true, hasDraft: true, kbState: "none", eligible: false });
    expect(r.word).toBe("لا يبيعه المساعد · مؤرشف");
  });
  it("a draft over an approved text keeps the knowledge cell done", () => {
    const r = readinessOf({ ...base, hasDraft: true, embedded: true });
    expect(r.cells[0].state).toBe("done");
    expect(r.word).toBe("جاهز للمساعد");
  });
  it("load failure is never a ready state", () => {
    const r = readinessOf({ ...base, embedded: true, loadFailed: true });
    expect(r.word).toBe("تعذّر التحقق");
    expect(r.eligible).toBe(false);
  });
});

describe("targetCoveragePct — null, never «٠٪» over no target", () => {
  it("null when target is null, 0, negative or NaN", () => {
    expect(targetCoveragePct(100, null)).toBeNull();
    expect(targetCoveragePct(100, undefined)).toBeNull();
    expect(targetCoveragePct(100, 0)).toBeNull();
    expect(targetCoveragePct(100, -5)).toBeNull();
    expect(targetCoveragePct(100, "x")).toBeNull();
  });
  it("rounds to a whole percent and tolerates a missing achieved", () => {
    expect(targetCoveragePct(34000, 34000)).toBe(100);
    expect(targetCoveragePct(1, 3)).toBe(33);
    expect(targetCoveragePct(0, 500)).toBe(0);
    expect(targetCoveragePct(null, 500)).toBe(0);
    expect(targetCoveragePct(1000, 500)).toBe(200);
  });
});

describe("priceSummary", () => {
  it("the lowest live package leads, with the count", () => {
    const r = priceSummary([
      { name: "باقة المؤسسات", listPrice: 95000, years: 1 },
      { name: "الباقة القياسية", listPrice: 18000, years: 1 },
    ], "ignored when packages exist");
    expect(r).toEqual({ kind: "package", lowest: { name: "الباقة القياسية", listPrice: 18000, years: 1 }, count: 2 });
  });
  it("falls back to the pricing note, then to none", () => {
    expect(priceSummary([], "يحدده المختص")).toEqual({ kind: "note", count: 0 });
    expect(priceSummary(null, "  ")).toEqual({ kind: "none", count: 0 });
    expect(priceSummary(undefined, null)).toEqual({ kind: "none", count: 0 });
  });
});

describe("changeSummary", () => {
  it("counts added and removed lines as a multiset, ignoring order and blanks", () => {
    expect(changeSummary("a\nb\nc", "c\nb\na")).toEqual({ added: 0, removed: 0 });
    expect(changeSummary("a\n\nb", "a\nb\nb\nd")).toEqual({ added: 2, removed: 0 });
    expect(changeSummary("a\nb\nc", "a")).toEqual({ added: 0, removed: 2 });
    expect(changeSummary("", "x\ny")).toEqual({ added: 2, removed: 0 });
    expect(changeSummary(null, null)).toEqual({ added: 0, removed: 0 });
  });
});

describe("the browser seam", () => {
  it("isEmbeddedProduct reads the injected constant", () => {
    expect(isEmbeddedProduct("الإجازات المرضية")).toBe(true);
    expect(isEmbeddedProduct("صحة أعمال Plus")).toBe(false);
  });
  it("every shipped function is self-contained", () => {
    expect(checkProductDomainClosure()).toEqual([]);
  });
  it("PRODUCT_DOMAIN_JS evaluates in a bare scope and answers like Node", () => {
    const api = new Function(PRODUCT_DOMAIN_JS + "\nreturn { normalizeProductName, readinessOf, isRuntimeEligible, targetCoveragePct, priceSummary, EMBEDDED_PRODUCTS, RESERVED_SECTIONS };")();
    expect(api.normalizeProductName("  x  ")).toEqual({ ok: true, name: "x" });
    expect(api.isRuntimeEligible({ exists: true, archived: false, kbState: "legacy", embedded: false })).toBe(false);
    expect(api.targetCoveragePct(1, 0)).toBeNull();
    expect(api.EMBEDDED_PRODUCTS).toEqual([...EMBEDDED_PRODUCTS]);
    expect(api.RESERVED_SECTIONS).toEqual([...RESERVED_SECTIONS]);
    expect(api.readinessOf({ archived: false, kbState: "none", hasDraft: false, embedded: false, hasAsset: false, hasPrice: false, eligible: false }).word)
      .toBe("لا يبيعه المساعد · بلا معرفة معتمدة");
  });
  it("contains no backtick — it is interpolated into a template literal", () => {
    expect(PRODUCT_DOMAIN_JS.includes("`")).toBe(false);
  });
});
