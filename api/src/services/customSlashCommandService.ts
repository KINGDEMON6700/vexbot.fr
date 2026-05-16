import type { CustomSlashResponseType, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { AppError } from "../lib/AppError.js";
import { ensureGuildForDiscord } from "./ensureGuild.js";
import {
  createGuildSlashCommand,
  deleteGuildSlashCommand,
  patchGuildSlashCommand,
} from "./discordSlashCommandsClient.js";

export type CustomSlashCommandDto = {
  id: string;
  name: string;
  description: string;
  responseType: CustomSlashResponseType;
  responseText: string | null;
  embedId: string | null;
  ephemeral: boolean;
  enabled: boolean;
  allowedRoleIds: string[];
  allowedChannelIds: string[];
  discordCommandId: string | null;
  createdAt: string;
  updatedAt: string;
};

const RESPONSE_TYPES = ["PLAIN_TEXT", "EMBED_INLINE", "EMBED_TEMPLATE"] as const;

/**
 * Validation du nom : Discord exige 1-32 caractères, minuscules, lettres/chiffres/_/-.
 * On force aussi à commencer par une lettre ou un chiffre.
 */
const nameSchema = z
  .string()
  .min(1, "Donne un nom à la commande.")
  .max(32, "Le nom doit faire au plus 32 caractères.")
  .regex(
    /^[a-z0-9][a-z0-9_-]*$/,
    "Lettres minuscules, chiffres, tiret ou underscore uniquement (sans espaces).",
  );

const descSchema = z
  .string()
  .min(1, "La description ne peut pas être vide.")
  .max(100, "La description doit faire au plus 100 caractères.");

const responseTextSchema = z
  .string()
  .max(2000, "La réponse doit faire au plus 2000 caractères.");

const idArraySchema = z.array(z.string().min(1).max(64)).max(50);

const createSchema = z.object({
  name: nameSchema,
  description: descSchema,
  responseType: z.enum(RESPONSE_TYPES),
  responseText: responseTextSchema.nullable().optional(),
  embedId: z.string().min(1).max(64).nullable().optional(),
  ephemeral: z.boolean().optional(),
  enabled: z.boolean().optional(),
  allowedRoleIds: idArraySchema.optional(),
  allowedChannelIds: idArraySchema.optional(),
});

const updateSchema = createSchema.partial();

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v === "string" && v.trim()) out.push(v.trim());
  }
  return out;
}

