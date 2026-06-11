-- AddIndex: MealPlanDay(mealPlanId, dayIndex) — speeds up per-plan day lookups
CREATE INDEX IF NOT EXISTS "MealPlanDay_mealPlanId_dayIndex_idx" ON "MealPlanDay"("mealPlanId", "dayIndex");

-- AddIndex: GeneratedShoppingList(userId, mealPlanId) — speeds up shopping list fetch
CREATE INDEX IF NOT EXISTS "GeneratedShoppingList_userId_mealPlanId_idx" ON "GeneratedShoppingList"("userId", "mealPlanId");

-- AddIndex: GeneratedShoppingList(userId, createdAt) — speeds up latest-list lookup
CREATE INDEX IF NOT EXISTS "GeneratedShoppingList_userId_createdAt_idx" ON "GeneratedShoppingList"("userId", "createdAt");

-- AlterTable: MealPlanDay — add ON DELETE CASCADE to the mealPlan FK
-- Prisma handles cascade at the ORM level; this aligns the DB constraint.
ALTER TABLE "MealPlanDay" DROP CONSTRAINT IF EXISTS "MealPlanDay_mealPlanId_fkey";
ALTER TABLE "MealPlanDay" ADD CONSTRAINT "MealPlanDay_mealPlanId_fkey"
  FOREIGN KEY ("mealPlanId") REFERENCES "MealPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
