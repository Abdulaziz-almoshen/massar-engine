// config-domain.ts — the rules behind «إعدادات النظام»: the sales ladder an admin may edit, the
// team directory escalations point at, and what «متأخرة» means per stage.
//
// WHY a domain module and not code inside the endpoints: the same rules decide twice — the browser
// disables a control and the server refuses the write — and a rule written twice is a rule that
// disagrees with itself. STANDARDS.md §2.1: pure, unit-tested, serialised into the page.
//
// THE OWNERSHIP LINE, because it is the thing most likely to be got wrong later:
//   · code owns  key · dot · terminal      (a stage's identity; renaming a key would orphan every
//                                           stored opportunity, every ledger event and every target)
//   · admin owns label · weight · position · SLA · active
// So the boot seed inserts what is missing and NEVER overwrites the admin's columns. Before this
// module the seed did `ON CONFLICT DO UPDATE SET label…, weight_pct…`, which would have quietly
// undone every edit on the next deploy.

/** A rung of the ladder as it is stored and edited. */
export type StageRow = {
  key: string;
  label: string;
  weightPct: number;
  position: number;
  /** Days a line may sit on this rung before the board calls it late. null = no SLA. */
  slaDays: number | null;
  active: boolean;
  dot: string;
  terminal: "won" | "lost" | null;
  exitCriterion: string | null;
};

export type StageInput = {
  key?: unknown; label?: unknown; weightPct?: unknown; position?: unknown;
  slaDays?: unknown; active?: unknown; exitCriterion?: unknown;
};

export type Rejection = { ok: false; code: string; reason: string; field: string };
export type StageAccepted = { ok: true; value: Omit<StageRow, "dot" | "terminal"> };

export const STAGE_LABEL_MAX = 40;
export const STAGE_KEY_MAX = 24;
export const SLA_DAYS_MAX = 365;
/** Terminal rungs are the two the whole engine is written against (isWonStage/isLostStage, the
 *  targets query, every forecast). They can be relabelled; they cannot be added, removed, paused
 *  or reweighted out of existence. */
export const TERMINAL_KEYS: readonly string[] = ["won", "lost"];

export function isTerminalStageKey(key: unknown): boolean {
  return TERMINAL_KEYS.indexOf(String(key)) >= 0;
}

/** A key is ASCII so it can live in a URL, a JSON payload and a SQL literal without escaping, and
 *  is derived from the label only when the admin does not supply one. Arabic labels transliterate
 *  to nothing useful, so the fallback is positional («stage6»), never a mangled romanisation. */
