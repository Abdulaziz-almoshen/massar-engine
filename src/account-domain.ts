// account-domain.ts — the rules of a customer ACCOUNT (client A, BRD v1.0 §9, slice S2).
//
// An account is an organisation Lean sells to: a name, a city, a sector, how much it matters, who owns
// it, and the people inside it. Until this slice an account was a WhatsApp number with a name on it, so
// «أضف عميلًا» could not record the IT manager and the procurement lead of the same hospital, and a
// customer who had never written to us had no record to open.
//
// PURE. No I/O, no clock, no DOM. The functions in DOMAIN_FNS are serialised into the page through
// Function.prototype.toString(), so the add-customer sheet and the server refuse the same input with the
// same sentence; those functions may reference only their parameters and the injected constants
// (checkAccountDomainClosure is asserted by the unit test).

import { calculateLineValue, isLostStage, isOpenStage, isWonStage } from "./opps-domain.js";
// The address rule is config-domain's isEmailShaped. checkAccount carries the same pattern inline because a
// serialised function cannot reach an import (the test runner rewrites it into a module reference the
// page does not have); tests/account-domain.test.ts asserts the two agree on every sample.
import { isEmailShaped } from "./config-domain.js";

// ---------------------------------------------------------------------------------------- vocabulary

/** BR-CUS-001 as the prototype drew it: a customer added by hand arrives «مقترح» and waits for the
 *  sales team to approve it before selling starts. Rejected accounts keep their history. */
export const ACCOUNT_APPROVALS = ["proposed", "approved", "rejected"] as const;
export type AccountApproval = (typeof ACCOUNT_APPROVALS)[number];
export const ACCOUNT_APPROVAL_LABELS: Readonly<Record<AccountApproval, string>> = {
  proposed: "مقترح", approved: "معتمد", rejected: "مرفوض",
};

export const ACCOUNT_IMPORTANCE = ["high", "medium", "low"] as const;
export type AccountImportance = (typeof ACCOUNT_IMPORTANCE)[number];
export const ACCOUNT_IMPORTANCE_LABELS: Readonly<Record<AccountImportance, string>> = {
  high: "عالية", medium: "متوسطة", low: "منخفضة",
};

/** BR-CUS-005. NULL in the table means the row predates this column: «غير مسجّل», never a guess. */
export const ACCOUNT_SOURCES = ["manual", "import", "whatsapp", "indicator", "partner", "other"] as const;
export type AccountSource = (typeof ACCOUNT_SOURCES)[number];
export const ACCOUNT_SOURCE_LABELS: Readonly<Record<AccountSource, string>> = {
  manual: "إضافة يدوية", import: "استيراد ملف", whatsapp: "محادثة واتساب",
  indicator: "من مؤشر استخدام", partner: "شريك مبيعات", other: "أخرى",
};

/** What an account's relationship with one product is, read from its opportunity lines. */
export const PRODUCT_STATUS_LABELS: Readonly<Record<string, string>> = {
  won: "تم البيع", open: "فرصة قائمة", lost: "خسارة", targeted: "مستهدف",
};

export const ACCOUNT_NAME_MAX = 120;
export const ACCOUNT_CITY_MAX = 60;
export const ACCOUNT_SECTOR_MAX = 80;
export const CONTACT_NAME_MAX = 80;
export const CONTACT_ROLE_MAX = 80;
export const CONTACT_EMAIL_MAX = 120;
export const CONTACTS_MAX = 20;

// ---------------------------------------------------------------------------------------- types

export type ContactInput = { name?: unknown; role?: unknown; phone?: unknown; email?: unknown; primary?: unknown };
export type AccountInput = {
  name?: unknown; city?: unknown; sector?: unknown; importance?: unknown; ownerId?: unknown; phone?: unknown;
  contacts?: unknown;
};
export type ContactValue = { name: string; role: string | null; phone: string | null; email: string | null; primary: boolean };
export type AccountValue = {
  name: string; city: string; sector: string | null; importance: AccountImportance | null; ownerId: number | null;
  phone: string; contacts: ContactValue[];
};
export type AccountCheck = { ok: true; value: AccountValue } | { ok: false; field: string; reason: string };

// ---------------------------------------------------------------------------------------- the rules

/** Digits only, with Arabic-Indic digits read as digits. Used to decide whether a phone is plausible;
 *  the server's canonical form (966…) comes from audience.normalizePhone before storage. */
export function phoneDigits(raw: unknown): string {
  var s = String(raw == null ? "" : raw);
  var out = "";
  for (var i = 0; i < s.length; i++) {
    var c = s.charAt(i);
    var ar = "٠١٢٣٤٥٦٧٨٩".indexOf(c);
    if (ar >= 0) out += String(ar);
    else if (c >= "0" && c <= "9") out += c;
  }
  return out;
}

