#!/usr/bin/env node
// Fails the CHECK, never the running engine.
//
// insights.ts SERVICE_CATALOGUE and agent.ts PRODUCTS are two hand-maintained copies of one
// truth: add a service to one and not the other and it is silently filed as «خدمة أخرى» on
// every board. Guarding that at module load would crash-loop production — including the
// opt-out path — so the guard lives here and in `npm run build`'s sibling check instead.
//
// Usage:  npm run check:catalogue   → exit 1 on drift, and name the services.
import { catalogueDrift } from "../dist/agent.js";
import { SERVICE_CATALOGUE } from "../dist/insights.js";

const drift = catalogueDrift();
if (drift.length) {
  console.error("service catalogue drift — in PRODUCTS (agent.ts) but not SERVICE_CATALOGUE (insights.ts):");
  for (const s of drift) console.error("  •", s);
  console.error("\nAdd them to SERVICE_CATALOGUE in src/insights.ts, or they will be filed as «خدمة أخرى».");
  process.exit(1);
}
console.log(`catalogue in step: ${SERVICE_CATALOGUE.length} services, 0 drift`);
