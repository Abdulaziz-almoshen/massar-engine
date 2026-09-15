import { describe, it, expect } from "vitest";
import {
  STAGE_TONE_KEYED, STAGE_TONE_CYCLE, STAGE_TONE_WON, STAGE_TONE_LOST, STAGE_TONE_JS,
  stageToneOf, customToneIndex, stageSteps, type StageTone,
} from "../src/stage-tone-domain.js";
import { SALES_STAGES } from "../src/sales-domain.js";

// WCAG relative luminance — re-derived here so the palette cannot drift past the floor it claims.
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: string, b: string) => {
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const SURFACE_2 = "#E5E8EE"; // DESIGN.md: the darkest ground a mark lands on

const ALL: [string, StageTone][] = [
  ...Object.entries(STAGE_TONE_KEYED),
  ["won", STAGE_TONE_WON], ["lost", STAGE_TONE_LOST],
  ...STAGE_TONE_CYCLE.map((t, i) => ["cycle" + i, t] as [string, StageTone]),
];

describe("stage palette contrast", () => {
  it.each(ALL)("%s: white on solid ≥ 4.5, text on soft ≥ 4.5, solid as a mark on --surface-2 ≥ 3", (_k, t) => {
    expect(ratio("#FFFFFF", t.solid)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(t.text, t.soft)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(t.solid, SURFACE_2)).toBeGreaterThanOrEqual(3);
  });
  it("every hue is distinct — two stages that share a colour are one stage to the eye", () => {
    const solids = ALL.map(([, t]) => t.solid);
    expect(new Set(solids).size).toBe(solids.length);
  });
  it("every seeded open rung has a keyed tone", () => {
    for (const s of SALES_STAGES.filter((x) => x.terminal === null)) expect(STAGE_TONE_KEYED[s.key]).toBeDefined();
  });
});

describe("stageToneOf", () => {
  it("terminals resolve by terminal OR key (the browser fallback ladder carries terminal:null)", () => {
    expect(stageToneOf("x", "won", 0)).toBe(STAGE_TONE_WON);
    expect(stageToneOf("lost", null, 0)).toBe(STAGE_TONE_LOST);
  });
  it("a custom rung cycles by its custom index and never borrows a keyed hue", () => {
    expect(stageToneOf("custom_a", null, 0)).toBe(STAGE_TONE_CYCLE[0]);
    expect(stageToneOf("custom_b", null, 5)).toBe(STAGE_TONE_CYCLE[1]);
    expect(stageToneOf("custom_c", null, -3)).toBe(STAGE_TONE_CYCLE[0]);
    expect(stageToneOf("present", null, 99)).toBe(STAGE_TONE_KEYED.present);
  });
  it("a key named after an Object.prototype member still gets a real tone", () => {
    for (const k of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
      expect(stageToneOf(k, null, 0).solid).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
  it("two custom rungs separated by seeded rungs take different tones", () => {
    const ladder = ["contact", "custom_a", "discover", "present", "tech", "quote", "custom_b", "negotiate"];
    expect(customToneIndex(ladder, "custom_a")).toBe(0);
    expect(customToneIndex(ladder, "custom_b")).toBe(1);
    expect(stageToneOf("custom_a", null, customToneIndex(ladder, "custom_a")))
      .not.toBe(stageToneOf("custom_b", null, customToneIndex(ladder, "custom_b")));
  });
});

describe("stageSteps", () => {
  const ladder = ["contact", "discover", "present", "tech"];
  it("open: before done, own current, after todo", () => {
    expect(stageSteps(ladder, "present")).toEqual(["done", "done", "current", "todo"]);
  });
  it("won passed every rung; lost and unknown claim nothing", () => {
    expect(stageSteps(ladder, "won")).toEqual(["done", "done", "done", "done"]);
    expect(stageSteps(ladder, "lost")).toEqual(["todo", "todo", "todo", "todo"]);
    expect(stageSteps(ladder, "ghost")).toEqual(["todo", "todo", "todo", "todo"]);
  });
});

describe("browser seam", () => {
  it("ships both functions and every constant they read", () => {
    const js = STAGE_TONE_JS;
    for (const name of ["STAGE_TONE_KEYED", "STAGE_TONE_WON", "STAGE_TONE_LOST", "STAGE_TONE_CYCLE", "function stageToneOf", "function customToneIndex", "function stageSteps"]) {
      expect(js).toContain(name);
    }
    // Evaluated as the page would: a missing reference is a ReferenceError here, not a blank page.
    const run = new Function(js + "; return [stageToneOf('tech', null, 0).solid, stageSteps(['a','b'], 'b').join()];");
    expect(run()).toEqual([STAGE_TONE_KEYED.tech.solid, "done,current"]);
  });
});
