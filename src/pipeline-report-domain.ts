// pipeline-report-domain.ts — «نظرة تنفيذية»: the five pipeline reports a CPO reads.
//
// WHY THIS FILE EXISTS (founder, 2026-09-15: «im cpo give me more reports»). «التقارير» answered one
// kind of question — WHICH deal is blocked, and on WHOM. A product officer asks the other kind: where
// does the ladder leak, how long does each rung take, which product and which channel actually carry
// the pipeline, and what moved this month. Each is answerable from data the engine already writes —
// `opportunities` and the append-only `track_stage_events` ledger — so none of them is a model's
// guess, and every figure can be traced to rows.
//
// THE RULES THAT SHAPE EVERY NUMBER BELOW:
//   · A deal «reached» a rung when its ledger (or its current stage) put it at that rung OR ANY LATER
//     ONE. Skipping a rung is common — a referral arrives already at «عرض المنتج» — and a funnel that
//     counted only recorded visits would show a deal vanishing and reappearing.
//   · Won counts as having reached every open rung; lost counts only as far as its ledger shows.
//   · Money excludes LOST lines, the same rule sumLiveValue holds on the board. Unpriced lines are
//     COUNTED, never valued as zero, and every report says how many there are.
//   · Movement ignores the migration backfill (actor 'migration'): those rows say «this deal was
//     already here», not «this deal moved».
//   · A zero denominator is null, and the screen prints «—» (DESIGN.md §6 rule 6).
//
// Pure: no I/O. The server reads the rows, this module decides what they mean, the screen draws it.

import { pluralizeArabic } from "./opps-domain.js";

export type ReportStage = {
  key: string; label: string; position: number; weightPct: number;
  slaDays: number | null; terminal: "won" | "lost" | null;
};
export type ReportLine = {
  id: number; stage: string; product: string; source: string;
  value: number; priced: boolean; createdAt: number; stageAt: number;
};
export type ReportEvent = {
  oppId: number; fromStage: string | null; toStage: string; at: number; actor: string | null;
};

const DAY_MS = 86_400_000;
/** Below this many lines a percentage is a hint, not a finding. Stated on screen, not hidden. */
export const SMALL_SAMPLE = 10;
/** The fewest lines a channel needs before it is ranked against another. */
export const SOURCE_MIN_LINES = 2;

const fmt = (n: number) => Number(n || 0).toLocaleString("en-US");
const nLine = (n: number) => pluralizeArabic(n, "بند واحد", "بندان", "بنود", "بندًا", fmt);
const nDay = (n: number) => pluralizeArabic(n, "يوم واحد", "يومان", "أيام", "يومًا", fmt);
/** «منذ …» governs the genitive: «منذ يومين», never «منذ يومان». */
const nDaySince = (n: number) => pluralizeArabic(n, "يوم واحد", "يومين", "أيام", "يومًا", fmt);
/** The adjective agrees with the count: «بند واحد مفتوح»، «بندان مفتوحان»، «٣ بنود مفتوحة»، «١١ بندًا مفتوحًا». */
const nOpenLine = (n: number) => pluralizeArabic(n, "بند واحد مفتوح", "بندان مفتوحان", "بنود مفتوحة", "بندًا مفتوحًا", fmt);
/** «لم يتحرك» agreeing with the same count. */
const notMoved = (n: number) => (n === 1 ? "لم يتحرك" : n === 2 ? "لم يتحركا" : n >= 3 && n <= 10 ? "لم تتحرك" : "لم يتحرك");

