-- add_multi_macro_deviation_fields
-- Adds per-macro deviation percentages (cal/prot/carb/fat + triggerMacro)
-- and weighted blend scale factor components (calF/protF/carbF/blendedRaw)
-- to macro_validation_logs for full CN routing observability.

ALTER TABLE "macro_validation_logs"
  ADD COLUMN IF NOT EXISTS "calDeviationPct"    DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "protDeviationPct"   DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "carbDeviationPct"   DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "fatDeviationPct"    DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "triggerMacro"       TEXT,
  ADD COLUMN IF NOT EXISTS "calScaleFactor"     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "protScaleFactor"    DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "carbScaleFactor"    DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "blendedScaleFactor" DOUBLE PRECISION;
