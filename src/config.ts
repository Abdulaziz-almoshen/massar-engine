import "dotenv/config";

// All runtime configuration in one place. On Fly these come from `fly secrets`.
export const cfg = {
  port: Number(process.env.PORT || 8080),

  openaiKey: process.env.OPENAI_API_KEY || "",
  // Optional override; when empty the agent auto-picks the best available model at boot.
  openaiModel: process.env.OPENAI_MODEL || "",

  gupshupKey: process.env.GUPSHUP_API_KEY || "",
  gupshupAppId: process.env.GUPSHUP_APP_ID || "",
  // App name is auto-learned from the first webhook (envelope `app` field) if not set.
  gupshupAppName: process.env.GUPSHUP_APP_NAME || "",
  // The WhatsApp business number of the Gupshup app (digits only, country code, no +).
  // Required for OUTBOUND sends; inbound tracking works without it.
  sourceNumber: process.env.GUPSHUP_SOURCE_NUMBER || "",

  // Shared secret appended to the webhook URL (?token=...) — Gupshup callbacks are unsigned.
  webhookToken: process.env.WEBHOOK_TOKEN || "",
  // Header token (x-admin-token) for /admin/* endpoints.
  adminToken: process.env.ADMIN_TOKEN || "",

  // Header token (x-integration-token) for /integration/* — the READ-ONLY, aggregate-only feed
  // other Lean systems consume (today: Makeen's product dashboard, «العملاء المحتملون»).
  //
  // A SEPARATE secret from ADMIN_TOKEN by design. The admin token can move money-bearing rows and
  // read every customer's phone and transcript; a sibling product that only needs six integers must
  // never be handed it, because handing it over is what turns one system's leak into both systems'
  // leak. Unset = the whole /integration surface is off (404), so the default posture is closed.
  integrationToken: process.env.INTEGRATION_TOKEN || "",

  // Header token (x-rep-token) for /rep/* — the sales rep's own surface.
  //
  // A THIRD secret, for the same reason integrationToken is a second one. Gate A needs a named rep
  // using Massar for three weeks, and the only credential that existed could launch a WhatsApp
  // campaign to real clinics and read every transcript. Handing that to a rep to run a pilot is not
  // a pilot, it is an incident waiting for a mistap.
  //
  // Format is "name:secret", one per rep, comma-separated — because Gate A is judged per rep and an
  // actor derived from a SHARED token attributes nothing. The name becomes the actor on every row
  // that rep writes; it is never read from the request body.
  //   REP_TOKENS="سارة القحطاني:s3cr3t,خالد الدوسري:0th3r"
  // Unset = the whole /rep surface is off (404), so the default posture is closed.
  repTokens: (process.env.REP_TOKENS || "")
    .split(",")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const i = pair.indexOf(":");
      return i < 0 ? null : { name: pair.slice(0, i).trim(), secret: pair.slice(i + 1).trim() };
    })
    .filter((r): r is { name: string; secret: string } => Boolean(r && r.name && r.secret)),

  // Public base URL for serving media to Gupshup.
  publicBaseUrl: process.env.PUBLIC_BASE_URL || "https://massar-engine.fly.dev",

  // The product manager's WhatsApp — hot leads and handoffs are pushed here as a lead card.
  // Digit-stripped at the boundary: the self-alert guard and the PM auto-test-flag both
  // exact-match against tracker phones, which are always bare digits. Unset = alerts disabled.
  notifyNumber: (process.env.NOTIFY_NUMBER || "").replace(/\D/g, ""),

  // A HOT reading opens an opportunity on «فرص البيع» by itself. On by default — the founder asked
  // for it — and switchable without a deploy (`fly secrets set AUTO_OPP=off`) because an automation
  // that writes to his money board must be stoppable by him, not only by us.
  autoOppFromHot: (process.env.AUTO_OPP || "on").toLowerCase() !== "off",

  // Sales assets the agent may send (images/PDFs). JSON array:
  // [{"id":"sickleave-onepager","type":"document","url":"https://…/x.pdf","filename":"الإجازات-المرضية.pdf","caption":"…"}]
  assetsJson: process.env.ASSETS_JSON || "[]",

  // Known accounts for the usage-led expansion motion. JSON array keyed by phone:
  // [{"phone":"9665...","customerName":"…","branches":10,"hisName":"…",
  //   "transactionVolume":"≈1,400 إجازة شهريًا","currentProducts":["الإجازات المرضية"]}]
  // Absent facts stay absent — the agent asks rather than guessing. See src/accounts.ts.
};

export function configReport() {
  return {
    openaiKey: cfg.openaiKey ? "set" : "MISSING",
    gupshupKey: cfg.gupshupKey ? "set" : "MISSING",
    gupshupAppId: cfg.gupshupAppId ? "set" : "MISSING",
    gupshupAppName: cfg.gupshupAppName || "(auto-learn from webhook)",
    sourceNumber: cfg.sourceNumber ? "set" : "MISSING — outbound disabled until GUPSHUP_SOURCE_NUMBER is set",
    webhookToken: cfg.webhookToken ? "set" : "MISSING (webhook is unauthenticated!)",
    adminToken: cfg.adminToken ? "set" : "MISSING (/admin disabled)",
    repTokens: cfg.repTokens.length ? String(cfg.repTokens.length) + " rep(s)" : "none (/rep disabled)",
    autoOppFromHot: cfg.autoOppFromHot ? "on" : "off (AUTO_OPP=off)",
  };
}
