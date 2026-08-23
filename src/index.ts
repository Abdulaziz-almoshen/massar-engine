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
import * as accounts from "./accounts.js";
import * as segments from "./segments.js";
import { checkOutbound } from "./outbound.js";
import * as templates from "./templates.js";
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
      // Pass the tap-vs-typed provenance, not just the text. Without it the agent cannot tell a
      // customer who TAPPED «لا» from one who wrote it as an answer to a question.
      enqueue(ev.from, () => agent.handleInbound(contact, ev.text, gupshup.isButtonTap(ev)));
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

// The portal lives at /dashboard, so the bare hostname returned a raw 404 JSON body — which is
// what an operator gets when they type the domain from memory or follow a link without the path.
// Redirect instead, carrying any ?token= and the #hash (the fragment is preserved by the browser
// across a 302, so #kmon survives). 302, not 301: the root is not permanently this page.
app.get("/", async (req, reply) => {
  const qs = (req.raw.url || "").split("?")[1];
  return reply.redirect("/dashboard" + (qs ? "?" + qs : ""), 302);
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
  // The account graph, reported honestly: `known` counts entities in the snapshot, `withFacts`
  // counts the ones that actually carry a fact the agent can state. Before this cycle the second
  // number was zero for every conversation and nothing said so.
  accounts: { known: accounts.count(), withFacts: accounts.withFacts(), refreshedAt: accounts.lastRefreshAt() },
  config: configReport(),
}));

// ------------------------------ admin (token-gated) ------------------------------

function adminOk(req: any): boolean {
  return Boolean(cfg.adminToken) && req.headers["x-admin-token"] === cfg.adminToken;
}
/** WHO typed a fact. One operator today (assumption A-3), so the token is the authorization and
 *  this is only a label on the record.
 *
 *  Read from the BODY, not a header: HTTP header values are latin-1, so «أبو عزيز» in an
 *  `x-admin-name` header throws ERR_INVALID_CHAR in the client before the request is even sent —
 *  measured, not assumed. A percent-encoded header would work and would also be a value the portal
 *  emits and cannot read back, which is this project's own recurring defect. */
function adminName(req: any): string {
  return String((req.body ?? {}).by ?? "").trim().slice(0, 60) || "اللوحة";
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
  await accounts.refresh();
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
    // A tag column arrives as a NAME, and a name can only be applied once it exists in the
    // registry — so the import creates what it needs first. The cap is the safety valve: a free
    // text column mistaken for a tag column would otherwise mint one tag per row, and the vocabulary
    // that every filter in the product reads would be unusable. Over the cap we create NOTHING and
    // say so, which is recoverable; creating 3,000 tags is not.
    const NEW_TAG_CAP = 60;
    const have = new Set((await db.listTags()).map((t) => t.name));
    const wanted = [...new Set(parsed.rows.flatMap((r) => r.tags))].filter((t) => !have.has(t));
    let tagsCreated = 0;
    let tagsRefused = 0;
    if (wanted.length > NEW_TAG_CAP) {
      tagsRefused = wanted.length;
      // Drop the unknown names from the rows: an unknown tag would be written to an account and
      // then fail the registry check every time anyone edited it afterwards.
      const known = have;
      for (const r of parsed.rows) r.tags = r.tags.filter((t) => known.has(t));
    } else {
      for (const t of wanted) if (await db.createTag(t, "import")) tagsCreated++;
    }
    const res = await db.addEntities(parsed.rows);
    // Imported columns became typed facts inside the upsert; the agent must see them on the very
    // next inbound message, not after the next restart.
    await accounts.refresh();
    log({ at: "audience", msg: "import done", filename: file.filename, ...res, skipped_rows: parsed.skipped.length });
    return {
      ...res,
      totalRows: parsed.totalRows,
      columns: parsed.columns,
      tagsCreated,
      tagsRefused,
      skippedRows: parsed.skipped.slice(0, 10),
      skippedCount: parsed.skipped.length,
    };
  } catch (e) {
    return reply.code(422).send({ error: String(e instanceof Error ? e.message : e).slice(0, 300) });
  }
});

/**
 * Tag / untag a set of accounts with ONE tag.
 *
 * The name is validated against the tag registry. Free text would let two spellings of one label
 * split a list in silence — the emitted-value-must-be-readable defect this codebase has shipped
 * before — so a tag must be CREATED before it can be APPLIED. The value is stored verbatim,
 * because the filter reads it back by exact match.
 *
 * No WhatsApp path is touched: this writes a label on accounts and nothing else.
 */
/** The tag vocabulary. Seeded once from Lean's own catalogue so existing behaviour is unchanged;
 *  everything after that is the operator's. */
app.get("/admin/tags", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  return db.listTags();
});

app.post("/admin/tags", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  const name = String((req.body as { name?: string })?.name ?? "").trim().replace(/\s+/g, " ");
  if (!name) return reply.code(400).send({ error: "name is required" });
  if (name.length > 60) return reply.code(400).send({ error: "too_long" });
  const created = await db.createTag(name, "portal");
  return { status: "ok", name, created };
});

app.post("/admin/tags/rename", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  const { from, to } = (req.body ?? {}) as { from?: string; to?: string };
  const a = String(from ?? "").trim();
  const b = String(to ?? "").trim().replace(/\s+/g, " ");
  if (!a || !b) return reply.code(400).send({ error: "body: { from, to }" });
  if (b.length > 60) return reply.code(400).send({ error: "too_long" });
  if (a === b) return { status: "ok", renamed: false };
  // A rename ONTO an existing tag would merge two vocabularies; that is a different decision with a
  // different blast radius, so it is refused here rather than done silently.
  if ((await db.listTags()).some((t) => t.name === b)) {
    return reply.code(409).send({ error: "tag_exists" });
  }
  const ok = await db.renameTag(a, b);
  if (!ok) return reply.code(404).send({ error: "unknown_tag" });
  return { status: "ok", renamed: true, from: a, to: b };
});

