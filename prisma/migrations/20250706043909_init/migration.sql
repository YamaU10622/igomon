-- CreateTable
CREATE TABLE "problems" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sgf_file_path" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "turn" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "answers" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "problem_id" INTEGER NOT NULL,
    "user_uuid" TEXT NOT NULL,
    "coordinate" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "player_name" TEXT NOT NULL,
    "player_rank" TEXT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "answers_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problems" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "answers_problem_id_idx" ON "answers"("problem_id");

-- CreateIndex
CREATE INDEX "answers_user_uuid_idx" ON "answers"("user_uuid");

-- CreateIndex
CREATE INDEX "answers_coordinate_idx" ON "answers"("coordinate");

-- CreateIndex
CREATE INDEX "answers_is_deleted_idx" ON "answers"("is_deleted");
