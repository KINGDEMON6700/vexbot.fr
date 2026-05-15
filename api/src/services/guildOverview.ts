import { PrismaClient } from "@prisma/client";
import type { DiscordGuild } from "../types/discord.js";
import { buildBotInviteUrl, isBotMemberOfGuild } from "./eligibleGuilds.js";

const DISCORD_API = "https://discord.com/api/v10";
const OVERVIEW_DISCORD_CACHE_TTL_MS = 20_000;

export function discordSnowflakeToIso(snowflake: string): string {
  const ms = Number((BigInt(snowflake) >> 22n) + 1420070400000n);
  return new Date(ms).toISOString();
}

export function guildIconUrl(guildId: string, icon: string | null, size = 128): string | null {
  if (!icon) return null;
  const ext = icon.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/icons/${guildId}/${icon}.${ext}?size=${size}`;
}

type CachedBotUser = {
  id: string;
  username: string;
  avatar: string | null;
  banner: string | null;
  globalName: string | null;
};

let cachedBotUser: CachedBotUser | null = null;
const discordJsonCache = new Map<string, { at: number; data: unknown }>();

async function getBotUser(botToken: string): Promise<CachedBotUser> {
  if (cachedBotUser) return cachedBotUser;
  const res = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bot ${botToken}` },
  });
  if (!res.ok) {
    throw new Error(`Impossible de lire le profil du bot (${res.status})`);
  }
  const u = (await res.json()) as {
    id: string;
    username: string;
    avatar: string | null;
    banner: string | null;
    global_name: string | null;
  };
  cachedBotUser = {
    id: u.id,
    username: u.username,
    avatar: u.avatar ?? null,
    banner: u.banner ?? null,
    globalName: u.global_name ?? null,
  };
  return cachedBotUser;
}

async function getBotUserId(botToken: string): Promise<string> {
  const u = await getBotUser(botToken);
  return u.id;
}

/** Avatar / bannière affichés sur ce serveur (profil serveur Nitro / fonctionnalités Discord). */
export function guildMemberAvatarUrl(
  guildId: string,
  userId: string,
  hash: string | null,
  size = 128,
): string | null {
  if (!hash) return null;
  const ext = hash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/guilds/${guildId}/users/${userId}/avatars/${hash}.${ext}?size=${size}`;
}

export function guildMemberBannerUrl(
  guildId: string,
  userId: string,
  hash: string | null,
  size = 600,
): string | null {
  if (!hash) return null;
  const ext = hash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/guilds/${guildId}/users/${userId}/banners/${hash}.${ext}?size=${size}`;
}

/** Avatar du compte bot (défaut sur tous les serveurs si pas de photo serveur). */
export function discordUserAvatarUrl(userId: string, hash: string | null, size = 128): string | null {
  if (!hash) return null;
  const ext = hash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${userId}/${hash}.${ext}?size=${size}`;
}

/** Bannière du profil bot (défaut, tous les serveurs). */
export function discordUserBannerUrl(userId: string, hash: string | null, size = 600): string | null {
  if (!hash) return null;
  const ext = hash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/banners/${userId}/${hash}.${ext}?size=${size}`;
}

type DiscordApiGuild = {
  id: string;
  name: string;
  icon: string | null;
  approximate_member_count?: number;
  approximate_presence_count?: number;
  premium_tier?: number;
  premium_subscription_count?: number;
};

export type OverviewDiscordBlock = {
  name: string;
  iconUrl: string | null;
  memberCount: number | null;
  onlineCount: number | null;
  /** Tous les canaux renvoyés par Discord (catégories + salons, etc.) */
  channelCount: number | null;
  channelCategoriesCount: number | null;
  /** Texte (0) et salons d’annonces (5) */
  channelTextCount: number | null;
  /** Vocal (2) et scène (13) */
  channelVoiceCount: number | null;
  /** Forums (15) */
  channelForumCount: number | null;
  /** Médias (16), rare sur les petits serveurs */
  channelMediaCount: number | null;
  /** Autres types (ex. annuaire…) — souvent 0 */
  channelOtherCount: number | null;
  roleCount: number | null;
  boostTier: number | null;
  boostCount: number | null;
  createdAtIso: string | null;
  partial: boolean;
  partialNotice: string | null;
};

export type OverviewVexBlock = {
  ticketsOpen: number;
  ticketsClosed: number;
  embedCount: number;
  slashCommandsActive: number;
  sanctionsTotal: number;
};

export type OverviewBotBlock = {
  nickname: string | null;
  /** Identifiant du compte bot (lecture seule, inchangé par ce panel) */
  accountUsername: string;
  /** Photo spécifique à ce serveur (null = tu vois l’avatar par défaut du bot) */
  guildAvatarUrl: string | null;
  /** Bannière spécifique à ce serveur */
  guildBannerUrl: string | null;
  /** Avatar par défaut du bot (tous les serveurs) — utile pour l’aperçu */
  defaultAvatarUrl: string | null;
  /** Bannière par défaut du compte bot (si Discord en fournit une) */
  defaultBannerUrl: string | null;
};

