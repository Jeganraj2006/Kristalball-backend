# KAVACH

KAVACH is a fictional, enterprise Asset Accountability & Lifecycle Management Platform. It currently provides a secure application foundation and a frontend UI demonstration; production asset, inventory, approval, and other business workflows are not implemented.

## Repository layout

```text
frontend/  React + TypeScript + Vite application
backend/   Express + TypeScript + Prisma API
docs/      Product, architecture, database, API, RBAC, and roadmap documentation
```

Read [AGENTS.md](AGENTS.md) and the documents in `docs/` before changing domain behavior.

## Prerequisites

- Node.js 24+ and pnpm 11+
- Docker Desktop with Docker Compose
- PostgreSQL is provided locally through Docker Compose; no database credentials belong in frontend variables.

## Local setup

1. Copy the backend/database example and choose a unique local password:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Update both occurrences of `replace-with-a-long-local-development-password` in `.env` to the same value. Do not commit `.env`.

3. Configure the browser-visible API base URL (it contains no secrets):

   ```powershell
   Copy-Item frontend/.env.example frontend/.env
   ```

4. Install dependencies and generate Prisma Client:

   ```powershell
   pnpm install
   pnpm db:generate
   ```

5. Start PostgreSQL and check it is healthy:

   ```powershell
   docker compose up -d postgres
   docker compose ps
   pnpm db:check
   ```

6. Start both applications:

   ```powershell
   pnpm dev
   ```

   The API listens on `http://localhost:3000`; the Vite app defaults to `http://localhost:5173`.

## UI demonstration

The frontend includes a responsive enterprise UI foundation with a dashboard and routed screens for Asset Registry, Inventory, Transfers, Assignments, Physical Reconciliation, Maintenance, Audit Logs, Reports, User Management, and Settings. It also includes loading, empty, error, confirmation, notification, global-search, profile, and responsive-navigation states.

All values and records in the UI are fictional static demo data from `frontend/src/app/demo-data.ts`. The interface intentionally labels the demo boundary and does not submit business commands or present mock data as a live API result.

## Verification commands

```powershell
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm db:check
```

`GET /api/v1/health` is a liveness endpoint. `GET /api/v1/ready` verifies PostgreSQL connectivity and returns `503` until the database is reachable.

## Environment safety

- `.env` is gitignored and read by the backend and Docker Compose only.
- Only variables prefixed with `VITE_` are exposed to the frontend. Do not place secrets, database URLs, JWT keys, or service credentials there.
- The API validates required configuration at startup and exits with a safe configuration error when invalid.
- Authentication additionally requires unique `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` values of at least 32 characters; use a secrets manager outside local development.

Read [Authentication and Authorization](docs/AUTHORIZATION.md) before changing identity, permissions, session, or location-scope behavior.

## Database workflow

Prisma is configured but deliberately has no domain models or migrations yet. Domain schema changes must follow the approved database design and use Prisma migrations plus raw SQL migrations where PostgreSQL constraints/triggers are required. Never use `prisma db push` for production schema changes.

When finished locally:

```powershell
docker compose down
```

Use `docker compose down -v` only when intentionally discarding local development data.
