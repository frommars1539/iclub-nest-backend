-- CreateTable
CREATE TABLE "login_failures" (
    "id" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_failures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "login_failures_key_hash_at_idx" ON "login_failures"("key_hash", "at");
