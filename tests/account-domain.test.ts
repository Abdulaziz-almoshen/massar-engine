import { describe, expect, it } from "vitest";
import { CONFIG_DOMAIN_JS, isEmailShaped } from "../src/config-domain.js";
import {
  ACCOUNT_DOMAIN_JS, accountFieldsFromAttrs, accountMatches, checkAccount, checkAccountDomainClosure, checkApproval,
  phoneDigits, productStatusOf, summarizeAccountOpps,
} from "../src/account-domain.js";

const good = {
  name: "مستشفى الرعاية", city: "الرياض", sector: "رعاية صحية", importance: "high", ownerId: 3, phone: "0551234567",
  contacts: [{ name: "م. فهد", role: "مدير تقنية المعلومات", phone: "0551234567", email: "f@x.sa" }],
};

describe("checkAccount (BR-CUS-001/002)", () => {
  it("accepts a complete account and marks the first contact primary", () => {
    const r = checkAccount(good, [3, 4], false);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.contacts[0].primary).toBe(true);
    expect(r.value.phone).toBe("0551234567");
    expect(r.value.importance).toBe("high");
  });
  it("requires name, city, phone and a named contact, in that order", () => {
    expect(checkAccount({ ...good, name: " " }, [3], false)).toMatchObject({ ok: false, field: "name" });
    expect(checkAccount({ ...good, city: "" }, [3], false)).toMatchObject({ ok: false, field: "city" });
    expect(checkAccount({ ...good, phone: "" }, [3], false)).toMatchObject({ ok: false, field: "phone" });
    expect(checkAccount({ ...good, contacts: [{ name: "", role: "", phone: "", email: "" }] }, [3], false)).toMatchObject({ ok: false, field: "contacts" });
  });
  it("a contact row with anything in it needs a name; empty rows are ignored", () => {
    const r = checkAccount({ ...good, contacts: [{ name: "أ. ريم" }, {}, { role: "مديرة المشتريات" }] }, [3], false);
    expect(r).toMatchObject({ ok: false, field: "contacts.2.name" });
  });
  it("refuses an owner outside the active team and a bad importance", () => {
    expect(checkAccount({ ...good, ownerId: 9 }, [3], false)).toMatchObject({ ok: false, field: "ownerId" });
    expect(checkAccount({ ...good, importance: "urgent" }, [3], false)).toMatchObject({ ok: false, field: "importance" });
    expect(checkAccount({ ...good, ownerId: "" }, [], false)).toMatchObject({ ok: true });
  });
  it("keeps exactly one primary: the first one marked", () => {
    const r = checkAccount({ ...good, contacts: [{ name: "أ" }, { name: "ب", primary: true }, { name: "ج", primary: true }] }, [3], false);
    expect(r.ok && r.value.contacts.map((c) => c.primary)).toEqual([false, true, false]);
  });
  it("refuses duplicate contact phones, bad phones and bad emails", () => {
    expect(checkAccount({ ...good, contacts: [{ name: "أ", phone: "0551" }] }, [3], false)).toMatchObject({ field: "contacts.0.phone" });
    expect(checkAccount({ ...good, contacts: [{ name: "أ", phone: "0551111111" }, { name: "ب", phone: "٠٥٥١١١١١١١" }] }, [3], false)).toMatchObject({ field: "contacts.1.phone" });
    expect(checkAccount({ ...good, contacts: [{ name: "أ", email: "f@x" }] }, [3], false)).toMatchObject({ field: "contacts.0.email" });
  });
  it("an edit does not ask for the phone: it is the account's identity", () => {
    expect(checkAccount({ ...good, phone: "" }, [3], true)).toMatchObject({ ok: true });
  });
  it("runs identically in the page", () => {
    expect(checkAccountDomainClosure()).toEqual([]);
    const page = new Function(CONFIG_DOMAIN_JS + "\n" + ACCOUNT_DOMAIN_JS + "; return { checkAccount, accountMatches, productStatusOf };")();
    expect(page.checkAccount({ ...good, city: "" }, [3], false)).toEqual(checkAccount({ ...good, city: "" }, [3], false));
    expect(page.checkAccount(good, [3], false)).toEqual(checkAccount(good, [3], false));
  });
});

