// knowledge-domain.ts — product knowledge as SECTIONS with weights, a completeness score, and what is missing
// (client A, BRD v1.0 §11 BR-KB-001..005, slice S6); and the rule that turns an answer's stated basis into a
// handoff (BR-KB-005).
//
// Until this slice a product's knowledge was one markdown document: approved or not. The BRD asks for the
// document to be organised into eight sections (overview, value, target customers, pricing, competitors, FAQ,
// objections, guardrails), for a readiness score from weighted sections, and for the missing items that lower
// it to be shown. The document stays the single stored form — the assistant reads it whole, the approval
// hashes it — and this module reads the sections OUT of it, so an uploaded deck and a hand-edited draft are
// scored by one rule.
//
// PURE. The functions in DOMAIN_FNS are serialised into the page (the section editor scores a draft as it is
// typed), so they reference only their parameters and the injected constants.

// ---------------------------------------------------------------------------------------- sections

export type KbSectionDef = { key: string; label: string; weight: number; min: number; aliases: string[]; hint: string };

/** BR-KB-001's eight, in the BRD's order. Weights sum to 100. `min` is the characters below which a section is
 *  «قصير» (half its weight): a pricing line can be short, an FAQ with one question is not an FAQ. The aliases
 *  include the headings kb.ts has always asked the extraction model for, so every document already stored
 *  scores without being rewritten. */
export const KB_SECTIONS: readonly KbSectionDef[] = [
  { key: "overview", label: "نظرة عامة", weight: 10, min: 60, aliases: ["نظرة عامة", "النظرة العامة", "overview"], hint: "ما المنتج، في جملتين أو ثلاث." },
  { key: "value", label: "القيمة المقدمة", weight: 15, min: 60, aliases: ["القيمة المقدمة", "القيمة والفوائد", "القيمة", "الفوائد", "value"], hint: "ماذا يكسب العميل: وقت، تكلفة، امتثال — بأرقام إن وُجدت." },
  { key: "audience", label: "العملاء المستهدفون", weight: 10, min: 30, aliases: ["العملاء المستهدفون", "العملاء المستهدفين", "الفئة المستهدفة", "الشرائح المستهدفة", "audience"], hint: "من يشتري: نوع المنشأة وحجمها ومن يقرر." },
  { key: "pricing", label: "التسعير", weight: 15, min: 20, aliases: ["التسعير", "التسعير والباقات", "الأسعار", "الباقات", "pricing"], hint: "الأسعار والباقات التي يُسمح للمساعد بذكرها، حرفيًا." },
  { key: "competitors", label: "المنافسون", weight: 10, min: 40, aliases: ["المنافسون", "المنافسين", "نقاط تميز تنافسية", "التميز التنافسي", "competitors"], hint: "البدائل التي يقارن بها العميل، وبماذا نتميز عنها." },
  { key: "faq", label: "الأسئلة الشائعة", weight: 15, min: 80, aliases: ["الأسئلة الشائعة", "الأسئلة المتوقعة وإجاباتها", "الأسئلة المتوقعة", "faq"], hint: "سؤال وجوابه في كل سطر." },
  { key: "objections", label: "الاعتراضات", weight: 15, min: 80, aliases: ["الاعتراضات والردود", "الاعتراضات", "objections"], hint: "الاعتراض وردّه في كل سطر." },
  { key: "guardrails", label: "الضوابط", weight: 10, min: 30, aliases: ["الضوابط", "ضوابط الإجابة", "حدود الإجابة", "ما لا يقوله المساعد", "guardrails"], hint: "ما لا يقوله المساعد ولا يعد به، ومتى يحوّل لموظف." },
];

/** The advisory readiness line (DEC-13). Below it the product record says the knowledge is too thin to sell
 *  from; it does not block a launch — eligibility stays the approval rule until client A sets a threshold. */
export const KB_READY_MIN = 60;
/** The assistant's prompt carries at most this many characters of one product's approved document
 *  (agent.ts). A document longer than this is cut silently there; here it is said out loud. */
export const KB_PROMPT_CHARS = 6000;
export const KB_SECTION_MAX = 6000;
export const KB_EXTRA_LABEL = "معلومات إضافية";

