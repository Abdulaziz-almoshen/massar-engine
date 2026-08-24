// Unit tests for the فرص البيع business tier (Technical Standards §4).
//
// FIRST (§4.3): every test is Fast (pure functions, no IO), Isolated (no shared state, `now` is
// injected rather than read from the clock), Repeatable (no Date.now, no randomness), and
// Self-Validating. AAA structure throughout.
//
// These do not chase line coverage — each one pins a rule that has ALREADY been wrong in
// production at least once, or a boundary the money on the board depends on.

import { describe, it, expect } from "vitest";
import {
  OPP_STAGES,
  OPP_SOURCES,
  OPP_STALL_DAYS,
  OPPS_DOMAIN_JS,
  accountKey,
  calculateLineValue,
  checkDomainClosure,
  daysInStage,
  groupStatusKey,
  hasLostLine,
  isLinePriced,
  isLineStalled,
  isLostStage,
  isOpenStage,
  isWonStage,
  pluralizeArabic,
  sumLiveValue,
  type OppLineFacts,
} from "../src/opps-domain.js";

const DAY = 86400000;
const NOW = 1_800_000_000_000; // fixed clock — a test that reads the wall clock is not Repeatable

function line(over: Partial<OppLineFacts> = {}): OppLineFacts {
  return {
    stage: "contact",
    salePrice: 100000,
    years: 1,
    quantity: 1,
    discountPercent: 0,
    stageEnteredAt: NOW,
    ...over,
  };
}

describe("calculateLineValue", () => {
  it("multiplies price by years and quantity and applies the discount", () => {
    // Arrange — the prototype's own worked example: 800,000 × 3 years × 1 × (1 − 5%)
    const subject = line({ salePrice: 800000, years: 3, quantity: 1, discountPercent: 5 });
    // Act
    const value = calculateLineValue(subject);
    // Assert
    expect(value).toBe(2280000);
  });

  it("multiplies by quantity, not just years", () => {
    // Arrange — 120,000 × 1 year × 2 units × (1 − 10%). Regression: an early card read 216,000
    // only because quantity was in the formula; dropping it silently halves a real deal.
    const subject = line({ salePrice: 120000, years: 1, quantity: 2, discountPercent: 10 });
    // Act + Assert
    expect(calculateLineValue(subject)).toBe(216000);
  });

  it("treats a missing quantity or years as one, never as zero", () => {
    // Arrange — the API defaults years and quantity to 1; a rule that read absent as 0 would
    // silently value every such line at nothing. This is the shape of a defect already fixed once
    // in validateOppLine, asserted here so it cannot come back through the arithmetic instead.
    const subject = line({ salePrice: 50000, years: 0, quantity: 0 });
    // Act + Assert
    expect(calculateLineValue(subject)).toBe(50000);
  });

  it("values an unpriced line at zero without throwing", () => {
    expect(calculateLineValue(line({ salePrice: 0 }))).toBe(0);
  });

  it("rounds to whole riyals", () => {
    // Arrange — 33,333 × 1 × 1 × (1 − 33%) = 22,333.11
    const subject = line({ salePrice: 33333, discountPercent: 33 });
    // Act + Assert
    expect(calculateLineValue(subject)).toBe(22333);
  });
});

describe("isLinePriced", () => {
  it("separates «unpriced» from «worth zero»", () => {
    // Arrange — the assistant opens lines from conversations that carry no number. Rendering those
    // as ٠ ر.س claimed a deal was worthless; this predicate is what stops that.
    // Act + Assert
    expect(isLinePriced(line({ salePrice: 0 }))).toBe(false);
    expect(isLinePriced(line({ salePrice: 1 }))).toBe(true);
  });
});

