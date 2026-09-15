import { describe, it, expect } from "vitest";
import {
  checkIndicator, checkMemberCount, indicatorFreshness, isIsoDate, isIndicatorUsable, foldArabicName,
  rowsFromGrid, gridFromText, matchRows, entityCodeOf, suggestOpportunities, suggestionKey,
  checkRepeatTargeting, checkIndicatorDomainClosure, INDICATOR_DOMAIN_JS, isDuplicateIndicatorName,
  type RuleContext, type RuleIndicator,
} from "../src/indicator-domain.js";

const PRODUCTS = ["الإجازات المرضية", "تكامل الأنظمة (HIS/ERP)", "فحص الموظفين"];
const TODAY = "2026-09-15";

describe("the indicator form", () => {
  it("accepts a complete indicator and cleans it", () => {
    const r = checkIndicator({ name: "  استخدام   مرتفع ", product: "الإجازات المرضية", signal: "high_usage", customerType: "medical", status: "active", periodFrom: "2026-04-01", periodTo: "2026-06-30", dataUpdatedAt: "2026-08-20" }, PRODUCTS, TODAY, false);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toMatchObject({ name: "استخدام مرتفع", status: "active", signal: "high_usage", periodTo: "2026-06-30" });
  });
  it("names the field it refuses", () => {
    const bad = (input: object, draft = false) => { const r = checkIndicator(input, PRODUCTS, TODAY, draft); return r.ok ? "ok" : r.field; };
    expect(bad({ product: "الإجازات المرضية" })).toBe("name");
    expect(bad({ name: "x" })).toBe("product");
    expect(bad({ name: "x", product: "منتج لا يوجد" })).toBe("product");
    expect(bad({ name: "x", product: "الإجازات المرضية", signal: "vibes" })).toBe("signal");
    expect(bad({ name: "x", product: "الإجازات المرضية" })).toBe("signal");
    expect(bad({ name: "x", product: "الإجازات المرضية", signal: "uses", periodFrom: "2026-02-31" })).toBe("periodFrom");
    expect(bad({ name: "x", product: "الإجازات المرضية", signal: "uses", periodFrom: "2026-07-01", periodTo: "2026-06-01" })).toBe("periodTo");
    expect(bad({ name: "x", product: "الإجازات المرضية", signal: "uses", dataUpdatedAt: "2026-12-01" })).toBe("dataUpdatedAt");
    expect(bad({ name: "a".repeat(81), product: "الإجازات المرضية" })).toBe("name");
  });
  it("lets a draft stop halfway, but not without a name", () => {
    expect(checkIndicator({ name: "مسودة" }, PRODUCTS, TODAY, true)).toMatchObject({ ok: true, value: { status: "draft", product: null } });
    expect(checkIndicator({}, PRODUCTS, TODAY, true).ok).toBe(false);
  });
  it("never saves a non-draft as draft, and never invents the data date", () => {
    const r = checkIndicator({ name: "x", product: "فحص الموظفين", signal: "uses", status: "draft", dataUpdatedAt: "2026-09-01" }, PRODUCTS, TODAY, false);
    expect(r).toMatchObject({ ok: true, value: { status: "active", dataUpdatedAt: "2026-09-01" } });
    expect(checkIndicator({ name: "x", product: "فحص الموظفين", signal: "uses" }, PRODUCTS, TODAY, false)).toMatchObject({ ok: false, field: "dataUpdatedAt" });
    expect(checkIndicator({ name: "x" }, PRODUCTS, TODAY, true)).toMatchObject({ ok: true, value: { dataUpdatedAt: TODAY } });
  });
  it("requires a customer on a saved indicator only", () => {
    expect(checkMemberCount(0, false).ok).toBe(false);
    expect(checkMemberCount(0, true).ok).toBe(true);
    expect(checkMemberCount(5001, true).ok).toBe(false);
  });
  it("reads dates and freshness exactly", () => {
    expect(isIsoDate("2026-09-15")).toBe(true);
    expect(isIsoDate("15/09/2026")).toBe(false);
    expect(indicatorFreshness("2026-06-01", TODAY)).toEqual({ days: 106, stale: true });
    expect(indicatorFreshness("2026-09-01", TODAY)).toEqual({ days: 14, stale: false });
    expect(indicatorFreshness("bad", TODAY)).toEqual({ days: null, stale: false });
  });
  it("feeds recommendations from active indicators only (BRULE-012)", () => {
    expect(isIndicatorUsable("active")).toBe(true);
    expect(isIndicatorUsable("inactive")).toBe(false);
    expect(isIndicatorUsable("draft")).toBe(false);
  });
  it("serialises into the page without a reference the page lacks", () => {
    expect(checkIndicatorDomainClosure()).toEqual([]);
    const page = new Function(INDICATOR_DOMAIN_JS + "; return checkIndicator;")();
    expect(page({ name: "x", product: "فحص الموظفين", signal: "uses", dataUpdatedAt: TODAY }, PRODUCTS, TODAY, false).ok).toBe(true);
    expect(page({ name: "x", product: "فحص الموظفين" }, PRODUCTS, TODAY, false).field).toBe("signal");
    expect(page({ name: "x" }, PRODUCTS, TODAY, false).reason).toBe("اختر المنتج المرتبط.");
  });
});

