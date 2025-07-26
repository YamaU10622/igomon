-- AlterTable
ALTER TABLE "users" ADD COLUMN "x_user_id" TEXT;
ALTER TABLE "users" ADD COLUMN "x_access_token" TEXT;
ALTER TABLE "users" ADD COLUMN "x_refresh_token" TEXT;
ALTER TABLE "users" ADD COLUMN "x_token_expires_at" DATETIME;

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "rank" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_x_user_id_key" ON "users"("x_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "user_profiles"("user_id");

-- AddForeignKey
-- SQLiteでは外部キー制約はテーブル作成時に定義済みのため、この行は不要