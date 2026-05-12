-- extend_validation_log_fields
-- Adds new fields to macro_validation_logs to capture the full
-- per-meal deviation/scaling/attempt-budget pipeline introduced in the CN rebuild.

ALTER TABLE "macro_validation_logs"
  ADD COLUMN IF NOT EXISTS "deviationPct"             DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "deviationAction"           TEXT,
  ADD COLUMN IF NOT EXISTS "partialMatchGuard"         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "scalingApplied"            BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "scaleFactor"               DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "postScaleCnCalories"       DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "postScaleDeviation"        DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "scalingResolved"           BOOLEAN,
  ADD COLUMN IF NOT EXISTS "mealTargetCheckPassed"     BOOLEAN,
  ADD COLUMN IF NOT EXISTS "mealTargetDeviationPct"    DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "attemptsUsedAtThisMeal"    INTEGER,
  ADD COLUMN IF NOT EXISTS "wasDayLevelReplacement"    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "dayTotalBeforeReplacement" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "dayTotalAfterReplacement"  DOUBLE PRECISION;
