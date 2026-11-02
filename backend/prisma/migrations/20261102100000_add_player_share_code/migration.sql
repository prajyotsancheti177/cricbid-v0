-- AlterTable
ALTER TABLE "player" ADD COLUMN     "shareCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "player_shareCode_key" ON "player"("shareCode");
