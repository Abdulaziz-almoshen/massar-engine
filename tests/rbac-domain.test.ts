import { describe, expect, it } from "vitest";
import { can, canOpen, checkUser, homeRouteFor, isAuditable, matrixCell, MATRIX_ROWS, permissionFor, PERMISSIONS, RBAC_DOMAIN_JS, ROLE_GRANTS, ROLES, ROUTE_PERMISSIONS } from "../src/rbac-domain.js";

const row = (label: string) => MATRIX_ROWS.find((r) => r.label === label)!;

describe("§22 as the BRD wrote it", () => {
  it("every grant is a known permission; admin holds all", () => {
    for (const r of ROLES) for (const p of ROLE_GRANTS[r]) expect(PERMISSIONS).toContain(p);
    expect(ROLE_GRANTS.admin).toEqual(PERMISSIONS);
  });
  it("matrix rows read ✓ / عرض / — per role", () => {
    const cells = (label: string) => ROLES.map((r) => matrixCell(r, row(label)));
    // columns: exec, product_manager, sales, partner, admin
    expect(cells("إدارة العملاء")).toEqual(["view", "full", "full", "none", "full"]);
    expect(cells("إدارة المؤشرات")).toEqual(["view", "full", "view", "none", "full"]);
    expect(cells("إدارة معرفة المنتج")).toEqual(["view", "full", "view", "none", "full"]);
    expect(cells("إنشاء/إطلاق حملة")).toEqual(["view", "full", "view", "none", "full"]);
    // DEC-14: creating is the product manager's; SENDING stays with the system administrator.
    expect(can("product_manager", "campaigns.launch")).toBe(false);
    expect(permissionFor("HEAD", "/admin/opps")?.permission).toBe("opps.view");
    expect(cells("إدارة الفرص")).toEqual(["view", "view", "full", "none", "full"]);
    expect(cells("تحديث نتائج التواصل")).toEqual(["view", "view", "full", "full", "full"]);
    expect(cells("إدارة الهيكل والصلاحيات")).toEqual(["none", "none", "none", "none", "full"]);
  });
  it("a partner never reaches conversations, customers or the send routes", () => {
    for (const p of ["conversations.view", "customers.view", "campaigns.launch", "messaging.raw", "opps.view", "dashboards.view"]) expect(can("partner", p)).toBe(false);
    expect(can("sales", "campaigns.launch")).toBe(false);
    expect(can("exec", "opps.edit")).toBe(false);
    expect(can("nobody", "partners.view")).toBe(false);
  });
});

describe("routes", () => {
  it("the send routes need launch or raw messaging; unlisted routes are nobody's", () => {
    expect(permissionFor("POST", "/admin/campaign/launch")?.permission).toBe("campaigns.launch");
    expect(permissionFor("post", "/admin/send-test")?.permission).toBe("messaging.raw");
    expect(permissionFor("GET", "/admin/something-new")).toBeNull();
  });
  it("no route is listed twice, and every write has an audit label", () => {
    const keys = ROUTE_PERMISSIONS.map((r) => r.method + " " + r.url);
    expect(new Set(keys).size).toBe(keys.length);
    const unlabelled = ROUTE_PERMISSIONS.filter((r) => r.method !== "GET" && !r.label && !/preview|compose|repeat-check/.test(r.url));
    expect(unlabelled).toEqual([]);
  });
  it("audits successful writes only", () => {
    expect(isAuditable("POST", 201)).toBe(true);
    expect(isAuditable("PATCH", 409)).toBe(false);
    expect(isAuditable("GET", 200)).toBe(false);
  });
  it("doors and landing", () => {
    expect(canOpen("partner", "partners")).toBe(true);
    expect(canOpen("partner", "home")).toBe(false);
    expect(canOpen("exec", "users")).toBe(false);
    expect(canOpen("admin", "anything")).toBe(true);
    expect(homeRouteFor("partner")).toBe("partners");
    expect(homeRouteFor("sales")).toBe("home");
  });
});

describe("checkUser", () => {
  it("a partner user names its partner; others carry none", () => {
    expect(checkUser({ name: "سالم", role: "partner" }, [1], [])).toMatchObject({ ok: false, field: "partnerId" });
    expect(checkUser({ name: "سالم", role: "partner", partnerId: 2 }, [1], [])).toMatchObject({ ok: false, field: "partnerId" });
    expect(checkUser({ name: "سالم", role: "partner", partnerId: "1" }, [1], [])).toEqual({ ok: true, value: { name: "سالم", role: "partner", partnerId: 1, memberId: null } });
    expect(checkUser({ name: "ريم", role: "sales", partnerId: 1, memberId: 7 }, [1], [7])).toEqual({ ok: true, value: { name: "ريم", role: "sales", partnerId: null, memberId: 7 } });
    expect(checkUser({ name: "ريم", role: "boss" }, [], [])).toMatchObject({ ok: false, field: "role" });
    expect(checkUser({ name: "ر", role: "sales" }, [], [])).toMatchObject({ ok: false, field: "name" });
    expect(checkUser({ name: "اللوحة", role: "sales" }, [], [])).toMatchObject({ ok: false, field: "name" });
  });
  it("the page runs the same rules", () => {
    const page = new Function(RBAC_DOMAIN_JS + "; return { can, canOpen };")();
    expect(page.can("sales", "opps.edit")).toBe(true);
    expect(page.canOpen("partner", "kmon")).toBe(false);
  });
});