app.post("/admin/tags/delete", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  const name = String((req.body as { name?: string })?.name ?? "").trim();
  if (!name) return reply.code(400).send({ error: "name is required" });
  const r = await db.deleteTag(name);
  if (!r.ok) return reply.code(404).send({ error: "unknown_tag" });
  return { status: "ok", name, cleared: r.cleared };
});

app.post("/admin/entities/tag", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  const { ids, product, add } = (req.body ?? {}) as { ids?: unknown; product?: string; add?: boolean };
  const list = Array.isArray(ids) ? ids.map(Number).filter((n) => Number.isFinite(n) && n > 0) : [];
  const name = String(product ?? "").trim();
  if (!list.length) return reply.code(400).send({ error: "body: { ids: number[], product, add }" });
  if (!name) return reply.code(400).send({ error: "product is required" });
  // Validated against the REGISTRY, not against Lean's hard-coded service catalogue. Still a
  // closed list at write time — but one the operator extends, which is the whole difference
  // between a product filter and a tagging system.
  const known = new Set((await db.listTags()).map((t) => t.name));
  if (!known.has(name)) {
    return reply.code(400).send({ error: "unknown_tag", known: [...known] });
  }
  const n = await db.setProductTag(list, name, add !== false);
  return { status: "ok", updated: n, product: name, add: add !== false };
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
  const { targets, message, name, product, buttons, templateId } = (req.body ?? {}) as
    { targets?: { phone: string; name?: string }[]; message?: string; name?: string; product?: string; buttons?: boolean; templateId?: string };
  // Buttons come from the REGISTRY by id, never from the request body. The operator edits the
  // message text freely, but the reply buttons are an approved shape — resolving them server-side
  // keeps the wizard's preview and the wire in agreement and blocks arbitrary titles.
  const tpl = templateId ? templates.byId(templateId) : undefined;
  // An unknown id used to fall through to the legacy buttons silently — the operator would see one
  // template in the wizard and the customer would get another template's buttons. Fail instead.
  if (templateId && !tpl) return reply.code(400).send({ error: `قالب غير معروف: ${templateId}` });
  // Default ON per the founder's instruction of 13 Aug, overriding the single-bubble rule he set
  // on 12 Aug. Pass buttons:false to get the one-bubble shape back.
  const wantButtons = buttons !== false;
  if (!Array.isArray(targets) || !targets.length || !message?.trim())
    return reply.code(400).send({ error: "body: { targets: [{phone,name}], message, name?, product? }" });
  if (targets.length > 50) return reply.code(400).send({ error: "launch cap: 50 recipients per launch" });
  // A template whose service variable cannot be resolved must not go out with an empty hole in it.
  if (/\{\{1\}\}|\{product\}/.test(message) && !(product || "").trim())
    return reply.code(400).send({ error: "القالب يحتوي {{1}} ولم تُحدَّد الخدمة — اختر الخدمة قبل الإطلاق" });
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
  const results: { phone: string; ok: boolean; error?: string; reason?: string }[] = [];
  for (const t of targets) {
    const phone = String(t.phone || "").replace(/\D/g, "");
    if (!phone) { results.push({ phone: String(t.phone), ok: false, error: "invalid phone" }); continue; }
    const contact = tracker.getContact(phone, t.name);
    if (contact.optedOut) { results.push({ phone, ok: false, error: "opted out — skipped" }); continue; }
    // REFUSE rather than fail. WhatsApp accepts a free-form message only inside 24h of the
    // customer's own last message; outside it, only a Meta-approved template — and this path sends
    // session messages. The founder launched to two contacts who had last written 33h earlier, both
    // sends failed with «Re-engagement message», and the screen had told him nothing beforehand.
    // Predicting it costs one comparison; discovering it costs a burnt send and a wrong number.
    const win = insights.windowState(contact);
    if (win.state !== "open") {
      results.push({ phone, ok: false, error: win.state === "closed" ? "outside_window" : "no_inbound_ever", reason: win.reason });
      tracker.recordSystem(phone, `[لم تُرسل: ${win.state === "closed" ? "خارج نافذة ٢٤ ساعة" : "لم يراسلنا من قبل"}]`);
      continue;
    }
    // {{1}} is the service variable in the founder's Meta template shape. Resolved here as well as
    // in the wizard: a literal «{{1}}» reaching a customer is the worst failure this screen has,
    // and it must not depend on the client having done the substitution.
    const personalized = templates.render(message, (product || "").trim())
      .replaceAll("{name}", t.name || "").replaceAll("{الاسم}", t.name || "").replace(/\s+([،.!؟])/g, "$1");
    try {
      // One bubble: opener as the document caption + reply buttons (falls back down the
      // capability ladder if the richer shapes are rejected).
      // The founder's design (13 Aug): the opener does NOT carry the file. It offers it. The first
      // button asks for the profile, so the PDF arrives because the customer chose it — which is
      // both a cleaner first impression and a real interest signal we can act on.
      // The fallback comes from the REGISTRY, not a literal here. A literal is a third emission site
      // that assertButtonsHandled() cannot see — the exact hole this whole contract exists to close.
      const BTNS = (tpl?.buttons ?? templates.LAUNCH_FALLBACK_BUTTONS).map((title) => ({ title }));
      const btnNote = ` [أزرار: ${BTNS.map((b) => b.title).join(" | ")}]`;
      const campMark = templates.campaignMark(tpl?.id);
      // REALITY CHECK (user's device, R32): quick_reply+document reported API success but
      // rendered as SEPARATE messages on WhatsApp. Document-with-caption is the native
      // guaranteed single bubble — that is the primary shape for asset launches now.
      const rejectedShape = (e: unknown) => /gupshup 4\d\d:/.test(String(e));
      const asset = introAsset;
      // The trade-off, made explicit instead of hardcoded. On the sandbox number the two cannot be
      // combined: document+caption is ONE bubble but carries no buttons; quick_reply with a
      // document reports API success and then arrives as TWO messages on the device (measured on
      // the founder's own phone, 12 Aug). Only a Meta-approved template with a document header can
      // give both, and that needs the production WABA. `buttons` picks which cost to pay.
      if (asset && !wantButtons) {
        await gupshup.sendDocument(phone, asset.url, asset.filename, personalized);
        tracker.recordAgentReply(phone, `${personalized} [مرفق في نفس الرسالة: ${asset.filename}]${campMark}`);
      } else {
        try {
          // ONE bubble, with the header and footer WhatsApp gives interactive messages, and the
          // file offered rather than attached. The approved template's own footer now reaches
          // the device instead of living only in the portal preview.
          // MEASURED, twice, on a real number: Meta rejects BOTH a header and a footer on a text
          // quick_reply through this Gupshup v1 shape — «131009 Parameter value is not valid».
          // Header and footer are genuine WhatsApp features, but they belong to APPROVED
          // TEMPLATES, which is where the founder's «حلول تكامل للقطاع الصحي» footer will live.
          // Sending neither is the only shape that reaches the device today.
          await gupshup.sendQuickReply(phone, personalized, BTNS);
          tracker.recordAgentReply(phone, `${personalized}${btnNote}${campMark}`);
        } catch (e) {
          if (!rejectedShape(e)) throw e;
          await gupshup.sendText(phone, personalized);
          tracker.recordAgentReply(phone, `${personalized}${campMark}`);
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
  const campaignId = String((req.query as any)?.campaign ?? "").trim();
  /** Sortable launch instant: a readable epoch, or 0 so unreadable campaigns sink to the bottom
   *  instead of poisoning the comparator with NaN. */
  const launchedAt = (cp: any) => {
    const w = insights.campaignWindow(cp?.created_at).from;
    return Number.isFinite(w) ? w : 0;
  };
  const ins = insights.normalizeCached(await insights.getInsights(contact, entity, force));
  return {
    contact, entity, insights: ins,
    // NFR-3 made visible: with no DATABASE_URL (or a dropped pool) a property write CANNOT persist,
    // so the panel renders its editors disabled with the reason stated rather than offering a save
    // that will 503. A local dev with no database is a visible disabled state, never a green save.
    // `enabled()`, deliberately NOT `&& isConnected()`. isConnected can be latched false by a
    // transient pool error; disabling every editor on that basis locks the operator out of a
    // ledger that may already be back. upsertProps re-probes on write and reports honestly if it
    // is genuinely down, so the failure is surfaced at the moment of saving rather than
    // pre-emptively greying out the panel. With no DATABASE_URL at all, this is false and the
    // editors correctly render disabled with the reason stated.
    propsWritable: db.enabled(),
    context: insights.contextScore(contact, entity),
    // What the conversation actually WAS. `contextScore` measures fields we hold and can read full
    // on a contact whose only real sentence was «ماني مهتم لا تتصل علي»; this reads the transcript.
    // Scoped to a campaign episode when the caller names one (?campaign=<id>), lifetime otherwise.
    // Opening a contact FROM a campaign launched minutes ago and reading every reply they ever
    // sent as that campaign's result is the customer-page half of the defect campWin fixed on the
    // campaign page. An unknown or unreadable campaign yields a window that admits nothing rather
    // than falling back to lifetime — the whole point is not to credit history to an event.
    interaction: insights.interactionRead(
      contact,
      (t) => Boolean(templates.buttonIntent(t)),
      campaignId
        ? insights.campaignWindow(((await db.listCampaigns()).find((cp: any) => String(cp.id) === campaignId) || {}).created_at)
        : undefined,
    ),
    timeline: insights.buildTimeline(contact),
    // Newest FIRST, and carrying the launch time. Without a date and an order these rendered as a
    // row of identical blue chips, so the founder could not tell which campaign started the
    // conversation he was looking at — his words: «not sure which one is related to the last one».
    // `created_at` is BIGINT and node-pg returns int8 as a digit STRING; it is passed through raw
    // and normalised by campaignWindow / fmtD rather than being parsed here.
    campaigns: (await db.listCampaigns())
      .filter((cp: any) => (cp.targets || []).some((t: any) => t.phone === phone))
      .map((cp: any) => ({ id: cp.id, name: cp.name, product: cp.product, created_at: cp.created_at, test: cp.test }))
      // campaignWindow returns Infinity for an unreadable launch time (it fails closed), and
      // Infinity - Infinity is NaN, which leaves the order undefined. Unreadable sorts LAST.
      .sort((a: any, b: any) => launchedAt(b) - launchedAt(a)),
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
  // ONE VOCABULARY. These buttons used to write a transcript marker and nothing else, so a human
  // clicking «اجتماع محجوز» and the agent recording `scheduled` were the same fact stored twice in
  // two languages, neither aware of the other — and the portal's own "current state" highlight
  // matched a string («نتيجة موثقة يدويًا») that nothing has ever written. The human decision now
  // writes the SAME outcome enum the agent writes, and the human is the source of truth.
  const HUMAN_TO_OUTCOME: Record<string, "scheduled" | "interested" | "later" | "stopped"> = {
    meeting_booked: "scheduled", quote_sent: "interested", postponed: "later", not_a_fit: "stopped",
  };
  const mapped = HUMAN_TO_OUTCOME[String(outcome)];
  if (mapped) tracker.setOutcome(p, mapped, "قرار بشري من اللوحة");
  else if (outcome === "clear") tracker.setOutcome(p, undefined, "");
  tracker.recordSystem(p, outcome === "clear" ? "[أُزيلت النتيجة البشرية]" : `[نتيجة بشرية: ${outcome}]`);
  db.insertEvent(p, "human_outcome", String(outcome), Date.now());
  // ONE VOCABULARY, second half: «غير مناسب» IS a disqualification, so it becomes a حقيقة on the
  // record instead of living only in outcomeReason where the agent could later overwrite it.
  // «clear» erases it back to «ناقص» — the same button that made the judgement withdraws it.
  let disqualify: string | null = null;
  if (outcome === "not_a_fit" || outcome === "clear") {
    const r = await tracker.writeProp(p, "disqualifyReason",
      // «other», NOT «no_need». The button says only «غير مناسب» — our judgement of the account.
      // Filing it as «لا حاجة لدى العميل» would put a sentence in the customer's mouth that they
      // may never have said, signed by the operator. Same class as the preselected-«السعر» bug.
      outcome === "clear" ? "" : "other: غير مناسب (قرار بشري من اللوحة)", "human", adminName(req));
    // Reported, not swallowed: the operator must be able to see that the fact did not reach the
    // ledger. The outcome itself is telemetry-grade and stays fire-and-forget.
    disqualify = r.applied ? "saved" : (r.reason ?? "unchanged");
  }
  return { status: "ok", outcome: mapped ?? null, disqualify };
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
  // BR-2: the tag set and its provenance commit TOGETHER. Curating tags alone left the panel unable
  // to tell a human correction from the machine reading it replaced, and a crash between two
  // separate commits would have made that permanent for that contact.
  const r = await tracker.writeProp(
    String(phone).replace(/\D/g, ""), "productInterest", tracker.formatInterest(clean),
    "human", adminName(req), { tags: clean });
  if (r.reason === "unknown_phone") return reply.code(404).send({ error: "unknown phone — curation never creates a contact" });
  if (r.reason === "not_persisted") return reply.code(503).send({ ok: false, persisted: false, reason: "not_persisted" });
  if (!r.applied) return reply.code(400).send({ ok: false, error: r.reason, key: "productInterest" });
  return { status: "ok", tags: clean.length };
});

// ------------------------------ the enrichable client record (props) ------------------------------
// The ONLY human write path onto the six typed properties. It reads nothing from the model and
// sends nothing: BR-4 makes "no enrichment path may send WhatsApp" a hard invariant, asserted by
// scripts/check-props.mjs greping this body for `gupshup.` / `agent.`. Keep it that way.
app.post("/admin/contact/props", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  const body = (req.body ?? {}) as {
    phone?: string;
    props?: Record<string, string | { value?: string; due?: number }>;
    tags?: { product: string; level: string }[];
  };
  const phone = String(body.phone ?? "").replace(/\D/g, "");
  if (!phone || !body.props || typeof body.props !== "object") {
    return reply.code(400).send({ error: "body: { phone, props: { <key>: value | {value, due} } }" });
  }
  const entries = Object.entries(body.props);
  if (!entries.length) return reply.code(400).send({ error: "props: at least one key" });

  // NFR-2: validate EVERY key before writing ANY of them, so a typo in the fourth key cannot leave
  // the first three written and the caller told the request failed.
  for (const [key] of entries) {
    if (!(tracker.PROP_KEYS as readonly string[]).includes(key)) {
      return reply.code(400).send({ ok: false, error: "unknown_property", key, allowed: tracker.PROP_KEYS });
    }
  }
  // FR-6 is a closed vocabulary; «other» carries the free text. An unrecognised reason is reported,
  // never coerced to «other» — a coerced value is a fact nobody stated.
  const reasonOf = (v: string) => v.split(/[:：]/)[0].trim();
  for (const [key, raw] of entries) {
    if (key !== "disqualifyReason") continue;
    const v = String((typeof raw === "object" && raw ? raw.value : raw) ?? "").trim();
    if (v && !(tracker.DISQUALIFY_REASONS as readonly string[]).includes(reasonOf(v))) {
      return reply.code(400).send({ ok: false, error: "unknown_reason", key, allowed: tracker.DISQUALIFY_REASONS });
    }
  }

  const by = adminName(req);
  const written: Record<string, unknown> = {};
  for (const [key, raw] of entries) {
    const value = typeof raw === "object" && raw ? String(raw.value ?? "") : String(raw ?? "");
    const due = typeof raw === "object" && raw && raw.due !== undefined ? Number(raw.due) : undefined;
    // BR-2 again: tags ride the productInterest write and nothing else.
    const tags = key === "productInterest" && Array.isArray(body.tags)
      ? body.tags.filter((t) => t && t.product).slice(0, 8).map((t) => ({
          product: String(t.product).slice(0, 80),
          level: (["hot", "warm", "cold"].includes(String(t.level)) ? String(t.level) : "warm") as "hot" | "warm" | "cold",
        }))
      : undefined;
    const r = await tracker.writeProp(phone, key, value, "human", by, { due, tags });
    if (r.reason === "unknown_phone") {
      return reply.code(404).send({ ok: false, error: "unknown_phone", phone });
    }
    // NFR-3 / plan D2, the HUMAN half of the asymmetry: a typed fact that did not reach the ledger
    // must never render as saved. 503 keeps the editor open with «لم يُحفظ — أعد المحاولة». The
    // agent half (agent.ts) does the opposite and swallows this — a live conversation must not
    // stall on the ledger. Both sites carry this comment on purpose.
    if (r.reason === "not_persisted") {
      return reply.code(503).send({ ok: false, persisted: false, error: "not_persisted", key });
    }
    if (r.reason === "too_long" || r.reason === "bad_date") {
      return reply.code(400).send({ ok: false, error: r.reason, key });
    }
    if (!r.applied) return reply.code(400).send({ ok: false, error: r.reason, key });
    written[key] = r.prop ?? null;   // null → the key was cleared back to «ناقص»

    // BR-3: a human disqualification is OUR judgement, so it moves the outcome — and it never sets
    // `opted_out`, which is the customer's right and only theirs to exercise.
    if (key === "disqualifyReason" && r.prop) {
      const stated = reasonOf(r.prop.value) === "no_need";
      tracker.setOutcome(phone, stated ? "stopped" : "not_interested", r.prop.value);
    }
  }
  return { ok: true, persisted: true, props: written };
});

// ------------------------------ the account graph (entity facts) ------------------------------
// The HUMAN write path onto an entity's typed facts — the operator half of what `record_fact`
// does from a conversation. Same door (`accounts.writeFact`), same precedence rule, opposite
// failure mode: a fact that did not reach the row must NEVER render as saved, so an unpersisted
// write is a 503 here and a swallowed log in agent.ts.
//
// Like the props route it reads nothing from the model and sends nothing.
app.post("/admin/entity/facts", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  const body = (req.body ?? {}) as { phone?: string; by?: string; facts?: Record<string, string> };
  const phone = String(body.phone ?? "").replace(/\D/g, "");
  if (!phone || !body.facts || typeof body.facts !== "object") {
    return reply.code(400).send({ error: "body: { phone, facts: { <key>: value } }" });
  }
  const entries = Object.entries(body.facts);
  if (!entries.length) return reply.code(400).send({ error: "facts: at least one key" });
  const by = String(body.by ?? "").trim().slice(0, 60) || "الفريق";
  const written: Record<string, boolean> = {};
  for (const [key, raw] of entries) {
    const r = await accounts.writeFact(phone, key, String(raw ?? ""), "human", by);
    if (r.reason === "not_persisted") {
      // No entity row for this phone, or the ledger is unreachable. Both mean the same thing to an
      // operator — nothing was saved — and both must keep the editor open.
      return reply.code(503).send({ ok: false, persisted: false, error: "not_persisted", key });
    }
    if (!r.applied) return reply.code(400).send({ ok: false, error: r.reason, key });
    written[key] = true;
  }
  return { ok: true, persisted: true, facts: written };
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
  // Refuse shapes that would silently evaluate to nobody. A zero the founder cannot distinguish
  // from an unsupported query is the failure this product exists to avoid.
  const SINGLE_SHOT = ["delivered", "read", "failed"];
  const SIGNALS = ["delivered", "read", "replied", "failed", "interest", "meeting", "opted_out"];
  for (const c of def.conditions) {
    // Validate the enum BEFORE evaluating: occurrences() has no default branch, so an unknown
    // signal returned undefined and the next .filter threw a 500 with an internal message.
    if (!SIGNALS.includes(String(c.signal))) {
      return reply.code(400).send({ error: `حدث غير معروف: «${String(c.signal).slice(0, 40)}»` });
    }
    if (!["happened", "never_happened"].includes(String(c.comparator))) {
      return reply.code(400).send({ error: "المقارنة يجب أن تكون «حدث» أو «لم يحدث»" });
    }
    if (c.comparator === "happened" && (c.atLeast || 1) > 1 && SINGLE_SHOT.includes(c.signal)) {
      return reply.code(400).send({ error: `«${c.signal}» يُسجَّل مرة واحدة لكل جهة، فلا يقبل «أكثر من مرة»` });
    }
    if (c.signal === "opted_out") {
      return reply.code(400).send({ error: "من طلب الإيقاف مستثنى دائمًا ولا يصلح شرطًا للاستهداف" });
    }
  }
  const all = tracker.listContacts();
  // A preview is synchronous and this process also serves the Gupshup webhook — including the
  // «إيقاف» path. Measured at 400k contacts an unbounded scan blocks the event loop for ~2.2s,
  // so an opt-out could queue behind a dashboard click. Bounded until segmentation moves into SQL.
  const SCAN_CAP = 20000;
  const pool = all.filter((c: any) => (body.includeTest ? true : !c.test)).slice(0, SCAN_CAP);
  const truncated = all.length > SCAN_CAP;
  const r = segments.evaluate(def, pool);
  const oldest = pool.reduce((m: number, c: any) => Math.max(m, Date.now() - (c.firstSeenAt || Date.now())), 0);
  return {
    describe: segments.describeSegment(def),
    matched: r.matched.length,
    // `sample` is for DISPLAY only. The send list is `targets`, capped at the same 50-recipient
    // limit /admin/campaign/launch enforces — building a launch from a 12-row preview sample
    // would silently drop everyone past the twelfth match.
    sample: r.matched.slice(0, 12).map((c) => ({
      phone: c.phone, name: c.waName || c.phone, daysSilent: segments.daysSilent(c),
    })),
    targets: r.matched.slice(0, 50).map((c) => ({ phone: c.phone, name: c.waName || c.phone })),
    overLaunchCap: r.matched.length > 50,
    suppressed: r.suppressed,
    tooNew: r.tooNew,
    oldestContactDays: Math.floor(oldest / 86_400_000),
    poolSize: pool.length,
    // Never a silent truncation: say so when the scan was bounded.
    scanTruncated: truncated,
    // The tenure forecast the benchmarked tools omit: «٠ مطابقة» on a book younger than the
    // window is a not-yet audience, not an empty one. One definition, shared with evaluate().
    requiredDays: segments.requiredTenureDays(def),
  };
});

// The approved campaign templates. Served rather than duplicated into the client script, so the
// wizard and the launch path read the SAME registry — a template can never render one way in the
// preview and go out another way on the wire.
app.get("/admin/templates", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  // The fallback travels with the registry so the client has no literal copy of its own — a third
  // copy is a third emission site, and the boot contract can only see the ones it is given.
  return reply.send({ templates: templates.TEMPLATES, fallbackButtons: templates.LAUNCH_FALLBACK_BUTTONS });
});

app.get("/admin/segments/presets", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  const w = Number((req.query as any)?.window) || segments.DEFAULT_WINDOW_DAYS;
  const win = Math.min(segments.WINDOW_MAX, Math.max(segments.WINDOW_MIN, w));
  // Same 20k bound as /preview, and for the same reason: this runs FIVE full scans per page load,
  // synchronously, in the process that also serves the Gupshup webhook — which carries «إيقاف».
  const pool = tracker.listContacts().filter((c: any) => !c.test).slice(0, 20000);
  const oldestDays = pool.reduce((m: number, c: any) => Math.max(m, (Date.now() - (c.firstSeenAt || Date.now())) / 86_400_000), 0);
  // Report the same three numbers the preview does. A preset reading «٠» while three contacts
  // are merely cooling down is the silent zero this feature exists to prevent.
  return segments.presets(win).map((p) => {
    const r = segments.evaluate(p.def, pool);
    return {
      ...p,
      describe: segments.describeSegment(p.def),
      matched: r.matched.length,
      suppressed: r.suppressed.length,
      tooNew: r.tooNew.length,
      requiredDays: segments.requiredTenureDays(p.def),
      // A zero with a date is a working product; a zero with an excuse is a broken one (CO-1).
      entersInDays: Math.max(0, segments.requiredTenureDays(p.def) - Math.floor(oldestDays)),
    };
  });
});

