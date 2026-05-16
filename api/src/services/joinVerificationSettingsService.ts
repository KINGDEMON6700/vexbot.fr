import type { PrismaClient } from "@prisma/client";
import { AppError } from "../lib/AppError.js";
import { ensureGuildForDiscord } from "./ensureGuild.js";

export type JoinVerificationSettingsDto = {
  moduleEnabled: boolean;
  channelId: string | null;
  unverifiedRoleId: string | null;
  panelMessageId: string | null;
  panelContent: string | null;
  panelUseEmbed: boolean;
  panelEmbedColor: number | null;
  panelEmbedId: string | null;
  buttonLabel: string | null;
  verifiedRoleIds: string[];
};

const MAX_VERIFIED_ROLES = 40;
const MAX_PANEL_CONTENT_LENGTH = 4096;

function normalizeDiscordId(v: unknown, field: string): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  if (!/^\d{5,25}$/.test(s)) {
    throw new AppError(400, `${field} invalide.`, "INVALID_ID");
  }
  return s;
}

function normalizeBool(v: unknown): boolean {
  if (typeof v !== "boolean") {
    throw new AppError(400, "Valeur booléenne attendue (true / false).", "INVALID_FIELD");
  }
  return v;
}

function normalizeButtonLabel(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  return s.slice(0, 80);
}

function normalizeContent(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  if (s.length > MAX_PANEL_CONTENT_LENGTH) {
    throw new AppError(400, "Le texte du panneau est trop long.", "CONTENT_TOO_LONG");
  }
  return s;
}

function normalizeEmbedColor(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 0xffffff) {
    throw new AppError(400, "Couleur embed invalide.", "INVALID_COLOR");
  }
  return v;
}

async function normalizeOptionalEmbedTemplateId(
  prisma: PrismaClient,
  guildId: string,
  v: unknown,
): Promise<string | null> {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return null;
  const id = v.trim();
  if (!id) return null;
  const exists = await prisma.embed.findFirst({ where: { id, guildId }, select: { id: true } });
  if (!exists) {
    throw new AppError(404, "Modèle Embed introuvable pour ce serveur.", "EMBED_TEMPLATE_NOT_FOUND");
  }
  return id;
}

/** IDs Discord depuis JSON (réglages / panel). */
function normalizeVerifiedRoleIds(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of v) {
    if (typeof x !== "string") continue;
    const id = x.trim();
    if (!/^\d{5,25}$/.test(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= MAX_VERIFIED_ROLES) break;
  }
  return out;
}

function mapRow(
  row:
    | {
        moduleEnabled: boolean;
        channelId: string | null;
        unverifiedRoleId: string | null;
        panelMessageId: string | null;
        panelContent: string | null;
        panelUseEmbed: boolean;
        panelEmbedColor: number | null;
        panelEmbedId: string | null;
        buttonLabel: string | null;
        verifiedRoleIds: unknown;
      }
    | undefined
    | null,
): JoinVerificationSettingsDto {
  if (!row) {
    return {
      moduleEnabled: false,
      channelId: null,
      unverifiedRoleId: null,
      panelMessageId: null,
      panelContent: null,
      panelUseEmbed: true,
      panelEmbedColor: null,
      panelEmbedId: null,
      buttonLabel: null,
      verifiedRoleIds: [],
    };
  }
  return {
    moduleEnabled: row.moduleEnabled,
    channelId: row.channelId,
    unverifiedRoleId: row.unverifiedRoleId,
    panelMessageId: row.panelMessageId,
    panelContent: row.panelContent,
    panelUseEmbed: row.panelUseEmbed,
    panelEmbedColor: row.panelEmbedColor,
    panelEmbedId: row.panelEmbedId,
    buttonLabel: row.buttonLabel,
    verifiedRoleIds: normalizeVerifiedRoleIds(row.verifiedRoleIds),
  };
}

export async function getJoinVerificationSettings(
  prisma: PrismaClient,
  discordGuildId: string,
): Promise<JoinVerificationSettingsDto> {
  const guild = await prisma.guild.findUnique({
    where: { discordId: discordGuildId },
    select: { id: true },
  });
  if (!guild) return mapRow(null);
  const row = await prisma.joinVerificationSettings.findUnique({
    where: { guildId: guild.id },
    select: {
      moduleEnabled: true,
      channelId: true,
      unverifiedRoleId: true,
      panelMessageId: true,
      panelContent: true,
      panelUseEmbed: true,
      panelEmbedColor: true,
      panelEmbedId: true,
      buttonLabel: true,
      verifiedRoleIds: true,
    },
  });
  return mapRow(row ?? null);
}

