-- Redefine WelcomeSettings: simple embed mode (couleur + texte) sans modèle Embeds.
ALTER TABLE "WelcomeSettings" ADD COLUMN "welcomeUseEmbed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WelcomeSettings" ADD COLUMN "welcomeEmbedColor" INTEGER;
ALTER TABLE "WelcomeSettings" ADD COLUMN "goodbyeUseEmbed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WelcomeSettings" ADD COLUMN "goodbyeEmbedColor" INTEGER;
