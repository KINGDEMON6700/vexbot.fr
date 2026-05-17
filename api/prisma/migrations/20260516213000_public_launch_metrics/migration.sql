-- CreateTable
CREATE TABLE "PanelUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "discordUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "globalName" TEXT,
    "avatar" TEXT,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "loginCount" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "PanelLoginEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelUserId" TEXT NOT NULL,
    "discordUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PanelLoginEvent_panelUserId_fkey" FOREIGN KEY ("panelUserId") REFERENCES "PanelUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BotInviteEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "discordGuildId" TEXT,
    "userAgent" TEXT,
    "ipHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ProductEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "source" TEXT,
    "path" TEXT,
    "referrer" TEXT,
    "discordUserId" TEXT,
    "discordGuildId" TEXT,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DailyMetricSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "day" DATETIME NOT NULL,
    "metrics" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "PanelUser_discordUserId_key" ON "PanelUser"("discordUserId");

-- CreateIndex
CREATE INDEX "PanelUser_lastLoginAt_idx" ON "PanelUser"("lastLoginAt");

-- CreateIndex
CREATE INDEX "PanelLoginEvent_discordUserId_idx" ON "PanelLoginEvent"("discordUserId");

-- CreateIndex
CREATE INDEX "PanelLoginEvent_createdAt_idx" ON "PanelLoginEvent"("createdAt");

-- CreateIndex
CREATE INDEX "BotInviteEvent_source_idx" ON "BotInviteEvent"("source");

-- CreateIndex
CREATE INDEX "BotInviteEvent_discordGuildId_idx" ON "BotInviteEvent"("discordGuildId");

-- CreateIndex
CREATE INDEX "BotInviteEvent_createdAt_idx" ON "BotInviteEvent"("createdAt");

-- CreateIndex
CREATE INDEX "ProductEvent_type_idx" ON "ProductEvent"("type");

-- CreateIndex
CREATE INDEX "ProductEvent_createdAt_idx" ON "ProductEvent"("createdAt");

-- CreateIndex
CREATE INDEX "ProductEvent_discordUserId_idx" ON "ProductEvent"("discordUserId");

-- CreateIndex
CREATE INDEX "ProductEvent_discordGuildId_idx" ON "ProductEvent"("discordGuildId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyMetricSnapshot_day_key" ON "DailyMetricSnapshot"("day");

