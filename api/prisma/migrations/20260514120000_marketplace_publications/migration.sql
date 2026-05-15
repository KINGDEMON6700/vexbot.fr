-- CreateTable
CREATE TABLE "MarketplacePublication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "discordUserId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "authorGlobalName" TEXT,
    "authorUsername" TEXT NOT NULL,
    "authorAvatar" TEXT,
    "messagesJson" JSONB,
    "serverGuildId" TEXT,
    "serverGuildName" TEXT,
    "sourceEmbedTemplateId" TEXT,
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "MarketplacePublication_discordUserId_idx" ON "MarketplacePublication"("discordUserId");

-- CreateIndex
CREATE INDEX "MarketplacePublication_createdAt_idx" ON "MarketplacePublication"("createdAt");
