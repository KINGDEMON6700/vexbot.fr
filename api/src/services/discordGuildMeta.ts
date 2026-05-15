const DISCORD_API = "https://discord.com/api/v10";

/** Salons qu’on peut mentionner avec &lt;#id&gt; (texte, annonces, vocal, threads, forums, etc.). */
const MENTIONABLE_CHANNEL_TYPES = new Set([0, 2, 5, 11, 12, 13, 15, 16]);
/** Salons texte utilisables pour envoyer un message. */
const SENDABLE_TEXT_CHANNEL_TYPES = new Set([0, 5]);
const THREAD_CHANNEL_TYPES = new Set([11, 12]);

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

/** Membre Discord pour le sélecteur de mention (panel). */
export type GuildMemberPickOption = {
  id: string;
  displayName: string;
  username: string;
};

type CacheEntry = { at: number; payload: { channels: GuildChannelOption[]; roles: GuildRoleOption[] } };
const cache = new Map<string, CacheEntry>();
type TextChannelsCacheEntry = { at: number; payload: GuildChannelOption[] };
const textChannelsCache = new Map<string, TextChannelsCacheEntry>();
type ThreadsCacheEntry = { at: number; payload: GuildChannelOption[] };
const threadsCache = new Map<string, ThreadsCacheEntry>();
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

type MembersPickCacheEntry = { at: number; payload: GuildMemberPickOption[] };
const membersPickCache = new Map<string, MembersPickCacheEntry>();
const MEMBERS_PICK_TTL_MS = 20_000;

/**
 * Liste des membres pour le panel (mentions utilisateur).
 * Utilise l’API « List Guild Members » : sans `query`, renvoie jusqu’à `limit` membres ;
 * avec `query`, recherche par préfixe sur pseudo / surnom (Discord).
 */
export async function getGuildMembersForPanel(
  discordGuildId: string,
  botToken: string,
  options: { query?: string; limit?: number } = {},
): Promise<GuildMemberPickOption[]> {
  const trimmedQuery = options.query?.trim();
  const defaultLimit = trimmedQuery ? 100 : 200;
  const limit = Math.min(Math.max(options.limit ?? defaultLimit, 1), 1000);

  const cacheKey = `${discordGuildId}:${trimmedQuery ?? ""}:${limit}`;
  const now = Date.now();
  const hit = membersPickCache.get(cacheKey);
  if (hit && now - hit.at < MEMBERS_PICK_TTL_MS) return hit.payload;

  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (trimmedQuery) {
    params.set("query", trimmedQuery);
  }

  const res = await fetch(`${DISCORD_API}/guilds/${discordGuildId}/members?${params.toString()}`, {
    headers: { Authorization: `Bot ${botToken}` },
  });

  if (res.status === 404) {
    throw new Error("BOT_OR_GUILD_MISSING");
  }
  if (!res.ok) {
    if (res.status === 403 || res.status === 401) {
      throw new Error("MEMBERS_LIST_FORBIDDEN");
    }
    throw new Error(`MEMBERS_${res.status}`);
  }

  const raw = (await res.json()) as Array<{
    user?: { id: string; username: string; global_name?: string | null };
    nick?: string | null;
  }>;

  const out: GuildMemberPickOption[] = [];
  for (const m of raw) {
    const u = m.user;
    if (!u?.id) continue;
    const fromNick = m.nick?.trim();
    const fromGlobal = u.global_name?.trim();
    const displayName = fromNick || fromGlobal || u.username;
    out.push({ id: u.id, displayName, username: u.username });
  }

  out.sort((a, b) => a.displayName.localeCompare(b.displayName, "fr", { sensitivity: "base" }));

  membersPickCache.set(cacheKey, { at: now, payload: out });
  return out;
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

export async function getGuildThreads(
  discordGuildId: string,
  botToken: string,
): Promise<GuildChannelOption[]> {
  const now = Date.now();
  const hit = threadsCache.get(discordGuildId);
  if (hit && now - hit.at < TTL_MS) return hit.payload;

  const [channelsRes, activeThreadsRes] = await Promise.all([
    fetch(`${DISCORD_API}/guilds/${discordGuildId}/channels`, {
      headers: { Authorization: `Bot ${botToken}` },
    }),
    fetch(`${DISCORD_API}/guilds/${discordGuildId}/threads/active`, {
      headers: { Authorization: `Bot ${botToken}` },
    }),
  ]);

  if (channelsRes.status === 404 || activeThreadsRes.status === 404) {
    throw new Error("BOT_OR_GUILD_MISSING");
  }
  if (!channelsRes.ok) {
    throw new Error(`CHANNELS_${channelsRes.status}`);
  }
  if (!activeThreadsRes.ok) {
    throw new Error(`THREADS_${activeThreadsRes.status}`);
  }

  const channelsRaw = (await channelsRes.json()) as DiscordChannel[];
  const categoryOrTextById = new Map(channelsRaw.map((c) => [c.id, c]));
  const activePayload = (await activeThreadsRes.json()) as { threads?: DiscordChannel[] };
  const activeThreadsRaw = Array.isArray(activePayload.threads) ? activePayload.threads : [];

  const fromChannels = channelsRaw.filter((c) => THREAD_CHANNEL_TYPES.has(c.type));
  const merged = [...fromChannels, ...activeThreadsRaw];
  const dedup = new Map<string, DiscordChannel>();
  for (const thread of merged) {
    if (!dedup.has(thread.id)) dedup.set(thread.id, thread);
  }

  const payload = [...dedup.values()]
    .sort((a, b) => a.position - b.position)
    .map((thread) => {
      const parent = thread.parent_id ? categoryOrTextById.get(thread.parent_id) : null;
      return {
        id: thread.id,
        name: parent ? `${parent.name} — ${thread.name}` : thread.name,
      };
    });

  threadsCache.set(discordGuildId, { at: now, payload });
  return payload;
}

type CategoriesCacheEntry = { at: number; payload: GuildChannelOption[] };
const categoriesCache = new Map<string, CategoriesCacheEntry>();

/** Catégories Discord (salons de type 4), pour placer les salons de tickets. */
export async function getGuildCategories(
  discordGuildId: string,
  botToken: string,
): Promise<GuildChannelOption[]> {
  const now = Date.now();
  const hit = categoriesCache.get(discordGuildId);
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
  const payload = channelsRaw
    .filter((c) => c.type === 4)
    .sort((a, b) => a.position - b.position)
    .map((c) => ({ id: c.id, name: c.name }));

  categoriesCache.set(discordGuildId, { at: now, payload });
  return payload;
}
