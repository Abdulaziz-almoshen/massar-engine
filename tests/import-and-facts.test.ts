// Unit tests for the audience importer and the fact refusal ladder (Technical Standards §4).
//
// NOTHING HERE IS MOCKED (§4.3). The importer is exercised against a REAL .xlsx workbook — the one
// `buildTemplateXlsx()` ships to the operator — so the test proves the product's own template round
// -trips through its own parser. Spreadsheet parsing is computation, not infrastructure; the
// Testcontainers rule applies to Postgres and Gupshup, and those boundaries are the next slice.

import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { buildTemplateXlsx, parseAudienceFile } from "../src/audience.js";
import { decideFact, readFacts } from "../src/facts.js";

/** Builds a real workbook in memory from a grid — no fixture files to drift out of date. */
function workbook(grid: unknown[][]): Buffer {
  const sheet = XLSX.utils.aoa_to_sheet(grid);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Sheet1");
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("parseAudienceFile", () => {
  it("parses the product's own downloadable template", () => {
    // Arrange — the template the operator is told to use. If this ever stops parsing, the primary
    // onboarding path is broken for everyone and nothing else would notice.
    const template = buildTemplateXlsx();
    // Act
    const parsed = parseAudienceFile(template, "audience-template.xlsx");
    // Assert
    expect(parsed.rows.length).toBeGreaterThan(0);
    expect(parsed.rows[0].name).toBeTruthy();
    expect(parsed.rows[0].phone).toMatch(/^966\d+$/);
  });

  it("normalises 05 numbers on import, so a pasted book keys on the same row a webhook does", () => {
    // Arrange — the ledger is phone-keyed; an un-normalised import silently creates a second
    // account for a customer who already exists.
    const file = workbook([
      ["الاسم", "الجوال"],
      ["مجمع النور الطبي", "0512345678"],
    ]);
    // Act
    const parsed = parseAudienceFile(file, "book.xlsx");
    // Assert
    expect(parsed.rows[0].phone).toBe("966512345678");
  });

  it("reads a phone stored as a NUMBER, not as scientific notation", () => {
    // Arrange — Excel formats a long numeric cell as 9.66512E+11. The parser deliberately reads the
    // workbook twice, raw and formatted, because the formatted value silently destroys the number.
    const file = workbook([
      ["الاسم", "الجوال"],
      ["مركز الشفاء", 966512345678],
    ]);
    // Act
    const parsed = parseAudienceFile(file, "book.xlsx");
    // Assert
    expect(parsed.rows[0].phone).toBe("966512345678");
  });

  it("turns every extra column into a targeting attribute", () => {
    // Arrange — the promise made in the empty state: «كل عمود إضافي يصبح شريحة استهداف».
    const file = workbook([
      ["الاسم", "الجوال", "المدينة", "الحجم"],
      ["عيادات النخبة", "0500000001", "الرياض", "كبيرة"],
    ]);
    // Act
    const parsed = parseAudienceFile(file, "book.xlsx");
    // Assert
    expect(parsed.rows[0].attrs).toMatchObject({ "المدينة": "الرياض", "الحجم": "كبيرة" });
  });

  it("skips a row with an unusable phone instead of importing a broken account", () => {
    // Arrange — one bad row must not abort the file, and must not land as a contact nobody can
    // reach. It is counted as skipped so the operator is told.
    const file = workbook([
      ["الاسم", "الجوال"],
      ["جهة صالحة", "0500000001"],
      ["جهة بلا رقم", "—"],
    ]);
    // Act
    const parsed = parseAudienceFile(file, "book.xlsx");
    // Assert — and `skipped` carries a ROW NUMBER and a REASON, not just a count: an importer that
    // says «تُخطّي ١» without saying which row or why leaves the operator to diff two spreadsheets.
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.skipped).toHaveLength(1);
    expect(parsed.skipped[0].row).toBe(3);
    expect(parsed.skipped[0].reason).toBeTruthy();
  });

  it("refuses a file with no data rows rather than importing nothing silently", () => {
    // Arrange — a header-only file is a mistake, and silence would look like success.
    const file = workbook([["الاسم", "الجوال"]]);
    // Act + Assert
    expect(() => parseAudienceFile(file, "empty.xlsx")).toThrow();
  });
});

