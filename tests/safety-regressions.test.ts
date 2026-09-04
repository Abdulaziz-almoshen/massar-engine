import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

// TWO MANDATORY REGRESSIONS (R17). Both were real, both were proven by attack or by measurement
// this cycle, and neither had a test. They are here rather than in a checker script because both
// are about BEHAVIOUR under a specific input, which a grep cannot assert.

describe("R17.1 — the seeder can never send a WhatsApp message", () => {
  const seed = read("scripts/seed-local.mjs");
  const index = read("src/index.ts");
  const FORBIDDEN = JSON.parse(
    (seed.match(/const FORBIDDEN = (\[[^\]]*\]);/) ?? [])[1]!.replace(/'/g, '"'));

  it("still carries all three independent guards", () => {
    // Any ONE of these alone has a hole. The URL check does not stop a local engine with live keys;
    // the health check does not stop a typo'd production URL; the denylist does not stop the
    // webhook path, which is how the seeder forges inbound messages the agent then REPLIES to.
    expect(seed, "local-target check").toMatch(/refusing to seed a non-local target/);
    expect(seed, "outbound.ok assertion").toMatch(/outbound\?\.ok !== false|outbound\.ok !== false/);
    expect(seed, "denylist enforcement").toMatch(/FORBIDDEN\.some/);
    expect(FORBIDDEN.length).toBeGreaterThanOrEqual(4);
  });

  // THE REGRESSION THAT MATTERS. A denylist of string paths silently stops matching the moment a
  // route is renamed: FORBIDDEN keeps the old path, `path.startsWith(f)` matches nothing, and the
  // seeder can post to a live send route with the standing «NO WHATSAPP SEND, TO ANY NUMBER, FOR
  // ANY REASON» rule fully in force and nothing reporting a problem.
  it.each(["/admin/send-test", "/admin/send-template", "/admin/campaign/launch", "/admin/campaign/test"])(
    "%s is still a real route, so the denylist entry still matches something", (route) => {
      expect(FORBIDDEN).toContain(route);
      expect(index, `${route} was renamed or removed — FORBIDDEN now blocks a path that does not exist`)
        .toContain(`"${route}"`);
    });

  // And the mirror: a NEW send route that nobody added to the list. This is the exact shape of the
  // defect found this cycle, where the webhook was a fifth path the denylist did not know about.
  it("every route that can reach WhatsApp is on the denylist", () => {
    const routes = [...index.matchAll(/app\.post\("(\/admin\/[^"]+)"/g)].map((m) => m[1]);
    const senders = routes.filter((r) => /send|launch|template/.test(r));
    const unlisted = senders.filter((r) => !FORBIDDEN.includes(r));
    expect(unlisted, "send-capable routes missing from seed-local.mjs FORBIDDEN").toEqual([]);
  });
});

describe("R17.2 — an uploaded cell cannot steal ADMIN_TOKEN", () => {
  // The original: JSON.stringify(x).replace(/"/g, "&quot;") interpolated into an HTML attribute.
  // It escapes the quote and NOT the ampersand, so a cell containing &quot; survives one decode
  // and closes the attribute. Proven by attack — a spreadsheet cell read localStorage and set
  // PWNED: true. The fix was a data attribute plus a delegated listener, over a real escaper.
  const dash = read("src/dashboard.ts");

  // Extract the escaper AS SHIPPED and run the actual attack payload through it, rather than
  // asserting on the text of the source. A test that greps for the fix passes on a fix that
  // does not work.
  // The whole LINE, not up to the first «;» — the definition contains "&#39;", whose semicolon
  // truncated an earlier version of this extraction mid-string and made the suite fail to parse.
  const escSrc = (dash.match(/^const esc = (.+);$/m) ?? [])[1]!;
  // eslint-disable-next-line no-eval
  const esc = eval(escSrc) as (s: unknown) => string;

  it("escapes the ampersand, which is the whole bug", () => {
    expect(esc("&")).toBe("&amp;");
    expect(esc("&quot;")).toBe("&amp;quot;");   // NOT "&quot;" — that is the exploit
  });

  it("neutralises the proven attack payload", () => {
    const attack = '&quot; onmouseover=&quot;fetch(1)&quot; x=&quot;';
    const out = esc(attack);
    expect(out).not.toContain('"');
    // A browser decodes an attribute value exactly ONCE, so the check must decode once too — as a
    // single simultaneous pass, not two sequential replaces. Two passes turn &amp;quot; back into a
    // real quote and «prove» a vulnerability the browser would never see; that mistake is what made
    // the first version of this test fail against correct code.
    const decodeOnce = (t: string) => t.replace(/&(amp|quot|lt|gt|#39);/g,
      (_m, e) => ({ amp: "&", quot: '"', lt: "<", gt: ">", "#39": "'" } as Record<string, string>)[e]);
    const seen = decodeOnce(out);
    expect(seen, "one decode pass must leave inert text, never a quote that closes the attribute")
      .not.toContain('"');
    // And the exploit only works if a second decode is reachable; assert it is not, by showing the
    // once-decoded text still carries the escaped ampersand rather than a live entity.
    expect(seen).toContain("&quot;");
  });

  it.each([["<", "&lt;"], [">", "&gt;"], ['"', "&quot;"], ["'", "&#39;"], ["&", "&amp;"]])(
    "escapes %s", (raw, want) => { expect(esc(raw)).toBe(want); });

  it("escapes & before the character it would re-introduce", () => {
    // Order matters: escaping " first and & second turns &quot; into &amp;quot; correctly, but
    // escaping & AFTER " would double-escape. One pass over a character class is the only safe form.
    expect(esc('a&b"c')).toBe("a&amp;b&quot;c");
  });

  it("no live attribute is still built by stringify-then-replace-quote", () => {
    const files = ["src/dashboard.ts", ...fs.readdirSync("src").filter((f) => /-crm\.ts$|rep-page\.ts$/.test(f)).map((f) => "src/" + f)];
    const offenders = files.filter((f) => /JSON\.stringify\([^)]*\)\s*\.replace\(\s*\/"\/g/.test(read(f)));
    expect(offenders, "stringify + quote-only replace is the exact XSS that stole the admin token").toEqual([]);
  });
});

describe("R16 — CI can never become a sender", () => {
  const ci = read(".github/workflows/ci.yml");

  // CI boots the engine and then runs a seeder that forges inbound webhooks the agent replies to.
  // The only thing standing between that and a real WhatsApp message is the absence of a usable
  // Gupshup credential. These assertions are cheap; the failure they prevent is not.
  it("reads no repository secrets at all", () => {
    expect(ci, "a secret in this workflow can give the CI engine live provider keys")
      .not.toMatch(/secrets\./);
  });

  it("sets GUPSHUP_API_KEY explicitly empty, not merely absent", () => {
    // MEASURED, on a checkout with a real .env: config.ts does `import "dotenv/config"`, and dotenv
    // does not override an already-set variable. With the key merely UNSET the engine reported
    // outbound.ok true and could send; set EMPTY it reported
    // { ok: false, reason: "GUPSHUP_API_KEY missing" }. Absence is not a guard.
    expect(ci).toMatch(/GUPSHUP_API_KEY:\s*""/);
  });

  it("asserts outbound is disabled BEFORE it runs the seeder", () => {
    const assertAt = ci.indexOf("assert the engine CANNOT send");
    const seedAt = ci.indexOf("seed-local.mjs");
    expect(assertAt, "the no-send assertion is missing from CI").toBeGreaterThan(-1);
    expect(seedAt).toBeGreaterThan(-1);
    expect(assertAt, "the seeder runs BEFORE the no-send assertion").toBeLessThan(seedAt);
  });

  it("fails the build when the DB suite skips itself", () => {
    // A suite that skips with no TEST_DATABASE_URL reports a green tick having asserted nothing.
    expect(ci).toMatch(/TEST_DATABASE_URL/);
    expect(ci).toMatch(/skipped/);
  });
});
