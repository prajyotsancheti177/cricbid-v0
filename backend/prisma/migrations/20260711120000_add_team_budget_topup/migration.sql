-- CreateTable
CREATE TABLE "team_budget_topup" (
    "id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "teamId" TEXT NOT NULL,
    "touranmentId" TEXT NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_budget_topup_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "team_budget_topup" ADD CONSTRAINT "team_budget_topup_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_budget_topup" ADD CONSTRAINT "team_budget_topup_touranmentId_fkey" FOREIGN KEY ("touranmentId") REFERENCES "tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_budget_topup" ADD CONSTRAINT "team_budget_topup_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