export function pctOf(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

export function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

export function isWon(stages: readonly ReportStage[], key: string): boolean {
  const st = stages.find((s) => s.key === key);
  return st ? st.terminal === "won" : key === "won";
}
export function isLost(stages: readonly ReportStage[], key: string): boolean {
  const st = stages.find((s) => s.key === key);
  return st ? st.terminal === "lost" : key === "lost";
}

/** The open rungs in ladder order. */
export function openLadder(stages: readonly ReportStage[]): ReportStage[] {
  return stages.filter((s) => s.terminal === null && s.key !== "won" && s.key !== "lost")
    .sort((a, b) => a.position - b.position);
}

function eventsByOpp(events: readonly ReportEvent[]): Map<number, ReportEvent[]> {
  const m = new Map<number, ReportEvent[]>();
  for (const e of events) {
    const list = m.get(e.oppId) ?? [];
    list.push(e);
    m.set(e.oppId, list);
  }
  for (const list of m.values()) list.sort((a, b) => a.at - b.at);
  return m;
}

/** The furthest OPEN rung index a line is known to have reached; won reaches the last one. -1 when
 *  nothing known places it on the ladder (a lost line with no history, or an unknown key). */
export function furthestIndex(
  stages: readonly ReportStage[], line: ReportLine, history: readonly ReportEvent[],
): number {
  const ladder = openLadder(stages).map((s) => s.key);
  if (isWon(stages, line.stage)) return ladder.length - 1;
  let best = ladder.indexOf(line.stage);
  for (const e of history) {
    if (isWon(stages, e.toStage)) return ladder.length - 1;
    best = Math.max(best, ladder.indexOf(e.toStage), e.fromStage ? ladder.indexOf(e.fromStage) : -1);
  }
  return best;
}

/** One next action, and the exact board population it is about. The screen opens «فرص البيع» with
 *  THESE filters and every other filter cleared, so the list a CPO lands on is the one the sentence
 *  named — not the stage filtered inside whatever product and owner were left selected last time. */
export type NextAction = {
  text: string; stage: string | null;
  source?: string | null; product?: string | null; shortcut?: "stalled" | "unpriced" | "open" | null;
};

// ------------------------------------------------------------------------------------------------
// 1. قمع المراحل — where the ladder leaks
// ------------------------------------------------------------------------------------------------
export type FunnelStep = {
  key: string; label: string; reached: number; now: number;
  /** Deals whose fate at this rung is KNOWN: they moved past it, or were lost on it. */
  decided: number; moved: number; conversionPct: number | null;
};
export type Funnel = {
  steps: FunnelStep[]; won: number; lost: number; lines: number; wonKey: string;
  /** Lost deals with no known rung (backfilled «null → lost», or recorded lost): real losses the
   *  funnel cannot place. The screen must not call the pipeline leak-free while these exist. */
  lostUnplaced: number;
  /** True when at least one rung had a decided deal — «nothing measured» and «nothing leaked» differ. */
  measured: boolean;
  weakest: { from: string; to: string; conversionPct: number; moved: number; decided: number } | null;
  action: NextAction | null;
};

export function buildFunnel(
  stages: readonly ReportStage[], lines: readonly ReportLine[], events: readonly ReportEvent[],
): Funnel {
  const ladder = openLadder(stages);
  const hist = eventsByOpp(events);
  const ladderKeys = ladder.map((s) => s.key);
  // A LOST deal is placed at the rung it was lost FROM (its last move into lost), not the furthest it
  // ever reached: a deal won, reopened and lost at «تواصل أولي» leaked at contact, not before signature.
  const idx = lines.map((l) => {
    const h = hist.get(l.id) ?? [];
    if (isLost(stages, l.stage)) {
      const into = [...h].reverse().find((e) => isLost(stages, e.toStage) && e.fromStage);
      const at = into && into.fromStage ? ladderKeys.indexOf(into.fromStage) : -1;
      if (at !== -1) return at;
    }
    return furthestIndex(stages, l, h);
  });
  const wonOf = lines.map((l) => isWon(stages, l.stage));
  const lostOf = lines.map((l) => isLost(stages, l.stage));
  const won = wonOf.filter(Boolean).length;
  const lost = lostOf.filter(Boolean).length;
  const wonKey = stages.find((s) => s.terminal === "won")?.key ?? "won";
  const last = ladder.length - 1;

  // CONVERSION IS PER DEAL, over one population. At rung i a deal either MOVED (its furthest rung is
  // beyond i; at the last rung, it was won), FAILED (it was lost and i is the furthest it got), or is
  // UNDECIDED (still open with i as its furthest). Numerator and denominator are drawn from the same
  // decided set, so the rate cannot pass 100٪. The first version divided historical reach by reach
  // minus current occupancy, and a deal that regressed produced 200٪ (GPT review, 2026-09-15).
  const steps: FunnelStep[] = ladder.map((st, i) => {
    let moved = 0, failed = 0;
    idx.forEach((f, k) => {
      if (i === last ? wonOf[k] : f > i) moved++;
      else if (f === i && lostOf[k]) failed++;
    });
    return {
      key: st.key, label: st.label,
      reached: idx.filter((f) => f >= i).length,
      now: lines.filter((l) => l.stage === st.key).length,
      decided: moved + failed, moved,
      conversionPct: pctOf(moved, moved + failed),
    };
  });

  // The weakest step is the lowest conversion below 100٪ — including the last rung into WON, the
  // transition the whole ladder exists for. Ties go to the EARLIER rung: a leak near the top starves
  // every rung below it.
  let w: Funnel["weakest"] = null;
  for (let i = 0; i < steps.length; i++) {
    const st = steps[i];
    if (st.conversionPct === null || st.conversionPct >= 100) continue;
    if (!w || st.conversionPct < w.conversionPct) {
      w = { from: st.key, to: i === last ? wonKey : steps[i + 1].key, conversionPct: st.conversionPct,
        moved: st.moved, decided: st.decided };
    }
  }
  const label = (k: string) => stages.find((s) => s.key === k)?.label ?? k;
  const action: NextAction | null = w
    ? {
        text: "راجع شرط الخروج من «" + label(w.from) + "»: انتقل " + fmt(w.moved) + " من " + fmt(w.decided) +
          " إلى «" + label(w.to) + "» (" + fmt(w.conversionPct) + "٪)، وهو أكبر تسرّب في الأنبوب.",
        stage: w.from,
      }
    : null;
  const lostUnplaced = idx.filter((f, k) => lostOf[k] && f === -1).length;
  return { steps, won, lost, lines: lines.length, wonKey, lostUnplaced, measured: steps.some((x) => x.decided > 0), weakest: w, action };
}

// ------------------------------------------------------------------------------------------------
// 2. زمن المراحل — how long each rung holds a deal
// ------------------------------------------------------------------------------------------------
export type VelocityStep = {
  key: string; label: string; slaDays: number | null;
  medianDoneDays: number | null; doneCount: number;
  openCount: number; medianOpenDays: number | null; maxOpenDays: number | null; overSla: number;
};
export type Velocity = {
  steps: VelocityStep[]; overSla: number; bottleneck: string | null; action: NextAction | null;
};

export function buildVelocity(
  stages: readonly ReportStage[], lines: readonly ReportLine[], events: readonly ReportEvent[], now: number,
): Velocity {
  const ladder = openLadder(stages);
  const hist = eventsByOpp(events);
  const done = new Map<string, number[]>();
  for (const list of hist.values()) {
    for (let i = 0; i + 1 < list.length; i++) {
      const days = Math.max(0, Math.floor((list[i + 1].at - list[i].at) / DAY_MS));
      const arr = done.get(list[i].toStage) ?? [];
      arr.push(days);
      done.set(list[i].toStage, arr);
    }
  }
  const steps: VelocityStep[] = ladder.map((st) => {
    const here = lines.filter((l) => l.stage === st.key);
    // Age in the CURRENT stay: the last ledger entry into this rung, else the row's own stage_at.
    const ages = here.map((l) => {
      const list = hist.get(l.id) ?? [];
      const last = [...list].reverse().find((e) => e.toStage === st.key);
      const since = Math.max(last ? last.at : 0, 0) || Number(l.stageAt) || Number(l.createdAt) || now;
      return Math.max(0, Math.floor((now - since) / DAY_MS));
    });
    const d = done.get(st.key) ?? [];
    return {
      key: st.key, label: st.label, slaDays: st.slaDays,
      medianDoneDays: median(d), doneCount: d.length,
      openCount: here.length, medianOpenDays: median(ages),
      maxOpenDays: ages.length ? Math.max(...ages) : null,
      overSla: st.slaDays === null ? 0 : ages.filter((a) => a >= (st.slaDays as number)).length,
    };
  });
  const overSla = steps.reduce((n, s) => n + s.overSla, 0);
  // The bottleneck is where SLAs are being broken; failing that, where deals have sat longest.
  const ranked = [...steps].filter((s) => s.openCount > 0)
    .sort((a, b) => (b.overSla - a.overSla) || ((b.medianOpenDays ?? 0) - (a.medianOpenDays ?? 0)));
  const top = ranked[0] ?? null;
  const action: NextAction | null = !top ? null : top.overSla
    ? {
        // The verb agrees with the count: «بند واحد تجاوز»، «بندان تجاوزا»، «٣ بنود تجاوزت».
        text: pluralizeArabic(top.overSla, "بند واحد", "بندان", "بنود", "بندًا", fmt) + " في «" + top.label + "» " +
          pluralizeArabic(top.overSla, "تجاوز", "تجاوزا", "تجاوزت", "تجاوز", () => "").trim() + " مهلة " + nDaySince(top.slaDays ?? 0) +
          ". ابدأ بالأقدم: بلا حركة منذ " + nDaySince(top.maxOpenDays ?? 0) + ".",
        stage: top.key, shortcut: "stalled",
      }
    : { text: "لا تجاوز لمهل المراحل. أطول بقاء الآن في «" + top.label + "»: " + nDay(top.maxOpenDays ?? 0) + ".",
        stage: top.key };
  return { steps, overSla, bottleneck: top ? top.key : null, action };
}

// ------------------------------------------------------------------------------------------------
// 3. المنتجات — which product carries the pipeline
// ------------------------------------------------------------------------------------------------
export type ProductReport = {
  product: string; lines: number; openLines: number; unpricedOpen: number;
  openValue: number; weightedValue: number;
  wonCount: number; wonValue: number; lostCount: number; lostValue: number;
  winRatePct: number | null; byStage: { key: string; n: number }[];
};
export type Products = {
  rows: ProductReport[]; openValue: number; topSharePct: number | null; action: NextAction | null;
};

export function buildProducts(stages: readonly ReportStage[], lines: readonly ReportLine[]): Products {
  const order = [...openLadder(stages), ...stages.filter((s) => s.terminal !== null)
    .sort((a, b) => a.position - b.position)];
  const names = [...new Set(lines.map((l) => l.product))];
  const weight = (k: string) => stages.find((s) => s.key === k)?.weightPct ?? 0;
  const rows: ProductReport[] = names.map((product) => {
    const ls = lines.filter((l) => l.product === product);
    const open = ls.filter((l) => !isWon(stages, l.stage) && !isLost(stages, l.stage));
    const won = ls.filter((l) => isWon(stages, l.stage));
    const lost = ls.filter((l) => isLost(stages, l.stage));
    const sum = (xs: ReportLine[]) => xs.reduce((n, l) => n + (l.priced ? l.value : 0), 0);
    return {
      product, lines: ls.length, openLines: open.length,
      unpricedOpen: open.filter((l) => !l.priced).length,
      openValue: sum(open),
      weightedValue: Math.round(open.reduce((n, l) => n + (l.priced ? (l.value * weight(l.stage)) / 100 : 0), 0)),
      wonCount: won.length, wonValue: sum(won), lostCount: lost.length, lostValue: sum(lost),
      winRatePct: pctOf(won.length, won.length + lost.length),
      byStage: order.map((s) => ({ key: s.key, n: ls.filter((l) => l.stage === s.key).length })).filter((x) => x.n > 0),
    };
  }).sort((a, b) => (b.openValue - a.openValue) || (b.openLines - a.openLines) || a.product.localeCompare(b.product));

  const openValue = rows.reduce((n, r) => n + r.openValue, 0);
  const top = rows[0] ?? null;
  const topSharePct = top ? pctOf(top.openValue, openValue) : null;
  const unpriced = rows.reduce((n, r) => n + r.unpricedOpen, 0);
  const openLines = rows.reduce((n, r) => n + r.openLines, 0);
  let action: NextAction | null = null;
  if (openLines && unpriced * 2 >= openLines) {
    // More than half the open pipeline has no price, so any value ranking is mostly unpriced guesswork.
    action = { text: "سعّر البنود المفتوحة أولًا: " + nOpenLine(unpriced) + " من أصل " + fmt(openLines) +
      " بلا سعر، فترتيب المنتجات بالقيمة لا يُعتمد قبلها.", stage: null, shortcut: "unpriced" };
  } else if (top && topSharePct !== null && topSharePct >= 60) {
    action = { text: "«" + top.product + "» يحمل " + fmt(topSharePct) + "٪ من القيمة المفتوحة: وسّع الأنبوب في بقية المنتجات قبل أن يتوقف الربع على منتج واحد.",
      stage: null, product: top.product, shortcut: "open" };
  } else if (top && top.openValue) {
    action = { text: "تابع بنود «" + top.product + "» أولًا: أعلى قيمة مفتوحة (" + fmt(topSharePct ?? 0) + "٪).",
      stage: null, product: top.product, shortcut: "open" };
  }
  return { rows, openValue, topSharePct, action };
}

// ------------------------------------------------------------------------------------------------
// 4. مصادر الفرص — which channel produces deals that move
// ------------------------------------------------------------------------------------------------
export type SourceReport = {
  source: string; lines: number; value: number; advanced: number; advancedPct: number | null;
  wonCount: number; lostCount: number; winRatePct: number | null;
};
export type Sources = { rows: SourceReport[]; best: string | null; eligible: number; level: boolean; action: NextAction | null };

export function buildSources(
  stages: readonly ReportStage[], lines: readonly ReportLine[], events: readonly ReportEvent[],
  labels: Readonly<Record<string, string>>,
): Sources {
  const hist = eventsByOpp(events);
  const keys = [...new Set(lines.map((l) => l.source || "other"))];
  const rows: SourceReport[] = keys.map((source) => {
    const ls = lines.filter((l) => (l.source || "other") === source);
    // «Advanced» = got past the FIRST open rung. A channel that fills «تواصل أولي» with names that
    // never move is producing a list, not a pipeline.
    const advanced = ls.filter((l) => furthestIndex(stages, l, hist.get(l.id) ?? []) >= 1).length;
    const wonCount = ls.filter((l) => isWon(stages, l.stage)).length;
    const lostCount = ls.filter((l) => isLost(stages, l.stage)).length;
    return {
      source, lines: ls.length,
      value: ls.reduce((n, l) => n + (l.priced && !isLost(stages, l.stage) ? l.value : 0), 0),
      advanced, advancedPct: pctOf(advanced, ls.length),
      wonCount, lostCount, winRatePct: pctOf(wonCount, wonCount + lostCount),
    };
  }).sort((a, b) => (b.lines - a.lines) || (b.value - a.value));

  // A channel is compared only once it has two lines. With one, «100٪» is a single deal, and naming it
  // the best channel is the small-sample claim this report promises not to make.
  const eligible = rows.filter((r) => r.lines >= SOURCE_MIN_LINES && r.advancedPct !== null);
  const byAdvance = [...eligible].sort((a, b) => ((b.advancedPct ?? 0) - (a.advancedPct ?? 0)) || (b.lines - a.lines));
  const top = eligible.length >= 2 ? byAdvance[0] : null;
  const bottom = eligible.length >= 2 ? byAdvance[byAdvance.length - 1] : null;
  // Level channels are not a ranking: naming one «best» on a tie contradicted the action beside it.
  const level = !!top && !!bottom && (top.advancedPct ?? 0) === (bottom.advancedPct ?? 0);
  const best = level ? null : top;
  const worst = level ? null : bottom;
  const firstKey = openLadder(stages)[0]?.key ?? null;
  const name = (k: string) => labels[k] ?? k;
  let action: NextAction | null = null;
  if (best && worst && (best.advancedPct ?? 0) > (worst.advancedPct ?? 0)) {
    action = { text: "راجع بنود «" + name(worst.source) + "» العالقة في التواصل الأولي: تقدّم منها " + fmt(worst.advancedPct ?? 0) +
      "٪ فقط، مقابل " + fmt(best.advancedPct ?? 0) + "٪ من «" + name(best.source) + "».", stage: firstKey, source: worst.source };
  } else if (level && top) {
    action = { text: "المصادر المؤهلة متساوية: تقدّم " + fmt(top.advancedPct ?? 0) + "٪ من فرص كلٍّ منها — لا قناة تستحق تحويل الجهد إليها بعد.", stage: null };
  } else if (rows.length) {
    action = { text: "لا مقارنة بين المصادر بعد: يُقارن المصدر حين يملك بندين أو أكثر.", stage: null };
  }
  return { rows, best: best ? best.source : null, eligible: eligible.length, level, action };
}

// ------------------------------------------------------------------------------------------------
// 5. الحركة — what happened in the window
// ------------------------------------------------------------------------------------------------
export type MoveKind = "opened" | "advanced" | "regressed" | "won" | "lost" | "reopened";
export const MOVE_KINDS: readonly MoveKind[] = ["opened", "advanced", "regressed", "won", "lost", "reopened"];
export type MoveCounts = Record<MoveKind, number>;
export type Movement = {
  days: number; totals: MoveCounts; wonValue: number; lostValue: number; advancedValue: number;
  weeks: { startMs: number; endMs: number; counts: MoveCounts }[];
  quietOpen: number; openLines: number; action: NextAction | null;
};

export function classifyMove(stages: readonly ReportStage[], e: ReportEvent): MoveKind | null {
  // A deal RECORDED already won or lost is a closure, not an opening — «opened=1, won=0» for a deal
  // created at signature was the GPT review's reproduction.
  if (isWon(stages, e.toStage)) return "won";
  if (isLost(stages, e.toStage)) return "lost";
  if (!e.fromStage) return "opened";
  if (isWon(stages, e.fromStage) || isLost(stages, e.fromStage)) return "reopened";
  const ladder = openLadder(stages).map((s) => s.key);
  const a = ladder.indexOf(e.fromStage), b = ladder.indexOf(e.toStage);
  if (a === -1 || b === -1 || a === b) return null;
  return b > a ? "advanced" : "regressed";
}

const zeroCounts = (): MoveCounts => ({ opened: 0, advanced: 0, regressed: 0, won: 0, lost: 0, reopened: 0 });

export function buildMovement(
  stages: readonly ReportStage[], lines: readonly ReportLine[], events: readonly ReportEvent[],
  now: number, days = 30,
): Movement {
  const from = now - days * DAY_MS;
  const inWindow = events.filter((e) => e.at >= from && e.at <= now && e.actor !== "migration");
  const byId = new Map(lines.map((l) => [l.id, l] as const));
  const weekCount = Math.ceil(days / 7);
  // Oldest week first. The screen mirrors the x axis for RTL (DESIGN.md §6 rule 3); the data does
  // not reverse, so a test reads it in calendar order.
  const weeks = Array.from({ length: weekCount }, (_, i) => {
    const endMs = now - (weekCount - 1 - i) * 7 * DAY_MS;
    return { startMs: Math.max(from, endMs - 7 * DAY_MS), endMs, counts: zeroCounts() };
  });
  const totals = zeroCounts();
  // Money is per DEAL, not per event: a deal won, reopened and won again is one deal's value, once.
  // It is the line's CURRENT value — the ledger does not snapshot price — and the screen says so.
  const wonDeals = new Set<number>(), lostDeals = new Set<number>(), advancedDeals = new Set<number>();
  const moved = new Set<number>();
  for (const e of inWindow) {
    const kind = classifyMove(stages, e);
    if (!kind) continue;
    moved.add(e.oppId);
    totals[kind]++;
    const wk = weeks.find((w) => e.at > w.startMs && e.at <= w.endMs) ?? weeks[0];
    wk.counts[kind]++;
    if (kind === "won") wonDeals.add(e.oppId);
    if (kind === "lost") lostDeals.add(e.oppId);
    if (kind === "advanced") advancedDeals.add(e.oppId);
  }
  const valueOf = (ids: Set<number>) => [...ids].reduce((n, id) => {
    const l = byId.get(id);
    return n + (l && l.priced ? l.value : 0);
  }, 0);
  // A deal won in the window and still won counts as won; one lost then reopened is not a loss today.
  const wonValue = valueOf(new Set([...wonDeals].filter((id) => { const l = byId.get(id); return !!l && isWon(stages, l.stage); })));
  const lostValue = valueOf(new Set([...lostDeals].filter((id) => { const l = byId.get(id); return !!l && isLost(stages, l.stage); })));
  const advancedValue = valueOf(advancedDeals);
  const open = lines.filter((l) => !isWon(stages, l.stage) && !isLost(stages, l.stage));
  const quietOpen = open.filter((l) => !moved.has(l.id)).length;
  const action: NextAction | null = !open.length ? null : quietOpen
    ? { text: "حرّك الراكد: " + nOpenLine(quietOpen) + " من أصل " + fmt(open.length) + " " + notMoved(quietOpen) +
        " خلال " + nDay(days) + " — حدّد خطوة تالية، أو أغلق ما لم يعد قائمًا.", stage: null }
    : { text: "كل البنود المفتوحة تحركت خلال " + nDay(days) + " — لا راكد يحتاج قرارًا.", stage: null };
  return { days, totals, wonValue, lostValue, advancedValue, weeks, quietOpen, openLines: open.length, action };
}

// ------------------------------------------------------------------------------------------------
// The headline strip and the whole report
// ------------------------------------------------------------------------------------------------
export type PipelineReport = {
  generatedAt: number; lines: number; smallSample: boolean;
  headline: {
    openLines: number; openValue: number; weightedValue: number; unpricedOpen: number; pricedOpen: number;
    winRatePct: number | null; wonCount: number; lostCount: number;
    /** Each rate carries its own sample, because «small» depends on the metric, not on the board. */
    winRateSmall: boolean; medianCycleDays: number | null; cycleBasis: number;
  };
  funnel: Funnel; velocity: Velocity; products: Products; sources: Sources; movement: Movement;
};

export function buildPipelineReport(input: {
  stages: readonly ReportStage[]; lines: readonly ReportLine[]; events: readonly ReportEvent[];
  now: number; days?: number; sourceLabels: Readonly<Record<string, string>>;
}): PipelineReport {
  const { stages, lines, events, now } = input;
  const products = buildProducts(stages, lines);
  const wonLines = lines.filter((l) => isWon(stages, l.stage));
  const wonCount = wonLines.length;
  const lostCount = lines.filter((l) => isLost(stages, l.stage)).length;
  // Cycle time: creation to the ledger's LAST move into won. Only won deals have a cycle.
  const hist = eventsByOpp(events);
  const cycles = wonLines.map((l) => {
    const w = [...(hist.get(l.id) ?? [])].reverse().find((e) => isWon(stages, e.toStage));
    const end = w ? w.at : Number(l.stageAt) || 0;
    return end && l.createdAt ? Math.max(0, Math.floor((end - l.createdAt) / DAY_MS)) : null;
  }).filter((x): x is number => x !== null);
  return {
    generatedAt: now, lines: lines.length, smallSample: lines.length < SMALL_SAMPLE,
    headline: {
      pricedOpen: products.rows.reduce((n, r) => n + r.openLines - r.unpricedOpen, 0),
      winRateSmall: wonCount + lostCount < SMALL_SAMPLE,
      cycleBasis: cycles.length,
      openLines: products.rows.reduce((n, r) => n + r.openLines, 0),
      openValue: products.openValue,
      weightedValue: products.rows.reduce((n, r) => n + r.weightedValue, 0),
      unpricedOpen: products.rows.reduce((n, r) => n + r.unpricedOpen, 0),
      winRatePct: pctOf(wonCount, wonCount + lostCount), wonCount, lostCount,
      medianCycleDays: median(cycles),
    },
    funnel: buildFunnel(stages, lines, events),
    velocity: buildVelocity(stages, lines, events, now),
    products,
    sources: buildSources(stages, lines, events, input.sourceLabels),
    movement: buildMovement(stages, lines, events, now, input.days ?? 30),
  };
}
