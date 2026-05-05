-- CreateTable: self-hosted Indian food databases (INDB 1014 recipes + ICMR-NIN 542 ingredients)
-- Applied via prisma db push — tables already exist in Neon

CREATE TABLE IF NOT EXISTS "indian_recipes" (
    "id" TEXT NOT NULL,
    "recipeCode" TEXT NOT NULL,
    "recipeName" TEXT NOT NULL,
    "aliases" TEXT,
    "caloriesPer100g" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "proteinPer100g" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "carbsPer100g" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fatPer100g" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fibrePer100g" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "servingGrams" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "servingName" TEXT NOT NULL DEFAULT '1 serving (100g)',
    "source" TEXT NOT NULL DEFAULT 'INDB',
    "dataSource" TEXT,
    CONSTRAINT "indian_recipes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "indian_recipes_recipeCode_key" ON "indian_recipes"("recipeCode");
CREATE INDEX IF NOT EXISTS "indian_recipes_recipeName_idx" ON "indian_recipes"("recipeName");

CREATE TABLE IF NOT EXISTS "indian_ingredients" (
    "id" TEXT NOT NULL,
    "foodCode" TEXT NOT NULL,
    "foodName" TEXT NOT NULL,
    "foodGroup" TEXT,
    "aliases" TEXT,
    "caloriesPer100g" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "proteinPer100g" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "carbsPer100g" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fatPer100g" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fibrePer100g" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'ICMR-NIN',
    CONSTRAINT "indian_ingredients_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "indian_ingredients_foodCode_key" ON "indian_ingredients"("foodCode");
CREATE INDEX IF NOT EXISTS "indian_ingredients_foodName_idx" ON "indian_ingredients"("foodName");
