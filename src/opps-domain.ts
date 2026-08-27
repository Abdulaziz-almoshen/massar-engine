// opps-domain.ts — THE BUSINESS TIER for فرص البيع.
//
// WHY THIS FILE EXISTS. Technical Standards §1 requires a closed three-tier split with business
// rules independent of any UI, and §4 requires those rules to be unit-tested. Before this file the
// opportunity rules — what a line is worth, when a deal is stalled, what an account's rollup status
// is, which money counts toward a total — lived inside `opps-crm.ts` as client JavaScript embedded
// in a template literal. That is the presentation tier, it cannot be imported, and therefore it
// could not be tested at all: coverage of the single most consequential arithmetic in the product
// (money on a sales board) was zero.
//
// ONE DEFINITION, TWO RUNTIMES. The server needs these rules for validation; the browser needs them
// for rendering. Copying them is how the card head and the stage strip came to disagree about
// whether a lost deal counts — a defect this cycle already had to fix once. So the functions are
// authored ONCE here, and `OPPS_DOMAIN_JS` ships their compiled source to the browser via
// Function.prototype.toString(). What the test asserts in Node is byte-for-byte what the page runs.
//
// CONSTRAINT, and it is load-bearing: every exported function below must be SELF-CONTAINED — it may
// reference only its own parameters and the constants injected alongside it. No imports, no module
// state, no helpers from elsewhere in this file unless that helper is also in DOMAIN_FNS. A
// reference that resolves in Node and not in the browser is a blank page, and `checkDomainClosure()`
// asserts against exactly that at boot rather than trusting the rule to hold by intent.

/** One rung of the deal ladder. Ordered; `position` is what makes "forward" and "backward" mean
 *  anything. Taken from the design prototype's own five stages plus the terminal loss. */
export type OppStage = {
  readonly key: "contact" | "present" | "tech" | "negotiate" | "won" | "lost";
  readonly label: string;
  readonly dot: string;
  readonly position: number;
};

export const OPP_STAGES: readonly OppStage[] = [
  { key: "contact", label: "تواصل أولي", dot: "#999999", position: 1 },
  { key: "present", label: "عرض المنتج", dot: "#2F5F94", position: 2 },
  { key: "tech", label: "التقييم الفني والمالي", dot: "#7A5CC4", position: 3 },
  { key: "negotiate", label: "التفاوض والاعتماد", dot: "#1F7A73", position: 4 },
  { key: "won", label: "إغلاق الصفقة", dot: "#027A48", position: 5 },
  { key: "lost", label: "خسارة", dot: "#B42318", position: 6 },
];

/** Where a deal came from. The founder's own distinction, and the reason opportunities are a table
 *  rather than a view over conversations: only `whatsapp` is something this system can witness by
 *  itself; the rest are a human recording what happened offline. */
export const OPP_SOURCES: Readonly<Record<string, string>> = {
  whatsapp: "حملة واتساب",
  call: "مكالمة",
  visit: "زيارة",
  referral: "إحالة",
  inbound: "طلب وارد",
  other: "غير محدد",
};

/** The two rungs where deals actually go quiet, and how long is too long. Not a guess: these are
 *  the prototype's own `stallStages` / `stallDays`. */
export const OPP_STALL_STAGES: readonly string[] = ["tech", "negotiate"];
export const OPP_STALL_DAYS = 14;

/** The rungs that mean a real, CONFIRMED buyer — not merely someone who has heard the pitch.
 *  «التقييم الفني والمالي» is the first stage a prospect reaches only by putting their own people
 *  on it, and «التفاوض والاعتماد» is the one before signature. Below these two, interest is a
 *  conversation; at or above them it is a commitment of the client's time and budget.
 *
 *  Deliberately NOT a `position >= 3` range test. «إغلاق الصفقة» sits at position 5 and is a
 *  CUSTOMER, not a potential one, so a range would silently fold won deals into a number the
 *  product side reads as pipeline. Naming the two rungs makes that exclusion visible and makes a
 *  future stage insert a decision instead of an accident. */
export const CONFIRMED_INTEREST_STAGES: readonly string[] = ["tech", "negotiate"];

export function isConfirmedInterestStage(stage: string): boolean {
  return stage === "tech" || stage === "negotiate";
}

/** The shape the rules operate on — the stored columns they read, and nothing else. Deliberately
 *  structural rather than the full `OppRow`: the browser holds plain JSON, and a rule that needed a
 *  class could not run in both tiers. */
