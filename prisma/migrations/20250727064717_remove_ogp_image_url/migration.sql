/*
  Warnings:

  - You are about to drop the column `ogp_image_url` on the `problems` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_problems" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sgf_file_path" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "turn" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deadline" DATETIME
);
INSERT INTO "new_problems" ("created_at", "deadline", "description", "id", "sgf_file_path", "turn", "updated_at") SELECT "created_at", "deadline", "description", "id", "sgf_file_path", "turn", "updated_at" FROM "problems";
DROP TABLE "problems";
ALTER TABLE "new_problems" RENAME TO "problems";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