// Sandbox separation for a whole launch: a rehearsal sent to real numbers is still a rehearsal,
// and «campaign is test only if every target is a test contact» could not express that.
// ------------------------------ tasks & notes ------------------------------
// Ported from Frappe's CRM Task / FCRM Note. Every route is admin-token gated like the rest of
// /admin, and NONE of them touch Gupshup: a task or a note is an internal record, never a message.

app.get("/admin/tasks", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  const q = req.query as Record<string, string | undefined>;
  const ref = q.kind && q.id ? { kind: q.kind, id: q.id } : undefined;
  return { tasks: await db.listTasks(ref) };
});

app.post("/admin/tasks", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  const body = (req.body ?? {}) as Record<string, unknown>;
  const bad = db.validateTask(body);
  if (bad) return reply.code(400).send({ ok: false, error: "invalid_field", field: bad });
  // Refuse a dangling ref rather than creating a row that points at nothing. There is no FK here
  // (contacts are phone-keyed, campaigns are BIGSERIAL), so this check IS the constraint.
  if (body.ref_kind && !(await db.refExists(String(body.ref_kind), String(body.ref_id)))) {
    return reply.code(400).send({ ok: false, error: "unknown_ref", kind: body.ref_kind, id: body.ref_id });
  }
  const row = await db.createTask(body as never);
  if (!row) return reply.code(503).send({ ok: false, persisted: false, error: "db_unavailable" });
  return { ok: true, task: row };
});

