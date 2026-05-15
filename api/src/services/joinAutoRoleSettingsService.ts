import type { Prisma, PrismaClient } from "@prisma/client";
import { AppError } from "../lib/AppError.js";
import { ensureGuildForDiscord } from "./ensureGuild.js";

export type JoinAutoRoleSettingsDto = {
  moduleEnabled: boolean;
  /** IDs Discord des rôles à ajouter à l’arrivée (ordre conservé). */
  discordRoleIds: string[];
};

const MAX_ROLES = 15;

function normalizeBool(v: unknown): boolean {
  if (typeof v !== "boolean") {
    throw new AppError(400, "Valeur booléenne attendue (true / false).", "INVALID_FIELD");
  }
  return v;
}

function parseStoredRoleIds(raw: Prisma.JsonValue | null | undefined): string[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") continue;
    const id = x.trim();
    if (!/^\d{5,25}$/.test(id)) continue;
    out.push(id);
  }
  return out;
}

function normalizeRoleIdsInput(raw: unknown, everyoneRoleId: string): string[] {
  if (raw === null || raw === undefined) return [];
  if (!Array.isArray(raw)) {
    throw new AppError(400, "La liste de rôles doit être un tableau.", "INVALID_FIELD");
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of raw) {
    if (typeof x !== "string") {
      throw new AppError(400, "Chaque rôle doit être un identifiant texte.", "INVALID_FIELD");
    }
    const id = x.trim();
    if (!id) continue;
    if (!/^\d{5,25}$/.test(id)) {
      throw new AppError(400, "Identifiant de rôle Discord invalide.", "INVALID_ID");
    }
    if (id === everyoneRoleId) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length > MAX_ROLES) {
      throw new AppError(
        400,
        `Tu ne peux pas sélectionner plus de ${MAX_ROLES} rôles pour l’arrivée.`,
        "TOO_MANY_ROLES",
      );
    }
  }
  return out;
}

function mapRow(
  row: { moduleEnabled: boolean; discordRoleIds: Prisma.JsonValue } | null,
  everyoneRoleId: string,
): JoinAutoRoleSettingsDto {
  if (!row) {
    return { moduleEnabled: false, discordRoleIds: [] };
  }
  const ids = parseStoredRoleIds(row.discordRoleIds).filter((id) => id !== everyoneRoleId);
  return { moduleEnabled: row.moduleEnabled, discordRoleIds: ids };
}

export async function getJoinAutoRoleSettings(
  prisma: PrismaClient,
  discordGuildId: string,
): Promise<JoinAutoRoleSettingsDto> {
  const guild = await prisma.guild.findUnique({
    where: { discordId: discordGuildId },
    select: { id: true, discordId: true },
  });
  if (!guild) return mapRow(null, discordGuildId);
  const row = await prisma.joinAutoRoleSettings.findUnique({
    where: { guildId: guild.id },
  });
  return mapRow(row, guild.discordId);
}

export async function upsertJoinAutoRoleSettings(
  prisma: PrismaClient,
  discordGuildId: string,
  guildNameHint: string | null | undefined,
  body: unknown,
): Promise<JoinAutoRoleSettingsDto> {
  const raw = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const guildId = await ensureGuildForDiscord(prisma, discordGuildId, guildNameHint);
  const guildRow = await prisma.guild.findUnique({
    where: { id: guildId },
    select: { discordId: true },
  });
  const everyoneId = guildRow?.discordId ?? discordGuildId;

  const existing = await prisma.joinAutoRoleSettings.findUnique({ where: { guildId } });
  let moduleEnabled = existing?.moduleEnabled ?? false;
  let discordRoleIds = parseStoredRoleIds(existing?.discordRoleIds).filter((id) => id !== everyoneId);

  if (Object.prototype.hasOwnProperty.call(raw, "moduleEnabled")) {
    moduleEnabled = normalizeBool(raw.moduleEnabled);
  }
  if (Object.prototype.hasOwnProperty.call(raw, "discordRoleIds")) {
    discordRoleIds = normalizeRoleIdsInput(raw.discordRoleIds, everyoneId);
  }

  const jsonIds = discordRoleIds as unknown as Prisma.InputJsonValue;

  await prisma.joinAutoRoleSettings.upsert({
    where: { guildId },
    create: {
      guildId,
      moduleEnabled,
      discordRoleIds: jsonIds,
    },
    update: {
      moduleEnabled,
      discordRoleIds: jsonIds,
    },
  });

  return getJoinAutoRoleSettings(prisma, discordGuildId);
}