describe("sumLiveValue — THE money rule", () => {
  it("excludes lost lines from a mixed total", () => {
    // Arrange — this exact set shipped broken: the card head excluded the lost line while the
    // stage strip added it back, so two numbers on one screen disagreed by 300,000.
    const lines = [
      line({ stage: "negotiate", salePrice: 800000, years: 3, discountPercent: 5 }), // 2,280,000
      line({ stage: "tech", salePrice: 450000, years: 2 }), //                            900,000
      line({ stage: "lost", salePrice: 300000 }), //                              excluded
    ];
    // Act
    const total = sumLiveValue(lines);
    // Assert
    expect(total).toBe(3180000);
  });

  it("counts a WON line — closed-won is money, closed-lost is not", () => {
    const lines = [line({ stage: "won", salePrice: 500000 }), line({ stage: "lost", salePrice: 900000 })];
    expect(sumLiveValue(lines)).toBe(500000);
  });

  it("returns zero for an all-unpriced set so the caller can say «لا قيمة مسعَّرة بعد»", () => {
    expect(sumLiveValue([line({ salePrice: 0 }), line({ salePrice: 0 })])).toBe(0);
  });

  it("returns zero, not NaN, for an empty set", () => {
    expect(sumLiveValue([])).toBe(0);
  });
});

describe("hasLostLine", () => {
  it("is what makes a total say «دون الخسارة» only when it excluded something", () => {
    expect(hasLostLine([line({ stage: "won" })])).toBe(false);
    expect(hasLostLine([line({ stage: "won" }), line({ stage: "lost" })])).toBe(true);
  });
});

describe("groupStatusKey", () => {
  it("stays «قائمة» while any line is still open, even beside a win and a loss", () => {
    // Arrange — the head must never claim a deal is finished while a line under it is live.
    const lines = [line({ stage: "won" }), line({ stage: "lost" }), line({ stage: "tech" })];
    // Act + Assert
    expect(groupStatusKey(lines)).toBe("open");
  });

  it("is «مكتملة جزئياً» only for a mixed close", () => {
    expect(groupStatusKey([line({ stage: "won" }), line({ stage: "lost" })])).toBe("partial");
  });

  it("is «ربح» when everything landed won", () => {
    expect(groupStatusKey([line({ stage: "won" }), line({ stage: "won" })])).toBe("won");
  });

  it("is «خسارة» when everything landed lost", () => {
    expect(groupStatusKey([line({ stage: "lost" })])).toBe("lost");
  });
});

describe("stage predicates", () => {
  it("classifies every rung in the shipped ladder exactly once", () => {
    // Arrange — guards against a seventh stage being added without deciding what it MEANS.
    for (const stage of OPP_STAGES) {
      // Act
      const classes = [isOpenStage(stage.key), isWonStage(stage.key), isLostStage(stage.key)];
      // Assert — exactly one of open / won / lost is true
      expect(classes.filter(Boolean)).toHaveLength(1);
    }
  });

  it("keeps the ladder ordered and terminal stages last", () => {
    const positions = OPP_STAGES.map((s) => s.position);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(OPP_STAGES[OPP_STAGES.length - 1].key).toBe("lost");
  });
});

describe("daysInStage / isLineStalled", () => {
  it("counts whole days since the stage was entered", () => {
    expect(daysInStage(line({ stageEnteredAt: NOW - 20 * DAY }), NOW)).toBe(20);
  });

  it("marks a deal stalled exactly at the threshold, not a day later", () => {
    // Arrange — boundary. 13 days is not stalled, 14 is.
    const justUnder = line({ stage: "negotiate", stageEnteredAt: NOW - (OPP_STALL_DAYS - 1) * DAY });
    const atThreshold = line({ stage: "negotiate", stageEnteredAt: NOW - OPP_STALL_DAYS * DAY });
    // Act + Assert
    expect(isLineStalled(justUnder, NOW)).toBe(false);
    expect(isLineStalled(atThreshold, NOW)).toBe(true);
  });

  it("never marks a finished deal stalled", () => {
    // Arrange — a deal won a year ago is not «متوقّف», it is done.
    const old = { stageEnteredAt: NOW - 400 * DAY };
    // Act + Assert
    expect(isLineStalled(line({ stage: "won", ...old }), NOW)).toBe(false);
    expect(isLineStalled(line({ stage: "lost", ...old }), NOW)).toBe(false);
  });

  it("only stalls on the two rungs where deals actually go quiet", () => {
    // Arrange — «تواصل أولي» sitting a year is a cold lead, not a stalled negotiation.
    const old = { stageEnteredAt: NOW - 400 * DAY };
    expect(isLineStalled(line({ stage: "contact", ...old }), NOW)).toBe(false);
    expect(isLineStalled(line({ stage: "tech", ...old }), NOW)).toBe(true);
  });
});