app.patch("/admin/tasks/:id", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  const id = Number((req.params as { id: string }).id);
  if (!Number.isFinite(id)) return reply.code(400).send({ ok: false, error: "bad_id" });
  const body = (req.body ?? {}) as Record<string, unknown>;
  // a PATCH carries a subset, so only the fields present are validated
  if (body.title !== undefined || body.status !== undefined || body.priority !== undefined || body.ref_kind !== undefined) {
    const merged = { title: body.title ?? "x", ...body };
    const bad = db.validateTask(merged);
    if (bad) return reply.code(400).send({ ok: false, error: "invalid_field", field: bad });
  }
  const row = await db.updateTask(id, body as never);
  if (!row) return reply.code(404).send({ ok: false, error: "not_found_or_no_change" });
  return { ok: true, task: row };
});

app.delete("/admin/tasks/:id", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  const id = Number((req.params as { id: string }).id);
  if (!Number.isFinite(id)) return reply.code(400).send({ ok: false, error: "bad_id" });
  return { ok: await db.deleteTask(id) };
});

app.get("/admin/notes", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  const q = req.query as Record<string, string | undefined>;
  const ref = q.kind && q.id ? { kind: q.kind, id: q.id } : undefined;
  return { notes: await db.listNotes(ref) };
});

app.post("/admin/notes", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  const body = (req.body ?? {}) as Record<string, unknown>;
  if (typeof body.content !== "string" || !body.content.trim()) {
    return reply.code(400).send({ ok: false, error: "invalid_field", field: "content" });
  }
  if (body.ref_kind && !(await db.refExists(String(body.ref_kind), String(body.ref_id)))) {
    return reply.code(400).send({ ok: false, error: "unknown_ref", kind: body.ref_kind, id: body.ref_id });
  }
  const row = await db.createNote(body as never);
  if (!row) return reply.code(503).send({ ok: false, persisted: false, error: "db_unavailable" });
  return { ok: true, note: row };
});