describe("decideFact — the refusal ladder", () => {
  const NOW = 1_800_000_000_000;

  it("refuses an unknown key instead of silently dropping it", () => {
    // Arrange — a typo'd key that vanished quietly is a fact the operator believes they recorded.
    // Act
    const decision = decideFact({ key: "notARealFact", value: "x", source: "human", by: "aziz", now: NOW });
    // Assert
    expect(decision.applied).toBe(false);
    expect(decision.reason).toBe("unknown_fact");
  });

  it("refuses the AGENT on a human-only key, before anything else is considered", () => {
    // Arrange — `customerName` is import-only: the WhatsApp display name is not a legal identity,
    // and the model must never overwrite one.
    // Act
    const decision = decideFact({ key: "customerName", value: "اسم من المحادثة", source: "agent", by: "agent", now: NOW });
    // Assert
    expect(decision.applied).toBe(false);
    expect(decision.reason).toBe("not_agent_writable");
  });

  it("lets a human write the same key the agent was refused", () => {
    // Arrange — the refusal above must be about the SOURCE, not about the key being frozen.
    // Act
    const decision = decideFact({ key: "customerName", value: "مجمع النور الطبي", source: "human", by: "aziz", now: NOW });
    // Assert
    expect(decision.applied).toBe(true);
  });

  it("refuses a value longer than the column can hold", () => {
    // Arrange — bounds exist so a pasted document does not become a fact.
    const decision = decideFact({ key: "branches", value: "x".repeat(500), source: "human", by: "aziz", now: NOW });
    // Assert
    expect(decision.applied).toBe(false);
    expect(decision.reason).toBe("too_long");
  });

  it("accepts an agent-writable fact from the agent", () => {
    const decision = decideFact({ key: "hisName", value: "نظام لديهم", source: "agent", by: "agent:record_fact", said: "نستخدم نظام كذا", now: NOW });
    expect(decision.applied).toBe(true);
  });

  it("stamps who and when on what it applied, so a fact is never an anonymous claim", () => {
    // Arrange — provenance is the whole reason facts are a typed store rather than a blob.
    // Act
    const decision = decideFact({ key: "branches", value: "12", source: "human", by: "عبدالعزيز", now: NOW });
    // Assert
    expect(decision.applied).toBe(true);
    expect(decision.fact?.by).toBe("عبدالعزيز");
    expect(decision.fact?.ts).toBe(NOW);
    expect(decision.fact?.source).toBe("human");
  });

  it("does not let the agent overwrite a value a human stated", () => {
    // Arrange — the human-value-wins rule. An operator who corrected a fact must not find the
    // model's reading back in place on the next turn.
    const humanFact = decideFact({ key: "hisName", value: "النظام الصحيح", source: "human", by: "aziz", now: NOW }).fact;
    // Act
    const agentAttempt = decideFact({
      key: "hisName", value: "قراءة مختلفة", source: "agent", by: "agent",
      current: humanFact, said: "قال شيئًا آخر", now: NOW + 1000,
    });
    // Assert
    expect(agentAttempt.applied).toBe(false);
  });
});

describe("readFacts", () => {
  it("round-trips what decideFact produced", () => {
    // Arrange — the store is JSONB; what goes in must come back typed.
    const fact = decideFact({ key: "branches", value: "12", source: "human", by: "aziz", now: 1 }).fact;
    // Act
    const restored = readFacts({ branches: fact });
    // Assert
    expect(restored.branches?.value).toBe("12");
  });

  it("drops a malformed entry rather than surfacing it as a fact", () => {
    // Arrange — an older write, or a hand-edited row, must not become a claim the agent states.
    // Act
    const restored = readFacts({ branches: "just a string, not a fact object" });
    // Assert
    expect(restored.branches).toBeUndefined();
  });
});
