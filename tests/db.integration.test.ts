import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import pg from "pg";

// THE FIRST DB-BACKED TESTS IN THIS PROJECT.
//
// The suite had 161 tests and none touched Postgres, which is precisely how the ledger shipped with
// no writer: tsc, every test, a dedicated security review and a 13-route smoke suite ALL pass
// against an empty table, because an empty table is a valid empty result. A 1,440,000 SAR won deal
// left the pipeline and arrived nowhere, and nothing in the gate could see it.
//
// Everything asserted here is SQL behaviour that cannot be unit-tested: the won CTE's LATERAL join,
// the engagement command's transaction boundary, idempotent replay, and FK cascade.
//
// Runs only with TEST_DATABASE_URL set, so `npm run check` stays green on a machine with no
// database. CI provisions it (see package.json test:db) — a skipped suite that nobody ever runs is
// the appearance of coverage, which is worse than none.
const URL_ = process.env.TEST_DATABASE_URL;
const d = URL_ ? describe : describe.skip;

let pool: pg.Pool;
let db: typeof import("../src/db.js");

d("db integration", () => {
  beforeAll(async () => {
    // Never point this at anything that could be production. A test suite that truncates tables
    // needs a louder guard than a comment.
    if (!/localhost|127\.0\.0\.1/.test(URL_!)) throw new Error("TEST_DATABASE_URL must be local");
    // And never at the DEVELOPMENT database either. beforeEach truncates four tables, and pointing
    // this at `massar` destroyed the local seed data the first time it ran — the dev instance the
    // screens are checked against. The database name must say it is for tests.
    if (!/\/[a-z_]*test/i.test(new URL(URL_!).pathname)) {
      throw new Error("TEST_DATABASE_URL must name a test database (…/massar_test), not " + new URL(URL_!).pathname);
    }
    process.env.DATABASE_URL = URL_;
    db = await import("../src/db.js");
    await db.init();
    pool = new pg.Pool({ connectionString: URL_ });
  });
  afterAll(async () => { await pool?.end(); });

  beforeEach(async () => {
    // salesPerformance reads FROM tags — the catalogue is the row source, so a product with no tag
    // simply does not appear on the board. On a fresh test database that made the won-CTE
    // assertions read `undefined` rather than a number.
    await pool.query(
      `INSERT INTO tags (name, created_at, created_by) VALUES ('تكامل الأنظمة', $1, 'test')
       ON CONFLICT (name) DO NOTHING`, [Date.now()]);
    await pool.query("DELETE FROM engagements");
    await pool.query("DELETE FROM actions");
    await pool.query("DELETE FROM track_stage_events");
    await pool.query("DELETE FROM opportunities");
  });

  const mkOpp = async (stage: string, price = 100000) => {
    const now = Date.now();
    const r = await pool.query(
      `INSERT INTO opportunities (account_name, phone, product, stage, source, sale_price, years, qty,
         discount, created_at, updated_at, stage_at)
       VALUES ('عيادة الاختبار','966500000999','تكامل الأنظمة',$1,'call',$2,1,1,0,$3,$3,$3) RETURNING id`,
      [stage, price, now]);
    return Number(r.rows[0].id);
  };

  describe("recordEngagement is one command in one transaction", () => {
    it("records a call that moves NO stage — the case that recorded nothing before", async () => {
      const id = await mkOpp("tech");
      const r = await db.recordEngagement({
        idemKey: "t1", contactPhone: "966500000999", oppId: id, rep: "سارة",
        kind: "call", outcomeKey: "awaiting_tech", occurredAt: Date.now(), note: null,
      });
      expect(r.ok).toBe(true);
      if (r.ok) { expect(r.fromStage).toBe("tech"); expect(r.toStage).toBe("tech"); expect(r.actionsCreated).toBe(1); }
      // updateOpp writes a ledger row ONLY on a real transition, so this must add none.
      expect(Number((await pool.query("SELECT COUNT(*) c FROM track_stage_events")).rows[0].c)).toBe(0);
      expect(Number((await pool.query("SELECT COUNT(*) c FROM engagements")).rows[0].c)).toBe(1);
      const a = await pool.query("SELECT dept, engagement_id FROM actions");
      expect(a.rows[0].dept).toBe("التقنية");
      expect(a.rows[0].engagement_id).not.toBeNull();
    });

    it("is idempotent across a retry — one key, one engagement, one action", async () => {
      const id = await mkOpp("tech");
      const args = { idemKey: "dup", contactPhone: "966500000999", oppId: id, rep: "سارة",
                     kind: "call" as const, outcomeKey: "awaiting_tech", occurredAt: Date.now(), note: null };
      const a = await db.recordEngagement(args);
      const b = await db.recordEngagement(args);
      expect(a.ok && b.ok).toBe(true);
      if (a.ok && b.ok) { expect(b.replayed).toBe(true); expect(b.engagementId).toBe(a.engagementId); }
      expect(Number((await pool.query("SELECT COUNT(*) c FROM engagements")).rows[0].c)).toBe(1);
      // The mirror of the bug this guards: an idempotent engagement insert followed by a retried
      // action writer still duplicates the action, unless BOTH live under the one key.
      expect(Number((await pool.query("SELECT COUNT(*) c FROM actions")).rows[0].c)).toBe(1);
    });

    it("refuses an outcome that does not belong to the locked stage, and writes nothing", async () => {
      const id = await mkOpp("tech");
      const r = await db.recordEngagement({
        idemKey: "bad", contactPhone: "966500000999", oppId: id, rep: "سارة",
        kind: "call", outcomeKey: "not_interested", occurredAt: Date.now(), note: null,
      });
      expect(r.ok).toBe(false);
      expect(Number((await pool.query("SELECT COUNT(*) c FROM engagements")).rows[0].c)).toBe(0);
      expect((await pool.query("SELECT stage FROM opportunities WHERE id=$1", [id])).rows[0].stage).toBe("tech");
    });

    it("bounds occurred_at so a quiet week cannot be backdated into a compliant one", async () => {
      const id = await mkOpp("tech");
      const old = await db.recordEngagement({
        idemKey: "old", contactPhone: "966500000999", oppId: id, rep: "سارة", kind: "call",
        outcomeKey: null, occurredAt: Date.now() - 30 * 24 * 3600 * 1000, note: null });
      expect(old.ok).toBe(false);
      const future = await db.recordEngagement({
        idemKey: "fut", contactPhone: "966500000999", oppId: id, rep: "سارة", kind: "call",
        outcomeKey: null, occurredAt: Date.now() + 3600 * 1000, note: null });
      expect(future.ok).toBe(false);
    });
  });

  describe("the won CTE — verified by hand once, now locked", () => {
    const period = () => {
      const now = new Date();
      return { start: Date.UTC(now.getUTCFullYear(), 0, 1), end: Date.UTC(now.getUTCFullYear() + 1, 0, 1) };
    };

    it("counts a won deal exactly once, at its LATEST win", async () => {
      const id = await mkOpp("negotiate", 500000);
      await db.recordEngagement({ idemKey: "w1", contactPhone: "966500000999", oppId: id, rep: "سارة",
        kind: "call", outcomeKey: "agreed", occurredAt: Date.now(), note: null });
      const { start, end } = period();
      const rows = await db.salesPerformance(start, end, new Date().getUTCFullYear(), 1, true);
      const line = rows.find((r) => r.product === "تكامل الأنظمة");
      expect(line?.achieved).toBe(500000);
      expect(line?.wonCount).toBe(1);
    });

    it("drops a reversed win out of achieved and returns it to open pipeline", async () => {
      const id = await mkOpp("negotiate", 500000);
      await db.recordEngagement({ idemKey: "w2", contactPhone: "966500000999", oppId: id, rep: "سارة",
        kind: "call", outcomeKey: "agreed", occurredAt: Date.now(), note: null });
      await db.updateOpp(id, { stage: "negotiate" } as never, "سارة");
      const { start, end } = period();
      const rows = await db.salesPerformance(start, end, new Date().getUTCFullYear(), 1, true);
      const line = rows.find((r) => r.product === "تكامل الأنظمة");
      // Two win events could exist on a re-win; the row's CURRENT stage decides, the ledger dates it.
      expect(line?.achieved).toBe(0);
      expect(line?.openCount).toBe(1);
    });
  });

  describe("«أين تتعثّر الصفقات» — the reader that shipped with the writer", () => {
    it("groups open work by the department that owes it, oldest blockage first", async () => {
      const a = await mkOpp("tech");
      const b = await mkOpp("negotiate");
      await db.recordEngagement({ idemKey: "g1", contactPhone: "966500000999", oppId: a, rep: "سارة",
        kind: "call", outcomeKey: "awaiting_tech", occurredAt: Date.now(), note: null });
      await db.recordEngagement({ idemKey: "g2", contactPhone: "966500000999", oppId: b, rep: "سارة",
        kind: "call", outcomeKey: "awaiting_procurement", occurredAt: Date.now(), note: null });
      const groups = await db.stalledByDept();
      const depts = groups.map((g) => g.dept).sort();
      expect(depts).toEqual(["المشتريات", "التقنية"].sort());
      expect(groups.every((g) => g.openCount === 1)).toBe(true);
      expect(groups.every((g) => g.items[0].rep === "سارة")).toBe(true);
    });

    it("dedups: chasing the same blocker twice owes the department one task, not two", async () => {
      const id = await mkOpp("tech");
      await db.recordEngagement({ idemKey: "d1", contactPhone: "966500000999", oppId: id, rep: "سارة",
        kind: "call", outcomeKey: "awaiting_tech", occurredAt: Date.now(), note: null });
      await db.recordEngagement({ idemKey: "d2", contactPhone: "966500000999", oppId: id, rep: "سارة",
        kind: "call", outcomeKey: "awaiting_tech", occurredAt: Date.now(), note: null });
      expect(Number((await pool.query("SELECT COUNT(*) c FROM engagements")).rows[0].c)).toBe(2);
      expect(Number((await pool.query("SELECT COUNT(*) c FROM actions WHERE state='open'")).rows[0].c)).toBe(1);
    });

    it("closes an action once and refuses the second close", async () => {
      const id = await mkOpp("tech");
      await db.recordEngagement({ idemKey: "c1", contactPhone: "966500000999", oppId: id, rep: "سارة",
        kind: "call", outcomeKey: "awaiting_tech", occurredAt: Date.now(), note: null });
      const actionId = Number((await pool.query("SELECT id FROM actions WHERE state='open'")).rows[0].id);
      expect(await db.closeAction(actionId, "done", "اللوحة")).toBe(true);
      // Without this the screen fills with rows nobody can clear and stops being read.
      expect(await db.closeAction(actionId, "done", "اللوحة")).toBe(false);
      expect((await db.stalledByDept()).length).toBe(0);
    });
  });

  describe("referential integrity", () => {
    it("cascades a deleted opportunity's ledger and actions instead of orphaning them", async () => {
      const id = await mkOpp("tech");
      await db.recordEngagement({ idemKey: "fk", contactPhone: "966500000999", oppId: id, rep: "سارة",
        kind: "call", outcomeKey: "awaiting_tech", occurredAt: Date.now(), note: null });
      await db.updateOpp(id, { stage: "quote" } as never, "سارة");
      expect(Number((await pool.query("SELECT COUNT(*) c FROM track_stage_events")).rows[0].c)).toBe(1);
      await db.deleteOpp(id);
      expect(Number((await pool.query("SELECT COUNT(*) c FROM track_stage_events")).rows[0].c)).toBe(0);
      expect(Number((await pool.query("SELECT COUNT(*) c FROM actions")).rows[0].c)).toBe(0);
      // The engagement SURVIVES: deleting one product line must not erase that a rep spoke to a human.
      const e = await pool.query("SELECT opp_id FROM engagements");
      expect(e.rows.length).toBe(1);
      expect(e.rows[0].opp_id).toBeNull();
    });
  });
});