describe("uploaded rows find their customers (BR-IND-003)", () => {
  const ents = [
    { id: 1, name: "مجمع النور الطبي", phone: "966512345678", code: "C-1042" },
    { id: 2, name: "مستشفى الحياة", phone: "966598765432" },
    { id: 3, name: "مستشفى الحياة", phone: "966500000003" },
    { id: 4, name: "مختبرات الدقة المتقدمة", phone: "966500000004" },
  ];
  it("folds the spellings one clinic is typed in", () => {
    expect(foldArabicName("مُستشفَى الحيـاة")).toBe(foldArabicName("مستشفي الحياه"));
    expect(foldArabicName("أإآ")).toBe("ااا");
  });
  it("reads a header in any order, and the prototype order without one", () => {
    const withHeader = rowsFromGrid([["القيمة", "اسم العميل", "الجوال"], ["87%", "مجمع النور الطبي", "0512345678"]]);
    expect(withHeader.headerFound).toBe(true);
    expect(withHeader.rows[0]).toMatchObject({ name: "مجمع النور الطبي", value: "87%", phone: "0512345678", line: 2 });
    const bare = rowsFromGrid(gridFromText("مستشفى الحياة,C-1077,64%,الربع 2 2026,\n\n"));
    const withPhone = rowsFromGrid(gridFromText("عيادة,C-1,0500000810,87%,Q2,ملاحظة")).rows[0];
    expect(withPhone).toMatchObject({ code: "C-1", phone: "0500000810", value: "87%", period: "Q2", note: "ملاحظة" });
    expect(rowsFromGrid([["اسم العميل"], ["مجمع النور الطبي (مثال — امسح هذا الصف)"], ["عيادة"]]).rows.map((r) => r.name)).toEqual(["عيادة"]);
    expect(bare.headerFound).toBe(false);
    expect(bare.rows).toHaveLength(1);
    expect(bare.rows[0]).toMatchObject({ code: "C-1077", value: "64%", period: "الربع 2 2026" });
  });
  it("matches by phone, then code, then exact name — and never picks between two", () => {
    const rows = rowsFromGrid([["اسم العميل", "المعرف", "الجوال"],
      ["اسم مختلف", "", "0512345678"], ["", "c-1042", ""], ["مجمع النور الطبى", "", ""],
      ["مستشفى الحياة", "", ""], ["مختبرات الدقة", "", ""], ["عيادة لا توجد", "", ""]]).rows;
    const m = matchRows(rows, ents);
    expect(m.map((r) => r.status)).toEqual(["matched", "matched", "matched", "review", "review", "unmatched"]);
    expect(m.map((r) => r.by)).toEqual(["phone", "code", "name", null, null, null]);
    expect(m[3].candidates.map((c) => c.id)).toEqual([2, 3]);
    expect(m[4].candidates.map((c) => c.id)).toEqual([4]);
  });
  it("sends a code two customers share to review instead of picking one", () => {
    const m = matchRows(rowsFromGrid([["اسم العميل", "المعرف"], ["x", "C-7"]]).rows,
      [{ id: 1, name: "أ", phone: "966500000001", code: "C-7" }, { id: 2, name: "ب", phone: "966500000002", code: "c-7" }]);
    expect(m[0]).toMatchObject({ status: "review", entityId: null });
    expect(m[0].candidates.map((c) => c.id)).toEqual([1, 2]);
  });
  it("refuses a second indicator with the same name as a human would read it", () => {
    const list = [{ id: 1, name: "مستشفى الحياة" }];
    expect(isDuplicateIndicatorName("مستشفي الحياه ", list, 0)).toBe(true);
    expect(isDuplicateIndicatorName("مستشفى الحياة", list, 1)).toBe(false);
    expect(isDuplicateIndicatorName("غيره", list, 0)).toBe(false);
  });
  it("finds a code a customer record already carries", () => {
    expect(entityCodeOf({ "رقم العميل": " C-9 " })).toBe("C-9");
    expect(entityCodeOf({ "المدينة": "الرياض" })).toBe(null);
  });
});

