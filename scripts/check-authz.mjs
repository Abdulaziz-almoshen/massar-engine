// check-authz.mjs — every door, every credential, asserted over real HTTP.
//
// WHY THIS EXISTS. One authorize() now replaces guards that were written by hand on 46 routes. That
// is the right shape, and it is also exactly the change that can silently widen a surface: a single
// wrong branch would let a rep token — issued to run a three-week pilot — reach
// /admin/campaign/launch, which sends WhatsApp to real clinics. The standing rule on this project
// is that no message goes to any number for any reason, and a unit test on the auth function does
// not prove which routes call it.
//
// So this boots the built server and probes the matrix: {admin, rep, wrong, none} x {the surfaces}.
// It asserts REACHABILITY, which a regex over source cannot.

import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = 8099 + Math.floor(Math.random() * 300);
const BASE = `http://127.0.0.1:${PORT}`;
const ADMIN = "admin-secret-for-test";
const REP = "rep-secret-for-test";

let failures = 0;
const c = (label, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? " — " + detail : ""}`);
};

const child = spawn(process.execPath, ["dist/index.js"], {
  env: {
    ...process.env,
    PORT: String(PORT),
    ADMIN_TOKEN: ADMIN,
    REP_TOKENS: `سارة القحطاني:${REP}`,
    WEBHOOK_TOKEN: "wh",
    // No database and no provider keys: this asserts AUTHORIZATION, and a route that 500s on a
    // missing database has still told us whether it let the caller in.
    DATABASE_URL: "",
    GUPSHUP_API_KEY: "",
    OPENAI_API_KEY: "",
  },
  stdio: "ignore",
});

// A REFUSAL is 401 or 429. The engine rate-limits repeated FAILED auth, so a check that makes
// enough refused requests eventually trips its own limiter — which is the limiter working. Asserting
// exactly 401 made the check fail as soon as the admin route list grew (adding /admin/reports/rollups
// was enough), and a 429 there reads as "the route let a wrong token in" when it means the opposite.
// Kept narrow: 500 is still a failure, not a refusal.
const refused = (code) => code === 401 || code === 429;

const hit = async (path, headers, method = "GET") => {
  try {
    const body = method === "GET" ? undefined : "{}";
    const h = body ? { ...headers, "content-type": "application/json" } : headers;
    const r = await fetch(BASE + path, { headers: h, method, body });
    return r.status;
  } catch { return 0; }
};

try {
  for (let i = 0; i < 60; i++) {
    if (await hit("/health", {}).then((s) => s === 200)) break;
    await sleep(250);
  }

  const admin = { "x-admin-token": ADMIN };
  const rep = { "x-rep-token": REP };
  const wrong = { "x-admin-token": "nope", "x-rep-token": "nope" };
  const none = {};

  // An admin surface must admit the admin and refuse everyone else. 401 is the refusal; anything
  // 2xx from a rep here is the failure this file exists to catch.
  const ADMIN_ROUTES = ["/admin/state", "/admin/sales/performance", "/admin/tags",
    "/admin/sales/sectors", "/admin/products", "/admin/sectors",
    "/admin/reports", "/admin/sales/quarters", "/admin/reports/rollups"];
  for (const route of ADMIN_ROUTES) {
    c(`${route} admits admin`, (await hit(route, admin)) !== 401);
    c(`${route} REFUSES a rep token`, refused(await hit(route, rep)));
    c(`${route} refuses a wrong token`, refused(await hit(route, wrong)));
    c(`${route} refuses no token`, refused(await hit(route, none)));
  }

  // The usage-indicator and campaign-suggestion routes (client A BRD, 2026-09-15), every method. The
  // security review found the GET-only matrix could not see a single one of them; a write route a rep
  // token could reach would be the gap this file exists to close.
  const ADMIN_WRITES = [
    ["GET", "/admin/opps/1/work"], ["POST", "/admin/opps/1/activities"], ["DELETE", "/admin/opp-activities/1"], ["POST", "/admin/opps/1/quotes"], ["POST", "/admin/opp-quotes/1/status"],
    ["GET", "/admin/campaigns/1/results"], ["GET", "/admin/partners"], ["POST", "/admin/products/knowledge/draft"], ["GET", "/admin/answer-reviews?phone=1"], ["POST", "/admin/answer-reviews"], ["POST", "/admin/partners"], ["PATCH", "/admin/partners/1"], ["PUT", "/admin/partners/1/targets"], ["POST", "/admin/partners/1/results"], ["PATCH", "/admin/partner-results/1"], ["DELETE", "/admin/partner-results/1"], ["GET", "/admin/kpis"], ["GET", "/admin/accounts"], ["GET", "/admin/accounts/1"], ["POST", "/admin/accounts"], ["PATCH", "/admin/accounts/1"], ["POST", "/admin/accounts/1/approval"],
    ["GET", "/admin/indicators"], ["GET", "/admin/indicators/membership"], ["GET", "/admin/indicators/1"],
    ["GET", "/admin/indicators/for-customer/966500000000"], ["GET", "/admin/campaign-suggestions"],
    ["POST", "/admin/indicators"], ["POST", "/admin/indicators/preview"], ["PATCH", "/admin/indicators/1"],
    ["POST", "/admin/indicators/1/status"], ["POST", "/admin/campaign-suggestions/dismiss"],
    ["POST", "/admin/campaign-suggestions/restore"], ["POST", "/admin/campaign/repeat-check"],
  ];
  for (const [method, route] of ADMIN_WRITES) {
    c(`${method} ${route} admits admin`, (await hit(route, admin, method)) !== 401);
    c(`${method} ${route} REFUSES a rep token`, refused(await hit(route, rep, method)));
    c(`${method} ${route} refuses no token`, refused(await hit(route, none, method)));
  }
  c("/assets/indicator-template.xlsx is public", (await hit("/assets/indicator-template.xlsx", none)) === 200);

  // The rep surface admits the rep AND the admin (the founder walks the same screen), refuses the rest.
  const REP_ROUTES = ["/rep/queue", "/rep/outcomes?stage=tech"];
  for (const route of REP_ROUTES) {
    c(`${route} admits the rep`, (await hit(route, rep)) !== 401);
    c(`${route} admits the admin too`, (await hit(route, admin)) !== 401);
    c(`${route} refuses a wrong token`, refused(await hit(route, wrong)));
    c(`${route} refuses no token`, refused(await hit(route, none)));
  }

  // Public stays public.
  c("/health is public", (await hit("/health", none)) === 200);
  c("/dashboard is public", (await hit("/dashboard", none)) === 200);

  // Closed by default: the integration surface is off with no token set, and says 404 rather than
  // 401 so it does not confirm to a prober that a door exists here.
  c("/integration is 404 when unconfigured", (await hit("/integration/product-interest", none)) === 404);
} finally {
  child.kill();
}

console.log(failures ? `\n${failures} FAILURES` : "\nauthz matrix: all green");
process.exit(failures ? 1 : 0);
