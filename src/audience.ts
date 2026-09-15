import * as XLSX from "xlsx";

// ---------------------------------------------------------------------------
// Audience file import: Excel/CSV → entities with schemaless attributes.
// Header auto-map (Arabic/English), KSA phone normalization, upsert by phone.
// The wizard derives segment chips from whatever columns the file carried.
// ---------------------------------------------------------------------------

const NAME_HEADERS = ["الاسم", "اسم", "الجهة", "جهة", "العميل", "الشركة", "المنشأة", "name", "company", "entity", "client"];
// Bare "رقم" stays LAST: the substring pass scans in this order, and a generic "رقم"
// must not shadow specific columns (رقم السجل التجاري…) when a واتساب/جوال column exists.
const PHONE_HEADERS = ["الجوال", "جوال", "رقم الجوال", "واتساب", "whatsapp", "الهاتف", "هاتف", "phone", "mobile", "tel", "number", "رقم"];

const MAX_ROWS = 5000;

function norm(h: string): string {
  return h.trim().toLowerCase().replace(/[أإآ]/g, "ا").replace(/\s+/g, " ");
}

function matchHeader(headers: string[], candidates: string[]): number {
  const normed = headers.map(norm);
  for (const c of candidates) {
    const i = normed.findIndex((h) => h === norm(c));
    if (i !== -1) return i;
  }
  for (const c of candidates) {
    const i = normed.findIndex((h) => h.includes(norm(c)));
    if (i !== -1) return i;
  }
  return -1;
}

/** KSA-aware: 05XXXXXXXX → 966XXXXXXXXX; bare 5XXXXXXXX → 966…; otherwise digits as-is. */
export function normalizePhone(raw: unknown): string {
  let d = String(raw ?? "").replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c))).replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 13 && d.startsWith("9660")) d = "966" + d.slice(4);   // 966 + 05… double-prefix
  if (d.length === 10 && d.startsWith("05")) d = "966" + d.slice(1);
  else if (d.length === 9 && d.startsWith("5")) d = "966" + d;
  return d;
}

/** Excel formats number-typed cells ("966512345678" General) as "9.66512E+11" — the digits
 *  survive the strip and pass length gates, silently corrupting the primary onboarding path. */
const SCI_NOTATION = /\d\s*[eE]\s*\+?\s*\d/;

