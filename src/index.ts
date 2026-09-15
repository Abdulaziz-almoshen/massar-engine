import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { cfg, configReport } from "./config.js";
import { DASHBOARD_HTML } from "./dashboard.js";
import { REP_PAGE_HTML } from "./rep-page.js";
import * as db from "./db.js";
import * as gupshup from "./gupshup.js";
import * as sales from "./sales-domain.js";
import * as reports from "./reports-domain.js";
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
import { countPotentialClientsAcross, countPotentialClientsByProduct } from "./interest.js";
import { CONFIRMED_INTEREST_STAGES, OPP_STAGES, OPP_SOURCES as OPP_SOURCE_LABELS, calculateLineValue, isLinePriced } from "./opps-domain.js";
import * as pipelineReport from "./pipeline-report-domain.js";
import * as sysCfg from "./config-domain.js";
import * as pd from "./product-domain.js";
import * as ind from "./indicator-domain.js";
import * as acct from "./account-domain.js";
import { activityByDay, activityFromCounts, readSeriousness } from "./signal-domain.js";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { monitorEventLoopDelay } from "node:perf_hooks";

// THE RISK IS A BLOCKED LOOP, SO MEASURE THE LOOP. The queue scores contacts in synchronous JS on
// one shared CPU that also serves the Gupshup webhook, and the dashboard polls every five seconds.
// Contact count says nothing about that, and RSS only notices pressure after it exists — by which
// point the symptom is a webhook that timed out, and a timed-out webhook can be a lost «إيقاف».
//
// resolution:20 keeps the histogram cheap; it samples, it does not instrument every tick.
const LOOP_RESOLUTION_MS = 20;
const loopDelay = monitorEventLoopDelay({ resolution: LOOP_RESOLUTION_MS });
loopDelay.enable();
const loopLagMs = (ns: number) =>
  Math.max(0, Math.round((ns / 1e6 - LOOP_RESOLUTION_MS) * 10) / 10);
import multipart from "@fastify/multipart";

const app = Fastify({ logger: false, bodyLimit: 26214400 });
await app.register(multipart, { limits: { fileSize: 25 * 1024 * 1024, files: 1 } });

// One shared token, no users, no sessions, no rotation — and until now no lockout, so an online
// guessing attack had unlimited attempts against the credential that can message real clinics.
// Scoped to /admin AND /rep. NOT the webhook: Gupshup bursts delivery statuses far past any sane
// per-minute cap during a campaign, and a throttled webhook drops inbound — which can be an
// «إيقاف». Opt-out is sacred (CLAUDE.md §7), so the webhook keeps its token and no limiter.
// /dashboard and /health stay open too: a limit that locks an operator out of the screen is a
// limit someone removes.
//
// Registered global with an allowList that skips everything outside /admin, rather than
// global:false plus per-route config — the per-route form needs the config on each route's own
// definition, and setting it from an onRoute hook does NOT take: it was verified silently doing
// nothing (40 wrong-token attempts, 40 x 401, zero 429).
//
// ONLY FAILED ATTEMPTS COUNT. The threat here is an online guessing attack on the one shared
// token, not authorised traffic, so a request carrying a VALID token is allow-listed and consumes
// no quota. Counting every admin call instead was measured breaking the product: a clean smoke run
// of the dashboard's own screens blew past 120/min and #kmon and the client record came back 429
// with a blank render. Limiting the credential check rather than the user costs the operator
// nothing and still caps guessing at 20/min per IP.
await app.register(rateLimit, {
  global: true,
  max: 20,
  timeWindow: "1 minute",
  // Fly puts the real client in fly-client-ip; req.ip is the proxy, and limiting the proxy would
  // throttle every operator together the first time one of them typed a wrong token.
  keyGenerator: (req: any) => String(req.headers["fly-client-ip"] || req.ip),
  // Both guarded doors, and a VALID credential of either kind costs no quota. Allow-listing only
  // adminOk would have counted every legitimate rep request as a failed admin attempt and throttled
  // the pilot at 20 requests a minute; leaving /rep off the list entirely would have given the new
  // door no brute-force protection at all.
  allowList: (req: any) => {
    const u = String(req.url || "");
    if (!u.startsWith("/admin") && !u.startsWith("/rep")) return true;
    return authorize(req) !== null;
  },
  // statusCode belongs ON the returned object: Fastify reads it off the error, and without it the
  // correct body went out under a 500. Verified — 120 x 401 then 30 x 429.
  errorResponseBuilder: () => ({ statusCode: 429, status: "too_many_requests", error: "محاولات كثيرة. انتظر دقيقة." }),
});

// No error handler existed, so Fastify's default returned err.message verbatim — which for a
// database failure is the raw pg text, relation and column names included. Detail is logged
// server-side; the caller gets the status and nothing that describes the schema.
app.setErrorHandler((err: any, req, reply) => {
  const status = Number(err?.statusCode) || 500;
  if (status >= 500) {
    console.error(JSON.stringify({
      at: "http", level: "error", msg: "unhandled route error",
      url: String(req.url || "").split("?")[0], err: String(err?.message ?? err).slice(0, 300),
    }));
    // A dropped database connection is «unavailable», not «the request is broken»: the dashboard
    // renders 503 db_unavailable as a retryable failed state, and a bare 500 as a generic error.
    // Seen on production 2026-09-13 whenever the 256MB Postgres hit its memory limit mid-request.
    if (/Connection terminated|ECONNRESET|ECONNREFUSED|timeout exceeded when trying to connect|Client has encountered a connection error/i.test(String(err?.message ?? ""))) {
      return reply.code(503).send({ ok: false, error: "db_unavailable" });
    }
    return reply.code(status).send({ status: "error", error: "تعذّر تنفيذ الطلب." });
  }
  // 4xx is the app's own deliberate answer (auth, validation, the rate limiter) — pass it through.
  return reply.code(status).send(err?.status || err?.error ? err : { status: "error", error: String(err?.message ?? "") });
});
const startedAt = Date.now();

function log(obj: Record<string, unknown>) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...obj }));
}

// ------------------------------ webhook ------------------------------

// Gupshup dashboard sends a GET (HEAD auto-registered by Fastify) when validating the callback URL.
app.get("/webhooks/gupshup", async () => "OK");

app.post("/webhooks/gupshup", async (req, reply) => {
  const token = (req.query as any)?.token ?? "";
  // FAIL CLOSED. This used to read `if (cfg.webhookToken && ...)`, so an UNSET token made the
  // guard evaluate false and accepted every POST — while configReport() printed "webhook is
  // unauthenticated!" and the app booted anyway. A forged webhook can flip opt-out state and
  // write the transcript the agent reads back, so an absent secret must refuse, not wave through.
  if (!cfg.webhookToken || !secretEq(String(token), cfg.webhookToken)) {
    return reply.code(401).send({ status: "unauthorized" });
  }

  // Parse BEFORE acking, so anything we cannot turn into events is RECORDED rather than swallowed.
  //
  // Scope, stated rather than implied: Fastify parses the JSON body before this handler runs, so
  // malformed JSON is already refused upstream and never reaches the catch below, which therefore
  // only fires if normalizeWebhook itself throws. An unrecognised SHAPE does not land here at all —
  // normalizeWebhook returns a {kind:"other"} event for any object, so it surfaces in the
  // "unhandled event type" branch below, which now carries the raw body. That is the only thing
  // that lets an operator recover an «إيقاف» that arrived inside an envelope we cannot yet read.
  //
  // It still acks 200 either way: the failure is deterministic, so a retry re-sends the same
  // unreadable body, and an endpoint that answers 4xx in a loop is one a provider can disable —
  // which would lose ALL inbound, including the opt-outs this fix exists to protect.
  let events;
  try {
    events = gupshup.normalizeWebhook(req.body);
  } catch (e) {
    console.error(JSON.stringify({ at: "webhook", level: "error", msg: "normalize threw — event NOT processed, raw body logged for manual recovery", err: String(e).slice(0, 300), raw: JSON.stringify(req.body ?? null).slice(0, 2000) }));
    return reply.send({ status: "ok" });
  }

  // Ack now; process async so Gupshup never times out on us.
  reply.send({ status: "ok" });

  // Per-event try/catch. One malformed event must not abort the loop and take the events after it
  // down with it — that is a silent partial loss, and this handler runs after the ack, so a throw
  // here surfaces nowhere at all.
  //
  // KNOWN LIMIT, stated rather than implied: this makes the handler crash-resistant, not durable.
  // A process death between the ack and the write still loses the event. The fix for that is the
  // inbound_events table in phase 0 of docs/designs/massar-platform-implementation.md.
  for (const ev of events) {
    try {
      if (ev.kind === "message") {
        if (!ev.from) continue;
        const contact = tracker.recordInbound(ev);
        // Pass the tap-vs-typed provenance, not just the text. Without it the agent cannot tell a
        // customer who TAPPED «لا» from one who wrote it as an answer to a question.
        enqueue(ev.from, () => agent.handleInbound(contact, ev.text, gupshup.isButtonTap(ev)));
      } else if (ev.kind === "status") {
        tracker.recordStatus(ev);
      } else {
        // Raw body included on purpose: this is the real silent-drop path. A future provider
        // envelope lands here, and if it carried an opt-out, this log is the only record of it.
        console.error(JSON.stringify({ at: "webhook", level: "error", msg: "unhandled event type", type: ev.type, raw: JSON.stringify(req.body ?? null).slice(0, 2000) }));
      }
    } catch (e) {
      console.error(JSON.stringify({ at: "webhook", level: "error", msg: "event dropped", kind: ev.kind, from: "from" in ev ? ev.from : "", err: String(e).slice(0, 300) }));
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
  // Honest, not decorative. This returned `true` unconditionally, so a machine whose migration
  // failed and fell back to memory-only mode (db.ts init catch) reported healthy while every write
  // was being dropped. Still HTTP 200 on purpose: Fly restarts on a failing check, and a restart
  // loop during a database outage is worse than a truthful body an operator can read.
  ok: !db.enabled() || db.isConnected(),
  service: "massar-engine",
  uptimeSec: Math.round((Date.now() - startedAt) / 1000),
  model: agent.currentModel(),
  gupshupAppName: gupshup.appName() || "(unknown — learned from first webhook)",
  sourceNumber: gupshup.sourceNumber() || "(unset — auto-learns from v3 webhooks)",
  outbound: gupshup.outboundReady(),
  // Milliseconds the event loop was late. p99 is the number that matters: a mean stays flat while
  // one 300ms scoring pass a minute quietly delays every webhook behind it.
  // The histogram measures the whole interval, so an IDLE process reads ~20ms at resolution 20.
  // Reporting that raw would have an operator chasing a lag that is only the sampler. Subtracting
  // the resolution makes the number mean what its name says: milliseconds the loop was LATE.
  loop: {
    meanMs: loopLagMs(loopDelay.mean),
    p99Ms: loopLagMs(loopDelay.percentile(99)),
    maxMs: loopLagMs(loopDelay.max),
  },
  contacts: tracker.contactCount(),
  db: { enabled: db.enabled(), connected: db.isConnected(), counts: await db.counts() },
  // The account graph, reported honestly: `known` counts entities in the snapshot, `withFacts`
  // counts the ones that actually carry a fact the agent can state. Before this cycle the second
  // number was zero for every conversation and nothing said so.
  accounts: { known: accounts.count(), withFacts: accounts.withFacts(), refreshedAt: accounts.lastRefreshAt() },
  config: configReport(),
}));

// --------------------- the commercial engine: performance and targets ---------------------
//
// ONE endpoint feeds the whole performance screen, from ONE grouped query, so no two tiles can
// disagree and the executive view costs one connection rather than one per card.

/** The fiscal calendar. January default because Lean's fiscal year start is still an open question
 *  in the design doc — env-switchable so the answer is a config change, not a deploy of new code. */
function fiscalStartMonth(): number {
  const m = Number(process.env.FISCAL_START_MONTH || 1);
  return Number.isFinite(m) && m >= 1 && m <= 12 ? Math.round(m) : 1;
}

/**
 * Resolve ?year and ?quarter into fiscal period bounds, or name the bad field.
 *
 * Shared by every period-scoped sales route. It is a function rather than copied lines because both
 * checks below were bugs: quarter was validated while year was not, and an out-of-range year
 * overflowed Date.UTC into NaN, which pg serialises as the string "NaN" and to_timestamp rejects,
 * surfacing the raw driver error with relation names as a 500. A second route pasting this block
 * would have inherited that on day one.
 */
function resolvePeriod(q: any): { bad: string } | {
  year: number; quarter: number; fsm: number; startMs: number; endMs: number; isCurrentPeriod: boolean;
} {
  const fsm = fiscalStartMonth();
  const now = sales.riyadhFiscalPeriod(Date.now(), fsm);
  const year = Number(q?.year) || now.year;
  const quarter = Number(q?.quarter) || now.quarter;
  if (quarter < 1 || quarter > 4) return { bad: "quarter" };
  if (!Number.isFinite(year) || year < 2020 || year > 2100) return { bad: "year" };
  const b = sales.riyadhPeriodBounds(year, quarter, fsm);
  return {
    year, quarter, fsm, startMs: b.startMs, endMs: b.endMs,
    // Whether the caller is looking at the quarter we are inside. Open pipeline with no planned
    // close date belongs to the current period or to none; decided here, not guessed in SQL.
    isCurrentPeriod: year === now.year && quarter === now.quarter,
  };
}

app.get("/admin/sales/performance", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized", error: "غير مصرّح" });
  const per = resolvePeriod(req.query);
  if ("bad" in per) return reply.code(400).send({ ok: false, error: "invalid_field", field: per.bad });
  const rows = await db.salesPerformance(per.startMs, per.endMs, per.year, per.quarter, per.isCurrentPeriod);
  return {
    ok: true, year: per.year, quarter: per.quarter, fiscalStartMonth: per.fsm,
    periodStart: per.startMs, periodEnd: per.endMs, now: Date.now(),
    rows,
  };
});

