import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import pg from "pg";
import * as sales from "../src/sales-domain.js";

// «المنتجات» V5 — the SQL that cannot be unit-tested, against a real Postgres.
//
// What is asserted here is the eligibility rule AS THE DATABASE ENFORCES IT: a draft never reaches
// runtimeKb(), a legacy row never does until a human approves the exact bytes, an archived product
// leaves both the knowledge and the asset list, and the performance query sums open value
// UNWEIGHTED over priced lines only. Every one of these passes trivially against an empty table,
// which is why they are exercised against rows.
//
// Runs only with TEST_DATABASE_URL (see tests/db.integration.test.ts for the guards and why).
const URL_ = process.env.TEST_DATABASE_URL;
const d = URL_ ? describe : describe.skip;

let pool: pg.Pool;
let db: typeof import("../src/db.js");

const P = "v5-منتج الاختبار";
const P2 = "v5-منتج آخر";
const STRAY = "v5-ملف بلا منتج";

d("products v5 (db)", () => {
  beforeAll(async () => {
    if (!/localhost|127\.0\.0\.1/.test(URL_!)) throw new Error("TEST_DATABASE_URL must be local");
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
    // Only this suite's own rows — every product it touches carries the v5- prefix, so the other
    // integration file's fixtures are never disturbed.
    await pool.query("DELETE FROM opportunities WHERE product LIKE 'v5-%'");
    for (const t of ["targets", "packages", "product_kb", "product_assets", "product_meta"]) {
      await pool.query(`DELETE FROM ${t} WHERE product LIKE 'v5-%'`);
    }
    await pool.query("DELETE FROM tags WHERE name LIKE 'v5-%'");
  });

  const create = (name: string, over: Partial<Parameters<typeof db.createProduct>[0]> = {}) =>
    db.createProduct({ name, sectorId: null, owner: null, pricingNote: null, firstPackage: null, ...over }, "test");

  it("createProduct is ONE transaction: tag + meta + package land together, a collision writes nothing", async () => {
    expect(await create(P, { owner: "سارة", firstPackage: { name: "أساسية", listPrice: 1000, years: 1, scope: null } })).toBe("ok");
    expect((await pool.query("SELECT 1 FROM tags WHERE name = $1", [P])).rowCount).toBe(1);
    expect((await pool.query("SELECT owner FROM product_meta WHERE product = $1", [P])).rows[0].owner).toBe("سارة");
    expect((await pool.query("SELECT 1 FROM packages WHERE product = $1 AND name = 'أساسية'", [P])).rowCount).toBe(1);

    expect(await create(P, { firstPackage: { name: "ثانية", listPrice: 5, years: 1, scope: null } })).toBe("exists");
    expect((await pool.query("SELECT 1 FROM packages WHERE product = $1 AND name = 'ثانية'", [P])).rowCount).toBe(0);

    // An unknown sector rolls the TAG back too — no half-product.
    expect(await create(P2, { sectorId: 999999 })).toBe("unknown_sector");
    expect((await pool.query("SELECT 1 FROM tags WHERE name = $1", [P2])).rowCount).toBe(0);
  });

  it("patchProductMeta changes only the fields sent, and a sent sector clears the guess", async () => {
    await create(P);
    await pool.query("UPDATE product_meta SET sector_assumed = true, pricing_note = 'قديم' WHERE product = $1", [P]);
    await db.patchProductMeta(P, { owner: "أحمد" });
    let m = (await pool.query("SELECT owner, sector_assumed, pricing_note FROM product_meta WHERE product = $1", [P])).rows[0];
    expect(m.owner).toBe("أحمد"); expect(m.sector_assumed).toBe(true); expect(m.pricing_note).toBe("قديم");

    const sectorId = Number((await pool.query("SELECT id FROM sectors ORDER BY id LIMIT 1")).rows[0].id);
    await db.patchProductMeta(P, { sectorId, pricingNote: null });
    m = (await pool.query("SELECT owner, sector_id, sector_assumed, pricing_note FROM product_meta WHERE product = $1", [P])).rows[0];
    expect(Number(m.sector_id)).toBe(sectorId); expect(m.sector_assumed).toBe(false);
    expect(m.pricing_note).toBeNull(); expect(m.owner).toBe("أحمد");
  });

  it("upload writes a DRAFT the assistant never reads; approve needs the exact hash", async () => {
    await create(P);
    await db.saveKb(P, "# نص\nسطر", "deck.pdf", "اللوحة");
    const row = (await db.knowledgeOf(P))!;
    expect(row.md).toBe("");
    expect(row.draft_md).toBe("# نص\nسطر");
    expect(row.draft_by).toBe("اللوحة");
    expect((await db.runtimeKb()).map((k) => k.product)).not.toContain(P);

    expect(await db.approveKbDraft(P, "0".repeat(64), "x")).toBe("stale");
    expect((await db.runtimeKb()).map((k) => k.product)).not.toContain(P);
    expect(await db.approveKbDraft(P, db.sha256Hex("# نص\nسطر"), "المدير")).toBe("ok");
    const after = (await db.knowledgeOf(P))!;
    expect(after.md).toBe("# نص\nسطر");
    expect(after.source_filename).toBe("deck.pdf");
    expect(after.approved_by).toBe("المدير");
    expect(after.draft_md).toBeNull();
    expect((await db.runtimeKb()).map((k) => k.product)).toContain(P);
    expect(await db.approveKbDraft(P, db.sha256Hex("# نص\nسطر"), "x")).toBe("no_draft");
  });

  it("a legacy row (approved_at NULL) is NOT runtime knowledge until approve-current matches its bytes", async () => {
    await create(P);
    await pool.query("INSERT INTO product_kb (product, md, updated_at) VALUES ($1, '# قديم', 1)", [P]);
    expect((await db.runtimeKb()).map((k) => k.product)).not.toContain(P);
    expect(await db.approveKbCurrent(P, db.sha256Hex("# قديم "), "x")).toBe("stale");
    expect(await db.approveKbCurrent(P2, db.sha256Hex("# قديم"), "x")).toBe("no_knowledge");
    expect(await db.approveKbCurrent(P, db.sha256Hex("# قديم"), "x")).toBe("ok");
    expect((await db.runtimeKb()).map((k) => k.product)).toContain(P);
  });

  it("archive removes a product from runtime knowledge AND assets; restore brings both back", async () => {
    await create(P);
    await db.saveKb(P, "# م", "a.pdf");
    await db.approveKbDraft(P, db.sha256Hex("# م"), "x");
    await db.saveAsset(P, "pid-v5", "a.pdf", "application/pdf", Buffer.from("%PDF"));
    expect((await db.runtimeAssets([])).map((a) => a.product)).toContain(P);
    await db.setArchived(P, true);
    expect((await db.runtimeKb()).map((k) => k.product)).not.toContain(P);
    expect((await db.runtimeAssets([])).map((a) => a.product)).not.toContain(P);
    expect(await db.activeTagNames()).not.toContain(P);
    await db.setArchived(P, false);
    expect((await db.runtimeKb()).map((k) => k.product)).toContain(P);
    expect((await db.runtimeAssets([])).map((a) => a.product)).toContain(P);
  });

  it("runtimeAssets: an asset with no approved knowledge ships only for an embedded product", async () => {
    await create(P);
    await db.saveAsset(P, "pid-v5b", "a.pdf", "application/pdf", Buffer.from("%PDF"));
    expect((await db.runtimeAssets([])).map((a) => a.product)).not.toContain(P);
    expect((await db.runtimeAssets([P])).map((a) => a.product)).toContain(P);
  });

  it("discard drops the draft, and drops the row when nothing approved remains", async () => {
    await create(P);
    await db.saveKb(P, "# مسودة", "d.pdf");
    expect(await db.discardKbDraft(P)).toBe(true);
    expect(await db.knowledgeOf(P)).toBeNull();
    expect(await db.discardKbDraft(P)).toBe(false);
  });

  it("productPerformance: open is UNWEIGHTED and priced-only; achieved follows the latest transition into won", async () => {
    await create(P);
    const rows = await db.createOppLines(
      { account_name: "مستشفى", phone: null, source: "call", source_ref: null, created_by: "test" },
      [
        { product: P, sale_price: 4200, years: 1, qty: 1, discount: 0 } as never,
        { product: P, sale_price: 0 } as never,
        { product: P, sale_price: 10000, years: 2, qty: 1, discount: 10 } as never,
      ]);
    expect(rows.length).toBe(3);
    await db.updateOpp(rows[2].id, { stage: "won" } as never, "test");
    await db.updateOpp(rows[1].id, { stage: "lost", lost_reason: "x" } as never, "test");
    const now = sales.riyadhFiscalPeriod(Date.now(), 1);
    const bounds = [1, 2, 3, 4].map((quarter) => ({ quarter, ...sales.riyadhPeriodBounds(now.year, quarter, 1) }));
    await pool.query("INSERT INTO targets (product, year, quarter, amount, updated_at) VALUES ($1,$2,3,34000,1)", [P, now.year]);
    const perf = (await db.productPerformance(now.year, bounds)).find((r) => r.product === P)!;
    expect(perf.openValue).toBe(4200);        // the discounted 18,000 line is won, not open; no weight applied
    expect(perf.openLines).toBe(1);
    expect(perf.unpricedOpenLines).toBe(0);   // the unpriced line is lost now
    expect(perf.achieved).toBe(18000);        // 10000 × 2 × 0.9
    expect(perf.wonLines).toBe(1);
    expect(perf.lostLines).toBe(1);
    expect(perf.annualTarget).toBe(34000);
    expect(perf.targetQuarters).toBe(1);
    expect(perf.quarters.map((q) => q.target)).toEqual([null, null, 34000, null]);
    expect(perf.quarters.reduce((n, q) => n + q.achieved, 0)).toBe(18000);
    expect(perf.quarters[now.quarter - 1].achieved).toBe(18000);

    // Won then corrected back to open: the money leaves «المحقق» and returns to open, once.
    await db.updateOpp(rows[2].id, { stage: "negotiate" } as never, "test");
    const perf2 = (await db.productPerformance(now.year, bounds)).find((r) => r.product === P)!;
    expect(perf2.achieved).toBe(0);
    expect(perf2.openValue).toBe(4200 + 18000);
    expect(perf2.openLines).toBe(2);
  });

  it("reconcileFile moves a stray kb row whole and refuses an occupied target", async () => {
    await create(P);
    await pool.query(
      `INSERT INTO product_kb (product, md, source_filename, updated_at, approved_at, draft_md) VALUES ($1, '# غ', 's.pdf', 1, 1, 'مسودة')`, [STRAY]);
    expect((await db.unmatchedFiles()).map((u) => u.name)).toContain(STRAY);
    expect(await db.reconcileFile("لا شيء", P, "kb")).toBe("unknown_source");
    expect(await db.reconcileFile(STRAY, P, "kb")).toBe("ok");
    const moved = (await db.knowledgeOf(P))!;
    expect(moved.md).toBe("# غ"); expect(moved.draft_md).toBe("مسودة"); expect(moved.approved_at).toBe(1);
    expect((await db.unmatchedFiles()).map((u) => u.name)).not.toContain(STRAY);
    await pool.query(`INSERT INTO product_kb (product, md, updated_at) VALUES ($1, 'x', 1)`, [STRAY]);
    expect(await db.reconcileFile(STRAY, P, "kb")).toBe("target_has");
    expect((await db.knowledgeOf(P))!.md).toBe("# غ");
  });

  it("productReferences sees every table; deleteTarget removes a row; updatePackage keeps the id", async () => {
    await create(P, { firstPackage: { name: "أ", listPrice: 1, years: 1, scope: null } });
    await create(P2);
    await pool.query("INSERT INTO targets (product, year, quarter, amount, updated_at) VALUES ($1,2030,1,5,1)", [P]);
    const refs = await db.productReferences(P);
    expect(refs.counts).toEqual({ targets: 1, packages: 1 });
    expect((await db.productReferences(P2)).total).toBe(0);
    expect(await db.deleteTarget(P, 2030, 1)).toBe(true);
    expect(await db.deleteTarget(P, 2030, 1)).toBe(false);

    const id = Number((await pool.query("SELECT id FROM packages WHERE product = $1", [P])).rows[0].id);
    await pool.query("INSERT INTO packages (product, name, list_price, years, created_at) VALUES ($1,'ب',2,1,1)", [P]);
    expect(await db.updatePackage(id, { name: "ب", listPrice: 1, years: 1, scope: null })).toBe("name_exists");
    const upd = await db.updatePackage(id, { name: "أ+", listPrice: 9, years: 3, scope: "فرع" });
    expect(upd).toMatchObject({ id, name: "أ+", listPrice: 9, years: 3, scope: "فرع" });
    expect(await db.updatePackage(999999, { name: "x", listPrice: 1, years: 1, scope: null })).toBeNull();
  });
});
