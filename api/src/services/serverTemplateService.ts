import { Prisma, type PrismaClient } from "@prisma/client";
import { AppError } from "../lib/AppError.js";
import type { DiscordUser } from "../types/discord.js";
import { ensureGuildForDiscord } from "./ensureGuild.js";
import { getOrRefreshGuildStructure } from "./guildStructureCacheService.js";
import { buildApplyPlan, type ApplyPlan } from "./serverTemplateDiff.js";
import {
  isValidStoredSnapshot,
  type ServerTemplateSnapshot,
} from "./serverTemplateSnapshot.js";

const NAME_MIN = 2;
const NAME_MAX = 100;
const DESC_MAX = 500;
const TEMPLATE_ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;

export type ServerTemplateSummary = {
  id: string;
  name: string;
  description: string | null;
  createdByDiscordUserId: string;
  /** Aperçu utile sans charger le snapshot entier : nombre de rôles + nombre de salons + nombre de catégories. */
  rolesCount: number;
  channelsCount: number;
  categoriesCount: number;
  sourceGuildName: string;
  createdAt: string;
  updatedAt: string;
};

export type ServerTemplateDetail = ServerTemplateSummary & {
  snapshot: ServerTemplateSnapshot;
};

function assertTemplateId(raw: string): string {
  const v = raw.trim();
  if (!TEMPLATE_ID_RE.test(v)) {
    throw new AppError(400, "Identifiant de template invalide.", "INVALID_TEMPLATE_ID");
  }
  return v;
}

function normalizeName(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new AppError(400, "Le nom du template est requis.", "INVALID_NAME");
  }
  const v = raw.trim();
  if (v.length < NAME_MIN) {
    throw new AppError(400, `Le nom doit faire au moins ${NAME_MIN} caractères.`, "INVALID_NAME");
  }
  if (v.length > NAME_MAX) {
    throw new AppError(400, `Le nom doit faire au plus ${NAME_MAX} caractères.`, "INVALID_NAME");
  }
  return v;
}

function normalizeDescription(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "string") {
    throw new AppError(400, "La description doit être une chaîne de caractères.", "INVALID_DESC");
  }
  const v = raw.trim();
  if (!v) return null;
  if (v.length > DESC_MAX) {
    throw new AppError(400, `La description doit faire au plus ${DESC_MAX} caractères.`, "INVALID_DESC");
  }
  return v;
}

