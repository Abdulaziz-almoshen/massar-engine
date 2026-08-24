// Unit tests for the pure validators on the write paths (Technical Standards §4).
//
// These are the functions that decide whether a value is ALLOWED into the ledger. Every one of them
// was previously exercised only through a live HTTP call against production — which is how the
// `years` defect below shipped, and why it was found by a curl against the deployed engine rather
// than by a test. FIRST + AAA throughout; nothing here touches Postgres, the network, or the clock
// except through an injected `now`.

import { describe, it, expect } from "vitest";
import { validateOppLine, OPP_STAGES as DB_OPP_STAGES, OPP_SOURCES as DB_OPP_SOURCES } from "../src/db.js";
import { normalizePhone, tagsFromCell } from "../src/audience.js";
import { canonicalService, scrubInventedIntent, windowState, SERVICE_CATALOGUE, OTHER_SERVICE, SESSION_WINDOW_MS } from "../src/insights.js";
import { readFacts, missingKeys, isAgentWritable, factsFromAttrs } from "../src/facts.js";
import { OPP_STAGES, OPP_SOURCES } from "../src/opps-domain.js";

describe("validateOppLine", () => {
  it("accepts a line that carries only a product", () => {
    // Arrange — years/quantity/discount are optional; the API and the INSERT both default them.
    const line = { product: "فحص الموظفين" };
    // Act
    const rejection = validateOppLine(line);
    // Assert
    expect(rejection).toBeNull();
  });

  it("does NOT read an absent `years` as zero", () => {
    // Arrange — THE regression. An omitted years was read as 0, failed `years < 1`, and the request
    // was rejected naming the wrong field — which hid an unknown product behind a complaint about a
    // number nobody sent. Caught in production by curl, not by a test. This is that test.
    const line = { product: "منتج غير معروف" };
    // Act
    const rejection = validateOppLine(line);
    // Assert — it must NOT complain about years
    expect(rejection).not.toBe("years");
  });

  it("names the field it rejected, so a form can point at it", () => {
    // Arrange + Act + Assert — each bad value reports its own field, never a neighbour's.
    expect(validateOppLine({ product: "" })).toBe("product");
    expect(validateOppLine({ product: "x", stage: "مرحلة مخترعة" })).toBe("stage");
    expect(validateOppLine({ product: "x", sale_price: -1 })).toBe("sale_price");
    expect(validateOppLine({ product: "x", years: 40 })).toBe("years");
    expect(validateOppLine({ product: "x", qty: 0 })).toBe("qty");
    expect(validateOppLine({ product: "x", discount: 900 })).toBe("discount");
  });

  it("rejects a discount that would render a NEGATIVE deal value", () => {
    // Arrange — «قيمة الفرصة» is a number the founder reads as money; 101% turns it negative.
    // Act + Assert
    expect(validateOppLine({ product: "x", discount: 101 })).toBe("discount");
    expect(validateOppLine({ product: "x", discount: 100 })).toBeNull();
  });

  it("rejects fractional years and quantities", () => {
    // Arrange — the column is INT; a fraction would be silently truncated by Postgres.
    expect(validateOppLine({ product: "x", years: 1.5 })).toBe("years");
    expect(validateOppLine({ product: "x", qty: 2.5 })).toBe("qty");
  });

  it("accepts every stage the shipped ladder offers", () => {
    // Arrange — the emitted-value-must-be-readable rule, as an assertion: the board offers these
    // six keys, so the validator must accept exactly these six.
    for (const stage of OPP_STAGES) {
      expect(validateOppLine({ product: "x", stage: stage.key }), stage.key).toBeNull();
    }
  });
});

describe("the stage and source vocabularies agree across tiers", () => {
  it("the CHECK constraint list matches the business tier's ladder", () => {
    // Arrange — db.ts owns the CHECK constraint, opps-domain.ts owns the labels the UI renders.
    // Two lists in two files is how a stage becomes selectable in the UI and rejected by the
    // database. This test is the only thing keeping them one vocabulary.
    // Act + Assert
    expect([...DB_OPP_STAGES].sort()).toEqual(OPP_STAGES.map((s) => s.key).sort());
  });

  it("the source CHECK constraint matches the labelled sources", () => {
    expect([...DB_OPP_SOURCES].sort()).toEqual(Object.keys(OPP_SOURCES).sort());
  });
});

describe("normalizePhone", () => {
  it("turns a Saudi 05 number into full international form", () => {
    // Arrange — the founder's book arrives as 05…; the ledger is keyed on 9665….
    // Act + Assert
    expect(normalizePhone("0512345678")).toBe("966512345678");
  });

  it("is idempotent, so an already-normalised number is not mangled", () => {
    const once = normalizePhone("0512345678");
    expect(normalizePhone(once)).toBe(once);
  });

  it("strips separators and a leading plus", () => {
    expect(normalizePhone("+966 51 234 5678")).toBe("966512345678");
    expect(normalizePhone("966-512-345-678")).toBe("966512345678");
  });

  it("converts Arabic-Indic digits, because that is how they are typed", () => {
    // Arrange — a number pasted from an Arabic sheet arrives as ٠٥١٢٣٤٥٦٧٨.
    // Act + Assert
    expect(normalizePhone("٠٥١٢٣٤٥٦٧٨")).toBe("966512345678");
  });

  it("returns something short rather than a plausible wrong number for junk", () => {
    // Arrange — the caller's contract is `length < 8 → reject`; it must not invent digits.
    expect(normalizePhone("").length).toBeLessThan(8);
    expect(normalizePhone("abc").length).toBeLessThan(8);
    expect(normalizePhone(null).length).toBeLessThan(8);
    expect(normalizePhone(undefined).length).toBeLessThan(8);
  });
});

