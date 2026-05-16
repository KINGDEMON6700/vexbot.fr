-- Un seul flux (plus de mode) + rôles après vérification
ALTER TABLE "JoinVerificationSettings" ADD COLUMN "verifiedRoleIds" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "JoinVerificationSettings" DROP COLUMN "mode";
