// The single door for outbound WhatsApp.
//
// Independent QA (Codex, round 1, 2026-08-14) found that /admin/send-test and
// /admin/send-template called gupshup.* directly with no opt-out check, so a contact who had
// written «إيقاف» could still be messaged from an admin route. `safeSend` in agent.ts is a
// try/catch, not a guard. The campaign launch path (index.ts) had the correct checks but kept
// them to itself — which is exactly the "widened for one consumer" shape that keeps recurring.
//
// This module holds the POLICY so it cannot be re-derived per call site. CLAUDE.md §4: hard
// rules live in code, never only in prompts.
import * as tracker from "./tracker.js";
import * as insights from "./insights.js";

/** Session = free-form text, allowed only inside the customer's own 24h window.
 *  Template = a Meta-approved template, which may legitimately open a closed window. */
export type SendKind = "session" | "template";

export type Refusal = { refused: true; code: string; reason: string };

/**
 * Returns a Refusal when the send must NOT happen, or null when it may proceed.
 *
 * Scope note, stated rather than implied: this enforces opt-out and the 24h service window.
 * It does NOT enforce the agent turn cap — that is a per-conversation budget owned by
 * agent.ts and is meaningless for an admin one-shot. Do not read a null return as "every
 * safety rule passed"; read it as "opt-out and window passed".
 */
export function checkOutbound(phone: string, kind: SendKind): Refusal | null {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return { refused: true, code: "invalid_phone", reason: "رقم غير صالح." };

  const contact = tracker.findContact(digits);

  // Opt-out is absolute and has no template exception. A customer who asked us to stop is not
  // a customer we may reach with an approved template either.
  if (contact?.optedOut) {
    return { refused: true, code: "opted_out", reason: "أوقف هذا الرقم التواصل — لا يُرسل إليه شيء." };
  }

  if (kind === "session") {
    const win = insights.windowState(contact);
    if (win.state !== "open") {
      return {
        refused: true,
        code: win.state === "closed" ? "outside_window" : "no_inbound_ever",
        reason: win.reason,
      };
    }
  }

  return null;
}
