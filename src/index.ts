import Fastify from "fastify";
import { cfg, configReport } from "./config.js";
import { DASHBOARD_HTML } from "./dashboard.js";
import * as db from "./db.js";
import * as gupshup from "./gupshup.js";
import * as tracker from "./tracker.js";
import * as agent from "./agent.js";
import { enqueue } from "./queue.js";

const app = Fastify({ logger: false });
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
  return tracker.snapshot();
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
  await db.init();                            // memory-only if DATABASE_URL unset/down
  if (db.isConnected()) await tracker.hydrate();
  agent.initModel().catch(() => { /* retried lazily on first turn */ });
  await app.listen({ port: cfg.port, host: "0.0.0.0" });
  log({ at: "boot", msg: `listening on :${cfg.port}` });
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
