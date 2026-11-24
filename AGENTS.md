# Controller — unified Remix app

Single Remix 3.2.0 app: marketing site + Console + agent backend (formerly the
Hono/Inngest service, now native Remix modules under `app/lib/agent/`).

## Commands

- `npm run dev` — dev server on :44100 (NODE_ENV=development)
- `npm start` — production server (`PORT` env, default 44100)
- `npm run typecheck` — `tsc --noEmit`

## Architecture

- Routes/actions: `app/routes.ts` + `app/actions/controller.tsx` (Request/Response handlers).
- Pages: `app/pages/*`; client entries: `app/ui/*` (`console.tsx`, `support-widget.tsx`, `goal-watcher.tsx`).
- Auth: Better Auth (`app/lib/auth.ts`) — email+password, no email verification,
  Postgres via `pg` Pool. Handler mounted at `/api/auth/*` in `server.ts`.
  Login/signup/plan are native form posts; `/dashboard` requires a session with
  `user.plan` set (trial is the only live tier; free is "coming soon").
  The account id is the tenant (`server_id`) for goals.
- Agent pipeline (in-process, no Inngest/Vercel): `app/lib/agent/runner.ts`
  (understand → plan → confirm → execute) backed entirely by Render Postgres
  (`db.ts` tables + `store.ts` kv/progress), Gemini (`gemini.ts`, `understand.ts`),
  Upstash Box VMs with headless Chromium (`box.ts`), support chat (`support.ts`).
  Executing goals resume mid-plan on restart via the persisted box id + progress.
- UI updates: native `<form method="post">` + `data-rmx-target="<frame>"` and
  `<Frame name src>` fragments; polling via `handle.frames.get(name).reload()`.

## Env vars (see .env.example)

`DATABASE_URL` (Render Postgres internal URL), `BETTER_AUTH_SECRET`,
`BETTER_AUTH_URL`, `UPSTASH_BOX_API_KEY`, `GEMINI_API_KEY` (or `GEMINI_API_KEYS`),
optional `MODEL_*`.

Deploy: `render.yaml` (Render web service, `npm ci` / `npm start`, Node 24).
