-- extend_validation_log_v2
-- Adds extended observability fields to macro_validation_logs:
--   initialDeviationAction, cnIngredientsSentCount, scalingSanityFailed, dayMealCount

ALTER TABLE "macro_validation_logs"
  ADD COLUMN IF NOT EXISTS "initialDeviationAction"  TEXT,
  ADD COLUMN IF NOT EXISTS "cnIngredientsSentCount"  INTEGER,
  ADD COLUMN IF NOT EXISTS "scalingSanityFailed"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "dayMealCount"            INTEGER;
