import { z } from "zod";
import { AppError } from "../lib/AppError.js";
import { componentBlockSchema, type MessageComponentInput } from "./messageComponentsSchema.js";

const DISCORD_API = "https://discord.com/api/v10";

const TIMESTAMP_MODES = ["NONE", "NOW", "FIXED"] as const;

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
    embeds: z.array(embedPartSchema).min(1).max(10),
    componentBlocks: z.array(componentBlockSchema).max(10),
  })
  .superRefine((msg, ctx) => {
    const totalRows = msg.componentBlocks.reduce((acc, b) => acc + b.rows.length, 0);
    if (totalRows > 5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Discord autorise au plus 5 lignes de composants par message.",
        path: ["componentBlocks"],
      });
    }
  });

const sendTemplateSchema = z.object({
  channelId: z.string().min(1).max(40),
  messages: z.array(templateMessageSchema).min(1).max(10),
});

type SendTemplateInput = z.infer<typeof sendTemplateSchema>;
type SendTemplateMessage = SendTemplateInput["messages"][number];
type SendTemplateEmbed = SendTemplateMessage["embeds"][number];

type DiscordEmbed = {
  title?: string;
  description?: string;
  color?: number;
  url?: string;
  author?: { name: string; url?: string; icon_url?: string };
  thumbnail?: { url: string };
  image?: { url: string };
  footer?: { text: string; icon_url?: string };
  fields?: { name: string; value: string; inline?: boolean }[];
  timestamp?: string;
};

type DiscordComponent =
  | {
      type: 2;
      style: 1 | 2 | 3 | 4;
      label: string;
      custom_id: string;
      disabled?: boolean;
    }
  | {
      type: 2;
      style: 5;
      label: string;
      url: string;
      disabled?: boolean;
    };

type DiscordActionRow = {
  type: 1;
  components: DiscordComponent[];
};

function trimToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function toDiscordTimestamp(mode: "NONE" | "NOW" | "FIXED", fixedAt: string | null | undefined): string | undefined {
  if (mode === "NONE") return undefined;
  if (mode === "NOW") return new Date().toISOString();
  return fixedAt ?? undefined;
}

function toDiscordEmbed(e: SendTemplateEmbed): DiscordEmbed {
  const title = trimToNull(e.title);
  const description = trimToNull(e.description);
  const url = trimToNull(e.url);
  const authorName = trimToNull(e.authorName);
  const authorUrl = trimToNull(e.authorUrl);
  const authorIconUrl = trimToNull(e.authorIconUrl);
  const thumbnailUrl = trimToNull(e.thumbnailUrl);
  const imageUrl = trimToNull(e.imageUrl);
  const footerText = trimToNull(e.footerText);
  const footerIconUrl = trimToNull(e.footerIconUrl);

  const fields =
    e.fields
      ?.map((f) => ({
        name: f.name.trim(),
        value: f.value.trim(),
        inline: f.inline ?? false,
      }))
      .filter((f) => f.name || f.value) ?? [];

  const out: DiscordEmbed = {};
  if (title) out.title = title;
  if (description) out.description = description;
  if (e.color != null) out.color = e.color;
  if (url) out.url = url;
  if (authorName) {
    out.author = { name: authorName };
    if (authorUrl) out.author.url = authorUrl;
    if (authorIconUrl) out.author.icon_url = authorIconUrl;
  }
  if (thumbnailUrl) out.thumbnail = { url: thumbnailUrl };
  if (imageUrl) out.image = { url: imageUrl };
  if (footerText) {
    out.footer = { text: footerText };
    if (footerIconUrl) out.footer.icon_url = footerIconUrl;
  }
  if (fields.length > 0) out.fields = fields;

  const timestampMode = e.timestampMode ?? "NONE";
  const timestamp = toDiscordTimestamp(timestampMode, e.fixedAt ?? null);
  if (timestamp) out.timestamp = timestamp;

  return out;
}

