import { Prisma, type EmbedTimestampMode, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { AppError } from "../lib/AppError.js";
import { ensureGuildForDiscord } from "./ensureGuild.js";
import {
  componentBlockSchema,
  componentRowsSchema,
  sanitizeStoredComponent,
  type MessageComponentInput,
} from "./messageComponentsSchema.js";

const TIMESTAMP_MODES = ["NONE", "NOW", "FIXED"] as const satisfies readonly EmbedTimestampMode[];

const fieldSchema = z.object({
  name: z.string().max(256),
  value: z.string().max(1024),
  inline: z.boolean().optional().default(false),
});

function optionalHttpUrl(max = 2048) {
  return z
    .union([z.string().url().max(max), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v));
}

/** Un bloc embed (sans nom de modèle). */
const embedPartSchema = z.object({
  title: z.string().max(256).nullable().optional(),
  description: z.string().max(4096).nullable().optional(),
  color: z.number().int().min(0).max(0xffffff).nullable().optional(),
  url: optionalHttpUrl(),
  thumbnailUrl: optionalHttpUrl(),
  imageUrl: optionalHttpUrl(),
  authorName: z.string().max(256).nullable().optional(),
  authorUrl: optionalHttpUrl(),
  authorIconUrl: optionalHttpUrl(),
  footerText: z.string().max(2048).nullable().optional(),
  footerIconUrl: optionalHttpUrl(),
  fields: z.array(fieldSchema).max(25).optional(),
  timestampMode: z.enum(TIMESTAMP_MODES).optional(),
  fixedAt: z.union([z.string().datetime(), z.null()]).optional(),
});

const templateMessageSchema = z
  .object({
    messageContent: z.string().max(4000).nullable().optional(),
    /** Remplace le nom du bot pour ce message (aperçu / envoi futur). */
    profileDisplayName: z.string().max(80).nullable().optional(),
    /** Remplace l’avatar du bot pour ce message (URL). */
    profileAvatarUrl: optionalHttpUrl(),
    embeds: z.array(embedPartSchema).min(1).max(10),
    componentBlocks: z.array(componentBlockSchema).max(10),
  })
  .superRefine((msg, ctx) => {
    const totalRows = msg.componentBlocks.reduce((acc, b) => acc + b.rows.length, 0);
    if (totalRows > 5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Discord autorise au plus 5 lignes d’action par message (boutons), tous groupes de composants confondus.",
        path: ["componentBlocks"],
      });
    }
  });

const saveTemplateSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  messages: z.array(templateMessageSchema).min(1).max(10),
});

export type EmbedPartDto = {
  title: string | null;
  description: string | null;
  color: number | null;
  url: string | null;
  thumbnailUrl: string | null;
  imageUrl: string | null;
  authorName: string | null;
  authorUrl: string | null;
  authorIconUrl: string | null;
  footerText: string | null;
  footerIconUrl: string | null;
  fields: { name: string; value: string; inline: boolean }[];
  timestampMode: EmbedTimestampMode;
  fixedAt: string | null;
};

export type MessageComponentDto = MessageComponentInput;

export type ComponentRowDto = {
  components: MessageComponentDto[];
};

export type ComponentBlockDto = {
  rows: ComponentRowDto[];
};

export type TemplateMessageDto = {
  messageContent: string | null;
  profileDisplayName: string | null;
  profileAvatarUrl: string | null;
  embeds: EmbedPartDto[];
  componentBlocks: ComponentBlockDto[];
};

export type EmbedTemplateDto = {
  id: string;
  name: string;
  messages: TemplateMessageDto[];
  createdAt: string;
  updatedAt: string;
};

const EMBEDS_JSON_VERSION = 1;
const EMBEDS_JSON_VERSION_V2 = 2;
const EMBEDS_JSON_VERSION_V3 = 3;

function parseFieldsJson(raw: Prisma.JsonValue | null): { name: string; value: string; inline: boolean }[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return [];
  const out: { name: string; value: string; inline: boolean }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.slice(0, 256) : "";
    const value = typeof o.value === "string" ? o.value.slice(0, 1024) : "";
    const inline = Boolean(o.inline);
    if (name || value) out.push({ name, value, inline });
  }
  return out.slice(0, 25);
}

function legacyRowToEmbedPart(row: {
  title: string | null;
  description: string | null;
  color: number | null;
  url: string | null;
  thumbnailUrl: string | null;
  imageUrl: string | null;
  authorName: string | null;
  authorUrl: string | null;
  authorIconUrl: string | null;
  footerText: string | null;
  footerIconUrl: string | null;
  fields: Prisma.JsonValue | null;
  timestampMode: EmbedTimestampMode;
  fixedAt: Date | null;
}): EmbedPartDto {
  return {
    title: row.title,
    description: row.description,
    color: row.color,
    url: row.url,
    thumbnailUrl: row.thumbnailUrl,
    imageUrl: row.imageUrl,
    authorName: row.authorName,
    authorUrl: row.authorUrl,
    authorIconUrl: row.authorIconUrl,
    footerText: row.footerText,
    footerIconUrl: row.footerIconUrl,
    fields: parseFieldsJson(row.fields),
    timestampMode: row.timestampMode,
    fixedAt: row.fixedAt ? row.fixedAt.toISOString() : null,
  };
}

