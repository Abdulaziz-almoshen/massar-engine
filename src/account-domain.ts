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

/**
 * HOW BIG THE CLIENT IS — the official Saudi classification, not one invented here.
 *
 * Monsha'at (the Small and Medium Enterprises General Authority) publishes the Kingdom's own
 * enterprise-size definition at monshaat.gov.sa/ar/SMEs-definition, read 2026-09-20:
 *
 *   متناهية الصغر   1–5 employees      revenue 0–3 million SAR
 *   صغيرة          6–49 employees     revenue over 3m, up to 40m
 *   متوسطة         50–249 employees   revenue over 40m, up to 200m
 *   كبيرة          250+ employees     revenue over 200m
 *
 * The page states the rule too: an enterprise is classified on BOTH criteria together, and where
 * they disagree «يؤخذ بالتصنيف الأعلى بين المعيارين» — the higher of the two wins.
 *
 * WHY THIS AND NOT «Enterprise / Mid-Market / SMB». The English sales convention has no
 * authority behind it: Wikipedia's own middle-market article says different authorities use
 * revenue, assets or headcount «with the result that definitions differ». Massar's customers are
 * Saudi organisations who can pull a government «شهادة حجم المنشأة» stating their tier, and who
 * write that tier on tenders. A client can confirm or correct this field from a certificate; they
 * could never confirm «mid-market».
 *
 * GENDER. Monsha'at's own tabs read «متناهية الصغر · صغيرة · متوسط · كبير» — the last two break
 * agreement with «منشأة». The labels below agree throughout, which is what the rest of Massar does.
 *
 * NOT «درجة الأهمية». Size is a fact ABOUT the client; importance is OUR judgement of them. A
 * micro clinic can be a high-importance account and a large hospital a low one. They are stored,
 * filtered and displayed apart, and the record says which is which.
 */
export const ACCOUNT_SIZES = ["micro", "small", "medium", "large"] as const;
export type AccountSize = (typeof ACCOUNT_SIZES)[number];
export const ACCOUNT_SIZE_LABELS: Readonly<Record<AccountSize, string>> = {
  micro: "متناهية الصغر", small: "صغيرة", medium: "متوسطة", large: "كبيرة",
};
/** The basis, printed beside the choice so nobody has to remember where the line falls. */
export const ACCOUNT_SIZE_BASIS: Readonly<Record<AccountSize, string>> = {
  micro: "1–5 موظفين · حتى 3 مليون ريال",
  small: "6–49 موظفًا · أكثر من 3 وحتى 40 مليون",
  medium: "50–249 موظفًا · أكثر من 40 وحتى 200 مليون",
  large: "250 موظفًا فأكثر · أكثر من 200 مليون",
};

/**
 * Read a size out of whatever a spreadsheet column held. Accounts imported before this field
 * existed carry «الحجم» as free text, already spelled three ways in production («كبيرة»,
 * «صغيرة», «صغير»). Only an UNAMBIGUOUS match becomes a typed value; anything else stays null,
 * because a guessed classification is worse than an absent one — it is indistinguishable from a
 * recorded fact once stored.
 */
export function normalizeAccountSize(raw: unknown): AccountSize | null {
  if (raw === null || raw === undefined) return null;
  const t = String(raw).trim().replace(/\s+/g, " ");
  if (!t) return null;
  if ((ACCOUNT_SIZES as readonly string[]).indexOf(t) >= 0) return t as AccountSize;
  // Arabic forms, both genders, with and without «منشأة».
  if (/^(متناهية|متناهي) الصغر$/.test(t) || /micro/i.test(t)) return "micro";
  if (/^(صغيرة|صغير)$/.test(t) || /^small$/i.test(t)) return "small";
  if (/^(متوسطة|متوسط)$/.test(t) || /^medium$/i.test(t)) return "medium";
  if (/^(كبيرة|كبير)$/.test(t) || /^large$/i.test(t)) return "large";
  return null;
}

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

export type ContactInput = { id?: unknown; name?: unknown; role?: unknown; phone?: unknown; email?: unknown; primary?: unknown };
export type AccountInput = {
  name?: unknown; city?: unknown; sector?: unknown; importance?: unknown; sizeTier?: unknown;
  ownerId?: unknown; phone?: unknown; contacts?: unknown;
};
export type ContactValue = { id?: number | null; name: string; role: string | null; phone: string | null; email: string | null; primary: boolean };
export type AccountValue = {
  name: string; city: string | null; sector: string | null; importance: AccountImportance | null;
  sizeTier: AccountSize | null; ownerId: number | null;
  phone: string; contacts: ContactValue[];
};
export type AccountCheck = { ok: true; value: AccountValue } | { ok: false; field: string; reason: string };

