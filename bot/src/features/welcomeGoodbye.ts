import { EmbedBuilder, type GuildMember, type PartialGuildMember } from "discord.js";
import { loadEnv } from "../config/env.js";
import { vexInternalGetJson, vexInternalPostJson } from "../lib/vexApi.js";
import { applyWelcomePlaceholders, type WelcomePlaceholderContext } from "../lib/welcomePlaceholders.js";

const DEFAULT_EMBED_COLOR = 0x5865f2;

export type WelcomeGoodbyeSettingsPayload = {
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
};

async function fetchSettings(guildId: string): Promise<WelcomeGoodbyeSettingsPayload | null> {
  const env = loadEnv();
  const res = await vexInternalGetJson<{ settings: WelcomeGoodbyeSettingsPayload }>(
    env,
    `/welcome-goodbye/${guildId}`,
  );
  if (!res.ok) return null;
  return res.data.settings;
}

function buildJoinCtx(member: GuildMember): WelcomePlaceholderContext {
  const g = member.guild;
  return {
    userId: member.id,
    userName: member.user.username,
    displayName: member.displayName,
    serverName: g.name,
    memberCount: g.memberCount,
  };
}

async function buildLeaveCtx(member: GuildMember | PartialGuildMember): Promise<WelcomePlaceholderContext> {
  const g = member.guild;
  let userName = "membre";
  let displayName = "Un membre";
  const u = member.user;
  if (u) {
    const full = u.partial ? await u.fetch().catch(() => u) : u;
    userName = full.username;
    displayName = full.globalName ?? full.username;
  } else if ("displayName" in member && typeof member.displayName === "string" && member.displayName) {
    displayName = member.displayName;
  }
  return {
    userId: member.id,
    userName,
    displayName,
    serverName: g.name,
    memberCount: g.memberCount,
  };
}

function placeholderPayload(ctx: WelcomePlaceholderContext) {
  return {
    userId: ctx.userId,
    userName: ctx.userName,
    displayName: ctx.displayName,
    serverName: ctx.serverName,
    memberCount: ctx.memberCount,
  };
}

export async function runWelcomeForMember(member: GuildMember): Promise<void> {
  if (member.user.bot) return;

  const settings = await fetchSettings(member.guild.id);
  if (!settings || !settings.moduleEnabled) return;

  const ctx = buildJoinCtx(member);

  if (settings.welcomeMessagesEnabled && settings.welcomeChannelId) {
    const ch = await member.guild.channels.fetch(settings.welcomeChannelId).catch(() => null);
    if (ch?.isTextBased() && !ch.isDMBased()) {
      const env = loadEnv();
      try {
        if (settings.welcomeEmbedId?.trim()) {
          const send = await vexInternalPostJson<{ ok: boolean }>(env, "/send-embed-template-by-id", {
            discordGuildId: member.guild.id,
            channelId: settings.welcomeChannelId,
            embedId: settings.welcomeEmbedId.trim(),
            placeholderContext: placeholderPayload(ctx),
          });
          if (!send.ok || !send.data?.ok) {
            console.error(
              "[welcome-goodbye] envoi modèle d’arrivée",
              send.ok ? JSON.stringify(send.data) : send.message,
            );
          }
        } else if (settings.welcomeContent?.trim()) {
          const text = applyWelcomePlaceholders(settings.welcomeContent, ctx).trim();
          if (text) {
            if (settings.welcomeUseEmbed) {
              const emb = new EmbedBuilder()
                .setDescription(text.slice(0, 4096))
                .setColor(settings.welcomeEmbedColor ?? DEFAULT_EMBED_COLOR);
              await ch.send({ embeds: [emb] });
            } else {
              await ch.send({ content: text.slice(0, 2000) });
            }
          }
        }
      } catch (err) {
        console.error("[welcome-goodbye] envoi message d’arrivée", err);
      }
    }
  }

  if (
    settings.welcomeMessagesEnabled &&
    settings.dmWelcomeEnabled &&
    settings.dmWelcomeContent?.trim()
  ) {
    const text = applyWelcomePlaceholders(settings.dmWelcomeContent, ctx).trim();
    if (text) {
      try {
        await member.send({ content: text.slice(0, 2000) });
      } catch {
        // MP fermés ou refusés : on ignore.
      }
    }
  }
}

export async function runGoodbyeForMember(member: GuildMember | PartialGuildMember): Promise<void> {
  if (member.user?.bot) return;

  const settings = await fetchSettings(member.guild.id);
  if (!settings || !settings.moduleEnabled) return;

  const ctx = await buildLeaveCtx(member);

  if (settings.goodbyeMessagesEnabled && settings.goodbyeChannelId) {
    const ch = await member.guild.channels.fetch(settings.goodbyeChannelId).catch(() => null);
    if (ch?.isTextBased() && !ch.isDMBased()) {
      const env = loadEnv();
      try {
        if (settings.goodbyeEmbedId?.trim()) {
          const send = await vexInternalPostJson<{ ok: boolean }>(env, "/send-embed-template-by-id", {
            discordGuildId: member.guild.id,
            channelId: settings.goodbyeChannelId,
            embedId: settings.goodbyeEmbedId.trim(),
            placeholderContext: placeholderPayload(ctx),
          });
          if (!send.ok || !send.data?.ok) {
            console.error(
              "[welcome-goodbye] envoi modèle de départ",
              send.ok ? JSON.stringify(send.data) : send.message,
            );
          }
        } else if (settings.goodbyeContent?.trim()) {
          const text = applyWelcomePlaceholders(settings.goodbyeContent, ctx).trim();
          if (text) {
            if (settings.goodbyeUseEmbed) {
              const emb = new EmbedBuilder()
                .setDescription(text.slice(0, 4096))
                .setColor(settings.goodbyeEmbedColor ?? DEFAULT_EMBED_COLOR);
              await ch.send({ embeds: [emb] });
            } else {
              await ch.send({ content: text.slice(0, 2000) });
            }
          }
        }
      } catch (err) {
        console.error("[welcome-goodbye] envoi message de départ", err);
      }
    }
  }
}
