-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('upcoming', 'live', 'completed', 'cancelled', 'no_result');

-- CreateEnum
CREATE TYPE "MatchFormat" AS ENUM ('T20', 'ODI', 'T10', 'custom');

-- CreateTable
CREATE TABLE "match" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "matchNumber" INTEGER,
    "round" TEXT,
    "venue" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "format" "MatchFormat" NOT NULL DEFAULT 'T20',
    "totalOvers" INTEGER NOT NULL DEFAULT 20,
    "teamAId" TEXT NOT NULL,
    "teamBId" TEXT NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'upcoming',
    "tossWonById" TEXT,
    "tossDecision" TEXT,
    "winnerId" TEXT,
    "resultNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "innings" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "inningsNumber" INTEGER NOT NULL,
    "battingTeamId" TEXT NOT NULL,
    "runs" INTEGER NOT NULL DEFAULT 0,
    "wickets" INTEGER NOT NULL DEFAULT 0,
    "oversBowled" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "extras" INTEGER NOT NULL DEFAULT 0,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "innings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "match_tournamentId_scheduledAt_idx" ON "match"("tournamentId", "scheduledAt");

-- CreateIndex
CREATE INDEX "match_tournamentId_status_idx" ON "match"("tournamentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "innings_matchId_inningsNumber_key" ON "innings"("matchId", "inningsNumber");

-- AddForeignKey
ALTER TABLE "match" ADD CONSTRAINT "match_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match" ADD CONSTRAINT "match_teamAId_fkey" FOREIGN KEY ("teamAId") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match" ADD CONSTRAINT "match_teamBId_fkey" FOREIGN KEY ("teamBId") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "innings" ADD CONSTRAINT "innings_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "innings" ADD CONSTRAINT "innings_battingTeamId_fkey" FOREIGN KEY ("battingTeamId") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
