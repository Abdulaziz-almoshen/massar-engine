// reports-domain.ts — the four named reports, specified once (R11).
//
// The stage document ends by naming four reports. They were described in prose, never defined, and
// «التقارير» has been a «قريبًا» placeholder since the rail was built. Prose is not a definition: it
// does not say which outcome keys count, whether a closed action still appears, or what the screen
// says when the answer is «none». Each report below carries all of that, so the query, the screen
// and the empty state cannot disagree about what the report IS.
//
// Every key here is checked against the shipped ladder by assertReportKeys(), because a report that
// filters on an outcome key nobody writes returns an empty table that looks exactly like good news.

export type ReportSource = "open_actions" | "lost_deals";

export type ReportDef = {
  readonly id: string;
  readonly title: string;
  /** The question a human is actually asking. Shown under the title, so the report says what it is. */
  readonly question: string;
  readonly source: ReportSource;
  /** Outcome keys that qualify. Empty means «any key», narrowed by dept instead. */
  readonly outcomeKeys: readonly string[];
  /** Department that owes the work. Null for reports not scoped to one. */
  readonly dept: string | null;
  /** What the screen says when there is nothing — never a blank table. */
  readonly emptyTitle: string;
  readonly emptyBody: string;
};

export const REPORTS: readonly ReportDef[] = [
  {
    id: "awaiting-procurement",
    title: "الفرص المتوقفة بانتظار المشتريات",
    question: "أي صفقة اتُّفق عليها ثم توقّفت عند المشتريات، ومنذ متى؟",
    source: "open_actions",
    outcomeKeys: ["awaiting_procurement"],
    dept: "المشتريات",
    emptyTitle: "لا صفقة متوقفة عند المشتريات",
    emptyBody: "لم تُسجَّل نتيجة «بانتظار المشتريات» على أي فرصة مفتوحة. يظهر هنا كل إجراء لم يُغلق بعد، مرتبًا بالأقدم توقّفًا.",
  },
  {
    id: "contract-edit",
    title: "الفرص التي تحتاج تعديل عقد",
    question: "أي صفقة تنتظر القانونية، وكم بقيت تنتظر؟",
    source: "open_actions",
    outcomeKeys: ["contract_edit"],
    dept: "القانونية",
    emptyTitle: "لا عقد ينتظر تعديلًا",
    emptyBody: "لم تُسجَّل نتيجة «يحتاج تعديل العقد» على أي فرصة مفتوحة.",
  },
  {
    id: "blocked-on-tech",
    title: "الإجراءات المعلّقة على التقنية",
    question: "ما الذي تنتظره المبيعات من التقنية الآن؟",
    source: "open_actions",
    // TWO keys, both landing on التقنية: «بانتظار الجهة التقنية» and «يحتاج توضيح تقني». Filtering
    // on the department rather than one key is what keeps them together.
    outcomeKeys: ["awaiting_tech", "needs_tech_clarity"],
    dept: "التقنية",
    emptyTitle: "لا شيء معلّق على التقنية",
    emptyBody: "لا إجراء مفتوح مسنَد إلى التقنية. يشمل هذا التقرير «بانتظار الجهة التقنية» و«يحتاج توضيح تقني» معًا.",
  },
  {
    id: "lost-to-integration",
    title: "الخسائر بسبب التكامل",
    question: "كم خسرنا لأن التكامل لم ينجح، وعلى أي منتج؟",
    source: "lost_deals",
    // TWO keys mean «lost to integration», and they sit at different stages: «خسارة – تكامل» is the
    // commercial loss, «فشل التكامل» is the technical one. A report counting either alone
    // UNDERCOUNTS, which on a loss report is the direction that hides the problem.
    outcomeKeys: ["lost_integration", "integration_failed"],
    dept: null,
    emptyTitle: "لا خسارة بسبب التكامل",
    emptyBody: "لم تُغلق أي صفقة بنتيجة «خسارة – تكامل» أو «فشل التكامل».",
  },
];

export function reportById(id: string): ReportDef | null {
  return REPORTS.find((r) => r.id === id) ?? null;
}

/**
 * Every outcome key a report filters on must EXIST in the shipped ladder.
 *
 * A report keyed on an outcome nobody writes returns an empty table, and an empty loss report reads
 * as good news. This is the same defect as a table with no writer, one layer up: the query is
 * valid, the screen renders, and the number is silently zero forever.
 */
export function assertReportKeys(knownKeys: readonly string[]): string[] {
  const known = new Set(knownKeys);
  const bad: string[] = [];
  for (const r of REPORTS) {
    for (const k of r.outcomeKeys) if (!known.has(k)) bad.push(`${r.id} -> ${k}`);
  }
  return bad;
}
