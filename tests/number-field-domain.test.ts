import { describe, it, expect } from "vitest";
import {
  normalizeNumberDigits, parseNumberField, stepDecimals, formatNumberField, stepNumberField,
  boundNumberField, commitNumberField, numberFieldCanStep, NUMBER_FIELD_DOMAIN_JS,
} from "../src/number-field-domain.js";

const PRICE = { min: 0, step: 100 };
const YEARS = { min: 1, max: 20, step: 1 };
const DISCOUNT = { min: 0, max: 100, step: 1 };

describe("normalizeNumberDigits", () => {
  it("maps Arabic-Indic and Extended Arabic-Indic digits and the Arabic decimal point", () => {
    expect(normalizeNumberDigits("٣٤٠٠٠")).toBe("34000");
    expect(normalizeNumberDigits("۱۲")).toBe("12");
    expect(normalizeNumberDigits("١٢٫٥")).toBe("12.5");
  });
  it("preserves length, so it can run on every keystroke without moving the caret", () => {
    for (const s of ["٣٤,٠٠٠", "abc١", "", "٫٥"]) expect(normalizeNumberDigits(s).length).toBe(s.length);
  });
});

describe("parseNumberField", () => {
  it("reads empty as null, not zero", () => {
    expect(parseNumberField("")).toBeNull();
    expect(parseNumberField("   ")).toBeNull();
  });
  it("ignores grouping marks, western and Arabic", () => {
    expect(parseNumberField("34,000")).toBe(34000);
    expect(parseNumberField("٣٤٬٠٠٠")).toBe(34000);
    expect(parseNumberField("12.5")).toBe(12.5);
  });
  it("reads anything else as NaN", () => {
    expect(parseNumberField("abc")).toBeNaN();
    expect(parseNumberField("1.2.3")).toBeNaN();
    expect(parseNumberField("12ر.س")).toBeNaN();
  });
});

describe("stepNumberField", () => {
  it("steps by the field's step, and by ten steps when asked", () => {
    expect(stepNumberField("4200", 1, PRICE)).toBe("4300");
    expect(stepNumberField("4200", -1, PRICE, 10)).toBe("3200");
  });
  it("clamps at the bounds", () => {
    expect(stepNumberField("20", 1, YEARS)).toBe("20");
    expect(stepNumberField("50", -1, PRICE)).toBe("0");
    expect(stepNumberField("95", 1, DISCOUNT, 10)).toBe("100");
  });
  it("from empty, + starts at the minimum when it is above zero, otherwise one step", () => {
    expect(stepNumberField("", 1, YEARS)).toBe("1");
    expect(stepNumberField("", 1, PRICE)).toBe("100");
  });
  it("from empty, − does nothing: «بلا سعر» never becomes a price nobody entered", () => {
    expect(stepNumberField("", -1, PRICE)).toBe("");
    expect(stepNumberField("abc", -1, PRICE)).toBe("abc");
  });
  it("has no floating-point residue on decimal steps", () => {
    expect(stepNumberField("0.2", 1, { step: 0.1 })).toBe("0.3");
    expect(stepDecimals(0.25)).toBe(2);
  });
  it("steps from a value typed in Arabic digits", () => {
    expect(stepNumberField("٩", 1, YEARS)).toBe("10");
  });
});

describe("commitNumberField", () => {
  it("keeps an empty field empty", () => {
    expect(commitNumberField("", "4200", PRICE)).toBe("");
  });
  it("reverts an unreadable entry to the last committed value, never to zero", () => {
    expect(commitNumberField("abc", "4200", PRICE)).toBe("4200");
    expect(commitNumberField("abc", "", PRICE)).toBe("");
  });
  it("cleans and clamps a readable one", () => {
    expect(commitNumberField("٣٤,٠٠٠", "", PRICE)).toBe("34000");
    expect(commitNumberField("250", "", DISCOUNT)).toBe("100");
    expect(commitNumberField("0", "", YEARS)).toBe("1");
  });
});

describe("boundNumberField and numberFieldCanStep", () => {
  it("Home and End go to a bound only when there is one", () => {
    expect(boundNumberField("7", "max", YEARS)).toBe("20");
    expect(boundNumberField("7", "max", PRICE)).toBe("7");
    expect(boundNumberField("7", "min", PRICE)).toBe("0");
  });
  it("says which buttons can act", () => {
    expect(numberFieldCanStep("1", YEARS)).toEqual({ dec: false, inc: true });
    expect(numberFieldCanStep("20", YEARS)).toEqual({ dec: true, inc: false });
    expect(numberFieldCanStep("", PRICE)).toEqual({ dec: false, inc: true });
    expect(numberFieldCanStep("500", PRICE)).toEqual({ dec: true, inc: true });
  });
  it("formats without clamping when no bounds are given", () => {
    expect(formatNumberField(-5, { step: 1 })).toBe("-5");
  });
});

describe("the browser bundle", () => {
  it("ships every function and each one resolves only against the bundle", () => {
    // eslint-disable-next-line no-new-func
    const run = new Function(NUMBER_FIELD_DOMAIN_JS + "; return { stepNumberField, commitNumberField, numberFieldCanStep };");
    const f = run();
    expect(f.stepNumberField("٩", 1, YEARS)).toBe("10");
    expect(f.commitNumberField("abc", "5", PRICE)).toBe("5");
    expect(f.numberFieldCanStep("20", YEARS)).toEqual({ dec: true, inc: false });
  });
});
