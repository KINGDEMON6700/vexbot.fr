-- Un seul commentaire par (templateId, discordUserId) : garder le plus récent.
DELETE FROM "MarketplaceTemplateComment"
WHERE "id" IN (
  SELECT "id" FROM (
    SELECT
      "id",
      ROW_NUMBER() OVER (
        PARTITION BY "templateId", "discordUserId"
        ORDER BY "createdAt" DESC
      ) AS "rn"
    FROM "MarketplaceTemplateComment"
  ) AS "dedup"
  WHERE "dedup"."rn" > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS "MarketplaceTemplateComment_templateId_discordUserId_key"
ON "MarketplaceTemplateComment"("templateId", "discordUserId");
