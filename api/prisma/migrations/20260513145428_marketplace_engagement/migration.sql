-- CreateTable
CREATE TABLE "MarketplaceTemplateLike" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "discordUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MarketplaceTemplateComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "discordUserId" TEXT NOT NULL,
    "authorGlobalName" TEXT,
    "authorUsername" TEXT NOT NULL,
    "authorAvatar" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "MarketplaceTemplateLike_templateId_idx" ON "MarketplaceTemplateLike"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceTemplateLike_templateId_discordUserId_key" ON "MarketplaceTemplateLike"("templateId", "discordUserId");

-- CreateIndex
CREATE INDEX "MarketplaceTemplateComment_templateId_idx" ON "MarketplaceTemplateComment"("templateId");