describe("small rules", () => {
  it("contact email agrees with the team directory's rule on every sample", () => {
    for (const e of ["a.b@lean.sa", "x@mail.lean.com.sa", "a@b@c.sa", "a @b.sa", "f@x", "@x.sa", "x@.sa", "x@sa.", "ريم@lean.sa"]) {
      const r = checkAccount({ ...good, contacts: [{ name: "أ", email: e }] }, [3], false);
      expect(r.ok, e).toBe(isEmailShaped(e));
    }
  });
  it("reads Arabic-Indic digits", () => { expect(phoneDigits("+٩٦٦ ٥٥ 123")).toBe("96655123"); });
  it("approval refuses no-ops and unknown decisions", () => {
    expect(checkApproval("proposed", "approved")).toEqual({ ok: true, value: "approved" });
    expect(checkApproval("approved", "approved")).toMatchObject({ ok: false });
    expect(checkApproval("approved", "maybe")).toMatchObject({ ok: false });
  });
});

describe("accountMatches (BR-CUS-003)", () => {
  const row = { id: 7, name: "جامعة الملك سعود", phone: "966114670001", city: "الرياض", sector: "القطاع التعليمي", importance: "medium",
    ownerId: 4, approval: "proposed", products: ["الإجازات المرضية"], contactText: "د. سعد الدوسري s@ksu.edu.sa" };
  it("«الكل» hides rejected; each tab is its own state", () => {
    expect(accountMatches(row, { tab: "all" })).toBe(true);
    expect(accountMatches({ ...row, approval: "rejected" }, { tab: "all" })).toBe(false);
    expect(accountMatches(row, { tab: "approved" })).toBe(false);
    expect(accountMatches(row, { tab: "proposed" })).toBe(true);
  });
  it("filters by product, sector, city, importance, owner and indicator", () => {
    expect(accountMatches(row, { product: "التقارير الطبية" })).toBe(false);
    expect(accountMatches(row, { sector: "القطاع التعليمي", city: "الرياض", importance: "medium", owner: "4" })).toBe(true);
    expect(accountMatches(row, { owner: "none" })).toBe(false);
    expect(accountMatches({ ...row, ownerId: null }, { owner: "none" })).toBe(true);
    expect(accountMatches(row, { inIndicator: { "8": 1 } })).toBe(false);
    expect(accountMatches(row, { inIndicator: { "7": 1 } })).toBe(true);
  });
  it("search reaches contacts and phone digits", () => {
    expect(accountMatches(row, { q: "الدوسري" })).toBe(true);
    expect(accountMatches(row, { q: "4670" })).toBe(true);
    expect(accountMatches(row, { q: "المراعي" })).toBe(false);
  });
});

describe("products and opportunities", () => {
  const lines = [
    { product: "أ", stage: "won" }, { product: "أ", stage: "contact" },
    { product: "ب", stage: "discovery" }, { product: "ج", stage: "lost" },
  ];
  it("product status", () => {
    expect(productStatusOf("أ", lines)).toBe("won");
    expect(productStatusOf("ب", lines)).toBe("open");
    expect(productStatusOf("ج", lines)).toBe("lost");
    expect(productStatusOf("د", lines)).toBe("targeted");
  });
  it("summary leaves lost lines out and prices by the one value rule", () => {
    const s = summarizeAccountOpps([
      { product: "أ", stage: "won", salePrice: 1000, years: 2, quantity: 1, discountPercent: 10 },
      { product: "ب", stage: "contact", salePrice: 500, years: 1, quantity: 2, discountPercent: 0 },
      { product: "ج", stage: "lost", salePrice: 9000, years: 1, quantity: 1, discountPercent: 0 },
    ]);
    expect(s).toEqual({ count: 2, open: 1, won: 1, value: 1800 + 1000 });
  });
});

describe("accountFieldsFromAttrs (customer sheet columns)", () => {
  it("maps the prototype's template columns", () => {
    const r = accountFieldsFromAttrs({ "القطاع": "حكومي", "الأهمية": "عالية", "جهة الاتصال": "د. خالد", "المنصب": "وكيل", "البريد": "k@hrsd.gov.sa" });
    expect(r).toEqual({ sector: "حكومي", importance: "high", contact: { name: "د. خالد", role: "وكيل", phone: null, email: "k@hrsd.gov.sa", primary: true } });
  });
  it("drops an unknown importance word and a malformed email rather than guessing", () => {
    const r = accountFieldsFromAttrs({ "الأهمية": "قصوى", "جهة الاتصال": "أ", "البريد": "bad" });
    expect(r.importance).toBeNull();
    expect(r.contact?.email).toBeNull();
    expect(accountFieldsFromAttrs({}).contact).toBeNull();
  });
});
