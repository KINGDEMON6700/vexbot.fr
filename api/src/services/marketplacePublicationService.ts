import { Prisma, type PrismaClient } from "@prisma/client";
import { AppError } from "../lib/AppError.js";
import type { DiscordUser } from "../types/discord.js";

export type MarketplacePublicationKind = "embed" | "server";

export type MarketplacePublicationDto = {
  id: string;
  kind: MarketplacePublicationKind;
  name: string;
  shortDescription: string;
  authorDiscordId: string;
  authorGlobalName: string | null;
  authorUsername: string;
  authorAvatar: string | null;
  createdAt: string;
  likes: number;
  downloads: number;
  messages?: unknown;
  serverGuildId?: string | null;
  serverGuildName?: string | null;
  sourceEmbedTemplateId?: string | null;
  sourceServerTemplateId?: string | null;
};

/** Snapshot page Templates (v1) stocké dans messagesJson pour kind === "server". */
function parseServerTemplateSnapshot(messages: unknown): { guildName: string; sourceGuildId: string } | null {
  if (!messages || typeof messages !== "object") return null;
  const m = messages as Record<string, unknown>;
  if (m.v !== 1) return null;
  if (!Array.isArray(m.roles) || !Array.isArray(m.channels)) return null;
  const sourceGuildId = typeof m.sourceGuildId === "string" ? m.sourceGuildId.trim() : "";
  if (!sourceGuildId) return null;
  const guildNameRaw = typeof m.guildName === "string" ? m.guildName.trim() : "";
  const guildName = guildNameRaw || "Serveur";
  return { guildName, sourceGuildId };
}

function rowToDto(row: {
  id: string;
  discordUserId: string;
  kind: string;
  name: string;
  shortDescription: string;
  authorGlobalName: string | null;
  authorUsername: string;
  authorAvatar: string | null;
  messagesJson: Prisma.JsonValue | null;
  serverGuildId: string | null;
  serverGuildName: string | null;
  sourceEmbedTemplateId: string | null;
  sourceServerTemplateId: string | null;
  downloads: number;
  createdAt: Date;
}): MarketplacePublicationDto {
  const messages = row.messagesJson === null || row.messagesJson === undefined ? undefined : row.messagesJson;
  return {
    id: row.id,
    kind: row.kind === "server" ? "server" : "embed",
    name: row.name,
    shortDescription: row.shortDescription,
    authorDiscordId: row.discordUserId,
    authorGlobalName: row.authorGlobalName,
    authorUsername: row.authorUsername,
    authorAvatar: row.authorAvatar,
    createdAt: row.createdAt.toISOString(),
    likes: 0,
    downloads: row.downloads,
    messages: messages as MarketplacePublicationDto["messages"],
    serverGuildId: row.serverGuildId,
    serverGuildName: row.serverGuildName,
    sourceEmbedTemplateId: row.sourceEmbedTemplateId,
    sourceServerTemplateId: row.sourceServerTemplateId,
  };
}

export async function listMarketplacePublications(prisma: PrismaClient): Promise<MarketplacePublicationDto[]> {
  const rows = await prisma.marketplacePublication.findMany({
    orderBy: { createdAt: "desc" },
  });
  return rows.map(rowToDto);
}

export async function getMarketplacePublication(
  prisma: PrismaClient,
  id: string,
): Promise<MarketplacePublicationDto | null> {
  const row = await prisma.marketplacePublication.findUnique({ where: { id } });
  return row ? rowToDto(row) : null;
}

export async function createMarketplacePublication(
  prisma: PrismaClient,
  user: DiscordUser,
  input: {
    kind: MarketplacePublicationKind;
    name: string;
    shortDescription: string;
    messages?: unknown;
    serverGuildId?: string | null;
    serverGuildName?: string | null;
    sourceEmbedTemplateId?: string | null;
    sourceServerTemplateId?: string | null;
  },
): Promise<MarketplacePublicationDto> {
  if (input.kind === "embed") {
    if (!Array.isArray(input.messages) || input.messages.length === 0) {
      throw new AppError(400, "Le modèle d’embed est requis.", "MISSING_MESSAGES");
    }
    const row = await prisma.marketplacePublication.create({
      data: {
        discordUserId: user.id,
        kind: "embed",
        name: input.name,
        shortDescription: input.shortDescription,
        authorGlobalName: user.global_name,
        authorUsername: user.username,
        authorAvatar: user.avatar,
        messagesJson: input.messages as Prisma.InputJsonValue,
        serverGuildId: null,
        serverGuildName: null,
        sourceEmbedTemplateId: input.sourceEmbedTemplateId ?? null,
        sourceServerTemplateId: null,
      },
    });
    return rowToDto(row);
  }

  const snap = parseServerTemplateSnapshot(input.messages);
  if (!snap) {
    throw new AppError(
      400,
      "Choisis un template de serveur sauvegardé (page Templates) : la structure capturée est requise.",
      "MISSING_SERVER_SNAPSHOT",
    );
  }
  const row = await prisma.marketplacePublication.create({
    data: {
      discordUserId: user.id,
      kind: "server",
      name: input.name,
      shortDescription: input.shortDescription,
      authorGlobalName: user.global_name,
      authorUsername: user.username,
      authorAvatar: user.avatar,
      messagesJson: input.messages as Prisma.InputJsonValue,
      serverGuildId: snap.sourceGuildId,
      serverGuildName: snap.guildName,
      sourceEmbedTemplateId: null,
      sourceServerTemplateId: input.sourceServerTemplateId?.trim() || null,
    },
  });
  return rowToDto(row);
}