const EMPTY_EMBED_PART: EmbedPartDto = {
  title: null,
  description: null,
  color: null,
  url: null,
  thumbnailUrl: null,
  imageUrl: null,
  authorName: null,
  authorUrl: null,
  authorIconUrl: null,
  footerText: null,
  footerIconUrl: null,
  fields: [],
  timestampMode: "NONE",
  fixedAt: null,
};

function zodPartToDto(b: z.infer<typeof embedPartSchema>): EmbedPartDto {
  const timestampMode = (b.timestampMode ?? "NONE") as EmbedTimestampMode;
  let fixedAt: string | null = null;
  if (timestampMode === "FIXED") {
    if (!b.fixedAt) throw new AppError(400, "Choisis une date pour l’horodatage fixe.", "INVALID_BODY");
    fixedAt = b.fixedAt;
  }
  const fields =
    b.fields?.map((f) => ({
      name: f.name,
      value: f.value,
      inline: f.inline ?? false,
    })) ?? [];
  return {
    title: b.title ?? null,
    description: b.description ?? null,
    color: b.color ?? null,
    url: b.url ?? null,
    thumbnailUrl: b.thumbnailUrl ?? null,
    imageUrl: b.imageUrl ?? null,
    authorName: b.authorName ?? null,
    authorUrl: b.authorUrl ?? null,
    authorIconUrl: b.authorIconUrl ?? null,
    footerText: b.footerText ?? null,
    footerIconUrl: b.footerIconUrl ?? null,
    fields,
    timestampMode,
    fixedAt,
  };
}

/** Lecture JSON stockée : tolérant si une ancienne version manque un champ. */
function embedPartFromStored(raw: unknown): EmbedPartDto {
  const p = embedPartSchema.safeParse(raw);
  if (!p.success) return { ...EMPTY_EMBED_PART };
  try {
    return zodPartToDto(p.data);
  } catch {
    return { ...EMPTY_EMBED_PART };
  }
}

function parseComponentRowsFromStored(raw: unknown): ComponentRowDto[] {
  if (!Array.isArray(raw)) return [];
  const rows: ComponentRowDto[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as { components?: unknown };
    if (!Array.isArray(o.components)) continue;
    const components: MessageComponentDto[] = [];
    for (const c of o.components) {
      const s = sanitizeStoredComponent(c);
      if (s) components.push(s);
    }
    if (components.length === 0) continue;
    if (components.length > 5) components.splice(5);
    rows.push({ components });
  }
  const parsed = componentRowsSchema.safeParse(rows);
  if (!parsed.success) return [];
  return parsed.data.map((r) => ({
    components: r.components as MessageComponentDto[],
  }));
}

function parseComponentBlocksFromStored(raw: unknown): ComponentBlockDto[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const out: ComponentBlockDto[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    out.push({ rows: parseComponentRowsFromStored(o.rows) });
  }
  return out;
}

function parseMessagesFromStoredV3(raw: unknown): TemplateMessageDto[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const messages: TemplateMessageDto[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const embedsRaw = o.embeds;
    if (!Array.isArray(embedsRaw) || embedsRaw.length === 0) continue;
    const embeds = embedsRaw.map((e) => embedPartFromStored(e));
    const messageContent =
      o.messageContent === null || o.messageContent === undefined
        ? null
        : typeof o.messageContent === "string"
          ? o.messageContent
          : null;
    const profileDisplayName =
      typeof o.profileDisplayName === "string" ? o.profileDisplayName.trim().slice(0, 80) || null : null;
    let profileAvatarUrl: string | null = null;
    if (typeof o.profileAvatarUrl === "string" && o.profileAvatarUrl.trim()) {
      profileAvatarUrl = o.profileAvatarUrl.trim().slice(0, 2048);
    }
    const componentBlocks = parseComponentBlocksFromStored(o.componentBlocks);
    messages.push({ messageContent, profileDisplayName, profileAvatarUrl, embeds, componentBlocks });
  }
  return messages.length > 0 ? messages : null;
}

