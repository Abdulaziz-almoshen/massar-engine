import Fastify from "fastify";
import { cfg, configReport } from "./config.js";
import { DASHBOARD_HTML } from "./dashboard.js";
import * as db from "./db.js";
import * as gupshup from "./gupshup.js";
import * as tracker from "./tracker.js";
import * as agent from "./agent.js";
import { enqueue } from "./queue.js";
import * as kb from "./kb.js";
import * as audience from "./audience.js";
import * as insights from "./insights.js";
import * as segments from "./segments.js";
import { randomBytes } from "node:crypto";
import multipart from "@fastify/multipart";

const app = Fastify({ logger: false, bodyLimit: 26214400 });
await app.register(multipart, { limits: { fileSize: 25 * 1024 * 1024, files: 1 } });
const startedAt = Date.now();

function log(obj: Record<string, unknown>) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...obj }));
}

// ------------------------------ webhook ------------------------------

// Gupshup dashboard sends a GET (HEAD auto-registered by Fastify) when validating the callback URL.
app.get("/webhooks/gupshup", async () => "OK");

app.post("/webhooks/gupshup", async (req, reply) => {
  const token = (req.query as any)?.token ?? "";
  if (cfg.webhookToken && token !== cfg.webhookToken) {
    return reply.code(401).send({ status: "unauthorized" });
  }

  // Ack immediately; process async so Gupshup never times out on us.
  reply.send({ status: "ok" });

  const events = gupshup.normalizeWebhook(req.body);
  for (const ev of events) {
    if (ev.kind === "message") {
      if (!ev.from) continue;
      const contact = tracker.recordInbound(ev);
      enqueue(ev.from, () => agent.handleInbound(contact, ev.text));
    } else if (ev.kind === "status") {
      tracker.recordStatus(ev);
    } else {
      log({ at: "webhook", msg: "unhandled event type", type: ev.type });
    }
  }
});

// ------------------------------ dashboard (المنصة) ------------------------------

app.get("/dashboard", async (_req, reply) => {
  reply.type("text/html; charset=utf-8");
  return DASHBOARD_HTML;
});

// ------------------------------ health ------------------------------

app.get("/health", async () => ({
  ok: true,
  service: "massar-engine",
  uptimeSec: Math.round((Date.now() - startedAt) / 1000),
  model: agent.currentModel(),
  gupshupAppName: gupshup.appName() || "(unknown — learned from first webhook)",
  sourceNumber: gupshup.sourceNumber() || "(unset — auto-learns from v3 webhooks)",
  outbound: gupshup.outboundReady(),
  db: { enabled: db.enabled(), connected: db.isConnected(), counts: await db.counts() },
  config: configReport(),
}));

// ------------------------------ admin (token-gated) ------------------------------

function adminOk(req: any): boolean {
  return Boolean(cfg.adminToken) && req.headers["x-admin-token"] === cfg.adminToken;
}

app.get("/admin/state", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  return { ...tracker.snapshot(), notifyNumber: cfg.notifyNumber };
});

// ------------------------------ audiences (entities) ------------------------------

app.get("/admin/entities", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  return db.listEntities();
});

// Paste import: one line per entity — "name, phone[, size[, city]]" (Arabic or Latin commas/tabs).
app.post("/admin/entities", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  const { text } = (req.body ?? {}) as { text?: string };
  if (!text?.trim()) return reply.code(400).send({ error: "body: { text }" });
  const rows: { name: string; phone: string; size?: string; city?: string }[] = [];
  const bad: string[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(/[,\t،؛;]/).map((x) => x.trim()).filter(Boolean);
    const name = parts[0] ?? "";
    // Same identity rules as the file path — phone is the upsert key, so 05/Arabic-digit
    // paste lines must land on the same row a file import would create.
    const phone = audience.normalizePhone(parts[1] ?? "");
    if (!name || phone.length < 8) { bad.push(line.slice(0, 60)); continue; }
    rows.push({ name, phone, size: parts[2] || undefined, city: parts[3] || undefined });
  }
  const res = await db.addEntities(rows);
  return { ...res, invalid: bad.length, invalidLines: bad.slice(0, 5) };
});

