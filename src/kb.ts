import OpenAI from "openai";
import { cfg } from "./config.js";
import * as db from "./db.js";
import { PDFParse } from "pdf-parse";

// ---------------------------------------------------------------------------
// Product Hub pipeline: uploaded sales pitch-deck PDF → text → LLM extraction →
// agent-readable Markdown, saved per product in Postgres. The agent's system
// prompt includes hub entries; the portal renders them for humans.
// ---------------------------------------------------------------------------

const client = new OpenAI({ apiKey: cfg.openaiKey });

const EXTRACT_SYSTEM = [
  "أنت محلل معرفة منتجات في شركة لِين للصحة الرقمية. ستستلم نص عرض تقديمي (Sales Pitch Deck) مستخرجًا من PDF.",
  "مهمتك: استخراج كل المعرفة البيعية وتنظيمها كملف Markdown يقرأه مساعد مبيعات آلي.",
  "قواعد صارمة:",
  "- استخرج فقط ما ورد في النص. لا تخترع أسعارًا أو أرقامًا أو وعودًا غير مذكورة.",
  "- إن غاب قسم، اكتب تحته: (غير مذكور في الملف).",
  "- اكتب بالعربية الفصحى المبسطة. اجعل كل نقطة قصيرة وقابلة للاستخدام في محادثة واتساب.",
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

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return String(result.text || "").trim();
  } finally {
    await parser.destroy().catch(() => {});
  }
}

export async function processDeck(buffer: Buffer, filename: string):
  Promise<{ product: string; md: string; chars: number }> {
  const text = await extractPdfText(buffer);
  if (text.length < 80) throw new Error("PDF text too short — is this a scanned/image-only deck?");
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
  const product = (parsed.product || "").trim();
  const md = (parsed.md || "").trim();
  if (!product || !md) throw new Error("extraction returned empty product/md");

  await db.saveKb(product, md, filename);
  console.log(JSON.stringify({ at: "kb", msg: "deck processed", product, filename, mdChars: md.length }));
  return { product, md, chars: md.length };
}
