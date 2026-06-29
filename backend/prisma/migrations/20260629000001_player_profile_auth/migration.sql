-- AlterTable: add password and sessionToken to player_profile
ALTER TABLE "player_profile" ADD COLUMN "password" TEXT;
ALTER TABLE "player_profile" ADD COLUMN "sessionToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "player_profile_sessionToken_key" ON "player_profile"("sessionToken");
