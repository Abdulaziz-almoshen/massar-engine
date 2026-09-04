import { describe, it, expect } from "vitest";
import {
  countPotentialClientsAcross,
  countPotentialClientsByProduct,
  type InterestLine,
} from "../src/interest.js";
import { CONFIRMED_INTEREST_STAGES, isConfirmedInterestStage } from "../src/opps-domain.js";
import { SERVICE_CATALOGUE } from "../src/insights.js";

const SICK = "الإجازات المرضية";
const NVR = "خدمات التطعيمات";

const line = (over: Partial<InterestLine>): InterestLine => ({
  account_name: "مستشفى الأمل",
  phone: "966500000001",
  product: SICK,
  stage: "tech",
  sale_price: 100000,
  years: 1,
  qty: 1,
  discount: 0,
  ...over,
});

const clientsFor = (lines: InterestLine[], product: string): number =>
  countPotentialClientsByProduct(lines).products.find((p) => p.product === product)?.clients ?? -1;

describe("isConfirmedInterestStage", () => {
  it("accepts exactly التقييم الفني والمالي and التفاوض والاعتماد", () => {
    expect(isConfirmedInterestStage("tech")).toBe(true);
    expect(isConfirmedInterestStage("negotiate")).toBe(true);
  });

  it("rejects the stages below it — interest that is still only a conversation", () => {
    expect(isConfirmedInterestStage("contact")).toBe(false);
    expect(isConfirmedInterestStage("present")).toBe(false);
  });

  // The single most consequential exclusion in this feature: a won deal is a CUSTOMER. Folding it
  // into «العملاء المحتملون» would tell a product manager there is pipeline where there is revenue.
  it("rejects won — a closed deal is a customer, not a prospect", () => {
    expect(isConfirmedInterestStage("won")).toBe(false);
  });

  it("rejects lost", () => {
    expect(isConfirmedInterestStage("lost")).toBe(false);
  });

  it("stays in step with the exported stage list", () => {
    expect([...CONFIRMED_INTEREST_STAGES].every(isConfirmedInterestStage)).toBe(true);
  });
});

describe("countPotentialClientsByProduct", () => {
  it("emits every catalogue product, at zero, when nothing is in the pipeline", () => {
    const feed = countPotentialClientsByProduct([]);
    expect(feed.products.map((p) => p.product)).toEqual([...SERVICE_CATALOGUE]);
    expect(feed.products.every((p) => p.clients === 0 && p.inCatalogue)).toBe(true);
    expect(feed.totalClients).toBe(0);
  });

  it("counts a confirmed-interest line", () => {
    expect(clientsFor([line({})], SICK)).toBe(1);
  });

  it("ignores lines below the bar, and won and lost", () => {
    const lines = [
      line({ phone: "1", stage: "contact" }),
      line({ phone: "2", stage: "present" }),
      line({ phone: "3", stage: "won" }),
      line({ phone: "4", stage: "lost" }),
    ];
    expect(clientsFor(lines, SICK)).toBe(0);
    expect(countPotentialClientsByProduct(lines).totalClients).toBe(0);
  });

  // The rule this module exists for. Two lines, one hospital, one product — one client.
  it("counts one client once, however many lines they have on the same product", () => {
    const lines = [
      line({ phone: "966500000001", stage: "tech" }),
      line({ phone: "966500000001", stage: "negotiate" }),
    ];
    expect(clientsFor(lines, SICK)).toBe(1);
  });

  it("counts one client per product they are evaluating", () => {
    const lines = [
      line({ phone: "966500000001", product: SICK }),
      line({ phone: "966500000001", product: NVR }),
    ];
    const feed = countPotentialClientsByProduct(lines);
    expect(feed.products.find((p) => p.product === SICK)?.clients).toBe(1);
    expect(feed.products.find((p) => p.product === NVR)?.clients).toBe(1);
    // …and ONE client overall. Summing the column would say two, which is why totalClients is
    // computed over the same identity set rather than added up from the rows.
    expect(feed.totalClients).toBe(1);
  });

  it("separates two different hospitals on one product", () => {
    const lines = [line({ phone: "966500000001" }), line({ phone: "966500000002" })];
    expect(clientsFor(lines, SICK)).toBe(2);
  });

  // A line recorded after a visit has no WhatsApp number at all; identity falls back to the name,
  // exactly as «فرص البيع» groups its cards.
  it("identifies a phoneless account by name", () => {
    const lines = [
      line({ phone: null, account_name: "مجمع النور", stage: "tech" }),
      line({ phone: null, account_name: "مجمع النور", stage: "negotiate" }),
      line({ phone: null, account_name: "مجمع الشفاء", stage: "tech" }),
    ];
    expect(clientsFor(lines, SICK)).toBe(2);
  });

  it("does not merge a phoneless account into a phoned one with the same name", () => {
    const lines = [
      line({ phone: null, account_name: "مجمع النور" }),
      line({ phone: "966500000009", account_name: "مجمع النور" }),
    ];
    expect(clientsFor(lines, SICK)).toBe(2);
  });

  it("reports an off-catalogue product only when it carries someone, and flags it", () => {
    const feed = countPotentialClientsByProduct([line({ product: "باقة NVR لثمانية مواقع" })]);
    const off = feed.products.find((p) => !p.inCatalogue);
    expect(off).toEqual({
      product: "باقة NVR لثمانية مواقع",
      clients: 1,
      deals: 1,
      value: 100000,
      unpriced: 0,
      inCatalogue: false,
    });
    // …and it never displaces the six that matter, which stay first and complete.
    expect(feed.products.slice(0, SERVICE_CATALOGUE.length).map((p) => p.product)).toEqual([
      ...SERVICE_CATALOGUE,
    ]);
  });

  it("skips a blank product rather than opening a nameless row", () => {
    const feed = countPotentialClientsByProduct([line({ product: "   " })]);
    expect(feed.products.every((p) => p.inCatalogue)).toBe(true);
    expect(feed.totalClients).toBe(0);
  });

  it("trims a product name so trailing whitespace is not a second product", () => {
    expect(clientsFor([line({ product: SICK + " " })], SICK)).toBe(1);
  });
});

