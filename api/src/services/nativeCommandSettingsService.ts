import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { AppError } from "../lib/AppError.js";
import { ensureGuildForDiscord } from "./ensureGuild.js";
import {
  NATIVE_COMMANDS_CATALOG,
  isKnownNativeCommand,
  type NativeCommandCatalogEntry,
} from "./nativeCommandsCatalog.js";

export type NativeCommandSettingDto = {
  /** Nom logique de la commande (ex: "ping"). */
  commandName: string;
  /** Métadonnées d'affichage (depuis le catalogue). */
  displayName: string;
  description: string;
  icon: string;
  configPanelPath: string | null;
  /** Activée pour ce serveur. */
  enabled: boolean;
  /** IDs Discord des rôles autorisés (vide = personne : au moins un rôle requis). */
  allowedRoleIds: string[];
  /** IDs Discord des salons autorisés (vide = partout). */
  allowedChannelIds: string[];
};

/** Valeurs par défaut quand aucun réglage n'a encore été enregistré pour cette commande. */
function defaultsFor(entry: NativeCommandCatalogEntry): NativeCommandSettingDto {
  return {
    commandName: entry.name,
    displayName: entry.displayName,
    description: entry.description,
    icon: entry.icon,
    configPanelPath: entry.configPanelPath,
    enabled: true,
    allowedRoleIds: [],
    allowedChannelIds: [],
  };
}

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v === "string" && v.trim()) out.push(v.trim());
  }
  return out;
}

export async function listNativeCommandSettings(
  prisma: PrismaClient,
  discordGuildId: string,
  guildNameHint?: string | null,
): Promise<NativeCommandSettingDto[]> {
  const guildId = await ensureGuildForDiscord(prisma, discordGuildId, guildNameHint);
  const rows = await prisma.nativeCommandSetting.findMany({ where: { guildId } });
  const byName = new Map(rows.map((r) => [r.commandName, r]));

  return NATIVE_COMMANDS_CATALOG.map((entry) => {
    const row = byName.get(entry.name);
    if (!row) return defaultsFor(entry);
    return {
      ...defaultsFor(entry),
      enabled: row.enabled,
      allowedRoleIds: parseStringArray(row.allowedRoleIds),
      allowedChannelIds: parseStringArray(row.allowedChannelIds),
    };
  });
}

const updateSchema = z.object({
  enabled: z.boolean().optional(),
  allowedRoleIds: z.array(z.string().min(1).max(64)).max(50).optional(),
  allowedChannelIds: z.array(z.string().min(1).max(64)).max(50).optional(),
});

export async function updateNativeCommandSetting(
  prisma: PrismaClient,
  discordGuildId: string,
  guildNameHint: string | null | undefined,
  commandName: string,
  body: unknown,
): Promise<NativeCommandSettingDto> {
  if (!isKnownNativeCommand(commandName)) {
    throw new AppError(404, "Commande native inconnue.", "NATIVE_COMMAND_UNKNOWN");
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(400, parsed.error.issues[0]?.message ?? "Données invalides.", "INVALID");
  }
  const input = parsed.data;

  const guildId = await ensureGuildForDiscord(prisma, discordGuildId, guildNameHint);

  // Récupère l'état actuel pour merger les champs absents.
  const existing = await prisma.nativeCommandSetting.findUnique({
    where: { guildId_commandName: { guildId, commandName } },
  });

  const nextEnabled = input.enabled ?? existing?.enabled ?? true;
  const nextRoles = input.allowedRoleIds ?? parseStringArray(existing?.allowedRoleIds);
  const nextChannels = input.allowedChannelIds ?? parseStringArray(existing?.allowedChannelIds);

  await prisma.nativeCommandSetting.upsert({
    where: { guildId_commandName: { guildId, commandName } },
    create: {
      guildId,
      commandName,
      enabled: nextEnabled,
      allowedRoleIds: nextRoles,
      allowedChannelIds: nextChannels,
    },
    update: {
      enabled: nextEnabled,
      allowedRoleIds: nextRoles,
      allowedChannelIds: nextChannels,
    },
  });

  const all = await listNativeCommandSettings(prisma, discordGuildId, guildNameHint);
  const dto = all.find((c) => c.commandName === commandName);
  if (!dto) {
    throw new AppError(500, "Lecture impossible après mise à jour.", "INTERNAL");
  }
  return dto;
}

/**
 * Évalue si une commande native est utilisable par un membre dans un salon donné.
 * Rôles : liste vide = aucun accès (il faut au moins un rôle autorisé).
 * Salons : liste vide = pas de restriction de salon.
 * Utilisé par l'API interne consommée par le bot.
 */
export async function evaluateNativeCommandAccess(
  prisma: PrismaClient,
  discordGuildId: string,
  commandName: string,
  memberRoleIds: string[],
  channelId: string | null,
): Promise<{ allowed: true } | { allowed: false; reason: "disabled" | "role" | "channel" }> {
  if (!isKnownNativeCommand(commandName)) {
    return { allowed: true };
  }

  const guild = await prisma.guild.findUnique({ where: { discordId: discordGuildId } });
  if (!guild) return { allowed: true };

  const row = await prisma.nativeCommandSetting.findUnique({
    where: { guildId_commandName: { guildId: guild.id, commandName } },
  });

  const enabled = row?.enabled ?? true;
  if (!enabled) return { allowed: false, reason: "disabled" };

  const allowedRoles = parseStringArray(row?.allowedRoleIds);
  if (allowedRoles.length === 0) {
    return { allowed: false, reason: "role" };
  }
  const roleOk = memberRoleIds.some((r) => allowedRoles.includes(r));
  if (!roleOk) return { allowed: false, reason: "role" };

  const allowedChannels = parseStringArray(row?.allowedChannelIds);
  if (allowedChannels.length > 0) {
    if (!channelId || !allowedChannels.includes(channelId)) {
      return { allowed: false, reason: "channel" };
    }
  }

  return { allowed: true };
}