function rowToDto(row: {
  id: string;
  name: string;
  description: string;
  responseType: CustomSlashResponseType;
  responseText: string | null;
  embedId: string | null;
  ephemeral: boolean;
  enabled: boolean;
  allowedRoleIds: unknown;
  allowedChannelIds: unknown;
  discordCommandId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): CustomSlashCommandDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    responseType: row.responseType,
    responseText: row.responseText,
    embedId: row.embedId,
    ephemeral: row.ephemeral,
    enabled: row.enabled,
    allowedRoleIds: parseStringArray(row.allowedRoleIds),
    allowedChannelIds: parseStringArray(row.allowedChannelIds),
    discordCommandId: row.discordCommandId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function assertEmbedBelongsToGuild(
  prisma: PrismaClient,
  guildId: string,
  embedId: string,
): Promise<void> {
  const found = await prisma.embed.findFirst({ where: { id: embedId, guildId } });
  if (!found) {
    throw new AppError(400, "Le modèle d'embed sélectionné est introuvable.", "EMBED_NOT_FOUND");
  }
}

function checkResponseConsistency(
  responseType: CustomSlashResponseType,
  responseText: string | null | undefined,
  embedId: string | null | undefined,
): void {
  if (responseType === "PLAIN_TEXT") {
    if (!responseText || !responseText.trim()) {
      throw new AppError(
        400,
        "Pour une réponse texte, écris le texte que la commande doit renvoyer.",
        "RESPONSE_TEXT_EMPTY",
      );
    }
  } else if (responseType === "EMBED_TEMPLATE") {
    if (!embedId) {
      throw new AppError(
        400,
        "Pour une réponse en embed, sélectionne un modèle d'embed.",
        "EMBED_REQUIRED",
      );
    }
  }
}

export async function listCustomSlashCommands(
  prisma: PrismaClient,
  discordGuildId: string,
  guildNameHint?: string | null,
): Promise<CustomSlashCommandDto[]> {
  const guildId = await ensureGuildForDiscord(prisma, discordGuildId, guildNameHint);
  const rows = await prisma.customSlashCommand.findMany({
    where: { guildId },
    orderBy: { name: "asc" },
  });
  return rows.map(rowToDto);
}

export async function getCustomSlashCommand(
  prisma: PrismaClient,
  discordGuildId: string,
  id: string,
): Promise<CustomSlashCommandDto> {
  const guild = await prisma.guild.findUnique({ where: { discordId: discordGuildId } });
  if (!guild) throw new AppError(404, "Serveur introuvable.", "GUILD_NOT_FOUND");
  const row = await prisma.customSlashCommand.findFirst({
    where: { id, guildId: guild.id },
  });
  if (!row) throw new AppError(404, "Commande introuvable.", "COMMAND_NOT_FOUND");
  return rowToDto(row);
}

export async function createCustomSlashCommand(
  prisma: PrismaClient,
  discordGuildId: string,
  guildNameHint: string | null | undefined,
  body: unknown,
  applicationId: string,
  botToken: string,
): Promise<CustomSlashCommandDto> {
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(400, parsed.error.issues[0]?.message ?? "Données invalides.", "INVALID");
  }
  const input = parsed.data;

  // Brouillon : le panel crée nom + description puis l’éditeur remplit la réponse (`checkResponseConsistency` sur update).
  const guildId = await ensureGuildForDiscord(prisma, discordGuildId, guildNameHint);

  if (input.embedId) {
    await assertEmbedBelongsToGuild(prisma, guildId, input.embedId);
  }

  // Conflit de nom : Discord refusera, autant donner une erreur claire avant.
  const existing = await prisma.customSlashCommand.findUnique({
    where: { guildId_name: { guildId, name: input.name } },
  });
  if (existing) {
    throw new AppError(409, "Une commande avec ce nom existe déjà sur ce serveur.", "NAME_TAKEN");
  }

  // Création côté Discord si la commande est activée. Si désactivée, on crée
  // seulement en base et on enregistrera côté Discord lors d'une éventuelle
  // activation.
  let discordCommandId: string | null = null;
  if (input.enabled !== false) {
    const created = await createGuildSlashCommand(applicationId, discordGuildId, botToken, {
      name: input.name,
      description: input.description,
    });
    discordCommandId = created.id;
  }

  const row = await prisma.customSlashCommand.create({
    data: {
      guildId,
      name: input.name,
      description: input.description,
      responseType: input.responseType,
      responseText: input.responseText ?? null,
      embedId: input.embedId ?? null,
      ephemeral: input.ephemeral ?? false,
      enabled: input.enabled ?? true,
      allowedRoleIds: input.allowedRoleIds ?? [],
      allowedChannelIds: input.allowedChannelIds ?? [],
      discordCommandId,
    },
  });
  return rowToDto(row);
}

export async function updateCustomSlashCommand(
  prisma: PrismaClient,
  discordGuildId: string,
  id: string,
  body: unknown,
  applicationId: string,
  botToken: string,
): Promise<CustomSlashCommandDto> {
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(400, parsed.error.issues[0]?.message ?? "Données invalides.", "INVALID");
  }
  const input = parsed.data;

  const guild = await prisma.guild.findUnique({ where: { discordId: discordGuildId } });
  if (!guild) throw new AppError(404, "Serveur introuvable.", "GUILD_NOT_FOUND");

  const existing = await prisma.customSlashCommand.findFirst({
    where: { id, guildId: guild.id },
  });
  if (!existing) throw new AppError(404, "Commande introuvable.", "COMMAND_NOT_FOUND");

  // Vérifie le conflit de nom si on change le nom.
  if (input.name && input.name !== existing.name) {
    const conflict = await prisma.customSlashCommand.findUnique({
      where: { guildId_name: { guildId: guild.id, name: input.name } },
    });
    if (conflict) {
      throw new AppError(409, "Une commande avec ce nom existe déjà sur ce serveur.", "NAME_TAKEN");
    }
  }

  if (input.embedId) {
    await assertEmbedBelongsToGuild(prisma, guild.id, input.embedId);
  }

  const nextName = input.name ?? existing.name;
  const nextDescription = input.description ?? existing.description;
  const nextResponseType = input.responseType ?? existing.responseType;
  const nextResponseText = input.responseText === undefined ? existing.responseText : input.responseText;
  const nextEmbedId = input.embedId === undefined ? existing.embedId : input.embedId;
  const nextEphemeral = input.ephemeral ?? existing.ephemeral;
  const nextEnabled = input.enabled ?? existing.enabled;
  const nextRoles = input.allowedRoleIds ?? parseStringArray(existing.allowedRoleIds);
  const nextChannels = input.allowedChannelIds ?? parseStringArray(existing.allowedChannelIds);

  checkResponseConsistency(nextResponseType, nextResponseText, nextEmbedId);

  // Synchro Discord :
  //   - si on désactive : DELETE la commande côté Discord (elle disparaît du serveur).
  //   - si on (ré)active : POST une nouvelle commande, on récupère un nouvel ID.
  //   - si on change nom/description et qu'elle est enregistrée : PATCH.
  let nextDiscordCommandId: string | null = existing.discordCommandId;
  const wasRegistered = existing.discordCommandId !== null && existing.enabled;

  if (!nextEnabled && wasRegistered && existing.discordCommandId) {
    await deleteGuildSlashCommand(
      applicationId,
      discordGuildId,
      botToken,
      existing.discordCommandId,
    );
    nextDiscordCommandId = null;
  } else if (nextEnabled && !wasRegistered) {
    const created = await createGuildSlashCommand(applicationId, discordGuildId, botToken, {
      name: nextName,
      description: nextDescription,
    });
    nextDiscordCommandId = created.id;
  } else if (
    nextEnabled &&
    wasRegistered &&
    existing.discordCommandId &&
    (nextName !== existing.name || nextDescription !== existing.description)
  ) {
    await patchGuildSlashCommand(
      applicationId,
      discordGuildId,
      botToken,
      existing.discordCommandId,
      { name: nextName, description: nextDescription },
    );
  }

  const row = await prisma.customSlashCommand.update({
    where: { id },
    data: {
      name: nextName,
      description: nextDescription,
      responseType: nextResponseType,
      responseText: nextResponseText,
      embedId: nextEmbedId,
      ephemeral: nextEphemeral,
      enabled: nextEnabled,
      allowedRoleIds: nextRoles,
      allowedChannelIds: nextChannels,
      discordCommandId: nextDiscordCommandId,
    },
  });
  return rowToDto(row);
}

