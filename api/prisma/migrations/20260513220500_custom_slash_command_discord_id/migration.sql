-- AlterTable: ID Discord de la commande custom (rempli après enregistrement côté Discord)
ALTER TABLE "CustomSlashCommand" ADD COLUMN "discordCommandId" TEXT;
