-- Add appleId column for Sign in with Apple (Apple App Store requirement when using third-party login)
ALTER TABLE "User" ADD COLUMN "appleId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_appleId_key" ON "User"("appleId");
