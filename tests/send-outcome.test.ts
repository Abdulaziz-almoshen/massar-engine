// The three-way send outcome, which decides whether a customer gets a message twice.
//
// This suite exists because the classification was wrong twice while it was being written:
// first a 4xx-only test read a Gupshup HTTP 200 + {"status":"error"} as "unknown" and suppressed
// the text fallback, so the customer got nothing; then treating every non-rejection as "may have
// been delivered" marked rung one as sent after a LOCAL preflight throw that never reached the
// wire, permanently suppressing a message nobody had sent. Both are one-line regressions and
// neither is visible in a type check.
import { describe, it, expect } from "vitest";
import { isProviderRejection, isUnknownOutcome } from "../src/gupshup.js";

/** reject = the provider answered and refused, nothing was sent, a different shape may be retried.
 *  unknown = it may already be on the customer's phone; never resend, but do mark as delivered.
 *  local   = it never reached the wire; do not resend and do NOT mark, so it stays retryable. */
function classify(message: string): "reject" | "unknown" | "local" {
  const e = new Error(message);
  if (isProviderRejection(e)) return "reject";
  if (isUnknownOutcome(e)) return "unknown";
  return "local";
}

describe("send outcome classification", () => {
  it("treats an HTTP 200 carrying status:error as a definite refusal", () => {
    // postForm throws on `!res.ok || body.status === "error"`, so a 2xx here is an
    // application-level refusal. Nothing was sent; falling back to plain text is correct.
    expect(classify('gupshup 200: {"status":"error","message":"invalid button title"}')).toBe("reject");
  });

  it("treats 4xx as a definite refusal", () => {
    expect(classify("gupshup 400: bad request")).toBe("reject");
    expect(classify("gupshup 429: rate limited")).toBe("reject");
  });

  it("treats 5xx as ambiguous, never as a licence to resend", () => {
    // The provider broke AFTER accepting the request. A resend here is the duplicate.
    expect(classify("gupshup 500: upstream boom")).toBe("unknown");
    expect(classify("gupshup 503: unavailable")).toBe("unknown");
  });

  it("treats a timeout or socket failure as ambiguous", () => {
    expect(classify("gupshup unreachable (outcome unknown, do not resend): TimeoutError")).toBe("unknown");
    expect(classify("gupshup unreachable (outcome unknown, do not resend): fetch failed")).toBe("unknown");
  });

  it("treats a local preflight throw as never-sent, so it stays retryable", () => {
    // baseParams() throws this before any HTTP call when the API key or source number is missing.
    // Marking it delivered would suppress a message that was never sent.
    expect(classify("outbound not ready: app name unknown")).toBe("local");
    expect(classify("outbound not ready: GUPSHUP_API_KEY missing")).toBe("local");
  });

  it("is not fooled by a status echoed inside the provider's own error body", () => {
    // The predicates are anchored for this reason: an unanchored test read the 400 in this 5xx
    // body as our own prefix and flipped an ambiguous outcome into "safe to resend".
    expect(classify("gupshup 500: upstream said gupshup 400: nested")).toBe("unknown");
  });

  it("never classifies the same error as both a rejection and unknown", () => {
    for (const m of [
      'gupshup 200: {"status":"error"}', "gupshup 400: x", "gupshup 500: x",
      "gupshup unreachable (outcome unknown, do not resend): x", "outbound not ready: x",
    ]) {
      const e = new Error(m);
      expect(isProviderRejection(e) && isUnknownOutcome(e)).toBe(false);
    }
  });
});
