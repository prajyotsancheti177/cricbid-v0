-- Field-level history of player edits so any action can be undone. Rows made
-- by one action share a batchId.
CREATE TABLE "player_change" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "playerName" TEXT,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "batchId" TEXT NOT NULL,
    "batchLabel" TEXT NOT NULL,
    "actorUserId" TEXT,
    "undoOfBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "player_change_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "player_change_tournamentId_createdAt_idx" ON "player_change"("tournamentId", "createdAt");
CREATE INDEX "player_change_batchId_idx" ON "player_change"("batchId");

ALTER TABLE "player_change" ADD CONSTRAINT "player_change_tournamentId_fkey"
    FOREIGN KEY ("tournamentId") REFERENCES "tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