function parseTemplateFromRow(row: {
  messageContent: string | null;
  embedsJson: Prisma.JsonValue | null;
  title: string | null;
  description: string | null;
  color: number | null;
  url: string | null;
  thumbnailUrl: string | null;
  imageUrl: string | null;
  authorName: string | null;
  authorUrl: string | null;
  authorIconUrl: string | null;
  footerText: string | null;
  footerIconUrl: string | null;
  fields: Prisma.JsonValue | null;
  timestampMode: EmbedTimestampMode;
  fixedAt: Date | null;
}): TemplateMessageDto[] {
  const j = row.embedsJson;
  if (j && typeof j === "object" && !Array.isArray(j)) {
    const o = j as Record<string, unknown>;
    const ver = o.v;
    if (ver === EMBEDS_JSON_VERSION_V3) {
      const parsed = parseMessagesFromStoredV3(o.messages);
      if (parsed) return parsed;
    }
    const embedsRaw = o.embeds;
    if (ver === EMBEDS_JSON_VERSION_V2 && Array.isArray(embedsRaw) && embedsRaw.length > 0) {
      return [
        {
          messageContent: row.messageContent,
          profileDisplayName: null,
          profileAvatarUrl: null,
          embeds: embedsRaw.map((e) => embedPartFromStored(e)),
          componentBlocks: [{ rows: parseComponentRowsFromStored(o.componentRows) }],
        },
      ];
    }
    if (ver === EMBEDS_JSON_VERSION && Array.isArray(embedsRaw) && embedsRaw.length > 0) {
      return [
        {
          messageContent: row.messageContent,
          profileDisplayName: null,
          profileAvatarUrl: null,
          embeds: embedsRaw.map((e) => embedPartFromStored(e)),
          componentBlocks: [{ rows: [] }],
        },
      ];
    }
  }
  return [
    {
      messageContent: row.messageContent,
      profileDisplayName: null,
      profileAvatarUrl: null,
      embeds: [legacyRowToEmbedPart(row)],
      componentBlocks: [{ rows: [] }],
    },
  ];
}

function embedPartToPrismaData(part: EmbedPartDto): {
  title: string | null;
  description: string | null;
  color: number | null;
  url: string | null;
  thumbnailUrl: string | null;
  imageUrl: string | null;
  authorName: string | null;
  authorUrl: string | null;
  authorIconUrl: string | null;
  footerText: string | null;
  footerIconUrl: string | null;
  fields: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  timestampMode: EmbedTimestampMode;
  fixedAt: Date | null;
} {
  const timestampMode = part.timestampMode;
  let fixedAt: Date | null = null;
  if (timestampMode === "FIXED" && part.fixedAt) {
    fixedAt = new Date(part.fixedAt);
  }
  const fieldsJson =
    part.fields.length > 0
      ? (part.fields.map((f) => ({
          name: f.name,
          value: f.value,
          inline: f.inline,
        })) as Prisma.InputJsonValue)
      : Prisma.JsonNull;

  return {
    title: part.title,
    description: part.description,
    color: part.color,
    url: part.url,
    thumbnailUrl: part.thumbnailUrl,
    imageUrl: part.imageUrl,
    authorName: part.authorName,
    authorUrl: part.authorUrl,
    authorIconUrl: part.authorIconUrl,
    footerText: part.footerText,
    footerIconUrl: part.footerIconUrl,
    fields: fieldsJson,
    timestampMode,
    fixedAt,
  };
}

