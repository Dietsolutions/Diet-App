-- Add isReview flag to User for the Play/App Store reviewer demo account.
-- Default false; set to true on the auto-created review account in production.
ALTER TABLE "User" ADD COLUMN "isReview" BOOLEAN NOT NULL DEFAULT false;