// ---- the sector board, the products screen and the sector selector (R10) -------------------
//
// READ-ONLY, and they are endpoints only: no screen mounts them yet. Saying otherwise is the
// mistake made once already on this project, where a commit claimed a screen shipped and what
// actually shipped was an HTTP route no nav item reached. The screens are open item R12.

app.get("/admin/sales/sectors", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized", error: "غير مصرّح" });
  const per = resolvePeriod(req.query);
  if ("bad" in per) return reply.code(400).send({ ok: false, error: "invalid_field", field: per.bad });
  const rows = await db.salesPerformance(per.startMs, per.endMs, per.year, per.quarter, per.isCurrentPeriod);
  const sectors = sales.rollupBySector(rows);
  return {
    ok: true, year: per.year, quarter: per.quarter, fiscalStartMonth: per.fsm,
    periodStart: per.startMs, periodEnd: per.endMs, now: Date.now(),
    sectors,
    // Stated, not left for a caller to derive: every product figure is inside exactly one bucket
    // above, so a screen that renders these rows renders the whole pipeline.
    productCount: rows.length,
    unclassifiedCount: sectors.find((x) => x.isUnclassified)?.products.length ?? 0,
  };
});

// ---- «المنتجات» V5 --------------------------------------------------------------------------
//
// One registry (tags), every file and figure overlaid by name, and ONE eligibility rule shared
// with the assistant's runtime. Errors on the new routes are RFC 9457 problem+json (STANDARDS §7);
// the client reads `error`. Product names travel in the query or the body, never in the path —
// «تكامل الأنظمة (HIS/ERP)» has a slash in it.

/** The product row every products read and write answers with — the catalogue row plus the two
 *  runtime facts the screens must not derive for themselves: `eligible` (the pure rule over the
 *  stored state) and `inAssistantKnowledge` (what the agent's live prompt actually holds). */
async function productRows(): Promise<Record<string, unknown>[]> {
  const live = new Set(agent.runtimeKnowledgeProducts());
  return (await db.productCatalogue()).map((c) => {
    const kbState = c.kb ? pd.kbStateOf(c.kb.md, c.kb.approvedAt) : "none";
    const embedded = pd.isEmbeddedProduct(c.product);
    return {
      product: c.product, sector: c.sector, sectorId: c.sectorId, sectorAssumed: c.sectorAssumed,
      owner: c.owner, pricingNote: c.pricingNote,
      // «القسم» — the company unit that owns it; the market sector is separate, above.
      divisionId: c.divisionId, division: c.division,
      packages: c.packages, retiredPackageCount: c.retiredPackageCount,
      archived: c.archived, archivedAt: c.archivedAt,
      embedded,
      eligible: pd.isRuntimeEligible({ exists: true, archived: c.archived, kbState, embedded }),
      inAssistantKnowledge: live.has(c.product),
      kb: c.kb
        ? { state: kbState, source: c.kb.source, approvedBy: c.kb.approvedBy, approvedAt: c.kb.approvedAt, updatedAt: c.kb.updatedAt }
        : { state: "none", source: null, approvedBy: null, approvedAt: null, updatedAt: null },
      draft: c.draft ? { source: c.draft.source, by: c.draft.by, at: c.draft.at, hash: db.sha256Hex(c.draft.md) } : null,
      asset: c.asset,
      createdAt: c.createdAt,
    };
  });
}

async function productRow(name: string): Promise<Record<string, unknown> | null> {
  return (await productRows()).find((r) => r.product === name) ?? null;
}

/** Four fiscal quarters of one year, the same bounds /admin/sales/quarters uses. */
function yearBounds(year: number): { quarter: number; startMs: number; endMs: number }[] {
  const fsm = fiscalStartMonth();
  return [1, 2, 3, 4].map((quarter) => {
    const b = sales.riyadhPeriodBounds(year, quarter, fsm);
    return { quarter, startMs: b.startMs, endMs: b.endMs };
  });
}

/** The product named by ?product= or the body, or null — one place, so every route trims alike. */
function productParam(req: any): string {
  const q = String((req.query as any)?.product ?? "").trim();
  return q || String((req.body as any)?.product ?? "").trim();
}

app.get("/admin/products", async (req, reply) => {
  if (!adminOk(req)) return problem(reply, 401, "unauthorized", "غير مصرّح");
  if (!(await db.canRead())) return reply.code(503).send({ ok: false, error: "db_unavailable" });
  const [products, unmatched, skill, sectors] = await Promise.all([
    productRows(), db.unmatchedFiles(), db.skillAsset(), db.listSectors(),
  ]);
  return { ok: true, products, unmatched, skill, sectors };
});

app.get("/admin/products/performance", async (req, reply) => {
  if (!adminOk(req)) return problem(reply, 401, "unauthorized", "غير مصرّح");
  if (!(await db.canRead())) return reply.code(503).send({ ok: false, error: "db_unavailable" });
  const fsm = fiscalStartMonth();
  const now = sales.riyadhFiscalPeriod(Date.now(), fsm);
  const year = Number((req.query as any)?.year) || now.year;
  if (!Number.isInteger(year) || year < 2020 || year > 2100) return problem(reply, 400, "invalid_field", "سنة غير صالحة", "year");
  return { ok: true, year, byProduct: await db.productPerformance(year, yearBounds(year)) };
});

app.get("/admin/products/knowledge", async (req, reply) => {
  if (!adminOk(req)) return problem(reply, 401, "unauthorized", "غير مصرّح");
  if (!(await db.canRead())) return reply.code(503).send({ ok: false, error: "db_unavailable" });
  const product = productParam(req);
  if (!product) return problem(reply, 400, "invalid_field", "اسم المنتج مطلوب", "product");
  const [state, row] = await Promise.all([db.tagState(product), db.knowledgeOf(product)]);
  // A kb row with no tag is an «غير مطابق» file and still readable, so the reconcile row can show it.
  if (!state.exists && !row) return problem(reply, 404, "unknown_product", "لا منتج بهذا الاسم", "product");
  const md = row?.md ?? "";
  const draftMd = row?.draft_md ?? null;
  return {
    ok: true, product, md, mdHash: db.sha256Hex(md),
    state: pd.kbStateOf(md, row?.approved_at ?? null),
    approvedBy: row?.approved_by ?? null, approvedAt: row?.approved_at ?? null,
    source: row?.source_filename ?? null, updatedAt: row?.updated_at ?? null,
    draftMd, draftHash: draftMd == null ? null : db.sha256Hex(draftMd),
    draftSource: row?.draft_source ?? null, draftBy: row?.draft_by ?? null, draftAt: row?.draft_at ?? null,
    changeSummary: draftMd == null ? null : pd.changeSummary(md, draftMd),
  };
});

app.get("/admin/products/impact", async (req, reply) => {
  if (!adminOk(req)) return problem(reply, 401, "unauthorized", "غير مصرّح");
  if (!(await db.canRead())) return reply.code(503).send({ ok: false, error: "db_unavailable" });
  const product = productParam(req);
  if (!product) return problem(reply, 400, "invalid_field", "اسم المنتج مطلوب", "product");
  if (!(await db.tagState(product)).exists) return problem(reply, 404, "unknown_product", "لا منتج بهذا الاسم", "product");
  return { ok: true, product, embedded: pd.isEmbeddedProduct(product), ...(await db.impactOf(product)) };
});

/** Shared field rules for a package body. Returns the clean shape or the offending field. */
function readPackageBody(b: Record<string, unknown>):
  { name: string; listPrice: number; years: number; scope: string | null } | { bad: string } {
  const name = String(b.name ?? "").trim().replace(/\s+/g, " ");
  if (!name || name.length > 60) return { bad: "name" };
  const listPrice = Number(b.listPrice);
  if (!Number.isInteger(listPrice) || listPrice < 0 || listPrice > 1e12) return { bad: "listPrice" };
  const years = Number(b.years ?? 1);
  if (!Number.isInteger(years) || years < 1 || years > 10) return { bad: "years" };
  const scopeRaw = b.scope == null ? "" : String(b.scope).trim();
  if (scopeRaw.length > 120) return { bad: "scope" };
  return { name, listPrice, years, scope: scopeRaw || null };
}

app.post("/admin/products", async (req, reply) => {
  if (!adminOk(req)) return problem(reply, 401, "unauthorized", "غير مصرّح");
  const b = (req.body ?? {}) as Record<string, unknown>;
  const named = pd.normalizeProductName(b.name);
  if (!named.ok) return problem(reply, 400, "invalid_name", named.reason, "name");
  const owner = b.owner == null ? null : String(b.owner).trim().replace(/\s+/g, " ") || null;
  if (owner && owner.length > 60) return problem(reply, 400, "invalid_field", "اسم المسؤول أطول من 60 حرفًا", "owner");
  const pricingNote = b.pricingNote == null ? null : String(b.pricingNote).trim() || null;
  if (pricingNote && pricingNote.length > 120) return problem(reply, 400, "invalid_field", "ملاحظة التسعير أطول من 120 حرفًا", "pricingNote");
  let sectorId: number | null = null;
  if (b.sectorId != null && b.sectorId !== "") {
    sectorId = Number(b.sectorId);
    if (!Number.isInteger(sectorId) || !(await db.listSectors()).some((s) => s.id === sectorId)) {
      return problem(reply, 400, "invalid_field", "قطاع غير معروف", "sectorId");
    }
  }
  let firstPackage: { name: string; listPrice: number; years: number; scope: string | null } | null = null;
  if (b.firstPackage != null && typeof b.firstPackage === "object") {
    const pk = readPackageBody(b.firstPackage as Record<string, unknown>);
    if ("bad" in pk) return problem(reply, 400, "invalid_field", "حقل الباقة غير صالح: " + pk.bad, "firstPackage." + pk.bad);
    firstPackage = pk;
  }
  if (!(await db.canRead())) return reply.code(503).send({ ok: false, error: "db_unavailable" });
  const r = await db.createProduct({ name: named.name, sectorId, owner, pricingNote, firstPackage }, adminName(req));
  if (r === "exists") return problem(reply, 409, "name_exists", "الاسم مستخدم لمنتج آخر", "name");
  if (r === "unknown_sector") return problem(reply, 400, "invalid_field", "قطاع غير معروف", "sectorId");
  // A create can match files already uploaded under this name (spec F) — the assistant must see them.
  await agent.refreshKb();
  const row = await productRow(named.name);
  reply.code(201).header("Location", "/admin/products?product=" + encodeURIComponent(named.name));
  return { ok: true, product: row };
});

app.patch("/admin/products", async (req, reply) => {
  if (!adminOk(req)) return problem(reply, 401, "unauthorized", "غير مصرّح");
  const product = productParam(req);
  if (!product) return problem(reply, 400, "invalid_field", "اسم المنتج مطلوب", "product");
  const b = (req.body ?? {}) as Record<string, unknown>;
  const patch: { sectorId?: number | null; owner?: string | null; pricingNote?: string | null; divisionId?: number | null } = {};
  if ("sectorId" in b) {
    if (b.sectorId == null || b.sectorId === "") patch.sectorId = null;
    else {
      const id = Number(b.sectorId);
      if (!Number.isInteger(id) || !(await db.listSectors()).some((s) => s.id === id)) {
        return problem(reply, 400, "invalid_field", "قطاع غير معروف", "sectorId");
      }
      patch.sectorId = id;
    }
  }
  if ("owner" in b) {
    const owner = b.owner == null ? null : String(b.owner).trim().replace(/\s+/g, " ") || null;
    if (owner && owner.length > 60) return problem(reply, 400, "invalid_field", "اسم المسؤول أطول من 60 حرفًا", "owner");
    patch.owner = owner;
  }
  if ("pricingNote" in b) {
    const note = b.pricingNote == null ? null : String(b.pricingNote).trim() || null;
    if (note && note.length > 120) return problem(reply, 400, "invalid_field", "ملاحظة التسعير أطول من 120 حرفًا", "pricingNote");
    patch.pricingNote = note;
  }
  // «القسم»: the company unit that owns this product (divisions), not «القطاع» (sectors) above.
  if ("divisionId" in b) {
    if (b.divisionId == null || b.divisionId === "") patch.divisionId = null;
    else {
      const id = Number(b.divisionId);
      if (!Number.isInteger(id) || !(await db.listDivisions()).some((d) => d.id === id)) {
        return problem(reply, 400, "invalid_field", "قسم غير معروف", "divisionId");
      }
      patch.divisionId = id;
    }
  }
  if (!(await db.tagState(product)).exists) return problem(reply, 404, "unknown_product", "لا منتج بهذا الاسم", "product");
  if (Object.keys(patch).length && !(await db.patchProductMeta(product, patch))) {
    return reply.code(503).send({ ok: false, error: "db_unavailable" });
  }
  return { ok: true, product: await productRow(product) };
});

app.post("/admin/products/archive", async (req, reply) => {
  if (!adminOk(req)) return problem(reply, 401, "unauthorized", "غير مصرّح");
  const b = (req.body ?? {}) as Record<string, unknown>;
  const product = String(b.product ?? "").trim();
  if (!product) return problem(reply, 400, "invalid_field", "اسم المنتج مطلوب", "product");
  if (typeof b.archived !== "boolean") return problem(reply, 400, "invalid_field", "archived يجب أن يكون true أو false", "archived");
  // Their names are coupled to agent.ts PRODUCTS, the product lock and the boot seed (spec C, D).
  if (pd.isEmbeddedProduct(product)) {
    return problem(reply, 409, "embedded_product", "مضمَّن في كتالوج المساعد — الأرشفة تتطلب تحديث الكتالوج", "product");
  }
  if (!(await db.tagState(product)).exists) return problem(reply, 404, "unknown_product", "لا منتج بهذا الاسم", "product");
  await db.setArchived(product, b.archived);
  // The assistant stops (or resumes) using this product's knowledge and PDF now, not at restart.
  await agent.refreshKb();
  const impact = { embedded: false, ...(await db.impactOf(product)) };
  return { ok: true, product, archived: b.archived, impact };
});

