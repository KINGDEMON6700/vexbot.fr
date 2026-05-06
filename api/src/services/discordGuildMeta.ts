const DISCORD_API = "https://discord.com/api/v10";

/** Salons qu’on peut mentionner avec &lt;#id&gt; (texte, annonces, vocal, threads, forums, etc.). */
const MENTIONABLE_CHANNEL_TYPES = new Set([0, 2, 5, 11, 12, 13, 15, 16]);
/** Salons texte utilisables pour envoyer un message. */
const SENDABLE_TEXT_CHANNEL_TYPES = new Set([0, 5]);

type DiscordChannel = {
  id: string;
  name: string;
  type: number;
  position: number;
  parent_id: string | null;
};

type DiscordRole = {
  id: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
};

export type GuildChannelOption = {
  id: string;
  name: string;
};

export type GuildRoleOption = {
  id: string;
  name: string;
  color: number;
};

type CacheEntry = { at: number; payload: { channels: GuildChannelOption[]; roles: GuildRoleOption[] } };
const cache = new Map<string, CacheEntry>();
type TextChannelsCacheEntry = { at: number; payload: GuildChannelOption[] };
const textChannelsCache = new Map<string, TextChannelsCacheEntry>();
const TTL_MS = 60_000;

function sortChannelsWithCategories(
  channelsRaw: DiscordChannel[],
  allowedTypes: Set<number>,
): GuildChannelOption[] {
  const categories = channelsRaw
    .filter((c) => c.type === 4)
    .sort((a, b) => a.position - b.position);

  const allowed = channelsRaw.filter((c) => allowedTypes.has(c.type));
  const channels: GuildChannelOption[] = [];

  for (const cat of categories) {
    const children = allowed
      .filter((c) => c.parent_id === cat.id)
      .sort((a, b) => a.position - b.position);
    for (const ch of children) {
      channels.push({ id: ch.id, name: `${cat.name} — ${ch.name}` });
    }
  }

  const uncategorized = allowed
    .filter((c) => c.parent_id === null)
    .sort((a, b) => a.position - b.position);
  for (const ch of uncategorized) {
    channels.push({ id: ch.id, name: ch.name });
  }

  return channels;
}

export async function getGuildChannelsAndRoles(
  discordGuildId: string,
  botToken: string,
): Promise<{ channels: GuildChannelOption[]; roles: GuildRoleOption[] }> {
  const now = Date.now();
  const hit = cache.get(discordGuildId);
  if (hit && now - hit.at < TTL_MS) return hit.payload;

  const [chRes, roleRes] = await Promise.all([
    fetch(`${DISCORD_API}/guilds/${discordGuildId}/channels`, {
      headers: { Authorization: `Bot ${botToken}` },
    }),
    fetch(`${DISCORD_API}/guilds/${discordGuildId}/roles`, {
      headers: { Authorization: `Bot ${botToken}` },
    }),
  ]);

  if (chRes.status === 404 || roleRes.status === 404) {
    throw new Error("BOT_OR_GUILD_MISSING");
  }
  if (!chRes.ok) {
    throw new Error(`CHANNELS_${chRes.status}`);
  }
  if (!roleRes.ok) {
    throw new Error(`ROLES_${roleRes.status}`);
  }

  const channelsRaw = (await chRes.json()) as DiscordChannel[];
  const rolesRaw = (await roleRes.json()) as DiscordRole[];

  const channels = sortChannelsWithCategories(channelsRaw, MENTIONABLE_CHANNEL_TYPES);

  const roles: GuildRoleOption[] = rolesRaw
    .filter((r) => r.name !== "@everyone")
    .sort((a, b) => b.position - a.position)
    .map((r) => ({ id: r.id, name: r.name, color: r.color }));

  const payload = { channels, roles };
  cache.set(discordGuildId, { at: now, payload });
  return payload;
}

export async function getGuildTextChannels(
  discordGuildId: string,
  botToken: string,
): Promise<GuildChannelOption[]> {
  const now = Date.now();
  const hit = textChannelsCache.get(discordGuildId);
  if (hit && now - hit.at < TTL_MS) return hit.payload;

  const chRes = await fetch(`${DISCORD_API}/guilds/${discordGuildId}/channels`, {
    headers: { Authorization: `Bot ${botToken}` },
  });

  if (chRes.status === 404) {
    throw new Error("BOT_OR_GUILD_MISSING");
  }
  if (!chRes.ok) {
    throw new Error(`CHANNELS_${chRes.status}`);
  }

  const channelsRaw = (await chRes.json()) as DiscordChannel[];
  const channels = sortChannelsWithCategories(channelsRaw, SENDABLE_TEXT_CHANNEL_TYPES);
  textChannelsCache.set(discordGuildId, { at: now, payload: channels });
  return channels;
}