/** The fill-in template users download from the portal (headers + example rows). */
export function buildTemplateXlsx(): Buffer {
  const rows = [
    ["الاسم", "الجوال", "المدينة", "الحجم", "القطاع"],
    ["مجمع النور الطبي (مثال — امسح هذا الصف)", "0512345678", "الرياض", "كبيرة", "مجمعات طبية"],
    ["عيادات الشفاء (مثال)", "0598765432", "جدة", "متوسطة", "عيادات"],
    ["صيدلية الدواء (مثال)", "966501112233", "الدمام", "صغيرة", "صيدليات"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 34 }, { wch: 16 }, { wch: 12 }, { wch: 10 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "المستهدفون");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export type ImportRow = { name: string; phone: string; attrs: Record<string, string>; tags: string[] };

/**
 * Header → «this column is a tag». Deliberately NARROW: an unrecognised column stays an attribute,
 * where the segment chips already read it, rather than being guessed into the tag vocabulary.
 *
 * «المنتجات» is NOT here on purpose — facts.ts already claims it for currentProducts (what the
 * account BUYS), and one header cannot honestly mean both what they own and who we plan to
 * approach. A department naming its own line uses «خط المنتجات» or «القسم» or plain «الوسم».
 */
const TAG_HEADERS = /^\s*(الوسم|الوسوم|وسم|وسوم|القسم|الفئة|خط\s*المنتجات|المنتج\s*المستهدف|الخدمة\s*المستهدفة|tags?|label|line)\s*$/i;

/** A cell may name several, in either comma. Values are trimmed and de-duplicated; anything longer
 *  than a tag has any business being is dropped rather than truncated into a near-duplicate. */
const TAG_MAX_LEN = 60;
export function tagsFromCell(v: string): string[] {
  const out: string[] = [];
  for (const part of String(v ?? "").split(/[،,;|]/)) {
    const t = part.trim().replace(/\s+/g, " ");
    if (t && t.length <= TAG_MAX_LEN && !out.includes(t)) out.push(t);
  }
  return out;
}
export type ImportParse = {
  rows: ImportRow[];
  columns: { name: string; phone: string; attrs: string[]; tags: string[] };
  skipped: { row: number; reason: string }[];
  totalRows: number;
};

export function parseAudienceFile(buffer: Buffer, filename: string): ImportParse {
  // The same inflation bound and row bound the indicator upload uses (security review: this path had
  // the zip-bomb shape too). sheetRows stops parsing past the cap instead of reading it and discarding.
  if (zipTooLarge(buffer)) throw new Error("الملف أكبر مما يمكن قراءته بعد فكّ ضغطه");
  const wb = XLSX.read(buffer, { type: "buffer", codepage: 65001, sheetRows: MAX_ROWS + 2 });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("الملف لا يحتوي على أي ورقة بيانات");
  const grid: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "", raw: false });
  // Second read with raw values: phones typed as NUMBERS format to scientific notation in the
  // formatted grid; the raw cell (exact integer < 2^53) is the truth for the phone column.
  const rawGrid: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "", raw: true });
  if (grid.length < 2) throw new Error("الملف يحتاج صف عناوين وصفًا واحدًا على الأقل من البيانات");

  const headers = (grid[0] ?? []).map((h) => String(h ?? "").trim());
  const nameIdx = matchHeader(headers, NAME_HEADERS);
  const phoneIdx = matchHeader(headers, PHONE_HEADERS);
  if (nameIdx === -1 || phoneIdx === -1) {
    throw new Error(`تعذر التعرف على أعمدة الاسم/الجوال — العناوين الموجودة: ${headers.filter(Boolean).join("، ") || "(لا شيء)"}`);
  }
  const attrIdx = headers
    .map((h, i) => ({ h, i }))
    .filter(({ h, i }) => h && i !== nameIdx && i !== phoneIdx);

  const rows: ImportRow[] = [];
  const skipped: { row: number; reason: string }[] = [];
  const dataRows = grid.slice(1, 1 + MAX_ROWS);
  for (let r = 0; r < dataRows.length; r++) {
    const line = dataRows[r] ?? [];
    const rowNo = r + 2; // 1-based + header row
    const name = String(line[nameIdx] ?? "").trim();
    const formattedPhone = String(line[phoneIdx] ?? "").trim();
    const rawPhone = (rawGrid[r + 1] ?? [])[phoneIdx];
    const phoneSource = typeof rawPhone === "number" && Number.isFinite(rawPhone)
      ? String(Math.round(rawPhone)) : formattedPhone;
    if (SCI_NOTATION.test(phoneSource)) {
      skipped.push({ row: rowNo, reason: `جوال بصيغة رقمية تالفة (${formattedPhone}) — نسّق العمود كنص` });
      continue;
    }
    const phone = normalizePhone(phoneSource);
    if (!name && !phone) continue; // fully empty line — not an error
    if (!name) { skipped.push({ row: rowNo, reason: "بدون اسم" }); continue; }
    if (phone.length < 8) { skipped.push({ row: rowNo, reason: `جوال غير صالح: ${formattedPhone || "(فارغ)"}` }); continue; }
    const attrs: Record<string, string> = {};
    const tags: string[] = [];
    for (const { h, i } of attrIdx) {
      const v = String(line[i] ?? "").trim();
      if (!v) continue;
      // A tag column becomes tags and NOT an attribute. Landing in both would give one spreadsheet
      // column two filters with two counts — the same label wearing two numbers.
      if (TAG_HEADERS.test(h)) { for (const t of tagsFromCell(v)) if (!tags.includes(t)) tags.push(t); continue; }
      attrs[h] = v;
    }
    rows.push({ name, phone, attrs, tags });
  }
  if (grid.length - 1 > MAX_ROWS) {
    skipped.push({ row: MAX_ROWS + 2, reason: `تجاوز الحد (${MAX_ROWS} صف) — تم تجاهل الباقي` });
  }
  console.log(JSON.stringify({ at: "audience", msg: "file parsed", filename, sheet: sheetName, rows: rows.length, skipped: skipped.length }));
  return {
    rows,
    columns: {
      name: headers[nameIdx], phone: headers[phoneIdx],
      attrs: attrIdx.filter((a) => !TAG_HEADERS.test(a.h)).map((a) => a.h),
      tags: attrIdx.filter((a) => TAG_HEADERS.test(a.h)).map((a) => a.h),
    },
    skipped,
    totalRows: grid.length - 1,
  };
}

/** Refuse a workbook whose sheets would inflate past what this machine can hold, BEFORE the xlsx
 *  library inflates them. An .xlsx is a zip; its central directory states every entry's uncompressed
 *  size. Measured by the security review: a 462KB file holding 108MB of sheet XML killed a 400MB
 *  heap inside XLSX.read — on the process that also carries the WhatsApp webhook and «إيقاف». Files
 *  that are not zips (CSV, legacy .xls) are bounded by the upload size instead. */
export const MAX_UNZIPPED_BYTES = 40 * 1024 * 1024;
export function zipTooLarge(buf: Buffer): boolean {
  if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) return false;   // not a zip
  const from = Math.max(0, buf.length - 65557);
  let eocd = -1;
  for (let i = buf.length - 22; i >= from; i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) return true;                                                  // a zip we cannot read the directory of
  const entries = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  let total = 0;
  for (let n = 0; n < entries; n++) {
    if (off + 46 > buf.length || buf.readUInt32LE(off) !== 0x02014b50) return true;
    const size = buf.readUInt32LE(off + 24);
    if (size === 0xffffffff) return true;                                     // ZIP64: larger than we accept
    total += size;
    if (total > MAX_UNZIPPED_BYTES) return true;
    off += 46 + buf.readUInt16LE(off + 28) + buf.readUInt16LE(off + 30) + buf.readUInt16LE(off + 32);
  }
  return false;
}