app.post("/admin/products/knowledge/approve", async (req, reply) => {
  if (!adminOk(req)) return problem(reply, 401, "unauthorized", "غير مصرّح");
  const b = (req.body ?? {}) as Record<string, unknown>;
  const product = String(b.product ?? "").trim();
  const draftHash = String(b.draftHash ?? "").trim().toLowerCase();
  if (!product) return problem(reply, 400, "invalid_field", "اسم المنتج مطلوب", "product");
  if (!/^[0-9a-f]{64}$/.test(draftHash)) return problem(reply, 400, "invalid_field", "draftHash مطلوب", "draftHash");
  const r = await db.approveKbDraft(product, draftHash, adminName(req));
  if (r === "no_draft") return problem(reply, 404, "no_draft", "لا مسودة لهذا المنتج", "product");
  if (r === "stale") return problem(reply, 409, "stale_draft", "تغيّرت المسودة منذ فتحها", "draftHash");
  await agent.refreshKb();
  return { ok: true };
});

app.post("/admin/products/knowledge/approve-current", async (req, reply) => {
  if (!adminOk(req)) return problem(reply, 401, "unauthorized", "غير مصرّح");
  const b = (req.body ?? {}) as Record<string, unknown>;
  const product = String(b.product ?? "").trim();
  const contentHash = String(b.contentHash ?? "").trim().toLowerCase();
  if (!product) return problem(reply, 400, "invalid_field", "اسم المنتج مطلوب", "product");
  if (!/^[0-9a-f]{64}$/.test(contentHash)) return problem(reply, 400, "invalid_field", "contentHash مطلوب", "contentHash");
  const r = await db.approveKbCurrent(product, contentHash, adminName(req));
  if (r === "no_knowledge") return problem(reply, 404, "no_knowledge", "لا نص معرفة لهذا المنتج", "product");
  if (r === "stale") return problem(reply, 409, "stale_content", "تغيّر النص منذ فتحه", "contentHash");
  await agent.refreshKb();
  return { ok: true };
});

app.post("/admin/products/knowledge/discard", async (req, reply) => {
  if (!adminOk(req)) return problem(reply, 401, "unauthorized", "غير مصرّح");
  const product = String((req.body as any)?.product ?? "").trim();
  if (!product) return problem(reply, 400, "invalid_field", "اسم المنتج مطلوب", "product");
  if (!(await db.discardKbDraft(product))) return problem(reply, 404, "no_draft", "لا مسودة لهذا المنتج", "product");
  await agent.refreshKb();   // a no-op for the runtime, kept so every knowledge write ends the same way
  return { ok: true };
});

app.post("/admin/products/reconcile", async (req, reply) => {
  if (!adminOk(req)) return problem(reply, 401, "unauthorized", "غير مصرّح");
  const b = (req.body ?? {}) as Record<string, unknown>;
  const from = String(b.from ?? "").trim();
  const to = String(b.to ?? "").trim();
  const kind = String(b.kind ?? "");
  if (!from) return problem(reply, 400, "invalid_field", "المصدر مطلوب", "from");
  if (kind !== "kb" && kind !== "asset") return problem(reply, 400, "invalid_field", "kind يجب أن يكون kb أو asset", "kind");
  const target = await db.tagState(to);
  if (!to || to.startsWith("__") || !target.exists || target.archived) {
    return problem(reply, 400, "invalid_target", "الوجهة يجب أن تكون منتجًا فعّالًا", "to");
  }
  const r = await db.reconcileFile(from, to, kind);
  if (r === "unknown_source") return problem(reply, 404, "unknown_source", "لا ملف بهذا الاسم", "from");
  if (r === "target_has") {
    return problem(reply, 409, kind === "kb" ? "target_has_kb" : "target_has_asset",
      kind === "kb" ? "المنتج الوجهة لديه ملف معرفة بالفعل" : "المنتج الوجهة لديه ملف تعريفي بالفعل", "to");
  }
  await agent.refreshKb();
  return { ok: true };
});

app.get("/admin/sectors", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized", error: "غير مصرّح" });
  return { ok: true, sectors: await db.listSectors() };
});

// ---- «إعدادات النظام»: the ladder, the divisions, the team -------------------------------
// Every write goes through config-domain, which the browser also runs — so a control the screen
// disables and a write the server refuses give the SAME reason, in the same words.

app.get("/admin/config", async (req, reply) => {
  if (!adminOk(req)) return problem(reply, 401, "unauthorized", "غير مصرّح");
  if (!(await db.canRead())) return reply.code(503).send({ ok: false, error: "db_unavailable" });
  const [stages, divisions, team] = await Promise.all([db.listStages(), db.listDivisions(), db.listMembers()]);
  return { ok: true, stages, divisions, team };
});

app.post("/admin/config/stages", async (req, reply) => {
  if (!adminOk(req)) return problem(reply, 401, "unauthorized", "غير مصرّح");
  const stages = await db.listStages();
  const checked = sysCfg.checkStage((req.body ?? {}) as sysCfg.StageInput, stages.map((s) => s.key));
  if (!checked.ok) return problem(reply, 400, checked.code, checked.reason, checked.field);
  const made = await db.createStage(checked.value);
  if (!made) return problem(reply, 409, "key_exists", "توجد مرحلة بهذا المعرّف", "key");
  log({ at: "config", msg: "stage added", key: checked.value.key, by: adminName(req) });
  return reply.code(201).header("Location", "/admin/config/stages/" + encodeURIComponent(checked.value.key))
    .send({ ok: true, stage: checked.value });
});

app.patch("/admin/config/stages/:key", async (req, reply) => {
  if (!adminOk(req)) return problem(reply, 401, "unauthorized", "غير مصرّح");
  const key = String((req.params as any).key || "");
  const stages = await db.listStages();
  const current = stages.find((s) => s.key === key);
  if (!current) return problem(reply, 404, "unknown_stage", "لا مرحلة بهذا المعرّف", "key");
  const body = (req.body ?? {}) as Record<string, unknown>;
  // A PATCH carries only what changed; the rest is the row as it stands, so a single field edit
  // cannot blank the others.
  const merged: sysCfg.StageInput = {
    label: "label" in body ? body.label : current.label,
    weightPct: "weightPct" in body ? body.weightPct : current.weightPct,
    position: "position" in body ? body.position : current.position,
    slaDays: "slaDays" in body ? body.slaDays : current.slaDays,
    active: "active" in body ? body.active : current.active,
    exitCriterion: "exitCriterion" in body ? body.exitCriterion : current.exitCriterion,
  };
  const checked = sysCfg.checkStage(merged, stages.map((s) => s.key), key);
  if (!checked.ok) return problem(reply, 400, checked.code, checked.reason, checked.field);
  const ok = await db.updateStage(key, checked.value);
  if (!ok) return problem(reply, 404, "unknown_stage", "لا مرحلة بهذا المعرّف", "key");
  log({ at: "config", msg: "stage edited", key, by: adminName(req) });
  return { ok: true, stage: { ...checked.value, key } };
});

app.delete("/admin/config/stages/:key", async (req, reply) => {
  if (!adminOk(req)) return problem(reply, 401, "unauthorized", "غير مصرّح");
  const key = String((req.params as any).key || "");
  const stages = await db.listStages();
  const current = stages.find((s) => s.key === key);
  if (!current) return problem(reply, 404, "unknown_stage", "لا مرحلة بهذا المعرّف", "key");
  const checked = sysCfg.checkStageDelete(key, current.openLines, db.SEEDED_STAGE_KEYS);
  if (!checked.ok) return problem(reply, 409, checked.code, checked.reason, checked.field);
  await db.deleteStage(key);
  log({ at: "config", msg: "stage deleted", key, by: adminName(req) });
  return { ok: true, key };
});

app.post("/admin/config/divisions", async (req, reply) => {
  if (!adminOk(req)) return problem(reply, 401, "unauthorized", "غير مصرّح");
  const body = (req.body ?? {}) as sysCfg.DivisionInput;
  const [divisions, owner] = await Promise.all([
    db.listDivisions(),
    body.ownerMemberId ? db.memberById(Number(body.ownerMemberId)) : Promise.resolve(null),
  ]);
  const checked = sysCfg.checkDivision(body, divisions.map((d) => d.name), owner);
  if (!checked.ok) return problem(reply, 400, checked.code, checked.reason, checked.field);
  const id = await db.createDivision(checked.value);
  if (id == null) return problem(reply, 409, "name_exists", "يوجد قسم بهذا الاسم", "name");
  log({ at: "config", msg: "division added", id, by: adminName(req) });
  return reply.code(201).header("Location", "/admin/config/divisions/" + id).send({ ok: true, id, division: checked.value });
});

app.patch("/admin/config/divisions/:id", async (req, reply) => {
  if (!adminOk(req)) return problem(reply, 401, "unauthorized", "غير مصرّح");
  const id = Number((req.params as any).id);
  const divisions = await db.listDivisions();
  const current = divisions.find((d) => d.id === id);
  if (!current) return problem(reply, 404, "unknown_division", "لا قسم بهذا المعرّف", "id");
  const body = (req.body ?? {}) as Record<string, unknown>;
  const merged: sysCfg.DivisionInput = {
    name: "name" in body ? body.name : current.name,
    ownerMemberId: "ownerMemberId" in body ? body.ownerMemberId : current.ownerMemberId,
    active: "active" in body ? body.active : current.active,
  };
  const owner = merged.ownerMemberId ? await db.memberById(Number(merged.ownerMemberId)) : null;
  const checked = sysCfg.checkDivision(merged, divisions.map((d) => d.name), owner, current.name);
  if (!checked.ok) return problem(reply, 400, checked.code, checked.reason, checked.field);
  const ok = await db.updateDivision(id, checked.value);
  if (!ok) return problem(reply, 404, "unknown_division", "لا قسم بهذا المعرّف", "id");
  return { ok: true, id, division: checked.value };
});

app.delete("/admin/config/divisions/:id", async (req, reply) => {
  if (!adminOk(req)) return problem(reply, 401, "unauthorized", "غير مصرّح");
  const id = Number((req.params as any).id);
  const current = (await db.listDivisions()).find((d) => d.id === id);
  if (!current) return problem(reply, 404, "unknown_division", "لا قسم بهذا المعرّف", "id");
  const checked = sysCfg.checkDivisionDelete(current.products, current.members);
  if (!checked.ok) return problem(reply, 409, checked.code, checked.reason, checked.field);
  await db.deleteDivision(id);
  return { ok: true, id };
});

app.post("/admin/config/team", async (req, reply) => {
  if (!adminOk(req)) return problem(reply, 401, "unauthorized", "غير مصرّح");
  const checked = sysCfg.checkMember((req.body ?? {}) as sysCfg.MemberInput);
  if (!checked.ok) return problem(reply, 400, checked.code, checked.reason, checked.field);
  if (checked.value.divisionId != null && !(await db.listDivisions()).some((d) => d.id === checked.value.divisionId)) {
    return problem(reply, 400, "unknown_division", "لا قسم بهذا المعرّف", "divisionId");
  }
  const id = await db.createMember(checked.value);
  if (id == null) return problem(reply, 409, "email_exists", "هذا البريد مسجّل لعضو آخر", "email");
  log({ at: "config", msg: "team member added", id, by: adminName(req) });
  return reply.code(201).header("Location", "/admin/config/team/" + id).send({ ok: true, id, member: checked.value });
});

app.patch("/admin/config/team/:id", async (req, reply) => {
  if (!adminOk(req)) return problem(reply, 401, "unauthorized", "غير مصرّح");
  const id = Number((req.params as any).id);
  const current = await db.memberById(id);
  if (!current) return problem(reply, 404, "unknown_member", "لا عضو بهذا المعرّف", "id");
  const body = (req.body ?? {}) as Record<string, unknown>;
  const merged: sysCfg.MemberInput = {
    name: "name" in body ? body.name : current.name,
    email: "email" in body ? body.email : current.email,
    role: "role" in body ? body.role : current.role,
    divisionId: "divisionId" in body ? body.divisionId : current.divisionId,
    active: "active" in body ? body.active : current.active,
  };
  const checked = sysCfg.checkMember(merged);
  if (!checked.ok) return problem(reply, 400, checked.code, checked.reason, checked.field);
  const out = await db.updateMember(id, checked.value);
  if (out === "email_taken") return problem(reply, 409, "email_exists", "هذا البريد مسجّل لعضو آخر", "email");
  if (out === "missing") return problem(reply, 404, "unknown_member", "لا عضو بهذا المعرّف", "id");
  return { ok: true, id, member: checked.value };
});

app.delete("/admin/config/team/:id", async (req, reply) => {
  if (!adminOk(req)) return problem(reply, 401, "unauthorized", "غير مصرّح");
  const id = Number((req.params as any).id);
  const out = await db.deleteMember(id);
  if (out === "referenced") return problem(reply, 409, "member_referenced", "عليه تصعيدات مسجّلة — أوقفه بدل حذفه", "id");
  if (out === "missing") return problem(reply, 404, "unknown_member", "لا عضو بهذا المعرّف", "id");
  if (typeof out === "object") return problem(reply, 409, "member_owns_accounts", "مسؤول عن " + out.owns + " من العملاء — انقلهم إلى عضو آخر أو أوقفه بدل حذفه", "id");
  return { ok: true, id };
});

// ---- escalation and «طلب دعم» ------------------------------------------------------------
// RECORDED, NOT SENT (founder, 2026-09-13): no mail sender is configured, so the row carries
// delivery:"recorded" and the screen says so. Nothing here contacts a customer — the recipient is
// an employee in the team directory, and even that is not messaged yet.

app.get("/admin/escalations", async (req, reply) => {
  if (!adminOk(req)) return problem(reply, 401, "unauthorized", "غير مصرّح");
  if (!(await db.canRead())) return reply.code(503).send({ ok: false, error: "db_unavailable" });
  const q = (req.query as any) || {};
  const oppId = q.opp === undefined || q.opp === "" ? undefined : Number(q.opp);
  if (oppId !== undefined && !Number.isInteger(oppId)) return problem(reply, 400, "invalid_field", "رقم الفرصة غير صحيح", "opp");
  return { ok: true, escalations: await db.listEscalations(oppId), emailConfigured: false };
});