// File import (primary onboarding): Excel/CSV upload → header auto-map → upsert by phone.
// Extra columns become segment attributes the launch picker filters on.
app.post("/admin/entities/import", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  const file = await (req as any).file();
  if (!file) return reply.code(400).send({ error: "multipart file required (.xlsx / .xls / .csv)" });
  const buf = await file.toBuffer();
  try {
    const parsed = audience.parseAudienceFile(buf, file.filename || "audience.xlsx");
    const res = await db.addEntities(parsed.rows);
    log({ at: "audience", msg: "import done", filename: file.filename, ...res, skipped_rows: parsed.skipped.length });
    return {
      ...res,
      totalRows: parsed.totalRows,
      columns: parsed.columns,
      skippedRows: parsed.skipped.slice(0, 10),
      skippedCount: parsed.skipped.length,
    };
  } catch (e) {
    return reply.code(422).send({ error: String(e instanceof Error ? e.message : e).slice(0, 300) });
  }
});

app.post("/admin/entities/delete", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  const { id } = (req.body ?? {}) as { id?: number };
  if (!id) return reply.code(400).send({ error: "body: { id }" });
  await db.deleteEntity(Number(id));
  return { status: "ok" };
});

// ------------------------------ campaign launch (human-confirmed in the UI) ------------------------------

app.post("/admin/campaign/launch", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  const { targets, message, name, product } = (req.body ?? {}) as
    { targets?: { phone: string; name?: string }[]; message?: string; name?: string; product?: string };
  if (!Array.isArray(targets) || !targets.length || !message?.trim())
    return reply.code(400).send({ error: "body: { targets: [{phone,name}], message, name?, product? }" });
  if (targets.length > 50) return reply.code(400).send({ error: "launch cap: 50 recipients per launch" });
  const campName = (name || "").trim() ||
    `حملة ${(product || "").trim() || "واتساب"} — ${new Date().toLocaleDateString("ar-SA")}`;
  const assets = await db.listAssets();
  const pa = assets.find((a) => a.product === (product || "").trim());
  const introAsset = pa ? { url: `${cfg.publicBaseUrl}/assets/${pa.public_id}.pdf`, filename: pa.filename } : null;
  // Classify at launch, when we still know WHY this went out. Hand-flagging afterwards is data
  // entry that rots: ten rehearsals had to be corrected by hand precisely because every launch
  // was born «فعلية». A launch that reaches only sandbox contacts is a rehearsal; the caller may
  // say so explicitly, and either way the flag stays editable afterwards.
  const phones = targets.map((t) => String(t.phone || "").replace(/\D/g, "")).filter(Boolean);
  const allSandbox = phones.length > 0 && phones.every((p) => Boolean(tracker.findContact(p)?.test));
  const isRehearsal = typeof (req.body as any)?.test === "boolean" ? Boolean((req.body as any).test) : allSandbox;
  const campaignId = await db.createCampaign(campName, (product || "").trim(), message, targets.map(t => ({
    phone: String(t.phone || "").replace(/\D/g, ""), name: t.name })), isRehearsal);
  const results: { phone: string; ok: boolean; error?: string }[] = [];
  for (const t of targets) {
    const phone = String(t.phone || "").replace(/\D/g, "");
    if (!phone) { results.push({ phone: String(t.phone), ok: false, error: "invalid phone" }); continue; }
    const contact = tracker.getContact(phone, t.name);
    if (contact.optedOut) { results.push({ phone, ok: false, error: "opted out — skipped" }); continue; }
    const personalized = message.replaceAll("{name}", t.name || "").replaceAll("{الاسم}", t.name || "").replace(/\s+([،.!؟])/g, "$1");
    try {
      // One bubble: opener as the document caption + reply buttons (falls back down the
      // capability ladder if the richer shapes are rejected).
      const BTNS = [{ title: "أرغب بعرض تعريفي" }, { title: "أرسلوا التفاصيل" }, { title: "ليس الآن" }];
      const btnNote = ` [أزرار: ${BTNS.map((b) => b.title).join(" | ")}]`;
      // REALITY CHECK (user's device, R32): quick_reply+document reported API success but
      // rendered as SEPARATE messages on WhatsApp. Document-with-caption is the native
      // guaranteed single bubble — that is the primary shape for asset launches now.
      const rejectedShape = (e: unknown) => /gupshup 4\d\d:/.test(String(e));
      const asset = introAsset;
      if (asset) {
        await gupshup.sendDocument(phone, asset.url, asset.filename, personalized);
        tracker.recordAgentReply(phone, `${personalized} [مرفق في نفس الرسالة: ${asset.filename}]`);
      } else {
        try {
          await gupshup.sendQuickReply(phone, personalized, BTNS);
          tracker.recordAgentReply(phone, `${personalized}${btnNote}`);
        } catch (e) {
          if (!rejectedShape(e)) throw e;
          await gupshup.sendText(phone, personalized);
          tracker.recordAgentReply(phone, personalized);
        }
      }
      results.push({ phone, ok: true });
    } catch (e) {
      tracker.recordSystem(phone, `campaign send failed: ${String(e).slice(0, 150)}`);
      results.push({ phone, ok: false, error: String(e).slice(0, 150) });
    }
    await new Promise((r) => setTimeout(r, 350));
  }
  const sent = results.filter((r) => r.ok).length;
  log({ at: "campaign", msg: "launch done", campaignId, name: campName, requested: targets.length, sent });
  return { campaignId, name: campName, requested: targets.length, sent, failed: results.filter((r) => !r.ok) };
});

