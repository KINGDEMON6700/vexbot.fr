-- AlterTable
ALTER TABLE "PanelLoginEvent" ADD COLUMN "visitorId" TEXT;
ALTER TABLE "PanelLoginEvent" ADD COLUMN "sessionId" TEXT;

-- AlterTable
ALTER TABLE "BotInviteEvent" ADD COLUMN "visitorId" TEXT;
ALTER TABLE "BotInviteEvent" ADD COLUMN "sessionId" TEXT;

-- AlterTable
ALTER TABLE "ProductEvent" ADD COLUMN "visitorId" TEXT;
ALTER TABLE "ProductEvent" ADD COLUMN "sessionId" TEXT;

-- CreateIndex
CREATE INDEX "PanelLoginEvent_visitorId_idx" ON "PanelLoginEvent"("visitorId");

-- CreateIndex
CREATE INDEX "PanelLoginEvent_sessionId_idx" ON "PanelLoginEvent"("sessionId");

-- CreateIndex
CREATE INDEX "BotInviteEvent_visitorId_idx" ON "BotInviteEvent"("visitorId");

-- CreateIndex
CREATE INDEX "BotInviteEvent_sessionId_idx" ON "BotInviteEvent"("sessionId");

-- CreateIndex
CREATE INDEX "ProductEvent_visitorId_idx" ON "ProductEvent"("visitorId");

-- CreateIndex
CREATE INDEX "ProductEvent_sessionId_idx" ON "ProductEvent"("sessionId");