app.post("/admin/opps/:id/escalate", async (req, reply) => {
  if (!adminOk(req)) return problem(reply, 401, "unauthorized", "غير مصرّح");
  const oppId = Number((req.params as any).id);
  if (!Number.isInteger(oppId)) return problem(reply, 400, "invalid_field", "رقم الفرصة غير صحيح", "id");
  const line = (await db.listOpps()).find((o) => Number(o.id) === oppId);
  if (!line) return problem(reply, 404, "unknown_opp", "لا فرصة بهذا الرقم", "id");
  const body = (req.body ?? {}) as sysCfg.EscalationInput;
  const member = body.memberId ? await db.memberById(Number(body.memberId)) : null;
  const checked = sysCfg.checkEscalation(body, member);
  if (!checked.ok) return problem(reply, 400, checked.code, checked.reason, checked.field);
  const row = await db.createEscalation({
    oppId, kind: checked.value.kind, reason: checked.value.reason,
    member: { id: member!.id, name: member!.name, email: member!.email },
    by: adminName(req), delivery: "recorded",
  });
  if (!row) return reply.code(503).send({ ok: false, error: "db_unavailable" });
  log({ at: "escalation", msg: "recorded", kind: checked.value.kind, opp: oppId, to: member!.email, by: adminName(req) });
  return reply.code(201).header("Location", "/admin/escalations?opp=" + oppId)
    .send({ ok: true, escalation: row, emailConfigured: false });
});

app.post("/admin/escalations/:id/resolve", async (req, reply) => {
  if (!adminOk(req)) return problem(reply, 401, "unauthorized", "غير مصرّح");
  const id = Number((req.params as any).id);
  if (!Number.isInteger(id)) return problem(reply, 400, "invalid_field", "رقم غير صحيح", "id");
  const ok = await db.resolveEscalation(id, adminName(req));
  if (!ok) return problem(reply, 404, "unknown_escalation", "لا تصعيد مفتوح بهذا الرقم", "id");
  return { ok: true, id };
});

// ---- «مؤشرات استخدام العملاء» and the campaign opportunities they produce ----------------------
// Client A's BRD v1.0 (2026-09-15). Every rule is in indicator-domain.ts; these routes load, check
// and store. None of them sends anything: a suggestion becomes a campaign only through the wizard's
// launch, which keeps its human confirmation.

/** Today as a calendar day in Riyadh — «تاريخ تحديث البيانات» is a day a manager typed, not an instant. */
function riyadhToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
}
function suppressionDays(): number {
  const n = Number(process.env.SUPPRESSION_DAYS);
  return Number.isInteger(n) && n >= 0 && n <= 365 ? n : ind.DEFAULT_SUPPRESSION_DAYS;
}
async function liveProductNames(): Promise<string[]> {
  return (await productRows()).filter((p) => !p.archived).map((p) => String(p.product));
}
/** The members a create/update carries, cleaned. Only ids and short strings survive. */
function membersFrom(body: any): db.IndicatorMemberIn[] | null {
  if (!Array.isArray(body?.members)) return null;
  const clip = (v: unknown, n: number) => (v == null ? null : String(v).trim().slice(0, n) || null);
  return body.members.slice(0, ind.INDICATOR_MEMBERS_MAX + 1).map((m: any) => ({
    entityId: Number(m?.entityId), value: clip(m?.value, 60), period: clip(m?.period, 40), note: clip(m?.note, 200),
    sourceName: clip(m?.sourceName, 120), matchedBy: ["phone", "code", "name", "manual", "review"].includes(String(m?.matchedBy)) ? String(m.matchedBy) : null,
  })).filter((m: db.IndicatorMemberIn) => Number.isSafeInteger(m.entityId) && m.entityId > 0);
}
function sourceFrom(body: any): { source: string; filename: string | null } {
  const s = ["manual", "file", "paste"].includes(String(body?.source)) ? String(body.source) : "manual";
  return { source: s, filename: s === "file" ? String(body?.sourceFilename || "").slice(0, 160) || null : null };
}
/** A path id Postgres can hold. «99999999999999999999» used to reach the driver and answer 500. */
function idParam(req: any): number | null {
  const n = Number((req.params as any).id);
  return Number.isSafeInteger(n) && n > 0 && n < 2 ** 53 ? n : null;
}
const INDICATOR_UPLOAD_MAX = 5 * 1024 * 1024;

app.get("/admin/indicators", async (req, reply) => {
  if (!adminOk(req)) return problem(reply, 401, "unauthorized", "غير مصرّح");
  if (!(await db.canRead())) return reply.code(503).send({ ok: false, error: "db_unavailable" });
  const [indicators, coverage, products] = await Promise.all([db.listIndicators(), db.indicatorCoverage(), liveProductNames()]);
  return { ok: true, indicators, coverage, products, today: riyadhToday(), suppressionDays: suppressionDays() };
});

/** Member ids per indicator, for the audience filters (BR-CAM-002, BR-CUS-003). */
app.get("/admin/indicators/membership", async (req, reply) => {
  if (!adminOk(req)) return problem(reply, 401, "unauthorized", "غير مصرّح");
  if (!(await db.canRead())) return reply.code(503).send({ ok: false, error: "db_unavailable" });
  return { ok: true, indicators: await db.indicatorRuleInput() };
});

app.get("/admin/indicators/for-customer/:phone", async (req, reply) => {
  if (!adminOk(req)) return problem(reply, 401, "unauthorized", "غير مصرّح");
  const phone = String((req.params as any).phone || "").replace(/\D/g, "").slice(0, 20);
  if (!phone) return problem(reply, 400, "invalid_field", "الرقم مطلوب", "phone");
  if (!(await db.canRead())) return reply.code(503).send({ ok: false, error: "db_unavailable" });
  return { ok: true, indicators: await db.indicatorsForPhone(phone), today: riyadhToday() };
});

app.get("/admin/indicators/:id", async (req, reply) => {
  if (!adminOk(req)) return problem(reply, 401, "unauthorized", "غير مصرّح");
  const id = idParam(req);
  if (id == null) return problem(reply, 400, "invalid_field", "رقم المؤشر غير صحيح", "id");
  if (!(await db.canRead())) return reply.code(503).send({ ok: false, error: "db_unavailable" });
  const row = await db.indicatorById(id);
  if (!row) return problem(reply, 404, "unknown_indicator", "لا مؤشر بهذا الرقم", "id");
  return { ok: true, indicator: row, today: riyadhToday() };
});

/** BR-IND-003, read-only: a pasted text or an uploaded file comes back as rows in three states
 *  (مطابق · يحتاج مراجعة · غير مطابق) with candidates. Nothing is stored until the manager saves. */
app.post("/admin/indicators/preview", async (req, reply) => {
  if (!adminOk(req)) return problem(reply, 401, "unauthorized", "غير مصرّح");
  let grid: string[][];
  let filename: string | null = null;
  let overflow = false;
  try {
    if ((req as any).isMultipart && (req as any).isMultipart()) {
      // Its own ceiling, far under the global 25MB: an indicator sheet of 5,000 rows is well under 1MB.
      const file = await (req as any).file({ limits: { fileSize: INDICATOR_UPLOAD_MAX, files: 1 } });
      if (!file) return problem(reply, 400, "file_required", "أرفق ملف Excel أو CSV", "file");
      filename = String(file.filename || "indicator.xlsx").slice(0, 160);
      const buf = await file.toBuffer();
      if (file.file?.truncated || buf.length >= INDICATOR_UPLOAD_MAX) return problem(reply, 413, "file_too_large", "الملف أكبر من 5 ميغابايت", "file");
      ({ grid, overflow } = audience.gridFromFile(buf, filename));
    } else {
      const text = String((req.body as any)?.text ?? "");
      if (!text.trim()) return problem(reply, 400, "text_required", "الصق محتوى الملف أولًا", "text");
      grid = ind.gridFromText(text.slice(0, 600_000));
    }
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e);
    if (/fileSize|too large/i.test(msg)) return problem(reply, 413, "file_too_large", "الملف أكبر من 5 ميغابايت", "file");
    return problem(reply, 422, "unreadable_file", "تعذّرت قراءة الملف: " + msg.slice(0, 160), "file");
  }
  const { rows, headerFound } = ind.rowsFromGrid(grid);
  if (overflow || rows.length > ind.INDICATOR_MEMBERS_MAX) return problem(reply, 422, "too_many_rows", "الملف يتجاوز 5000 صف — قسّمه إلى مؤشرات أصغر", "file");
  if (!rows.length) return problem(reply, 422, "no_rows", filename ? "الملف لا يحتوي صفوف بيانات." : "لا صفوف بيانات في المحتوى الملصق.", "file");
  if (!(await db.canRead())) return reply.code(503).send({ ok: false, error: "db_unavailable" });
  const entities = (await db.listEntities()).map((e) => ({ id: e.id, name: e.name, phone: e.phone, code: ind.entityCodeOf(e.attrs) }));
  const matched = ind.matchRows(rows, entities);
  const totals = { total: matched.length, matched: 0, review: 0, unmatched: 0 };
  for (const r of matched) totals[r.status]++;
  // The same customer twice in one file is a data-quality fact the manager should see (NFR-006).
  const seen = new Map<number, number>();
  for (const r of matched) if (r.entityId != null) seen.set(r.entityId, (seen.get(r.entityId) || 0) + 1);
  const duplicates = [...seen.values()].filter((n) => n > 1).length;
  return { ok: true, filename, headerFound, totals, duplicates, rows: matched, customers: entities.length };
});

function indicatorBody(req: any): any {
  const body = req.body;
  return body && typeof body === "object" && !Array.isArray(body) ? body : {};
}
function indicatorInput(body: any): Record<string, unknown> {
  return body.indicator && typeof body.indicator === "object" && !Array.isArray(body.indicator) ? body.indicator : {};
}

app.post("/admin/indicators", async (req, reply) => {
  if (!adminOk(req)) return problem(reply, 401, "unauthorized", "غير مصرّح");
  if (!(await db.canRead())) return reply.code(503).send({ ok: false, error: "db_unavailable" });
  const body = indicatorBody(req);
  const draft = body.draft === true;
  const checked = ind.checkIndicator(indicatorInput(body), await liveProductNames(), riyadhToday(), draft);
  if (!checked.ok) return problem(reply, 400, checked.code, checked.reason, checked.field);
  if (ind.isDuplicateIndicatorName(checked.value.name, await db.listIndicators(), 0)) {
    return problem(reply, 409, "name_exists", "يوجد مؤشر بهذا الاسم — اختر اسمًا يميّزه", "name");
  }
  const members = membersFrom(body) ?? [];
  const count = ind.checkMemberCount(members.length, draft);
  if (!count.ok) return problem(reply, 400, count.code, count.reason, count.field);
  const src = sourceFrom(body);
  const made = await db.createIndicator(checked.value, members, src.source, src.filename, adminName(req), draft);
  if (!made) return reply.code(503).send({ ok: false, error: "db_unavailable" });
  if (made.gone) return problem(reply, 409, "members_gone", "لم يُحفظ شيء: العملاء المختارون لم يعودوا في القائمة", "members");
  log({ at: "indicator", msg: "created", id: made.id, members: made.members, status: checked.value.status, by: adminName(req) });
  return reply.code(201).header("Location", "/admin/indicators/" + made.id).send({ ok: true, id: made.id, members: made.members });
});

app.patch("/admin/indicators/:id", async (req, reply) => {
  if (!adminOk(req)) return problem(reply, 401, "unauthorized", "غير مصرّح");
  const id = idParam(req);
  if (id == null) return problem(reply, 400, "invalid_field", "رقم المؤشر غير صحيح", "id");
  if (!(await db.canRead())) return reply.code(503).send({ ok: false, error: "db_unavailable" });
  const current = await db.indicatorById(id);
  if (!current) return problem(reply, 404, "unknown_indicator", "لا مؤشر بهذا الرقم", "id");
  const body = indicatorBody(req);
  const draft = body.draft === true;
  // Two tabs editing one indicator: the second save used to wipe the first silently, and re-activate a
  // row disabled in between (QA). The form sends the version it loaded; a mismatch is a conflict.
  if (body.ifUpdatedAt !== undefined && Number(body.ifUpdatedAt) !== current.updatedAt) {
    return problem(reply, 409, "stale_indicator", "عُدّل هذا المؤشر من مكان آخر بعد أن فتحته — أعد فتحه لترى آخر نسخة.", "ifUpdatedAt");
  }
  const inp = indicatorInput(body);
  // PATCH carries what changed; everything else is the row as it stands.
  const pick = (k: string, cur: unknown) => (Object.prototype.hasOwnProperty.call(inp, k) ? inp[k] : cur);
  const merged: ind.IndicatorInput = {
    name: pick("name", current.name), description: pick("description", current.description), product: pick("product", current.product),
    signal: pick("signal", current.signal), customerType: pick("customerType", current.customerType), status: pick("status", current.status),
    periodFrom: pick("periodFrom", current.periodFrom), periodTo: pick("periodTo", current.periodTo), dataUpdatedAt: pick("dataUpdatedAt", current.dataUpdatedAt),
  };
  // Its own product stays valid even if archived since: an edit that keeps it must not fail (QA).
  const allowed = await liveProductNames();
  if (current.product && !allowed.includes(current.product)) allowed.push(current.product);
  const checked = ind.checkIndicator(merged, allowed, riyadhToday(), draft);
  if (!checked.ok) return problem(reply, 400, checked.code, checked.reason, checked.field);
  if (ind.isDuplicateIndicatorName(checked.value.name, await db.listIndicators(), id)) {
    return problem(reply, 409, "name_exists", "يوجد مؤشر بهذا الاسم — اختر اسمًا يميّزه", "name");
  }
  const members = membersFrom(body);
  const count = ind.checkMemberCount(members ? members.length : current.memberCount, draft);
  if (!count.ok) return problem(reply, 400, count.code, count.reason, count.field);
  const src = members ? sourceFrom(body) : { source: null, filename: null };
  const done = await db.updateIndicator(id, checked.value, members, src.source, src.filename, adminName(req), draft);
  if (!done) return problem(reply, 404, "unknown_indicator", "لا مؤشر بهذا الرقم", "id");
  if (done.gone) return problem(reply, 409, "members_gone", "لم يُحفظ شيء: العملاء المختارون لم يعودوا في القائمة", "members");
  log({ at: "indicator", msg: "updated", id, replacedMembers: Boolean(members), members: done.members, by: adminName(req) });
  return { ok: true, id, members: done.members };
});

