import { Prisma, type PrismaClient } from "@prisma/client";
import { ensureGuildForDiscord } from "./ensureGuild.js";
import {
  buildServerTemplateSnapshot,
  isValidStoredSnapshot,
  type ServerTemplateSnapshot,
} from "./serverTemplateSnapshot.js";

export type GuildStructureResult = {
  snapshot: ServerTemplateSnapshot;
  capturedAt: string;
};

/**
 * Renvoie la dernière structure connue du serveur. Si aucune n’existe (premier appel),
 * la récupère depuis Discord et la met en cache. Avec `forceRefresh`, force la lecture Discord.
 */
export async function getOrRefreshGuildStructure(
  prisma: PrismaClient,
  discordGuildId: string,
  guildNameHint: string | null | undefined,
  botToken: string,
  forceRefresh: boolean,
): Promise<GuildStructureResult> {
  const guildInternalId = await ensureGuildForDiscord(prisma, discordGuildId, guildNameHint);

  if (!forceRefresh) {
    const existing = await prisma.guildStructureCache.findUnique({
      where: { guildId: guildInternalId },
    });
    if (existing && isValidStoredSnapshot(existing.snapshot)) {
      return {
        snapshot: existing.snapshot,
        capturedAt: existing.capturedAt.toISOString(),
      };
    }
  }

  const snapshot = await buildServerTemplateSnapshot(discordGuildId, botToken);
  const saved = await prisma.guildStructureCache.upsert({
    where: { guildId: guildInternalId },
    create: {
      guildId: guildInternalId,
      snapshot: snapshot as unknown as Prisma.InputJsonValue,
      capturedAt: new Date(),
    },
    update: {
      snapshot: snapshot as unknown as Prisma.InputJsonValue,
      capturedAt: new Date(),
    },
  });
  return {
    snapshot,
    capturedAt: saved.capturedAt.toISOString(),
  };
}

/** Vide le cache (utile après un apply ou en cas de problème). */
export async function invalidateGuildStructureCache(
  prisma: PrismaClient,
  discordGuildId: string,
): Promise<void> {
  const guild = await prisma.guild.findUnique({
    where: { discordId: discordGuildId },
    select: { id: true },
  });
  if (!guild) return;
  await prisma.guildStructureCache.deleteMany({ where: { guildId: guild.id } });
}