export type GuildOverviewResponse = {
  botPresent: boolean;
  discord: OverviewDiscordBlock;
  vex: OverviewVexBlock | null;
  bot: OverviewBotBlock | null;
  inviteUrl: string | null;
};

/** Compte les canaux par type (API Discord v10, champ `type`). */
function summarizeGuildChannels(channels: unknown[]): {
  total: number;
  categories: number;
  text: number;
  voice: number;
  forums: number;
  media: number;
  other: number;
} {
  const out = {
    total: 0,
    categories: 0,
    text: 0,
    voice: 0,
    forums: 0,
    media: 0,
    other: 0,
  };
  if (!Array.isArray(channels)) return out;
  out.total = channels.length;
  for (const raw of channels) {
    if (!raw || typeof raw !== "object" || !("type" in raw)) continue;
    const t = Number((raw as { type: number }).type);
    if (t === 4) out.categories += 1;
    else if (t === 0 || t === 5) out.text += 1;
    else if (t === 2 || t === 13) out.voice += 1;
    else if (t === 15) out.forums += 1;
    else if (t === 16) out.media += 1;
    else out.other += 1;
  }
  return out;
}

async function fetchJson<T>(url: string, botToken: string): Promise<T> {
  const cacheHit = discordJsonCache.get(url);
  const now = Date.now();
  if (cacheHit && now - cacheHit.at < OVERVIEW_DISCORD_CACHE_TTL_MS) {
    return cacheHit.data as T;
  }

  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const res = await fetch(url, {
      headers: { Authorization: `Bot ${botToken}` },
    });
    if (res.ok) {
      const data = (await res.json()) as T;
      discordJsonCache.set(url, { at: Date.now(), data });
      return data;
    }

    if (res.status === 429 && attempt === 0) {
      let retryAfterMs = 1200;
      try {
        const body = (await res.json()) as { retry_after?: number };
        if (typeof body.retry_after === "number" && Number.isFinite(body.retry_after)) {
          retryAfterMs = Math.max(250, Math.ceil(body.retry_after * 1000));
        }
      } catch {
        // ignore parse error and keep default retry delay
      }
      await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
      continue;
    }

    const text = await res.text();
    lastError = `${url} → ${res.status} ${text}`;
    break;
  }

  throw new Error(lastError || `${url} → 429`);
}

export async function getVexStats(prisma: PrismaClient, discordGuildId: string): Promise<OverviewVexBlock> {
  const row = await prisma.guild.findUnique({
    where: { discordId: discordGuildId },
    select: { id: true },
  });

  if (!row) {
    return {
      ticketsOpen: 0,
      ticketsClosed: 0,
      embedCount: 0,
      slashCommandsActive: 0,
      sanctionsTotal: 0,
    };
  }

  const guildId = row.id;

  const [ticketsOpen, ticketsClosed, embedCount, slashCommandsActive, sanctionsTotal] =
    await Promise.all([
      prisma.ticket.count({ where: { guildId, status: "OPEN" } }),
      prisma.ticket.count({
        where: { guildId, status: { in: ["CLOSED", "ARCHIVED"] } },
      }),
      prisma.embed.count({ where: { guildId } }),
      prisma.customSlashCommand.count({ where: { guildId, enabled: true } }),
      prisma.moderationCase.count({ where: { guildId } }),
    ]);

  return {
    ticketsOpen,
    ticketsClosed,
    embedCount,
    slashCommandsActive,
    sanctionsTotal,
  };
}

