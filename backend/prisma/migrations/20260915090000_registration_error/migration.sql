-- Refused player registrations, keyed by the error id shown to the player.
CREATE TABLE "registration_error" (
    "id" TEXT NOT NULL,
    "errorId" TEXT NOT NULL,
    "tournamentId" TEXT,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'server',
    "httpStatus" INTEGER,
    "name" TEXT,
    "mobile" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registration_error_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "registration_error_errorId_key" ON "registration_error"("errorId");
CREATE INDEX "registration_error_tournamentId_createdAt_idx" ON "registration_error"("tournamentId", "createdAt");
CREATE INDEX "registration_error_code_createdAt_idx" ON "registration_error"("code", "createdAt");
