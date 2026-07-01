-- CreateEnum
CREATE TYPE "Role" AS ENUM ('boss', 'super_user', 'tournament_host');

-- CreateEnum
CREATE TYPE "AuctionMode" AS ENUM ('category', 'manual');

-- CreateEnum
CREATE TYPE "AuctionLogStatus" AS ENUM ('sold', 'unsold');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('active', 'ended', 'abandoned');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'tournament_host',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "logo" TEXT,
    "canCreateSuperUser" BOOLEAN NOT NULL DEFAULT false,
    "canCreateTournamentHost" BOOLEAN NOT NULL DEFAULT false,
    "canManageTournaments" BOOLEAN NOT NULL DEFAULT true,
    "canManageTeams" BOOLEAN NOT NULL DEFAULT true,
    "canManagePlayers" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "tournamentHostId" TEXT,
    "noOfTeams" INTEGER,
    "maxPlayersPerTeam" INTEGER,
    "minPlayersPerTeam" INTEGER,
    "totalBudget" INTEGER,
    "playerCategories" TEXT[],
    "categoryBasePrices" JSONB,
    "bidIncrementSlabs" JSONB,
    "registrationFormConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "logo" TEXT,
    "ownerName" TEXT,
    "ownerEmail" TEXT,
    "ownerMobile" TEXT,
    "touranmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "age" INTEGER,
    "gender" TEXT,
    "photo" TEXT,
    "skill" TEXT,
    "mobile" TEXT,
    "email" TEXT,
    "address" TEXT,
    "touranmentId" TEXT,
    "teamId" TEXT,
    "sold" BOOLEAN,
    "auctionStatus" BOOLEAN,
    "amtSold" INTEGER,
    "playerCategory" TEXT,
    "auctionSerialNumber" INTEGER,
    "customFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auction_log" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "playerName" TEXT,
    "playerCategory" TEXT,
    "basePrice" INTEGER NOT NULL,
    "auctionMode" "AuctionMode" NOT NULL,
    "status" "AuctionLogStatus" NOT NULL,
    "winningTeamId" TEXT,
    "winningTeamName" TEXT,
    "finalPrice" INTEGER,
    "totalBids" INTEGER NOT NULL DEFAULT 0,
    "uniqueTeamsBidding" INTEGER NOT NULL DEFAULT 0,
    "auctionStartedAt" TIMESTAMP(3),
    "auctionEndedAt" TIMESTAMP(3),
    "totalDurationSeconds" INTEGER,
    "conductedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auction_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auction_log_bid" (
    "id" TEXT NOT NULL,
    "auctionLogId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "bidAmount" INTEGER NOT NULL,
    "bidIncrement" INTEGER,
    "timestamp" TIMESTAMP(3),
    "bidOrder" INTEGER NOT NULL,

    CONSTRAINT "auction_log_bid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auction_room_session" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "tournamentName" TEXT,
    "sessionStartedAt" TIMESTAMP(3),
    "sessionEndedAt" TIMESTAMP(3),
    "sessionDurationMinutes" INTEGER,
    "hostUserId" TEXT,
    "hostUserName" TEXT,
    "uniqueViewerUserIds" TEXT[],
    "anonymousViewerIPs" TEXT[],
    "totalUniqueViewers" INTEGER NOT NULL DEFAULT 0,
    "totalJoins" INTEGER NOT NULL DEFAULT 0,
    "peakConcurrentViewers" INTEGER NOT NULL DEFAULT 0,
    "peakViewerTimestamp" TIMESTAMP(3),
    "playersAuctioned" INTEGER NOT NULL DEFAULT 0,
    "playersSold" INTEGER NOT NULL DEFAULT 0,
    "playersUnsold" INTEGER NOT NULL DEFAULT 0,
    "totalBids" INTEGER NOT NULL DEFAULT 0,
    "viewerHistory" JSONB,
    "status" "SessionStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auction_room_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_event" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "tournamentId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventData" JSONB,
    "page" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_log" (
    "id" TEXT NOT NULL,
    "messageType" TEXT NOT NULL,
    "templateName" TEXT,
    "recipientMobile" TEXT NOT NULL,
    "playerId" TEXT,
    "playerName" TEXT,
    "tournamentId" TEXT,
    "tournamentName" TEXT,
    "teamName" TEXT,
    "amtSold" INTEGER,
    "status" TEXT NOT NULL,
    "messageId" TEXT,
    "errorMessage" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ip_geo_cache" (
    "id" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT,
    "countryCode" TEXT,
    "lat" DOUBLE PRECISION,
    "lon" DOUBLE PRECISION,
    "isp" TEXT,
    "isValid" BOOLEAN NOT NULL DEFAULT true,
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ip_geo_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "auction_log_tournamentId_status_idx" ON "auction_log"("tournamentId", "status");

-- CreateIndex
CREATE INDEX "auction_log_tournamentId_playerCategory_idx" ON "auction_log"("tournamentId", "playerCategory");

-- CreateIndex
CREATE INDEX "auction_log_playerId_auctionStartedAt_idx" ON "auction_log"("playerId", "auctionStartedAt");

-- CreateIndex
CREATE INDEX "auction_log_tournamentId_auctionEndedAt_idx" ON "auction_log"("tournamentId", "auctionEndedAt");

-- CreateIndex
CREATE INDEX "auction_log_bid_auctionLogId_bidOrder_idx" ON "auction_log_bid"("auctionLogId", "bidOrder");

-- CreateIndex
CREATE INDEX "auction_room_session_tournamentId_sessionStartedAt_idx" ON "auction_room_session"("tournamentId", "sessionStartedAt");

-- CreateIndex
CREATE INDEX "auction_room_session_status_sessionStartedAt_idx" ON "auction_room_session"("status", "sessionStartedAt");

-- CreateIndex
CREATE INDEX "auction_room_session_hostUserId_sessionStartedAt_idx" ON "auction_room_session"("hostUserId", "sessionStartedAt");

-- CreateIndex
CREATE INDEX "user_event_tournamentId_eventType_timestamp_idx" ON "user_event"("tournamentId", "eventType", "timestamp");

-- CreateIndex
CREATE INDEX "user_event_userId_timestamp_idx" ON "user_event"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "user_event_sessionId_timestamp_idx" ON "user_event"("sessionId", "timestamp");

-- CreateIndex
CREATE INDEX "whatsapp_log_status_timestamp_idx" ON "whatsapp_log"("status", "timestamp");

-- CreateIndex
CREATE INDEX "whatsapp_log_messageType_timestamp_idx" ON "whatsapp_log"("messageType", "timestamp");

-- CreateIndex
CREATE INDEX "whatsapp_log_tournamentId_timestamp_idx" ON "whatsapp_log"("tournamentId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "ip_geo_cache_ipAddress_key" ON "ip_geo_cache"("ipAddress");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team" ADD CONSTRAINT "team_touranmentId_fkey" FOREIGN KEY ("touranmentId") REFERENCES "tournament"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player" ADD CONSTRAINT "player_touranmentId_fkey" FOREIGN KEY ("touranmentId") REFERENCES "tournament"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player" ADD CONSTRAINT "player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_log" ADD CONSTRAINT "auction_log_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_log" ADD CONSTRAINT "auction_log_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_log" ADD CONSTRAINT "auction_log_winningTeamId_fkey" FOREIGN KEY ("winningTeamId") REFERENCES "team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_log" ADD CONSTRAINT "auction_log_conductedById_fkey" FOREIGN KEY ("conductedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_log_bid" ADD CONSTRAINT "auction_log_bid_auctionLogId_fkey" FOREIGN KEY ("auctionLogId") REFERENCES "auction_log"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_log_bid" ADD CONSTRAINT "auction_log_bid_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_room_session" ADD CONSTRAINT "auction_room_session_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_room_session" ADD CONSTRAINT "auction_room_session_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_event" ADD CONSTRAINT "user_event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_event" ADD CONSTRAINT "user_event_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournament"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_log" ADD CONSTRAINT "whatsapp_log_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_log" ADD CONSTRAINT "whatsapp_log_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournament"("id") ON DELETE SET NULL ON UPDATE CASCADE;