export async function upsertJoinVerificationSettings(
  prisma: PrismaClient,
  discordGuildId: string,
  guildNameHint: string | null | undefined,
  body: unknown,
): Promise<JoinVerificationSettingsDto> {
  const raw = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const guildId = await ensureGuildForDiscord(prisma, discordGuildId, guildNameHint);
  const existing = await prisma.joinVerificationSettings.findUnique({ where: { guildId } });

  let moduleEnabled = existing?.moduleEnabled ?? false;
  let channelId = existing?.channelId ?? null;
  let unverifiedRoleId = existing?.unverifiedRoleId ?? null;
  let panelMessageId = existing?.panelMessageId ?? null;
  let panelContent = existing?.panelContent ?? null;
  let panelUseEmbed = existing?.panelUseEmbed ?? true;
  let panelEmbedColor = existing?.panelEmbedColor ?? null;
  let panelEmbedId = existing?.panelEmbedId ?? null;
  let buttonLabel = existing?.buttonLabel ?? null;
  let verifiedRoleIds = normalizeVerifiedRoleIds(existing?.verifiedRoleIds);

  if (Object.prototype.hasOwnProperty.call(raw, "moduleEnabled")) {
    moduleEnabled = normalizeBool(raw.moduleEnabled);
  }
  if (Object.prototype.hasOwnProperty.call(raw, "channelId")) {
    channelId = normalizeDiscordId(raw.channelId, "Salon");
  }
  if (Object.prototype.hasOwnProperty.call(raw, "unverifiedRoleId")) {
    unverifiedRoleId = normalizeDiscordId(raw.unverifiedRoleId, "Rôle");
  }
  if (Object.prototype.hasOwnProperty.call(raw, "panelMessageId")) {
    const v = raw.panelMessageId;
    if (v === null) panelMessageId = null;
    else panelMessageId = normalizeDiscordId(v, "Message panneau");
  }
  if (Object.prototype.hasOwnProperty.call(raw, "panelContent")) {
    panelContent = normalizeContent(raw.panelContent);
  }
  if (Object.prototype.hasOwnProperty.call(raw, "panelUseEmbed")) {
    panelUseEmbed = normalizeBool(raw.panelUseEmbed);
  }
  if (Object.prototype.hasOwnProperty.call(raw, "panelEmbedColor")) {
    panelEmbedColor = normalizeEmbedColor(raw.panelEmbedColor);
  }
  if (Object.prototype.hasOwnProperty.call(raw, "panelEmbedId")) {
    panelEmbedId = await normalizeOptionalEmbedTemplateId(prisma, guildId, raw.panelEmbedId);
  }
  if (Object.prototype.hasOwnProperty.call(raw, "buttonLabel")) {
    buttonLabel = normalizeButtonLabel(raw.buttonLabel);
  }
  if (Object.prototype.hasOwnProperty.call(raw, "verifiedRoleIds")) {
    verifiedRoleIds = normalizeVerifiedRoleIds(raw.verifiedRoleIds);
  }

  if (unverifiedRoleId !== null && unverifiedRoleId === discordGuildId) {
    throw new AppError(400, "Le rôle @everyone ne peut pas servir de rôle non vérifié.", "INVALID_ROLE");
  }

  if (unverifiedRoleId !== null && verifiedRoleIds.includes(unverifiedRoleId)) {
    throw new AppError(
      400,
      "Le rôle « non vérifié » ne doit pas être dans les rôles attribués après validation.",
      "INVALID_ROLE_LIST",
    );
  }

  if (panelEmbedId) {
    panelUseEmbed = true;
    panelEmbedColor = null;
  }

  await prisma.joinVerificationSettings.upsert({
    where: { guildId },
    create: {
      guildId,
      moduleEnabled,
      channelId,
      unverifiedRoleId,
      panelMessageId,
      panelContent,
      panelUseEmbed,
      panelEmbedColor,
      panelEmbedId,
      buttonLabel,
      verifiedRoleIds,
    },
    update: {
      moduleEnabled,
      channelId,
      unverifiedRoleId,
      panelMessageId,
      panelContent,
      panelUseEmbed,
      panelEmbedColor,
      panelEmbedId,
      buttonLabel,
      verifiedRoleIds,
    },
  });

  if (!moduleEnabled) {
    await prisma.joinVerificationCaptcha.deleteMany({ where: { guildId } });
  }

  return getJoinVerificationSettings(prisma, discordGuildId);
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCaptchaCode(length = 6): string {
  let s = "";
  for (let i = 0; i < length; i++) {
    s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]!;
  }
  return s;
}

/** Bot : crée ou remplace un code captcha pour ce membre. */
export async function issueJoinVerificationCaptcha(
  prisma: PrismaClient,
  discordGuildId: string,
  discordUserId: string,
): Promise<{ ok: true; code: string } | { ok: false; reason: string }> {
  const guild = await prisma.guild.findUnique({
    where: { discordId: discordGuildId },
    select: { id: true },
  });
  if (!guild) return { ok: false, reason: "Serveur inconnu." };

  const settings = await prisma.joinVerificationSettings.findUnique({
    where: { guildId: guild.id },
  });
  if (!settings?.moduleEnabled) {
    return { ok: false, reason: "Module de vérification désactivé." };
  }
  if (!settings.channelId || !settings.unverifiedRoleId) {
    return { ok: false, reason: "Réglages incomplets." };
  }

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  const code = randomCaptchaCode(6);

  await prisma.joinVerificationCaptcha.upsert({
    where: {
      guildId_discordUserId: { guildId: guild.id, discordUserId },
    },
    create: {
      guildId: guild.id,
      discordUserId,
      code,
      expiresAt,
    },
    update: {
      code,
      expiresAt,
    },
  });

  return { ok: true, code };
}

/** Bot : vérifie le code saisi ; si ok, supprime l’entrée. */
export async function consumeJoinVerificationCaptcha(
  prisma: PrismaClient,
  discordGuildId: string,
  discordUserId: string,
  submitted: string,
): Promise<{ ok: boolean }> {
  const guild = await prisma.guild.findUnique({
    where: { discordId: discordGuildId },
    select: { id: true },
  });
  if (!guild) return { ok: false };

  const row = await prisma.joinVerificationCaptcha.findUnique({
    where: {
      guildId_discordUserId: { guildId: guild.id, discordUserId },
    },
  });
  if (!row) return { ok: false };
  if (row.expiresAt.getTime() < Date.now()) {
    await prisma.joinVerificationCaptcha.delete({ where: { id: row.id } }).catch(() => {});
    return { ok: false };
  }

  const a = submitted.trim().toUpperCase();
  const b = row.code.trim().toUpperCase();
  if (a !== b) return { ok: false };

  await prisma.joinVerificationCaptcha.delete({ where: { id: row.id } });
  return { ok: true };
}
