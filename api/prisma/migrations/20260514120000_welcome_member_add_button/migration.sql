-- AlterTable
ALTER TABLE "GuildTicketSettings" ADD COLUMN "welcomeMemberAddButton" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "GuildTicketSettings" ADD COLUMN "welcomeMemberAddButtonStyle" TEXT NOT NULL DEFAULT 'primary';