app.post("/admin/indicators/:id/status", async (req, reply) => {
  if (!adminOk(req)) return problem(reply, 401, "unauthorized", "غير مصرّح");
  const id = idParam(req);
  const status = String((req.body as any)?.status ?? "");
  if (id == null) return problem(reply, 400, "invalid_field", "رقم المؤشر غير صحيح", "id");
  if (status !== "active" && status !== "inactive") return problem(reply, 400, "invalid_status", "الحالة «نشط» أو «غير نشط»", "status");
  if (!(await db.canRead())) return reply.code(503).send({ ok: false, error: "db_unavailable" });
  const current = await db.indicatorById(id);
  if (!current) return problem(reply, 404, "unknown_indicator", "لا مؤشر بهذا الرقم", "id");
  if (current.status === "draft") return problem(reply, 409, "not_toggleable", "المسودة تُفعَّل بحفظها كاملة، لا من هنا", "status");
  const ok = await db.setIndicatorStatus(id, status, adminName(req));
  if (!ok) return reply.code(503).send({ ok: false, error: "db_unavailable" });
  log({ at: "indicator", msg: status, id, by: adminName(req) });
  return { ok: true, id, status };
});

app.get("/assets/indicator-template.xlsx", async (_req, reply) => {
  reply.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  reply.header("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent("قالب-مؤشر-الاستخدام.xlsx")}`);
  return audience.buildIndicatorTemplateXlsx();
});

/** BR-IND-007/008, BR-CAM-003, BR-MON-002 — and the adoption KPI beside them, so the recommendation
 *  engine is judged on the same screen it speaks on. */
app.get("/admin/campaign-suggestions", async (req, reply) => {
  if (!adminOk(req)) return problem(reply, 401, "unauthorized", "غير مصرّح");
  if (!(await db.canRead())) return reply.code(503).send({ ok: false, error: "db_unavailable" });
  const days = suppressionDays();
  const since = Date.now() - days * 86_400_000;
  const [indicators, entities, catalogue, recent, withOrigin, opps, dismissals] = await Promise.all([
    db.indicatorRuleInput(), db.entityIdentities(), productRows(), db.recentCampaignTargets(since), db.campaignsWithOrigin(), db.listOpps(), db.listDismissals(),
  ]);
  const suggestions = ind.suggestOpportunities({
    indicators, entities,
    products: catalogue.filter((p) => !p.archived).map((p) => ({ name: String(p.product), sector: (p.sector as string) ?? null, eligible: Boolean(p.eligible), why: p.eligible ? undefined : "لا يبيعه المساعد بعد" })),
    optedOutPhones: tracker.listContacts().filter((c) => c.optedOut).map((c) => c.phone),
    recentTargets: recent.filter((c) => c.product).flatMap((c) => c.phones.map((phone) => ({ phone, product: c.product as string, at: c.createdAt }))),
    openOpportunities: opps.filter((o) => o.phone && !sysCfg.isTerminalStageKey(o.stage)).map((o) => ({ phone: o.phone as string, product: o.product })),
    dismissedKeys: dismissals.map((d) => d.key),
    now: Date.now(), todayIso: riyadhToday(), suppressionDays: days,
  });
  // KPI «Recommendation Adoption» (BRD §23). A campaign built from an indicator's own list (rule
  // «indicator») is attributed but is not a recommendation adopted. Launched-as-proposed and
  // launched-after-changes are counted apart, so an edited audience is not reported as the engine's win.
  const adopted = withOrigin.filter((c) => (c.origin as any).suggestionKey && (c.origin as any).rule !== "indicator");
  return {
    ok: true, suggestions, suppressionDays: days,
    activeIndicators: indicators.filter((i) => ind.isIndicatorUsable(i.status)).length,
    adoption: {
      launched: adopted.length,
      launchedAsProposed: adopted.filter((c) => (c.origin as any).modified !== true).length,
      dismissed: dismissals.length, open: suggestions.length,
      campaigns: adopted.slice(0, 20).map((c) => ({ id: c.id, name: c.name, product: c.product, createdAt: c.createdAt, rule: (c.origin as any).rule ?? null, modified: (c.origin as any).modified === true })),
    },
    dismissals: dismissals.slice(0, 20),
  };
});

app.post("/admin/campaign-suggestions/dismiss", async (req, reply) => {
  if (!adminOk(req)) return problem(reply, 401, "unauthorized", "غير مصرّح");
  const key = String((req.body as any)?.key ?? "").slice(0, 400);
  if (key.split("|").length !== 4) return problem(reply, 400, "invalid_field", "مفتاح التوصية غير صحيح", "key");
  const title = String((req.body as any)?.title ?? "").trim().slice(0, 160) || null;
  const reason = String((req.body as any)?.reason ?? "").trim().slice(0, 200) || null;
  const ids = Array.isArray((req.body as any)?.indicatorIds)
    ? [...new Set<number>((req.body as any).indicatorIds.map(Number).filter((n: number) => Number.isSafeInteger(n) && n > 0))].slice(0, 50) : [];
  if (!(await db.dismissSuggestion(key, title, ids, reason, adminName(req)))) return reply.code(503).send({ ok: false, error: "db_unavailable" });
  log({ at: "suggestion", msg: "dismissed", key, by: adminName(req) });
  return { ok: true, key };
});

app.post("/admin/campaign-suggestions/restore", async (req, reply) => {
  if (!adminOk(req)) return problem(reply, 401, "unauthorized", "غير مصرّح");
  const key = String((req.body as any)?.key ?? "").slice(0, 400);
  if (!(await db.canRead())) return reply.code(503).send({ ok: false, error: "db_unavailable" });
  if (!(await db.restoreSuggestion(key))) return problem(reply, 404, "unknown_dismissal", "لا توصية متجاهلة بهذا المفتاح", "key");
  return { ok: true, key };
});

/** BR-CAM-007 — a warning the wizard shows before launch. Read-only, windowed in SQL. */
app.post("/admin/campaign/repeat-check", async (req, reply) => {
  if (!adminOk(req)) return problem(reply, 401, "unauthorized", "غير مصرّح");
  const product = String((req.body as any)?.product ?? "").trim().slice(0, 120);
  const phones = Array.isArray((req.body as any)?.phones) ? (req.body as any).phones.slice(0, 5000).map((p: unknown) => String(p).slice(0, 20)) : [];
  if (!(await db.canRead())) return reply.code(503).send({ ok: false, error: "db_unavailable" });
  const days = suppressionDays();
  const campaigns = await db.recentCampaignTargets(Date.now() - days * 86_400_000);
  return { ok: true, ...ind.checkRepeatTargeting(product, phones, campaigns, Date.now(), days) };
});

// ---- the four named reports (R11) and the four-quarter view (R13) -------------------------
// READ-ONLY, endpoints only. «التقارير» is a door with no screen yet; saying otherwise is the
// mistake this project has already made once.

app.get("/admin/reports", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized", error: "غير مصرّح" });
  return {
    ok: true,
    reports: reports.REPORTS.map((r) => ({
      id: r.id, title: r.title, question: r.question, source: r.source, dept: r.dept,
      outcomeKeys: r.outcomeKeys,
    })),
  };
});

app.get("/admin/reports/:id", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized", error: "غير مصرّح" });
  const def = reports.reportById(String((req.params as any).id ?? ""));
  if (!def) return reply.code(404).send({ ok: false, error: "unknown_report" });
  const rows = await db.runReport(def);
  return {
    ok: true,
    report: { id: def.id, title: def.title, question: def.question },
    // The empty state travels WITH the data, so a screen cannot render a blank table: an empty
    // result and a broken query look identical to the reader unless the report says which it is.
    empty: rows.length === 0 ? { title: def.emptyTitle, body: def.emptyBody } : null,
    valueBasis: { label: sales.VALUE_BASIS_LABEL, note: sales.VALUE_BASIS_NOTE },
    count: rows.length,
    totalValue: rows.reduce((n, r) => n + r.value, 0),
    rows,
  };
});

app.get("/admin/reports/rollups", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized", error: "غير مصرّح" });
  const [byDept, byReason] = await Promise.all([db.blockedByDept(), db.lossesByReason()]);
  // The outcome KEY is a database value; the label a person reads comes from the shipped ladder,
  // so the screen cannot invent a name for a loss reason the engine does not have.
  const label = (k: string) => sales.STAGE_OUTCOMES.find((o) => o.key === k)?.label ?? k;
  return {
    ok: true,
    byDept,
    byReason: byReason.map((r) => ({ ...r, label: label(r.outcomeKey) })),
    valueBasis: { label: sales.VALUE_BASIS_LABEL, note: sales.VALUE_BASIS_NOTE },
    empty: {
      dept: { title: "لا شيء معلّق على أي إدارة", body: "لا إجراء مفتوح مسنَد إلى إدارة." },
      reason: { title: "لا خسائر مسجّلة", body: "لم تُغلق أي صفقة بنتيجة خسارة." },
    },
  };
});

// «نظرة تنفيذية» — the five pipeline reports (pipeline-report-domain.ts). Computed on read from the
// opportunities table and the stage ledger; nothing is cached, so the page can never disagree with
// the board it sits beside.
app.get("/admin/reports/pipeline", async (req, reply) => {
  if (!adminOk(req)) return problem(reply, 401, "unauthorized", "غير مصرّح");
  // A database blip must not read as «no pipeline»: the V5 board once said «لا فرص مسجّلة بعد» over
  // six real deals for exactly this reason.
  if (!(await db.canRead())) return reply.code(503).send({ ok: false, error: "db_unavailable" });
  const days = Number((req.query as any)?.days ?? 30);
  if (!Number.isInteger(days) || days < 7 || days > 365) return problem(reply, 400, "invalid_field", "المدة بين 7 و365 يومًا", "days");
  const [opps, events, ladder] = await Promise.all([db.listOpps(), db.listStageEvents(), db.listStages()]);
  const report = pipelineReport.buildPipelineReport({
    now: Date.now(), days, events,
    stages: ladder.map((s) => ({
      key: s.key, label: s.label, position: s.position, weightPct: s.weightPct,
      // A rung the admin gave no SLA still stalls at the compiled default when the ladder says so,
      // the same rule the board's «متأخرة» applies.
      slaDays: s.slaDays ?? (sales.STALL_STAGES.includes(s.key) ? sales.STALL_DAYS : null),
      terminal: s.terminal,
    })),
    lines: opps.map((o) => {
      const facts = { stage: o.stage, salePrice: Number(o.sale_price), years: Number(o.years), quantity: Number(o.qty),
        discountPercent: Number(o.discount), stageEnteredAt: Number(o.stage_at) };
      return {
        id: o.id, stage: o.stage, product: o.product, source: o.source,
        value: calculateLineValue(facts), priced: isLinePriced(facts),
        createdAt: Number(o.created_at), stageAt: Number(o.stage_at),
      };
    }),
    sourceLabels: OPP_SOURCE_LABELS,
  });
  return {
    ok: true, report,
    stages: ladder.map((s) => ({ key: s.key, label: s.label, position: s.position, terminal: s.terminal })),
    sourceLabels: OPP_SOURCE_LABELS,
    valueBasis: { label: sales.VALUE_BASIS_LABEL, note: sales.VALUE_BASIS_NOTE },
  };
});

app.get("/admin/sales/quarters", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized", error: "غير مصرّح" });
  const q = (req.query as any) || {};
  const fsm = fiscalStartMonth();
  const now = sales.riyadhFiscalPeriod(Date.now(), fsm);
  const year = Number(q.year) || now.year;
  if (!Number.isFinite(year) || year < 2020 || year > 2100) {
    return reply.code(400).send({ ok: false, error: "invalid_field", field: "year" });
  }
  const bounds = [1, 2, 3, 4].map((quarter) => {
    const b = sales.riyadhPeriodBounds(year, quarter, fsm);
    return { quarter, startMs: b.startMs, endMs: b.endMs };
  });
  return {
    ok: true, year, fiscalStartMonth: fsm, currentQuarter: year === now.year ? now.quarter : null,
    // Stated, never implied. The accounting basis is still undecided, so the screen is given the
    // words rather than left to invent them.
    valueBasis: { label: sales.VALUE_BASIS_LABEL, note: sales.VALUE_BASIS_NOTE },
    quarters: await db.quarterlyPerformance(year, bounds),
    // The brief's own grid: every product, its annual target, the split, and what each quarter
    // actually achieved. Same bounds, same query pass.
    byProduct: await db.quarterlyByProduct(year, bounds),
  };
});