// Fill-in audience template (public — static example content, no data).
app.get("/assets/audience-template.xlsx", async (_req, reply) => {
  reply.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  reply.header("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent("قالب-المستهدفين.xlsx")}`);
  return audience.buildTemplateXlsx();
});

// Public intro-file serving (Gupshup fetches media by URL — unguessable id, no auth).
app.get("/assets/:pid", async (req, reply) => {
  const pid = String((req.params as any).pid || "").replace(/\.pdf$/i, "");
  const a = await db.getAssetByPublicId(pid);
  if (!a) return reply.code(404).send({ error: "not found" });
  reply.type(a.content_type || "application/pdf");
  reply.header("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(a.filename)}`);
  return a.bytes;
});

app.get("/admin/product-assets", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  return db.listAssets();
});

// Upload the product's intro PDF (the file the agent SENDS — separate from knowledge decks).
app.post("/admin/product-asset/upload", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  const file = await (req as any).file();
  if (!file) return reply.code(400).send({ error: "multipart file required" });
  const product = (String((file.fields?.product as any)?.value ?? "").trim() ||
    String((req.query as any)?.product ?? "").trim());
  if (!product) return reply.code(400).send({ error: "product required (multipart field before file, or ?product=)" });
  const buf = await file.toBuffer();
  const publicId = randomBytes(9).toString("hex");
  await db.saveAsset(product, publicId, file.filename || "intro.pdf", file.mimetype || "application/pdf", buf);
  await agent.refreshKb();
  log({ at: "assets", msg: "intro file saved", product, publicId, size: buf.length });
  return { product, publicId, filename: file.filename };
});

// Portal takeover toggle: human=true mutes the agent for this chat; false resumes it.
app.post("/admin/contact/human", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  const { phone, human } = (req.body ?? {}) as { phone?: string; human?: boolean };
  if (!phone) return reply.code(400).send({ error: "body: { phone, human }" });
  tracker.setHuman(String(phone).replace(/\D/g, ""), Boolean(human));
  return { status: "ok" };
});

// Let the model write the opener: product knowledge + audience shape → a seller's message.
app.post("/admin/compose", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  const { product, audience, angle } = (req.body ?? {}) as { product?: string; audience?: string; angle?: string };
  if (!product) return reply.code(400).send({ error: "body: { product, audience?, angle? }" });
  try {
    const text = await agent.composeOpener(String(product), String(audience || ""), String(angle || ""));
    return { message: text };
  } catch (e) {
    return reply.code(502).send({ error: String(e instanceof Error ? e.message : e).slice(0, 200) });
  }
});

// «لماذا نكسب ولماذا نخسر» — aggregated over cached reads (no LLM cost per view).
app.get("/admin/intel/winloss", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  // Sandbox conversations must not pollute the real market verdict; ?all=1 includes them
  // (the portal asks for that only while it is transparently showing sandbox data).
  const includeTest = String((req.query as any)?.all ?? "") === "1";
  return insights.winLossBoard(includeTest ? undefined : (phone) => Boolean(tracker.findContact(phone)?.test));
});

// Cached reads only (no LLM) — lets list rows show next actions cheaply.
app.get("/admin/insights", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  // Clamp service names on the way out: rows cached before the catalogue existed hold free text,
  // and the portal renders these straight into chips and filters.
  return (await db.listInsights()).map((r: any) => ({ ...r, data: insights.normalizeCached(r.data) }));
});

