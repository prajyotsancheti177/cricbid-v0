-- Requests typed into the Assistant page, with the plan and the outcome.
CREATE TABLE "agent_request" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT,
    "requestText" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'unknown',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "plan" JSONB,
    "result" JSONB,
    "error" TEXT,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_request_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "agent_request_status_createdAt_idx" ON "agent_request"("status", "createdAt");