/** The first sheet of an Excel/CSV file as a plain grid, for indicator uploads. `overflow` is true when
 *  the sheet holds more data rows than MAX_ROWS — the caller refuses it rather than silently keeping
 *  the first 5,000 (eng + codex review). sheetRows bounds the parse itself. Phone-shaped numbers come
 *  from the RAW cell, as in parseAudienceFile: a General-formatted 966512345678 formats as 9.66512E+11. */
/** What the bytes actually are. The extension is a claim; a renamed text file or random bytes were
 *  accepted as «spreadsheets» and showed as thousands of garbage rows (QA). */
export function sniffSheet(buf: Buffer, filename: string): "zip" | "cfb" | "text" | "unknown" {
  const ext = (filename.match(/\.([a-z0-9]+)$/i)?.[1] || "").toLowerCase();
  if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) return ext === "xlsx" ? "zip" : "unknown";
  if (buf.length >= 8 && buf.readUInt32BE(0) === 0xd0cf11e0 && buf.readUInt32BE(4) === 0xa1b11ae1) return ext === "xls" ? "cfb" : "unknown";
  if (ext !== "csv") return "unknown";
  const sample = buf.subarray(0, Math.min(buf.length, 64_000));
  let control = 0;
  for (const b of sample) if (b === 0 || (b < 9) || (b > 13 && b < 32)) control++;
  return control > sample.length * 0.01 ? "unknown" : "text";
}

/** A CSV as text. Excel's «CSV UTF-8» starts with a BOM, and an older Arabic Excel writes Windows-1256;
 *  both used to reach SheetJS as bytes and come back as mojibake with every column shifted (QA). */
export function decodeCsv(buf: Buffer): string {
  let b = buf;
  if (b.length >= 3 && b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) b = b.subarray(3);
  try { return new TextDecoder("utf-8", { fatal: true }).decode(b); }
  catch { return new TextDecoder("windows-1256").decode(b); }
}

export function gridFromFile(buffer: Buffer, filename = "file.xlsx"): { grid: string[][]; overflow: boolean } {
  const kind = sniffSheet(buffer, filename);
  if (kind === "unknown") throw new Error("ليس ملف جدول بيانات صالحًا — استخدم XLSX أو XLS أو CSV");
  if (kind === "text") {
    // raw strings: a CSV phone «0500000810» must not become the number 500000810.
    const wbText = XLSX.read(decodeCsv(buffer), { type: "string", raw: true, sheetRows: MAX_ROWS + 2 });
    const sh = wbText.Sheets[wbText.SheetNames[0]];
    const g: string[][] = (XLSX.utils.sheet_to_json(sh, { header: 1, defval: "", raw: false }) as unknown[][])
      .map((row) => (row ?? []).map((c) => String(c ?? "").trim()));
    return { grid: g.slice(0, MAX_ROWS + 1), overflow: g.length > MAX_ROWS + 1 };
  }
  if (zipTooLarge(buffer)) throw new Error("الملف أكبر مما يمكن قراءته بعد فكّ ضغطه");
  const wb = XLSX.read(buffer, { type: "buffer", codepage: 65001, sheetRows: MAX_ROWS + 2 });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("الملف لا يحتوي على أي ورقة بيانات");
  const sheet = wb.Sheets[sheetName];
  const rawGrid: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
  const grid: string[][] = rawGrid.map((row, r) => (row ?? []).map((raw, c) => {
    if (typeof raw === "number" && Number.isInteger(raw) && String(raw).length >= 9) return String(raw);
    const cell = sheet[XLSX.utils.encode_cell({ r, c })];
    return String(cell && cell.w != null ? cell.w : raw ?? "").trim();
  }));
  return { grid: grid.slice(0, MAX_ROWS + 1), overflow: grid.length > MAX_ROWS + 1 };
}

/** The indicator fill-in template: the prototype's columns plus the phone, which is the strongest key. */
export function buildIndicatorTemplateXlsx(): Buffer {
  const rows = [
    ["اسم العميل", "المعرف", "الجوال", "قيمة المؤشر", "الفترة", "ملاحظات"],
    ["مجمع النور الطبي (مثال — امسح هذا الصف)", "C-1042", "0512345678", "87%", "الربع 2 2026", "استخدام مستقر"],
    ["مستشفى الحياة (مثال)", "C-1077", "", "64%", "الربع 2 2026", ""],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 36 }, { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 22 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "بيانات المؤشر");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
