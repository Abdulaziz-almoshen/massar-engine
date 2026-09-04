import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { cfg, configReport } from "./config.js";
import { DASHBOARD_HTML } from "./dashboard.js";
import { REP_PAGE_HTML } from "./rep-page.js";
import * as db from "./db.js";
import * as gupshup from "./gupshup.js";
import * as sales from "./sales-domain.js";
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
import { CONFIRMED_INTEREST_STAGES, OPP_STAGES } from "./opps-domain.js";
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

app.get("/admin/sales/performance", async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ status: "unauthorized", error: "غير مصرّح" });
  const q = (req.query as any) || {};
  const fsm = fiscalStartMonth();
  const now = sales.riyadhFiscalPeriod(Date.now(), fsm);
  const year = Number(q.year) || now.year;
  const quarter = Number(q.quarter) || now.quarter;
  if (quarter < 1 || quarter > 4) {
    return reply.code(400).send({ ok: false, error: "invalid_field", field: "quarter" });
  }
  // Year was unchecked while quarter was, and the asymmetry was reachable: Date.UTC overflows past
  // year 275760, riyadhPeriodBounds then returns NaN, pg serialises that as the string "NaN", and
  // to_timestamp raises — surfacing the raw driver error, relation names included, as a 500.
  // Same range POST /admin/sales/targets already enforces.
  if (!Number.isFinite(year) || year < 2020 || year > 2100) {
    return reply.code(400).send({ ok: false, error: "invalid_field", field: "year" });
  }
  const b = sales.riyadhPeriodBounds(year, quarter, fsm);
  // Whether the caller is looking at the quarter we are inside. Open pipeline with no planned close
  // date belongs to the current period or to none, and the decision is made here rather than in SQL.
  const isCurrentPeriod = year === now.year && quarter === now.quarter;
  const rows = await db.salesPerformance(b.startMs, b.endMs, year, quarter, isCurrentPeriod);
  return {
    ok: true, year, quarter, fiscalStartMonth: fsm,
    periodStart: b.startMs, periodEnd: b.endMs, now: Date.now(),
    rows,
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
  const year = Number(b.year), quarter = Number(b.quarter), amount = Number(b.amount);
  if (!Number.isFinite(year) || year < 2020 || year > 2100) {
    return reply.code(400).send({ ok: false, error: "invalid_field", field: "year" });
  }
  if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
    return reply.code(400).send({ ok: false, error: "invalid_field", field: "quarter" });
  }
  // A negative target is not a stretch goal, it is a typo that would flip every colour on the board.
  if (!Number.isFinite(amount) || amount < 0 || amount > 1e12) {
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