export type OppLineFacts = {
  stage: string;
  salePrice: number;
  years: number;
  quantity: number;
  discountPercent: number;
  stageEnteredAt: number;
};

// ---------------------------------------------------------------------------
// THE RULES. Every function below is self-contained by contract (see the header) because its source
// is shipped to the browser verbatim.
// ---------------------------------------------------------------------------

export function isWonStage(stage: string): boolean {
  return stage === "won";
}

export function isLostStage(stage: string): boolean {
  return stage === "lost";
}

export function isOpenStage(stage: string): boolean {
  return stage !== "won" && stage !== "lost";
}

/**
 * سعر البيع × السنوات × الكمية × (١ − الخصم). The prototype's arithmetic, and the ONE definition of
 * what a line is worth — the card total, the stage strip, the list footer and the create form's
 * live preview all resolve here, so no two numbers on one screen can be computed differently.
 */
export function calculateLineValue(line: OppLineFacts): number {
  const price = Number(line.salePrice) || 0;
  const years = Number(line.years) || 1;
  const quantity = Number(line.quantity) || 1;
  const discountPercent = Number(line.discountPercent) || 0;
  return Math.round(price * years * quantity * (1 - discountPercent / 100));
}

/**
 * An UNPRICED line is not a worthless one. The assistant opens lines from a conversation that
 * contains no number, and rendering those as «٠ ر.س» claims a deal is worth nothing when the truth
 * is that nobody has priced it. Every total and every cell asks this before printing money.
 */
export function isLinePriced(line: OppLineFacts): boolean {
  return Number(line.salePrice) > 0;
}

/** Whole days spent in the CURRENT stage. Reads `stageEnteredAt`, which moves only on a real stage
 *  change, so editing a next step never resets the clock a stall is measured against. */
export function daysInStage(line: OppLineFacts, now: number): number {
  const enteredAt = Number(line.stageEnteredAt) || now;
  return Math.floor((now - enteredAt) / 86400000);
}

/** «متوقّف» — open, on one of the two rungs that stall, and past the threshold. A won or lost deal
 *  is never stalled: it is finished. */
export function isLineStalled(line: OppLineFacts, now: number): boolean {
  if (!isOpenStage(line.stage)) return false;
  if (OPP_STALL_STAGES.indexOf(line.stage) === -1) return false;
  return daysInStage(line, now) >= OPP_STALL_DAYS;
}

/**
 * THE MONEY RULE: a lost line is worth nothing, so it never counts toward a total that MIXES
 * stages. This shipped broken once — the account card excluded lost while the stage strip and the
 * list footer added it back, so two numbers on one screen disagreed by the value of every deal
 * already failed. Single-stage figures (the خسارة column's own sum) do not call this.
 */
export function sumLiveValue(lines: readonly OppLineFacts[]): number {
  let total = 0;
  for (const line of lines) {
    if (!isLostStage(line.stage)) total += calculateLineValue(line);
  }
  return total;
}

export function hasLostLine(lines: readonly OppLineFacts[]): boolean {
  return lines.some((line) => isLostStage(line.stage));
}

/**
 * An account's rollup: قائمة while anything is still live, ربح/خسارة only once every line has
 * landed, مكتملة جزئياً for the mixed close. The head must never claim a deal is won while a line
 * beneath it is open.
 */
export function groupStatusKey(lines: readonly OppLineFacts[]): string {
  let open = 0;
  let won = 0;
  let lost = 0;
  for (const line of lines) {
    if (isOpenStage(line.stage)) open++;
    else if (isWonStage(line.stage)) won++;
    else lost++;
  }
  if (open > 0) return "open";
  if (won > 0 && lost > 0) return "partial";
  if (won > 0) return "won";
  return "lost";
}

/**
 * Arabic counted nouns are four-way, not `n + noun`: مفرد · مثنى · جمع القلة (٣–١٠) · تمييز مفرد
 * (١١+, and zero). The board first shipped «١ منتجات» and «٥ جهة» — broken grammar in the product's
 * own language, on the two lines a reader's eye lands on first. `formatNumber` is passed in rather
 * than imported because digit rendering is a presentation concern and this tier must not own one.
 */
export function pluralizeArabic(
  count: number,
  one: string,
  two: string,
  few: string,
  many: string,
  formatNumber: (value: number) => string,
): string {
  const n = Number(count) || 0;
  if (n === 1) return one;
  if (n === 2) return two;
  return formatNumber(n) + " " + (n >= 3 && n <= 10 ? few : many);
}

