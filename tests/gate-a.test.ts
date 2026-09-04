import { describe, it, expect } from "vitest";
import {
  isRiyadhWorkingDay, riyadhDayKey, medianPerWorkingDay, loggedWithinADay,
  gateAVerdict, GATE_A_MIN_MEDIAN, GATE_A_MIN_LOGGED_PCT,
} from "../src/sales-domain.js";

const D = 86_400_000;
// 2026-09-06 is a Sunday in Riyadh. Anchored to a real date so the weekend assertions are checkable
// by hand rather than by trusting the arithmetic that is under test.
const SUN = Date.UTC(2026, 8, 6, 9, 0, 0);

describe("the Riyadh working week", () => {
  it("runs Sunday to Thursday", () => {
    const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const got = names.map((_, i) => isRiyadhWorkingDay(SUN + i * D));
    expect(got).toEqual([true, true, true, true, true, false, false]);
  });

  it("puts a small-hours Riyadh call on the Riyadh day, not the UTC one before it", () => {
    // 01:00 Riyadh on the 7th is 22:00 UTC on the 6th. Grouping on UTC would file it a day early
    // and move an engagement out of the day the rep actually worked.
    const oneAmRiyadh7th = Date.UTC(2026, 8, 6, 22, 0, 0);
    expect(riyadhDayKey(oneAmRiyadh7th)).toBe("2026-09-07");
  });
});

describe("median per working day", () => {
  it("counts a day with no engagements as a ZERO, not as absent", () => {
    // The defect this exists for: a median over only the days that have rows answers "how busy was
    // the rep when they were busy", which is never the question the gate asks.
    const counts = { [riyadhDayKey(SUN)]: 10 };           // one big day, four empty ones
    const m = medianPerWorkingDay(counts, SUN, SUN + 5 * D);
    expect(m).toBe(0);                                     // Sun..Thu -> [0,0,0,0,10] -> 0
  });

  it("ignores Friday and Saturday entirely", () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 7; i++) counts[riyadhDayKey(SUN + i * D)] = 4;
    // Seven days of 4, but only the five working ones are sampled, so the median is still 4.
    expect(medianPerWorkingDay(counts, SUN, SUN + 7 * D)).toBe(4);
  });

  it("returns null for a window with no working days, because that is unmeasured, not zero", () => {
    const fri = SUN + 5 * D;
    expect(medianPerWorkingDay({}, fri, fri + 2 * D)).toBeNull();
  });
});

describe("logging latency", () => {
  it("counts an engagement recorded within a day of happening", () => {
    const now = Date.now();
    const r = loggedWithinADay([
      { occurredAt: now - 2 * 3600_000, recordedAt: now },        // same day
      { occurredAt: now - 2 * D, recordedAt: now },               // two days late
    ]);
    expect(r.total).toBe(2);
    expect(r.within).toBe(1);
    expect(r.pct).toBe(50);
  });

  it("is null rather than zero when nothing was recorded at all", () => {
    expect(loggedWithinADay([]).pct).toBeNull();
  });
});

describe("the verdict is computed, not remembered", () => {
  it("fails a median below the threshold and says why", () => {
    const v = gateAVerdict(GATE_A_MIN_MEDIAN - 1, 100);
    expect(v.verdict).toBe("fail");
    expect(v.reasons.length).toBe(1);
  });

  it("fails late logging even when the volume is fine", () => {
    const v = gateAVerdict(GATE_A_MIN_MEDIAN + 5, GATE_A_MIN_LOGGED_PCT - 1);
    expect(v.verdict).toBe("fail");
  });

  it("passes when both thresholds are met", () => {
    expect(gateAVerdict(GATE_A_MIN_MEDIAN, GATE_A_MIN_LOGGED_PCT).verdict).toBe("pass");
  });

  it("reports unmeasured rather than failing when there were no working days", () => {
    expect(gateAVerdict(null, null).verdict).toBe("unmeasured");
  });
});
