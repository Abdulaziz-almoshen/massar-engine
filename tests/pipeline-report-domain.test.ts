import { describe, it, expect } from "vitest";
import {
  buildFunnel, buildVelocity, buildProducts, buildSources, buildMovement, buildPipelineReport,
  classifyMove, furthestIndex, median, pctOf, openLadder,
  type ReportStage, type ReportLine, type ReportEvent,
} from "../src/pipeline-report-domain.js";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 8, 15, 12);

const STAGES: ReportStage[] = [
  { key: "contact", label: "تواصل أولي", position: 1, weightPct: 10, slaDays: null, terminal: null },
  { key: "discover", label: "اكتشاف الحاجة", position: 2, weightPct: 25, slaDays: null, terminal: null },
  { key: "present", label: "عرض المنتج", position: 3, weightPct: 45, slaDays: null, terminal: null },
  { key: "tech", label: "التقييم التقني", position: 4, weightPct: 65, slaDays: 14, terminal: null },
  { key: "won", label: "إغلاق – ربح", position: 7, weightPct: 100, slaDays: null, terminal: "won" },
  { key: "lost", label: "إغلاق – خسارة", position: 8, weightPct: 0, slaDays: null, terminal: "lost" },
];

let nextId = 1;
const line = (over: Partial<ReportLine>): ReportLine => ({
  id: nextId++, stage: "contact", product: "أ", source: "whatsapp",
  value: 0, priced: false, createdAt: NOW - 40 * DAY, stageAt: NOW - 40 * DAY, ...over,
});
const ev = (oppId: number, fromStage: string | null, toStage: string, daysAgo: number, actor: string | null = "rep"): ReportEvent =>
  ({ oppId, fromStage, toStage, at: NOW - daysAgo * DAY, actor });

describe("helpers", () => {
  it("pctOf is null on a zero denominator — the screen prints «—», never 0%", () => {
    expect(pctOf(0, 0)).toBeNull();
    expect(pctOf(1, 3)).toBe(33);
  });
  it("median of nothing is null; even counts average", () => {
    expect(median([])).toBeNull();
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2, 3, 10])).toBe(3);
  });
  it("openLadder drops terminals and sorts by position", () => {
    expect(openLadder([...STAGES].reverse()).map((s) => s.key)).toEqual(["contact", "discover", "present", "tech"]);
  });
});

describe("furthestIndex", () => {
  it("a won deal reached every open rung even with no recorded visits", () => {
    const l = line({ stage: "won" });
    expect(furthestIndex(STAGES, l, [])).toBe(3);
  });
  it("a lost deal counts only as far as its ledger shows", () => {
    const l = line({ stage: "lost" });
    expect(furthestIndex(STAGES, l, [ev(l.id, null, "contact", 30), ev(l.id, "contact", "present", 20), ev(l.id, "present", "lost", 5)])).toBe(2);
    expect(furthestIndex(STAGES, line({ stage: "lost" }), [])).toBe(-1);
  });
  it("a skipped rung still counts as reached", () => {
    const l = line({ stage: "present" });
    expect(furthestIndex(STAGES, l, [ev(l.id, null, "present", 3)])).toBe(2);
  });
});

describe("buildFunnel", () => {
  it("counts reached-or-beyond, and the last open rung converts into won", () => {
    const a = line({ stage: "contact" });
    const b = line({ stage: "present" });
    const c = line({ stage: "won" });
    const d = line({ stage: "lost" });
    const f = buildFunnel(STAGES, [a, b, c, d], [ev(d.id, null, "contact", 10), ev(d.id, "contact", "lost", 2)]);
    expect(f.steps.map((s) => s.reached)).toEqual([4, 2, 2, 1]);
    expect(f.steps.map((s) => s.conversionPct)).toEqual([50, 100, 50, 100]);
    expect(f.won).toBe(1);
    expect(f.lost).toBe(1);
    expect(f.weakest).toEqual({ from: "contact", to: "discover", conversionPct: 50 });
    expect(f.action?.stage).toBe("contact");
    expect(f.action?.text).toContain("50٪");
  });
  it("an empty board has no weakest step and no action", () => {
    const f = buildFunnel(STAGES, [], []);
    expect(f.steps.every((s) => s.conversionPct === null)).toBe(true);
    expect(f.weakest).toBeNull();
    expect(f.action).toBeNull();
  });
});

describe("buildVelocity", () => {
  it("measures completed stays from consecutive ledger rows and ongoing ages from the last entry", () => {
    const a = line({ stage: "tech" });
    const b = line({ stage: "tech", stageAt: NOW - 3 * DAY });
    const events = [ev(a.id, null, "contact", 30), ev(a.id, "contact", "tech", 20)];
    const v = buildVelocity(STAGES, [a, b], events, NOW);
    const contact = v.steps.find((s) => s.key === "contact")!;
    expect(contact.medianDoneDays).toBe(10);
    expect(contact.doneCount).toBe(1);
    const tech = v.steps.find((s) => s.key === "tech")!;
    expect(tech.openCount).toBe(2);
    expect(tech.maxOpenDays).toBe(20);
    expect(tech.overSla).toBe(1); // 20 days ≥ 14-day SLA; the 3-day one is inside it
    expect(v.bottleneck).toBe("tech");
    expect(v.action?.text).toBe("بند واحد في «التقييم التقني» تجاوز مهلة 14 يومًا. الأقدم بلا حركة منذ 20 يومًا.");
  });
  it("a stage with no SLA never reports a breach", () => {
    const a = line({ stage: "contact", stageAt: NOW - 400 * DAY });
    const v = buildVelocity(STAGES, [a], [], NOW);
    expect(v.overSla).toBe(0);
    expect(v.action?.text).toContain("لا تجاوز");
  });
});

