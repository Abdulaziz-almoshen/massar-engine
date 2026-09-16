// acceptance-domain.ts — «قبول المنتجات»: which products the market actually bought.
//
// The founder's prototype ends its التقارير screen with a table nobody in Massar could produce:
// every product classified by how customers received it — مقبولة (sold well) · متعثّرة (selling, but
// badly) · غير مقبولة (tried and rejected) · لم تُبع بعد (no verdict yet) — with the count of deals
// won, lost and open behind each one, its attainment against target, and the reason customers gave
// most often for saying no.
//
// The classification is the whole point, so it lives here and not in a renderer. Two rules decide it:
//
//   1. A VERDICT NEEDS DECIDED DEALS. A product with nothing won and nothing lost is «لم تُبع بعد»,
//      no matter how many open lines it carries — an open deal is a question, not an answer. Calling
//      that product «غير مقبولة» because it has not closed yet would condemn a product for being new.
//   2. THE BAR IS THE WIN RATE AMONG DECIDED DEALS, not the pipeline and not the money: «did the
//      customers who reached a decision say yes?» A single win out of one decided deal is not a
//      verdict either, which is why MIN_DECIDED exists and the screen prints the denominator.
//
// PURE. No I/O, no clock, no DOM. Serialised into the page, so these functions may reference only
// their parameters and the injected constants.

/** Fewer decided deals than this and the product is «قليل البيانات»: the rate exists but says nothing. */
export const ACCEPT_MIN_DECIDED = 2;
/** At or above this share of decided deals won, the market accepted it. */
export const ACCEPT_GOOD_PCT = 60;
/** Below this, customers were asked and said no. Between the two, it sells — badly. */
export const ACCEPT_BAD_PCT = 30;

export const ACCEPT_STATES = ["accepted", "struggling", "rejected", "unsold", "thin"] as const;
export type AcceptState = (typeof ACCEPT_STATES)[number];
export const ACCEPT_LABELS: Readonly<Record<AcceptState, string>> = {
  accepted: "مقبولة — بيعت جيدًا",
  struggling: "متعثّرة",
  rejected: "غير مقبولة من العملاء",
  unsold: "لم تُبع بعد",
  thin: "قليلة البيانات",
};
export const ACCEPT_HINTS: Readonly<Record<AcceptState, string>> = {
  accepted: "أغلب الصفقات المحسومة انتهت بالبيع",
  struggling: "تُباع، لكن أكثر من ثلث المحسوم يُخسر",
  rejected: "أكثر الصفقات المحسومة خُسرت",
  unsold: "لا صفقة محسومة بعد — لا حكم",
  thin: "صفقة واحدة محسومة فقط — لا تكفي لحكم",
};

export type AcceptLine = { product: string; stage: string; lostReason?: string | null };
export type AcceptRow = {
  product: string;
  state: AcceptState;
  won: number; lost: number; open: number; decided: number;
  winRatePct: number | null;
  /** the reason given most often on this product's lost lines, and how many said it */
  topReason: string | null; topReasonCount: number;
  attainmentPct: number | null;
};

/**
 * One row per product that has any line at all, plus every product in `catalogue` so a product with
 * no deals still appears as «لم تُبع بعد» — a product missing from the table reads as "we don't sell
 * that", which is a different claim from "nobody has bought it yet".
 *
 * `isWon` / `isLost` are passed in because the ladder belongs to the administrator (settings), and a
 * second copy of "which rung is terminal" in this file would drift from it the first time one moved.
 */