function toDto(row: {
  id: string;
  name: string;
  messageContent: string | null;
  embedsJson: Prisma.JsonValue | null;
  title: string | null;
  description: string | null;
  color: number | null;
  url: string | null;
  thumbnailUrl: string | null;
  imageUrl: string | null;
  authorName: string | null;
  authorUrl: string | null;
  authorIconUrl: string | null;
  footerText: string | null;
  footerIconUrl: string | null;
  fields: Prisma.JsonValue | null;
  timestampMode: EmbedTimestampMode;
  fixedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): EmbedTemplateDto {
  const messages = parseTemplateFromRow(row);
  return {
    id: row.id,
    name: row.name,
    messages,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function buildEmbedsJson(messages: TemplateMessageDto[]): Prisma.InputJsonValue {
  return {
    v: EMBEDS_JSON_VERSION_V3,
    messages: messages.map((m) => ({
      messageContent: m.messageContent,
      profileDisplayName: m.profileDisplayName,
      profileAvatarUrl: m.profileAvatarUrl,
      embeds: m.embeds.map((e) => ({
        title: e.title,
        description: e.description,
        color: e.color,
        url: e.url,
        thumbnailUrl: e.thumbnailUrl,
        imageUrl: e.imageUrl,
        authorName: e.authorName,
        authorUrl: e.authorUrl,
        authorIconUrl: e.authorIconUrl,
        footerText: e.footerText,
        footerIconUrl: e.footerIconUrl,
        fields: e.fields,
        timestampMode: e.timestampMode,
        fixedAt: e.fixedAt,
      })),
      componentBlocks: m.componentBlocks.map((b) => ({
        rows: b.rows.map((r) => ({
          components: r.components,
        })),
      })),
    })),
  };
}

function parseSaveBody(body: unknown): z.infer<typeof saveTemplateSchema> {
  const parsed = saveTemplateSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(400, "Données invalides.", "INVALID_BODY");
  }
  return parsed.data;
}

function normalizeMessagesFromSave(raw: z.infer<typeof saveTemplateSchema>["messages"]): TemplateMessageDto[] {
  return raw.map((m) => ({
    messageContent: m.messageContent ?? null,
    profileDisplayName: m.profileDisplayName ?? null,
    profileAvatarUrl: m.profileAvatarUrl ?? null,
    embeds: m.embeds.map((e) => zodPartToDto(e)),
    componentBlocks: m.componentBlocks.map((b) => ({
      rows: b.rows.map((r) => ({
        components: r.components as MessageComponentDto[],
      })),
    })),
  }));
}

export async function listEmbedTemplates(
  prisma: PrismaClient,
  discordGuildId: string,
  guildNameHint: string | null | undefined,
): Promise<EmbedTemplateDto[]> {
  const guildId = await ensureGuildForDiscord(prisma, discordGuildId, guildNameHint);
  const rows = await prisma.embed.findMany({
    where: { guildId },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(toDto);
}

export async function createEmbedTemplate(
  prisma: PrismaClient,
  discordGuildId: string,
  guildNameHint: string | null | undefined,
  body: unknown,
): Promise<EmbedTemplateDto> {
  const b = parseSaveBody(body);
  const messages = normalizeMessagesFromSave(b.messages);
  const firstMsg = messages[0]!;
  const firstEmbed = firstMsg.embeds[0]!;
  const first = embedPartToPrismaData(firstEmbed);
  const guildId = await ensureGuildForDiscord(prisma, discordGuildId, guildNameHint);

  try {
    const row = await prisma.embed.create({
      data: {
        guildId,
        name: b.name,
        messageContent: firstMsg.messageContent ?? null,
        embedsJson: buildEmbedsJson(messages),
        ...first,
      },
    });
    return toDto(row);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new AppError(409, "Tu as déjà un modèle avec ce nom. Choisis un autre nom.", "DUPLICATE_NAME");
    }
    throw e;
  }
}

export async function updateEmbedTemplate(
  prisma: PrismaClient,
  discordGuildId: string,
  guildNameHint: string | null | undefined,
  embedId: string,
  body: unknown,
): Promise<EmbedTemplateDto> {
  const b = parseSaveBody(body);
  const messages = normalizeMessagesFromSave(b.messages);
  const firstMsg = messages[0]!;
  const firstEmbed = firstMsg.embeds[0]!;
  const first = embedPartToPrismaData(firstEmbed);
  const guildId = await ensureGuildForDiscord(prisma, discordGuildId, guildNameHint);

  const existing = await prisma.embed.findFirst({
    where: { id: embedId, guildId },
  });
  if (!existing) {
    throw new AppError(404, "Modèle introuvable.", "NOT_FOUND");
  }

  try {
    const row = await prisma.embed.update({
      where: { id: embedId },
      data: {
        name: b.name,
        messageContent: firstMsg.messageContent ?? null,
        embedsJson: buildEmbedsJson(messages),
        ...first,
      },
    });
    return toDto(row);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new AppError(409, "Tu as déjà un modèle avec ce nom. Choisis un autre nom.", "DUPLICATE_NAME");
    }
    throw e;
  }
}

export async function deleteEmbedTemplate(
  prisma: PrismaClient,
  discordGuildId: string,
  guildNameHint: string | null | undefined,
  embedId: string,
): Promise<void> {
  const guildId = await ensureGuildForDiscord(prisma, discordGuildId, guildNameHint);
  const existing = await prisma.embed.findFirst({
    where: { id: embedId, guildId },
  });
  if (!existing) {
    throw new AppError(404, "Modèle introuvable.", "NOT_FOUND");
  }
  await prisma.embed.delete({ where: { id: embedId } });
}

/** Recherche d’un modèle Embeds par nom, sans créer de ligne Guild (insensible à la casse). */
export async function findEmbedTemplateDtoByNameCaseInsensitive(
  prisma: PrismaClient,
  discordGuildId: string,
  templateName: string,
): Promise<EmbedTemplateDto | null> {
  const guild = await prisma.guild.findUnique({
    where: { discordId: discordGuildId },
    select: { id: true },
  });
  if (!guild) return null;
  const needle = templateName.trim().toLowerCase();
  if (!needle) return null;
  const rows = await prisma.embed.findMany({
    where: { guildId: guild.id },
  });
  const row = rows.find((r) => r.name.trim().toLowerCase() === needle);
  if (!row) return null;
  return toDto(row);
}
