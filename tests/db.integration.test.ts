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
    // Two products, because the composite-FK test needs a package on a DIFFERENT product from
    // the one mkOpp writes its deals against.
    for (const t of ["تكامل الأنظمة", "الإجازات المرضية"]) {
      await pool.query(
        `INSERT INTO tags (name, created_at, created_by) VALUES ($1, $2, 'test')
         ON CONFLICT (name) DO NOTHING`, [t, Date.now()]);
    }
    await pool.query("DELETE FROM engagements");
    await pool.query("DELETE FROM actions");
    await pool.query("DELETE FROM track_stage_events");
    await pool.query("DELETE FROM opportunities");
    await pool.query("DELETE FROM packages WHERE name NOT IN ('الباقة القياسية','باقة المؤسسات')");
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

  describe("packages — price on the package, enforced by the database", () => {
    const mkPkg = async (product: string, name: string, price: number) =>
      db.upsertPackage({ product, name, listPrice: price, years: 1, scope: null });

    it("refuses a package for a product that is not in the catalogue", async () => {
      expect(await mkPkg("منتج غير موجود", "باقة", 1000)).toBeNull();
    });

    it("REFUSES a deal referencing a package of a DIFFERENT product", async () => {
      // The composite foreign key, not application code. A plain package_id FK would allow this.
      // mkOpp creates the deal on «تكامل الأنظمة», so the package must belong to a DIFFERENT
      // product for this to be the case under test. A first draft put both on the same product
      // and the FK correctly allowed it — the test was wrong, not the constraint.
      const pkg = await mkPkg("الإجازات المرضية", "باقة الاختبار", 50000);
      const other = await mkOpp("tech");   // على «تكامل الأنظمة»
      await expect(
        pool.query("UPDATE opportunities SET package_id = $1 WHERE id = $2", [pkg!.id, other]),
      ).rejects.toThrow(/opp_package_product_fk/);
    });

    it("REFUSES deleting a package a deal still references — retirement is the only exit", async () => {
      const pkg = await mkPkg("تكامل الأنظمة", "باقة مرجعية", 50000);
      const id = await mkOpp("tech");
      await pool.query("UPDATE opportunities SET product='تكامل الأنظمة', package_id=$1 WHERE id=$2", [pkg!.id, id]);
      await expect(pool.query("DELETE FROM packages WHERE id = $1", [pkg!.id]))
        .rejects.toThrow(/opp_package_product_fk/);
      // Retiring it works, and the deal keeps pointing at it.
      expect(await db.retirePackage(pkg!.id, true)).toBe(true);
      const still = await pool.query("SELECT package_id FROM opportunities WHERE id=$1", [id]);
      expect(Number(still.rows[0].package_id)).toBe(pkg!.id);
    });

    it("hides retired packages from the offerable list but keeps them readable", async () => {
      const pkg = await mkPkg("تكامل الأنظمة", "باقة منتهية", 40000);
      await db.retirePackage(pkg!.id, true);
      const live = await db.listPackages("تكامل الأنظمة");
      const all = await db.listPackages("تكامل الأنظمة", true);
      expect(live.map((p) => p.name)).not.toContain("باقة منتهية");
      expect(all.map((p) => p.name)).toContain("باقة منتهية");
    });

    it("upserts on (product, name) rather than duplicating", async () => {
      await mkPkg("تكامل الأنظمة", "باقة واحدة", 10000);
      await mkPkg("تكامل الأنظمة", "باقة واحدة", 12000);
      const rows = (await db.listPackages("تكامل الأنظمة")).filter((p) => p.name === "باقة واحدة");
      expect(rows.length).toBe(1);
      expect(rows[0].listPrice).toBe(12000);
    });

    it("seeded the two REAL published packages, and only those", async () => {
      // Verbatim from agent.ts:80. The only prices this company publishes.
      const sick = await db.listPackages("الإجازات المرضية");
      const byName = Object.fromEntries(sick.map((p) => [p.name, p.listPrice]));
      expect(byName["الباقة القياسية"]).toBe(18000);
      expect(byName["باقة المؤسسات"]).toBe(95000);
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

  describe("sector seed + catalogue reads", () => {
    it("seeds the three sectors at boot, not in a migration", async () => {
      const secs = await db.listSectors();
      expect(secs.map((x) => x.name)).toEqual(
        ["قطاع المستشفيات", "قطاع الصيدليات", "قطاع الأعمال"]);
    });

    it("does not duplicate sectors when the seed runs again", async () => {
      await db.init();
      expect((await db.listSectors())).toHaveLength(3);
    });

    // The seed is insert-if-absent so a hand correction survives a deploy. seedDefaultPipeline
    // uses DO UPDATE for the opposite reason; getting these two backwards silently reverts a
    // founder's fix on the next deploy.
    it("leaves a corrected mapping alone on the next boot", async () => {
      const hosp = (await db.listSectors()).find((s) => s.name === "قطاع المستشفيات")!;
      await pool.query(
        "UPDATE product_meta SET sector_id=$1, sector_assumed=false WHERE product='فحص الموظفين'",
        [hosp.id]);
      await db.init();
      const r = await pool.query(
        "SELECT sector_id, sector_assumed FROM product_meta WHERE product='فحص الموظفين'");
      expect(Number(r.rows[0].sector_id)).toBe(hosp.id);
      expect(r.rows[0].sector_assumed).toBe(false);
    });

    // Driven off tags, so a product the agent catalogue has never heard of still appears. Two such
    // products exist in production.
    it("returns a row for a tag with no product_meta, carrying a null sector", async () => {
      await pool.query(
        `INSERT INTO tags (name, created_at, created_by) VALUES ('صحة أعمال Plus', $1, 'test')
         ON CONFLICT (name) DO NOTHING`, [Date.now()]);
      const cat = await db.productCatalogue();
      const row = cat.find((c) => c.product === "صحة أعمال Plus");
      expect(row).toBeDefined();
      expect(row!.sector).toBeNull();
      expect(row!.packages).toEqual([]);
    });

    it("attaches live packages and hides retired ones", async () => {
      const cat = await db.productCatalogue();
      const sick = cat.find((c) => c.product === "الإجازات المرضية")!;
      expect(sick.packages.map((p) => p.name)).toEqual(["الباقة القياسية", "باقة المؤسسات"]);
      expect(sick.packages[0].listPrice).toBe(18000);
      expect(sick.pricingNote).toBeNull();   // it has real packages, so no «يحدده المختص» note
    });
  });

  describe("R8 — renaming a product moves every table that names it", () => {
    const uniq = () => "ر٨-" + Math.random().toString(36).slice(2, 8);

    it("moves targets, product_meta and packages, not just the tag", async () => {
      const a = uniq(), b = uniq(), now = Date.now();
      await pool.query("INSERT INTO tags (name, created_at, created_by) VALUES ($1,$2,'t')", [a, now]);
      await pool.query("INSERT INTO targets (product, year, quarter, amount, updated_at) VALUES ($1,2030,1,900000,$2)", [a, now]);
      await pool.query("INSERT INTO product_meta (product, updated_at) VALUES ($1,$2)", [a, now]);
      await pool.query("INSERT INTO packages (product, name, list_price, years, created_at) VALUES ($1,'ب',1,1,$2)", [a, now]);

      const r = await db.renameTag(a, b);
      expect(r.ok).toBe(true);
      // The old version returned true here having moved ONLY the tag, and the quarterly target
      // silently left the board because salesPerformance joins targets ON tgt.product = t.name.
      expect(r.moved).toMatchObject({ tags: 1, targets: 1, product_meta: 1, packages: 1 });

      for (const t of ["targets", "product_meta", "packages"]) {
        const left = await pool.query(`SELECT count(*)::int AS n FROM ${t} WHERE product = $1`, [a]);
        expect(left.rows[0].n, `${t} still holds the old name`).toBe(0);
        const moved = await pool.query(`SELECT count(*)::int AS n FROM ${t} WHERE product = $1`, [b]);
        expect(moved.rows[0].n, `${t} did not receive the new name`).toBe(1);
      }
    });

    // The composite FK (package_id, product) -> packages(id, product) makes the two sides
    // impossible to move one at a time; Postgres refuses either order. Verified directly: the
    // un-deferred UPDATE errors with «is still referenced from table "opportunities"».
    it("moves both sides of the composite package FK together", async () => {
      const a = uniq(), b = uniq(), now = Date.now();
      await pool.query("INSERT INTO tags (name, created_at, created_by) VALUES ($1,$2,'t')", [a, now]);
      const pk = await pool.query(
        "INSERT INTO packages (product, name, list_price, years, created_at) VALUES ($1,'ب',5000,1,$2) RETURNING id", [a, now]);
      await pool.query(
        `INSERT INTO opportunities (account_name, product, stage, stage_at, sale_price, years, qty, discount, package_id, created_at, updated_at)
         VALUES ('ع',$1,'contact',$2,5000,1,1,0,$3,$2,$2)`, [a, now, pk.rows[0].id]);

      const r = await db.renameTag(a, b);
      expect(r.ok).toBe(true);
      expect(r.moved).toMatchObject({ opportunities: 1, packages: 1 });
      const joined = await pool.query(
        "SELECT o.product AS op, p.product AS pp FROM opportunities o JOIN packages p ON p.id = o.package_id WHERE p.id = $1",
        [pk.rows[0].id]);
      expect(joined.rows[0].op).toBe(b);
      expect(joined.rows[0].pp).toBe(b);   // the link survived the rename
    });

    it("returns ok:false and changes nothing for an unknown tag", async () => {
      const before = await pool.query("SELECT count(*)::int AS n FROM tags");
      const r = await db.renameTag("لا-يوجد-" + uniq(), "أيًّا-كان");
      expect(r.ok).toBe(false);
      expect(r.moved).toEqual({});
      const after = await pool.query("SELECT count(*)::int AS n FROM tags");
      expect(after.rows[0].n).toBe(before.rows[0].n);
    });
  });

  describe("R11 — the four named reports return real rows, not just empty states", () => {
    const now = () => Date.now();

    const seedBlocked = async (outcomeKey: string, dept: string, product: string) => {
      const t = now();
      await pool.query("INSERT INTO tags (name, created_at, created_by) VALUES ($1,$2,'t') ON CONFLICT DO NOTHING", [product, t]);
      const o = await pool.query(
        `INSERT INTO opportunities (account_name, product, stage, stage_at, sale_price, years, qty, discount, created_at, updated_at)
         VALUES ('عميل التقرير',$1,'negotiate',$2,100000,1,1,0,$2,$2) RETURNING id`, [product, t]);
      const oppId = Number(o.rows[0].id);
      const e = await pool.query(
        `INSERT INTO track_stage_events (opp_id, from_stage, to_stage, outcome_key, effective_at, recorded_at, actor)
         VALUES ($1,'negotiate','negotiate',$2, now() - interval '9 days', $3, 'test') RETURNING id`,
        [oppId, outcomeKey, t]);
      await pool.query(
        `INSERT INTO actions (opp_id, stage_event_id, dept, title, state, created_at)
         VALUES ($1,$2,$3,'إجراء اختبار','open',$4)`,
        [oppId, Number(e.rows[0].id), dept, t - 9 * 86400000]);
      return oppId;
    };

    it.each([
      ["awaiting-procurement", "awaiting_procurement", "المشتريات"],
      ["contract-edit", "contract_edit", "القانونية"],
      ["blocked-on-tech", "awaiting_tech", "التقنية"],
    ])("%s finds a blocked deal and counts the days", async (id, key, dept) => {
      const { reportById } = await import("../src/reports-domain.js");
      const product = "منتج-تقرير-" + key;
      const oppId = await seedBlocked(key, dept, product);
      const rows = await db.runReport(reportById(id)!);
      const mine = rows.find((r) => r.oppId === oppId);
      expect(mine, `${id} returned nothing — an empty report reads as good news`).toBeDefined();
      expect(mine!.dept).toBe(dept);
      expect(mine!.daysWaiting).toBeGreaterThanOrEqual(8);   // seeded 9 days ago
      expect(mine!.value).toBe(100000);
    });

    it("a CLOSED action leaves the report", async () => {
      const { reportById } = await import("../src/reports-domain.js");
      const oppId = await seedBlocked("contract_edit", "القانونية", "منتج-تقرير-مغلق");
      await pool.query("UPDATE actions SET state='done', done_at=$1 WHERE opp_id=$2", [Date.now(), oppId]);
      const rows = await db.runReport(reportById("contract-edit")!);
      expect(rows.find((r) => r.oppId === oppId)).toBeUndefined();
    });

    // Both integration-loss keys must land in the same report; counting one undercounts.
    it.each(["lost_integration", "integration_failed"])(
      "lost-to-integration counts a deal lost with %s", async (key) => {
        const { reportById } = await import("../src/reports-domain.js");
        const t = Date.now(), product = "منتج-خسارة-" + key;
        await pool.query("INSERT INTO tags (name, created_at, created_by) VALUES ($1,$2,'t') ON CONFLICT DO NOTHING", [product, t]);
        const o = await pool.query(
          `INSERT INTO opportunities (account_name, product, stage, stage_at, sale_price, years, qty, discount, created_at, updated_at)
           VALUES ('عميل خاسر',$1,'lost',$2,250000,2,1,0,$2,$2) RETURNING id`, [product, t]);
        const oppId = Number(o.rows[0].id);
        await pool.query(
          `INSERT INTO track_stage_events (opp_id, from_stage, to_stage, outcome_key, effective_at, recorded_at, actor)
           VALUES ($1,'negotiate','lost',$2, now() - interval '3 days', $3, 'test')`, [oppId, key, t]);
        const rows = await db.runReport(reportById("lost-to-integration")!);
        const mine = rows.find((r) => r.oppId === oppId);
        expect(mine, `a deal lost with ${key} is missing from the loss report`).toBeDefined();
        expect(mine!.value).toBe(500000);   // 250000 x 2 years
      });

    // A deal lost and then reopened must not still appear on a loss report.
    it("drops a reopened deal out of the loss report", async () => {
      const { reportById } = await import("../src/reports-domain.js");
      const t = Date.now(), product = "منتج-خسارة-معاد";
      await pool.query("INSERT INTO tags (name, created_at, created_by) VALUES ($1,$2,'t') ON CONFLICT DO NOTHING", [product, t]);
      const o = await pool.query(
        `INSERT INTO opportunities (account_name, product, stage, stage_at, sale_price, years, qty, discount, created_at, updated_at)
         VALUES ('عميل عاد',$1,'lost',$2,90000,1,1,0,$2,$2) RETURNING id`, [product, t]);
      const oppId = Number(o.rows[0].id);
      await pool.query(
        `INSERT INTO track_stage_events (opp_id, from_stage, to_stage, outcome_key, effective_at, recorded_at, actor)
         VALUES ($1,'negotiate','lost','lost_integration', now() - interval '2 days', $2, 'test')`, [oppId, t]);
      expect((await db.runReport(reportById("lost-to-integration")!)).some((r) => r.oppId === oppId)).toBe(true);
      await pool.query("UPDATE opportunities SET stage='negotiate' WHERE id=$1", [oppId]);
      expect((await db.runReport(reportById("lost-to-integration")!)).some((r) => r.oppId === oppId)).toBe(false);
    });
  });

  describe("R13 — four quarters in one pass", () => {
    const bounds = (year: number) => [1, 2, 3, 4].map((quarter) => ({
      quarter,
      startMs: Date.UTC(year, (quarter - 1) * 3, 1) - 3 * 3600e3,
      endMs: Date.UTC(year, quarter * 3, 1) - 3 * 3600e3,
    }));

    it("returns all four quarters, in order, even with no data", async () => {
      const q = await db.quarterlyPerformance(2031, bounds(2031));
      expect(q.map((x) => x.quarter)).toEqual([1, 2, 3, 4]);
      expect(q.every((x) => x.achieved === 0)).toBe(true);
    });

    it("puts a target and its win in the SAME quarter, and leaves the others alone", async () => {
      const year = 2032, t = Date.now(), product = "منتج-ربعي";
      await pool.query("INSERT INTO tags (name, created_at, created_by) VALUES ($1,$2,'t') ON CONFLICT DO NOTHING", [product, t]);
      await pool.query("INSERT INTO targets (product, year, quarter, amount, updated_at) VALUES ($1,$2,3,400000,$3)", [product, year, t]);
      const o = await pool.query(
        `INSERT INTO opportunities (account_name, product, stage, stage_at, sale_price, years, qty, discount, created_at, updated_at)
         VALUES ('ع',$1,'won',$2,300000,1,1,0,$2,$2) RETURNING id`, [product, t]);
      // mid-Q3 of that year
      await pool.query(
        `INSERT INTO track_stage_events (opp_id, from_stage, to_stage, to_stage_at, effective_at, recorded_at, actor)
         VALUES ($1,'negotiate','won',NULL, $2::timestamptz, $3, 'test')`.replace(", to_stage_at", "").replace(",NULL", ""),
        [Number(o.rows[0].id), new Date(Date.UTC(year, 7, 15)).toISOString(), t]);

      const q = await db.quarterlyPerformance(year, bounds(year));
      const q3 = q.find((x) => x.quarter === 3)!;
      expect(q3.target).toBe(400000);
      expect(q3.achieved).toBe(300000);
      expect(q3.wonCount).toBe(1);
      expect(q3.coveragePct).toBe(75);
      for (const other of q.filter((x) => x.quarter !== 3)) {
        expect(other.achieved, `Q${other.quarter} leaked`).toBe(0);
        // null, not 0 — a quarter with no target has no coverage, which is not 0% coverage.
        expect(other.coveragePct).toBeNull();
      }
    });
  });
});
