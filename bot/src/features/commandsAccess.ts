import {
  EmbedBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";
import type { BotEnv } from "../config/env.js";
import { vexInternalPostJson } from "../lib/vexApi.js";

type EvaluateNativeResponse =
  | { allowed: true }
  | { allowed: false; reason: "disabled" | "role" | "channel" };

type ResolveCustomResponse =
  | {
      ok: true;
      ephemeral: boolean;
      responseType: "PLAIN_TEXT" | "EMBED_INLINE" | "EMBED_TEMPLATE";
      responseText: string | null;
      embedId: string | null;
      template?: TemplateDto | null;
    }
  | { ok: false; reason: "not_found" | "disabled" | "role" | "channel" };

type TemplateEmbedPartDto = {
  title?: string | null;
  description?: string | null;
  color?: number | null;
  url?: string | null;
  thumbnailUrl?: string | null;
  imageUrl?: string | null;
  authorName?: string | null;
  authorUrl?: string | null;
  authorIconUrl?: string | null;
  footerText?: string | null;
  footerIconUrl?: string | null;
  fields?: { name: string; value: string; inline?: boolean }[];
};

type TemplateMessageDto = {
  messageContent: string | null;
  embeds: TemplateEmbedPartDto[];
};

type TemplateDto = {
  messages: TemplateMessageDto[];
};

function extractMemberRoleIds(interaction: ChatInputCommandInteraction): string[] {
  const m = interaction.member as GuildMember | null;
  if (!m) return [];
  if ("roles" in m && m.roles && "cache" in m.roles) {
    return Array.from(m.roles.cache.keys());
  }
  // APIInteractionGuildMember : roles est string[]
  const raw = (interaction.member as unknown as { roles?: unknown }).roles;
  if (Array.isArray(raw)) return raw.filter((r): r is string => typeof r === "string");
  return [];
}

function reasonMessage(reason: "disabled" | "role" | "channel" | "not_found"): string {
  switch (reason) {
    case "disabled":
      return "Cette commande est désactivée sur ce serveur.";
    case "role":
      return "Tu n'as pas le rôle nécessaire pour utiliser cette commande ici.";
    case "channel":
      return "Cette commande n'est pas autorisée dans ce salon.";
    case "not_found":
      return "Commande inconnue.";
  }
}

/**
 * Vérifie qu'une commande native peut être exécutée par ce membre dans ce salon.
 * Si la vérification échoue, répond à l'interaction et renvoie `false`.
 * En cas d'erreur réseau, on autorise par défaut (fail-open) pour ne pas bloquer
 * un serveur si l'API est temporairement injoignable.
 */
export async function checkNativeCommandAccess(
  env: BotEnv,
  interaction: ChatInputCommandInteraction,
  commandName: string,
): Promise<boolean> {
  if (!interaction.guildId) return true;

  const result = await vexInternalPostJson<EvaluateNativeResponse>(
    env,
    "/commands/evaluate-native",
    {
      discordGuildId: interaction.guildId,
      commandName,
      memberRoleIds: extractMemberRoleIds(interaction),
      channelId: interaction.channelId ?? null,
    },
  );

  if (!result.ok) {
    if (result.kind === "config" || result.kind === "network") {
      console.warn(`[commandsAccess] API indisponible pour check de /${commandName}, on autorise.`);
      return true;
    }
    console.warn(`[commandsAccess] API a refusé l'évaluation de /${commandName} :`, result.message);
    return true;
  }

  if (result.data.allowed) return true;

  try {
    await interaction.reply({ content: reasonMessage(result.data.reason), ephemeral: true });
  } catch {
    // ignore
  }
  return false;
}

function replaceVariables(
  raw: string | null | undefined,
  interaction: ChatInputCommandInteraction,
): string | null {
  if (raw === null || raw === undefined) return null;
  const userMention = interaction.user.toString();
  const userName = interaction.user.username;
  const guildName = interaction.guild?.name ?? "";
  const channelMention =
    interaction.channelId ? `<#${interaction.channelId}>` : "";
  const channelName =
    interaction.channel && "name" in interaction.channel && interaction.channel.name
      ? interaction.channel.name
      : "";

  return raw
    .replaceAll("{user.mention}", userMention)
    .replaceAll("{user}", userMention)
    .replaceAll("{user.name}", userName)
    .replaceAll("{server}", guildName)
    .replaceAll("{server.name}", guildName)
    .replaceAll("{channel}", channelMention)
    .replaceAll("{channel.mention}", channelMention)
    .replaceAll("{channel.name}", channelName);
}

function buildEmbedsFromTemplate(
  template: TemplateDto,
  interaction: ChatInputCommandInteraction,
): { content: string | null; embeds: EmbedBuilder[] } {
  const first = template.messages[0];
  if (!first) return { content: null, embeds: [] };

  const content = replaceVariables(first.messageContent ?? null, interaction);
  const embeds: EmbedBuilder[] = [];
  for (const part of first.embeds ?? []) {
    const b = new EmbedBuilder();
    const title = replaceVariables(part.title ?? null, interaction);
    const desc = replaceVariables(part.description ?? null, interaction);
    if (title) b.setTitle(title);
    if (desc) b.setDescription(desc);
    if (typeof part.color === "number") b.setColor(part.color);
    if (part.url) b.setURL(part.url);
    if (part.thumbnailUrl) b.setThumbnail(part.thumbnailUrl);
    if (part.imageUrl) b.setImage(part.imageUrl);
    if (part.authorName) {
      b.setAuthor({
        name: replaceVariables(part.authorName, interaction) ?? part.authorName,
        url: part.authorUrl ?? undefined,
        iconURL: part.authorIconUrl ?? undefined,
      });
    }
    if (part.footerText) {
      b.setFooter({
        text: replaceVariables(part.footerText, interaction) ?? part.footerText,
        iconURL: part.footerIconUrl ?? undefined,
      });
    }
    if (part.fields && part.fields.length > 0) {
      b.addFields(
        part.fields.map((f) => ({
          name: replaceVariables(f.name, interaction) ?? f.name,
          value: replaceVariables(f.value, interaction) ?? f.value,
          inline: f.inline ?? false,
        })),
      );
    }
    embeds.push(b);
  }
  return { content, embeds };
}

/**
 * Tente d'exécuter une commande slash *non native* comme commande personnalisée.
 * Retourne `true` si la commande a été reconnue (qu'elle ait été acceptée ou
 * refusée), `false` si l'API ne la connaît pas (le bot répondra alors « commande
 * inconnue »).
 */
export async function tryRunCustomSlashCommand(
  env: BotEnv,
  interaction: ChatInputCommandInteraction,
): Promise<boolean> {
  if (!interaction.guildId) return false;

  const result = await vexInternalPostJson<ResolveCustomResponse>(env, "/commands/resolve-custom", {
    discordGuildId: interaction.guildId,
    commandName: interaction.commandName,
    memberRoleIds: extractMemberRoleIds(interaction),
    channelId: interaction.channelId ?? null,
  });

  if (!result.ok) {
    if (result.kind === "config" || result.kind === "network") {
      return false;
    }
    console.warn(
      `[commandsAccess] API a refusé la résolution de /${interaction.commandName} :`,
      result.message,
    );
    return false;
  }

  const data = result.data;
  if (!data.ok) {
    if (data.reason === "not_found") return false;
    try {
      await interaction.reply({ content: reasonMessage(data.reason), ephemeral: true });
    } catch {
      // ignore
    }
    return true;
  }

  // Envoi de la réponse
  if (data.responseType === "PLAIN_TEXT") {
    const content = replaceVariables(data.responseText ?? "", interaction) ?? "";
    await interaction.reply({
      content: content.length > 0 ? content : " ",
      ephemeral: data.ephemeral,
    });
    return true;
  }

  if (data.responseType === "EMBED_TEMPLATE" && data.template) {
    const { content, embeds } = buildEmbedsFromTemplate(data.template, interaction);
    if (embeds.length === 0 && !content) {
      await interaction.reply({
        content: "(Ce modèle d'embed est vide.)",
        ephemeral: true,
      });
      return true;
    }
    await interaction.reply({
      content: content ?? undefined,
      embeds,
      ephemeral: data.ephemeral,
    });
    return true;
  }

  // Fallback : si le type n'est pas géré (ex: EMBED_INLINE) ou s'il manque le template.
  await interaction.reply({
    content: "Cette commande personnalisée n'a pas de contenu utilisable.",
    ephemeral: true,
  });
  return true;
}
