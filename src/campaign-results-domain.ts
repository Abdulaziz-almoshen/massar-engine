// campaign-results-domain.ts — what a campaign led to after «مهتم» (client A, BRD v1.0: BR-MON-004/006,
// §23 KPIs, slice S4): qualified customers, meetings, opportunities, quotes, won deals and their revenue,
// and the rates the BRD defines over them.
//
// PURE. `funnelRates` is serialised into the page (the campaign screen's top of funnel is computed there,
// from the same contact ledger its six cards use, so one number never has two sources). Attribution and
// the rollups run on the server.

// ------------------------------------------------------------------------------------------ attribution

/** A WhatsApp line opened within this many days of a launch, for a phone that campaign targeted and the
 *  product it sold, is attributed to it when the line names no campaign itself. */
export const ATTRIBUTION_DAYS = 30;

export type CampaignRef = { id: number; launchedAt: number; product: string | null; phones: readonly string[]; test?: boolean };
export type LineRef = { id: number; phone: string | null; product: string; source: string; sourceRef: string | null; createdAt: number };

/** Target outcomes that mean the campaign's message actually went out. A target refused before sending
 *  (opted_out, outside_window, no_inbound_ever) was never reached, so the campaign earns nothing from them. */
export function isReachedOutcome(outcome: string | null | undefined): boolean {
  return outcome == null || outcome === "sent";
}

type Index = { live: CampaignRef[]; byId: Map<string, CampaignRef>; phones: Map<number, Set<string>>; windowMs: number };
function indexCampaigns(campaigns: readonly CampaignRef[], days: number): Index {
  const live = campaigns.filter((c) => !c.test);
  return { live, byId: new Map(live.map((c) => [String(c.id), c])), phones: new Map(live.map((c) => [c.id, new Set(c.phones)])),
    windowMs: Math.max(0, days) * 86_400_000 };
}
/** Could this campaign have produced an event for this phone and product at this moment? */
function canCredit(ix: Index, c: CampaignRef, phone: string, product: string, at: number): boolean {
  if (c.product && c.product !== product) return false;
  if (!(ix.phones.get(c.id) as Set<string>).has(phone)) return false;
  return c.launchedAt <= at && at - c.launchedAt <= ix.windowMs;
}
function latestFor(ix: Index, phone: string, product: string, at: number): CampaignRef | null {
  let best: CampaignRef | null = null;
  for (const c of ix.live) if (canCredit(ix, c, phone, product, at) && (!best || c.launchedAt > best.launchedAt)) best = c;
  return best;
}

/**
 * Which campaign each opportunity line belongs to (BR-MON-006: الحملة → الفرصة). Only WhatsApp lines can
 * belong to a campaign; a call, a visit, a referral or a partner never does, whatever its reference says
 * (a partner's reference is a name, and a name can be «2»).
 *   1. A WhatsApp line whose source_ref names a live campaign that could have reached it (same product or
 *      none, the phone targeted and reached, launched before the line, within the window) belongs to it.
 *   2. Otherwise it belongs to the LATEST campaign that could have reached it. The reference is only a hint:
 *      autoOppFromHot once wrote the phone's newest campaign whatever its product, and a rehearsal's id
 *      must not take a real campaign's deal away.
 * Rehearsal campaigns never receive a line.
 */
export function attributeLines(campaigns: readonly CampaignRef[], lines: readonly LineRef[], days: number = ATTRIBUTION_DAYS): Map<number, number[]> {
  const out = new Map<number, number[]>();
  const ix = indexCampaigns(campaigns, days);
  for (const l of lines) {
    if (l.source !== "whatsapp" || !l.phone) continue;
    const named = l.sourceRef ? ix.byId.get(String(l.sourceRef).trim()) : undefined;
    const c = named && canCredit(ix, named, l.phone, l.product, l.createdAt) ? named : latestFor(ix, l.phone, l.product, l.createdAt);
    if (!c) continue;
    const list = out.get(c.id) || []; list.push(l.id); out.set(c.id, list);
  }
  return out;
}

/** Each HOT reading belongs to one campaign at most — the latest that could have produced it — so a customer
 *  two campaigns reached is qualified once, not once per campaign. Returns campaign id → phones. */
export function attributeHot(campaigns: readonly CampaignRef[], hot: readonly { phone: string; product: string; ts: number }[], days: number = ATTRIBUTION_DAYS): Map<number, string[]> {
  const out = new Map<number, string[]>();
  const ix = indexCampaigns(campaigns, days);
  for (const h of hot) {
    const c = latestFor(ix, h.phone, h.product, h.ts);
    if (!c) continue;
    const list = out.get(c.id) || []; list.push(h.phone); out.set(c.id, list);
  }
  return out;
}

// ------------------------------------------------------------------------------------------ one campaign

export type ResultLine = { id: number; phone: string | null; stage: string; value: number };