app.post("/admin/sales/targets", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized", error: "غير مصرّح" });
  const b = (req.body ?? {}) as Record<string, unknown>;
  const product = String(b.product ?? "").trim();
  if (!product) return reply.code(400).send({ ok: false, error: "invalid_field", field: "product" });
  const known = new Set((await db.listTags()).map((t) => t.name));
  if (!known.has(product)) {
    // The count, not the catalogue: an error body is not a place to enumerate the product line.
    return reply.code(400).send({ ok: false, error: "unknown_product", product, knownCount: known.size });
  }
  const year = Number(b.year), quarter = Number(b.quarter);
  if (!Number.isFinite(year) || year < 2020 || year > 2100) {
    return reply.code(400).send({ ok: false, error: "invalid_field", field: "year" });
  }
  if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
    return reply.code(400).send({ ok: false, error: "invalid_field", field: "quarter" });
  }
  // null REMOVES the row: «بلا مستهدف» is a missing target, which is not a target of zero.
  if (b.amount === null) {
    const deleted = await db.deleteTarget(product, year, quarter);
    return { ok: true, product, year, quarter, deleted };
  }
  const amount = Number(b.amount);
  // Integer SAR, bounded. A negative target is not a stretch goal, it is a typo that would flip
  // every colour on the board; a fractional one is a number no invoice has ever carried.
  if (!Number.isInteger(amount) || amount < 0 || amount > 1e12) {
    return reply.code(400).send({ ok: false, error: "invalid_field", field: "amount" });
  }
  const ok = await db.setTarget(product, year, quarter, amount, adminName(req));
  if (!ok) return reply.code(503).send({ ok: false, error: "not_persisted" });
  return { ok: true, product, year, quarter, amount: Math.round(amount) };
});

// --------------------- integration (read-only, aggregate-only) ---------------------
//
// The ONE surface another Lean system may read. Three properties hold it in place, and each one is
// a decision rather than an omission:
//
//   · READ-ONLY — GET only. Nothing here can move a deal, and a compromised consumer cannot write.
//   · AGGREGATE-ONLY — integers and catalogue names. No account name, no phone, no transcript, no
//     money. There is no field to redact because none is ever assembled.
//   · CLOSED BY DEFAULT — with INTEGRATION_TOKEN unset the surface answers 404, the same as a route
//     that does not exist. A misconfigured deploy therefore fails shut, and it does not advertise
//     that an integration exists here for someone to go looking at.
//
// 404-not-401 for the unset case is deliberate: «not configured» and «wrong token» are different
// facts, and only the second one should confirm to a caller that they found the right door.

function integrationOk(req: any): boolean {
  return Boolean(cfg.integrationToken) && req.headers["x-integration-token"] === cfg.integrationToken;
}

app.get("/integration/product-interest", async (req, reply) => {
  if (!cfg.integrationToken) return reply.code(404).send({ status: "not_found" });
  if (!integrationOk(req)) return reply.code(401).send({ status: "unauthorized" });
  const opps = await db.listOpps();
  const feed = countPotentialClientsByProduct(opps);
  // Optional `?products=a|b` — the DISTINCT client count across a caller's chosen subset. Pipe
  // separated because a catalogue name contains a comma («تكامل الأنظمة (HIS/ERP)» does not, but
  // nothing stops the next one from doing so) and a separator that can appear inside a value is a
  // parsing bug waiting for the entry that trips it.
  const raw = String((req.query as Record<string, unknown> | undefined)?.products ?? "").trim();
  const selectedNames = raw ? raw.split("|").map((p) => p.trim()).filter(Boolean).slice(0, 50) : [];
  const selected = selectedNames.length
    ? { products: selectedNames, ...countPotentialClientsAcross(opps, selectedNames) }
    : null;
  return {
    ok: true,
    generatedAt: Date.now(),
    selected,
    // The consumer displays what «محتمل» meant, rather than hardcoding its own copy of the rule.
    // When the definition changes here, every dashboard reading it re-labels itself in the same
    // deploy instead of quietly describing the old rule over the new number.
    stages: CONFIRMED_INTEREST_STAGES.map((key) => {
      const stage = OPP_STAGES.find((s) => s.key === key);
      return { key, label: stage ? stage.label : key };
    }),
    ...feed,
  };
});

/** THE GATE'S OWN INSTRUMENT. Gate A decides whether phases 4-8 ship as designed, and until now
 *  nothing in the system measured either of its two thresholds — the gate could not be evaluated by
 *  the software it judges. Every number here is computed by sales-domain, so the screen and the
 *  verdict cannot disagree. */
app.get("/admin/gate-a", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized", error: "غير مصرّح" });
  const q = (req.query as any) || {};
  const days = Math.min(90, Math.max(1, Number(q.days) || 21));
  const endMs = Date.now();
  const startMs = endMs - days * 86_400_000;
  const rep = q.rep ? String(q.rep) : undefined;

  const rows = await db.gateARows(startMs, endMs, rep);
  const byRep = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!byRep.has(r.rep)) byRep.set(r.rep, []);
    byRep.get(r.rep)!.push(r);
  }

  const reps = [...byRep.entries()].map(([name, rs]) => {
    const counts: Record<string, number> = {};
    for (const r of rs) {
      const k = sales.riyadhDayKey(r.occurredAt);
      counts[k] = (counts[k] ?? 0) + 1;
    }
    const median = sales.medianPerWorkingDay(counts, startMs, endMs);
    const logged = sales.loggedWithinADay(rs);
    const v = sales.gateAVerdict(median, logged.pct);
    return {
      rep: name, engagements: rs.length, medianPerWorkingDay: median,
      loggedWithinADay: logged, verdict: v.verdict, reasons: v.reasons,
      byDay: counts,
    };
  }).sort((a, b) => b.engagements - a.engagements);

  return {
    ok: true, days, periodStart: startMs, periodEnd: endMs,
    // Stated on the response so the reader never has to guess what the gate means.
    thresholds: { minMedianPerWorkingDay: sales.GATE_A_MIN_MEDIAN, minLoggedWithinADayPct: sales.GATE_A_MIN_LOGGED_PCT },
    workingWeek: "الأحد إلى الخميس بتوقيت الرياض، وأيام بلا نشاط تُحتسب أصفارًا",
    reps,
  };
});

// ------------------------------ packages (الباقات) ------------------------------
//
// THE PRODUCT KEY TRAVELS IN THE QUERY OR THE BODY, NEVER IN THE PATH. One shipped product is
// «تكامل الأنظمة (HIS/ERP)» and that slash would split a path parameter — /admin/packages/تكامل
// الأنظمة (HIS/ERP) is two segments, not one. Product names are also mutable display text, so a
// rename would change every URL. Found by the Codex outside voice and verified against the live
// tags table.

app.get("/admin/packages", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized", error: "غير مصرّح" });
  const q = (req.query as any) || {};
  const product = q.product ? String(q.product) : undefined;
  const includeRetired = String(q.retired ?? "") === "1";
  return { ok: true, packages: await db.listPackages(product, includeRetired) };
});

app.post("/admin/packages", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized", error: "غير مصرّح" });
  const b = (req.body ?? {}) as Record<string, unknown>;
  const product = String(b.product ?? "").trim();
  const name = String(b.name ?? "").trim().slice(0, 120);
  if (!product) return reply.code(400).send({ ok: false, error: "invalid_field", field: "product" });
  if (!name) return reply.code(400).send({ ok: false, error: "invalid_field", field: "name" });
  const listPrice = Number(b.listPrice);
  // Bounded, like every other money field on this surface: a price of 1e15 renders as a number
  // nobody can read and a negative one inverts every discount figure downstream.
  if (!Number.isFinite(listPrice) || listPrice < 0 || listPrice > 1e12) {
    return reply.code(400).send({ ok: false, error: "invalid_field", field: "listPrice" });
  }
  const years = Number(b.years ?? 1);
  if (!Number.isInteger(years) || years < 1 || years > 10) {
    return reply.code(400).send({ ok: false, error: "invalid_field", field: "years" });
  }
  const row = await db.upsertPackage({
    product, name, listPrice, years,
    scope: b.scope == null ? null : String(b.scope).trim().slice(0, 120) || null,
  });
  // Null means the product is not in the catalogue. Same guard the targets endpoint uses: a
  // package for a product that does not exist would be invisible on every screen.
  if (!row) return reply.code(400).send({ ok: false, error: "unknown_product", product });
  return { ok: true, package: row };
});

app.patch("/admin/packages/:id", async (req, reply) => {
  if (!adminOk(req)) return problem(reply, 401, "unauthorized", "غير مصرّح");
  const id = Number((req.params as { id: string }).id);
  if (!Number.isInteger(id) || id <= 0) return problem(reply, 400, "bad_id", "معرّف غير صالح", "id");
  const pk = readPackageBody((req.body ?? {}) as Record<string, unknown>);
  if ("bad" in pk) return problem(reply, 400, "invalid_field", "حقل الباقة غير صالح: " + pk.bad, pk.bad);
  const row = await db.updatePackage(id, pk);
  if (row === "name_exists") return problem(reply, 409, "name_exists", "اسم الباقة مستخدم لباقة أخرى في هذا المنتج", "name");
  if (!row) return problem(reply, 404, "not_found", "لا باقة بهذا المعرّف", "id");
  return { ok: true, package: row };
});

app.post("/admin/packages/:id/retire", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized", error: "غير مصرّح" });
  const id = Number((req.params as { id: string }).id);
  if (!Number.isFinite(id)) return reply.code(400).send({ ok: false, error: "bad_id" });
  const retire = (req.body as any)?.retire !== false;
  const done = await db.retirePackage(id, retire);
  if (!done) return reply.code(404).send({ ok: false, error: "not_found" });
  return { ok: true, id, retired: retire };
});

app.get("/admin/actions/stalled", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized", error: "غير مصرّح" });
  const groups = await db.stalledByDept();
  return {
    ok: true,
    departments: sales.DEPARTMENTS,
    groups,
    totalOpen: groups.reduce((n, g) => n + g.openCount, 0),
  };
});

app.post("/admin/actions/:id/close", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized", error: "غير مصرّح" });
  const id = Number((req.params as { id: string }).id);
  if (!Number.isFinite(id)) return reply.code(400).send({ ok: false, error: "bad_id" });
  const state = String((req.body as any)?.state ?? "done");
  if (state !== "done" && state !== "cancelled") {
    return reply.code(400).send({ ok: false, error: "invalid_field", field: "state" });
  }
  const done = await db.closeAction(id, state, adminName(req));
  if (!done) return reply.code(404).send({ ok: false, error: "not_found_or_already_closed" });
  return { ok: true, id, state };
});

// ------------------------------ /rep — the sales rep's surface ------------------------------
//
// Closed by default: with REP_TOKENS unset every route here answers 404, the same posture
// /integration takes. «Not configured» and «wrong token» are different facts and only the second
// should confirm to a caller that they found the right door.
//
// The whole surface is three routes. That is deliberate — a rep needs to see who to call, record
// what happened, and read one account. Nothing here can launch a campaign or send a message.

function repSurfaceOff(reply: any): boolean {
  if (cfg.repTokens.length === 0) { reply.code(404).send({ status: "not_found" }); return true; }
  return false;
}

// The page itself is public, exactly as /dashboard is: it contains no data, and the token that
// bootstraps it arrives in the URL the rep is sent. Every byte of content behind it is gated.
app.get("/rep", async (_req, reply) => {
  if (cfg.repTokens.length === 0) return reply.code(404).send({ status: "not_found" });
  return reply.type("text/html; charset=utf-8").send(REP_PAGE_HTML);
});

app.get("/rep/queue", async (req, reply) => {
  if (repSurfaceOff(reply)) return;
  const caller = authorize(req);
  if (!caller) return reply.code(401).send({ status: "unauthorized", error: "غير مصرّح" });
  const rows = await db.repQueue(caller.actor, 50);
  return { ok: true, rep: caller.actor, count: rows.length, rows };
});

app.post("/rep/engagements", async (req, reply) => {
  if (repSurfaceOff(reply)) return;
  const caller = authorize(req);
  if (!caller) return reply.code(401).send({ status: "unauthorized", error: "غير مصرّح" });
  const b = (req.body ?? {}) as Record<string, unknown>;

  const kinds = ["call", "visit", "whatsapp", "email", "note"] as const;
  const kind = String(b.kind ?? "call");
  if (!(kinds as readonly string[]).includes(kind)) {
    return reply.code(400).send({ ok: false, error: "invalid_field", field: "kind" });
  }
  const phone = String(b.contactPhone ?? "").replace(/\D/g, "");
  if (!phone) return reply.code(400).send({ ok: false, error: "invalid_field", field: "contactPhone" });
  // The client generates the key and REUSES it across retries. That is what makes a tap from a
  // phone on a bad connection safe to send again.
  const idemKey = String(b.idemKey ?? "").trim();
  if (!idemKey) return reply.code(400).send({ ok: false, error: "invalid_field", field: "idemKey" });

  const r = await db.recordEngagement({
    idemKey,
    contactPhone: phone,
    oppId: b.oppId == null ? null : Number(b.oppId),
    // NEVER from the body. The actor is the credential.
    rep: caller.actor,
    kind: kind as (typeof kinds)[number],
    outcomeKey: b.outcomeKey == null ? null : String(b.outcomeKey),
    occurredAt: b.occurredAt == null ? Date.now() : Number(b.occurredAt),
    note: b.note == null ? null : String(b.note).slice(0, 1000),
  });
  if (!r.ok) return reply.code(400).send(r);
  return r;
});

/** The outcomes a rep may pick, for the stage the deal is actually on. Sent to the client so the
 *  picklist cannot offer a move the server would reject. */
app.get("/rep/outcomes", async (req, reply) => {
  if (repSurfaceOff(reply)) return;
  if (!authorize(req)) return reply.code(401).send({ status: "unauthorized" });
  const stage = String((req.query as any)?.stage ?? "");
  const list = sales.STAGE_OUTCOMES.filter((o) => o.stage === stage);
  return { ok: true, stage, outcomes: list };
});

// ------------------------------ admin (token-gated) ------------------------------

/** WHO IS CALLING, decided in one place and derived from the CREDENTIAL, never from the body.
 *
 *  `adminName` used to read `req.body.by`, so "who recorded this" was whatever the caller typed.
 *  That was survivable while one operator held one token. It is not survivable for Gate A, which is
 *  judged per rep on engagements the rep themselves records — a self-declared actor makes the gate's
 *  own numbers unverifiable, and lets any caller write history as anyone.
 *
 *  Roles are positive grants, so a surface nobody has granted is closed. A rep token authenticates
 *  on /rep and is simply NOT an admin anywhere else. */
export type Caller = { role: "admin" | "rep"; actor: string } | null;

