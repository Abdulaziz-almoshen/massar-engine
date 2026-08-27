// interest.ts — «العملاء المحتملون لكل منتج»: the ONE aggregation behind the integration feed
// that Makeen's product dashboard reads.
//
// WHY THIS FILE EXISTS. Makeen (the product-management side of the house) wants to show, next to
// each product it is building, how many real buyers Massar is already holding for it. That number
// is not a row count. Two facts make it a rule rather than a query:
//
//   1. A CLIENT IS NOT A LINE. One hospital that asked about الإجازات المرضية twice — a visit in
//      March and a WhatsApp campaign in August — is ONE potential client, not two. Counting rows
//      would inflate every product by exactly the accounts that are most engaged with it, which is
//      the worst possible direction for a number a product manager uses to prioritise.
//   2. IDENTITY IS ALREADY DEFINED. `accountKey` in opps-domain.ts is what «فرص البيع» groups a
//      card by. Re-deriving identity here would let the board and this feed disagree about how many
//      clients exist, and the board is the one the founder looks at. So it is imported, never
//      re-implemented.
//
// SERVER-ONLY, on purpose. This is not in `DOMAIN_FNS`: nothing on the sales board renders it, so
// shipping it to the browser would widen the closure contract (ADR-0001) for no reader.
import { accountKey, calculateLineValue, isConfirmedInterestStage, isLinePriced } from "./opps-domain.js";
import { SERVICE_CATALOGUE } from "./insights.js";

/** The stored columns this aggregation reads, and nothing else — structural rather than the full
 *  `OppRow`, so the rule can be exercised without constructing eighteen irrelevant fields. */
export type InterestLine = {
  account_name: string;
  phone: string | null;
  product: string;
  stage: string;
  // The pricing columns, optional because the CLIENT count never needs them. Absent means the
  // line contributes to `deals` and to `unpriced`, never to `value`.
  sale_price?: number;
  years?: number;
  qty?: number;
  discount?: number;
};

export type ProductInterest = {
  /** The Massar catalogue name, verbatim — this is the key Makeen maps its own products onto. */
  product: string;
  /** Distinct accounts at a confirmed-interest stage for this product. */
  clients: number;
  /**
   * Open deal LINES, which is a different number from `clients` and deliberately reported beside
   * it. One hospital may hold two deals on one product, and a reader cross-checking this against
   * the Massar board counts rows — so a dashboard that published only the client count made the
   * two systems look like they disagreed. They never did; they were answering different questions.
   */
  deals: number;
  /** Pipeline value of the priced deals, via Massar's own `calculateLineValue`. */
  value: number;
  /** Deals carrying no price. «٠ ر.س» would claim a deal is worth nothing when the truth is that
   *  nobody has priced it, so they are counted here and excluded from `value`. */
  unpriced: number;
  /** True when the name is one of the six catalogue entries. A false here is a data-quality signal
   *  for the sales side, and it tells Makeen not to offer the row as a mapping target. */
  inCatalogue: boolean;
};

export type InterestFeed = {
  /** Every catalogue product, then any off-catalogue product that actually carries clients. */
  products: ProductInterest[];
  /** Distinct accounts at a confirmed-interest stage across ALL products. Deliberately NOT the sum
   *  of `clients`: one hospital evaluating both الإجازات المرضية and خدمات التطعيمات is two product
   *  rows and one client, and a reader who adds the column up would otherwise double-count them. */
  totalClients: number;
};

/** Deals + money for a set of lines. Split out because the per-product pass and the subset pass
 *  must agree to the riyal, and two copies of this arithmetic would eventually not. */
function tally(lines: readonly InterestLine[]): { deals: number; value: number; unpriced: number } {
  let deals = 0;
  let value = 0;
  let unpriced = 0;
  for (const line of lines) {
    deals++;
    const facts = {
      stage: line.stage,
      salePrice: Number(line.sale_price) || 0,
      years: Number(line.years) || 1,
      quantity: Number(line.qty) || 1,
      discountPercent: Number(line.discount) || 0,
      stageEnteredAt: 0,
    };
    if (isLinePriced(facts)) value += calculateLineValue(facts);
    else unpriced++;
  }
  return { deals, value, unpriced };
}

/**
 * Distinct confirmed-interest clients per product.
 *
 * Every catalogue entry is emitted even at zero. An absent key and a zero are different claims —
 * "no demand recorded" is an answer, "we have no idea" is not — and a consumer that has to guess
 * which one a missing key meant will guess wrong on the day it matters.
 */
export function countPotentialClientsByProduct(lines: readonly InterestLine[]): InterestFeed {
  const byProduct = new Map<string, { keys: Set<string>; lines: InterestLine[] }>();
  const everyone = new Set<string>();
  const catalogue = SERVICE_CATALOGUE as readonly string[];

  for (const product of catalogue) byProduct.set(product, { keys: new Set<string>(), lines: [] });

  for (const line of lines) {
    if (!isConfirmedInterestStage(line.stage)) continue;
    const product = String(line.product || "").trim();
    if (!product) continue;
    const key = accountKey(line.account_name, line.phone);
    let bucket = byProduct.get(product);
    if (!bucket) {
      bucket = { keys: new Set<string>(), lines: [] };
      byProduct.set(product, bucket);
    }
    bucket.keys.add(key);
    bucket.lines.push(line);
    everyone.add(key);
  }

  const products: ProductInterest[] = [];
  for (const product of catalogue) {
    const b = byProduct.get(product)!;
    products.push({ product, clients: b.keys.size, ...tally(b.lines), inCatalogue: true });
  }
  // Off-catalogue names are reported only when they carry someone. Listing every historical typo at
  // zero would bury the six rows that matter under noise nobody is going to clean up.
  for (const [product, b] of byProduct) {
    if (catalogue.includes(product)) continue;
    if (b.keys.size === 0) continue;
    products.push({ product, clients: b.keys.size, ...tally(b.lines), inCatalogue: false });
  }

  return { products, totalClients: everyone.size };
}

/**
 * Distinct confirmed-interest clients across a CHOSEN SUBSET of products.
 *
 * WHY THIS IS NOT A SUM. Makeen may confirm that one of its products sells as two catalogue lines —
 * a platform that covers both الإجازات المرضية and الشهادات الصحية, say. Adding the two per-product
 * counts would count twice every hospital evaluating both, and that hospital is by definition the
 * most engaged one on the board: the error is largest exactly where the number is most consulted.
 *
 * The subset has to be resolved HERE because only this side holds account identity. Sending the
 * identities out so the caller could union them itself would turn an aggregate-only feed into a
 * customer-list feed, which is the one thing `/integration/*` promises never to be.
 */
export function countPotentialClientsAcross(
  lines: readonly InterestLine[],
  products: readonly string[],
): { clients: number; deals: number; value: number; unpriced: number } {
  const wanted = new Set(products.map((p) => String(p || "").trim()).filter(Boolean));
  if (wanted.size === 0) return { clients: 0, deals: 0, value: 0, unpriced: 0 };
  const seen = new Set<string>();
  const matched: InterestLine[] = [];
  for (const line of lines) {
    if (!isConfirmedInterestStage(line.stage)) continue;
    if (!wanted.has(String(line.product || "").trim())) continue;
    seen.add(accountKey(line.account_name, line.phone));
    matched.push(line);
  }
  // deals ADD across products (a deal belongs to exactly one product line) while clients UNION.
  // That asymmetry is the whole point of reporting both.
  return { clients: seen.size, ...tally(matched) };
}