describe("buildProducts", () => {
  it("excludes lost money from open value, weights by stage, never values an unpriced line", () => {
    const rows = [
      line({ product: "أ", stage: "tech", value: 100_000, priced: true }),
      line({ product: "أ", stage: "contact", value: 0, priced: false }),
      line({ product: "أ", stage: "lost", value: 50_000, priced: true }),
      line({ product: "ب", stage: "won", value: 30_000, priced: true }),
    ];
    const p = buildProducts(STAGES, rows);
    const a = p.rows[0];
    expect(a.product).toBe("أ");
    expect(a.openValue).toBe(100_000);
    expect(a.weightedValue).toBe(65_000);
    expect(a.unpricedOpen).toBe(1);
    expect(a.lostValue).toBe(50_000);
    expect(a.winRatePct).toBe(0);
    expect(a.byStage).toEqual([{ key: "contact", n: 1 }, { key: "tech", n: 1 }, { key: "lost", n: 1 }]);
    const b = p.rows[1];
    expect(b.winRatePct).toBe(100);
    expect(b.openLines).toBe(0);
    expect(p.topSharePct).toBe(100);
  });
  it("when most of the open pipeline is unpriced it says the ranking cannot be trusted", () => {
    const p = buildProducts(STAGES, [line({}), line({}), line({ stage: "tech", value: 9, priced: true })]);
    expect(p.action?.text).toContain("بلا تسعير");
  });
});

describe("buildSources", () => {
  it("advanced means past the first open rung; the action compares channels with ≥2 lines", () => {
    const w1 = line({ source: "whatsapp", stage: "contact" });
    const w2 = line({ source: "whatsapp", stage: "contact" });
    const v1 = line({ source: "visit", stage: "present" });
    const v2 = line({ source: "visit", stage: "won" });
    const s = buildSources(STAGES, [w1, w2, v1, v2], [], { whatsapp: "حملة واتساب", visit: "زيارة" });
    const wa = s.rows.find((r) => r.source === "whatsapp")!;
    expect(wa.advancedPct).toBe(0);
    const vi = s.rows.find((r) => r.source === "visit")!;
    expect(vi.advancedPct).toBe(100);
    expect(vi.winRatePct).toBe(100);
    expect(s.best).toBe("visit");
    expect(s.action?.text).toBe("تقدّمت 100٪ من فرص «زيارة»، و0٪ فقط من «حملة واتساب».");
  });
});

describe("buildMovement", () => {
  it("classifies each move and ignores the migration backfill", () => {
    expect(classifyMove(STAGES, ev(1, null, "contact", 1))).toBe("opened");
    expect(classifyMove(STAGES, ev(1, "contact", "tech", 1))).toBe("advanced");
    expect(classifyMove(STAGES, ev(1, "tech", "contact", 1))).toBe("regressed");
    expect(classifyMove(STAGES, ev(1, "tech", "won", 1))).toBe("won");
    expect(classifyMove(STAGES, ev(1, "lost", "tech", 1))).toBe("reopened");
    expect(classifyMove(STAGES, ev(1, "tech", "tech", 1))).toBeNull();
  });
  it("counts the window, values priced moves, and names the lines that did not move", () => {
    const a = line({ stage: "won", value: 70_000, priced: true });
    const b = line({ stage: "tech" });
    const c = line({ stage: "contact" });
    const events = [
      ev(a.id, "tech", "won", 2),
      ev(b.id, "contact", "tech", 9),
      ev(c.id, null, "contact", 3, "migration"),
      ev(c.id, null, "contact", 60),
    ];
    const m = buildMovement(STAGES, [a, b, c], events, NOW, 30);
    expect(m.totals.won).toBe(1);
    expect(m.totals.advanced).toBe(1);
    expect(m.totals.opened).toBe(0);
    expect(m.wonValue).toBe(70_000);
    expect(m.weeks).toHaveLength(5);
    expect(m.weeks[m.weeks.length - 1].counts.won).toBe(1);
    expect(m.quietOpen).toBe(1);
    expect(m.openLines).toBe(2);
    expect(m.action?.text).toContain("لم تتحرك");
  });
});

describe("buildPipelineReport", () => {
  it("assembles the headline, flags a small sample, and measures cycle only on won deals", () => {
    const a = line({ stage: "won", value: 10, priced: true, createdAt: NOW - 50 * DAY });
    const b = line({ stage: "tech", value: 100, priced: true });
    const r = buildPipelineReport({
      stages: STAGES, lines: [a, b], now: NOW, sourceLabels: {},
      events: [ev(a.id, null, "contact", 50), ev(a.id, "contact", "won", 10)],
    });
    expect(r.smallSample).toBe(true);
    expect(r.headline.openLines).toBe(1);
    expect(r.headline.openValue).toBe(100);
    expect(r.headline.weightedValue).toBe(65);
    expect(r.headline.winRatePct).toBe(100);
    expect(r.headline.medianCycleDays).toBe(40);
  });
});
