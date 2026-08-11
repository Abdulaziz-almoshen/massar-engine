import { cfg } from "./config.js";

// ---------------------------------------------------------------------------
// Gupshup WhatsApp gateway adapter.
// Send:    POST https://api.gupshup.io/wa/api/v1/msg           (session msgs)
//          POST https://api.gupshup.io/wa/api/v1/template/msg  (templates)
// Receive: JSON webhooks — envelope { app, timestamp, version, type, payload }
//   type "message"        → inbound user message
//   type "message-event"  → enqueued | sent | delivered | read | failed | deleted
// This is the only file that knows Gupshup's wire format. Swapping BSP = new adapter.
// ---------------------------------------------------------------------------

const MSG_URL = "https://api.gupshup.io/wa/api/v1/msg";
const TEMPLATE_URL = "https://api.gupshup.io/wa/api/v1/template/msg";

let learnedAppName = "";
let learnedSourceNumber = "";
export function noteAppName(name: string) {
  if (name && !learnedAppName) {
    learnedAppName = name;
    console.log(JSON.stringify({ at: "gupshup", msg: "learned app name from webhook", appName: name }));
  }
}
export function noteSourceNumber(num: string) {
  const digits = (num || "").replace(/\D/g, "");
  if (digits && !learnedSourceNumber && !cfg.sourceNumber) {
    learnedSourceNumber = digits;
    console.log(JSON.stringify({ at: "gupshup", msg: "learned source number from v3 webhook metadata", sourceNumber: digits }));
  }
}
export function appName(): string {
  return cfg.gupshupAppName || learnedAppName;
}
export function sourceNumber(): string {
  return cfg.sourceNumber || learnedSourceNumber;
}
export function outboundReady(): { ok: boolean; reason?: string } {
  if (!cfg.gupshupKey) return { ok: false, reason: "GUPSHUP_API_KEY missing" };
  if (!sourceNumber()) return { ok: false, reason: "GUPSHUP_SOURCE_NUMBER missing (auto-learns from v3 webhooks)" };
  if (!appName()) return { ok: false, reason: "app name unknown (set GUPSHUP_APP_NAME or wait for first v2 webhook)" };
  return { ok: true };
}

async function postForm(url: string, params: Record<string, string>): Promise<{ status: string; messageId?: string }> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: cfg.gupshupKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params).toString(),
  });
  const text = await res.text();
  let body: any = {};
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  if (!res.ok || body.status === "error") {
    throw new Error(`gupshup ${res.status}: ${text.slice(0, 300)}`);
  }
  return body;
}

function baseParams(destination: string): Record<string, string> {
  const ready = outboundReady();
  if (!ready.ok) throw new Error(`outbound not ready: ${ready.reason}`);
  return {
    channel: "whatsapp",
    source: sourceNumber(),
    destination,
    "src.name": appName(),
  };
}

/** Free-form text inside the 24h service window. */
export async function sendText(destination: string, text: string) {
  return postForm(MSG_URL, {
    ...baseParams(destination),
    message: JSON.stringify({ type: "text", text }),
  });
}

/** Interactive quick-reply message (max 3 buttons) inside the service window. */
export async function sendQuickReply(
  destination: string,
  body: string,
  options: { title: string; postbackText?: string }[],
  footer?: string,
) {
  const message = {
    type: "quick_reply",
    msgid: `qr-${Date.now()}`,
    content: { type: "text", text: body, ...(footer ? { caption: footer } : {}) },
    options: options.slice(0, 3),
  };
  return postForm(MSG_URL, { ...baseParams(destination), message: JSON.stringify(message) });
}

/** One bubble: document header + caption text + up to 3 quick-reply buttons. */
export async function sendQuickReplyDocument(
  destination: string,
  url: string,
  filename: string,
  body: string,
  options: { title: string }[],
) {
  const message = {
    type: "quick_reply",
    msgid: `qrd-${Date.now()}`,
    content: { type: "document", url, filename, caption: body },
    options: options.slice(0, 3),
  };
  return postForm(MSG_URL, { ...baseParams(destination), message: JSON.stringify(message) });
}

/** Image inside the service window (public URL; caption optional). */
export async function sendImage(destination: string, url: string, caption?: string) {
  const message = { type: "image", originalUrl: url, previewUrl: url, ...(caption ? { caption } : {}) };
  return postForm(MSG_URL, { ...baseParams(destination), message: JSON.stringify(message) });
}

/** Document (PDF etc.) inside the service window. */
export async function sendDocument(destination: string, url: string, filename: string, caption?: string) {
  const message = { type: "file", url, filename, ...(caption ? { caption } : {}) };
  return postForm(MSG_URL, { ...baseParams(destination), message: JSON.stringify(message) });
}

