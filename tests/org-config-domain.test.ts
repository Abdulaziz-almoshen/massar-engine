import { describe, it, expect } from "vitest";
import {
  checkSegment, checkSegmentDelete, checkOrgSector, checkOrgSectorDelete, checkRole, roleKeyFrom,
  checkRoleDelete, buildOrgTree, checkDivision, checkMember, checkConfigDomainClosure, CONFIG_DOMAIN_JS,
} from "../src/config-domain.js";

describe("segments — the market a product sells into", () => {
  it("accepts the three types and refuses any other", () => {
    expect(checkSegment({ name: " المستشفيات  الخاصة ", kind: "hospitals" }, [])).toEqual({ ok: true, value: { name: "المستشفيات الخاصة", kind: "hospitals", active: true } });
    expect(checkSegment({ name: "س", kind: "pharmacies" }, []).ok).toBe(true);
    expect(checkSegment({ name: "س", kind: "business" }, []).ok).toBe(true);
    const bad = checkSegment({ name: "س", kind: "clinics" }, []);
    expect(bad.ok === false && bad.field).toBe("kind");
  });
  it("refuses a taken name but lets a row keep its own", () => {
    expect(checkSegment({ name: "أ", kind: "business" }, ["أ"]).ok).toBe(false);
    expect(checkSegment({ name: "أ", kind: "business" }, ["أ"], "أ").ok).toBe(true);
  });
  it("is not deleted while products point at it", () => {
    expect(checkSegmentDelete(2).ok).toBe(false);
    expect(checkSegmentDelete(0).ok).toBe(true);
  });
});

describe("org sectors — business, sales or support, with a manager", () => {
  it("classifies and validates the manager", () => {
    expect(checkOrgSector({ name: "قطاع الأعمال", kind: "business" }, []).ok).toBe(true);
    expect(checkOrgSector({ name: "س", kind: "hr" }, []).ok).toBe(false);
    const absent = checkOrgSector({ name: "س", kind: "sales", managerMemberId: 9 }, [], null);
    expect(absent.ok === false && absent.code).toBe("unknown_member");
    const paused = checkOrgSector({ name: "س", kind: "sales", managerMemberId: 9 }, [], { id: 9, active: false });
    expect(paused.ok === false && paused.code).toBe("inactive_member");
    const ok = checkOrgSector({ name: "س", kind: "support", managerMemberId: "9" }, [], { id: 9, active: true });
    expect(ok.ok && ok.value.managerMemberId).toBe(9);
  });
  it("keeps departments from being orphaned", () => {
    expect(checkOrgSectorDelete(1).ok).toBe(false);
    expect(checkOrgSectorDelete(0).ok).toBe(true);
  });
});

describe("departments sit under a sector", () => {
  it("carries the sector id and refuses one that does not exist", () => {
    const ok = checkDivision({ name: "إدارة", sectorId: "4" }, [], null, undefined, { id: 4, active: true });
    expect(ok.ok && ok.value.sectorId).toBe(4);
    const none = checkDivision({ name: "إدارة", sectorId: 4 }, [], null, undefined, null);
    expect(none.ok === false && none.field).toBe("sectorId");
    const loose = checkDivision({ name: "إدارة" }, []);
    expect(loose.ok && loose.value.sectorId).toBe(null);
  });
});

describe("roles — the admin's list, four the code depends on", () => {
  it("validates against the live keys when given, the seeded four otherwise", () => {
    const m = { name: "سارة", email: "s@lean.sa", role: "account_manager" };
    expect(checkMember(m).ok).toBe(false);
    expect(checkMember(m, ["sales", "account_manager"]).ok).toBe(true);
    expect(checkMember({ ...m, role: "product_manager" }).ok).toBe(true);
  });
  it("never pauses or deletes a system role", () => {
    expect(checkRole({ label: "مبيعات", active: false }, [], "مبيعات", true).ok).toBe(false);
    expect(checkRole({ label: "فريق المبيعات" }, ["مبيعات"], "مبيعات", true).ok).toBe(true);
    expect(checkRoleDelete("sales", 0).ok).toBe(false);
    expect(checkRoleDelete("role_2", 3).ok).toBe(false);
    expect(checkRoleDelete("role_2", 0).ok).toBe(true);
  });
  it("derives a stable ascii key", () => {
    expect(roleKeyFrom("مدير حساب", [])).toBe("role");
    expect(roleKeyFrom("مدير حساب", ["role"])).toBe("role_2");
    expect(roleKeyFrom("Account Manager", [])).toBe("account_manager");
  });
});

describe("the hierarchy — sector → manager → department → manager → members", () => {
  const sectors = [{ id: 1, name: "الأعمال", kind: "business", managerMemberId: 10, active: true }];
  const depts = [
    { id: 5, name: "الحلول", sectorId: 1, ownerMemberId: 11, active: true },
    { id: 6, name: "بلا أب", sectorId: null, ownerMemberId: null, active: true },
    { id: 7, name: "قطاعه محذوف", sectorId: 99, ownerMemberId: null, active: true },
  ];
  const members = [
    { id: 10, name: "مدير القطاع", role: "manager", divisionId: null, active: true },
    { id: 11, name: "مدير الإدارة", role: "manager", divisionId: 5, active: true },
    { id: 12, name: "مندوب", role: "sales", divisionId: 5, active: true },
    { id: 13, name: "تائه", role: "sales", divisionId: 404, active: true },
  ];
  const tree = buildOrgTree(sectors, depts, members);
  it("hangs each department off its sector, with both managers resolved", () => {
    expect(tree.sectors[0].manager?.name).toBe("مدير القطاع");
    expect(tree.sectors[0].departments.map((d) => d.name)).toEqual(["الحلول"]);
    expect(tree.sectors[0].departments[0].manager?.name).toBe("مدير الإدارة");
  });
  it("does not list a department's manager twice", () => {
    expect(tree.sectors[0].departments[0].members.map((m) => m.id)).toEqual([12]);
  });
  it("draws what falls out of the tree instead of dropping it", () => {
    expect(tree.unsectored.map((d) => d.id)).toEqual([6, 7]);
    expect(tree.unplaced.map((m) => m.id)).toEqual([10, 13]);
  });
});

describe("the browser copy", () => {
  it("serialises every new rule with nothing undefined", () => {
    expect(checkConfigDomainClosure()).toEqual([]);
    for (const n of ["checkSegment", "checkOrgSector", "checkRole", "buildOrgTree", "SEGMENT_KIND_LABELS", "ORG_SECTOR_KIND_LABELS"]) {
      expect(CONFIG_DOMAIN_JS).toContain(n);
    }
    // eslint-disable-next-line no-new-func
    const run = new Function(CONFIG_DOMAIN_JS + "; return buildOrgTree([], [], [{ id: 1, name: 'x', role: 'sales', divisionId: null, active: true }]).unplaced.length;");
    expect(run()).toBe(1);
  });
});
