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

  // Public base URL for serving media to Gupshup.
  publicBaseUrl: process.env.PUBLIC_BASE_URL || "https://massar-engine.fly.dev",

  // The product manager's WhatsApp (digits, country code) — hot leads and handoffs are
  // pushed here as a lead card. Unset = alerts silently disabled.
  notifyNumber: process.env.NOTIFY_NUMBER || "",

  // Sales assets the agent may send (images/PDFs). JSON array:
  // [{"id":"sickleave-onepager","type":"document","url":"https://…/x.pdf","filename":"الإجازات-المرضية.pdf","caption":"…"}]
  assetsJson: process.env.ASSETS_JSON || "[]",
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
  };
}