export function stageKeyFrom(label: unknown, taken: readonly string[]): string {
  const ascii = String(label ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  // A key must START with a letter (isValidStageKey). «مراجعة قانونية 1234» reduces to «1234»,
  // which is not a key — caught by the browser test that added exactly that stage.
  const stem = /^[a-z]/.test(ascii) ? ascii : (ascii ? "stage_" + ascii : "stage");
  const base = stem.slice(0, STAGE_KEY_MAX) || "stage";
  if (taken.indexOf(base) === -1) return base;
  for (let i = 2; i < 200; i++) {
    const candidate = (base + "_" + i).slice(0, STAGE_KEY_MAX);
    if (taken.indexOf(candidate) === -1) return candidate;
  }
  return base + "_" + Date.now();
}

export function isValidStageKey(key: unknown): boolean {
  return /^[a-z][a-z0-9_]{0,23}$/.test(String(key ?? ""));
}

/** One gate for add and edit. Returns the cleaned row or the reason, in the words the screen shows:
 *  an error the operator cannot act on is the same as no error at all. */
export function checkStage(input: StageInput, taken: readonly string[], existingKey?: string): StageAccepted | Rejection {
  const label = String(input.label ?? "").replace(/\s+/g, " ").trim();
  if (!label) return { ok: false, code: "invalid_label", reason: "اسم المرحلة مطلوب.", field: "label" };
  if (label.length > STAGE_LABEL_MAX) {
    return { ok: false, code: "invalid_label", reason: "اسم المرحلة 40 حرفًا كحدٍّ أقصى.", field: "label" };
  }
  const key = existingKey ?? (input.key === undefined || input.key === null || input.key === ""
    ? stageKeyFrom(label, taken)
    : String(input.key));
  if (!isValidStageKey(key)) {
    return { ok: false, code: "invalid_key", reason: "معرّف المرحلة حروف إنجليزية صغيرة وأرقام وشرطة سفلية.", field: "key" };
  }
  if (!existingKey && taken.indexOf(key) >= 0) {
    return { ok: false, code: "key_exists", reason: "توجد مرحلة بهذا المعرّف.", field: "key" };
  }
  const weight = Number(input.weightPct);
  if (!Number.isInteger(weight) || weight < 0 || weight > 100) {
    return { ok: false, code: "invalid_weight", reason: "الوزن عدد صحيح من 0 إلى 100.", field: "weightPct" };
  }
  const position = Number(input.position);
  if (!Number.isInteger(position) || position < 1 || position > 99) {
    return { ok: false, code: "invalid_position", reason: "الترتيب عدد صحيح من 1 إلى 99.", field: "position" };
  }
  let slaDays: number | null = null;
  if (input.slaDays !== null && input.slaDays !== undefined && String(input.slaDays) !== "") {
    const n = Number(input.slaDays);
    if (!Number.isInteger(n) || n < 1 || n > SLA_DAYS_MAX) {
      return { ok: false, code: "invalid_sla", reason: "مدة الالتزام من يوم واحد إلى 365 يومًا، أو اتركها فارغة.", field: "slaDays" };
    }
    slaDays = n;
  }
  const active = input.active === undefined ? true : Boolean(input.active);
  if (!active && isTerminalStageKey(key)) {
    return { ok: false, code: "terminal_stage", reason: "مرحلتا الربح والخسارة لا تُوقفان.", field: "active" };
  }
  if (isTerminalStageKey(key) && key === "won" && weight !== 100) {
    return { ok: false, code: "terminal_stage", reason: "وزن «ربح» يبقى 100٪.", field: "weightPct" };
  }
  if (isTerminalStageKey(key) && key === "lost" && weight !== 0) {
    return { ok: false, code: "terminal_stage", reason: "وزن «خسارة» يبقى 0٪.", field: "weightPct" };
  }
  const exit = String(input.exitCriterion ?? "").replace(/\s+/g, " ").trim().slice(0, 200) || null;
  return { ok: true, value: { key, label, weightPct: weight, position, slaDays, active, exitCriterion: exit } };
}

/** Why a stage may not be deleted, in the words the screen shows. Deleting a rung that holds
 *  opportunities would orphan them — the ledger keeps their history under a key nothing defines. */
export function checkStageDelete(key: unknown, openLines: unknown, seededKeys?: readonly string[]): { ok: true } | Rejection {
  if (isTerminalStageKey(key)) {
    return { ok: false, code: "terminal_stage", reason: "مرحلتا الربح والخسارة جزء من المحرك — لا تُحذفان.", field: "key" };
  }
  // A rung the engine SEEDS comes back on the next boot, so deleting it is a lie that lasts until a
  // restart. Pausing it is the honest form, and it survives every deploy.
  if (seededKeys && seededKeys.indexOf(String(key)) >= 0) {
    return { ok: false, code: "seeded_stage", reason: "مرحلة أساسية في المحرك — أوقفها بدل حذفها (الحذف يعود عند إعادة التشغيل).", field: "key" };
  }
  const n = Number(openLines) || 0;
  if (n > 0) {
    return { ok: false, code: "stage_in_use", reason: "على هذه المرحلة فرص مسجّلة — أوقفها بدل حذفها.", field: "key" };
  }
  return { ok: true };
}

/** Which stages a NEW or MOVED line may sit on: active ones, plus the line's current stage so a
 *  paused rung never traps a deal that is already on it. */
export function isStageSelectable(stage: StageRow | undefined, currentStage?: string): boolean {
  if (!stage) return false;
  if (stage.active) return true;
  return !!currentStage && stage.key === currentStage;
}

/** «متأخرة»: an OPEN line that has sat past its stage's SLA. A stage with no SLA never goes late —
 *  silence is not a deadline. Terminal lines are finished, never late. */
export function stageSlaState(
  stage: StageRow | undefined, daysInStage: unknown, now?: unknown,
): { sla: number | null; days: number; late: boolean; overBy: number } {
  void now;
  const days = Math.max(0, Math.floor(Number(daysInStage) || 0));
  const sla = stage && stage.slaDays ? Number(stage.slaDays) : null;
  const terminal = !!stage && stage.terminal !== null;
  const late = sla !== null && !terminal && days >= sla;
  return { sla, days, late, overBy: late && sla !== null ? days - sla : 0 };
}

// ---------------------------------------------------------------------------
// The team directory. Escalation points at a PERSON, so a person has to exist.
// ---------------------------------------------------------------------------

export type TeamRole = "sales" | "support" | "manager";
export const TEAM_ROLES: readonly TeamRole[] = ["sales", "support", "manager"];
export const TEAM_ROLE_LABELS: Readonly<Record<string, string>> = {
  sales: "مبيعات", support: "دعم فني", manager: "إدارة",
};

export type MemberInput = { name?: unknown; email?: unknown; role?: unknown; active?: unknown; divisionId?: unknown };
export type MemberAccepted = { ok: true; value: { name: string; email: string; role: TeamRole; active: boolean; divisionId: number | null } };

/** Deliberately not the RFC 5322 grammar: this is a company directory, and a pattern an operator
 *  can predict beats a pattern that accepts «a"b"@c». One dot-separated domain, no spaces. */
export function isEmailShaped(email: unknown): boolean {
  const s = String(email ?? "").trim();
  return s.length <= 120 && /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(s);
}

export function checkMember(input: MemberInput): MemberAccepted | Rejection {
  const name = String(input.name ?? "").replace(/\s+/g, " ").trim();
  if (!name) return { ok: false, code: "invalid_name", reason: "الاسم مطلوب.", field: "name" };
  if (name.length > 60) return { ok: false, code: "invalid_name", reason: "الاسم 60 حرفًا كحدٍّ أقصى.", field: "name" };
  const email = String(input.email ?? "").trim().toLowerCase();
  if (!email) return { ok: false, code: "invalid_email", reason: "البريد مطلوب — التصعيد يُرسل إليه.", field: "email" };
  if (!isEmailShaped(email)) return { ok: false, code: "invalid_email", reason: "صيغة البريد غير صحيحة.", field: "email" };
  const role = String(input.role ?? "");
  if ((TEAM_ROLES as readonly string[]).indexOf(role) === -1) {
    return { ok: false, code: "invalid_role", reason: "الدور: مبيعات أو دعم فني أو إدارة.", field: "role" };
  }
  let divisionId: number | null = null;
  if (input.divisionId !== null && input.divisionId !== undefined && String(input.divisionId) !== "") {
    const id = Number(input.divisionId);
    if (!Number.isInteger(id) || id <= 0) {
      return { ok: false, code: "invalid_division", reason: "القسم غير معروف.", field: "divisionId" };
    }
    divisionId = id;
  }
  return { ok: true, value: { name, email, role: role as TeamRole, active: input.active === undefined ? true : Boolean(input.active), divisionId } };
}

// ---------------------------------------------------------------------------
// Divisions — the company's own units. NOT «القطاع»: a sector is the MARKET a product sells into
// (hospitals, pharmacies), a division is who inside Lean owns it. Both exist on a product and the
// screens keep the words apart deliberately; conflating them was the first thing to get wrong here.
// ---------------------------------------------------------------------------

export type DivisionInput = { name?: unknown; ownerMemberId?: unknown; active?: unknown };
export type DivisionAccepted = { ok: true; value: { name: string; ownerMemberId: number | null; active: boolean } };

export function checkDivision(
  input: DivisionInput,
  takenNames: readonly string[],
  owner?: { id: number; active: boolean } | null,
  existingName?: string,
): DivisionAccepted | Rejection {
  const name = String(input.name ?? "").replace(/\s+/g, " ").trim();
  if (!name) return { ok: false, code: "invalid_name", reason: "اسم القسم مطلوب.", field: "name" };
  if (name.length > 60) return { ok: false, code: "invalid_name", reason: "اسم القسم 60 حرفًا كحدٍّ أقصى.", field: "name" };
  if (name !== existingName && takenNames.indexOf(name) >= 0) {
    return { ok: false, code: "name_exists", reason: "يوجد قسم بهذا الاسم.", field: "name" };
  }
  let ownerMemberId: number | null = null;
  if (input.ownerMemberId !== null && input.ownerMemberId !== undefined && String(input.ownerMemberId) !== "") {
    const id = Number(input.ownerMemberId);
    if (!Number.isInteger(id) || id <= 0) {
      return { ok: false, code: "invalid_owner", reason: "مسؤول القسم غير معروف.", field: "ownerMemberId" };
    }
    if (!owner) return { ok: false, code: "unknown_member", reason: "لا أحد بهذا المعرّف في الفريق.", field: "ownerMemberId" };
    if (!owner.active) return { ok: false, code: "inactive_member", reason: "مسؤول القسم موقوف في سجل الفريق.", field: "ownerMemberId" };
    ownerMemberId = id;
  }
  return { ok: true, value: { name, ownerMemberId, active: input.active === undefined ? true : Boolean(input.active) } };
}

/** A division that still owns products or people is not deleted — it is paused, or emptied first.
 *  Deleting it would leave every product pointing at a division nothing defines. */
export function checkDivisionDelete(products: unknown, members: unknown): { ok: true } | Rejection {
  const p = Number(products) || 0, m = Number(members) || 0;
  if (p > 0 || m > 0) {
    return {
      ok: false, code: "division_in_use", field: "id",
      reason: "القسم مرتبط بمنتجات أو أعضاء — انقلهم أو أوقف القسم بدل حذفه.",
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Escalation and support requests.
// ---------------------------------------------------------------------------

export type EscalationKind = "escalation" | "support";
export const ESCALATION_KINDS: readonly EscalationKind[] = ["escalation", "support"];
export const ESCALATION_LABELS: Readonly<Record<string, string>> = {
  escalation: "تصعيد", support: "طلب دعم",
};
/** Who each kind may be sent to. Support goes to the people who do support; an escalation goes up,
 *  which in a company this size means a manager — or a named senior seller. */
export const ESCALATION_ROLES: Readonly<Record<string, readonly TeamRole[]>> = {
  escalation: ["manager", "sales"],
  support: ["support", "manager"],
};

/** Delivery is RECORDED, not sent: the founder's call (Sep 13) — no mail leaves the building until
 *  a sender is chosen. The state is stored so the day a provider is configured, the queue is the
 *  list of what to send, and the screen never claims an email went out. */
export type DeliveryState = "recorded" | "queued" | "sent" | "failed";
export const DELIVERY_LABELS: Readonly<Record<string, string>> = {
  recorded: "مسجّل — لم يُرسل بريد بعد",
  queued: "في انتظار الإرسال",
  sent: "أُرسل بالبريد",
  failed: "تعذّر الإرسال",
};

export type EscalationInput = { kind?: unknown; memberId?: unknown; reason?: unknown };
export type EscalationAccepted = { ok: true; value: { kind: EscalationKind; memberId: number; reason: string } };

export function checkEscalation(
  input: EscalationInput,
  member: { id: number; role: string; active: boolean } | null | undefined,
): EscalationAccepted | Rejection {
  const kind = String(input.kind ?? "");
  if ((ESCALATION_KINDS as readonly string[]).indexOf(kind) === -1) {
    return { ok: false, code: "invalid_kind", reason: "النوع: تصعيد أو طلب دعم.", field: "kind" };
  }
  const memberId = Number(input.memberId);
  if (!Number.isInteger(memberId) || memberId <= 0) {
    return { ok: false, code: "invalid_member", reason: "اختر الشخص المسؤول.", field: "memberId" };
  }
  if (!member) return { ok: false, code: "unknown_member", reason: "لا أحد بهذا المعرّف في الفريق.", field: "memberId" };
  if (!member.active) return { ok: false, code: "inactive_member", reason: "هذا الشخص موقوف في سجل الفريق.", field: "memberId" };
  const allowed = ESCALATION_ROLES[kind] || [];
  if ((allowed as readonly string[]).indexOf(member.role) === -1) {
    return {
      ok: false, code: "wrong_role", field: "memberId",
      reason: kind === "support" ? "طلب الدعم يذهب إلى الدعم الفني أو الإدارة." : "التصعيد يذهب إلى الإدارة أو مسؤول مبيعات.",
    };
  }
  const reason = String(input.reason ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  if (!reason) return { ok: false, code: "invalid_reason", reason: "اكتب سبب التصعيد — الشخص المستلم يقرؤه أولًا.", field: "reason" };
  return { ok: true, value: { kind: kind as EscalationKind, memberId, reason } };
}

// ---------------------------------------------------------------------------
// The seam that carries the rules above into the browser.
// ---------------------------------------------------------------------------

const DOMAIN_FNS = [
  isTerminalStageKey, stageKeyFrom, isValidStageKey, checkStage, checkStageDelete,
  isStageSelectable, stageSlaState, isEmailShaped, checkMember, checkDivision,
  checkDivisionDelete, checkEscalation,
] as const;

export const CONFIG_DOMAIN_JS: string = [
  "/* ===== config-domain (generated from src/config-domain.ts — do not edit here) ===== */",
  "var STAGE_LABEL_MAX = " + STAGE_LABEL_MAX + ";",
  "var STAGE_KEY_MAX = " + STAGE_KEY_MAX + ";",
  "var SLA_DAYS_MAX = " + SLA_DAYS_MAX + ";",
  "var TERMINAL_KEYS = " + JSON.stringify(TERMINAL_KEYS) + ";",
  "var TEAM_ROLES = " + JSON.stringify(TEAM_ROLES) + ";",
  "var TEAM_ROLE_LABELS = " + JSON.stringify(TEAM_ROLE_LABELS) + ";",
  "var ESCALATION_KINDS = " + JSON.stringify(ESCALATION_KINDS) + ";",
  "var ESCALATION_LABELS = " + JSON.stringify(ESCALATION_LABELS) + ";",
  "var ESCALATION_ROLES = " + JSON.stringify(ESCALATION_ROLES) + ";",
  "var DELIVERY_LABELS = " + JSON.stringify(DELIVERY_LABELS) + ";",
  ...DOMAIN_FNS.map((fn) => fn.toString()),
].join("\n");

/** The same closure check product-domain carries: a serialised function may reference only its own
 *  parameters and the constants injected above it, so a rule cannot work in Node and throw in the
 *  browser. Called by the unit test, not at boot. */
export function checkConfigDomainClosure(): string[] {
  const injected = [
    "STAGE_LABEL_MAX", "STAGE_KEY_MAX", "SLA_DAYS_MAX", "TERMINAL_KEYS", "TEAM_ROLES",
    "TEAM_ROLE_LABELS", "ESCALATION_KINDS", "ESCALATION_LABELS", "ESCALATION_ROLES", "DELIVERY_LABELS",
  ];
  const names = DOMAIN_FNS.map((f) => f.name);
  const problems: string[] = [];
  for (const fn of DOMAIN_FNS) {
    // Comments travel with toString(), and a capitalised word inside one ("must START with…")
    // reads as an undefined constant. Strip them before scanning identifiers.
    const src = fn.toString().replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
    const ids = src.match(/\b[A-Za-z_$][A-Za-z0-9_$]*\b/g) ?? [];
    for (const id of ids) {
      // SCREAMING_CASE only, and at least two characters with a letter in them: a bare «_» comes
      // from a regex in the source, not from a constant a page would have to define.
      if (/^[A-Z][A-Z0-9_]+$/.test(id) && injected.indexOf(id) === -1 && !/^(NaN|Infinity)$/.test(id)) {
        problems.push(fn.name + " references " + id + ", which is not injected into the page");
      }
      if (names.indexOf(id) >= 0) continue;
    }
  }
  return problems;
}
