import { describe, it, expect } from "vitest";
import {
  activityByDay, activityFromCounts, bandOf, readMomentum, readSeriousness, replyLatencies,
  type SignalTurn,
} from "../src/signal-domain.js";

const DAY = 24 * 3600e3;
const NOW = 1_756_000_000_000; // fixed instant — the clock is a parameter, never Date.now()
const noEcho = () => false;

/** Minutes-ago helper, so a fixture reads as a conversation rather than as arithmetic. */
const ago = (minutes: number) => NOW - minutes * 60e3;
const turn = (role: SignalTurn["role"], text: string, ts: number): SignalTurn => ({ role, text, ts });

const base = {
  tags: [] as never[],
  isButtonEcho: noEcho,
  now: NOW,
};

describe("bandOf", () => {
  it("names each band at its own boundary", () => {
    expect(bandOf(100).band).toBe("ready");
    expect(bandOf(70).band).toBe("ready");
    expect(bandOf(69).band).toBe("serious");
    expect(bandOf(45).band).toBe("serious");
    expect(bandOf(44).band).toBe("watch");
    expect(bandOf(20).band).toBe("watch");
    expect(bandOf(19).band).toBe("cold");
    expect(bandOf(0).band).toBe("cold");
  });
});

describe("replyLatencies", () => {
  it("measures from our message to their FIRST answer only", () => {
    // Three customer messages in a row are one answer. Counting the burst would report a
    // sub-minute responsiveness nobody demonstrated.
    const t = [
      turn("agent", "مرحبًا", ago(100)),
      turn("customer", "أهلًا", ago(90)),
      turn("customer", "عندي سؤال", ago(89)),
      turn("customer", "كم السعر", ago(88)),
    ];
    expect(replyLatencies(t)).toEqual([10]);
  });

  it("ignores a customer message with no question of ours before it", () => {
    expect(replyLatencies([turn("customer", "السلام عليكم", ago(5))])).toEqual([]);
  });
});

describe("readMomentum", () => {
  it("calls a 14-day gap silent rather than steady", () => {
    // Zero recent against zero prior is a ratio that reads «ثابت» — on a lapsed conversation.
    const t = [turn("customer", "أرسل التفاصيل", NOW - 20 * DAY)];
    expect(readMomentum(t, NOW).momentum).toBe("silent");
  });

  it("reads acceleration and cooling from the customer's own cadence", () => {
    const rising = [
      turn("customer", "أ", NOW - 10 * DAY),
      turn("customer", "ب", NOW - 2 * DAY),
      turn("customer", "ج", NOW - 1 * DAY),
    ];
    expect(readMomentum(rising, NOW).momentum).toBe("rising");
    const cooling = [
      turn("customer", "أ", NOW - 12 * DAY),
      turn("customer", "ب", NOW - 11 * DAY),
      turn("customer", "ج", NOW - 3 * DAY),
    ];
    expect(readMomentum(cooling, NOW).momentum).toBe("cooling");
  });

  it("says so when nobody has spoken", () => {
    expect(readMomentum([turn("agent", "مرحبًا", ago(5))], NOW).momentum).toBe("none");
  });
});

describe("activityByDay", () => {
  it("emits empty days, because the silence is the signal", () => {
    const rows = activityByDay([turn("customer", "أهلًا", NOW - 6 * DAY)], NOW, 7);
    expect(rows).toHaveLength(7);
    expect(rows.filter((r) => r.inbound > 0)).toHaveLength(1);
    expect(rows[rows.length - 1].day).toBeGreaterThan(rows[0].day);
  });

  it("separates their messages from ours and drops system turns", () => {
    const rows = activityByDay([
      turn("customer", "أهلًا", NOW),
      turn("agent", "مرحبًا", NOW),
      turn("system", "تفعيل", NOW),
    ], NOW, 3);
    const today = rows[rows.length - 1];
    expect(today.inbound).toBe(1);
    expect(today.outbound).toBe(1);
  });

  it("ignores turns older than the window instead of stacking them on the first bar", () => {
    const rows = activityByDay([turn("customer", "قديم", NOW - 60 * DAY)], NOW, 7);
    expect(rows.every((r) => r.inbound === 0)).toBe(true);
  });
});

