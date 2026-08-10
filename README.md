# massar-engine

The WhatsApp AI campaign engine for **Massar (مَسار)** — MVP spine.
Gupshup gateway adapter + Arabic AI salesperson (OpenAI) + in-memory per-contact tracking.

Architecture doc: https://claude.ai/code/artifact/11645969-2dcd-4515-8fba-5f00c3b48abd

## What it does today

- Receives Gupshup webhooks (`POST /webhooks/gupshup?token=…`): inbound WhatsApp
  messages **and** delivery events (`enqueued / sent / delivered / read / failed`).
- Tracks every contact in memory: status timeline, transcript, WhatsApp profile
  name, product-interest tags, outcome (interested / not interested / handoff /
  opted out). This is the Postgres `campaign_contacts` + `events` model, memory
  edition — DB comes next.
- Runs the Arabic sales agent on every inbound message: grounded on a seed
  product KB (الإجازات المرضية + cross-sell فحص الموظفين / التقارير الطبية), with
  tools `tag_interest`, `mark_not_interested`, `offer_alternative`,
  `request_human_handoff`, `close_conversation`.
- Hard rules in code (not the model): «إيقاف»/STOP opt-out short-circuit,
  12-turn cap → handoff, human-takeover silence.
- Sends session text / quick-reply / template messages through Gupshup.

## Endpoints

| Route | Auth | Purpose |
|---|---|---|
| `GET /health` | none | status, chosen model, config report |
| `GET/POST /webhooks/gupshup` | `?token=` | Gupshup callback URL |
| `GET /admin/state` | `x-admin-token` | full tracker snapshot (contacts, tags, transcripts) |
| `POST /admin/send-test` | `x-admin-token` | `{ "to": "9665…", "text": "…" }` — session message smoke test |
| `POST /admin/send-template` | `x-admin-token` | `{ "to", "templateId", "params": [] }` — campaign opener |

## Run locally

```bash
cp .env.example .env   # fill in keys
npm install
npm run dev
# expose for webhooks: cloudflared tunnel --url http://localhost:8080
```

## Deploy (Fly.io)

```bash
fly deploy --ha=false
fly secrets set OPENAI_API_KEY=… GUPSHUP_API_KEY=… GUPSHUP_APP_ID=… \
  WEBHOOK_TOKEN=… ADMIN_TOKEN=… GUPSHUP_SOURCE_NUMBER=…
```

Webhook URL for the Gupshup dashboard (App → Webhooks / Callback URL):

```
https://<app>.fly.dev/webhooks/gupshup?token=<WEBHOOK_TOKEN>
```

Subscribe modes: **Message** (inbound) + message events (**Sent, Delivered, Read, Failed, Others**), payload **v2**.

## Next increments (per the architecture doc)

1. Postgres (`campaigns`, `campaign_contacts`, `events`, `interest_tags`) replacing the in-memory tracker.
2. BullMQ + Redis replacing the in-process FIFO; outbox + pacer for campaign template blasts.
3. KB editor feed (معرفة المنتج) replacing the seed KB constant.
4. Massar dashboard reading the funnel + contact tracker.
