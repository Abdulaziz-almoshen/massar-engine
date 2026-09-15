import { describe, expect, it } from "vitest";
import {
  addDays, canChangeResult, checkPartner, checkResult, checkTarget, isIsoDay, isWeekStart, PARTNER_DOMAIN_JS, resultFromWord,
  splitPasteLines, summarizeWeek, weekStartOf,
} from "../src/partner-domain.js";

const P = ["الإجازات المرضية", "فحص الموظفين"];

describe("weeks", () => {
  it("start on Sunday", () => {
    expect(weekStartOf("2026-09-15")).toBe("2026-09-13"); // Tuesday → Sunday
    expect(weekStartOf("2026-09-13")).toBe("2026-09-13");
    expect(weekStartOf("2026-09-19")).toBe("2026-09-13"); // Saturday still in the week that began Sunday
    expect(isWeekStart("2026-09-13")).toBe(true);
    expect(isWeekStart("2026-09-14")).toBe(false);
    expect(addDays("2026-12-27", 7)).toBe("2027-01-03");
  });
  it("only real days", () => {
    expect(isIsoDay("2026-02-29")).toBe(false);
    expect(isIsoDay("2028-02-29")).toBe(true);
    expect(isIsoDay("2026-9-1")).toBe(false);
  });
});

describe("checkPartner", () => {
  it("needs a name and a kind", () => {
    expect(checkPartner({ name: "", kind: "sales" })).toMatchObject({ ok: false, field: "name" });
    expect(checkPartner({ name: "شركة إجادة", kind: "vendor" })).toMatchObject({ ok: false, field: "kind" });
    expect(checkPartner({ name: " شركة إجادة ", kind: "sales", email: "a@b" })).toMatchObject({ ok: false, field: "email" });
    expect(checkPartner({ name: " شركة إجادة ", kind: "marketing", phone: "٠٥٥١٢٣٤٥٦٧" })).toMatchObject({ ok: true, value: { name: "شركة إجادة", kind: "marketing", email: null } });
  });
});

describe("checkTarget", () => {
  it("whole numbers for a known product; blank is zero", () => {
    expect(checkTarget({ product: "x", target: 3 }, P)).toMatchObject({ ok: false, field: "product" });
    expect(checkTarget({ product: P[0], target: "2.5" }, P)).toMatchObject({ ok: false, field: "target" });
    expect(checkTarget({ product: P[0], target: "-1" }, P)).toMatchObject({ ok: false, field: "target" });
    expect(checkTarget({ product: P[0], target: "" }, P)).toEqual({ ok: true, value: { product: P[0], target: 0 } });
    expect(checkTarget({ product: P[0], target: 250 }, P)).toEqual({ ok: true, value: { product: P[0], target: 250 } });
  });
});

describe("checkResult", () => {
  const ok = { product: P[0], accountName: "مستشفى الأمل", phone: "0551234567", result: "interested", contactedOn: "2026-09-14" };
  it("accepts a real contact and keeps the digits", () => {
    expect(checkResult(ok, P, "2026-09-15")).toEqual({ ok: true, value: { ...ok, phone: "0551234567", note: null } });
  });
  it("refuses each missing or wrong field with its own sentence", () => {
    expect(checkResult({ ...ok, phone: "" }, P, "2026-09-15")).toMatchObject({ ok: false, field: "phone" });
    expect(checkResult({ ...ok, phone: "055123" }, P, "2026-09-15")).toMatchObject({ ok: false, field: "phone" });
    expect(checkResult({ ...ok, phone: "5512345678" }, P, "2026-09-15")).toMatchObject({ ok: false, field: "phone" });
    expect(checkResult({ ...ok, phone: "+966 55 123 4567" }, P, "2026-09-15")).toMatchObject({ ok: true });
    expect(checkResult({ ...ok, result: "maybe" }, P, "2026-09-15")).toMatchObject({ ok: false, field: "result" });
    expect(checkResult({ ...ok, contactedOn: "2026-09-16" }, P, "2026-09-15")).toMatchObject({ ok: false, field: "contactedOn", reason: "تاريخ التواصل في المستقبل" });
    expect(checkResult({ ...ok, product: "x" }, P, "2026-09-15")).toMatchObject({ ok: false, field: "product" });
    expect(checkResult({ ...ok, accountName: "م" }, P, "2026-09-15")).toMatchObject({ ok: false, field: "accountName" });
  });
  it("a handed-over result is closed to the partner", () => {
    expect(canChangeResult({ oppId: null })).toBe(true);
    expect(canChangeResult({ oppId: 4 })).toBe(false);
  });
});

