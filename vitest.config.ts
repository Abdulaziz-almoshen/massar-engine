import { defineConfig } from "vitest/config";

// Technical Standards §4.1 — coverage is a BUILD GATE, not a report. `npm test` fails below the
// threshold rather than printing a number nobody reads.
//
// SCOPE, stated rather than assumed. The thresholds apply to the tiers that CAN be unit-tested:
// the business rules (`opps-domain.ts`) and the validators that guard the write path (`db.ts`,
// `insights.ts`, `facts.ts`, `audience.ts`). Excluded, each for a reason a reviewer can check:
//
//   · `dashboard.ts`, `*-crm.ts`  — presentation. These modules export STRINGS of browser
//     JavaScript inside template literals; there is no unit to call. They are covered instead by
//     `npm run smoke`, which loads twelve real routes in a real browser and fails on a blank
//     render — the guard that actually catches this tier's failure mode (ADR-0001).
//   · `index.ts`, `db.ts`          — the Fastify wiring and the Postgres layer. db.ts is 300
//     covered-lines of pool IO; unit-testing it means mocking a database, which §4.3 forbids
//     outright. Its PURE parts are tested regardless (`validateOppLine` has its own suite in
//     tests/validators.test.ts) — they simply do not count toward a percentage the rest of the
//     file would drag down for the wrong reason. NAMED NEXT SLICE: Testcontainers Postgres, at
//     which point db.ts and index.ts join this list.
//   · `insights.ts`                — 201 lines, most of them the OpenAI analyst call and its
//     prompt. Same rule: the model boundary is not something to mock. Its pure helpers
//     (`canonicalService`, `windowState`, `scrubInventedIntent`) are tested in validators.test.ts.
//   · `gupshup.ts`, `outbound.ts`, `queue.ts`, `tracker.ts`, `agent.ts` — network and model
//     adapters, same reason.
//
// Excluding a file from the denominator is a claim about what the gate means. Every entry above is
// a deliberate scope decision with its own compensating control, not a way to make 60% cheaper.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "json-summary"],
      include: [
        "src/opps-domain.ts", // business tier — the opportunity rules
        "src/signal-domain.ts", // business tier — the client seriousness / momentum indicators
        "src/facts.ts",       // the fact refusal ladder
        "src/audience.ts",    // the importer: header matching, phone normalisation, skip reasons
      ],
      thresholds: {
        // §4.1 as of 11 Apr 2026: target 90%, build-blocking minimum 60%.
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60,
      },
    },
  },
});