// ---------------------------------------------------------------------------------------- the rules

/** Digits only, with Arabic-Indic (٠-٩) and Persian (۰-۹) digits read as digits. Used to decide whether
 *  a phone is plausible; the stored canonical form (966…) comes from audience.normalizePhone. */
export function phoneDigits(raw: unknown): string {
  var s = typeof raw === "string" || typeof raw === "number" ? String(raw) : "";
  var out = "";
  for (var i = 0; i < s.length; i++) {
    var c = s.charAt(i);
    var ar = "٠١٢٣٤٥٦٧٨٩".indexOf(c);
    var fa = "۰۱۲۳۴۵۶۷۸۹".indexOf(c);
    if (ar >= 0) out += String(ar);
    else if (fa >= 0) out += String(fa);
    else if (c >= "0" && c <= "9") out += c;
  }
  return out;
}

/** Why a phone cannot be a real number, or "" when it can. A Saudi mobile has a fixed length in each of
 *  its written forms, so «055000900» (one digit short) is refused instead of becoming a second customer
 *  that no WhatsApp message can ever reach (review, 2026-09-15). Other countries: 8–15 digits. */
export function phoneShapeProblem(digits: string): string {
  var d = String(digits || "");
  if (!d) return "";
  if (d.length < 8 || d.length > 15) return "رقم غير صالح — عدد الأرقام غير صحيح";
  if (d.indexOf("05") === 0 && d.length !== 10) return "رقم الجوال السعودي يبدأ بـ05 ويتكون من 10 أرقام";
  if (d.indexOf("9665") === 0 && d.length !== 12) return "رقم الجوال السعودي الدولي يتكون من 12 رقمًا (9665…)";
  if (d.indexOf("009665") === 0 && d.length !== 14) return "رقم الجوال السعودي الدولي يتكون من 14 رقمًا (009665…)";
  if (d.charAt(0) === "5" && d.length !== 9 && d.length < 11) return "رقم الجوال السعودي بدون الصفر يتكون من 9 أرقام";
  return "";
}

/**
 * BR-CUS-001 + BR-CUS-002: a NEW account needs a name, a city and at least one named contact; each contact
 * row that carries anything needs a name; one contact is primary. The account's WhatsApp number is its
 * identity everywhere else in Massar (conversations, campaigns, opportunities all key by it), so it is
 * required on create and fixed afterwards.
 *
 * An EDIT asks for the name only: accounts that arrived before this slice (imports, WhatsApp) have no city
 * and no contacts, and assigning one an owner must not force someone to invent a person (review).
 *
 * `memberIds` are the team members an owner may be chosen from. Values that are not text are treated as
 * empty — an object in a JSON body is a malformed request, not a name.
 */
