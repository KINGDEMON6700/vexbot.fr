import type { PrismaClient } from "@prisma/client";

/** Retourne l’id interne Guild pour ce serveur Discord, en créant la ligne si besoin. */
export async function ensureGuildForDiscord(
  prisma: PrismaClient,
  discordGuildId: string,
  nameHint: string | null | undefined,
): Promise<string> {
  const row = await prisma.guild.findUnique({
    where: { discordId: discordGuildId },
    select: { id: true },
  });
  if (row) return row.id;

  const created = await prisma.guild.create({
    data: {
      discordId: discordGuildId,
      name: nameHint?.trim() || null,
    },
    select: { id: true },
  });
  return created.id;
}
