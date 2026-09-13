import { describe, it, expect } from "vitest";
import * as tracker from "../src/tracker.js";

// The in-memory half of a product rename. The durable half (interest_tags) moves inside the
// database transaction; this is what the read path shows until the next restart.
describe("tracker.renameTagProduct", () => {
  it("rewrites tags[].product on every contact carrying the old name and reports how many changed", () => {
    const a = tracker.getContact("966500000101");
    const b = tracker.getContact("966500000102");
    const c = tracker.getContact("966500000103");
    a.tags = [{ product: "قديم", level: "hot", ts: 10 }, { product: "آخر", level: "warm", ts: 5 }];
    b.tags = [{ product: "آخر", level: "cold", ts: 1 }];
    // Already carries the destination name too: the newer reading survives, once.
    c.tags = [{ product: "قديم", level: "warm", ts: 20 }, { product: "جديد", level: "hot", ts: 8 }];

    expect(tracker.renameTagProduct("قديم", "جديد")).toBe(2);

    expect(a.tags).toEqual([{ product: "جديد", level: "hot", ts: 10 }, { product: "آخر", level: "warm", ts: 5 }]);
    expect(b.tags).toEqual([{ product: "آخر", level: "cold", ts: 1 }]);
    expect(c.tags).toEqual([{ product: "جديد", level: "warm", ts: 20 }]);
    expect(tracker.renameTagProduct("قديم", "جديد")).toBe(0);
  });
});
