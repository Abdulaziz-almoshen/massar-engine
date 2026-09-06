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
const NEVER_TEXT = { "#A9B4C0": "--s-off (2.10:1)", "#CBD7E4": "--line (1.46:1)",
                     "#E3E9F1": "--line-soft (1.22:1)", "#EEF1F4": "--s-off-soft" };
// Status BASE values that have a -mark variant; the base is a fill, the mark is a dot.
const NEEDS_MARK = { "#D99A00": "--s-attn -> --s-attn-mark #B37F00",
                     "#629CCD": "--s-sched -> --s-sched-mark #4A7FB0" };

// Every colour DESIGN.md section 2 defines. A text colour outside this set is unmeasured.
const TOKENS = new Set(["#306DB5","#416CAD","#629CCD","#EAF1F8","#DDEAF3","#FFFFFF","#F4F6F9",
  "#EDF1F7","#CBD7E4","#E3E9F1","#212529","#3A3A3A","#536170","#1E9E63","#E4F5EC","#12633F",
  "#D99A00","#FFF5D6","#7A5600","#B37F00","#D9534F","#FBE7E6","#8E2A27","#E8F0F8","#2A5988",
  "#E9EEF7","#2C4A78","#EAF1F8","#255490","#A9B4C0","#EEF1F4","#4A5560","#4A7FB0","#8C959F",
  "#DCF8C6","#E5DDD4",
  // Text ON the quoted WhatsApp bubble ground (#DCF8C6), not on --paper. Measuring these
  // against the page would be measuring the wrong pair.
  "#7D8B6A","#5B6B52"]);

// Re-derived on every run so the table in DESIGN.md 3.0 cannot drift from reality.
const TOKEN_RATIOS = [
  ["--muted on --paper", "#536170", "#FFFFFF", 4.5],
  ["--blue on --paper", "#306DB5", "#FFFFFF", 4.5],
  ["white on --blue", "#FFFFFF", "#306DB5", 4.5],
  ["--s-issued-text on soft", "#12633F", "#E4F5EC", 4.5],
  ["--s-attn-text on soft", "#7A5600", "#FFF5D6", 4.5],
  ["--s-fail-text on soft", "#8E2A27", "#FBE7E6", 4.5],
  ["--s-sched-text on soft", "#2A5988", "#E8F0F8", 4.5],
  ["--s-attn-mark as a mark", "#B37F00", "#FFFFFF", 3.0],
  ["--s-sched-mark as a mark", "#4A7FB0", "#FFFFFF", 3.0],
  ["--s-off-mark as a mark", "#8C959F", "#FFFFFF", 3.0],
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
