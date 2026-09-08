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
const NEVER_TEXT = { "#A2A9B4": "--s-off (2.37:1)", "#D8DCE3": "--line (1.38:1)",
                     "#ECEEF2": "--line-soft (1.16:1)", "#EEF0F3": "--s-off-soft" };
// Status BASE values that have a -mark variant; the base is a fill, the mark is a dot.
const NEEDS_MARK = { "#D99A00": "--s-attn -> --s-attn-mark #B37F00",
                     "#5B8DEF": "--s-sched -> --s-sched-mark #4A7BE8" };

// Every colour DESIGN.md section 2 defines. A text colour outside this set is unmeasured.
const TOKENS = new Set(["#2563EB","#1E5FCC","#5B8DEF","#EAF1FE","#DCE8FC","#FFFFFF","#EFF1F5",
  "#E5E8EE","#D8DCE3","#ECEEF2","#14161A","#33373E","#656B76","#1E9E63","#E4F5EC","#12633F",
  "#D99A00","#FFF5D6","#7A5600","#B37F00","#D9534F","#FBE7E6","#8E2A27","#E9F0FE","#1A47BE",
  "#E7EEFB","#173FA8","#A2A9B4","#EEF0F3","#464C56","#4A7BE8","#767D89",
  "#F6F7F9","#F2F6FE","#545A66",
  "#DCF8C6","#E5DDD4",
  // Text on the quoted WhatsApp surfaces. ONE value, and it clears 4.5 on BOTH of them —
  // 5.37 on the #E5DDD4 wallpaper and 6.29 on the #DCF8C6 bubble. The two it replaces were
  // exempted as "measured against the bubble", but #7D8B6A was 3.17 even there and both were
  // actually rendering on the WALLPAPER, at 2.71 and 4.26. An exemption is only as good as the
  // ground it names.
  "#54594B"]);

// Re-derived on every run so the table in DESIGN.md 3.0 cannot drift from reality.
const TOKEN_RATIOS = [
  ["--muted on --paper", "#656B76", "#FFFFFF", 4.5],
  ["--muted on --surface", "#656B76", "#EFF1F5", 4.5],
  ["--muted on --canvas", "#656B76", "#F6F7F9", 4.5],
  // --muted FAILS on --surface-2 (4.37) and that ground is a control track. --muted-2 exists for it.
  ["--muted-2 on --surface-2", "#545A66", "#E5E8EE", 4.5],
  ["--muted-2 on --paper", "#545A66", "#FFFFFF", 4.5],
  // The SELECTED filter chip: --accent on --blue-wash measured 4.18, so the chip a person had just
  // clicked was the least readable thing in the row. --accent-deep is 6.32.
  ["--accent-deep on --blue-wash", "#1A47BE", "#DCE8FC", 4.5],
  // The quoted WhatsApp preview, on BOTH of its grounds.
  ["wa ink on the chat wallpaper", "#54594B", "#E5DDD4", 4.5],
  ["wa ink on the bubble", "#54594B", "#DCF8C6", 4.5],
  ["--accent on --paper", "#2563EB", "#FFFFFF", 4.5],
  ["white on --accent", "#FFFFFF", "#2563EB", 4.5],
  // Both stops of --grad, because white labels sit on it.
  ["white on --grad dark stop", "#FFFFFF", "#1A47BE", 4.5],
  ["white on --grad light stop", "#FFFFFF", "#2563EB", 4.5],
  ["--accent-deep on --accent-tint", "#1A47BE", "#EAF1FE", 4.5],
  ["--s-issued-text on soft", "#12633F", "#E4F5EC", 4.5],
  ["--s-attn-text on soft", "#7A5600", "#FFF5D6", 4.5],
  ["--s-fail-text on soft", "#8E2A27", "#FBE7E6", 4.5],
  ["--s-sched-text on soft", "#1A47BE", "#E9F0FE", 4.5],
  ["--s-review-text on soft", "#173FA8", "#E7EEFB", 4.5],
  ["--s-attend-text on soft", "#1A47BE", "#EAF1FE", 4.5],
  ["--s-off-text on soft", "#464C56", "#EEF0F3", 4.5],
  ["--s-attn-mark as a mark", "#B37F00", "#FFFFFF", 3.0],
  ["--s-sched-mark as a mark", "#4A7BE8", "#FFFFFF", 3.0],
  ["--s-off-mark as a mark", "#767D89", "#FFFFFF", 3.0],
  // The accent mark must clear 3:1 on the TINTED row ground too, not just paper — that is the
  // ground the old --s-sched failed on at 2.93:1.
  ["--accent-mark on --surface", "#4A7BE8", "#EFF1F5", 3.0],
  // A FIELD ring is a control boundary, so it meets the same non-text floor. DESIGN.md 5, Field.
  ["--s-off-mark as a field ring", "#767D89", "#FFFFFF", 3.0],
];