function buttonStyle(style: "primary" | "secondary" | "success" | "danger"): 1 | 2 | 3 | 4 {
  switch (style) {
    case "primary":
      return 1;
    case "secondary":
      return 2;
    case "success":
      return 3;
    case "danger":
      return 4;
  }
}

function toDiscordComponent(c: MessageComponentInput): DiscordComponent {
  if (c.type === "button") {
    return {
      type: 2,
      style: buttonStyle(c.style),
      label: c.label,
      custom_id: c.customId,
      disabled: c.disabled ?? false,
    };
  }
  return {
    type: 2,
    style: 5,
    label: c.label,
    url: c.url,
    disabled: c.disabled ?? false,
  };
}

function toDiscordActionRows(message: SendTemplateMessage): DiscordActionRow[] {
  return message.componentBlocks.flatMap((block) =>
    block.rows.map((row) => ({
      type: 1 as const,
      components: row.components.map((c) => toDiscordComponent(c as MessageComponentInput)),
    })),
  );
}

async function postMessageToChannel(
  channelId: string,
  botToken: string,
  body: { content?: string; embeds?: DiscordEmbed[]; components?: DiscordActionRow[] },
): Promise<void> {
  const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (res.ok) return;

  if (res.status === 404) {
    throw new AppError(400, "Salon introuvable, ou bot absent de ce serveur.", "CHANNEL_NOT_FOUND");
  }
  if (res.status === 403) {
    throw new AppError(
      400,
      "Le bot n’a pas la permission d’envoyer des messages dans ce salon.",
      "MISSING_PERMISSIONS",
    );
  }
  if (res.status === 429) {
    throw new AppError(429, "Discord limite temporairement l’envoi. Réessaie dans un instant.", "DISCORD_RATE_LIMIT");
  }

  throw new AppError(502, "Discord a refusé l’envoi du message.", "DISCORD_SEND_FAILED");
}

async function ensureChannelBelongsToGuild(
  channelId: string,
  discordGuildId: string,
  botToken: string,
): Promise<void> {
  const res = await fetch(`${DISCORD_API}/channels/${channelId}`, {
    headers: {
      Authorization: `Bot ${botToken}`,
    },
  });

  if (res.status === 404) {
    throw new AppError(400, "Salon introuvable.", "CHANNEL_NOT_FOUND");
  }
  if (res.status === 403) {
    throw new AppError(400, "Le bot n’a pas accès à ce salon.", "MISSING_PERMISSIONS");
  }
  if (!res.ok) {
    throw new AppError(502, "Impossible de vérifier le salon Discord.", "DISCORD_CHANNEL_LOOKUP_FAILED");
  }

  const data = (await res.json()) as { guild_id?: string | null };
  if (!data.guild_id || data.guild_id !== discordGuildId) {
    throw new AppError(400, "Le salon choisi ne fait pas partie de ce serveur.", "CHANNEL_WRONG_GUILD");
  }
}

export async function sendTemplateMessagesToChannel(
  discordGuildId: string,
  botToken: string,
  body: unknown,
): Promise<{ sent: number }> {
  const parsed = sendTemplateSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(400, "Données invalides pour l’envoi.", "INVALID_BODY");
  }

  const data = parsed.data;
  let sent = 0;
  await ensureChannelBelongsToGuild(data.channelId, discordGuildId, botToken);

  for (const msg of data.messages) {
    const content = trimToNull(msg.messageContent) ?? undefined;
    const embeds = msg.embeds.map((e) => toDiscordEmbed(e)).filter((e) => Object.keys(e).length > 0);
    const components = toDiscordActionRows(msg);

    if (!content && embeds.length === 0 && components.length === 0) {
      continue;
    }

    await postMessageToChannel(data.channelId, botToken, {
      content,
      embeds: embeds.length > 0 ? embeds : undefined,
      components: components.length > 0 ? components : undefined,
    });
    sent += 1;
  }

  if (sent === 0) {
    throw new AppError(400, "Rien à envoyer pour ce modèle.", "EMPTY_MESSAGES");
  }

  return { sent };
}
