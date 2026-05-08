-- CreateTable
CREATE TABLE "macro_validation_logs" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "mealPlanId" TEXT NOT NULL,
    "planDuration" INTEGER NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "mealIndex" INTEGER NOT NULL,
    "iteration" INTEGER NOT NULL,
    "claudeMealName" TEXT NOT NULL,
    "claudeCalories" DOUBLE PRECISION NOT NULL,
    "claudeProtein" DOUBLE PRECISION NOT NULL,
    "claudeCarbs" DOUBLE PRECISION NOT NULL,
    "claudeFat" DOUBLE PRECISION NOT NULL,
    "claudeFibre" DOUBLE PRECISION NOT NULL,
    "claudeIngredients" TEXT NOT NULL,
    "cnQueryString" TEXT NOT NULL,
    "cnApiSuccess" BOOLEAN NOT NULL,
    "cnApiStatusCode" INTEGER,
    "cnReturnedCalories" DOUBLE PRECISION,
    "cnReturnedProtein" DOUBLE PRECISION,
    "cnReturnedCarbs" DOUBLE PRECISION,
    "cnReturnedFat" DOUBLE PRECISION,
    "cnReturnedFibre" DOUBLE PRECISION,
    "cnItemsMatched" INTEGER,
    "userTargetCalories" DOUBLE PRECISION NOT NULL,
    "userTargetProtein" DOUBLE PRECISION NOT NULL,
    "userTargetCarbs" DOUBLE PRECISION NOT NULL,
    "userTargetFat" DOUBLE PRECISION NOT NULL,
    "mealTargetCalories" DOUBLE PRECISION NOT NULL,
    "mealTargetProtein" DOUBLE PRECISION NOT NULL,
    "mealTargetCarbs" DOUBLE PRECISION NOT NULL,
    "mealTargetFat" DOUBLE PRECISION NOT NULL,
    "deltaCalories" DOUBLE PRECISION,
    "deltaProtein" DOUBLE PRECISION,
    "deltaCarbs" DOUBLE PRECISION,
    "deltaFat" DOUBLE PRECISION,
    "deltaPctCalories" DOUBLE PRECISION,
    "deltaPctProtein" DOUBLE PRECISION,
    "deltaPctCarbs" DOUBLE PRECISION,
    "deltaPctFat" DOUBLE PRECISION,
    "withinTolerance" BOOLEAN NOT NULL,
    "dayTotalCnCalories" DOUBLE PRECISION,
    "dayTotalCnProtein" DOUBLE PRECISION,
    "dayTotalCnCarbs" DOUBLE PRECISION,
    "dayTotalCnFat" DOUBLE PRECISION,
    "dayDeltaCalories" DOUBLE PRECISION,
    "dayDeltaPctCalories" DOUBLE PRECISION,
    "dayValidationPassed" BOOLEAN,
    "correctionTriggered" BOOLEAN NOT NULL DEFAULT false,
    "correctionTargetMeal" TEXT,
    "correctionReason" TEXT,
    "correctionGapKcal" DOUBLE PRECISION,
    "correctedMealName" TEXT,
    "correctedCalories" DOUBLE PRECISION,
    "correctedProtein" DOUBLE PRECISION,
    "correctedCarbs" DOUBLE PRECISION,
    "correctedFat" DOUBLE PRECISION,
    "correctedFibre" DOUBLE PRECISION,
    "recheckCalories" DOUBLE PRECISION,
    "recheckProtein" DOUBLE PRECISION,
    "recheckCarbs" DOUBLE PRECISION,
    "recheckFat" DOUBLE PRECISION,
    "recheckWithinTolerance" BOOLEAN,
    "finalOutcome" TEXT NOT NULL,
    "finalCalories" DOUBLE PRECISION NOT NULL,
    "finalProtein" DOUBLE PRECISION NOT NULL,
    "finalCarbs" DOUBLE PRECISION NOT NULL,
    "finalFat" DOUBLE PRECISION NOT NULL,
    "finalFibre" DOUBLE PRECISION NOT NULL,
    "accuracyDeltaKcal" DOUBLE PRECISION,
    "accuracyDeltaPct" DOUBLE PRECISION,

    CONSTRAINT "macro_validation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "macro_validation_logs_userId_mealPlanId_idx" ON "macro_validation_logs"("userId", "mealPlanId");

-- CreateIndex
CREATE INDEX "macro_validation_logs_mealPlanId_dayIndex_mealIndex_idx" ON "macro_validation_logs"("mealPlanId", "dayIndex", "mealIndex");

-- CreateIndex
CREATE INDEX "macro_validation_logs_createdAt_idx" ON "macro_validation_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "macro_validation_logs" ADD CONSTRAINT "macro_validation_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
