# Smart Wallet Copier Dashboard

Read-only dashboard for a **paper-trading only** copy-trading bot. Not financial advice.

- `GET /` – dashboard (public, read-only)
- `GET /api/snapshot` – latest snapshot JSON (public)
- `POST /api/ingest` – replace snapshot; requires `Authorization: Bearer $INGEST_TOKEN`
- `GET /healthz`

Env: `INGEST_TOKEN` (required for ingest, set in Render, never committed), `PORT`.
The bot pushes a FULL snapshot each time (free instances restart and lose memory).
