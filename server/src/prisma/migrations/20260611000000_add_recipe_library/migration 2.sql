-- add_recipe_library
-- Browse Recipes feature: canonical deduplicated recipe store extracted from
-- all users' MealPlanDay.meals blobs, plus per-user likes.

CREATE TABLE IF NOT EXISTS "recipes" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "mealType"    TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "ingredients" TEXT NOT NULL DEFAULT '[]',
    "time"        TEXT,
    "calories"    DOUBLE PRECISION NOT NULL,
    "protein"     DOUBLE PRECISION NOT NULL,
    "carbs"       DOUBLE PRECISION NOT NULL,
    "fat"         DOUBLE PRECISION NOT NULL,
    "fibre"       DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cuisineType" TEXT NOT NULL DEFAULT 'Indian',
    "dietType"    TEXT NOT NULL DEFAULT 'veg',
    "prepTime"    TEXT,
    "sourceCount" INTEGER NOT NULL DEFAULT 1,
    "likeCount"   INTEGER NOT NULL DEFAULT 0,
    "dedupeKey"   TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "recipes_dedupeKey_key" ON "recipes"("dedupeKey");
CREATE INDEX IF NOT EXISTS "recipes_mealType_idx"    ON "recipes"("mealType");
CREATE INDEX IF NOT EXISTS "recipes_dietType_idx"    ON "recipes"("dietType");
CREATE INDEX IF NOT EXISTS "recipes_calories_idx"    ON "recipes"("calories");
CREATE INDEX IF NOT EXISTS "recipes_protein_idx"     ON "recipes"("protein");
CREATE INDEX IF NOT EXISTS "recipes_fibre_idx"       ON "recipes"("fibre");
CREATE INDEX IF NOT EXISTS "recipes_likeCount_idx"   ON "recipes"("likeCount");
CREATE INDEX IF NOT EXISTS "recipes_sourceCount_idx" ON "recipes"("sourceCount");
CREATE INDEX IF NOT EXISTS "recipes_createdAt_idx"   ON "recipes"("createdAt");

CREATE TABLE IF NOT EXISTS "recipe_likes" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "recipeId"  TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_likes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "recipe_likes_userId_recipeId_key" ON "recipe_likes"("userId", "recipeId");
CREATE INDEX IF NOT EXISTS "recipe_likes_recipeId_idx" ON "recipe_likes"("recipeId");

ALTER TABLE "recipe_likes"
  ADD CONSTRAINT "recipe_likes_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recipe_likes"
  ADD CONSTRAINT "recipe_likes_recipeId_fkey"
  FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
