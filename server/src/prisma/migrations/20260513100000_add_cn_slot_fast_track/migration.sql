-- add_cn_slot_fast_track
-- Adds cnSlotFailCountAtSkip to macro_validation_logs to capture the
-- plan-level slot failure count that triggered the fast-track decision.

ALTER TABLE "macro_validation_logs"
  ADD COLUMN IF NOT EXISTS "cnSlotFailCountAtSkip" INTEGER;
