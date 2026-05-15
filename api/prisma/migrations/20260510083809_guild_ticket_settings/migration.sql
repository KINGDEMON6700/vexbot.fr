-- CreateTable
CREATE TABLE "GuildTicketSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "panelChannelId" TEXT,
    "panelMessageId" TEXT,
    "ticketCategoryId" TEXT,
    "welcomeEmbedId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GuildTicketSettings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GuildTicketSettings_welcomeEmbedId_fkey" FOREIGN KEY ("welcomeEmbedId") REFERENCES "Embed" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "GuildTicketSettings_guildId_key" ON "GuildTicketSettings"("guildId");
