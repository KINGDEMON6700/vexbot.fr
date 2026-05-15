import type { JoinVerificationMode, PrismaClient } from "@prisma/client";
import { AppError } from "../lib/AppError.js";
import { ensureGuildForDiscord } from "./ensureGuild.js";

export type JoinVerificationSettingsDto = {
  moduleEnabled: boolean;
  mode: JoinVerificationMode;
  channelId: string | null;
  unverifiedRoleId: string | null;
  panelMessageId: string | null;
  buttonLabel: string | null;
};

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

function normalizeMode(v: unknown): JoinVerificationMode {
  if (v === "CAPTCHA" || v === "BUTTON") return v;
  throw new AppError(400, "Mode invalide (CAPTCHA ou BUTTON).", "INVALID_FIELD");
}

function normalizeButtonLabel(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  return s.slice(0, 80);
}

function mapRow(
  row: {
    moduleEnabled: boolean;
    mode: JoinVerificationMode;
    channelId: string | null;
    unverifiedRoleId: string | null;
    panelMessageId: string | null;
    buttonLabel: string | null;
  } | null,
): JoinVerificationSettingsDto {
  if (!row) {
    return {
      moduleEnabled: false,
      mode: "BUTTON",
      channelId: null,
      unverifiedRoleId: null,
      panelMessageId: null,
      buttonLabel: null,
    };
  }
  return {
    moduleEnabled: row.moduleEnabled,
    mode: row.mode,
    channelId: row.channelId,
    unverifiedRoleId: row.unverifiedRoleId,
    panelMessageId: row.panelMessageId,
    buttonLabel: row.buttonLabel,
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
  });
  return mapRow(row);
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
  let mode: JoinVerificationMode = existing?.mode ?? "BUTTON";
  let channelId = existing?.channelId ?? null;
  let unverifiedRoleId = existing?.unverifiedRoleId ?? null;
  let panelMessageId = existing?.panelMessageId ?? null;
  let buttonLabel = existing?.buttonLabel ?? null;

  if (Object.prototype.hasOwnProperty.call(raw, "moduleEnabled")) {
    moduleEnabled = normalizeBool(raw.moduleEnabled);
  }
  if (Object.prototype.hasOwnProperty.call(raw, "mode")) {
    mode = normalizeMode(raw.mode);
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
  if (Object.prototype.hasOwnProperty.call(raw, "buttonLabel")) {
    buttonLabel = normalizeButtonLabel(raw.buttonLabel);
  }

  if (unverifiedRoleId !== null && unverifiedRoleId === discordGuildId) {
    throw new AppError(400, "Le rôle @everyone ne peut pas servir de rôle non vérifié.", "INVALID_ROLE");
  }

  await prisma.joinVerificationSettings.upsert({
    where: { guildId },
    create: {
      guildId,
      moduleEnabled,
      mode,
      channelId,
      unverifiedRoleId,
      panelMessageId,
      buttonLabel,
    },
    update: {
      moduleEnabled,
      mode,
      channelId,
      unverifiedRoleId,
      panelMessageId,
      buttonLabel,
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
  if (!settings?.moduleEnabled || settings.mode !== "CAPTCHA") {
    return { ok: false, reason: "Captcha non activé." };
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
