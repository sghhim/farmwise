# FieldWise API

Express service backed by Postgres (TypeORM), optional Redis for HTTP response caching, and local disk for uploads.

## Requirements

- Bun (see packageManager in package.json)
- Postgres reachable via DATABASE_URL
- Optional Redis at REDIS_URL for caching (lists, meta categories, weather proxy TTL)

## Setup

Copy .env.example to .env and set at least DATABASE_URL and JWT_SECRET (32+ characters). For local stacks, docker-compose.yml at the repo root starts Postgres and Redis with user and database named fieldwise.

## Run

Development with reload:

    bun run dev

Production-style compile then node entry:

    bun run build
    bun run start

The process listens on PORT (default 4000). Health check path: /api/health

## Admin bootstrap

If ADMIN_EMAIL and ADMIN_PASSWORD are defined in .env and no account exists for that email, one ADMIN user is created on startup.

## Notes

- Schema sync is enabled when NODE_ENV is not production; use migrations before real production deploys.
- Uploaded files live under UPLOAD_DIR (default ./uploads) and are served under /uploads.
