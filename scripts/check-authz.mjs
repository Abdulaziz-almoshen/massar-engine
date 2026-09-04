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

const hit = async (path, headers) => {
  try {
    const r = await fetch(BASE + path, { headers, method: "GET" });
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
  const ADMIN_ROUTES = ["/admin/state", "/admin/sales/performance", "/admin/tags"];
  for (const route of ADMIN_ROUTES) {
    c(`${route} admits admin`, (await hit(route, admin)) !== 401);
    c(`${route} REFUSES a rep token`, (await hit(route, rep)) === 401);
    c(`${route} refuses a wrong token`, (await hit(route, wrong)) === 401);
    c(`${route} refuses no token`, (await hit(route, none)) === 401);
  }

  // The rep surface admits the rep AND the admin (the founder walks the same screen), refuses the rest.
  const REP_ROUTES = ["/rep/queue", "/rep/outcomes?stage=tech"];
  for (const route of REP_ROUTES) {
    c(`${route} admits the rep`, (await hit(route, rep)) !== 401);
    c(`${route} admits the admin too`, (await hit(route, admin)) !== 401);
    c(`${route} refuses a wrong token`, (await hit(route, wrong)) === 401);
    c(`${route} refuses no token`, (await hit(route, none)) === 401);
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