describe("tagsFromCell", () => {
  it("splits one cell naming several services on the Arabic comma", () => {
    // Arrange — «خط المنتجات» cells arrive as «الإجازات المرضية، فحص الموظفين».
    // Act
    const tags = tagsFromCell("الإجازات المرضية، فحص الموظفين");
    // Assert
    expect(tags).toEqual(["الإجازات المرضية", "فحص الموظفين"]);
  });

  it("collapses blanks and repeats rather than minting near-duplicate labels", () => {
    // Arrange — two spellings of one list is the emitted-value-unreadable defect in another hat.
    expect(tagsFromCell("أ، ، أ")).toEqual(["أ"]);
    expect(tagsFromCell("")).toEqual([]);
  });
});

describe("canonicalService", () => {
  it("returns catalogue names unchanged", () => {
    for (const service of SERVICE_CATALOGUE) {
      expect(canonicalService(service)).toBe(service);
    }
  });

  it("files anything outside the catalogue as «خدمة أخرى» rather than inventing a name", () => {
    // Arrange — an unclamped name reaches a board no filter can search. The agent prompt promises
    // this clamp; this asserts the code keeps the promise.
    // Act + Assert
    expect(canonicalService("خدمة اخترعها النموذج")).toBe(OTHER_SERVICE);
  });

  it("distinguishes «no service named» from «a service I do not recognise»", () => {
    // Arrange — empty in, empty out: the model naming NOTHING is not the same event as it naming
    // something off-catalogue, and collapsing the two would file every silent turn under
    // «خدمة أخرى» and inflate that bucket on every board that counts it.
    // Act + Assert
    expect(canonicalService("")).toBe("");
    expect(canonicalService("   ")).toBe("");
    expect(canonicalService("خدمة اخترعها النموذج")).toBe(OTHER_SERVICE);
  });
});

describe("scrubInventedIntent", () => {
  it("returns a string for every input shape, including non-strings", () => {
    // Arrange — it runs on model output, which is not guaranteed to be a string at all.
    // Act + Assert
    expect(typeof scrubInventedIntent("نص عادي")).toBe("string");
    expect(typeof scrubInventedIntent(null)).toBe("string");
    expect(typeof scrubInventedIntent(undefined)).toBe("string");
    expect(typeof scrubInventedIntent(42)).toBe("string");
  });
});

describe("windowState — the 24h WhatsApp session rule", () => {
  const NOW = 1_800_000_000_000;

  it("reports «unknown», not «closed», for someone who never wrote to us", () => {
    // Arrange — the distinction is the point: a closed window means we KNOW the 24h lapsed; unknown
    // means they never messaged at all, which is also the state with no consent evidence.
    // Act
    const state = windowState(undefined, NOW);
    // Assert
    expect(state.state).toBe("unknown");
    expect(state.lastInboundAt).toBeNull();
    expect(state.reason).toBeTruthy();
  });

  it("only a CUSTOMER turn opens the window — never our own message", () => {
    // Arrange — an agent turn opening the session would authorise a free-form send off our own
    // outbound, which is precisely what the platform rule forbids.
    const agentOnly = { transcript: [{ role: "agent", ts: NOW - 60000 }] };
    // Act + Assert
    expect(windowState(agentOnly as never, NOW).state).toBe("unknown");
  });

  it("closes exactly at the 24-hour boundary, not after it", () => {
    // Arrange — one minute inside is open; the boundary itself is closed.
    const justInside = { transcript: [{ role: "customer", ts: NOW - SESSION_WINDOW_MS + 60000 }] };
    const atBoundary = { transcript: [{ role: "customer", ts: NOW - SESSION_WINDOW_MS }] };
    // Act + Assert
    expect(windowState(justInside as never, NOW).state).toBe("open");
    expect(windowState(atBoundary as never, NOW).state).toBe("closed");
  });
});

describe("facts", () => {
  it("returns an empty set for anything that is not a fact object", () => {
    // Arrange — `entities.facts` is JSONB and can hold whatever an older write left behind.
    // Act + Assert
    expect(readFacts(null)).toEqual({});
    expect(readFacts("not an object")).toEqual({});
    expect(readFacts(42)).toEqual({});
  });

  it("lists every unknown fact as missing when nothing is known", () => {
    // Arrange — the prompt's gap list is built from this; an empty account must ask for everything.
    // Act
    const gaps = missingKeys({});
    // Assert
    expect(gaps.length).toBeGreaterThan(0);
  });

  it("stops asking for a fact once it is known", () => {
    // Arrange — the whole point of the account graph: a fact learned once is never asked again.
    const known = readFacts({});
    const before = missingKeys(known).length;
    const withOne = factsFromAttrs({ "عدد الفروع": "12" }, 1);
    // Act
    const after = missingKeys({ ...known, ...withOne }).length;
    // Assert
    expect(after).toBeLessThanOrEqual(before);
  });

  it("keeps `customerName` out of the agent's reach", () => {
    // Arrange — facts.ts states this explicitly: the WhatsApp display name is already on the
    // contact and is not the entity's legal identity, so the model may never write it. A boolean
    // that returned true for everything would make the whole writability distinction decorative.
    // Act + Assert
    expect(isAgentWritable("customerName" as never)).toBe(false);
    expect(isAgentWritable("hisName" as never)).toBe(true);
  });
});
