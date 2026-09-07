// GATE STEP 22: the design system defends itself.
//
// WHY THIS EXISTS. DESIGN.md §3.4 has forbidden `--s-off` as a text colour since the rebrand, and
// the codebase carried 165 `color:#A9B4C0` declarations at 2.10:1 — real Arabic sentences, not
// decoration — plus four using the border token as text. Twenty-one gate steps ran on every build
// and not one looked at a colour. A design rule nobody checks is a suggestion.
//
// It is a RATCHET, not a wall. Existing debt is recorded as a baseline and may only shrink; a NEW
// violation fails the build immediately. That is the only honest way to turn on enforcement against
// a codebase with 26 font sizes and 11 z-index values already in it.
import fs from "node:fs";
import path from "node:path";

const SRC = new URL("../src/", import.meta.url);
const files = fs.readdirSync(SRC).filter((f) => f.endsWith(".ts"));
const BASELINE = new URL("./design-baseline.json", import.meta.url);

// ---- contrast, the same maths the WCAG defines ----
const lum = (hex) => {
  const h = hex.replace("#", "");
  const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((x) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

// Tokens that may never be a text colour, with their measured ratio on --paper.
const NEVER_TEXT = { "#A9AEBE": "--s-off (2.21:1)", "#D6D1E8": "--line (1.48:1)",
                     "#EFEDF7": "--line-soft (1.16:1)", "#EFEEF5": "--s-off-soft" };
// Status BASE values that have a -mark variant; the base is a fill, the mark is a dot.
const NEEDS_MARK = { "#D99A00": "--s-attn -> --s-attn-mark #B37F00",
                     "#8B7BF5": "--s-sched -> --s-sched-mark #7A6BEE" };

// Every colour DESIGN.md section 2 defines. A text colour outside this set is unmeasured.
const TOKENS = new Set(["#6C5CE7","#5A4BD6","#8B7BF5","#EDEAFD","#DDD6F7","#FFFFFF","#F0EEF9",
  "#E9E6F4","#D6D1E8","#EFEDF7","#16151F","#35333F","#6B6880","#1E9E63","#E4F5EC","#12633F",
  "#D99A00","#FFF5D6","#7A5600","#B37F00","#D9534F","#FBE7E6","#8E2A27","#E9E6F9","#4B3FBF",
  "#EAE7F7","#453A9E","#A9AEBE","#EFEEF5","#4A5560","#7A6BEE","#7F8595",
  "#F7F6FC","#F4F2FD",
  "#DCF8C6","#E5DDD4",
  // Text ON the quoted WhatsApp bubble ground (#DCF8C6), not on --paper. Measuring these
  // against the page would be measuring the wrong pair.
  "#7D8B6A","#5B6B52"]);

// Re-derived on every run so the table in DESIGN.md 3.0 cannot drift from reality.
const TOKEN_RATIOS = [
  ["--muted on --paper", "#6B6880", "#FFFFFF", 4.5],
  ["--muted on --surface", "#6B6880", "#F0EEF9", 4.5],
  ["--accent on --paper", "#6C5CE7", "#FFFFFF", 4.5],
  ["white on --accent", "#FFFFFF", "#6C5CE7", 4.5],
  // Both stops of --grad, because white labels sit on it.
  ["white on --grad dark stop", "#FFFFFF", "#4B3FBF", 4.5],
  ["white on --grad light stop", "#FFFFFF", "#6C5CE7", 4.5],
  ["--s-issued-text on soft", "#12633F", "#E4F5EC", 4.5],
  ["--s-attn-text on soft", "#7A5600", "#FFF5D6", 4.5],
  ["--s-fail-text on soft", "#8E2A27", "#FBE7E6", 4.5],
  ["--s-sched-text on soft", "#4B3FBF", "#E9E6F9", 4.5],
  ["--s-review-text on soft", "#453A9E", "#EAE7F7", 4.5],
  ["--s-attend-text on soft", "#4B3FBF", "#EDEAFD", 4.5],
  ["--s-off-text on soft", "#4A5560", "#EFEEF5", 4.5],
  ["--s-attn-mark as a mark", "#B37F00", "#FFFFFF", 3.0],
  ["--s-sched-mark as a mark", "#7A6BEE", "#FFFFFF", 3.0],
  ["--s-off-mark as a mark", "#7F8595", "#FFFFFF", 3.0],
  // The accent mark must clear 3:1 on the TINTED row ground too, not just paper — that is the
  // ground the old --s-sched failed on at 2.93:1.
  ["--accent-mark on --surface", "#7A6BEE", "#F0EEF9", 3.0],
];

const findings = { textOnForbidden: [], untokenisedText: [], intZIndex: [], offLadderType: [] };
const LADDER = new Set([12, 14, 16, 18, 22, 28, 40, 44]);

for (const f of files) {
  const src = fs.readFileSync(new URL(f, SRC), "utf8");
  src.split("\n").forEach((raw, i) => {
    // A value quoted inside a comment is not a declaration. Without this the checker reports its
    // own documentation — the same false-positive class as matching `border-color:` as text.
    const line = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/, "");
    const at = `${f}:${i + 1}`;
    // TEXT colour only. `border-color:` and `outline-color:` also end in "color:", and an earlier
    // version of this check used a (?<!background-) lookbehind that let both through — it reported
    // a BORDER as failing text contrast. Require the property to start the declaration.
    const TEXT_COLOR = /(?:^|[;{]\s*)color: ?(#[0-9A-Fa-f]{6})/;
    const m = line.match(TEXT_COLOR);
    // A DISABLED control is exempt from the contrast floor (DESIGN.md 5, Control states) — its
    // whole job is to look unavailable. Without this the doc and the gate contradict each other,
    // and `.pen[disabled]` was the case that proved it.
    const disabled = /\[disabled\]|:disabled|\.dis\b|aria-disabled|--s-off-text/.test(line);
    if (m && !disabled) {
      const hex = m[1].toUpperCase();
      if (NEVER_TEXT[hex]) findings.textOnForbidden.push(`${at} ${NEVER_TEXT[hex]}`);
      // The GROUND cannot be known from one line — `.bt` sits on the WhatsApp bubble #DCF8C6, not
      // on --paper — so this does NOT measure arbitrary pairs. It asserts the one thing that is
      // statically true: the colour must be a token from DESIGN.md section 2. An untokenised hex is
      // a colour nobody measured, which is the actual defect. Contrast of a real pair is asserted
      // in the token table in DESIGN.md 3.0 and re-derived by TOKEN_RATIOS below.
      else if (!TOKENS.has(hex)) findings.untokenisedText.push(`${at} ${m[1]}`);
    }
    if (/z-index: ?\d/.test(line)) findings.intZIndex.push(at);
    const t = line.match(/font-size: ?([0-9.]+)px/);
    if (t && !LADDER.has(Number(t[1]))) findings.offLadderType.push(`${at} ${t[1]}px`);
  });
}

const counts = Object.fromEntries(Object.entries(findings).map(([k, v]) => [k, v.length]));
let base = { textOnForbidden: 0, untokenisedText: 0, intZIndex: 0, offLadderType: 0 };

// The token table in DESIGN.md is a claim. Prove it every build.
let tokenBad = 0;
for (const [name, fg, bg, floor] of TOKEN_RATIOS) {
  const r = ratio(fg, bg);
  if (r < floor) { tokenBad++; console.log(`FAIL ${name} = ${r.toFixed(2)}:1, floor ${floor}`); }
}
console.log(tokenBad ? `FAIL ${tokenBad} token pair(s) below their floor`
                     : `ok   all ${TOKEN_RATIOS.length} documented token pairs meet their floor`);
if (fs.existsSync(BASELINE)) base = JSON.parse(fs.readFileSync(BASELINE, "utf8"));

let bad = 0;
const LABEL = {
  textOnForbidden: "a token DESIGN.md forbids as text (3.4)",
  untokenisedText: "a text colour that is not a DESIGN.md token",
  intZIndex: "an integer z-index (DESIGN.md 2 defines a scale)",
  offLadderType: "a font-size off the type ladder (DESIGN.md 2)",
};
for (const k of Object.keys(counts)) {
  const now = counts[k], was = base[k] ?? 0;
  if (now > was) {
    bad++;
    console.log(`FAIL ${LABEL[k]} — ${now}, baseline ${was}. NEW violations:`);
    findings[k].slice(0, 8).forEach((x) => console.log(`       ${x}`));
  } else {
    console.log(`ok   ${LABEL[k]} — ${now}${was > now ? ` (baseline ${was}, improved)` : ""}`);
  }
}
if (process.env.DESIGN_BASELINE_WRITE === "1") {
  fs.writeFileSync(BASELINE, JSON.stringify(counts, null, 2) + "\n");
  console.log("\nbaseline rewritten:", JSON.stringify(counts));
  process.exit(0);
}
console.log(bad ? `\ndesign system: ${bad} category FAILED` : "\ndesign system: all green (ratchet holds)");
process.exit(bad || tokenBad ? 1 : 0);
