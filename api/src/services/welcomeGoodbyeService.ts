import type { PrismaClient } from "@prisma/client";
import { AppError } from "../lib/AppError.js";
import { ensureGuildForDiscord } from "./ensureGuild.js";

export type WelcomeGoodbyeSettingsDto = {
  moduleEnabled: boolean;
  welcomeMessagesEnabled: boolean;
  goodbyeMessagesEnabled: boolean;
  welcomeChannelId: string | null;
  welcomeContent: string | null;
  welcomeUseEmbed: boolean;
  welcomeEmbedColor: number | null;
  /** Modèle Embeds (page Embeds) pour le message d’arrivée dans le salon. */
  welcomeEmbedId: string | null;
  goodbyeChannelId: string | null;
  goodbyeContent: string | null;
  goodbyeUseEmbed: boolean;
  goodbyeEmbedColor: number | null;
  goodbyeEmbedId: string | null;
  dmWelcomeEnabled: boolean;
  dmWelcomeContent: string | null;
};

function normalizeDiscordId(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  if (!/^\d{5,25}$/.test(s)) {
    throw new AppError(400, "Identifiant de salon Discord invalide.", "INVALID_ID");
  }
  return s;
}

function normalizeContent(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return null;
  const s = v.replace(/\r\n/g, "\n");
  return s.trim() === "" ? null : s;
}

function normalizeBool(v: unknown): boolean {
  if (typeof v !== "boolean") {
    throw new AppError(400, "Valeur booléenne attendue (true / false).", "INVALID_FIELD");
  }
  return v;
}

function normalizeEmbedColor(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 0xffffff) return v;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    const hex = s.startsWith("#") ? s.slice(1) : s;
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
      throw new AppError(400, "Couleur embed invalide (ex. #5865F2).", "INVALID_COLOR");
    }
    return parseInt(hex, 16);
  }
  throw new AppError(400, "Couleur embed invalide.", "INVALID_COLOR");
}

async function normalizeOptionalEmbedTemplateId(
  prisma: PrismaClient,
  guildId: string,
  v: unknown,
): Promise<string | null> {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") {
    throw new AppError(400, "Identifiant de modèle invalide.", "INVALID_EMBED_ID");
  }
  const id = v.trim();
  if (!id) return null;
  const row = await prisma.embed.findFirst({ where: { id, guildId }, select: { id: true } });
  if (!row) {
    throw new AppError(404, "Ce modèle d’embed n’existe pas sur ce serveur.", "EMBED_NOT_FOUND");
  }
  return id;
}

function mapRow(row: {
  moduleEnabled: boolean;
  welcomeMessagesEnabled: boolean;
  goodbyeMessagesEnabled: boolean;
  welcomeChannelId: string | null;
  welcomeContent: string | null;
  welcomeUseEmbed: boolean;
  welcomeEmbedColor: number | null;
  welcomeEmbedId: string | null;
  goodbyeChannelId: string | null;
  goodbyeContent: string | null;
  goodbyeUseEmbed: boolean;
  goodbyeEmbedColor: number | null;
  goodbyeEmbedId: string | null;
  dmWelcomeEnabled: boolean;
  dmWelcomeContent: string | null;
} | null): WelcomeGoodbyeSettingsDto {
  if (!row) {
    return {
      moduleEnabled: true,
      welcomeMessagesEnabled: true,
      goodbyeMessagesEnabled: true,
      welcomeChannelId: null,
      welcomeContent: null,
      welcomeUseEmbed: false,
      welcomeEmbedColor: null,
      welcomeEmbedId: null,
      goodbyeChannelId: null,
      goodbyeContent: null,
      goodbyeUseEmbed: false,
      goodbyeEmbedColor: null,
      goodbyeEmbedId: null,
      dmWelcomeEnabled: false,
      dmWelcomeContent: null,
    };
  }
  return {
    moduleEnabled: row.moduleEnabled,
    welcomeMessagesEnabled: row.welcomeMessagesEnabled,
    goodbyeMessagesEnabled: row.goodbyeMessagesEnabled,
    welcomeChannelId: row.welcomeChannelId,
    welcomeContent: row.welcomeContent,
    welcomeUseEmbed: row.welcomeUseEmbed,
    welcomeEmbedColor: row.welcomeEmbedColor,
    welcomeEmbedId: row.welcomeEmbedId,
    goodbyeChannelId: row.goodbyeChannelId,
    goodbyeContent: row.goodbyeContent,
    goodbyeUseEmbed: row.goodbyeUseEmbed,
    goodbyeEmbedColor: row.goodbyeEmbedColor,
    goodbyeEmbedId: row.goodbyeEmbedId,
    dmWelcomeEnabled: row.dmWelcomeEnabled,
    dmWelcomeContent: row.dmWelcomeContent,
  };
}

