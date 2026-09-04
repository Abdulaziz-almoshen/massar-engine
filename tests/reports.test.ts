import { describe, it, expect } from "vitest";
import { REPORTS, reportById, assertReportKeys } from "../src/reports-domain.js";
import { STAGE_OUTCOMES, VALUE_BASIS_LABEL, VALUE_BASIS_NOTE } from "../src/sales-domain.js";

describe("the four named reports (R11)", () => {
  it("is exactly the four the stage document names", () => {
    expect(REPORTS.map((r) => r.id)).toEqual([
      "awaiting-procurement", "contract-edit", "blocked-on-tech", "lost-to-integration",
    ]);
  });

  // THE ONE THAT MATTERS. A report filtering on an outcome key nobody writes returns an empty
  // table — and an empty LOSS report reads as good news. Same defect as a table with no writer,
  // one layer up: valid query, rendered screen, silently zero forever.
  it("filters only on outcome keys the ladder actually writes", () => {
    expect(assertReportKeys(STAGE_OUTCOMES.map((o) => o.key))).toEqual([]);
  });

  it("catches a key that does not exist", () => {
    expect(assertReportKeys(["awaiting_procurement"])).toContain("contract-edit -> contract_edit");
  });

  // «الخسائر بسبب التكامل» has TWO keys at two different stages — the commercial loss and the
  // technical one. Counting either alone undercounts, which on a loss report hides the problem.
  it("counts both integration-loss keys, not one", () => {
    const r = reportById("lost-to-integration")!;
    expect(r.outcomeKeys).toEqual(["lost_integration", "integration_failed"]);
  });

  it("counts both ways a deal waits on التقنية", () => {
    expect(reportById("blocked-on-tech")!.outcomeKeys).toEqual(["awaiting_tech", "needs_tech_clarity"]);
  });

  it("every dept named by a report is a dept the ladder assigns", () => {
    const depts = new Set(STAGE_OUTCOMES.map((o) => o.dept).filter(Boolean));
    for (const r of REPORTS) if (r.dept) expect(depts, `${r.id}`).toContain(r.dept);
  });

  // A blank table and a broken query look identical. Every report must be able to say which.
  it("every report carries a written empty state", () => {
    for (const r of REPORTS) {
      expect(r.emptyTitle.length, r.id).toBeGreaterThan(6);
      expect(r.emptyBody.length, r.id).toBeGreaterThan(20);
      expect(r.question, r.id).toMatch(/؟$/);   // it states the question it answers
    }
  });

  it("returns null for an unknown id rather than a default report", () => {
    expect(reportById("nope")).toBeNull();
  });
});

describe("the honest money label (R13)", () => {
  // The accounting basis was never decided. A bare «المحقق» beside a target lets the reader supply
  // their own basis, and reading TCV as ACV is wrong by the number of years — 300% on a 3-year deal.
  it("says what the arithmetic did", () => {
    expect(VALUE_BASIS_LABEL).toContain("السنوات");
    expect(VALUE_BASIS_LABEL).toContain("الخصم");
  });

  it("says the basis is undecided instead of implying one", () => {
    expect(VALUE_BASIS_NOTE).toContain("لم يُحسم");
    for (const basis of ["حجوزات", "ACV", "TCV"]) expect(VALUE_BASIS_NOTE).toContain(basis);
  });
});
