-- AlterTable
ALTER TABLE "Guild" ADD COLUMN "locale" TEXT;
ALTER TABLE "Guild" ADD COLUMN "premiumUntil" DATETIME;
ALTER TABLE "Guild" ADD COLUMN "settings" JSONB;
ALTER TABLE "Guild" ADD COLUMN "timezone" TEXT;

-- CreateTable
CREATE TABLE "Embed" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "color" INTEGER,
    "url" TEXT,
    "thumbnailUrl" TEXT,
    "imageUrl" TEXT,
    "authorName" TEXT,
    "authorUrl" TEXT,
    "authorIconUrl" TEXT,
    "footerText" TEXT,
    "footerIconUrl" TEXT,
    "fields" JSONB,
    "timestampMode" TEXT NOT NULL DEFAULT 'NONE',
    "fixedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Embed_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "ticketNumber" INTEGER NOT NULL,
    "channelId" TEXT NOT NULL,
    "openerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "subject" TEXT,
    "priority" INTEGER,
    "claimedById" TEXT,
    "closedAt" DATETIME,
    "closedById" TEXT,
    "closeReason" TEXT,
    "embedId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Ticket_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Ticket_embedId_fkey" FOREIGN KEY ("embedId") REFERENCES "Embed" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TicketTranscript" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'PLAIN',
    "content" TEXT NOT NULL,
    "messageCount" INTEGER,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedById" TEXT,
    CONSTRAINT "TicketTranscript_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GuildLogSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "moderationChannelId" TEXT,
    "messageChannelId" TEXT,
    "memberChannelId" TEXT,
    "serverChannelId" TEXT,
    "voiceChannelId" TEXT,
    "inviteChannelId" TEXT,
    "roleChannelId" TEXT,
    "ignoredChannelIds" JSONB,
    "ignoreBots" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GuildLogSettings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RoleGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RoleGroup_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RoleGroupRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roleGroupId" TEXT NOT NULL,
    "discordRoleId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "config" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RoleGroupRule_roleGroupId_fkey" FOREIGN KEY ("roleGroupId") REFERENCES "RoleGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomSlashCommand" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "responseType" TEXT NOT NULL,
    "responseText" TEXT,
    "embedId" TEXT,
    "ephemeral" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomSlashCommand_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CustomSlashCommand_embedId_fkey" FOREIGN KEY ("embedId") REFERENCES "Embed" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WelcomeSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "welcomeChannelId" TEXT,
    "welcomeContent" TEXT,
    "welcomeEmbedId" TEXT,
    "goodbyeChannelId" TEXT,
    "goodbyeContent" TEXT,
    "goodbyeEmbedId" TEXT,
    "dmWelcomeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "dmWelcomeContent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WelcomeSettings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WelcomeSettings_welcomeEmbedId_fkey" FOREIGN KEY ("welcomeEmbedId") REFERENCES "Embed" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WelcomeSettings_goodbyeEmbedId_fkey" FOREIGN KEY ("goodbyeEmbedId") REFERENCES "Embed" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ModerationCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "caseNumber" INTEGER NOT NULL,
    "targetId" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "durationSeconds" INTEGER,
    "expiresAt" DATETIME,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "proofUrl" TEXT,
    "contextMessageId" TEXT,
    "relatedCaseId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ModerationCase_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ModerationCase_relatedCaseId_fkey" FOREIGN KEY ("relatedCaseId") REFERENCES "ModerationCase" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PanelAllowedRole" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "discordRoleId" TEXT NOT NULL,
    "note" TEXT,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PanelAllowedRole_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Embed_guildId_idx" ON "Embed"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "Embed_guildId_name_key" ON "Embed"("guildId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_channelId_key" ON "Ticket"("channelId");

-- CreateIndex
CREATE INDEX "Ticket_guildId_idx" ON "Ticket"("guildId");

-- CreateIndex
CREATE INDEX "Ticket_openerId_idx" ON "Ticket"("openerId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_guildId_ticketNumber_key" ON "Ticket"("guildId", "ticketNumber");

-- CreateIndex
CREATE UNIQUE INDEX "TicketTranscript_ticketId_key" ON "TicketTranscript"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "GuildLogSettings_guildId_key" ON "GuildLogSettings"("guildId");

-- CreateIndex
CREATE INDEX "RoleGroup_guildId_idx" ON "RoleGroup"("guildId");

-- CreateIndex
CREATE INDEX "RoleGroupRule_roleGroupId_idx" ON "RoleGroupRule"("roleGroupId");

-- CreateIndex
CREATE INDEX "CustomSlashCommand_guildId_idx" ON "CustomSlashCommand"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomSlashCommand_guildId_name_key" ON "CustomSlashCommand"("guildId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "WelcomeSettings_guildId_key" ON "WelcomeSettings"("guildId");

-- CreateIndex
CREATE INDEX "ModerationCase_guildId_idx" ON "ModerationCase"("guildId");

-- CreateIndex
CREATE INDEX "ModerationCase_targetId_idx" ON "ModerationCase"("targetId");

-- CreateIndex
CREATE UNIQUE INDEX "ModerationCase_guildId_caseNumber_key" ON "ModerationCase"("guildId", "caseNumber");

-- CreateIndex
CREATE INDEX "PanelAllowedRole_guildId_idx" ON "PanelAllowedRole"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "PanelAllowedRole_guildId_discordRoleId_key" ON "PanelAllowedRole"("guildId", "discordRoleId");
