import { describe, expect, it } from "vitest";
import {
  ACCEPTANCE_DOMAIN_JS, acceptanceTotals, checkAcceptanceDomainClosure, productAcceptance,
} from "../src/acceptance-domain.js";

const isWon = (s: string) => s === "won";
const isLost = (s: string) => s === "lost";
const L = (product: string, stage: string, lostReason?: string) => ({ product, stage, lostReason });

describe("productAcceptance", () => {
  it("a product with no decided deal is «لم تُبع بعد», however many are open", () => {
    const rows = productAcceptance([L("أ", "contact"), L("أ", "negotiate"), L("أ", "demo")], [], isWon, isLost);
    expect(rows[0].state).toBe("unsold");
    expect([rows[0].open, rows[0].decided, rows[0].winRatePct]).toEqual([3, 0, null]);
  });
  it("one decided deal is too thin for a verdict", () => {
    expect(productAcceptance([L("أ", "won")], [], isWon, isLost)[0].state).toBe("thin");
    expect(productAcceptance([L("أ", "lost", "السعر")], [], isWon, isLost)[0].state).toBe("thin");
  });
  it("the bar is the win rate among DECIDED deals", () => {
    const rows = productAcceptance([
      L("مقبول", "won"), L("مقبول", "won"), L("مقبول", "lost", "السعر"), L("مقبول", "contact"),
      L("متعثر", "won"), L("متعثر", "lost", "السعر"), L("متعثر", "lost", "التكامل"),
      L("مرفوض", "lost", "السعر"), L("مرفوض", "lost", "السعر"), L("مرفوض", "lost", "التكامل"), L("مرفوض", "won"),
    ], [], isWon, isLost);
    const by = Object.fromEntries(rows.map((r) => [r.product, r]));
    expect(by["مقبول"].state).toBe("accepted");   // 2 من 3 = 67٪
    expect(by["متعثر"].state).toBe("struggling"); // 1 من 3 = 33٪
    expect(by["مرفوض"].state).toBe("rejected");   // 1 من 4 = 25٪
    expect(by["مقبول"].open).toBe(1);
  });
  it("names the reason customers gave most often, and only from lost lines", () => {
    const r = productAcceptance([
      L("أ", "lost", "السعر"), L("أ", "lost", "السعر"), L("أ", "lost", "التكامل"), L("أ", "won"),
    ], [], isWon, isLost)[0];
    expect([r.topReason, r.topReasonCount]).toEqual(["السعر", 2]);
  });
  it("a catalogue product with no deals still appears", () => {
    const rows = productAcceptance([], ["أ", "ب"], isWon, isLost);
    expect(rows.map((r) => r.product).sort()).toEqual(["أ", "ب"]);
    expect(rows.every((r) => r.state === "unsold")).toBe(true);
  });
  it("worst first, so the problem is not below the winners", () => {
    const rows = productAcceptance([
      L("جيد", "won"), L("جيد", "won"), L("جيد", "lost", "س"),
      L("سيئ", "lost", "س"), L("سيئ", "lost", "س"), L("سيئ", "lost", "س"),
      L("جديد", "contact"),
    ], [], isWon, isLost);
    expect(rows.map((r) => r.state)).toEqual(["rejected", "accepted", "unsold"]);
  });
  it("attainment is passed in, never re-derived here", () => {
    const rows = productAcceptance([L("أ", "won")], [], isWon, isLost, (p) => (p === "أ" ? 64 : null));
    expect(rows[0].attainmentPct).toBe(64);
    expect(productAcceptance([L("أ", "won")], [], isWon, isLost)[0].attainmentPct).toBeNull();
  });
});

describe("acceptanceTotals", () => {
  it("counts products per state, and keeps a zero state visible", () => {
    const rows = productAcceptance([L("أ", "won"), L("أ", "won"), L("ب", "contact")], [], isWon, isLost);
    const t = Object.fromEntries(acceptanceTotals(rows).map((x) => [x.key, x.count]));
    expect(t).toEqual({ accepted: 1, struggling: 0, rejected: 0, unsold: 1, thin: 0 });
  });
});

describe("the browser seam", () => {
  it("ships every rule and references nothing it does not inject", () => {
    expect(checkAcceptanceDomainClosure()).toEqual([]);
    for (const n of ["productAcceptance", "acceptanceTotals", "ACCEPT_LABELS"]) expect(ACCEPTANCE_DOMAIN_JS).toContain(n);
  });
});
