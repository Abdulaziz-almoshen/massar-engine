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
    // contact: b and c moved past it, d was lost on it, a is undecided → 2 of 3.
    // present: b still sits there (undecided), c moved on → 1 of 1. tech → won: c won → 1 of 1.
    expect(f.steps.map((s) => s.conversionPct)).toEqual([67, 100, 100, 100]);
    expect(f.won).toBe(1);
    expect(f.lost).toBe(1);
    expect(f.weakest).toEqual({ from: "contact", to: "discover", conversionPct: 67, moved: 2, decided: 3 });
    expect(f.action?.stage).toBe("contact");
    expect(f.action?.text).toBe("راجع شرط الخروج من «تواصل أولي»: انتقل 2 من 3 إلى «اكتشاف الحاجة» (67٪)، وهو أكبر تسرّب في الأنبوب.");
  });
  it("a deal that moved BACKWARD cannot push conversion past 100٪ (GPT review reproduction)", () => {
    const x = line({ stage: "contact" });
    const y = line({ stage: "discover" });
    const f = buildFunnel(STAGES, [x, y], [
      ev(x.id, null, "contact", 20), ev(x.id, "contact", "discover", 10), ev(x.id, "discover", "contact", 5),
      ev(y.id, null, "discover", 8),
    ]);
    for (const st of f.steps) if (st.conversionPct !== null) expect(st.conversionPct).toBeLessThanOrEqual(100);
    expect(f.steps[0].conversionPct).toBe(100);
  });
  it("a loss on the LAST rung is the weakest step, pointing at won", () => {
    const z = line({ stage: "lost" });
    const f = buildFunnel(STAGES, [z], [ev(z.id, null, "tech", 9), ev(z.id, "tech", "lost", 2)]);
    expect(f.steps[3].conversionPct).toBe(0);
    expect(f.weakest).toMatchObject({ from: "tech", to: "won", conversionPct: 0 });
    expect(f.measured).toBe(true);
  });
  it("a rung whose only deal is still on it has no conversion — undecided is not a leak", () => {
    // Production, 2026-09-15: one open deal at quote reported «0٪ انتقلت» as the biggest leak.
    const q = line({ stage: "tech" });
    const f = buildFunnel(STAGES, [q], [ev(q.id, null, "contact", 9), ev(q.id, "contact", "tech", 7)]);
    expect(f.steps.find((s) => s.key === "tech")!.conversionPct).toBeNull();
    expect(f.weakest).toBeNull();
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
    expect(v.action?.text).toBe("بند واحد في «التقييم التقني» تجاوز مهلة 14 يومًا. ابدأ بالأقدم: بلا حركة منذ 20 يومًا.");
    expect(v.action).toMatchObject({ stage: "tech", shortcut: "stalled" });
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
    expect(p.action?.text).toBe("سعّر البنود المفتوحة أولًا: بندان مفتوحان من أصل 3 بلا سعر، فترتيب المنتجات بالقيمة لا يُعتمد قبلها.");
    expect(p.action?.shortcut).toBe("unpriced");
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
    expect(s.eligible).toBe(2);
    expect(s.action?.text).toBe("راجع بنود «حملة واتساب» العالقة في التواصل الأولي: تقدّم منها 0٪ فقط، مقابل 100٪ من «زيارة».");
    expect(s.action).toMatchObject({ stage: "contact", source: "whatsapp" });
  });
  it("a one-line channel is never ranked — «100٪» of one deal is not the best channel", () => {
    const s = buildSources(STAGES, [line({ source: "whatsapp" }), line({ source: "whatsapp" }), line({ source: "visit", stage: "won" })], [], {});
    expect(s.best).toBeNull();
    expect(s.eligible).toBe(1);
    expect(s.action?.text).toContain("لا مقارنة");
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
    expect(m.action?.text).toBe("حرّك الراكد: بند واحد مفتوح من أصل 2 لم يتحرك خلال 30 يومًا — حدّد خطوة تالية، أو أغلق ما لم يعد قائمًا.");
  });
  it("a deal recorded already won is a win, not an opening; a re-won deal is valued once", () => {
    const a = line({ stage: "won", value: 1000, priced: true });
    const b = line({ stage: "won", value: 1000, priced: true });
    const m = buildMovement(STAGES, [a, b], [
      ev(a.id, null, "won", 3),
      ev(b.id, "tech", "won", 20), ev(b.id, "won", "tech", 15), ev(b.id, "tech", "won", 10),
    ], NOW, 30);
    expect(m.totals.opened).toBe(0);
    expect(m.totals.won).toBe(3);
    expect(m.totals.reopened).toBe(1);
    expect(m.wonValue).toBe(2000);
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
