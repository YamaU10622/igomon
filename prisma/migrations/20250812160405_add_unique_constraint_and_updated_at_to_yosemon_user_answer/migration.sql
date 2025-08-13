/*
  Warnings:

  - You are about to alter the column `point` on the `yosemon_answers` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Float`.
  - Added the required column `updated_at` to the `yosemon_user_answers` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_yosemon_answers" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "problem_id" INTEGER NOT NULL,
    "coordinate" TEXT NOT NULL,
    "point" REAL NOT NULL,
    "order_index" INTEGER NOT NULL,
    CONSTRAINT "yosemon_answers_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "yosemon_problems" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_yosemon_answers" ("coordinate", "id", "order_index", "point", "problem_id") SELECT "coordinate", "id", "order_index", "point", "problem_id" FROM "yosemon_answers";
DROP TABLE "yosemon_answers";
ALTER TABLE "new_yosemon_answers" RENAME TO "yosemon_answers";
CREATE INDEX "yosemon_answers_problem_id_idx" ON "yosemon_answers"("problem_id");
CREATE UNIQUE INDEX "yosemon_answers_problem_id_order_index_key" ON "yosemon_answers"("problem_id", "order_index");
CREATE TABLE "new_yosemon_user_answers" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "problem_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "user_answer" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "yosemon_user_answers_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "yosemon_problems" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "yosemon_user_answers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_yosemon_user_answers" ("created_at", "id", "is_correct", "problem_id", "user_answer", "user_id") SELECT "created_at", "id", "is_correct", "problem_id", "user_answer", "user_id" FROM "yosemon_user_answers";
DROP TABLE "yosemon_user_answers";
ALTER TABLE "new_yosemon_user_answers" RENAME TO "yosemon_user_answers";
CREATE INDEX "yosemon_user_answers_problem_id_idx" ON "yosemon_user_answers"("problem_id");
CREATE INDEX "yosemon_user_answers_user_id_idx" ON "yosemon_user_answers"("user_id");
CREATE UNIQUE INDEX "yosemon_user_answers_problem_id_user_id_key" ON "yosemon_user_answers"("problem_id", "user_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
