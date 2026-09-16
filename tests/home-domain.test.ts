import { describe, expect, it } from "vitest";
import {
  HEALTH_STATES, HOME_DOMAIN_JS, checkHomeDomainClosure, partnerWeekBand, pipelineHealth, wholePct,
} from "../src/home-domain.js";
import { attainmentPct } from "../src/sales-domain.js";

const line = (o: Partial<Parameters<typeof pipelineHealth>[0][number]> & { id: number }) => ({
  id: o.id, value: o.value ?? 0, lost: !!o.lost, stalled: !!o.stalled, awaitingSupport: !!o.awaitingSupport, won: !!o.won,
});

describe("pipelineHealth", () => {
  const rows = [
    line({ id: 1, value: 100 }),
    line({ id: 2, value: 200, stalled: true }),
    line({ id: 3, value: 300, awaitingSupport: true }),
    line({ id: 4, value: 400, lost: true }),
    line({ id: 5, value: 500, won: true }),
  ];
  it("places every line in exactly one state, and the counts reconcile", () => {
    const h = pipelineHealth(rows);
    expect(h.buckets.map((b) => [b.key, b.count, b.value])).toEqual([
      ["on_track", 1, 100], ["late", 1, 200], ["support", 1, 300], ["rejected", 1, 400],
    ]);
    // a won line is finished and is not in the pipeline at all
    expect(h.total).toBe(4);
    expect(h.buckets.reduce((n, b) => n + b.count, 0)).toBe(h.total);
    // the open book excludes the lost line
    expect(h.openCount).toBe(3);
    expect(h.openValue).toBe(600);
  });
  it("a closed deal is never «late» and a blocked deal is never counted as neglect", () => {
    const h = pipelineHealth([
      line({ id: 1, value: 10, lost: true, stalled: true, awaitingSupport: true }),
      line({ id: 2, value: 20, stalled: true, awaitingSupport: true }),
    ]);
    const by = Object.fromEntries(h.buckets.map((b) => [b.key, b.count]));
    expect(by).toEqual({ on_track: 0, late: 0, support: 1, rejected: 1 });
  });
  it("an empty book is four zeroes, not an empty list", () => {
    const h = pipelineHealth([]);
    expect(h.buckets.length).toBe(HEALTH_STATES.length);
    expect(h.buckets.every((b) => b.count === 0 && b.value === 0)).toBe(true);
    expect(h.openValue).toBe(0);
  });
});

describe("wholePct over the ONE attainment rule", () => {
  it("is null with no target — never 0٪, and never a second copy of the rule", () => {
    expect(wholePct(attainmentPct(0, 0))).toBeNull();
    expect(wholePct(attainmentPct(0, 100))).toBe(0);
    expect(wholePct(attainmentPct(640, 1000))).toBe(64);
    expect(wholePct(attainmentPct(333, 520))).toBe(64);
    expect(wholePct(undefined)).toBeNull();
  });
});

describe("partnerWeekBand", () => {
  it("shares are of the contracted target, to one decimal", () => {
    const b = partnerWeekBand({ target: 1000, contacted: 748, interested: 214, notInterested: 364, noReply: 170 });
    expect([b.contactedPct, b.interestedPct, b.notInterestedPct, b.noReplyPct]).toEqual([74.8, 21.4, 36.4, 17]);
  });
  it("no target means no share, and the counts still stand", () => {
    const b = partnerWeekBand({ target: 0, contacted: 5, interested: 2 });
    expect(b.contacted).toBe(5);
    expect(b.contactedPct).toBeNull();
    expect(b.noReply).toBe(0);
  });
});

describe("the browser seam", () => {
  it("ships every rule and references nothing it does not inject", () => {
    expect(checkHomeDomainClosure()).toEqual([]);
    for (const name of ["pipelineHealth", "wholePct", "partnerWeekBand", "HEALTH_STATES"]) {
      expect(HOME_DOMAIN_JS).toContain(name);
    }
  });
});
