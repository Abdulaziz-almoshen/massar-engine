import { describe, expect, it } from "vitest";
import {
  SESSION_COOKIE, SESSION_TTL_MS, clearCookie, cookieValue, mintSession, readSession, safeNext, sessionCookie,
} from "../src/session.js";

const KEY = "a-long-enough-secret";
const NOW = 1_800_000_000_000;

describe("mint and read", () => {
  it("round-trips the user", () => {
    expect(readSession(mintSession("massar", KEY, NOW), KEY, NOW + 1000)).toBe("massar");
  });

  it("round-trips an Arabic username", () => {
    const c = mintSession("مدير النظام", KEY, NOW);
    expect(readSession(c, KEY, NOW + 1000)).toBe("مدير النظام");
  });

  it("expires", () => {
    const c = mintSession("massar", KEY, NOW);
    expect(readSession(c, KEY, NOW + SESSION_TTL_MS - 1)).toBe("massar");
    expect(readSession(c, KEY, NOW + SESSION_TTL_MS + 1)).toBeNull();
  });

  it("refuses a cookie signed with another key — this is the whole point", () => {
    expect(readSession(mintSession("massar", "other-key", NOW), KEY, NOW + 1)).toBeNull();
  });

  it("refuses a cookie whose expiry was edited", () => {
    const c = mintSession("massar", KEY, NOW);
    const [u, , mac] = c.split(".");
    const forged = u + "." + (NOW + 10 * SESSION_TTL_MS) + "." + mac;
    expect(readSession(forged, KEY, NOW + 1)).toBeNull();
  });

  it("refuses a cookie whose user was swapped", () => {
    const c = mintSession("viewer", KEY, NOW);
    const [, exp, mac] = c.split(".");
    const forged = Buffer.from("massar").toString("base64").replace(/=+$/, "") + "." + exp + "." + mac;
    expect(readSession(forged, KEY, NOW + 1)).toBeNull();
  });

  it("refuses junk instead of throwing", () => {
    for (const bad of [null, undefined, 42, {}, "", "a", "a.b", "a.b.c.d", "...", "a.b.c"]) {
      expect(readSession(bad as unknown, KEY, NOW)).toBeNull();
    }
  });

  it("refuses everything when the server has no key", () => {
    expect(readSession(mintSession("massar", KEY, NOW), "", NOW + 1)).toBeNull();
  });
});

describe("cookie shaping", () => {
  it("is HttpOnly, SameSite=Lax and Secure", () => {
    const c = sessionCookie("v");
    expect(c).toContain("HttpOnly");
    expect(c).toContain("SameSite=Lax");
    expect(c).toContain("Secure");
    expect(c).toContain(SESSION_COOKIE + "=v");
  });

  it("drops Secure for local http", () => {
    expect(sessionCookie("v", SESSION_TTL_MS, false)).not.toContain("Secure");
  });

  it("clears with Max-Age=0", () => {
    expect(clearCookie()).toContain("Max-Age=0");
  });

  it("reads one cookie out of a header", () => {
    expect(cookieValue("a=1; massar_session=xyz; b=2", SESSION_COOKIE)).toBe("xyz");
    expect(cookieValue("a=1", SESSION_COOKIE)).toBeNull();
    expect(cookieValue(null, SESSION_COOKIE)).toBeNull();
    // A value containing '=' survives: only the FIRST '=' splits.
    expect(cookieValue("massar_session=a.b.c==", SESSION_COOKIE)).toBe("a.b.c==");
  });
});

describe("safeNext — the login form must not become an open redirect", () => {
  it("keeps a same-site path", () => {
    expect(safeNext("/dashboard#opps")).toBe("/dashboard#opps");
    expect(safeNext("/rep")).toBe("/rep");
  });

  it("refuses anything that leaves this host", () => {
    for (const bad of ["https://evil.example", "//evil.example", "http://x", "evil", "", null, undefined, 42]) {
      expect(safeNext(bad as unknown)).toBe("/dashboard");
    }
  });

  it("refuses header splitting", () => {
    expect(safeNext("/a\r\nSet-Cookie: x=1")).toBe("/dashboard");
  });
});
