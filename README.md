# DevSync

DevSync is a collaborative engineering workspace that connects project discussions, decisions, tasks, pull requests, activity, and notifications so implementation keeps its source context.

## Implemented areas

- JWT-backed account registration and login, authenticated workspaces, memberships, invitations, and scoped projects.
- Project discussions and messages, a decision log, task board, task comments, and linked source context.
- Project activity, user notifications, search, uploads with file/request/quota validation, and Socket.IO updates for authorized project rooms.
- GitHub pull-request links and lifecycle updates from signed GitHub webhook events. Lifecycle status is not set by the client.

## Task lifecycle and GitHub review

Tasks move through `To Do → In Progress → In Review → Done`. Only the assigned developer can start work, submit for review, or return an in-review task to work. The task creator or a workspace Admin can assign/reassign tasks; a workspace Admin can manually complete an in-review task with a required completion note. Direct client updates cannot set a task to Done.

Link a PR with its canonical HTTPS GitHub URL. Without a GitHub API integration, a newly pasted URL is stored as **unverified**; the URL alone does not prove the PR exists or its state. Configure `GITHUB_WEBHOOK_SECRET` and GitHub **Pull requests** and **Pull request reviews** events at `/api/webhooks/github` to receive signed lifecycle and review updates. A signed merge changes an in-review task to Done only when every listed acceptance criterion is complete. A signed `changes_requested` review returns the task to In Progress. GitHub API lookup (PR title/review/check status before webhook delivery) is not currently configured. Review discussions can be recorded with task comments; GitHub review comments and approval/check-state synchronization are not currently imported.

## Workspace permissions and deletion

Workspace creation assigns the creator the existing `Admin` role; there is no separate Owner role. Admins can invite members, change roles, delete projects, and delete the workspace. A role update requires the caller to currently be an Admin, and the role update rechecks atomically that an Admin remains. Members can view scoped workspace/project data, create projects, and create tasks. Task creators or Admins can reassign/delete their tasks; only the assignee may move a task through the work/review transitions. Project/workspace deletion requires typing the exact name and is permanent.

Deletion is an idempotent, retryable cleanup sequence: managed files are unlinked only from `DEVSYNC_UPLOAD_DIRECTORY` using validated generated filenames; scoped records (tasks, discussions, decisions, activity, notifications, webhook deliveries, uploads, quotas, invitations) are removed before the parent project/workspace. The parent remains if cleanup fails, so an Admin can retry. MongoDB transactions are not required for this cleanup path. Notifications are listed across currently accessible workspaces/projects, only while their referenced resource still exists; clicking one switches to its authorized workspace/project and the destination page fetches the resource again under normal scope checks. Realtime notification sockets send only a wake-up ID; content is reloaded through the authorized API.

## Local development

Use Node.js 20.19+ or 22.12+ for the current Vite toolchain.

1. Install dependencies in `server` and `client` with `npm install`.
2. Copy `server/.env.example` to `server/.env`, then configure a local MongoDB URI and a private JWT secret. The example uses a local MongoDB address; set your own Atlas URI if using Atlas.
3. Copy `client/.env.example` to `client/.env` if the API is not at its local default.
4. Run `npm run dev` from `server` and `npm run dev` from `client` in separate terminals.

Never commit local `.env` files. Server-only secrets must not use `VITE_` names because Vite exposes those variables to browser code.

## Configuration

Required server settings:

- `MONGODB_URI`: local MongoDB or the connection string for the intended MongoDB deployment.
- `JWT_SECRET`: private signing secret; production requires a non-placeholder value of at least 32 characters.
- `CLIENT_ORIGIN`: one trusted frontend origin; production requires HTTPS.

Optional integrations:

- `GITHUB_WEBHOOK_SECRET`: secret used to verify the SHA-256 signature of raw GitHub webhook payloads. Configure the webhook for **Pull requests** events at `/api/webhooks/github` on the deployed HTTPS API origin. A GitHub API token is not required for the verified webhook lifecycle flow.
- `DEVSYNC_UPLOAD_DIRECTORY`: optional private file storage location. Mount a persistent writable volume there in production; the default local disk path is not durable on ephemeral hosts. `DEVSYNC_UPLOAD_MAX_FILE_BYTES` optionally configures the per-file limit (default 5 MB, maximum 50 MB). Uploads allow five files per request and 100 MB stored per user/workspace. The unique `uploadquotas` index on `{ workspace: 1, user: 1 }` is required when Mongoose automatic index creation is disabled.

The client reads `VITE_API_BASE_URL`; local development defaults to `http://localhost:5000/api`. Production builds require an explicit HTTPS API URL. REST and Socket.IO use the same configured API origin.

See `server/.env.example`, `client/.env.example`, and `client/.env.production.example` for safe templates. They contain no working credentials or deployment hostnames.

## Verification commands

From `server`:

```sh
node --test
```

From `client`:

```sh
npm run lint
npm test
npm run build
```

Current tests include authentication, body parsing, upload scope, scoped task references, database diagnostics, and runtime configuration. The automated suite does not replace live verification against a configured MongoDB deployment or GitHub credentials.

## Current workflow notes

- Invitations are copy-and-share tokens; DevSync does not send invitation email. The server stores a token hash. Acceptance uses a short-lived atomic claim, idempotent membership insertion, and retryable finalization. Admins can view member identities/roles and pending invitation email/expiry in Settings → Workspace and revoke pending invitations; Members have read-only roster access.
- Deleting an individual task clears its references from independent discussions and decisions, removes task notifications, and retains activity history without a live task link. If reference cleanup fails, the task remains available so cleanup can be retried.
- Additional focused tests cover invitation concurrency/retry and task-reference cleanup. The HTTP tests bind temporary localhost ports; live MongoDB and GitHub webhook checks remain separate integration work.