describe("countPotentialClientsAcross", () => {
  it("is a union, not a sum — one client on two products counts once", () => {
    const lines = [
      line({ phone: "966500000001", product: SICK }),
      line({ phone: "966500000001", product: NVR }),
    ];
    const feed = countPotentialClientsByProduct(lines);
    const naiveSum = feed.products
      .filter((p) => p.product === SICK || p.product === NVR)
      .reduce((n, p) => n + p.clients, 0);
    expect(naiveSum).toBe(2); // what a caller adding the column up would have shown
    expect(countPotentialClientsAcross(lines, [SICK, NVR]).clients).toBe(1); // the truth
  });

  it("adds up when the clients really are different people", () => {
    const lines = [
      line({ phone: "966500000001", product: SICK }),
      line({ phone: "966500000002", product: NVR }),
    ];
    expect(countPotentialClientsAcross(lines, [SICK, NVR]).clients).toBe(2);
  });

  it("counts only the products asked for", () => {
    const lines = [
      line({ phone: "966500000001", product: SICK }),
      line({ phone: "966500000002", product: NVR }),
    ];
    expect(countPotentialClientsAcross(lines, [SICK]).clients).toBe(1);
  });

  it("applies the same stage bar", () => {
    const lines = [line({ product: SICK, stage: "won" }), line({ product: NVR, stage: "present" })];
    expect(countPotentialClientsAcross(lines, [SICK, NVR]).clients).toBe(0);
  });

  it("is zero for an empty or blank selection rather than counting everyone", () => {
    const lines = [line({})];
    expect(countPotentialClientsAcross(lines, []).clients).toBe(0);
    expect(countPotentialClientsAcross(lines, ["  "]).clients).toBe(0);
  });
});

// The founder cross-checked the Makeen tile against the Massar list and read 4 where the dashboard
// said 3. Neither was wrong: مستشفى الأمل holds TWO deals on الإجازات المرضية, so the board's row
// count and the client count are different questions. Both are now reported side by side.
describe("deals and pipeline value alongside clients", () => {
  const board: InterestLine[] = [
    line({ account_name: "مستشفى الأمل", phone: "1", stage: "negotiate", sale_price: 120000 }),
    line({ account_name: "مستشفى الأمل", phone: "1", stage: "tech", sale_price: 100000 }),
    line({ account_name: "مستشفى السلام", phone: "2", stage: "negotiate", sale_price: 90000 }),
    line({ account_name: "مجمع النور", phone: null, stage: "tech", sale_price: 70000 }),
  ];

  it("reports 3 clients and 4 deals for the same rows", () => {
    const sick = countPotentialClientsByProduct(board).products.find((p) => p.product === SICK)!;
    expect(sick.clients).toBe(3);
    expect(sick.deals).toBe(4);
  });

  it("sums the pipeline with Massar's own money rule", () => {
    const sick = countPotentialClientsByProduct(board).products.find((p) => p.product === SICK)!;
    expect(sick.value).toBe(380000);
    expect(sick.unpriced).toBe(0);
  });

  it("applies years, quantity and discount rather than reading sale_price raw", () => {
    const l = [line({ sale_price: 100000, years: 2, qty: 3, discount: 10 })];
    // 100000 × 2 × 3 × 0.9
    expect(countPotentialClientsByProduct(l).products.find((p) => p.product === SICK)!.value).toBe(540000);
  });

  // «٠ ر.س» would claim a deal is worth nothing when nobody has priced it yet.
  it("counts an unpriced deal without letting it drag the value to zero", () => {
    const l = [line({ sale_price: 0, phone: "9" }), line({ sale_price: 50000, phone: "8" })];
    const sick = countPotentialClientsByProduct(l).products.find((p) => p.product === SICK)!;
    expect(sick.deals).toBe(2);
    expect(sick.unpriced).toBe(1);
    expect(sick.value).toBe(50000);
  });

  it("keeps deals additive while clients union, across a subset", () => {
    const mixed = [...board, line({ account_name: "مستشفى الأمل", phone: "1", product: NVR, stage: "negotiate", sale_price: 80000 })];
    const sel = countPotentialClientsAcross(mixed, [SICK, NVR]);
    expect(sel.clients).toBe(3);   // الأمل counted once
    expect(sel.deals).toBe(5);     // …but both of its deals counted
    expect(sel.value).toBe(460000);
  });

  it("excludes won and lost from the money too", () => {
    const l = [line({ stage: "won", sale_price: 999999 }), line({ stage: "lost", sale_price: 888888 })];
    const sick = countPotentialClientsByProduct(l).products.find((p) => p.product === SICK)!;
    expect(sick.deals).toBe(0);
    expect(sick.value).toBe(0);
  });
});