describe("readSeriousness", () => {
  it("returns zero for an opted-out contact whatever else the ledger holds", () => {
    // A person who asked us to stop is not a weakly-serious prospect. A meter reading 30 on them
    // invites exactly the follow-up the opt-out forbids.
    const read = readSeriousness({
      ...base,
      optedOut: true,
      outcome: "scheduled",
      transcript: [turn("customer", "كم السعر وأبغى اجتماع", ago(10))],
    });
    expect(read.score).toBe(0);
    expect(read.band).toBe("cold");
    expect(read.factors.map((f) => f.key)).toEqual(["opted_out"]);
  });

  it("scores a live commercial conversation into the serious bands", () => {
    const read = readSeriousness({
      ...base,
      transcript: [
        turn("agent", "مرحبًا، معك مسار", ago(200)),
        turn("customer", "أهلًا، وش الخدمة؟", ago(190)),
        turn("agent", "خدمة الإجازات المرضية", ago(180)),
        turn("customer", "كم السعر للسنة؟", ago(170)),
        turn("agent", "نرسل لك عرضًا", ago(160)),
        turn("customer", "تمام أرسله", ago(150)),
      ],
      tags: [{ product: "الإجازات المرضية", level: "hot", ts: ago(150) }],
    });
    expect(read.score).toBeGreaterThanOrEqual(70);
    expect(read.band).toBe("ready");
    expect(read.typedTurns).toBe(3);
    expect(read.factors.find((f) => f.key === "commercial")?.evidence).toContain("كم السعر");
  });

  it("does not credit a tap or the platform handshake as the customer writing", () => {
    // The failure this prevents: a contact who never wrote a word reading as engaged because our
    // own button title came back as their message.
    const read = readSeriousness({
      ...base,
      isButtonEcho: (t) => t.trim() === "أرسل لي التفاصيل",
      transcript: [
        turn("customer", "proxy massar", ago(60)),
        turn("customer", "أرسل لي التفاصيل", ago(50)),
      ],
    });
    expect(read.typedTurns).toBe(0);
    expect(read.factors.find((f) => f.key === "taps_only")).toBeTruthy();
    expect(read.factors.find((f) => f.key === "depth")).toBeUndefined();
  });

  it("subtracts for silence, and says how long in agreeing Arabic", () => {
    const read = readSeriousness({
      ...base,
      transcript: [
        turn("agent", "مرحبًا", NOW - 9 * DAY),
        turn("customer", "كم السعر؟", NOW - 9 * DAY + 60e3),
      ],
    });
    const silence = read.factors.find((f) => f.key === "silence");
    expect(silence?.points).toBeLessThan(0);
    // 8, not 9: the customer spoke a minute INTO the ninth day back, and only fully elapsed days
    // are counted. Reporting the partial day as whole would overstate a silence by a day.
    expect(silence?.evidence).toContain("٨ أيام");
    expect(read.daysSilent).toBe(8);
  });

  it("empties the meter when a human filed the contact as not interested", () => {
    const read = readSeriousness({
      ...base,
      outcome: "not_interested",
      transcript: [
        turn("agent", "مرحبًا", ago(120)),
        turn("customer", "كم السعر؟", ago(110)),
        turn("customer", "طيب أرسل العرض", ago(100)),
        turn("customer", "خلاص ماني مهتم", ago(90)),
      ],
    });
    expect(read.score).toBe(0);
    expect(read.factors.find((f) => f.key === "refused")).toBeTruthy();
  });

  it("never exceeds 100 — a clamped score is honest where a raw sum is not", () => {
    const read = readSeriousness({
      ...base,
      outcome: "scheduled",
      transcript: [
        turn("agent", "مرحبًا", ago(50)),
        turn("customer", "كم السعر وأبغى اجتماع؟", ago(48)),
        turn("agent", "أكيد", ago(46)),
        turn("customer", "نبدأ متى؟", ago(45)),
        turn("agent", "الأسبوع القادم", ago(44)),
        turn("customer", "ممتاز جهزوا العقد", ago(43)),
      ],
      tags: [{ product: "الإجازات المرضية", level: "hot", ts: ago(43) }],
    });
    expect(read.score).toBe(100);
  });

  it("reads an unanswered outbound as cold with no invented factors", () => {
    const read = readSeriousness({ ...base, transcript: [turn("agent", "مرحبًا", ago(30))] });
    expect(read.score).toBe(0);
    expect(read.band).toBe("cold");
    expect(read.factors).toEqual([]);
    expect(read.daysSilent).toBeNull();
    expect(read.replyMinutes).toBeNull();
    expect(read.momentum).toBe("none");
  });
});

describe("activityFromCounts — the exact chart, in the shape the old one drew", () => {
  it("emits every day in the window, empties included, like activityByDay", () => {
    const now = Date.now();
    const DAY = 86_400_000;
    const today = Math.floor(now / DAY) * DAY;
    const fromCounts = activityFromCounts([{ day: today, inbound: 3, outbound: 1 }], now, 21);
    const fromTranscript = activityByDay(
      [{ role: "customer", text: "a", ts: now }, { role: "customer", text: "b", ts: now },
       { role: "customer", text: "c", ts: now }, { role: "agent", text: "d", ts: now }],
      now, 21);
    // Same length, same keys, same day boundaries — the point is that making the data exact must
    // not redraw a shipped chart.
    expect(fromCounts.length).toBe(fromTranscript.length);
    expect(fromCounts.map((b) => b.day)).toEqual(fromTranscript.map((b) => b.day));
    expect(fromCounts[fromCounts.length - 1]).toEqual(fromTranscript[fromTranscript.length - 1]);
  });

  it("drops counts that fall outside the window instead of folding them into an edge bucket", () => {
    const now = Date.now();
    const DAY = 86_400_000;
    const old = Math.floor((now - 400 * DAY) / DAY) * DAY;
    const out = activityFromCounts([{ day: old, inbound: 99, outbound: 99 }], now, 21);
    expect(out.every((b) => b.inbound === 0 && b.outbound === 0)).toBe(true);
  });
});