describe("indicators become explainable campaign opportunities (BR-IND-007/008)", () => {
  const ind = (id: number, over: Partial<RuleIndicator>): RuleIndicator => ({
    id, name: "مؤشر " + id, product: "الإجازات المرضية", signal: "other", status: "active", dataUpdatedAt: "2026-09-01", memberIds: [], ...over,
  });
  const entities = [1, 2, 3, 4, 5, 6].map((id) => ({ id, name: "عميل " + id, phone: "96650000000" + id }));
  const base = (over: Partial<RuleContext>): RuleContext => ({
    indicators: [], entities,
    products: [
      { name: "الإجازات المرضية", sector: "الصحة", eligible: true },
      { name: "فحص الموظفين", sector: "الصحة", eligible: true },
      { name: "تكامل الأنظمة (HIS/ERP)", sector: null, eligible: false, why: "بلا معرفة معتمدة" },
    ],
    optedOutPhones: [], recentTargets: [], openOpportunities: [], dismissedKeys: [],
    now: Date.parse("2026-09-15T12:00:00Z"), todayIso: TODAY, suppressionDays: 30, ...over,
  });

  it("high usage minus integrated, with both indicators named and the count after exclusions", () => {
    const s = suggestOpportunities(base({ indicators: [
      ind(1, { name: "استخدام مرتفع", signal: "high_usage", memberIds: [1, 2, 3, 4] }),
      ind(2, { name: "لديهم ربط", signal: "integrated", memberIds: [2] }),
    ], optedOutPhones: ["966500000003"], recentTargets: [{ phone: "966500000004", product: "الإجازات المرضية", at: Date.parse("2026-09-10T00:00:00Z") }] }));
    const top = s.find((x) => x.rule === "usage_without_integration")!;
    expect(top.entityIds).toEqual([1]);
    expect(top.excluded).toEqual({ optedOut: 1, recentlyTargeted: 1, openOpportunity: 0 });
    expect(top.reason).toContain("«استخدام مرتفع»");
    expect(top.reason).toContain("«لديهم ربط»");
    expect(top.indicators.map((i) => i.role)).toEqual(["include", "exclude"]);
    expect(top.key).toBe("usage_without_integration|الإجازات المرضية||");
    expect(suggestionKey("segment", "p", null, [3, 1])).toBe("segment|p||1.3");
  });
  it("takes a ready «high usage without integration» list as it is, minus anyone integrated", () => {
    const s = suggestOpportunities(base({ indicators: [
      ind(1, { name: "بدون HIS", signal: "usage_no_integration", memberIds: [1, 2, 3], customerType: "medical" }),
      ind(2, { name: "مرتبطون", signal: "integrated", memberIds: [3] }),
    ] }));
    const top = s[0];
    expect(top).toMatchObject({ rule: "usage_without_integration", entityIds: [1, 2], segment: "medical" });
    expect(top.reason).not.toContain("فقد يكون");
    expect(s.some((x) => x.rule === "high_usage")).toBe(false);
  });
  it("cross-sells through the other product's non-subscriber list, and never repeats a name in a reason", () => {
    const s = suggestOpportunities(base({ indicators: [
      ind(1, { name: "مشتركون", signal: "uses", memberIds: [1, 2, 3] }),
      ind(2, { name: "مشتركون", signal: "high_usage", memberIds: [2] }),
      ind(3, { product: "فحص الموظفين", signal: "not_using", memberIds: [2, 3, 5] }),
    ] }));
    const cross = s.find((x) => x.rule === "cross_sell")!;
    expect(cross).toMatchObject({ product: "فحص الموظفين", fromProduct: "الإجازات المرضية", entityIds: [2, 3] });
    const hi = s.find((x) => x.rule === "high_usage")!;
    expect((hi.reason.match(/«مشتركون»/g) || []).length).toBe(1);
  });
  it("stays fast at scale: 5,000 customers against 5,000 past targets", () => {
    const N = 5000;
    const big = Array.from({ length: N }, (_, i) => ({ id: i + 1, name: "ع" + i, phone: "9665" + String(10000000 + i) }));
    const t0 = Date.now();
    suggestOpportunities(base({ entities: big,
      indicators: [ind(1, { signal: "high_usage", memberIds: big.map((e) => e.id) }), ind(2, { signal: "integrated", memberIds: [1] }), ind(3, { signal: "not_using", memberIds: big.map((e) => e.id) })],
      recentTargets: big.map((e) => ({ phone: e.phone, product: "فحص الموظفين", at: Date.parse("2026-09-10T00:00:00Z") })) }));
    expect(Date.now() - t0).toBeLessThan(400);
  });
  it("a campaign outside the suppression window does not exclude anyone", () => {
    const s = suggestOpportunities(base({ indicators: [ind(1, { signal: "not_using", memberIds: [5] })],
      recentTargets: [{ phone: "966500000005", product: "الإجازات المرضية", at: Date.parse("2026-07-01T00:00:00Z") }] }));
    expect(s[0]).toMatchObject({ rule: "non_subscribers", count: 1 });
  });
  it("says it cannot know who is integrated when no integration indicator exists", () => {
    const s = suggestOpportunities(base({ indicators: [ind(1, { signal: "high_usage", memberIds: [1] })] }));
    expect(s[0].rule).toBe("high_usage");
    expect(s[0].reason).toContain("فقد يكون بعضهم مرتبطًا");
  });
  it("cross-sells only inside a sector and only with evidence about the other product", () => {
    const noEvidence = suggestOpportunities(base({ indicators: [ind(1, { signal: "uses", memberIds: [1, 2] })] }));
    expect(noEvidence.filter((x) => x.rule === "cross_sell")).toEqual([]);
    const s = suggestOpportunities(base({ indicators: [
      ind(1, { signal: "uses", memberIds: [1, 2, 3] }),
      ind(2, { product: "فحص الموظفين", signal: "uses", memberIds: [3, 6] }),
    ] }));
    const cross = s.filter((x) => x.rule === "cross_sell");
    expect(cross.map((x) => [x.fromProduct, x.product, x.entityIds])).toEqual([
      ["الإجازات المرضية", "فحص الموظفين", [1, 2]],
      ["فحص الموظفين", "الإجازات المرضية", [6]],
    ]);
  });
  it("ignores inactive and draft indicators, honours dismissals, and drops empty audiences", () => {
    const i1 = ind(1, { signal: "not_using", memberIds: [1] });
    expect(suggestOpportunities(base({ indicators: [{ ...i1, status: "inactive" }] }))).toEqual([]);
    expect(suggestOpportunities(base({ indicators: [{ ...i1, status: "draft" }] }))).toEqual([]);
    const key = suggestOpportunities(base({ indicators: [i1] }))[0].key;
    expect(suggestOpportunities(base({ indicators: [i1], dismissedKeys: [key] }))).toEqual([]);
    expect(suggestOpportunities(base({ indicators: [i1], openOpportunities: [{ phone: "966500000001", product: "الإجازات المرضية" }] }))).toEqual([]);
  });
  it("shows a product the assistant cannot sell, with why, after the sellable ones", () => {
    const s = suggestOpportunities(base({ indicators: [
      ind(1, { product: "تكامل الأنظمة (HIS/ERP)", signal: "not_using", memberIds: [1, 2, 3, 4, 5] }),
      ind(2, { signal: "other", memberIds: [6], dataUpdatedAt: "2026-01-01" }),
    ] }));
    expect(s.map((x) => x.eligible)).toEqual([true, false]);
    expect(s[0].stale).toBe(true);
    expect(s[1].blockedWhy).toBe("بلا معرفة معتمدة");
  });
});

