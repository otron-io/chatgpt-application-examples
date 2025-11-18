# Hotel Support Desk

A ChatGPT App example that demonstrates how a hotel brand can deliver booking support directly inside ChatGPT. The app is built with Next.js 15, Tailwind CSS (v4), and the Model Context Protocol (MCP). It ships with a lightweight JSON database that simulates real bookings plus an MCP tool that returns structured resolution plans.

## Features

- **Mock booking database** – JSON-backed storage with CRUD APIs, seeding endpoint, and booking stats.
- **LLM-powered triage** – `/server/support.ts` calls OpenRouter (or falls back to rules) to produce 2–4 resolution options per request.
- **ChatGPT widget** – `app/page.tsx` renders booking context, missing info callouts, resolution cards, and next actions.
- **MCP tool** – `submit_support_request` exposes the workflow to ChatGPT with a borderless widget resource (`ui://hotel-support.html`).
- **Admin helpers** – `/api/admin` lets you reseed the mock DB or inspect bookings without leaving the sandbox.

## Project layout

```
hotel-support-next/
├── app/
│   ├── api/
│   │   ├── bookings/route.ts   # CRUD + filters
│   │   ├── admin/route.ts      # seed + stats
│   │   └── support/route.ts    # calls support analyzer
│   ├── mcp/route.ts            # MCP resource + tool
│   ├── page.tsx                # ChatGPT widget UI
│   └── layout.tsx              # NextChatSDK bootstrap
├── data/
│   ├── bookings.json           # live data store
│   └── bookings.seed.json      # reset snapshot
├── server/
│   ├── bookings.ts             # JSON persistence helpers
│   └── support.ts              # LLM + fallback logic
└── README.md
```

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000 to view the widget standalone. In dev mode you will see the “Local support tester” panel which hits `/api/support` directly.

### Environment variables

Set these to enable live OpenRouter calls (otherwise the fallback logic runs):

```
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet  # optional
OPENROUTER_TITLE=Hotel Support Desk          # optional
OPENROUTER_REFERRER=https://example.com      # optional
```

## API quick reference

| Endpoint | Description |
| --- | --- |
| `GET /api/bookings?status=confirmed&guestName=sara` | Filter bookings |
| `POST /api/bookings` | Create a booking |
| `PUT /api/bookings` | Update a booking (`{ id, updates }`) |
| `DELETE /api/bookings` | Delete a booking (`{ id }`) |
| `GET /api/admin?resource=stats` | Aggregated counters |
| `POST /api/admin {"action":"seed"}` | Reset the DB to demo state |
| `POST /api/support` | Analyze a support request |

## Using the MCP tool in ChatGPT

1. Run the Next.js app on a reachable URL (e.g., Vercel or via tunnel).
2. Configure your connector with the `https://<host>/mcp` endpoint.
3. Invoke the tool by asking something like: “Help guest QF8N2A cancel her stay.”
4. ChatGPT will render the widget defined in `app/page.tsx`, showing booking context, info requests, and resolution cards.

## Notes

- All data is mock/demo only—no external services are called beyond OpenRouter.
- The widget is self-contained (`NextChatSDKBootstrap`) so static assets load correctly inside ChatGPT’s sandbox.
- For a clean state during demos, `POST /api/admin {"action":"seed"}` resets `data/bookings.json` from `bookings.seed.json`.
