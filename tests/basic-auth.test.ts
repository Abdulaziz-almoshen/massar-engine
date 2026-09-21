import { describe, expect, it } from "vitest";
import {
  configProblem, isBasicAuthOn, mayOpenDashboard, parseBasicAuth, safeEqual,
} from "../src/basic-auth.js";

const b64 = (s: string) => "Basic " + Buffer.from(s, "utf8").toString("base64");
const CFG = { user: "massar", pass: "a-long-enough-secret" };

describe("parseBasicAuth", () => {
  it("reads a well-formed header", () => {
    expect(parseBasicAuth(b64("massar:pw"))).toEqual({ user: "massar", pass: "pw" });
  });

  it("splits on the FIRST colon, so a password may contain colons", () => {
    expect(parseBasicAuth(b64("u:a:b:c"))).toEqual({ user: "u", pass: "a:b:c" });
  });

  it("reads a non-ASCII password — the operator may well type Arabic", () => {
    expect(parseBasicAuth(b64("مدير:كلمة-سر-طويلة"))).toEqual({ user: "مدير", pass: "كلمة-سر-طويلة" });
  });

  it("refuses anything malformed rather than guessing", () => {
    for (const bad of [null, undefined, 42, {}, "", "Basic", "Bearer abc", "Basic !!!!", b64("nocolon")]) {
      expect(parseBasicAuth(bad as unknown)).toBeNull();
    }
  });
});

describe("safeEqual", () => {
  it("matches equal strings and rejects everything else", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "ab")).toBe(false);   // a prefix is not a match
    expect(safeEqual("", "")).toBe(true);
    expect(safeEqual(null, "")).toBe(true);       // both coerce to ""
    expect(safeEqual(undefined, "x")).toBe(false);
    expect(safeEqual(123 as unknown, "123")).toBe(false);  // a number is not the string
  });
});

describe("the gate is OFF unless both secrets are set", () => {
  it("needs a user and a password", () => {
    expect(isBasicAuthOn({ user: null, pass: null })).toBe(false);
    expect(isBasicAuthOn({ user: "u", pass: null })).toBe(false);
    expect(isBasicAuthOn({ user: null, pass: "p" })).toBe(false);
    expect(isBasicAuthOn(CFG)).toBe(true);
  });

  it("says WHY it is off, so a misconfigured deploy announces itself", () => {
    expect(configProblem({ user: null, pass: null })).toMatch(/unset/);
    expect(configProblem({ user: "u", pass: null })).toMatch(/DASH_PASSWORD/);
    expect(configProblem({ user: null, pass: "p" })).toMatch(/DASH_USER/);
    // On, but weak — still a finding, because "configured" and "safe" are different claims.
    expect(configProblem({ user: "u", pass: "short" })).toMatch(/12/);
    expect(configProblem(CFG)).toBeNull();
  });
});

describe("mayOpenDashboard", () => {
  const H = (authorization?: string, adminToken?: string) => ({ authorization, adminToken });

  it("lets everyone in when the gate is off — local dev must still work", () => {
    expect(mayOpenDashboard({ user: null, pass: null }, H(), null).ok).toBe(true);
  });

  it("accepts the right credentials", () => {
    expect(mayOpenDashboard(CFG, H(b64("massar:a-long-enough-secret")), null).ok).toBe(true);
  });

  it("refuses the wrong ones, and challenges rather than 404ing", () => {
    for (const bad of ["massar:wrong", "wrong:a-long-enough-secret", "massar:", ":a-long-enough-secret"]) {
      const r = mayOpenDashboard(CFG, H(b64(bad)), null);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.challenge).toBe(true);
    }
  });

  it("refuses a missing header", () => {
    expect(mayOpenDashboard(CFG, H(), null).ok).toBe(false);
  });

  it("accepts the admin token from the HEADER, for scripts and smoke", () => {
    expect(mayOpenDashboard(CFG, H(undefined, "tok-123"), "tok-123").ok).toBe(true);
  });

  it("refuses a wrong admin token", () => {
    expect(mayOpenDashboard(CFG, H(undefined, "nope"), "tok-123").ok).toBe(false);
  });

  it("does not accept a token when the server has none configured", () => {
    // Otherwise an instance with ADMIN_TOKEN unset would accept ANY x-admin-token header.
    expect(mayOpenDashboard(CFG, H(undefined, ""), null).ok).toBe(false);
    expect(mayOpenDashboard(CFG, H(undefined, "anything"), null).ok).toBe(false);
  });
});
