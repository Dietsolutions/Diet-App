-- TDEE calculation audit log: one row per calculation, full input snapshot +
-- step-by-step derivation. Idempotent (IF NOT EXISTS) so it is safe to apply
-- against a database whose Prisma migration history is not fully in sync.

CREATE TABLE IF NOT EXISTS "tdee_calculation_logs" (
  "id"                  TEXT NOT NULL,
  "userId"              TEXT NOT NULL,
  "mealPlanId"          TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  "age"                 INTEGER,
  "sex"                 TEXT,
  "heightCm"            DOUBLE PRECISION,
  "weightKg"            DOUBLE PRECISION,
  "bodyFatPct"          DOUBLE PRECISION,
  "activityLevel"       TEXT,
  "trainingType"        TEXT,
  "trainingDaysPerWeek" INTEGER,
  "dailySteps"          INTEGER,
  "occupationType"      TEXT,
  "insulinSensitivity"  TEXT,
  "goal"                TEXT,
  "dietIntensity"       TEXT,

  "bmrFormula"          TEXT,
  "bmrValue"            DOUBLE PRECISION,
  "activityMultiplier"  DOUBLE PRECISION,
  "tdeeBeforeAdjust"    DOUBLE PRECISION,
  "neatAdjustment"      DOUBLE PRECISION,
  "goalAdjustment"      DOUBLE PRECISION,
  "tdeeAfterAdjust"     DOUBLE PRECISION,
  "safetyFloorApplied"  BOOLEAN NOT NULL DEFAULT false,
  "safetyFloorType"     TEXT,

  "finalCalories"       DOUBLE PRECISION,
  "finalProteinG"       DOUBLE PRECISION,
  "finalCarbsG"         DOUBLE PRECISION,
  "finalFatG"           DOUBLE PRECISION,
  "finalFibreG"         DOUBLE PRECISION,

  "proteinBasis"        TEXT,
  "fatBasis"            TEXT,
  "carbsBasis"          TEXT,

  "breakdownJson"       TEXT,

  CONSTRAINT "tdee_calculation_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tdee_calculation_logs_userId_createdAt_idx"
  ON "tdee_calculation_logs" ("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "tdee_calculation_logs_mealPlanId_idx"
  ON "tdee_calculation_logs" ("mealPlanId");