// ---- DESIGN.md must document what the code actually ships ----
//
// WHY THIS EXISTS. On 2026-09-07 the accent was remapped across 1,164 sites and the TOKENS set in
// this file was updated with it — so the gate went green while DESIGN.md, the token AUTHORITY,
// still documented fifteen values that had not shipped since the day before: the whole
// --s-attend / --s-review / --s-sched / --s-off family and both skeleton tokens. A checker and a
// document holding the same values with nothing comparing them is the same defect class as a table
// with a reader and no writer. Nobody notices, because each side is internally consistent.
//
// The rep page is checked too: it is a SEPARATE document with its own :root, so it is a second
// copy of the palette and a second place to drift.
const readRoot = (file) => {
  const src = fs.readFileSync(new URL(file, SRC), "utf8");
  const block = src.match(/:root\s*\{([\s\S]*?)\n\s*\}/);
  if (!block) return {};
  const out = {};
  for (const m of block[1].matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9A-Fa-f]{6})/g)) {
    out[m[1]] = m[2].toUpperCase();
  }
  return out;
};
const shipped = readRoot("dashboard.ts");
const repRoot = readRoot("rep-page.ts");
// DESIGN.md lives in the PARENT repo, not in massar-engine. The first version of this check
// pointed at ../DESIGN.md, read nothing, and reported "agrees on all 0 documented tokens" — a
// guard that passes because it found no data is the empty-table failure this codebase has shipped
// four times. So the path is asserted and a zero parse is a hard failure, never a pass.
const DESIGN_MD = new URL("../../DESIGN.md", import.meta.url);
const documented = {};
if (!fs.existsSync(DESIGN_MD)) {
  console.log("FAIL DESIGN.md not found at " + DESIGN_MD.pathname + " — the authority check cannot run");
  process.exit(1);
}
{
  const md = fs.readFileSync(DESIGN_MD, "utf8");
  for (const m of md.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9A-Fa-f]{6})/g)) {
    documented[m[1]] = m[2].toUpperCase();
  }
}
if (Object.keys(documented).length < 20) {
  console.log(`FAIL DESIGN.md parsed only ${Object.keys(documented).length} tokens — the format changed and this check went blind`);
  process.exit(1);
}
const docDrift = Object.entries(documented)
  .filter(([k, v]) => shipped[k] && shipped[k] !== v)
  .map(([k, v]) => `${k}: DESIGN.md says ${v}, src ships ${shipped[k]}`);
// A token in :root that DESIGN.md never mentions is undocumented, and the drift check above
// cannot see it — it only compares keys present on BOTH sides. That hole let --accent-bar ship
// undocumented on the first run of this very check. A value the authority does not carry is a
// value the next reader will invent a second time.
const undocumented = Object.keys(shipped)
  .filter((k) => !(k in documented))
  .map((k) => `${k}: ${shipped[k]} is in :root but not in DESIGN.md §2`);
const repDrift = Object.entries(repRoot)
  .filter(([k, v]) => shipped[k] && shipped[k] !== v)
  .map(([k, v]) => `${k}: rep-page.ts has ${v}, dashboard.ts has ${shipped[k]}`);

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
// Drift is NOT baselined. It must be zero: a value the authority documents and the product does
// not ship is a wrong answer to anybody who reads the file, on the first day it happens.
if (docDrift.length) {
  bad++;
  console.log(`FAIL DESIGN.md documents ${docDrift.length} token(s) the code does not ship:`);
  docDrift.slice(0, 12).forEach((x) => console.log(`       ${x}`));
} else {
  console.log(`ok   DESIGN.md agrees with src/ on all ${Object.keys(documented).length} documented tokens`);
}
if (undocumented.length) {
  bad++;
  console.log(`FAIL ${undocumented.length} token(s) ship without being documented in DESIGN.md:`);
  undocumented.slice(0, 12).forEach((x) => console.log(`       ${x}`));
} else {
  console.log(`ok   every token in :root is documented in DESIGN.md`);
}
if (repDrift.length) {
  bad++;
  console.log(`FAIL rep-page.ts has ${repDrift.length} token(s) that disagree with dashboard.ts:`);
  repDrift.slice(0, 12).forEach((x) => console.log(`       ${x}`));
} else {
  console.log(`ok   rep-page.ts agrees with dashboard.ts on every shared token`);
}

console.log(bad ? `\ndesign system: ${bad} category FAILED` : "\ndesign system: all green (ratchet holds)");
process.exit(bad || tokenBad ? 1 : 0);
