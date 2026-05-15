import type { PrismaClient } from "@prisma/client";
import { AppError } from "../lib/AppError.js";
import type { DiscordUser } from "../types/discord.js";

const TEMPLATE_ID_RE = /^[a-zA-Z0-9_-]{1,96}$/;
const COMMENT_ID_RE = /^[a-zA-Z0-9_-]{20,128}$/;

export function assertMarketplaceTemplateId(raw: string): string {
  const id = raw.trim();
  if (!TEMPLATE_ID_RE.test(id)) {
    throw new AppError(400, "Identifiant de la template invalide.", "INVALID_TEMPLATE_ID");
  }
  return id;
}

function assertMarketplaceCommentId(raw: string): string {
  const id = raw.trim();
  if (!COMMENT_ID_RE.test(id)) {
    throw new AppError(400, "Identifiant de commentaire invalide.", "INVALID_COMMENT_ID");
  }
  return id;
}

export type MarketplaceTemplateStats = {
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
};

export async function getMarketplaceStatsMap(
  prisma: PrismaClient,
  templateIds: string[],
  currentUserId: string,
): Promise<Record<string, MarketplaceTemplateStats>> {
  const unique = [...new Set(templateIds.map((x) => x.trim()).filter(Boolean))].slice(0, 200);
  if (unique.length === 0) return {};

  const [likeGroups, commentGroups, myLikes] = await Promise.all([
    prisma.marketplaceTemplateLike.groupBy({
      by: ["templateId"],
      where: { templateId: { in: unique } },
      _count: { _all: true },
    }),
    prisma.marketplaceTemplateComment.groupBy({
      by: ["templateId"],
      where: { templateId: { in: unique } },
      _count: { _all: true },
    }),
    prisma.marketplaceTemplateLike.findMany({
      where: { templateId: { in: unique }, discordUserId: currentUserId },
      select: { templateId: true },
    }),
  ]);

  const likeMap = Object.fromEntries(likeGroups.map((g) => [g.templateId, g._count._all]));
  const commentMap = Object.fromEntries(commentGroups.map((g) => [g.templateId, g._count._all]));
  const mySet = new Set(myLikes.map((x) => x.templateId));

  const out: Record<string, MarketplaceTemplateStats> = {};
  for (const id of unique) {
    out[id] = {
      likeCount: likeMap[id] ?? 0,
      commentCount: commentMap[id] ?? 0,
      likedByMe: mySet.has(id),
    };
  }
  return out;
}

export async function toggleMarketplaceLike(
  prisma: PrismaClient,
  templateId: string,
  discordUserId: string,
): Promise<{ liked: boolean; likeCount: number }> {
  const tid = assertMarketplaceTemplateId(templateId);
  const existing = await prisma.marketplaceTemplateLike.findUnique({
    where: { templateId_discordUserId: { templateId: tid, discordUserId } },
  });
  if (existing) {
    await prisma.marketplaceTemplateLike.delete({ where: { id: existing.id } });
  } else {
    await prisma.marketplaceTemplateLike.create({
      data: { templateId: tid, discordUserId },
    });
  }
  const likeCount = await prisma.marketplaceTemplateLike.count({ where: { templateId: tid } });
  return { liked: !existing, likeCount };
}

export type MarketplaceCommentDto = {
  id: string;
  discordUserId: string;
  authorGlobalName: string | null;
  authorUsername: string;
  authorAvatar: string | null;
  body: string;
  createdAt: string;
};

export async function listMarketplaceComments(
  prisma: PrismaClient,
  templateId: string,
): Promise<MarketplaceCommentDto[]> {
  const tid = assertMarketplaceTemplateId(templateId);
  const rows = await prisma.marketplaceTemplateComment.findMany({
    where: { templateId: tid },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      discordUserId: true,
      authorGlobalName: true,
      authorUsername: true,
      authorAvatar: true,
      body: true,
      createdAt: true,
    },
  });
  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function addMarketplaceComment(
  prisma: PrismaClient,
  templateId: string,
  user: DiscordUser,
  body: string,
): Promise<MarketplaceCommentDto> {
  const tid = assertMarketplaceTemplateId(templateId);
  const trimmed = body.trim();
  if (!trimmed) {
    throw new AppError(400, "Le commentaire est vide.", "EMPTY_COMMENT");
  }
  if (trimmed.length > 2000) {
    throw new AppError(400, "Le commentaire est trop long (2000 caractères max).", "COMMENT_TOO_LONG");
  }
  const row = await prisma.marketplaceTemplateComment.create({
    data: {
      templateId: tid,
      discordUserId: user.id,
      authorGlobalName: user.global_name,
      authorUsername: user.username,
      authorAvatar: user.avatar,
      body: trimmed,
    },
    select: {
      id: true,
      discordUserId: true,
      authorGlobalName: true,
      authorUsername: true,
      authorAvatar: true,
      body: true,
      createdAt: true,
    },
  });
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function deleteMarketplaceComment(
  prisma: PrismaClient,
  templateId: string,
  commentId: string,
  discordUserId: string,
): Promise<{ deleted: boolean }> {
  const tid = assertMarketplaceTemplateId(templateId);
  const cid = assertMarketplaceCommentId(commentId);
  const r = await prisma.marketplaceTemplateComment.deleteMany({
    where: { id: cid, templateId: tid, discordUserId },
  });
  if (r.count === 0) {
    throw new AppError(404, "Commentaire introuvable ou déjà supprimé.", "COMMENT_NOT_FOUND");
  }
  return { deleted: true };
}
