// session.ts — the signed cookie that remembers a login.
//
// WHY A COOKIE AND NOT THE BROWSER'S OWN BASIC-AUTH POPUP. The popup is a browser chrome dialog:
// it cannot be in Arabic, it cannot carry the product's name or design, it cannot say what is wrong
// when a password is mistyped, and there is no way to sign OUT of it short of closing the browser.
// For a platform whose whole argument is an Arabic-first enterprise surface, the first screen an
// operator sees should not be an untranslatable grey box.
//
// WHAT IS SIGNED, AND WHY NOTHING IS STORED. The cookie carries the username and an expiry, and an
// HMAC over both. The server keeps no session table: it re-computes the signature and compares. A
// forged cookie fails the HMAC; an expired one fails the clock. That costs one hash per request and
// keeps a database outage from logging everyone out.
//
// THE KEY IS THE PASSWORD. Deriving the signing key from DASH_PASSWORD means changing the password
// invalidates every outstanding session, which is exactly what an operator expects "change the
// password" to do. No separate secret to set, and no way to leave a stale one behind.
//
// PURE. No I/O beyond node:crypto, no framework types.
import { createHmac, timingSafeEqual } from "node:crypto";

/** How long a login lasts. Long enough for a working day, short enough that a borrowed laptop
 *  stops being a way in by the next morning. */
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const SESSION_COOKIE = "massar_session";

const b64url = (b: Buffer) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function sign(payload: string, key: string): string {
  return b64url(createHmac("sha256", key).update(payload).digest());
}

/** `<user-b64>.<expiresAt>.<hmac>` — opaque to the browser, verifiable without state. */
export function mintSession(user: string, key: string, now: number, ttlMs = SESSION_TTL_MS): string {
  const exp = now + ttlMs;
  const payload = b64url(Buffer.from(user, "utf8")) + "." + exp;
  return payload + "." + sign(payload, key);
}

/**
 * The user this cookie proves, or null.
 *
 * Returns null — never throws and never partially trusts — for a malformed cookie, a bad
 * signature, or an expired one. The signature is checked BEFORE the expiry is believed, because
 * the expiry is attacker-supplied text until the HMAC says otherwise.
 */
export function readSession(cookie: unknown, key: string, now: number): string | null {
  if (typeof cookie !== "string" || !key) return null;
  const parts = cookie.split(".");
  if (parts.length !== 3) return null;
  const [userB64, expRaw, mac] = parts;
  const payload = userB64 + "." + expRaw;
  const expected = sign(payload, key);
  // Both are base64url of a 32-byte digest, so lengths match unless the cookie is junk.
  if (mac.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  if (!/^[0-9]+$/.test(expRaw)) return null;
  if (Number(expRaw) <= now) return null;
  try {
    const user = Buffer.from(userB64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return user || null;
  } catch {
    return null;
  }
}

/** The Set-Cookie value for a fresh login. HttpOnly so page script cannot read it (an XSS then
 *  cannot steal the session), SameSite=Lax so it does not ride cross-site requests, Secure because
 *  production is HTTPS-only. */
export function sessionCookie(value: string, maxAgeMs = SESSION_TTL_MS, secure = true): string {
  return [
    SESSION_COOKIE + "=" + value,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
    "Max-Age=" + Math.floor(maxAgeMs / 1000),
  ].filter(Boolean).join("; ");
}

/** The Set-Cookie value that ends a session. */
export function clearCookie(secure = true): string {
  return [SESSION_COOKIE + "=", "Path=/", "HttpOnly", "SameSite=Lax", secure ? "Secure" : "", "Max-Age=0"]
    .filter(Boolean).join("; ");
}

/** Read one cookie out of a `Cookie:` header without pulling in a parser. */
export function cookieValue(header: unknown, name: string): string | null {
  if (typeof header !== "string") return null;
  for (const part of header.split(";")) {
    const at = part.indexOf("=");
    if (at < 0) continue;
    if (part.slice(0, at).trim() === name) return part.slice(at + 1).trim();
  }
  return null;
}

/**
 * Where to send someone after login.
 *
 * ONLY a same-site path. `?next=https://evil.example` would otherwise turn the login form into an
 * open redirect — a phishing primitive that borrows this domain's credibility. Anything that is not
 * a single-slash-rooted path is discarded for the dashboard.
 */
export function safeNext(next: unknown): string {
  if (typeof next !== "string" || !next) return "/dashboard";
  if (!next.startsWith("/")) return "/dashboard";
  if (next.startsWith("//")) return "/dashboard";        // protocol-relative -> another host
  if (/[\r\n]/.test(next)) return "/dashboard";          // header splitting
  return next;
}
