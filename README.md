# ForgeAI — AI Factory Operations Prototype

A working prototype of the *AI Factory Operations SaaS Technical Blueprint*:
inventory → production → procurement → supplier selection → approval →
purchase → updated inventory, with a real (if simplified) AI layer watching
for stockout risk.

**This is a walking-skeleton prototype, not the full blueprint.** Every number
in the app is computed live from a seeded synthetic dataset — nothing is
hardcoded — but several blueprint components are implemented as lighter-weight
stand-ins rather than the specified ML stack. See
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for exactly what's real vs.
simplified vs. deferred, and [docs/SRS.md](docs/SRS.md) for the full
requirements list.

## Quick start

```bash
# 1. Start Postgres (runs on localhost:5434, not 5432)
docker compose up -d

# 2. Install dependencies
npm install

# 3. Create the schema and load the demo dataset
npx prisma migrate dev --name init
npm run db:seed

# 4. Run it
npm run dev
```

Open `http://localhost:3000` and sign in with any demo account listed on the
login page (password `ForgeAI123!` for all of them).

## Documentation

- [docs/SRS.md](docs/SRS.md) — requirements, roles, what's in/out of scope
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system design, what's simplified and why
- [docs/ERD.md](docs/ERD.md) — entity-relationship diagram
- [docs/API_SPEC.md](docs/API_SPEC.md) — every endpoint, roles, request/response shape
- [docs/USER_MANUAL.md](docs/USER_MANUAL.md) — how to use every page
- [docs/DEMO_RUNBOOK.md](docs/DEMO_RUNBOOK.md) — the blueprint §20 demo, step by step
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — deploying to Vercel

## Project layout

```
app/(app)/          authenticated pages (dashboard, inventory, production, …)
app/api/             route handlers
app/login/           sign-in page
components/ui.tsx    shared UI primitives
lib/domain/          the numerical engine — forecast, risk, suppliers, anomaly, workflow, assistant
lib/                 auth, prisma client, API/client fetch helpers
prisma/              schema + seed script
docs/                SRS, architecture, ERD, API spec, user manual, demo runbook
docker-compose.yml   PostgreSQL only
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the app |
| `npm run build` / `npm start` | Production build/serve |
| `npm run db:seed` | Reset and reload the synthetic dataset (deterministic) |
| `npm run db:migrate` | Prisma migrations |
| `npm run db:studio` | Browse the database |
