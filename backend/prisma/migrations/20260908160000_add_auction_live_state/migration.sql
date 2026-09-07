-- Mirror of the in-memory auction state, so a restart or crash does not lose
-- the lot currently on the block. One row per tournament; removed when the
-- auction ends.
CREATE TABLE "auction_live_state" (
    "tournamentId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "auction_live_state_pkey" PRIMARY KEY ("tournamentId")
);

ALTER TABLE "auction_live_state" ADD CONSTRAINT "auction_live_state_tournamentId_fkey"
    FOREIGN KEY ("tournamentId") REFERENCES "tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
