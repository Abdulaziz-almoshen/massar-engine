import { describe, expect, it } from "vitest";
import {
  accuracyRate, assembleKb, checkSectionDraft, confidenceRate, handoffForAnswer, KB_SECTIONS, KNOWLEDGE_DOMAIN_JS, parseKbSections,
  scoreKnowledge, sectionKeyOf,
} from "../src/knowledge-domain.js";

const long = (n: number) => "نص ".repeat(n);

describe("sections (BR-KB-001)", () => {
  it("weights sum to 100", () => { expect(KB_SECTIONS.reduce((a, s) => a + s.weight, 0)).toBe(100); });
  it("reads the headings kb.ts has always asked for", () => {
    expect(sectionKeyOf("## القيمة والفوائد (نقاط)")).toBe("value");
    expect(sectionKeyOf("التسعير والباقات (فقط المذكور نصًا)")).toBe("pricing");
    expect(sectionKeyOf("نقاط تميز تنافسية")).toBe("competitors");
    expect(sectionKeyOf("الأسئلة المتوقعة وإجاباتها")).toBe("faq");
    expect(sectionKeyOf("العملاء المستهدفون وسياقهم")).toBe("audience");
    expect(sectionKeyOf("معلومات إضافية (أرقام، مراجع)")).toBe("");
  });
  it("parses sections, keeps unknown ones as extra, ignores the title", () => {
    const p = parseKbSections("# منتج\nمقدمة\n## نظرة عامة\nأ\n## حالات عملاء\nب\n## معلومات إضافية (أرقام)\nج\n## نظرة عامة\nد");
    expect(p.sections).toEqual({ overview: "أ\nد" });
    expect(p.extra).toBe("مقدمة\n### حالات عملاء\nب\nج");
  });
  it("never drops a block under a first-level heading", () => {
    const p = parseKbSections("# م\n## نظرة عامة\nأ\n# ملحق\nنص تحت عنوان مستوى أول");
    expect(p.extra).toBe("### ملحق\nنص تحت عنوان مستوى أول");
  });
});

describe("scoreKnowledge (BR-KB-002/003)", () => {
  it("an extracted document with placeholders scores only what it says", () => {
    const md = ["# م", "## نظرة عامة", long(30), "## القيمة والفوائد", long(30), "## العملاء المستهدفون", "(غير مذكور في الملف)",
      "## التسعير والباقات", "1000 ريال سنويًا للباقة", "## الأسئلة المتوقعة وإجاباتها", "س: كم؟ ج: قليل", "## الاعتراضات والردود", long(40)].join("\n");
    const s = scoreKnowledge(md);
    // overview 10 + value 15 + pricing 15 + objections 15 + faq short 7.5 = 62.5 → 63
    expect(s.score).toBe(63);
    expect(s.ready).toBe(true);
    expect(s.missing.map((m) => [m.key, m.state])).toEqual([["audience", "missing"], ["competitors", "missing"], ["guardrails", "missing"], ["faq", "short"]]);
  });
  it("empty is zero and not ready; a document past the prompt limit says so", () => {
    expect(scoreKnowledge("").score).toBe(0);
    expect(scoreKnowledge("# م\n## نظرة عامة\n" + "x".repeat(6100)).truncated).toBe(true);
  });
  it("a fully written document scores 100", () => {
    const secs: Record<string, string> = {};
    KB_SECTIONS.forEach((d) => { secs[d.key] = long(60); });
    expect(scoreKnowledge(assembleKb("منتج", secs, "")).score).toBe(100);
  });
});

describe("the section editor", () => {
  it("assembles in the BRD order and round-trips through the parser", () => {
    const md = assembleKb("الإجازات المرضية", { pricing: "سعر", overview: "نظرة", guardrails: "" }, "### مراجع\nرابط");
    expect(md).toBe("# الإجازات المرضية\n\n## نظرة عامة\nنظرة\n\n## التسعير\nسعر\n\n## معلومات إضافية\n### مراجع\nرابط\n");
    const back = parseKbSections(md);
    expect(back.sections).toEqual({ overview: "نظرة", pricing: "سعر" });
    expect(back.extra).toBe("### مراجع\nرابط");
  });
  it("refuses unknown sections, headings inside a section, an empty draft, oversize text", () => {
    expect(checkSectionDraft({ sections: { nope: "x" } })).toMatchObject({ ok: false, field: "sections" });
    expect(checkSectionDraft({ sections: { faq: "## عنوان" } })).toMatchObject({ ok: false, field: "sections.faq" });
    expect(checkSectionDraft({ sections: { faq: "(غير مذكور في الملف)" } })).toMatchObject({ ok: false, field: "sections" });
    expect(checkSectionDraft({ sections: { faq: "x".repeat(6001) } })).toMatchObject({ ok: false, field: "sections.faq" });
    expect(checkSectionDraft({ sections: { faq: "\u200f## مخفي" } })).toMatchObject({ ok: false, field: "sections.faq" });
    expect(checkSectionDraft({ sections: { faq: "### هل يتكامل؟\nنعم\n#وسم" } })).toMatchObject({ ok: true });
    expect(checkSectionDraft({ sections: { faq: 3 } })).toMatchObject({ ok: false, field: "sections.faq" });
    expect(checkSectionDraft({ sections: { faq: " س ج " }, extra: "" })).toEqual({ ok: true, sections: { overview: "", value: "", audience: "", pricing: "", competitors: "", faq: "س ج", objections: "", guardrails: "" }, extra: "" });
  });
});

describe("answers (BR-KB-004/005, BR-MON-005)", () => {
  it("low confidence, or a product question answered from nothing, goes to a person", () => {
    expect(handoffForAnswer({ confidence: "low", basis: "approved_knowledge", productQuestion: true })).toBe("ثقة منخفضة في الإجابة");
    expect(handoffForAnswer({ confidence: "high", basis: "none", productQuestion: true })).toBe("سؤال خارج المعرفة المعتمدة");
    expect(handoffForAnswer({ confidence: "medium", basis: "none", productQuestion: false })).toBeNull();
    expect(handoffForAnswer({ confidence: "low", basis: "conversation", productQuestion: false })).toBeNull();
    expect(handoffForAnswer({ confidence: "high", basis: "approved_knowledge", productQuestion: true })).toBeNull();
  });
  it("rates over nothing are null", () => {
    expect(confidenceRate({ high: 3, medium: 1, low: 1 })).toBe(80);
    expect(confidenceRate({ high: 0, medium: 0, low: 0 })).toBeNull();
    expect(accuracyRate({ correct: 9, wrong: 1 })).toBe(90);
    expect(accuracyRate({ correct: 0, wrong: 0 })).toBeNull();
  });
  it("the page runs the same rules", () => {
    const page = new Function(KNOWLEDGE_DOMAIN_JS + "; return { scoreKnowledge, assembleKb };")();
    const md = "# م\n## نظرة عامة\n" + long(30) + "\n## الضوابط\nلا وعود بمواعيد تنفيذ دون موظف";
    expect(page.scoreKnowledge(md)).toEqual(scoreKnowledge(md));
  });
});
