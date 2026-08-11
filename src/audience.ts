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

export type ImportRow = { name: string; phone: string; attrs: Record<string, string> };
export type ImportParse = {
  rows: ImportRow[];
  columns: { name: string; phone: string; attrs: string[] };
  skipped: { row: number; reason: string }[];
  totalRows: number;
};

export function parseAudienceFile(buffer: Buffer, filename: string): ImportParse {
  const wb = XLSX.read(buffer, { type: "buffer", codepage: 65001 });
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
    for (const { h, i } of attrIdx) {
      const v = String(line[i] ?? "").trim();
      if (v) attrs[h] = v;
    }
    rows.push({ name, phone, attrs });
  }
  if (grid.length - 1 > MAX_ROWS) {
    skipped.push({ row: MAX_ROWS + 2, reason: `تجاوز الحد (${MAX_ROWS} صف) — تم تجاهل الباقي` });
  }
  console.log(JSON.stringify({ at: "audience", msg: "file parsed", filename, sheet: sheetName, rows: rows.length, skipped: skipped.length }));
  return {
    rows,
    columns: { name: headers[nameIdx], phone: headers[phoneIdx], attrs: attrIdx.map((a) => a.h) },
    skipped,
    totalRows: grid.length - 1,
  };
}