// العميل ٣٦٠ — one person, fully assembled: identity + timeline + فهم المساعد + context score.
app.get("/admin/customer/:phone", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  const phone = String((req.params as any).phone || "").replace(/\D/g, "");
  if (!phone) return reply.code(400).send({ error: "phone required" });
  // Live contact (full transcript) — snapshot caps transcripts at 30 and would freeze
  // the insight watermark exactly for the most active customers.
  const contact = tracker.findContact(phone);
  if (!contact) return reply.code(404).send({ error: "لا محادثة لهذا الرقم بعد" });
  const entity = (await db.listEntities()).find((e) => e.phone === phone) ?? null;
  const force = String((req.query as any)?.refresh ?? "") === "1";
  const ins = insights.normalizeCached(await insights.getInsights(contact, entity, force));
  return {
    contact, entity, insights: ins,
    context: insights.contextScore(contact, entity),
    timeline: insights.buildTimeline(contact),
    campaigns: (await db.listCampaigns()).filter((cp: any) => (cp.targets || []).some((t: any) => t.phone === phone)).map((cp: any) => ({ id: cp.id, name: cp.name })),
  };
});

// Human-confirmed outcome — the loop-closer that turns AI verdicts into countable results.
app.post("/admin/contact/outcome", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  const { phone, outcome } = (req.body ?? {}) as { phone?: string; outcome?: string };
  const allowed = ["meeting_booked", "quote_sent", "postponed", "not_a_fit", "clear"];
  if (!phone || !allowed.includes(String(outcome))) {
    return reply.code(400).send({ error: "body: { phone, outcome: meeting_booked|quote_sent|postponed|not_a_fit|clear }" });
  }
  const p = String(phone).replace(/\D/g, "");
  tracker.recordSystem(p, outcome === "clear" ? "[أُزيلت النتيجة البشرية]" : `[نتيجة بشرية: ${outcome}]`);
  db.insertEvent(p, "human_outcome", String(outcome), Date.now());
  return { status: "ok" };
});

// Correct a contact's interest tags (removes fabricated or duplicated entries).
app.post("/admin/contact/tags", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  const { phone, tags } = (req.body ?? {}) as { phone?: string; tags?: { product: string; level: string }[] };
  if (!phone || !Array.isArray(tags)) return reply.code(400).send({ error: "body: { phone, tags: [{product, level}] }" });
  const clean = tags.filter((t) => t && t.product).slice(0, 8).map((t) => ({
    product: String(t.product).slice(0, 80),
    level: (["hot", "warm", "cold"].includes(String(t.level)) ? String(t.level) : "warm") as "hot" | "warm" | "cold",
  }));
  const ok = await tracker.replaceTags(String(phone).replace(/\D/g, ""), clean);
  if (!ok) return reply.code(404).send({ error: "unknown phone — curation never creates a contact" });
  return { status: "ok", tags: clean.length };
});

// Behavioural segmentation — evaluate a segment against the live ledger and return what would
// be sent, what is suppressed, and what is too new. Read-only: it never sends and never writes.
app.post("/admin/segments/preview", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  const body = (req.body ?? {}) as { def?: segments.SegmentDef; includeTest?: boolean };
  const def = body.def;
  if (!def || !Array.isArray(def.conditions) || !def.conditions.length) {
    return reply.code(400).send({ error: "body: { def: { match, conditions: [...] } }" });
  }
  if (def.conditions.length > 8) return reply.code(400).send({ error: "بحد أقصى ٨ شروط" });
  const pool = tracker.listContacts().filter((c: any) => (body.includeTest ? true : !c.test));
  const r = segments.evaluate(def, pool);
  const oldest = pool.reduce((m: number, c: any) => Math.max(m, Date.now() - (c.firstSeenAt || Date.now())), 0);
  return {
    describe: segments.describeSegment(def),
    matched: r.matched.length,
    sample: r.matched.slice(0, 12).map((c) => ({
      phone: c.phone, name: c.waName || c.phone, daysSilent: segments.daysSilent(c),
    })),
    suppressed: r.suppressed,
    tooNew: r.tooNew,
    // The tenure state needs a real forecast, not «no results»: how old the book actually is.
    oldestContactDays: Math.floor(oldest / 86_400_000),
    poolSize: pool.length,
    // The tenure forecast the market's tools omit: when the book is younger than the window,
    // «٠ مطابقة» is not an empty audience, it is a not-yet audience. Say when it becomes one.
    requiredDays: (() => {
      let n = 0;
      for (const c of def.conditions) {
        if (c.beforeDays) n = Math.max(n, c.beforeDays);
        if (c.comparator === "never_happened" && c.withinDays) n = Math.max(n, c.withinDays);
      }
      return n;
    })(),
  };
});

