-- CreateEnum
CREATE TYPE "WicketType" AS ENUM ('bowled', 'caught', 'lbw', 'run_out', 'stumped', 'hit_wicket', 'handled_ball', 'obstructing_field', 'timed_out', 'retired_hurt');

-- CreateEnum
CREATE TYPE "ExtraType" AS ENUM ('wide', 'no_ball', 'bye', 'leg_bye', 'penalty');

-- CreateTable
CREATE TABLE "ball_event" (
    "id" TEXT NOT NULL,
    "inningsId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "inningsNumber" INTEGER NOT NULL,
    "overNumber" INTEGER NOT NULL,
    "ballInOver" INTEGER NOT NULL,
    "isLegalDelivery" BOOLEAN NOT NULL DEFAULT true,
    "batsmanId" TEXT NOT NULL,
    "nonStrikerId" TEXT,
    "bowlerId" TEXT NOT NULL,
    "batRuns" INTEGER NOT NULL DEFAULT 0,
    "isExtra" BOOLEAN NOT NULL DEFAULT false,
    "extraType" "ExtraType",
    "extraRuns" INTEGER NOT NULL DEFAULT 0,
    "totalRuns" INTEGER NOT NULL DEFAULT 0,
    "isWicket" BOOLEAN NOT NULL DEFAULT false,
    "wicketType" "WicketType",
    "outBatsmanId" TEXT,
    "fielderId" TEXT,
    "commentary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ball_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batsman_innings" (
    "id" TEXT NOT NULL,
    "inningsId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "inningsNumber" INTEGER NOT NULL,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "battingOrder" INTEGER NOT NULL,
    "runs" INTEGER NOT NULL DEFAULT 0,
    "ballsFaced" INTEGER NOT NULL DEFAULT 0,
    "fours" INTEGER NOT NULL DEFAULT 0,
    "sixes" INTEGER NOT NULL DEFAULT 0,
    "isOut" BOOLEAN NOT NULL DEFAULT false,
    "howOut" TEXT,
    "wicketType" "WicketType",
    "bowlerId" TEXT,
    "fielderId" TEXT,
    "didNotBat" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batsman_innings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bowler_innings" (
    "id" TEXT NOT NULL,
    "inningsId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "inningsNumber" INTEGER NOT NULL,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "balls" INTEGER NOT NULL DEFAULT 0,
    "runs" INTEGER NOT NULL DEFAULT 0,
    "wickets" INTEGER NOT NULL DEFAULT 0,
    "maidens" INTEGER NOT NULL DEFAULT 0,
    "wides" INTEGER NOT NULL DEFAULT 0,
    "noBalls" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bowler_innings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partnership" (
    "id" TEXT NOT NULL,
    "inningsId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "wicketNumber" INTEGER NOT NULL,
    "batsman1Id" TEXT NOT NULL,
    "batsman2Id" TEXT NOT NULL,
    "runs" INTEGER NOT NULL DEFAULT 0,
    "balls" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partnership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fall_of_wicket" (
    "id" TEXT NOT NULL,
    "inningsId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "wicketNumber" INTEGER NOT NULL,
    "playerId" TEXT NOT NULL,
    "runs" INTEGER NOT NULL,
    "balls" INTEGER NOT NULL,
    "overNumber" INTEGER NOT NULL,
    "ballInOver" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fall_of_wicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ball_event_inningsId_overNumber_ballInOver_idx" ON "ball_event"("inningsId", "overNumber", "ballInOver");

-- CreateIndex
CREATE INDEX "ball_event_matchId_inningsNumber_idx" ON "ball_event"("matchId", "inningsNumber");

-- CreateIndex
CREATE INDEX "batsman_innings_matchId_inningsNumber_idx" ON "batsman_innings"("matchId", "inningsNumber");

-- CreateIndex
CREATE UNIQUE INDEX "batsman_innings_inningsId_playerId_key" ON "batsman_innings"("inningsId", "playerId");

-- CreateIndex
CREATE INDEX "bowler_innings_matchId_inningsNumber_idx" ON "bowler_innings"("matchId", "inningsNumber");

-- CreateIndex
CREATE UNIQUE INDEX "bowler_innings_inningsId_playerId_key" ON "bowler_innings"("inningsId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "partnership_inningsId_wicketNumber_key" ON "partnership"("inningsId", "wicketNumber");

-- CreateIndex
CREATE UNIQUE INDEX "fall_of_wicket_inningsId_wicketNumber_key" ON "fall_of_wicket"("inningsId", "wicketNumber");

-- AddForeignKey
ALTER TABLE "ball_event" ADD CONSTRAINT "ball_event_inningsId_fkey" FOREIGN KEY ("inningsId") REFERENCES "innings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batsman_innings" ADD CONSTRAINT "batsman_innings_inningsId_fkey" FOREIGN KEY ("inningsId") REFERENCES "innings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bowler_innings" ADD CONSTRAINT "bowler_innings_inningsId_fkey" FOREIGN KEY ("inningsId") REFERENCES "innings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partnership" ADD CONSTRAINT "partnership_inningsId_fkey" FOREIGN KEY ("inningsId") REFERENCES "innings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fall_of_wicket" ADD CONSTRAINT "fall_of_wicket_inningsId_fkey" FOREIGN KEY ("inningsId") REFERENCES "innings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