export type CampaignResults = {
  /** customers the campaign qualified: a HOT reading attributed to it, or an opportunity attributed to it
   *  (a customer with an opportunity was qualified on the way, whether or not a tag said so) */
  qualified: number;
  /** distinct customers with an attributed opportunity line */
  opportunities: number;
  /** distinct customers with a meeting logged on an attributed line */
  meetings: number;
  /** distinct customers who were sent a quote on an attributed line */
  quotes: number;
  /** distinct customers with a won line, and lines won/closed for the win rate */
  won: number;
  wonLines: number;
  closedLines: number;
  /** value of won attributed lines (Campaign Revenue), and of lines still open */
  revenue: number;
  openValue: number;
};

export function summarizeResults(hotPhones: readonly string[], lines: readonly ResultLine[],
  meetingLineIds: readonly number[], quoteLineIds: readonly number[]): CampaignResults {
  const qualified = new Set<string>(hotPhones);
  const opp = new Set<string>(), meet = new Set<string>(), quote = new Set<string>(), won = new Set<string>();
  const meetIds = new Set(meetingLineIds), quoteIds = new Set(quoteLineIds);
  let wonLines = 0, closedLines = 0, revenue = 0, openValue = 0;
  for (const l of lines) {
    // A line with no phone still counts as a deal; the customer key falls back to the line so it is not lost.
    const who = l.phone || "line:" + l.id;
    opp.add(who);
    if (meetIds.has(l.id)) meet.add(who);
    if (quoteIds.has(l.id)) quote.add(who);
    if (l.stage === "won") { won.add(who); wonLines++; closedLines++; revenue += l.value; }
    else if (l.stage === "lost") closedLines++;
    else openValue += l.value;
  }
  // The chain never shows more opportunities than qualified customers: see `qualified` above.
  for (const who of opp) qualified.add(who);
  return { qualified: qualified.size, opportunities: opp.size, meetings: meet.size, quotes: quote.size,
    won: won.size, wonLines, closedLines, revenue, openValue };
}

// ------------------------------------------------------------------------------------------ the BRD's rates

export type FunnelCounts = { sent: number; read: number; replied: number; interested: number; qualified: number; opportunities: number; wonLines: number; closedLines: number };

/** §23, each as the BRD writes it. A rate over nothing is null («—»), never 0٪: a campaign that sent nothing
 *  did not have a 0٪ reply rate. A numerator larger than its denominator is null too — the two counts come
 *  from different populations (a hot reading with no «interested» reply), and «100٪» beside «5 من 3» is a
 *  number the screen made up. The counts stay printed beside it. */
export function funnelRates(c: FunnelCounts): { readRate: number | null; replyRate: number | null; interestRate: number | null; qualificationRate: number | null; opportunityConversion: number | null; winRate: number | null } {
  var pct = function (n: number, d: number) { return d > 0 && n <= d ? Math.round((n / d) * 100) : null; };
  return {
    readRate: pct(c.read, c.sent),
    replyRate: pct(c.replied, c.sent),
    interestRate: pct(c.interested, c.sent),
    qualificationRate: pct(c.qualified, c.interested),
    opportunityConversion: pct(c.opportunities, c.qualified),
    winRate: pct(c.wonLines, c.closedLines),
  };
}

/** Human Handoff Rate (§23): conversations handed to a person ÷ conversations that had a customer message. */
export function handoffRate(handedOff: number, conversations: number): number | null {
  return conversations > 0 && handedOff <= conversations ? Math.round((handedOff / conversations) * 100) : null;
}

/** Recommendation Adoption (§23). Nothing records a suggestion being SHOWN, so the honest denominator is the
 *  suggestions somebody decided on: launched or dismissed. Open suggestions are listed beside it, not in it. */
export function adoptionRate(launched: number, dismissed: number): number | null {
  const d = launched + dismissed;
  return d > 0 ? Math.round((launched / d) * 100) : null;
}

/** The assistant's reply time: for each customer message, the first agent message after it within the
 *  window. Median, in seconds — a mean is one slow night away from meaningless. Messages must be sorted by
 *  phone then time. */
export function medianReplySeconds(messages: readonly { phone: string; role: string; ts: number }[], windowMs: number = 15 * 60_000): number | null {
  const gaps: number[] = [];
  let pending: { phone: string; ts: number } | null = null;
  for (const m of messages) {
    if (pending && m.phone !== pending.phone) pending = null;
    // A burst is timed from its first message; a customer message after the window has closed starts a new
    // wait, so one unanswered night does not swallow the next morning's prompt reply.
    if (m.role === "customer") { if (!pending || m.ts - pending.ts > windowMs) pending = { phone: m.phone, ts: m.ts }; continue; }
    if (m.role === "agent" && pending) {
      const gap = m.ts - pending.ts;
      if (gap >= 0 && gap <= windowMs) gaps.push(gap);
      pending = null;
    }
  }
  if (!gaps.length) return null;
  gaps.sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  const ms = gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2;
  return Math.round(ms / 1000);
}

// ------------------------------------------------------------------------------------------ the seam

const DOMAIN_FNS = [funnelRates, handoffRate] as const;
export const CAMPAIGN_RESULTS_DOMAIN_JS: string = [
  "/* ===== campaign-results-domain (generated from src/campaign-results-domain.ts — do not edit here) ===== */",
  "var ATTRIBUTION_DAYS = " + ATTRIBUTION_DAYS + ";",
  ...DOMAIN_FNS.map((fn) => fn.toString()),
].join("\n");