app.patch("/admin/notes/:id", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  const id = Number((req.params as { id: string }).id);
  if (!Number.isFinite(id)) return reply.code(400).send({ ok: false, error: "bad_id" });
  const row = await db.updateNote(id, (req.body ?? {}) as never);
  if (!row) return reply.code(404).send({ ok: false, error: "not_found_or_no_change" });
  return { ok: true, note: row };
});

app.delete("/admin/notes/:id", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  const id = Number((req.params as { id: string }).id);
  if (!Number.isFinite(id)) return reply.code(400).send({ ok: false, error: "bad_id" });
  return { ok: await db.deleteNote(id) };
});

// ------------------------------ opportunities (فرص البيع) ------------------------------
//
// The board's whole contract. A line is a human's claim about a deal, so every write records WHO
// made it (created_by) and the product is clamped to the SAME registry that validates a tag — the
// emitted-value-must-be-readable rule: the board offers a closed list of names and stores exactly
// the string it offered, so a card can never show a product no filter can find.

app.get("/admin/opps", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  return { opps: await db.listOpps() };
});

app.post("/admin/opps", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  const b = (req.body ?? {}) as Record<string, unknown>;
  const name = String(b.account_name ?? "").trim().slice(0, 120);
  if (!name) return reply.code(400).send({ ok: false, error: "invalid_field", field: "account_name" });
  const rawPhone = String(b.phone ?? "").trim();
  // Normalised through the SAME function the importer uses, so a line typed as 05… lands on the
  // very row an imported book already holds instead of opening a second card for one client.
  const phone = rawPhone ? audience.normalizePhone(rawPhone) : "";
  if (rawPhone && phone.length < 8) return reply.code(400).send({ ok: false, error: "invalid_field", field: "phone" });
  const source = String(b.source ?? "other");
  if (!(db.OPP_SOURCES as readonly string[]).includes(source)) {
    return reply.code(400).send({ ok: false, error: "invalid_field", field: "source" });
  }
  // A whatsapp line must name the campaign it came from — that link is the only reason the founder's
  // «sometimes it comes from the campaign» is answerable later, and a dangling id answers nothing.
  const sourceRef = String(b.source_ref ?? "").trim() || null;
  if (source === "whatsapp" && sourceRef && !(await db.refExists("campaign", sourceRef))) {
    return reply.code(400).send({ ok: false, error: "unknown_ref", kind: "campaign", id: sourceRef });
  }
  const lines = Array.isArray(b.lines) ? (b.lines as Record<string, unknown>[]) : [];
  if (!lines.length) return reply.code(400).send({ ok: false, error: "invalid_field", field: "lines" });
  if (lines.length > 20) return reply.code(400).send({ ok: false, error: "too_many_lines" });
  const known = new Set((await db.listTags()).map((t) => t.name));
  for (const l of lines) {
    const bad = db.validateOppLine(l);
    if (bad) return reply.code(400).send({ ok: false, error: "invalid_field", field: bad });
    if (!known.has(String(l.product).trim())) {
      return reply.code(400).send({ ok: false, error: "unknown_product", product: l.product, known: [...known] });
    }
  }
  const rows = await db.createOppLines(
    { account_name: name, phone: phone || null, source, source_ref: sourceRef, created_by: adminName(req) },
    lines.map((l) => ({
      product: String(l.product).trim(),
      stage: (l.stage ?? undefined) as never,
      sale_price: Math.round(Number(l.sale_price ?? 0)),
      years: Math.round(Number(l.years ?? 1)), qty: Math.round(Number(l.qty ?? 1)),
      discount: Math.round(Number(l.discount ?? 0)),
      owner: String(l.owner ?? "").trim().slice(0, 60) || null,
      close_on: l.close_on == null || l.close_on === "" ? null : Number(l.close_on),
      next_step: String(l.next_step ?? "").trim().slice(0, 300) || null,
    })));
  if (!rows.length) return reply.code(503).send({ ok: false, persisted: false, error: "db_unavailable" });
  return { ok: true, opps: rows };
});

