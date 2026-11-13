-- CreateTable
CREATE TABLE "team_planner" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "touranmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_planner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planner_pick" (
    "id" TEXT NOT NULL,
    "plannerId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "plannedAmount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planner_pick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "team_planner_token_key" ON "team_planner"("token");

-- CreateIndex
CREATE UNIQUE INDEX "team_planner_teamId_key" ON "team_planner"("teamId");

-- CreateIndex
CREATE INDEX "planner_pick_plannerId_category_rank_idx" ON "planner_pick"("plannerId", "category", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "planner_pick_plannerId_playerId_key" ON "planner_pick"("plannerId", "playerId");

-- AddForeignKey
ALTER TABLE "team_planner" ADD CONSTRAINT "team_planner_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_planner" ADD CONSTRAINT "team_planner_touranmentId_fkey" FOREIGN KEY ("touranmentId") REFERENCES "tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planner_pick" ADD CONSTRAINT "planner_pick_plannerId_fkey" FOREIGN KEY ("plannerId") REFERENCES "team_planner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planner_pick" ADD CONSTRAINT "planner_pick_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

