# DevSync

### Real-Time Collaborative Engineering Workspace

DevSync is a MERN-stack collaborative workspace that connects team discussions, decisions, tasks, and code while preserving the reasoning behind every task.

**Tech Stack:** React, Node.js, Express.js, MongoDB, Socket.IO.

## API and CORS configuration

Local Vite development defaults to `http://localhost:5000/api`. For another backend, set `VITE_API_BASE_URL` in `client/.env`; it must be an absolute URL ending in `/api`. The same configured origin is used by REST and Socket.IO. Production builds require `VITE_API_BASE_URL` and require HTTPS, for example `https://api.example.com/api` (see `client/.env.production.example`).

The server uses `CLIENT_ORIGIN` as the single allowed browser origin for both Express CORS and Socket.IO. Local development defaults to `http://localhost:5173`; production requires an explicit HTTPS origin, for example `https://app.example.com` (see `server/.env.example`).

`MONGODB_URI`, `JWT_SECRET`, `LLM_API_KEY`, and `GITHUB_WEBHOOK_SECRET` are server-only settings. Never prefix them with `VITE_`: Vite embeds `VITE_` variables into browser assets. Store real secrets only in the server deployment environment and never commit `.env` files.

### Authentication and upload limits

Authentication throttles registration to 5 attempts per IP per hour and login to 10 attempts per IP per 15 minutes. Uploads are limited to 10 requests per authenticated user per 15 minutes, 5 files per request, 5 MB per file, and 100 MB stored per user/workspace. The rate limits are process-local; deployments with multiple server instances should use a shared limiter. Upload quota reservations use atomic MongoDB updates and require the unique `uploadquotas` index on `{ workspace: 1, user: 1 }`; deployments with Mongoose automatic index creation disabled must create that index before enabling uploads.

## Development Status

Day 1 — Initial project setup.

## Core Features (Planned)

- JWT Authentication
- Workspaces and role-based permissions
- Projects and Kanban board
- Real-time collaboration
- Discussion channels
- Decision Log
- Context-linked tasks
- AI-assisted decision extraction
- GitHub PR integration

## AI Discussion Suggestions (Phase 7)

AI extraction is server-side and uses an OpenAI-compatible chat-completions endpoint. Configure the following in the server environment; no key belongs in the client environment or source files:

```env
LLM_API_KEY=replace-with-your-provider-key
LLM_API_URL=https://api.openai.com/v1/chat/completions
LLM_MODEL=gpt-4o-mini
```

`LLM_API_KEY` is required. `LLM_API_URL` and `LLM_MODEL` are optional and default to the OpenAI-compatible endpoint and `gpt-4o-mini`. For local-only providers using plain HTTP, `LLM_ALLOW_HTTP=true` is required; use HTTPS in deployed environments. Suggestions remain pending until a project member explicitly approves selected items. Requests are limited to five per user, workspace, and project per 15 minutes per server process.

## GitHub pull request webhooks (Phase 8)

Set this server-side environment variable to a long random secret. Never place it in the client environment or source files:

```env
GITHUB_WEBHOOK_SECRET=replace-with-a-long-random-secret
```

To configure a repository webhook, use the URL `https://<your-deployed-host>/api/webhooks/github`, choose **application/json**, set the same secret, and subscribe to **Pull requests** events. Configure the actual HTTPS domain provided by your deployment; DevSync does not assume a hosting provider or hostname. The endpoint verifies GitHub's SHA-256 HMAC over the raw request body. Localhost is not reachable by GitHub and plain local HTTP does not provide a production-safe webhook endpoint; local webhook work requires a temporary public HTTPS tunnel. The integration uses verified webhook payloads and does not require a GitHub API token.