/**
 * BR-CUS-001 + BR-CUS-002: an account needs a name, a city and at least one named contact; each contact
 * row that carries anything needs a name; one contact is primary. The account's WhatsApp number is its
 * identity everywhere else in Massar (conversations, campaigns, opportunities all key by it), so it is
 * required on create and fixed afterwards — `isEdit` skips it.
 *
 * `memberIds` are the ACTIVE team members an owner may be chosen from.
 */
export function checkAccount(input: AccountInput, memberIds: readonly number[], isEdit: boolean): AccountCheck {
  var src = input || {};
  var text = function (v: unknown) { return String(v == null ? "" : v).trim(); };
  var name = text(src.name);
  if (!name) return { ok: false, field: "name", reason: "اسم العميل مطلوب" };
  if (name.length > ACCOUNT_NAME_MAX) return { ok: false, field: "name", reason: "اسم العميل أطول من " + ACCOUNT_NAME_MAX + " حرفًا" };
  var city = text(src.city);
  if (!city) return { ok: false, field: "city", reason: "المدينة مطلوبة" };
  if (city.length > ACCOUNT_CITY_MAX) return { ok: false, field: "city", reason: "اسم المدينة أطول من " + ACCOUNT_CITY_MAX + " حرفًا" };
  var sector = text(src.sector);
  if (sector.length > ACCOUNT_SECTOR_MAX) return { ok: false, field: "sector", reason: "القطاع أطول من " + ACCOUNT_SECTOR_MAX + " حرفًا" };
  var importance = text(src.importance);
  if (importance && ACCOUNT_IMPORTANCE.indexOf(importance as AccountImportance) < 0) return { ok: false, field: "importance", reason: "درجة الأهمية غير معروفة" };
  var ownerRaw = src.ownerId;
  var ownerId: number | null = null;
  if (ownerRaw != null && String(ownerRaw) !== "") {
    ownerId = Number(ownerRaw);
    if (!(ownerId > 0) || memberIds.indexOf(ownerId) < 0) return { ok: false, field: "ownerId", reason: "الموظف المسؤول غير موجود في الفريق أو غير نشط" };
  }
  var phone = phoneDigits(src.phone);
  if (!isEdit) {
    if (!phone) return { ok: false, field: "phone", reason: "رقم واتساب العميل مطلوب — به ترتبط المحادثات والحملات والفرص" };
    if (phone.length < 8 || phone.length > 15) return { ok: false, field: "phone", reason: "رقم واتساب غير صالح" };
  }
  var rows = Array.isArray(src.contacts) ? (src.contacts as ContactInput[]) : [];
  var contacts: ContactValue[] = [];
  var seenPhones: Record<string, number> = {};
  var primaryAt = -1;
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i] || {};
    var cn = text(r.name), cr = text(r.role), cp = text(r.phone), ce = text(r.email);
    if (!cn && !cr && !cp && !ce) continue;
    var at = contacts.length;
    if (!cn) return { ok: false, field: "contacts." + i + ".name", reason: "اسم جهة الاتصال مطلوب" };
    if (cn.length > CONTACT_NAME_MAX) return { ok: false, field: "contacts." + i + ".name", reason: "اسم جهة الاتصال أطول من " + CONTACT_NAME_MAX + " حرفًا" };
    if (cr.length > CONTACT_ROLE_MAX) return { ok: false, field: "contacts." + i + ".role", reason: "المنصب أطول من " + CONTACT_ROLE_MAX + " حرفًا" };
    var cd = phoneDigits(cp);
    if (cp && (cd.length < 8 || cd.length > 15)) return { ok: false, field: "contacts." + i + ".phone", reason: "رقم هاتف جهة الاتصال غير صالح" };
    if (cd && seenPhones[cd] != null) return { ok: false, field: "contacts." + i + ".phone", reason: "هذا الرقم مكرر لجهتي اتصال" };
    if (cd) seenPhones[cd] = at;
    if (ce && (ce.length > CONTACT_EMAIL_MAX || !/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(ce))) return { ok: false, field: "contacts." + i + ".email", reason: "البريد الإلكتروني غير صالح" };
    var isPrimary = r.primary === true || r.primary === "true";
    if (isPrimary && primaryAt < 0) primaryAt = at;
    contacts.push({ name: cn, role: cr || null, phone: cd || null, email: ce || null, primary: false });
  }
  if (!contacts.length) return { ok: false, field: "contacts", reason: "أضف جهة اتصال واحدة على الأقل باسمها" };
  if (contacts.length > CONTACTS_MAX) return { ok: false, field: "contacts", reason: "الحد " + CONTACTS_MAX + " جهة اتصال للعميل" };
  contacts[primaryAt < 0 ? 0 : primaryAt].primary = true;
  return {
    ok: true,
    value: { name: name, city: city, sector: sector || null, importance: (importance || null) as AccountImportance | null, ownerId: ownerId, phone: phone, contacts: contacts },
  };
}