// ---------------------------------------------------------------------------------------- reading

export type KbSectionState = "done" | "short" | "missing";
export type KbSectionRead = { key: string; label: string; weight: number; state: KbSectionState; chars: number; text: string };
export type KbScore = { score: number; ready: boolean; sections: KbSectionRead[]; missing: { key: string; label: string; state: KbSectionState; weight: number }[];
  extra: string; chars: number; truncated: boolean };

/** Heading text reduced to what identifies it: no «#», no parenthetical note, no diacritics or tatweel, one space. */
export function normalizeHeading(h: unknown): string {
  return String(h == null ? "" : h).replace(/^#+/, "").replace(/\([^)]*\)/g, "").replace(/[ً-ْـ]/g, "")
    .replace(/[:：]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** Which of the eight a heading names, or "" for anything else (kept as «معلومات إضافية»). */
export function sectionKeyOf(heading: unknown): string {
  var h = normalizeHeading(heading);
  if (!h) return "";
  for (var i = 0; i < KB_SECTIONS.length; i++) {
    var al = KB_SECTIONS[i].aliases;
    for (var j = 0; j < al.length; j++) {
      var a = normalizeHeading(al[j]);
      if (h === a || h.indexOf(a + " ") === 0 || h.indexOf(a + "،") === 0 || h.indexOf(a + " و") === 0) return KB_SECTIONS[i].key;
    }
  }
  return "";
}

/** Text that says nothing: the extraction model's «(غير مذكور في الملف)» and its variants, dashes, blank bullets. */
export function meaningfulText(text: unknown): string {
  return String(text == null ? "" : text).split(/\r?\n/).map(function (l) {
    return l.replace(/\(?\s*غير مذكور[^)\n]*\)?/g, "").replace(/^[\s\-*•·–—]+$/, "").trim();
  }).filter(function (l) { return l !== ""; }).join("\n");
}

/** Reads the eight sections out of a knowledge document. Nothing is dropped: a preface before the first «##»
 *  and any block under a «#» heading other than the opening product title go to the extra text, so saving from
 *  the editor never deletes what an uploaded document said (S6 review). A heading that repeats appends. */
export function parseKbSections(md: unknown): { sections: Record<string, string>; extra: string } {
  var lines = String(md == null ? "" : md).split(/\r?\n/);
  var sections: Record<string, string> = {};
  var extra: string[] = [];
  var cur: string | null = "__extra", curExtraHeading = "", sawTitle = false;
  for (var i = 0; i < lines.length; i++) {
    var m = /^\s*##\s+(.+?)\s*$/.exec(lines[i]);
    if (m) {
      var key = sectionKeyOf(m[1]);
      if (key) { cur = key; if (sections[key] == null) sections[key] = ""; }
      else { cur = "__extra"; curExtraHeading = m[1]; if (normalizeHeading(curExtraHeading) !== normalizeHeading(KB_EXTRA_LABEL)) extra.push("### " + curExtraHeading); }
      continue;
    }
    var t1 = /^\s*#\s+(.+?)\s*$/.exec(lines[i]);
    if (t1 && !/^\s*##/.test(lines[i])) {
      // The first «#» before any section is the product's own title: assembleKb writes it back.
      if (!sawTitle && cur === "__extra" && !extra.join("").trim()) { sawTitle = true; continue; }
      cur = "__extra"; extra.push("### " + t1[1]); continue;
    }
    if (cur === "__extra") extra.push(lines[i]);
    else sections[cur] = sections[cur] ? sections[cur] + "\n" + lines[i] : lines[i];
  }
  for (var k in sections) sections[k] = sections[k].replace(/^\s+|\s+$/g, "");
  return { sections: sections, extra: extra.join("\n").replace(/^\s+|\s+$/g, "") };
}

/** BR-KB-002/003: the weighted score and the sections that hold it down. A section below its minimum counts
 *  half; an empty or placeholder-only one counts nothing. */
export function scoreKnowledge(md: unknown): KbScore {
  var text = String(md == null ? "" : md);
  var parsed = parseKbSections(text);
  var total = 0, got = 0;
  var sections: KbSectionRead[] = [];
  var missing: { key: string; label: string; state: KbSectionState; weight: number }[] = [];
  for (var i = 0; i < KB_SECTIONS.length; i++) {
    var d = KB_SECTIONS[i];
    var body = meaningfulText(parsed.sections[d.key] || "");
    var chars = body.replace(/\s+/g, "").length;
    var state: KbSectionState = chars === 0 ? "missing" : chars < d.min ? "short" : "done";
    total += d.weight;
    if (state === "done") got += d.weight; else if (state === "short") got += d.weight / 2;
    sections.push({ key: d.key, label: d.label, weight: d.weight, state: state, chars: chars, text: parsed.sections[d.key] || "" });
    if (state !== "done") missing.push({ key: d.key, label: d.label, state: state, weight: d.weight });
  }
  var score = total ? Math.round((got / total) * 100) : 0;
  // The biggest gaps first: a missing 15-point section matters more than a short 10-point one.
  missing.sort(function (a, b) { var wa = a.state === "missing" ? a.weight : a.weight / 2, wb = b.state === "missing" ? b.weight : b.weight / 2; return wb - wa; });
  return { score: score, ready: score >= KB_READY_MIN, sections: sections, missing: missing, extra: parsed.extra, chars: text.length, truncated: text.length > KB_PROMPT_CHARS };
}

// ---------------------------------------------------------------------------------------- writing

/** A draft typed section by section, as the one document the assistant and the approval read. Sections in the
 *  BRD's order, empty ones left out, anything else under «معلومات إضافية». */
export function assembleKb(product: string, sections: Record<string, unknown>, extra: unknown): string {
  var out = ["# " + String(product || "").trim()];
  for (var i = 0; i < KB_SECTIONS.length; i++) {
    var body = String(sections[KB_SECTIONS[i].key] == null ? "" : sections[KB_SECTIONS[i].key]).replace(/^\s+|\s+$/g, "");
    if (body) out.push("", "## " + KB_SECTIONS[i].label, body);
  }
  var ex = String(extra == null ? "" : extra).replace(/^\s+|\s+$/g, "");
  if (ex) out.push("", "## " + KB_EXTRA_LABEL, ex);
  return out.join("\n") + "\n";
}

/** The section editor's input. Every section a string within its bound; at least one says something. */
export function checkSectionDraft(input: { sections?: unknown; extra?: unknown }): { ok: true; sections: Record<string, string>; extra: string } | { ok: false; field: string; reason: string } {
  var src = input && typeof input.sections === "object" && input.sections !== null && !Array.isArray(input.sections) ? input.sections as Record<string, unknown> : null;
  if (!src) return { ok: false, field: "sections", reason: "لا أقسام في الطلب" };
  var out: Record<string, string> = {};
  var any = false;
  for (var i = 0; i < KB_SECTIONS.length; i++) {
    var k = KB_SECTIONS[i].key, v = src[k];
    if (v != null && typeof v !== "string") return { ok: false, field: "sections." + k, reason: "نص القسم غير صالح" };
    var s = String(v == null ? "" : v).replace(/^\s+|\s+$/g, "");
    if (s.length > KB_SECTION_MAX) return { ok: false, field: "sections." + k, reason: "«" + KB_SECTIONS[i].label + "» أطول من " + KB_SECTION_MAX + " حرف" };
    if (/^[\s\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]*#{1,2}(\s|$)/m.test(s)) return { ok: false, field: "sections." + k, reason: "لا تبدأ سطرًا بـ# أو ## داخل القسم — عناوين الأقسام تُضاف تلقائيًا، وللعناوين الفرعية استخدم ###" };
    if (meaningfulText(s)) any = true;
    out[k] = s;
  }
  for (var key in src) {
    var known = false;
    for (var j = 0; j < KB_SECTIONS.length; j++) if (KB_SECTIONS[j].key === key) known = true;
    if (!known) return { ok: false, field: "sections", reason: "قسم غير معروف: " + key };
  }
  var extra = input.extra == null ? "" : input.extra;
  if (typeof extra !== "string") return { ok: false, field: "extra", reason: "نص المعلومات الإضافية غير صالح" };
  if (extra.length > KB_SECTION_MAX) return { ok: false, field: "extra", reason: "«" + KB_EXTRA_LABEL + "» أطول من " + KB_SECTION_MAX + " حرف" };
  if (/^[\s\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]*#{1,2}(\s|$)/m.test(extra)) return { ok: false, field: "extra", reason: "استخدم ### للعناوين الفرعية داخل المعلومات الإضافية" };
  if (!any) return { ok: false, field: "sections", reason: "اكتب قسمًا واحدًا على الأقل" };
  return { ok: true, sections: out, extra: extra.replace(/^\s+|\s+$/g, "") };
}

// ---------------------------------------------------------------------------------------- answers

/** What the assistant says an answer rests on (BR-KB-004, BR-MON-005). */
export const ANSWER_BASES = ["approved_knowledge", "catalogue", "conversation", "none"] as const;
export type AnswerBasis = (typeof ANSWER_BASES)[number];
export const ANSWER_CONFIDENCE = ["high", "medium", "low"] as const;
export type AnswerConfidence = (typeof ANSWER_CONFIDENCE)[number];
export const ANSWER_CONFIDENCE_LABELS: Readonly<Record<AnswerConfidence, string>> = { high: "مرتفعة", medium: "متوسطة", low: "منخفضة" };

/**
 * BR-KB-005, decided in code rather than trusted to the prompt: an answer the assistant itself rates low, or
 * that rests on nothing it was given, goes to a person. A product question answered from «none» is exactly the
 * invented answer BR-KB-004 forbids; the handoff is how the conversation recovers from it.
 */
export function handoffForAnswer(a: { confidence: unknown; basis: unknown; productQuestion: unknown }): string | null {
  var c = String(a.confidence || ""), b = String(a.basis || "");
  // Only for questions about the product: a low self-rating on small talk or a greeting must not page a rep (S6 review).
  if (a.productQuestion !== true) return null;
  if (b === "none") return "سؤال خارج المعرفة المعتمدة";
  if (c === "low") return "ثقة منخفضة في الإجابة";
  return null;
}

/** «الثقة في الإجابات» (§23): the share of rated answers the assistant rated high or medium. Null over nothing. */
export function confidenceRate(counts: { high: number; medium: number; low: number }): number | null {
  var n = (Number(counts.high) || 0) + (Number(counts.medium) || 0) + (Number(counts.low) || 0);
  return n > 0 ? Math.round((((Number(counts.high) || 0) + (Number(counts.medium) || 0)) / n) * 100) : null;
}

/** «دقة الإجابات» (BR-MON-005): answers a reviewer marked correct ÷ answers a reviewer marked at all. */
export function accuracyRate(counts: { correct: number; wrong: number }): number | null {
  var n = (Number(counts.correct) || 0) + (Number(counts.wrong) || 0);
  return n > 0 ? Math.round(((Number(counts.correct) || 0) / n) * 100) : null;
}

// ---------------------------------------------------------------------------------------- the seam

const DOMAIN_FNS = [normalizeHeading, sectionKeyOf, meaningfulText, parseKbSections, scoreKnowledge, assembleKb, checkSectionDraft, confidenceRate, accuracyRate] as const;

export const KNOWLEDGE_DOMAIN_JS: string = [
  "/* ===== knowledge-domain (generated from src/knowledge-domain.ts — do not edit here) ===== */",
  "var KB_SECTIONS = " + JSON.stringify(KB_SECTIONS) + ";",
  "var KB_READY_MIN = " + KB_READY_MIN + ";",
  "var KB_PROMPT_CHARS = " + KB_PROMPT_CHARS + ";",
  "var KB_SECTION_MAX = " + KB_SECTION_MAX + ";",
  "var KB_EXTRA_LABEL = " + JSON.stringify(KB_EXTRA_LABEL) + ";",
  "var ANSWER_CONFIDENCE_LABELS = " + JSON.stringify(ANSWER_CONFIDENCE_LABELS) + ";",
  ...DOMAIN_FNS.map((fn) => fn.toString()),
].join("\n");