function authorize(req: any): Caller {
  const admin = req.headers["x-admin-token"];
  if (cfg.adminToken && typeof admin === "string" && secretEq(admin, cfg.adminToken)) {
    // The admin is one human today (assumption A-3), so a label is all the actor can be. Unlike the
    // old body-derived name, it cannot be spoofed into someone else's.
    return { role: "admin", actor: "اللوحة" };
  }
  const rep = req.headers["x-rep-token"];
  if (typeof rep === "string" && rep) {
    for (const r of cfg.repTokens) if (secretEq(rep, r.secret)) return { role: "rep", actor: r.name };
  }
  return null;
}

/** Constant-time string compare for secrets. Lengths are compared first and separately, because
 *  timingSafeEqual THROWS on a length mismatch and a secret's length is not what needs protecting. */
function secretEq(got: string, want: string): boolean {
  const a = Buffer.from(got, "utf8"), b = Buffer.from(want, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Constant-time, because `===` on a secret leaks its prefix through timing and this one token is
 *  the entire authorization model: it can launch campaigns to real clinics and read every
 *  transcript. Lengths are compared first and separately — timingSafeEqual THROWS on a length
 *  mismatch, and the length of a token is not the secret worth protecting. */
function adminOk(req: any): boolean {
  return authorize(req)?.role === "admin";
}

/** /rep accepts a rep OR the admin, so the founder can walk the same screen the rep sees without a
 *  second credential. /admin never accepts a rep. */
function repOk(req: any): boolean {
  return authorize(req) !== null;
}
/** WHO typed a fact. One operator today (assumption A-3), so the token is the authorization and
 *  this is only a label on the record.
 *
 *  Read from the BODY, not a header: HTTP header values are latin-1, so «أبو عزيز» in an
 *  `x-admin-name` header throws ERR_INVALID_CHAR in the client before the request is even sent —
 *  measured, not assumed. A percent-encoded header would work and would also be a value the portal
 *  emits and cannot read back, which is this project's own recurring defect. */
function adminName(req: any): string {
  // Derived from the credential, not from the body. The old form read String(req.body.by), so any
  // caller could sign a record as anyone — which for Gate A, judged per rep, made the numbers
  // unverifiable. Falls back to the old label only when there is no caller, which cannot happen on
  // a guarded route.
  return authorize(req)?.actor ?? "اللوحة";
}

/** RFC 9457 problem+json (STANDARDS §7, D-5 exit step 2) for the routes built since the rule
 *  bound. `error` is the machine code the client switches on; `detail` is what a person reads. */
function problem(reply: any, status: number, error: string, detail?: string, field?: string) {
  return reply.code(status).type("application/problem+json").send({
    type: "about:blank", title: error, status, detail, error, ...(field ? { field } : {}),
  });
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
  const { text, source } = (req.body ?? {}) as { text?: string; source?: string };
  if (!text?.trim()) return reply.code(400).send({ error: "body: { text }" });
  // BR-CUS-005: where the account came from. The indicator form's «إضافة كعميل جديد» says so; anything
  // else typed into this box is a manual add.
  const origin: acct.AccountSource = source === "indicator" ? "indicator" : "manual";
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
  const res = await db.addEntities(rows, { source: origin, by: adminName(req) });
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
    const res = await db.addEntities(parsed.rows, { source: "import", by: adminName(req) });
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
  // The ONE name rule (spec E): a tag IS a product, so it obeys the product's name rule.
  const named = pd.normalizeProductName((req.body as { name?: string })?.name);
  if (!named.ok) return problem(reply, 400, "invalid_name", named.reason, "name");
  const created = await db.createTag(named.name, "portal");
  return { status: "ok", name: named.name, created };
});

app.post("/admin/tags/rename", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  const { from, to } = (req.body ?? {}) as { from?: string; to?: string };
  const a = String(from ?? "").trim();
  if (!a) return reply.code(400).send({ error: "body: { from, to }" });
  const named = pd.normalizeProductName(to);
  if (!named.ok) return problem(reply, 400, "invalid_name", named.reason, "to");
  const b = named.name;
  if (a === b) return { status: "ok", renamed: false };
  // The six embedded products are named in agent.ts PRODUCTS, the product lock's patterns and the
  // boot seed. A database rename would leave the code pointing at a name that no longer exists —
  // and the seed would recreate the old one at the next restart (spec D).
  if (pd.isEmbeddedProduct(a)) {
    return problem(reply, 409, "embedded_product", "مضمَّن في كتالوج المساعد — إعادة التسمية تتطلب تحديث الكتالوج", "from");
  }
  // A rename ONTO an existing tag would merge two vocabularies; that is a different decision with a
  // different blast radius, so it is refused here rather than done silently.
  if ((await db.listTags()).some((t) => t.name === b)) {
    return reply.code(409).send({ error: "tag_exists" });
  }
  // Counted BEFORE the move, on the old name — after it there is nothing left to count.
  const counts = await db.impactOf(a);
  const r = await db.renameTag(a, b);
  if (!r.ok) return reply.code(404).send({ error: "unknown_tag" });
  // After COMMIT: the in-memory readings follow the durable ones, and the assistant's knowledge
  // and files are reloaded under the new name in the same request.
  const contacts = tracker.renameTagProduct(a, b);
  await agent.refreshKb();
  // The per-table counts, not «تم». A rename touches ten tables and used to touch one; reporting
  // what actually moved is how the caller can tell those two apart.
  return { status: "ok", renamed: true, from: a, to: b, moved: r.moved, counts: { ...counts, embedded: false, contacts } };
});

app.post("/admin/tags/delete", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  const name = String((req.body as { name?: string })?.name ?? "").trim();
  if (!name) return reply.code(400).send({ error: "name is required" });
  // Delete used to remove the tag and leave its kb, asset, packages, targets and deals orphaned
  // (spec J). A referenced product is archived, never deleted.
  const refs = await db.productReferences(name);
  if (refs.total > 0) {
    return reply.code(409).type("application/problem+json").send({
      type: "about:blank", title: "referenced", status: 409, error: "referenced",
      detail: "المنتج مستخدم في سجلات أخرى — أرشفه بدلًا من حذفه", counts: refs.counts,
    });
  }
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

// ---- «العملاء» as accounts (client A, BRD §9, slice S2) ---------------------------------------------
// Rules in account-domain.ts; these routes load, check and store. Nothing here sends a message.

async function activeMemberIds(): Promise<{ ids: number[]; members: { id: number; name: string; role: string; division: string | null }[] }> {
  const all = (await db.listMembers()).filter((m) => m.active);
  return { ids: all.map((m) => m.id), members: all.map((m) => ({ id: m.id, name: m.name, role: m.role, division: m.division })) };
}
function accountBody(req: any): { account: acct.AccountInput; ifUpdatedAt: number | null } {
  const b = (req.body ?? {}) as any;
  const a = b.account && typeof b.account === "object" && !Array.isArray(b.account) ? b.account : {};
  const n = typeof b.ifUpdatedAt === "number" ? b.ifUpdatedAt : NaN;
  return { account: a, ifUpdatedAt: Number.isSafeInteger(n) && n > 0 ? n : null };
}
/** Phones in their stored 966… form BEFORE the rules run, so «0551234567» and «966551234567» on two
 *  contacts of one account are recognised as the same number (review). */
function normalizeAccountPhones(a: acct.AccountInput): acct.AccountInput {
  const norm = (v: unknown) => {
    const d = acct.phoneDigits(v);
    return d ? audience.normalizePhone(d) : (typeof v === "string" ? v : "");
  };
  const contacts = Array.isArray(a.contacts) ? (a.contacts as acct.ContactInput[]).map((c) => (c && typeof c === "object" ? { ...c, phone: norm(c.phone) } : c)) : a.contacts;
  return { ...a, phone: norm(a.phone), contacts };
}
/** A route body run against the database; an outage is 503, never an empty list or a false 404. */
async function withDb(reply: any, fn: () => Promise<unknown>): Promise<unknown> {
  if (!(await db.canRead())) return reply.code(503).send({ ok: false, error: "db_unavailable" });
  try { return await fn(); }
  catch (e) {
    if (e instanceof db.DbUnavailable) return reply.code(503).send({ ok: false, error: "db_unavailable" });
    throw e;
  }
}

app.get("/admin/accounts", async (req, reply) => {
  if (!adminOk(req)) return problem(reply, 401, "unauthorized", "غير مصرّح");
  return withDb(reply, async () => {
    const [list, team] = await Promise.all([db.listAccounts(), activeMemberIds()]);
    return { ok: true, accounts: list, members: team.members };
  });
});

app.get("/admin/accounts/:id", async (req, reply) => {
  if (!adminOk(req)) return problem(reply, 401, "unauthorized", "غير مصرّح");
  const id = idParam(req);
  if (id == null) return problem(reply, 400, "invalid_field", "رقم العميل غير صحيح", "id");
  return withDb(reply, async () => {
    const account = await db.accountById(id);
    if (!account) return problem(reply, 404, "unknown_account", "لا عميل بهذا الرقم", "id");
    const [activity, tasks, notes, indicators, team] = await Promise.all([
      db.accountActivity(account.phone),
      db.listTasks({ kind: "contact", id: account.phone }),
      db.listNotes({ kind: "contact", id: account.phone }),
      db.indicatorsForPhone(account.phone),
      activeMemberIds(),
    ]);
    const contact = tracker.findContact(account.phone);
    return {
      ok: true, account, ...activity, indicators, members: team.members,
      tasks: tasks.slice(0, 20).map((t) => ({ id: t.id, title: t.title, status: t.status, dueAt: t.due_at, assignedTo: t.assigned_to })),
      notes: notes.slice(0, 20).map((n) => ({ id: n.id, title: n.title, content: n.content.slice(0, 400), author: n.author, createdAt: n.created_at })),
      conversation: contact ? { lastEventAt: contact.lastEventAt, optedOut: contact.optedOut } : null,
    };
  });
});

app.post("/admin/accounts", async (req, reply) => {
  if (!adminOk(req)) return problem(reply, 401, "unauthorized", "غير مصرّح");
  return withDb(reply, async () => {
    const { account } = accountBody(req);
    const team = await activeMemberIds();
    const checked = acct.checkAccount(normalizeAccountPhones(account), team.ids, false);
    if (!checked.ok) return problem(reply, 400, "invalid_field", checked.reason, checked.field);
    const r = await db.createAccount(checked.value, "manual", adminName(req));
    if (!r) return reply.code(503).send({ ok: false, error: "db_unavailable" });
    if ("conflict" in r) {
      return reply.code(409).type("application/problem+json").send({
        type: "about:blank", title: "phone_exists", status: 409, error: "phone_exists", field: "phone",
        detail: "هذا الرقم مسجّل لعميل آخر", existingId: r.conflict,
      });
    }
    await accounts.refresh();
    return reply.code(201).header("Location", "/admin/accounts/" + r.id).send({ ok: true, id: r.id });
  });
});

app.patch("/admin/accounts/:id", async (req, reply) => {
  if (!adminOk(req)) return problem(reply, 401, "unauthorized", "غير مصرّح");
  const id = idParam(req);
  if (id == null) return problem(reply, 400, "invalid_field", "رقم العميل غير صحيح", "id");
  const { account, ifUpdatedAt } = accountBody(req);
  // Required, not optional: a PATCH without the version it was based on is a blind overwrite (review).
  if (ifUpdatedAt == null) return problem(reply, 400, "invalid_field", "ifUpdatedAt مطلوب — نسخة العميل التي بُني عليها التعديل", "ifUpdatedAt");
  return withDb(reply, async () => {
    const cur = await db.accountById(id);
    if (!cur) return problem(reply, 404, "unknown_account", "لا عميل بهذا الرقم", "id");
    const team = await activeMemberIds();
    // An owner who has since left the team stays assignable on THIS account until someone changes it —
    // otherwise editing a phone number would force a reassignment nobody asked for.
    const ids = cur.ownerId != null && team.ids.indexOf(cur.ownerId) < 0 ? team.ids.concat([cur.ownerId]) : team.ids;
    const checked = acct.checkAccount(normalizeAccountPhones(account), ids, true);
    if (!checked.ok) return problem(reply, 400, "invalid_field", checked.reason, checked.field);
    checked.value.phone = cur.phone;
    // A contact id this account does not own is treated as a new person, never an update of someone else's.
    const own = new Set(cur.contacts.map((c) => c.id));
    checked.value.contacts = checked.value.contacts.map((c) => ({ ...c, id: c.id != null && own.has(c.id) ? c.id : null }));
    const r = await db.updateAccount(id, checked.value, ifUpdatedAt, adminName(req));
    if (!r) return problem(reply, 404, "unknown_account", "لا عميل بهذا الرقم", "id");
    if ("stale" in r) return problem(reply, 409, "stale_account", "عدّل شخص آخر هذا العميل بعد أن فتحته");
    await accounts.refresh();
    return { ok: true, updatedAt: r.updatedAt };
  });
});

app.post("/admin/accounts/:id/approval", async (req, reply) => {
  if (!adminOk(req)) return problem(reply, 401, "unauthorized", "غير مصرّح");
  const id = idParam(req);
  if (id == null) return problem(reply, 400, "invalid_field", "رقم العميل غير صحيح", "id");
  const b = (req.body ?? {}) as { decision?: unknown; note?: unknown };
  const decision = typeof b.decision === "string" ? b.decision : "";
  if (!acct.ACCOUNT_APPROVALS.includes(decision as acct.AccountApproval)) return problem(reply, 400, "invalid_field", "قرار غير معروف", "decision");
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 300) || null : null;
  return withDb(reply, async () => {
    const r = await db.setAccountApproval(id, decision as acct.AccountApproval, note, adminName(req));
    if (!r) return problem(reply, 404, "unknown_account", "لا عميل بهذا الرقم", "id");
    if ("refused" in r) return problem(reply, 409, "no_change", r.refused, "decision");
    return { ok: true, approvalAt: r.approvalAt };
  });
});

// ------------------------------ campaign launch (human-confirmed in the UI) ------------------------------