/** The approval moves an account may make. Any state may move to any other — a rejection is reversible —
 *  but a no-op is refused so the audit log never records a decision nobody made. */
export function checkApproval(current: string, next: unknown): { ok: true; value: AccountApproval } | { ok: false; reason: string } {
  var n = String(next == null ? "" : next);
  if (ACCOUNT_APPROVALS.indexOf(n as AccountApproval) < 0) return { ok: false, reason: "قرار غير معروف" };
  if (n === current) return { ok: false, reason: "العميل " + ACCOUNT_APPROVAL_LABELS[n as AccountApproval] + " بالفعل" };
  return { ok: true, value: n as AccountApproval };
}

export type AccountFilterRow = {
  id: number; name: string; phone: string; city: string | null; sector: string | null; importance: string | null;
  ownerId: number | null; approval: string; products: readonly string[]; contactText: string;
};
export type AccountFilter = {
  q?: string; tab?: string; product?: string; sector?: string; city?: string; owner?: string; importance?: string;
  /** entity ids in the chosen indicator, or null for no indicator filter */
  inIndicator?: Record<string, number> | null;
};

/** BR-CUS-003: search and filter by product, sector, city, owner, status and indicator. «الكل» leaves
 *  out rejected accounts, as the prototype's total does; «مرفوضون» is where they are found. */
export function accountMatches(a: AccountFilterRow, f: AccountFilter): boolean {
  var tab = f.tab || "all";
  if (tab === "all" ? a.approval === "rejected" : a.approval !== tab) return false;
  if (f.product && (a.products || []).indexOf(f.product) < 0) return false;
  if (f.sector && (a.sector || "") !== f.sector) return false;
  if (f.city && (a.city || "") !== f.city) return false;
  if (f.importance && (a.importance || "") !== f.importance) return false;
  if (f.owner) {
    if (f.owner === "none") { if (a.ownerId != null) return false; }
    else if (String(a.ownerId) !== f.owner) return false;
  }
  if (f.inIndicator && !f.inIndicator[String(a.id)]) return false;
  var q = String(f.q || "").trim();
  if (q) {
    var hay = [a.name, a.phone, a.city || "", a.sector || "", a.contactText || ""].join(" ");
    var digits = phoneDigits(q);
    if (hay.indexOf(q) < 0 && !(digits.length >= 3 && String(a.phone).indexOf(digits) >= 0)) return false;
  }
  return true;
}

/** «مستهدف · فرصة قائمة · تم البيع» for one product, from that account's lines of it. A won line wins
 *  over an open one; an account whose every line for the product was lost reads «خسارة». */
export function productStatusOf(product: string, lines: readonly { product: string; stage: string }[]): string {
  var won = false, open = false, lost = false;
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].product !== product) continue;
    var st = lines[i].stage;
    if (st === "won") won = true;
    else if (st === "lost") lost = true;
    else open = true;
  }
  return won ? "won" : open ? "open" : lost ? "lost" : "targeted";
}

// ---------------------------------------------------------------------------------------- server-only

export type OppLineLite = { product: string; stage: string; salePrice: number; years: number; quantity: number; discountPercent: number };

/** The list's «عدد الفرص · قيمة الفرص»: lines not lost, and their value by the ONE value rule in
 *  opps-domain — the same figure the opportunities board prints for the same account. */
export function summarizeAccountOpps(lines: readonly OppLineLite[]): { count: number; open: number; won: number; value: number } {
  let count = 0, open = 0, won = 0, value = 0;
  for (const l of lines) {
    if (isLostStage(l.stage)) continue;
    count++;
    if (isOpenStage(l.stage)) open++;
    if (isWonStage(l.stage)) won++;
    value += calculateLineValue({ stage: l.stage, salePrice: l.salePrice, years: l.years, quantity: l.quantity, discountPercent: l.discountPercent, stageEnteredAt: 0 });
  }
  return { count, open, won, value };
}

const IMPORTANCE_WORDS: Readonly<Record<string, AccountImportance>> = {
  "عالية": "high", "عالي": "high", "مرتفعة": "high", "high": "high",
  "متوسطة": "medium", "متوسط": "medium", "medium": "medium",
  "منخفضة": "low", "منخفض": "low", "low": "low",
};

/** A customer sheet's columns (the prototype's template: اسم المنشأة · المدينة · القطاع · الأهمية ·
 *  جهة الاتصال · المنصب · الهاتف · البريد) become account fields and a first contact. Headers are the
 *  sheet's own words; an unknown importance word is dropped rather than guessed. */
