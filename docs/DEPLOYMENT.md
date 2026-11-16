# ForgeAI — Deploying to Vercel

The app is a standard Next.js 16 App Router project, which is Vercel's native
target — no adapter or config needed. The only real prerequisite is a
Postgres database Vercel's serverless functions can reach; the local Docker
Postgres this project uses for development can't be.

## 1. Get a hosted Postgres

Any managed Postgres works. **Neon** and **Supabase** are the common pairings
with Vercel and both have a free tier with connection pooling built in —
important, because serverless functions open many short-lived connections and
will exhaust a small unpooled Postgres fast.

- Neon: create a project, copy the **pooled** connection string (has
  `-pooler` in the hostname) for `DATABASE_URL`, and the **direct** connection
  string for `DIRECT_URL`.
- Supabase: use the "Connection pooling" string (port 6543, transaction mode)
  for `DATABASE_URL`, and the direct string (port 5432) for `DIRECT_URL`.
- Any single unpooled Postgres (e.g. a small managed instance): set both
  `DATABASE_URL` and `DIRECT_URL` to the same value.

`DIRECT_URL` is only used by `prisma migrate deploy` at build time — the app
itself only ever uses `DATABASE_URL` (see `prisma/schema.prisma`'s
`directUrl` field).

## 2. Import the repo into Vercel

Vercel auto-detects Next.js — no framework preset changes needed.

## 3. Set environment variables (Vercel project → Settings → Environment Variables)

| Variable | Value |
|---|---|
| `DATABASE_URL` | pooled connection string from step 1 |
| `DIRECT_URL` | direct (non-pooled) connection string from step 1 |
| `SESSION_SECRET` | a long random string — `openssl rand -hex 32` works |

Set these for Production (and Preview, if you want preview deployments to
work against a database too — ideally a separate one, not production's).

## 4. Deploy

Push to the branch Vercel is watching, or click Deploy. The build runs:

```
prisma generate && prisma migrate deploy && next build
```

(`package.json`'s `build` script) — this generates the Prisma Client, applies
any pending migrations to the database from step 1, then builds the app.
Because `migrate deploy` runs on every build, it's safe to redeploy
repeatedly; it only applies migrations that haven't been applied yet.

## 5. Load the demo dataset (optional, once)

The seed script is a plain Node script, not part of the deployed app — run it
from your own machine pointed at the production database:

```bash
# Temporarily set DATABASE_URL to the production (pooled) connection string
DATABASE_URL="<production DATABASE_URL>" npm run db:seed
```

This clears and reloads the full synthetic dataset, same as locally. Skip
this if you'd rather the production deployment start with an empty database.

## Things that are already handled in the code

- **`proxy.ts`** (Next 16's replacement for `middleware.ts`) always runs on
  the Node.js runtime, so session signing via Node's `crypto` module works
  there without any opt-in — unlike the old middleware convention, which
  defaulted to Edge and didn't support it.
- **No API route declares `edge` runtime** — everything defaults to Node.js
  functions, so Prisma works everywhere without special handling.
- **`prisma generate` runs on both `postinstall` and as the first step of
  `build`** — belt-and-suspenders against Vercel sometimes skipping
  `postinstall` when it reuses a cached `node_modules`.
- **No local filesystem writes** at runtime — the app is stateless beyond the
  database, so it needs no persistent volume.

## What's still your call

- Which Postgres provider (Neon vs. Supabase vs. something else) — pick
  whichever you're already using elsewhere, or default to Neon's free tier.
- Whether preview deployments get their own database or share production's
  (sharing is fine for a prototype demo, riskier for anything real).
- `SESSION_SECRET` rotation policy — this prototype doesn't invalidate
  existing sessions on rotation, they just stop verifying (users get logged
  out, nothing worse).
