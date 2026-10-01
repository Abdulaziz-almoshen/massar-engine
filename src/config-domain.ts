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

// The roles code reads by KEY (escalation routes to support/manager; the product record offers
// product managers). An admin may rename them and add more in «الأدوار», but these four are seeded
// on every boot and cannot be deleted. The list is the fallback the page uses before org_roles loads.
export type TeamRole = string;
export const TEAM_ROLES: readonly string[] = ["sales", "support", "manager", "product_manager"];
export const TEAM_ROLE_LABELS: Readonly<Record<string, string>> = {
  sales: "مبيعات", support: "دعم فني", manager: "إدارة", product_manager: "مدير منتج",
};

export type MemberInput = { name?: unknown; email?: unknown; role?: unknown; active?: unknown; divisionId?: unknown };
export type MemberAccepted = { ok: true; value: { name: string; email: string; role: TeamRole; active: boolean; divisionId: number | null } };

/** Deliberately not the RFC 5322 grammar: this is a company directory, and a pattern an operator
 *  can predict beats a pattern that accepts «a"b"@c». One dot-separated domain, no spaces. */
export function isEmailShaped(email: unknown): boolean {
  const s = String(email ?? "").trim();
  return s.length <= 120 && /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(s);
}

/** roleKeys is the LIVE role list (org_roles); without it the seeded four are the whole vocabulary. */
export function checkMember(input: MemberInput, roleKeys?: readonly string[]): MemberAccepted | Rejection {
  const name = String(input.name ?? "").replace(/\s+/g, " ").trim();
  if (!name) return { ok: false, code: "invalid_name", reason: "الاسم مطلوب.", field: "name" };
  if (name.length > 60) return { ok: false, code: "invalid_name", reason: "الاسم 60 حرفًا كحدٍّ أقصى.", field: "name" };
  const email = String(input.email ?? "").trim().toLowerCase();
  if (!email) return { ok: false, code: "invalid_email", reason: "البريد مطلوب — التصعيد يُرسل إليه.", field: "email" };
  if (!isEmailShaped(email)) return { ok: false, code: "invalid_email", reason: "صيغة البريد غير صحيحة.", field: "email" };
  const role = String(input.role ?? "");
  if ((roleKeys && roleKeys.length ? roleKeys : TEAM_ROLES).indexOf(role) === -1) {
    return { ok: false, code: "invalid_role", reason: "الدور غير معروف — اختر دورًا من «الأدوار».", field: "role" };
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

export type DivisionInput = { name?: unknown; ownerMemberId?: unknown; active?: unknown; sectorId?: unknown };
export type DivisionAccepted = { ok: true; value: { name: string; ownerMemberId: number | null; active: boolean; sectorId: number | null } };

/** sector: the org sector the department sits under, as the caller found it. undefined = not looked
 *  up (the id is only shape-checked); null = looked up and absent. */
export function checkDivision(
  input: DivisionInput,
  takenNames: readonly string[],
  owner?: { id: number; active: boolean } | null,
  existingName?: string,
  sector?: { id: number; active: boolean } | null,
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
  let sectorId: number | null = null;
  if (input.sectorId !== null && input.sectorId !== undefined && String(input.sectorId) !== "") {
    const sid = Number(input.sectorId);
    if (!Number.isInteger(sid) || sid <= 0) return { ok: false, code: "invalid_sector", reason: "القطاع غير معروف.", field: "sectorId" };
    if (sector === null) return { ok: false, code: "unknown_sector", reason: "لا قطاع بهذا المعرّف.", field: "sectorId" };
    sectorId = sid;
  }
  return { ok: true, value: { name, ownerMemberId, active: input.active === undefined ? true : Boolean(input.active), sectorId } };
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
// «إعدادات المنظمة» (founder, 2026-10-01): segments, sectors, departments, employees, roles.
//
// TWO WORDS, TWO THINGS. A SEGMENT («الشريحة») is the MARKET a product sells into — hospitals,
// pharmacies, business. It is the old `sectors` table: the three seeded rows were always exactly
// these three markets, so the segment list IS that table with a type, and every product keeps the
// link it already had. A SECTOR («القطاع») is now the company's own top-level unit — business, sales
// or support — with a manager, and departments sit under it:
//   Sector → Sector manager → Department → Department manager → Members.
// ---------------------------------------------------------------------------

export const NAME_MAX = 60;
export const SEGMENT_KINDS: readonly string[] = ["hospitals", "pharmacies", "business"];
export const SEGMENT_KIND_LABELS: Readonly<Record<string, string>> = {
  hospitals: "مستشفيات", pharmacies: "صيدليات", business: "قطاع الأعمال",
};
export const ORG_SECTOR_KINDS: readonly string[] = ["business", "sales", "support"];
export const ORG_SECTOR_KIND_LABELS: Readonly<Record<string, string>> = {
  business: "أعمال", sales: "مبيعات", support: "دعم",
};
/** The roles code depends on by key. Renamable, never deletable. */
export const SYSTEM_ROLE_KEYS: readonly string[] = ["sales", "support", "manager", "product_manager"];

export type SegmentInput = { name?: unknown; kind?: unknown; active?: unknown };
export type SegmentAccepted = { ok: true; value: { name: string; kind: string; active: boolean } };

/** One name rule for every row on the screen: collapsed whitespace, required, NAME_MAX long, unique. */
export function checkOrgName(raw: unknown, takenNames: readonly string[], existingName: string | undefined, what: string): { ok: true; name: string } | Rejection {
  const name = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!name) return { ok: false, code: "invalid_name", reason: "اسم " + what + " مطلوب.", field: "name" };
  if (name.length > NAME_MAX) return { ok: false, code: "invalid_name", reason: "اسم " + what + " " + NAME_MAX + " حرفًا كحدٍّ أقصى.", field: "name" };
  if (name !== existingName && takenNames.indexOf(name) >= 0) return { ok: false, code: "name_exists", reason: "يوجد " + what + " بهذا الاسم.", field: "name" };
  return { ok: true, name };
}

export function checkSegment(input: SegmentInput, takenNames: readonly string[], existingName?: string): SegmentAccepted | Rejection {
  const n = checkOrgName(input.name, takenNames, existingName, "الشريحة");
  if (!n.ok) return n;
  const kind = String(input.kind ?? "");
  if (SEGMENT_KINDS.indexOf(kind) === -1) {
    return { ok: false, code: "invalid_kind", reason: "النوع: مستشفيات أو صيدليات أو قطاع الأعمال.", field: "kind" };
  }
  return { ok: true, value: { name: n.name, kind, active: input.active === undefined ? true : Boolean(input.active) } };
}

/** A segment products still point at is paused, not deleted: the product would lose its market. */
export function checkSegmentDelete(products: unknown): { ok: true } | Rejection {
  if ((Number(products) || 0) > 0) {
    return { ok: false, code: "segment_in_use", field: "id", reason: "الشريحة مرتبطة بمنتجات — انقلها إلى شريحة أخرى أو أوقف الشريحة بدل حذفها." };
  }
  return { ok: true };
}

export type OrgSectorInput = { name?: unknown; kind?: unknown; managerMemberId?: unknown; active?: unknown };
export type OrgSectorAccepted = { ok: true; value: { name: string; kind: string; managerMemberId: number | null; active: boolean } };

export function checkOrgSector(
  input: OrgSectorInput,
  takenNames: readonly string[],
  manager?: { id: number; active: boolean } | null,
  existingName?: string,
): OrgSectorAccepted | Rejection {
  const n = checkOrgName(input.name, takenNames, existingName, "القطاع");
  if (!n.ok) return n;
  const kind = String(input.kind ?? "");
  if (ORG_SECTOR_KINDS.indexOf(kind) === -1) {
    return { ok: false, code: "invalid_kind", reason: "التصنيف: أعمال أو مبيعات أو دعم.", field: "kind" };
  }
  let managerMemberId: number | null = null;
  if (input.managerMemberId !== null && input.managerMemberId !== undefined && String(input.managerMemberId) !== "") {
    const id = Number(input.managerMemberId);
    if (!Number.isInteger(id) || id <= 0) return { ok: false, code: "invalid_manager", reason: "مدير القطاع غير معروف.", field: "managerMemberId" };
    if (manager === null) return { ok: false, code: "unknown_member", reason: "لا أحد بهذا المعرّف في الموظفين.", field: "managerMemberId" };
    if (manager && !manager.active) return { ok: false, code: "inactive_member", reason: "مدير القطاع موقوف في سجل الموظفين.", field: "managerMemberId" };
    managerMemberId = id;
  }
  return { ok: true, value: { name: n.name, kind, managerMemberId, active: input.active === undefined ? true : Boolean(input.active) } };
}

/** A sector with departments under it is emptied or paused first — deleting it would orphan them silently. */
export function checkOrgSectorDelete(departments: unknown): { ok: true } | Rejection {
  if ((Number(departments) || 0) > 0) {
    return { ok: false, code: "sector_in_use", field: "id", reason: "تحت القطاع إدارات — انقلها إلى قطاع آخر أو أوقف القطاع بدل حذفه." };
  }
  return { ok: true };
}

export type RoleInput = { label?: unknown; active?: unknown };
export type RoleAccepted = { ok: true; value: { label: string; active: boolean } };

export function checkRole(input: RoleInput, takenLabels: readonly string[], existingLabel?: string, isSystem?: boolean): RoleAccepted | Rejection {
  const label = String(input.label ?? "").replace(/\s+/g, " ").trim();
  if (!label) return { ok: false, code: "invalid_label", reason: "اسم الدور مطلوب.", field: "label" };
  if (label.length > 40) return { ok: false, code: "invalid_label", reason: "اسم الدور 40 حرفًا كحدٍّ أقصى.", field: "label" };
  if (label !== existingLabel && takenLabels.indexOf(label) >= 0) return { ok: false, code: "label_exists", reason: "يوجد دور بهذا الاسم.", field: "label" };
  const active = input.active === undefined ? true : Boolean(input.active);
  if (isSystem && !active) return { ok: false, code: "system_role", reason: "دور أساسي في النظام — يُعاد تسميته ولا يُوقف.", field: "active" };
  return { ok: true, value: { label, active } };
}

/** A custom role's key: ascii, stable, never typed by the admin. Arabic labels give «role», «role_2»… */
export function roleKeyFrom(label: unknown, taken: readonly string[]): string {
  const ascii = String(label ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const base = (/^[a-z]/.test(ascii) ? ascii : (ascii ? "role_" + ascii : "role")).slice(0, 24);
  if (taken.indexOf(base) === -1) return base;
  for (let i = 2; i < 500; i++) {
    const candidate = (base + "_" + i).slice(0, 30);
    if (taken.indexOf(candidate) === -1) return candidate;
  }
  return base + "_" + Date.now();
}

export function checkRoleDelete(key: unknown, members: unknown): { ok: true } | Rejection {
  if (SYSTEM_ROLE_KEYS.indexOf(String(key ?? "")) >= 0) {
    return { ok: false, code: "system_role", field: "key", reason: "دور أساسي في النظام — يُعاد تسميته ولا يُحذف." };
  }
  if ((Number(members) || 0) > 0) {
    return { ok: false, code: "role_in_use", field: "key", reason: "موظفون يحملون هذا الدور — غيّر أدوارهم أو أوقف الدور بدل حذفه." };
  }
  return { ok: true };
}

/** THE HIERARCHY, derived — never stored a second time. Sector → manager → departments → manager →
 *  members, plus the two places a row can fall out of it: a department under no sector, and a person
 *  in no department. Both are SHOWN, because a hierarchy that silently drops rows reads as complete. */
export function buildOrgTree(
  sectors: readonly { id: number; name: string; kind: string; managerMemberId: number | null; active: boolean }[],
  departments: readonly { id: number; name: string; sectorId: number | null; ownerMemberId: number | null; active: boolean }[],
  members: readonly { id: number; name: string; role: string; divisionId: number | null; active: boolean }[],
) {
  const byId: Record<string, { id: number; name: string; role: string; divisionId: number | null; active: boolean }> = {};
  members.forEach(function (m) { byId[String(m.id)] = m; });
  const sectorIds: Record<string, boolean> = {};
  sectors.forEach(function (s) { sectorIds[String(s.id)] = true; });
  const deptIds: Record<string, boolean> = {};
  departments.forEach(function (d) { deptIds[String(d.id)] = true; });
  const dept = function (d: { id: number; name: string; sectorId: number | null; ownerMemberId: number | null; active: boolean }) {
    const manager = d.ownerMemberId == null ? null : (byId[String(d.ownerMemberId)] || null);
    return {
      id: d.id, name: d.name, active: d.active, manager: manager,
      // The manager is drawn in the department's header, so the member list does not repeat them.
      members: members.filter(function (m) { return m.divisionId === d.id && (!manager || m.id !== manager.id); }),
    };
  };
  return {
    sectors: sectors.map(function (s) {
      return {
        id: s.id, name: s.name, kind: s.kind, active: s.active,
        manager: s.managerMemberId == null ? null : (byId[String(s.managerMemberId)] || null),
        departments: departments.filter(function (d) { return d.sectorId === s.id; }).map(dept),
      };
    }),
    unsectored: departments.filter(function (d) { return d.sectorId == null || !sectorIds[String(d.sectorId)]; }).map(dept),
    unplaced: members.filter(function (m) { return m.divisionId == null || !deptIds[String(m.divisionId)]; }),
  };
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
  checkDivisionDelete, checkEscalation, checkOrgName, checkSegment, checkSegmentDelete,
  checkOrgSector, checkOrgSectorDelete, checkRole, roleKeyFrom, checkRoleDelete, buildOrgTree,
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
  "var NAME_MAX = " + NAME_MAX + ";",
  "var SEGMENT_KINDS = " + JSON.stringify(SEGMENT_KINDS) + ";",
  "var SEGMENT_KIND_LABELS = " + JSON.stringify(SEGMENT_KIND_LABELS) + ";",
  "var ORG_SECTOR_KINDS = " + JSON.stringify(ORG_SECTOR_KINDS) + ";",
  "var ORG_SECTOR_KIND_LABELS = " + JSON.stringify(ORG_SECTOR_KIND_LABELS) + ";",
  "var SYSTEM_ROLE_KEYS = " + JSON.stringify(SYSTEM_ROLE_KEYS) + ";",
  ...DOMAIN_FNS.map((fn) => fn.toString()),
].join("\n");

/** The same closure check product-domain carries: a serialised function may reference only its own
 *  parameters and the constants injected above it, so a rule cannot work in Node and throw in the
 *  browser. Called by the unit test, not at boot. */
export function checkConfigDomainClosure(): string[] {
  const injected = [
    "STAGE_LABEL_MAX", "STAGE_KEY_MAX", "SLA_DAYS_MAX", "TERMINAL_KEYS", "TEAM_ROLES",
    "TEAM_ROLE_LABELS", "ESCALATION_KINDS", "ESCALATION_LABELS", "ESCALATION_ROLES", "DELIVERY_LABELS",
    "NAME_MAX", "SEGMENT_KINDS", "SEGMENT_KIND_LABELS", "ORG_SECTOR_KINDS", "ORG_SECTOR_KIND_LABELS", "SYSTEM_ROLE_KEYS",
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
