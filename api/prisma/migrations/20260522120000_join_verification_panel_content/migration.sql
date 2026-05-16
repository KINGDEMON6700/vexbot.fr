-- Contenu personnalisable du panneau de vérification à l'arrivée.
ALTER TABLE "JoinVerificationSettings" ADD COLUMN "panelContent" TEXT;
ALTER TABLE "JoinVerificationSettings" ADD COLUMN "panelUseEmbed" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "JoinVerificationSettings" ADD COLUMN "panelEmbedColor" INTEGER;
ALTER TABLE "JoinVerificationSettings" ADD COLUMN "panelEmbedId" TEXT REFERENCES "Embed"("id") ON DELETE SET NULL ON UPDATE CASCADE;