app.patch("/admin/opps/:id", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  const id = Number((req.params as { id: string }).id);
  if (!Number.isFinite(id)) return reply.code(400).send({ ok: false, error: "bad_id" });
  const b = (req.body ?? {}) as Record<string, unknown>;
  // A PATCH carries a subset, so only what is present is validated — merged onto a product because
  // validateOppLine's first obligation is that one exists.
  const bad = db.validateOppLine({ product: b.product ?? "x", ...b });
  if (bad && !(bad === "product" && b.product === undefined)) {
    return reply.code(400).send({ ok: false, error: "invalid_field", field: bad });
  }
  if (b.product !== undefined) {
    const known = new Set((await db.listTags()).map((t) => t.name));
    if (!known.has(String(b.product).trim())) {
      return reply.code(400).send({ ok: false, error: "unknown_product", product: b.product });
    }
  }
  const patch: Record<string, unknown> = {};
  for (const k of ["product", "stage", "owner", "next_step", "lost_reason"]) {
    if (b[k] !== undefined) patch[k] = String(b[k] ?? "").trim().slice(0, 300) || null;
  }
  for (const k of ["sale_price", "years", "qty", "discount"]) {
    if (b[k] !== undefined) patch[k] = Math.round(Number(b[k]));
  }
  if (b.close_on !== undefined) patch.close_on = b.close_on == null || b.close_on === "" ? null : Number(b.close_on);
  const row = await db.updateOpp(id, patch as never);
  if (!row) return reply.code(404).send({ ok: false, error: "not_found_or_no_change" });
  return { ok: true, opp: row };
});

