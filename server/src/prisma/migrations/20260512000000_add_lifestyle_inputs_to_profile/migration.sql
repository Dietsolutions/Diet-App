-- AddColumn lifestyle inputs to UserProfile

ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "trainingType"          TEXT DEFAULT 'none';
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "trainingDaysPerWeek"   INTEGER DEFAULT 3;
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "trainingDurationMins"  INTEGER DEFAULT 45;
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "cardioSessionsPerWeek" INTEGER DEFAULT 0;
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "dailySteps"            INTEGER DEFAULT 5000;
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "occupationType"        TEXT DEFAULT 'desk_job';
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "insulinSensitivity"    TEXT DEFAULT 'average';
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "sleepQuality"          TEXT DEFAULT 'average';
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "stressLevel"           TEXT DEFAULT 'medium';
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "recoveryCapacity"      TEXT DEFAULT 'average';
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "hungerLevel"           TEXT DEFAULT 'medium';
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "energyLevel"           TEXT DEFAULT 'moderate';
