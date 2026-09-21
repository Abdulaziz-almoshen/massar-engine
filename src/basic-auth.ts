// basic-auth.ts — who may open the dashboard at all.
//
// WHAT THIS REPLACES. /dashboard was served to ANYONE: the page shell, the whole client script and
// every Arabic label in it came back on an unauthenticated GET. Only the /admin/* fetches were
// gated, by a token the operator pasted into `?token=` in the URL — which then lives in browser
// history, in any proxy log, and in the Referer header of every outbound link. That same token is
// how this project's admin credential ended up quoted in a chat transcript.
//
// So the gate moves in front of the page, and the token stops travelling in the URL: once Basic
// Auth passes, the server hands the page its token in the HTML body instead.
//
// PURE. No I/O, no framework types. Every decision here is a function of its arguments, so the
// route layer stays a thin adapter and these rules are unit-testable.

/** Parsed `Authorization: Basic <base64>`. Null when the header is absent or malformed. */
export function parseBasicAuth(header: unknown): { user: string; pass: string } | null {
  if (typeof header !== "string") return null;
  const m = /^Basic\s+([A-Za-z0-9+/=]+)$/.exec(header.trim());
  if (!m) return null;
  let decoded: string;
  try {
    decoded = Buffer.from(m[1], "base64").toString("utf8");
  } catch {
    return null;
  }
  // The FIRST colon splits; a password may legally contain more of them.
  const at = decoded.indexOf(":");
  if (at < 0) return null;
  return { user: decoded.slice(0, at), pass: decoded.slice(at + 1) };
}

/**
 * Constant-time string equality.
 *
 * A plain `===` on a secret leaks its length and its first differing byte through timing. That is a
 * thin attack over the public internet, but this is the only thing standing in front of the whole
 * customer book, and the correct comparison costs nothing.
 */
export function safeEqual(a: unknown, b: unknown): boolean {
  const x = typeof a === "string" ? a : "";
  const y = typeof b === "string" ? b : "";
  // Compare over the longer of the two so the loop count does not reveal which is shorter.
  const n = Math.max(x.length, y.length);
  let diff = x.length ^ y.length;
  for (let i = 0; i < n; i++) diff |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0);
  return diff === 0;
}

export type BasicAuthConfig = { user: string | null; pass: string | null };

/**
 * Is the gate switched on?
 *
 * OFF when either secret is missing — and that is deliberate, not a loophole: local development and
 * `npm run smoke` run without secrets, and a gate that cannot be satisfied would make the dashboard
 * unopenable rather than secure. `configProblem` below is what makes the disabled state VISIBLE, so
 * "off" can never be mistaken for "on" in production.
 */
export function isBasicAuthOn(cfg: BasicAuthConfig): boolean {
  return !!(cfg.user && cfg.pass);
}

/**
 * The reason the gate is not protecting anything, or null when it is. Printed on /health so a
 * misconfigured production instance announces itself instead of quietly serving the book to the
 * internet.
 */
export function configProblem(cfg: BasicAuthConfig): string | null {
  if (!cfg.user && !cfg.pass) return "DASH_USER and DASH_PASSWORD are unset — the dashboard is open";
  if (!cfg.user) return "DASH_USER is unset — the dashboard is open";
  if (!cfg.pass) return "DASH_PASSWORD is unset — the dashboard is open";
  if (cfg.pass.length < 12) return "DASH_PASSWORD is shorter than 12 characters";
  return null;
}

export type AuthOutcome = { ok: true } | { ok: false; challenge: true };

/**
 * May this request open the dashboard?
 *
 * The admin token is accepted as an ALTERNATIVE credential, via the `x-admin-token` header only —
 * never from the query string. Scripts and the smoke suite already hold that token, and forcing
 * them onto Basic Auth would buy nothing: it is the same secret either way. What it must not do is
 * come back through `?token=`, which is the leak this module exists to close.
 */
export function mayOpenDashboard(
  cfg: BasicAuthConfig,
  headers: { authorization?: unknown; adminToken?: unknown },
  adminToken: string | null,
): AuthOutcome {
  if (!isBasicAuthOn(cfg)) return { ok: true };
  if (adminToken && safeEqual(headers.adminToken, adminToken)) return { ok: true };
  const creds = parseBasicAuth(headers.authorization);
  if (creds && safeEqual(creds.user, cfg.user) && safeEqual(creds.pass, cfg.pass)) return { ok: true };
  return { ok: false, challenge: true };
}
