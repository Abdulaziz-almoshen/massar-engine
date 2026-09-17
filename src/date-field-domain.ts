/**
 * date-field-domain.ts — the maths behind the date picker and the range picker.
 *
 * WHY. The founder asked for the coss ui date pickers (p-date-picker-3 for a single date,
 * p-date-picker-2 for a range, 2026-09-17). Those specimens are React over date-fns and @daypicker;
 * this app is a template-literal SPA with no build step and no React, so the PATTERN is ported and the
 * arithmetic is written here — pure, so a month grid, a clamp and a parse are tested rather than
 * eyeballed in a browser.
 *
 * ISO IS THE VALUE. Every date on the wire and in Postgres is «YYYY-MM-DD», which is what the
 * type="date" inputs these replace already carried, so no save path changes. Only the DISPLAY is
 * Arabic.
 *
 * NO TIMEZONE ARITHMETIC. A date here is a calendar day, not an instant. Parsing «2026-09-17» builds a
 * LOCAL noon Date, so a day never slides backwards in Riyadh the way new Date("2026-09-17") does by
 * being parsed as UTC midnight.
 *
 * Serialised to the browser via Function.prototype.toString(), so every function may reference only its
 * parameters and the other functions in DATE_FIELD_FNS.
 */

/** Gregorian month names as the dashboard prints them elsewhere (fmtD's own list). */
export const AR_MONTHS: readonly string[] = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

/** The week starts on Sunday in Saudi Arabia, so the grid's first column is الأحد. */
export const AR_WEEKDAYS: readonly string[] = ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];

/** «YYYY-MM-DD» → a local-noon Date, or null. Rejects a well-formed but impossible day (2026-02-31). */
export function parseISODate(v: string): Date | null {
  const s = String(v == null ? "" : v).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]) - 1, d = Number(m[3]);
  if (mo < 0 || mo > 11 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo, d, 12, 0, 0, 0);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
  return dt;
}

/** A Date → «YYYY-MM-DD», read in LOCAL time (toISOString would shift the day). */
export function toISODate(d: Date): string {
  const p = (n: number) => (n < 10 ? "0" + n : String(n));
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}

/** «17 سبتمبر 2026», the form the rest of the dashboard prints. Western numerals, as everywhere. */
export function formatArabicDate(v: string): string {
  const d = parseISODate(v);
  if (!d) return "";
  return d.getDate() + " " + AR_MONTHS[d.getMonth()] + " " + d.getFullYear();
}

export function sameISODay(a: string, b: string): boolean {
  return !!a && !!b && a === b;
}

/** Whether a day is inside [from, to] inclusive; a half-open range contains only its own end. */
export function isWithinISO(day: string, from: string, to: string): boolean {
  if (!day) return false;
  if (from && to) return day >= from && day <= to;
  if (from) return day === from;
  return false;
}

/** Whether a day may be chosen, given optional «YYYY-MM-DD» bounds. */
export function isDayAllowed(day: string, min?: string | null, max?: string | null): boolean {
  if (!day) return false;
  if (min && day < min) return false;
  if (max && day > max) return false;
  return true;
}

export type MonthCell = { iso: string; day: number; inMonth: boolean };

/**
 * The six-week grid for a month, Sunday first, padded with the neighbouring months' days so every row
 * has seven cells and the grid never changes height between months (a calendar that grows by a row as
 * you page through it moves everything under it).
 */
export function monthGrid(year: number, month: number): MonthCell[] {
  const first = new Date(year, month, 1, 12, 0, 0, 0);
  const lead = first.getDay();                    // 0 = Sunday
  const start = new Date(year, month, 1 - lead, 12, 0, 0, 0);
  const out: MonthCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i, 12, 0, 0, 0);
    out.push({ iso: toISODate(d), day: d.getDate(), inMonth: d.getMonth() === month });
  }
  return out;
}

/** Step a month by n, wrapping the year. Returns { year, month }. */
export function shiftMonth(year: number, month: number, n: number): { year: number; month: number } {
  const t = year * 12 + month + n;
  return { year: Math.floor(t / 12), month: ((t % 12) + 12) % 12 };
}

/** Step a day by n days, as «YYYY-MM-DD» — what the arrow keys move by inside the grid. */
export function shiftISODay(v: string, n: number): string {
  const d = parseISODate(v);
  if (!d) return v;
  return toISODate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12, 0, 0, 0));
}

/**
 * The years a picker may page through. The specimen offered 1900 to today; a sales record has no use
 * for 1900, so the window is the bounds when they are given and ±5 years around the anchor otherwise.
 */
export function yearRange(anchor: number, min?: string | null, max?: string | null): number[] {
  const lo = min ? Number(String(min).slice(0, 4)) : anchor - 5;
  const hi = max ? Number(String(max).slice(0, 4)) : anchor + 5;
  const out: number[] = [];
  for (let y = Math.min(lo, anchor); y <= Math.max(hi, anchor); y++) out.push(y);
  return out;
}

/**
 * Clicking a day while picking a range. The first click starts it; the second closes it, and a second
 * click BEFORE the first swaps the ends rather than refusing — dragging backwards through a calendar is
 * how people pick «the last ten days».
 */
export function pickRange(from: string, to: string, day: string): { from: string; to: string } {
  if (!from || (from && to)) return { from: day, to: "" };
  if (day < from) return { from: day, to: from };
  return { from: from, to: day };
}

const DATE_FIELD_FNS = [
  parseISODate, toISODate, formatArabicDate, sameISODay, isWithinISO, isDayAllowed,
  monthGrid, shiftMonth, shiftISODay, yearRange, pickRange,
] as const;

export const DATE_FIELD_DOMAIN_JS: string = [
  "/* ===== date-field-domain (generated from src/date-field-domain.ts — do not edit here) ===== */",
  "var AR_MONTHS = " + JSON.stringify(AR_MONTHS) + ";",
  "var AR_WEEKDAYS = " + JSON.stringify(AR_WEEKDAYS) + ";",
  ...DATE_FIELD_FNS.map((fn) => fn.toString()),
].join("\n");
