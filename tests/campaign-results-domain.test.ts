import { describe, expect, it } from "vitest";
import {
  adoptionRate, attributeHot, attributeLines, CAMPAIGN_RESULTS_DOMAIN_JS, funnelRates, handoffRate, isReachedOutcome, medianReplySeconds, summarizeResults,
} from "../src/campaign-results-domain.js";

const DAY = 86_400_000;
const T0 = 1_790_000_000_000;

describe("attributeLines (BR-MON-006)", () => {
  const campaigns = [
    { id: 1, launchedAt: T0, product: "أ", phones: ["p1", "p2"] },
    { id: 2, launchedAt: T0 + 5 * DAY, product: "أ", phones: ["p1"] },
    { id: 3, launchedAt: T0, product: "ب", phones: ["p3"], test: true },
    { id: 4, launchedAt: T0 + 2 * DAY, product: "ب", phones: ["p2"] },
    { id: 5, launchedAt: T0 + 3 * DAY, product: null, phones: ["p4"] },
  ];
  it("a WhatsApp line naming a campaign that could have reached it belongs to that campaign", () => {
    const m = attributeLines(campaigns, [{ id: 10, phone: "p1", product: "أ", source: "whatsapp", sourceRef: "1", createdAt: T0 + 6 * DAY }]);
    expect([...m.entries()]).toEqual([[1, [10]]]);
  });
  it("an unnamed WhatsApp line goes to the latest campaign that reached that phone for that product", () => {
    const m = attributeLines(campaigns, [{ id: 11, phone: "p1", product: "أ", source: "whatsapp", sourceRef: null, createdAt: T0 + 6 * DAY }]);
    expect([...m.entries()]).toEqual([[2, [11]]]);
  });
  it("a reference naming another product's campaign falls through to the right one", () => {
    const m = attributeLines(campaigns, [{ id: 12, phone: "p2", product: "أ", source: "whatsapp", sourceRef: "4", createdAt: T0 + 6 * DAY }]);
    expect([...m.entries()]).toEqual([[1, [12]]]);
  });
  it("a reference naming a rehearsal does not take the line away from a real campaign", () => {
    const m = attributeLines([...campaigns, { id: 6, launchedAt: T0 + DAY, product: "أ", phones: ["p2"], test: true }],
      [{ id: 13, phone: "p2", product: "أ", source: "whatsapp", sourceRef: "6", createdAt: T0 + 2 * DAY }]);
    expect([...m.entries()]).toEqual([[1, [13]]]);
  });
  it("calls, visits and partners are never credited, whatever their reference says", () => {
    const m = attributeLines(campaigns, [
      { id: 14, phone: "p1", product: "أ", source: "call", sourceRef: "1", createdAt: T0 + DAY },
      { id: 15, phone: "p1", product: "أ", source: "partner", sourceRef: "2", createdAt: T0 + 6 * DAY },
    ]);
    expect(m.size).toBe(0);
  });
  it("never credits a line opened before the launch, too late, or for another product", () => {
    const m = attributeLines(campaigns, [
      { id: 16, phone: "p2", product: "أ", source: "whatsapp", sourceRef: null, createdAt: T0 - 1 },
      { id: 17, phone: "p2", product: "أ", source: "whatsapp", sourceRef: null, createdAt: T0 + 31 * DAY },
      { id: 18, phone: "p1", product: "ب", source: "whatsapp", sourceRef: null, createdAt: T0 + DAY },
    ]);
    expect(m.size).toBe(0);
  });
  it("a campaign with no product credits any product", () => {
    const m = attributeLines(campaigns, [{ id: 19, phone: "p4", product: "ج", source: "whatsapp", sourceRef: null, createdAt: T0 + 4 * DAY }]);
    expect([...m.entries()]).toEqual([[5, [19]]]);
  });
});

