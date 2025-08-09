-- CreateTable
CREATE TABLE "yosemon_problems" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "problem_number" INTEGER NOT NULL,
    "moves" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "yosemon_answers" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "problem_id" INTEGER NOT NULL,
    "coordinate" TEXT NOT NULL,
    "point" INTEGER NOT NULL,
    "order_index" INTEGER NOT NULL,
    CONSTRAINT "yosemon_answers_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "yosemon_problems" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "yosemon_user_answers" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "problem_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "user_answer" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "yosemon_user_answers_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "yosemon_problems" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "yosemon_user_answers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "yosemon_problems_problem_number_key" ON "yosemon_problems"("problem_number");

-- CreateIndex
CREATE INDEX "yosemon_answers_problem_id_idx" ON "yosemon_answers"("problem_id");

-- CreateIndex
CREATE UNIQUE INDEX "yosemon_answers_problem_id_order_index_key" ON "yosemon_answers"("problem_id", "order_index");

-- CreateIndex
CREATE INDEX "yosemon_user_answers_problem_id_idx" ON "yosemon_user_answers"("problem_id");

-- CreateIndex
CREATE INDEX "yosemon_user_answers_user_id_idx" ON "yosemon_user_answers"("user_id");

-- CreateIndex
CREATE INDEX "yosemon_user_answers_problem_id_user_id_idx" ON "yosemon_user_answers"("problem_id", "user_id");