app.delete("/admin/opps/:id", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  const id = Number((req.params as { id: string }).id);
  if (!Number.isFinite(id)) return reply.code(400).send({ ok: false, error: "bad_id" });
  return { ok: await db.deleteOpp(id) };
});

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
  const blocked = checkOutbound(to, "session");
  if (blocked) return reply.code(409).send({ status: "refused", ...blocked });
  const res = await gupshup.sendText(to, text || "رسالة تجريبية من مَسار ✅");
  tracker.recordAgentReply(to, text || "(test message)");
  return res;
});

app.post("/admin/send-template", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  const { to, templateId, params } = (req.body ?? {}) as { to?: string; templateId?: string; params?: string[] };
  if (!to || !templateId) return reply.code(400).send({ error: "body: { to, templateId, params[] }" });
  const blocked = checkOutbound(to, "template");
  if (blocked) return reply.code(409).send({ status: "refused", ...blocked });
  return gupshup.sendTemplate(to, templateId, params ?? []);
});

// ------------------------------ boot ------------------------------

const main = async () => {
  log({ at: "boot", config: configReport() });
  // Refuse to start with a button we cannot answer, or a title WhatsApp will reject. Both have
  // already shipped once: a 21-char title failed three sends, and «العرض التجاري» dead-ended the
  // customer who tapped it. Crashing at boot is loud; a dead-end button is silent.
  // SAFETY CONDITION (safety-gate, 13 Aug — the basis of its PASS): this assertion is safe to
  // fail-closed ONLY because its input is 100% compile-time static, so a given image either always
  // throws or never does, and it throws before app.listen — never leaving the service half-alive
  // with outbound working and inbound «إيقاف» dropped. If anyone ever passes a runtime-derived
  // title here (a DB template, an env var, an operator-typed button), this must degrade to a loud
  // log plus refuse-to-emit-that-button. A data-dependent boot crash on the webhook receiver is a
  // real availability hazard for the opt-out path.
  templates.assertButtonsHandled(agent.EMITTED_BUTTONS);
  tracker.setTestNumbers([cfg.notifyNumber]);  // the PM's own chat is sandbox traffic by definition
  await db.init();                            // memory-only if DATABASE_URL unset/down
  // Everything the process reads from Postgres into memory, in one place, because it must run at
  // TWO moments: boot, and the reconnect a latched-off pool makes 30s after Postgres returns.
  // Every step is idempotent — hydrate() self-guards against a second run (a reconnect after a
  // healthy boot must not clobber memory that is ahead of the dropped writes), the tag seed
  // checks what exists, and the two refreshes are plain re-reads.
  const hydrateFromDb = async () => {
    if (!db.isConnected()) return;
    await tracker.hydrate();
    // Seed the tag vocabulary from Lean's own catalogue, once and idempotently, so the registry
    // starts where the hard-coded list left off and nothing an operator already tagged stops
    // validating. Everything added after this is theirs.
    const have = new Set((await db.listTags()).map((t) => t.name));
    const seed = [
      ...(insights.SERVICE_CATALOGUE as readonly string[]),
      ...(await db.listKb()).map((d) => d.product).filter((p) => p && p !== "__skill__"),
    ];
    let added = 0;
    for (const name of seed) if (!have.has(name) && await db.createTag(name, "seed")) added++;
    if (added) log({ at: "boot", msg: `tag registry seeded with ${added} name(s)` });
    // Contacts the assistant read as HOT before auto-creation shipped get the same treatment as the
    // next one — otherwise the board's behaviour would depend on the deploy date, which is the kind
    // of inconsistency nobody can explain a month later. Idempotent by construction: every call
    // goes through the same once-only claim, so this runs on every boot and every reconnect and
    // creates nothing the second time. It runs AFTER the tag seed on purpose — the registry check
    // inside it would refuse a product the seed above is about to create.
    if (cfg.autoOppFromHot) {
      let made = 0;
      for (const h of await db.hotReadings()) {
        const o = await db.autoOppFromHot(h.phone, h.product, h.wa_name ?? undefined).catch(() => null);
        if (o) made++;
      }
      if (made) log({ at: "boot", msg: `opp_auto backfill: ${made} opportunity line(s) from hot readings` });
    }
    await agent.refreshKb();
    // The agent's account facts. Loaded once into a synchronous snapshot, then kept current
    // by every import and every fact write — systemPrompt is sync and must not wait on a query.
    await accounts.refresh();
  };
  await hydrateFromDb();
  // Registered AFTER the boot run on purpose: a clean boot fires no callback; this is the rescue
  // path for the Aug 19–23 failure, where init() raced a Postgres restart and the engine served
  // an empty ledger for 3.7 days with /health green.
  db.onReconnect(() => {
    hydrateFromDb()
      .then(() => log({ at: "db", msg: "reconnected — memory rehydrated from postgres" }))
      .catch((e) => log({ at: "db", msg: `reconnect rehydrate failed: ${String(e).slice(0, 200)}` }));
  });
  agent.initModel().catch(() => { /* retried lazily on first turn */ });
  await app.listen({ port: cfg.port, host: "0.0.0.0" });
  log({ at: "boot", msg: `listening on :${cfg.port}` });
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