describe("paste", () => {
  it("reads the words a sheet uses and never guesses", () => {
    expect(resultFromWord(" غير مهتم ")).toBe("not_interested");
    expect(resultFromWord("No Reply")).toBe("no_reply");
    expect(resultFromWord("مهتمٌ")).toBe("interested");
    expect(resultFromWord("ربما")).toBeNull();
  });
  it("a spreadsheet copy splits on tabs only, and its header is skipped after a blank line", () => {
    expect(splitPasteLines("\nالمنشأة\tالجوال\tالنتيجة\nمستشفى, فرع الرياض\t0551234567\tمهتم")).toEqual([
      { line: 3, accountName: "مستشفى, فرع الرياض", phone: "0551234567", result: "interested", note: "" },
    ]);
    expect(splitPasteLines("أ؛0551234567؛لم يرد")[0].result).toBe("no_reply");
  });
  it("splits commas, Arabic commas and tabs; skips a header; keeps unknown words for checkResult to refuse", () => {
    const rows = splitPasteLines("الاسم,الجوال,النتيجة\nمستشفى الأمل، 0551234567، مهتم، يريد عرضًا\n\nعيادة النور\t0559876543\tربما");
    expect(rows).toEqual([
      { line: 2, accountName: "مستشفى الأمل", phone: "0551234567", result: "interested", note: "يريد عرضًا" },
      { line: 4, accountName: "عيادة النور", phone: "0559876543", result: "ربما", note: "" },
    ]);
  });
});

describe("summarizeWeek (BR-PRT-002)", () => {
  it("counts customers once with their latest result, and achievement may pass 100", () => {
    const line = summarizeWeek([{ partnerId: 1, product: P[0], target: 2 }], [
      { partnerId: 1, product: P[0], phone: "a", result: "no_reply", contactedOn: "2026-09-13", oppId: null },
      { partnerId: 1, product: P[0], phone: "a", result: "interested", contactedOn: "2026-09-15", oppId: 7 },
      { partnerId: 1, product: P[0], phone: "b", result: "not_interested", contactedOn: "2026-09-14", oppId: null },
      { partnerId: 1, product: P[0], phone: "c", result: "no_reply", contactedOn: "2026-09-14", oppId: null },
    ]);
    expect(line).toEqual({ target: 2, contacted: 3, contactedTargeted: 3, interested: 1, notInterested: 1, noReply: 1, handedOver: 1, pct: 150 });
  });
  it("a handed-over interest stands against a later result from the same partner", () => {
    const line = summarizeWeek([], [
      { partnerId: 1, product: P[0], phone: "a", result: "interested", contactedOn: "2026-09-14", oppId: 9 },
      { partnerId: 1, product: P[0], phone: "a", result: "not_interested", contactedOn: "2026-09-15", oppId: null },
    ]);
    expect(line).toMatchObject({ contacted: 1, interested: 1, notInterested: 0, handedOver: 1 });
  });
  it("contacts for an untargeted product do not fill another product's target", () => {
    const line = summarizeWeek([{ partnerId: 1, product: P[0], target: 10 }], Array.from({ length: 10 }, (_, i) =>
      ({ partnerId: 1, product: P[1], phone: "p" + i, result: "no_reply", contactedOn: "2026-09-14", oppId: null })));
    expect(line).toMatchObject({ contacted: 10, contactedTargeted: 0, pct: 0 });
  });
  it("no target is no achievement figure", () => {
    expect(summarizeWeek([], []).pct).toBeNull();
  });
  it("the page runs the same rules", () => {
    const page = new Function(PARTNER_DOMAIN_JS + "; return { summarizeWeek, checkResult, splitPasteLines, weekStartOf };")();
    expect(page.weekStartOf("2026-09-17")).toBe("2026-09-13");
    expect(page.checkResult({ product: P[0], accountName: "x", phone: "1", result: "interested", contactedOn: "2026-09-14" }, P, "2026-09-15"))
      .toEqual(checkResult({ product: P[0], accountName: "x", phone: "1", result: "interested", contactedOn: "2026-09-14" }, P, "2026-09-15"));
    expect(page.splitPasteLines("أ،0551234567،لم يرد")).toEqual(splitPasteLines("أ،0551234567،لم يرد"));
  });
});
