-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GuildTicketSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "panelChannelId" TEXT,
    "panelMessageId" TEXT,
    "ticketCategoryId" TEXT,
    "welcomeEmbedId" TEXT,
    "panelEmbedId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GuildTicketSettings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GuildTicketSettings_welcomeEmbedId_fkey" FOREIGN KEY ("welcomeEmbedId") REFERENCES "Embed" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GuildTicketSettings_panelEmbedId_fkey" FOREIGN KEY ("panelEmbedId") REFERENCES "Embed" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_GuildTicketSettings" ("createdAt", "guildId", "id", "panelChannelId", "panelMessageId", "ticketCategoryId", "updatedAt", "welcomeEmbedId") SELECT "createdAt", "guildId", "id", "panelChannelId", "panelMessageId", "ticketCategoryId", "updatedAt", "welcomeEmbedId" FROM "GuildTicketSettings";
DROP TABLE "GuildTicketSettings";
ALTER TABLE "new_GuildTicketSettings" RENAME TO "GuildTicketSettings";
CREATE UNIQUE INDEX "GuildTicketSettings_guildId_key" ON "GuildTicketSettings"("guildId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