describe("reach and hot readings", () => {
  it("only a sent (or pre-outcome) target was reached", () => {
    expect([null, undefined, "sent"].every(isReachedOutcome)).toBe(true);
    expect(["opted_out", "outside_window", "no_inbound_ever"].some(isReachedOutcome)).toBe(false);
  });
  it("one hot reading qualifies a customer in one campaign, the latest that could have produced it", () => {
    const cs = [{ id: 1, launchedAt: T0, product: "أ", phones: ["p1"] }, { id: 2, launchedAt: T0 + 5 * DAY, product: "أ", phones: ["p1"] }];
    const m = attributeHot(cs, [{ phone: "p1", product: "أ", ts: T0 + 6 * DAY }, { phone: "p1", product: "أ", ts: T0 + DAY }, { phone: "p1", product: "ب", ts: T0 + DAY }]);
    expect([...m.entries()].sort()).toEqual([[1, ["p1"]], [2, ["p1"]]]);
    expect(attributeHot(cs, [{ phone: "p1", product: "أ", ts: T0 + 6 * DAY }]).get(1)).toBeUndefined();
  });
});

describe("summarizeResults", () => {
  it("counts customers once per step; a customer with an opportunity was qualified on the way", () => {
    const r = summarizeResults(["p3"], [
      { id: 1, phone: "p1", stage: "won", value: 1000 },
      { id: 2, phone: "p1", stage: "lost", value: 500 },
      { id: 3, phone: "p2", stage: "contact", value: 300 },
    ], [1, 3], [1]);
    expect(r).toEqual({ qualified: 3, opportunities: 2, meetings: 2, quotes: 1, won: 1, wonLines: 1, closedLines: 2, revenue: 1000, openValue: 300 });
  });
});

describe("rates (§23)", () => {
  it("follow the BRD's definitions and say «—» over nothing", () => {
    expect(funnelRates({ sent: 40, read: 30, replied: 10, interested: 8, qualified: 4, opportunities: 3, wonLines: 1, closedLines: 2 }))
      .toEqual({ readRate: 75, replyRate: 25, interestRate: 20, qualificationRate: 50, opportunityConversion: 75, winRate: 50 });
    expect(funnelRates({ sent: 0, read: 0, replied: 0, interested: 0, qualified: 0, opportunities: 0, wonLines: 0, closedLines: 0 }))
      .toEqual({ readRate: null, replyRate: null, interestRate: null, qualificationRate: null, opportunityConversion: null, winRate: null });
  });
  it("a numerator larger than its denominator is no rate, never a capped 100", () => {
    expect(funnelRates({ sent: 2, read: 5, replied: 0, interested: 3, qualified: 5, opportunities: 0, wonLines: 0, closedLines: 0 }))
      .toMatchObject({ readRate: null, qualificationRate: null, replyRate: 0 });
  });
  it("handoff rate", () => { expect(handoffRate(3, 12)).toBe(25); expect(handoffRate(1, 0)).toBeNull(); });
  it("adoption is over decided suggestions", () => { expect(adoptionRate(1, 3)).toBe(25); expect(adoptionRate(0, 0)).toBeNull(); });
  it("median reply time pairs each customer message with the next agent reply in the same thread", () => {
    const m = [
      { phone: "a", role: "customer", ts: 0 }, { phone: "a", role: "customer", ts: 5000 }, { phone: "a", role: "agent", ts: 10_000 },
      { phone: "b", role: "customer", ts: 0 }, { phone: "b", role: "agent", ts: 30_000 },
      { phone: "c", role: "customer", ts: 0 }, { phone: "c", role: "agent", ts: 3_600_000 },
      { phone: "d", role: "customer", ts: 0 },
    ];
    expect(medianReplySeconds(m)).toBe(20);
    expect(medianReplySeconds([])).toBeNull();
  });
  it("an unanswered night does not swallow the next morning's prompt reply", () => {
    expect(medianReplySeconds([{ phone: "a", role: "customer", ts: 0 }, { phone: "a", role: "customer", ts: 8 * 3_600_000 }, { phone: "a", role: "agent", ts: 8 * 3_600_000 + 40_000 }])).toBe(40);
  });
  it("the page runs the same rules", () => {
    const page = new Function(CAMPAIGN_RESULTS_DOMAIN_JS + "; return { funnelRates, handoffRate };")();
    const c = { sent: 9, read: 3, replied: 2, interested: 1, qualified: 3, opportunities: 1, wonLines: 0, closedLines: 0 };
    expect(page.funnelRates(c)).toEqual(funnelRates(c));
  });
});