export async function buildGuildOverview(
  prisma: PrismaClient,
  discordGuildId: string,
  userGuild: DiscordGuild,
  botToken: string,
  clientId: string,
): Promise<GuildOverviewResponse> {
  const inviteUrl = buildBotInviteUrl(clientId, discordGuildId);

  let botPresent = false;
  try {
    botPresent = await isBotMemberOfGuild(discordGuildId, botToken);
  } catch {
    botPresent = false;
  }

  const baseName = userGuild.name;
  const baseIconUrl = guildIconUrl(discordGuildId, userGuild.icon);

  if (!botPresent) {
    return {
      botPresent: false,
      discord: {
        name: baseName,
        iconUrl: baseIconUrl,
        memberCount: null,
        onlineCount: null,
        channelCount: null,
        channelCategoriesCount: null,
        channelTextCount: null,
        channelVoiceCount: null,
        channelForumCount: null,
        channelMediaCount: null,
        channelOtherCount: null,
        roleCount: null,
        boostTier: null,
        boostCount: null,
        createdAtIso: discordSnowflakeToIso(discordGuildId),
        partial: true,
        partialNotice: "Certaines infos nécessitent que le bot soit sur le serveur.",
      },
      vex: null,
      bot: null,
      inviteUrl,
    };
  }

  const [guild, channels, roles, botUser] = await Promise.all([
    fetchJson<DiscordApiGuild>(
      `${DISCORD_API}/guilds/${discordGuildId}?with_counts=true`,
      botToken,
    ),
    fetchJson<unknown[]>(`${DISCORD_API}/guilds/${discordGuildId}/channels`, botToken),
    fetchJson<unknown[]>(`${DISCORD_API}/guilds/${discordGuildId}/roles`, botToken),
    getBotUser(botToken),
  ]);

  type DiscordApiMember = {
    nick?: string | null;
    avatar?: string | null;
    banner?: string | null;
  };

  let member: DiscordApiMember | null = null;
  try {
    member = await fetchJson<DiscordApiMember>(
      `${DISCORD_API}/guilds/${discordGuildId}/members/${botUser.id}`,
      botToken,
    );
  } catch {
    member = null;
  }

  const nickname = member?.nick ?? null;
  const guildAvatarUrl = guildMemberAvatarUrl(discordGuildId, botUser.id, member?.avatar ?? null);
  const guildBannerUrl = guildMemberBannerUrl(discordGuildId, botUser.id, member?.banner ?? null);
  const defaultAvatarUrl = discordUserAvatarUrl(botUser.id, botUser.avatar);
  const defaultBannerUrl = discordUserBannerUrl(botUser.id, botUser.banner);

  const vex = await getVexStats(prisma, discordGuildId);

  const chStats = Array.isArray(channels) ? summarizeGuildChannels(channels) : null;

  return {
    botPresent: true,
    discord: {
      name: guild.name,
      iconUrl: guildIconUrl(discordGuildId, guild.icon),
      memberCount: guild.approximate_member_count ?? null,
      onlineCount: guild.approximate_presence_count ?? null,
      channelCount: chStats ? chStats.total : null,
      channelCategoriesCount: chStats ? chStats.categories : null,
      channelTextCount: chStats ? chStats.text : null,
      channelVoiceCount: chStats ? chStats.voice : null,
      channelForumCount: chStats ? chStats.forums : null,
      channelMediaCount: chStats ? chStats.media : null,
      channelOtherCount: chStats ? chStats.other : null,
      roleCount: Array.isArray(roles) ? roles.length : null,
      boostTier: guild.premium_tier ?? null,
      boostCount: guild.premium_subscription_count ?? null,
      createdAtIso: discordSnowflakeToIso(discordGuildId),
      partial: false,
      partialNotice: null,
    },
    vex,
    bot: {
      nickname,
      accountUsername: botUser.username,
      guildAvatarUrl,
      guildBannerUrl,
      defaultAvatarUrl,
      defaultBannerUrl,
    },
    inviteUrl: null,
  };
}

const IMAGE_DATA_URI_RE = /^data:image\/(png|jpeg|jpg|gif|webp);base64,/i;

function validateImageDataUri(value: string): void {
  if (!IMAGE_DATA_URI_RE.test(value)) {
    throw new Error("INVALID_IMAGE");
  }
  const comma = value.indexOf(",");
  const b64 = comma >= 0 ? value.slice(comma + 1) : "";
  const approxBytes = (b64.length * 3) / 4;
  if (approxBytes > 8 * 1024 * 1024) {
    throw new Error("IMAGE_TOO_LARGE");
  }
}

export type PatchBotGuildMemberInput = {
  nick?: string | null;
  avatar?: string | null;
  banner?: string | null;
};

export async function patchBotGuildMember(
  discordGuildId: string,
  botToken: string,
  patch: PatchBotGuildMemberInput,
): Promise<void> {
  const present = await isBotMemberOfGuild(discordGuildId, botToken);
  if (!present) {
    throw new Error("BOT_NOT_IN_GUILD");
  }

  const body: Record<string, string | null> = {};

  if (patch.nick !== undefined) {
    const n = patch.nick;
    body.nick = n === null || n === "" ? null : n.trim().slice(0, 32) || null;
  }

  if (patch.avatar !== undefined) {
    if (patch.avatar === null) {
      body.avatar = null;
    } else {
      validateImageDataUri(patch.avatar);
      body.avatar = patch.avatar;
    }
  }

  if (patch.banner !== undefined) {
    if (patch.banner === null) {
      body.banner = null;
    } else {
      validateImageDataUri(patch.banner);
      body.banner = patch.banner;
    }
  }

  if (Object.keys(body).length === 0) {
    throw new Error("EMPTY_PATCH");
  }

  const res = await fetch(`${DISCORD_API}/guilds/${discordGuildId}/members/@me`, {
    method: "PATCH",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DISCORD_${res.status}:${text}`);
  }
}

export async function patchBotNickname(
  discordGuildId: string,
  nickname: string | null,
  botToken: string,
): Promise<void> {
  const trimmed = nickname === null || nickname === "" ? null : nickname.trim().slice(0, 32);
  await patchBotGuildMember(discordGuildId, botToken, { nick: trimmed });
}
