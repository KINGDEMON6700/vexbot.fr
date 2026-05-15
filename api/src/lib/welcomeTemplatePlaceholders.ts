import type { TemplateMessageDto } from "../services/embedTemplateService.js";
import type { MessageComponentInput } from "../services/messageComponentsSchema.js";

/** Même champs que le bot (`welcomePlaceholders.ts`) pour les variables {user}, etc. */
export type WelcomePlaceholderContextDto = {
  userId: string;
  userName: string;
  displayName: string;
  serverName: string;
  memberCount: number;
};

function applyToString(template: string, ctx: WelcomePlaceholderContextDto): string {
  return template
    .replaceAll("{user}", ctx.displayName)
    .replaceAll("{user.mention}", `<@${ctx.userId}>`)
    .replaceAll("{user.name}", ctx.userName)
    .replaceAll("{user.id}", ctx.userId)
    .replaceAll("{server}", ctx.serverName)
    .replaceAll("{guild}", ctx.serverName)
    .replaceAll("{memberCount}", String(ctx.memberCount));
}

function mapNullable(s: string | null | undefined, ctx: WelcomePlaceholderContextDto): string | null {
  if (s == null) return null;
  const t = s.trim();
  if (!t) return null;
  return applyToString(s, ctx);
}

function mapComponent(c: MessageComponentInput, ctx: WelcomePlaceholderContextDto): MessageComponentInput {
  if (c.type === "button") {
    return { ...c, label: applyToString(c.label, ctx) };
  }
  return {
    ...c,
    label: applyToString(c.label, ctx),
    url: applyToString(c.url, ctx),
  };
}

/**
 * Applique les variables d’arrivée / départ sur tout le texte d’un modèle Embeds avant envoi Discord.
 */
export function applyWelcomePlaceholdersToTemplateMessages(
  messages: TemplateMessageDto[],
  ctx: WelcomePlaceholderContextDto,
): TemplateMessageDto[] {
  return messages.map((msg) => ({
    ...msg,
    messageContent: mapNullable(msg.messageContent, ctx),
    profileDisplayName: mapNullable(msg.profileDisplayName, ctx),
    threadName: mapNullable(msg.threadName, ctx),
    embeds: msg.embeds.map((e) => ({
      ...e,
      title: mapNullable(e.title, ctx),
      description: mapNullable(e.description, ctx),
      url: mapNullable(e.url, ctx),
      thumbnailUrl: mapNullable(e.thumbnailUrl, ctx),
      imageUrl: mapNullable(e.imageUrl, ctx),
      authorName: mapNullable(e.authorName, ctx),
      authorUrl: mapNullable(e.authorUrl, ctx),
      authorIconUrl: mapNullable(e.authorIconUrl, ctx),
      footerText: mapNullable(e.footerText, ctx),
      footerIconUrl: mapNullable(e.footerIconUrl, ctx),
      fields: e.fields?.map((f) => ({
        name: applyToString(f.name, ctx),
        value: applyToString(f.value, ctx),
        inline: f.inline ?? false,
      })),
    })),
    componentBlocks: msg.componentBlocks.map((block) => ({
      rows: block.rows.map((row) => ({
        components: row.components.map((c) => mapComponent(c, ctx)),
      })),
    })),
  }));
}
