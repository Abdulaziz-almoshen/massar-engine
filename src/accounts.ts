// The place where account facts live.
//
// The AE motion is "usage-led account expansion": the customer ALREADY uses a product, their
// manual transaction volume is the buying signal, and the pitch is moving that workflow into
// their HIS. That only works if the agent knows the account — and re-asking «كم فرع عندكم؟»
// when we already know is the single thing that makes it read as a bot.
//
// Facts here are TREATED AS KNOWN and may be stated back to the customer. Anything absent is
// simply absent: the agent must ask, never guess. There is no default, no inferred volume, no
// estimated branch count. (user-model Rule 2 — numbers must be real, sourced, honestly bounded.)
import { cfg } from "./config.js";

export type Account = {
  phone: string;                    // digits only, country code, no +
  customerName?: string;
  customerType?: string;            // مستشفى · مجموعة طبية · مجمع · مزوّد نظام HIS
  currentProducts?: string[];       // what they already pay for — the expansion base
  transactionVolume?: string;       // e.g. "≈1,400 إجازة شهريًا" — as measured, never estimated
  usageLevel?: string;              // مرتفع · متوسط · منخفض
  branches?: number;
  hisName?: string;
  hisArchitecture?: string;         // مركزي · لكل فرع
  integrationStatus?: string;       // لا يوجد · قيد الدراسة · جزئي
  manualUsage?: string;             // what is still done by hand
  pricing?: string;                 // AUTHORITATIVE for this account; overrides the product table
  approvedDiscountRange?: string;   // internal ceiling — never quoted verbatim to the customer
  contractStatus?: string;
  decisionMaker?: string;
  adjacentProducts?: string[];      // legitimate cross-sell, per Strategy 12
  technicalNotes?: string;
};

let cache: Map<string, Account> | null = null;

function load(): Map<string, Account> {
  if (cache) return cache;
  const m = new Map<string, Account>();
  try {
    const raw = JSON.parse(cfg.accountsJson) as Account[];
    if (Array.isArray(raw)) {
      for (const a of raw) {
        const phone = String(a?.phone || "").replace(/\D/g, "");
        if (phone) m.set(phone, { ...a, phone });
      }
    }
  } catch {
    // A malformed registry must not take the agent down, and must not silently become
    // "this is a cold lead with no history" either — that is why loadError() exists.
  }
  cache = m;
  return m;
}

export function getAccount(phone: string): Account | undefined {
  return load().get(String(phone || "").replace(/\D/g, ""));
}

export function count(): number {
  return load().size;
}

/** Non-empty when ACCOUNTS_JSON is set but unparseable — surfaced by /health so a typo in the
 *  registry cannot quietly downgrade every expansion conversation into a cold pitch. */
export function loadError(): string {
  if (!cfg.accountsJson || cfg.accountsJson.trim() === "[]") return "";
  try {
    const raw = JSON.parse(cfg.accountsJson);
    return Array.isArray(raw) ? "" : "ACCOUNTS_JSON must be a JSON array";
  } catch (e) {
    return `ACCOUNTS_JSON is not valid JSON: ${(e as Error).message}`;
  }
}

/** The account block injected into the system prompt. Only facts that EXIST are emitted, each
 *  labelled, so the model can restate them as known — and cannot pad the gaps. */
export function accountBlock(phone: string): string {
  const a = getAccount(phone);
  if (!a) return "";
  const line = (label: string, v?: string | number | string[]) => {
    if (v === undefined || v === null) return "";
    const s = Array.isArray(v) ? v.join("، ") : String(v);
    return s.trim() ? `- ${label}: ${s}` : "";
  };
  const facts = [
    line("اسم الجهة", a.customerName),
    line("نوع الجهة", a.customerType),
    line("الخدمات المستخدمة حاليًا", a.currentProducts),
    line("حجم العمليات المقاس", a.transactionVolume),
    line("مستوى الاستخدام", a.usageLevel),
    line("عدد الفروع", a.branches),
    line("نظام الـHIS", a.hisName),
    line("بنية الـHIS", a.hisArchitecture),
    line("حالة التكامل", a.integrationStatus),
    line("ما زال يدويًا", a.manualUsage),
    line("التسعير المعتمد لهذا الحساب", a.pricing),
    line("حالة العقد", a.contractStatus),
    line("صاحب القرار", a.decisionMaker),
    line("خدمات مجاورة ذات صلة", a.adjacentProducts),
    line("ملاحظات تقنية", a.technicalNotes),
  ].filter(Boolean);
  if (!facts.length) return "";
  return [
    "# ٠) ملف الحساب — حقائق معروفة، لا تسأل عنها",
    "هذه الحقائق مؤكدة لدينا. استخدمها في كلامك واذكرها كمعطى معروف، ولا تطلب من العميل تأكيدها.",
    ...facts,
    "ما لم يُذكر أعلاه فهو غير معروف: اسأل عنه عند الحاجة، ولا تفترضه ولا تقدّره.",
    a.approvedDiscountRange
      ? "ملاحظة داخلية (لا تُذكر للعميل بأي صيغة): هامش الخصم المعتمد محدود، ولا تعلن رقم خصم — استخدم مسار التأهيل التجاري."
      : "",
  ].filter(Boolean).join("\n");
}
