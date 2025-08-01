-- CreateTable
CREATE TABLE "auth_providers" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "token_expires_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "auth_providers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "auth_providers_user_id_idx" ON "auth_providers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_providers_provider_provider_user_id_key" ON "auth_providers"("provider", "provider_user_id");

-- Migrate existing X auth data
INSERT INTO "auth_providers" ("user_id", "provider", "provider_user_id", "access_token", "refresh_token", "token_expires_at", "created_at", "updated_at")
SELECT 
    id as user_id,
    'x' as provider,
    x_user_id as provider_user_id,
    x_access_token as access_token,
    x_refresh_token as refresh_token,
    x_token_expires_at as token_expires_at,
    created_at,
    updated_at
FROM users
WHERE x_user_id IS NOT NULL;