describe("repeat targeting warns, never blocks (BR-CAM-007)", () => {
  const now = Date.parse("2026-09-15T12:00:00Z");
  const day = 86400000;
  const camps = [
    { id: 1, name: "قديمة", product: "الإجازات المرضية", createdAt: now - 60 * day, test: false, phones: ["966500000001"] },
    { id: 2, name: "حديثة لنفس المنتج", product: "الإجازات المرضية", createdAt: now - 5 * day, test: false, phones: ["966599999999"] },
    { id: 3, name: "منتج آخر بنفس العملاء", product: "فحص الموظفين", createdAt: now - 3 * day, test: false, phones: ["966500000001", "966500000002"] },
    { id: 4, name: "منتج آخر بلا تقاطع", product: "فحص الموظفين", createdAt: now - 3 * day, test: false, phones: ["966588888888"] },
    { id: 5, name: "بروفة", product: "الإجازات المرضية", createdAt: now - day, test: true, phones: ["966500000001"] },
  ];
  it("lists recent same-product campaigns and any campaign that shared a recipient", () => {
    const w = checkRepeatTargeting("الإجازات المرضية", ["0500000001", "966500000002"], camps, now, 30);
    expect(w.campaigns.map((c) => [c.id, c.sameProduct, c.overlap])).toEqual([[3, false, 2], [2, true, 0]]);
    expect(w.overlapPhones).toBe(2);
    expect(w.sameProductRecent).toBe(1);
  });
});
