-- AlterTable
ALTER TABLE "user_event" ADD COLUMN     "visitorId" TEXT,
ADD COLUMN     "referrer" TEXT,
ADD COLUMN     "timezone" TEXT,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "deviceType" TEXT,
ADD COLUMN     "isBot" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "user_event_visitorId_timestamp_idx" ON "user_event"("visitorId", "timestamp");

-- CreateIndex
CREATE INDEX "user_event_eventType_isBot_timestamp_idx" ON "user_event"("eventType", "isBot", "timestamp");