export function checkAccount(input: AccountInput, memberIds: readonly number[], isEdit: boolean): AccountCheck {
  var src = input && typeof input === "object" ? input : {};
  var text = function (v: unknown) { return typeof v === "string" || typeof v === "number" ? String(v).trim() : ""; };
  var name = text(src.name);
  if (!name) return { ok: false, field: "name", reason: "اسم العميل مطلوب" };
  if (name.length > ACCOUNT_NAME_MAX) return { ok: false, field: "name", reason: "اسم العميل أطول من " + ACCOUNT_NAME_MAX + " حرفًا" };
  var city = text(src.city);
  if (!city && !isEdit) return { ok: false, field: "city", reason: "المدينة مطلوبة" };
  if (city.length > ACCOUNT_CITY_MAX) return { ok: false, field: "city", reason: "اسم المدينة أطول من " + ACCOUNT_CITY_MAX + " حرفًا" };
  var sector = text(src.sector);
  if (sector.length > ACCOUNT_SECTOR_MAX) return { ok: false, field: "sector", reason: "القطاع أطول من " + ACCOUNT_SECTOR_MAX + " حرفًا" };
  var importance = text(src.importance);
  if (importance && ACCOUNT_IMPORTANCE.indexOf(importance as AccountImportance) < 0) return { ok: false, field: "importance", reason: "درجة الأهمية غير معروفة" };
  /* «حجم المنشأة» is optional: nobody should be blocked from recording a client because they do
     not yet know its size. An unrecognised value is REFUSED rather than dropped — silently storing
     null would tell the caller the size was saved. */
  var sizeRaw = text(src.sizeTier);
  var sizeTier: AccountSize | null = null;
  if (sizeRaw) {
    sizeTier = normalizeAccountSize(sizeRaw);
    if (!sizeTier) return { ok: false, field: "sizeTier", reason: "حجم المنشأة غير معروف" };
  }
  var ownerRaw = text(src.ownerId);
  var ownerId: number | null = null;
  if (ownerRaw) {
    ownerId = /^[0-9]+$/.test(ownerRaw) ? Number(ownerRaw) : 0;
    if (!(ownerId > 0) || memberIds.indexOf(ownerId) < 0) return { ok: false, field: "ownerId", reason: "الموظف المسؤول غير موجود في الفريق أو غير نشط" };
  }
  var phone = phoneDigits(src.phone);
  if (!isEdit) {
    if (!phone) return { ok: false, field: "phone", reason: "رقم واتساب العميل مطلوب — به ترتبط المحادثات والحملات والفرص" };
    var pp = phoneShapeProblem(phone);
    if (pp) return { ok: false, field: "phone", reason: pp };
  }
  var rows = Array.isArray(src.contacts) ? (src.contacts as ContactInput[]) : [];
  var contacts: ContactValue[] = [];
  var seenPhones: Record<string, number> = {};
  var primaryAt = -1;
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i] && typeof rows[i] === "object" ? rows[i] : {};
    var cn = text(r.name), cr = text(r.role), cp = text(r.phone), ce = text(r.email);
    if (!cn && !cr && !cp && !ce) continue;
    var at = contacts.length;
    if (!cn) return { ok: false, field: "contacts." + i + ".name", reason: "اسم جهة الاتصال مطلوب" };
    if (cn.length > CONTACT_NAME_MAX) return { ok: false, field: "contacts." + i + ".name", reason: "اسم جهة الاتصال أطول من " + CONTACT_NAME_MAX + " حرفًا" };
    if (cr.length > CONTACT_ROLE_MAX) return { ok: false, field: "contacts." + i + ".role", reason: "المنصب أطول من " + CONTACT_ROLE_MAX + " حرفًا" };
    var cd = phoneDigits(cp);
    if (cp && !cd) return { ok: false, field: "contacts." + i + ".phone", reason: "رقم هاتف جهة الاتصال غير صالح" };
    var cpp = phoneShapeProblem(cd);
    if (cpp) return { ok: false, field: "contacts." + i + ".phone", reason: cpp };
    if (cd && seenPhones[cd] != null) return { ok: false, field: "contacts." + i + ".phone", reason: "هذا الرقم مكرر لجهتي اتصال" };
    if (cd) seenPhones[cd] = at;
    if (ce && (ce.length > CONTACT_EMAIL_MAX || !/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(ce))) return { ok: false, field: "contacts." + i + ".email", reason: "البريد الإلكتروني غير صالح" };
    var isPrimary = r.primary === true || r.primary === "true";
    if (isPrimary && primaryAt < 0) primaryAt = at;
    var cid = typeof r.id === "number" && r.id > 0 && r.id === Math.floor(r.id) ? r.id : null;
    contacts.push({ id: cid, name: cn, role: cr || null, phone: cd || null, email: ce || null, primary: false });
  }
  if (!contacts.length && !isEdit) return { ok: false, field: "contacts", reason: "أضف جهة اتصال واحدة على الأقل باسمها" };
  if (contacts.length > CONTACTS_MAX) return { ok: false, field: "contacts", reason: "الحد " + CONTACTS_MAX + " جهة اتصال للعميل" };
  if (contacts.length) contacts[primaryAt < 0 ? 0 : primaryAt].primary = true;
  return {
    ok: true,
    value: { name: name, city: city || null, sector: sector || null, importance: (importance || null) as AccountImportance | null, sizeTier: sizeTier, ownerId: ownerId, phone: phone, contacts: contacts },
  };
}

/** The approval moves an account may make. Any state may move to any other — a rejection is reversible —
 *  but a no-op is refused so the audit log never records a decision nobody made. */