export function productAcceptance(
  lines: readonly AcceptLine[],
  catalogue: readonly string[],
  isWon: (stage: string) => boolean,
  isLost: (stage: string) => boolean,
  attainmentOf?: (product: string) => number | null,
): AcceptRow[] {
  var by: Record<string, { won: number; lost: number; open: number; reasons: Record<string, number> }> = {};
  var seen: string[] = [];
  var touch = function (p: string) {
    if (!by[p]) { by[p] = { won: 0, lost: 0, open: 0, reasons: {} }; seen.push(p); }
    return by[p];
  };
  for (var c = 0; c < catalogue.length; c++) touch(String(catalogue[c]));
  for (var i = 0; i < lines.length; i++) {
    var l = lines[i];
    var name = String(l.product || "");
    if (!name) continue;
    var b = touch(name);
    if (isWon(l.stage)) b.won++;
    else if (isLost(l.stage)) {
      b.lost++;
      var why = typeof l.lostReason === "string" ? l.lostReason.trim() : "";
      if (why) b.reasons[why] = (b.reasons[why] || 0) + 1;
    } else b.open++;
  }
  var out: AcceptRow[] = [];
  for (var s = 0; s < seen.length; s++) {
    var p = seen[s];
    var r = by[p];
    var decided = r.won + r.lost;
    var pct = decided > 0 ? Math.round((r.won / decided) * 100) : null;
    var state: AcceptState = decided === 0 ? "unsold"
      : decided < ACCEPT_MIN_DECIDED ? "thin"
      : (pct as number) >= ACCEPT_GOOD_PCT ? "accepted"
      : (pct as number) >= ACCEPT_BAD_PCT ? "struggling"
      : "rejected";
    var top: string | null = null, topN = 0;
    for (var k in r.reasons) if (r.reasons[k] > topN) { top = k; topN = r.reasons[k]; }
    out.push({
      product: p, state: state, won: r.won, lost: r.lost, open: r.open, decided: decided,
      winRatePct: pct, topReason: top, topReasonCount: topN,
      attainmentPct: attainmentOf ? attainmentOf(p) : null,
    });
  }
  // Worst first: this table exists to surface what is not selling, and a reader who has to scroll
  // past the winners to find the problem reads a different report from the one intended.
  var rank: Record<string, number> = { rejected: 0, struggling: 1, thin: 2, accepted: 3, unsold: 4 };
  out.sort(function (a, b2) {
    if (rank[a.state] !== rank[b2.state]) return rank[a.state] - rank[b2.state];
    var ad = a.decided + a.open, bd = b2.decided + b2.open;
    if (ad !== bd) return bd - ad;
    return a.product < b2.product ? -1 : a.product > b2.product ? 1 : 0;
  });
  return out;
}

/** How many products sit in each state — the tiles above the table. */
export function acceptanceTotals(rows: readonly AcceptRow[]): { key: AcceptState; label: string; count: number }[] {
  var out: { key: AcceptState; label: string; count: number }[] = [];
  for (var i = 0; i < ACCEPT_STATES.length; i++) {
    var k = ACCEPT_STATES[i];
    var n = 0;
    for (var j = 0; j < rows.length; j++) if (rows[j].state === k) n++;
    out.push({ key: k, label: ACCEPT_LABELS[k], count: n });
  }
  return out;
}

// ---------------------------------------------------------------------------------------- the seam

const DOMAIN_FNS = [productAcceptance, acceptanceTotals] as const;
const INJECTED = ["ACCEPT_MIN_DECIDED", "ACCEPT_GOOD_PCT", "ACCEPT_BAD_PCT", "ACCEPT_STATES", "ACCEPT_LABELS", "ACCEPT_HINTS"] as const;

export const ACCEPTANCE_DOMAIN_JS: string = [
  "/* ===== acceptance-domain (generated from src/acceptance-domain.ts — do not edit here) ===== */",
  "var ACCEPT_MIN_DECIDED = " + ACCEPT_MIN_DECIDED + ";",
  "var ACCEPT_GOOD_PCT = " + ACCEPT_GOOD_PCT + ";",
  "var ACCEPT_BAD_PCT = " + ACCEPT_BAD_PCT + ";",
  "var ACCEPT_STATES = " + JSON.stringify(ACCEPT_STATES) + ";",
  "var ACCEPT_LABELS = " + JSON.stringify(ACCEPT_LABELS) + ";",
  "var ACCEPT_HINTS = " + JSON.stringify(ACCEPT_HINTS) + ";",
  ...DOMAIN_FNS.map((fn) => fn.toString()),
].join("\n");

export function checkAcceptanceDomainClosure(): string[] {
  const problems: string[] = [];
  const shipped = DOMAIN_FNS.map((fn) => fn.name);
  for (const fn of DOMAIN_FNS) {
    const src = fn.toString().replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ").replace(/"[^"\n]*"/g, '""');
    for (const id of src.match(/\b[A-Za-z_$][A-Za-z0-9_$]*\b/g) ?? []) {
      if (/^[A-Z][A-Z0-9_]+$/.test(id) && (INJECTED as readonly string[]).indexOf(id) === -1) problems.push(fn.name + " references " + id);
      if (/^(productAcceptance|acceptanceTotals)$/.test(id) && shipped.indexOf(id) === -1) problems.push(fn.name + " references " + id);
    }
  }
  return problems;
}