/** The account identity a board groups by. A phone is the account key everywhere else in this
 *  product (entities and contacts are both phone-keyed); a line recorded after a visit with no
 *  number groups by its name. Never by both, or one client opens two cards. */
export function accountKey(accountName: string, phone: string | null | undefined): string {
  return phone ? "p:" + phone : "n:" + String(accountName || "").trim();
}

// ---------------------------------------------------------------------------
// The seam that carries all of the above into the browser.
// ---------------------------------------------------------------------------

/** The functions shipped to the presentation tier, in dependency order. Adding one here is the ONLY
 *  way it reaches the page — and `checkDomainClosure()` will reject it if it is not self-contained. */
const DOMAIN_FNS = [
  isWonStage, isLostStage, isOpenStage,
  calculateLineValue, isLinePriced, daysInStage, isLineStalled,
  sumLiveValue, hasLostLine, groupStatusKey, pluralizeArabic, accountKey,
] as const;

/**
 * The compiled source of the constants and rules above, as one script the dashboard interpolates.
 * Function.prototype.toString() returns what tsc emitted, so the browser runs the exact code the
 * test suite exercised — the copy-drift this file exists to end cannot reappear through this seam.
 */
export const OPPS_DOMAIN_JS: string = [
  "/* ===== opps-domain (generated from src/opps-domain.ts — do not edit here) ===== */",
  "var OPP_STAGES = " + JSON.stringify(OPP_STAGES) + ";",
  "var OPP_SOURCES = " + JSON.stringify(OPP_SOURCES) + ";",
  "var OPP_STALL_STAGES = " + JSON.stringify(OPP_STALL_STAGES) + ";",
  "var OPP_STALL_DAYS = " + String(OPP_STALL_DAYS) + ";",
  ...DOMAIN_FNS.map((fn) => fn.toString()),
].join("\n");

/**
 * BOOT ASSERTION for the one constraint that cannot be typed: every shipped function must resolve
 * only against its parameters and the injected constants. A helper that exists in this module but
 * is not in DOMAIN_FNS compiles cleanly, passes every unit test in Node, and throws
 * `ReferenceError` in the browser — which renders a blank page, the exact failure class ADR-0001
 * was written for. Catching it at boot turns a silent production blank into a startup error.
 *
 * Returns the offending names rather than throwing, so the caller decides whether a drifted seam
 * should stop the process or just shout.
 */
export function checkDomainClosure(): string[] {
  const provided = new Set<string>([
    "OPP_STAGES", "OPP_SOURCES", "OPP_STALL_STAGES", "OPP_STALL_DAYS",
    ...DOMAIN_FNS.map((fn) => fn.name),
    // globals every browser and Node share, which a rule may legitimately use
    "Number", "Math", "String", "Boolean", "Array", "Object", "JSON", "Date", "isNaN",
  ]);
  const problems: string[] = [];
  for (const fn of DOMAIN_FNS) {
    const source = fn.toString();
    // Strip string literals and comments FIRST. Without this the scanner reported the CONTENTS of
    // "won" and "lost" as undefined identifiers — a check that cries wolf gets muted, which is
    // how the class it guards comes back.
    const body = source
      .slice(source.indexOf("{"))
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\/\/[^\n]*/g, " ")
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      .replace(/'(?:[^'\\]|\\.)*'/g, "''")
      .replace(/`(?:[^`\\]|\\.)*`/g, "``");
    // Identifiers that look like a free reference: a bare name NOT preceded by a dot (so property
    // accesses are ignored) and NOT immediately followed by a colon (object literal keys).
    const identifiers = body.match(/(?<![.\w$])[A-Za-z_$][\w$]*(?!\s*:)/g) ?? [];
    for (const name of identifiers) {
      if (RESERVED.has(name) || provided.has(name)) continue;
      // a parameter or a local of this very function is fine
      const header = source.slice(0, source.indexOf("{"));
      if (header.includes(name)) continue;
      if (new RegExp("(?:var|let|const)\\s+" + name + "\\b").test(body)) continue;
      problems.push(fn.name + " → " + name);
    }
  }
  return problems;
}

const RESERVED = new Set<string>([
  "return", "if", "else", "for", "of", "in", "let", "const", "var", "function", "true", "false",
  "null", "undefined", "typeof", "new", "this", "break", "continue", "while", "do", "switch",
  "case", "default", "throw", "try", "catch", "finally", "void", "delete", "instanceof",
]);