function toSummary(row: {
  id: string;
  name: string;
  description: string | null;
  createdByDiscordUserId: string;
  snapshot: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}): ServerTemplateSummary {
  const snap = isValidStoredSnapshot(row.snapshot) ? row.snapshot : null;
  const categoriesCount = snap ? snap.channels.filter((c) => c.type === "category").length : 0;
  const channelsCount = snap ? snap.channels.filter((c) => c.type !== "category").length : 0;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdByDiscordUserId: row.createdByDiscordUserId,
    rolesCount: snap ? snap.roles.length : 0,
    channelsCount,
    categoriesCount,
    sourceGuildName: snap?.guildName ?? "",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Crée un nouveau template à partir de la structure actuelle du serveur Discord ciblé.
 * Le snapshot est récupéré via l’API Discord avec le bot token.
 */
export async function createServerTemplateFromGuild(
  prisma: PrismaClient,
  discordGuildId: string,
  guildNameHint: string | null | undefined,
  user: DiscordUser,
  botToken: string,
  body: unknown,
): Promise<ServerTemplateDetail> {
  const raw = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const name = normalizeName(raw.name);
  const description = normalizeDescription(raw.description);

  const guildId = await ensureGuildForDiscord(prisma, discordGuildId, guildNameHint);

  let snapshot: ServerTemplateSnapshot;
  if (Object.prototype.hasOwnProperty.call(raw, "snapshot")) {
    const imported = raw.snapshot;
    if (imported === null || imported === undefined) {
      throw new AppError(
        400,
        "Pour importer un template, le champ « snapshot » ne doit pas être vide.",
        "SNAPSHOT_REQUIRED",
      );
    }
    if (!isValidStoredSnapshot(imported)) {
      throw new AppError(
        400,
        "Le snapshot JSON est invalide ou provient d’une version non prise en charge.",
        "INVALID_SNAPSHOT",
      );
    }
    snapshot = imported;
  } else {
    // On sauvegarde "ce que l'utilisateur voit" : utilise le cache existant, sinon Discord live.
    const result = await getOrRefreshGuildStructure(
      prisma,
      discordGuildId,
      guildNameHint,
      botToken,
      false,
    );
    snapshot = result.snapshot;
  }

  const created = await prisma.serverTemplate.create({
    data: {
      guildId,
      name,
      description,
      createdByDiscordUserId: user.id,
      snapshot: snapshot as unknown as Prisma.InputJsonValue,
    },
  });
  return {
    ...toSummary(created),
    snapshot,
  };
}

export async function listServerTemplates(
  prisma: PrismaClient,
  discordGuildId: string,
): Promise<ServerTemplateSummary[]> {
  const guild = await prisma.guild.findUnique({
    where: { discordId: discordGuildId },
    select: { id: true },
  });
  if (!guild) return [];
  const rows = await prisma.serverTemplate.findMany({
    where: { guildId: guild.id },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toSummary);
}

export async function getServerTemplateDetail(
  prisma: PrismaClient,
  discordGuildId: string,
  templateId: string,
): Promise<ServerTemplateDetail> {
  const id = assertTemplateId(templateId);
  const guild = await prisma.guild.findUnique({
    where: { discordId: discordGuildId },
    select: { id: true },
  });
  if (!guild) {
    throw new AppError(404, "Template introuvable.", "TEMPLATE_NOT_FOUND");
  }
  const row = await prisma.serverTemplate.findFirst({
    where: { id, guildId: guild.id },
  });
  if (!row) {
    throw new AppError(404, "Template introuvable.", "TEMPLATE_NOT_FOUND");
  }
  if (!isValidStoredSnapshot(row.snapshot)) {
    throw new AppError(500, "Le contenu du template est corrompu ou d’une version inconnue.", "SNAPSHOT_INVALID");
  }
  return {
    ...toSummary(row),
    snapshot: row.snapshot,
  };
}

export async function updateServerTemplate(
  prisma: PrismaClient,
  discordGuildId: string,
  templateId: string,
  body: unknown,
): Promise<ServerTemplateSummary> {
  const id = assertTemplateId(templateId);
  const raw = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  const data: { name?: string; description?: string | null } = {};
  if (Object.prototype.hasOwnProperty.call(raw, "name")) {
    data.name = normalizeName(raw.name);
  }
  if (Object.prototype.hasOwnProperty.call(raw, "description")) {
    data.description = normalizeDescription(raw.description);
  }
  if (Object.keys(data).length === 0) {
    throw new AppError(400, "Aucune modification fournie.", "EMPTY_PATCH");
  }

  const guild = await prisma.guild.findUnique({
    where: { discordId: discordGuildId },
    select: { id: true },
  });
  if (!guild) {
    throw new AppError(404, "Template introuvable.", "TEMPLATE_NOT_FOUND");
  }

  const existing = await prisma.serverTemplate.findFirst({
    where: { id, guildId: guild.id },
    select: { id: true },
  });
  if (!existing) {
    throw new AppError(404, "Template introuvable.", "TEMPLATE_NOT_FOUND");
  }

  const updated = await prisma.serverTemplate.update({
    where: { id: existing.id },
    data,
  });
  return toSummary(updated);
}

export async function previewServerTemplateApply(
  prisma: PrismaClient,
  discordGuildId: string,
  guildNameHint: string | null | undefined,
  botToken: string,
  templateId: string,
): Promise<{ plan: ApplyPlan; currentCapturedAt: string }> {
  const template = await getServerTemplateDetail(prisma, discordGuildId, templateId);
  const current = await getOrRefreshGuildStructure(
    prisma,
    discordGuildId,
    guildNameHint,
    botToken,
    false,
  );
  const plan = buildApplyPlan(current.snapshot, template.snapshot);
  return { plan, currentCapturedAt: current.capturedAt };
}

export async function deleteServerTemplate(
  prisma: PrismaClient,
  discordGuildId: string,
  templateId: string,
): Promise<{ deleted: boolean }> {
  const id = assertTemplateId(templateId);
  const guild = await prisma.guild.findUnique({
    where: { discordId: discordGuildId },
    select: { id: true },
  });
  if (!guild) {
    throw new AppError(404, "Template introuvable.", "TEMPLATE_NOT_FOUND");
  }
  const r = await prisma.serverTemplate.deleteMany({
    where: { id, guildId: guild.id },
  });
  if (r.count === 0) {
    throw new AppError(404, "Template introuvable ou déjà supprimé.", "TEMPLATE_NOT_FOUND");
  }
  return { deleted: true };
}
