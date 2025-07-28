-- AlterTable
ALTER TABLE "users" ADD COLUMN "is_banned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "banned_reason" TEXT;