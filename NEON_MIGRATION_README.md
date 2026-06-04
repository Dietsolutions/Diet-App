# NEON_MIGRATION.sql

Single SQL script to apply the Batch 4+5 schema changes to a Neon (PostgreSQL) database.

## Why a separate file

The local dev DB is SQLite (managed by `prisma migrate dev`). The production DB
on Neon is PostgreSQL (managed by `prisma migrate deploy`). The 3 new
migrations we shipped in Batches 4+5 were written for SQLite syntax. The
Postgres version has some differences:

- `BOOLEAN` and `TEXT` are native types (no change needed)
- Postgres has a built-in `sha256()` function (used for the reset-token
  hash column backfill)
- Postgres needs explicit `DROP CONSTRAINT` / `DROP INDEX IF EXISTS` to
  safely re-run partially
- The `password_reset_tokens` table was never created in the production
  schema (the original init migration didn't include it). This script
  creates it from scratch if missing.

## How to apply

1. Open the Neon dashboard → your project → **SQL Editor**.
2. Open `NEON_MIGRATION.sql` from this directory.
3. Paste the entire file contents into the editor.
4. Click **Run**.

The script is wrapped in a single transaction (`BEGIN` / `COMMIT`) and
guards every operation with `IF NOT EXISTS` / `IF EXISTS`, so it is safe
to re-run if it partially succeeds.

## What it does

| Step | Change | Idempotent? |
|---|---|---|
| A.1 | `ALTER TABLE "User" ADD COLUMN "appleId" TEXT` + unique index | yes (column + index both `IF NOT EXISTS`) |
| A.2 | `ALTER TABLE "User" ADD COLUMN "isReview" BOOLEAN NOT NULL DEFAULT false` | yes |
| B.1 | `CREATE TABLE IF NOT EXISTS password_reset_tokens (...)` with the new `tokenHash` schema | yes |
| B.2 | Add FK to User if missing | yes (DO block checks pg_constraint) |
| B.3 | If old `token` column exists, backfill SHA-256 hex into `tokenHash` and drop the old column | yes (column-existence check) |
| B.4 | Enforce NOT NULL on `tokenHash` (deletes any NULL rows first) | yes (nullable check) |
| B.5 | Create unique + lookup indexes on `tokenHash` and `userId` | yes (all `IF NOT EXISTS`) |

## Verify after running

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'User' AND column_name IN ('appleId', 'isReview');

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'password_reset_tokens'
ORDER BY ordinal_position;
```

Expected:
- `User.appleId`: `text`, `YES` (nullable)
- `User.isReview`: `boolean`, `NO` (NOT NULL)
- `password_reset_tokens.tokenHash`: `text`, `NO` (NOT NULL)

## What this script does NOT do

- It does NOT create any User rows. Run the auth/Apple flow as normal to
  create users with the new fields.
- It does NOT seed data. Use `npm run seed` (or your own seed script)
  if you need the demo accounts.
- It does NOT touch any tables other than `User` and `password_reset_tokens`.
