-- CreateTable
CREATE TABLE "additional_meal_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "mealCategory" TEXT NOT NULL,
    "mealTime" TEXT,
    "foodName" TEXT NOT NULL,
    "foodSource" TEXT NOT NULL,
    "foodExternalId" TEXT,
    "servingSize" TEXT NOT NULL,
    "servingQty" DOUBLE PRECISION NOT NULL,
    "servingGrams" DOUBLE PRECISION,
    "calories" DOUBLE PRECISION NOT NULL,
    "proteinG" DOUBLE PRECISION NOT NULL,
    "carbsG" DOUBLE PRECISION NOT NULL,
    "fatG" DOUBLE PRECISION NOT NULL,
    "fibreG" DOUBLE PRECISION NOT NULL,
    "note" TEXT DEFAULT '',
    "isAiEstimate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "additional_meal_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "additional_meal_logs_userId_date_idx" ON "additional_meal_logs"("userId", "date");

-- CreateIndex
CREATE INDEX "additional_meal_logs_userId_date_mealCategory_idx" ON "additional_meal_logs"("userId", "date", "mealCategory");

-- AddForeignKey
ALTER TABLE "additional_meal_logs" ADD CONSTRAINT "additional_meal_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