app.post("/admin/campaign/launch", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  const { targets, message, name, product, buttons, templateId, objective, origin } = (req.body ?? {}) as
    { targets?: { phone: string; name?: string }[]; message?: string; name?: string; product?: string; buttons?: boolean; templateId?: string;
      objective?: string; origin?: { suggestionKey?: unknown; rule?: unknown; indicatorIds?: unknown } };
  // BR-CAM-001: the objective is a closed list, so a report can group by it.
  if (objective !== undefined && objective !== null && objective !== "" && !ind.CAMPAIGN_OBJECTIVES.includes(String(objective))) {
    return problem(reply, 400, "invalid_objective", "هدف الحملة غير معروف", "objective");
  }
  // Attribution to a suggestion, kept to the three fields a report reads. Anything else is dropped.
  const campOrigin = origin && typeof origin.suggestionKey === "string" && origin.suggestionKey.includes("|")
    ? { suggestionKey: origin.suggestionKey.slice(0, 400), rule: String(origin.rule ?? "").slice(0, 40) || null,
        indicatorIds: Array.isArray(origin.indicatorIds) ? origin.indicatorIds.map(Number).filter(Number.isInteger).slice(0, 20) : [],
        modified: (origin as any).modified === true }
    : null;
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
  // BEFORE ANY SEND (spec B′ rule 4): a campaign about a product the assistant cannot sell —
  // unknown, archived, or with no approved or embedded knowledge — would open conversations the
  // agent then cannot hold. The wizard shows the same reason; a UI-only guard is not enough.
  if ((product || "").trim() && !agent.isEligibleNow((product || "").trim())) {
    return problem(reply, 400, "product_not_eligible", "لا يبيعه المساعد — يلزم اعتماد ملف المعرفة أو استعادة المنتج أولًا", "product");
  }
  const campName = (name || "").trim() ||
    // Western digits and the gregorian calendar: this name is read on the dashboard beside every
    // other date, and a Hijri date in Arabic-Indic digits was the one string that disagreed.
    `حملة ${(product || "").trim() || "واتساب"} — ${new Date().toLocaleDateString("ar-SA-u-ca-gregory-nu-latn")}`;
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
    phone: String(t.phone || "").replace(/\D/g, ""), name: t.name })), isRehearsal, campOrigin, objective ? String(objective) : null);
  const results: { phone: string; ok: boolean; error?: string; reason?: string }[] = [];
  for (const t of targets) {
    const phone = String(t.phone || "").replace(/\D/g, "");
    if (!phone) { results.push({ phone: String(t.phone), ok: false, error: "invalid phone" }); continue; }
    const contact = tracker.getContact(phone, t.name);
    if (contact.optedOut) { results.push({ phone, ok: false, error: "opted out — skipped" }); void db.markTargetOutcome(campaignId, phone, "opted_out"); continue; }
    // REFUSE rather than fail. WhatsApp accepts a free-form message only inside 24h of the
    // customer's own last message; outside it, only a Meta-approved template — and this path sends
    // session messages. The founder launched to two contacts who had last written 33h earlier, both
    // sends failed with «Re-engagement message», and the screen had told him nothing beforehand.
    // Predicting it costs one comparison; discovering it costs a burnt send and a wrong number.
    const win = insights.windowState(contact);
    if (win.state !== "open") {
      results.push({ phone, ok: false, error: win.state === "closed" ? "outside_window" : "no_inbound_ever", reason: win.reason });
      tracker.recordSystem(phone, `[لم تُرسل: ${win.state === "closed" ? "خارج نافذة 24 ساعة" : "لم يراسلنا من قبل"}]`);
      void db.markTargetOutcome(campaignId, phone, win.state === "closed" ? "outside_window" : "no_inbound_ever");
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
      // Was a local 4xx-only regex — the same defect the agent path carried: a Gupshup HTTP 200
      // with {"status":"error"} is a definite refusal and was being rethrown instead of falling
      // back to text, so that recipient got nothing. One predicate now, in gupshup.ts.
      const rejectedShape = gupshup.isProviderRejection;
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
      void db.markTargetOutcome(campaignId, phone, "sent");
    } catch (e) {
      // Unknown, not «failed»: a provider timeout may still have delivered (send-outcome rule), so the
      // row stays approached for suppression rather than being offered again tomorrow.
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
  if (!(await db.canRead())) return reply.code(503).send({ ok: false, error: "db_unavailable" });
  return db.listAssets();
});

const ASSET_MAX_BYTES = 10 * 1024 * 1024;

// Upload the product's intro PDF (the file the agent SENDS — separate from knowledge decks).
app.post("/admin/product-asset/upload", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  const file = await (req as any).file();
  if (!file) return reply.code(400).send({ error: "multipart file required" });
  const product = (String((file.fields?.product as any)?.value ?? "").trim() ||
    String((req.query as any)?.product ?? "").trim());
  if (!product) return reply.code(400).send({ error: "product required (multipart field before file, or ?product=)" });
  const isSkill = product === "__skill__";
  if (!isSkill) {
    // A product file goes to a CUSTOMER, by URL, from a public route. So: a live product only, a
    // real PDF only (the bytes say so, not the extension), and bounded. A failed check keeps the
    // current file — nothing is written until every check passes.
    if (product.startsWith("__")) return problem(reply, 400, "unknown_product", "لا منتج بهذا الاسم", "product");
    const state = await db.tagState(product);
    if (!state.exists) return problem(reply, 400, "unknown_product", "لا منتج بهذا الاسم", "product");
    if (state.archived) return problem(reply, 400, "archived_product", "المنتج مؤرشف — استعده أولًا", "product");
  }
  const buf = await file.toBuffer();
  if (!isSkill) {
    if (buf.length > ASSET_MAX_BYTES) return problem(reply, 400, "invalid_file", "الملف أكبر من 10 م.ب", "file");
    if (buf.subarray(0, 4).toString("latin1") !== "%PDF") return problem(reply, 400, "invalid_file", "الملف ليس PDF", "file");
  }
  const publicId = randomBytes(9).toString("hex");
  await db.saveAsset(product, publicId, file.filename || "intro.pdf",
    isSkill ? (file.mimetype || "application/zip") : "application/pdf", buf);
  await agent.refreshKb();
  log({ at: "assets", msg: "intro file saved", product, publicId, size: buf.length });
  return { ok: true, product, publicId, filename: file.filename, size: buf.length };
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
    const msg = String(e instanceof Error ? e.message : e);
    // The eligibility rule, not a model failure: the wizard reads `not_eligible` and shows why.
    if (msg === "not_eligible") return problem(reply, 400, "not_eligible", "لا يبيعه المساعد — يلزم اعتماد ملف المعرفة أو استعادة المنتج أولًا", "product");
    return reply.code(502).send({ error: msg.slice(0, 200) });
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

// العميل 360 — one person, fully assembled: identity + timeline + فهم المساعد + context score.
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

  // THE LIFETIME READ GETS THE LIFETIME TRANSCRIPT. The resident Map holds the last 50 messages
  // per contact, so seriousness — which index.ts below calls deliberately lifetime — was silently
  // a recent-50 question for any account worth opening. Loaded from Postgres per-record: this is
  // one row's page view, not a hot path, and the honesty is worth the query. Falls back to the
  // resident copy when there is no database, so a local dev still renders.
  const lifetime = db.enabled() ? await db.fullTranscript(phone) : [];
  const transcriptForSignal = lifetime.length ? lifetime : (contact.transcript || []);
  // The chart is aggregated in Postgres over the WHOLE table, so 21 days means 21 days even for a
  // contact with 400 messages. Computed from the resident copy only when there is no database.
  const activityCounts = db.enabled() ? await db.activityCountsByDay(phone, 21) : null;

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
    // THE INDICATORS the record now leads with. Computed here, on the server, and delivered ready
    // to draw: these rules are the business tier (`signal-domain.ts`, unit-tested), and the record
    // page is presentation. Shipping them to the browser would widen ADR-0001's closure contract
    // for no second reader.
    //
    // Lifetime, deliberately NOT campaign-scoped like `interaction` above. «How serious is this
    // client» is a question about the person, and a prospect who priced the deal last month is
    // serious today even when today's campaign window holds one message.
    signal: readSeriousness({
      transcript: transcriptForSignal as never,
      tags: contact.tags || [],
      outcome: contact.outcome,
      optedOut: contact.optedOut,
      isButtonEcho: (t: string) => Boolean(templates.buttonIntent(t)),
      now: Date.now(),
    }),
    // 21 days: three weeks is long enough to show a conversation going quiet and short enough that
    // each bar is still a readable day on a 300px chart.
    activity: activityCounts
      ? activityFromCounts(activityCounts, Date.now(), 21)
      : activityByDay(contact.transcript || [], Date.now(), 21),
    // Stated on the response because it changes how the two figures above should be read.
    transcriptSource: lifetime.length ? "lifetime" : "resident",
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
  if (def.conditions.length > 8) return reply.code(400).send({ error: "بحد أقصى 8 شروط" });
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
    // The tenure forecast the benchmarked tools omit: «0 مطابقة» on a book younger than the
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
  // Report the same three numbers the preview does. A preset reading «0» while three contacts
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
  if (!(await db.canRead())) return reply.code(503).send({ ok: false, error: "db_unavailable" });
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
  const active = new Set(await db.activeTagNames());
  // NEW lines may only start on an ACTIVE rung; an existing line keeps whatever rung it is on
  // (see the PATCH route below, which allows the line's own stage too).
  const liveStages = await db.activeStageKeys();
  // Resolve the stage the line will ACTUALLY be stored on before judging it: an omitted stage used
  // to slip past the guard and be defaulted to «contact» by the INSERT, so a paused «contact»
  // rejected the explicit form and accepted the silent one.
  const startStage = await db.defaultStageKey();
  for (const l of lines) {
    if (l.stage == null || l.stage === "") l.stage = startStage;
    const bad = db.validateOppLine(l, liveStages);
    if (bad) return reply.code(400).send({ ok: false, error: "invalid_field", field: bad });
    if (!known.has(String(l.product).trim())) {
      return reply.code(400).send({ ok: false, error: "unknown_product", product: l.product, known: [...known] });
    }
    // Archived, not eligibility (spec B′ rule 5): a rep may record a deal for a product the
    // assistant cannot sell, but not for one the company has shelved. Existing lines stay editable.
    if (!active.has(String(l.product).trim())) {
      return problem(reply, 400, "archived_product", "المنتج مؤرشف — استعده قبل تسجيل فرصة جديدة", "product");
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
  // Stages an EDIT may land on: the active ones, plus the rung this line already sits on — pausing a
  // rung must not trap the deals on it, and must not become a way to move new deals onto it either
  // (config-domain.isStageSelectable, the same rule the picker uses).
  const currentStage = await db.oppStageOf(id);
  const allowedStages = [...new Set([...(await db.activeStageKeys()), ...(currentStage ? [currentStage] : [])])];
  const bad = db.validateOppLine({ product: b.product ?? "x", ...b }, allowedStages);
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
  const row = await db.updateOpp(id, patch as never, adminName(req));
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
  if (!(await db.canRead())) return reply.code(503).send({ ok: false, error: "db_unavailable" });
  return db.listKb();
});

const KB_MAX_BYTES = 15 * 1024 * 1024;
const KB_FILE_RE = /\.(pdf|docx|pptx|xlsx|md|txt)$/i;

/**
 * Knowledge upload → DRAFT. The product is REQUIRED and must be a live tag: the model no longer
 * names a product from any UI, because a typo in its answer used to create a pseudo-product that
 * the boot seed then promoted to a tag. What the model extracts lands in draft_*; the assistant
 * reads md, and md moves only through «اعتماد المعرفة» (spec A, A′).
 */
app.post("/admin/kb/upload", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized" });
  const file = await (req as any).file();
  if (!file) return problem(reply, 400, "invalid_file", "الملف مطلوب", "file");
  // The multipart field must PRECEDE the file part, or it is not parsed yet when the file arrives.
  const product = (String((file.fields?.product as any)?.value ?? "").trim() ||
    String((req.query as any)?.product ?? "").trim());
  if (!product) return problem(reply, 400, "unknown_product", "اسم المنتج مطلوب (حقل product قبل الملف أو ?product=)", "product");
  if (product.startsWith("__")) return problem(reply, 400, "unknown_product", "لا منتج بهذا الاسم", "product");
  const state = await db.tagState(product);
  if (!state.exists) return problem(reply, 400, "unknown_product", "لا منتج بهذا الاسم", "product");
  if (state.archived) return problem(reply, 400, "archived_product", "المنتج مؤرشف — استعده أولًا", "product");
  const filename = String(file.filename || "");
  if (!KB_FILE_RE.test(filename)) return problem(reply, 400, "invalid_file", "الأنواع المقبولة: pdf docx pptx xlsx md txt", "file");
  const buf = await file.toBuffer();
  if (buf.length > KB_MAX_BYTES) return problem(reply, 400, "invalid_file", "الملف أكبر من 15 م.ب", "file");
  try {
    // processDeck writes the draft (db.saveKb writes draft_* only) under the product given here.
    await kb.processDeck(buf, filename, product);
  } catch (e) {
    // The existing draft and the approved text are untouched: nothing was written.
    return problem(reply, 502, "extraction_failed", String(e instanceof Error ? e.message : e).slice(0, 300), "file");
  }
  await db.setKbDraftBy(product, adminName(req));
  const row = await db.knowledgeOf(product);
  const draftMd = row?.draft_md ?? "";
  return { ok: true, product, draftHash: db.sha256Hex(draftMd), changeSummary: pd.changeSummary(row?.md ?? "", draftMd) };
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
    // SERVICE_CATALOGUE ONLY. Seeding from product_kb names as well meant a rename or an
    // unmatched upload recreated a product at every restart (spec D); an off-registry file is now
    // an «غير مطابق» row the operator reconciles, not a product the boot invents.
    const have = new Set((await db.listTags()).map((t) => t.name));
    const seed = [...(insights.SERVICE_CATALOGUE as readonly string[])];
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
