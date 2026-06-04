-- =============================================================================
-- Apply pending migrations to Neon (PostgreSQL) — paste this into the
-- Neon SQL editor and click Run. Idempotent: safe to re-run.
-- =============================================================================
--
-- Background: Batches 4+5 changed the schema in three migrations. The local
-- dev DB (SQLite) was updated by `prisma migrate dev`. This script applies
-- the same changes to the production Postgres DB on Neon, which is currently
-- unreachable from this dev env so we can't use `prisma migrate deploy`.
--
-- The script is split into:
--   A. Schema changes (User columns)
--   B. New table (password_reset_tokens) + column migration to hashed tokens
--
-- Each section is guarded with `IF NOT EXISTS` / `IF EXISTS` so the script
-- is safe to re-run if part of it was applied previously.
-- =============================================================================

BEGIN;

-- =============================================================================
-- A.1 — Add User.appleId for Sign in with Apple
-- =============================================================================
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "appleId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_appleId_key" ON "User"("appleId");

-- =============================================================================
-- A.2 — Add User.isReview flag for the Play/App Store reviewer demo account
-- =============================================================================
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isReview" BOOLEAN NOT NULL DEFAULT false;

-- =============================================================================
-- B — Create password_reset_tokens (with tokenHash, no plaintext token column)
-- =============================================================================
-- The original init migration did NOT include this table, so the production
-- schema has never had password reset support. We create it now with the
-- hashed-token schema so future code references succeed.
--
-- If you ran an older version of this script that created the table with a
-- plaintext `token` column, the migration block below will:
--   1. Add a `tokenHash` column (if it doesn't already exist)
--   2. Backfill: SHA-256 each existing token into tokenHash
--   3. Enforce NOT NULL + UNIQUE on tokenHash
--   4. Drop the old `token` column + its index
--
-- The block is fully idempotent and works for all three starting states:
--   (a) Table doesn't exist
--   (b) Table exists, has only `token` column (old schema)
--   (c) Table exists, has only `tokenHash` column (new schema)
--   (d) Table exists, has both (transient state mid-migration)

CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "tokenHash" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt"    TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- Add FK to User if missing. IF NOT EXISTS on a constraint is supported in
-- Postgres 9.6+ via DO block since there's no native syntax.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'password_reset_tokens_userId_fkey'
  ) THEN
    ALTER TABLE "password_reset_tokens"
      ADD CONSTRAINT "password_reset_tokens_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

-- Bring the table to the target schema regardless of starting state.
DO $$
DECLARE
  has_token_col    BOOLEAN;
  has_tokenhash_col BOOLEAN;
  tokenhash_nullable BOOLEAN;
BEGIN
  -- 1. Add tokenHash column if it doesn't exist (case: legacy schema)
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'password_reset_tokens' AND column_name = 'tokenHash'
  ) INTO has_tokenhash_col;

  IF NOT has_tokenhash_col THEN
    ALTER TABLE "password_reset_tokens" ADD COLUMN "tokenHash" TEXT;
    has_tokenhash_col := TRUE;
  END IF;

  -- 2. If old `token` column exists, backfill to tokenHash
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'password_reset_tokens' AND column_name = 'token'
  ) INTO has_token_col;

  IF has_token_col THEN
    -- sha256() is built into Postgres (no extension needed). Digest
    -- the token bytes and hex-encode the result. Matches the Node
    -- crypto.createHash('sha256').update(token).digest('hex') used by
    -- the auth route, since SHA-256 is platform-independent.
    UPDATE "password_reset_tokens"
    SET "tokenHash" = encode(sha256("token"::bytea), 'hex')
    WHERE "tokenHash" IS NULL;

    -- Drop plaintext + its index
    DROP INDEX IF EXISTS "password_reset_tokens_token_key";
    ALTER TABLE "password_reset_tokens" DROP COLUMN "token";
    DROP INDEX IF EXISTS "password_reset_tokens_token_idx";
  END IF;

  -- 3. Ensure tokenHash is NOT NULL
  SELECT is_nullable = 'YES'
  FROM information_schema.columns
  WHERE table_name = 'password_reset_tokens' AND column_name = 'tokenHash'
  INTO tokenhash_nullable;

  IF tokenhash_nullable THEN
    -- Any row with NULL tokenHash at this point is unrecoverable
    -- (came from a failed backfill or partial migration). Delete them
    -- so the NOT NULL constraint can be applied.
    DELETE FROM "password_reset_tokens" WHERE "tokenHash" IS NULL;
    ALTER TABLE "password_reset_tokens" ALTER COLUMN "tokenHash" SET NOT NULL;
  END IF;
END$$;

-- Unique + lookup indexes on tokenHash
CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_tokenHash_key"
  ON "password_reset_tokens"("tokenHash");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_tokenHash_idx"
  ON "password_reset_tokens"("tokenHash");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_userId_idx"
  ON "password_reset_tokens"("userId");

COMMIT;

-- =============================================================================
-- Verification queries (run separately if you want to confirm):
--
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'User' AND column_name IN ('appleId', 'isReview');
--
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'password_reset_tokens'
--   ORDER BY ordinal_position;
-- =============================================================================
