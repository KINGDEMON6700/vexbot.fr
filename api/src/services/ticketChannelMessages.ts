import type { PrismaClient } from "@prisma/client";
import { AppError } from "../lib/AppError.js";

const DISCORD_API = "https://discord.com/api/v10";

export type LiveChannelMessage = {
  id: string;
  authorId: string;
  authorName: string;
  /** Hash d’avatar Discord (`author.avatar`), ou null → avatar par défaut côté client. */
  authorAvatarHash: string | null;
  content: string;
  createdAt: string;
};

/** Messages du salon Discord du ticket (ordre chronologique), si le salon existe encore. */
export async function fetchTicketChannelMessages(
  prisma: PrismaClient,
  discordGuildId: string,
  ticketId: string,
  botToken: string,
): Promise<LiveChannelMessage[]> {
  const guild = await prisma.guild.findUnique({
    where: { discordId: discordGuildId },
    select: { id: true },
  });
  if (!guild) {
    throw new AppError(404, "Serveur introuvable.", "NOT_FOUND");
  }
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, guildId: guild.id },
    select: { channelId: true },
  });
  if (!ticket) {
    throw new AppError(404, "Ticket introuvable.", "NOT_FOUND");
  }

  const res = await fetch(`${DISCORD_API}/channels/${ticket.channelId}/messages?limit=100`, {
    headers: { Authorization: `Bot ${botToken}` },
  });
  if (res.status === 403 || res.status === 404) {
    throw new AppError(
      502,
      "Le bot ne peut pas lire ce salon (permissions ou salon supprimé).",
      "DISCORD_MESSAGES_FORBIDDEN",
    );
  }
  if (!res.ok) {
    throw new AppError(502, "Impossible de récupérer les messages sur Discord.", "DISCORD_MESSAGES_FAILED");
  }

  const raw = (await res.json()) as Array<{
    id: string;
    content: string;
    timestamp: string;
    author?: { id: string; username: string; global_name?: string | null; avatar: string | null };
  }>;

  const mapped: LiveChannelMessage[] = raw.map((m) => ({
    id: m.id,
    authorId: m.author?.id ?? "?",
    authorName: String(m.author?.global_name || m.author?.username || "?").slice(0, 80),
    authorAvatarHash: m.author?.avatar ?? null,
    content: m.content ?? "",
    createdAt: m.timestamp,
  }));

  return mapped.reverse();
}