export async function updateMarketplacePublication(
  prisma: PrismaClient,
  id: string,
  user: DiscordUser,
  input: {
    name: string;
    shortDescription: string;
    messages?: unknown;
    serverGuildId?: string | null;
    serverGuildName?: string | null;
    sourceEmbedTemplateId?: string | null;
    sourceServerTemplateId?: string | null;
  },
): Promise<MarketplacePublicationDto> {
  const existing = await prisma.marketplacePublication.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, "Publication introuvable.", "NOT_FOUND");
  }
  if (existing.discordUserId !== user.id) {
    throw new AppError(403, "Tu ne peux pas modifier cette publication.", "FORBIDDEN");
  }
  if (existing.kind === "embed") {
    if (input.messages !== undefined) {
      if (!Array.isArray(input.messages) || input.messages.length === 0) {
        throw new AppError(400, "Le modèle d’embed est requis.", "MISSING_MESSAGES");
      }
    }
    const row = await prisma.marketplacePublication.update({
      where: { id },
      data: {
        name: input.name,
        shortDescription: input.shortDescription,
        authorGlobalName: user.global_name,
        authorUsername: user.username,
        authorAvatar: user.avatar,
        ...(input.messages !== undefined
          ? { messagesJson: input.messages as Prisma.InputJsonValue }
          : {}),
        ...(input.sourceEmbedTemplateId !== undefined
          ? { sourceEmbedTemplateId: input.sourceEmbedTemplateId }
          : {}),
      },
    });
    return rowToDto(row);
  }

  if (input.messages !== undefined) {
    const snap = parseServerTemplateSnapshot(input.messages);
    if (!snap) {
      throw new AppError(400, "Structure de template serveur invalide.", "INVALID_SERVER_SNAPSHOT");
    }
    const row = await prisma.marketplacePublication.update({
      where: { id },
      data: {
        name: input.name,
        shortDescription: input.shortDescription,
        authorGlobalName: user.global_name,
        authorUsername: user.username,
        authorAvatar: user.avatar,
        messagesJson: input.messages as Prisma.InputJsonValue,
        serverGuildId: snap.sourceGuildId,
        serverGuildName: snap.guildName,
        ...(input.sourceServerTemplateId !== undefined
          ? { sourceServerTemplateId: input.sourceServerTemplateId }
          : {}),
      },
    });
    return rowToDto(row);
  }

  const data: Prisma.MarketplacePublicationUpdateInput = {
    name: input.name,
    shortDescription: input.shortDescription,
    authorGlobalName: user.global_name,
    authorUsername: user.username,
    authorAvatar: user.avatar,
  };
  if (input.serverGuildId?.trim() && input.serverGuildName?.trim()) {
    data.serverGuildId = input.serverGuildId.trim();
    data.serverGuildName = input.serverGuildName.trim();
  }
  if (input.sourceServerTemplateId !== undefined) {
    data.sourceServerTemplateId = input.sourceServerTemplateId;
  }
  const row = await prisma.marketplacePublication.update({
    where: { id },
    data,
  });
  return rowToDto(row);
}

export async function deleteMarketplacePublication(prisma: PrismaClient, id: string, userId: string): Promise<void> {
  const existing = await prisma.marketplacePublication.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, "Publication introuvable.", "NOT_FOUND");
  }
  if (existing.discordUserId !== userId) {
    throw new AppError(403, "Tu ne peux pas supprimer cette publication.", "FORBIDDEN");
  }
  await prisma.marketplacePublication.delete({ where: { id } });
}

export async function bumpMarketplacePublicationDownload(
  prisma: PrismaClient,
  id: string,
): Promise<{ downloads: number }> {
  try {
    const row = await prisma.marketplacePublication.update({
      where: { id },
      data: { downloads: { increment: 1 } },
      select: { downloads: true },
    });
    return { downloads: row.downloads };
  } catch {
    throw new AppError(404, "Publication introuvable.", "NOT_FOUND");
  }
}
