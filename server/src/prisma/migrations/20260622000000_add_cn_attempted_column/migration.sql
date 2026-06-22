-- macro_validation_logs.cnAttempted — present in the Prisma model
-- (Boolean @default(false)) but missing from production, because the table
-- predated the field and earlier migrations used CREATE TABLE IF NOT EXISTS
-- (which does not add columns to an existing table). The missing column made
-- every logMealValidation insert throw "column cnAttempted does not exist",
-- and the logger's try/catch swallowed it — so ~all validation log writes were
-- silently lost. Idempotent ADD COLUMN IF NOT EXISTS so it is safe to re-apply.
ALTER TABLE "macro_validation_logs"
  ADD COLUMN IF NOT EXISTS "cnAttempted" BOOLEAN NOT NULL DEFAULT false;
