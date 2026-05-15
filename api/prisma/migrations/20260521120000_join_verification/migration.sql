-- Vérification à l'arrivée (captcha ou bouton).
CREATE TABLE "JoinVerificationSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "moduleEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mode" TEXT NOT NULL DEFAULT 'BUTTON',
    "channelId" TEXT,
    "unverifiedRoleId" TEXT,
    "panelMessageId" TEXT,
    "buttonLabel" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "JoinVerificationSettings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "JoinVerificationSettings_guildId_key" ON "JoinVerificationSettings"("guildId");

CREATE TABLE "JoinVerificationCaptcha" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "discordUserId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JoinVerificationCaptcha_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "JoinVerificationCaptcha_guildId_discordUserId_key" ON "JoinVerificationCaptcha"("guildId", "discordUserId");
CREATE INDEX "JoinVerificationCaptcha_guildId_idx" ON "JoinVerificationCaptcha"("guildId");