app.get("/admin/segments/presets", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  const w = Number((req.query as any)?.window) || segments.DEFAULT_WINDOW_DAYS;
  const win = Math.min(segments.WINDOW_MAX, Math.max(segments.WINDOW_MIN, w));
  const pool = tracker.listContacts().filter((c: any) => !c.test);
  return segments.presets(win).map((p) => ({
    ...p, describe: segments.describeSegment(p.def), matched: segments.evaluate(p.def, pool).matched.length,
  }));
});

// Sandbox separation for a whole launch: a rehearsal sent to real numbers is still a rehearsal,
// and «campaign is test only if every target is a test contact» could not express that.
app.post("/admin/campaign/test", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  const { id, test } = (req.body ?? {}) as { id?: number; test?: boolean };
  // Number("abc") is NaN, which reached Postgres and came back as a 500 leaking «22P02 invalid
  // input syntax for bigint». Validate here, and require `test` explicitly rather than defaulting
  // a missing field to true — the sibling contact route uses Boolean(test).
  const cid = Number(id);
  if (!Number.isSafeInteger(cid) || cid <= 0) return reply.code(400).send({ error: "body: { id: positive integer, test: boolean }" });
  if (typeof test !== "boolean") return reply.code(400).send({ error: "body: { id, test: boolean } — test must be explicit" });
  const ok = await db.setCampaignTest(cid, test);
  if (!ok) return reply.code(404).send({ error: "unknown campaign" });
  return { status: "ok", id: cid, test };
});

// Sandbox separation: test=true keeps this chat out of the real campaign views/KPIs.
app.post("/admin/contact/test", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  const { phone, test } = (req.body ?? {}) as { phone?: string; test?: boolean };
  if (!phone) return reply.code(400).send({ error: "body: { phone, test }" });
  tracker.setTest(String(phone).replace(/\D/g, ""), Boolean(test));
  return { status: "ok" };
});

// ------------------------------ product hub (KB uploads) ------------------------------

app.get("/admin/campaigns", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  return db.listCampaigns();
});

app.get("/admin/kb", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  return db.listKb();
});

app.post("/admin/kb/upload", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  const file = await (req as any).file();
  if (!file) return reply.code(400).send({ error: "multipart file required" });
  const buf = await file.toBuffer();
  // Optional multipart field "product": scope the upload to an existing product page
  // (overrides the extracted name so the doc lands under the product the user is viewing).
  const productOverride = (String((file.fields?.product as any)?.value ?? "").trim() ||
    String((req.query as any)?.product ?? "").trim()) || undefined;
  try {
    const out = await kb.processDeck(buf, file.filename || "deck.pdf", productOverride);
    await agent.refreshKb();
    return out;
  } catch (e) {
    return reply.code(422).send({ error: String(e).slice(0, 300) });
  }
});

// Outbound smoke tests — e.g. verify the source number once it's configured.
app.post("/admin/send-test", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  const { to, text } = (req.body ?? {}) as { to?: string; text?: string };
  if (!to) return reply.code(400).send({ error: "body: { to, text? }" });
  const res = await gupshup.sendText(to, text || "رسالة تجريبية من مَسار ✅");
  tracker.recordAgentReply(to, text || "(test message)");
  return res;
});

app.post("/admin/send-template", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  const { to, templateId, params } = (req.body ?? {}) as { to?: string; templateId?: string; params?: string[] };
  if (!to || !templateId) return reply.code(400).send({ error: "body: { to, templateId, params[] }" });
  return gupshup.sendTemplate(to, templateId, params ?? []);
});

// ------------------------------ boot ------------------------------

const main = async () => {
  log({ at: "boot", config: configReport() });
  tracker.setTestNumbers([cfg.notifyNumber]);  // the PM's own chat is sandbox traffic by definition
  await db.init();                            // memory-only if DATABASE_URL unset/down
  if (db.isConnected()) await tracker.hydrate();
  if (db.isConnected()) await agent.refreshKb();
  agent.initModel().catch(() => { /* retried lazily on first turn */ });
  await app.listen({ port: cfg.port, host: "0.0.0.0" });
  log({ at: "boot", msg: `listening on :${cfg.port}` });
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
