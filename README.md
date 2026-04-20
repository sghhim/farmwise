# FieldWise (Agronomy Advisory Hub)

Full-stack app: Express + TypeORM + PostgreSQL + JWT (backend), React + Vite + Tailwind + shadcn (frontend when present).

## Prerequisites

- [Bun](https://bun.sh/) (recommended for installs and running scripts)
- PostgreSQL 14+
- Redis (optional; used for advisory list caching if `REDIS_URL` is set)

### Local database

Create a database named **`project`** (or point `DATABASE_URL` at whatever you use):

```bash
createdb project
# or: psql -U postgres -c "CREATE DATABASE project;"
```

Set **`DATABASE_URL`** in `backend/.env` to your real Postgres user, password, and database name (e.g. **`project`**):

```bash
# example — replace USER, PASSWORD, and DB name as needed
DATABASE_URL=postgres://USER:PASSWORD@localhost:5432/project
```

If you see **password authentication failed** or **client password must be a string**, the URL does not match how Postgres is configured on your machine. Use the same values you use in `psql` or your GUI client.

### Local Redis

If Redis is running on the default port, `.env.example` sets:

`REDIS_URL=redis://localhost:6379`

Comment that line out in `.env` if you do not want caching.

## Backend

```bash
cd backend
cp .env.example .env
# edit .env: DATABASE_URL (if not using postgres/postgres/project), JWT_SECRET; optional ADMIN_EMAIL + ADMIN_PASSWORD for seeded admin

bun install
bun run dev
```

- API: `http://localhost:4000` (default)
- Health: `GET /api/health`

### Scripts (Bun)


| Command         | Description                             |
| --------------- | --------------------------------------- |
| `bun install`   | Install dependencies (creates lockfile) |
| `bun run dev`   | Dev server with watch (`bun --watch`)   |
| `bun run build` | TypeScript compile to `dist/`           |
| `bun run start` | Run compiled app                        |


Using **npm** or **pnpm** still works (`npm install`, `npm run dev`), but this repo standardizes on **Bun**.

## Frontend

```bash
cd frontend
bun install
bun run dev
```

- App: `http://localhost:5173` (Vite dev server proxies `/api` and `/uploads` to the backend on port 4000).

## Environment variables

See `backend/.env.example`.

Optional **Redis**: set `REDIS_URL` to enable short-lived caching of the public advisory catalog (`GET /api/advisories`). Cache entries are invalidated when advisories are published, updated, archived, or receive new attachments.