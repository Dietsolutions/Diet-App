-- Hash password-reset tokens at rest.
--
-- Old schema: `token` column held the plaintext random token sent in the
-- email URL. A DB read leak therefore granted the attacker a working
-- password-reset link. We rename the column to `tokenHash` and store the
-- SHA-256 hex of the token instead. The plaintext token only ever exists
-- in the user's email inbox.

-- 1. Add the new column (nullable for the backfill step).
ALTER TABLE "password_reset_tokens" ADD COLUMN "tokenHash" TEXT;

-- 2. Backfill: any pre-existing rows have their plaintext token hashed.
--    SHA-256 hex is 64 chars; if `token` happens to be exactly 64 hex
--    chars, this still produces a correct hash value.
UPDATE "password_reset_tokens" SET "tokenHash" = encode(sha256("token"::bytea), 'hex');

-- 3. Enforce NOT NULL + UNIQUE on the new column.
ALTER TABLE "password_reset_tokens" ALTER COLUMN "tokenHash" SET NOT NULL;
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");

-- 4. Drop the plaintext column and its index.
DROP INDEX IF EXISTS "password_reset_tokens_token_key";
ALTER TABLE "password_reset_tokens" DROP COLUMN "token";

-- 5. Refresh the lookup index name to match the new column.
DROP INDEX IF EXISTS "password_reset_tokens_token_idx";
CREATE INDEX "password_reset_tokens_tokenHash_idx" ON "password_reset_tokens"("tokenHash");
