-- AlterTable: ajoute le contrôle d'accès aux commandes custom
ALTER TABLE "CustomSlashCommand" ADD COLUMN "allowedRoleIds" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "CustomSlashCommand" ADD COLUMN "allowedChannelIds" JSONB NOT NULL DEFAULT '[]';

-- CreateTable: réglages par serveur des commandes natives
CREATE TABLE "NativeCommandSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "commandName" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "allowedRoleIds" JSONB NOT NULL DEFAULT '[]',
    "allowedChannelIds" JSONB NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NativeCommandSetting_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "NativeCommandSetting_guildId_commandName_key" ON "NativeCommandSetting"("guildId", "commandName");
CREATE INDEX "NativeCommandSetting_guildId_idx" ON "NativeCommandSetting"("guildId");
