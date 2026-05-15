-- Rôles attribués automatiquement à l'arrivée d'un membre (réglages panneau + bot).
CREATE TABLE "JoinAutoRoleSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "moduleEnabled" BOOLEAN NOT NULL DEFAULT false,
    "discordRoleIds" JSONB NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "JoinAutoRoleSettings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "JoinAutoRoleSettings_guildId_key" ON "JoinAutoRoleSettings"("guildId");