export function accountFieldsFromAttrs(attrs: Readonly<Record<string, string>>): {
  sector: string | null; importance: AccountImportance | null; contact: ContactValue | null;
} {
  const pick = (...keys: string[]): string => {
    for (const k of keys) {
      const v = attrs[k];
      if (v != null && String(v).trim()) return String(v).trim();
    }
    return "";
  };
  const sector = pick("القطاع", "الشريحة", "القطاع/الشريحة", "sector").slice(0, ACCOUNT_SECTOR_MAX);
  const impWord = pick("الأهمية", "درجة الأهمية", "importance").toLowerCase();
  const cName = pick("جهة الاتصال", "اسم جهة الاتصال", "contact").slice(0, CONTACT_NAME_MAX);
  const cRole = pick("المنصب", "الدور", "role", "title").slice(0, CONTACT_ROLE_MAX);
  const cEmail = pick("البريد", "البريد الإلكتروني", "email");
  return {
    sector: sector || null,
    importance: IMPORTANCE_WORDS[impWord] ?? null,
    contact: cName ? { name: cName, role: cRole || null, phone: null, email: isEmailShaped(cEmail) ? cEmail : null, primary: true } : null,
  };
}

// ---------------------------------------------------------------------------------------- the seam

const DOMAIN_FNS = [phoneDigits, checkAccount, checkApproval, accountMatches, productStatusOf] as const;

const INJECTED = [
  "ACCOUNT_APPROVALS", "ACCOUNT_APPROVAL_LABELS", "ACCOUNT_IMPORTANCE", "ACCOUNT_IMPORTANCE_LABELS",
  "ACCOUNT_SOURCES", "ACCOUNT_SOURCE_LABELS", "PRODUCT_STATUS_LABELS",
  "ACCOUNT_NAME_MAX", "ACCOUNT_CITY_MAX", "ACCOUNT_SECTOR_MAX", "CONTACT_NAME_MAX", "CONTACT_ROLE_MAX", "CONTACT_EMAIL_MAX", "CONTACTS_MAX",
] as const;

export const ACCOUNT_DOMAIN_JS: string = [
  "/* ===== account-domain (generated from src/account-domain.ts — do not edit here) ===== */",
  "var ACCOUNT_APPROVALS = " + JSON.stringify(ACCOUNT_APPROVALS) + ";",
  "var ACCOUNT_APPROVAL_LABELS = " + JSON.stringify(ACCOUNT_APPROVAL_LABELS) + ";",
  "var ACCOUNT_IMPORTANCE = " + JSON.stringify(ACCOUNT_IMPORTANCE) + ";",
  "var ACCOUNT_IMPORTANCE_LABELS = " + JSON.stringify(ACCOUNT_IMPORTANCE_LABELS) + ";",
  "var ACCOUNT_SOURCES = " + JSON.stringify(ACCOUNT_SOURCES) + ";",
  "var ACCOUNT_SOURCE_LABELS = " + JSON.stringify(ACCOUNT_SOURCE_LABELS) + ";",
  "var PRODUCT_STATUS_LABELS = " + JSON.stringify(PRODUCT_STATUS_LABELS) + ";",
  "var ACCOUNT_NAME_MAX = " + ACCOUNT_NAME_MAX + ";",
  "var ACCOUNT_CITY_MAX = " + ACCOUNT_CITY_MAX + ";",
  "var ACCOUNT_SECTOR_MAX = " + ACCOUNT_SECTOR_MAX + ";",
  "var CONTACT_NAME_MAX = " + CONTACT_NAME_MAX + ";",
  "var CONTACT_ROLE_MAX = " + CONTACT_ROLE_MAX + ";",
  "var CONTACT_EMAIL_MAX = " + CONTACT_EMAIL_MAX + ";",
  "var CONTACTS_MAX = " + CONTACTS_MAX + ";",
  ...DOMAIN_FNS.map((fn) => fn.toString()),
].join("\n");

/** A serialised function may reference only its parameters, the other shipped functions and the
 *  injected constants — otherwise it works in Node and throws in the page. */
export function checkAccountDomainClosure(): string[] {
  const problems: string[] = [];
  const shipped = DOMAIN_FNS.map((fn) => fn.name);
  for (const fn of DOMAIN_FNS) {
    const src = fn.toString().replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ").replace(/"[^"\n]*"/g, '""');
    for (const id of src.match(/\b[A-Za-z_$][A-Za-z0-9_$]*\b/g) ?? []) {
      if (/^[A-Z][A-Z0-9_]+$/.test(id) && (INJECTED as readonly string[]).indexOf(id) === -1) problems.push(fn.name + " references " + id);
      if (/^(calculateLineValue|isLostStage|isOpenStage|isWonStage|summarizeAccountOpps|accountFieldsFromAttrs)$/.test(id) && shipped.indexOf(id) === -1) problems.push(fn.name + " references " + id);
    }
  }
  return problems;
}