/** Approved template message — the only way to open a conversation. */
export async function sendTemplate(destination: string, templateId: string, params: string[]) {
  return postForm(TEMPLATE_URL, {
    ...baseParams(destination),
    template: JSON.stringify({ id: templateId, params }),
  });
}

// ------------------------------ webhook normalization ------------------------------

export type InboundMessage = {
  kind: "message";
  waMessageId: string;
  from: string;          // user phone, international digits
  name?: string;         // WhatsApp profile name (the tracker's display name)
  msgType: string;       // text | button | image | ...
  text: string;          // text body, or button title for button taps
  raw: unknown;
};

export type StatusEvent = {
  kind: "status";
  status: "enqueued" | "sent" | "delivered" | "read" | "failed" | "deleted" | string;
  destination: string;   // user phone the message was sent to
  waMessageId?: string;
  gsId?: string;
  errorCode?: number;
  errorReason?: string;
  raw: unknown;
};

export type OtherEvent = { kind: "other"; type: string; raw: unknown };

export type NormalizedEvent = InboundMessage | StatusEvent | OtherEvent;

export function normalizeWebhook(body: any): NormalizedEvent[] {
  if (!body || typeof body !== "object") return [];

  // --- Meta format (v3): WhatsApp Cloud API shape { entry: [{ changes: [{ value }] }] },
  // possibly wrapped by Gupshup with extra top-level fields (e.g. gs_app_id).
  if (Array.isArray(body.entry)) return normalizeMetaFormat(body);
  if (body.payload && Array.isArray(body.payload?.entry)) return normalizeMetaFormat(body.payload);

  // --- Gupshup v2 envelope
  if (body.app) noteAppName(String(body.app));
  const type = body.type;
  const p = body.payload ?? {};

  if (type === "message") {
    const inner = p.payload ?? {};
    const text: string =
      typeof inner.text === "string" ? inner.text :
      typeof inner.title === "string" ? inner.title : // some interactive replies carry title
      "";
    return [{
      kind: "message",
      waMessageId: String(p.id ?? ""),
      // digits-only: phones are E.164 digits; also kills any injection via crafted payloads
      from: String(p.sender?.phone ?? p.source ?? "").replace(/\D/g, ""),
      name: p.sender?.name ? String(p.sender.name) : undefined,
      msgType: String(p.type ?? "text"),
      text,
      raw: body,
    }];
  }

  if (type === "message-event") {
    const inner = p.payload ?? {};
    return [{
      kind: "status",
      status: String(p.type ?? "unknown"),
      destination: String(p.destination ?? "").replace(/\D/g, ""),
      waMessageId: p.gsId ? String(p.id ?? "") : undefined,
      gsId: p.gsId ? String(p.gsId) : (p.type === "enqueued" || p.type === "failed" ? String(p.id ?? "") : undefined),
      errorCode: typeof inner.code === "number" ? inner.code : undefined,
      errorReason: typeof inner.reason === "string" ? inner.reason : undefined,
      raw: body,
    }];
  }

  return [{ kind: "other", type: String(type ?? "unknown"), raw: body }];
}

/** WhatsApp Cloud API (Meta) webhook shape — what Gupshup forwards when the app's
 *  payload format is set to "Meta format (v3)". */
function normalizeMetaFormat(body: any): NormalizedEvent[] {
  const out: NormalizedEvent[] = [];
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      if (value.metadata?.display_phone_number) noteSourceNumber(String(value.metadata.display_phone_number));

      const names = new Map<string, string>();
      for (const c of value.contacts ?? []) {
        if (c?.wa_id && c?.profile?.name) names.set(String(c.wa_id), String(c.profile.name));
      }

      for (const m of value.messages ?? []) {
        const text: string =
          m.text?.body ??
          m.button?.text ??                       // template quick-reply tap
          m.interactive?.button_reply?.title ??   // interactive buttons
          m.interactive?.list_reply?.title ??     // interactive list
          m.reaction?.emoji ??
          "";
        out.push({
          kind: "message",
          waMessageId: String(m.id ?? ""),
          from: String(m.from ?? "").replace(/\D/g, ""),
          name: names.get(String(m.from ?? "")) ?? undefined,
          msgType: String(m.type ?? "text"),
          text,
          raw: body,
        });
      }

      for (const s of value.statuses ?? []) {
        const err = Array.isArray(s.errors) && s.errors.length ? s.errors[0] : undefined;
        out.push({
          kind: "status",
          status: String(s.status ?? "unknown"),
          destination: String(s.recipient_id ?? "").replace(/\D/g, ""),
          waMessageId: String(s.id ?? ""),
          errorCode: typeof err?.code === "number" ? err.code : undefined,
          errorReason: err ? String(err.title ?? err.message ?? "") : undefined,
          raw: body,
        });
      }
    }
  }
  if (!out.length) out.push({ kind: "other", type: "meta-v3-unrecognized", raw: body });
  return out;
}
