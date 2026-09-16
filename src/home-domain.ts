// home-domain.ts — what «الرئيسية» reports, as rules rather than as rendering.
//
// The founder's standalone prototype opens on an executive dashboard: four figures, then «صحة خط البيع»
// — every open deal placed in exactly one of four states, each with a count AND the money behind it —
// then the sales partners' week, then sectors, products and quarters.
//
// The four states are the part worth writing down, because they are a CLASSIFICATION and a
// classification that overlaps is a lie: a deal that is both late and waiting on support would be
// counted twice, and the four figures would not add up to the pipeline. Here every line lands in
// exactly one bucket, in a stated order of precedence, and the sum is asserted by the unit test.
//
// PURE. No I/O, no clock of its own (the caller passes `now`), no DOM. Serialised into the page
// through Function.prototype.toString(), so these functions may reference only their parameters and
// the injected constants.

/** One opportunity line as this screen needs it. `stalled` and `lost` are decided by opps-domain — the
 *  ladder is the admin's, so this file must not re-derive which rung is terminal. */
export type HealthLine = {
  id: number;
  value: number;
  /** the line sits on a lost rung (rejected by the customer, or written off) */
  lost: boolean;
  /** open and past the limit its stage allows */
  stalled: boolean;
  /** an escalation or a support request was recorded on it and nobody has closed it */
  awaitingSupport: boolean;
  /** the line is won: finished, and outside the live pipeline */
  won: boolean;
};

export type HealthBucket = { key: string; label: string; hint: string; count: number; value: number };

export const HEALTH_STATES: readonly { key: string; label: string; hint: string }[] = [
  { key: "on_track", label: "على المسار", hint: "تتحرك بين المراحل في وقتها" },
  { key: "late", label: "متأخرة", hint: "تجاوزت المدة المسموحة في مرحلتها" },
  { key: "support", label: "بانتظار الدعم", hint: "طُلب فيها دعم أو تصعيد ولم يُغلق بعد" },
  { key: "rejected", label: "مرفوضة", hint: "أُغلقت خسارةً — مرفوضة من العميل أو متوقفة" },
];

/**
 * Every line in exactly one state. PRECEDENCE, and why:
 *   1. lost      — a closed deal is not "late"; its clock stopped.
 *   2. support   — a deal blocked on someone else is not the sales owner's delay to answer for, so it
 *                  must not hide inside «متأخرة» where it reads as neglect.
 *   3. stalled   — open, and past what its own stage allows.
 *   4. on track  — everything else that is open.
 * Won lines are not in the pipeline at all and are left out entirely, which is why the caller gets
 * `openCount`/`openValue` back beside the buckets: the four counts must reconcile to the open book.
 */
export function pipelineHealth(lines: readonly HealthLine[]): {
  buckets: HealthBucket[]; openCount: number; openValue: number; total: number;
} {
  var by: Record<string, HealthBucket> = {};
  for (var i = 0; i < HEALTH_STATES.length; i++) {
    var s = HEALTH_STATES[i];
    by[s.key] = { key: s.key, label: s.label, hint: s.hint, count: 0, value: 0 };
  }
  var openCount = 0, openValue = 0, total = 0;
  for (var j = 0; j < lines.length; j++) {
    var l = lines[j];
    if (l.won) continue;
    var key = l.lost ? "rejected" : l.awaitingSupport ? "support" : l.stalled ? "late" : "on_track";
    var v = Number(l.value) || 0;
    by[key].count++;
    by[key].value += v;
    total++;
    if (!l.lost) { openCount++; openValue += v; }
  }
  var out: HealthBucket[] = [];
  for (var k = 0; k < HEALTH_STATES.length; k++) out.push(by[HEALTH_STATES[k].key]);
  return { buckets: out, openCount: openCount, openValue: openValue, total: total };
}

/** Attainment is NOT redefined here: sales-domain.attainmentPct is already serialised into the page,
 *  and a second copy of a rule is how «coveragePct» once shipped twice and the page ran whichever
 *  was concatenated last (scripts/check-browser-globals.mjs exists because of that). This screen
 *  rounds it for display with wholePct below. */
export function wholePct(pct: unknown): number | null {
  if (pct === null || pct === undefined) return null;
  var n = Number(pct);
  return isFinite(n) ? Math.round(n) : null;
}

/** The partners' week as the home band prints it: the contracted target, how much of it was contacted,
 *  and what the contacts produced. Shares are of the TARGET, because that is the promise being
 *  measured; with no target there is no share, and the band says the count alone. */
export function partnerWeekBand(line: {
  target?: unknown; contacted?: unknown; interested?: unknown; notInterested?: unknown; noReply?: unknown;
}): { target: number; contacted: number; interested: number; notInterested: number; noReply: number;
      contactedPct: number | null; interestedPct: number | null; notInterestedPct: number | null; noReplyPct: number | null } {
  var t = Number(line && line.target) || 0;
  var c = Number(line && line.contacted) || 0;
  var i = Number(line && line.interested) || 0;
  var n = Number(line && line.notInterested) || 0;
  var r = Number(line && line.noReply) || 0;
  var share = function (v: number) { return t > 0 ? Math.round((v / t) * 1000) / 10 : null; };
  return { target: t, contacted: c, interested: i, notInterested: n, noReply: r,
    contactedPct: share(c), interestedPct: share(i), notInterestedPct: share(n), noReplyPct: share(r) };
}

// ---------------------------------------------------------------------------------------- the seam

const DOMAIN_FNS = [pipelineHealth, wholePct, partnerWeekBand] as const;
const INJECTED = ["HEALTH_STATES"] as const;

export const HOME_DOMAIN_JS: string = [
  "/* ===== home-domain (generated from src/home-domain.ts — do not edit here) ===== */",
  "var HEALTH_STATES = " + JSON.stringify(HEALTH_STATES) + ";",
  ...DOMAIN_FNS.map((fn) => fn.toString()),
].join("\n");

/** A serialised function may reference only its parameters and the injected constants. */
export function checkHomeDomainClosure(): string[] {
  const problems: string[] = [];
  const shipped = DOMAIN_FNS.map((fn) => fn.name);
  for (const fn of DOMAIN_FNS) {
    const src = fn.toString().replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ").replace(/"[^"\n]*"/g, '""');
    for (const id of src.match(/\b[A-Za-z_$][A-Za-z0-9_$]*\b/g) ?? []) {
      if (/^[A-Z][A-Z0-9_]+$/.test(id) && (INJECTED as readonly string[]).indexOf(id) === -1) problems.push(fn.name + " references " + id);
      if (/^(pipelineHealth|wholePct|partnerWeekBand)$/.test(id) && shipped.indexOf(id) === -1) problems.push(fn.name + " references " + id);
    }
  }
  return problems;
}
