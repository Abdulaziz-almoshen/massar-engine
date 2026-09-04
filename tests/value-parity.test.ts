import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { calculateLineValue } from "../src/opps-domain.js";
import { OPP_VALUE_SQL } from "../src/db.js";

// «قيمة الفرصة» EXISTS TWICE AND CANNOT EXIST ONCE.
//
// calculateLineValue runs in TypeScript, in the browser, to print a card. OPP_VALUE_SQL runs in
// Postgres, to sum a board. Neither can call the other, so "one code path" is not achievable and
// pretending otherwise is how the two drift. What IS achievable is a proof that they answer the
// same, driven from the same inputs — this file is that proof, and it is the closure of R18.
//
// It already caught one: the SQL summed UNROUNDED line values while the UI rounded each line, so
// three deals at a 50% discount on an odd price totalled 57 on «فرص البيع» and 56 on «المستهدفات
// والأداء». The rounding boundary is now the line, on both sides.
const URL_ = process.env.TEST_DATABASE_URL;
const d = URL_ ? describe : describe.skip;

// price, qty, years, discount% — chosen to land ON integers, OFF them, and exactly on the .5 tie
// where two languages are most likely to disagree.
const CASES: [number, number, number, number][] = [
  [18000, 1, 1, 0], [95000, 1, 1, 0], [18000, 3, 2, 15],
  [1, 1, 1, 33], [7, 1, 1, 50], [3, 1, 1, 50], [101, 1, 1, 50],
  [333, 1, 1, 33], [12345, 7, 3, 17], [999, 1, 1, 99],
  [0, 1, 1, 0], [1000, 1, 1, 100], [50, 3, 1, 50],
];

let pool: pg.Pool;
const sqlValue = async (p: number, q: number, y: number, disc: number): Promise<number> => {
  const r = await pool.query(
    `SELECT ${OPP_VALUE_SQL} AS v
       FROM (SELECT $1::bigint AS sale_price, $2::int AS qty, $3::int AS years, $4::int AS discount) o`,
    [p, q, y, disc]);
  return Number(r.rows[0].v);
};

d("«قيمة الفرصة» — TypeScript and SQL agree", () => {
  beforeAll(() => { pool = new pg.Pool({ connectionString: URL_ }); });
  afterAll(async () => { await pool?.end(); });

  it.each(CASES)("price %i x qty %i x %i years, -%i%%", async (price, qty, years, disc) => {
    const ts = calculateLineValue({ salePrice: price, quantity: qty, years, discountPercent: disc } as never);
    expect(await sqlValue(price, qty, years, disc)).toBe(ts);
  });

  // The regression itself: a board total must equal the sum of the cards it is a total OF.
  it("a board total equals the sum of the card totals, on .5 boundaries", async () => {
    const lines: [number, number, number, number][] = [[7, 1, 1, 50], [3, 1, 1, 50], [101, 1, 1, 50]];
    const cards = lines.reduce((n, [p, q, y, dd]) =>
      n + calculateLineValue({ salePrice: p, quantity: q, years: y, discountPercent: dd } as never), 0);
    const vals = lines.map(([p, q, y, dd]) => `(${p}::bigint, ${q}::int, ${y}::int, ${dd}::int)`).join(",");
    const r = await pool.query(
      `SELECT SUM(${OPP_VALUE_SQL}) AS total
         FROM (VALUES ${vals}) AS o(sale_price, qty, years, discount)`);
    expect(Number(r.rows[0].total)).toBe(cards);
    expect(cards).toBe(57);   // pinned: this read 56 from the board before the fix
  });
});
