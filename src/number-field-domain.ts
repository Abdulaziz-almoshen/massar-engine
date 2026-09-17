/**
 * number-field-domain.ts — the rules behind every numeric input on the dashboard.
 *
 * WHY THIS EXISTS. The founder asked for one number field everywhere (2026-09-17), after the coss ui
 * NumberField (coss.com/ui/particles?tags=input): a − and + either side of the value, arrow keys that
 * step, Shift for ten steps, Home/End for the bounds, and a value that is clamped and cleaned when it is
 * committed. Twenty fields across eight builders were plain type="number" inputs, each with its own idea
 * of what a number is. These are the rules they now share, kept pure so they are tested here rather than
 * discovered in a browser.
 *
 * TWO RULES THAT ARE MASSAR'S, NOT THE REFERENCE'S.
 *
 *   EMPTY IS NOT ZERO. An empty price field means «بلا سعر» and an empty target means «بلا مستهدف»; the
 *   whole reporting layer depends on null and 0 staying different. So committing an empty field keeps it
 *   empty, and an unreadable entry reverts to the last committed value instead of becoming 0.
 *
 *   ARABIC DIGITS ARE DIGITS. A user on an Arabic keyboard types «٣٤٠٠٠» and «٫» for the decimal point.
 *   A type="number" input rejects those silently and the save receives an empty string. They are mapped
 *   to western digits, which is what the rest of the app prints.
 *
 * Serialised to the browser via Function.prototype.toString(), so every function may reference only its
 * parameters and the other functions in NUMBER_FIELD_FNS.
 */

export type NumberFieldBounds = {
  readonly min?: number | null;
  readonly max?: number | null;
  readonly step?: number | null;
};

/** Arabic-Indic (٠-٩) and Extended Arabic-Indic (۰-۹) digits to western; «٫» to «.». Length-preserving,
 *  so it can run on every keystroke without moving the caret. Grouping marks are left for commit. */
export function normalizeNumberDigits(raw: string): string {
  let out = "";
  const s = String(raw == null ? "" : raw);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0x0660 && c <= 0x0669) out += String.fromCharCode(48 + c - 0x0660);
    else if (c >= 0x06f0 && c <= 0x06f9) out += String.fromCharCode(48 + c - 0x06f0);
    else if (c === 0x066b) out += ".";
    else out += s.charAt(i);
  }
  return out;
}

/** The number a field holds, or null when it is empty, or NaN when it holds something that is not a
 *  number. Grouping marks («,» «٬» «،» and spaces) are ignored, so «34,000» reads as 34000. */
export function parseNumberField(raw: string): number {
  const s = normalizeNumberDigits(raw).replace(/[,٬،\s]/g, "");
  if (s === "") return null as unknown as number;
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
  return Number(s);
}

/** Decimal places a step implies, so 0.1 + 0.2 prints «0.3» and not «0.30000000000000004». */
export function stepDecimals(step: number): number {
  const t = String(step);
  const i = t.indexOf(".");
  return i < 0 ? 0 : t.length - i - 1;
}

/** Clamp to the bounds and round to the step's precision, returned as the string the field shows. */
export function formatNumberField(n: number, b: NumberFieldBounds): string {
  let v = n;
  if (b.min !== null && b.min !== undefined && v < b.min) v = b.min;
  if (b.max !== null && b.max !== undefined && v > b.max) v = b.max;
  const d = stepDecimals(b.step || 1);
  return d ? String(Number(v.toFixed(d))) : String(Math.round(v));
}

/**
 * One press of − or + (or an arrow key), `times` steps at once (Shift and PageUp/Down pass 10).
 *
 * From EMPTY, increasing starts at the smallest meaningful value — the minimum when it is above zero,
 * otherwise one step — and decreasing does nothing: there is no number to take a step away from, and
 * inventing one would turn «بلا سعر» into a price nobody entered. An unreadable entry is treated the
 * same way as empty.
 */
export function stepNumberField(raw: string, dir: 1 | -1, b: NumberFieldBounds, times?: number): string {
  const cur = parseNumberField(raw);
  const step = b.step || 1;
  if (cur === null || isNaN(cur)) {
    if (dir < 0) return String(raw == null ? "" : raw);
    const start = b.min !== null && b.min !== undefined && b.min > 0 ? b.min : step;
    return formatNumberField(start, b);
  }
  return formatNumberField(cur + dir * step * (times || 1), b);
}

/** Home and End: the bound, when there is one. With no bound the value is left alone. */
export function boundNumberField(raw: string, which: "min" | "max", b: NumberFieldBounds): string {
  const v = which === "min" ? b.min : b.max;
  if (v === null || v === undefined) return String(raw == null ? "" : raw);
  return formatNumberField(v, b);
}

/**
 * What a field holds once it is committed (on change or blur): empty stays empty, a readable number is
 * clamped and cleaned, and anything else reverts to `last` — the value the field held before this edit.
 */
export function commitNumberField(raw: string, last: string, b: NumberFieldBounds): string {
  const n = parseNumberField(raw);
  if (n === null) return "";
  if (isNaN(n)) return String(last == null ? "" : last);
  return formatNumberField(n, b);
}

/** Whether − and + can do anything from here, so each can say so instead of silently no-oping. */
export function numberFieldCanStep(raw: string, b: NumberFieldBounds): { dec: boolean; inc: boolean } {
  const n = parseNumberField(raw);
  if (n === null || isNaN(n)) return { dec: false, inc: true };
  return {
    dec: b.min === null || b.min === undefined || n > b.min,
    inc: b.max === null || b.max === undefined || n < b.max,
  };
}

const NUMBER_FIELD_FNS = [
  normalizeNumberDigits, parseNumberField, stepDecimals, formatNumberField,
  stepNumberField, boundNumberField, commitNumberField, numberFieldCanStep,
] as const;

export const NUMBER_FIELD_DOMAIN_JS: string = [
  "/* ===== number-field-domain (generated from src/number-field-domain.ts — do not edit here) ===== */",
  ...NUMBER_FIELD_FNS.map((fn) => fn.toString()),
].join("\n");
