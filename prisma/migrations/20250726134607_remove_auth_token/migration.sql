/*
  Warnings:

  - You are about to drop the column `auth_token` on the `users` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uuid" TEXT NOT NULL,
    "x_user_id" TEXT,
    "x_access_token" TEXT,
    "x_refresh_token" TEXT,
    "x_token_expires_at" DATETIME,
    "is_banned" BOOLEAN NOT NULL DEFAULT false,
    "banned_reason" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_users" ("banned_reason", "created_at", "id", "is_banned", "updated_at", "uuid", "x_access_token", "x_refresh_token", "x_token_expires_at", "x_user_id") SELECT "banned_reason", "created_at", "id", "is_banned", "updated_at", "uuid", "x_access_token", "x_refresh_token", "x_token_expires_at", "x_user_id" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_uuid_key" ON "users"("uuid");
CREATE UNIQUE INDEX "users_x_user_id_key" ON "users"("x_user_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