export async function deleteCustomSlashCommand(
  prisma: PrismaClient,
  discordGuildId: string,
  id: string,
  applicationId: string,
  botToken: string,
): Promise<void> {
  const guild = await prisma.guild.findUnique({ where: { discordId: discordGuildId } });
  if (!guild) throw new AppError(404, "Serveur introuvable.", "GUILD_NOT_FOUND");

  const existing = await prisma.customSlashCommand.findFirst({
    where: { id, guildId: guild.id },
  });
  if (!existing) throw new AppError(404, "Commande introuvable.", "COMMAND_NOT_FOUND");

  if (existing.discordCommandId) {
    await deleteGuildSlashCommand(
      applicationId,
      discordGuildId,
      botToken,
      existing.discordCommandId,
    );
  }
  await prisma.customSlashCommand.delete({ where: { id } });
}

/**
 * Résolution d'une commande custom pour le bot.
 * Le bot appelle cet endpoint quand une slash command non native est invoquée.
 * Rôles autorisés vides = aucun accès (au moins un rôle requis).
 */
export type CustomCommandResolution =
  | {
      ok: true;
      ephemeral: boolean;
      responseType: CustomSlashResponseType;
      responseText: string | null;
      embedId: string | null;
    }
  | { ok: false; reason: "not_found" | "disabled" | "role" | "channel" };

export async function resolveCustomCommandForBot(
  prisma: PrismaClient,
  discordGuildId: string,
  commandName: string,
  memberRoleIds: string[],
  channelId: string | null,
): Promise<CustomCommandResolution> {
  const guild = await prisma.guild.findUnique({ where: { discordId: discordGuildId } });
  if (!guild) return { ok: false, reason: "not_found" };

  const row = await prisma.customSlashCommand.findUnique({
    where: { guildId_name: { guildId: guild.id, name: commandName } },
  });
  if (!row) return { ok: false, reason: "not_found" };
  if (!row.enabled) return { ok: false, reason: "disabled" };

  const allowedRoles = parseStringArray(row.allowedRoleIds);
  if (allowedRoles.length === 0) {
    return { ok: false, reason: "role" };
  }
  const roleOk = memberRoleIds.some((r) => allowedRoles.includes(r));
  if (!roleOk) return { ok: false, reason: "role" };

  const allowedChannels = parseStringArray(row.allowedChannelIds);
  if (allowedChannels.length > 0) {
    if (!channelId || !allowedChannels.includes(channelId)) {
      return { ok: false, reason: "channel" };
    }
  }

  return {
    ok: true,
    ephemeral: row.ephemeral,
    responseType: row.responseType,
    responseText: row.responseText,
    embedId: row.embedId,
  };
}
