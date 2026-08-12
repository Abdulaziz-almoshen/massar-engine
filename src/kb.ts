import OpenAI from "openai";
import { cfg } from "./config.js";
import * as db from "./db.js";
import { PDFParse } from "pdf-parse";
import { toMarkdownBytes } from "@firecrawl/anydoc";

// ---------------------------------------------------------------------------
// Product Hub pipeline: uploaded sales pitch-deck PDF → text → LLM extraction →
// agent-readable Markdown, saved per product in Postgres. The agent's system
// prompt includes hub entries; the portal renders them for humans.
// ---------------------------------------------------------------------------

const client = new OpenAI({ apiKey: cfg.openaiKey });

const EXTRACT_SYSTEM = [
  "أنت محلل معرفة منتجات في شركة لِين لخدمات الأعمال. ستستلم محتوى عرض تقديمي بيعي (Sales Pitch Deck) مستخرجًا كنص/Markdown من ملف PDF أو Word أو PowerPoint. تجاهل أخطاء تقطيع الحروف العربية الناتجة عن الاستخراج.",
  "مهمتك: استخراج كل المعرفة البيعية وتنظيمها كملف Markdown يقرأه مساعد مبيعات آلي.",
  "قواعد صارمة:",
  "- استخرج فقط ما ورد في النص. لا تخترع أسعارًا أو أرقامًا أو وعودًا غير مذكورة.",
  "- إن غاب قسم، اكتب تحته: (غير مذكور في الملف).",
  "- اكتب بالعربية الفصحى المبسطة. اجعل كل نقطة قصيرة وقابلة للاستخدام في محادثة واتساب.",
  "- نظّف اسم المنتج والنصوص من آثار الاستخراج: بادئات/حروف مقطوعة (مثل «لِ» منفصلة عن «لِين»)، ترتيب علامات النسبة المئوية، وتشوهات الاتجاه.",
  "- عروض لِين الرسمية تأتي غالبًا بثمانية أقسام: الغلاف، الملخص التنفيذي، فهم المتطلبات، الحل المقترح، نتائج مثبتة، الملف التعريفي للشركة، العرض التجاري وجدول الكميات، الشكر والختام. خرّطها هكذا: الحل المقترح → نظرة عامة + القيمة؛ فهم المتطلبات → العملاء المستهدفون وسياقهم؛ العرض التجاري وجدول الكميات → التسعير والباقات (انقل الأرقام حرفيًا)؛ نتائج مثبتة + الملف التعريفي → نقاط تميز تنافسية ومعلومات إضافية. تجاهل الغلاف والشكر.",
  "أعد JSON فقط بالشكل: {\"product\": \"<اسم المنتج كما ورد>\", \"md\": \"<الملف>\"}",
  "بنية md المطلوبة حرفيًا:",
  "# <اسم المنتج>",
  "## نظرة عامة",
  "## القيمة والفوائد (نقاط)",
  "## العملاء المستهدفون",
  "## التسعير والباقات (فقط المذكور نصًا)",
  "## الأسئلة المتوقعة وإجاباتها",
  "## الاعتراضات والردود",
  "## نقاط تميز تنافسية",
  "## معلومات إضافية (أرقام، مراجع، شهادات، تكاملات)",
].join("\n");

/** Primary: Firecrawl AnyDoc (user directive, Aug 11) — 14 formats → GFM markdown,
 *  format auto-detected from content. Fallback for PDFs: pdf-parse (proven path). */
export async function extractDocText(buffer: Buffer, filename: string): Promise<{ text: string; via: string }> {
  try {
    const md = await toMarkdownBytes(new Uint8Array(buffer));
    if (md && md.trim().length >= 80) return { text: md.trim(), via: "anydoc" };
    throw new Error("anydoc returned too little text");
  } catch (e) {
    if (!/\.pdf$/i.test(filename)) throw e;
    console.error(JSON.stringify({ at: "kb", msg: "anydoc failed — pdf-parse fallback", err: String(e).slice(0, 200) }));
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return { text: String(result.text || "").trim(), via: "pdf-parse" };
    } finally {
      await parser.destroy().catch(() => {});
    }
  }
}

export async function processDeck(buffer: Buffer, filename: string, productOverride?: string):
  Promise<{ product: string; md: string; chars: number }> {
  const { text, via } = await extractDocText(buffer, filename);
  if (text.length < 80) throw new Error("document text too short — is this a scanned/image-only file?");
  console.log(JSON.stringify({ at: "kb", msg: "text extracted", via, chars: text.length, filename }));
  const clipped = text.slice(0, 60_000);

  const completion = await client.chat.completions.create({
    model: cfg.openaiModel || "gpt-5.6-terra",
    messages: [
      { role: "system", content: EXTRACT_SYSTEM },
      { role: "user", content: `اسم الملف: ${filename}\n\n--- نص العرض ---\n${clipped}` },
    ],
    response_format: { type: "json_object" },
    ...( (cfg.openaiModel || "gpt-5.6-terra").startsWith("gpt-5") ? { reasoning_effort: "none" } : {} ),
  } as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming);

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let parsed: { product?: string; md?: string } = {};
  try { parsed = JSON.parse(raw); } catch { throw new Error("extraction did not return valid JSON"); }
  const product = (productOverride || parsed.product || "").trim();
  const md = (parsed.md || "").trim();
  if (!product || !md) throw new Error("extraction returned empty product/md");

  await db.saveKb(product, md, filename);
  console.log(JSON.stringify({ at: "kb", msg: "deck processed", product, filename, mdChars: md.length }));
  return { product, md, chars: md.length };
}
