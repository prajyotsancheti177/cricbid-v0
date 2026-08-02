-- CreateTable
CREATE TABLE "whatsapp_incoming" (
    "id" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "senderName" TEXT,
    "messageId" TEXT NOT NULL,
    "messageType" TEXT NOT NULL DEFAULT 'text',
    "body" TEXT,
    "mediaUrl" TEXT,
    "tournamentId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_incoming_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_incoming_messageId_key" ON "whatsapp_incoming"("messageId");

-- CreateIndex
CREATE INDEX "whatsapp_incoming_from_receivedAt_idx" ON "whatsapp_incoming"("from", "receivedAt");

-- CreateIndex
CREATE INDEX "whatsapp_incoming_receivedAt_idx" ON "whatsapp_incoming"("receivedAt" DESC);

-- CreateIndex
CREATE INDEX "whatsapp_incoming_isRead_idx" ON "whatsapp_incoming"("isRead");