describe("pluralizeArabic", () => {
  const digits = (n: number) => String(n);

  it("uses the four Arabic forms, not «n + noun»", () => {
    // Arrange — «١ منتجات» and «٥ جهة» both shipped and both read as broken Arabic.
    const forms = (n: number) => pluralizeArabic(n, "منتج واحد", "منتجان", "منتجات", "منتجًا", digits);
    // Act + Assert
    expect(forms(1)).toBe("منتج واحد");
    expect(forms(2)).toBe("منتجان");
    expect(forms(3)).toBe("3 منتجات");
    expect(forms(10)).toBe("10 منتجات");
    expect(forms(11)).toBe("11 منتجًا");
  });

  it("gives zero the SINGULAR form, which is where CLDR puts ar's zero", () => {
    // Arrange — «٠ فرصة», not «٠ فرص». This test was first written asserting the plural, which is
    // what a comment in the presentation module also claimed; the implementation was right and both
    // the comment and the expectation were wrong. Pinned here so the next reader is not misled.
    // Act + Assert
    expect(pluralizeArabic(0, "واحد", "اثنان", "قليل", "كثير", digits)).toBe("0 كثير");
  });

  it("delegates digit rendering to the caller, so the tier owns no presentation", () => {
    // Arrange — the app renders Arabic-Indic digits; the rule must not hard-code either system.
    const arabicIndic = (n: number) => n.toLocaleString("ar-SA");
    // Act
    const result = pluralizeArabic(5, "a", "b", "few", "many", arabicIndic);
    // Assert
    expect(result).toBe("٥ few");
  });
});

describe("accountKey", () => {
  it("groups by phone when there is one", () => {
    expect(accountKey("مجمع النور", "966500000001")).toBe("p:966500000001");
  });

  it("falls back to the trimmed name for an account with no number", () => {
    // Arrange — a lead recorded after a visit may have no WhatsApp number at all.
    expect(accountKey("  مستشفى الأمل  ", null)).toBe("n:مستشفى الأمل");
  });

  it("never lets one client open two cards by mixing the two keys", () => {
    // Arrange — same account, once with a phone and once without: the keys must not collide
    // with a DIFFERENT account's, which is what a bare concatenation would risk.
    expect(accountKey("x", "966500000001")).not.toBe(accountKey("x", null));
  });
});

describe("OPP_SOURCES", () => {
  it("carries a label for every source the API accepts", () => {
    // Arrange — the emitted-value-must-be-readable rule: the board offers these keys and the
    // server validates against them, so an unlabelled key would render blank on a real card.
    const apiAccepts = ["whatsapp", "call", "visit", "referral", "inbound", "other"];
    // Act + Assert
    for (const key of apiAccepts) {
      expect(OPP_SOURCES[key], `no Arabic label for source «${key}»`).toBeTruthy();
    }
    expect(Object.keys(OPP_SOURCES).sort()).toEqual(apiAccepts.sort());
  });
});

describe("the browser seam", () => {
  it("ships every rule to the page with no free references", () => {
    // Arrange — a rule that resolves in Node but not in the browser renders a blank page, which
    // tsc and node --check both pass. This is the assertion that catches it.
    // Act
    const problems = checkDomainClosure();
    // Assert
    expect(problems).toEqual([]);
  });

  it("carries the constants AND the functions the page needs", () => {
    for (const name of ["OPP_STAGES", "OPP_SOURCES", "OPP_STALL_DAYS", "calculateLineValue", "sumLiveValue", "groupStatusKey"]) {
      expect(OPPS_DOMAIN_JS).toContain(name);
    }
  });

  it("evaluates in a bare scope and computes the same answer as the module", () => {
    // Arrange — the strongest available proof that the two runtimes agree: evaluate the shipped
    // source with NOTHING in scope but itself, then compare against the tested implementation.
    const subject = line({ salePrice: 800000, years: 3, discountPercent: 5 });
    // Act
    const evaluate = new Function(
      OPPS_DOMAIN_JS + "\nreturn { value: calculateLineValue(arguments[0]), status: groupStatusKey([arguments[0]]) };",
    );
    const fromBrowserCopy = evaluate(subject) as { value: number; status: string };
    // Assert
    expect(fromBrowserCopy.value).toBe(calculateLineValue(subject));
    expect(fromBrowserCopy.status).toBe(groupStatusKey([subject]));
  });
});
