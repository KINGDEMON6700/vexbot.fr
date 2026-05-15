-- Activation globale du module + choix arrivée / départ indépendants.
ALTER TABLE "WelcomeSettings" ADD COLUMN "moduleEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "WelcomeSettings" ADD COLUMN "welcomeMessagesEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "WelcomeSettings" ADD COLUMN "goodbyeMessagesEnabled" BOOLEAN NOT NULL DEFAULT true;