export function checkApproval(current: string, next: unknown): { ok: true; value: AccountApproval } | { ok: false; reason: string } {
  var n = typeof next === "string" ? next : "";
  if (ACCOUNT_APPROVALS.indexOf(n as AccountApproval) < 0) return { ok: false, reason: "قرار غير معروف" };
  if (n === current) return { ok: false, reason: "العميل " + ACCOUNT_APPROVAL_LABELS[n as AccountApproval] + " بالفعل" };
  return { ok: true, value: n as AccountApproval };
}

export type AccountFilterRow = {
  id: number; name: string; phone: string; city: string | null; sector: string | null; importance: string | null;
  sizeTier?: string | null;
  ownerId: number | null; approval: string; products: readonly string[]; contactText: string;
};
export type AccountFilter = {
  q?: string; tab?: string; product?: string; sector?: string; city?: string; owner?: string; importance?: string;
  /** a tier key, or "__none" for accounts nobody has classified yet */
  size?: string;
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
  /* «بلا حجم مسجّل» is a real thing to ask for — it is the worklist of accounts still to classify,
     and it is 16 of 16 on the day this shipped. It is NOT the same as matching the empty string. */
  if (f.size) {
    if (f.size === "__none") { if (a.sizeTier) return false; }
    else if ((a.sizeTier || "") !== f.size) return false;
  }
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

// ------------------------------------------------------- BR-CAM-002: the audience by account column
//
// The campaign wizard could already narrow an audience, but only by the COLUMNS THE IMPORTED FILE
// happened to carry (segGroups reads entities.attrs). That makes the segment an artefact of whoever
// prepared the spreadsheet: an account added by hand through «الحسابات» has no attrs at all and is
// therefore invisible to every chip on that step, and «القطاع» means one thing in one upload and
// another in the next. S2 gave an account real columns — sector, city, importance — and BR-CAM-002
// asks the wizard to filter on THOSE. The import columns stay, below these, for anything the account
// record has no field for (نوع المنشأة، عدد الأسرّة…).
//
// The empty value is a value. «بدون» (AUDIENCE_NONE) selects the accounts where the column was never
// filled — the operator needs to see them to fix them, and silently folding them into «الكل» is how
// a book of 400 accounts launches to 120 without anyone noticing.

export const AUDIENCE_NONE = "__none__";
/** The spreadsheet headers each account column is read from — the same list accountFieldsFromAttrs
 *  accepts, plus «المدينة» for the city. The wizard hides an imported chip whose header is in here,
 *  because the account column now carries that fact and two chips over one fact can disagree. */
export const AUDIENCE_ATTR_KEYS: readonly string[] = [
  "القطاع", "الشريحة", "القطاع/الشريحة", "sector",
  "الأهمية", "درجة الأهمية", "importance",
  "المدينة", "city",
];
export const AUDIENCE_FIELDS = [
  { key: "sector", label: "القطاع" },
  { key: "city", label: "المدينة" },
  { key: "importance", label: "الأهمية" },
] as const;
export type AudienceFieldKey = (typeof AUDIENCE_FIELDS)[number]["key"];
export type AudienceRow = { sector?: string | null; city?: string | null; importance?: string | null };
export type AudienceFilter = Partial<Record<AudienceFieldKey, string>>;

/** One account's value for one audience column, trimmed; "" when the column was never filled. */
export function audienceValueOf(a: AudienceRow, key: string): string {
  var v = key === "sector" ? a.sector : key === "city" ? a.city : key === "importance" ? a.importance : null;
  return typeof v === "string" ? v.trim() : "";
}

/** An unset field matches everything; AUDIENCE_NONE matches only the accounts missing that column. */
export function audienceMatches(a: AudienceRow, f: AudienceFilter): boolean {
  for (var i = 0; i < AUDIENCE_FIELDS.length; i++) {
    var key = AUDIENCE_FIELDS[i].key;
    var want = f ? (f as Record<string, string>)[key] : "";
    if (!want) continue;
    var have = audienceValueOf(a, key);
    if (want === AUDIENCE_NONE) { if (have) return false; }
    else if (have !== want) return false;
  }
  return true;
}

/** The chips the wizard draws: each column's values with live counts, commonest first, plus how many
 *  accounts have that column empty. Counts are of the rows PASSED IN, so they answer «كم سيبقى؟» for
 *  the audience as it stands, not for the whole book. */
export function audienceGroups(rows: readonly AudienceRow[], max?: number):
  { key: string; label: string; values: [string, number][]; missing: number }[] {
  var cap = typeof max === "number" && max > 0 ? max : 12;
  var out: { key: string; label: string; values: [string, number][]; missing: number }[] = [];
  for (var i = 0; i < AUDIENCE_FIELDS.length; i++) {
    var key = AUDIENCE_FIELDS[i].key;
    var counts: Record<string, number> = {}; var seen: Record<string, number> = {}; var order: string[] = []; var missing = 0;
    for (var j = 0; j < rows.length; j++) {
      var v = audienceValueOf(rows[j], key);
      if (!v) { missing++; continue; }
      if (counts[v] === undefined) { counts[v] = 0; seen[v] = order.length; order.push(v); }
      counts[v]++;
    }
    // Commonest first; ties keep first-seen order, so the chips do not reshuffle between renders.
    // The tiebreak reads a recorded index, never order.indexOf — that would move under the sort.
    order.sort(function (a, b) { return counts[b] - counts[a] || seen[a] - seen[b]; });
    var values: [string, number][] = [];
    for (var k = 0; k < order.length && k < cap; k++) values.push([order[k], counts[order[k]]]);
    out.push({ key: key, label: AUDIENCE_FIELDS[i].label, values: values, missing: missing });
  }
  return out;
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

const DOMAIN_FNS = [phoneDigits, phoneShapeProblem, checkAccount, checkApproval, accountMatches, productStatusOf,
  audienceValueOf, audienceMatches, audienceGroups, normalizeAccountSize] as const;

const INJECTED = [
  "ACCOUNT_APPROVALS", "ACCOUNT_APPROVAL_LABELS", "ACCOUNT_IMPORTANCE", "ACCOUNT_IMPORTANCE_LABELS",
  "ACCOUNT_SIZES", "ACCOUNT_SIZE_LABELS", "ACCOUNT_SIZE_BASIS",
  "ACCOUNT_SOURCES", "ACCOUNT_SOURCE_LABELS", "PRODUCT_STATUS_LABELS",
  "ACCOUNT_NAME_MAX", "ACCOUNT_CITY_MAX", "ACCOUNT_SECTOR_MAX", "CONTACT_NAME_MAX", "CONTACT_ROLE_MAX", "CONTACT_EMAIL_MAX", "CONTACTS_MAX",
  "AUDIENCE_FIELDS", "AUDIENCE_NONE", "AUDIENCE_ATTR_KEYS",
] as const;

export const ACCOUNT_DOMAIN_JS: string = [
  "/* ===== account-domain (generated from src/account-domain.ts — do not edit here) ===== */",
  "var ACCOUNT_APPROVALS = " + JSON.stringify(ACCOUNT_APPROVALS) + ";",
  "var ACCOUNT_APPROVAL_LABELS = " + JSON.stringify(ACCOUNT_APPROVAL_LABELS) + ";",
  "var ACCOUNT_IMPORTANCE = " + JSON.stringify(ACCOUNT_IMPORTANCE) + ";",
  "var ACCOUNT_IMPORTANCE_LABELS = " + JSON.stringify(ACCOUNT_IMPORTANCE_LABELS) + ";",
  "var ACCOUNT_SIZES = " + JSON.stringify(ACCOUNT_SIZES) + ";",
  "var ACCOUNT_SIZE_LABELS = " + JSON.stringify(ACCOUNT_SIZE_LABELS) + ";",
  "var ACCOUNT_SIZE_BASIS = " + JSON.stringify(ACCOUNT_SIZE_BASIS) + ";",
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
  "var AUDIENCE_FIELDS = " + JSON.stringify(AUDIENCE_FIELDS) + ";",
  "var AUDIENCE_NONE = " + JSON.stringify(AUDIENCE_NONE) + ";",
  "var AUDIENCE_ATTR_KEYS = " + JSON.stringify(AUDIENCE_ATTR_KEYS) + ";",
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
      if (/^(calculateLineValue|isLostStage|isOpenStage|isWonStage|summarizeAccountOpps|accountFieldsFromAttrs|audienceValueOf)$/.test(id) && shipped.indexOf(id) === -1) problems.push(fn.name + " references " + id);
    }
  }
  return problems;
}
