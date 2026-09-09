-- CricHeroes enrichment.
--
-- Two tables, deliberately separate:
--   cricheroes_link — the match between one CricBid player and a CricHeroes
--     profile. Matching is fuzzy and frequently ambiguous (two "Naman Kasliwal"
--     accounts exist in Aurangabad alone), so a link carries a status and the
--     rejected candidates, and is only auto-created when unambiguous.
--   cricheroes_stat — the fetched stats, keyed by the CricHeroes player id so
--     one profile is stored once even when the same person registers for
--     several tournaments.

CREATE TABLE "cricheroes_link" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    -- linked | ambiguous | not_found | error
    "status" TEXT NOT NULL,
    "cricheroesPlayerId" INTEGER,
    "matchedName" TEXT,
    "matchedCity" TEXT,
    -- 0..1, how confident the automatic match was
    "confidence" DOUBLE PRECISION,
    -- ranked runners-up, so a host can resolve an ambiguous row without a re-search
    "candidates" JSONB,
    -- set when a human confirmed or cleared the link; the job never overwrites these
    "confirmedByUserId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "lastSearchedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cricheroes_link_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cricheroes_link_playerId_key" ON "cricheroes_link"("playerId");
CREATE INDEX "cricheroes_link_tournamentId_status_idx" ON "cricheroes_link"("tournamentId", "status");
CREATE INDEX "cricheroes_link_cricheroesPlayerId_idx" ON "cricheroes_link"("cricheroesPlayerId");

ALTER TABLE "cricheroes_link" ADD CONSTRAINT "cricheroes_link_playerId_fkey"
    FOREIGN KEY ("playerId") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cricheroes_link" ADD CONSTRAINT "cricheroes_link_tournamentId_fkey"
    FOREIGN KEY ("tournamentId") REFERENCES "tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "cricheroes_stat" (
    "cricheroesPlayerId" INTEGER NOT NULL,
    "name" TEXT,
    "profilePhoto" TEXT,
    "cityName" TEXT,
    "battingHand" TEXT,
    "bowlingStyle" TEXT,
    "playingRole" TEXT,
    "batterCategory" TEXT,
    "bowlerCategory" TEXT,
    "isPro" BOOLEAN NOT NULL DEFAULT false,
    "dob" TEXT,
    "totalMatches" INTEGER,
    "totalRuns" INTEGER,
    "totalWickets" INTEGER,
    -- flattened headline numbers, so the auction card needs no JSON digging
    "battingAverage" DOUBLE PRECISION,
    "battingStrikeRate" DOUBLE PRECISION,
    "highestScore" TEXT,
    "bowlingEconomy" DOUBLE PRECISION,
    "bestBowling" TEXT,
    "catches" INTEGER,
    -- the API's own {title,value} arrays, kept whole so nothing is lost
    "batting" JSONB,
    "bowling" JSONB,
    "fielding" JSONB,
    "captain" JSONB,
    "profileRaw" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cricheroes_stat_pkey" PRIMARY KEY ("cricheroesPlayerId")
);

CREATE INDEX "cricheroes_stat_fetchedAt_idx" ON "cricheroes_stat"("fetchedAt");
