// stage-tone-domain.ts — what colour a sales stage IS, and where a deal sits on its ladder.
//
// WHY THIS FILE EXISTS (founder, 2026-09-15: «why our board is not colorful … stages not visible and
// not dynamic»). V5 painted every open stage from one blue ramp — six shades of the accent that a
// reader cannot tell apart — and the drawer's stage track was six unlabelled 6px bars whose names
// lived only in a tooltip. The CPO reads the board by STAGE, so a stage needs an identity a reader can
// hold across the summary, the list, the kanban, the drawer and the reports: one hue, the same
// everywhere.
//
// This REVERSES DESIGN.md §6 rule 4 («one accent per surface») for the stage channel only, by the
// founder's instruction; DESIGN.md records the exception. What does NOT change is §3.0b — colour is
// never the only channel. Every place a tone is drawn also prints the stage's label.
//
// Every value below was MEASURED, not eyeballed, and tests/stage-tone-domain.test.ts re-measures them:
//   solid  — a chip ground carrying WHITE text        ≥ 4.5:1   (the current stage)
//   text   — the label on its own soft ground          ≥ 4.5:1   (a passed stage, a badge)
//   solid  — as a dot / bar / chart mark on --surface-2 ≥ 3:1    (the darkest ground a mark lands on)
//
// SELF-CONTAINED by the same contract as opps-domain.ts: the functions ship to the browser via
// toString(), so they may reference only their parameters and the constants injected with them.

export type StageTone = { readonly solid: string; readonly soft: string; readonly text: string };

/** The seeded rungs keep their hue whatever position an admin moves them to — a stage's colour is
 *  part of its identity, like its key, and the key is code-owned for the same reason. The order runs
 *  cool to warm: early conversation is slate and teal, commitment is violet and fuchsia, the last
 *  open rung before signature is orange. */
export const STAGE_TONE_KEYED: Readonly<Record<string, StageTone>> = {
  contact:   { solid: "#475569", soft: "#EEF1F5", text: "#334155" },
  discover:  { solid: "#0F766E", soft: "#E3F4F1", text: "#115E59" },
  present:   { solid: "#2563EB", soft: "#EAF1FE", text: "#1A47BE" },
  tech:      { solid: "#7C3AED", soft: "#F1EAFD", text: "#5B21B6" },
  quote:     { solid: "#A21CAF", soft: "#FAE8FB", text: "#86198F" },
  negotiate: { solid: "#C2410C", soft: "#FDEDE3", text: "#9A3412" },
};

/** Outcomes use the status channel's meaning (green won, red lost), darkened so white text on the
 *  solid clears 4.5:1 — DESIGN.md's `--s-issued` #1E9E63 is a MARK and carries white at only 3.3. */
export const STAGE_TONE_WON: StageTone = { solid: "#15803D", soft: "#E4F5EC", text: "#12633F" };
export const STAGE_TONE_LOST: StageTone = { solid: "#B91C1C", soft: "#FBE7E6", text: "#8E2A27" };

/** A rung an admin ADDS in «إعدادات النظام» has no seeded hue. It takes one from this cycle by its
 *  position among open stages — none of these repeats a keyed hue, so a custom rung never looks like
 *  a neighbour. */
export const STAGE_TONE_CYCLE: readonly StageTone[] = [
  { solid: "#4338CA", soft: "#ECEBFB", text: "#3730A3" },
  { solid: "#0369A1", soft: "#E3F1FA", text: "#075985" },
  { solid: "#A16207", soft: "#FBF1DC", text: "#854D0E" },
  { solid: "#BE185D", soft: "#FBE7F0", text: "#9D174D" },
];

/** Resolve a stage's tone. `terminal` is the ladder's own field ("won" | "lost" | null); the key is
 *  checked too, because the compiled fallback ladder in the browser carries terminal:null. */
export function stageToneOf(key: string, terminal: string | null, openIndex: number): StageTone {
  if (terminal === "won" || key === "won") return STAGE_TONE_WON;
  if (terminal === "lost" || key === "lost") return STAGE_TONE_LOST;
  const keyed = STAGE_TONE_KEYED[key];
  if (keyed) return keyed;
  const i = Math.max(0, Math.floor(Number(openIndex) || 0));
  return STAGE_TONE_CYCLE[i % STAGE_TONE_CYCLE.length];
}

export type StepState = "done" | "current" | "todo";

/**
 * Where a line sits on the OPEN ladder, one state per rung, for the stepper.
 *
 *   open line  — rungs before its own are done, its own is current, the rest todo.
 *   won        — every open rung is done: a signed deal passed them all, whether or not each one was
 *                recorded (the ladder is a definition of the sale, not a log of clicks).
 *   lost       — every rung is todo. The row does not remember how far the deal got before it was
 *                lost, and marking rungs done would be a claim nobody recorded.
 *   unknown    — a key the ladder does not carry: nothing is current, rather than guessing a rung.
 *
 * `openKeys` is the ladder's open rungs IN ORDER; order is the caller's, so an admin's reordering is
 * honoured without this function knowing about positions.
 */
export function stageSteps(openKeys: readonly string[], currentKey: string): StepState[] {
  if (currentKey === "won") return openKeys.map(() => "done" as StepState);
  const at = openKeys.indexOf(currentKey);
  if (at === -1) return openKeys.map(() => "todo" as StepState);
  return openKeys.map((_, i) => (i < at ? "done" : i === at ? "current" : "todo") as StepState);
}

const TONE_FNS = [stageToneOf, stageSteps] as const;

export const STAGE_TONE_JS: string = [
  "/* ===== stage-tone-domain (generated from src/stage-tone-domain.ts — do not edit here) ===== */",
  "var STAGE_TONE_KEYED = " + JSON.stringify(STAGE_TONE_KEYED) + ";",
  "var STAGE_TONE_WON = " + JSON.stringify(STAGE_TONE_WON) + ";",
  "var STAGE_TONE_LOST = " + JSON.stringify(STAGE_TONE_LOST) + ";",
  "var STAGE_TONE_CYCLE = " + JSON.stringify(STAGE_TONE_CYCLE) + ";",
  ...TONE_FNS.map((fn) => fn.toString()),
].join("\n");