export async function getWelcomeGoodbyeSettings(
  prisma: PrismaClient,
  discordGuildId: string,
): Promise<WelcomeGoodbyeSettingsDto> {
  const guild = await prisma.guild.findUnique({
    where: { discordId: discordGuildId },
    select: { id: true },
  });
  if (!guild) return mapRow(null);
  const row = await prisma.welcomeSettings.findUnique({
    where: { guildId: guild.id },
  });
  return mapRow(row);
}

function validateContentLength(useEmbed: boolean, content: string | null) {
  if (!content) return;
  const max = useEmbed ? 4096 : 2000;
  if (content.length > max) {
    throw new AppError(
      400,
      useEmbed
        ? `Le texte embed ne peut pas dépasser ${max} caractères.`
        : `Le message ne peut pas dépasser ${max} caractères.`,
      "CONTENT_TOO_LONG",
    );
  }
}

export async function upsertWelcomeGoodbyeSettings(
  prisma: PrismaClient,
  discordGuildId: string,
  guildNameHint: string | null | undefined,
  body: unknown,
): Promise<WelcomeGoodbyeSettingsDto> {
  const raw = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const guildId = await ensureGuildForDiscord(prisma, discordGuildId, guildNameHint);
  const existing = await prisma.welcomeSettings.findUnique({ where: { guildId } });

  let moduleEnabled = existing?.moduleEnabled ?? true;
  let welcomeMessagesEnabled = existing?.welcomeMessagesEnabled ?? true;
  let goodbyeMessagesEnabled = existing?.goodbyeMessagesEnabled ?? true;
  let welcomeChannelId = existing?.welcomeChannelId ?? null;
  let welcomeContent = existing?.welcomeContent ?? null;
  let welcomeUseEmbed = existing?.welcomeUseEmbed ?? false;
  let welcomeEmbedColor = existing?.welcomeEmbedColor ?? null;
  let welcomeEmbedId = existing?.welcomeEmbedId ?? null;
  let goodbyeChannelId = existing?.goodbyeChannelId ?? null;
  let goodbyeContent = existing?.goodbyeContent ?? null;
  let goodbyeUseEmbed = existing?.goodbyeUseEmbed ?? false;
  let goodbyeEmbedColor = existing?.goodbyeEmbedColor ?? null;
  let goodbyeEmbedId = existing?.goodbyeEmbedId ?? null;
  let dmWelcomeEnabled = existing?.dmWelcomeEnabled ?? false;
  let dmWelcomeContent = existing?.dmWelcomeContent ?? null;

  if (Object.prototype.hasOwnProperty.call(raw, "moduleEnabled")) {
    moduleEnabled = normalizeBool(raw.moduleEnabled);
  }
  if (Object.prototype.hasOwnProperty.call(raw, "welcomeMessagesEnabled")) {
    welcomeMessagesEnabled = normalizeBool(raw.welcomeMessagesEnabled);
  }
  if (Object.prototype.hasOwnProperty.call(raw, "goodbyeMessagesEnabled")) {
    goodbyeMessagesEnabled = normalizeBool(raw.goodbyeMessagesEnabled);
  }

  if (Object.prototype.hasOwnProperty.call(raw, "welcomeChannelId")) {
    welcomeChannelId = normalizeDiscordId(raw.welcomeChannelId);
  }
  if (Object.prototype.hasOwnProperty.call(raw, "welcomeContent")) {
    welcomeContent = normalizeContent(raw.welcomeContent);
  }
  if (Object.prototype.hasOwnProperty.call(raw, "welcomeUseEmbed")) {
    welcomeUseEmbed = normalizeBool(raw.welcomeUseEmbed);
  }
  if (Object.prototype.hasOwnProperty.call(raw, "welcomeEmbedColor")) {
    welcomeEmbedColor = normalizeEmbedColor(raw.welcomeEmbedColor);
  }
  if (Object.prototype.hasOwnProperty.call(raw, "welcomeEmbedId")) {
    welcomeEmbedId = await normalizeOptionalEmbedTemplateId(prisma, guildId, raw.welcomeEmbedId);
  }

  if (Object.prototype.hasOwnProperty.call(raw, "goodbyeChannelId")) {
    goodbyeChannelId = normalizeDiscordId(raw.goodbyeChannelId);
  }
  if (Object.prototype.hasOwnProperty.call(raw, "goodbyeContent")) {
    goodbyeContent = normalizeContent(raw.goodbyeContent);
  }
  if (Object.prototype.hasOwnProperty.call(raw, "goodbyeUseEmbed")) {
    goodbyeUseEmbed = normalizeBool(raw.goodbyeUseEmbed);
  }
  if (Object.prototype.hasOwnProperty.call(raw, "goodbyeEmbedColor")) {
    goodbyeEmbedColor = normalizeEmbedColor(raw.goodbyeEmbedColor);
  }
  if (Object.prototype.hasOwnProperty.call(raw, "goodbyeEmbedId")) {
    goodbyeEmbedId = await normalizeOptionalEmbedTemplateId(prisma, guildId, raw.goodbyeEmbedId);
  }

  if (Object.prototype.hasOwnProperty.call(raw, "dmWelcomeEnabled")) {
    dmWelcomeEnabled = normalizeBool(raw.dmWelcomeEnabled);
  }
  if (Object.prototype.hasOwnProperty.call(raw, "dmWelcomeContent")) {
    dmWelcomeContent = normalizeContent(raw.dmWelcomeContent);
  }

  if (!welcomeEmbedId) {
    validateContentLength(welcomeUseEmbed, welcomeContent);
  }
  if (!goodbyeEmbedId) {
    validateContentLength(goodbyeUseEmbed, goodbyeContent);
  }
  if (dmWelcomeContent) {
    validateContentLength(false, dmWelcomeContent);
  }

  if (
    welcomeMessagesEnabled &&
    welcomeChannelId &&
    !welcomeEmbedId &&
    !(welcomeContent && welcomeContent.trim())
  ) {
    throw new AppError(
      400,
      "Pour les arrivées : choisis un salon puis un message texte, un embed simple, ou un modèle d’embed.",
      "WELCOME_BODY_EMPTY",
    );
  }
  if (
    goodbyeMessagesEnabled &&
    goodbyeChannelId &&
    !goodbyeEmbedId &&
    !(goodbyeContent && goodbyeContent.trim())
  ) {
    throw new AppError(
      400,
      "Pour les départs : choisis un salon puis un message texte, un embed simple, ou un modèle d’embed.",
      "GOODBYE_BODY_EMPTY",
    );
  }

  await prisma.welcomeSettings.upsert({
    where: { guildId },
    create: {
      guildId,
      moduleEnabled,
      welcomeMessagesEnabled,
      goodbyeMessagesEnabled,
      welcomeChannelId,
      welcomeContent,
      welcomeUseEmbed: welcomeEmbedId ? false : welcomeUseEmbed,
      welcomeEmbedColor: welcomeEmbedId ? null : welcomeEmbedColor,
      welcomeEmbedId,
      goodbyeChannelId,
      goodbyeContent,
      goodbyeUseEmbed: goodbyeEmbedId ? false : goodbyeUseEmbed,
      goodbyeEmbedColor: goodbyeEmbedId ? null : goodbyeEmbedColor,
      goodbyeEmbedId,
      dmWelcomeEnabled,
      dmWelcomeContent,
    },
    update: {
      moduleEnabled,
      welcomeMessagesEnabled,
      goodbyeMessagesEnabled,
      welcomeChannelId,
      welcomeContent,
      welcomeUseEmbed: welcomeEmbedId ? false : welcomeUseEmbed,
      welcomeEmbedColor: welcomeEmbedId ? null : welcomeEmbedColor,
      welcomeEmbedId,
      goodbyeChannelId,
      goodbyeContent,
      goodbyeUseEmbed: goodbyeEmbedId ? false : goodbyeUseEmbed,
      goodbyeEmbedColor: goodbyeEmbedId ? null : goodbyeEmbedColor,
      goodbyeEmbedId,
      dmWelcomeEnabled,
      dmWelcomeContent,
    },
  });

  return getWelcomeGoodbyeSettings(prisma, discordGuildId);
}
